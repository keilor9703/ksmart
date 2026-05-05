from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date, datetime, timedelta, timezone
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ
from dateutil.relativedelta import relativedelta


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS INTERNOS
# ═══════════════════════════════════════════════════════════════════════════════

def _calcular_fecha_vencimiento(fecha_inicio: date, tipo: str) -> date:
    """
    Calcula la fecha de vencimiento según el tipo de suscripción.
    - mensual:   mismo día del mes siguiente (relativedelta maneja febrero, etc.)
    - quincenal: 15 días exactos
    - diaria:    1 día
    """
    if tipo == "mensual":
        return fecha_inicio + relativedelta(months=+1)
    if tipo == "quincenal":
        return fecha_inicio + timedelta(days=15)
    if tipo == "diaria":
        return fecha_inicio + timedelta(days=1)
    raise ValueError(f"Tipo de suscripción desconocido: {tipo}")


def _obtener_tarifa_por_tipo(config: models.ParqueaderoConfig, tipo: str) -> float:
    """Devuelve la tarifa global configurada para el tipo de suscripción."""
    if tipo == "mensual":
        return config.tarifa_mensual or 0.0
    if tipo == "quincenal":
        return config.tarifa_quincenal or 0.0
    if tipo == "diaria":
        return config.tarifa_diaria or 0.0
    raise ValueError(f"Tipo no válido: {tipo}")


def _actualizar_estado_pago(suscripcion: models.SuscripcionParqueadero):
    """Recalcula estado_pago según monto_pagado vs monto_total."""
    if suscripcion.monto_pagado >= suscripcion.monto_total:
        suscripcion.estado_pago = "pagado"
    elif suscripcion.monto_pagado > 0:
        suscripcion.estado_pago = "parcial"
    else:
        suscripcion.estado_pago = "pendiente"


def _enriquecer_suscripcion(susc: models.SuscripcionParqueadero) -> dict:
    """Convierte una suscripción a dict con campos calculados (saldo, días restantes)."""
    hoy = datetime.now(BOGOTA_TZ).date()
    saldo = max(0.0, (susc.monto_total or 0) - (susc.monto_pagado or 0))
    dias_restantes = (susc.fecha_vencimiento - hoy).days

    pagos_data = []
    for p in (susc.pagos or []):
        pagos_data.append({
            "id":               p.id,
            "suscripcion_id":   p.suscripcion_id,
            "monto":            p.monto,
            "metodo_pago":      p.metodo_pago,
            "fecha":            p.fecha,
            "observaciones":    p.observaciones,
            "usuario_id":       p.usuario_id,
            "usuario_username": p.usuario.username if getattr(p, "usuario", None) else None,
        })

    return {
        "id":                  susc.id,
        "empresa_id":          susc.empresa_id,
        "vehiculo_id":         susc.vehiculo_id,
        "tipo":                susc.tipo,
        "fecha_inicio":        susc.fecha_inicio,
        "fecha_vencimiento":   susc.fecha_vencimiento,
        "monto_total":         susc.monto_total,
        "monto_pagado":        susc.monto_pagado,
        "saldo_pendiente":     saldo,
        "estado_pago":         susc.estado_pago,
        "estado":              susc.estado,
        "metodo_pago_inicial": susc.metodo_pago_inicial,
        "observaciones":       susc.observaciones,
        "es_retroactiva":      susc.es_retroactiva,
        "dias_restantes":      dias_restantes,
        "created_at":          susc.created_at,
        "placa":               susc.vehiculo.placa if susc.vehiculo else None,
        "cliente_nombre":      susc.vehiculo.cliente.nombre if (susc.vehiculo and susc.vehiculo.cliente) else None,
        "pagos":               pagos_data,
    }


def _enriquecer_vehiculo(veh: models.Vehiculo) -> dict:
    """Convierte un vehículo a dict con datos del cliente."""
    return {
        "id":                veh.id,
        "empresa_id":        veh.empresa_id,
        "placa":             veh.placa,
        "cliente_id":        veh.cliente_id,
        "marca":             veh.marca,
        "modelo":            veh.modelo,
        "color":             veh.color,
        "foto_url":          veh.foto_url,
        "observaciones":     veh.observaciones,
        "is_active":         veh.is_active,
        "created_at":        veh.created_at,
        "cliente_nombre":    veh.cliente.nombre if veh.cliente else None,
        "cliente_telefono":  veh.cliente.telefono if veh.cliente else None,
        "cliente_cedula":    veh.cliente.cedula if veh.cliente else None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 1. CONFIG (Tarifas + Cupo)
# ═══════════════════════════════════════════════════════════════════════════════

def get_or_create_parq_config(db: Session, empresa_id: int) -> models.ParqueaderoConfig:
    """Obtiene la config de la empresa, o la crea con valores por defecto."""
    cfg = db.query(models.ParqueaderoConfig).filter(
        models.ParqueaderoConfig.empresa_id == empresa_id
    ).first()
    if cfg:
        return cfg

    cfg = models.ParqueaderoConfig(empresa_id=empresa_id)
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg


def update_parq_config(
    db: Session, empresa_id: int, payload: schemas.ParqueaderoConfigUpdate
) -> models.ParqueaderoConfig:
    cfg = get_or_create_parq_config(db, empresa_id)
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(cfg, k, v)
    cfg.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(cfg)
    return cfg
