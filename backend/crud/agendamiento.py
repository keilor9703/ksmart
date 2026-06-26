"""
CRUD del módulo de Agendamiento de Citas.

Conceptos:
- Servicio agendable  → un Producto con agendable=True y duracion_minutos.
- Trabajadores        → Users del sistema asignados a un servicio (ServicioTrabajador).
- Cita                → reserva de un servicio con un trabajador en una franja horaria.
- AgendamientoConfig  → horario laboral, días hábiles y políticas de anticipo por empresa.

Reglas:
- Solo trabajadores asignados a un servicio pueden atenderlo.
- Un trabajador no puede tener dos citas solapadas.
- El cliente sólo ve franjas libres (al menos un trabajador disponible).
- Las franjas respetan el horario y días laborables configurados por la empresa.
"""
from datetime import datetime, timedelta, time, date
from zoneinfo import ZoneInfo
from typing import List, Optional

from sqlalchemy.orm import Session

import models, schemas

BOGOTA_TZ = ZoneInfo("America/Bogota")
ESTADOS_ACTIVOS = ("pendiente", "confirmada", "en_curso")  # bloquean la agenda


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────
def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=BOGOTA_TZ)
    return dt


def _limpiar_cedula(cedula) -> Optional[str]:
    """Deja solo caracteres alfanuméricos (la FE exige dni sin puntos/guiones/espacios).
    Quita el dígito verificador de NIT si viene con guion (900123456-1 → 900123456)."""
    if not cedula:
        return None
    s = str(cedula).strip()
    if "-" in s:
        s = s.split("-")[0]
    limpio = "".join(c for c in s if c.isalnum())
    return limpio or None


def _enriquecer_cita(db: Session, cita: models.Cita) -> models.Cita:
    prod = cita.producto
    trab = cita.usuario
    cli  = cita.cliente
    cita.producto_nombre    = prod.nombre if prod else None
    cita.trabajador_nombre  = (trab.nombre_completo or trab.username) if trab else None
    cita.producto_precio    = prod.precio if prod else None
    if cli:
        cita.cliente_display    = cli.nombre
        cita.cliente_telefono   = cita.cliente_telefono or cli.telefono
    elif cita.cliente_nombre:
        cita.cliente_display    = cita.cliente_nombre
    else:
        cita.cliente_display    = "Sin cliente"
    return cita


# ──────────────────────────────────────────────────────────────────────────────
# Configuración de agendamiento por empresa
# ──────────────────────────────────────────────────────────────────────────────
def get_or_create_agendamiento_config(db: Session, empresa_id: int) -> models.AgendamientoConfig:
    cfg = db.query(models.AgendamientoConfig).filter_by(empresa_id=empresa_id).first()
    if not cfg:
        cfg = models.AgendamientoConfig(empresa_id=empresa_id)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def update_agendamiento_config(db: Session, empresa_id: int, data) -> models.AgendamientoConfig:
    cfg = get_or_create_agendamiento_config(db, empresa_id)
    for field in ("hora_apertura", "hora_cierre", "dias_laborales", "dias_no_laborales",
                  "whatsapp", "requiere_anticipo", "porcentaje_anticipo", "mensaje_recordatorio"):
        v = getattr(data, field, None)
        if v is not None:
            setattr(cfg, field, v)
    db.commit()
    db.refresh(cfg)
    return cfg


def _es_dia_laboral(cfg: models.AgendamientoConfig, dia: date) -> bool:
    """True si el día es laborable según config (weekday y no es festivo)."""
    dias = cfg.dias_laborales or [0, 1, 2, 3, 4, 5]
    festivos = cfg.dias_no_laborales or []
    if dia.weekday() not in dias:
        return False
    if dia.isoformat() in festivos:
        return False
    return True


# ──────────────────────────────────────────────────────────────────────────────
# Servicios agendables y asignación de trabajadores
# ──────────────────────────────────────────────────────────────────────────────
def get_servicios_agendables(db: Session, empresa_id: int, solo_activos: bool = False) -> List[models.Producto]:
    q = db.query(models.Producto).filter(models.Producto.empresa_id == empresa_id)
    if solo_activos:
        q = q.filter(models.Producto.agendable == True, models.Producto.vigente == True)
    else:
        q = q.filter(models.Producto.es_servicio == True)
    productos = q.order_by(models.Producto.nombre).all()
    for p in productos:
        p.trabajadores = _trabajadores_de_servicio(db, empresa_id, p.id)
    return productos


