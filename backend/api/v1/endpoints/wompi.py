import os
import hashlib
import time
import logging
import requests as http_requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from sqlalchemy import or_

import models
import schemas
from api.deps import get_db, get_current_user

router = APIRouter()
logger = logging.getLogger("wompi")

WOMPI_PUBLIC_KEY       = os.getenv("WOMPI_PUBLIC_KEY", "")
WOMPI_INTEGRITY_SECRET = os.getenv("WOMPI_INTEGRITY_SECRET", "")
# Llave privada para consultar la API de Wompi (diferente a la pública del widget)
WOMPI_PRIVATE_KEY      = os.getenv("WOMPI_PRIVATE_KEY", "")

WOMPI_API_PROD    = "https://production.wompi.co/v1"
WOMPI_API_SANDBOX = "https://sandbox.wompi.co/v1"


def _wompi_api_url() -> str:
    """Retorna la URL base según el modo (prod vs sandbox)."""
    key = WOMPI_PUBLIC_KEY
    return WOMPI_API_SANDBOX if key.startswith("pub_test") else WOMPI_API_PROD


def _verificar_transaccion_wompi(wompi_id: str) -> dict:
    """
    Consulta la API de Wompi para verificar que la transacción existe y fue aprobada.
    Retorna el objeto 'data' de la transacción o lanza HTTPException.

    Wompi docs: GET /transactions/{id}
    Auth: Bearer {private_key}
    """
    if not WOMPI_PRIVATE_KEY:
        # En desarrollo sin llave privada configurada, loguear advertencia.
        # En producción WOMPI_PRIVATE_KEY DEBE estar configurada.
        logger.warning("WOMPI_PRIVATE_KEY no configurada — saltando verificación con API de Wompi")
        return None

    url = f"{_wompi_api_url()}/transactions/{wompi_id}"
    try:
        resp = http_requests.get(
            url,
            headers={"Authorization": f"Bearer {WOMPI_PRIVATE_KEY}"},
            timeout=10,
        )
    except http_requests.exceptions.Timeout:
        raise HTTPException(status_code=503, detail="Timeout al verificar el pago con Wompi. Intenta de nuevo.")
    except http_requests.exceptions.RequestException as e:
        logger.error(f"Error de red consultando Wompi API: {e}")
        raise HTTPException(status_code=503, detail="No se pudo contactar a Wompi para verificar el pago.")

    if resp.status_code == 404:
        raise HTTPException(status_code=400, detail="La transacción no existe en Wompi.")
    if resp.status_code != 200:
        logger.error(f"Wompi API devolvió {resp.status_code}: {resp.text[:300]}")
        raise HTTPException(status_code=502, detail="Respuesta inesperada de Wompi al verificar el pago.")

    return resp.json().get("data", {})


# ─────────────────────────────────────────────────────────────────────────────

