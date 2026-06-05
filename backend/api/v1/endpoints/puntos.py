from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas
from api.deps import get_db, get_current_active_user
from crud.puntos import (
    get_puntos_disponibles, canjear_puntos, get_historial_puntos,
    REDEEM_RATE, EARN_RATE,
)

router = APIRouter()


def _get_empresa_rates(db: Session, empresa_id: int):
    empresa = db.query(models.Empresa).filter_by(id=empresa_id).first()
    earn_rate   = getattr(empresa, "fidelizacion_earn_rate",   EARN_RATE)   or EARN_RATE
    redeem_rate = getattr(empresa, "fidelizacion_redeem_rate", REDEEM_RATE) or REDEEM_RATE
    activa = getattr(empresa, "fidelizacion_activa", True)
    return earn_rate, redeem_rate, (activa if activa is not None else True)


@router.get("/{cliente_id}/puntos")
def leer_puntos(
    cliente_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    empresa_id = current_user.empresa_id
    earn_rate, redeem_rate, fidelizacion_activa = _get_empresa_rates(db, empresa_id)
    puntos = get_puntos_disponibles(db, empresa_id, cliente_id)
    return {
        "cliente_id":          cliente_id,
        "puntos_disponibles":  puntos,
        "descuento_maximo":    puntos * redeem_rate,
        "earn_rate":           earn_rate,
        "redeem_rate":         redeem_rate,
        "fidelizacion_activa": fidelizacion_activa,
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
    _, redeem_rate, _ = _get_empresa_rates(db, current_user.empresa_id)
    try:
        descuento = canjear_puntos(db, current_user.empresa_id, cliente_id,
                                   puntos_a_canjear, redeem_rate=redeem_rate)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"descuento_aplicado": descuento, "puntos_canjeados": puntos_a_canjear}
