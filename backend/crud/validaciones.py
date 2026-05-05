from sqlalchemy.orm import Session
import models

# ═══════════════════════════════════════════════════════════════════════════════
# VALIDACIONES DE ELIMINACIÓN
# ═══════════════════════════════════════════════════════════════════════════════

def check_can_delete_cliente(db: Session, empresa_id: int, cliente_id: int) -> list:
    """✅ FILTRADO POR EMPRESA"""
    bloqueos = []
    ventas = db.query(models.Venta).filter(
        models.Venta.cliente_id == cliente_id,
        models.Venta.empresa_id == empresa_id  # ✅
    ).count()
    if ventas:
        bloqueos.append(f"{ventas} venta{'s' if ventas > 1 else ''}")

    compras = db.query(models.Compra).filter(
        models.Compra.proveedor_id == cliente_id,
        models.Compra.empresa_id == empresa_id  # ✅
    ).count()
    if compras:
        bloqueos.append(f"{compras} compra{'s' if compras > 1 else ''} como proveedor")

    ordenes = db.query(models.OrdenTrabajo).filter(
        models.OrdenTrabajo.cliente_id == cliente_id,
        models.OrdenTrabajo.empresa_id == empresa_id  # ✅
    ).count()
    if ordenes:
        bloqueos.append(f"{ordenes} orden{'es' if ordenes > 1 else ''} de trabajo")

    lotes = db.query(models.LoteProduccion).filter(
        models.LoteProduccion.cliente_id == cliente_id,
        models.LoteProduccion.empresa_id == empresa_id  # ✅
    ).count()
    if lotes:
        bloqueos.append(f"{lotes} lote{'s' if lotes > 1 else ''} de producción")

    return bloqueos

def check_can_delete_producto(db: Session, empresa_id: int, producto_id: int) -> list:
    """✅ FILTRADO POR EMPRESA - Productos pueden aparecer en ventas/compras de la misma empresa"""
    bloqueos = []

    # Revisar detalles de venta (join para filtrar por empresa de la venta)
    dv = db.query(models.DetalleVenta).join(models.Venta).filter(
        models.DetalleVenta.producto_id == producto_id,
        models.Venta.empresa_id == empresa_id  # ✅
    ).count()
    if dv:
        bloqueos.append(f"usado en {dv} venta{'s' if dv > 1 else ''}")

    dc = db.query(models.DetalleCompra).join(models.Compra).filter(
        models.DetalleCompra.producto_id == producto_id,
        models.Compra.empresa_id == empresa_id  # ✅
    ).count()
    if dc:
        bloqueos.append(f"usado en {dc} compra{'s' if dc > 1 else ''}")

    mov = db.query(models.InventoryMovement).filter(
        models.InventoryMovement.producto_id == producto_id,
        models.InventoryMovement.empresa_id == empresa_id  # ✅
    ).count()
    if mov:
        bloqueos.append(f"tiene {mov} movimiento{'s' if mov > 1 else ''} de inventario")

    receta = db.query(models.Receta).filter(
        models.Receta.producto_id == producto_id,
        models.Receta.empresa_id == empresa_id  # ✅
    ).first()
    if receta:
        bloqueos.append("tiene una receta de producción asociada")

    en_receta = db.query(models.RecetaItem).join(models.Receta).filter(
        models.RecetaItem.insumo_id == producto_id,
        models.Receta.empresa_id == empresa_id  # ✅
    ).count()
    if en_receta:
        bloqueos.append(f"es insumo en {en_receta} receta{'s' if en_receta > 1 else ''}")

    op = db.query(models.OrdenProducto).join(models.OrdenTrabajo).filter(
        models.OrdenProducto.producto_id == producto_id,
        models.OrdenTrabajo.empresa_id == empresa_id  # ✅
    ).count()
    if op:
        bloqueos.append(f"en {op} orden{'es' if op > 1 else ''} de trabajo")

    os_ = db.query(models.OrdenServicio).join(models.OrdenTrabajo).filter(
        models.OrdenServicio.servicio_id == producto_id,
        models.OrdenTrabajo.empresa_id == empresa_id  # ✅
    ).count()
    if os_:
        bloqueos.append(f"como servicio en {os_} orden{'es' if os_ > 1 else ''}")

    return bloqueos

def check_can_delete_venta(db: Session, empresa_id: int, venta_id: int) -> list:
    """✅ FILTRADO POR EMPRESA"""
    bloqueos = []
    devs = db.query(models.Devolucion).filter(
        models.Devolucion.venta_id == venta_id,
        models.Devolucion.empresa_id == empresa_id  # ✅
    ).count()
    if devs:
        bloqueos.append(f"tiene {devs} devolución{'es' if devs > 1 else ''} registrada{'s' if devs > 1 else ''}")

    orden = db.query(models.OrdenTrabajo).filter(
        models.OrdenTrabajo.venta_id == venta_id,
        models.OrdenTrabajo.empresa_id == empresa_id  # ✅
    ).first()
    if orden:
        bloqueos.append(f"vinculada a la orden de trabajo #{orden.id}")

    return bloqueos

def check_can_delete_receta(db: Session, empresa_id: int, receta_id: int) -> list:
    """✅ FILTRADO POR EMPRESA"""
    bloqueos = []
    lotes = db.query(models.LoteProduccion).filter(
        models.LoteProduccion.receta_id == receta_id,
        models.LoteProduccion.empresa_id == empresa_id  # ✅
    ).count()
    if lotes:
        bloqueos.append(f"tiene {lotes} lote{'s' if lotes > 1 else ''} de producción asociado{'s' if lotes > 1 else ''}")

    return bloqueos
