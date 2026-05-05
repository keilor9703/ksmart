from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud
import schemas
import models
from api.deps import get_db, get_current_active_user, get_current_admin_user

router = APIRouter()

@router.get("/", response_model=List[schemas.ResolucionDianOut])
def listar_resoluciones(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Lista todas las resoluciones DIAN de la empresa con campos calculados."""
    return crud.get_resoluciones(db, empresa_id=current_user.empresa_id)

@router.post("/", response_model=schemas.ResolucionDianOut)
def crear_resolucion(
    payload: schemas.ResolucionDianCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    """Crea una nueva resolución DIAN. Solo admins."""
    return crud.create_resolucion(db, empresa_id=current_user.empresa_id, payload=payload)

@router.put("/{resolucion_id}", response_model=schemas.ResolucionDianOut)
def actualizar_resolucion(
    resolucion_id: int,
    payload: schemas.ResolucionDianUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    resolucion = crud.update_resolucion(
        db, empresa_id=current_user.empresa_id,
        resolucion_id=resolucion_id, payload=payload,
    )
    if not resolucion:
        raise HTTPException(status_code=404, detail="Resolución no encontrada.")
    return resolucion

@router.patch("/{resolucion_id}/activar", response_model=schemas.ResolucionDianOut)
def activar_resolucion(
    resolucion_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    """
    Activa esta resolución y desactiva automáticamente las demás de la empresa.
    Es el equivalente de 'seleccionar resolución actual'.
    """
    resolucion = crud.activar_resolucion(
        db, empresa_id=current_user.empresa_id, resolucion_id=resolucion_id
    )
    if not resolucion:
        raise HTTPException(status_code=404, detail="Resolución no encontrada.")
    return resolucion

@router.delete("/{resolucion_id}")
def eliminar_resolucion(
    resolucion_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    crud.delete_resolucion(db, empresa_id=current_user.empresa_id, resolucion_id=resolucion_id)
    return {"message": "Resolución eliminada correctamente."}

@router.get("/activa")
def get_resolucion_activa(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Endpoint liviano para que el frontend muestre la resolución activa en el header de ventas."""
    resolucion = crud._get_resolucion_activa(db, empresa_id=current_user.empresa_id)
    if not resolucion:
        return {"activa": False, "resolucion": None}
    return {
        "activa":     True,
        "prefijo":    resolucion.prefijo or "",
        "siguiente":  resolucion.numero_actual + 1,
        "disponibles": resolucion.numero_final - resolucion.numero_actual,
        "resolucion": resolucion.numero_resolucion,
    }
