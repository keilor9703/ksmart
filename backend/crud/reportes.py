from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, text, cast, Date, case
from typing import Optional, List
from datetime import date, datetime, timedelta
import models, schemas
from crud.common import BOGOTA_TZ, UTC_TZ, get_utc_boundaries, _is_postgres
from crud.inventario import get_low_stock

# ═══════════════════════════════════════════════════════════════════════════════
# REPORTES
# ═══════════════════════════════════════════════════════════════════════════════

def get_ventas_summary(db: Session, empresa_id: int, start_date: Optional[date] = None, end_date: Optional[date] = None):
    query_ventas = db.query(models.Venta).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.tipo == "venta",
    )
    query_compras = db.query(models.Compra).filter(models.Compra.empresa_id == empresa_id)
    query_gastos = db.query(models.Gasto).filter(models.Gasto.empresa_id == empresa_id)

    if start_date:
        utc_start, _ = get_utc_boundaries(start_date)
        query_ventas = query_ventas.filter(models.Venta.fecha >= utc_start)
        query_compras = query_compras.filter(models.Compra.fecha >= utc_start)
        query_gastos = query_gastos.filter(models.Gasto.fecha >= utc_start)

    if end_date:
        _, utc_end = get_utc_boundaries(end_date)
        query_ventas = query_ventas.filter(models.Venta.fecha <= utc_end)
        query_compras = query_compras.filter(models.Compra.fecha <= utc_end)
        query_gastos = query_gastos.filter(models.Gasto.fecha <= utc_end)

    ventas = query_ventas.all()
    compras = query_compras.all()
    gastos = query_gastos.all()

    total_pagado = sum(venta.monto_pagado or 0 for venta in ventas)
    total_pendiente = sum((venta.total or 0) - (venta.monto_pagado or 0) for venta in ventas if venta.estado_pago != "pagado")
    total_general = sum(venta.total or 0 for venta in ventas)

    total_compras = sum(compra.monto_pagado or 0 for compra in compras)
    total_gastos = sum(gasto.monto or 0 for gasto in gastos)

    # ✅ VENTAS DE HOY EXACTAS USANDO BOUNDARIES UTC Y CAST DE FECHA PARA SEGURIDAD POSTGRES
    hoy_colombia = datetime.now(BOGOTA_TZ).date()
    inicio_utc_hoy, fin_utc_hoy = get_utc_boundaries(hoy_colombia)

    ventas_hoy = db.query(models.Venta).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.tipo == "venta",
        models.Venta.fecha >= inicio_utc_hoy,
        models.Venta.fecha <= fin_utc_hoy,
    ).all()

    total_ventas_hoy = sum(v.total or 0 for v in ventas_hoy)

    return schemas.VentasSummary(
        total_pagado=total_pagado,
        total_pendiente=total_pendiente,
        total_general=total_general,
        total_ventas_hoy=total_ventas_hoy,
        total_compras=total_compras,
        total_gastos=total_gastos
    )

def get_cuentas_por_cobrar_por_cliente(db: Session, empresa_id: int):
    clientes_con_pendientes = db.query(models.Cliente).join(models.Venta).filter(
        models.Cliente.empresa_id == empresa_id,
        models.Venta.empresa_id == empresa_id,
        models.Venta.tipo == "venta",
        (models.Venta.estado_pago == "pendiente") | (models.Venta.estado_pago == "parcial")
    ).distinct().all()

    result = []
    for cliente in clientes_con_pendientes:
        ventas_pendientes_cliente = db.query(models.Venta).options(
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
            joinedload(models.Venta.pagos)
        ).filter(
            models.Venta.cliente_id == cliente.id,
            models.Venta.empresa_id == empresa_id,
            models.Venta.tipo == "venta",
            (models.Venta.estado_pago == "pendiente") | (models.Venta.estado_pago == "parcial")
        ).all()

        monto_pendiente_total = sum(venta.total - venta.monto_pagado for venta in ventas_pendientes_cliente)

        result.append(schemas.ClienteCuentasPorCobrar(
            cliente_id=cliente.id,
            cliente_nombre=cliente.nombre,
            monto_pendiente=monto_pendiente_total,
            ventas_pendientes=ventas_pendientes_cliente
        ))
    return result

