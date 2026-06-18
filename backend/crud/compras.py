from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ
from crud.productos import get_producto
from crud.inventario import create_movement
from services.contabilidad import registrar_asiento_compra


def get_compras(
    db: Session, empresa_id: int, skip: int = 0, limit: int = 25,
    search: str = "", fecha_inicio=None, fecha_fin=None, estado_pago: str = ""
):
    from sqlalchemy import cast, String, or_
    q = (
        db.query(models.Compra)
        .options(
            joinedload(models.Compra.proveedor),
            joinedload(models.Compra.detalles).joinedload(models.DetalleCompra.producto),
            joinedload(models.Compra.pagos),
        )
        .filter(models.Compra.empresa_id == empresa_id)
    )
    if search:
        import re
        term = f"%{search}%"
        conditions = [
            models.Cliente.nombre.ilike(term),
            models.Compra.referencia_factura.ilike(term),
            cast(models.Compra.id, String).ilike(term),
        ]
        m = re.match(r'^[Cc]-?0*(\d+)$', search.strip())
        if m:
            try:
                conditions.append(models.Compra.id == int(m.group(1)))
            except ValueError:
                pass
        q = q.outerjoin(models.Compra.proveedor).filter(or_(*conditions)).distinct()
    if estado_pago and estado_pago != "todos":
        q = q.filter(models.Compra.estado_pago == estado_pago)
    if fecha_inicio:
        q = q.filter(models.Compra.fecha >= fecha_inicio)
    if fecha_fin:
        q = q.filter(models.Compra.fecha <= fecha_fin)

    total = q.count()
    items = q.order_by(models.Compra.fecha.desc()).offset(skip).limit(limit).all()

    from sqlalchemy import func as sqlfunc
    agg_q = db.query(
        sqlfunc.coalesce(sqlfunc.sum(models.Compra.total), 0).label("sum_total"),
        sqlfunc.coalesce(sqlfunc.sum(models.Compra.monto_pagado), 0).label("sum_pagado"),
    ).filter(models.Compra.empresa_id == empresa_id)
    if search:
        import re
        term = f"%{search}%"
        conditions = [
            models.Cliente.nombre.ilike(term),
            models.Compra.referencia_factura.ilike(term),
            cast(models.Compra.id, String).ilike(term),
        ]
        m = re.match(r'^[Cc]-?0*(\d+)$', search.strip())
        if m:
            try:
                conditions.append(models.Compra.id == int(m.group(1)))
            except ValueError:
                pass
        agg_q = agg_q.outerjoin(models.Compra.proveedor).filter(or_(*conditions)).distinct()
    if estado_pago and estado_pago != "todos":
        agg_q = agg_q.filter(models.Compra.estado_pago == estado_pago)
    if fecha_inicio:
        agg_q = agg_q.filter(models.Compra.fecha >= fecha_inicio)
    if fecha_fin:
        agg_q = agg_q.filter(models.Compra.fecha <= fecha_fin)
    agg = agg_q.one()
    stats = {
        "sum_total": float(agg.sum_total),
        "sum_pagado": float(agg.sum_pagado),
        "sum_pendiente": float(agg.sum_total) - float(agg.sum_pagado),
    }
    return total, items, stats

def get_compra(db: Session, empresa_id: int, compra_id: int):
    """✅ FILTRADO POR EMPRESA"""
    return db.query(models.Compra).options(
        joinedload(models.Compra.proveedor),
        joinedload(models.Compra.detalles).joinedload(models.DetalleCompra.producto),
        joinedload(models.Compra.pagos)
    ).filter(
        models.Compra.id == compra_id,
        models.Compra.empresa_id == empresa_id  # ✅
    ).first()


