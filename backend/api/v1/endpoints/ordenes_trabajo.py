from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import shutil, os, uuid

import crud, models, schemas
from api.deps import get_db, get_current_active_user, get_current_admin_user

router = APIRouter()


@router.get("/", response_model=List[schemas.OrdenTrabajo])
def listar_ordenes(
    skip: int = 0, limit: int = 100,
    estado: Optional[str] = None,
    operador_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_ordenes_trabajo(
        db, empresa_id=current_user.empresa_id,
        skip=skip, limit=limit, estado=estado,
        operador_id=operador_id, start_date=start_date, end_date=end_date,
    )


@router.get("/total")
def total_ordenes(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_total_ordenes_trabajo(
        db, empresa_id=current_user.empresa_id,
        start_date=start_date, end_date=end_date,
    )


@router.get("/{orden_id}", response_model=schemas.OrdenTrabajo)
def obtener_orden(
    orden_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    orden = crud.get_orden_trabajo(db, empresa_id=current_user.empresa_id, orden_id=orden_id)
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return orden


@router.post("/", response_model=schemas.OrdenTrabajo)
def crear_orden(
    orden: schemas.OrdenTrabajoCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.create_orden_trabajo(
        db, empresa_id=current_user.empresa_id,
        orden=orden, operador_id=current_user.id,
    )


@router.put("/{orden_id}", response_model=schemas.OrdenTrabajo)
def actualizar_orden(
    orden_id: int,
    orden: schemas.OrdenTrabajoCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    result = crud.update_orden_trabajo(
        db, empresa_id=current_user.empresa_id, orden_id=orden_id, orden=orden,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return result


@router.patch("/{orden_id}/estado")
def cambiar_estado(
    orden_id: int,
    estado: str,
    observaciones: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.update_orden_trabajo_estado(
        db, empresa_id=current_user.empresa_id,
        orden_id=orden_id, estado=estado, observaciones=observaciones,
    )


@router.post("/{orden_id}/aprobar", response_model=schemas.OrdenTrabajo)
def aprobar_orden(
    orden_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    return crud.aprobar_orden_trabajo(
        db, empresa_id=current_user.empresa_id,
        orden_id=orden_id, admin_user=current_user,
    )


@router.post("/{orden_id}/rechazar", response_model=schemas.OrdenTrabajo)
def rechazar_orden(
    orden_id: int,
    observaciones: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    return crud.rechazar_orden_trabajo(
        db, empresa_id=current_user.empresa_id,
        orden_id=orden_id, observaciones=observaciones, admin_user=current_user,
    )


@router.put("/{orden_id}/cerrar", response_model=schemas.OrdenTrabajo)
def cerrar_orden(
    orden_id: int,
    close_data: schemas.OrdenTrabajoClose,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    return crud.cerrar_orden_trabajo(
        db, empresa_id=current_user.empresa_id,
        orden_id=orden_id, admin_user=current_user, close_data=close_data,
    )


@router.post("/{orden_id}/evidencia")
def subir_evidencia(
    orden_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join("evidencias", filename)
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return crud.add_evidencia_orden_trabajo(
        db, empresa_id=current_user.empresa_id,
        orden_id=orden_id, file_path=filepath,
    )