def get_productos_vendidos(db: Session, empresa_id: int, start_date: Optional[date] = None, end_date: Optional[date] = None):
    query = (
        db.query(
            models.Producto.id.label("product_id"),
            models.Producto.nombre.label("product_name"),
            models.Producto.es_servicio.label("es_servicio"),
            func.sum(models.DetalleVenta.cantidad).label("total_quantity_sold"),
            func.sum(models.DetalleVenta.cantidad * models.DetalleVenta.precio_unitario).label("total_revenue")
        )
        .join(models.DetalleVenta, models.Producto.id == models.DetalleVenta.producto_id)
        .join(models.Venta, models.DetalleVenta.venta_id == models.Venta.id)
        .filter(
            models.Producto.empresa_id == empresa_id,
            models.Venta.empresa_id == empresa_id,
            models.Venta.tipo == "venta",
        )
    )

    if start_date:
        utc_start, _ = get_utc_boundaries(start_date)
        query = query.filter(models.Venta.fecha >= utc_start)
    if end_date:
        _, utc_end = get_utc_boundaries(end_date)
        query = query.filter(models.Venta.fecha <= utc_end)

    query = (
        query.group_by(models.Producto.id, models.Producto.nombre, models.Producto.es_servicio)
             .order_by(func.sum(models.DetalleVenta.cantidad).desc())
    )

    resultados = query.all()

    productos_vendidos = [schemas.ProductoVendido.from_orm(row) for row in resultados if not row.es_servicio]
    servicios_vendidos = [schemas.ProductoVendido.from_orm(row) for row in resultados if row.es_servicio]

    return schemas.ReporteProductosVendidos(
        productos=productos_vendidos,
        servicios=servicios_vendidos
    )

def get_clientes_compradores(db: Session, empresa_id: int, start_date: Optional[date] = None, end_date: Optional[date] = None):
    query = (
        db.query(
            models.Cliente.id.label("client_id"),
            models.Cliente.nombre.label("client_name"),
            func.sum(models.Venta.total).label("total_purchase_amount")
        )
        .join(models.Venta, models.Cliente.id == models.Venta.cliente_id)
        .filter(
            models.Cliente.empresa_id == empresa_id,
            models.Venta.empresa_id == empresa_id,
            models.Venta.tipo == "venta",
        )
    )

    if start_date:
        utc_start, _ = get_utc_boundaries(start_date)
        query = query.filter(models.Venta.fecha >= utc_start)
    if end_date:
        _, utc_end = get_utc_boundaries(end_date)
        query = query.filter(models.Venta.fecha <= utc_end)

    query = (
        query.group_by(models.Cliente.id, models.Cliente.nombre)
             .order_by(func.sum(models.Venta.total).desc())
    )

    return [schemas.ClienteComprador.from_orm(row) for row in query.all()]

def get_clientes_deudores(db: Session, empresa_id: int):
    query = (
        db.query(
            models.Cliente.id.label("client_id"),
            models.Cliente.nombre.label("client_name"),
            (func.sum(models.Venta.total) - func.sum(models.Venta.monto_pagado)).label("total_debt_amount")
        )
        .join(models.Venta, models.Cliente.id == models.Venta.cliente_id)
        .filter(
            models.Cliente.empresa_id == empresa_id,
            models.Venta.empresa_id == empresa_id,
            models.Venta.tipo == "venta",
            models.Venta.estado_pago != "pagado",
        )
    )

    query = (
        query.group_by(models.Cliente.id, models.Cliente.nombre)
             .having((func.sum(models.Venta.total) - func.sum(models.Venta.monto_pagado)) > 0)
             .order_by((func.sum(models.Venta.total) - func.sum(models.Venta.monto_pagado)).desc())
    )

    return [schemas.ClienteDeudor.from_orm(row) for row in query.all()]

