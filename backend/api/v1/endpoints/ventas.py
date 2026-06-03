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

    if not venta.operador_id:
        venta = venta.model_copy(update={'operador_id': current_user.id})

    omitir_inventario = venta.omitir_inventario

    db_cliente = None
    if venta.cliente_id is not None:
        db_cliente = crud.get_cliente(db, empresa_id=empresa_id, cliente_id=venta.cliente_id)
        if not db_cliente:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

    if not venta.detalles:
        raise HTTPException(status_code=400, detail="Debe proporcionar al menos un producto.")

    productos_locked: dict[int, models.Producto] = {}

    if not omitir_inventario:
        # Lock physical product rows to prevent race conditions on stock
        for d in venta.detalles:
            if d.producto_id is None:  # ítem libre — no stock
                continue
            if d.producto_id in productos_locked:
                continue
            prod = (
                db.query(models.Producto)
                .filter(
                    models.Producto.id == d.producto_id,
                    models.Producto.empresa_id == empresa_id,
                    models.Producto.vigente == True,
                )
                .with_for_update(of=models.Producto)
                .first()
            )
            if not prod:
                raise HTTPException(status_code=404, detail=f"Producto {d.producto_id} no existe")
            productos_locked[d.producto_id] = prod

        for d in venta.detalles:
            if d.producto_id is None:
                continue
            prod = productos_locked[d.producto_id]
            if not prod.es_servicio and not prod.requiere_cocina:
                if (prod.stock_actual or 0) < d.cantidad:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Stock insuficiente para '{prod.nombre}'. Disponible: {prod.stock_actual}, requerido: {d.cantidad}",
                    )
    else:
        # Just verify product exists, no locking or stock check
        for d in venta.detalles:
            if d.producto_id is None:
                continue
            if d.producto_id not in productos_locked:
                prod = crud.get_producto(db, empresa_id=empresa_id, producto_id=d.producto_id)
                if not prod:
                    raise HTTPException(status_code=404, detail=f"Producto {d.producto_id} no existe")
                productos_locked[d.producto_id] = prod

    if not venta.pagada and db_cliente is not None:
        iva_pct = float(getattr(venta, 'iva_porcentaje', 0) or 0)
        total_nueva = sum(
            (d.precio_unitario if d.precio_unitario is not None else (productos_locked[d.producto_id].precio if d.producto_id else 0)) * (d.cantidad or 1)
            for d in venta.detalles
        ) * (1 + iva_pct / 100)
        deuda_actual = crud.get_cliente_deuda(db, empresa_id=empresa_id, cliente_id=venta.cliente_id)
        if (deuda_actual + total_nueva) > db_cliente.cupo_credito:
            cupo_disp = db_cliente.cupo_credito - deuda_actual
            raise HTTPException(status_code=400, detail=f"La venta excede el cupo de crédito. Disponible: {cupo_disp:.2f}")

    db_venta = crud.create_venta(db=db, empresa_id=empresa_id, venta=venta, commit=False)

    if not omitir_inventario:
        try:
            for det in db_venta.detalles:
                if det.producto_id is None:  # ítem libre
                    continue
                prod = productos_locked.get(det.producto_id)
                if not prod:
                    prod = crud.get_producto(db, empresa_id=empresa_id, producto_id=det.producto_id)
                if not prod or getattr(prod, "es_servicio", False) or getattr(prod, "requiere_cocina", False):
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
                                referencia=f"Venta #{db_venta.id}",
                                commit=False,
                            )
                        except ValueError as e:
                            raise HTTPException(status_code=400, detail=str(e))
                        prod.stock_actual = (prod.stock_actual or 0) - det.cantidad
                        db.add(prod)
                    else:
                        crud.create_movement(db, empresa_id=empresa_id, payload=schemas.InventoryMovementCreate(
                            producto_id=det.producto_id,
                            tipo=schemas.MovementType.salida,
                            cantidad=det.cantidad,
                            costo_unitario=prod.costo or 0.0,
                            motivo="venta",
                            referencia=f"venta #{db_venta.id}",
                            usuario_id=current_user.id,
                        ), commit=False)
                else:
                    crud.create_movement(db, empresa_id=empresa_id, payload=schemas.InventoryMovementCreate(
                        producto_id=det.producto_id,
                        tipo=schemas.MovementType.salida,
                        cantidad=det.cantidad,
                        costo_unitario=prod.costo or 0.0,
                        motivo="venta",
                        referencia=f"venta #{db_venta.id}",
                        usuario_id=current_user.id,
                    ), commit=False)
        except (ValueError, HTTPException):
            db.rollback()
            raise

    db.commit()
    db.refresh(db_venta)

    if not omitir_inventario:
        producto_ids = [det.producto_id for det in db_venta.detalles if det.producto_id]
        if producto_ids:
            crud.check_and_notify_low_stock(db, empresa_id=empresa_id, producto_ids=producto_ids)

    if db_venta.cliente_id and venta.pagada:
        try:
            from crud.puntos import ganar_puntos_venta, canjear_puntos
            # Deduct redeemed points first (already discounted from total)
            if venta.puntos_canjeados and venta.puntos_canjeados > 0:
                canjear_puntos(db, empresa_id=empresa_id, cliente_id=db_venta.cliente_id,
                               puntos_a_canjear=venta.puntos_canjeados)
            # Earn points on net total paid
            ganar_puntos_venta(db, empresa_id=empresa_id, cliente_id=db_venta.cliente_id,
                               total_venta=float(db_venta.total or 0), venta_id=db_venta.id)
        except Exception:
            pass  # Points are non-critical; never block the sale

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
    if venta.cliente_id is not None and not crud.get_cliente(db, empresa_id=empresa_id, cliente_id=venta.cliente_id):
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    if not venta.detalles:
        raise HTTPException(status_code=400, detail="Debe proporcionar al menos un producto.")
    for detalle in venta.detalles:
        prod = crud.get_producto(db, empresa_id=empresa_id, producto_id=detalle.producto_id)
        if not prod:
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
