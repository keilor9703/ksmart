from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ
from crud.productos import get_producto
from crud.inventario import create_movement


def get_compras(db: Session, empresa_id: int, skip: int = 0, limit: int = 100):
    """✅ FILTRADO POR EMPRESA"""
    return db.query(models.Compra).options(
        joinedload(models.Compra.proveedor),
        joinedload(models.Compra.detalles).joinedload(models.DetalleCompra.producto),
        joinedload(models.Compra.pagos)
    ).filter(
        models.Compra.empresa_id == empresa_id  # ✅
    ).order_by(models.Compra.fecha.desc()).offset(skip).limit(limit).all()

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

    iva_porc = compra.iva_porcentaje
    subtotal_base = total_bruto / (1 + (iva_porc / 100))
    iva_total_calc = total_bruto - subtotal_base

    db_compra = models.Compra(
        proveedor_id=compra.proveedor_id,
        total=total_bruto,
        iva_total=iva_total_calc,
        iva_porcentaje=iva_porc,
        referencia_factura=compra.referencia_factura,
        monto_pagado=total_bruto if compra.pagada else 0.0,
        estado_pago="pagado" if compra.pagada else "pendiente",
        empresa_id=empresa_id
    )
    db.add(db_compra)
    db.flush()

    for item in compra.detalles:
        prod = get_producto(db, empresa_id, item.producto_id)
        if not prod:
            raise HTTPException(status_code=404, detail=f"Producto {item.producto_id} no encontrado")

        db_detalle = models.DetalleCompra(
            compra_id=db_compra.id,
            producto_id=item.producto_id,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,
            iva_porcentaje=0.0
        )
        db.add(db_detalle)

        # ── Crear lote automático si el detalle trae datos de lote ──────────────
        if item.numero_lote and item.fecha_vencimiento:
            prod_obj = get_producto(db, empresa_id, item.producto_id)
            if prod_obj and getattr(prod_obj, 'maneja_lotes', False):
                if not item.numero_lote or not item.fecha_vencimiento: raise ValueError(f"El producto '{prod.nombre}' es perecedero. Requiere Número de Lote y Fecha de Vencimiento.")

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
    return db_pago
