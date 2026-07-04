from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import datetime, timezone
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ
from crud.parqueadero.config import get_or_create_parq_config, _obtener_tarifa_por_tipo
from crud.parqueadero.vehiculos import get_vehiculo_por_placa


# ───────────────────────────────────────────────────────────────────────────────
# 2️⃣  HELPER NUEVO — generar comprobante de entrada por WhatsApp
# ───────────────────────────────────────────────────────────────────────────────

def _generar_comprobante_entrada_wa(
    db: Session, empresa_id: int, usuario_id: int,
    acceso: models.AccesoParqueadero, telefono_valido: str,
) -> dict:
    """
    Construye el mensaje de comprobante de entrada y la URL wa.me/
    Registra el envío en el historial.
    """
    import re
    import urllib.parse
    from crud.parqueadero.whatsapp import get_plantilla
    from crud.parqueadero.metodos_pago import get_metodo_por_modalidad, _formato_moneda_co

    cfg = get_or_create_parq_config(db, empresa_id)
    nombre_parq = cfg.nombre_parqueadero or "el parqueadero"

    # Obtener plantilla "comprobante_entrada", auto-crearla si no existe
    plantilla = get_plantilla(db, empresa_id, "comprobante_entrada")

    # Resolver método de pago (modalidad 'libre' es la indicada para ocasionales)
    metodo = get_metodo_por_modalidad(db, empresa_id, "libre")
    advertencia = None
    link_pago = "(Consulta al operario al salir)"
    instrucciones = ""

    if metodo:
        if metodo.link_pago:
            link_pago = metodo.link_pago
        if metodo.instrucciones:
            instrucciones = metodo.instrucciones
    else:
        advertencia = (
            "No tienes configurado un método de pago para 'Pago libre'. "
            "El mensaje se envía sin link."
        )

    # Construir línea de cobro mínimo / tarifa plena
    cobro_minimo_linea = ""
    if cfg.usar_tarifa_plena:
        umbral_h = round((cfg.fraccion_minutos or 480) / 60, 1)
        cobro_minimo_linea = (
            f"• Tarifa por minuto: {_formato_moneda_co(cfg.tarifa_minuto or 0)}/min\n"
            f"• Tarifa plena (cada {umbral_h}h): {_formato_moneda_co(cfg.tarifa_plena or 0)}\n"
        )
    elif cfg.cobro_minimo_minutos and cfg.cobro_minimo_minutos > 0:
        monto_minimo = (cfg.tarifa_minuto or 0) * cfg.cobro_minimo_minutos
        cobro_minimo_linea = (
            f"• Cobro mínimo: {cfg.cobro_minimo_minutos} min "
            f"({_formato_moneda_co(monto_minimo)})\n"
        )

    # Hora de entrada en zona horaria local
    hora_entrada = acceso.fecha_entrada.astimezone(BOGOTA_TZ).strftime("%I:%M %p, %d/%m/%Y")

    # Nombre del cliente
    nombre_cliente = (acceso.nombre_ocasional or "").split()[0].title() \
        if acceso.nombre_ocasional else "cliente"

    try:
        mensaje = plantilla.mensaje.format(
            nombre              = nombre_cliente,
            placa               = acceso.placa,
            parqueadero         = nombre_parq,
            hora_entrada        = hora_entrada,
            tarifa_minuto       = _formato_moneda_co(cfg.tarifa_minuto or 0),
            tarifa_hora         = _formato_moneda_co(cfg.tarifa_hora or 0),
            cobro_minimo_linea  = cobro_minimo_linea,
            link_pago           = link_pago,
            instrucciones       = instrucciones or "",
        )
    except KeyError as e:
        raise ValueError(f"La plantilla 'comprobante_entrada' tiene una variable desconocida: {e}")

    mensaje = re.sub(r'\n{3,}', '\n\n', mensaje).strip()
    texto_url = urllib.parse.quote(mensaje, safe='')
    wa_url = f"https://wa.me/{telefono_valido}?text={texto_url}"

    # Registrar el envío
    db.add(models.EnvioWhatsApp(
        empresa_id      = empresa_id,
        vehiculo_id     = acceso.vehiculo_id,
        suscripcion_id  = None,
        telefono        = telefono_valido,
        tipo            = "comprobante_entrada",
        mensaje_enviado = mensaje,
        usuario_id      = usuario_id,
    ))
    db.commit()

    return {"wa_url": wa_url, "mensaje": mensaje, "advertencia": advertencia}


