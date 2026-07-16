"""
CRUD del módulo Taller de Mecánica.

Dos flujos sobre el mismo VehiculoTaller:
- reparacion_cliente: el cliente trae SU vehículo, se le cobra un servicio.
- remanufactura_reventa: el taller compra un vehículo usado, invierte en
  repuestos/pintura/mano de obra, y lo vende.

El costo de una orden NUNCA se define de antemano — se acumula agregando
filas a DetalleOrdenTaller mientras la orden esté abierta (ver
agregar_detalle). Esto es justo lo que Producción (receta fija + costo
promediado) y Órdenes de Trabajo (sin campo de costo) no permiten.
"""
import logging
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session, joinedload

import models, schemas
from crud.consecutivos import next_consecutivo
from crud.inventario import create_movement

logger = logging.getLogger("taller")

ESTADOS_ORDEN = ["recibido", "diagnostico", "en_reparacion", "listo", "entregado", "vendido", "cancelado"]

ALLOWED_TRANSITIONS = {
    "recibido":      ["diagnostico", "en_reparacion", "cancelado"],
    "diagnostico":   ["en_reparacion", "cancelado"],
    "en_reparacion": ["listo", "cancelado"],
    "listo":         ["entregado", "vendido", "cancelado"],
    "entregado":     [],
    "vendido":       [],
    "cancelado":     [],
}


class TallerError(ValueError):
    pass


# ─── Vehículos ──────────────────────────────────────────────────────────────

def crear_vehiculo(db: Session, empresa_id: int, data: schemas.VehiculoTallerCreate) -> models.VehiculoTaller:
    existente = db.query(models.VehiculoTaller).filter(
        models.VehiculoTaller.empresa_id == empresa_id,
        models.VehiculoTaller.placa == data.placa.upper().strip(),
    ).first()
    if existente:
        raise TallerError(f"Ya existe un vehículo con placa {data.placa} en el taller.")

    vehiculo = models.VehiculoTaller(
        empresa_id=empresa_id,
        placa=data.placa.upper().strip(),
        tipo=data.tipo,
        marca=data.marca,
        modelo=data.modelo,
        anio=data.anio,
        color=data.color,
        kilometraje=data.kilometraje,
        origen=data.origen,
        cliente_id=data.cliente_id,
        foto_ingreso=data.foto_ingreso,
    )
    db.add(vehiculo)
    db.commit()
    db.refresh(vehiculo)
    return vehiculo


def get_vehiculo(db: Session, empresa_id: int, vehiculo_id: int) -> Optional[models.VehiculoTaller]:
    return db.query(models.VehiculoTaller).filter(
        models.VehiculoTaller.id == vehiculo_id,
        models.VehiculoTaller.empresa_id == empresa_id,
    ).first()


def listar_vehiculos(db: Session, empresa_id: int, origen: Optional[str] = None) -> List[models.VehiculoTaller]:
    q = db.query(models.VehiculoTaller).options(joinedload(models.VehiculoTaller.cliente)).filter(
        models.VehiculoTaller.empresa_id == empresa_id
    )
    if origen:
        q = q.filter(models.VehiculoTaller.origen == origen)
    return q.order_by(models.VehiculoTaller.created_at.desc()).all()


# ─── Órdenes ────────────────────────────────────────────────────────────────

def _costo_acumulado(orden: models.OrdenTaller) -> float:
    total = sum(d.subtotal for d in (orden.detalles or []))
    if orden.tipo_orden == "remanufactura_reventa" and orden.precio_compra_vehiculo:
        total += orden.precio_compra_vehiculo
    return round(total, 2)


def _enriquecer_orden(orden: models.OrdenTaller) -> models.OrdenTaller:
    orden.costo_acumulado = _costo_acumulado(orden)
    if orden.tipo_orden == "remanufactura_reventa":
        if orden.precio_venta_final is not None:
            orden.margen = round(orden.precio_venta_final - orden.costo_acumulado, 2)
    else:
        if orden.valor_cobrado is not None:
            # Margen del servicio: lo cobrado menos el costo de repuestos/insumos
            # usados (la mano de obra ya suele estar reflejada en valor_cobrado).
            orden.margen = round(orden.valor_cobrado - orden.costo_acumulado, 2)
    orden.mecanico_nombre = (orden.mecanico.nombre_completo or orden.mecanico.username) if orden.mecanico else None
    return orden


