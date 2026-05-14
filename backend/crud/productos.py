from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import timedelta
import models, schemas
from crud.perecederos import crear_lote_existencia

import json

# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCTOS
# ═══════════════════════════════════════════════════════════════════════════════

def get_producto(db: Session, empresa_id: int, producto_id: int):
    db_producto = db.query(models.Producto).filter(
        models.Producto.id == producto_id,
        models.Producto.empresa_id == empresa_id
    ).first()
    
    # Deserializar imágenes si existen
    if db_producto and db_producto.imagenes:
        try:
            db_producto.imagenes = json.loads(db_producto.imagenes)
        except:
            db_producto.imagenes = []
    elif db_producto:
        db_producto.imagenes = []
        
    return db_producto

def get_productos(db: Session, empresa_id: int, skip: int = 0, limit: int = 100):
    db_productos = db.query(models.Producto).filter(
        models.Producto.empresa_id == empresa_id
    ).offset(skip).limit(limit).all()
    
    for p in db_productos:
        if p.imagenes:
            try: p.imagenes = json.loads(p.imagenes)
            except: p.imagenes = []
        else:
            p.imagenes = []
            
    return db_productos

def create_producto(db: Session, empresa_id: int, producto: schemas.ProductoCreate):
    # Extraer campos de inicialización de stock para que no rompan el constructor del Modelo
    stock_inicial     = producto.stock_inicial
    numero_lote       = producto.numero_lote
    fecha_vencimiento = producto.fecha_vencimiento
    
    # Datos limpios para el modelo Producto
    prod_data = producto.dict(exclude={'stock_inicial', 'numero_lote', 'fecha_vencimiento'})
    
    # Serializar lista de imágenes a JSON string
    if prod_data.get('imagenes'):
        prod_data['imagenes'] = json.dumps(prod_data['imagenes'])
    
    db_producto = models.Producto(**prod_data, empresa_id=empresa_id)
    db.add(db_producto)
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
        
        # Serializar lista de imágenes si viene en el update
        if "imagenes" in update_data and isinstance(update_data["imagenes"], list):
            update_data["imagenes"] = json.dumps(update_data["imagenes"])

        for key, value in update_data.items():
            setattr(db_producto, key, value)
        db.commit()
        db.refresh(db_producto)
    return db_producto

def delete_producto(db: Session, empresa_id: int, producto_id: int):
    db_producto = get_producto(db, empresa_id, producto_id)
    if db_producto:
        db.delete(db_producto)
        db.commit()
    return db_producto
