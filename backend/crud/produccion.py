from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ
from crud.clientes import get_cliente
from crud.productos import get_producto
from crud.inventario import create_movement

# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCCIÓN - RECETAS Y LOTES
# ═══════════════════════════════════════════════════════════════════════════════

def get_recetas(db: Session, empresa_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Receta).options(
        joinedload(models.Receta.producto_resultante),
        joinedload(models.Receta.items).joinedload(models.RecetaItem.insumo)
    ).filter(
        models.Receta.empresa_id == empresa_id
    ).offset(skip).limit(limit).all()

def get_receta(db: Session, empresa_id: int, receta_id: int):
    return db.query(models.Receta).options(
        joinedload(models.Receta.producto_resultante),
        joinedload(models.Receta.items).joinedload(models.RecetaItem.insumo)
    ).filter(
        models.Receta.id == receta_id,
        models.Receta.empresa_id == empresa_id
    ).first()

def get_receta_by_producto(db: Session, empresa_id: int, producto_id: int):
    return db.query(models.Receta).filter(
        models.Receta.producto_id == producto_id,
        models.Receta.empresa_id == empresa_id
    ).first()

def create_receta(db: Session, empresa_id: int, receta: schemas.RecetaCreate):
    producto = get_producto(db, empresa_id, receta.producto_id)
    if not producto:
        raise ValueError("Producto resultante no encontrado o no pertenece a esta empresa")

    for item in receta.items:
        db_prod = get_producto(db, empresa_id, item.insumo_id)
        if not db_prod:
            raise ValueError(f"Insumo con ID {item.insumo_id} no encontrado o no pertenece a esta empresa.")
        if db_prod.grupo_item not in [1, 4]:
            raise ValueError(f"El ítem '{db_prod.nombre}' no puede ser insumo. Solo se permiten Materias Primas o Insumos.")

    db_receta = models.Receta(
        producto_id=receta.producto_id,
        nombre=receta.nombre,
        descripcion=receta.descripcion,
        empresa_id=empresa_id
    )
    db.add(db_receta)
    db.flush()

    for item in receta.items:
        db_item = models.RecetaItem(
            receta_id=db_receta.id,
            insumo_id=item.insumo_id,
            cantidad=item.cantidad
        )
        db.add(db_item)

    for srv in receta.servicios:
        serv = get_producto(db, empresa_id, srv.servicio_id)
        if not serv:
            raise ValueError(f"Servicio {srv.servicio_id} no encontrado")
        db_srv = models.RecetaServicio(
            receta_id=db_receta.id,
            servicio_id=srv.servicio_id
        )
        db.add(db_srv)

    db.commit()
    db.refresh(db_receta)
    return db_receta

def delete_receta(db: Session, empresa_id: int, receta_id: int):
    db_receta = db.query(models.Receta).filter(
        models.Receta.id == receta_id,
        models.Receta.empresa_id == empresa_id
    ).first()
    if db_receta:
        db.delete(db_receta)
        db.commit()
        return True
    return False

def get_lotes(db: Session, empresa_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.LoteProduccion).options(
        joinedload(models.LoteProduccion.receta).joinedload(models.Receta.producto_resultante),
        joinedload(models.LoteProduccion.cliente)
    ).filter(
        models.LoteProduccion.empresa_id == empresa_id
    ).order_by(models.LoteProduccion.fecha_planificada.desc()).offset(skip).limit(limit).all()

def get_lote(db: Session, empresa_id: int, lote_id: int):
    return db.query(models.LoteProduccion).options(
        joinedload(models.LoteProduccion.receta).joinedload(models.Receta.producto_resultante),
        joinedload(models.LoteProduccion.receta).joinedload(models.Receta.items).joinedload(models.RecetaItem.insumo),
        joinedload(models.LoteProduccion.cliente)
    ).filter(
        models.LoteProduccion.id == lote_id,
        models.LoteProduccion.empresa_id == empresa_id
    ).first()

def create_lote(db: Session, empresa_id: int, lote: schemas.LoteProduccionCreate):
    receta = get_receta(db, empresa_id, lote.receta_id)
    if not receta:
        raise ValueError("Receta no encontrada o no pertenece a esta empresa")

    cliente_id = lote.cliente_id

    if cliente_id is None:
        interno = get_or_create_cliente_interno(db, empresa_id)
        cliente_id = interno.id
    else:
        cliente = get_cliente(db, empresa_id, cliente_id)
        if not cliente:
            raise ValueError("Cliente no encontrado o no pertenece a esta empresa")

    db_lote = models.LoteProduccion(
        receta_id=lote.receta_id,
        cantidad_a_producir=lote.cantidad_a_producir,
        cliente_id=cliente_id,
        observaciones=lote.observaciones,
        estado="En produccion",
        empresa_id=empresa_id,
        fecha_planificada=datetime.now(timezone.utc)
    )
    db.add(db_lote)
    db.commit()
    db.refresh(db_lote)
    return db_lote

