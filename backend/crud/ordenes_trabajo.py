from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func
from typing import Optional, List
from datetime import date, datetime, timezone, timedelta
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ, get_utc_boundaries
from crud.clientes import get_cliente
from crud.productos import get_producto
from crud.ventas import create_venta, get_venta
from crud.pagos import create_pago

# ═══════════════════════════════════════════════════════════════════════════════
# ÓRDENES DE TRABAJO
# ═══════════════════════════════════════════════════════════════════════════════

def get_orden_trabajo(db: Session, empresa_id: int, orden_id: int):
    return db.query(models.OrdenTrabajo).options(
        joinedload(models.OrdenTrabajo.cliente),
        joinedload(models.OrdenTrabajo.operador),
        joinedload(models.OrdenTrabajo.productos).joinedload(models.OrdenProducto.producto),
        joinedload(models.OrdenTrabajo.servicios).joinedload(models.OrdenServicio.servicio),
        joinedload(models.OrdenTrabajo.evidencias)
    ).filter(
        models.OrdenTrabajo.id == orden_id,
        models.OrdenTrabajo.empresa_id == empresa_id
    ).first()

def get_ordenes_trabajo(
    db: Session,
    empresa_id: int,
    skip: int = 0,
    limit: int = 100,
    operador_id: Optional[int] = None,
    estado: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    cliente_id: Optional[int] = None
):
    query = db.query(models.OrdenTrabajo).options(
        joinedload(models.OrdenTrabajo.cliente),
        joinedload(models.OrdenTrabajo.operador)
    ).filter(
        models.OrdenTrabajo.empresa_id == empresa_id
    ).order_by(models.OrdenTrabajo.fecha_creacion.desc())

    if operador_id:
        query = query.filter(models.OrdenTrabajo.operador_id == operador_id)
    if estado:
        query = query.filter(models.OrdenTrabajo.estado == estado)

    if start_date:
        utc_start, _ = get_utc_boundaries(start_date)
        query = query.filter(models.OrdenTrabajo.fecha_creacion >= utc_start)
    if end_date:
        _, utc_end = get_utc_boundaries(end_date)
        query = query.filter(models.OrdenTrabajo.fecha_creacion <= utc_end)

    if cliente_id:
        query = query.filter(models.OrdenTrabajo.cliente_id == cliente_id)

    return query.offset(skip).limit(limit).all()

