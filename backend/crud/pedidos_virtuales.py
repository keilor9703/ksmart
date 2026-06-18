import logging
import urllib.parse
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
import schemas
from crud import notificaciones as crud_notif
from crud import pagos as crud_pagos

logger = logging.getLogger(__name__)


def _utcnow():
    return datetime.now(timezone.utc)


ALLOWED_TRANSITIONS = {
    "nuevo":          ["confirmado", "cancelado"],
    "confirmado":     ["en_preparacion", "cancelado"],
    "en_preparacion": ["enviado", "cancelado"],
    "enviado":        ["entregado", "cancelado"],
    "entregado":      [],
    "cancelado":      [],
}


# ─── PUBLIC ──────────────────────────────────────────────────────────────────

def create_pedido_publico(db: Session, slug: str, payload: schemas.PedidoVirtualCreate):
    empresa = db.query(models.Empresa).filter(models.Empresa.slug_catalogo == slug).first()
    if not empresa:
        raise ValueError("Catálogo no encontrado")

    if not payload.detalles:
        raise ValueError("El pedido debe tener al menos un producto")

    total = 0.0
    detalles_data = []

    for item in payload.detalles:
        # Buscar el producto validando que pertenezca a la empresa y esté vigente.
        # No se requiere mostrar_en_catalogo==True porque el cliente pudo haber cargado
        # el catálogo antes de que se hiciera un cambio, y rechazarlo sería una mala UX.
        producto = db.query(models.Producto).filter(
            models.Producto.id == item.producto_id,
            models.Producto.empresa_id == empresa.id,
            models.Producto.vigente == True,
        ).first()
        if not producto:
            raise ValueError(f"Producto {item.producto_id} no encontrado en esta tienda")

        subtotal = round(item.cantidad * item.precio_unitario, 2)
        total += subtotal
        detalles_data.append({
            "empresa_id":      empresa.id,
            "producto_id":     producto.id,
            "nombre_producto": producto.nombre,
            "cantidad":        item.cantidad,
            "precio_unitario": item.precio_unitario,
            "subtotal":        subtotal,
        })

    pedido = models.PedidoVirtual(
        empresa_id        = empresa.id,
        nombre_cliente    = payload.nombre_cliente,
        celular_cliente   = payload.celular_cliente,
        email_cliente     = payload.email_cliente,
        tipo_entrega      = payload.tipo_entrega,
        direccion_entrega = payload.direccion_entrega,
        comentarios       = payload.comentarios,
        estado            = models.EstadoPedidoVirtual.nuevo,
        total             = round(total, 2),
    )
    db.add(pedido)
    db.flush()

    for d in detalles_data:
        db.add(models.DetallePedidoVirtual(pedido_id=pedido.id, **d))

    db.commit()
    db.refresh(pedido)

    # Notificar — aislado del commit principal para que un fallo no revierta el pedido
    try:
        _notificar_nuevo_pedido(db, empresa.id, pedido)
    except Exception as e:
        logger.warning("No se pudo notificar pedido #%s: %s", pedido.id, e)

    return pedido


def _notificar_nuevo_pedido(db: Session, empresa_id: int, pedido: models.PedidoVirtual):
    """Sends in-app notification to all active users of the empresa."""
    fmt = lambda v: f"${v:,.0f}".replace(",", ".")
    mensaje = (
        f"🛍️ Nuevo pedido #{pedido.id} de {pedido.nombre_cliente} "
        f"— {fmt(pedido.total)} | Tienda Virtual"
    )
    usuarios = db.query(models.User).filter(
        models.User.empresa_id == empresa_id,
        models.User.is_active == True,
    ).all()
    for u in usuarios:
        notif = schemas.NotificacionCreate(
            usuario_id=u.id,
            mensaje=mensaje,
        )
        db_notif = models.Notificacion(
            **notif.dict(),
            empresa_id=empresa_id,
            tipo="info",
        )
        db.add(db_notif)
    db.commit()


# ─── PRIVATE ─────────────────────────────────────────────────────────────────

