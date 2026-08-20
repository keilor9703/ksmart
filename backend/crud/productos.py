from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import timedelta
import re
import models, schemas
from crud.perecederos import crear_lote_existencia
from crud.impuestos import attach_impuestos_to_productos
from sqlalchemy import func

import json

# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCTOS
# ═══════════════════════════════════════════════════════════════════════════════

def _generate_smart_sku(db, empresa_id, grupo_id, nombre, variante_attrs=None, exclude_id=None):
    # 1. Category prefix: GrupoProducto.codigo, max 4 chars, uppercase, alphanumeric only
    grupo = db.query(models.GrupoProducto).filter(models.GrupoProducto.id == grupo_id).first()
    cat = re.sub(r'[^A-Z0-9]', '', (grupo.codigo[:4].upper() if grupo and grupo.codigo else 'GEN'))
    if not cat:
        cat = 'GEN'

    # 2. Description: longest word from nombre, max 5 chars, or first 5 chars
    words = [re.sub(r'[^A-Z0-9]', '', w.upper()) for w in nombre.split() if len(w) >= 3]
    words = [w for w in words if w]
    desc = max(words, key=len)[:5] if words else re.sub(r'[^A-Z0-9]', '', nombre.upper())[:5]
    if not desc:
        desc = 'ITEM'

    # 3. Variant attribute parts: each value max 4 chars, alphanumeric
    var_parts = []
    if variante_attrs:
        for v in variante_attrs.values():
            part = re.sub(r'[^A-Z0-9]', '', str(v).upper())[:4]
            if part:
                var_parts.append(part)

    base = '-'.join([cat, desc] + var_parts)

    # 4. Ensure uniqueness within empresa
    candidate = base
    counter = 2
    while sku_exists(db, empresa_id, candidate, exclude_id=exclude_id):
        candidate = f"{base}-{counter:02d}"
        counter += 1
    return candidate


def sku_exists(db: Session, empresa_id: int, sku: str, exclude_id: int = None) -> bool:
    q = db.query(models.Producto).filter(
        models.Producto.empresa_id == empresa_id,
        models.Producto.sku == sku,
        models.Producto.vigente == True,
    )
    if exclude_id:
        q = q.filter(models.Producto.id != exclude_id)
    if q.first() is not None:
        return True
    # El SKU de una variante vive en la misma "familia" de SKUs que los
    # productos — sin este chequeo, _generate_smart_sku podía repetir un SKU
    # que ya usaba OTRA variante (de este producto o de otro).
    qv = db.query(models.ProductoVariante).filter(
        models.ProductoVariante.empresa_id == empresa_id,
        models.ProductoVariante.sku == sku,
    )
    if exclude_id:
        qv = qv.filter(models.ProductoVariante.id != exclude_id)
    return qv.first() is not None


def attach_costo_produccion(db: Session, empresa_id: int, productos: list):
    """Anexa producto.costo_produccion = costo_unitario del último lote confirmado
    que tenga como producto resultante a este producto. UNA sola consulta."""
    if not productos:
        return productos
    # Map producto_id -> receta_ids
    receta_to_producto = dict(
        db.query(models.Receta.id, models.Receta.producto_id).filter(
            models.Receta.empresa_id == empresa_id,
            models.Receta.producto_id.in_([p.id for p in productos]),
        ).all()
    )
    if not receta_to_producto:
        return productos
    # Último lote confirmado por receta (DISTINCT ON evitado para portabilidad)
    lotes = db.query(
        models.LoteProduccion.receta_id,
        models.LoteProduccion.costo_unitario_resultado,
        models.LoteProduccion.fecha_confirmacion,
    ).filter(
        models.LoteProduccion.empresa_id == empresa_id,
        models.LoteProduccion.estado == "Confirmado",
        models.LoteProduccion.receta_id.in_(list(receta_to_producto.keys())),
    ).order_by(models.LoteProduccion.fecha_confirmacion.desc()).all()
    # producto_id -> costo del lote más reciente
    costo_map = {}
    for receta_id, costo, _fc in lotes:
        prod_id = receta_to_producto.get(receta_id)
        if prod_id and prod_id not in costo_map:
            costo_map[prod_id] = float(costo or 0.0)
    for p in productos:
        p.__dict__['costo_produccion'] = costo_map.get(p.id)
    return productos