def crear_orden(db: Session, empresa_id: int, data: schemas.OrdenTallerCreate) -> models.OrdenTaller:
    if data.vehiculo_id:
        vehiculo = get_vehiculo(db, empresa_id, data.vehiculo_id)
        if not vehiculo:
            raise TallerError("Vehículo no encontrado.")
    elif data.vehiculo:
        vehiculo = crear_vehiculo(db, empresa_id, data.vehiculo)
    else:
        raise TallerError("Debes indicar un vehiculo_id existente o los datos de un vehículo nuevo.")

    if data.tipo_orden == "remanufactura_reventa" and not data.precio_compra_vehiculo:
        raise TallerError("Para remanufactura y reventa debes indicar el precio de compra del vehículo.")

    orden = models.OrdenTaller(
        empresa_id=empresa_id,
        vehiculo_id=vehiculo.id,
        tipo_orden=data.tipo_orden,
        mecanico_id=data.mecanico_id,
        estado=models.EstadoOrdenTaller.RECIBIDO.value,
        descripcion_problema=data.descripcion_problema,
        fecha_estimada_entrega=data.fecha_estimada_entrega,
        precio_compra_vehiculo=data.precio_compra_vehiculo,
    )
    db.add(orden)
    db.commit()
    db.refresh(orden)

    try:
        _notificar_nueva_orden(db, empresa_id, orden, vehiculo)
    except Exception as e:
        logger.warning("No se pudo notificar nueva orden de taller #%s: %s", orden.id, e)

    return _enriquecer_orden(orden)


def _query_ordenes(db: Session, empresa_id: int):
    return (
        db.query(models.OrdenTaller)
        .options(
            joinedload(models.OrdenTaller.vehiculo).joinedload(models.VehiculoTaller.cliente),
            joinedload(models.OrdenTaller.mecanico),
            joinedload(models.OrdenTaller.detalles),
        )
        .filter(models.OrdenTaller.empresa_id == empresa_id)
    )


def listar_ordenes(
    db: Session, empresa_id: int,
    estado: Optional[str] = None, tipo_orden: Optional[str] = None,
) -> List[models.OrdenTaller]:
    q = _query_ordenes(db, empresa_id)
    if estado and estado != "todos":
        q = q.filter(models.OrdenTaller.estado == estado)
    if tipo_orden:
        q = q.filter(models.OrdenTaller.tipo_orden == tipo_orden)
    ordenes = q.order_by(models.OrdenTaller.fecha_ingreso.desc()).all()
    return [_enriquecer_orden(o) for o in ordenes]


def get_orden(db: Session, empresa_id: int, orden_id: int) -> Optional[models.OrdenTaller]:
    orden = _query_ordenes(db, empresa_id).filter(models.OrdenTaller.id == orden_id).first()
    if not orden:
        return None
    return _enriquecer_orden(orden)


def update_orden(db: Session, empresa_id: int, orden_id: int, data: schemas.OrdenTallerUpdate) -> Optional[models.OrdenTaller]:
    orden = db.query(models.OrdenTaller).filter(
        models.OrdenTaller.id == orden_id, models.OrdenTaller.empresa_id == empresa_id,
    ).first()
    if not orden:
        return None
    for field in ("mecanico_id", "diagnostico", "descripcion_problema", "fecha_estimada_entrega",
                  "valor_cobrado", "precio_venta_sugerido", "notas_internas"):
        v = getattr(data, field, None)
        if v is not None:
            setattr(orden, field, v)
    orden.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(orden)
    return _enriquecer_orden(orden)


# ─── Detalles de costo/trabajo ──────────────────────────────────────────────