def registrar_entrada_horas(
    db: Session, empresa_id: int, usuario_id: int, payload: schemas.AccesoEntradaCreate
) -> dict:
    """
    Registra un ingreso por minutos. Permite teléfono + nombre opcional para
    enviar comprobante por WhatsApp inmediatamente.

    Devuelve dict con:
      - acceso: el modelo AccesoParqueadero recién creado
      - wa_url: opcional, link wa.me/ si se pidió enviar_whatsapp y hay teléfono válido
      - mensaje: opcional, preview del mensaje
      - advertencia: opcional, si algo no se pudo (ej. sin método de pago configurado)
    """
    from crud.parqueadero.metodos_pago import _normalizar_telefono_whatsapp

    placa_norm = payload.placa.strip().upper().replace(" ", "").replace("-", "")

    # Validar que esa placa NO tenga un acceso abierto
    abierto = db.query(models.AccesoParqueadero).filter(
        models.AccesoParqueadero.empresa_id == empresa_id,
        models.AccesoParqueadero.placa == placa_norm,
        models.AccesoParqueadero.estado == "dentro",
    ).first()
    if abierto:
        raise HTTPException(
            status_code=400,
            detail=f"La placa {placa_norm} ya tiene un acceso abierto desde {abierto.fecha_entrada}."
        )

    # Si la moto ya está registrada en el parqueadero, vincularla
    veh_id = payload.vehiculo_id
    if not veh_id:
        veh = get_vehiculo_por_placa(db, empresa_id, placa_norm)
        veh_id = veh.id if veh else None

    # Normalizar teléfono si lo envían
    telefono_norm = None
    if payload.telefono and payload.telefono.strip():
        telefono_norm = _normalizar_telefono_whatsapp(payload.telefono.strip())
        # Si el teléfono no es válido, lo guardamos crudo igual pero no enviamos WA
        if not telefono_norm and payload.telefono.strip():
            telefono_norm = payload.telefono.strip()  # lo guardamos como lo escribieron

    # Crear acceso
    acceso = models.AccesoParqueadero(
        empresa_id        = empresa_id,
        vehiculo_id       = veh_id,
        placa             = placa_norm,
        nombre_ocasional  = (payload.nombre_ocasional or "").strip() or None,
        telefono          = telefono_norm,
        fecha_entrada     = datetime.now(timezone.utc),
        estado            = "dentro",
        observaciones     = payload.observaciones,
        usuario_id        = usuario_id,
    )
    db.add(acceso)
    db.commit()
    db.refresh(acceso)

    # Construir el response base
    resultado = {
        "acceso":      acceso,
        "wa_url":      None,
        "mensaje":     None,
        "advertencia": None,
    }

    # ── Generar WhatsApp si se pidió y hay teléfono válido ──────────────────
    if payload.enviar_whatsapp:
        # Validar que el teléfono normalizado sea válido para wa.me/
        telefono_valido = _normalizar_telefono_whatsapp(telefono_norm) if telefono_norm else None

        if not telefono_valido:
            resultado["advertencia"] = (
                "No se envió WhatsApp: el teléfono no tiene formato válido."
            )
        else:
            try:
                wa_data = _generar_comprobante_entrada_wa(
                    db, empresa_id, usuario_id, acceso, telefono_valido,
                )
                resultado["wa_url"]      = wa_data["wa_url"]
                resultado["mensaje"]     = wa_data["mensaje"]
                resultado["advertencia"] = wa_data.get("advertencia")
            except Exception as ex:
                resultado["advertencia"] = f"No se pudo generar el WhatsApp: {ex}"

    return resultado


