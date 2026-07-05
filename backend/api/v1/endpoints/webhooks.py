import hashlib
import logging
import os
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

import models
from api.deps import get_db
from core.limiter import limiter

router = APIRouter()
logger = logging.getLogger("webhooks")

WOMPI_EVENTS_SECRET = os.getenv("WOMPI_EVENTS_SECRET", "")


def _verify_wompi_signature(payload: dict, checksum_header: str | None) -> bool:
    """Verify Wompi webhook signature.

    Wompi formula: SHA256(prop_values... + timestamp + events_secret)
    Order verified empirically: timestamp comes BEFORE the secret.
    Properties come from payload["signature"]["properties"] (e.g. ["transaction.id",
    "transaction.status", "transaction.amount_in_cents"]), NOT hardcoded.
    Timestamp comes from payload["timestamp"].
    """
    if not WOMPI_EVENTS_SECRET:
        logger.error("WOMPI_EVENTS_SECRET no configurada — rechazando webhook por seguridad")
        return False
    if not checksum_header:
        return False

    signature_info = payload.get("signature", {})
    properties = signature_info.get("properties", [])
    timestamp = payload.get("timestamp", "")
    tx = payload.get("data", {}).get("transaction", {})

    parts = []
    for prop in properties:
        # "transaction.id" → tx["id"], "transaction.status" → tx["status"], etc.
        key = prop.split(".", 1)[-1]
        parts.append(str(tx.get(key, "")))
    # Wompi formula: prop_values... + timestamp + events_secret (timestamp va ANTES del secreto)
    parts.append(str(timestamp))
    parts.append(WOMPI_EVENTS_SECRET)

    expected = hashlib.sha256("".join(parts).encode("utf-8")).hexdigest()
    return expected == checksum_header


@router.post("/wompi")
@limiter.limit("30/minute")
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

            # Recuperar la intención de pago (monto esperado con descuento +
            # código promocional) para que el webhook active EXACTAMENTE
            # igual que la confirmación del widget — antes el webhook no
            # conocía el código promo aplicado ni desactivaba FE al bajar de
            # plan, así que cuál de los dos canales llegaba primero cambiaba
            # el resultado de la misma compra.
            intento = (
                db.query(models.IntentoPagoSuscripcion)
                .filter(models.IntentoPagoSuscripcion.reference == reference)
                .first()
            )
            descuento_aplicado = float(intento.descuento_aplicado or 0) if intento else 0.0
            codigo_promo_id = intento.codigo_promo_id if intento else None
            monto_esperado = intento.monto_esperado_centavos if intento else None

            from crud.suscripcion_pagos import activar_suscripcion_pagada
            try:
                resultado = activar_suscripcion_pagada(
                    db,
                    empresa_id=empresa_id,
                    plan_id=plan_id,
                    wompi_id=wompi_id,
                    amount_in_cents=data.get("amount_in_cents") or 0,
                    currency=data.get("currency"),
                    metodo_pago=data.get("payment_method_type"),
                    email_pagador=data.get("customer_email"),
                    payload_auditoria=payload,
                    payment_source_id=data.get("payment_source_id"),
                    monto_esperado_centavos=monto_esperado,
                    descuento_aplicado=descuento_aplicado,
                    codigo_promo_id=codigo_promo_id,
                )
                if resultado.get("duplicado"):
                    logger.info(f"⚠️ Webhook ignorado: pago {wompi_id} ya procesado.")
                else:
                    logger.info(f"✅ Suscripción Wompi activada para empresa {empresa_id}")
            except ValueError as e:
                logger.error(f"⚠️ Webhook Wompi rechazado para empresa {empresa_id}: {e}")

    return {"status": "ok"}