def get_pedidos(
    db: Session,
    empresa_id: int,
    estado: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> List[models.PedidoVirtual]:
    q = db.query(models.PedidoVirtual).filter(
        models.PedidoVirtual.empresa_id == empresa_id
    )
    if estado and estado != "todos":
        q = q.filter(models.PedidoVirtual.estado == estado)
    if search:
        like = f"%{search}%"
        q = q.filter(
            models.PedidoVirtual.nombre_cliente.ilike(like) |
            models.PedidoVirtual.celular_cliente.ilike(like)
        )
    return q.order_by(models.PedidoVirtual.fecha_creacion.desc()).offset(skip).limit(limit).all()


def get_pedido(db: Session, pedido_id: int, empresa_id: int) -> Optional[models.PedidoVirtual]:
    return db.query(models.PedidoVirtual).filter(
        models.PedidoVirtual.id == pedido_id,
        models.PedidoVirtual.empresa_id == empresa_id,
    ).first()


def get_stats(db: Session, empresa_id: int) -> dict:
    result = {e.value: 0 for e in models.EstadoPedidoVirtual}
    rows = (
        db.query(models.PedidoVirtual.estado, func.count(models.PedidoVirtual.id))
        .filter(models.PedidoVirtual.empresa_id == empresa_id)
        .group_by(models.PedidoVirtual.estado)
        .all()
    )
    for estado, count in rows:
        key = estado.value if hasattr(estado, "value") else estado
        result[key] = count
    result["total"] = sum(result.values())
    return result


def update_estado(
    db: Session,
    pedido_id: int,
    empresa_id: int,
    nuevo_estado: str,
    notas: Optional[str] = None,
) -> models.PedidoVirtual:
    pedido = get_pedido(db, pedido_id, empresa_id)
    if not pedido:
        raise ValueError("Pedido no encontrado")

    actual = pedido.estado.value if hasattr(pedido.estado, "value") else pedido.estado
    if nuevo_estado not in ALLOWED_TRANSITIONS.get(actual, []):
        raise ValueError(f"No se puede pasar de '{actual}' a '{nuevo_estado}'")

    # Deduct stock when confirming
    if nuevo_estado == "confirmado" and not pedido.stock_descontado:
        _deducir_stock(db, pedido, empresa_id)
        pedido.stock_descontado = True

    # Restore stock when cancelling a confirmed order
    if nuevo_estado == "cancelado" and pedido.stock_descontado:
        _restaurar_stock(db, pedido, empresa_id)
        pedido.stock_descontado = False

    pedido.estado = nuevo_estado
    pedido.fecha_actualizacion = _utcnow()
    if notas is not None:
        pedido.notas_internas = notas

    db.commit()
    db.refresh(pedido)
    return pedido


def update_pedido(
    db: Session,
    pedido_id: int,
    empresa_id: int,
    payload: schemas.PedidoVirtualUpdate,
) -> models.PedidoVirtual:
    pedido = get_pedido(db, pedido_id, empresa_id)
    if not pedido:
        raise ValueError("Pedido no encontrado")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(pedido, field, value)
    pedido.fecha_actualizacion = _utcnow()
    db.commit()
    db.refresh(pedido)
    return pedido


def convertir_a_venta(
    db: Session,
    pedido_id: int,
    empresa_id: int,
    user_id: int,
    metodo_pago: str = "Efectivo",
    omitir_inventario: bool = False,
    iva_porcentaje: float = 0.0,
) -> models.PedidoVirtual:
    pedido = get_pedido(db, pedido_id, empresa_id)
    if not pedido:
        raise ValueError("Pedido no encontrado")

    actual = pedido.estado.value if hasattr(pedido.estado, "value") else pedido.estado
    if actual in ("cancelado",):
        raise ValueError("No se puede convertir un pedido cancelado")
    if pedido.venta_id:
        raise ValueError("Este pedido ya tiene una venta asociada")

    # Find or auto-create client by phone
    cliente = db.query(models.Cliente).filter(
        models.Cliente.empresa_id == empresa_id,
        models.Cliente.telefono == pedido.celular_cliente,
    ).first()
    if not cliente:
        cliente = models.Cliente(
            empresa_id  = empresa_id,
            nombre      = pedido.nombre_cliente,
            telefono    = pedido.celular_cliente,
            es_cliente  = True,
        )
        db.add(cliente)
        db.flush()

    factor_iva = 1 + (iva_porcentaje / 100)
    total_con_iva = round(pedido.total * factor_iva, 2)
    iva_total = round(pedido.total * (iva_porcentaje / 100), 2)

    venta = models.Venta(
        empresa_id      = empresa_id,
        cliente_id      = cliente.id,
        total           = total_con_iva,
        descuento_total = 0.0,
        estado_pago     = "pendiente",
        operador_id     = user_id,
        tipo            = "venta",
        observaciones   = f"Pedido virtual #{pedido.id} — {pedido.nombre_cliente}",
    )
    db.add(venta)
    db.flush()

    for d in pedido.detalles:
        if not d.producto_id:
            continue
        db.add(models.DetalleVenta(
            empresa_id      = empresa_id,
            venta_id        = venta.id,
            producto_id     = d.producto_id,
            cantidad        = d.cantidad,
            precio_unitario = d.precio_unitario,
            descuento_pct   = 0.0,
            iva_porcentaje  = iva_porcentaje,
        ))

    # Ensure stock is decremented (may not have been if skipped confirmation)
    if not omitir_inventario and not pedido.stock_descontado:
        _deducir_stock(db, pedido, empresa_id)
        pedido.stock_descontado = True

    pedido.venta_id            = venta.id
    pedido.estado              = models.EstadoPedidoVirtual.entregado
    pedido.fecha_actualizacion = _utcnow()

    db.commit()

    # Register payment after venta and pedido are persisted
    pago = schemas.PagoCreate(
        venta_id    = venta.id,
        monto       = pedido.total,
        metodo_pago = metodo_pago,
        detalle_pago= f"Pedido virtual #{pedido.id}",
    )
    crud_pagos.create_pago(db, empresa_id, pago)

    db.refresh(pedido)
    return pedido


def build_whatsapp_url(pedido: models.PedidoVirtual, mensaje: str) -> str:
    telefono = "".join(filter(str.isdigit, pedido.celular_cliente or ""))
    if len(telefono) == 10 and not telefono.startswith("57"):
        telefono = "57" + telefono
    return f"https://wa.me/{telefono}?text={urllib.parse.quote(mensaje)}"


# ─── STOCK HELPERS ────────────────────────────────────────────────────────────

def _deducir_stock(db: Session, pedido: models.PedidoVirtual, empresa_id: int):
    for det in pedido.detalles:
        if not det.producto_id:
            continue
        prod = db.query(models.Producto).filter(
            models.Producto.id == det.producto_id,
            models.Producto.empresa_id == empresa_id,
        ).first()
        if not prod or getattr(prod, "es_servicio", False):
            continue
        if prod.stock_actual < det.cantidad:
            raise ValueError(
                f"Stock insuficiente para '{prod.nombre}': "
                f"disponible {prod.stock_actual}, solicitado {det.cantidad}"
            )
        prod.stock_actual -= det.cantidad
        db.add(models.InventoryMovement(
            empresa_id     = empresa_id,
            producto_id    = prod.id,
            tipo           = models.MovementType.SALIDA,
            cantidad       = det.cantidad,
            motivo         = "Pedido virtual",
            referencia     = f"pedido_virtual #{pedido.id}",
        ))


def _restaurar_stock(db: Session, pedido: models.PedidoVirtual, empresa_id: int):
    for det in pedido.detalles:
        if not det.producto_id:
            continue
        prod = db.query(models.Producto).filter(
            models.Producto.id == det.producto_id,
            models.Producto.empresa_id == empresa_id,
        ).first()
        if not prod or getattr(prod, "es_servicio", False):
            continue
        prod.stock_actual += det.cantidad
        db.add(models.InventoryMovement(
            empresa_id     = empresa_id,
            producto_id    = prod.id,
            tipo           = models.MovementType.ENTRADA,
            cantidad       = det.cantidad,
            motivo         = "Reposición por cancelación de pedido virtual",
            referencia     = f"pedido_virtual #{pedido.id}",
        ))
