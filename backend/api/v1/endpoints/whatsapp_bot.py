"""
Módulo "Bot de WhatsApp": permite que cada empresa conecte su propio número
de WhatsApp desde Ksmart360 para recibir pedidos automáticamente.

El navegador del cliente NUNCA ve la clave de Evolution: todas las llamadas
pasan por aquí, autenticadas con el token normal de Ksmart360 y acotadas a
la instancia de SU empresa (nunca puede tocar la de otro tenant).
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from api.deps import get_db, get_current_active_user, get_current_admin_user
from services import evolution_service as evo

router = APIRouter()
logger = logging.getLogger("whatsapp_bot")


def _sin_configurar():
    raise HTTPException(
        status_code=503,
        detail="El servicio de WhatsApp no está configurado. Contacta a soporte.",
    )


@router.get("/estado")
def estado(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Estado de la conexión de WhatsApp de la empresa actual."""
    if not evo.is_configured():
        return {"disponible": False, "conectado": False, "estado": "no_configurado"}

    empresa = current_user.empresa
    instancia = empresa.whatsapp_instancia

    if not instancia:
        return {"disponible": True, "conectado": False, "estado": "sin_vincular",
                "instancia": None}

    data = evo.estado_conexion(current_user.empresa_id)
    if data.get("error"):
        # 404 = la instancia se borró del lado de Evolution
        if data.get("status_code") == 404:
            return {"disponible": True, "conectado": False, "estado": "sin_vincular",
                    "instancia": instancia}
        return {"disponible": True, "conectado": False, "estado": "error",
                "instancia": instancia, "mensaje": data["error"]}

    estado_wa = (data.get("instance") or {}).get("state", "close")
    return {
        "disponible": True,
        "conectado": estado_wa == "open",
        "estado": estado_wa,
        "instancia": instancia,
    }


@router.post("/conectar")
def conectar(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    """
    Crea (o reusa) la instancia de la empresa y devuelve el QR para escanear
    desde WhatsApp. Solo el administrador de la empresa puede hacerlo.
    """
    if not evo.is_configured():
        _sin_configurar()

    empresa_id = current_user.empresa_id
    empresa = current_user.empresa
    instancia = evo.nombre_instancia(empresa_id)

    # Registrar la instancia en la empresa (es la llave que usa la automatización)
    if empresa.whatsapp_instancia != instancia:
        empresa.whatsapp_instancia = instancia
        db.add(empresa)
        db.commit()

    data = evo.crear_instancia(empresa_id)

    # Si ya existía, pedimos un QR nuevo en vez de fallar
    if data.get("error"):
        data = evo.obtener_qr(empresa_id)
        if data.get("error"):
            raise HTTPException(status_code=502, detail=data["error"])

    # El webhook se (re)aplica SIEMPRE, no solo al crear la instancia: si esta
    # ya existía de un intento anterior, quedaba sin webhook y los mensajes del
    # cliente no llegaban a la automatización, sin ningún error visible.
    wh = evo.configurar_webhook(empresa_id)
    if wh.get("error"):
        logger.warning(
            "No se pudo configurar el webhook de %s: %s", instancia, wh["error"]
        )

    qr = (data.get("qrcode") or {}).get("base64") or data.get("base64")
    codigo = (data.get("qrcode") or {}).get("code") or data.get("code")

    return {
        "instancia": instancia,
        "qr_base64": qr,
        "codigo": codigo,
        # Si esto es False, el número se conectará pero los pedidos NO
        # llegarán: falta EVOLUTION_WEBHOOK_URL en el servidor.
        "automatizacion_lista": not wh.get("error"),
    }


@router.delete("/desconectar")
def desconectar(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    """Desvincula el WhatsApp de la empresa."""
    if not evo.is_configured():
        _sin_configurar()

    evo.eliminar_instancia(current_user.empresa_id)

    empresa = current_user.empresa
    empresa.whatsapp_instancia = None
    db.add(empresa)
    db.commit()

    return {"mensaje": "WhatsApp desvinculado correctamente."}
