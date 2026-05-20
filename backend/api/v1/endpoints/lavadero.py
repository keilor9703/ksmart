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
    """
    Reporte de productividad del lavadero por trabajador.
    Solo incluye ventas con placa_vehiculo registrada (lavadero).
    Ordenadas de mayor a menor ingreso.
    """
    empresa_id = current_user.empresa_id

    q = db.query(
        models.User.id.label("operador_id"),
        models.User.nombre_completo.label("nombre"),
        func.count(models.Venta.id).label("num_lavadas"),
        func.sum(models.Venta.total).label("total_ventas"),
        func.min(models.Venta.fecha).label("primera_lavada"),
        func.max(models.Venta.fecha).label("ultima_lavada"),
    ).join(
        models.Venta, models.Venta.operador_id == models.User.id
    ).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.placa_vehiculo.isnot(None),
    )

    if fecha_inicio:
        q = q.filter(models.Venta.fecha >= datetime.combine(fecha_inicio, datetime.min.time()))
    if fecha_fin:
        q = q.filter(models.Venta.fecha <= datetime.combine(fecha_fin, datetime.max.time()))

    q = q.group_by(models.User.id, models.User.nombre_completo)
    q = q.order_by(func.sum(models.Venta.total).desc())
    rows = q.all()

    total_global  = sum(float(r.total_ventas or 0) for r in rows)
    lavadas_total = sum(r.num_lavadas for r in rows)

    return {
        "trabajadores": [
            {
                "operador_id":    r.operador_id,
                "nombre":         r.nombre or f"Usuario #{r.operador_id}",
                "num_lavadas":    r.num_lavadas,
                "total_ventas":   float(r.total_ventas or 0),
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
        },
    }
