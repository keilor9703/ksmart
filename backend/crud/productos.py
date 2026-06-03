from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import timedelta
import re
import models, schemas
from crud.perecederos import crear_lote_existencia
from crud.impuestos import attach_impuestos_to_productos

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
    return q.first() is not None


def get_producto(db: Session, empresa_id: int, producto_id: int):
    p = db.query(models.Producto).filter(
        models.Producto.id == producto_id,
        models.Producto.empresa_id == empresa_id,
        models.Producto.vigente == True,
    ).first()
    if p:
        attach_impuestos_to_productos(db, empresa_id, [p])
    return p

def get_productos(db: Session, empresa_id: int, skip: int = 0, limit: int = 100, solo_pos: bool = False):
    q = db.query(models.Producto).filter(
        models.Producto.empresa_id == empresa_id,
        models.Producto.vigente == True,
    )
    if solo_pos:
        from sqlalchemy import or_
        from crud.grupos_producto import _get_overrides, _apply_empresa_overrides
        # Traer todos los grupos visibles para esta empresa con overlay aplicado
        grupos = db.query(models.GrupoProducto).filter(
            or_(
                models.GrupoProducto.empresa_id.is_(None),
                models.GrupoProducto.empresa_id == empresa_id,
            )
        ).all()
        _apply_empresa_overrides(grupos, _get_overrides(db, empresa_id))
        visible_ids = [g.id for g in grupos if g.visible_pos]
        q = q.filter(models.Producto.grupo_item.in_(visible_ids))
    items = q.offset(skip).limit(limit).all()
    return attach_impuestos_to_productos(db, empresa_id, items)

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