def create_compra(db: Session, empresa_id: int, compra: schemas.CompraCreate):
    """✅ INYECCIÓN DE EMPRESA_ID + VALIDACIÓN CROSS-TENANT + LOTES"""
    # Validar que el proveedor pertenece a la empresa
    db_prov = db.query(models.Cliente).filter(
        models.Cliente.id == compra.proveedor_id,
        models.Cliente.empresa_id == empresa_id
    ).first()
    if not db_prov or not db_prov.es_proveedor:
        raise HTTPException(status_code=400, detail="Proveedor no válido o no pertenece a esta empresa.")

    total_bruto = 0.0
    for item in compra.detalles:
        total_bruto += item.cantidad * item.precio_unitario

    iva_porc = compra.iva_porcentaje or 0.0
    iva_total_calc = total_bruto * iva_porc / 100 if iva_porc > 0 else 0.0
    total_final = total_bruto + iva_total_calc

    db_compra = models.Compra(
        proveedor_id=compra.proveedor_id,
        total=total_final,
        iva_total=iva_total_calc,
        iva_porcentaje=iva_porc,
        referencia_factura=compra.referencia_factura,
        monto_pagado=total_final if compra.pagada else 0.0,
        estado_pago="pagado" if compra.pagada else "pendiente",
        empresa_id=empresa_id
    )
    db.add(db_compra)
    db.flush()

    for idx, item in enumerate(compra.detalles):
        if item.producto_id is None and not item.nombre_libre:
            raise HTTPException(status_code=400, detail=f"El ítem #{idx+1} debe tener un producto o una descripción.")

        prod = None
        if item.producto_id is not None:
            prod = get_producto(db, empresa_id, item.producto_id)
            if not prod:
                raise HTTPException(status_code=404, detail=f"Producto {item.producto_id} no encontrado")

        db_detalle = models.DetalleCompra(
            compra_id=db_compra.id,
            producto_id=item.producto_id,
            nombre_libre=item.nombre_libre,
            sort_order=idx,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,
            iva_porcentaje=0.0
        )
        db.add(db_detalle)

        if item.producto_id is None:
            # Ítem libre: solo registra el gasto, sin tocar inventario
            continue

        # ── Crear lote automático si el detalle trae datos de lote ──────────────
        if item.numero_lote and item.fecha_vencimiento:
            if prod and getattr(prod, 'maneja_lotes', False):
                from crud.perecederos import crear_lote_existencia
                lote_payload = schemas.LoteExistenciaCreate(
                    producto_id       = item.producto_id,
                    numero_lote       = item.numero_lote.strip().upper(),
                    fecha_vencimiento = item.fecha_vencimiento,
                    fecha_fabricacion = getattr(item, 'fecha_fabricacion', None),
                    cantidad_inicial  = item.cantidad,
                    costo_unitario    = item.precio_unitario,
                    proveedor_id      = compra.proveedor_id,
                    referencia_compra = compra.referencia_factura,
                )
                crear_lote_existencia(db, empresa_id, lote_payload)

            prod.costo = item.precio_unitario
            db.add(prod)
        else:
            # Entrada de producto regular
            payload_mov = schemas.InventoryMovementCreate(
                producto_id=item.producto_id,
                tipo=schemas.MovementType.entrada,
                cantidad=item.cantidad,
                costo_unitario=item.precio_unitario,
                motivo="Compra",
                referencia=f"Compra #{db_compra.id}",
                observacion=f"Factura: {compra.referencia_factura or 'N/A'}"
            )
            create_movement(db, empresa_id, payload_mov)

            prod.costo = item.precio_unitario
            db.add(prod)

    db.commit()
    db.refresh(db_compra)
    registrar_asiento_compra(db, db_compra)
    db.commit()
    return db_compra


def create_pago_compra(db: Session, empresa_id: int, pago: schemas.PagoCompraCreate):
    db_compra = get_compra(db, empresa_id, pago.compra_id)
    if not db_compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    db_pago = models.PagoCompra(**pago.dict(), empresa_id=empresa_id)
    db.add(db_pago)
    db.flush() # Guarda el pago en la BD pero no cierra la transacción

    # ✅ FIX: Calcular el total consultando directamente a la base de datos
    # Esto evita el bug de caché en memoria de SQLAlchemy
    total_pagado = db.query(func.sum(models.PagoCompra.monto)).filter(
        models.PagoCompra.compra_id == db_compra.id
    ).scalar() or 0.0

    db_compra.monto_pagado = total_pagado

    if db_compra.monto_pagado >= db_compra.total:
        db_compra.estado_pago = "pagado"
    elif db_compra.monto_pagado > 0:
        db_compra.estado_pago = "parcial"
    else:
        db_compra.estado_pago = "pendiente"

    db.commit()
    db.refresh(db_compra)
    registrar_asiento_compra(db, db_compra, pago=db_pago)
    db.commit()
    return db_pago