def _trabajadores_de_servicio(db: Session, empresa_id: int, producto_id: int) -> List[models.User]:
    asign = (
        db.query(models.ServicioTrabajador)
        .filter(
            models.ServicioTrabajador.empresa_id == empresa_id,
            models.ServicioTrabajador.producto_id == producto_id,
            models.ServicioTrabajador.activo == True,
        ).all()
    )
    ids = [a.user_id for a in asign]
    if not ids:
        return []
    return db.query(models.User).filter(models.User.id.in_(ids)).all()


def configurar_servicio_agendable(db: Session, empresa_id: int, producto_id: int, data) -> Optional[models.Producto]:
    prod = (
        db.query(models.Producto)
        .filter(models.Producto.id == producto_id, models.Producto.empresa_id == empresa_id)
        .first()
    )
    if not prod:
        return None
    prod.agendable = data.agendable
    if data.duracion_minutos is not None:
        prod.duracion_minutos = data.duracion_minutos
    if data.agendable:
        prod.es_servicio = True
    deseados = set(data.trabajador_ids or [])
    actuales = {
        a.user_id: a
        for a in db.query(models.ServicioTrabajador).filter(
            models.ServicioTrabajador.empresa_id == empresa_id,
            models.ServicioTrabajador.producto_id == producto_id,
        )
    }
    for uid in deseados:
        if uid in actuales:
            actuales[uid].activo = True
        else:
            db.add(models.ServicioTrabajador(
                empresa_id=empresa_id, producto_id=producto_id, user_id=uid, activo=True
            ))
    for uid, a in actuales.items():
        if uid not in deseados:
            a.activo = False
    db.commit()
    db.refresh(prod)
    prod.trabajadores = _trabajadores_de_servicio(db, empresa_id, prod.id)
    return prod


# ──────────────────────────────────────────────────────────────────────────────
# Disponibilidad
# ──────────────────────────────────────────────────────────────────────────────
def _citas_activas_trabajador(db: Session, empresa_id: int, user_id: int, dia: date) -> List[models.Cita]:
    inicio_dia = datetime.combine(dia, time.min, tzinfo=BOGOTA_TZ)
    fin_dia    = datetime.combine(dia, time.max, tzinfo=BOGOTA_TZ)
    return (
        db.query(models.Cita)
        .filter(
            models.Cita.empresa_id == empresa_id,
            models.Cita.user_id == user_id,
            models.Cita.estado.in_(ESTADOS_ACTIVOS),
            models.Cita.fecha_inicio < fin_dia,
            models.Cita.fecha_fin > inicio_dia,
        ).all()
    )


def _solapa(ia, fa, ib, fb) -> bool:
    return ia < fb and fa > ib


def calcular_disponibilidad(db: Session, empresa_id: int, producto_id: int, dia: date) -> dict:
    prod = (
        db.query(models.Producto)
        .filter(models.Producto.id == producto_id, models.Producto.empresa_id == empresa_id)
        .first()
    )
    if not prod:
        return {"fecha": dia, "producto_id": producto_id, "duracion_minutos": 0, "franjas": []}

    cfg = get_or_create_agendamiento_config(db, empresa_id)

    if not _es_dia_laboral(cfg, dia):
        return {"fecha": dia, "producto_id": producto_id, "duracion_minutos": prod.duracion_minutos or 30, "franjas": []}

    duracion    = prod.duracion_minutos or 30
    apertura    = cfg.hora_apertura if cfg.hora_apertura is not None else 8
    cierre      = cfg.hora_cierre   if cfg.hora_cierre   is not None else 18
    trabajadores = _trabajadores_de_servicio(db, empresa_id, producto_id)
    if not trabajadores:
        return {"fecha": dia, "producto_id": producto_id, "duracion_minutos": duracion, "franjas": []}

    ocupacion = {t.id: _citas_activas_trabajador(db, empresa_id, t.id, dia) for t in trabajadores}
    nombres   = {t.id: (t.nombre_completo or t.username) for t in trabajadores}

    ahora      = datetime.now(BOGOTA_TZ)
    t_apertura = datetime.combine(dia, time(apertura, 0), tzinfo=BOGOTA_TZ)
    t_cierre   = datetime.combine(dia, time(cierre,   0), tzinfo=BOGOTA_TZ)

    franjas = []
    paso    = timedelta(minutes=duracion)
    cursor  = t_apertura
    while cursor + paso <= t_cierre:
        fin = cursor + paso
        if fin > ahora:
            for t in trabajadores:
                libre = all(
                    not _solapa(cursor, fin, _aware(c.fecha_inicio), _aware(c.fecha_fin))
                    for c in ocupacion[t.id]
                )
                if libre:
                    franjas.append({
                        "inicio": cursor,
                        "fin": fin,
                        "user_id": t.id,
                        "trabajador_nombre": nombres[t.id],
                    })
                    break
        cursor += paso

    return {"fecha": dia, "producto_id": producto_id, "duracion_minutos": duracion, "franjas": franjas}


