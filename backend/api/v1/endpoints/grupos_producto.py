from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import models, schemas
from api.deps import get_db, get_current_active_user
from crud import grupos_producto as crud_grupos

router = APIRouter()


@router.get("/", response_model=List[schemas.GrupoProductoOut])
def list_grupos(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    tipo = getattr(current_user.empresa, "tipo_negocio", "erp") or "erp"
    return crud_grupos.get_grupos(db, current_user.empresa_id, tipo_negocio=tipo)


@router.post("/", response_model=schemas.GrupoProductoOut, status_code=201)
def create_grupo(
    data: schemas.GrupoProductoCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return crud_grupos.create_grupo(db, current_user.empresa_id, data)


@router.put("/{grupo_id}", response_model=schemas.GrupoProductoOut)
def update_grupo(
    grupo_id: int,
    data: schemas.GrupoProductoUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    grupo = crud_grupos.update_grupo(db, current_user.empresa_id, grupo_id, data)
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo no encontrado o no se puede modificar")
    return grupo


@router.patch("/{grupo_id}/config", response_model=schemas.GrupoProductoOut)
def update_grupo_config(
    grupo_id: int,
    data: schemas.GrupoConfigUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Actualiza solo requiere_cocina y visible_pos para esta empresa.
    Funciona tanto en grupos predefinidos como personalizados."""
    existe = db.query(models.GrupoProducto).filter(models.GrupoProducto.id == grupo_id).first()
    if not existe:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return crud_grupos.upsert_grupo_config(db, current_user.empresa_id, grupo_id, data)


@router.delete("/{grupo_id}", status_code=204)
def delete_grupo(
    grupo_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    ok, msg = crud_grupos.delete_grupo(db, current_user.empresa_id, grupo_id)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
