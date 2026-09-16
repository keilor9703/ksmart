from sqlalchemy.orm import Session, joinedload, load_only
from sqlalchemy import func, text, cast, Date, or_
from typing import Optional, List
from datetime import date, datetime, timezone
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ, UTC_TZ, get_utc_boundaries, _is_postgres
from crud.productos import get_producto

# ═══════════════════════════════════════════════════════════════════════════════
# INVENTARIO - MOVIMIENTOS, KARDEX, ALERTAS
# ═══════════════════════════════════════════════════════════════════════════════

def create_movement(db: Session, empresa_id: int, payload: schemas.InventoryMovementCreate, commit: bool = True,
                    descontar_lotes: bool = False):
    prod = get_producto(db, empresa_id, payload.producto_id)
    if not prod:
        raise ValueError("Producto no encontrado o no pertenece a esta empresa")

    delta = payload.cantidad
    if payload.tipo == schemas.MovementType.salida:
        delta = -abs(payload.cantidad)
    elif payload.tipo == schemas.MovementType.entrada:
        delta = abs(payload.cantidad)
    elif payload.tipo == schemas.MovementType.ajuste:
        delta = payload.cantidad

    # Movimiento dirigido a una variante específica: el stock que se mueve es
    # el de la variante (igual que ya hace Ventas), no el del producto padre
    # — evita que un ajuste manual "a ciegas" descuadre el stock por talla/color.
    variante = None
    nombre_variante = None
    if payload.variante_id is not None:
        variante = db.query(models.ProductoVariante).filter(
            models.ProductoVariante.id == payload.variante_id,
            models.ProductoVariante.producto_id == payload.producto_id,
            models.ProductoVariante.empresa_id == empresa_id,
        ).first()
        if not variante:
            raise ValueError("La variante indicada no existe o no pertenece a este producto")
        nombre_variante = variante.nombre

        new_stock = (variante.stock_actual or 0) + delta
        if new_stock < 0:
            raise ValueError(f"Stock insuficiente en la variante '{variante.nombre}'")
        variante.stock_actual = new_stock
        db.add(variante)
    else:
        new_stock = (prod.stock_actual or 0) + delta
        if new_stock < 0:
            raise ValueError("Stock insuficiente")
        prod.stock_actual = new_stock
        db.add(prod)

    # Sincronizar lotes en salidas manuales de productos perecederos: sin esto
    # el stock del producto baja pero los lotes quedan intactos y se
    # desincronizan (stock_actual < suma de lotes). Best-effort FEFO: se
    # descuenta de los lotes vigentes hasta donde alcancen; el remanente se
    # asume stock fuera de lotes. Solo lo activa el endpoint de movimientos
    # manuales — los flujos de venta/producción gestionan sus lotes aparte.
    # (No aplica a movimientos por variante: los lotes son por producto.)
    if descontar_lotes and variante is None and delta < 0 and getattr(prod, "maneja_lotes", False):
        from crud.perecederos import get_lotes_fefo
        restante = abs(delta)
        for lote in get_lotes_fefo(db, empresa_id, payload.producto_id):
            if restante <= 0:
                break
            consumo = min(lote.cantidad_actual, restante)
            lote.cantidad_actual -= consumo
            restante -= consumo
            db.add(lote)

    ahora_utc = datetime.now(timezone.utc)

    mov = models.InventoryMovement(
        producto_id=payload.producto_id,
        tipo=payload.tipo.value,
        cantidad=payload.cantidad,
        costo_unitario=payload.costo_unitario,
        motivo=payload.motivo or "",
        referencia=payload.referencia or "",
        observacion=payload.observacion or "",
        empresa_id=empresa_id,
        created_at=ahora_utc,
        usuario_id=payload.usuario_id,
        variante_id=payload.variante_id,
        nombre_variante=nombre_variante,
    )
    db.add(mov)
    if commit:
        db.commit()
        db.refresh(mov)
    return mov

def list_movements(db: Session, empresa_id: int, producto_id: int = None, limit: int = 100,
                   lote_id: int = None, numero_lote: str = None):
    # Cargamos el producto en la MISMA consulta (evita N+1) y solo las columnas
    # que la UI necesita — sin la columna `imagenes` (base64), que hacía el
    # historial de movimientos lentísimo y con payloads enormes.
    q = db.query(models.InventoryMovement).options(
        joinedload(models.InventoryMovement.producto).load_only(
            models.Producto.id,
            models.Producto.nombre,
            models.Producto.codigo_barras,
            models.Producto.unidad_medida,
        )
    ).filter(
        models.InventoryMovement.empresa_id == empresa_id
    ).order_by(models.InventoryMovement.created_at.desc())

    if producto_id:
        q = q.filter(models.InventoryMovement.producto_id == producto_id)
    if lote_id or numero_lote:
        conds = []
        if lote_id:
            conds.append(models.InventoryMovement.lote_id == lote_id)
        if numero_lote:
            conds.append(models.InventoryMovement.numero_lote == numero_lote)
        q = q.filter(or_(*conds))

    return q.limit(limit).all()

