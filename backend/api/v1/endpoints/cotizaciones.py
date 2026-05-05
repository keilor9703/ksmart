from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

import crud
import schemas
import models
from api.deps import get_db, get_current_active_user

router = APIRouter()

@router.get("/")
def listar_cotizaciones(
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Lista todas las cotizaciones con estado calculado (vigente/vencida/convertida)."""
    return crud.get_cotizaciones(db, empresa_id=current_user.empresa_id, skip=skip, limit=limit)

@router.post("/")
def crear_cotizacion(
    payload: schemas.CotizacionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """
    Crea una cotización/proforma.
    NO descuenta stock, NO crea movimientos de inventario.
    """
    if not payload.detalles:
        raise HTTPException(status_code=400, detail="La cotización debe tener al menos un ítem.")

    return crud.create_cotizacion(db, empresa_id=current_user.empresa_id, payload=payload)

@router.post("/{cotizacion_id}/convertir")
def convertir_cotizacion(
    cotizacion_id: int,
    payload: schemas.CotizacionConvertir,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """
    Convierte una cotización en venta real:
    - Valida stock disponible
    - Crea movimientos de inventario (FEFO si aplica)
    - Asigna numero_factura desde resolución DIAN activa
    - Registra método y estado de pago
    """
    return crud.convertir_cotizacion_a_venta(
        db,
        empresa_id    = current_user.empresa_id,
        cotizacion_id = cotizacion_id,
        payload       = payload,
    )

@router.get("/{cotizacion_id}")
def get_cotizacion(
    cotizacion_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    cotizacion = (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.cliente),
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
        )
        .filter(
            models.Venta.id         == cotizacion_id,
            models.Venta.empresa_id == current_user.empresa_id,
            models.Venta.tipo       == "cotizacion",
        )
        .first()
    )
    if not cotizacion:
        raise HTTPException(status_code=404, detail="Cotización no encontrada.")
    return cotizacion

@router.delete("/{cotizacion_id}")
def eliminar_cotizacion(
    cotizacion_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    crud.delete_cotizacion(db, empresa_id=current_user.empresa_id, cotizacion_id=cotizacion_id)
    return {"message": "Cotización eliminada correctamente."}
