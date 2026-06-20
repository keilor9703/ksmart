from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional, List
from datetime import date, datetime, timedelta, timezone
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ
from crud.parqueadero.config import (
    _calcular_fecha_vencimiento, _obtener_tarifa_por_tipo,
    _actualizar_estado_pago, _enriquecer_suscripcion, get_or_create_parq_config
)
from crud.parqueadero.vehiculos import get_vehiculo


def get_suscripcion_activa(
    db: Session, empresa_id: int, vehiculo_id: int
) -> Optional[models.SuscripcionParqueadero]:
    """
    Devuelve la suscripción VIGENTE más reciente. Si no hay vigente,
    devuelve la última vencida (para mostrar 'vencida hace X días').
    No considera las canceladas.
    """
    hoy = datetime.now(BOGOTA_TZ).date()

    vigente = (
        db.query(models.SuscripcionParqueadero)
        .options(joinedload(models.SuscripcionParqueadero.pagos))
        .filter(
            models.SuscripcionParqueadero.empresa_id == empresa_id,
            models.SuscripcionParqueadero.vehiculo_id == vehiculo_id,
            models.SuscripcionParqueadero.estado != "cancelada",
            models.SuscripcionParqueadero.fecha_vencimiento >= hoy,
        )
        .order_by(models.SuscripcionParqueadero.fecha_vencimiento.desc())
        .first()
    )
    if vigente:
        return vigente

    return (
        db.query(models.SuscripcionParqueadero)
        .options(joinedload(models.SuscripcionParqueadero.pagos))
        .filter(
            models.SuscripcionParqueadero.empresa_id == empresa_id,
            models.SuscripcionParqueadero.vehiculo_id == vehiculo_id,
            models.SuscripcionParqueadero.estado != "cancelada",
        )
        .order_by(models.SuscripcionParqueadero.fecha_vencimiento.desc())
        .first()
    )


def list_suscripciones_vehiculo(
    db: Session, empresa_id: int, vehiculo_id: int, limit: int = 50
) -> List[dict]:
    suscripciones = (
        db.query(models.SuscripcionParqueadero)
        .options(
            joinedload(models.SuscripcionParqueadero.vehiculo).joinedload(models.Vehiculo.cliente),
            joinedload(models.SuscripcionParqueadero.pagos),
        )
        .filter(
            models.SuscripcionParqueadero.empresa_id == empresa_id,
            models.SuscripcionParqueadero.vehiculo_id == vehiculo_id,
        )
        .order_by(models.SuscripcionParqueadero.fecha_inicio.desc())
        .limit(limit)
        .all()
    )
    return [_enriquecer_suscripcion(s) for s in suscripciones]


def list_todas_suscripciones(
    db: Session, empresa_id: int, skip: int = 0, limit: int = 100,
    solo_vigentes: bool = False, solo_vencidas: bool = False,
    incluir_inactivos: bool = False,   # ✨ NUEVO: si True, incluye motos dadas de baja
) -> List[dict]:
    """
    🛠️ FIX BUG #2: Por defecto NO devuelve suscripciones de motos dadas de baja.
    Si necesitas verlas (ej. para reportes históricos), pasa incluir_inactivos=True.
    """
    hoy = datetime.now(BOGOTA_TZ).date()
    q = (
        db.query(models.SuscripcionParqueadero)
        .join(models.Vehiculo, models.SuscripcionParqueadero.vehiculo_id == models.Vehiculo.id)
        .options(
            joinedload(models.SuscripcionParqueadero.vehiculo).joinedload(models.Vehiculo.cliente),
            joinedload(models.SuscripcionParqueadero.pagos),
        )
        .filter(
            models.SuscripcionParqueadero.empresa_id == empresa_id,
            models.SuscripcionParqueadero.estado != "cancelada",
        )
    )

    # 🛠️ FIX: solo motos activas por defecto
    if not incluir_inactivos:
        q = q.filter(models.Vehiculo.is_active == True)

    if solo_vigentes:
        q = q.filter(models.SuscripcionParqueadero.fecha_vencimiento >= hoy)
    elif solo_vencidas:
        q = q.filter(models.SuscripcionParqueadero.fecha_vencimiento < hoy)

    suscripciones = q.order_by(
        models.SuscripcionParqueadero.fecha_vencimiento.desc()
    ).offset(skip).limit(limit).all()

    return [_enriquecer_suscripcion(s) for s in suscripciones]