def get_low_stock(db: Session, empresa_id: int):
    """Devuelve dicts (producto_id, nombre, stock_actual, stock_minimo) — no
    filas de Producto directamente, porque un producto con variantes nunca
    acumula stock propio (cada movimiento va a su variante); usar su
    stock_actual/stock_minimo de padre generaría falsas alertas permanentes.
    Para esos casos se evalúa cada variante activa por separado."""
    prods = db.query(models.Producto).filter(
        models.Producto.empresa_id == empresa_id,
        models.Producto.vigente == True,
        models.Producto.stock_minimo.isnot(None),
        models.Producto.stock_minimo > 0,
    ).all()

    alertas = []
    for p in prods:
        if p.tiene_variantes:
            for v in (p.variantes or []):
                if not v.activo or not v.stock_minimo:
                    continue
                if (v.stock_actual or 0) < v.stock_minimo:
                    alertas.append({
                        "producto_id": p.id,
                        "nombre": f"{p.nombre} — {v.nombre}",
                        "stock_actual": v.stock_actual or 0,
                        "stock_minimo": v.stock_minimo,
                    })
        elif (p.stock_actual or 0) < p.stock_minimo:
            alertas.append({
                "producto_id": p.id,
                "nombre": p.nombre,
                "stock_actual": p.stock_actual or 0,
                "stock_minimo": p.stock_minimo,
            })
    return alertas

def update_producto_stock_minimo(db: Session, empresa_id: int, producto_id: int, minimo: float):
    prod = get_producto(db, empresa_id, producto_id)
    if not prod:
        return None
    prod.stock_minimo = minimo
    db.commit()
    db.refresh(prod)
    return prod