@router.post("/generar-hash")
def generar_hash_wompi(
    request_data: schemas.BoldHashRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not WOMPI_INTEGRITY_SECRET:
        logger.error("WOMPI_INTEGRITY_SECRET no configurada — no se puede generar hash de pago")
        raise HTTPException(status_code=503, detail="Pasarela de pago no configurada. Contacte a soporte.")

    # Un plan exclusivo (empresa_id_exclusivo) es una tarifa negociada para UNA
    # sola empresa: sin este filtro, cualquier tenant que conociera el
    # codigo_interno de otro (p.ej. filtrado antes en /mi-suscripcion) podría
    # comprarlo a su precio negociado.
    plan = db.query(models.PlanSuscripcion).filter(
        models.PlanSuscripcion.codigo_interno == request_data.plan_name,
        models.PlanSuscripcion.is_active == True,
        or_(
            models.PlanSuscripcion.empresa_id_exclusivo.is_(None),
            models.PlanSuscripcion.empresa_id_exclusivo == current_user.empresa_id,
        ),
    ).first()
    if not plan:
        raise HTTPException(status_code=400, detail="El plan no existe.")

    # Código promocional opcional: valida y aplica el descuento al monto firmado.
    from crud import promociones as crud_promo
    precio_final = float(plan.precio or 0)
    descuento    = 0.0
    codigo_obj   = None
    if request_data.codigo_promo:
        codigo_obj, descuento, motivo = crud_promo.validar_codigo(
            db, request_data.codigo_promo, plan, current_user.empresa_id
        )
        if motivo:
            raise HTTPException(status_code=400, detail=motivo)
        precio_final = max(0.0, float(plan.precio or 0) - descuento)

    monto_centavos_int = int(round(precio_final * 100))
    monto_en_centavos = str(monto_centavos_int)
    divisa = "COP"
    timestamp = int(time.time())
    referencia = f"KSMART-{current_user.empresa_id}-{plan.id}-{timestamp}"
    cadena = f"{referencia}{monto_en_centavos}{divisa}{WOMPI_INTEGRITY_SECRET}"
    hash_integridad = hashlib.sha256(cadena.encode("utf-8")).hexdigest()

    # Guarda la intención de pago: la confirmación validará contra este monto
    # (con descuento) sin confiar en datos del cliente.
    try:
        db.add(models.IntentoPagoSuscripcion(
            reference=referencia,
            empresa_id=current_user.empresa_id,
            plan_id=plan.id,
            codigo_promo_id=codigo_obj.id if codigo_obj else None,
            monto_esperado_centavos=monto_centavos_int,
            descuento_aplicado=descuento,
        ))
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning("No se pudo registrar la intención de pago: %s", exc)

    return {
        "reference":       referencia,
        "amount_in_cents": monto_en_centavos,
        "currency":        divisa,
        "signature":       hash_integridad,
        "public_key":      WOMPI_PUBLIC_KEY,
    }


class ConfirmarPagoWidgetRequest(BaseModel):
    wompi_id: str   # Único campo que aceptamos del frontend


@router.post("/confirmar-pago-widget")
def confirmar_pago_widget(
    payload: ConfirmarPagoWidgetRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Activa la suscripción tras pago con el widget de Wompi.

    Seguridad:
    - Solo recibe el wompi_id del frontend (superficie mínima de confianza).
    - Verifica la transacción directamente con la API de Wompi usando la
      llave privada del servidor. Ningún dato sensible viene del cliente.
    - Valida que la transacción esté APPROVED y que la referencia pertenezca
      a la empresa autenticada (JWT), evitando que un usuario active la
      cuenta de otro con un ID de transacción ajeno.
    - Idempotente: si el webhook ya procesó el mismo wompi_id, retorna OK.
    """
    wompi_id = payload.wompi_id.strip()

    # 1. Idempotencia: ya fue procesado por webhook o llamada anterior
    existing = db.query(models.RegistroPago).filter(
        models.RegistroPago.bold_tx_id == wompi_id,
    ).first()
    if existing:
        logger.info(f"confirmar-pago-widget: {wompi_id} ya procesado — idempotente OK")
        return {"status": "ok", "mensaje": "Suscripción ya activa."}

    # 2. Verificar la transacción directamente con Wompi
    tx = _verificar_transaccion_wompi(wompi_id)

    if tx is not None:
        # 2a. La transacción debe estar APPROVED
        if tx.get("status") != "APPROVED":
            logger.warning(f"confirmar-pago-widget: {wompi_id} status={tx.get('status')} — rechazado")
            raise HTTPException(
                status_code=400,
                detail=f"El pago no está aprobado (estado: {tx.get('status')}).",
            )

        # 2b. Extraer referencia y monto desde la respuesta de Wompi (no del cliente)
        reference        = tx.get("reference", "")
        amount_from_tx   = tx.get("amount_in_cents", 0)
        currency_from_tx = tx.get("currency", "COP")
        payment_method   = tx.get("payment_method_type")
        customer_email   = tx.get("customer_email")
    else:
        # Sin llave privada (desarrollo local): confiar en los datos del frontend
        # para no bloquear el desarrollo, pero registrar la advertencia
        reference      = ""
        amount_from_tx = 0
        currency_from_tx = "COP"
        payment_method   = None
        customer_email   = None

    # 3. Parsear empresa_id y plan_id desde la referencia de Wompi
    if not reference.startswith("KSMART-"):
        raise HTTPException(status_code=400, detail="Referencia de pago inválida.")

    partes = reference.split("-")
    if len(partes) < 3:
        raise HTTPException(status_code=400, detail="Formato de referencia inválido.")

    try:
        empresa_id_ref = int(partes[1])
        plan_id        = int(partes[2])
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Referencia con IDs no numéricos.")

    # 4. La empresa de la referencia debe coincidir con el JWT del usuario autenticado
    if empresa_id_ref != current_user.empresa_id:
        logger.warning(
            f"confirmar-pago-widget: intento de activar empresa {empresa_id_ref} "
            f"desde token de empresa {current_user.empresa_id} — RECHAZADO"
        )
        raise HTTPException(status_code=403, detail="Esta transacción no pertenece a tu empresa.")

    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id_ref).first()
    plan    = db.query(models.PlanSuscripcion).filter(models.PlanSuscripcion.id == plan_id).first()

    if not empresa or not plan:
        raise HTTPException(status_code=404, detail="Empresa o plan no encontrado.")

    # 4b. Recuperar la intención de pago (monto esperado con descuento + código)
    intento = (
        db.query(models.IntentoPagoSuscripcion)
        .filter(models.IntentoPagoSuscripcion.reference == reference)
        .first()
    )
    descuento_aplicado = float(intento.descuento_aplicado or 0) if intento else 0.0
    codigo_promo_id    = intento.codigo_promo_id if intento else None
    monto_esperado = (
        (intento.monto_esperado_centavos if intento else int(plan.precio * 100))
        if tx is not None else None
    )

    # 5-8: validar monto, activar suscripción, registrar pago, acreditar promo
    # y emitir la factura de la suscripción — misma función que usa el
    # webhook de Wompi, para que ambos canales de confirmación se comporten
    # idénticamente sin importar cuál llegue primero.
    from crud.suscripcion_pagos import activar_suscripcion_pagada
    try:
        resultado = activar_suscripcion_pagada(
            db,
            empresa_id=empresa_id_ref,
            plan_id=plan_id,
            wompi_id=wompi_id,
            amount_in_cents=amount_from_tx,
            currency=currency_from_tx,
            metodo_pago=payment_method,
            email_pagador=customer_email,
            payload_auditoria={"wompi_id": wompi_id, "verificado_api": tx is not None},
            payment_source_id=None,
            monto_esperado_centavos=monto_esperado,
            descuento_aplicado=descuento_aplicado,
            codigo_promo_id=codigo_promo_id,
        )
    except ValueError as e:
        logger.warning(f"confirmar-pago-widget: {e} — RECHAZADO")
        raise HTTPException(status_code=400, detail=str(e))

    if resultado.get("duplicado"):
        logger.info(f"confirmar-pago-widget: {wompi_id} duplicado ignorado")
        return {"status": "ok", "mensaje": "Suscripción ya activa."}

    logger.info(f"✅ Suscripción activada vía widget (verificada con API Wompi): empresa {empresa_id_ref}")

    return {"status": "ok", "mensaje": f"Suscripción activada por {plan.dias_duracion} días."}