def create_orden_trabajo(db: Session, empresa_id: int, orden: schemas.OrdenTrabajoCreate, operador_id: int):
    cliente = get_cliente(db, empresa_id, orden.cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado o no pertenece a esta empresa")

    db_orden = models.OrdenTrabajo(
        cliente_id=orden.cliente_id,
        operador_id=operador_id,
        total=orden.total,
        estado='Pendiente', # ✅ CORREGIDO: Nace como Pendiente para que el Operador la inicie
        empresa_id=empresa_id,
        fecha_creacion=datetime.now(timezone.utc),
        fecha_actualizacion=datetime.now(timezone.utc)
    )
    # ... (El resto de la función queda igual)
    for producto_data in orden.productos:
        prod = get_producto(db, empresa_id, producto_data.producto_id)
        if not prod:
            raise HTTPException(
                status_code=404,
                detail=f"Producto {producto_data.producto_id} no encontrado"
            )
        db_orden.productos.append(models.OrdenProducto(**producto_data.dict()))

    for servicio_data in orden.servicios:
        serv = get_producto(db, empresa_id, servicio_data.servicio_id)
        if not serv:
            raise HTTPException(
                status_code=404,
                detail=f"Servicio {servicio_data.servicio_id} no encontrado"
            )
        db_orden.servicios.append(models.OrdenServicio(**servicio_data.dict()))

    db.add(db_orden)
    db.commit()
    db.refresh(db_orden)
    return db_orden

def update_orden_trabajo(db: Session, empresa_id: int, orden_id: int, orden: schemas.OrdenTrabajoCreate):
    db_orden = (
        db.query(models.OrdenTrabajo)
          .options(
              selectinload(models.OrdenTrabajo.productos),
              selectinload(models.OrdenTrabajo.servicios),
          )
          .filter(
              models.OrdenTrabajo.id == orden_id,
              models.OrdenTrabajo.empresa_id == empresa_id
          )
          .first()
    )
    if not db_orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    db_orden.cliente_id = orden.cliente_id
    db_orden.total = orden.total
    if hasattr(orden, "operador_id") and orden.operador_id is not None:
        db_orden.operador_id = orden.operador_id

    db_orden.productos = []
    db_orden.servicios = []

    nuevos_productos = []
    for p in getattr(orden, "productos", []):
        nuevos_productos.append(
            models.OrdenProducto(
                producto_id=p.producto_id,
                cantidad=p.cantidad,
                precio_unitario=p.precio_unitario,
            )
        )

    nuevos_servicios = []
    for s in getattr(orden, "servicios", []):
        nuevos_servicios.append(
            models.OrdenServicio(
                servicio_id=s.servicio_id,
                cantidad=s.cantidad,
                precio_servicio=s.precio_servicio,
            )
        )

    db_orden.productos = nuevos_productos
    db_orden.servicios = nuevos_servicios
    db_orden.fecha_actualizacion = datetime.now(timezone.utc)

    db.commit()
    db.refresh(db_orden)
    return db_orden

def update_orden_trabajo_estado(db: Session, empresa_id: int, orden_id: int, estado: str, observaciones: Optional[str] = None):
    db_orden = get_orden_trabajo(db, empresa_id, orden_id)
    if db_orden:
        db_orden.estado = estado
        if observaciones:
            db_orden.observaciones_aprobador = observaciones
        db_orden.fecha_actualizacion = datetime.now(timezone.utc)
        db.commit()
        db.refresh(db_orden)
    return db_orden

def add_evidencia_orden_trabajo(db: Session, empresa_id: int, orden_id: int, file_path: str):
    db_orden = get_orden_trabajo(db, empresa_id, orden_id)
    if not db_orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    db_evidencia = models.Evidencia(orden_id=orden_id, file_path=file_path)
    db.add(db_evidencia)
    db.commit()
    db.refresh(db_evidencia)
    return db_evidencia

def aprobar_orden_trabajo(db: Session, empresa_id: int, orden_id: int, admin_user: models.User):
    db_orden = get_orden_trabajo(db, empresa_id, orden_id)
    if not db_orden or db_orden.estado != 'En revisión':
        return None

    db_orden.estado = 'Aprobada'
    db_orden.observaciones_aprobador = f"Aprobado por {admin_user.username}"
    db_orden.fecha_actualizacion = datetime.now(timezone.utc)

    detalles_venta = []
    for item in db_orden.productos:
        detalles_venta.append(schemas.DetalleVentaCreate(
            producto_id=item.producto_id,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario
        ))
    for item in db_orden.servicios:
        detalles_venta.append(schemas.DetalleVentaCreate(
            producto_id=item.servicio_id,
            cantidad=item.cantidad if item.cantidad is not None else 0.0,
            precio_unitario=item.precio_servicio
        ))

    venta_schema = schemas.VentaCreate(
        cliente_id=db_orden.cliente_id,
        detalles=detalles_venta,
        pagada=False
    )
    created_venta = create_venta(db, empresa_id, venta_schema)

    db_orden.venta_id = created_venta.id

    for servicio in db_orden.servicios:
        valor_productividad_calculado = servicio.precio_servicio * servicio.cantidad
        modalidad_pago_defined = "por_servicio"

        prod_log = schemas.RegistroProductividadCreate(
            operador_id=db_orden.operador_id,
            orden_id=orden_id,
            servicio_id=servicio.servicio_id,
            valor_productividad=valor_productividad_calculado,
            modalidad_pago=modalidad_pago_defined
        )
        db.add(models.RegistroProductividad(**prod_log.dict()))

    db.commit()
    db.refresh(db_orden)
    return db_orden

def rechazar_orden_trabajo(db: Session, empresa_id: int, orden_id: int, observaciones: str, admin_user: models.User):
    db_orden = get_orden_trabajo(db, empresa_id, orden_id)
    if not db_orden or db_orden.estado != 'En revisión':
        return None

    db_orden.estado = 'Rechazada'
    db_orden.observaciones_aprobador = f"Rechazado por {admin_user.username}: {observaciones}"
    db_orden.fecha_actualizacion = datetime.now(timezone.utc)

    db.commit()
    db.refresh(db_orden)
    return db_orden

def cerrar_orden_trabajo(db: Session, empresa_id: int, orden_id: int, admin_user: models.User, close_data: schemas.OrdenTrabajoClose):
    db_orden = get_orden_trabajo(db, empresa_id, orden_id)
    if not db_orden or db_orden.estado not in ['Aprobada', 'Rechazada']:
        return None

    if not db_orden.venta_id:
        return None

    db_venta = get_venta(db, empresa_id, db_orden.venta_id)
    if not db_venta:
        return None

    if close_data.was_paid:
        if close_data.payment_type == "total":
            monto_a_pagar = db_venta.total - db_venta.monto_pagado
            if monto_a_pagar > 0:
                pago_schema = schemas.PagoCreate(
                    venta_id=db_venta.id,
                    monto=monto_a_pagar,
                    metodo_pago="Cierre de Orden (Pago Total)"
                )
                create_pago(db, empresa_id, pago_schema)
            db_venta.estado_pago = "pagado"
            db_venta.monto_pagado = db_venta.total
        elif close_data.payment_type == "partial":
            if close_data.paid_amount is None or close_data.paid_amount <= 0:
                return None

            monto_pendiente = db_venta.total - db_venta.monto_pagado
            if close_data.paid_amount > monto_pendiente:
                return None

            pago_schema = schemas.PagoCreate(
                venta_id=db_venta.id,
                monto=close_data.paid_amount,
                metodo_pago="Cierre de Orden (Pago Parcial)"
            )
            create_pago(db, empresa_id, pago_schema)

        db_venta.fecha_pago = datetime.now(timezone.utc)
    else:
        db_venta.estado_pago = "pendiente"

    db_orden.estado = 'Cerrada'
    db_orden.observaciones_aprobador = f"Cerrada por {admin_user.username}"
    db_orden.fecha_actualizacion = datetime.now(timezone.utc)

    db.commit()
    db.refresh(db_orden)
    db.refresh(db_venta)
    return db_orden

def get_total_ordenes_trabajo(
    db: Session,
    empresa_id: int,
    operador_id: Optional[int] = None,
    estado: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    cliente_id: Optional[int] = None
) -> float:
    query = db.query(func.sum(models.OrdenTrabajo.total)).filter(
        models.OrdenTrabajo.empresa_id == empresa_id
    )

    if operador_id:
        query = query.filter(models.OrdenTrabajo.operador_id == operador_id)
    if estado:
        query = query.filter(models.OrdenTrabajo.estado == estado)

    if start_date:
        utc_start, _ = get_utc_boundaries(start_date)
        query = query.filter(models.OrdenTrabajo.fecha_creacion >= utc_start)
    if end_date:
        _, utc_end = get_utc_boundaries(end_date)
        query = query.filter(models.OrdenTrabajo.fecha_creacion <= utc_end)

    if cliente_id:
        query = query.filter(models.OrdenTrabajo.cliente_id == cliente_id)

    total = query.scalar()
    return total if total is not None else 0.0

# ═══════════════════════════════════════════════════════════════════════════════
# PANEL DEL OPERADOR
# ═══════════════════════════════════════════════════════════════════════════════

def get_ordenes_pendientes_operador(db: Session, empresa_id: int, operador_id: int) -> List[schemas.PanelOrdenPendiente]:
    ordenes_pendientes = db.query(models.OrdenTrabajo).options(
        joinedload(models.OrdenTrabajo.cliente),
        joinedload(models.OrdenTrabajo.productos).joinedload(models.OrdenProducto.producto),
        joinedload(models.OrdenTrabajo.servicios).joinedload(models.OrdenServicio.servicio)
    ).filter(
        models.OrdenTrabajo.operador_id == operador_id,
        models.OrdenTrabajo.empresa_id == empresa_id,
        models.OrdenTrabajo.estado != 'Cerrada'
    ).order_by(models.OrdenTrabajo.fecha_actualizacion.asc()).all()

    response = []
    for orden in ordenes_pendientes:
        response.append(schemas.PanelOrdenPendiente(
            id=orden.id,
            cliente_id=orden.cliente.id,
            cliente_nombre=orden.cliente.nombre,
            cliente_telefono=orden.cliente.telefono,
            cliente_direccion=orden.cliente.direccion,
            estado=orden.estado,
            fecha_creacion=orden.fecha_creacion,
            fecha_actualizacion=orden.fecha_actualizacion,
            total=orden.total,
            productos=orden.productos,
            servicios=orden.servicios
        ))
    return response

def get_productividad_operador(
    db: Session,
    empresa_id: int,
    operador_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> schemas.PanelProductividad:

    hoy_colombia = datetime.now(BOGOTA_TZ).date()
    week_start_date = hoy_colombia - timedelta(days=hoy_colombia.weekday())
    month_start_date = hoy_colombia.replace(day=1)

    today_utc_start, today_utc_end = get_utc_boundaries(hoy_colombia)
    week_utc_start, week_utc_end = get_utc_boundaries(week_start_date)
    month_utc_start, month_utc_end = get_utc_boundaries(month_start_date)

    def get_total_units_for_range(utc_start, utc_end):
        return (db.query(func.sum(models.OrdenServicio.cantidad))
                .select_from(models.OrdenServicio)
                .join(models.RegistroProductividad,
                      (models.OrdenServicio.orden_id == models.RegistroProductividad.orden_id) &
                      (models.OrdenServicio.servicio_id == models.RegistroProductividad.servicio_id))
                .filter(
                    models.RegistroProductividad.operador_id == operador_id,
                    models.RegistroProductividad.empresa_id == empresa_id,
                    models.RegistroProductividad.fecha >= utc_start,
                    models.RegistroProductividad.fecha <= utc_end
                ).scalar() or 0)

    servicios_hoy = get_total_units_for_range(today_utc_start, today_utc_end)
    servicios_semana = get_total_units_for_range(week_utc_start, today_utc_end)
    servicios_mes = get_total_units_for_range(month_utc_start, today_utc_end)

    ordenes_completadas_semana = db.query(func.count(models.OrdenTrabajo.id)).filter(
        models.OrdenTrabajo.operador_id == operador_id,
        models.OrdenTrabajo.empresa_id == empresa_id,
        models.OrdenTrabajo.estado == 'Cerrada',
        models.OrdenTrabajo.fecha_actualizacion >= week_utc_start,
        models.OrdenTrabajo.fecha_actualizacion <= today_utc_end
    ).scalar() or 0

    if start_date and end_date:
        filtered_start_utc, _ = get_utc_boundaries(start_date)
        _, filtered_end_utc = get_utc_boundaries(end_date)
    else:
        filtered_start_utc = week_utc_start
        filtered_end_utc = today_utc_end

    servicios_agg_query = (
        db.query(
            models.Producto.nombre,
            func.sum(models.OrdenServicio.cantidad).label('cantidad')
        )
        .select_from(models.OrdenServicio)
        .join(
            models.Producto, models.OrdenServicio.servicio_id == models.Producto.id
        )
        .join(
            models.RegistroProductividad,
            (models.RegistroProductividad.orden_id == models.OrdenServicio.orden_id) &
            (models.RegistroProductividad.servicio_id == models.OrdenServicio.servicio_id)
        )
        .filter(
            models.RegistroProductividad.operador_id == operador_id,
            models.RegistroProductividad.empresa_id == empresa_id,
            models.RegistroProductividad.fecha >= filtered_start_utc,
            models.RegistroProductividad.fecha <= filtered_end_utc
        )
        .group_by(models.Producto.nombre)
    )
    servicios_agg = servicios_agg_query.all()

    grafica_servicios_semana = [
        schemas.PanelProductividadDataPoint(name=nombre, value=cantidad)
        for nombre, cantidad in servicios_agg
    ]

    unidades_por_servicio_query = (
        db.query(
            models.Producto.id.label("servicio_id"),
            models.Producto.nombre.label("servicio_nombre"),
            func.coalesce(func.sum(models.OrdenServicio.cantidad), 0).label("total_unidades"),
            func.coalesce(func.sum(models.RegistroProductividad.valor_productividad), 0).label("total_valor"),
        )
        .join(
            models.OrdenServicio,
            (models.OrdenServicio.orden_id == models.RegistroProductividad.orden_id)
            & (models.OrdenServicio.servicio_id == models.RegistroProductividad.servicio_id),
        )
        .join(models.Producto, models.Producto.id == models.RegistroProductividad.servicio_id)
        .filter(
            models.RegistroProductividad.operador_id == operador_id,
            models.RegistroProductividad.empresa_id == empresa_id,
            models.RegistroProductividad.fecha >= filtered_start_utc,
            models.RegistroProductividad.fecha <= filtered_end_utc
        )
        .group_by(
            models.Producto.id,
            models.Producto.nombre,
        )
        .order_by(models.Producto.nombre)
    )
    unidades_por_servicio_rows = unidades_por_servicio_query.all()

    unidades_por_servicio_filtrado = [
        schemas.ProductividadUnidadesPorServicio(
            servicio_id=row.servicio_id,
            servicio_nombre=row.servicio_nombre,
            total_unidades=float(row.total_unidades),
            total_valor=float(row.total_valor),
        ) for row in unidades_por_servicio_rows
    ]

    return schemas.PanelProductividad(
        servicios_hoy=servicios_hoy,
        servicios_semana=servicios_semana,
        servicios_mes=servicios_mes,
        ordenes_completadas_semana=ordenes_completadas_semana,
        grafica_servicios_semana=grafica_servicios_semana,
        unidades_por_servicio_filtrado=unidades_por_servicio_filtrado
    )

def get_historial_reciente_operador(db: Session, empresa_id: int, operador_id: int) -> List[schemas.PanelHistorialItem]:
    hoy_colombia = datetime.now(BOGOTA_TZ).date()
    hace_7_dias = hoy_colombia - timedelta(days=7)
    utc_inicio, _ = get_utc_boundaries(hace_7_dias)

    ordenes_recientes = db.query(models.OrdenTrabajo).options(
        joinedload(models.OrdenTrabajo.cliente),
        joinedload(models.OrdenTrabajo.venta_asociada)
    ).filter(
        models.OrdenTrabajo.operador_id == operador_id,
        models.OrdenTrabajo.empresa_id == empresa_id,
        models.OrdenTrabajo.estado == 'Cerrada',
        models.OrdenTrabajo.fecha_actualizacion >= utc_inicio
    ).order_by(models.OrdenTrabajo.fecha_actualizacion.desc()).limit(10).all()

    response = []
    for orden in ordenes_recientes:
        estado_pago = "N/A"
        if orden.venta_asociada:
            estado_pago = orden.venta_asociada.estado_pago

        response.append(schemas.PanelHistorialItem(
            id=orden.id,
            cliente_nombre=orden.cliente.nombre,
            fecha_actualizacion=orden.fecha_actualizacion,
            total=orden.total,
            estado_pago_venta=estado_pago
        ))
    return response

def get_reporte_productividad(db: Session, empresa_id: int, start_date: date, end_date: date):
    utc_start, _ = get_utc_boundaries(start_date)
    _, utc_end = get_utc_boundaries(end_date)

    registros = (
        db.query(models.RegistroProductividad)
        .options(
            joinedload(models.RegistroProductividad.operador),
            joinedload(models.RegistroProductividad.servicio),
        )
        .filter(
            models.RegistroProductividad.empresa_id == empresa_id,
            models.RegistroProductividad.fecha >= utc_start,
            models.RegistroProductividad.fecha <= utc_end,
        )
        .all()
    )

    productividad_por_operador: dict[int, schemas.ProductividadOperador] = {}

    for reg in registros:
        op_id = reg.operador_id
        if op_id not in productividad_por_operador:
            productividad_por_operador[op_id] = schemas.ProductividadOperador(
                operador_id=op_id,
                operador_username=reg.operador.username if reg.operador else str(op_id),
                total_ganado=0.0,
                desglose=[],
                desglose_unidades=[],
            )

        item = productividad_por_operador[op_id]
        valor = float(reg.valor_productividad or 0.0)
        item.total_ganado += valor
        item.desglose.append(
            schemas.ProductividadOperadorDetalle(
                orden_id=reg.orden_id,
                servicio_nombre=reg.servicio.nombre if reg.servicio else "",
                valor_ganado=valor,
            )
        )

    unidades_rows = (
        db.query(
            models.RegistroProductividad.operador_id.label("operador_id"),
            models.RegistroProductividad.servicio_id.label("servicio_id"),
            models.Producto.nombre.label("servicio_nombre"),
            func.coalesce(func.sum(models.OrdenServicio.cantidad), 0).label("total_unidades"),
            func.coalesce(func.sum(models.RegistroProductividad.valor_productividad), 0).label("total_valor"),
        )
        .join(
            models.OrdenServicio,
            (models.OrdenServicio.orden_id == models.RegistroProductividad.orden_id)
            & (models.OrdenServicio.servicio_id == models.RegistroProductividad.servicio_id),
        )
        .join(models.Producto, models.Producto.id == models.RegistroProductividad.servicio_id)
        .filter(
            models.RegistroProductividad.empresa_id == empresa_id,
            models.RegistroProductividad.fecha >= utc_start,
            models.RegistroProductividad.fecha <= utc_end,
        )
        .group_by(
            models.RegistroProductividad.operador_id,
            models.RegistroProductividad.servicio_id,
            models.Producto.nombre,
        )
        .all()
    )

    for r in unidades_rows:
        op_id = int(r.operador_id)

        if op_id not in productividad_por_operador:
            user = db.query(models.User).get(op_id)
            productividad_por_operador[op_id] = schemas.ProductividadOperador(
                operador_id=op_id,
                operador_username=user.username if user else str(op_id),
                total_ganado=0.0,
                desglose=[],
                desglose_unidades=[],
            )

        productividad_por_operador[op_id].desglose_unidades.append(
            schemas.ProductividadUnidadesPorServicio(
                servicio_id=int(r.servicio_id),
                servicio_nombre=str(r.servicio_nombre),
                total_unidades=float(r.total_unidades or 0.0),
                total_valor=float(r.total_valor or 0.0),
            )
        )

    return schemas.ReporteProductividad(
        start_date=start_date,
        end_date=end_date,
        reporte=list(productividad_por_operador.values()),
    )
