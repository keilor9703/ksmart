from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, date, timezone
from pydantic import BaseModel

import models
from api.deps import get_db, get_current_active_user
from models import utcnow

router = APIRouter()


# ─── Schemas (inline) ────────────────────────────────────────────────────────

class DetalleIn(BaseModel):
    producto_id: Optional[int] = None
    nombre_servicio: str
    cantidad: float = 1.0
    precio_unitario: float
    comision_pct: Optional[float] = None  # None = use global config

class OrdenCreate(BaseModel):
    placa: str
    tipo_vehiculo: Optional[str] = None
    operador_id: Optional[int] = None
    cliente_id: Optional[int] = None
    observaciones: Optional[str] = None
    detalles: List[DetalleIn]

class OrdenEstadoUpdate(BaseModel):
    estado: str  # recibido | lavando | terminado | entregado

class CobrarIn(BaseModel):
    metodo_pago: str = "Efectivo"
    monto_pagado: Optional[float] = None
    puntos_canjeados: Optional[int] = None
    descuento_puntos: Optional[float] = None
    solicita_fe: bool = False

class LavaderoConfigUpdate(BaseModel):
    comision_pct_global: Optional[float] = None
    tipo_impresora: Optional[str] = None
    imprimir_recibo: Optional[bool] = None
    nombre_lavadero: Optional[str] = None


# ─── Config ──────────────────────────────────────────────────────────────────

def _get_or_create_config(db: Session, empresa_id: int) -> models.LavaderoConfig:
    cfg = db.query(models.LavaderoConfig).filter_by(empresa_id=empresa_id).first()
    if not cfg:
        cfg = models.LavaderoConfig(empresa_id=empresa_id)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


