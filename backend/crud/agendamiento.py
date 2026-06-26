"""
CRUD del módulo de Agendamiento de Citas.

Conceptos:
- Servicio agendable  → un Producto con agendable=True y duracion_minutos.
- Trabajadores        → Users del sistema asignados a un servicio (ServicioTrabajador).
- Cita                → reserva de un servicio con un trabajador en una franja horaria.

Reglas:
- Solo trabajadores asignados a un servicio pueden atenderlo.
- Un trabajador no puede tener dos citas solapadas.
- El cliente sólo ve franjas libres (al menos un trabajador disponible).
"""
from datetime import datetime, timedelta, time, date
from zoneinfo import ZoneInfo
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

import models

BOGOTA_TZ = ZoneInfo("America/Bogota")

# Horario laboral por defecto (hora local Bogotá). Las citas sólo se ofertan dentro de él.
HORA_APERTURA = 8     # 08:00
HORA_CIERRE   = 18    # 18:00
ESTADOS_ACTIVOS = ("pendiente", "confirmada", "en_curso")  # ocupan la agenda


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────
def _aware(dt: datetime) -> datetime:
    """Garantiza datetime timezone-aware (asume Bogotá si es naive)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=BOGOTA_TZ)
    return dt


def _enriquecer_cita(db: Session, cita: models.Cita) -> models.Cita:
    """Agrega campos de display sin tocar la BD."""
    prod = cita.producto
    trab = cita.usuario
    cli  = cita.cliente
    cita.producto_nombre = prod.nombre if prod else None
    cita.trabajador_nombre = (trab.nombre_completo or trab.username) if trab else None
    if cli:
        cita.cliente_display = cli.nombre
    elif cita.cliente_nombre:
        cita.cliente_display = cita.cliente_nombre
    else:
        cita.cliente_display = "Sin cliente"
    return cita


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
        )
        .all()
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
    # Un servicio agendable es, por definición, un servicio
    if data.agendable:
        prod.es_servicio = True

    # Reconciliar trabajadores asignados
    deseados = set(data.trabajador_ids or [])
    actuales = {
        a.user_id: a
        for a in db.query(models.ServicioTrabajador).filter(
            models.ServicioTrabajador.empresa_id == empresa_id,
            models.ServicioTrabajador.producto_id == producto_id,
        )
    }
    # Activar/crear deseados
    for uid in deseados:
        if uid in actuales:
            actuales[uid].activo = True
        else:
            db.add(models.ServicioTrabajador(
                empresa_id=empresa_id, producto_id=producto_id, user_id=uid, activo=True
            ))
    # Desactivar los que ya no están
    for uid, a in actuales.items():
        if uid not in deseados:
            a.activo = False

    db.commit()
    db.refresh(prod)
    prod.trabajadores = _trabajadores_de_servicio(db, empresa_id, producto_id)
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
        )
        .all()
    )


def _solapa(inicio_a, fin_a, inicio_b, fin_b) -> bool:
    return inicio_a < fin_b and fin_a > inicio_b


def calcular_disponibilidad(db: Session, empresa_id: int, producto_id: int, dia: date) -> dict:
    """
    Devuelve las franjas libres del día para un servicio: una franja está
    disponible si al menos un trabajador asignado no tiene cita solapada.
    """
    prod = (
        db.query(models.Producto)
        .filter(models.Producto.id == producto_id, models.Producto.empresa_id == empresa_id)
        .first()
    )
    if not prod:
        return {"fecha": dia, "producto_id": producto_id, "duracion_minutos": 0, "franjas": []}

    duracion = prod.duracion_minutos or 30
    trabajadores = _trabajadores_de_servicio(db, empresa_id, producto_id)
    if not trabajadores:
        return {"fecha": dia, "producto_id": producto_id, "duracion_minutos": duracion, "franjas": []}

    # Citas activas por trabajador en el día
    ocupacion = {t.id: _citas_activas_trabajador(db, empresa_id, t.id, dia) for t in trabajadores}
    nombres = {t.id: (t.nombre_completo or t.username) for t in trabajadores}

    ahora = datetime.now(BOGOTA_TZ)
    apertura = datetime.combine(dia, time(HORA_APERTURA, 0), tzinfo=BOGOTA_TZ)
    cierre   = datetime.combine(dia, time(HORA_CIERRE, 0), tzinfo=BOGOTA_TZ)

    franjas = []
    paso = timedelta(minutes=duracion)
    cursor = apertura
    while cursor + paso <= cierre:
        fin = cursor + paso
        if fin > ahora:  # no ofertar franjas en el pasado
            # primer trabajador libre para esta franja
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

    return {
        "fecha": dia,
        "producto_id": producto_id,
        "duracion_minutos": duracion,
        "franjas": franjas,
    }


def _trabajador_disponible(db: Session, empresa_id: int, user_id: int, inicio: datetime, fin: datetime,
                           excluir_cita_id: Optional[int] = None) -> bool:
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
def get_citas(db: Session, empresa_id: int, desde: Optional[date] = None, hasta: Optional[date] = None,
              user_id: Optional[int] = None, estado: Optional[str] = None) -> List[models.Cita]:
    q = db.query(models.Cita).filter(models.Cita.empresa_id == empresa_id)
    if desde:
        q = q.filter(models.Cita.fecha_inicio >= datetime.combine(desde, time.min, tzinfo=BOGOTA_TZ))
    if hasta:
        q = q.filter(models.Cita.fecha_inicio <= datetime.combine(hasta, time.max, tzinfo=BOGOTA_TZ))
    if user_id:
        q = q.filter(models.Cita.user_id == user_id)
    if estado:
        q = q.filter(models.Cita.estado == estado)
    citas = q.order_by(models.Cita.fecha_inicio).all()
    return [_enriquecer_cita(db, c) for c in citas]


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
    """Resuelve una empresa por su slug público (reutiliza slug_catalogo)."""
    return db.query(models.Empresa).filter(models.Empresa.slug_catalogo == slug).first()


def create_cita(db: Session, empresa_id: int, data) -> models.Cita:
    prod = (
        db.query(models.Producto)
        .filter(models.Producto.id == data.producto_id, models.Producto.empresa_id == empresa_id)
        .first()
    )
    if not prod:
        raise AgendamientoError("El servicio no existe.")

    duracion = prod.duracion_minutos or 30
    inicio = _aware(data.fecha_inicio)
    fin = inicio + timedelta(minutes=duracion)

    # El trabajador debe estar asignado al servicio
    asignado = (
        db.query(models.ServicioTrabajador)
        .filter(
            models.ServicioTrabajador.empresa_id == empresa_id,
            models.ServicioTrabajador.producto_id == data.producto_id,
            models.ServicioTrabajador.user_id == data.user_id,
            models.ServicioTrabajador.activo == True,
        )
        .first()
    )
    if not asignado:
        raise AgendamientoError("El trabajador seleccionado no puede atender este servicio.")

    # Sin solapamiento
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
    return _enriquecer_cita(db, cita)


def update_cita(db: Session, empresa_id: int, cita_id: int, data) -> Optional[models.Cita]:
    cita = (
        db.query(models.Cita)
        .filter(models.Cita.id == cita_id, models.Cita.empresa_id == empresa_id)
        .first()
    )
    if not cita:
        return None

    nuevo_prod_id = data.producto_id if data.producto_id is not None else cita.producto_id
    nuevo_user_id = data.user_id if data.user_id is not None else cita.user_id
    nuevo_inicio = _aware(data.fecha_inicio) if data.fecha_inicio is not None else _aware(cita.fecha_inicio)

    prod = (
        db.query(models.Producto)
        .filter(models.Producto.id == nuevo_prod_id, models.Producto.empresa_id == empresa_id)
        .first()
    )
    duracion = (prod.duracion_minutos or 30) if prod else 30
    nuevo_fin = nuevo_inicio + timedelta(minutes=duracion)

    # Reprogramación o cambio de trabajador → revalidar
    cambia_agenda = (
        data.fecha_inicio is not None or data.user_id is not None or data.producto_id is not None
    )
    if cambia_agenda:
        asignado = (
            db.query(models.ServicioTrabajador)
            .filter(
                models.ServicioTrabajador.empresa_id == empresa_id,
                models.ServicioTrabajador.producto_id == nuevo_prod_id,
                models.ServicioTrabajador.user_id == nuevo_user_id,
                models.ServicioTrabajador.activo == True,
            )
            .first()
        )
        if not asignado:
            raise AgendamientoError("El trabajador seleccionado no puede atender este servicio.")
        if not _trabajador_disponible(db, empresa_id, nuevo_user_id, nuevo_inicio, nuevo_fin, excluir_cita_id=cita_id):
            raise AgendamientoError("El trabajador ya tiene una cita en ese horario.")
        cita.producto_id = nuevo_prod_id
        cita.user_id = nuevo_user_id
        cita.fecha_inicio = nuevo_inicio
        cita.fecha_fin = nuevo_fin

    if data.cliente_id is not None:
        cita.cliente_id = data.cliente_id
    if data.estado is not None:
        cita.estado = data.estado
    if data.cliente_nombre is not None:
        cita.cliente_nombre = data.cliente_nombre
    if data.cliente_telefono is not None:
        cita.cliente_telefono = data.cliente_telefono
    if data.cliente_email is not None:
        cita.cliente_email = data.cliente_email
    if data.notas is not None:
        cita.notas = data.notas

    db.commit()
    db.refresh(cita)
    return _enriquecer_cita(db, cita)


def cambiar_estado_cita(db: Session, empresa_id: int, cita_id: int, estado: str) -> Optional[models.Cita]:
    cita = (
        db.query(models.Cita)
        .filter(models.Cita.id == cita_id, models.Cita.empresa_id == empresa_id)
        .first()
    )
    if not cita:
        return None
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
