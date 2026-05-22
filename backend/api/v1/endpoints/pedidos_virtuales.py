from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List

import models
import schemas
from api.deps import get_db, get_current_active_user
from crud import pedidos_virtuales as crud_pv

router = APIRouter()


@router.get("/stats", response_model=schemas.PedidoVirtualStats)
def get_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud_pv.get_stats(db, current_user.empresa_id)


@router.get("/", response_model=List[schemas.PedidoVirtualOut])
def list_pedidos(
    estado: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud_pv.get_pedidos(db, current_user.empresa_id, estado, search, skip, limit)


@router.get("/{pedido_id}", response_model=schemas.PedidoVirtualOut)
def get_pedido(
    pedido_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    pedido = crud_pv.get_pedido(db, pedido_id, current_user.empresa_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return pedido


@router.patch("/{pedido_id}/estado", response_model=schemas.PedidoVirtualOut)
def update_estado(
    pedido_id: int,
    payload: schemas.PedidoEstadoUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    try:
        return crud_pv.update_estado(
            db, pedido_id, current_user.empresa_id, payload.estado, payload.notas_internas
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{pedido_id}/convertir-venta", response_model=schemas.PedidoVirtualOut)
def convertir_a_venta(
    pedido_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    try:
        return crud_pv.convertir_a_venta(db, pedido_id, current_user.empresa_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{pedido_id}/whatsapp")
def get_whatsapp_url(
    pedido_id: int,
    payload: schemas.PedidoWhatsAppMessage,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    pedido = crud_pv.get_pedido(db, pedido_id, current_user.empresa_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    url = crud_pv.build_whatsapp_url(pedido, payload.mensaje)
    return {"url": url}
