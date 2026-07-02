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
        joinedload(models.Receta.items).joinedload(models.RecetaItem.insumo),
        joinedload(models.Receta.servicios_maquila).joinedload(models.RecetaServicio.servicio),
    ).filter(
        models.Receta.empresa_id == empresa_id
    ).offset(skip).limit(limit).all()

def get_receta(db: Session, empresa_id: int, receta_id: int):
    return db.query(models.Receta).options(
        joinedload(models.Receta.producto_resultante),
        joinedload(models.Receta.items).joinedload(models.RecetaItem.insumo),
        joinedload(models.Receta.servicios_maquila).joinedload(models.RecetaServicio.servicio),
    ).filter(
        models.Receta.id == receta_id,
        models.Receta.empresa_id == empresa_id
    ).first()

def get_receta_by_producto(db: Session, empresa_id: int, producto_id: int):
    return db.query(models.Receta).filter(
        models.Receta.producto_id == producto_id,
        models.Receta.empresa_id == empresa_id
    ).first()

def check_can_delete_receta(db: Session, empresa_id: int, receta_id: int):
    lotes = db.query(models.LoteProduccion).filter(
        models.LoteProduccion.receta_id == receta_id,
        models.LoteProduccion.empresa_id == empresa_id
    ).count()
    bloqueos = []
    if lotes > 0:
        bloqueos.append(f"tiene {lotes} lote(s) de producción asociados")
    return bloqueos

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
        rendimiento_esperado=getattr(receta, 'rendimiento_esperado', 1.0) or 1.0,
        notas_tecnicas=getattr(receta, 'notas_tecnicas', None),
        porciones=getattr(receta, 'porciones', 1) or 1,
        precio_sugerido=getattr(receta, 'precio_sugerido', None),
        empresa_id=empresa_id
    )
    db.add(db_receta)
    db.flush()

    for item in receta.items:
        db_item = models.RecetaItem(
            receta_id=db_receta.id,
            insumo_id=item.insumo_id,
            cantidad=item.cantidad,
            merma_pct=getattr(item, 'merma_pct', 0.0) or 0.0,
        )
        db.add(db_item)

    for srv in receta.servicios:
        serv = get_producto(db, empresa_id, srv.servicio_id)
        if not serv:
            raise ValueError(f"Servicio {srv.servicio_id} no encontrado")
        db_srv = models.RecetaServicio(
            receta_id=db_receta.id,
            servicio_id=srv.servicio_id,
            cantidad=getattr(srv, 'cantidad', 1.0) or 1.0,
        )
        db.add(db_srv)

    db.commit()
    db.refresh(db_receta)
    return db_receta

def update_receta(db: Session, empresa_id: int, receta_id: int, receta: schemas.RecetaCreate):
    db_receta = db.query(models.Receta).filter(
        models.Receta.id == receta_id,
        models.Receta.empresa_id == empresa_id
    ).first()
    if not db_receta:
        raise ValueError("Receta no encontrada")

    producto = get_producto(db, empresa_id, receta.producto_id)
    if not producto:
        raise ValueError("Producto resultante no encontrado")

    for item in receta.items:
        db_prod = get_producto(db, empresa_id, item.insumo_id)
        if not db_prod:
            raise ValueError(f"Insumo con ID {item.insumo_id} no encontrado")
        if db_prod.grupo_item not in [1, 4]:
            raise ValueError(f"El ítem '{db_prod.nombre}' no puede ser insumo.")

    db_receta.producto_id = receta.producto_id
    db_receta.nombre = receta.nombre
    db_receta.descripcion = receta.descripcion
    db_receta.rendimiento_esperado = getattr(receta, 'rendimiento_esperado', 1.0) or 1.0
    db_receta.notas_tecnicas = getattr(receta, 'notas_tecnicas', None)
    db_receta.porciones = getattr(receta, 'porciones', 1) or 1
    db_receta.precio_sugerido = getattr(receta, 'precio_sugerido', None)

    db.query(models.RecetaItem).filter(models.RecetaItem.receta_id == receta_id).delete()
    for item in receta.items:
        db.add(models.RecetaItem(
            receta_id=receta_id,
            insumo_id=item.insumo_id,
            cantidad=item.cantidad,
            merma_pct=getattr(item, 'merma_pct', 0.0) or 0.0,
        ))

    db.query(models.RecetaServicio).filter(models.RecetaServicio.receta_id == receta_id).delete()
    for srv in receta.servicios:
        serv = get_producto(db, empresa_id, srv.servicio_id)
        if not serv:
            raise ValueError(f"Servicio {srv.servicio_id} no encontrado")
        db.add(models.RecetaServicio(
            receta_id=receta_id,
            servicio_id=srv.servicio_id,
            cantidad=getattr(srv, 'cantidad', 1.0) or 1.0,
        ))

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
        joinedload(models.LoteProduccion.receta).joinedload(models.Receta.items).joinedload(models.RecetaItem.insumo),
        joinedload(models.LoteProduccion.cliente)
    ).filter(
        models.LoteProduccion.empresa_id == empresa_id
    ).order_by(models.LoteProduccion.fecha_planificada.desc()).offset(skip).limit(limit).all()

