import os
import hashlib
import time
import logging
import requests as http_requests
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from typing import Optional

import models
import schemas
from api.deps import get_db, get_current_user
from services import matias_service as _ms

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

    plan = db.query(models.PlanSuscripcion).filter(
        models.PlanSuscripcion.codigo_interno == request_data.plan_name,
        models.PlanSuscripcion.is_active == True,
    ).first()
    if not plan:
        raise HTTPException(status_code=400, detail="El plan no existe.")

    monto_en_centavos = str(int(plan.precio * 100))
    divisa = "COP"
    timestamp = int(time.time())
    referencia = f"KSMART-{current_user.empresa_id}-{plan.id}-{timestamp}"
    cadena = f"{referencia}{monto_en_centavos}{divisa}{WOMPI_INTEGRITY_SECRET}"
    hash_integridad = hashlib.sha256(cadena.encode("utf-8")).hexdigest()

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

    # 5. Validar que el monto pagado corresponde al plan (contra manipulación de precios)
    if tx is not None:
        monto_esperado = int(plan.precio * 100)
        if amount_from_tx < monto_esperado:
            logger.warning(
                f"confirmar-pago-widget: monto pagado {amount_from_tx} < esperado {monto_esperado} "
                f"para plan {plan.codigo_interno} — RECHAZADO"
            )
            raise HTTPException(
                status_code=400,
                detail="El monto pagado no corresponde al plan seleccionado.",
            )

    # 6. Activar suscripción
    empresa.is_active  = True
    empresa.plan_type  = "premium"
    ahora = datetime.now(timezone.utc)
    base  = empresa.trial_ends_at if empresa.trial_ends_at and empresa.trial_ends_at > ahora else ahora
    empresa.trial_ends_at = base + timedelta(days=plan.dias_duracion)

    nuevo_pago = models.RegistroPago(
        empresa_id   = empresa_id_ref,
        plan_id      = plan_id,
        monto        = amount_from_tx / 100 if amount_from_tx else plan.precio,
        moneda       = currency_from_tx,
        metodo_pago  = payment_method,
        bold_tx_id   = wompi_id,
        email_pagador= customer_email,
        payload_auditoria = {"wompi_id": wompi_id, "verificado_api": tx is not None},
    )
    db.add(nuevo_pago)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        logger.info(f"confirmar-pago-widget: {wompi_id} duplicado ignorado (unique constraint)")
        return {"status": "ok", "mensaje": "Suscripción ya activa."}

    logger.info(f"✅ Suscripción activada vía widget (verificada con API Wompi): empresa {empresa_id_ref}")

    # ── Facturación electrónica de la suscripción ────────────────────────────
    # El dueño del sistema (PlataformaConfig) emite la FE al cliente que pagó,
    # usando sus propias credenciales Matías. Independiente de las empresas clientes.
    try:
        plataforma = db.query(models.PlataformaConfig).filter_by(id=1).first()
        if (
            plataforma
            and plataforma.facturacion_electronica_activa
            and (plataforma.matias_api_key or plataforma.matias_sandbox_api_key)
            and plataforma.resolucion_numero
        ):
            test_mode = plataforma.matias_test_mode if plataforma.matias_test_mode is not None else True
            api_key   = plataforma.matias_sandbox_api_key if test_mode else plataforma.matias_api_key
            if api_key:
                resultado = _ms.emitir_factura_suscripcion(
                    registro_pago   = nuevo_pago,
                    empresa_cliente = empresa,
                    plan            = plan,
                    plataforma      = plataforma,
                    api_key         = api_key,
                    test_mode       = test_mode,
                )
                nuevo_pago.estado_fe             = resultado["estado"]
                nuevo_pago.cufe_fe               = resultado.get("cufe_fe")
                nuevo_pago.pdf_url_fe            = resultado.get("pdf_url_fe")
                nuevo_pago.numero_factura_ksmart = resultado.get("numero_factura")
                if resultado["estado"] == "exitoso":
                    plataforma.resolucion_numero_actual = (plataforma.resolucion_numero_actual or 0) + 1
                db.commit()
                logger.info("FE suscripción empresa %s: %s", empresa_id_ref, resultado["estado"])
    except Exception as _fe_exc:
        logger.error("Error emitiendo FE de suscripción empresa %s: %s", empresa_id_ref, _fe_exc)

    return {"status": "ok", "mensaje": f"Suscripción activada por {plan.dias_duracion} días."}
