"""
Módulo "Bot de WhatsApp": permite que cada empresa conecte su propio número
de WhatsApp desde Ksmart360 para recibir pedidos automáticamente.

El navegador del cliente NUNCA ve la clave de Evolution: todas las llamadas
pasan por aquí, autenticadas con el token normal de Ksmart360 y acotadas a
la instancia de SU empresa (nunca puede tocar la de otro tenant).
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
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
        # Desde cuándo está caído, según el monitor de fondo. Permite mostrar
        # "desconectado desde ayer" en vez de un simple punto rojo, que es la
        # diferencia entre enterarse y darse cuenta.
        "desconectado_desde": (
            empresa.whatsapp_desconectado_desde.isoformat()
            if estado_wa != "open" and empresa.whatsapp_desconectado_desde
            else None
        ),
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
    # Reconectar cierra el ciclo del aviso anterior: si vuelve a caerse, se
    # notifica de nuevo desde cero en lugar de esperar el próximo re-aviso.
    empresa.whatsapp_desconectado_desde = None
    empresa.whatsapp_ultimo_aviso = None
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
    # Se limpia la vigilancia: desvincular es una decisión del negocio, no una
    # caída, y no tiene sentido avisarle de algo que acaba de hacer a propósito.
    empresa.whatsapp_estado = None
    empresa.whatsapp_desconectado_desde = None
    empresa.whatsapp_ultimo_aviso = None
    db.add(empresa)
    db.commit()

    return {"mensaje": "WhatsApp desvinculado correctamente."}


# ─── Configuración que usa el bot al responder ────────────────────────────────

class BotConfigIn(BaseModel):
    horario_atencion: Optional[str] = None
    whatsapp_notificaciones: Optional[str] = None


@router.get("/config")
def get_config(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Datos que el bot cita al responder preguntas frecuentes."""
    empresa = current_user.empresa
    return {
        "horario_atencion": empresa.horario_atencion,
        "whatsapp_pedidos": empresa.whatsapp_pedidos,
        "whatsapp_notificaciones": empresa.whatsapp_notificaciones,
    }


@router.patch("/config")
def update_config(
    payload: BotConfigIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    """
    Actualiza el horario que el bot le informa a los clientes.

    Es texto libre a propósito: cada negocio expresa su horario distinto
    (jornada continua, domingos, festivos) y el bot lo cita tal cual, sin
    interpretarlo ni inventarlo.
    """
    empresa = current_user.empresa
    if payload.horario_atencion is not None:
        empresa.horario_atencion = payload.horario_atencion.strip()[:200] or None
    if payload.whatsapp_notificaciones is not None:
        empresa.whatsapp_notificaciones = (
            payload.whatsapp_notificaciones.strip()[:20] or None
        )
    db.add(empresa)
    db.commit()
    return {
        "horario_atencion": empresa.horario_atencion,
        "whatsapp_notificaciones": empresa.whatsapp_notificaciones,
    }
