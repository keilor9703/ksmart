from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
from api.deps import get_db, get_current_user

router = APIRouter()


@router.get("/mi-suscripcion")
def get_mi_suscripcion(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    empresa = db.query(models.Empresa).filter(
        models.Empresa.id == current_user.empresa_id
    ).first()

    ahora = datetime.now(timezone.utc)

    # Calcular días restantes y total del período
    dias_restantes = None
    total_dias = None
    if empresa.trial_ends_at:
        ends = empresa.trial_ends_at
        if ends.tzinfo is None:
            ends = ends.replace(tzinfo=timezone.utc)
        delta = (ends - ahora).total_seconds()
        dias_restantes = max(0, int(delta / 86400))
        # Total del período: desde creación hasta vencimiento
        if empresa.created_at:
            start = empresa.created_at
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            total_dias = max(1, (ends - start).days)

    # is_plan_expired (mismo cálculo del schema)
    is_expired = False
    if empresa.trial_ends_at and empresa.id != 1 and not empresa.is_protected:
        ends = empresa.trial_ends_at
        if ends.tzinfo is None:
            ends = ends.replace(tzinfo=timezone.utc)
        is_expired = ahora > ends

    suscripcion = {
        "plan_type":      empresa.plan_type,
        "is_active":      empresa.is_active,
        "is_plan_expired": is_expired,
        "trial_ends_at":  empresa.trial_ends_at.isoformat() if empresa.trial_ends_at else None,
        "dias_restantes": dias_restantes,
        "total_dias":     total_dias,
        "is_protected":   empresa.is_protected,
    }

    # Historial de pagos con datos del plan
    registros = (
        db.query(models.RegistroPago)
        .filter(models.RegistroPago.empresa_id == current_user.empresa_id)
        .order_by(models.RegistroPago.fecha_pago.desc())
        .all()
    )

    historial = []
    for r in registros:
        plan_data = None
        if r.plan:
            plan_data = {
                "id":            r.plan.id,
                "nombre":        r.plan.nombre,
                "precio":        r.plan.precio,
                "dias_duracion": r.plan.dias_duracion,
                "caracteristicas": r.plan.caracteristicas,
            }
        historial.append({
            "id":           r.id,
            "fecha_pago":   r.fecha_pago.isoformat() if r.fecha_pago else None,
            "monto":        r.monto,
            "moneda":       r.moneda or "COP",
            "metodo_pago":  r.metodo_pago,
            "wompi_tx_id":  r.bold_tx_id,
            "email_pagador": r.email_pagador,
            "plan":         plan_data,
        })

    # Planes disponibles para renovación
    planes = db.query(models.PlanSuscripcion).filter(
        models.PlanSuscripcion.is_active == True
    ).all()

    planes_disponibles = [
        {
            "id":              p.id,
            "nombre":          p.nombre,
            "codigo_interno":  p.codigo_interno,
            "precio":          p.precio,
            "dias_duracion":   p.dias_duracion,
            "caracteristicas": p.caracteristicas,
        }
        for p in planes
    ]

    return {
        "suscripcion":       suscripcion,
        "historial_pagos":   historial,
        "planes_disponibles": planes_disponibles,
    }
