from typing import List, Optional
from datetime import date, datetime, timedelta
import io
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

import crud
import models
import schemas
from api.deps import get_db, get_current_active_user, get_current_admin_user

router = APIRouter()

@router.get("/ventas_summary", response_model=schemas.VentasSummary)
def get_ventas_summary(start_date: Optional[date] = None, end_date: Optional[date] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.get_ventas_summary(db, empresa_id=current_user.empresa_id, start_date=start_date, end_date=end_date)

@router.get("/productos_vendidos", response_model=schemas.ReporteProductosVendidos)
def get_productos_vendidos(start_date: Optional[date] = None, end_date: Optional[date] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.get_productos_vendidos(db, empresa_id=current_user.empresa_id, start_date=start_date, end_date=end_date)

@router.get("/clientes_compradores", response_model=List[schemas.ClienteComprador])
def get_clientes_compradores(start_date: Optional[date] = None, end_date: Optional[date] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.get_clientes_compradores(db, empresa_id=current_user.empresa_id, start_date=start_date, end_date=end_date)

@router.get("/clientes_deudores", response_model=List[schemas.ClienteDeudor])
def get_clientes_deudores(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.get_clientes_deudores(db, empresa_id=current_user.empresa_id)

@router.get("/rentabilidad_productos", response_model=List[schemas.ProductoRentabilidad])
def get_rentabilidad_productos(start_date: Optional[date] = None, end_date: Optional[date] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.get_rentabilidad_por_producto(db, empresa_id=current_user.empresa_id, start_date=start_date, end_date=end_date)

@router.get("/cuentas_por_cobrar", response_model=List[schemas.ClienteCuentasPorCobrar])
def get_cuentas_por_cobrar(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.get_cuentas_por_cobrar_por_cliente(db, empresa_id=current_user.empresa_id)

@router.get("/dashboard", response_model=schemas.DashboardData)
def get_dashboard_report(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.get_dashboard_data(db, empresa_id=current_user.empresa_id)

@router.get("/iva-neto")
def get_iva_neto(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    empresa_id = current_user.empresa_id
    query_v_iva   = db.query(func.sum(models.Venta.iva_total)).filter(models.Venta.empresa_id == empresa_id)
    query_v_total = db.query(func.sum(models.Venta.total)).filter(models.Venta.empresa_id == empresa_id)
    query_c_iva   = db.query(func.sum(models.Compra.iva_total)).filter(models.Compra.empresa_id == empresa_id)
    query_c_total = db.query(func.sum(models.Compra.total)).filter(models.Compra.empresa_id == empresa_id)

    if start_date:
        query_v_iva   = query_v_iva.filter(models.Venta.fecha >= start_date)
        query_v_total = query_v_total.filter(models.Venta.fecha >= start_date)
        query_c_iva   = query_c_iva.filter(models.Compra.fecha >= start_date)
        query_c_total = query_c_total.filter(models.Compra.fecha >= start_date)
    if end_date:
        td = timedelta(days=1)
        query_v_iva   = query_v_iva.filter(models.Venta.fecha < end_date + td)
        query_v_total = query_v_total.filter(models.Venta.fecha < end_date + td)
        query_c_iva   = query_c_iva.filter(models.Compra.fecha < end_date + td)
        query_c_total = query_c_total.filter(models.Compra.fecha < end_date + td)

    iva_v = query_v_iva.scalar() or 0.0
    tot_v = query_v_total.scalar() or 0.0
    iva_c = query_c_iva.scalar() or 0.0
    tot_c = query_c_total.scalar() or 0.0

    return {
        "periodo": {"desde": start_date, "hasta": end_date},
        "iva_generado_ventas": iva_v, "iva_descontable_compras": iva_c,
        "iva_neto_resultado": iva_v - iva_c, "ventas_brutas": tot_v,
        "base_gravable_ventas": tot_v - iva_v, "compras_brutas": tot_c,
        "base_gravable_compras": tot_c - iva_c
    }

@router.get("/productividad", response_model=schemas.ReporteProductividad, dependencies=[Depends(get_current_admin_user)])
def get_productivity_report(start_date: date, end_date: date, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    return crud.get_reporte_productividad(db, empresa_id=current_user.empresa_id, start_date=start_date, end_date=end_date)

@router.get("/produccion-summary")
def get_produccion_summary(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    empresa_id = current_user.empresa_id
    query = db.query(models.LoteProduccion).filter(
        models.LoteProduccion.estado == "Confirmado",
        models.LoteProduccion.empresa_id == empresa_id
    )
    if start_date:
        query = query.filter(models.LoteProduccion.fecha_confirmacion >= start_date)
    if end_date:
        query = query.filter(models.LoteProduccion.fecha_confirmacion < end_date + timedelta(days=1))
    lotes = query.all()
    return {
        "total_costo_produccion": sum(l.costo_total for l in lotes),
        "total_unidades_producidas": sum(l.cantidad_real for l in lotes if l.cantidad_real),
        "total_lotes_finalizados": len(lotes),
        "total_maquilas": len([l for l in lotes if l.cliente_id])
    }

@router.get("/consumo-insumos")
def get_consumo_insumos(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    empresa_id = current_user.empresa_id
    query = (
        db.query(
            models.Producto.nombre,
            func.sum(models.InventoryMovement.cantidad).label("cantidad_total"),
            func.sum(models.InventoryMovement.cantidad * models.InventoryMovement.costo_unitario).label("costo_total")
        )
        .join(models.InventoryMovement, models.Producto.id == models.InventoryMovement.producto_id)
        .filter(
            models.InventoryMovement.tipo == "salida",
            models.InventoryMovement.motivo.like("%Producción%"),
            models.InventoryMovement.empresa_id == empresa_id
        )
    )
    if start_date:
        query = query.filter(models.InventoryMovement.created_at >= start_date)
    if end_date:
        query = query.filter(models.InventoryMovement.created_at < end_date + timedelta(days=1))
    results = query.group_by(models.Producto.nombre).order_by(func.sum(models.InventoryMovement.cantidad).desc()).all()
    return [{"insumo": r.nombre, "cantidad": r.cantidad_total, "costo": r.costo_total} for r in results]

@router.get("/financiero-prestamos")
def reporte_financiero_prestamos(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    return crud.get_reporte_financiero_prestamos(db, current_user.empresa_id)

@router.get("/calendario-cobros")
def calendario_cobros(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.get_resumen_calendario_cobros(db, current_user.empresa_id)

@router.get("/proximos-a-vencer", response_model=List[schemas.AlertaVencimientoOut])
def proximos_a_vencer(
    dias: int = Query(30, ge=1, le=365, description="Horizon de días hacia adelante"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_alertas_vencimiento(
        db, empresa_id=current_user.empresa_id, dias=dias,
    )

@router.get("/resumen-alertas-vencimiento")
def resumen_alertas_vencimiento(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_resumen_alertas_vencimiento(db, current_user.empresa_id)

@router.get("/inventario-actual", response_model=schemas.InventarioSnapshot)
def inventario_actual(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_inventario_actual(db, empresa_id=current_user.empresa_id)


@router.get("/rotacion", response_model=schemas.ReporteRotacion)
def get_rotacion_productos(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 10,
    incluir_servicios: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_rotacion_productos(
        db,
        empresa_id=current_user.empresa_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        incluir_servicios=incluir_servicios
    )


@router.get("/rotacion/export")
def rotacion_export_excel(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 10,
    incluir_servicios: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    rot = crud.get_rotacion_productos(
        db,
        empresa_id=current_user.empresa_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        incluir_servicios=incluir_servicios
    )
    
    # Preparar datos para Top Vendidos
    data_top = []
    for it in rot.top:
        data_top.append({
            "Producto": it.nombre,
            "Es Servicio": "Sí" if it.es_servicio else "No",
            "Cantidad Vendida": it.total_cantidad_vendida,
            "Total Ingresos": it.total_ingresos
        })
    
    # Preparar datos para Menor Rotación
    data_slow = []
    for it in rot.slow:
        data_slow.append({
            "Producto": it.nombre,
            "Es Servicio": "Sí" if it.es_servicio else "No",
            "Cantidad Vendida": it.total_cantidad_vendida,
            "Total Ingresos": it.total_ingresos
        })

    df_top = pd.DataFrame(data_top)
    df_slow = pd.DataFrame(data_slow)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df_top.to_excel(writer, index=False, sheet_name="Más Vendidos")
        df_slow.to_excel(writer, index=False, sheet_name="Menor Rotación")
    
    output.seek(0)
    
    filename = f"rotacion_inventario_{start_date or 'inicio'}_a_{end_date or 'hoy'}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get("/inventario-actual/export")
def inventario_actual_export(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    snap = crud.get_inventario_actual(db, empresa_id=current_user.empresa_id)
    
    items = snap.items
    if search:
        search_lower = search.lower()
        items = [it for it in items if search_lower in it.nombre.lower()]

    data = []
    total_costo = 0.0
    total_venta = 0.0
    for it in items:
        data.append({
            "ID": it.id,
            "Nombre": it.nombre,
            "Es Servicio": "Sí" if it.es_servicio else "No",
            "Unidad": it.unidad_medida or "",
            "Stock Actual": it.stock_actual,
            "Costo Unit.": it.costo,
            "Precio Venta": it.precio,
            "Valor Total Costo": it.valor_costo,
            "Valor Total Venta": it.valor_venta
        })
        total_costo += it.valor_costo
        total_venta += it.valor_venta
    
    # Añadir fila de totales
    data.append({
        "ID": "", "Nombre": "TOTALES (Filtrado)" if search else "TOTALES", 
        "Es Servicio": "", "Unidad": "", 
        "Stock Actual": "", "Costo Unit.": "", "Precio Venta": "",
        "Valor Total Costo": total_costo,
        "Valor Total Venta": total_venta
    })

    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Inventario Actual")
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="inventario_actual.xlsx"',
        },
    )


@router.get("/caja-rango")
def reporte_caja_rango(
    start_date: date = Query(...),
    end_date:   date = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    empresa_id = current_user.empresa_id

    resumen_dias: dict[str, dict] = {}
    metodos_totales: dict[str, float] = {}
    total_ingresos = 0.0
    total_egresos  = 0.0

    def _fecha_col(dt) -> str:
        if dt is None:
            return None
        if isinstance(dt, datetime):
            try:
                return dt.astimezone(crud.BOGOTA_TZ).strftime("%Y-%m-%d")
            except Exception:
                return str(dt)[:10]
        return str(dt)[:10]

    def _acumular(fecha_str: str, metodo: str, monto: float, tipo: str):
        nonlocal total_ingresos, total_egresos
        if not fecha_str:
            return
        if fecha_str not in resumen_dias:
            resumen_dias[fecha_str] = {
                "fecha": fecha_str,
                "ingresos": 0.0,
                "egresos":  0.0,
                "neto":     0.0,
                "por_metodo": {},
            }
        dia = resumen_dias[fecha_str]

        if tipo == "ingreso":
            dia["ingresos"] += monto
            dia["neto"]     += monto
            total_ingresos  += monto
            metodos_totales[metodo] = metodos_totales.get(metodo, 0.0) + monto
            dia["por_metodo"][metodo] = dia["por_metodo"].get(metodo, 0.0) + monto
        else:
            dia["egresos"] += monto
            dia["neto"]    -= monto
            total_egresos  += monto

    # --- 1. Ventas Contado ---
    ventas = db.query(models.Venta).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.fecha >= start_date,
        models.Venta.fecha < end_date + timedelta(days=1),
        models.Venta.estado_pago == "pagado",
        models.Venta.monto_pagado >= models.Venta.total
    ).all()
    for v in ventas:
        _acumular(_fecha_col(v.fecha), v.metodo_pago, v.total, "ingreso")

    # --- 2. Abonos Cartera ---
    abonos = db.query(models.Pago).filter(
        models.Pago.empresa_id == empresa_id,
        models.Pago.fecha >= start_date,
        models.Pago.fecha < end_date + timedelta(days=1)
    ).all()
    for a in abonos:
        _acumular(_fecha_col(a.fecha), a.metodo_pago, a.monto, "ingreso")

    # --- 3. Cuotas Préstamo ---
    cuotas = db.query(models.CuotaPrestamo).join(models.Prestamo).filter(
        models.Prestamo.empresa_id == empresa_id,
        models.CuotaPrestamo.fecha_pago >= start_date,
        models.CuotaPrestamo.fecha_pago < end_date + timedelta(days=1),
        models.CuotaPrestamo.estado_pago == "Pagado"
    ).all()
    for c in cuotas:
        _acumular(_fecha_col(c.fecha_pago), c.metodo_pago or "Efectivo", c.monto_cuota, "ingreso")

    # --- 4. Gastos (Egresos) ---
    gastos = db.query(models.Gasto).filter(
        models.Gasto.empresa_id == empresa_id,
        models.Gasto.fecha >= start_date,
        models.Gasto.fecha < end_date + timedelta(days=1)
    ).all()
    for g in gastos:
        _acumular(_fecha_col(g.fecha), g.metodo_pago, g.monto, "egreso")

    return {
        "periodo": {"desde": start_date, "hasta": end_date},
        "resumen_diario": sorted(resumen_dias.values(), key=lambda x: x["fecha"]),
        "totales_por_metodo": metodos_totales,
        "total_ingresos": total_ingresos,
        "total_egresos":  total_egresos,
        "neto_total":     total_ingresos - total_egresos
    }


# ─── Ventas por Vendedor ──────────────────────────────────────────────────────

@router.get("/ventas-vendedor", response_model=schemas.ReporteVentasVendedor)
def get_ventas_por_vendedor(
    start_date: Optional[date] = None,
    end_date:   Optional[date] = None,
    db:           Session       = Depends(get_db),
    current_user: models.User   = Depends(get_current_active_user),
):
    return crud.get_ventas_por_vendedor(
        db, current_user.empresa_id, start_date, end_date
    )


@router.get("/ventas-vendedor/{vendedor_id}", response_model=List[schemas.VentaVendedorItem])
def get_ventas_de_vendedor(
    vendedor_id: int,
    start_date:  Optional[date] = None,
    end_date:    Optional[date] = None,
    limit:       int            = 100,
    db:           Session       = Depends(get_db),
    current_user: models.User   = Depends(get_current_active_user),
):
    return crud.get_ventas_de_vendedor(
        db, current_user.empresa_id, vendedor_id, start_date, end_date, limit
    )
