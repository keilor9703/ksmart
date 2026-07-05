"""
Activación de suscripción tras un pago aprobado (Wompi).

Único punto de verdad para lo que debe pasar cuando un pago se confirma,
sin importar si llegó por el webhook de Wompi o por la confirmación del
widget en el navegador del usuario — antes cada endpoint reimplementaba
esta lógica y habían divergido: el webhook no desactivaba FE al bajar de
plan, no emitía la factura de la suscripción, y no acreditaba el código
promocional usado. Como cuál de los dos "gana" la carrera es no
determinístico (depende de la red), el comportamiento resultante era
distinto según qué llegara primero — ahora ambos llaman a esta función.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models

logger = logging.getLogger("suscripcion_pagos")


def activar_suscripcion_pagada(
    db: Session,
    empresa_id: int,
    plan_id: int,
    wompi_id: str,
    amount_in_cents: int,
    currency: str,
    metodo_pago: Optional[str],
    email_pagador: Optional[str],
    payload_auditoria: dict,
    payment_source_id: Optional[str] = None,
    monto_esperado_centavos: Optional[int] = None,
    descuento_aplicado: float = 0.0,
    codigo_promo_id: Optional[int] = None,
) -> dict:
    """
    Activa la suscripción, registra el pago, desactiva FE si el nuevo plan no
    la incluye, acredita el código promocional y emite la factura de la
    suscripción. Idempotente por `bold_tx_id` (constraint único): si ya fue
    procesado por el otro canal, retorna sin duplicar nada.
    """
    # Idempotencia explícita además del unique constraint: evita el
    # IntegrityError (y su log ruidoso) en el camino feliz de "ya procesado".
    existing = db.query(models.RegistroPago).filter(
        models.RegistroPago.bold_tx_id == wompi_id
    ).first()
    if existing:
        return {"status": "ok", "mensaje": "Suscripción ya activa.", "duplicado": True}

    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    plan = db.query(models.PlanSuscripcion).filter(models.PlanSuscripcion.id == plan_id).first()
    if not empresa or not plan:
        raise ValueError(f"Empresa {empresa_id} o plan {plan_id} no encontrado.")

    if monto_esperado_centavos is not None and amount_in_cents < monto_esperado_centavos:
        raise ValueError(
            f"El monto pagado ({amount_in_cents}) no corresponde al plan/promo "
            f"esperado ({monto_esperado_centavos})."
        )

    empresa.is_active = True
    empresa.plan_type = "premium"
    if payment_source_id:
        empresa.wompi_payment_source_id = str(payment_source_id)

    ahora = datetime.now(timezone.utc)
    vence_actual = empresa.trial_ends_at
    if vence_actual and vence_actual.tzinfo is None:
        vence_actual = vence_actual.replace(tzinfo=timezone.utc)  # SQLite no conserva tzinfo
    base = vence_actual if vence_actual and vence_actual > ahora else ahora
    empresa.trial_ends_at = base + timedelta(days=plan.dias_duracion)

    if getattr(plan, "incluye_fe", True) is False:
        empresa.facturacion_electronica_activa = False
        logger.info(
            "Plan %s no incluye FE — facturacion_electronica_activa desactivada (empresa %s)",
            plan.codigo_interno, empresa_id,
        )

    nuevo_pago = models.RegistroPago(
        empresa_id=empresa_id,
        plan_id=plan_id,
        monto=amount_in_cents / 100 if amount_in_cents else plan.precio,
        moneda=currency or "COP",
        metodo_pago=metodo_pago,
        bold_tx_id=wompi_id,
        email_pagador=email_pagador,
        codigo_promo_id=codigo_promo_id,
        descuento_aplicado=descuento_aplicado,
        payload_auditoria=payload_auditoria,
    )
    db.add(nuevo_pago)

    if codigo_promo_id:
        cod = db.query(models.CodigoPromocional).filter(
            models.CodigoPromocional.id == codigo_promo_id
        ).first()
        if cod:
            cod.usos_actuales = (cod.usos_actuales or 0) + 1

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        logger.info("activar_suscripcion_pagada: %s duplicado ignorado (unique constraint)", wompi_id)
        return {"status": "ok", "mensaje": "Suscripción ya activa.", "duplicado": True}

    logger.info("Suscripción activada: empresa %s, plan %s, tx %s", empresa_id, plan.codigo_interno, wompi_id)

    _emitir_fe_suscripcion(db, nuevo_pago, empresa, plan)

    return {"status": "ok", "mensaje": "Suscripción activada.", "duplicado": False, "registro_pago_id": nuevo_pago.id}


def _emitir_fe_suscripcion(db: Session, registro_pago, empresa, plan) -> None:
    """Emite la factura electrónica de la suscripción a nombre del dueño del
    SaaS (Ksmart360), usando la configuración de PlataformaConfig. Nunca
    lanza: un fallo aquí no debe revertir la suscripción ya activada."""
    try:
        from services import matias_service as _ms
        plataforma = db.query(models.PlataformaConfig).filter_by(id=1).first()
        if not (
            plataforma
            and plataforma.facturacion_electronica_activa
            and (plataforma.matias_api_key or plataforma.matias_sandbox_api_key)
            and plataforma.resolucion_numero
        ):
            return
        test_mode = plataforma.matias_test_mode if plataforma.matias_test_mode is not None else True
        api_key = plataforma.matias_sandbox_api_key if test_mode else plataforma.matias_api_key
        if not api_key:
            return

        resultado = _ms.emitir_factura_suscripcion(
            registro_pago=registro_pago,
            empresa_cliente=empresa,
            plan=plan,
            plataforma=plataforma,
            api_key=api_key,
            test_mode=test_mode,
        )
        registro_pago.estado_fe = resultado["estado"]
        registro_pago.cufe_fe = resultado.get("cufe_fe")
        registro_pago.pdf_url_fe = resultado.get("pdf_url_fe")
        registro_pago.numero_factura_ksmart = resultado.get("numero_factura")
        if resultado["estado"] == "exitoso":
            plataforma.resolucion_numero_actual = (plataforma.resolucion_numero_actual or 0) + 1
        db.commit()
        logger.info("FE suscripción empresa %s: %s", empresa.id, resultado["estado"])
    except Exception:
        logger.exception("Error emitiendo FE de suscripción empresa %s", getattr(empresa, "id", "?"))
