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
from crud.common import empresa_suscripcion_activa
from crud.consecutivos import next_consecutivo

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
    if not empresa or not empresa_suscripcion_activa(empresa):
        raise ValueError("Catálogo no encontrado")

    if not payload.detalles:
        raise ValueError("El pedido debe tener al menos un producto")

    total = 0.0
    detalles_data = []

    for item in payload.detalles:
        # El producto debe existir, pertenecer a la empresa, estar vigente y
        # seguir visible en el catálogo — evita ordenar productos ocultos/
        # descontinuados adivinando su ID.
        producto = db.query(models.Producto).filter(
            models.Producto.id == item.producto_id,
            models.Producto.empresa_id == empresa.id,
            models.Producto.vigente == True,
            models.Producto.mostrar_en_catalogo == True,
        ).first()
        if not producto:
            raise ValueError(f"Producto {item.producto_id} no encontrado en esta tienda")

        # Si el producto maneja variantes, la variante es obligatoria y el
        # precio/stock a validar son los DE LA VARIANTE, no los del padre
        # (que quedan obsoletos/inconsistentes en cuanto existen variantes).
        variante = None
        nombre_variante = None
        if producto.tiene_variantes:
            if not item.variante_id:
                raise ValueError(f"Debes seleccionar una opción (talla/color/etc.) para '{producto.nombre}'")
            variante = db.query(models.ProductoVariante).filter(
                models.ProductoVariante.id == item.variante_id,
                models.ProductoVariante.producto_id == producto.id,
                models.ProductoVariante.empresa_id == empresa.id,
                models.ProductoVariante.activo == True,
            ).first()
            if not variante:
                raise ValueError(f"La opción seleccionada para '{producto.nombre}' ya no está disponible")
            nombre_variante = variante.nombre

        stock_disponible = (variante.stock_actual if variante else producto.stock_actual) or 0
        if not producto.es_servicio and stock_disponible < item.cantidad:
            nombre_mostrado = f"{producto.nombre} ({nombre_variante})" if nombre_variante else producto.nombre
            raise ValueError(
                f"Stock insuficiente para '{nombre_mostrado}': "
                f"disponible {stock_disponible}, solicitado {item.cantidad}"
            )

        # El precio SIEMPRE se recalcula desde la BD — nunca se confía en el
        # precio enviado por el cliente (evita manipulación de precios).
        precio_real = variante.precio if (variante and variante.precio is not None) else producto.precio
        subtotal = round(item.cantidad * precio_real, 2)
        total += subtotal
        detalles_data.append({
            "empresa_id":      empresa.id,
            "producto_id":     producto.id,
            "nombre_producto": producto.nombre,
            "cantidad":        item.cantidad,
            "precio_unitario": precio_real,
            "subtotal":        subtotal,
            "variante_id":     variante.id if variante else None,
            "nombre_variante": nombre_variante,
        })

    numero_pedido = next_consecutivo(db, empresa.id, "ultimo_numero_pedido")

    pedido = models.PedidoVirtual(
        empresa_id        = empresa.id,
        numero_pedido     = numero_pedido,
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


def _solo_digitos(s: str) -> str:
    return "".join(ch for ch in (s or "") if ch.isdigit())


def get_pedido_status_publico(
    db: Session, slug: str, numero_pedido: int, celular_cliente: str
) -> Optional[models.PedidoVirtual]:
    """Consulta pública de estado — requiere el número de pedido Y el celular
    con el que se hizo el pedido (evita que cualquiera enumere pedidos ajenos
    probando números consecutivos)."""
    empresa = db.query(models.Empresa).filter(models.Empresa.slug_catalogo == slug).first()
    if not empresa or not empresa_suscripcion_activa(empresa):
        return None
    candidatos = db.query(models.PedidoVirtual).filter(
        models.PedidoVirtual.empresa_id == empresa.id,
        models.PedidoVirtual.numero_pedido == numero_pedido,
    ).all()
    celular_norm = _solo_digitos(celular_cliente)
    for pedido in candidatos:
        if _solo_digitos(pedido.celular_cliente) == celular_norm:
            return pedido
    return None


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


def get_pedido(db: Session, pedido_id: int, empresa_id: int, for_update: bool = False) -> Optional[models.PedidoVirtual]:
    q = db.query(models.PedidoVirtual).filter(
        models.PedidoVirtual.id == pedido_id,
        models.PedidoVirtual.empresa_id == empresa_id,
    )
    if for_update:
        q = q.with_for_update()
    return q.first()


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
    # Row lock: dos PATCH /estado concurrentes (doble clic, dos empleados)
    # transicionando nuevo→confirmado no deben poder deducir el stock dos veces.
    pedido = get_pedido(db, pedido_id, empresa_id, for_update=True)
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
    # Row lock: dos solicitudes de conversión concurrentes (doble clic, dos
    # empleados) no deben poder crear dos ventas/pagos para el mismo pedido.
    pedido = get_pedido(db, pedido_id, empresa_id, for_update=True)
    if not pedido:
        raise ValueError("Pedido no encontrado")

    actual = pedido.estado.value if hasattr(pedido.estado, "value") else pedido.estado
    if actual in ("cancelado",):
        raise ValueError("No se puede convertir un pedido cancelado")
    if pedido.venta_id:
        raise ValueError("Este pedido ya tiene una venta asociada")
    if pedido.total <= 0 or all(d.producto_id is None for d in pedido.detalles):
        raise ValueError("El pedido no tiene productos válidos para convertir en venta")

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

    from crud.consecutivos import next_consecutivo
    venta = models.Venta(
        numero_venta    = next_consecutivo(db, empresa_id, "ultimo_numero_venta"),
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
            variante_id     = d.variante_id,
            nombre_variante = d.nombre_variante,
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
        # `Producto.grupo` es lazy="joined" (siempre agrega un LEFT OUTER JOIN
        # a grupos_producto). Postgres rechaza FOR UPDATE genérico sobre el
        # lado nullable de un outer join («FeatureNotSupported»), así que hay
        # que acotar el lock explícitamente a la tabla productos con `of=`.
        prod = db.query(models.Producto).filter(
            models.Producto.id == det.producto_id,
            models.Producto.empresa_id == empresa_id,
        ).with_for_update(of=models.Producto).first()
        if not prod or getattr(prod, "es_servicio", False):
            continue

        if det.variante_id:
            variante = db.query(models.ProductoVariante).filter(
                models.ProductoVariante.id == det.variante_id,
                models.ProductoVariante.empresa_id == empresa_id,
            ).with_for_update().first()
            if not variante:
                continue
            if (variante.stock_actual or 0) < det.cantidad:
                raise ValueError(
                    f"Stock insuficiente para '{prod.nombre} ({variante.nombre})': "
                    f"disponible {variante.stock_actual}, solicitado {det.cantidad}"
                )
            variante.stock_actual -= det.cantidad
            db.add(variante)
        else:
            if prod.stock_actual < det.cantidad:
                raise ValueError(
                    f"Stock insuficiente para '{prod.nombre}': "
                    f"disponible {prod.stock_actual}, solicitado {det.cantidad}"
                )
            prod.stock_actual -= det.cantidad

        db.add(models.InventoryMovement(
            empresa_id      = empresa_id,
            producto_id     = prod.id,
            tipo            = models.MovementType.SALIDA,
            cantidad        = det.cantidad,
            motivo          = "Pedido virtual",
            referencia      = f"pedido_virtual #{pedido.id}",
            variante_id     = det.variante_id,
            nombre_variante = det.nombre_variante,
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

        if det.variante_id:
            variante = db.query(models.ProductoVariante).filter(
                models.ProductoVariante.id == det.variante_id,
                models.ProductoVariante.empresa_id == empresa_id,
            ).first()
            if variante:
                variante.stock_actual = (variante.stock_actual or 0) + det.cantidad
                db.add(variante)
        else:
            prod.stock_actual += det.cantidad

        db.add(models.InventoryMovement(
            empresa_id      = empresa_id,
            producto_id     = prod.id,
            tipo            = models.MovementType.ENTRADA,
            cantidad        = det.cantidad,
            motivo          = "Reposición por cancelación de pedido virtual",
            referencia      = f"pedido_virtual #{pedido.id}",
            variante_id     = det.variante_id,
            nombre_variante = det.nombre_variante,
        ))
