import os
import hashlib
import time
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

import models
import schemas
from api.deps import get_db, get_current_user

router = APIRouter()
logger = logging.getLogger("wompi")

WOMPI_PUBLIC_KEY = os.getenv("WOMPI_PUBLIC_KEY", "pub_test_...")
WOMPI_INTEGRITY_SECRET = os.getenv("WOMPI_INTEGRITY_SECRET", "prod_integrity_...")

@router.post("/generar-hash")
def generar_hash_wompi(
    request_data: schemas.BoldHashRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    plan = db.query(models.PlanSuscripcion).filter(
        models.PlanSuscripcion.codigo_interno == request_data.plan_name,
        models.PlanSuscripcion.is_active == True
    ).first()
    if not plan:
        raise HTTPException(status_code=400, detail="El plan no existe.")

    monto_en_centavos = str(int(plan.precio * 100))
    divisa = "COP"
    timestamp = int(time.time())
    referencia = f"KSMART-{current_user.empresa_id}-{plan.id}-{timestamp}"
    cadena_concatenada = f"{referencia}{monto_en_centavos}{divisa}{WOMPI_INTEGRITY_SECRET}"
    hash_integridad = hashlib.sha256(cadena_concatenada.encode('utf-8')).hexdigest()

    return {
        "reference": referencia,
        "amount_in_cents": monto_en_centavos,
        "currency": divisa,
        "signature": hash_integridad,
        "public_key": WOMPI_PUBLIC_KEY
    }


class ConfirmarPagoWidgetRequest(BaseModel):
    wompi_id: str
    reference: str
    amount_in_cents: int
    currency: str
    payment_method_type: Optional[str] = None
    customer_email: Optional[str] = None


@router.post("/confirmar-pago-widget")
def confirmar_pago_widget(
    payload: ConfirmarPagoWidgetRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Activa la suscripción inmediatamente tras el pago con el widget de Wompi.

    El cliente llama este endpoint desde el callback JS del widget (status=APPROVED)
    en lugar de esperar el webhook asíncrono, eliminando la condición de carrera
    que dejaba al usuario en la pantalla de suscripción expirada.

    Es idempotente: si el webhook ya procesó el mismo wompi_id, retorna OK sin duplicar.
    """
    # Idempotencia: si ya fue procesado (por webhook o llamada anterior), retornar OK
    existing = db.query(models.RegistroPago).filter(
        models.RegistroPago.bold_tx_id == payload.wompi_id
    ).first()
    if existing:
        logger.info(f"confirmar-pago-widget: pago {payload.wompi_id} ya procesado — OK idempotente")
        return {"status": "ok", "mensaje": "Suscripción ya activa."}

    # Validar que la referencia pertenece a esta empresa
    if not payload.reference.startswith("KSMART-"):
        raise HTTPException(status_code=400, detail="Referencia de pago inválida.")

    partes = payload.reference.split("-")
    if len(partes) < 3:
        raise HTTPException(status_code=400, detail="Formato de referencia inválido.")

    try:
        empresa_id_ref = int(partes[1])
        plan_id = int(partes[2])
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Referencia con IDs no numéricos.")

    # Seguridad: la empresa de la referencia debe coincidir con la del token JWT
    if empresa_id_ref != current_user.empresa_id:
        logger.warning(
            f"confirmar-pago-widget: empresa_id del token ({current_user.empresa_id}) "
            f"no coincide con el de la referencia ({empresa_id_ref})"
        )
        raise HTTPException(status_code=403, detail="La referencia no pertenece a tu empresa.")

    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id_ref).first()
    plan = db.query(models.PlanSuscripcion).filter(models.PlanSuscripcion.id == plan_id).first()

    if not empresa or not plan:
        raise HTTPException(status_code=404, detail="Empresa o plan no encontrado.")

    # Activar suscripción
    empresa.is_active = True
    empresa.plan_type = "premium"

    ahora = datetime.now(timezone.utc)
    base = empresa.trial_ends_at if empresa.trial_ends_at and empresa.trial_ends_at > ahora else ahora
    empresa.trial_ends_at = base + timedelta(days=plan.dias_duracion)

    nuevo_pago = models.RegistroPago(
        empresa_id=empresa_id_ref,
        plan_id=plan_id,
        monto=payload.amount_in_cents / 100,
        moneda=payload.currency,
        metodo_pago=payload.payment_method_type,
        bold_tx_id=payload.wompi_id,
        email_pagador=payload.customer_email,
        payload_auditoria=payload.model_dump(),
    )
    db.add(nuevo_pago)
    db.commit()

    logger.info(f"✅ Suscripción activada vía widget: empresa {empresa_id_ref}, plan {plan_id}")
    return {"status": "ok", "mensaje": f"Suscripción activada por {plan.dias_duracion} días."}
