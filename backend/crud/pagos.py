from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from fastapi import HTTPException
import models, schemas
from crud.ventas import get_venta

# ═══════════════════════════════════════════════════════════════════════════════
# PAGOS
# ═══════════════════════════════════════════════════════════════════════════════

def _acreditar_puntos_si_quedo_pagada(db: Session, empresa_id: int, db_venta: models.Venta, ya_estaba_pagada: bool):
    """Una venta a crédito (fiado) no gana puntos al crearse — solo cuando el
    cliente termina de pagarla (aquí, vía un abono que la deja en "pagado").
    Sin esto el cliente nunca acumulaba puntos de esas ventas, y el
    comprobante mostraba "Puntos ganados" vacío o desactualizado aunque la
    venta ya estuviera saldada. Se protege con `ya_estaba_pagada` para no
    volver a acreditar si se llama más de una vez sobre la misma venta."""
    if ya_estaba_pagada or db_venta.estado_pago != "pagado" or not db_venta.cliente_id:
        return
    if db_venta.puntos_ganados:  # ya se acreditaron antes (defensivo)
        return
    try:
        empresa_obj = db.query(models.Empresa).filter_by(id=empresa_id).first()
        fidel_activa = getattr(empresa_obj, "fidelizacion_activa", True)
        if fidel_activa is None:
            fidel_activa = True
        if not fidel_activa:
            return
        from crud.puntos import ganar_puntos_venta
        earn_rate = getattr(empresa_obj, "fidelizacion_earn_rate", 1000) or 1000
        puntos_ganados = ganar_puntos_venta(
            db, empresa_id=empresa_id, cliente_id=db_venta.cliente_id,
            total_venta=float(db_venta.total or 0), venta_id=db_venta.id,
            earn_rate=earn_rate, commit=False,
        )
        db_venta.puntos_ganados = puntos_ganados
        db.flush()
        cliente = db.query(models.Cliente).filter_by(id=db_venta.cliente_id).first()
        db_venta.saldo_puntos_cliente = cliente.puntos_fidelidad if cliente else None
        db.add(db_venta)
        db.commit()
        db.refresh(db_venta)
    except Exception:
        db.rollback()  # los puntos son secundarios; nunca deben romper el registro del pago


def create_pago(db: Session, empresa_id: int, pago: schemas.PagoCreate):
    db_venta = get_venta(db, empresa_id, pago.venta_id)
    if not db_venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    ya_estaba_pagada = db_venta.estado_pago == "pagado"

    db_pago = models.Pago(**pago.dict(), empresa_id=empresa_id)
    db.add(db_pago)
    db.flush()

    # ✅ FIX: Calcular el total consultando directamente a la base de datos
    total_pagado_venta = db.query(func.sum(models.Pago.monto)).filter(
        models.Pago.venta_id == db_venta.id
    ).scalar() or 0.0

    db_venta.monto_pagado = total_pagado_venta

    if db_venta.monto_pagado >= db_venta.total:
        db_venta.estado_pago = "pagado"
    elif db_venta.monto_pagado > 0:
        db_venta.estado_pago = "parcial"
    else:
        db_venta.estado_pago = "pendiente"

    db.commit()
    db.refresh(db_venta)

    # Al quedar pagada la venta, generar su asiento (idempotente)
    if db_venta.estado_pago == "pagado":
        from services.contabilidad import registrar_asiento_venta
        try:
            registrar_asiento_venta(db, db_venta)
            db.commit()
        except Exception:
            db.rollback()  # el backfill diario recupera el asiento

    _acreditar_puntos_si_quedo_pagada(db, empresa_id, db_venta, ya_estaba_pagada)
    return db_pago

def get_pago(db: Session, empresa_id: int, pago_id: int):
    return db.query(models.Pago).join(models.Venta).filter(
        models.Pago.id == pago_id,
        models.Venta.empresa_id == empresa_id
    ).first()

def update_pago(db: Session, empresa_id: int, pago_id: int, pago: schemas.PagoUpdate):
    db_pago = get_pago(db, empresa_id, pago_id)
    if db_pago:
        for key, value in pago.dict(exclude_unset=True).items():
            setattr(db_pago, key, value)
        db.commit()
        db.refresh(db_pago)

        db_venta = get_venta(db, empresa_id, db_pago.venta_id)
        if db_venta:
            ya_estaba_pagada = db_venta.estado_pago == "pagado"
            total_pagado_venta = sum(p.monto for p in db_venta.pagos)
            db_venta.monto_pagado = total_pagado_venta

            if db_venta.monto_pagado >= db_venta.total:
                db_venta.estado_pago = "pagado"
            elif db_venta.monto_pagado > 0:
                db_venta.estado_pago = "parcial"
            else:
                db_venta.estado_pago = "pendiente"
            db.commit()
            db.refresh(db_venta)
            _acreditar_puntos_si_quedo_pagada(db, empresa_id, db_venta, ya_estaba_pagada)
    return db_pago
