from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, datetime, timezone
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ
from crud.productos import get_producto
from crud.inventario import create_movement


def _get_resolucion_activa(db: Session, empresa_id: int) -> Optional[models.ResolucionDian]:
    """Retorna la resolución activa de la empresa, si existe."""
    return db.query(models.ResolucionDian).filter(
        models.ResolucionDian.empresa_id == empresa_id,
        models.ResolucionDian.is_active  == True,
    ).first()


def _asignar_numero_factura(db: Session, empresa_id: int, venta: models.Venta) -> Optional[str]:
    """
    Incrementa el consecutivo de la resolución activa y asigna el numero_factura
    a la venta. Retorna el número asignado o None si no hay resolución activa.
    Llama ANTES de hacer db.commit().
    """
    resolucion = _get_resolucion_activa(db, empresa_id)
    if not resolucion:
        return None

    siguiente = resolucion.numero_actual + 1

    # Validación de rango
    if siguiente > resolucion.numero_final:
        raise HTTPException(
            status_code=400,
            detail=(
                f"La resolución DIAN ha llegado al límite de numeración "
                f"({resolucion.numero_final}). Configura una nueva resolución."
            )
        )

    resolucion.numero_actual = siguiente
    numero_str = f"{resolucion.prefijo}{siguiente}"
    venta.numero_factura = numero_str
    venta.resolucion_id  = resolucion.id

    # 👇 NUEVO: Marcar como pendiente si la empresa tiene FE activa
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if empresa and empresa.facturacion_electronica_activa:
        venta.estado_electronico = "pendiente"

    db.add(resolucion)
    return numero_str


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
                    referencia=f"Venta #{db_venta.id}",
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
                referencia     = f"venta #{db_venta.id}",
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
    """Activa una resolución y desactiva todas las demás de la empresa."""
    # Desactivar todas
    db.query(models.ResolucionDian).filter(
        models.ResolucionDian.empresa_id == empresa_id,
    ).update({"is_active": False})

    # Activar la seleccionada
    resolucion = db.query(models.ResolucionDian).filter(
        models.ResolucionDian.id         == resolucion_id,
        models.ResolucionDian.empresa_id == empresa_id,
    ).first()
    if not resolucion:
        db.rollback()
        return None

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
