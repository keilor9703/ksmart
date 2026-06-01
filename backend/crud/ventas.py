from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, timezone, date
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ, get_utc_boundaries
from crud.clientes import get_cliente
from crud.productos import get_producto

# ═══════════════════════════════════════════════════════════════════════════════
# VENTAS
# ═══════════════════════════════════════════════════════════════════════════════

def get_ventas(db: Session, empresa_id: int, skip: int = 0, limit: int = 100):
    return (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.cliente),
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
            joinedload(models.Venta.pagos),
        )
        .filter(models.Venta.empresa_id == empresa_id, models.Venta.tipo == "venta")
        .order_by(models.Venta.fecha.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_venta(db: Session, empresa_id: int, venta_id: int):
    return (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.cliente),
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
            joinedload(models.Venta.pagos),
        )
        .filter(
            models.Venta.id == venta_id,
            models.Venta.empresa_id == empresa_id
        )
        .first()
    )

def create_venta(db: Session, empresa_id: int, venta: schemas.VentaCreate, commit: bool = True):
    if venta.cliente_id is not None:
        cliente = get_cliente(db, empresa_id, venta.cliente_id)
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente no encontrado o no pertenece a esta empresa")

    total_bruto = 0.0
    detalles_objs = []

    for d in venta.detalles:
        prod = get_producto(db, empresa_id, d.producto_id)
        if not prod:
            raise HTTPException(
                status_code=404,
                detail=f"Producto {d.producto_id} no encontrado o no pertenece a esta empresa"
            )

        precio = d.precio_unitario if d.precio_unitario is not None else prod.precio
        subtotal = precio * d.cantidad
        total_bruto += subtotal

        detalle = models.DetalleVenta(
            producto_id=d.producto_id,
            cantidad=d.cantidad,
            precio_unitario=precio,
            descuento_pct=getattr(d, 'descuento_pct', 0.0),
            iva_porcentaje=getattr(d, 'iva_porcentaje', 0.0),
        )
        detalles_objs.append(detalle)

    iva_porc = float(getattr(venta, 'iva_porcentaje', 0) or 0)
    iva_total = total_bruto * iva_porc / 100 if iva_porc > 0 else 0.0
    descuento_puntos = float(getattr(venta, 'descuento_puntos', 0) or 0)
    total_final = max(0.0, total_bruto + iva_total - descuento_puntos)

    # Usamos timezone explícito para Postgres
    ahora_utc = datetime.now(timezone.utc)

    db_venta = models.Venta(
        cliente_id=venta.cliente_id,
        total=total_final,
        iva_total=iva_total,
        iva_porcentaje=iva_porc,
        monto_pagado=total_final if venta.pagada else 0,
        estado_pago="pagado" if venta.pagada else "pendiente",
        metodo_pago=venta.metodo_pago if venta.pagada else None,
        empresa_id=empresa_id,
        fecha=ahora_utc # Forzado explicito para no depender del default base
    )
    db.add(db_venta)
    db.flush()

    for det in detalles_objs:
        det.venta_id = db_venta.id
        db.add(det)

    # Fase 2A: Numeración DIAN (solo para ventas reales, no cotizaciones)
    if getattr(venta, 'tipo', 'venta') == 'venta':
        _asignar_numero_factura(db, empresa_id, db_venta)

    # Fase 2B: campos extra
    db_venta.tipo           = getattr(venta, 'tipo', 'venta')
    db_venta.valida_hasta   = getattr(venta, 'valida_hasta', None)
    db_venta.observaciones  = getattr(venta, 'observaciones', None)
    db_venta.operador_id    = getattr(venta, 'operador_id', None)
    db_venta.placa_vehiculo = getattr(venta, 'placa_vehiculo', None)




    if commit:
        db.commit()
        db.refresh(db_venta)
    return db_venta