def create_suscripcion(
    db: Session, empresa_id: int, usuario_id: int, payload: schemas.SuscripcionCreate
) -> dict:
    """
    Crea una nueva suscripción. La regla del dueño:
      - Los días vencidos NO se cobran si el cliente NO entró durante ellos.
      - Por eso este endpoint asume "no entró" → arranca desde HOY (o fecha enviada).
      - Para el caso "sí entró durante los vencidos", usar create_suscripcion_retroactiva().
    """
    veh = get_vehiculo(db, empresa_id, payload.vehiculo_id)
    if not veh:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")

    cfg = get_or_create_parq_config(db, empresa_id)

    # Determinar monto: el operario puede usar tarifa global o un monto personalizado (descuento)
    monto_total = payload.monto_personalizado if payload.monto_personalizado is not None \
        else _obtener_tarifa_por_tipo(cfg, payload.tipo.value)

    if monto_total <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"No hay tarifa configurada para el tipo '{payload.tipo.value}'. Configúrala primero."
        )

    fecha_inicio = payload.fecha_inicio or datetime.now(BOGOTA_TZ).date()
    fecha_vence  = _calcular_fecha_vencimiento(fecha_inicio, payload.tipo.value)

    monto_pagado = min(payload.monto_pagado or 0.0, monto_total)

    susc = models.SuscripcionParqueadero(
        empresa_id          = empresa_id,
        vehiculo_id         = payload.vehiculo_id,
        tipo                = payload.tipo.value,
        fecha_inicio        = fecha_inicio,
        fecha_vencimiento   = fecha_vence,
        monto_total         = monto_total,
        monto_pagado        = monto_pagado,
        metodo_pago_inicial = payload.metodo_pago_inicial,
        observaciones       = payload.observaciones,
        es_retroactiva      = payload.es_retroactiva,
        estado              = "vigente",
    )
    _actualizar_estado_pago(susc)
    db.add(susc)
    db.flush()

    # Si pagó algo de entrada, registrar el primer pago
    if monto_pagado > 0:
        primer_pago = models.PagoParqueadero(
            empresa_id     = empresa_id,
            suscripcion_id = susc.id,
            monto          = monto_pagado,
            metodo_pago    = payload.metodo_pago_inicial or "Efectivo",
            usuario_id     = usuario_id,
            observaciones  = "Pago al crear la suscripción",
        )
        db.add(primer_pago)

    db.commit()
    db.refresh(susc)

    # Cargar relaciones para el response
    susc = (
        db.query(models.SuscripcionParqueadero)
        .options(
            joinedload(models.SuscripcionParqueadero.vehiculo).joinedload(models.Vehiculo.cliente),
            joinedload(models.SuscripcionParqueadero.pagos),
        )
        .filter(models.SuscripcionParqueadero.id == susc.id)
        .first()
    )
    return _enriquecer_suscripcion(susc)