def update_compra(db: Session, empresa_id: int, compra_id: int, data: schemas.CompraUpdate):
    """
    Actualiza una compra. Para simplificar y asegurar consistencia de inventario,
    revertimos los movimientos de la compra anterior y aplicamos los nuevos.
    """
    db_compra = get_compra(db, empresa_id, compra_id)
    if not db_compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    # 1. Revertir inventario de la compra actual
    for detalle in db_compra.detalles:
        # Buscar movimiento de inventario asociado
        mov = db.query(models.InventoryMovement).filter(
            models.InventoryMovement.referencia == f"Compra #{db_compra.id}",
            models.InventoryMovement.producto_id == detalle.producto_id
        ).first()
        
        if mov:
            # Revertir stock (salida por el mismo valor)
            reversa = schemas.InventoryMovementCreate(
                producto_id=detalle.producto_id,
                tipo=schemas.MovementType.salida,
                cantidad=detalle.cantidad,
                motivo="Anulación por edición de compra",
                referencia=f"Reversa Compra #{db_compra.id}"
            )
            create_movement(db, empresa_id, reversa)
            db.delete(mov)

    # 2. Actualizar datos básicos
    if data.proveedor_id:
        db_compra.proveedor_id = data.proveedor_id
    if data.referencia_factura:
        db_compra.referencia_factura = data.referencia_factura
    if data.fecha:
        db_compra.fecha = data.fecha
    if data.iva_porcentaje is not None:
        db_compra.iva_porcentaje = data.iva_porcentaje

    # 3. Si vienen detalles, reemplazarlos y re-aplicar inventario
    if data.detalles is not None:
        # Eliminar detalles viejos
        for d in db_compra.detalles:
            db.delete(d)
        db_compra.detalles = []
        db.flush()

        total_bruto = 0.0
        for idx, item in enumerate(data.detalles):
            total_bruto += item.cantidad * item.precio_unitario

            db_detalle = models.DetalleCompra(
                compra_id=db_compra.id,
                producto_id=item.producto_id,
                nombre_libre=item.nombre_libre,
                sort_order=idx,
                cantidad=item.cantidad,
                precio_unitario=item.precio_unitario,
                iva_porcentaje=0.0,
                empresa_id=empresa_id
            )
            db.add(db_detalle)

            if item.producto_id is None:
                continue

            # Aplicar nuevo inventario
            prod = get_producto(db, empresa_id, item.producto_id)
            if prod:
                payload_mov = schemas.InventoryMovementCreate(
                    producto_id=item.producto_id,
                    tipo=schemas.MovementType.entrada,
                    cantidad=item.cantidad,
                    costo_unitario=item.precio_unitario,
                    motivo="Compra (Editada)",
                    referencia=f"Compra #{db_compra.id}",
                    observacion=f"Factura: {db_compra.referencia_factura or 'N/A'}"
                )
                create_movement(db, empresa_id, payload_mov)
                prod.costo = item.precio_unitario

        iva_pct = db_compra.iva_porcentaje or 0.0
        db_compra.iva_total = total_bruto * iva_pct / 100 if iva_pct > 0 else 0.0
        db_compra.total = total_bruto + db_compra.iva_total

    # 4. Manejo Inteligente de Pago
    if data.pagada is True:
        # Si se marca como pagada en la edición, actualizamos el monto pagado al nuevo total
        db_compra.monto_pagado = db_compra.total
        db_compra.estado_pago = "pagado"
    elif data.pagada is False:
        # Si se desmarca explícitamente, queda pendiente o parcial según lo que ya tuviera
        if db_compra.monto_pagado >= db_compra.total and db_compra.total > 0:
             # Caso raro: estaba pagada y la desmarcan. Bajamos el monto pagado? 
             # Para evitar líos contables, si la desmarcan pero el monto coincide, la dejamos como estaba o bajamos a 0?
             # Decisión: si la desmarcan explícitamente, asumimos que quieren ver el saldo.
             db_compra.estado_pago = "pendiente"
             db_compra.monto_pagado = 0 
        else:
             db_compra.estado_pago = "pendiente" if db_compra.monto_pagado == 0 else "parcial"
    else:
        # Si no viene el flag de pagada, recalculamos estado basado en el monto pagado previo y nuevo total
        if db_compra.monto_pagado >= db_compra.total and db_compra.total > 0:
            db_compra.estado_pago = "pagado"
        elif db_compra.monto_pagado > 0:
            db_compra.estado_pago = "parcial"
        else:
            db_compra.estado_pago = "pendiente"

    db.commit()
    db.refresh(db_compra)
    return db_compra


def delete_compra(db: Session, empresa_id: int, compra_id: int):
    """
    Elimina una compra y revierte su impacto en inventario.
    """
    db_compra = get_compra(db, empresa_id, compra_id)
    if not db_compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    # Revertir inventario (skip free-text items with no producto_id)
    for detalle in db_compra.detalles:
        if detalle.producto_id is None:
            continue
        reversa = schemas.InventoryMovementCreate(
            producto_id=detalle.producto_id,
            tipo=schemas.MovementType.salida,
            cantidad=detalle.cantidad,
            motivo="Eliminación de compra",
            referencia=f"Eliminación Compra #{db_compra.id}"
        )
        create_movement(db, empresa_id, reversa)

    db.delete(db_compra)
    db.commit()
    return True