@router.get("/config")
def get_config(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    cfg = _get_or_create_config(db, current_user.empresa_id)
    return {
        "id": cfg.id,
        "comision_pct_global": cfg.comision_pct_global,
        "tipo_impresora": cfg.tipo_impresora,
        "imprimir_recibo": cfg.imprimir_recibo,
        "nombre_lavadero": cfg.nombre_lavadero,
    }


@router.put("/config")
def update_config(
    body: LavaderoConfigUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    cfg = _get_or_create_config(db, current_user.empresa_id)
    if body.comision_pct_global is not None:
        cfg.comision_pct_global = body.comision_pct_global
    if body.tipo_impresora is not None:
        cfg.tipo_impresora = body.tipo_impresora
    if body.imprimir_recibo is not None:
        cfg.imprimir_recibo = body.imprimir_recibo
    if body.nombre_lavadero is not None:
        cfg.nombre_lavadero = body.nombre_lavadero
    cfg.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(cfg)
    return {
        "id": cfg.id,
        "comision_pct_global": cfg.comision_pct_global,
        "tipo_impresora": cfg.tipo_impresora,
        "imprimir_recibo": cfg.imprimir_recibo,
        "nombre_lavadero": cfg.nombre_lavadero,
    }


# ─── Update producto comision_pct ────────────────────────────────────────────

class ProductoComisionUpdate(BaseModel):
    comision_pct: Optional[float] = None

@router.patch("/productos/{producto_id}/comision")
def update_producto_comision(
    producto_id: int,
    body: ProductoComisionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    p = db.query(models.Producto).filter_by(id=producto_id, empresa_id=current_user.empresa_id).first()
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    p.comision_pct = body.comision_pct
    db.commit()
    return {"ok": True, "comision_pct": p.comision_pct}


# ─── Ordenes ─────────────────────────────────────────────────────────────────

def _orden_to_dict(o: models.LavaderoOrden) -> dict:
    return {
        "id": o.id,
        "placa": o.placa,
        "tipo_vehiculo": o.tipo_vehiculo,
        "estado": o.estado,
        "operador_id": o.operador_id,
        "operador_nombre": o.operador.nombre_completo if o.operador else None,
        "cliente_id": o.cliente_id,
        "cliente_nombre": o.cliente.nombre if o.cliente else None,
        "cliente_telefono": o.cliente.telefono if o.cliente else None,
        "observaciones": o.observaciones,
        "fecha_entrada": o.fecha_entrada.isoformat() if o.fecha_entrada else None,
        "fecha_salida": o.fecha_salida.isoformat() if o.fecha_salida else None,
        "total": o.total,
        "metodo_pago": o.metodo_pago,
        "pagado": o.pagado,
        "venta_id": o.venta_id,
        "detalles": [
            {
                "id": d.id,
                "producto_id": d.producto_id,
                "nombre_servicio": d.nombre_servicio,
                "cantidad": d.cantidad,
                "precio_unitario": d.precio_unitario,
                "comision_pct": d.comision_pct,
                "subtotal": d.cantidad * d.precio_unitario,
            }
            for d in (o.detalles or [])
        ],
    }


@router.post("/ordenes")
def crear_orden(
    body: OrdenCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    if not body.detalles:
        raise HTTPException(400, "Debe incluir al menos un servicio")

    cfg = _get_or_create_config(db, current_user.empresa_id)
    placa = body.placa.upper().replace("-", "").strip()

    orden = models.LavaderoOrden(
        empresa_id=current_user.empresa_id,
        placa=placa,
        tipo_vehiculo=body.tipo_vehiculo,
        estado="recibido",
        operador_id=body.operador_id,
        cliente_id=body.cliente_id,
        observaciones=body.observaciones,
        fecha_entrada=datetime.now(timezone.utc),
    )
    db.add(orden)
    db.flush()  # get orden.id

    total = 0.0
    for det in body.detalles:
        comision = det.comision_pct if det.comision_pct is not None else cfg.comision_pct_global
        d = models.LavaderoOrdenDetalle(
            empresa_id=current_user.empresa_id,
            orden_id=orden.id,
            producto_id=det.producto_id,
            nombre_servicio=det.nombre_servicio,
            cantidad=det.cantidad,
            precio_unitario=det.precio_unitario,
            comision_pct=comision,
        )
        db.add(d)
        total += det.cantidad * det.precio_unitario

    orden.total = total
    db.commit()
    db.refresh(orden)
    return _orden_to_dict(orden)


@router.get("/ordenes")
def listar_ordenes(
    estado: Optional[str] = Query(None),
    activas: bool = Query(True),
    fecha: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    q = db.query(models.LavaderoOrden).filter(
        models.LavaderoOrden.empresa_id == current_user.empresa_id
    )
    if estado:
        q = q.filter(models.LavaderoOrden.estado == estado)
    elif activas:
        q = q.filter(models.LavaderoOrden.estado.in_(["recibido", "lavando", "terminado"]))

    if fecha:
        from datetime import timedelta
        start = datetime.combine(fecha, datetime.min.time()).replace(tzinfo=timezone.utc)
        end = datetime.combine(fecha, datetime.max.time()).replace(tzinfo=timezone.utc)
        q = q.filter(models.LavaderoOrden.fecha_entrada.between(start, end))
    elif activas:
        # For active orders, show all active regardless of date (could be from yesterday)
        pass

    ordenes = q.order_by(models.LavaderoOrden.fecha_entrada.asc()).all()
    return [_orden_to_dict(o) for o in ordenes]


@router.patch("/ordenes/{orden_id}")
def actualizar_estado(
    orden_id: int,
    body: OrdenEstadoUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    VALID_STATES = {"recibido", "lavando", "terminado", "entregado"}
    if body.estado not in VALID_STATES:
        raise HTTPException(400, f"Estado inválido. Debe ser uno de: {VALID_STATES}")

    orden = db.query(models.LavaderoOrden).filter_by(
        id=orden_id, empresa_id=current_user.empresa_id
    ).first()
    if not orden:
        raise HTTPException(404, "Orden no encontrada")

    orden.estado = body.estado
    db.commit()
    db.refresh(orden)
    return _orden_to_dict(orden)


@router.post("/ordenes/{orden_id}/cobrar")
def cobrar_orden(
    orden_id: int,
    body: CobrarIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    orden = db.query(models.LavaderoOrden).filter_by(
        id=orden_id, empresa_id=current_user.empresa_id
    ).first()
    if not orden:
        raise HTTPException(404, "Orden no encontrada")
    if orden.pagado:
        raise HTTPException(400, "Esta orden ya fue cobrada")

    bruto = orden.total or sum(d.cantidad * d.precio_unitario for d in orden.detalles)
    descuento_pts = float(body.descuento_puntos or 0)
    total = max(0.0, bruto - descuento_pts)

    # Create Venta record (maintains compatibility with existing reports)
    from crud.consecutivos import next_consecutivo
    venta = models.Venta(
        numero_venta=next_consecutivo(db, current_user.empresa_id, "ultimo_numero_venta"),
        empresa_id=current_user.empresa_id,
        cliente_id=orden.cliente_id,
        total=total,
        monto_pagado=body.monto_pagado or total,
        estado_pago="pagado",
        fecha_pago=datetime.now(timezone.utc),
        metodo_pago=body.metodo_pago,
        placa_vehiculo=orden.placa,
        tipo_vehiculo=orden.tipo_vehiculo,
        operador_id=orden.operador_id,
        observaciones=orden.observaciones,
        descuento_puntos=descuento_pts,
        puntos_canjeados=body.puntos_canjeados or 0,
        origen='lavadero',
        solicita_fe=body.solicita_fe,
    )
    db.add(venta)
    db.flush()

    for det in orden.detalles:
        dv = models.DetalleVenta(
            empresa_id=current_user.empresa_id,
            venta_id=venta.id,
            producto_id=det.producto_id,
            nombre_libre=det.nombre_servicio if not det.producto_id else None,
            cantidad=det.cantidad,
            precio_unitario=det.precio_unitario,
        )
        db.add(dv)

    # Finalize orden
    orden.pagado = True
    orden.estado = "entregado"
    orden.metodo_pago = body.metodo_pago
    orden.total = total
    orden.fecha_salida = datetime.now(timezone.utc)
    orden.venta_id = venta.id

    # Puntos de fidelización
    if orden.cliente_id:
        try:
            empresa_obj = db.query(models.Empresa).filter_by(id=current_user.empresa_id).first()
            fidel_activa = getattr(empresa_obj, "fidelizacion_activa", True)
            if fidel_activa is None:
                fidel_activa = True
            if fidel_activa:
                from crud.puntos import ganar_puntos_venta, canjear_puntos
                earn_rate   = getattr(empresa_obj, "fidelizacion_earn_rate",   1000) or 1000
                redeem_rate = getattr(empresa_obj, "fidelizacion_redeem_rate", 100)  or 100
                if body.puntos_canjeados and body.puntos_canjeados > 0:
                    canjear_puntos(db, empresa_id=current_user.empresa_id,
                                   cliente_id=orden.cliente_id,
                                   puntos_a_canjear=body.puntos_canjeados,
                                   redeem_rate=redeem_rate, commit=False)
                ganar_puntos_venta(db, empresa_id=current_user.empresa_id,
                                   cliente_id=orden.cliente_id,
                                   total_venta=float(total), venta_id=venta.id,
                                   earn_rate=earn_rate, commit=False)
        except Exception:
            pass  # Points are non-critical; never block the sale

    db.commit()
    db.refresh(orden)

    # ── Facturación electrónica (helper canónico, compartido con POS/restaurante/parqueadero) ──
    try:
        from crud import ventas as _crud_ventas
        cliente_fe = db.query(models.Cliente).filter_by(
            id=orden.cliente_id, empresa_id=current_user.empresa_id
        ).first() if orden.cliente_id else None

        detalles_fe = db.query(models.DetalleVenta).filter_by(
            venta_id=venta.id, empresa_id=current_user.empresa_id
        ).options(joinedload(models.DetalleVenta.producto)).all()

        _crud_ventas.emitir_fe_venta(
            db, current_user.empresa_id, venta, detalles_fe, cliente=cliente_fe,
        )
        db.commit()
    except Exception as _fe_exc:
        import logging
        logging.getLogger("lavadero").error("Error FE en cobrar_orden %s: %s", orden_id, _fe_exc)

    db.refresh(orden)
    return {**_orden_to_dict(orden), "venta_id": venta.id}


# ─── Historial de ventas ──────────────────────────────────────────────────────

@router.get("/historial")
def historial_ventas(
    fecha_inicio: Optional[date] = Query(None),
    fecha_fin:    Optional[date] = Query(None),
    placa:        Optional[str]  = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Historial de órdenes cobradas con datos de FE y cliente."""
    q = (
        db.query(models.LavaderoOrden)
        .filter(
            models.LavaderoOrden.empresa_id == current_user.empresa_id,
            models.LavaderoOrden.pagado == True,
        )
        .options(
            joinedload(models.LavaderoOrden.detalles),
            joinedload(models.LavaderoOrden.cliente),
            joinedload(models.LavaderoOrden.operador),
        )
    )
    if placa:
        q = q.filter(models.LavaderoOrden.placa.ilike(f"%{placa.upper().replace('-','')}%"))
    if fecha_inicio:
        q = q.filter(
            models.LavaderoOrden.fecha_entrada >= datetime.combine(fecha_inicio, datetime.min.time()).replace(tzinfo=timezone.utc)
        )
    if fecha_fin:
        q = q.filter(
            models.LavaderoOrden.fecha_entrada <= datetime.combine(fecha_fin, datetime.max.time()).replace(tzinfo=timezone.utc)
        )

    ordenes = q.order_by(models.LavaderoOrden.fecha_salida.desc()).all()

    resultado = []
    for o in ordenes:
        # Traer datos de FE desde la Venta vinculada
        venta_fe = db.query(
            models.Venta.numero_factura,
            models.Venta.estado_electronico,
            models.Venta.cufe,
            models.Venta.pdf_url,
        ).filter_by(id=o.venta_id).first() if o.venta_id else None

        resultado.append({
            "id":           o.id,
            "placa":        o.placa,
            "tipo_vehiculo":o.tipo_vehiculo,
            "fecha_entrada":o.fecha_entrada.isoformat() if o.fecha_entrada else None,
            "fecha_salida": o.fecha_salida.isoformat()  if o.fecha_salida  else None,
            "total":        o.total,
            "metodo_pago":  o.metodo_pago,
            "cliente_nombre": o.cliente.nombre if o.cliente else None,
            "operador_nombre": (o.operador.nombre_completo or o.operador.username) if o.operador else None,
            "servicios":    [{"nombre": d.nombre_servicio or d.nombre_libre, "precio": d.precio_unitario, "cantidad": d.cantidad} for d in o.detalles],
            "venta_id":     o.venta_id,
            "numero_factura":  venta_fe.numero_factura  if venta_fe else None,
            "estado_fe":       venta_fe.estado_electronico if venta_fe else None,
            "cufe":            venta_fe.cufe             if venta_fe else None,
            "pdf_url":         venta_fe.pdf_url          if venta_fe else None,
        })
    return resultado


@router.post("/ventas/{venta_id}/reintentar-fe")
def reintentar_fe_lavadero(
    venta_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Reintenta la emisión FE de una venta de lavadero."""
    venta = db.query(models.Venta).filter(
        models.Venta.id == venta_id,
        models.Venta.empresa_id == current_user.empresa_id,
        models.Venta.origen == "lavadero",
    ).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta de lavadero no encontrada.")

    from sqlalchemy.orm import joinedload as _jl
    from crud import ventas as _crud_ventas

    # El retry reemite el documento del tipo que ya correspondía (FE o DEE-POS).

    detalles = db.query(models.DetalleVenta).filter_by(
        venta_id=venta.id, empresa_id=current_user.empresa_id
    ).options(_jl(models.DetalleVenta.producto)).all()

    cliente = db.query(models.Cliente).filter_by(
        id=venta.cliente_id, empresa_id=current_user.empresa_id
    ).first() if venta.cliente_id else None

    resultado = _crud_ventas.emitir_fe_venta(
        db, current_user.empresa_id, venta, detalles, cliente=cliente
    )
    db.commit()

    if not resultado:
        raise HTTPException(status_code=400, detail="FE no disponible (empresa sin resolución activa o FE inactiva).")

    return {
        "estado":         venta.estado_electronico,
        "numero_factura": venta.numero_factura,
        "cufe":           venta.cufe,
        "pdf_url":        venta.pdf_url,
        "mensaje":        venta.mensaje_proveedor,
    }


# ─── Reporte ─────────────────────────────────────────────────────────────────

@router.get("/reporte")
def reporte_lavadero(
    fecha_inicio: Optional[date] = Query(None),
    fecha_fin: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    empresa_id = current_user.empresa_id

    # Query from LavaderoOrden (paid orders)
    q = db.query(
        models.User.id.label("operador_id"),
        func.coalesce(models.User.nombre_completo, models.User.username).label("nombre"),
        func.count(models.LavaderoOrden.id).label("num_lavadas"),
        func.sum(models.LavaderoOrden.total).label("total_ventas"),
        func.min(models.LavaderoOrden.fecha_entrada).label("primera_lavada"),
        func.max(models.LavaderoOrden.fecha_entrada).label("ultima_lavada"),
    ).join(
        models.LavaderoOrden, models.LavaderoOrden.operador_id == models.User.id
    ).filter(
        models.LavaderoOrden.empresa_id == empresa_id,
        models.LavaderoOrden.pagado == True,
    )

    if fecha_inicio:
        q = q.filter(models.LavaderoOrden.fecha_entrada >= datetime.combine(fecha_inicio, datetime.min.time()))
    if fecha_fin:
        q = q.filter(models.LavaderoOrden.fecha_entrada <= datetime.combine(fecha_fin, datetime.max.time()))

    q = q.group_by(models.User.id, models.User.nombre_completo)
    q = q.order_by(func.sum(models.LavaderoOrden.total).desc())
    rows = q.all()

    # Also query commission data per worker
    comision_q = db.query(
        models.LavaderoOrden.operador_id,
        func.sum(
            models.LavaderoOrdenDetalle.cantidad *
            models.LavaderoOrdenDetalle.precio_unitario *
            models.LavaderoOrdenDetalle.comision_pct / 100.0
        ).label("comision_total")
    ).join(
        models.LavaderoOrdenDetalle, models.LavaderoOrdenDetalle.orden_id == models.LavaderoOrden.id
    ).filter(
        models.LavaderoOrden.empresa_id == empresa_id,
        models.LavaderoOrden.pagado == True,
    )

    if fecha_inicio:
        comision_q = comision_q.filter(models.LavaderoOrden.fecha_entrada >= datetime.combine(fecha_inicio, datetime.min.time()))
    if fecha_fin:
        comision_q = comision_q.filter(models.LavaderoOrden.fecha_entrada <= datetime.combine(fecha_fin, datetime.max.time()))

    comision_q = comision_q.group_by(models.LavaderoOrden.operador_id)
    comision_data = {r.operador_id: float(r.comision_total or 0) for r in comision_q.all()}

    total_global  = sum(float(r.total_ventas or 0) for r in rows)
    lavadas_total = sum(r.num_lavadas for r in rows)
    comision_global = sum(comision_data.values())

    cfg = _get_or_create_config(db, empresa_id)

    return {
        "trabajadores": [
            {
                "operador_id":    r.operador_id,
                "nombre":         r.nombre or f"Usuario #{r.operador_id}",
                "num_lavadas":    r.num_lavadas,
                "total_ventas":   float(r.total_ventas or 0),
                "comision_ganada": comision_data.get(r.operador_id, 0.0),
                "porcentaje":     round(
                    float(r.total_ventas or 0) / total_global * 100, 1
                ) if total_global > 0 else 0.0,
                "primera_lavada": r.primera_lavada.isoformat() if r.primera_lavada else None,
                "ultima_lavada":  r.ultima_lavada.isoformat() if r.ultima_lavada else None,
            }
            for r in rows
        ],
        "resumen": {
            "total_lavadas":    lavadas_total,
            "total_ventas":     total_global,
            "num_trabajadores": len(rows),
            "comision_global":  comision_global,
            "comision_pct_global": cfg.comision_pct_global,
        },
    }
