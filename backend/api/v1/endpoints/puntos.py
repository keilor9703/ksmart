from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas
from database import get_db
from api.v1.endpoints.auth import get_current_active_user
from crud.puntos import (
    get_puntos_disponibles, canjear_puntos, get_historial_puntos,
    REDEEM_RATE, EARN_RATE,
)

router = APIRouter()


@router.get("/{cliente_id}/puntos")
def leer_puntos(
    cliente_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    empresa_id = current_user.empresa_id
    puntos = get_puntos_disponibles(db, empresa_id, cliente_id)
    return {
        "cliente_id": cliente_id,
        "puntos_disponibles": puntos,
        "descuento_maximo": puntos * REDEEM_RATE,
        "earn_rate": EARN_RATE,
        "redeem_rate": REDEEM_RATE,
    }


@router.get("/{cliente_id}/puntos/historial", response_model=List[schemas.MovimientoPuntosOut])
def historial_puntos(
    cliente_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return get_historial_puntos(db, current_user.empresa_id, cliente_id)


@router.post("/{cliente_id}/puntos/canjear")
def canjear(
    cliente_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    puntos_a_canjear = int(payload.get("puntos", 0))
    if puntos_a_canjear <= 0:
        raise HTTPException(status_code=400, detail="Puntos inválidos.")
    try:
        descuento = canjear_puntos(db, current_user.empresa_id, cliente_id, puntos_a_canjear)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"descuento_aplicado": descuento, "puntos_canjeados": puntos_a_canjear}
