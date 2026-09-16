"""
Endpoints del módulo Taller de Mecánica.

- Vehículos: alta de vehículos (de cliente o comprados para reventa).
- Órdenes: reparación a cliente y remanufactura/reventa sobre un vehículo,
  con un ledger abierto de costos (DetalleOrdenTaller) hasta el cierre.
- Cierre: cobrar (reparación) o vender (reventa) — genera una Venta real.
- Estadísticas de rentabilidad del taller.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models, schemas
from crud import taller as crud_taller
from api.deps import get_db, get_current_active_user

router = APIRouter()


# ──────────────────────────────────────────────────────────────────────────────
# Vehículos
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/vehiculos", response_model=List[schemas.VehiculoTallerOut])
def listar_vehiculos(
    origen: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    vehiculos = crud_taller.listar_vehiculos(db, empresa_id=current_user.empresa_id, origen=origen)
    out = []
    for v in vehiculos:
        item = schemas.VehiculoTallerOut.model_validate(v)
        item.cliente_nombre = v.cliente.nombre if v.cliente else None
        out.append(item)
    return out


@router.post("/vehiculos", response_model=schemas.VehiculoTallerOut, status_code=201)
def crear_vehiculo(
    payload: schemas.VehiculoTallerCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    try:
        vehiculo = crud_taller.crear_vehiculo(db, empresa_id=current_user.empresa_id, data=payload)
    except crud_taller.TallerError as e:
        raise HTTPException(status_code=409, detail=str(e))
    item = schemas.VehiculoTallerOut.model_validate(vehiculo)
    item.cliente_nombre = vehiculo.cliente.nombre if vehiculo.cliente else None
    return item


# ──────────────────────────────────────────────────────────────────────────────
# Órdenes
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/ordenes", response_model=List[schemas.OrdenTallerOut])
def listar_ordenes(
    estado: Optional[str] = None,
    tipo_orden: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud_taller.listar_ordenes(
        db, empresa_id=current_user.empresa_id, estado=estado, tipo_orden=tipo_orden,
    )


@router.get("/ordenes/{orden_id}", response_model=schemas.OrdenTallerOut)
def obtener_orden(
    orden_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    orden = crud_taller.get_orden(db, empresa_id=current_user.empresa_id, orden_id=orden_id)
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return orden


@router.post("/ordenes", response_model=schemas.OrdenTallerOut, status_code=201)
def crear_orden(
    payload: schemas.OrdenTallerCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    try:
        return crud_taller.crear_orden(db, empresa_id=current_user.empresa_id, data=payload)
    except crud_taller.TallerError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/ordenes/{orden_id}", response_model=schemas.OrdenTallerOut)
def actualizar_orden(
    orden_id: int,
    payload: schemas.OrdenTallerUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    orden = crud_taller.update_orden(db, empresa_id=current_user.empresa_id, orden_id=orden_id, data=payload)
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return orden


@router.patch("/ordenes/{orden_id}/estado", response_model=schemas.OrdenTallerOut)
def cambiar_estado_orden(
    orden_id: int,
    payload: schemas.OrdenTallerEstadoUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    try:
        return crud_taller.cambiar_estado(
            db, empresa_id=current_user.empresa_id, orden_id=orden_id,
            nuevo_estado=payload.estado, notificar_cliente=payload.notificar_cliente,
        )
    except crud_taller.TallerError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ordenes/{orden_id}/detalles", response_model=schemas.OrdenTallerOut)
def agregar_detalle_orden(
    orden_id: int,
    payload: schemas.DetalleOrdenTallerCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    try:
        return crud_taller.agregar_detalle(db, empresa_id=current_user.empresa_id, orden_id=orden_id, data=payload)
    except crud_taller.TallerError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        # create_movement (stock insuficiente / producto no encontrado)
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/ordenes/{orden_id}/detalles/{detalle_id}")
def eliminar_detalle_orden(
    orden_id: int,
    detalle_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    ok = crud_taller.eliminar_detalle(db, empresa_id=current_user.empresa_id, orden_id=orden_id, detalle_id=detalle_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Detalle no encontrado")
    return {"message": "Detalle eliminado correctamente"}


@router.post("/ordenes/{orden_id}/cerrar-cliente", response_model=schemas.OrdenTallerOut)
def cerrar_orden_cliente(
    orden_id: int,
    payload: schemas.OrdenTallerCerrarCliente,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    try:
        return crud_taller.cerrar_reparacion_cliente(db, empresa_id=current_user.empresa_id, orden_id=orden_id, data=payload)
    except crud_taller.TallerError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ordenes/{orden_id}/cerrar-reventa", response_model=schemas.OrdenTallerOut)
def cerrar_orden_reventa(
    orden_id: int,
    payload: schemas.OrdenTallerCerrarReventa,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    try:
        return crud_taller.cerrar_reventa(db, empresa_id=current_user.empresa_id, orden_id=orden_id, data=payload)
    except crud_taller.TallerError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────────
# Estadísticas
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/stats", response_model=schemas.TallerStatsOut)
def get_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud_taller.get_stats(db, empresa_id=current_user.empresa_id)