def get_rentabilidad_por_producto(db: Session, empresa_id: int, start_date: Optional[date] = None, end_date: Optional[date] = None):
    query = (
        db.query(
            models.Producto.id.label("product_id"),
            models.Producto.nombre.label("product_name"),
            func.sum(models.DetalleVenta.cantidad).label("total_quantity_sold"),
            func.sum(models.DetalleVenta.precio_unitario * models.DetalleVenta.cantidad).label("total_revenue"),
            func.sum(models.Producto.costo * models.DetalleVenta.cantidad).label("total_cost")
        )
        .join(models.DetalleVenta, models.Producto.id == models.DetalleVenta.producto_id)
        .join(models.Venta, models.DetalleVenta.venta_id == models.Venta.id)
        .filter(
            models.Producto.empresa_id == empresa_id,
            models.Venta.empresa_id == empresa_id,
            models.Venta.tipo == "venta",
        )
    )

    if start_date:
        utc_start, _ = get_utc_boundaries(start_date)
        query = query.filter(models.Venta.fecha >= utc_start)
    if end_date:
        _, utc_end = get_utc_boundaries(end_date)
        query = query.filter(models.Venta.fecha <= utc_end)

    results = query.group_by(models.Producto.id, models.Producto.nombre).all()

    report_data = []
    for row in results:
        net_profit = row.total_revenue - row.total_cost
        profit_margin = (net_profit / row.total_revenue) * 100 if row.total_revenue > 0 else 0
        report_data.append(schemas.ProductoRentabilidad(
            product_id=row.product_id,
            product_name=row.product_name,
            total_quantity_sold=row.total_quantity_sold,
            total_revenue=row.total_revenue,
            total_cost=row.total_cost,
            net_profit=net_profit,
            profit_margin=profit_margin
        ))

    return sorted(report_data, key=lambda x: x.net_profit, reverse=True)


# 2. REEMPLAZA LA FUNCIÓN get_sales_by_day (Aprox Línea 770)
def get_sales_by_day(db: Session, empresa_id: int, start_date: date, end_date: date):
    utc_start, _ = get_utc_boundaries(start_date)
    _, utc_end = get_utc_boundaries(end_date)

    ventas = db.query(models.Venta).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.tipo == "venta",
        models.Venta.fecha >= utc_start,
        models.Venta.fecha <= utc_end
    ).all()

    sales_map = {}
    for v in ventas:
        col_date = v.fecha.astimezone(BOGOTA_TZ).date()
        key = col_date.isoformat()
        sales_map[key] = sales_map.get(key, 0.0) + float(v.total or 0)

    # ✅ NUEVA LÓGICA: DIBUJAR LA GRÁFICA CON LOS RECAUDOS DE PRÉSTAMOS
    cuotas_pagadas = db.query(models.CuotaPrestamo).filter(
        models.CuotaPrestamo.empresa_id == empresa_id,
        models.CuotaPrestamo.estado_pago == "Pagado",
        models.CuotaPrestamo.fecha_pago >= utc_start,
        models.CuotaPrestamo.fecha_pago <= utc_end
    ).all()

    for c in cuotas_pagadas:
        if c.fecha_pago:
            col_date = c.fecha_pago.astimezone(BOGOTA_TZ).date()
            key = col_date.isoformat()
            sales_map[key] = sales_map.get(key, 0.0) + float(c.monto_cuota or 0)

    all_days = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]
    return [
        schemas.SalesByDay(day=d, total=sales_map.get(d.isoformat(), 0.0))
        for d in all_days
    ]


def get_total_sales_today(db: Session, empresa_id: int) -> float:
    hoy = datetime.now(BOGOTA_TZ).date()
    inicio_utc, fin_utc = get_utc_boundaries(hoy)

    total = db.query(func.sum(models.Venta.total)).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.tipo == "venta",
        models.Venta.fecha >= inicio_utc,
        models.Venta.fecha <= fin_utc
    ).scalar()
    return float(total or 0)

