from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud, schemas
from api.deps import get_db

router = APIRouter()

@router.get("/planes-activos", response_model=List[schemas.PlanSuscripcionOut])
def listar_planes_activos(db: Session = Depends(get_db)):
    """
    Endpoint público (solo requiere token de usuario activo) 
    para listar los planes que están marcados como is_active=True.
    """
    return crud.get_planes(db, include_inactive=False)
