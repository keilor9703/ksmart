from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

import schemas
from api.deps import get_db, get_current_active_user
from crud import impuestos as crud_imp

router = APIRouter()


# ─── Tipos de Impuesto ────────────────────────────────────────────────────────

@router.get("/", response_model=List[schemas.TipoImpuestoOut])
def list_impuestos(
    solo_activos: bool = True,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    impuestos = crud_imp.list_tipos_impuesto(db, current_user.empresa_id)
    if solo_activos:
        impuestos = [i for i in impuestos if i.is_active]
    return impuestos


@router.post("/", response_model=schemas.TipoImpuestoOut, status_code=status.HTTP_201_CREATED)
def create_impuesto(
    payload: schemas.TipoImpuestoCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return crud_imp.create_tipo_impuesto(db, current_user.empresa_id, payload)


@router.put("/{impuesto_id}", response_model=schemas.TipoImpuestoOut)
def update_impuesto(
    impuesto_id: int,
    payload: schemas.TipoImpuestoUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    obj = crud_imp.update_tipo_impuesto(db, current_user.empresa_id, impuesto_id, payload)
    if not obj:
        raise HTTPException(status_code=404, detail="Impuesto no encontrado")
    return obj


@router.delete("/{impuesto_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_impuesto(
    impuesto_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    ok = crud_imp.delete_tipo_impuesto(db, current_user.empresa_id, impuesto_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Impuesto no encontrado")


# ─── Asignación Producto ↔ Impuesto ──────────────────────────────────────────

@router.get("/producto/{producto_id}", response_model=Optional[schemas.ProductoImpuestoOut])
def get_impuesto_producto(
    producto_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    row = crud_imp.get_impuesto_de_producto(db, current_user.empresa_id, producto_id)
    return row


@router.post(
    "/producto/{producto_id}",
    response_model=schemas.ProductoImpuestoOut,
    status_code=status.HTTP_200_OK,
)
def set_impuesto_producto(
    producto_id: int,
    payload: schemas.ProductoImpuestoCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    # Validar que el impuesto pertenece a la empresa
    imp = crud_imp.get_tipo_impuesto(db, current_user.empresa_id, payload.impuesto_id)
    if not imp:
        raise HTTPException(status_code=404, detail="Tipo de impuesto no encontrado")
    return crud_imp.set_impuesto_para_producto(
        db, current_user.empresa_id, producto_id, payload.impuesto_id
    )


@router.delete("/producto/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_impuesto_producto(
    producto_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    crud_imp.remove_impuesto_de_producto(db, current_user.empresa_id, producto_id)
