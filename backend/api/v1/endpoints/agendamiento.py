"""
Endpoints del módulo de Agendamiento de Citas.

- Configuración de servicios agendables y sus trabajadores (admin).
- Consulta de disponibilidad (admin y portal cliente).
- CRUD de citas.
"""
from typing import List, Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import crud
import schemas
import models
from api.deps import get_db, get_current_active_user

router = APIRouter()


# ──────────────────────────────────────────────────────────────────────────────
# Servicios agendables y trabajadores
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/servicios", response_model=List[schemas.ServicioAgendable])
def listar_servicios_agendables(
    solo_activos: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """
    Lista los servicios. Por defecto todos los servicios (es_servicio=True) para
    que el admin pueda habilitarlos; con solo_activos=True, sólo los agendables.
    """
    return crud.get_servicios_agendables(db, empresa_id=current_user.empresa_id, solo_activos=solo_activos)


@router.put("/servicios/{producto_id}", response_model=schemas.ServicioAgendable)
def configurar_servicio(
    producto_id: int,
    payload: schemas.ServicioAgendableUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Habilita/deshabilita un servicio para agendamiento y asigna sus trabajadores."""
    prod = crud.configurar_servicio_agendable(
        db, empresa_id=current_user.empresa_id, producto_id=producto_id, data=payload
    )
    if not prod:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    return prod


# ──────────────────────────────────────────────────────────────────────────────
# Disponibilidad
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/disponibilidad", response_model=schemas.DisponibilidadResponse)
def disponibilidad(
    producto_id: int = Query(...),
    fecha: date = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Franjas horarias libres para un servicio en una fecha dada."""
    return crud.calcular_disponibilidad(
        db, empresa_id=current_user.empresa_id, producto_id=producto_id, dia=fecha
    )


# ──────────────────────────────────────────────────────────────────────────────
# Citas
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/citas", response_model=List[schemas.Cita])
def listar_citas(
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
    user_id: Optional[int] = None,
    estado: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_citas(
        db, empresa_id=current_user.empresa_id,
        desde=desde, hasta=hasta, user_id=user_id, estado=estado,
    )


@router.get("/citas/{cita_id}", response_model=schemas.Cita)
def obtener_cita(
    cita_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    cita = crud.get_cita(db, empresa_id=current_user.empresa_id, cita_id=cita_id)
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    return cita


@router.post("/citas", response_model=schemas.Cita)
def crear_cita(
    payload: schemas.CitaCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    try:
        return crud.create_cita(db, empresa_id=current_user.empresa_id, data=payload)
    except crud.AgendamientoError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.put("/citas/{cita_id}", response_model=schemas.Cita)
def actualizar_cita(
    cita_id: int,
    payload: schemas.CitaUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    try:
        cita = crud.update_cita(db, empresa_id=current_user.empresa_id, cita_id=cita_id, data=payload)
    except crud.AgendamientoError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    return cita


@router.patch("/citas/{cita_id}/estado", response_model=schemas.Cita)
def cambiar_estado(
    cita_id: int,
    estado: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    cita = crud.cambiar_estado_cita(db, empresa_id=current_user.empresa_id, cita_id=cita_id, estado=estado)
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    return cita


@router.delete("/citas/{cita_id}")
def eliminar_cita(
    cita_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    ok = crud.delete_cita(db, empresa_id=current_user.empresa_id, cita_id=cita_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    return {"message": "Cita eliminada correctamente"}
