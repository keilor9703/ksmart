from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud, models, schemas
from api.deps import get_db, get_current_active_user, get_current_admin_user

router = APIRouter()


# ─── RECETAS ──────────────────────────────────────────────────────────────────

@router.get("/recetas/", response_model=List[schemas.Receta])
def listar_recetas(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_recetas(db, empresa_id=current_user.empresa_id, skip=skip, limit=limit)


@router.get("/recetas/{receta_id}", response_model=schemas.Receta)
def obtener_receta(
    receta_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    receta = crud.get_receta(db, empresa_id=current_user.empresa_id, receta_id=receta_id)
    if not receta:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    return receta


@router.post("/recetas/", response_model=schemas.Receta)
def crear_receta(
    receta: schemas.RecetaCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.create_receta(db, empresa_id=current_user.empresa_id, receta=receta)


@router.put("/recetas/{receta_id}", response_model=schemas.Receta)
def actualizar_receta(
    receta_id: int,
    receta: schemas.RecetaCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    try:
        result = crud.update_receta(
            db, empresa_id=current_user.empresa_id,
            receta_id=receta_id, receta=receta,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not result:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    return result


@router.delete("/recetas/{receta_id}")
def eliminar_receta(
    receta_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    # ✅ VALIDACIÓN: Verificar que la receta no tenga lotes asociados
    bloqueos = crud.check_can_delete_receta(db, empresa_id=current_user.empresa_id, receta_id=receta_id)
    if bloqueos:
        raise HTTPException(
            status_code=409,
            detail=f"No se puede eliminar la receta porque {', '.join(bloqueos)}"
        )
    
    crud.delete_receta(db, empresa_id=current_user.empresa_id, receta_id=receta_id)
    return {"message": "Receta eliminada"}


# ─── LOTES DE PRODUCCIÓN ──────────────────────────────────────────────────────

@router.get("/lotes/", response_model=List[schemas.LoteProduccion])
def listar_lotes(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_lotes(db, empresa_id=current_user.empresa_id, skip=skip, limit=limit)


@router.get("/lotes/{lote_id}", response_model=schemas.LoteProduccion)
def obtener_lote(
    lote_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    lote = crud.get_lote(db, empresa_id=current_user.empresa_id, lote_id=lote_id)
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    return lote


@router.post("/lotes/", response_model=schemas.LoteProduccion)
def crear_lote(
    lote: schemas.LoteProduccionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.create_lote(db, empresa_id=current_user.empresa_id, lote=lote)


@router.post("/lotes/{lote_id}/confirmar", response_model=schemas.LoteProduccion)
def confirmar_lote(
    lote_id: int,
    confirm_data: schemas.LoteProduccionConfirm,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.confirmar_lote_produccion(
        db, empresa_id=current_user.empresa_id,
        lote_id=lote_id, confirm_data=confirm_data,
    )


@router.put("/lotes/{lote_id}/cancelar", response_model=schemas.LoteProduccion)
def cancelar_lote(
    lote_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.cancelar_lote(db, empresa_id=current_user.empresa_id, lote_id=lote_id)
