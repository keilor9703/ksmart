from sqlalchemy.orm import Session, joinedload, selectinload
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


def get_clientes_cumpleanos_hoy(db: Session, empresa_id: int):
    """Clientes cuyo fecha_nacimiento (mes+día, sin importar el año) cae hoy."""
    from datetime import date
    from sqlalchemy import func, extract
    from database import IS_SQLITE

    hoy = date.today()
    q = db.query(models.Cliente).filter(
        models.Cliente.empresa_id == empresa_id,
        models.Cliente.fecha_nacimiento.isnot(None),
    )
    if IS_SQLITE:
        q = q.filter(func.strftime('%m-%d', models.Cliente.fecha_nacimiento) == hoy.strftime('%m-%d'))
    else:
        q = q.filter(
            extract('month', models.Cliente.fecha_nacimiento) == hoy.month,
            extract('day', models.Cliente.fecha_nacimiento) == hoy.day,
        )
    return q.order_by(models.Cliente.nombre.asc()).all()

def _normalize_cedula(data: dict) -> dict:
    """Convierte cedula='' a None para evitar violación de índice único en BD legacy."""
    if 'cedula' in data and (data['cedula'] == '' or data['cedula'] is not None and str(data['cedula']).strip() == ''):
        data['cedula'] = None
    return data

_DV_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]

def calcular_dv(nit: str) -> Optional[str]:
    """Calcula el dígito de verificación (DV) de un NIT colombiano según el
    algoritmo módulo 11 de la DIAN."""
    digits = ''.join(ch for ch in str(nit) if ch.isdigit())
    if not digits:
        return None
    total = sum(int(d) * w for d, w in zip(reversed(digits), _DV_WEIGHTS))
    remainder = total % 11
    if remainder in (0, 1):
        return str(remainder)
    return str(11 - remainder)

def _autocalcular_dv(data: dict) -> dict:
    """Si es NIT (tipo_documento_id=31) y no se envió DV, lo calcula automáticamente."""
    if data.get('tipo_documento_id') == 31 and not data.get('dv') and data.get('cedula'):
        data['dv'] = calcular_dv(data['cedula'])
    return data

def _check_cedula_duplicada(db: Session, empresa_id: int, cedula: Optional[str], exclude_id: Optional[int] = None):
    if not cedula:
        return
    query = db.query(models.Cliente).filter(
        models.Cliente.empresa_id == empresa_id,
        models.Cliente.cedula == cedula
    )
    if exclude_id is not None:
        query = query.filter(models.Cliente.id != exclude_id)
    existente = query.first()
    if existente:
        raise HTTPException(
            status_code=409,
            detail=f"Ya existe un tercero con la cédula/NIT {cedula}: '{existente.nombre}'."
        )

def create_cliente(db: Session, empresa_id: int, cliente: schemas.ClienteCreate):
    data = _autocalcular_dv(_normalize_cedula(cliente.dict()))
    _check_cedula_duplicada(db, empresa_id, data.get('cedula'))
    db_cliente = models.Cliente(**data, empresa_id=empresa_id)
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
        data = _autocalcular_dv(_normalize_cedula(cliente.dict(exclude_unset=True)))
        if 'cedula' in data:
            _check_cedula_duplicada(db, empresa_id, data.get('cedula'), exclude_id=cliente_id)
        for key, value in data.items():
            setattr(db_cliente, key, value)
        db.commit()
        db.refresh(db_cliente)
    return db_cliente

def delete_cliente(db: Session, empresa_id: int, cliente_id: int):
    from sqlalchemy.exc import IntegrityError
    db_cliente = db.query(models.Cliente).filter(
        models.Cliente.id == cliente_id,
        models.Cliente.empresa_id == empresa_id
    ).first()
    if db_cliente:
        db.delete(db_cliente)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="No se puede eliminar este tercero porque tiene registros asociados. Desactívelo en lugar de eliminarlo."
            )
    return db_cliente

def get_cliente_history(db: Session, empresa_id: int, cliente_id: int):
    cliente = db.query(models.Cliente).filter(
        models.Cliente.id == cliente_id,
        models.Cliente.empresa_id == empresa_id
    ).first()
    if not cliente:
        return None

    ventas = db.query(models.Venta).options(
        selectinload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
        selectinload(models.Venta.pagos)
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