def update_venta(db: Session, empresa_id: int, venta_id: int, venta: schemas.VentaCreate):
    db_venta = db.query(models.Venta).filter(
        models.Venta.id == venta_id,
        models.Venta.empresa_id == empresa_id
    ).first()
    if not db_venta:
        return None

    if venta.cliente_id is not None:
        db_venta.cliente_id = venta.cliente_id

    db.query(models.DetalleVenta).filter(models.DetalleVenta.venta_id == venta_id).delete()
    db.flush()

    total_venta = 0.0
    new_detalles = []
    for detalle_data in venta.detalles:
        producto = get_producto(db, empresa_id, detalle_data.producto_id)
        if not producto:
            raise HTTPException(
                status_code=404,
                detail=f"Producto {detalle_data.producto_id} no encontrado"
            )

        precio_unitario = detalle_data.precio_unitario if detalle_data.precio_unitario is not None else producto.precio
        detalle_total = precio_unitario * detalle_data.cantidad
        total_venta += detalle_total

        db_detalle = models.DetalleVenta(
            venta_id=venta_id,
            producto_id=detalle_data.producto_id,
            cantidad=detalle_data.cantidad,
            precio_unitario=precio_unitario
        )
        new_detalles.append(db_detalle)

    db.add_all(new_detalles)

    iva_porc = float(getattr(venta, 'iva_porcentaje', 0) or db_venta.iva_porcentaje or 0)
    iva_total = total_venta * iva_porc / 100 if iva_porc > 0 else 0.0
    total_final = total_venta + iva_total

    db_venta.total = total_final
    db_venta.iva_total = iva_total
    db_venta.iva_porcentaje = iva_porc
    db_venta.monto_pagado = total_final if venta.pagada else 0.0
    db_venta.estado_pago = "pagado" if venta.pagada else "pendiente"

    db.commit()
    db.refresh(db_venta)
    return db_venta

def delete_venta(db: Session, empresa_id: int, venta_id: int):
    db_venta = db.query(models.Venta).filter(
        models.Venta.id == venta_id,
        models.Venta.empresa_id == empresa_id
    ).first()
    if db_venta:
        db.delete(db_venta)
        db.commit()
    return db_venta


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS DE VENTAS (copiados desde líneas ~3916-3987 de crud.py)
# ═══════════════════════════════════════════════════════════════════════════════

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


def get_lotes_fefo(
    db: Session,
    empresa_id: int,
    producto_id: int,
) -> list:
    """
    Retorna los lotes vigentes del producto ordenados por fecha de vencimiento ASC.
    Incluye lotes sin fecha de vencimiento (NULL = sin caducidad).
    Excluye lotes vencidos y sin stock.
    """
    from datetime import date as _date
    from sqlalchemy import or_
    hoy = _date.today()
    return (
        db.query(models.LoteExistencia)
        .filter(
            models.LoteExistencia.empresa_id      == empresa_id,
            models.LoteExistencia.producto_id     == producto_id,
            models.LoteExistencia.cantidad_actual >  0,
            or_(
                models.LoteExistencia.fecha_vencimiento == None,
                models.LoteExistencia.fecha_vencimiento >= hoy,
            ),
        )
        .order_by(
            models.LoteExistencia.fecha_vencimiento.asc().nullslast()
        )
        .all()
    )


def consumir_stock_fefo(
    db: Session,
    empresa_id: int,
    producto_id: int,
    cantidad_requerida: float,
    motivo: str = "venta",
    referencia: str = "",
    commit: bool = True,
) -> list:
    """
    Descuenta stock aplicando FEFO.
    Retorna lista de lotes afectados para trazabilidad en la factura.
    Lanza ValueError si no hay stock suficiente en lotes vigentes.
    """
    lotes    = get_lotes_fefo(db, empresa_id, producto_id)
    restante = cantidad_requerida
    afectados = []

    for lote in lotes:
        if restante <= 0:
            break

        consumo = min(lote.cantidad_actual, restante)
        lote.cantidad_actual -= consumo
        restante             -= consumo

        afectados.append({
            "lote_id":           lote.id,
            "numero_lote":       lote.numero_lote,
            "fecha_vencimiento": lote.fecha_vencimiento.isoformat(),
            "consumido":         consumo,
        })

        db.add(models.InventoryMovement(
            empresa_id     = empresa_id,
            producto_id    = producto_id,
            tipo           = "salida",
            cantidad       = consumo,
            costo_unitario = lote.costo_unitario,
            motivo         = motivo,
            referencia     = referencia,
            lote_id        = lote.id,
            numero_lote    = lote.numero_lote,
        ))

    if restante > 0:
        raise ValueError(
            f"Stock insuficiente en lotes vigentes para '{referencia}'. "
            f"Faltaron {restante:.2f} unidades."
        )

    if commit:
        db.commit()

    return afectados


def _ejecutar_movimientos_venta(db: Session, empresa_id: int, db_venta: models.Venta):
    """
    Crea los movimientos de inventario para cada detalle de la venta.
    Aplica FEFO si el producto maneja lotes, descuento estándar en caso contrario.
    Reutilizable desde create_venta (main.py) y convertir_cotizacion.
    """
    from crud.inventario import create_movement
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