def get_producto(db: Session, empresa_id: int, producto_id: int):
    p = db.query(models.Producto).filter(
        models.Producto.id == producto_id,
        models.Producto.empresa_id == empresa_id,
        models.Producto.vigente == True,
    ).first()
    if p:
        attach_impuestos_to_productos(db, empresa_id, [p])
        attach_costo_produccion(db, empresa_id, [p])
    return p

def get_productos(
    db: Session,
    empresa_id: int,
    skip: int = 0,
    limit: int = 100,
    solo_pos: bool = False,
    search: str = None,
    filter_group: str = None,
    filter_stock: str = None,
):
    from sqlalchemy import or_
    q = db.query(models.Producto).filter(
        models.Producto.empresa_id == empresa_id,
        models.Producto.vigente == True,
    )
    if solo_pos:
        from crud.grupos_producto import _get_overrides, _apply_empresa_overrides
        grupos = db.query(models.GrupoProducto).filter(
            or_(
                models.GrupoProducto.empresa_id.is_(None),
                models.GrupoProducto.empresa_id == empresa_id,
            )
        ).all()
        _apply_empresa_overrides(grupos, _get_overrides(db, empresa_id))
        visible_ids = [g.id for g in grupos if g.visible_pos]
        q = q.filter(models.Producto.grupo_item.in_(visible_ids))

    if filter_group:
        if filter_group == 'servicio':
            q = q.filter(models.Producto.es_servicio == True)
        else:
            try:
                q = q.filter(
                    models.Producto.es_servicio == False,
                    models.Producto.grupo_item == int(filter_group),
                )
            except (ValueError, TypeError):
                pass

    if filter_stock and filter_stock != 'all':
        if filter_stock == 'ok':
            q = q.filter(
                models.Producto.es_servicio == False,
                models.Producto.stock_actual > models.Producto.stock_minimo,
            )
        elif filter_stock == 'bajo':
            q = q.filter(
                models.Producto.es_servicio == False,
                models.Producto.stock_actual <= models.Producto.stock_minimo,
                models.Producto.stock_actual > 0,
            )
        elif filter_stock == 'sinStock':
            q = q.filter(
                models.Producto.es_servicio == False,
                models.Producto.stock_actual <= 0,
            )

    if search:
        s = f"%{search}%"
        # Join with GrupoProducto for category search
        q = q.outerjoin(
            models.GrupoProducto,
            models.Producto.grupo_item == models.GrupoProducto.id,
        ).filter(
            or_(
                models.Producto.nombre.ilike(s),
                models.Producto.sku.ilike(s),
                models.Producto.codigo_barras.ilike(s),
                models.Producto.descripcion.ilike(s),
                models.GrupoProducto.nombre.ilike(s),
            )
        )

    items = q.offset(skip).limit(limit).all()
    attach_impuestos_to_productos(db, empresa_id, items)
    attach_costo_produccion(db, empresa_id, items)
    attach_stock_vigente(db, empresa_id, items)
    return items


def attach_stock_vigente(db: Session, empresa_id: int, items: list):
    """Para productos con lotes: stock realmente vendible (excluye la cantidad
    atrapada en lotes vencidos). Los lotes vencidos suman a stock_actual pero
    el FEFO no los consume — mostrar stock_actual en el POS confunde al
    cajero ('hay 5' pero la venta falla). Una sola consulta agregada."""
    from datetime import date as _date
    from sqlalchemy import func as _func
    ids_lotes = [p.id for p in items if getattr(p, "maneja_lotes", False) and not p.es_servicio]
    vencido_por_prod = {}
    if ids_lotes:
        rows = (
            db.query(
                models.LoteExistencia.producto_id,
                _func.coalesce(_func.sum(models.LoteExistencia.cantidad_actual), 0),
            )
            .filter(
                models.LoteExistencia.empresa_id == empresa_id,
                models.LoteExistencia.producto_id.in_(ids_lotes),
                models.LoteExistencia.cantidad_actual > 0,
                models.LoteExistencia.fecha_vencimiento != None,  # noqa: E711
                models.LoteExistencia.fecha_vencimiento < _date.today(),
            )
            .group_by(models.LoteExistencia.producto_id)
            .all()
        )
        vencido_por_prod = {pid: float(total) for pid, total in rows}
    for p in items:
        vencido = vencido_por_prod.get(p.id, 0.0)
        p.stock_vigente = max(0.0, (p.stock_actual or 0) - vencido)

