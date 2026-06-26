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


# ──────────────────────────────────────────────────────────────────────────────
# 🌐 PORTAL PÚBLICO (sin autenticación) — el cliente agenda por su cuenta
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/publico/{slug}", response_model=schemas.AgendamientoPublicoInfo)
def info_publica(slug: str, db: Session = Depends(get_db)):
    """Datos de la empresa y servicios agendables disponibles para el público."""
    empresa = crud.get_empresa_by_slug(db, slug=slug)
    if not empresa:
        raise HTTPException(status_code=404, detail="Página de agendamiento no encontrada")
    servicios = crud.get_servicios_agendables(db, empresa_id=empresa.id, solo_activos=True)
    # Sólo exponer servicios que tengan trabajadores asignados
    servicios = [s for s in servicios if getattr(s, "trabajadores", None)]
    return schemas.AgendamientoPublicoInfo(
        empresa_nombre=empresa.nombre,
        slug=slug,
        logo_base64=getattr(empresa, "logo_base64", None),
        servicios=servicios,
    )


@router.get("/publico/{slug}/disponibilidad", response_model=schemas.DisponibilidadResponse)
def disponibilidad_publica(
    slug: str,
    producto_id: int = Query(...),
    fecha: date = Query(...),
    db: Session = Depends(get_db),
):
    empresa = crud.get_empresa_by_slug(db, slug=slug)
    if not empresa:
        raise HTTPException(status_code=404, detail="Página de agendamiento no encontrada")
    return crud.calcular_disponibilidad(db, empresa_id=empresa.id, producto_id=producto_id, dia=fecha)


@router.post("/publico/{slug}/cita", response_model=schemas.CitaPublicaResponse, status_code=201)
def crear_cita_publica(
    slug: str,
    payload: schemas.CitaPublicaCreate,
    db: Session = Depends(get_db),
):
    empresa = crud.get_empresa_by_slug(db, slug=slug)
    if not empresa:
        raise HTTPException(status_code=404, detail="Página de agendamiento no encontrada")
    data = schemas.CitaCreate(
        producto_id=payload.producto_id,
        user_id=payload.user_id,
        cliente_id=None,
        fecha_inicio=payload.fecha_inicio,
        cliente_nombre=payload.cliente_nombre,
        cliente_telefono=payload.cliente_telefono,
        cliente_email=payload.cliente_email,
        notas=payload.notas,
    )
    try:
        cita = crud.create_cita(db, empresa_id=empresa.id, data=data)
    except crud.AgendamientoError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return cita