def _trabajador_disponible(
    db: Session, empresa_id: int, user_id: int,
    inicio: datetime, fin: datetime, excluir_cita_id: Optional[int] = None,
) -> bool:
    q = db.query(models.Cita).filter(
        models.Cita.empresa_id == empresa_id,
        models.Cita.user_id == user_id,
        models.Cita.estado.in_(ESTADOS_ACTIVOS),
        models.Cita.fecha_inicio < fin,
        models.Cita.fecha_fin > inicio,
    )
    if excluir_cita_id:
        q = q.filter(models.Cita.id != excluir_cita_id)
    return q.first() is None


# ──────────────────────────────────────────────────────────────────────────────
# CRUD de Citas
# ──────────────────────────────────────────────────────────────────────────────
def get_citas(
    db: Session, empresa_id: int,
    desde: Optional[date] = None, hasta: Optional[date] = None,
    user_id: Optional[int] = None, estado: Optional[str] = None,
) -> List[models.Cita]:
    q = db.query(models.Cita).filter(models.Cita.empresa_id == empresa_id)
    if desde:
        q = q.filter(models.Cita.fecha_inicio >= datetime.combine(desde, time.min, tzinfo=BOGOTA_TZ))
    if hasta:
        q = q.filter(models.Cita.fecha_inicio <= datetime.combine(hasta, time.max, tzinfo=BOGOTA_TZ))
    if user_id:
        q = q.filter(models.Cita.user_id == user_id)
    if estado:
        q = q.filter(models.Cita.estado == estado)
    return [_enriquecer_cita(db, c) for c in q.order_by(models.Cita.fecha_inicio).all()]


def get_cita(db: Session, empresa_id: int, cita_id: int) -> Optional[models.Cita]:
    cita = (
        db.query(models.Cita)
        .filter(models.Cita.id == cita_id, models.Cita.empresa_id == empresa_id)
        .first()
    )
    return _enriquecer_cita(db, cita) if cita else None


class AgendamientoError(Exception):
    pass


def get_empresa_by_slug(db: Session, slug: str):
    return db.query(models.Empresa).filter(models.Empresa.slug_catalogo == slug).first()


def _notificar_nueva_cita(db: Session, empresa_id: int, cita: models.Cita):
    """Notifica a admins y al trabajador asignado sobre una nueva reserva pública."""
    prod = db.query(models.Producto).filter(models.Producto.id == cita.producto_id).first()
    servicio_nombre = prod.nombre if prod else "Servicio"
    when = cita.fecha_inicio.astimezone(BOGOTA_TZ) if cita.fecha_inicio else None
    cuando = when.strftime("%d/%m %I:%M %p") if when else ""
    mensaje = (
        f"📅 Nueva cita de {cita.cliente_nombre or 'cliente'} "
        f"— {servicio_nombre}" + (f" · {cuando}" if cuando else "") + " | Agendamiento"
    )
    # Destinatarios: admins de la empresa + el trabajador asignado.
    usuarios = db.query(models.User).filter(
        models.User.empresa_id == empresa_id,
        models.User.is_active == True,
    ).all()
    destinatarios = [
        u for u in usuarios
        if (u.role and u.role.name == "Admin") or u.id == cita.user_id
    ]
    for u in destinatarios:
        db.add(models.Notificacion(
            usuario_id=u.id,
            mensaje=mensaje,
            empresa_id=empresa_id,
            tipo="info",
        ))
    db.commit()


def create_cita(db: Session, empresa_id: int, data, notificar: bool = False) -> models.Cita:
    prod = (
        db.query(models.Producto)
        .filter(models.Producto.id == data.producto_id, models.Producto.empresa_id == empresa_id)
        .first()
    )
    if not prod:
        raise AgendamientoError("El servicio no existe.")
    duracion = prod.duracion_minutos or 30
    inicio   = _aware(data.fecha_inicio)
    fin      = inicio + timedelta(minutes=duracion)

    asignado = (
        db.query(models.ServicioTrabajador)
        .filter(
            models.ServicioTrabajador.empresa_id == empresa_id,
            models.ServicioTrabajador.producto_id == data.producto_id,
            models.ServicioTrabajador.user_id == data.user_id,
            models.ServicioTrabajador.activo == True,
        ).first()
    )
    if not asignado:
        raise AgendamientoError("El trabajador seleccionado no puede atender este servicio.")
    if not _trabajador_disponible(db, empresa_id, data.user_id, inicio, fin):
        raise AgendamientoError("El trabajador ya tiene una cita en ese horario.")

    cita = models.Cita(
        empresa_id=empresa_id,
        producto_id=data.producto_id,
        cliente_id=data.cliente_id,
        user_id=data.user_id,
        fecha_inicio=inicio,
        fecha_fin=fin,
        estado=models.EstadoCita.PENDIENTE.value,
        cliente_nombre=data.cliente_nombre,
        cliente_telefono=data.cliente_telefono,
        cliente_email=data.cliente_email,
        notas=data.notas,
    )
    db.add(cita)
    db.commit()
    db.refresh(cita)
    if notificar:
        try:
            _notificar_nueva_cita(db, empresa_id, cita)
        except Exception:
            db.rollback()  # una notificación fallida no debe tumbar la reserva
    return _enriquecer_cita(db, cita)


