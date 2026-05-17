from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import datetime, date

import models
from api.deps import get_db, get_current_active_user

router = APIRouter()

@router.get("/reporte")
def reporte_lavadero(
    fecha_inicio: Optional[date] = Query(None),
    fecha_fin: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    empresa_id = current_user.empresa_id
    q = db.query(
        models.User.id.label("operador_id"),
        models.User.nombre_completo.label("nombre"),
        func.count(models.Venta.id).label("num_ventas"),
        func.sum(models.Venta.total).label("total"),
    ).join(
        models.Venta, models.Venta.operador_id == models.User.id
    ).filter(
        models.Venta.empresa_id == empresa_id,
    )
    if fecha_inicio:
        q = q.filter(models.Venta.fecha >= datetime.combine(fecha_inicio, datetime.min.time()))
    if fecha_fin:
        q = q.filter(models.Venta.fecha <= datetime.combine(fecha_fin, datetime.max.time()))
    q = q.group_by(models.User.id, models.User.nombre_completo)
    rows = q.all()
    return [
        {
            "operador_id": r.operador_id,
            "nombre": r.nombre or f"Usuario #{r.operador_id}",
            "num_ventas": r.num_ventas,
            "total": float(r.total or 0),
        }
        for r in rows
    ]
