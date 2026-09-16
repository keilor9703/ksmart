from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, datetime, timezone
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ
from crud.productos import get_producto
from crud.inventario import create_movement


# _get_resolucion_activa / _asignar_numero_factura vivían duplicadas aquí con
# un read-modify-write en Python sobre numero_actual (sin lock): dos ventas
# concurrentes de la misma empresa podían recibir el MISMO consecutivo DIAN,
# lo cual la DIAN rechaza. Se unificó en crud.ventas con un UPDATE...RETURNING
# atómico; este módulo reusa esa única implementación en vez de mantener una
# segunda copia con el mismo bug (afecta la conversión de cotización a venta).
from crud.ventas import _get_resolucion_activa, _asignar_numero_factura  # noqa: F401,E402


def _ejecutar_movimientos_venta(db: Session, empresa_id: int, db_venta: models.Venta):
    """
    Crea los movimientos de inventario para cada detalle de la venta.
    Aplica FEFO si el producto maneja lotes, descuento estándar en caso contrario.
    Reutilizable desde create_venta (main.py) y convertir_cotizacion.
    """
    from crud.perecederos import consumir_stock_fefo

    for det in db_venta.detalles:
        prod = get_producto(db, empresa_id=empresa_id, producto_id=det.producto_id)
        if not prod or prod.es_servicio:
            continue

        if getattr(prod, "maneja_lotes", False):
            try:
                consumir_stock_fefo(
                    db, empresa_id=empresa_id,
                    producto_id=det.producto_id,
                    cantidad_requerida=det.cantidad,
                    referencia=f"Venta #{db_venta.numero_venta or db_venta.id}",
                    commit=False,
                )
                prod.stock_actual = (prod.stock_actual or 0) - det.cantidad
                db.add(prod)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
        else:
            create_movement(db, empresa_id=empresa_id, payload=schemas.InventoryMovementCreate(
                producto_id    = det.producto_id,
                tipo           = schemas.MovementType.salida,
                cantidad       = det.cantidad,
                costo_unitario = prod.costo or 0.0,
                motivo         = "venta",
                referencia     = f"venta #{db_venta.numero_venta or db_venta.id}",
            ))


# ════════════════════════════════════════════════════════════════════════════
# FASE 2A — CRUD DE RESOLUCIONES DIAN
# ════════════════════════════════════════════════════════════════════════════

def get_resoluciones(db: Session, empresa_id: int) -> List[models.ResolucionDian]:
    """Lista todas las resoluciones de la empresa, ordenadas por id desc."""
    resoluciones = db.query(models.ResolucionDian).filter(
        models.ResolucionDian.empresa_id == empresa_id
    ).order_by(models.ResolucionDian.id.desc()).all()

    # Enriquecer con campos calculados
    hoy = date.today()
    resultado = []
    for r in resoluciones:
        dias_para_vencer = None
        if r.vigencia_hasta:
            dias_para_vencer = (r.vigencia_hasta - hoy).days

        r_dict = {
            "id":                   r.id,
            "empresa_id":           r.empresa_id,
            "tipo":                 getattr(r, "tipo", None) or "fe",
            "prefijo":              r.prefijo or "",
            "numero_resolucion":    r.numero_resolucion,
            "numero_actual":        r.numero_actual,
            "numero_inicial":       r.numero_inicial,
            "numero_final":         r.numero_final,
            "vigencia_desde":       r.vigencia_desde,
            "vigencia_hasta":       r.vigencia_hasta,
            "is_active":            r.is_active,
            "created_at":           r.created_at,
            "clave_tecnica":        getattr(r, "clave_tecnica", None),
            "nota":                 getattr(r, "nota", None),
            "numeros_disponibles":  r.numero_final - r.numero_actual,
            "porcentaje_usado":     round(
                ((r.numero_actual - r.numero_inicial) /
                 max(r.numero_final - r.numero_inicial, 1)) * 100, 1
            ) if r.numero_actual > 0 else 0.0,
            "esta_vigente": (
                (r.vigencia_hasta is None or r.vigencia_hasta >= hoy) and
                r.numero_actual < r.numero_final
            ),
            "dias_para_vencer": dias_para_vencer,
        }
        resultado.append(r_dict)
    return resultado


