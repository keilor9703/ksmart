from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, date, timezone, timedelta
from pydantic import BaseModel

import models
from api.deps import get_db, get_current_active_user
from models import utcnow

router = APIRouter()

# Colombia es UTC-5 fijo todo el año (sin horario de verano). El frontend
# manda "hoy" como la fecha calendario LOCAL del navegador, pero
# fecha_entrada se guarda en UTC real — comparar esa fecha local contra
# límites UTC sin ajustar el desfase hace que, por ejemplo, un lavado de
# ayer 7:10pm (medianoche UTC) se cuente como "hoy". Este helper corrige
# eso convirtiendo el rango de fechas LOCAL al rango UTC equivalente.
COLOMBIA_UTC_OFFSET = timedelta(hours=5)

def _rango_utc_colombia(fecha_inicio: Optional[date], fecha_fin: Optional[date]):
    inicio_utc = fin_utc = None
    if fecha_inicio:
        inicio_utc = datetime.combine(fecha_inicio, datetime.min.time()) + COLOMBIA_UTC_OFFSET
        inicio_utc = inicio_utc.replace(tzinfo=timezone.utc)
    if fecha_fin:
        # Límite superior exclusivo: el día siguiente a las 00:00 local,
        # convertido a UTC — evita el redondeo de datetime.max.time().
        fin_utc = datetime.combine(fecha_fin + timedelta(days=1), datetime.min.time()) + COLOMBIA_UTC_OFFSET
        fin_utc = fin_utc.replace(tzinfo=timezone.utc)
    return inicio_utc, fin_utc


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
    sede_id: Optional[int] = None
    observaciones: Optional[str] = None
    detalles: List[DetalleIn]

class OrdenEstadoUpdate(BaseModel):
    estado: str  # recibido | lavando | terminado | entregado
    operador_id: Optional[int] = None  # cambio de lavador al iniciar el lavado

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

class SedeIn(BaseModel):
    nombre: str
    activa: Optional[bool] = True

class SedeUpdate(BaseModel):
    nombre: Optional[str] = None
    activa: Optional[bool] = None

class TrabajadoresSedeIn(BaseModel):
    user_ids: List[int]

class ServiciosSedeIn(BaseModel):
    producto_ids: List[int]


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


# ─── Sedes (multi-sede, solo para Lavadero) ──────────────────────────────────

def _sede_to_dict(s: models.LavaderoSede) -> dict:
    return {"id": s.id, "nombre": s.nombre, "activa": s.activa}


@router.get("/sedes")
def listar_sedes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    sedes = db.query(models.LavaderoSede).filter_by(
        empresa_id=current_user.empresa_id
    ).order_by(models.LavaderoSede.nombre.asc()).all()
    return [_sede_to_dict(s) for s in sedes]