def registrar_salida_horas(
    db: Session, empresa_id: int, payload: schemas.AccesoSalidaCreate
) -> models.AccesoParqueadero:
    """
    Cierra un acceso, calcula MINUTOS y monto. Aplica cobro mínimo configurado.
    El operario puede sobrescribir el monto con `monto_manual` para descuentos.
    """
    acceso = db.query(models.AccesoParqueadero).filter(
        models.AccesoParqueadero.id == payload.acceso_id,
        models.AccesoParqueadero.empresa_id == empresa_id,
    ).first()

    if not acceso:
        raise HTTPException(status_code=404, detail="Acceso no encontrado.")
    if acceso.estado == "salio":
        raise HTTPException(status_code=400, detail="Este acceso ya fue cerrado.")

    cfg = get_or_create_parq_config(db, empresa_id)
    ahora = datetime.now(timezone.utc)

    # --- FIX: Inyección de zona horaria UTC ---
    entrada = acceso.fecha_entrada
    if entrada.tzinfo is None:
        entrada = entrada.replace(tzinfo=timezone.utc)

    delta = ahora - entrada
    # ------------------------------------------

    minutos_reales = max(1, int(round(delta.total_seconds() / 60)))

    cobro_minimo = cfg.cobro_minimo_minutos or 0

    if cfg.usar_tarifa_plena:
        # ── Modelo híbrido: por minuto + tarifa plena al completar el umbral ─
        # Períodos completos (umbral) → tarifa_plena c/u
        # Minutos restantes → min(resto × tarifa_minuto, tarifa_plena)
        # Esto garantiza que el cobro nunca supere tarifa_plena dentro del período
        minutos_cobrar = max(minutos_reales, cobro_minimo) if cobro_minimo > 0 else minutos_reales
        umbral       = max(1, cfg.fraccion_minutos or 480)
        tarifa_plena = cfg.tarifa_plena or 0.0
        tarifa_min   = cfg.tarifa_minuto or 0.0

        periodos = minutos_cobrar // umbral
        resto    = minutos_cobrar % umbral
        costo_resto = min(resto * tarifa_min, tarifa_plena)
        monto_calc = round(periodos * tarifa_plena + costo_resto, 0)
    else:
        # ── Modelo por minuto (original) ────────────────────────────────────
        minutos_cobrar = max(minutos_reales, cobro_minimo) if cobro_minimo > 0 else minutos_reales
        tarifa_min     = cfg.tarifa_minuto or 0
        monto_calc     = round(minutos_cobrar * tarifa_min, 0)

    monto_final = payload.monto_manual if payload.monto_manual is not None else monto_calc

    # Compatibilidad con campo legacy horas_cobradas
    horas_compat = round(minutos_cobrar / 60, 2)

    acceso.fecha_salida    = ahora
    acceso.minutos_cobrados = minutos_cobrar
    acceso.horas_cobradas  = horas_compat
    acceso.monto_cobrado   = monto_final
    acceso.metodo_pago     = payload.metodo_pago
    acceso.estado          = "salio"

    if payload.observaciones:
        acceso.observaciones = (acceso.observaciones or "") + " | Salida: " + payload.observaciones

    db.commit()
    db.refresh(acceso)

    # Solo crear venta si hubo cobro
    if monto_final and monto_final > 0:
        import models as _models
        from crud import ventas as _crud_ventas
        placa_str = acceso.placa or ''
        solicita_fe = getattr(payload, 'solicita_fe', False)
        from crud.consecutivos import next_consecutivo
        venta_parq = _models.Venta(
            numero_venta= next_consecutivo(db, empresa_id, "ultimo_numero_venta"),
            empresa_id  = empresa_id,
            total       = monto_final,
            monto_pagado= monto_final,
            estado_pago = "pagado",
            metodo_pago = payload.metodo_pago or "Efectivo",
            origen      = "parqueadero_horas",
            tipo        = "venta",
            placa_vehiculo = placa_str,
            fecha_pago  = datetime.now(timezone.utc),
            solicita_fe = solicita_fe,
            observaciones = f"Acceso por minutos | Placa: {placa_str} | {minutos_cobrar} min",
        )
        db.add(venta_parq)
        db.commit()
        db.refresh(venta_parq)

        # Asiento contable (idempotente)
        try:
            from services.contabilidad import registrar_asiento_venta
            registrar_asiento_venta(db, venta_parq)
            db.commit()
        except Exception:
            db.rollback()  # sesión envenenada rompería refresh/serialización posteriores

        # Documento electrónico DIAN por acceso: FE si el cliente la pidió
        # (solicita_fe), Documento Equivalente POS (DEE) en caso contrario.
        # emitir_fe_venta decide el tipo y sólo emite si hay resolución del tipo
        # requerido; si no hay resolución POS configurada, el acceso queda
        # pendiente y podrá incluirse en el cierre FE consolidado del día.
        nit = (payload.cliente_nit or "").strip()
        cliente_fe = None
        if solicita_fe and nit:
            nombre_fe = (payload.cliente_nombre or "").strip() or f"Cliente {nit}"
            cliente_fe = db.query(_models.Cliente).filter(
                _models.Cliente.empresa_id == empresa_id,
                _models.Cliente.cedula == nit,
            ).first()
            if not cliente_fe:
                cliente_fe = _models.Cliente(
                    empresa_id = empresa_id,
                    nombre     = nombre_fe,
                    cedula     = nit,
                )
                db.add(cliente_fe)
                db.commit()
                db.refresh(cliente_fe)

        detalle = _crud_ventas._DetalleSintetico(
            descripcion=f"Parqueadero {minutos_cobrar} min — Placa {placa_str}",
            monto=float(monto_final),
        )
        _crud_ventas.emitir_fe_venta(db, empresa_id, venta_parq, [detalle], cliente=cliente_fe)
        db.commit()

        db.refresh(acceso)

    return acceso
