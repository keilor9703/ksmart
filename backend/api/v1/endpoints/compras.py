from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud, models, schemas
from api.deps import get_db, get_current_active_user, get_current_admin_user

router = APIRouter()


@router.get("/", response_model=List[schemas.Compra])
def listar_compras(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_compras(db, empresa_id=current_user.empresa_id, skip=skip, limit=limit)


@router.get("/{compra_id}", response_model=schemas.Compra)
def obtener_compra(
    compra_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    compra = crud.get_compra(db, empresa_id=current_user.empresa_id, compra_id=compra_id)
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return compra


@router.post("/", response_model=schemas.Compra)
def crear_compra(
    compra: schemas.CompraCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.create_compra(db, empresa_id=current_user.empresa_id, compra=compra)


@router.post("/pagos/", response_model=schemas.PagoCompra)
def registrar_pago_compra(
    pago: schemas.PagoCompraCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.create_pago_compra(db, empresa_id=current_user.empresa_id, pago=pago)


@router.patch("/{compra_id}", response_model=schemas.Compra)
def actualizar_compra(
    compra_id: int,
    compra_data: schemas.CompraUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.update_compra(db, empresa_id=current_user.empresa_id, compra_id=compra_id, data=compra_data)


@router.delete("/{compra_id}")
def eliminar_compra(
    compra_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    crud.delete_compra(db, empresa_id=current_user.empresa_id, compra_id=compra_id)
    return {"message": "Compra eliminada correctamente"}