def update_cita(db: Session, empresa_id: int, cita_id: int, data) -> Optional[models.Cita]:
    cita = (
        db.query(models.Cita)
        .filter(models.Cita.id == cita_id, models.Cita.empresa_id == empresa_id)
        .first()
    )
    if not cita:
        return None

    nuevo_prod_id  = data.producto_id  if data.producto_id  is not None else cita.producto_id
    nuevo_user_id  = data.user_id      if data.user_id      is not None else cita.user_id
    nuevo_inicio   = _aware(data.fecha_inicio) if data.fecha_inicio is not None else _aware(cita.fecha_inicio)

    prod     = db.query(models.Producto).filter(models.Producto.id == nuevo_prod_id, models.Producto.empresa_id == empresa_id).first()
    duracion = (prod.duracion_minutos or 30) if prod else 30
    nuevo_fin = nuevo_inicio + timedelta(minutes=duracion)

    cambia_agenda = data.fecha_inicio is not None or data.user_id is not None or data.producto_id is not None
    if cambia_agenda:
        asignado = (
            db.query(models.ServicioTrabajador)
            .filter(
                models.ServicioTrabajador.empresa_id == empresa_id,
                models.ServicioTrabajador.producto_id == nuevo_prod_id,
                models.ServicioTrabajador.user_id == nuevo_user_id,
                models.ServicioTrabajador.activo == True,
            ).first()
        )
        if not asignado:
            raise AgendamientoError("El trabajador seleccionado no puede atender este servicio.")
        if not _trabajador_disponible(db, empresa_id, nuevo_user_id, nuevo_inicio, nuevo_fin, excluir_cita_id=cita_id):
            raise AgendamientoError("El trabajador ya tiene una cita en ese horario.")
        cita.producto_id  = nuevo_prod_id
        cita.user_id      = nuevo_user_id
        cita.fecha_inicio = nuevo_inicio
        cita.fecha_fin    = nuevo_fin

    if data.cliente_id   is not None: cita.cliente_id       = data.cliente_id
    if data.estado        is not None: cita.estado           = data.estado
    if data.cliente_nombre   is not None: cita.cliente_nombre   = data.cliente_nombre
    if data.cliente_telefono is not None: cita.cliente_telefono = data.cliente_telefono
    if data.cliente_email    is not None: cita.cliente_email    = data.cliente_email
    if data.notas            is not None: cita.notas            = data.notas

    db.commit()
    db.refresh(cita)
    return _enriquecer_cita(db, cita)


TRANSICIONES_VALIDAS = {
    "pendiente":  {"confirmada", "en_curso", "completada", "cancelada", "no_asistio"},
    "confirmada": {"en_curso", "completada", "cancelada", "no_asistio"},
    "en_curso":   {"completada", "cancelada", "no_asistio"},
    "completada": set(),   # terminal — cobrada o no, no se revierte
    "cancelada":  set(),
    "no_asistio": set(),
}


def cambiar_estado_cita(db: Session, empresa_id: int, cita_id: int, estado: str) -> Optional[models.Cita]:
    cita = (
        db.query(models.Cita)
        .filter(models.Cita.id == cita_id, models.Cita.empresa_id == empresa_id)
        .first()
    )
    if not cita:
        return None
    permitidos = TRANSICIONES_VALIDAS.get(cita.estado, set())
    if estado not in permitidos:
        raise AgendamientoError(
            f"No se puede pasar de '{cita.estado}' a '{estado}'."
        )
    cita.estado = estado
    db.commit()
    db.refresh(cita)
    return _enriquecer_cita(db, cita)


def delete_cita(db: Session, empresa_id: int, cita_id: int) -> bool:
    cita = (
        db.query(models.Cita)
        .filter(models.Cita.id == cita_id, models.Cita.empresa_id == empresa_id)
        .first()
    )
    if not cita:
        return False
    db.delete(cita)
    db.commit()
    return True


