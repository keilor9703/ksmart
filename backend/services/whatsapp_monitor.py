"""
Vigilancia de las conexiones de WhatsApp de cada empresa.

El problema que resuelve: una sesión de WhatsApp se cae sola —el celular se
queda sin datos varios días, alguien cierra el dispositivo vinculado, WhatsApp
expira la sesión— y hasta ahora eso era completamente invisible. Los clientes
escribían, el bot no contestaba, el negocio creía que todo iba bien, y el
problema salía a la luz con un reclamo días después.

Aquí se revisa periódicamente el estado real de cada instancia y, cuando una
pasa de conectada a caída, se le notifica a los administradores de esa empresa
dentro de Ksmart360.

El aviso NO puede ir por WhatsApp: justamente el canal caído es ese.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict

from sqlalchemy.orm import Session

import models
from services import evolution_service as evo

logger = logging.getLogger("whatsapp_monitor")

# Cada cuánto se le vuelve a recordar al negocio que sigue desconectado.
# Un solo aviso se pierde entre otras notificaciones; uno cada hora sería
# ruido. Seis horas mantiene el asunto presente sin volverse molesto.
INTERVALO_REAVISO = timedelta(hours=6)

MENSAJE_CAIDA = (
    "⚠️ Tu WhatsApp se desconectó. Los clientes que te escriban NO están "
    "recibiendo respuesta. Entra a Pedidos por WhatsApp y vuelve a escanear "
    "el código QR para reactivarlo."
)


def _notificar_admins(db: Session, empresa_id: int, mensaje: str, tipo: str) -> int:
    """Crea la notificación para cada administrador de la empresa."""
    admins = (
        db.query(models.User)
        .join(models.Role)
        .filter(
            models.User.empresa_id == empresa_id,
            models.User.is_active == True,  # noqa: E712
            models.Role.name == "Admin",
        )
        .all()
    )
    for admin in admins:
        db.add(models.Notificacion(
            empresa_id=empresa_id,
            usuario_id=admin.id,
            mensaje=mensaje,
            tipo=tipo,
        ))
    return len(admins)


def revisar_conexiones(db: Session) -> Dict[str, int]:
    """
    Revisa todas las empresas con WhatsApp vinculado y avisa de las caídas.

    Es idempotente: puede correr cada pocos minutos sin generar notificaciones
    repetidas, porque solo avisa en la transición a caída y luego respeta
    INTERVALO_REAVISO.
    """
    if not evo.is_configured():
        return {"revisadas": 0, "caidas": 0, "avisos": 0}

    ahora = datetime.now(timezone.utc)
    empresas = db.query(models.Empresa).filter(
        models.Empresa.whatsapp_instancia.isnot(None),
        models.Empresa.is_active == True,  # noqa: E712
    ).all()

    revisadas = caidas = avisos = 0

    for empresa in empresas:
        revisadas += 1
        data = evo.estado_conexion(empresa.id)

        if data.get("error"):
            # Un fallo de red hacia Evolution no significa que la empresa esté
            # desconectada: no se toca su estado ni se avisa. Avisar por esto
            # entrenaría al negocio a ignorar la notificación.
            if data.get("status_code") != 404:
                logger.warning(
                    "No se pudo consultar el estado de %s: %s",
                    empresa.whatsapp_instancia, data["error"],
                )
                continue
            # 404 sí es concluyente: la instancia ya no existe en Evolution.
            estado = "eliminada"
        else:
            estado = (data.get("instance") or {}).get("state", "close")

        conectado = estado == "open"
        empresa.whatsapp_estado = estado

        if conectado:
            # Se recuperó: se limpia el estado para que la próxima caída
            # vuelva a avisar desde cero.
            if empresa.whatsapp_desconectado_desde:
                logger.info("WhatsApp de empresa %s reconectado.", empresa.id)
            empresa.whatsapp_desconectado_desde = None
            empresa.whatsapp_ultimo_aviso = None
            db.add(empresa)
            continue

        caidas += 1
        if not empresa.whatsapp_desconectado_desde:
            empresa.whatsapp_desconectado_desde = ahora

        toca_avisar = (
            empresa.whatsapp_ultimo_aviso is None
            or (ahora - empresa.whatsapp_ultimo_aviso) >= INTERVALO_REAVISO
        )
        if toca_avisar:
            n = _notificar_admins(db, empresa.id, MENSAJE_CAIDA, "error")
            if n:
                empresa.whatsapp_ultimo_aviso = ahora
                avisos += 1
                logger.info(
                    "WhatsApp de empresa %s caído (%s): %d administradores avisados.",
                    empresa.id, estado, n,
                )

        db.add(empresa)

    db.commit()
    return {"revisadas": revisadas, "caidas": caidas, "avisos": avisos}
