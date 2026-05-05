from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ
from crud.clientes import get_cliente
from crud.productos import get_producto
from crud.notificaciones import check_and_notify_low_stock
from crud.facturacion_dian import _asignar_numero_factura, _ejecutar_movimientos_venta

# import lazy para evitar circular: from crud.ventas import create_venta


def get_cotizaciones(
    db: Session,
    empresa_id: int,
    skip: int = 0,
    limit: int = 100,
) -> List[dict]:
    """Lista cotizaciones de la empresa ordenadas por fecha desc."""
    cotizaciones = (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.cliente),
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
        )
        .filter(
            models.Venta.empresa_id == empresa_id,
            models.Venta.tipo       == "cotizacion",
        )
        .order_by(models.Venta.fecha.desc())
        .offset(skip).limit(limit).all()
    )

    hoy = datetime.now(BOGOTA_TZ).date()
    resultado = []
    for c in cotizaciones:
        estado = "vigente"
        if c.numero_factura:          # fue convertida
            estado = "convertida"
        elif c.valida_hasta:
            # Si c.valida_hasta es aware, lo pasamos a Bogota. Si es naive, asumimos que es UTC.
            valida_dt = c.valida_hasta
            if valida_dt.tzinfo is None:
                valida_dt = valida_dt.replace(tzinfo=timezone.utc)
            
            if valida_dt.astimezone(BOGOTA_TZ).date() < hoy:
                estado = "vencida"

        resultado.append({
            **{col.key: getattr(c, col.key)
               for col in models.Venta.__table__.columns},
            "cliente":           c.cliente,
            "detalles":          c.detalles,
            "estado_cotizacion": estado,
        })
    return resultado


def create_cotizacion(
    db: Session,
    empresa_id: int,
    payload: schemas.CotizacionCreate,
) -> models.Venta:
    """
    Crea una cotización. NO valida stock, NO crea movimientos de inventario.
    """
    cliente = get_cliente(db, empresa_id, payload.cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")

    total_bruto = 0.0
    detalles_objs = []

    for d in payload.detalles:
        prod = get_producto(db, empresa_id, d.producto_id)
        if not prod:
            raise HTTPException(status_code=404, detail=f"Producto {d.producto_id} no encontrado.")

        precio = d.precio_unitario if d.precio_unitario is not None else prod.precio
        subtotal = precio * d.cantidad
        total_bruto += subtotal

        detalles_objs.append(models.DetalleVenta(
            producto_id     = d.producto_id,
            cantidad        = d.cantidad,
            precio_unitario = precio,
            descuento_pct   = getattr(d, "descuento_pct", 0.0),
            iva_porcentaje  = 0.0,
        ))

    iva_porc  = float(payload.iva_porcentaje or 0)
    iva_total = total_bruto * iva_porc / (100 + iva_porc) if iva_porc > 0 else 0.0

    db_cot = models.Venta(
        cliente_id    = payload.cliente_id,
        total         = total_bruto,
        iva_total     = iva_total,
        iva_porcentaje = iva_porc,
        monto_pagado  = 0.0,
        estado_pago   = "pendiente",
        tipo          = "cotizacion",
        valida_hasta  = payload.valida_hasta,
        observaciones = payload.observaciones,
        empresa_id    = empresa_id,
        fecha         = datetime.now(timezone.utc),
    )
    db.add(db_cot)
    db.flush()

    for det in detalles_objs:
        det.venta_id   = db_cot.id
        det.empresa_id = empresa_id
        db.add(det)

    db.commit()
    db.refresh(db_cot)
    return db_cot


def convertir_cotizacion_a_venta(
    db: Session,
    empresa_id: int,
    cotizacion_id: int,
    payload: schemas.CotizacionConvertir,
) -> models.Venta:
    """
    Convierte una cotización en una venta real:
    1. Valida stock
    2. Crea movimientos de inventario (FEFO o estándar)
    3. Asigna numero_factura desde resolución activa
    4. Cambia tipo → 'venta'
    5. Marca estado_pago según payload.pagada
    """
    cotizacion = (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
            joinedload(models.Venta.cliente),
        )
        .filter(
            models.Venta.id         == cotizacion_id,
            models.Venta.empresa_id == empresa_id,
            models.Venta.tipo       == "cotizacion",
        )
        .first()
    )

    if not cotizacion:
        raise HTTPException(status_code=404, detail="Cotización no encontrada.")

    if cotizacion.numero_factura:
        raise HTTPException(status_code=400, detail="Esta cotización ya fue convertida a venta.")

    # ── 1. Validar stock ──────────────────────────────────────────────────
    for det in cotizacion.detalles:
        prod = get_producto(db, empresa_id, det.producto_id)
        if not prod or prod.es_servicio:
            continue
        if not getattr(prod, "maneja_lotes", False):
            stock_disp = prod.stock_actual or 0
            if stock_disp < det.cantidad:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para '{prod.nombre}'. "
                           f"Disponible: {stock_disp}, requerido: {det.cantidad}."
                )

    # ── 2. Crear movimientos de inventario ────────────────────────────────
    # Necesitamos que cotizacion.id sea conocido como venta primero
    cotizacion.tipo = "venta"
    db.flush()  # sincroniza el tipo antes de crear movimientos

    _ejecutar_movimientos_venta(db, empresa_id, cotizacion)

    # ── 3. Asignar numero_factura ─────────────────────────────────────────
    _asignar_numero_factura(db, empresa_id, cotizacion)

    # ── 4. Actualizar estado de pago ──────────────────────────────────────
    cotizacion.pagada      = payload.pagada
    cotizacion.estado_pago = "pagado" if payload.pagada else "pendiente"
    cotizacion.metodo_pago = payload.metodo_pago if payload.pagada else None
    cotizacion.monto_pagado = cotizacion.total if payload.pagada else 0.0
    cotizacion.fecha_pago   = datetime.now(timezone.utc) if payload.pagada else None

    db.commit()
    db.refresh(cotizacion)

    # Notificar bajo stock
    check_and_notify_low_stock(
        db, empresa_id=empresa_id,
        producto_ids=[d.producto_id for d in cotizacion.detalles]
    )

    return cotizacion


def get_cotizacion(
    db: Session,
    empresa_id: int,
    cotizacion_id: int,
) -> Optional[models.Venta]:
    """Obtiene una cotización por id."""
    return (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.cliente),
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
        )
        .filter(
            models.Venta.id         == cotizacion_id,
            models.Venta.empresa_id == empresa_id,
            models.Venta.tipo       == "cotizacion",
        )
        .first()
    )


def delete_cotizacion(
    db: Session,
    empresa_id: int,
    cotizacion_id: int,
) -> bool:
    """Elimina una cotización. No puede eliminarse si ya fue convertida."""
    cotizacion = db.query(models.Venta).filter(
        models.Venta.id         == cotizacion_id,
        models.Venta.empresa_id == empresa_id,
        models.Venta.tipo       == "cotizacion",
    ).first()

    if not cotizacion:
        raise HTTPException(status_code=404, detail="Cotización no encontrada.")

    if cotizacion.numero_factura:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar una cotización ya convertida a venta."
        )

    db.delete(cotizacion)
    db.commit()
    return True
