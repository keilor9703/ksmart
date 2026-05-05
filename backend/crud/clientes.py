from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from fastapi import HTTPException
import models, schemas

# ═══════════════════════════════════════════════════════════════════════════════
# CLIENTES / TERCEROS
# ═══════════════════════════════════════════════════════════════════════════════

def get_cliente(db: Session, empresa_id: int, cliente_id: int):
    return db.query(models.Cliente).filter(
        models.Cliente.id == cliente_id,
        models.Cliente.empresa_id == empresa_id
    ).first()

def get_cliente_deuda(db: Session, empresa_id: int, cliente_id: int):
    ventas_cliente = db.query(models.Venta).filter(
        models.Venta.cliente_id == cliente_id,
        models.Venta.empresa_id == empresa_id
    ).all()
    total_deuda = sum(v.total - v.monto_pagado for v in ventas_cliente)
    return total_deuda

def get_clientes(db: Session, empresa_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Cliente).filter(
        models.Cliente.empresa_id == empresa_id
    ).offset(skip).limit(limit).all()

def create_cliente(db: Session, empresa_id: int, cliente: schemas.ClienteCreate):
    db_cliente = models.Cliente(**cliente.dict(), empresa_id=empresa_id)
    db.add(db_cliente)
    db.commit()
    db.refresh(db_cliente)
    return db_cliente

def update_cliente(db: Session, empresa_id: int, cliente_id: int, cliente: schemas.ClienteCreate):
    db_cliente = db.query(models.Cliente).filter(
        models.Cliente.id == cliente_id,
        models.Cliente.empresa_id == empresa_id
    ).first()
    if db_cliente:
        for key, value in cliente.dict(exclude_unset=True).items():
            setattr(db_cliente, key, value)
        db.commit()
        db.refresh(db_cliente)
    return db_cliente

def delete_cliente(db: Session, empresa_id: int, cliente_id: int):
    db_cliente = db.query(models.Cliente).filter(
        models.Cliente.id == cliente_id,
        models.Cliente.empresa_id == empresa_id
    ).first()
    if db_cliente:
        db.delete(db_cliente)
        db.commit()
    return db_cliente

def get_cliente_history(db: Session, empresa_id: int, cliente_id: int):
    cliente = db.query(models.Cliente).filter(
        models.Cliente.id == cliente_id,
        models.Cliente.empresa_id == empresa_id
    ).first()
    if not cliente:
        return None

    ventas = db.query(models.Venta).options(
        joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
        joinedload(models.Venta.pagos)
    ).filter(
        models.Venta.cliente_id == cliente_id,
        models.Venta.empresa_id == empresa_id
    ).all()

    total_ventas_general = sum(venta.total for venta in ventas)
    total_pagado_general = sum(venta.monto_pagado for venta in ventas)
    total_deuda = total_ventas_general - total_pagado_general

    return schemas.ClienteHistory(
        cliente=cliente,
        ventas=ventas,
        total_deuda=total_deuda,
        total_pagado_general=total_pagado_general,
        total_ventas_general=total_ventas_general
    )
