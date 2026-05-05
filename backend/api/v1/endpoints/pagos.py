from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud
import models
import schemas
from api.deps import get_db, get_current_active_user

router = APIRouter()

@router.post("/", response_model=schemas.Pago)
def create_pago(pago: schemas.PagoCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    empresa_id = current_user.empresa_id
    db_venta = crud.get_venta(db, empresa_id=empresa_id, venta_id=pago.venta_id)
    if not db_venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    monto_pendiente = db_venta.total - db_venta.monto_pagado
    if pago.monto > monto_pendiente + 0.01:
        raise HTTPException(status_code=400, detail=f"El monto excede el saldo pendiente de {monto_pendiente:.2f}")
    return crud.create_pago(db=db, empresa_id=empresa_id, pago=pago)

@router.get("/", response_model=List[schemas.Pago])
def read_pagos(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    return (
        db.query(models.Pago)
        .filter(models.Pago.empresa_id == current_user.empresa_id)
        .offset(skip)
        .limit(limit)
        .all()
    )

@router.put("/{pago_id}", response_model=schemas.Pago)
def update_pago(pago_id: int, pago: schemas.PagoUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    db_pago = crud.update_pago(db, empresa_id=current_user.empresa_id, pago_id=pago_id, pago=pago)
    if db_pago is None:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return db_pago
