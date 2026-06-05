from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

import crud
import schemas
from api.v1.endpoints.auth import get_current_active_user
from database import SessionLocal

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── Plan de cuentas ──────────────────────────────────────────────────────────

@router.get("/cuentas", response_model=list[schemas.CuentaContableOut])
def listar_cuentas(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return crud.listar_cuentas(db, current_user.empresa_id)


# ─── Libro diario ─────────────────────────────────────────────────────────────

@router.get("/asientos", response_model=schemas.AsientosListResponse)
def listar_asientos(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    tipo_origen: Optional[str] = Query(None),
    fecha_inicio: Optional[datetime] = Query(None),
    fecha_fin: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    skip = (page - 1) * page_size
    items, total = crud.listar_asientos(
        db, current_user.empresa_id,
        skip=skip, limit=page_size,
        tipo_origen=tipo_origen,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
    )
    return schemas.AsientosListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/asientos/{asiento_id}", response_model=schemas.AsientoContableOut)
def get_asiento(
    asiento_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    a = crud.get_asiento(db, current_user.empresa_id, asiento_id)
    if not a:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Asiento no encontrado")
    return a


# ─── Balance de comprobación ──────────────────────────────────────────────────

@router.get("/balance-comprobacion", response_model=list[schemas.BalanceComprobacionItem])
def balance_comprobacion(
    fecha_inicio: Optional[datetime] = Query(None),
    fecha_fin: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return crud.get_balance_comprobacion(
        db, current_user.empresa_id, fecha_inicio, fecha_fin
    )


# ─── Estado de resultados ─────────────────────────────────────────────────────

@router.get("/estado-resultados", response_model=schemas.EstadoResultados)
def estado_resultados(
    fecha_inicio: Optional[datetime] = Query(None),
    fecha_fin: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return crud.get_estado_resultados(
        db, current_user.empresa_id, fecha_inicio, fecha_fin
    )