# 1. Reemplaza la función get_dashboard_data:
def get_dashboard_data(db: Session, empresa_id: int) -> schemas.DashboardData:
    from crud.ordenes_trabajo import get_ordenes_trabajo
    hoy_colombia = datetime.now(BOGOTA_TZ).date()
    inicio_utc_hoy, fin_utc_hoy = get_utc_boundaries(hoy_colombia)

    # --- MÉTRICAS ERP (PRODUCTOS) ---
    # Ventas totales del día (creadas hoy)
    ventas_hoy_recs = db.query(models.Venta).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.fecha >= inicio_utc_hoy,
        models.Venta.fecha <= fin_utc_hoy,
        models.Venta.tipo == "venta",
    ).all()
    ventas_hoy = sum(v.total or 0 for v in ventas_hoy_recs)

    # ← NUEVO: sumar también los abonos a cartera recibidos hoy
    abonos_hoy = db.query(func.sum(models.Pago.monto)).join(models.Venta).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.tipo == "venta",
        models.Pago.fecha >= inicio_utc_hoy,
        models.Pago.fecha <= fin_utc_hoy,
    ).scalar() or 0.0

    ventas_hoy += abonos_hoy   # el KPI del dashboard ahora refleja todo el dinero recibido hoy


    deudores = get_clientes_deudores(db, empresa_id)
    cuentas_por_cobrar = sum(d.total_debt_amount for d in deudores)
    productos_bajo_stock = len(get_low_stock(db, empresa_id))

    # --- MÉTRICAS PRÉSTAMOS ---
    recaudo_hoy = db.query(func.sum(models.CuotaPrestamo.monto_cuota)).filter(
        models.CuotaPrestamo.empresa_id == empresa_id,
        models.CuotaPrestamo.estado_pago == "Pagado",
        models.CuotaPrestamo.fecha_pago >= inicio_utc_hoy,
        models.CuotaPrestamo.fecha_pago <= fin_utc_hoy
    ).scalar() or 0.0

    capital_calle = db.query(func.sum(models.CuotaPrestamo.saldo_pendiente)).filter(
        models.CuotaPrestamo.empresa_id == empresa_id,
        models.CuotaPrestamo.estado_pago != "Pagado"
    ).scalar() or 0.0

    cuotas_mora = db.query(models.CuotaPrestamo).filter(
        models.CuotaPrestamo.empresa_id == empresa_id,
        models.CuotaPrestamo.fecha_vencimiento < hoy_colombia,
        models.CuotaPrestamo.estado_pago != "Pagado"
    ).count()

    # Gráfica de ventas (ERP) — 30 days ending today
    end_date = hoy_colombia
    start_date = end_date - timedelta(days=29)
    ventas_30 = get_sales_by_day(db, empresa_id, start_date, end_date)

    # ventas_ayer — directly from the 30-day array (index 28 = yesterday)
    ventas_ayer = ventas_30[28].total if len(ventas_30) >= 29 else 0.0

    # Intereses cobrados hoy — interest portion of cuotas paid today
    cuotas_hoy = (
        db.query(models.CuotaPrestamo, models.Prestamo.tasa_interes)
        .join(models.Prestamo, models.CuotaPrestamo.prestamo_id == models.Prestamo.id)
        .filter(
            models.CuotaPrestamo.empresa_id == empresa_id,
            models.CuotaPrestamo.estado_pago == "Pagado",
            models.CuotaPrestamo.fecha_pago >= inicio_utc_hoy,
            models.CuotaPrestamo.fecha_pago <= fin_utc_hoy,
        )
        .all()
    )
    intereses_hoy = sum(
        float(c.monto_cuota or 0) * t / (100.0 + t)
        for c, t in cuotas_hoy
        if t and t > 0
    )

    return schemas.DashboardData(
        ventas_hoy=ventas_hoy,
        cuentas_por_cobrar=cuentas_por_cobrar,
        productos_bajo_stock=productos_bajo_stock,
        recaudo_prestamos_hoy=float(recaudo_hoy),
        capital_en_calle=float(capital_calle),
        cuotas_mora=cuotas_mora,
        intereses_cobrados_hoy=round(intereses_hoy, 2),
        ventas_ayer=round(ventas_ayer, 2),
        ordenes_recientes=get_ordenes_trabajo(db, empresa_id, skip=0, limit=5),
        ventas_ultimos_30_dias=ventas_30,
    )


# ─── Ventas por Vendedor ──────────────────────────────────────────────────────