def agregar_detalle(db: Session, empresa_id: int, orden_id: int, data: schemas.DetalleOrdenTallerCreate) -> models.OrdenTaller:
    orden = db.query(models.OrdenTaller).filter(
        models.OrdenTaller.id == orden_id, models.OrdenTaller.empresa_id == empresa_id,
    ).first()
    if not orden:
        raise TallerError("Orden no encontrada.")
    if orden.estado in ("entregado", "vendido", "cancelado"):
        raise TallerError("No se pueden agregar costos a una orden cerrada.")

    subtotal = round(data.cantidad * data.costo_unitario, 2)

    # Si es un repuesto de inventario, descuenta stock igual que cualquier
    # otra salida — reutiliza el mismo movimiento de inventario que usa todo
    # el sistema, no un descuento "a mano" paralelo.
    if data.producto_id:
        create_movement(db, empresa_id, schemas.InventoryMovementCreate(
            producto_id=data.producto_id,
            tipo=schemas.MovementType.salida,
            cantidad=data.cantidad,
            costo_unitario=data.costo_unitario,
            motivo="Repuesto usado en Taller de Mecánica",
            referencia=f"OT-{orden_id}",
        ), commit=False)

    detalle = models.DetalleOrdenTaller(
        empresa_id=empresa_id,
        orden_id=orden_id,
        tipo=data.tipo,
        producto_id=data.producto_id,
        descripcion=data.descripcion,
        cantidad=data.cantidad,
        costo_unitario=data.costo_unitario,
        subtotal=subtotal,
    )
    db.add(detalle)
    db.commit()
    return get_orden(db, empresa_id, orden_id)


def eliminar_detalle(db: Session, empresa_id: int, orden_id: int, detalle_id: int) -> bool:
    detalle = db.query(models.DetalleOrdenTaller).filter(
        models.DetalleOrdenTaller.id == detalle_id,
        models.DetalleOrdenTaller.orden_id == orden_id,
        models.DetalleOrdenTaller.empresa_id == empresa_id,
    ).first()
    if not detalle:
        return False
    # Nota: no se restaura el stock del repuesto automáticamente — si fue un
    # error de captura, se corrige con un ajuste de inventario manual, igual
    # que con cualquier otro movimiento de salida ya confirmado.
    db.delete(detalle)
    db.commit()
    return True


# ─── Cambios de estado ──────────────────────────────────────────────────────

def cambiar_estado(
    db: Session, empresa_id: int, orden_id: int, nuevo_estado: str, notificar_cliente: bool = True,
) -> models.OrdenTaller:
    orden = db.query(models.OrdenTaller).options(
        joinedload(models.OrdenTaller.vehiculo).joinedload(models.VehiculoTaller.cliente),
    ).filter(
        models.OrdenTaller.id == orden_id, models.OrdenTaller.empresa_id == empresa_id,
    ).first()
    if not orden:
        raise TallerError("Orden no encontrada.")

    if nuevo_estado not in ALLOWED_TRANSITIONS.get(orden.estado, []):
        raise TallerError(f"No se puede pasar de '{orden.estado}' a '{nuevo_estado}'.")

    # entregado/vendido tienen su propio flujo de cierre (cobran/venden) —
    # cambiar el estado directamente aquí se salta ese registro contable.
    if nuevo_estado in ("entregado", "vendido"):
        raise TallerError("Usa el cierre de la orden (cobrar/vender) para este paso, no el cambio de estado directo.")

    orden.estado = nuevo_estado
    orden.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(orden)

    if nuevo_estado == "listo" and notificar_cliente:
        try:
            _notificar_vehiculo_listo(orden)
        except Exception as e:
            logger.warning("No se pudo notificar vehículo listo (orden #%s): %s", orden.id, e)

    return _enriquecer_orden(orden)


# ─── Cierre: cobrar (reparacion_cliente) / vender (remanufactura_reventa) ──

