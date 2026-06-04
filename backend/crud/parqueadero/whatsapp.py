import re
import urllib.parse
from datetime import datetime, date, timezone
from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

import models, schemas
from schemas import PLANTILLAS_DEFAULT
from crud.common import BOGOTA_TZ
from crud.parqueadero.config import get_or_create_parq_config
from crud.parqueadero.metodos_pago import (
    get_metodo_por_modalidad,
    _normalizar_telefono_whatsapp,
    _formato_moneda_co,
    _formato_fecha_es,
)


def get_plantilla(
    db: Session, empresa_id: int, tipo: str
) -> Optional[models.PlantillaWhatsApp]:
    """Devuelve la plantilla para un tipo. Si no existe, la crea con el default."""
    p = db.query(models.PlantillaWhatsApp).filter(
        models.PlantillaWhatsApp.empresa_id == empresa_id,
        models.PlantillaWhatsApp.tipo       == tipo,
    ).first()
    if p:
        return p
    default_msg = PLANTILLAS_DEFAULT.get(tipo, PLANTILLAS_DEFAULT["pago"])
    p = models.PlantillaWhatsApp(
        empresa_id = empresa_id,
        tipo       = tipo,
        mensaje    = default_msg,
        is_active  = True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def listar_plantillas(db: Session, empresa_id: int) -> List[models.PlantillaWhatsApp]:
    """Lista todas las plantillas disponibles. Si alguna no existe, la crea con el default."""
    resultado = []
    for tipo in PLANTILLAS_DEFAULT.keys():
        resultado.append(get_plantilla(db, empresa_id, tipo))
    return resultado


def update_plantilla(
    db: Session, empresa_id: int, tipo: str, payload: schemas.PlantillaWhatsAppUpdate
) -> models.PlantillaWhatsApp:
    plantilla = get_plantilla(db, empresa_id, tipo)
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(plantilla, k, v)
    plantilla.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(plantilla)
    return plantilla


def restaurar_plantilla_default(
    db: Session, empresa_id: int, tipo: str
) -> models.PlantillaWhatsApp:
    """Vuelve la plantilla al texto por defecto."""
    plantilla = get_plantilla(db, empresa_id, tipo)
    plantilla.mensaje    = PLANTILLAS_DEFAULT.get(tipo, PLANTILLAS_DEFAULT["pago"])
    plantilla.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(plantilla)
    return plantilla


def generar_link_whatsapp(
    db: Session, empresa_id: int, usuario_id: int, payload: schemas.GenerarWhatsAppRequest
) -> dict:
    """
    Arma el mensaje, lo url-encodea y devuelve la URL wa.me/ lista para abrir en el frontend.
    """
    advertencia = None

    vehiculo = None
    suscripcion = None
    cliente_nombre = None
    placa = None
    telefono_raw = payload.telefono

    # Si se pasa acceso_id, resolver placa/nombre/teléfono del acceso ocasional
    if payload.acceso_id:
        acceso_obj = db.query(models.AccesoParqueadero).filter(
            models.AccesoParqueadero.id == payload.acceso_id,
            models.AccesoParqueadero.empresa_id == empresa_id,
        ).first()
        if acceso_obj:
            placa = placa or acceso_obj.placa
            cliente_nombre = cliente_nombre or acceso_obj.nombre_ocasional
            if not telefono_raw:
                telefono_raw = acceso_obj.telefono

    if payload.vehiculo_id:
        vehiculo = db.query(models.Vehiculo).options(
            joinedload(models.Vehiculo.cliente)
        ).filter(
            models.Vehiculo.id == payload.vehiculo_id,
            models.Vehiculo.empresa_id == empresa_id,
        ).first()
        if not vehiculo:
            raise HTTPException(404, "Vehículo no encontrado")
        placa = vehiculo.placa
        if vehiculo.cliente:
            cliente_nombre = vehiculo.cliente.nombre
            if not telefono_raw:
                telefono_raw = vehiculo.cliente.telefono

    if payload.suscripcion_id:
        suscripcion = db.query(models.SuscripcionParqueadero).filter(
            models.SuscripcionParqueadero.id == payload.suscripcion_id,
            models.SuscripcionParqueadero.empresa_id == empresa_id,
        ).first()
        if not suscripcion:
            raise HTTPException(404, "Suscripción no encontrada")
        if not vehiculo and suscripcion.vehiculo_id:
            vehiculo = db.query(models.Vehiculo).options(
                joinedload(models.Vehiculo.cliente)
            ).filter(
                models.Vehiculo.id == suscripcion.vehiculo_id,
            ).first()
            if vehiculo:
                placa = vehiculo.placa
                if vehiculo.cliente:
                    cliente_nombre = vehiculo.cliente.nombre
                    if not telefono_raw:
                        telefono_raw = vehiculo.cliente.telefono

    telefono_norm = _normalizar_telefono_whatsapp(telefono_raw)
    if not telefono_norm:
        raise HTTPException(
            400,
            "El cliente no tiene un número de WhatsApp válido. "
            "Edítalo en la ficha del propietario."
        )

    cfg = get_or_create_parq_config(db, empresa_id)
    nombre_parq = cfg.nombre_parqueadero or "el parqueadero"
    direccion   = cfg.direccion or ""

    hoy = datetime.now(BOGOTA_TZ).date()

    if suscripcion:
        tipo_plan = suscripcion.tipo
        fecha_venc = _formato_fecha_es(suscripcion.fecha_vencimiento)
        dias_rest = (suscripcion.fecha_vencimiento - hoy).days
        dias_venc = max(0, -dias_rest)
        monto_a_cobrar = (
            payload.monto_override if payload.monto_override is not None
            else (suscripcion.saldo_pendiente if hasattr(suscripcion, 'saldo_pendiente')
                  else max(0, (suscripcion.monto_total or 0) - (suscripcion.monto_pagado or 0))
                  or suscripcion.monto_total or 0)
        )
        saldo_pendiente = max(0, (suscripcion.monto_total or 0) - (suscripcion.monto_pagado or 0))
        modalidad_metodo = suscripcion.tipo
    else:
        tipo_plan = "Por definir"
        fecha_venc = "—"
        dias_rest = 0
        dias_venc = 0
        monto_a_cobrar = payload.monto_override or 0
        saldo_pendiente = 0
        modalidad_metodo = "libre"

    metodo = get_metodo_por_modalidad(db, empresa_id, modalidad_metodo)
    if not metodo:
        metodo = get_metodo_por_modalidad(db, empresa_id, "libre")

    link_pago = ""
    instrucciones = ""
    metodo_nombre = None
    qr_data_uri = None

    if metodo:
        metodo_nombre = metodo.nombre_metodo
        if metodo.link_pago:
            link_pago = metodo.link_pago
        if metodo.instrucciones:
            instrucciones = metodo.instrucciones
        if metodo.qr_base64:
            qr_data_uri = f"data:{metodo.qr_mime_type or 'image/png'};base64,{metodo.qr_base64}"

    if not link_pago and not qr_data_uri:
        advertencia = (
            f"No has configurado un método de pago para '{modalidad_metodo}'. "
            "El mensaje se enviará sin link de pago."
        )

    if payload.mensaje_personalizado:
        mensaje = payload.mensaje_personalizado
    else:
        plantilla = get_plantilla(db, empresa_id, payload.tipo.value)

        saldo_linea = ""
        if saldo_pendiente > 0 and saldo_pendiente != monto_a_cobrar:
            saldo_linea = f"• Saldo pendiente: *{_formato_moneda_co(saldo_pendiente)}*\n"

        instrucciones_completas = instrucciones
        if qr_data_uri and not link_pago:
            extra = "📲 Escanea el código QR que te enviamos a continuación para pagar."
            instrucciones_completas = (instrucciones_completas + "\n\n" + extra).strip()

        link_pago_display = link_pago if link_pago else "(El comerciante te enviará el QR)"

        try:
            mensaje = plantilla.mensaje.format(
                nombre          = (cliente_nombre or "estimado cliente").split()[0].title(),
                placa           = placa or "—",
                parqueadero     = nombre_parq,
                tipo_plan       = tipo_plan.title() if tipo_plan else "—",
                fecha_vence     = fecha_venc,
                dias_vencido    = dias_venc,
                dias_restantes  = max(0, dias_rest),
                monto           = _formato_moneda_co(monto_a_cobrar),
                saldo           = _formato_moneda_co(saldo_pendiente),
                saldo_linea     = saldo_linea,
                link_pago       = link_pago_display,
                instrucciones   = instrucciones_completas or "",
                direccion       = direccion,
                # Variables para recibo_salida
                minutos         = payload.minutos or 0,
                metodo_pago     = payload.metodo_pago_text or "—",
            )
        except KeyError as e:
            raise HTTPException(
                400,
                f"La plantilla tiene una variable desconocida: {e}. "
                "Restaura la plantilla por defecto desde la configuración."
            )

    mensaje = re.sub(r'\n{3,}', '\n\n', mensaje).strip()

    texto_url = urllib.parse.quote(mensaje, safe='')
    wa_url = f"https://wa.me/{telefono_norm}?text={texto_url}"

    envio = models.EnvioWhatsApp(
        empresa_id      = empresa_id,
        vehiculo_id     = vehiculo.id if vehiculo else None,
        suscripcion_id  = suscripcion.id if suscripcion else None,
        telefono        = telefono_norm,
        tipo            = payload.tipo.value,
        mensaje_enviado = mensaje,
        usuario_id      = usuario_id,
    )
    db.add(envio)
    db.commit()

    return {
        "wa_url":        wa_url,
        "mensaje":       mensaje,
        "telefono":      telefono_norm,
        "tiene_qr":      bool(qr_data_uri),
        "qr_data_uri":   qr_data_uri,
        "metodo_nombre": metodo_nombre,
        "advertencia":   advertencia,
    }


def listar_envios_whatsapp(
    db: Session, empresa_id: int, skip: int = 0, limit: int = 100,
    vehiculo_id: Optional[int] = None,
) -> List[dict]:
    q = (
        db.query(models.EnvioWhatsApp)
        .options(
            joinedload(models.EnvioWhatsApp.vehiculo).joinedload(models.Vehiculo.cliente),
            joinedload(models.EnvioWhatsApp.usuario),
        )
        .filter(models.EnvioWhatsApp.empresa_id == empresa_id)
    )
    if vehiculo_id:
        q = q.filter(models.EnvioWhatsApp.vehiculo_id == vehiculo_id)

    envios = q.order_by(models.EnvioWhatsApp.fecha.desc()).offset(skip).limit(limit).all()

    resultado = []
    for e in envios:
        resultado.append({
            "id":              e.id,
            "empresa_id":      e.empresa_id,
            "vehiculo_id":     e.vehiculo_id,
            "suscripcion_id":  e.suscripcion_id,
            "telefono":        e.telefono,
            "tipo":            e.tipo,
            "mensaje_enviado": e.mensaje_enviado,
            "usuario_id":      e.usuario_id,
            "fecha":           e.fecha,
            "placa":           e.vehiculo.placa if e.vehiculo else None,
            "cliente_nombre":  e.vehiculo.cliente.nombre if (e.vehiculo and e.vehiculo.cliente) else None,
            "usuario_username": e.usuario.username if e.usuario else None,
        })
    return resultado
