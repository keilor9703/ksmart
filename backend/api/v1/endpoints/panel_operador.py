from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud, models, schemas
from api.deps import get_db, get_current_active_user

router = APIRouter()


@router.get("/pendientes")
def pendientes_operador(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_ordenes_pendientes_operador(
        db, empresa_id=current_user.empresa_id, operador_id=current_user.id,
    )


@router.get("/productividad")
def productividad_operador(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_productividad_operador(
        db, empresa_id=current_user.empresa_id, operador_id=current_user.id,
    )


@router.get("/historial")
def historial_operador(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_historial_reciente_operador(
        db, empresa_id=current_user.empresa_id, operador_id=current_user.id,
    )


@router.put("/{orden_id}/iniciar")
def iniciar_orden(
    orden_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    result = crud.update_orden_trabajo_estado(
        db, empresa_id=current_user.empresa_id,
        orden_id=orden_id, estado="Iniciada"
    )
    if not result:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return result


@router.put("/{orden_id}/terminar")
def terminar_orden(
    orden_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    result = crud.update_orden_trabajo_estado(
        db, empresa_id=current_user.empresa_id,
        orden_id=orden_id, estado="En revisión"
    )
    if not result:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return result
