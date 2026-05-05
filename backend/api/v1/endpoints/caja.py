from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
import models
import schemas
from api.deps import get_db, get_current_active_user

router = APIRouter()

@router.post("/corte", response_model=schemas.CorteCajaOut)
def crear_corte_caja(data: schemas.CorteCajaCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.crear_corte_caja(db, empresa_id=current_user.empresa_id, usuario_id=current_user.id, efectivo_fisico=data.efectivo_fisico, observaciones=data.observaciones)

@router.get("/cortes", response_model=List[schemas.CorteCajaOut])
def listar_cortes(skip: int = 0, limit: int = 30, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.get_cortes_caja(db, empresa_id=current_user.empresa_id, skip=skip, limit=limit)

@router.get("/corte/preview")
def preview_corte(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.calcular_totales_dia(db, empresa_id=current_user.empresa_id)

@router.post("/gastos", response_model=schemas.GastoOut)
def registrar_gasto(data: schemas.GastoCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.crear_gasto(db, empresa_id=current_user.empresa_id, usuario_id=current_user.id, data=data)

@router.get("/gastos", response_model=List[schemas.GastoOut])
def listar_gastos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.get_gastos(db, empresa_id=current_user.empresa_id, skip=skip, limit=limit)