def get_ventas_por_vendedor(
    db: Session,
    empresa_id: int,
    start_date: Optional[date] = None,
    end_date:   Optional[date] = None,
) -> schemas.ReporteVentasVendedor:
    q = (
        db.query(
            models.User.id.label("vendedor_id"),
            func.coalesce(models.User.nombre_completo, models.User.username).label("nombre"),
            models.User.email.label("email"),
            func.count(models.Venta.id).label("total_ventas"),
            func.coalesce(func.sum(models.Venta.total),       0.0).label("total_ingresos"),
            func.coalesce(func.sum(models.Venta.monto_pagado), 0.0).label("total_cobrado"),
            func.sum(case((models.Venta.estado_pago == "pagado",   1), else_=0)).label("ventas_pagadas"),
            func.sum(case((models.Venta.estado_pago == "pendiente", 1), else_=0)).label("ventas_pendientes"),
        )
        .join(models.Venta, models.Venta.operador_id == models.User.id)
        .filter(
            models.Venta.empresa_id == empresa_id,
            models.Venta.tipo == "venta",
        )
    )
    if start_date:
        utc_start, _ = get_utc_boundaries(start_date)
        q = q.filter(models.Venta.fecha >= utc_start)
    if end_date:
        _, utc_end = get_utc_boundaries(end_date)
        q = q.filter(models.Venta.fecha <= utc_end)

    rows = q.group_by(
        models.User.id,
        models.User.nombre_completo,
        models.User.username,
        models.User.email,
    ).all()

    total_ingresos_global = sum(r.total_ingresos for r in rows)

    vendedores = []
    for r in rows:
        pendiente      = max(r.total_ingresos - r.total_cobrado, 0.0)
        ticket_prom    = r.total_ingresos / r.total_ventas if r.total_ventas > 0 else 0.0
        pct            = (r.total_ingresos / total_ingresos_global * 100) if total_ingresos_global > 0 else 0.0
        vendedores.append(schemas.VendedorVentaStats(
            vendedor_id       = r.vendedor_id,
            nombre            = r.nombre or f"Usuario #{r.vendedor_id}",
            email             = r.email,
            total_ventas      = r.total_ventas,
            total_ingresos    = round(r.total_ingresos, 2),
            total_cobrado     = round(r.total_cobrado, 2),
            total_pendiente   = round(pendiente, 2),
            ticket_promedio   = round(ticket_prom, 2),
            ventas_pagadas    = r.ventas_pagadas,
            ventas_pendientes = r.ventas_pendientes,
            pct_total         = round(pct, 1),
        ))

    vendedores.sort(key=lambda v: v.total_ingresos, reverse=True)

    return schemas.ReporteVentasVendedor(
        vendedores             = vendedores,
        total_ingresos_periodo = round(total_ingresos_global, 2),
        total_ventas_periodo   = sum(r.total_ventas for r in rows),
    )


def get_ventas_de_vendedor(
    db:          Session,
    empresa_id:  int,
    vendedor_id: int,
    start_date:  Optional[date] = None,
    end_date:    Optional[date] = None,
    limit:       int = 100,
) -> list:
    q = (
        db.query(models.Venta)
        .options(joinedload(models.Venta.cliente), joinedload(models.Venta.detalles))
        .filter(
            models.Venta.empresa_id == empresa_id,
            models.Venta.operador_id == vendedor_id,
            models.Venta.tipo == "venta",
        )
    )
    if start_date:
        utc_start, _ = get_utc_boundaries(start_date)
        q = q.filter(models.Venta.fecha >= utc_start)
    if end_date:
        _, utc_end = get_utc_boundaries(end_date)
        q = q.filter(models.Venta.fecha <= utc_end)

    ventas = q.order_by(models.Venta.fecha.desc()).limit(limit).all()

    return [
        schemas.VentaVendedorItem(
            id          = v.id,
            fecha       = v.fecha,
            cliente     = v.cliente.nombre if v.cliente else None,
            num_items   = len(v.detalles),
            total       = v.total or 0.0,
            monto_pagado= v.monto_pagado or 0.0,
            estado_pago = v.estado_pago or "pendiente",
            metodo_pago = v.metodo_pago,
        )
        for v in ventas
    ]
