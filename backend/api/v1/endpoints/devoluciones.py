from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
import models
import schemas
from api.deps import get_db, get_current_active_user

router = APIRouter()

@router.post("/", response_model=schemas.DevolucionOut)
def crear_devolucion(data: schemas.DevolucionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.crear_devolucion(db, empresa_id=current_user.empresa_id, data=data)

@router.get("/venta/{venta_id}", response_model=List[schemas.DevolucionOut])
def get_devoluciones_venta(venta_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.get_devoluciones_by_venta(db, empresa_id=current_user.empresa_id, venta_id=venta_id)