def create_producto(db: Session, empresa_id: int, producto: schemas.ProductoCreate):
    # Extraer campos de inicialización de stock para que no rompan el constructor del Modelo
    stock_inicial     = producto.stock_inicial
    numero_lote       = producto.numero_lote
    fecha_vencimiento = producto.fecha_vencimiento
    sku_provided      = (producto.sku or '').strip() or None

    # Datos limpios para el modelo Producto
    prod_data = producto.dict(exclude={'stock_inicial', 'numero_lote', 'fecha_vencimiento'})
    prod_data['sku'] = None  # se asigna después de obtener el id

    db_producto = models.Producto(**prod_data, empresa_id=empresa_id)
    db.add(db_producto)
    db.commit()
    db.refresh(db_producto)

    # Asignar SKU: usar el provisto (si es único) o autogenerar
    if sku_provided and not sku_exists(db, empresa_id, sku_provided, exclude_id=db_producto.id):
        db_producto.sku = sku_provided.upper()
    else:
        db_producto.sku = _generate_smart_sku(db, empresa_id, db_producto.grupo_item, db_producto.nombre)
    db.commit()
    db.refresh(db_producto)
    
    # ... rest of logic unchanged ...

    # Lógica de inicialización de Stock / Lotes
    if stock_inicial and stock_inicial > 0:
        if db_producto.maneja_lotes:
            # Si es perecedero, creamos su primer lote
            lote_payload = schemas.LoteExistenciaCreate(
                producto_id       = db_producto.id,
                numero_lote       = numero_lote or "LOTE-INICIAL",
                fecha_vencimiento = fecha_vencimiento or (models.utcnow().date() + timedelta(days=365)),
                cantidad_inicial  = stock_inicial,
                costo_unitario    = db_producto.costo or 0.0,
                observaciones     = "Ingreso inicial desde Registro Ágil"
            )
            crear_lote_existencia(db, empresa_id, lote_payload)
        else:
            # Si no es perecedero, registro de entrada simple
            db_producto.stock_actual = stock_inicial
            db.add(models.InventoryMovement(
                producto_id    = db_producto.id,
                empresa_id     = empresa_id,
                tipo           = "entrada",
                cantidad       = stock_inicial,
                costo_unitario = db_producto.costo or 0.0,
                motivo         = "inicializacion_stock",
                referencia     = "Registro Ágil"
            ))
            db.commit()

    db.refresh(db_producto)
    return db_producto

def update_producto(db: Session, empresa_id: int, producto_id: int, producto: schemas.ProductoBase):
    db_producto = get_producto(db, empresa_id, producto_id)
    if db_producto:
        update_data = producto.dict(exclude_unset=True)

        # Validar SKU: si se provee uno nuevo, debe ser único en la empresa
        new_sku = (update_data.get('sku') or '').strip().upper() or None
        if new_sku:
            if sku_exists(db, empresa_id, new_sku, exclude_id=producto_id):
                from fastapi import HTTPException
                raise HTTPException(status_code=409, detail=f"El SKU '{new_sku}' ya está en uso por otro producto.")
            update_data['sku'] = new_sku
        else:
            update_data.pop('sku', None)  # no borrar el SKU existente si viene vacío

        for key, value in update_data.items():
            setattr(db_producto, key, value)
        db.commit()
        db.refresh(db_producto)
    return db_producto

def delete_producto(db: Session, empresa_id: int, producto_id: int):
    db_producto = get_producto(db, empresa_id, producto_id)
    if db_producto:
        db_producto.vigente = False
        db.commit()
    return db_producto


