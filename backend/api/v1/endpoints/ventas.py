from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import crud
import models
import schemas
from api.deps import get_db, get_current_active_user

router = APIRouter()

@router.post("/", response_model=schemas.Venta)
def create_venta(venta: schemas.VentaCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    empresa_id = current_user.empresa_id

    db_cliente = crud.get_cliente(db, empresa_id=empresa_id, cliente_id=venta.cliente_id)
    if not db_cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    if not venta.detalles:
        raise HTTPException(status_code=400, detail="Debe proporcionar al menos un producto.")

    for d in venta.detalles:
        prod = crud.get_producto(db, empresa_id=empresa_id, producto_id=d.producto_id)
        if not prod:
            raise HTTPException(status_code=404, detail=f"Producto {d.producto_id} no existe")
        if not prod.es_servicio and prod.grupo_item != 2:
            raise HTTPException(status_code=400, detail=f"'{prod.nombre}' no es un Producto Terminado y no puede venderse.")
        if not prod.es_servicio:
            if (prod.stock_actual or 0) < d.cantidad:
                raise HTTPException(status_code=400, detail=f"Stock insuficiente for '{prod.nombre}'. Disponible: {prod.stock_actual}, requerido: {d.cantidad}")

    if not venta.pagada:
        total_nueva = sum(
            (d.precio_unitario if d.precio_unitario is not None else crud.get_producto(db, empresa_id, d.producto_id).precio) * d.cantidad
            for d in venta.detalles
        )
        deuda_actual = crud.get_cliente_deuda(db, empresa_id=empresa_id, cliente_id=venta.cliente_id)
        if (deuda_actual + total_nueva) > db_cliente.cupo_credito:
            cupo_disp = db_cliente.cupo_credito - deuda_actual
            raise HTTPException(status_code=400, detail=f"La venta excede el cupo de crédito. Disponible: {cupo_disp:.2f}")

    db_venta = crud.create_venta(db=db, empresa_id=empresa_id, venta=venta)

    try:
        for det in db_venta.detalles:
            prod = crud.get_producto(db, empresa_id=empresa_id, producto_id=det.producto_id)
            if getattr(prod, "es_servicio", False):
                continue
            if getattr(prod, "maneja_lotes", False):
                lotes_disponibles = crud.get_lotes_fefo(db, empresa_id=empresa_id, producto_id=det.producto_id)
                if lotes_disponibles:
                    try:
                        crud.consumir_stock_fefo(
                            db,
                            empresa_id=empresa_id,
                            producto_id=det.producto_id,
                            cantidad_requerida=det.cantidad,
                            referencia=f"Venta #{db_venta.id}"
                        )
                    except ValueError as e:
                        raise HTTPException(status_code=400, detail=str(e))
                else:
                    # Sin lotes registrados: descuento estándar sobre stock_actual
                    crud.create_movement(db, empresa_id=empresa_id, payload=schemas.InventoryMovementCreate(
                        producto_id=det.producto_id,
                        tipo=schemas.MovementType.salida,
                        cantidad=det.cantidad,
                        costo_unitario=prod.costo or 0.0,
                        motivo="venta",
                        referencia=f"venta #{db_venta.id}",
                    ))
                prod.stock_actual = (prod.stock_actual or 0) - det.cantidad
                db.add(prod)
                db.commit()
            else:
                crud.create_movement(db, empresa_id=empresa_id, payload=schemas.InventoryMovementCreate(
                    producto_id=det.producto_id,
                    tipo=schemas.MovementType.salida,
                    cantidad=det.cantidad,
                    costo_unitario=prod.costo or 0.0,
                    motivo="venta",
                    referencia=f"venta #{db_venta.id}"
                ))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    crud.check_and_notify_low_stock(db, empresa_id=empresa_id, producto_ids=[det.producto_id for det in db_venta.detalles])
    return db_venta

@router.get("/", response_model=List[schemas.Venta])
def read_ventas(
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    return crud.get_ventas(db, empresa_id=current_user.empresa_id, skip=skip, limit=limit)

@router.get("/{venta_id}", response_model=schemas.Venta)
def read_venta(venta_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    db_venta = crud.get_venta(db, empresa_id=current_user.empresa_id, venta_id=venta_id)
    if db_venta is None:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return db_venta

@router.put("/{venta_id}", response_model=schemas.Venta)
def update_venta(venta_id: int, venta: schemas.VentaCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    empresa_id = current_user.empresa_id
    if not crud.get_cliente(db, empresa_id=empresa_id, cliente_id=venta.cliente_id):
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    if not venta.detalles:
        raise HTTPException(status_code=400, detail="Debe proporcionar al menos un producto.")
    for detalle in venta.detalles:
        if not crud.get_producto(db, empresa_id=empresa_id, producto_id=detalle.producto_id):
            raise HTTPException(status_code=404, detail=f"Producto {detalle.producto_id} no encontrado.")
    db_venta = crud.update_venta(db, empresa_id=empresa_id, venta_id=venta_id, venta=venta)
    if db_venta is None:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return db_venta

@router.delete("/{venta_id}")
def delete_venta(venta_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    empresa_id = current_user.empresa_id
    db_venta = crud.get_venta(db, empresa_id=empresa_id, venta_id=venta_id)
    if db_venta is None:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    bloqueos = crud.check_can_delete_venta(db, empresa_id=empresa_id, venta_id=venta_id)
    if bloqueos:
        raise HTTPException(
            status_code=409,
            detail=(f"No se puede eliminar la venta #{venta_id} porque " + ", ".join(bloqueos) + ".")
        )
    crud.revertir_movimientos_venta(db, empresa_id=empresa_id, venta=db_venta)
    crud.delete_venta(db, empresa_id=empresa_id, venta_id=venta_id)
    return {"message": f"Venta #{venta_id} eliminada y stock revertido"}