@router.post("/sedes")
def crear_sede(
    body: SedeIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    sede = models.LavaderoSede(
        empresa_id=current_user.empresa_id,
        nombre=body.nombre.strip(),
        activa=body.activa if body.activa is not None else True,
    )
    db.add(sede)
    db.commit()
    db.refresh(sede)
    return _sede_to_dict(sede)


@router.put("/sedes/{sede_id}")
def actualizar_sede(
    sede_id: int,
    body: SedeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    sede = db.query(models.LavaderoSede).filter_by(
        id=sede_id, empresa_id=current_user.empresa_id
    ).first()
    if not sede:
        raise HTTPException(404, "Sede no encontrada")
    if body.nombre is not None:
        sede.nombre = body.nombre.strip()
    if body.activa is not None:
        sede.activa = body.activa
    db.commit()
    db.refresh(sede)
    return _sede_to_dict(sede)


@router.delete("/sedes/{sede_id}")
def eliminar_sede(
    sede_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    sede = db.query(models.LavaderoSede).filter_by(
        id=sede_id, empresa_id=current_user.empresa_id
    ).first()
    if not sede:
        raise HTTPException(404, "Sede no encontrada")
    tiene_ordenes = db.query(models.LavaderoOrden).filter_by(
        empresa_id=current_user.empresa_id, sede_id=sede_id
    ).first()
    if tiene_ordenes:
        raise HTTPException(400, "Esta sede ya tiene órdenes registradas — desactívala en vez de eliminarla.")
    db.query(models.LavaderoTrabajadorSede).filter_by(empresa_id=current_user.empresa_id, sede_id=sede_id).delete()
    db.query(models.LavaderoSedeServicio).filter_by(empresa_id=current_user.empresa_id, sede_id=sede_id).delete()
    db.delete(sede)
    db.commit()
    return {"ok": True}


@router.get("/sedes/{sede_id}/asignaciones")
def get_asignaciones_sede(
    sede_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Trabajadores y servicios asignados a esta sede en particular."""
    sede = db.query(models.LavaderoSede).filter_by(
        id=sede_id, empresa_id=current_user.empresa_id
    ).first()
    if not sede:
        raise HTTPException(404, "Sede no encontrada")
    trabajador_ids = [r.user_id for r in db.query(models.LavaderoTrabajadorSede.user_id).filter_by(
        empresa_id=current_user.empresa_id, sede_id=sede_id)]
    producto_ids = [r.producto_id for r in db.query(models.LavaderoSedeServicio.producto_id).filter_by(
        empresa_id=current_user.empresa_id, sede_id=sede_id)]
    return {"trabajador_ids": trabajador_ids, "producto_ids": producto_ids}


@router.put("/sedes/{sede_id}/trabajadores")
def set_trabajadores_sede(
    sede_id: int,
    body: TrabajadoresSedeIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """
    Reemplaza la asignación de trabajadores de esta sede. Un trabajador solo
    puede estar en UNA sede a la vez: si ya estaba en otra, se le quita de
    allá al asignarlo aquí.
    """
    empresa_id = current_user.empresa_id
    sede = db.query(models.LavaderoSede).filter_by(id=sede_id, empresa_id=empresa_id).first()
    if not sede:
        raise HTTPException(404, "Sede no encontrada")

    if body.user_ids:
        db.query(models.LavaderoTrabajadorSede).filter(
            models.LavaderoTrabajadorSede.empresa_id == empresa_id,
            models.LavaderoTrabajadorSede.user_id.in_(body.user_ids),
        ).delete(synchronize_session=False)
    db.query(models.LavaderoTrabajadorSede).filter_by(
        empresa_id=empresa_id, sede_id=sede_id
    ).delete(synchronize_session=False)
    for uid in body.user_ids:
        db.add(models.LavaderoTrabajadorSede(empresa_id=empresa_id, user_id=uid, sede_id=sede_id))
    db.commit()
    return {"ok": True, "user_ids": body.user_ids}


@router.put("/sedes/{sede_id}/servicios")
def set_servicios_sede(
    sede_id: int,
    body: ServiciosSedeIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Reemplaza qué servicios se ofrecen en esta sede (un servicio puede
    estar en varias sedes a la vez)."""
    empresa_id = current_user.empresa_id
    sede = db.query(models.LavaderoSede).filter_by(id=sede_id, empresa_id=empresa_id).first()
    if not sede:
        raise HTTPException(404, "Sede no encontrada")

    db.query(models.LavaderoSedeServicio).filter_by(
        empresa_id=empresa_id, sede_id=sede_id
    ).delete(synchronize_session=False)
    for pid in body.producto_ids:
        db.add(models.LavaderoSedeServicio(empresa_id=empresa_id, sede_id=sede_id, producto_id=pid))
    db.commit()
    return {"ok": True, "producto_ids": body.producto_ids}


@router.get("/sedes/{sede_id}/filtros")
def get_filtros_sede(
    sede_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """
    IDs a EXCLUIR de las listas de trabajadores/servicios ya cargadas en el
    frontend, para que el POS muestre solo lo que aplica a esta sede:
    - Trabajador: se excluye si está asignado a OTRA sede distinta a esta.
      Uno sin ninguna sede asignada se ve en todas.
    - Servicio: se excluye si tiene sedes asignadas y esta no es una de
      ellas. Uno sin ninguna sede asignada se ve en todas.
    """
    empresa_id = current_user.empresa_id
    sede = db.query(models.LavaderoSede).filter_by(id=sede_id, empresa_id=empresa_id).first()
    if not sede:
        raise HTTPException(404, "Sede no encontrada")

    asignados_aqui = {r.user_id for r in db.query(models.LavaderoTrabajadorSede.user_id).filter_by(
        empresa_id=empresa_id, sede_id=sede_id)}
    todos_asignados = {r.user_id for r in db.query(models.LavaderoTrabajadorSede.user_id).filter_by(
        empresa_id=empresa_id)}
    trabajador_ids_excluidos = list(todos_asignados - asignados_aqui)

    con_restriccion = {r.producto_id for r in db.query(models.LavaderoSedeServicio.producto_id).filter_by(
        empresa_id=empresa_id).distinct()}
    permitidos_aqui = {r.producto_id for r in db.query(models.LavaderoSedeServicio.producto_id).filter_by(
        empresa_id=empresa_id, sede_id=sede_id)}
    producto_ids_excluidos = list(con_restriccion - permitidos_aqui)

    return {
        "trabajador_ids_excluidos": trabajador_ids_excluidos,
        "producto_ids_excluidos": producto_ids_excluidos,
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
        "sede_id": o.sede_id,
        "sede_nombre": o.sede.nombre if o.sede else None,
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
        sede_id=body.sede_id,
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
    sede_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    q = db.query(models.LavaderoOrden).filter(
        models.LavaderoOrden.empresa_id == current_user.empresa_id
    )
    if sede_id:
        q = q.filter(models.LavaderoOrden.sede_id == sede_id)
    if estado:
        q = q.filter(models.LavaderoOrden.estado == estado)
    elif activas:
        q = q.filter(models.LavaderoOrden.estado.in_(["recibido", "lavando", "terminado"]))

    if fecha:
        start, end = _rango_utc_colombia(fecha, fecha)
        q = q.filter(models.LavaderoOrden.fecha_entrada >= start, models.LavaderoOrden.fecha_entrada < end)
    elif activas:
        # For active orders, show all active regardless of date (could be from yesterday)
        pass

    ordenes = q.order_by(models.LavaderoOrden.fecha_entrada.asc()).all()
    return [_orden_to_dict(o) for o in ordenes]


@router.get("/vehiculos-frecuentes")
def vehiculos_frecuentes(
    limit: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Placas que más veces han pasado por el lavadero — para registrar de
    un clic sin volver a escribir todo. Solo cuenta placas con 2+ visitas."""
    conteo = (
        db.query(
            models.LavaderoOrden.placa,
            func.count(models.LavaderoOrden.id).label("veces"),
            func.max(models.LavaderoOrden.id).label("ultima_id"),
        )
        .filter(models.LavaderoOrden.empresa_id == current_user.empresa_id)
        .group_by(models.LavaderoOrden.placa)
        .having(func.count(models.LavaderoOrden.id) >= 2)
        .order_by(func.count(models.LavaderoOrden.id).desc())
        .limit(limit)
        .all()
    )
    resultado = []
    for r in conteo:
        ultima = db.query(models.LavaderoOrden).options(
            joinedload(models.LavaderoOrden.cliente)
        ).filter_by(id=r.ultima_id).first()
        resultado.append({
            "placa": r.placa,
            "veces": r.veces,
            "tipo_vehiculo": ultima.tipo_vehiculo if ultima else None,
            "cliente_id": ultima.cliente_id if ultima else None,
            "cliente_nombre": ultima.cliente.nombre if ultima and ultima.cliente else None,
        })
    return resultado


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

    if body.operador_id is not None:
        orden.operador_id = body.operador_id

    # Tiempo real de lavado: se marca la primera vez que entra a "lavando" y
    # cuando queda "terminado" — no se pisa si ya se había marcado antes (un
    # regreso accidental de estado no debe borrar el tiempo ya registrado).
    if body.estado == "lavando" and orden.fecha_inicio_lavado is None:
        orden.fecha_inicio_lavado = datetime.now(timezone.utc)
    if body.estado == "terminado" and orden.fecha_fin_lavado is None:
        orden.fecha_fin_lavado = datetime.now(timezone.utc)

    orden.estado = body.estado
    db.commit()
    db.refresh(orden)
    return _orden_to_dict(orden)


@router.post("/ordenes/{orden_id}/cancelar")
def cancelar_orden(
    orden_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Cancela una orden que aún no fue cobrada (el cliente se fue, error al
    registrar, etc.). Deja de aparecer en el tablero de activas. Una orden ya
    cobrada no se puede cancelar desde aquí — para eso está el flujo normal
    de devoluciones sobre la venta."""
    orden = db.query(models.LavaderoOrden).filter_by(
        id=orden_id, empresa_id=current_user.empresa_id
    ).first()
    if not orden:
        raise HTTPException(404, "Orden no encontrada")
    if orden.pagado:
        raise HTTPException(400, "Esta orden ya fue cobrada, no se puede cancelar.")

    orden.estado = "cancelado"
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

    # Puntos de fidelización: el descuento se calcula y se descuenta AQUÍ,
    # con el redeem_rate real de la empresa — nunca se confía en el monto que
    # mande el navegador. Si no hay puntos suficientes, se rechaza el cobro
    # en vez de aplicar el descuento y dejar el canje sin efecto (antes esto
    # fallaba en silencio: la venta salía con el descuento aplicado, pero los
    # puntos del cliente jamás se restaban).
    empresa_obj = db.query(models.Empresa).filter_by(id=current_user.empresa_id).first()
    fidel_activa = getattr(empresa_obj, "fidelizacion_activa", True)
    if fidel_activa is None:
        fidel_activa = True
    earn_rate   = getattr(empresa_obj, "fidelizacion_earn_rate",   1000) or 1000
    redeem_rate = getattr(empresa_obj, "fidelizacion_redeem_rate", 100)  or 100

    puntos_canjeados = int(body.puntos_canjeados or 0)
    descuento_pts = 0.0
    if puntos_canjeados > 0:
        if not orden.cliente_id:
            raise HTTPException(400, "No se puede canjear puntos: el pedido no tiene un cliente asignado.")
        if not fidel_activa:
            raise HTTPException(400, "El programa de fidelización está desactivado.")
        from crud.puntos import canjear_puntos
        try:
            descuento_pts = canjear_puntos(
                db, empresa_id=current_user.empresa_id, cliente_id=orden.cliente_id,
                puntos_a_canjear=puntos_canjeados, redeem_rate=redeem_rate, commit=False,
            )
        except ValueError as e:
            raise HTTPException(400, str(e))

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
        puntos_canjeados=puntos_canjeados,
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

    # Ganar puntos por esta compra — sí puede fallar en silencio (no es
    # dinero que se pierda, solo puntos que el cliente no acumula), pero se
    # deja registrado en el log para poder auditarlo. El snapshot
    # (puntos_ganados / saldo_puntos_cliente) queda en la Venta para que el
    # recibo pueda mostrarlo sin recalcular nada en una reimpresión futura.
    puntos_ganados = 0
    saldo_puntos_cliente = None
    if orden.cliente_id and fidel_activa:
        try:
            from crud.puntos import ganar_puntos_venta
            puntos_ganados = ganar_puntos_venta(db, empresa_id=current_user.empresa_id,
                               cliente_id=orden.cliente_id,
                               total_venta=float(total), venta_id=venta.id,
                               earn_rate=earn_rate, commit=False)
            db.flush()
            cliente_obj = db.query(models.Cliente).filter_by(id=orden.cliente_id).first()
            saldo_puntos_cliente = cliente_obj.puntos_fidelidad if cliente_obj else None
            venta.puntos_ganados = puntos_ganados
            venta.saldo_puntos_cliente = saldo_puntos_cliente
            db.add(venta)
        except Exception:
            import logging
            logging.getLogger("lavadero").exception(
                "No se pudieron acreditar puntos de fidelización para la orden %s", orden_id
            )

    db.commit()
    db.refresh(orden)

    # Asiento contable de la venta del lavadero (idempotente)
    try:
        from services.contabilidad import registrar_asiento_venta
        registrar_asiento_venta(db, venta)
        db.commit()
    except Exception:
        db.rollback()  # sesión envenenada rompería refresh/serialización posteriores

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
    return {
        **_orden_to_dict(orden),
        "venta_id": venta.id,
        "subtotal": bruto,
        "descuento_puntos": descuento_pts,
        "puntos_canjeados": puntos_canjeados,
        "puntos_ganados": puntos_ganados,
        "saldo_puntos_cliente": saldo_puntos_cliente,
    }


# ─── Historial de ventas ──────────────────────────────────────────────────────

@router.get("/historial")
def historial_ventas(
    fecha_inicio: Optional[date] = Query(None),
    fecha_fin:    Optional[date] = Query(None),
    placa:        Optional[str]  = Query(None),
    sede_id:      Optional[int]  = Query(None),
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
            joinedload(models.LavaderoOrden.sede),
        )
    )
    if sede_id:
        q = q.filter(models.LavaderoOrden.sede_id == sede_id)
    if placa:
        q = q.filter(models.LavaderoOrden.placa.ilike(f"%{placa.upper().replace('-','')}%"))
    start, end = _rango_utc_colombia(fecha_inicio, fecha_fin)
    if start:
        q = q.filter(models.LavaderoOrden.fecha_entrada >= start)
    if end:
        q = q.filter(models.LavaderoOrden.fecha_entrada < end)

    ordenes = q.order_by(models.LavaderoOrden.fecha_salida.desc()).all()

    # Datos de FE de todas las ventas vinculadas en UNA sola consulta, en vez
    # de una consulta aparte por cada orden del historial (N+1).
    venta_ids = [o.venta_id for o in ordenes if o.venta_id]
    fe_por_venta = {}
    if venta_ids:
        fe_rows = db.query(
            models.Venta.id,
            models.Venta.numero_factura,
            models.Venta.estado_electronico,
            models.Venta.cufe,
            models.Venta.pdf_url,
        ).filter(models.Venta.id.in_(venta_ids)).all()
        fe_por_venta = {r.id: r for r in fe_rows}

    resultado = []
    for o in ordenes:
        venta_fe = fe_por_venta.get(o.venta_id) if o.venta_id else None

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
            "sede_nombre": o.sede.nombre if o.sede else None,
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
    sede_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    empresa_id = current_user.empresa_id

    # Query from LavaderoOrden (paid orders). LEFT JOIN a User: una orden sin
    # lavador asignado (operador_id nulo) debe seguir sumando al total del
    # negocio, agrupada bajo "Sin asignar" — antes se perdía por completo con
    # un INNER JOIN.
    q = db.query(
        models.LavaderoOrden.operador_id.label("operador_id"),
        func.coalesce(models.User.nombre_completo, models.User.username, "Sin asignar").label("nombre"),
        func.count(models.LavaderoOrden.id).label("num_lavadas"),
        func.sum(models.LavaderoOrden.total).label("total_ventas"),
        func.min(models.LavaderoOrden.fecha_entrada).label("primera_lavada"),
        func.max(models.LavaderoOrden.fecha_entrada).label("ultima_lavada"),
    ).outerjoin(
        models.User, models.LavaderoOrden.operador_id == models.User.id
    ).filter(
        models.LavaderoOrden.empresa_id == empresa_id,
        models.LavaderoOrden.pagado == True,
    )
    if sede_id:
        q = q.filter(models.LavaderoOrden.sede_id == sede_id)

    _r_start, _r_end = _rango_utc_colombia(fecha_inicio, fecha_fin)
    if _r_start:
        q = q.filter(models.LavaderoOrden.fecha_entrada >= _r_start)
    if _r_end:
        q = q.filter(models.LavaderoOrden.fecha_entrada < _r_end)

    q = q.group_by(models.LavaderoOrden.operador_id, models.User.nombre_completo, models.User.username)
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
    if sede_id:
        comision_q = comision_q.filter(models.LavaderoOrden.sede_id == sede_id)

    if _r_start:
        comision_q = comision_q.filter(models.LavaderoOrden.fecha_entrada >= _r_start)
    if _r_end:
        comision_q = comision_q.filter(models.LavaderoOrden.fecha_entrada < _r_end)

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


# ─── Reporte de tiempos de lavada ─────────────────────────────────────────────

@router.get("/reporte-tiempos")
def reporte_tiempos(
    fecha_inicio: Optional[date] = Query(None),
    fecha_fin: Optional[date] = Query(None),
    sede_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """
    Cuánto tardó cada lavada de verdad (de "lavando" a "terminado"), para
    evaluar trabajadores y detectar cuál lavada específica infló el
    promedio. Solo cuenta órdenes con ambas marcas de tiempo registradas —
    las anteriores a esta funcionalidad no tienen ese dato.
    """
    empresa_id = current_user.empresa_id
    start, end = _rango_utc_colombia(fecha_inicio, fecha_fin)

    q = db.query(models.LavaderoOrden).options(
        joinedload(models.LavaderoOrden.operador)
    ).filter(
        models.LavaderoOrden.empresa_id == empresa_id,
        models.LavaderoOrden.fecha_inicio_lavado.isnot(None),
        models.LavaderoOrden.fecha_fin_lavado.isnot(None),
    )
    if sede_id:
        q = q.filter(models.LavaderoOrden.sede_id == sede_id)
    if start:
        q = q.filter(models.LavaderoOrden.fecha_entrada >= start)
    if end:
        q = q.filter(models.LavaderoOrden.fecha_entrada < end)

    ordenes = q.order_by(models.LavaderoOrden.fecha_fin_lavado.desc()).all()

    detalle = []
    por_trabajador = {}
    for o in ordenes:
        minutos = round((o.fecha_fin_lavado - o.fecha_inicio_lavado).total_seconds() / 60, 1)
        nombre = (o.operador.nombre_completo or o.operador.username) if o.operador else "Sin asignar"
        detalle.append({
            "orden_id":            o.id,
            "placa":               o.placa,
            "tipo_vehiculo":       o.tipo_vehiculo,
            "operador_id":         o.operador_id,
            "operador_nombre":     nombre,
            "minutos":             minutos,
            "fecha_inicio_lavado": o.fecha_inicio_lavado.isoformat(),
            "fecha_fin_lavado":    o.fecha_fin_lavado.isoformat(),
        })
        acc = por_trabajador.setdefault(o.operador_id, {"nombre": nombre, "tiempos": []})
        acc["tiempos"].append(minutos)

    resumen_trabajadores = []
    for operador_id, acc in por_trabajador.items():
        tiempos = acc["tiempos"]
        resumen_trabajadores.append({
            "operador_id":       operador_id,
            "nombre":            acc["nombre"],
            "num_lavados":       len(tiempos),
            "promedio_minutos":  round(sum(tiempos) / len(tiempos), 1),
            "minimo_minutos":    round(min(tiempos), 1),
            "maximo_minutos":    round(max(tiempos), 1),
        })
    resumen_trabajadores.sort(key=lambda r: r["promedio_minutos"])

    todos_los_tiempos = [d["minutos"] for d in detalle]
    promedio_general = round(sum(todos_los_tiempos) / len(todos_los_tiempos), 1) if todos_los_tiempos else 0.0

    # Detalle ordenado de más lenta a más rápida — para identificar de un
    # vistazo cuál lavada específica infló el promedio de un trabajador.
    detalle.sort(key=lambda d: d["minutos"], reverse=True)

    return {
        "promedio_general_minutos": promedio_general,
        "num_lavados_con_tiempo":   len(detalle),
        "trabajadores":             resumen_trabajadores,
        "detalle":                  detalle,
    }
