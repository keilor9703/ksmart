"""
Servicio de integración con Evolution API (WhatsApp no oficial, autohospedado).

Permite que cada empresa conecte SU propio número de WhatsApp desde Ksmart360
—escaneando un QR— sin conocer ni manipular la infraestructura de Evolution.
La clave maestra vive solo aquí, en el servidor: el navegador del cliente
nunca la ve.

Cada empresa tiene una "instancia" en Evolution, nombrada de forma
determinística (`ksmart-<empresa_id>`), que es la que n8n usa para saber de
qué negocio viene cada mensaje.

Configuración por variables de entorno:
  EVOLUTION_API_URL   Ej: https://evo.ksmart360.com
  EVOLUTION_API_KEY   La AUTHENTICATION_API_KEY del servidor de Evolution.
  EVOLUTION_WEBHOOK_URL  URL del webhook de n8n que recibe los mensajes.

Si no están configuradas, el módulo responde "no disponible" en vez de fallar.
"""

import logging
import os
from typing import Optional

import requests as http_requests

logger = logging.getLogger("evolution")

EVOLUTION_API_URL     = (os.getenv("EVOLUTION_API_URL", "") or "").rstrip("/")
EVOLUTION_API_KEY     = os.getenv("EVOLUTION_API_KEY", "")
EVOLUTION_WEBHOOK_URL = os.getenv("EVOLUTION_WEBHOOK_URL", "")

TIMEOUT = 20


def is_configured() -> bool:
    """True si el servidor tiene Evolution configurado."""
    return bool(EVOLUTION_API_URL and EVOLUTION_API_KEY)


def nombre_instancia(empresa_id: int) -> str:
    """Nombre determinístico de la instancia de una empresa."""
    return f"ksmart-{empresa_id}"


def _headers() -> dict:
    return {"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"}


def _request(metodo: str, ruta: str, payload: Optional[dict] = None) -> dict:
    """Llama a Evolution y normaliza los errores de red a un dict con 'error'."""
    url = f"{EVOLUTION_API_URL}{ruta}"
    try:
        resp = http_requests.request(
            metodo, url, headers=_headers(), json=payload, timeout=TIMEOUT
        )
    except http_requests.exceptions.Timeout:
        logger.warning("Evolution timeout en %s %s", metodo, ruta)
        return {"error": "El servicio de WhatsApp no respondió a tiempo."}
    except http_requests.exceptions.RequestException as e:
        logger.error("Evolution error de red en %s %s: %s", metodo, ruta, e)
        return {"error": "No se pudo contactar el servicio de WhatsApp."}

    try:
        data = resp.json()
    except ValueError:
        data = {}

    if resp.status_code >= 400:
        # 404 al consultar estado = la instancia no existe todavía (normal)
        logger.info("Evolution %s en %s %s: %s", resp.status_code, metodo, ruta, str(data)[:200])
        return {"error": data.get("message") or data.get("error") or f"HTTP {resp.status_code}",
                "status_code": resp.status_code}

    return data if isinstance(data, dict) else {"data": data}


# ─── Operaciones ──────────────────────────────────────────────────────────────

def crear_instancia(empresa_id: int) -> dict:
    """
    Crea la instancia de la empresa y devuelve el QR para vincular.
    Si ya existe, Evolution responde error y se reintenta pidiendo el QR.
    """
    instancia = nombre_instancia(empresa_id)
    payload = {
        "instanceName": instancia,
        "qrcode": True,
        "integration": "WHATSAPP-BAILEYS",
    }
    if EVOLUTION_WEBHOOK_URL:
        payload["webhook"] = {
            "enabled": True,
            "url": EVOLUTION_WEBHOOK_URL,
            "byEvents": False,
            "base64": False,
            "events": ["MESSAGES_UPSERT"],
        }
    return _request("POST", "/instance/create", payload)


def obtener_qr(empresa_id: int) -> dict:
    """Pide un QR nuevo para una instancia que ya existe."""
    return _request("GET", f"/instance/connect/{nombre_instancia(empresa_id)}")


def configurar_webhook(empresa_id: int) -> dict:
    """
    (Re)aplica el webhook a la instancia.

    Se llama SIEMPRE al conectar, no solo al crear: una instancia creada antes
    de configurar EVOLUTION_WEBHOOK_URL —o creada cuando la URL era otra— se
    quedaba sin webhook y los mensajes del cliente no llegaban a ninguna parte,
    sin ningún error visible.
    """
    if not EVOLUTION_WEBHOOK_URL:
        return {"error": "EVOLUTION_WEBHOOK_URL no configurada"}
    return _request(
        "POST",
        f"/webhook/set/{nombre_instancia(empresa_id)}",
        {
            "webhook": {
                "enabled": True,
                "url": EVOLUTION_WEBHOOK_URL,
                "byEvents": False,
                "base64": False,
                "events": ["MESSAGES_UPSERT"],
            }
        },
    )


def estado_conexion(empresa_id: int) -> dict:
    """Estado de la sesión: 'open' (conectada), 'connecting', 'close'."""
    return _request("GET", f"/instance/connectionState/{nombre_instancia(empresa_id)}")


def eliminar_instancia(empresa_id: int) -> dict:
    """Desconecta y borra la instancia (el cliente tendrá que re-escanear)."""
    instancia = nombre_instancia(empresa_id)
    _request("DELETE", f"/instance/logout/{instancia}")   # cierra sesión
    return _request("DELETE", f"/instance/delete/{instancia}")


def normalizar_numero(numero: str) -> str:
    """
    Deja un número en el formato que exige Evolution: solo dígitos, con
    indicativo de país.

    Los números llegan como los escribió una persona —'312 613 7615',
    '+57 312...', '(312) 613-7615'— y sin indicativo Evolution responde
    `exists: false` sin enviar nada. Se asume Colombia (57) para los
    celulares de 10 dígitos que empiezan por 3, que es el formato nacional;
    cualquier otra longitud se deja tal cual, porque es preferible fallar
    visiblemente que reescribir mal un número extranjero.
    """
    if not numero:
        return ""
    digitos = "".join(c for c in str(numero) if c.isdigit())
    if len(digitos) == 10 and digitos.startswith("3"):
        return "57" + digitos
    return digitos


def enviar_texto(empresa_id: int, numero: str, texto: str) -> dict:
    """Envía un mensaje de texto desde el WhatsApp de esa empresa."""
    destino = numero if "@" in str(numero) else normalizar_numero(numero)
    if not destino:
        return {"error": "Número de destino vacío o inválido"}
    return _request(
        "POST",
        f"/message/sendText/{nombre_instancia(empresa_id)}",
        {"number": destino, "text": texto},
    )
