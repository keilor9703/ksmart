from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_

import models
from api.deps import get_db, get_current_user
from crud.ventas import _docs_electronicos_mes_actual, _max_docs_mes_plan

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

    # Uso de Facturación Electrónica del mes vigente vs el límite del plan.
    # FE es el diferenciador pagado del sistema — sin esto, el cliente solo
    # se entera de su límite cuando una venta se lo bloquea en otro módulo.
    docs_usados = _docs_electronicos_mes_actual(db, empresa.id) if empresa.facturacion_electronica_activa else 0
    docs_limite = _max_docs_mes_plan(db, empresa.id) if empresa.facturacion_electronica_activa else None

    suscripcion = {
        "plan_type":      empresa.plan_type,
        "is_active":      empresa.is_active,
        "is_plan_expired": is_expired,
        "trial_ends_at":  empresa.trial_ends_at.isoformat() if empresa.trial_ends_at else None,
        "dias_restantes": dias_restantes,
        "total_dias":     total_dias,
        "is_protected":   empresa.is_protected,
        "facturacion_electronica_activa": empresa.facturacion_electronica_activa,
        "docs_electronicos_usados": docs_usados,
        "docs_electronicos_limite": docs_limite,  # None = sin límite (plan superior)
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
                "incluye_fe":    getattr(r.plan, "incluye_fe", True) if getattr(r.plan, "incluye_fe", None) is not None else True,
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
            "numero_factura_ksmart": r.numero_factura_ksmart,
            "estado_fe":    r.estado_fe,
            "pdf_url_fe":   r.pdf_url_fe,
        })

    # Planes disponibles para renovación: públicos (empresa_id_exclusivo NULL)
    # o negociados exclusivamente para ESTA empresa. Sin este filtro, cada
    # empresa veía (y podía comprar) las tarifas privadas de las demás.
    planes = db.query(models.PlanSuscripcion).filter(
        models.PlanSuscripcion.is_active == True,
        or_(
            models.PlanSuscripcion.empresa_id_exclusivo.is_(None),
            models.PlanSuscripcion.empresa_id_exclusivo == empresa.id,
        ),
    ).all()

    planes_disponibles = [
        {
            "id":              p.id,
            "nombre":          p.nombre,
            "codigo_interno":  p.codigo_interno,
            "precio":          p.precio,
            "dias_duracion":   p.dias_duracion,
            "caracteristicas": p.caracteristicas,
            "incluye_fe":      getattr(p, "incluye_fe", True) if getattr(p, "incluye_fe", None) is not None else True,
            "max_documentos_mes": p.max_documentos_mes,
        }
        for p in planes
    ]

    # Plan actual: el de la compra más reciente (el pago ya está ordenado
    # desc). Nota: si la empresa está en trial o su plan fue activado
    # manualmente por un superadmin sin pago registrado, no hay forma de
    # saber a qué PlanSuscripcion corresponde (Empresa.plan_type es solo un
    # estado 'trial'/'premium'/'vitalicio', no una referencia a un plan
    # específico) — en ese caso queda None y el frontend muestra el estado
    # genérico en vez de inventar un nombre de plan.
    plan_actual = historial[0]["plan"] if historial else None

    return {
        "suscripcion":       suscripcion,
        "plan_actual":       plan_actual,
        "historial_pagos":   historial,
        "planes_disponibles": planes_disponibles,
    }