def cerrar_reparacion_cliente(
    db: Session, empresa_id: int, orden_id: int, data: schemas.OrdenTallerCerrarCliente,
) -> models.OrdenTaller:
    orden = db.query(models.OrdenTaller).filter(
        models.OrdenTaller.id == orden_id, models.OrdenTaller.empresa_id == empresa_id,
    ).first()
    if not orden:
        raise TallerError("Orden no encontrada.")
    if orden.tipo_orden != "reparacion_cliente":
        raise TallerError("Esta orden no es de reparación a cliente.")
    if orden.estado not in ("listo", "en_reparacion", "diagnostico"):
        raise TallerError(f"No se puede cerrar una orden en estado '{orden.estado}'.")

    venta = _crear_venta_taller(
        db, empresa_id,
        cliente_id=orden.vehiculo.cliente_id if orden.vehiculo else None,
        total=data.valor_cobrado,
        metodo_pago=data.metodo_pago,
        descripcion=f"Servicio de taller — {orden.vehiculo.placa if orden.vehiculo else ''}",
    )

    orden.valor_cobrado = data.valor_cobrado
    orden.estado_pago = "pagado"
    orden.estado = models.EstadoOrdenTaller.ENTREGADO.value
    orden.fecha_entrega_real = datetime.now(timezone.utc)
    orden.venta_id = venta.id
    orden.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(orden)
    return get_orden(db, empresa_id, orden_id)


def cerrar_reventa(
    db: Session, empresa_id: int, orden_id: int, data: schemas.OrdenTallerCerrarReventa,
) -> models.OrdenTaller:
    orden = db.query(models.OrdenTaller).filter(
        models.OrdenTaller.id == orden_id, models.OrdenTaller.empresa_id == empresa_id,
    ).first()
    if not orden:
        raise TallerError("Orden no encontrada.")
    if orden.tipo_orden != "remanufactura_reventa":
        raise TallerError("Esta orden no es de remanufactura y reventa.")
    if orden.estado not in ("listo", "en_reparacion", "diagnostico"):
        raise TallerError(f"No se puede cerrar una orden en estado '{orden.estado}'.")

    venta = _crear_venta_taller(
        db, empresa_id,
        cliente_id=data.comprador_cliente_id,
        total=data.precio_venta_final,
        metodo_pago=data.metodo_pago,
        descripcion=f"Venta de vehículo remanufacturado — {orden.vehiculo.placa if orden.vehiculo else ''}",
    )

    orden.precio_venta_final = data.precio_venta_final
    orden.comprador_cliente_id = data.comprador_cliente_id
    orden.estado = models.EstadoOrdenTaller.VENDIDO.value
    orden.fecha_entrega_real = datetime.now(timezone.utc)
    orden.venta_id = venta.id
    orden.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(orden)
    return get_orden(db, empresa_id, orden_id)


def _crear_venta_taller(db: Session, empresa_id: int, cliente_id, total: float, metodo_pago: str, descripcion: str) -> models.Venta:
    """Registra el cierre (cobro de servicio o venta de vehículo) como una
    Venta real del sistema — visible en Caja/Reportes/Financiero igual que
    cualquier otra venta, sin duplicar esa lógica contable aquí."""
    numero_venta = next_consecutivo(db, empresa_id, "ultimo_numero_venta")
    venta = models.Venta(
        empresa_id=empresa_id,
        cliente_id=cliente_id,
        total=round(total, 2),
        monto_pagado=round(total, 2),
        estado_pago="pagado",
        metodo_pago=metodo_pago,
        numero_venta=numero_venta,
        tipo="venta",
        fecha=datetime.now(timezone.utc),
        fecha_pago=datetime.now(timezone.utc),
    )
    db.add(venta)
    db.flush()
    db.add(models.DetalleVenta(
        empresa_id=empresa_id,
        venta_id=venta.id,
        nombre_libre=descripcion,
        cantidad=1,
        precio_unitario=round(total, 2),
        descuento_pct=0.0,
        iva_porcentaje=0.0,
    ))
    db.add(models.Pago(empresa_id=empresa_id, venta_id=venta.id, monto=round(total, 2), metodo_pago=metodo_pago))
    db.commit()
    db.refresh(venta)
    return venta


