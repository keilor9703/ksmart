"""
Servicio de integración con WhatsApp Business Platform (Meta Cloud API) —
notificaciones automáticas a las empresas cuando reciben un pedido desde el
Catálogo Virtual / Centro Comercial Virtual.

Distinto del flujo `wa.me` ya existente (crud.pedidos_virtuales.build_whatsapp_url):
ese requiere que un humano abra el link y le dé "Enviar" — este envía el
mensaje solo, sin intervención, usando UN número propio de Ksmart360 (no el
de cada empresa) vía la API oficial de Meta.

Fuera de la ventana de 24h de conversación (que nunca se abre aquí, porque la
empresa no le escribe primero a este número), Meta solo permite enviar
mensajes de PLANTILLA previamente aprobados — no texto libre. Por eso se usa
`type: template`, no `type: text`.

Configuración vía variables de entorno (ninguna es obligatoria: si faltan,
el envío se omite silenciosamente — un pedido nunca debe fallar por esto):
  WHATSAPP_ACCESS_TOKEN     Token permanente (usuario del sistema) del WABA.
  WHATSAPP_PHONE_NUMBER_ID  ID del número remitente (el de Ksmart360), NO el
                            número en sí.
  WHATSAPP_TEMPLATE_NAME    Nombre de la plantilla aprobada (default: ver abajo).
  WHATSAPP_TEMPLATE_LANG    Código de idioma de la plantilla (default: "es").
  WHATSAPP_API_VERSION      Versión de la Graph API (default: "v21.0").
"""

import logging
import os
import re
from typing import Optional

import httpx

logger = logging.getLogger("whatsapp_business")

ACCESS_TOKEN    = os.getenv("WHATSAPP_ACCESS_TOKEN")
PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
TEMPLATE_NAME   = os.getenv("WHATSAPP_TEMPLATE_NAME", "nuevo_pedido_virtual")
TEMPLATE_LANG   = os.getenv("WHATSAPP_TEMPLATE_LANG", "es")
API_VERSION     = os.getenv("WHATSAPP_API_VERSION", "v21.0")

HTTP_TIMEOUT = 15


def is_configured() -> bool:
    return bool(ACCESS_TOKEN and PHONE_NUMBER_ID)


def _normalizar_telefono_co(telefono: str) -> Optional[str]:
    """Convierte un teléfono colombiano a E.164 sin '+' (formato que exige la
    Graph API en el campo `to`). Ver crud.parqueadero.metodos_pago para el
    mismo criterio aplicado al link wa.me manual."""
    if not telefono:
        return None
    solo_digitos = re.sub(r"\D", "", telefono)
    if not solo_digitos:
        return None
    if solo_digitos.startswith("57") and len(solo_digitos) == 12:
        return solo_digitos
    if len(solo_digitos) == 10 and solo_digitos.startswith("3"):
        return "57" + solo_digitos
    if len(solo_digitos) >= 11:
        return solo_digitos
    return None


def enviar_notificacion_nuevo_pedido(
    telefono_empresa: str,
    numero_pedido: int,
    nombre_cliente: str,
    total_formateado: str,
    detalle_entrega: str,
) -> bool:
    """Envía la plantilla `nuevo_pedido_virtual` (o la configurada) al
    WhatsApp de la empresa. Best-effort: cualquier fallo (token vencido,
    plantilla no aprobada aún, número inválido, WhatsApp Cloud caído) se
    registra en logs y devuelve False — NUNCA debe interrumpir la creación
    del pedido, que ya quedó guardada en el sistema de todas formas.
    """
    if not is_configured():
        logger.info("WhatsApp Business no configurado (faltan credenciales) — se omite notificación.")
        return False

    destino = _normalizar_telefono_co(telefono_empresa)
    if not destino:
        logger.warning("Teléfono de empresa inválido para notificar por WhatsApp: %r", telefono_empresa)
        return False

    url = f"https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": destino,
        "type": "template",
        "template": {
            "name": TEMPLATE_NAME,
            "language": {"code": TEMPLATE_LANG},
            "components": [{
                "type": "body",
                "parameters": [
                    {"type": "text", "text": str(numero_pedido)},
                    {"type": "text", "text": nombre_cliente},
                    {"type": "text", "text": total_formateado},
                    {"type": "text", "text": detalle_entrega},
                ],
            }],
        },
    }
    try:
        resp = httpx.post(
            url, json=payload, timeout=HTTP_TIMEOUT,
            headers={"Authorization": f"Bearer {ACCESS_TOKEN}", "Content-Type": "application/json"},
        )
        if resp.status_code >= 400:
            logger.warning("WhatsApp API respondió %s al notificar pedido #%s: %s", resp.status_code, numero_pedido, resp.text)
            return False
        return True
    except Exception:
        logger.exception("Error de red notificando pedido #%s por WhatsApp", numero_pedido)
        return False
