from sqlalchemy.orm import Session
from typing import Optional, List
import models, schemas

# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCTOS
# ═══════════════════════════════════════════════════════════════════════════════

def get_producto(db: Session, empresa_id: int, producto_id: int):
    return db.query(models.Producto).filter(
        models.Producto.id == producto_id,
        models.Producto.empresa_id == empresa_id
    ).first()

def get_productos(db: Session, empresa_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Producto).filter(
        models.Producto.empresa_id == empresa_id
    ).offset(skip).limit(limit).all()

def create_producto(db: Session, empresa_id: int, producto: schemas.ProductoCreate):
    db_producto = models.Producto(**producto.dict(), empresa_id=empresa_id)
    db.add(db_producto)
    db.commit()
    db.refresh(db_producto)
    return db_producto

def update_producto(db: Session, empresa_id: int, producto_id: int, producto: schemas.ProductoCreate):
    db_producto = get_producto(db, empresa_id, producto_id)
    if db_producto:
        for key, value in producto.dict(exclude_unset=True).items():
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
