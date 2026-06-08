from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional, List
from datetime import date, datetime, timedelta, timezone
from fastapi import HTTPException
import math
import models, schemas
from crud.common import BOGOTA_TZ, get_utc_boundaries
from crud.parqueadero.config import get_or_create_parq_config
from crud.parqueadero.vehiculos import get_vehiculo, get_vehiculo_por_placa
from crud.parqueadero.config import _enriquecer_vehiculo, _enriquecer_suscripcion
from crud.parqueadero.suscripciones import get_suscripcion_activa, list_todas_suscripciones


def _calcular_monto_estimado(cfg, minutos_reales: int) -> tuple[int, int]:
    """
    Devuelve (minutos_cobrar, monto_estimado) respetando el modo activo:
    tarifa plena o tarifa por minuto.
    """
    cobro_minimo = cfg.cobro_minimo_minutos or 0
    minutos_cobrar = max(minutos_reales, cobro_minimo) if cobro_minimo > 0 else minutos_reales

    if getattr(cfg, 'usar_tarifa_plena', False):
        umbral       = max(1, cfg.fraccion_minutos or 480)
        tarifa_plena = cfg.tarifa_plena or 0.0
        tarifa_min   = cfg.tarifa_minuto or 0.0
        periodos = minutos_cobrar // umbral
        resto    = minutos_cobrar % umbral
        costo_resto = min(resto * tarifa_min, tarifa_plena)
        monto    = round(periodos * tarifa_plena + costo_resto)
    else:
        monto = round(minutos_cobrar * (cfg.tarifa_minuto or 0))

    return minutos_cobrar, monto


