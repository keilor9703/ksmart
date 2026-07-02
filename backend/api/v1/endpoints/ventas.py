from typing import List, Optional
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

    # Los platos de restaurante (requiere_cocina) no manejan stock propio: sus
    # insumos se descuentan vía el flujo de cocina. Ese bypass SOLO aplica a
    # empresas tipo restaurante; en cualquier otro negocio todo producto físico
    # valida y descuenta inventario sin excepción.
    empresa_obj = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    es_restaurante = (getattr(empresa_obj, "tipo_negocio", "") or "").lower() == "restaurante"

    def _exento_de_stock(prod) -> bool:
        return bool(prod.es_servicio or (es_restaurante and getattr(prod, "requiere_cocina", False)))

    db_cliente = None
    if venta.cliente_id is not None:
        db_cliente = crud.get_cliente(db, empresa_id=empresa_id, cliente_id=venta.cliente_id)
        if not db_cliente:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

    if not venta.detalles:
        raise HTTPException(status_code=400, detail="Debe proporcionar al menos un producto.")

    # Si la venta proviene de cobrar una cita, validar de una vez que se pueda vincular
    # (que exista, sea de la empresa y no esté ya cobrada) para fallar antes de crearla.
    if venta.cita_id:
        cita_chk = (
            db.query(models.Cita)
            .filter(models.Cita.id == venta.cita_id, models.Cita.empresa_id == empresa_id)
            .first()
        )
        if not cita_chk:
            raise HTTPException(status_code=404, detail="Cita no encontrada")
        if cita_chk.venta_id:
            raise HTTPException(status_code=409, detail="Esta cita ya fue cobrada.")

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
            if not _exento_de_stock(prod):
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
        # Los precios unitarios ya incluyen IVA — no aplicar IVA adicional
        total_nueva = sum(
            (d.precio_unitario if d.precio_unitario is not None else (productos_locked[d.producto_id].precio if d.producto_id else 0))
            * (d.cantidad or 1)
            * (1 - float(getattr(d, 'descuento_pct', 0) or 0) / 100)
            for d in venta.detalles
        ) - float(getattr(venta, 'descuento_puntos', 0) or 0)
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
                if not prod or _exento_de_stock(prod):
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

    # Vincular la cita (si la venta proviene de cobrar un agendamiento) en la misma
    # transacción: la cita queda completada y la venta marcada como originada allí.
    if venta.cita_id:
        try:
            crud.vincular_cita_a_venta(db, empresa_id=empresa_id, cita_id=venta.cita_id,
                                       venta_id=db_venta.id, commit=False)
            db_venta.origen = "agendamiento"
        except crud.AgendamientoError as e:
            db.rollback()
            raise HTTPException(status_code=409, detail=str(e))

    db.commit()
    db.refresh(db_venta)

    if not omitir_inventario:
        producto_ids = [det.producto_id for det in db_venta.detalles if det.producto_id]
        if producto_ids:
            crud.check_and_notify_low_stock(db, empresa_id=empresa_id, producto_ids=producto_ids)

    if db_venta.cliente_id and venta.pagada:
        try:
            empresa_obj = db.query(models.Empresa).filter_by(id=empresa_id).first()
            fidel_activa = getattr(empresa_obj, "fidelizacion_activa", True)
            if fidel_activa is None:
                fidel_activa = True
            if fidel_activa:
                from crud.puntos import ganar_puntos_venta, canjear_puntos
                earn_rate   = getattr(empresa_obj, "fidelizacion_earn_rate",   1000) or 1000
                redeem_rate = getattr(empresa_obj, "fidelizacion_redeem_rate", 100)  or 100
                if venta.puntos_canjeados and venta.puntos_canjeados > 0:
                    canjear_puntos(db, empresa_id=empresa_id, cliente_id=db_venta.cliente_id,
                                   puntos_a_canjear=venta.puntos_canjeados, redeem_rate=redeem_rate)
                ganar_puntos_venta(db, empresa_id=empresa_id, cliente_id=db_venta.cliente_id,
                                   total_venta=float(db_venta.total or 0), venta_id=db_venta.id,
                                   earn_rate=earn_rate)
        except Exception:
            pass  # Points are non-critical; never block the sale

    return db_venta

@router.get("/")
def read_ventas(
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

    total, items, stats = crud.get_ventas(
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
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "pages":     max(1, (total + page_size - 1) // page_size),
        "items":     [schemas.Venta.model_validate(v) for v in items],
        "stats":     stats,
    }

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
