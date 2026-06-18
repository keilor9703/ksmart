from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import crud, models, schemas
from api.deps import get_db, get_current_active_user, get_current_admin_user

router = APIRouter()


@router.get("/")
def listar_compras(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    search: str = Query(default=""),
    fecha_inicio: Optional[str] = Query(default=None),
    fecha_fin: Optional[str] = Query(default=None),
    estado_pago: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    from datetime import datetime, timezone, timedelta
    fi = None
    ff = None
    if fecha_inicio:
        try:
            fi = datetime.fromisoformat(fecha_inicio).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    if fecha_fin:
        try:
            ff = (datetime.fromisoformat(fecha_fin) + timedelta(days=1)).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    total, items, stats = crud.get_compras(
        db,
        empresa_id=current_user.empresa_id,
        skip=(page - 1) * page_size,
        limit=page_size,
        search=search.strip(),
        fecha_inicio=fi,
        fecha_fin=ff,
        estado_pago=estado_pago or "",
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
        "items": [schemas.Compra.model_validate(c) for c in items],
        "stats": stats,
    }


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
