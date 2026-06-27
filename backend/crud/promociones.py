"""
CRUD y validación de códigos promocionales para suscripciones.

El descuento se aplica al precio del plan al pagar la suscripción (Wompi).
La validación es server-side y se usa tanto para previsualizar el descuento
como para firmar el monto real del cobro.
"""
from datetime import datetime, timezone
from typing import Optional, Tuple

from sqlalchemy.orm import Session

import models, schemas


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def _normalizar(codigo: str) -> str:
    return (codigo or "").strip().upper()


def calcular_descuento(codigo: models.CodigoPromocional, precio: float) -> float:
    """Devuelve el descuento en COP (acotado al precio) según tipo y valor."""
    if precio <= 0:
        return 0.0
    if codigo.tipo == "fijo":
        desc = float(codigo.valor or 0)
    else:  # porcentaje
        desc = precio * float(codigo.valor or 0) / 100.0
    return max(0.0, min(desc, precio))


def obtener_por_codigo(db: Session, codigo: str) -> Optional[models.CodigoPromocional]:
    return (
        db.query(models.CodigoPromocional)
        .filter(models.CodigoPromocional.codigo == _normalizar(codigo))
        .first()
    )


def validar_codigo(
    db: Session, codigo_str: str, plan: models.PlanSuscripcion, empresa_id: int
) -> Tuple[Optional[models.CodigoPromocional], float, Optional[str]]:
    """Valida un código contra un plan y empresa.
    Devuelve (codigo|None, descuento_cop, motivo_error|None)."""
    cod = obtener_por_codigo(db, codigo_str)
    if not cod:
        return None, 0.0, "El código no existe."
    if not cod.activo:
        return None, 0.0, "El código está inactivo."

    ahora = _ahora()
    if cod.fecha_inicio and ahora < _aware(cod.fecha_inicio):
        return None, 0.0, "El código aún no está vigente."
    if cod.fecha_fin and ahora > _aware(cod.fecha_fin):
        return None, 0.0, "El código está vencido."

    if cod.max_usos is not None and (cod.usos_actuales or 0) >= cod.max_usos:
        return None, 0.0, "El código alcanzó su límite de usos."

    if cod.planes_aplicables and plan.id not in cod.planes_aplicables:
        return None, 0.0, "El código no aplica a este plan."

    if cod.un_uso_por_empresa:
        ya_usado = (
            db.query(models.RegistroPago)
            .filter(
                models.RegistroPago.empresa_id == empresa_id,
                models.RegistroPago.codigo_promo_id == cod.id,
            )
            .first()
        )
        if ya_usado:
            return None, 0.0, "Ya usaste este código anteriormente."

    descuento = calcular_descuento(cod, float(plan.precio or 0))
    if descuento <= 0:
        return None, 0.0, "El código no genera descuento para este plan."
    return cod, descuento, None


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# ── CRUD superadmin ───────────────────────────────────────────────────────────
def listar(db: Session):
    return db.query(models.CodigoPromocional).order_by(models.CodigoPromocional.id.desc()).all()


def crear(db: Session, data: schemas.CodigoPromocionalCreate) -> models.CodigoPromocional:
    cod = models.CodigoPromocional(
        codigo=_normalizar(data.codigo),
        descripcion=data.descripcion,
        tipo=data.tipo,
        valor=data.valor,
        activo=data.activo,
        fecha_inicio=data.fecha_inicio,
        fecha_fin=data.fecha_fin,
        max_usos=data.max_usos,
        un_uso_por_empresa=data.un_uso_por_empresa,
        planes_aplicables=data.planes_aplicables or None,
    )
    db.add(cod)
    db.commit()
    db.refresh(cod)
    return cod


def actualizar(db: Session, codigo_id: int, data: schemas.CodigoPromocionalUpdate) -> Optional[models.CodigoPromocional]:
    cod = db.query(models.CodigoPromocional).filter(models.CodigoPromocional.id == codigo_id).first()
    if not cod:
        return None
    for field in ("descripcion", "tipo", "valor", "activo", "fecha_inicio", "fecha_fin",
                  "max_usos", "un_uso_por_empresa", "planes_aplicables"):
        v = getattr(data, field, None)
        if v is not None:
            setattr(cod, field, v)
    db.commit()
    db.refresh(cod)
    return cod


def eliminar(db: Session, codigo_id: int) -> bool:
    cod = db.query(models.CodigoPromocional).filter(models.CodigoPromocional.id == codigo_id).first()
    if not cod:
        return False
    db.delete(cod)
    db.commit()
    return True