def create_suscripcion_retroactiva(
    db: Session, empresa_id: int, usuario_id: int, payload: schemas.SuscripcionRetroactivaCreate
) -> dict:
    """
    Caso especial: el cliente SÍ entró durante los días vencidos. Acumula deuda + opcional renovación.

    Lógica:
      1. Crea suscripción retroactiva por los días vencidos (tipo y monto según escoja)
      2. Opcionalmente, crea una nueva suscripción desde HOY
      3. Distribuye el monto_pagado_total entre ambas (primero la retroactiva)
    """
    veh = get_vehiculo(db, empresa_id, payload.vehiculo_id)
    if not veh:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")

    cfg = get_or_create_parq_config(db, empresa_id)
    hoy = datetime.now(BOGOTA_TZ).date()

    # ── 1. Suscripción retroactiva ────────────────────────────────────────────
    fecha_inicio_retro = hoy - timedelta(days=payload.dias_vencidos_a_cobrar)

    if payload.tipo_retroactivo.value == "diaria":
        # Cobrar X días sueltos a tarifa diaria
        monto_retro = (cfg.tarifa_diaria or 0) * payload.dias_vencidos_a_cobrar
        # El "vencimiento" técnico de esta retroactiva es ayer (ya pasó)
        fecha_vence_retro = hoy - timedelta(days=1)
    else:
        # Mensualidad/quincenal retroactiva: una sola tarifa que cubre desde el primer día vencido
        monto_retro = _obtener_tarifa_por_tipo(cfg, payload.tipo_retroactivo.value)
        fecha_vence_retro = _calcular_fecha_vencimiento(fecha_inicio_retro, payload.tipo_retroactivo.value)

    if monto_retro <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"Tarifa no configurada para el tipo retroactivo '{payload.tipo_retroactivo.value}'."
        )

    susc_retro = models.SuscripcionParqueadero(
        empresa_id          = empresa_id,
        vehiculo_id         = payload.vehiculo_id,
        tipo                = payload.tipo_retroactivo.value,
        fecha_inicio        = fecha_inicio_retro,
        fecha_vencimiento   = fecha_vence_retro,
        monto_total         = monto_retro,
        monto_pagado        = 0.0,
        metodo_pago_inicial = payload.metodo_pago,
        observaciones       = (
            f"Retroactiva: {payload.dias_vencidos_a_cobrar} días vencidos. "
            + (payload.observaciones or "")
        ).strip(),
        es_retroactiva      = True,
        estado              = "vencida" if fecha_vence_retro < hoy else "vigente",
    )
    db.add(susc_retro)
    db.flush()

    # ── 2. Nueva suscripción desde HOY (opcional) ──────────────────────────────
    susc_nueva = None
    monto_nueva = 0.0
    if payload.crear_nueva_desde_hoy and payload.tipo_nueva_suscripcion:
        monto_nueva = _obtener_tarifa_por_tipo(cfg, payload.tipo_nueva_suscripcion.value)
        if monto_nueva <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Tarifa no configurada para '{payload.tipo_nueva_suscripcion.value}'."
            )
        fecha_vence_nueva = _calcular_fecha_vencimiento(hoy, payload.tipo_nueva_suscripcion.value)

        susc_nueva = models.SuscripcionParqueadero(
            empresa_id          = empresa_id,
            vehiculo_id         = payload.vehiculo_id,
            tipo                = payload.tipo_nueva_suscripcion.value,
            fecha_inicio        = hoy,
            fecha_vencimiento   = fecha_vence_nueva,
            monto_total         = monto_nueva,
            monto_pagado        = 0.0,
            metodo_pago_inicial = payload.metodo_pago,
            observaciones       = "Renovación tras pagar deuda atrasada.",
            es_retroactiva      = False,
            estado              = "vigente",
        )
        db.add(susc_nueva)
        db.flush()

    # ── 3. Distribuir el pago: primero retro, luego nueva ──────────────────────
    monto_disponible = payload.monto_pagado_total
    metodo = payload.metodo_pago or "Efectivo"

    if monto_disponible > 0 and susc_retro:
        a_aplicar = min(monto_disponible, susc_retro.monto_total)
        susc_retro.monto_pagado = a_aplicar
        _actualizar_estado_pago(susc_retro)
        db.add(models.PagoParqueadero(
            empresa_id     = empresa_id,
            suscripcion_id = susc_retro.id,
            monto          = a_aplicar,
            metodo_pago    = metodo,
            usuario_id     = usuario_id,
            observaciones  = "Pago de deuda retroactiva",
        ))
        monto_disponible -= a_aplicar

    if monto_disponible > 0 and susc_nueva:
        a_aplicar = min(monto_disponible, susc_nueva.monto_total)
        susc_nueva.monto_pagado = a_aplicar
        _actualizar_estado_pago(susc_nueva)
        db.add(models.PagoParqueadero(
            empresa_id     = empresa_id,
            suscripcion_id = susc_nueva.id,
            monto          = a_aplicar,
            metodo_pago    = metodo,
            usuario_id     = usuario_id,
            observaciones  = "Pago de nueva suscripción",
        ))

    db.commit()
    db.refresh(susc_retro)
    if susc_nueva:
        db.refresh(susc_nueva)

    return {
        "msg": "Suscripción retroactiva procesada correctamente.",
        "suscripcion_retroactiva": _enriquecer_suscripcion(susc_retro),
        "suscripcion_nueva":       _enriquecer_suscripcion(susc_nueva) if susc_nueva else None,
        "total_facturado":         (susc_retro.monto_total + monto_nueva),
        "total_pagado":            payload.monto_pagado_total,
        "saldo_total":             max(0, (susc_retro.monto_total + monto_nueva) - payload.monto_pagado_total),
    }


