from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from fastapi import HTTPException
import models, schemas
from crud.ventas import get_venta

# ═══════════════════════════════════════════════════════════════════════════════
# PAGOS
# ═══════════════════════════════════════════════════════════════════════════════

def create_pago(db: Session, empresa_id: int, pago: schemas.PagoCreate):
    db_venta = get_venta(db, empresa_id, pago.venta_id)
    if not db_venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

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
    return db_pago