def create_resolucion(
    db: Session,
    empresa_id: int,
    payload: schemas.ResolucionDianCreate,
) -> models.ResolucionDian:
    """Crea una resolución. Si is_active=True desactiva las demás."""
    resolucion = models.ResolucionDian(
        empresa_id        = empresa_id,
        tipo              = (payload.tipo or "fe"),
        prefijo           = payload.prefijo or "",
        numero_resolucion = payload.numero_resolucion,
        numero_actual     = payload.numero_inicial - 1,
        numero_inicial    = payload.numero_inicial,
        numero_final      = payload.numero_final,
        vigencia_desde    = payload.vigencia_desde,
        vigencia_hasta    = payload.vigencia_hasta,
        clave_tecnica     = payload.clave_tecnica,
        nota              = payload.nota,
        is_active         = False,
    )
    db.add(resolucion)
    db.commit()
    db.refresh(resolucion)
    return resolucion


def update_resolucion(
    db: Session,
    empresa_id: int,
    resolucion_id: int,
    payload: schemas.ResolucionDianUpdate,
) -> Optional[models.ResolucionDian]:
    resolucion = db.query(models.ResolucionDian).filter(
        models.ResolucionDian.id         == resolucion_id,
        models.ResolucionDian.empresa_id == empresa_id,
    ).first()
    if not resolucion:
        return None

    for key, val in payload.dict(exclude_unset=True).items():
        setattr(resolucion, key, val)

    db.commit()
    db.refresh(resolucion)
    return resolucion


def activar_resolucion(
    db: Session,
    empresa_id: int,
    resolucion_id: int,
) -> Optional[models.ResolucionDian]:
    """
    Activa una resolución y desactiva las demás DEL MISMO TIPO de la empresa.
    Una empresa puede tener simultáneamente una resolución 'fe' y una 'pos' activas.
    """
    # Localizar la resolución a activar primero (para conocer su tipo)
    resolucion = db.query(models.ResolucionDian).filter(
        models.ResolucionDian.id         == resolucion_id,
        models.ResolucionDian.empresa_id == empresa_id,
    ).first()
    if not resolucion:
        db.rollback()
        return None

    tipo_res = getattr(resolucion, "tipo", None) or "fe"
    # Desactivar las demás del mismo tipo (incluye legados 'fe' con tipo NULL)
    from sqlalchemy import or_
    q = db.query(models.ResolucionDian).filter(
        models.ResolucionDian.empresa_id == empresa_id,
    )
    if tipo_res == "fe":
        q = q.filter(or_(
            models.ResolucionDian.tipo == "fe",
            models.ResolucionDian.tipo.is_(None),
            models.ResolucionDian.tipo == "",
        ))
    else:
        q = q.filter(models.ResolucionDian.tipo == tipo_res)
    q.update({"is_active": False}, synchronize_session=False)

    resolucion.is_active = True
    db.commit()
    db.refresh(resolucion)
    return resolucion


def ajustar_numero_resolucion(
    db: Session,
    empresa_id: int,
    resolucion_id: int,
    nuevo_numero: int,
) -> Optional[models.ResolucionDian]:
    """Ajusta manualmente el número actual de la resolución. Solo admin."""
    resolucion = db.query(models.ResolucionDian).filter(
        models.ResolucionDian.id         == resolucion_id,
        models.ResolucionDian.empresa_id == empresa_id,
    ).first()
    if not resolucion:
        return None

    if nuevo_numero < resolucion.numero_inicial - 1 or nuevo_numero > resolucion.numero_final:
        raise HTTPException(
            status_code=400,
            detail=f"El número debe estar entre {resolucion.numero_inicial - 1} y {resolucion.numero_final}."
        )

    resolucion.numero_actual = nuevo_numero
    db.commit()
    db.refresh(resolucion)
    return resolucion


def delete_resolucion(
    db: Session,
    empresa_id: int,
    resolucion_id: int,
) -> bool:
    """Elimina una resolución solo si no ha emitido ningún comprobante."""
    resolucion = db.query(models.ResolucionDian).filter(
        models.ResolucionDian.id         == resolucion_id,
        models.ResolucionDian.empresa_id == empresa_id,
    ).first()
    if not resolucion:
        return False

    if resolucion.numero_actual > 0:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar una resolución que ya emitió comprobantes."
        )

    db.delete(resolucion)
    db.commit()
    return True
