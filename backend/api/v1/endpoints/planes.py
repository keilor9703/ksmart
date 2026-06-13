from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_

import models, schemas
from api.deps import get_db, get_current_user

router = APIRouter()


@router.get("/planes-activos", response_model=List[schemas.PlanSuscripcionOut])
def listar_planes_activos(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Devuelve los planes visibles para la empresa del usuario autenticado:
    - Planes públicos (empresa_id_exclusivo IS NULL)
    - Planes privados asignados a su empresa
    """
    empresa_id = current_user.empresa_id
    planes = (
        db.query(models.PlanSuscripcion)
        .filter(
            models.PlanSuscripcion.is_active == True,
            or_(
                models.PlanSuscripcion.empresa_id_exclusivo.is_(None),
                models.PlanSuscripcion.empresa_id_exclusivo == empresa_id,
            ),
        )
        .order_by(models.PlanSuscripcion.precio)
        .all()
    )
    return [schemas.PlanSuscripcionOut.from_orm_with_empresa(p) for p in planes]
