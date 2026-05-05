from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import models, schemas
from crud.common import BOGOTA_TZ
from crud.productos import get_producto


def create_notificacion(db: Session, empresa_id: int, notificacion: schemas.NotificacionCreate):
    db_notificacion = models.Notificacion(**notificacion.dict(), empresa_id=empresa_id)
    db.add(db_notificacion)
    db.commit()
    db.refresh(db_notificacion)
    return db_notificacion

def get_notificaciones_usuario(db: Session, empresa_id: int, usuario_id: int, skip: int = 0, limit: int = 20):
    return (
        db.query(models.Notificacion)
        .filter(
            models.Notificacion.usuario_id == usuario_id,
            models.Notificacion.empresa_id == empresa_id
        )
        .order_by(models.Notificacion.fecha_creacion.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def marcar_notificacion_leida(db: Session, empresa_id: int, notificacion_id: int, usuario_id: int):
    db_notificacion = (
        db.query(models.Notificacion)
        .filter(
            models.Notificacion.id == notificacion_id,
            models.Notificacion.usuario_id == usuario_id,
            models.Notificacion.empresa_id == empresa_id
        )
        .first()
    )
    if db_notificacion:
        db_notificacion.leido = True
        db.commit()
        db.refresh(db_notificacion)
    return db_notificacion

def check_and_notify_low_stock(db: Session, empresa_id: int, producto_ids: List[int]):
    admin_users = db.query(models.User).join(models.Role).filter(
        models.Role.name == "Admin",
        models.User.empresa_id == empresa_id
    ).all()
    if not admin_users:
        return

    hoy_col = datetime.now(BOGOTA_TZ).date()

    for prod_id in set(producto_ids):
        prod = get_producto(db, empresa_id, prod_id)
        if not prod or prod.es_servicio:
            continue
        if (prod.stock_minimo or 0) > 0 and (prod.stock_actual or 0) < prod.stock_minimo:
            for admin in admin_users:
                # Evitar notificaciones duplicadas en el mismo día
                ya_notificado = db.query(models.Notificacion).filter(
                    models.Notificacion.usuario_id == admin.id,
                    models.Notificacion.empresa_id == empresa_id,
                    models.Notificacion.mensaje.like(f"%{prod.nombre}%bajo stock%"),
                ).all()

                # Checkear si alguna fue hoy en local
                notificado_hoy = any(n.fecha_creacion.astimezone(BOGOTA_TZ).date() == hoy_col for n in ya_notificado)

                if notificado_hoy:
                    continue
                db.add(models.Notificacion(
                    usuario_id=admin.id,
                    empresa_id=empresa_id,
                    mensaje=f"⚠️ '{prod.nombre}' está bajo stock mínimo. Actual: {prod.stock_actual:.1f} | Mínimo: {prod.stock_minimo:.1f}",
                    tipo="warning",
                    leido=False
                ))
    db.commit()