def generar_variantes(db: Session, empresa_id: int, producto_id: int, payload: schemas.VariantesGenerarIn):
    """Crea varias variantes de una sola vez a partir de un atributo (ej.
    "Talla") y una lista de valores (35, 36, 37...), compartiendo precio,
    costo y demás atributos comunes — evita repetir un formulario completo
    por cada valor cuando lo único que cambia es ese atributo."""
    prod = get_producto(db, empresa_id, producto_id)
    if not prod:
        raise ValueError("Producto no encontrado")

    creadas = []
    for v in payload.valores:
        attrs = {**payload.atributos_comunes, payload.atributo: v.valor}
        var_sku = _generate_smart_sku(db, empresa_id, prod.grupo_item, prod.nombre, variante_attrs=attrs)
        variante = models.ProductoVariante(
            empresa_id   = empresa_id,
            producto_id  = producto_id,
            sku          = var_sku,
            nombre       = f"{payload.atributo}: {v.valor}",
            atributos    = attrs,
            precio       = v.precio if v.precio is not None else payload.precio,
            costo        = v.costo if v.costo is not None else payload.costo,
            stock_minimo = payload.stock_minimo,
            stock_actual = v.stock_inicial,
            activo       = True,
        )
        db.add(variante)
        # Flush ya mismo: si dos filas de este mismo lote generan el mismo SKU
        # candidato (ej. dos valores que truncan igual), la siguiente iteración
        # de _generate_smart_sku debe poder ver esta variante para detectarlo.
        db.flush()
        creadas.append(variante)

    prod.tiene_variantes = True
    db.add(prod)
    db.commit()
    for v in creadas:
        db.refresh(v)
    return creadas


def create_variante(db: Session, empresa_id: int, producto_id: int, payload: schemas.ProductoVarianteCreate):
    prod = get_producto(db, empresa_id, producto_id)
    if not prod:
        raise ValueError("Producto no encontrado")

    # Generate SKU for variant
    attrs = payload.atributos or {}
    if payload.sku and not sku_exists(db, empresa_id, payload.sku.upper(), exclude_id=None):
        var_sku = payload.sku.upper()
    else:
        var_sku = _generate_smart_sku(db, empresa_id, prod.grupo_item, prod.nombre, variante_attrs=attrs)

    variante = models.ProductoVariante(
        empresa_id   = empresa_id,
        producto_id  = producto_id,
        sku          = var_sku,
        nombre       = payload.nombre,
        atributos    = attrs,
        precio       = payload.precio,
        costo        = payload.costo,
        stock_minimo = payload.stock_minimo,
        stock_actual = payload.stock_inicial if hasattr(payload, 'stock_inicial') else 0.0,
        activo       = True,
    )
    db.add(variante)

    # Mark parent as having variants
    prod.tiene_variantes = True
    db.add(prod)
    db.commit()
    db.refresh(variante)
    return variante


def list_variantes(db: Session, empresa_id: int, producto_id: int):
    return db.query(models.ProductoVariante).filter(
        models.ProductoVariante.empresa_id == empresa_id,
        models.ProductoVariante.producto_id == producto_id,
    ).order_by(models.ProductoVariante.id).all()


def update_variante(db: Session, empresa_id: int, variante_id: int, payload: schemas.ProductoVarianteUpdate):
    v = db.query(models.ProductoVariante).filter(
        models.ProductoVariante.id == variante_id,
        models.ProductoVariante.empresa_id == empresa_id,
    ).first()
    if not v:
        raise ValueError("Variante no encontrada")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(v, field, value)
    db.commit()
    db.refresh(v)
    return v


def delete_variante(db: Session, empresa_id: int, variante_id: int):
    v = db.query(models.ProductoVariante).filter(
        models.ProductoVariante.id == variante_id,
        models.ProductoVariante.empresa_id == empresa_id,
    ).first()
    if v:
        prod_id = v.producto_id
        db.delete(v)
        db.commit()
        # If no more variants, unset tiene_variantes
        remaining = db.query(models.ProductoVariante).filter(
            models.ProductoVariante.producto_id == prod_id,
            models.ProductoVariante.empresa_id == empresa_id,
        ).count()
        if remaining == 0:
            prod = db.query(models.Producto).filter(models.Producto.id == prod_id).first()
            if prod:
                prod.tiene_variantes = False
                db.commit()
    return v