# ─── Notificaciones ─────────────────────────────────────────────────────────

def _notificar_nueva_orden(db: Session, empresa_id: int, orden: models.OrdenTaller, vehiculo: models.VehiculoTaller):
    mensaje = f"🔧 Nueva orden de taller #{orden.id} — {vehiculo.placa} ({vehiculo.tipo})"
    usuarios = db.query(models.User).filter(models.User.empresa_id == empresa_id, models.User.is_active == True).all()
    for u in usuarios:
        db.add(models.Notificacion(usuario_id=u.id, empresa_id=empresa_id, mensaje=mensaje, tipo="info"))
    db.commit()


def _notificar_vehiculo_listo(orden: models.OrdenTaller):
    vehiculo = orden.vehiculo
    if not vehiculo or not vehiculo.cliente or not getattr(vehiculo.cliente, "telefono", None):
        return
    from services.whatsapp_business import enviar_notificacion_vehiculo_listo
    valor = orden.valor_cobrado or orden.precio_venta_sugerido or 0
    fmt_valor = f"${valor:,.0f}".replace(",", ".")
    enviar_notificacion_vehiculo_listo(
        telefono_cliente=vehiculo.cliente.telefono,
        placa=vehiculo.placa,
        tipo_vehiculo=vehiculo.tipo,
        valor_formateado=fmt_valor,
    )


# ─── Estadísticas ────────────────────────────────────────────────────────────

def get_stats(db: Session, empresa_id: int) -> dict:
    from datetime import date
    from sqlalchemy import func as sqlfunc

    ordenes_activas = db.query(models.OrdenTaller).filter(
        models.OrdenTaller.empresa_id == empresa_id,
        models.OrdenTaller.estado.notin_(["entregado", "vendido", "cancelado"]),
    ).count()

    vehiculos_en_reparacion = db.query(models.OrdenTaller).filter(
        models.OrdenTaller.empresa_id == empresa_id,
        models.OrdenTaller.tipo_orden == "reparacion_cliente",
        models.OrdenTaller.estado.notin_(["entregado", "cancelado"]),
    ).count()

    vehiculos_en_reventa = db.query(models.OrdenTaller).filter(
        models.OrdenTaller.empresa_id == empresa_id,
        models.OrdenTaller.tipo_orden == "remanufactura_reventa",
        models.OrdenTaller.estado.notin_(["vendido", "cancelado"]),
    ).count()

    inicio_mes = date.today().replace(day=1)

    ingresos_servicios_mes = db.query(sqlfunc.coalesce(sqlfunc.sum(models.OrdenTaller.valor_cobrado), 0)).filter(
        models.OrdenTaller.empresa_id == empresa_id,
        models.OrdenTaller.tipo_orden == "reparacion_cliente",
        models.OrdenTaller.estado == "entregado",
        models.OrdenTaller.fecha_entrega_real >= inicio_mes,
    ).scalar() or 0.0

    reventas_mes = db.query(models.OrdenTaller).filter(
        models.OrdenTaller.empresa_id == empresa_id,
        models.OrdenTaller.tipo_orden == "remanufactura_reventa",
        models.OrdenTaller.estado == "vendido",
        models.OrdenTaller.fecha_entrega_real >= inicio_mes,
    ).all()
    invertido_reventa_mes = sum(_costo_acumulado(o) for o in reventas_mes)
    vendido_reventa_mes = sum(o.precio_venta_final or 0 for o in reventas_mes)

    return {
        "ordenes_activas": ordenes_activas,
        "vehiculos_en_reparacion": vehiculos_en_reparacion,
        "vehiculos_en_reventa": vehiculos_en_reventa,
        "ingresos_servicios_mes": round(ingresos_servicios_mes, 2),
        "invertido_reventa_mes": round(invertido_reventa_mes, 2),
        "vendido_reventa_mes": round(vendido_reventa_mes, 2),
        "margen_reventa_mes": round(vendido_reventa_mes - invertido_reventa_mes, 2),
    }