def get_kardex_promedio_ponderado(
    db: Session,
    empresa_id: int,
    producto_id: int,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> schemas.KardexResponse:
    prod = get_producto(db, empresa_id, producto_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    q = db.query(models.InventoryMovement).filter(
        models.InventoryMovement.producto_id == producto_id,
        models.InventoryMovement.empresa_id == empresa_id
    )

    if start_date:
        utc_start, _ = get_utc_boundaries(start_date.date())
        q = q.filter(models.InventoryMovement.created_at >= utc_start)
    if end_date:
        _, utc_end = get_utc_boundaries(end_date.date())
        q = q.filter(models.InventoryMovement.created_at <= utc_end)

    movimientos = q.order_by(
        models.InventoryMovement.created_at.asc(),
        models.InventoryMovement.id.asc()
    ).all()

    saldo_cant = 0.0
    saldo_valor = 0.0
    saldo_costo_unit = 0.0

    items: List[schemas.KardexItem] = []
    for m in movimientos:
        tipo = m.tipo.value if hasattr(m.tipo, "value") else str(m.tipo)
        cant = float(m.cantidad or 0.0)
        costo_u = float(m.costo_unitario or 0.0)

        if tipo == "entrada" or (tipo == "ajuste" and cant > 0):
            entrada_valor = cant * costo_u
            saldo_valor = saldo_valor + entrada_valor
            saldo_cant = saldo_cant + cant
            saldo_costo_unit = (saldo_valor / saldo_cant) if saldo_cant > 0 else 0.0
        else:
            salida_valor = cant * saldo_costo_unit
            saldo_valor = max(0.0, saldo_valor - salida_valor)
            saldo_cant = max(0.0, saldo_cant - cant)
            saldo_costo_unit = (saldo_valor / saldo_cant) if saldo_cant > 0 else 0.0

        items.append(
            schemas.KardexItem(
                fecha=m.created_at,
                tipo=tipo,
                cantidad=cant,
                costo_unitario=costo_u if tipo == "entrada" else saldo_costo_unit,
                referencia=m.referencia,
                saldo_cantidad=saldo_cant,
                saldo_costo_unitario=saldo_costo_unit,
                saldo_valor=saldo_valor,
            )
        )

    return schemas.KardexResponse(
        producto_id=prod.id,
        producto_nombre=prod.nombre,
        items=items,
    )

def get_inventario_actual(db: Session, empresa_id: int) -> schemas.InventarioSnapshot:
    prods = db.query(models.Producto).filter(
        models.Producto.empresa_id == empresa_id,
        models.Producto.vigente == True,
    ).all()

    items: List[schemas.InventarioItem] = []
    total_costo = 0.0
    total_venta = 0.0
    for p in prods:
        # Un producto con variantes no acumula su propio stock_actual (cada
        # movimiento va a la variante correspondiente) — sin esto, su fila
        # reportaría siempre stock/valor $0 pese a tener inventario real
        # repartido en sus variantes.
        if p.tiene_variantes:
            for v in (p.variantes or []):
                if not v.activo:
                    continue
                stock = float(v.stock_actual or 0.0)
                costo = float(v.costo if v.costo is not None else (p.costo or 0.0))
                precio = float(v.precio if v.precio is not None else (p.precio or 0.0))
                valor_costo = stock * costo
                valor_venta = stock * precio
                total_costo += valor_costo
                total_venta += valor_venta
                items.append(
                    schemas.InventarioItem(
                        id=p.id,
                        nombre=f"{p.nombre} — {v.nombre}",
                        es_servicio=bool(p.es_servicio),
                        unidad_medida=p.unidad_medida,
                        stock_actual=stock,
                        stock_minimo=float(v.stock_minimo or 0.0),
                        costo=costo,
                        precio=precio,
                        valor_costo=valor_costo,
                        valor_venta=valor_venta,
                        variante_id=v.id,
                        nombre_variante=v.nombre,
                    )
                )
            continue

        stock = float(p.stock_actual or 0.0)
        costo = float(p.costo or 0.0)
        precio = float(p.precio or 0.0)
        valor_costo = stock * costo
        valor_venta = stock * precio
        total_costo += valor_costo
        total_venta += valor_venta

        items.append(
            schemas.InventarioItem(
                id=p.id,
                nombre=p.nombre,
                es_servicio=bool(p.es_servicio),
                unidad_medida=p.unidad_medida,
                stock_actual=stock,
                stock_minimo=float(p.stock_minimo or 0.0),
                costo=costo,
                precio=precio,
                valor_costo=valor_costo,
                valor_venta=valor_venta,
            )
        )

    return schemas.InventarioSnapshot(
        items=items,
        total_valor_costo=total_costo,
        total_valor_venta=total_venta,
    )

def get_rotacion_productos(
    db: Session,
    empresa_id: int,
    start_date: Optional[date],
    end_date: Optional[date],
    limit: int = 10,
    incluir_servicios: bool = False,
) -> schemas.ReporteRotacion:
    q = (
        db.query(
            models.Producto.id.label("producto_id"),
            models.Producto.nombre.label("nombre"),
            models.Producto.es_servicio.label("es_servicio"),
            func.coalesce(func.sum(models.DetalleVenta.cantidad), 0).label("total_cantidad"),
            func.coalesce(func.sum(models.DetalleVenta.cantidad * models.DetalleVenta.precio_unitario), 0).label("total_ingresos"),
        )
        .join(models.DetalleVenta, models.DetalleVenta.producto_id == models.Producto.id)
        .join(models.Venta, models.DetalleVenta.venta_id == models.Venta.id)
        .filter(
            models.Producto.empresa_id == empresa_id,
            models.Venta.empresa_id == empresa_id
        )
    )

    if start_date:
        utc_start, _ = get_utc_boundaries(start_date)
        q = q.filter(models.Venta.fecha >= utc_start)
    if end_date:
        _, utc_end = get_utc_boundaries(end_date)
        q = q.filter(models.Venta.fecha <= utc_end)

    if not incluir_servicios:
        q = q.filter(models.Producto.es_servicio == False)

    q = q.group_by(models.Producto.id, models.Producto.nombre, models.Producto.es_servicio)

    top_rows = q.order_by(func.coalesce(func.sum(models.DetalleVenta.cantidad), 0).desc()).limit(limit).all()

    slow_rows = (
        q.having(func.coalesce(func.sum(models.DetalleVenta.cantidad), 0) > 0)
         .order_by(func.coalesce(func.sum(models.DetalleVenta.cantidad), 0).asc())
         .limit(limit)
         .all()
    )

    def map_row(r) -> schemas.ProductoRotacionItem:
        return schemas.ProductoRotacionItem(
            producto_id=r.producto_id,
            nombre=r.nombre,
            es_servicio=bool(r.es_servicio),
            total_cantidad_vendida=float(r.total_cantidad or 0.0),
            total_ingresos=float(r.total_ingresos or 0.0),
        )

    return schemas.ReporteRotacion(
        start_date=start_date,
        end_date=end_date,
        top=[map_row(r) for r in top_rows],
        slow=[map_row(r) for r in slow_rows],
    )