def buscar_por_placa(db: Session, empresa_id: int, placa: str) -> dict:
    """
    EL endpoint más usado del sistema. En una sola llamada decide qué mostrar.

    🛠️ FIX BUG #2: Si el vehículo está dado de baja, lo trata como "no registrado"
    para que el operario pueda registrarlo de nuevo o cobrarlo por horas como
    cliente ocasional. (Antes lo trataba como activo causando inconsistencias).

    Casos:
      - vehiculo_al_dia          → 🟢 verde, "ENTRA"
      - vehiculo_vencido         → 🔴 rojo, ofrecer cobrar
      - vehiculo_sin_susc        → 🟡 amarillo, registrar nueva suscripción
      - vehiculo_no_registrado   → 🔵 azul, ofrecer registrar o cobrar por horas
      - tiene_acceso_abierto     → ⚫ gris, ofrecer registrar salida
    """
    placa_norm = placa.strip().upper().replace(" ", "").replace("-", "")
    hoy = datetime.now(BOGOTA_TZ).date()

    # 1. ¿Tiene acceso por horas/minutos abierto? (no depende de is_active)
    acceso_abierto = db.query(models.AccesoParqueadero).filter(
        models.AccesoParqueadero.empresa_id == empresa_id,
        models.AccesoParqueadero.placa == placa_norm,
        models.AccesoParqueadero.estado == "dentro",
    ).first()

    if acceso_abierto:
        cfg = get_or_create_parq_config(db, empresa_id)
        ahora_utc = datetime.now(timezone.utc)
        entrada = acceso_abierto.fecha_entrada
        if entrada.tzinfo is None:
            entrada = entrada.replace(tzinfo=timezone.utc)

        delta = ahora_utc - entrada
        minutos_reales = max(1, int(round(delta.total_seconds() / 60)))

        minutos_cobrar, monto_estim = _calcular_monto_estimado(cfg, minutos_reales)
        horas_display = round(minutos_cobrar / 60, 2)
        cobro_minimo = cfg.cobro_minimo_minutos or 0

        return {
            "tipo_resultado":      "tiene_acceso_abierto",
            "placa":               placa_norm,
            "acceso_abierto":      acceso_abierto,
            "horas_transcurridas": horas_display,
            "monto_estimado":      monto_estim,
            "mensaje":             (
                f"Esta moto está dentro hace {minutos_reales} min "
                f"({horas_display:.1f}h). Cobro: ${monto_estim:,.0f}"
                + (f" (mínimo {cobro_minimo} min)" if minutos_reales < cobro_minimo and cobro_minimo > 0 else "")
            ),
            "color_semaforo":      "gris",
        }

    # 2. ¿El vehículo está registrado? (incluyendo los dados de baja)
    veh = get_vehiculo_por_placa(db, empresa_id, placa_norm)

    # 🛠️ FIX BUG #2: Si NO existe, O si existe pero está dado de baja, tratar igual
    if not veh or not veh.is_active:
        # Mensaje distinto si la moto fue dada de baja antes (para contexto al operario)
        if veh and not veh.is_active:
            mensaje = (
                f"Esta placa estaba registrada a nombre de {veh.cliente.nombre if veh.cliente else 'cliente anterior'} "
                f"pero fue dada de baja. ¿Registrar de nuevo o cobrar por horas?"
            )
        else:
            mensaje = "Placa no registrada. ¿Registrar moto nueva o cobrar por horas?"

        return {
            "tipo_resultado":  "vehiculo_no_registrado",
            "placa":           placa_norm,
            "mensaje":         mensaje,
            "color_semaforo":  "azul",
        }

    veh_dict = _enriquecer_vehiculo(veh)

    # 3. ¿Tiene suscripción activa?
    susc = get_suscripcion_activa(db, empresa_id, veh.id)

    if not susc:
        return {
            "tipo_resultado":  "vehiculo_sin_susc",
            "placa":           placa_norm,
            "vehiculo":        veh_dict,
            "mensaje":         f"{veh.cliente.nombre} ({placa_norm}) está registrado pero no tiene suscripción activa. Registrar pago.",
            "color_semaforo":  "amarillo",
        }

    susc_dict = _enriquecer_suscripcion(susc)

    # 4. ¿Está vigente o vencida?
    if susc.fecha_vencimiento >= hoy:
        dias_restantes = (susc.fecha_vencimiento - hoy).days
        return {
            "tipo_resultado":     "vehiculo_al_dia",
            "placa":              placa_norm,
            "vehiculo":           veh_dict,
            "suscripcion_actual": susc_dict,
            "fecha_vencimiento":  susc.fecha_vencimiento,
            "mensaje":            (
                f"✅ {veh.cliente.nombre} · Mensualidad vigente · "
                f"Vence en {dias_restantes} día{'s' if dias_restantes != 1 else ''} ({susc.fecha_vencimiento.strftime('%d/%m/%Y')}). ENTRA."
            ),
            "color_semaforo":     "verde" if dias_restantes > 5 else "amarillo",
        }
    else:
        dias_vencido = (hoy - susc.fecha_vencimiento).days
        return {
            "tipo_resultado":     "vehiculo_vencido",
            "placa":              placa_norm,
            "vehiculo":           veh_dict,
            "suscripcion_actual": susc_dict,
            "dias_vencido":       dias_vencido,
            "fecha_vencimiento":  susc.fecha_vencimiento,
            "mensaje":            (
                f"⚠️ {veh.cliente.nombre} · Mensualidad VENCIDA hace {dias_vencido} día{'s' if dias_vencido != 1 else ''}. "
                f"¿Cómo quiere cobrar?"
            ),
            "color_semaforo":     "rojo",
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 4. NUEVA — get_baja_info (preview antes de dar de baja)
# ═══════════════════════════════════════════════════════════════════════════════

def get_baja_info(db: Session, empresa_id: int, vehiculo_id: int) -> dict:
    """
    Devuelve un análisis estructurado de qué se vería afectado al dar de baja
    este vehículo. El frontend usa esto para mostrar checkboxes en el diálogo.
    """
    veh = get_vehiculo(db, empresa_id, vehiculo_id)
    if not veh:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")
    if not veh.is_active:
        raise HTTPException(
            status_code=400,
            detail="Este vehículo ya está dado de baja."
        )

    hoy = datetime.now(BOGOTA_TZ).date()

    # Suscripciones NO canceladas (activas o vencidas con saldo)
    suscripciones = (
        db.query(models.SuscripcionParqueadero)
        .filter(
            models.SuscripcionParqueadero.empresa_id == empresa_id,
            models.SuscripcionParqueadero.vehiculo_id == vehiculo_id,
            models.SuscripcionParqueadero.estado != "cancelada",
        )
        .all()
    )

    # Solo mostrar las relevantes: vigentes o con saldo pendiente
    suscripciones_relevantes = []
    for s in suscripciones:
        saldo = max(0.0, (s.monto_total or 0) - (s.monto_pagado or 0))
        es_vigente = s.fecha_vencimiento >= hoy
        # Mostrar si está vigente O si tiene saldo pendiente
        if es_vigente or saldo > 0:
            suscripciones_relevantes.append({
                "id":                s.id,
                "tipo":              s.tipo,
                "fecha_vencimiento": s.fecha_vencimiento,
                "monto_total":       s.monto_total or 0,
                "monto_pagado":      s.monto_pagado or 0,
                "saldo_pendiente":   saldo,
                "dias_para_vencer":  (s.fecha_vencimiento - hoy).days,
                "es_vigente":        es_vigente,
            })

    # Accesos por horas abiertos
    accesos = db.query(models.AccesoParqueadero).filter(
        models.AccesoParqueadero.empresa_id == empresa_id,
        models.AccesoParqueadero.vehiculo_id == vehiculo_id,
        models.AccesoParqueadero.estado == "dentro",
    ).all()

    cfg = get_or_create_parq_config(db, empresa_id)
    accesos_data = []
    for a in accesos:
        ahora_utc = datetime.now(timezone.utc)
        entrada = a.fecha_entrada
        if entrada.tzinfo is None:
            entrada = entrada.replace(tzinfo=timezone.utc)
        delta = ahora_utc - entrada
        minutos_reales = max(1, int(round(delta.total_seconds() / 60)))
        _, monto_estim = _calcular_monto_estimado(cfg, minutos_reales)

        accesos_data.append({
            "id":              a.id,
            "fecha_entrada":   a.fecha_entrada,
            "minutos_dentro":  minutos_reales,
            "monto_estimado":  monto_estim,
        })

    # Calcular saldo total
    saldo_total = sum(s["saldo_pendiente"] for s in suscripciones_relevantes)

    # Construir advertencias legibles
    advertencias = []
    if suscripciones_relevantes:
        cnt = len(suscripciones_relevantes)
        advertencias.append(
            f"Tiene {cnt} suscripción{'es' if cnt > 1 else ''} activa{'s' if cnt > 1 else ''}"
            + (f" con saldo pendiente de ${saldo_total:,.0f}" if saldo_total > 0 else "")
        )
    if accesos_data:
        cnt = len(accesos_data)
        advertencias.append(
            f"Tiene {cnt} acceso{'s' if cnt > 1 else ''} por horas abierto{'s' if cnt > 1 else ''}"
        )

    puede_directo = len(suscripciones_relevantes) == 0 and len(accesos_data) == 0

    return {
        "vehiculo_id":            veh.id,
        "placa":                  veh.placa,
        "cliente_nombre":         veh.cliente.nombre if veh.cliente else None,
        "cliente_cedula":         veh.cliente.cedula if veh.cliente else None,
        "suscripciones_activas":  suscripciones_relevantes,
        "accesos_abiertos":       accesos_data,
        "saldo_total_pendiente":  saldo_total,
        "puede_dar_baja_directo": puede_directo,
        "advertencias":           advertencias,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 7. DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════
def get_dashboard_parqueadero(db: Session, empresa_id: int) -> dict:
    """
    Resumen completo para la pantalla principal del operario.

    🛠️ FIX BUG #2: TODAS las queries ahora hacen JOIN con Vehiculo y filtran
    por is_active=True para no contar suscripciones huérfanas o de motos
    dadas de baja.
    """
    hoy = datetime.now(BOGOTA_TZ).date()
    inicio_hoy_utc, fin_hoy_utc = get_utc_boundaries(hoy)
    inicio_semana = hoy - timedelta(days=hoy.weekday())
    inicio_mes    = hoy.replace(day=1)
    inicio_sem_utc, _ = get_utc_boundaries(inicio_semana)
    inicio_mes_utc, _ = get_utc_boundaries(inicio_mes)

    cfg = get_or_create_parq_config(db, empresa_id)

    # ── Cupo (FIX: solo de vehículos activos) ─────────────────────────────────
    mensualidades_activas = (
        db.query(models.SuscripcionParqueadero)
        .join(models.Vehiculo, models.SuscripcionParqueadero.vehiculo_id == models.Vehiculo.id)
        .filter(
            models.SuscripcionParqueadero.empresa_id == empresa_id,
            models.SuscripcionParqueadero.estado == "vigente",
            models.SuscripcionParqueadero.fecha_vencimiento >= hoy,
            models.Vehiculo.is_active == True,   # 🛠️ FIX
        )
        .count()
    )

    accesos_dentro_count = db.query(models.AccesoParqueadero).filter(
        models.AccesoParqueadero.empresa_id == empresa_id,
        models.AccesoParqueadero.estado == "dentro",
    ).count()

    cupo_ocupado = mensualidades_activas + accesos_dentro_count
    cupo_disp    = max(0, (cfg.cupo_total or 0) - cupo_ocupado)
    pct_ocup     = round((cupo_ocupado / cfg.cupo_total * 100), 1) if (cfg.cupo_total or 0) > 0 else 0.0

    # ── Vencimientos ──────────────────────────────────────────────────────────
    en_5_dias = hoy + timedelta(days=5)

    por_vencer_q = (
        db.query(models.SuscripcionParqueadero)
        .join(models.Vehiculo, models.SuscripcionParqueadero.vehiculo_id == models.Vehiculo.id)
        .options(joinedload(models.SuscripcionParqueadero.vehiculo).joinedload(models.Vehiculo.cliente))
        .filter(
            models.SuscripcionParqueadero.empresa_id == empresa_id,
            models.SuscripcionParqueadero.estado != "cancelada",
            models.SuscripcionParqueadero.fecha_vencimiento >= hoy,
            models.SuscripcionParqueadero.fecha_vencimiento <= en_5_dias,
            models.Vehiculo.is_active == True,   # 🛠️ FIX
        )
        .order_by(models.SuscripcionParqueadero.fecha_vencimiento.asc())
        .all()
    )
    proximos_vencimientos = [
        {
            "suscripcion_id":  s.id,
            "vehiculo_id":     s.vehiculo_id,
            "placa":           s.vehiculo.placa if s.vehiculo else "—",
            "propietario":     s.vehiculo.cliente.nombre if (s.vehiculo and s.vehiculo.cliente) else "—",
            "telefono":        s.vehiculo.cliente.telefono if (s.vehiculo and s.vehiculo.cliente) else None,
            "fecha_vence":     s.fecha_vencimiento,
            "dias_restantes":  (s.fecha_vencimiento - hoy).days,
            "tipo":            s.tipo,
        }
        for s in por_vencer_q
    ]

    vencidas_q = (
        db.query(models.SuscripcionParqueadero)
        .join(models.Vehiculo, models.SuscripcionParqueadero.vehiculo_id == models.Vehiculo.id)
        .options(joinedload(models.SuscripcionParqueadero.vehiculo).joinedload(models.Vehiculo.cliente))
        .filter(
            models.SuscripcionParqueadero.empresa_id == empresa_id,
            models.SuscripcionParqueadero.estado != "cancelada",
            models.SuscripcionParqueadero.fecha_vencimiento < hoy,
            models.Vehiculo.is_active == True,   # 🛠️ FIX
        )
        .order_by(models.SuscripcionParqueadero.fecha_vencimiento.desc())
        .limit(50)
        .all()
    )

    # Filtrar las que NO han sido reemplazadas por una nueva vigente
    suscripciones_vencidas = []
    for s in vencidas_q:
        nueva = (
            db.query(models.SuscripcionParqueadero)
            .filter(
                models.SuscripcionParqueadero.empresa_id == empresa_id,
                models.SuscripcionParqueadero.vehiculo_id == s.vehiculo_id,
                models.SuscripcionParqueadero.fecha_vencimiento >= hoy,
                models.SuscripcionParqueadero.estado != "cancelada",
            ).first()
        )
        if not nueva:
            suscripciones_vencidas.append({
                "suscripcion_id": s.id,
                "vehiculo_id":    s.vehiculo_id,
                "placa":          s.vehiculo.placa if s.vehiculo else "—",
                "propietario":    s.vehiculo.cliente.nombre if (s.vehiculo and s.vehiculo.cliente) else "—",
                "telefono":       s.vehiculo.cliente.telefono if (s.vehiculo and s.vehiculo.cliente) else None,
                "fecha_vence":    s.fecha_vencimiento,
                "dias_vencido":   (hoy - s.fecha_vencimiento).days,
                "tipo":           s.tipo,
            })

    # ── Ingresos (sin cambios — los pagos pasados deben contar siempre) ──────
    def _ingresos_rango(utc_start, utc_end):
        susc_total = db.query(func.sum(models.PagoParqueadero.monto)).filter(
            models.PagoParqueadero.empresa_id == empresa_id,
            models.PagoParqueadero.fecha >= utc_start,
            models.PagoParqueadero.fecha <= utc_end,
        ).scalar() or 0.0

        acc_total = db.query(func.sum(models.AccesoParqueadero.monto_cobrado)).filter(
            models.AccesoParqueadero.empresa_id == empresa_id,
            models.AccesoParqueadero.estado == "salio",
            models.AccesoParqueadero.fecha_salida >= utc_start,
            models.AccesoParqueadero.fecha_salida <= utc_end,
        ).scalar() or 0.0

        return float(susc_total) + float(acc_total)

    ingresos_hoy    = _ingresos_rango(inicio_hoy_utc, fin_hoy_utc)
    ingresos_semana = _ingresos_rango(inicio_sem_utc, fin_hoy_utc)
    ingresos_mes    = _ingresos_rango(inicio_mes_utc, fin_hoy_utc)

    # ── Accesos dentro (motos por horas) ──────────────────────────────────────
    accesos_dentro = db.query(models.AccesoParqueadero).filter(
        models.AccesoParqueadero.empresa_id == empresa_id,
        models.AccesoParqueadero.estado == "dentro",
    ).order_by(models.AccesoParqueadero.fecha_entrada.asc()).all()

    # ── Total vehículos (ya filtraba bien) ────────────────────────────────────
    total_veh = db.query(models.Vehiculo).filter(
        models.Vehiculo.empresa_id == empresa_id,
        models.Vehiculo.is_active == True,
    ).count()

    return {
        "cupo_total":               cfg.cupo_total or 0,
        "cupo_ocupado_estimado":    cupo_ocupado,
        "cupo_disponible":          cupo_disp,
        "porcentaje_ocupacion":     pct_ocup,
        "mensualidades_activas":    mensualidades_activas,
        "por_vencer_5_dias":        len(proximos_vencimientos),
        "vencidas":                 len(suscripciones_vencidas),
        "ingresos_hoy":             ingresos_hoy,
        "ingresos_semana":          ingresos_semana,
        "ingresos_mes":             ingresos_mes,
        "proximos_vencimientos":    proximos_vencimientos,
        "suscripciones_vencidas":   suscripciones_vencidas,
        "accesos_dentro":           accesos_dentro,
        "total_vehiculos":          total_veh,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 8. REPORTES
# ═══════════════════════════════════════════════════════════════════════════════

def reporte_ingresos_parqueadero(
    db: Session, empresa_id: int, start_date: date, end_date: date
) -> dict:
    utc_start, _ = get_utc_boundaries(start_date)
    _, utc_end   = get_utc_boundaries(end_date)

    # ── Pagos de suscripciones ────────────────────────────────────────────────
    pagos = (
        db.query(models.PagoParqueadero)
        .options(joinedload(models.PagoParqueadero.suscripcion))
        .filter(
            models.PagoParqueadero.empresa_id == empresa_id,
            models.PagoParqueadero.fecha >= utc_start,
            models.PagoParqueadero.fecha <= utc_end,
        )
        .all()
    )

    # ── Accesos por horas cerrados ────────────────────────────────────────────
    accesos = db.query(models.AccesoParqueadero).filter(
        models.AccesoParqueadero.empresa_id == empresa_id,
        models.AccesoParqueadero.estado == "salio",
        models.AccesoParqueadero.fecha_salida >= utc_start,
        models.AccesoParqueadero.fecha_salida <= utc_end,
    ).all()

    # ── Agregaciones ──────────────────────────────────────────────────────────
    desglose_dia = {}
    desglose_metodo = {}
    desglose_tipo = {"mensual": 0.0, "quincenal": 0.0, "diaria": 0.0, "por_horas": 0.0}
    total_general = 0.0

    def _key_dia(dt) -> str:
        return dt.astimezone(BOGOTA_TZ).date().isoformat()

    for p in pagos:
        k = _key_dia(p.fecha)
        if k not in desglose_dia:
            desglose_dia[k] = {"total_suscripciones": 0.0, "total_horas": 0.0, "cantidad_pagos": 0}
        desglose_dia[k]["total_suscripciones"] += p.monto
        desglose_dia[k]["cantidad_pagos"]      += 1
        total_general += p.monto
        desglose_metodo[p.metodo_pago] = desglose_metodo.get(p.metodo_pago, 0.0) + p.monto
        if p.suscripcion:
            tipo = p.suscripcion.tipo
            if tipo in desglose_tipo:
                desglose_tipo[tipo] += p.monto

    for a in accesos:
        k = _key_dia(a.fecha_salida)
        if k not in desglose_dia:
            desglose_dia[k] = {"total_suscripciones": 0.0, "total_horas": 0.0, "cantidad_pagos": 0}
        desglose_dia[k]["total_horas"]    += (a.monto_cobrado or 0)
        desglose_dia[k]["cantidad_pagos"] += 1
        total_general += (a.monto_cobrado or 0)
        if a.metodo_pago:
            desglose_metodo[a.metodo_pago] = desglose_metodo.get(a.metodo_pago, 0.0) + (a.monto_cobrado or 0)
        desglose_tipo["por_horas"] += (a.monto_cobrado or 0)

    # ── Construir lista ordenada ──────────────────────────────────────────────
    desglose_list = []
    cur = start_date
    while cur <= end_date:
        k = cur.isoformat()
        d = desglose_dia.get(k, {"total_suscripciones": 0.0, "total_horas": 0.0, "cantidad_pagos": 0})
        desglose_list.append({
            "fecha":               cur,
            "total_suscripciones": d["total_suscripciones"],
            "total_horas":         d["total_horas"],
            "total_general":       d["total_suscripciones"] + d["total_horas"],
            "cantidad_pagos":      d["cantidad_pagos"],
        })
        cur += timedelta(days=1)

    return {
        "start_date":          start_date,
        "end_date":            end_date,
        "total_general":       round(total_general, 2),
        "desglose_por_dia":    desglose_list,
        "desglose_por_metodo": {k: round(v, 2) for k, v in desglose_metodo.items()},
        "desglose_por_tipo":   {k: round(v, 2) for k, v in desglose_tipo.items()},
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 9. NOTIFICACIONES AUTOMÁTICAS DE VENCIMIENTO (cron diario)
# ═══════════════════════════════════════════════════════════════════════════════

def notificar_vencimientos_parqueadero(db: Session) -> int:
    """
    Genera notificaciones para admins de empresas con tipo 'parqueadero'
    sobre suscripciones que vencen en ≤5 días o ya vencidas.
    Llamar diariamente desde un cron job.
    """
    hoy = datetime.now(BOGOTA_TZ).date()
    en_5_dias = hoy + timedelta(days=5)
    total_creadas = 0

    empresas = db.query(models.Empresa).filter(models.Empresa.is_active == True).all()

    for empresa in empresas:
        # Solo procesar empresas con módulo de parqueadero habilitado
        modulos = empresa.modulos_habilitados or []
        if "/parqueadero" not in modulos:
            continue

        por_vencer = db.query(models.SuscripcionParqueadero).filter(
            models.SuscripcionParqueadero.empresa_id == empresa.id,
            models.SuscripcionParqueadero.estado != "cancelada",
            models.SuscripcionParqueadero.fecha_vencimiento >= hoy,
            models.SuscripcionParqueadero.fecha_vencimiento <= en_5_dias,
        ).count()

        vencidas = db.query(models.SuscripcionParqueadero).filter(
            models.SuscripcionParqueadero.empresa_id == empresa.id,
            models.SuscripcionParqueadero.estado != "cancelada",
            models.SuscripcionParqueadero.fecha_vencimiento < hoy,
        ).count()

        if por_vencer == 0 and vencidas == 0:
            continue

        admins = db.query(models.User).join(models.Role).filter(
            models.User.empresa_id == empresa.id,
            models.Role.name == "Admin",
            models.User.is_active == True,
        ).all()

        for admin in admins:
            if vencidas > 0:
                db.add(models.Notificacion(
                    usuario_id = admin.id,
                    empresa_id = empresa.id,
                    mensaje    = f"🔴 Tienes {vencidas} mensualidad(es) VENCIDA(S) en el parqueadero.",
                    tipo       = "error",
                    leido      = False,
                ))
                total_creadas += 1
            if por_vencer > 0:
                db.add(models.Notificacion(
                    usuario_id = admin.id,
                    empresa_id = empresa.id,
                    mensaje    = f"🟡 {por_vencer} mensualidad(es) vence(n) en los próximos 5 días.",
                    tipo       = "warning",
                    leido      = False,
                ))
                total_creadas += 1

    db.commit()
    return total_creadas