def get_lote(db: Session, empresa_id: int, lote_id: int):
    return db.query(models.LoteProduccion).options(
        joinedload(models.LoteProduccion.receta).joinedload(models.Receta.producto_resultante),
        joinedload(models.LoteProduccion.receta).joinedload(models.Receta.items).joinedload(models.RecetaItem.insumo),
        joinedload(models.LoteProduccion.receta).joinedload(models.Receta.servicios_maquila).joinedload(models.RecetaServicio.servicio),
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

    numero_lote_produccion = getattr(lote, 'numero_lote_produccion', None)
    if not numero_lote_produccion:
        numero_lote_produccion = get_next_numero_lote(db, empresa_id)

    db_lote = models.LoteProduccion(
        receta_id=lote.receta_id,
        cantidad_a_producir=lote.cantidad_a_producir,
        cliente_id=cliente_id,
        observaciones=lote.observaciones,
        numero_lote_produccion=numero_lote_produccion,
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
        nombre="Producción Interna",
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
    from crud.perecederos import crear_lote_existencia

    db_lote = get_lote(db, empresa_id, lote_id)
    if not db_lote or db_lote.estado != "En produccion":
        raise ValueError("El lote no existe o ya ha sido procesado.")

    receta = db_lote.receta
    cantidad_teorica = db_lote.cantidad_a_producir
    cantidad_final = confirm_data.cantidad_real

    if cantidad_final is None or cantidad_final <= 0:
        raise ValueError("La cantidad realmente producida debe ser mayor a cero.")

    # ─── 1. PRE-VALIDACIÓN: verificar TODO el stock antes de consumir nada ───
    insumos_plan = []  # (insumo, cantidad_requerida_con_merma, item)
    for item in receta.items:
        insumo = get_producto(db, empresa_id, item.insumo_id)
        if not insumo:
            raise ValueError(f"Insumo {item.insumo_id} no encontrado")
        merma_pct = getattr(item, 'merma_pct', 0.0) or 0.0
        factor_merma = 1.0 + (merma_pct / 100.0)
        cantidad_requerida = item.cantidad * cantidad_teorica * factor_merma
        if (insumo.stock_actual or 0) < cantidad_requerida:
            raise ValueError(
                f"Stock insuficiente para: {insumo.nombre}. "
                f"Req: {round(cantidad_requerida, 4)}, Disp: {insumo.stock_actual or 0}"
            )
        insumos_plan.append((insumo, cantidad_requerida, item))

    costo_insumos_acumulado = 0.0
    costo_maquila_acumulado = 0.0

    # ─── 2. CONSUMO DE INSUMOS (sin commits intermedios) ───
    for insumo, cantidad_requerida, item in insumos_plan:
        costo_insumos_acumulado += cantidad_requerida * (insumo.costo or 0.0)

        if getattr(insumo, "maneja_lotes", False):
            consumir_stock_fefo(
                db, empresa_id, insumo.id, cantidad_requerida,
                motivo="Producción - Consumo", referencia=f"Lote #{db_lote.id}",
                commit=False,
            )
            insumo.stock_actual = (insumo.stock_actual or 0) - cantidad_requerida
            db.add(insumo)
        else:
            mov_salida = schemas.InventoryMovementCreate(
                producto_id=insumo.id,
                tipo=schemas.MovementType.salida,
                cantidad=cantidad_requerida,
                costo_unitario=insumo.costo or 0.0,
                motivo="Producción - Consumo",
                referencia=f"Lote #{db_lote.id}",
                observacion=f"Consumo para {cantidad_teorica} de {receta.producto_resultante.nombre}"
            )
            create_movement(db, empresa_id, mov_salida, commit=False)

    # ─── 3. COSTO DE SERVICIOS DE MAQUILA ───
    precios_override = {p.servicio_id: p.precio for p in (confirm_data.precios_servicios or [])}
    for srv in (receta.servicios_maquila or []):
        servicio = get_producto(db, empresa_id, srv.servicio_id)
        if not servicio:
            continue
        precio_unit = precios_override.get(
            srv.servicio_id,
            servicio.costo if (servicio.costo or 0) > 0 else (servicio.precio or 0.0)
        )
        cantidad_srv = getattr(srv, 'cantidad', 1.0) or 1.0
        costo_servicio = cantidad_srv * float(precio_unit or 0.0)
        costo_maquila_acumulado += costo_servicio

    costo_total_acumulado = costo_insumos_acumulado + costo_maquila_acumulado
    costo_unitario_final = (costo_total_acumulado / cantidad_final) if cantidad_final > 0 else 0.0

    # ─── 4. INGRESO DEL PRODUCTO TERMINADO A BODEGA ───
    if getattr(receta.producto_resultante, "maneja_lotes", False):
        if not confirm_data.numero_lote or not confirm_data.fecha_vencimiento:
            raise ValueError(f"El producto resultante '{receta.producto_resultante.nombre}' es perecedero. Debes asignarle Número de Lote y Fecha de Vencimiento.")

        payload_lote = schemas.LoteExistenciaCreate(
            producto_id=receta.producto_id,
            numero_lote=confirm_data.numero_lote,
            fecha_vencimiento=confirm_data.fecha_vencimiento,
            fecha_fabricacion=confirm_data.fecha_fabricacion,
            cantidad_inicial=cantidad_final,
            costo_unitario=costo_unitario_final,
            referencia_compra=f"Producción #{db_lote.id}",
            observaciones=confirm_data.observaciones
        )
        crear_lote_existencia(db, empresa_id, payload_lote, commit=False)
    else:
        mov_entrada = schemas.InventoryMovementCreate(
            producto_id=receta.producto_id,
            tipo=schemas.MovementType.entrada,
            cantidad=cantidad_final,
            costo_unitario=costo_unitario_final,
            motivo="Producción - Finalizado",
            referencia=f"Lote #{db_lote.id}",
            observacion=f"Costo unit: {costo_unitario_final:.2f} (MP: {costo_insumos_acumulado:.2f} | Maquila: {costo_maquila_acumulado:.2f})"
        )
        create_movement(db, empresa_id, mov_entrada, commit=False)

    # ─── 5. Cierre del lote ───
    db_lote.estado = "Confirmado"
    db_lote.cantidad_real = cantidad_final
    db_lote.costo_total = costo_total_acumulado
    db_lote.costo_insumos = costo_insumos_acumulado
    db_lote.costo_maquila = costo_maquila_acumulado
    db_lote.costo_unitario_resultado = costo_unitario_final
    db_lote.fecha_confirmacion = datetime.now(timezone.utc)

    # ─── Propagación de costo en cascada: actualizar el costo del producto resultante
    # para que el siguiente lote que lo use como insumo tome el costo real de producción.
    if costo_unitario_final > 0 and receta.producto_resultante:
        receta.producto_resultante.costo = costo_unitario_final
        db.add(receta.producto_resultante)
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
    if not db_lote:
        raise ValueError("Lote no encontrado.")
    if db_lote.estado != "En produccion":
        raise ValueError(f"El lote no se puede cancelar porque su estado es '{db_lote.estado}'.")
    db_lote.estado = "Cancelado"
    db.commit()
    db.refresh(db_lote)
    return db_lote

def get_simulacion_receta(db: Session, empresa_id: int, receta_id: int, cantidad: float = 1.0):
    """Devuelve la simulación de un lote: factibilidad, faltantes, costo estimado y
    cantidad máxima producible según stock actual de insumos."""
    receta = get_receta(db, empresa_id, receta_id)
    if not receta:
        return None

    faltantes = []
    detalle_insumos = []
    costo_total = 0.0
    cantidad_maxima = float('inf')

    for item in receta.items:
        insumo = get_producto(db, empresa_id, item.insumo_id)
        if not insumo:
            continue
        merma_pct = getattr(item, 'merma_pct', 0.0) or 0.0
        factor = 1.0 + merma_pct / 100.0
        qty_unitaria_con_merma = item.cantidad * factor  # consumo por 1 unidad pedida
        requerido = qty_unitaria_con_merma * cantidad
        disponible = float(insumo.stock_actual or 0)
        costo_total += requerido * float(insumo.costo or 0.0)

        # Cuántas unidades del lote se pueden producir con este insumo
        if qty_unitaria_con_merma > 0:
            max_por_insumo = disponible / qty_unitaria_con_merma
            cantidad_maxima = min(cantidad_maxima, max_por_insumo)

        detalle_insumos.append({
            "insumo_id": insumo.id,
            "nombre": insumo.nombre,
            "unidad": insumo.unidad_medida,
            "requerido": round(requerido, 4),
            "disponible": round(disponible, 4),
            "suficiente": disponible >= requerido,
        })

        if disponible < requerido:
            faltantes.append({
                "insumo_id": insumo.id,
                "nombre": insumo.nombre,
                "unidad": insumo.unidad_medida,
                "requerido": round(requerido, 4),
                "disponible": round(disponible, 4),
                "faltante": round(requerido - disponible, 4),
            })

    # Servicios de maquila al costo configurado
    for srv in (receta.servicios_maquila or []):
        servicio = get_producto(db, empresa_id, srv.servicio_id)
        if not servicio:
            continue
        cantidad_srv = getattr(srv, 'cantidad', 1.0) or 1.0
        precio_srv = (servicio.costo or 0) if (servicio.costo or 0) > 0 else (servicio.precio or 0.0)
        costo_total += cantidad_srv * float(precio_srv)

    if cantidad_maxima == float('inf'):
        cantidad_maxima = 0.0  # no hay insumos definidos

    return {
        "receta_id": receta.id,
        "cantidad_solicitada": cantidad,
        "factible": len(faltantes) == 0,
        "faltantes": faltantes,
        "detalle_insumos": detalle_insumos,
        "costo_teorico_total": round(costo_total, 2),
        "costo_por_unidad": round(costo_total / cantidad, 2) if cantidad > 0 else 0.0,
        "cantidad_maxima_producible": round(cantidad_maxima, 4),
    }


def get_next_numero_lote(db: Session, empresa_id: int) -> str:
    """Genera el siguiente código de orden con patrón OP{YYYYMMDD}{seq}."""
    from datetime import date
    hoy = date.today()
    prefijo = f"OP{hoy.strftime('%Y%m%d')}"
    # Contar lotes de la empresa con número que empiece por el prefijo de hoy
    count = db.query(models.LoteProduccion).filter(
        models.LoteProduccion.empresa_id == empresa_id,
        models.LoteProduccion.numero_lote_produccion.like(f"{prefijo}%"),
    ).count()
    return f"{prefijo}{count + 1}"


def get_analisis_receta(db: Session, empresa_id: int, receta_id: int, cantidad: float = 1.0):
    """Cost analysis and profitability for a recipe at a given production quantity."""
    receta = get_receta(db, empresa_id, receta_id)
    if not receta:
        return None

    rendimiento = getattr(receta, 'rendimiento_esperado', 1.0) or 1.0
    costo_insumos = 0.0
    costo_maquila = 0.0
    detalle_insumos = []
    detalle_maquila = []

    for item in receta.items:
        insumo = get_producto(db, empresa_id, item.insumo_id)
        if not insumo:
            continue
        merma_pct = getattr(item, 'merma_pct', 0.0) or 0.0
        factor = 1.0 + merma_pct / 100.0
        qty_neta = item.cantidad * cantidad
        qty_con_merma = qty_neta * factor
        costo_unit = insumo.costo or 0.0
        subtotal = qty_con_merma * costo_unit
        costo_insumos += subtotal
        detalle_insumos.append({
            "insumo": insumo.nombre,
            "unidad": insumo.unidad_medida,
            "cantidad_neta": round(qty_neta, 4),
            "merma_pct": merma_pct,
            "cantidad_con_merma": round(qty_con_merma, 4),
            "costo_unitario": costo_unit,
            "subtotal": round(subtotal, 2),
            "stock_disponible": insumo.stock_actual or 0,
            "stock_suficiente": (insumo.stock_actual or 0) >= qty_con_merma,
        })

    for srv in (receta.servicios_maquila or []):
        servicio = get_producto(db, empresa_id, srv.servicio_id)
        if not servicio:
            continue
        cantidad_srv = getattr(srv, 'cantidad', 1.0) or 1.0
        precio_srv = (servicio.costo or 0) if (servicio.costo or 0) > 0 else (servicio.precio or 0.0)
        subtotal = cantidad_srv * float(precio_srv)
        costo_maquila += subtotal
        detalle_maquila.append({
            "servicio": servicio.nombre,
            "cantidad": cantidad_srv,
            "precio_unitario": float(precio_srv),
            "subtotal": round(subtotal, 2),
        })

    costo_total = costo_insumos + costo_maquila
    unidades_netas = cantidad * rendimiento
    costo_por_unidad = costo_total / unidades_netas if unidades_netas > 0 else 0.0
    precio_venta = getattr(receta, 'precio_sugerido', None) or (
        getattr(receta.producto_resultante, 'precio_venta', None) or 0.0
    )
    margen_pct = ((precio_venta - costo_por_unidad) / precio_venta * 100) if precio_venta > 0 and costo_por_unidad > 0 else None

    return {
        "receta_id": receta.id,
        "nombre": receta.nombre,
        "cantidad_produccion": cantidad,
        "rendimiento_esperado": rendimiento,
        "unidades_netas": round(unidades_netas, 2),
        "costo_insumos": round(costo_insumos, 2),
        "costo_maquila": round(costo_maquila, 2),
        "costo_total": round(costo_total, 2),
        "costo_por_unidad": round(costo_por_unidad, 2),
        "precio_venta_sugerido": precio_venta,
        "margen_pct": round(margen_pct, 1) if margen_pct is not None else None,
        "detalle_insumos": detalle_insumos,
        "detalle_maquila": detalle_maquila,
    }