# ──────────────────────────────────────────────────────────────────────────────
# Cobro de cita → genera una Venta
# ──────────────────────────────────────────────────────────────────────────────
def cobrar_cita(db: Session, empresa_id: int, cita_id: int, data) -> models.Cita:
    """
    Convierte una cita en una Venta en el sistema de ventas.
    - Crea el detalle de venta con el servicio como producto.
    - Descuenta el anticipo si ya estaba pagado.
    - Vincula venta_id a la cita y la marca como completada.
    """
    from crud.ventas import create_venta

    cita = (
        db.query(models.Cita)
        .filter(models.Cita.id == cita_id, models.Cita.empresa_id == empresa_id)
        .first()
    )
    if not cita:
        raise AgendamientoError("Cita no encontrada.")
    if cita.venta_id:
        raise AgendamientoError("Esta cita ya fue cobrada.")

    prod = db.query(models.Producto).filter(
        models.Producto.id == cita.producto_id,
        models.Producto.empresa_id == empresa_id,
    ).first()
    if not prod:
        raise AgendamientoError("El servicio no existe.")

    precio = data.precio_unitario if data.precio_unitario is not None else (prod.precio or 0)

    # Si la cita tiene datos de cliente inline pero sin cliente_id registrado,
    # buscar o crear un Cliente para que el historial de ventas muestre el nombre real.
    cliente_id = cita.cliente_id
    if not cliente_id and cita.cliente_nombre:
        # Buscar cliente existente SOLO si coinciden nombre Y (teléfono o email).
        # Nunca vincular a un cliente diferente basándose solo en el teléfono.
        cliente_existente = None
        nombre_cita = (cita.cliente_nombre or "").strip().lower()
        if cita.cliente_telefono:
            candidato = (
                db.query(models.Cliente)
                .filter(
                    models.Cliente.empresa_id == empresa_id,
                    models.Cliente.telefono == cita.cliente_telefono,
                ).first()
            )
            if candidato and (candidato.nombre or "").strip().lower() == nombre_cita:
                cliente_existente = candidato
        if not cliente_existente and cita.cliente_email:
            candidato = (
                db.query(models.Cliente)
                .filter(
                    models.Cliente.empresa_id == empresa_id,
                    models.Cliente.email == cita.cliente_email,
                ).first()
            )
            if candidato and (candidato.nombre or "").strip().lower() == nombre_cita:
                cliente_existente = candidato
        if not cliente_existente:
            nuevo = models.Cliente(
                empresa_id=empresa_id,
                nombre=cita.cliente_nombre,
                telefono=cita.cliente_telefono,
                email=cita.cliente_email,
            )
            db.add(nuevo)
            db.flush()
            cliente_existente = nuevo
        # Si el operador proporcionó cédula/NIT para FE y el cliente aún no la tiene, actualizarla.
        cedula_fe = _limpiar_cedula(getattr(data, 'cedula_fe', None))
        if cedula_fe and not cliente_existente.cedula:
            cliente_existente.cedula = cedula_fe
        cliente_id = cliente_existente.id
        cita.cliente_id = cliente_id

    # Si el cliente ya estaba registrado pero sin cédula y el operador la proporcionó, actualizarla.
    cedula_fe = _limpiar_cedula(getattr(data, 'cedula_fe', None))
    if cedula_fe and cita.cliente_id:
        cli = db.query(models.Cliente).filter(
            models.Cliente.id == cita.cliente_id,
            models.Cliente.empresa_id == empresa_id,
        ).first()
        if cli and not cli.cedula:
            cli.cedula = cedula_fe

    venta_data = schemas.VentaCreate(
        cliente_id=cliente_id,
        detalles=[schemas.DetalleVentaCreate(
            producto_id=prod.id,
            cantidad=1,
            precio_unitario=precio,
            descuento_pct=0,
        )],
        pagada=True,
        metodo_pago=data.metodo_pago or "Efectivo",
        operador_id=cita.user_id,
        omitir_inventario=True,   # servicios no tienen stock
        solicita_fe=data.solicita_fe if hasattr(data, "solicita_fe") else False,
        origen="agendamiento",
        observaciones=f"Cita #{cita_id}" + (f" — {cita.notas}" if cita.notas else ""),
    )

    venta = create_venta(db=db, empresa_id=empresa_id, venta=venta_data)

    # Vincular
    cita.venta_id = venta.id
    cita.estado   = models.EstadoCita.COMPLETADA.value
    db.commit()
    db.refresh(cita)
    return _enriquecer_cita(db, cita)