def get_or_create_cliente_interno(db: Session, empresa_id: int) -> models.Cliente:
    interno = db.query(models.Cliente).filter(
        models.Cliente.cedula == "INTERNO",
        models.Cliente.empresa_id == empresa_id
    ).first()
    if interno:
        return interno

    interno = models.Cliente(
        nombre="Vialmar - Producción interna",
        cedula="INTERNO",
        es_cliente=True,
        es_proveedor=False,
        empresa_id=empresa_id
    )
    db.add(interno)
    db.commit()
    db.refresh(interno)
    return interno

def confirmar_lote_produccion(db: Session, empresa_id: int, lote_id: int, confirm_data: schemas.LoteProduccionConfirm):
    from crud.ventas import consumir_stock_fefo
    db_lote = get_lote(db, empresa_id, lote_id)
    if not db_lote or db_lote.estado != "En produccion":
        raise ValueError("El lote no existe o ya ha sido procesado.")

    receta = db_lote.receta
    cantidad_teorica = db_lote.cantidad_a_producir
    cantidad_final = confirm_data.cantidad_real

    costo_total_acumulado = 0.0

    # ─── 1. CONSUMO DE INSUMOS ───
    for item in receta.items:
        insumo = get_producto(db, empresa_id, item.insumo_id)
        if not insumo:
            raise ValueError(f"Insumo {item.insumo_id} no encontrado")

        cantidad_requerida = item.cantidad * cantidad_teorica
        if (insumo.stock_actual or 0) < cantidad_requerida:
            raise ValueError(f"Stock insuficiente para: {insumo.nombre}. Req: {cantidad_requerida}, Disp: {insumo.stock_actual}")

        costo_insumo_total = cantidad_requerida * (insumo.costo or 0.0)
        costo_total_acumulado += costo_insumo_total

        if getattr(insumo, "maneja_lotes", False):
            # Consumo de insumo usando FEFO
            consumir_stock_fefo(
                db, empresa_id, insumo.id, cantidad_requerida,
                motivo="Producción - Consumo", referencia=f"Lote #{db_lote.id}"
            )
            insumo.stock_actual = (insumo.stock_actual or 0) - cantidad_requerida
            db.add(insumo)
        else:
            # Consumo de insumo regular
            mov_salida = schemas.InventoryMovementCreate(
                producto_id=item.insumo_id,
                tipo=schemas.MovementType.salida,
                cantidad=cantidad_requerida,
                costo_unitario=insumo.costo or 0.0,
                motivo="Producción - Consumo",
                referencia=f"Lote #{db_lote.id}",
                observacion=f"Consumo para {cantidad_teorica} de {receta.producto_resultante.nombre}"
            )
            create_movement(db, empresa_id, mov_salida)

    costo_unitario_final = (costo_total_acumulado / cantidad_final) if cantidad_final > 0 else 0.0

    # ─── 2. INGRESO DEL PRODUCTO TERMINADO A BODEGA ───
    if getattr(receta.producto_resultante, "maneja_lotes", False):
        if not confirm_data.numero_lote or not confirm_data.fecha_vencimiento:
            raise ValueError(f"El producto resultante '{receta.producto_resultante.nombre}' es perecedero. Debes asignarle Número de Lote y Fecha de Vencimiento.")

        payload_lote = schemas.LoteExistenciaCreate(
            producto_id=receta.producto_id,
            numero_lote=confirm_data.numero_lote,
            fecha_vencimiento=confirm_data.fecha_vencimiento,
            fecha_fabricacion=confirm_data.fecha_fabricacion if hasattr(confirm_data, 'fecha_fabricacion') else None,
            cantidad_inicial=cantidad_final,
            costo_unitario=costo_unitario_final,
            referencia_compra=f"Producción #{db_lote.id}",
            observaciones=confirm_data.observaciones
        )
        from crud.lotes import crear_lote_existencia
        crear_lote_existencia(db, empresa_id, payload_lote)
    else:
        mov_entrada = schemas.InventoryMovementCreate(
            producto_id=receta.producto_id,
            tipo=schemas.MovementType.entrada,
            cantidad=cantidad_final,
            costo_unitario=costo_unitario_final,
            motivo="Producción - Finalizado",
            referencia=f"Lote #{db_lote.id}",
            observacion=f"Costo unitario calculado: {costo_unitario_final:.2f}"
        )
        create_movement(db, empresa_id, mov_entrada)

    # Actualizamos el estado del lote de producción
    db_lote.estado = "Confirmado"
    db_lote.cantidad_real = cantidad_final
    db_lote.costo_total = costo_total_acumulado
    db_lote.costo_unitario_resultado = costo_unitario_final
    db_lote.fecha_confirmacion = datetime.now(timezone.utc)
    if confirm_data.observaciones:
        db_lote.observaciones = (db_lote.observaciones or "") + " | Cierre: " + confirm_data.observaciones

    db.commit()
    db.refresh(db_lote)
    return db_lote

def cancelar_lote(db: Session, empresa_id: int, lote_id: int):
    db_lote = db.query(models.LoteProduccion).filter(
        models.LoteProduccion.id == lote_id,
        models.LoteProduccion.empresa_id == empresa_id
    ).first()
    if db_lote and db_lote.estado == "En produccion":
        db_lote.estado = "Cancelado"
        db.commit()
        return True
    return False