def cancelar_suscripcion(
    db: Session, empresa_id: int, suscripcion_id: int, motivo: Optional[str] = None
) -> bool:
    susc = db.query(models.SuscripcionParqueadero).filter(
        models.SuscripcionParqueadero.id == suscripcion_id,
        models.SuscripcionParqueadero.empresa_id == empresa_id,
    ).first()
    if not susc:
        return False
    susc.estado = "cancelada"
    if motivo:
        susc.observaciones = (susc.observaciones or "") + f" | Cancelada: {motivo}"
    db.commit()
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# 4. PAGOS / ABONOS
# ═══════════════════════════════════════════════════════════════════════════════

def registrar_pago_suscripcion(
    db: Session, empresa_id: int, usuario_id: int, payload: schemas.PagoParqueaderoCreate
) -> dict:
    """Registra un abono sobre una suscripción existente y recalcula su estado_pago."""
    susc = db.query(models.SuscripcionParqueadero).filter(
        models.SuscripcionParqueadero.id == payload.suscripcion_id,
        models.SuscripcionParqueadero.empresa_id == empresa_id,
    ).first()
    if not susc:
        raise HTTPException(status_code=404, detail="Suscripción no encontrada.")

    saldo = (susc.monto_total or 0) - (susc.monto_pagado or 0)
    if payload.monto > saldo + 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"El abono ({payload.monto}) excede el saldo pendiente ({saldo:.0f})."
        )

    pago = models.PagoParqueadero(
        empresa_id     = empresa_id,
        suscripcion_id = susc.id,
        monto          = payload.monto,
        metodo_pago    = payload.metodo_pago,
        usuario_id     = usuario_id,
        observaciones  = payload.observaciones,
    )
    db.add(pago)

    susc.monto_pagado = (susc.monto_pagado or 0) + payload.monto
    _actualizar_estado_pago(susc)

    db.commit()
    db.refresh(susc)

    # Registrar el pago como Venta para consolidación financiera
    import models as _models
    placa_susc = susc.vehiculo.placa if susc.vehiculo else ""
    venta_parq = _models.Venta(
        empresa_id  = empresa_id,
        total       = payload.monto,
        monto_pagado= payload.monto,
        estado_pago = "pagado",
        metodo_pago = payload.metodo_pago,
        origen      = "parqueadero_suscripcion",
        tipo        = "venta",
        placa_vehiculo = placa_susc,
        fecha_pago  = datetime.now(timezone.utc),
        observaciones = f"Suscripción #{susc.id} | {susc.tipo} | Placa: {placa_susc}",
    )
    db.add(venta_parq)
    db.commit()
    db.refresh(venta_parq)

    # ── Facturación electrónica (suscripción = cliente identificable) ─────────
    # Las suscripciones son contratos recurrentes de monto significativo: se
    # factura individualmente. Si el vehículo tiene cliente con cédula/NIT se
    # emite a su nombre; de lo contrario, a Consumidor Final.
    try:
        from crud import ventas as _crud_ventas
        cliente_fe = susc.vehiculo.cliente if (susc.vehiculo and susc.vehiculo.cliente) else None
        detalle = _crud_ventas._DetalleSintetico(
            descripcion=f"Suscripción parqueadero {susc.tipo} — Placa {placa_susc}",
            monto=float(payload.monto or 0),
        )
        _crud_ventas.emitir_fe_venta(
            db, empresa_id, venta_parq, [detalle], cliente=cliente_fe
        )
        db.commit()
    except Exception:
        import logging as _logging
        _logging.getLogger("crud.parqueadero").exception(
            "Error FE suscripción parqueadero venta %s", venta_parq.id
        )

    susc = (
        db.query(models.SuscripcionParqueadero)
        .options(
            joinedload(models.SuscripcionParqueadero.vehiculo).joinedload(models.Vehiculo.cliente),
            joinedload(models.SuscripcionParqueadero.pagos),
        )
        .filter(models.SuscripcionParqueadero.id == susc.id)
        .first()
    )
    return _enriquecer_suscripcion(susc)
