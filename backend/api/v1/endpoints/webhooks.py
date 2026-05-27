import hashlib
import logging
import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

import models
from api.deps import get_db

router = APIRouter()
logger = logging.getLogger("webhooks")

WOMPI_EVENTS_SECRET = os.getenv("WOMPI_EVENTS_SECRET", "")


def _verify_wompi_signature(payload: dict, checksum_header: str | None) -> bool:
    """Verify Wompi webhook signature.

    Wompi computes: SHA256(tx.id + tx.status + tx.amount_in_cents + tx.currency + events_secret)
    and sends it in the x-event-checksum header.
    """
    if not WOMPI_EVENTS_SECRET:
        logger.warning("WOMPI_EVENTS_SECRET no configurada — omitiendo verificación de firma")
        return True
    if not checksum_header:
        return False
    tx = payload.get("data", {}).get("transaction", {})
    props = (
        str(tx.get("id", ""))
        + str(tx.get("status", ""))
        + str(tx.get("amount_in_cents", ""))
        + str(tx.get("currency", ""))
        + WOMPI_EVENTS_SECRET
    )
    expected = hashlib.sha256(props.encode("utf-8")).hexdigest()
    return expected == checksum_header


@router.post("/wompi")
async def webhook_wompi(request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
    except Exception:
        logger.error("⚠️ Webhook Wompi: Se recibió un body vacío o JSON inválido.")
        return {"status": "error", "message": "Invalid JSON or empty body"}

    checksum = request.headers.get("x-event-checksum")
    if not _verify_wompi_signature(payload, checksum):
        logger.warning("⛔ Webhook Wompi rechazado: firma inválida")
        raise HTTPException(status_code=401, detail="Firma inválida")

    event = payload.get("event")
    data = payload.get("data", {}).get("transaction", {})

    if event == "transaction.updated" and data.get("status") == "APPROVED":
        reference = data.get("reference", "")
        if reference.startswith("KSMART-"):
            partes = reference.split("-")
            empresa_id = int(partes[1])
            plan_id = int(partes[2])
            wompi_id = data.get("id")

            # ✅ IDEMPOTENCIA: Verificar si ya procesamos este ID de transacción
            existing_pago = db.query(models.RegistroPago).filter(
                models.RegistroPago.bold_tx_id == wompi_id
            ).first()
            if existing_pago:
                logger.info(f"⚠️ Webhook ignorado: Pago {wompi_id} ya procesado.")
                return {"status": "ok", "message": "Ya procesado"}

            empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
            plan = db.query(models.PlanSuscripcion).filter(models.PlanSuscripcion.id == plan_id).first()

            if empresa and plan:
                empresa.is_active = True
                empresa.plan_type = "premium"

                payment_source = data.get("payment_source_id")
                if payment_source:
                    empresa.wompi_payment_source_id = str(payment_source)

                ahora = datetime.now(timezone.utc)
                base = empresa.trial_ends_at if empresa.trial_ends_at and empresa.trial_ends_at > ahora else ahora
                empresa.trial_ends_at = base + timedelta(days=plan.dias_duracion)

                nuevo_pago = models.RegistroPago(
                    empresa_id=empresa_id,
                    plan_id=plan_id,
                    monto=data.get("amount_in_cents") / 100,
                    moneda=data.get("currency"),
                    metodo_pago=data.get("payment_method_type"),
                    bold_tx_id=data.get("id"),
                    email_pagador=data.get("customer_email"),
                    payload_auditoria=payload
                )
                db.add(nuevo_pago)
                db.commit()
                logger.info(f"✅ Suscripción Wompi activada para empresa {empresa_id}")

    return {"status": "ok"}
