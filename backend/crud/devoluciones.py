from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ
from crud.productos import get_producto

# ═══════════════════════════════════════════════════════════════════════════════
# DEVOLUCIONES
# ═══════════════════════════════════════════════════════════════════════════════

def crear_devolucion(db: Session, empresa_id: int, data: schemas.DevolucionCreate) -> models.Devolucion:
    """✅ VALIDACIÓN POR EMPRESA"""
    venta = (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
            joinedload(models.Venta.cliente),
        )
        .filter(
            models.Venta.id == data.venta_id,
            models.Venta.empresa_id == empresa_id  # ✅
        )
        .first()
    )

    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    if not data.items:
        raise HTTPException(status_code=400, detail="Debe incluir al menos un ítem a devolver.")

    if not data.motivo or not data.motivo.strip():
        raise HTTPException(status_code=400, detail="El motivo es obligatorio.")

    total_dev = 0.0
    for item in data.items:
        if item.cantidad <= 0:
            raise HTTPException(status_code=400, detail="La cantidad debe ser mayor a 0.")
        if item.precio_unitario <= 0:
            raise HTTPException(status_code=400, detail="El precio unitario debe ser mayor a 0.")

        if item.detalle_id:
            detalle = next((d for d in venta.detalles if d.id == item.detalle_id), None)
            if detalle and item.cantidad > detalle.cantidad:
                nombre = detalle.producto.nombre if detalle.producto else f"ID {item.producto_id}"
                raise HTTPException(
                    status_code=400,
                    detail=f"No puede devolver {item.cantidad} de '{nombre}'. Solo se vendieron {detalle.cantidad}."
                )
        total_dev += item.cantidad * item.precio_unitario

    dev = models.Devolucion(
        venta_id=venta.id,
        motivo=data.motivo.strip(),
        monto_total=total_dev,
        tipo="parcial",
        estado="confirmada",
        empresa_id=empresa_id  # ✅
    )
    db.add(dev)
    db.flush()

    for item in data.items:
        db_item = models.DevolucionItem(
            devolucion_id=dev.id,
            producto_id=item.producto_id,
            detalle_id=item.detalle_id,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,
        )
        db.add(db_item)

        # Reponer inventario
        prod = get_producto(db, empresa_id, item.producto_id)
        if prod and not prod.es_servicio:
            prod.stock_actual = (prod.stock_actual or 0) + item.cantidad

            # Reponer el lote original si el producto maneja lotes: buscar la
            # salida de esa venta ligada a un lote y devolver allí la cantidad
            # (mantiene sincronizado el módulo de Perecederos y la trazabilidad
            # del lote devuelto).
            lote_repuesto = None
            if getattr(prod, "maneja_lotes", False):
                mov_salida = (
                    db.query(models.InventoryMovement)
                    .filter(
                        models.InventoryMovement.empresa_id  == empresa_id,
                        models.InventoryMovement.producto_id == item.producto_id,
                        models.InventoryMovement.lote_id.isnot(None),
                        models.InventoryMovement.referencia.ilike(f"%venta #{data.venta_id}%"),
                    )
                    .order_by(models.InventoryMovement.id.desc())
                    .first()
                )
                if mov_salida:
                    lote_repuesto = db.query(models.LoteExistencia).filter(
                        models.LoteExistencia.id         == mov_salida.lote_id,
                        models.LoteExistencia.empresa_id == empresa_id,
                    ).first()
                    if lote_repuesto:
                        lote_repuesto.cantidad_actual += item.cantidad
                        db.add(lote_repuesto)
            db.add(prod)

            mov = models.InventoryMovement(
                producto_id=item.producto_id,
                tipo="entrada",
                cantidad=item.cantidad,
                costo_unitario=prod.costo or 0.0,
                motivo="devolucion",
                referencia=f"Dev #{dev.id} / Venta #{data.venta_id}",
                observacion=f"Devolución: {data.motivo[:80]}",
                empresa_id=empresa_id,  # ✅
                lote_id=lote_repuesto.id if lote_repuesto else None,
                numero_lote=lote_repuesto.numero_lote if lote_repuesto else None,
            )
            db.add(mov)

    # Ajustar la venta
    if venta.estado_pago == "pagado":
        venta.total = max(0.0, venta.total - total_dev)
        venta.monto_pagado = max(0.0, venta.monto_pagado - total_dev)
    else:
        venta.total = max(0.0, venta.total - total_dev)

    # Recalcular estado_pago
    if venta.total <= 0:
        venta.estado_pago = "pagado"
        venta.monto_pagado = 0.0
    elif venta.monto_pagado >= venta.total:
        venta.estado_pago = "pagado"
    elif venta.monto_pagado > 0:
        venta.estado_pago = "parcial"
    else:
        venta.estado_pago = "pendiente"

    db.add(venta)

    # Notificar al admin
    cliente_nombre = venta.cliente.nombre if venta.cliente else "desconocido"
    admin_users = db.query(models.User).join(models.Role).filter(
        models.Role.name == "Admin",
        models.User.empresa_id == empresa_id  # ✅
    ).all()
    for admin in admin_users:
        db.add(models.Notificacion(
            usuario_id=admin.id,
            empresa_id=empresa_id,  # ✅
            mensaje=(
                f"↩️ Devolución — Venta #{data.venta_id} · {cliente_nombre} · "
                f"Nota crédito: ${total_dev:,.0f}"
            ),
            tipo="warning",
            leido=False,
        ))

    db.commit()
    db.refresh(dev)
    return dev

def get_devoluciones_by_venta(db: Session, empresa_id: int, venta_id: int) -> List[models.Devolucion]:
    """✅ FILTRADO POR EMPRESA"""
    return (
        db.query(models.Devolucion)
        .options(joinedload(models.Devolucion.items).joinedload(models.DevolucionItem.producto))
        .filter(
            models.Devolucion.venta_id == venta_id,
            models.Devolucion.empresa_id == empresa_id  # ✅
        )
        .order_by(models.Devolucion.fecha.desc())
        .all()
    )

def revertir_movimientos_venta(db: Session, empresa_id: int, venta: models.Venta):
    """✅ INYECCIÓN DE EMPRESA_ID"""
    for det in venta.detalles:
        prod = get_producto(db, empresa_id, det.producto_id)
        if not prod or prod.es_servicio:
            continue
        mov = models.InventoryMovement(
            producto_id=det.producto_id,
            tipo="entrada",
            cantidad=det.cantidad,
            costo_unitario=prod.costo or 0.0,
            motivo="reversa_venta",
            referencia=f"reversa venta #{venta.id}",
            observacion=f"Venta #{venta.id} eliminada el {datetime.now(timezone.utc).date()}",
            empresa_id=empresa_id  # ✅
        )
        db.add(mov)
        prod.stock_actual = (prod.stock_actual or 0) + det.cantidad
        db.add(prod)
    db.commit()
