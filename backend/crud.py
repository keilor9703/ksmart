# ═══════════════════════════════════════════════════════════════════════════════
# CRUD.PY - VERSIÓN MULTI-TENANT CON TIMEZONE FIX DEFINITIVO
# ═══════════════════════════════════════════════════════════════════════════════

from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, text, cast, Date
from typing import Optional, List, IO
from datetime import date, timedelta, datetime, timezone, time
from passlib.context import CryptContext
import models, schemas
import pandas as pd
from fastapi import HTTPException
from zoneinfo import ZoneInfo

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
COL_TZ = "America/Bogota"

def _is_postgres(db: Session) -> bool:
    try:
        dialect = db.get_bind().dialect.name
        return dialect == "postgresql"
    except Exception:
        try:
            from database import DATABASE_URL
            return "postgresql" in DATABASE_URL.lower()
        except Exception:
            return False

# ─── MANEJO PROFESIONAL DE ZONAS HORARIAS ───
BOGOTA_TZ = ZoneInfo("America/Bogota")
UTC_TZ = ZoneInfo("UTC")

def get_utc_boundaries(local_date: date, db: Session = None):
    """
    Toma una fecha local (date) y devuelve el inicio y fin de ese día en UTC.
    Compatible tanto con Postgres (Producción) como SQLite (Local).
    """
    local_start = datetime.combine(local_date, time.min, tzinfo=BOGOTA_TZ)
    local_end = datetime.combine(local_date, time.max, tzinfo=BOGOTA_TZ)

    utc_start = local_start.astimezone(UTC_TZ)
    utc_end = local_end.astimezone(UTC_TZ)

    # Si pasamos la db y comprobamos que es SQLite, removemos el tzinfo
    # para que la comparación por string en SQLite funcione.
    if db and not _is_postgres(db):
        utc_start = utc_start.replace(tzinfo=None)
        utc_end = utc_end.replace(tzinfo=None)

    return utc_start, utc_end  

# ═══════════════════════════════════════════════════════════════════════════════
# UTILIDADES
# ═══════════════════════════════════════════════════════════════════════════════

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

# ═══════════════════════════════════════════════════════════════════════════════
# ROLES Y MÓDULOS
# ═══════════════════════════════════════════════════════════════════════════════

def get_modulo(db: Session, modulo_id: int):
    return db.query(models.Modulo).filter(models.Modulo.id == modulo_id).first()

def get_modulo_by_name(db: Session, name: str):
    return db.query(models.Modulo).filter(models.Modulo.name == name).first()

def get_modulos(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Modulo).offset(skip).limit(limit).all()

def create_modulo(db: Session, modulo: schemas.ModuloCreate):
    db_modulo = models.Modulo(**modulo.dict())
    db.add(db_modulo)
    db.commit()
    db.refresh(db_modulo)
    return db_modulo

def update_modulo(db: Session, modulo_id: int, modulo: schemas.ModuloCreate):
    db_modulo = db.query(models.Modulo).filter(models.Modulo.id == modulo_id).first()
    if db_modulo:
        for key, value in modulo.dict(exclude_unset=True).items():
            setattr(db_modulo, key, value)
        db.commit()
        db.refresh(db_modulo)
    return db_modulo

def delete_modulo(db: Session, modulo_id: int):
    db_modulo = db.query(models.Modulo).filter(models.Modulo.id == modulo_id).first()
    if db_modulo:
        db.delete(db_modulo)
        db.commit()
    return db_modulo

def get_role(db: Session, role_id: int):
    return db.query(models.Role).options(joinedload(models.Role.modules)).filter(models.Role.id == role_id).first()

def get_role_by_name(db: Session, name: str):
    return db.query(models.Role).options(joinedload(models.Role.modules)).filter(models.Role.name == name).first()

def get_roles(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Role).options(joinedload(models.Role.modules)).offset(skip).limit(limit).all()

def create_role(db: Session, role: schemas.RoleCreate):
    db_role = models.Role(name=role.name)
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

def add_modules_to_role(db: Session, role_id: int, module_ids: List[int]):
    db_role = get_role(db, role_id)
    if not db_role:
        return None
    for module_id in module_ids:
        db_modulo = get_modulo(db, module_id)
        if db_modulo and db_modulo not in db_role.modules:
            db_role.modules.append(db_modulo)
    db.commit()
    db.refresh(db_role)
    return db_role

def remove_modules_from_role(db: Session, role_id: int, module_ids: List[int]):
    db_role = get_role(db, role_id)
    if not db_role:
        return None
    for module_id in module_ids:
        db_modulo = get_modulo(db, module_id)
        if db_modulo and db_modulo in db_role.modules:
            db_role.modules.remove(db_modulo)
    db.commit()
    db.refresh(db_role)
    return db_role

def set_modules_for_role(db: Session, role_id: int, module_ids: List[int]):
    db_role = get_role(db, role_id)
    if not db_role:
        return None
    db_role.modules.clear()
    for module_id in module_ids:
        db_modulo = get_modulo(db, module_id)
        if db_modulo:
            db_role.modules.append(db_modulo)
    db.commit()
    db.refresh(db_role)
    return db_role

# ═══════════════════════════════════════════════════════════════════════════════
# USUARIOS
# ═══════════════════════════════════════════════════════════════════════════════

def get_user(db: Session, user_id: int):
    return db.query(models.User).options(
        joinedload(models.User.role).joinedload(models.Role.modules)
    ).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).options(
        joinedload(models.User.role).joinedload(models.Role.modules),
        joinedload(models.User.empresa) 
    ).filter(models.User.username == username).first()

def get_users(db: Session, empresa_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.User).options(
        joinedload(models.User.role).joinedload(models.Role.modules)
    ).filter(
        models.User.empresa_id == empresa_id
    ).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate, empresa_id: int):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        hashed_password=hashed_password,
        role_id=user.role_id,
        empresa_id=empresa_id 
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: int, user: schemas.UserCreate, empresa_id: int):
    db_user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.empresa_id == empresa_id 
    ).first()
    if db_user:
        for key, value in user.dict(exclude_unset=True).items():
            if key == "password":
                setattr(db_user, "hashed_password", get_password_hash(value))
            else:
                setattr(db_user, key, value)
        db.commit()
        db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int, empresa_id: int):
    db_user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.empresa_id == empresa_id 
    ).first()
    if db_user:
        db.delete(db_user)
        db.commit()
    return db_user

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

# ═══════════════════════════════════════════════════════════════════════════════
# VENTAS
# ═══════════════════════════════════════════════════════════════════════════════

def get_ventas(db: Session, empresa_id: int, skip: int = 0, limit: int = 100):
    return (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.cliente),
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
            joinedload(models.Venta.pagos),
        )
        .filter(models.Venta.empresa_id == empresa_id)
        .order_by(models.Venta.fecha.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_venta(db: Session, empresa_id: int, venta_id: int):
    return (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.cliente),
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
            joinedload(models.Venta.pagos),
        )
        .filter(
            models.Venta.id == venta_id,
            models.Venta.empresa_id == empresa_id 
        )
        .first()
    )

def create_venta(db: Session, empresa_id: int, venta: schemas.VentaCreate):
    cliente = get_cliente(db, empresa_id, venta.cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado o no pertenece a esta empresa")

    total_bruto = 0.0
    detalles_objs = []

    for d in venta.detalles:
        prod = get_producto(db, empresa_id, d.producto_id)
        if not prod:
            raise HTTPException(
                status_code=404,
                detail=f"Producto {d.producto_id} no encontrado o no pertenece a esta empresa"
            )
        
        precio = d.precio_unitario if d.precio_unitario is not None else prod.precio
        subtotal = precio * d.cantidad
        total_bruto += subtotal

        detalle = models.DetalleVenta(
            producto_id=d.producto_id,
            cantidad=d.cantidad,
            precio_unitario=precio,
            descuento_pct=getattr(d, 'descuento_pct', 0.0),
            iva_porcentaje=getattr(d, 'iva_porcentaje', 0.0),
        )
        detalles_objs.append(detalle)

    iva_porc = float(getattr(venta, 'iva_porcentaje', 0) or 0)
    iva_total = total_bruto * iva_porc / (100 + iva_porc) if iva_porc > 0 else 0.0

    # Usamos timezone explícito para Postgres
    ahora_utc = datetime.now(timezone.utc)

    db_venta = models.Venta(
        cliente_id=venta.cliente_id,
        total=total_bruto,
        iva_total=iva_total,
        iva_porcentaje=iva_porc,
        monto_pagado=total_bruto if venta.pagada else 0,
        estado_pago="pagado" if venta.pagada else "pendiente",
        metodo_pago=venta.metodo_pago if venta.pagada else None,
        empresa_id=empresa_id,
        fecha=ahora_utc # Forzado explicito para no depender del default base
    )
    db.add(db_venta)
    db.flush()

    for det in detalles_objs:
        det.venta_id = db_venta.id
        db.add(det)

    db.commit()
    db.refresh(db_venta)
    return db_venta

def update_venta(db: Session, empresa_id: int, venta_id: int, venta: schemas.VentaCreate):
    db_venta = db.query(models.Venta).filter(
        models.Venta.id == venta_id,
        models.Venta.empresa_id == empresa_id
    ).first()
    if not db_venta:
        return None

    if venta.cliente_id is not None:
        db_venta.cliente_id = venta.cliente_id

    db.query(models.DetalleVenta).filter(models.DetalleVenta.venta_id == venta_id).delete()
    db.flush()

    total_venta = 0.0
    new_detalles = []
    for detalle_data in venta.detalles:
        producto = get_producto(db, empresa_id, detalle_data.producto_id)
        if not producto:
            raise HTTPException(
                status_code=404,
                detail=f"Producto {detalle_data.producto_id} no encontrado"
            )
        
        precio_unitario = detalle_data.precio_unitario if detalle_data.precio_unitario is not None else producto.precio
        detalle_total = precio_unitario * detalle_data.cantidad
        total_venta += detalle_total
        
        db_detalle = models.DetalleVenta(
            venta_id=venta_id,
            producto_id=detalle_data.producto_id,
            cantidad=detalle_data.cantidad,
            precio_unitario=precio_unitario
        )
        new_detalles.append(db_detalle)
    
    db.add_all(new_detalles)

    db_venta.total = total_venta
    db_venta.monto_pagado = total_venta if venta.pagada else 0.0
    db_venta.estado_pago = "pagado" if venta.pagada else "pendiente"

    db.commit()
    db.refresh(db_venta)
    return db_venta

def delete_venta(db: Session, empresa_id: int, venta_id: int):
    db_venta = db.query(models.Venta).filter(
        models.Venta.id == venta_id,
        models.Venta.empresa_id == empresa_id 
    ).first()
    if db_venta:
        db.delete(db_venta)
        db.commit()
    return db_venta


# ═══════════════════════════════════════════════════════════════════════════════
# INVENTARIO - MOVIMIENTOS, KARDEX, ALERTAS
# ═══════════════════════════════════════════════════════════════════════════════

def create_movement(db: Session, empresa_id: int, payload: schemas.InventoryMovementCreate):
    prod = get_producto(db, empresa_id, payload.producto_id)
    if not prod:
        raise ValueError("Producto no encontrado o no pertenece a esta empresa")

    delta = payload.cantidad
    if payload.tipo == schemas.MovementType.salida:
        delta = -abs(payload.cantidad)
    elif payload.tipo == schemas.MovementType.entrada:
        delta = abs(payload.cantidad)
    elif payload.tipo == schemas.MovementType.ajuste:
        delta = payload.cantidad

    new_stock = (prod.stock_actual or 0) + delta
    if new_stock < 0:
        raise ValueError("Stock insuficiente")

    prod.stock_actual = new_stock
    ahora_utc = datetime.now(timezone.utc)

    mov = models.InventoryMovement(
        producto_id=payload.producto_id,
        tipo=payload.tipo.value,
        cantidad=payload.cantidad,
        costo_unitario=payload.costo_unitario,
        motivo=payload.motivo or "",
        referencia=payload.referencia or "",
        observacion=payload.observacion or "",
        empresa_id=empresa_id,
        created_at=ahora_utc
    )
    db.add(mov)
    db.add(prod)
    db.commit()
    db.refresh(mov)
    return mov

def list_movements(db: Session, empresa_id: int, producto_id: int = None, limit: int = 100):
    q = db.query(models.InventoryMovement).filter(
        models.InventoryMovement.empresa_id == empresa_id 
    ).order_by(models.InventoryMovement.created_at.desc())
    
    if producto_id:
        q = q.filter(models.InventoryMovement.producto_id == producto_id)
    
    return q.limit(limit).all()

def get_low_stock(db: Session, empresa_id: int):
    return db.query(models.Producto).filter(
        models.Producto.empresa_id == empresa_id, 
        models.Producto.stock_minimo.isnot(None),
        models.Producto.stock_minimo > 0,
        (models.Producto.stock_actual or 0) < models.Producto.stock_minimo
    ).all()

def update_producto_stock_minimo(db: Session, empresa_id: int, producto_id: int, minimo: float):
    prod = get_producto(db, empresa_id, producto_id)
    if not prod:
        return None
    prod.stock_minimo = minimo
    db.commit()
    db.refresh(prod)
    return prod

def get_kardex_promedio_ponderado(
    db: Session,
    empresa_id: int, 
    producto_id: int,
    start_date: Optional[datetime] = None, 
    end_date: Optional[datetime] = None,
) -> schemas.KardexResponse:
    prod = get_producto(db, empresa_id, producto_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    q = db.query(models.InventoryMovement).filter(
        models.InventoryMovement.producto_id == producto_id,
        models.InventoryMovement.empresa_id == empresa_id 
    )
    
    if start_date:
        utc_start, _ = get_utc_boundaries(start_date.date())
        q = q.filter(models.InventoryMovement.created_at >= utc_start)
    if end_date:
        _, utc_end = get_utc_boundaries(end_date.date())
        q = q.filter(models.InventoryMovement.created_at <= utc_end)

    movimientos = q.order_by(
        models.InventoryMovement.created_at.asc(),
        models.InventoryMovement.id.asc()
    ).all()

    saldo_cant = 0.0
    saldo_valor = 0.0
    saldo_costo_unit = 0.0

    items: List[schemas.KardexItem] = []
    for m in movimientos:
        tipo = m.tipo.value if hasattr(m.tipo, "value") else str(m.tipo)
        cant = float(m.cantidad or 0.0)
        costo_u = float(m.costo_unitario or 0.0)

        if tipo == "entrada" or (tipo == "ajuste" and cant > 0):
            entrada_valor = cant * costo_u
            saldo_valor = saldo_valor + entrada_valor
            saldo_cant = saldo_cant + cant
            saldo_costo_unit = (saldo_valor / saldo_cant) if saldo_cant > 0 else 0.0
        else:
            salida_valor = cant * saldo_costo_unit
            saldo_valor = max(0.0, saldo_valor - salida_valor)
            saldo_cant = max(0.0, saldo_cant - cant)
            saldo_costo_unit = (saldo_valor / saldo_cant) if saldo_cant > 0 else 0.0

        items.append(
            schemas.KardexItem(
                fecha=m.created_at,
                tipo=tipo,
                cantidad=cant,
                costo_unitario=costo_u if tipo == "entrada" else saldo_costo_unit,
                referencia=m.referencia,
                saldo_cantidad=saldo_cant,
                saldo_costo_unitario=saldo_costo_unit,
                saldo_valor=saldo_valor,
            )
        )

    return schemas.KardexResponse(
        producto_id=prod.id,
        producto_nombre=prod.nombre,
        items=items,
    )

def get_inventario_actual(db: Session, empresa_id: int) -> schemas.InventarioSnapshot:
    prods = db.query(models.Producto).filter(
        models.Producto.empresa_id == empresa_id 
    ).all()

    items: List[schemas.InventarioItem] = []
    total_costo = 0.0
    total_venta = 0.0
    for p in prods:
        stock = float(p.stock_actual or 0.0)
        costo = float(p.costo or 0.0)
        precio = float(p.precio or 0.0)
        valor_costo = stock * costo
        valor_venta = stock * precio
        total_costo += valor_costo
        total_venta += valor_venta

        items.append(
            schemas.InventarioItem(
                id=p.id,
                nombre=p.nombre,
                es_servicio=bool(p.es_servicio),
                unidad_medida=p.unidad_medida,
                stock_actual=stock,
                costo=costo,
                precio=precio,
                valor_costo=valor_costo,
                valor_venta=valor_venta,
            )
        )

    return schemas.InventarioSnapshot(
        items=items,
        total_valor_costo=total_costo,
        total_valor_venta=total_venta,
    )

def get_rotacion_productos(
    db: Session,
    empresa_id: int,
    start_date: Optional[date],
    end_date: Optional[date],
    limit: int = 10,
    incluir_servicios: bool = False,
) -> schemas.ReporteRotacion:
    q = (
        db.query(
            models.Producto.id.label("producto_id"),
            models.Producto.nombre.label("nombre"),
            models.Producto.es_servicio.label("es_servicio"),
            func.coalesce(func.sum(models.DetalleVenta.cantidad), 0).label("total_cantidad"),
            func.coalesce(func.sum(models.DetalleVenta.cantidad * models.DetalleVenta.precio_unitario), 0).label("total_ingresos"),
        )
        .join(models.DetalleVenta, models.DetalleVenta.producto_id == models.Producto.id)
        .join(models.Venta, models.DetalleVenta.venta_id == models.Venta.id)
        .filter(
            models.Producto.empresa_id == empresa_id,
            models.Venta.empresa_id == empresa_id 
        )
    )

    if start_date:
        utc_start, _ = get_utc_boundaries(start_date)
        q = q.filter(models.Venta.fecha >= utc_start)
    if end_date:
        _, utc_end = get_utc_boundaries(end_date)
        q = q.filter(models.Venta.fecha <= utc_end)
        
    if not incluir_servicios:
        q = q.filter(models.Producto.es_servicio == False)

    q = q.group_by(models.Producto.id, models.Producto.nombre, models.Producto.es_servicio)

    top_rows = q.order_by(func.coalesce(func.sum(models.DetalleVenta.cantidad), 0).desc()).limit(limit).all()

    slow_rows = (
        q.having(func.coalesce(func.sum(models.DetalleVenta.cantidad), 0) > 0)
         .order_by(func.coalesce(func.sum(models.DetalleVenta.cantidad), 0).asc())
         .limit(limit)
         .all()
    )

    def map_row(r) -> schemas.ProductoRotacionItem:
        return schemas.ProductoRotacionItem(
            producto_id=r.producto_id,
            nombre=r.nombre,
            es_servicio=bool(r.es_servicio),
            total_cantidad_vendida=float(r.total_cantidad or 0.0),
            total_ingresos=float(r.total_ingresos or 0.0),
        )

    return schemas.ReporteRotacion(
        start_date=start_date,
        end_date=end_date,
        top=[map_row(r) for r in top_rows],
        slow=[map_row(r) for r in slow_rows],
    )

# ═══════════════════════════════════════════════════════════════════════════════
# PAGOS
# ═══════════════════════════════════════════════════════════════════════════════

def create_pago(db: Session, empresa_id: int, pago: schemas.PagoCreate):
    db_venta = get_venta(db, empresa_id, pago.venta_id)
    if not db_venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    db_pago = models.Pago(**pago.dict())
    db.add(db_pago)
    db.flush()

    # ✅ FIX: Calcular el total consultando directamente a la base de datos
    total_pagado_venta = db.query(func.sum(models.Pago.monto)).filter(
        models.Pago.venta_id == db_venta.id
    ).scalar() or 0.0

    db_venta.monto_pagado = total_pagado_venta

    if db_venta.monto_pagado >= db_venta.total:
        db_venta.estado_pago = "pagado"
    elif db_venta.monto_pagado > 0:
        db_venta.estado_pago = "parcial"
    else:
        db_venta.estado_pago = "pendiente"
    
    db.commit()
    db.refresh(db_venta)
    return db_pago

def get_pago(db: Session, empresa_id: int, pago_id: int):
    return db.query(models.Pago).join(models.Venta).filter(
        models.Pago.id == pago_id,
        models.Venta.empresa_id == empresa_id
    ).first()

def update_pago(db: Session, empresa_id: int, pago_id: int, pago: schemas.PagoUpdate):
    db_pago = get_pago(db, empresa_id, pago_id)
    if db_pago:
        for key, value in pago.dict(exclude_unset=True).items():
            setattr(db_pago, key, value)
        db.commit()
        db.refresh(db_pago)

        db_venta = get_venta(db, empresa_id, db_pago.venta_id)
        if db_venta:
            total_pagado_venta = sum(p.monto for p in db_venta.pagos)
            db_venta.monto_pagado = total_pagado_venta

            if db_venta.monto_pagado >= db_venta.total:
                db_venta.estado_pago = "pagado"
            elif db_venta.monto_pagado > 0:
                db_venta.estado_pago = "parcial"
            else:
                db_venta.estado_pago = "pendiente"
            db.commit()
            db.refresh(db_venta)
    return db_pago

# ═══════════════════════════════════════════════════════════════════════════════
# REPORTES
# ═══════════════════════════════════════════════════════════════════════════════

def get_ventas_summary(db: Session, empresa_id: int, start_date: Optional[date] = None, end_date: Optional[date] = None):
    query_ventas = db.query(models.Venta).filter(models.Venta.empresa_id == empresa_id)
    query_compras = db.query(models.Compra).filter(models.Compra.empresa_id == empresa_id)
    query_gastos = db.query(models.Gasto).filter(models.Gasto.empresa_id == empresa_id)

    if start_date:
        utc_start, _ = get_utc_boundaries(start_date)
        query_ventas = query_ventas.filter(models.Venta.fecha >= utc_start)
        query_compras = query_compras.filter(models.Compra.fecha >= utc_start)
        query_gastos = query_gastos.filter(models.Gasto.fecha >= utc_start)
        
    if end_date:
        _, utc_end = get_utc_boundaries(end_date)
        query_ventas = query_ventas.filter(models.Venta.fecha <= utc_end)
        query_compras = query_compras.filter(models.Compra.fecha <= utc_end)
        query_gastos = query_gastos.filter(models.Gasto.fecha <= utc_end)

    ventas = query_ventas.all()
    compras = query_compras.all()
    gastos = query_gastos.all()

    total_pagado = sum(venta.monto_pagado or 0 for venta in ventas)
    total_pendiente = sum((venta.total or 0) - (venta.monto_pagado or 0) for venta in ventas if venta.estado_pago != "pagado")
    total_general = sum(venta.total or 0 for venta in ventas)
    
    total_compras = sum(compra.monto_pagado or 0 for compra in compras)
    total_gastos = sum(gasto.monto or 0 for gasto in gastos)

    # ✅ VENTAS DE HOY EXACTAS USANDO BOUNDARIES UTC Y CAST DE FECHA PARA SEGURIDAD POSTGRES
    hoy_colombia = datetime.now(BOGOTA_TZ).date()
    inicio_utc_hoy, fin_utc_hoy = get_utc_boundaries(hoy_colombia)

    ventas_hoy = db.query(models.Venta).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.fecha >= inicio_utc_hoy,
        models.Venta.fecha <= fin_utc_hoy
        # models.Venta.estado_pago == "pagado"
    ).all()
    
    total_ventas_hoy = sum(v.total or 0 for v in ventas_hoy)

    return schemas.VentasSummary(
        total_pagado=total_pagado,
        total_pendiente=total_pendiente,
        total_general=total_general,
        total_ventas_hoy=total_ventas_hoy, 
        total_compras=total_compras,
        total_gastos=total_gastos
    )

def get_cuentas_por_cobrar_por_cliente(db: Session, empresa_id: int):
    clientes_con_pendientes = db.query(models.Cliente).join(models.Venta).filter(
        models.Cliente.empresa_id == empresa_id, 
        models.Venta.empresa_id == empresa_id,   
        (models.Venta.estado_pago == "pendiente") | (models.Venta.estado_pago == "parcial")
    ).distinct().all()

    result = []
    for cliente in clientes_con_pendientes:
        ventas_pendientes_cliente = db.query(models.Venta).options(
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
            joinedload(models.Venta.pagos)
        ).filter(
            models.Venta.cliente_id == cliente.id,
            models.Venta.empresa_id == empresa_id, 
            (models.Venta.estado_pago == "pendiente") | (models.Venta.estado_pago == "parcial")
        ).all()
        
        monto_pendiente_total = sum(venta.total - venta.monto_pagado for venta in ventas_pendientes_cliente)

        result.append(schemas.ClienteCuentasPorCobrar(
            cliente_id=cliente.id,
            cliente_nombre=cliente.nombre,
            monto_pendiente=monto_pendiente_total,
            ventas_pendientes=ventas_pendientes_cliente
        ))
    return result

def get_productos_vendidos(db: Session, empresa_id: int, start_date: Optional[date] = None, end_date: Optional[date] = None):
    query = (
        db.query(
            models.Producto.id.label("product_id"),
            models.Producto.nombre.label("product_name"),
            models.Producto.es_servicio.label("es_servicio"),
            func.sum(models.DetalleVenta.cantidad).label("total_quantity_sold"),
            func.sum(models.DetalleVenta.cantidad * models.DetalleVenta.precio_unitario).label("total_revenue")
        )
        .join(models.DetalleVenta, models.Producto.id == models.DetalleVenta.producto_id)
        .join(models.Venta, models.DetalleVenta.venta_id == models.Venta.id)
        .filter(
            models.Producto.empresa_id == empresa_id, 
            models.Venta.empresa_id == empresa_id     
        )
    )

    if start_date:
        utc_start, _ = get_utc_boundaries(start_date)
        query = query.filter(models.Venta.fecha >= utc_start)
    if end_date:
        _, utc_end = get_utc_boundaries(end_date)
        query = query.filter(models.Venta.fecha <= utc_end)

    query = (
        query.group_by(models.Producto.id, models.Producto.nombre, models.Producto.es_servicio)
             .order_by(func.sum(models.DetalleVenta.cantidad).desc())
    )

    resultados = query.all()

    productos_vendidos = [schemas.ProductoVendido.from_orm(row) for row in resultados if not row.es_servicio]
    servicios_vendidos = [schemas.ProductoVendido.from_orm(row) for row in resultados if row.es_servicio]

    return schemas.ReporteProductosVendidos(
        productos=productos_vendidos,
        servicios=servicios_vendidos
    )

def get_clientes_compradores(db: Session, empresa_id: int, start_date: Optional[date] = None, end_date: Optional[date] = None):
    query = (
        db.query(
            models.Cliente.id.label("client_id"),
            models.Cliente.nombre.label("client_name"),
            func.sum(models.Venta.total).label("total_purchase_amount")
        )
        .join(models.Venta, models.Cliente.id == models.Venta.cliente_id)
        .filter(
            models.Cliente.empresa_id == empresa_id, 
            models.Venta.empresa_id == empresa_id    
        )
    )

    if start_date:
        utc_start, _ = get_utc_boundaries(start_date)
        query = query.filter(models.Venta.fecha >= utc_start)
    if end_date:
        _, utc_end = get_utc_boundaries(end_date)
        query = query.filter(models.Venta.fecha <= utc_end)

    query = (
        query.group_by(models.Cliente.id, models.Cliente.nombre)
             .order_by(func.sum(models.Venta.total).desc())
    )

    return [schemas.ClienteComprador.from_orm(row) for row in query.all()]

def get_clientes_deudores(db: Session, empresa_id: int):
    query = (
        db.query(
            models.Cliente.id.label("client_id"),
            models.Cliente.nombre.label("client_name"),
            (func.sum(models.Venta.total) - func.sum(models.Venta.monto_pagado)).label("total_debt_amount")
        )
        .join(models.Venta, models.Cliente.id == models.Venta.cliente_id)
        .filter(
            models.Cliente.empresa_id == empresa_id, 
            models.Venta.empresa_id == empresa_id,   
            models.Venta.estado_pago != "pagado"
        )
    )

    query = (
        query.group_by(models.Cliente.id, models.Cliente.nombre)
             .having((func.sum(models.Venta.total) - func.sum(models.Venta.monto_pagado)) > 0)
             .order_by((func.sum(models.Venta.total) - func.sum(models.Venta.monto_pagado)).desc())
    )

    return [schemas.ClienteDeudor.from_orm(row) for row in query.all()]

def get_rentabilidad_por_producto(db: Session, empresa_id: int, start_date: Optional[date] = None, end_date: Optional[date] = None):
    query = (
        db.query(
            models.Producto.id.label("product_id"),
            models.Producto.nombre.label("product_name"),
            func.sum(models.DetalleVenta.cantidad).label("total_quantity_sold"),
            func.sum(models.DetalleVenta.precio_unitario * models.DetalleVenta.cantidad).label("total_revenue"),
            func.sum(models.Producto.costo * models.DetalleVenta.cantidad).label("total_cost")
        )
        .join(models.DetalleVenta, models.Producto.id == models.DetalleVenta.producto_id)
        .join(models.Venta, models.DetalleVenta.venta_id == models.Venta.id)
        .filter(
            models.Producto.empresa_id == empresa_id, 
            models.Venta.empresa_id == empresa_id     
        )
    )

    if start_date:
        utc_start, _ = get_utc_boundaries(start_date)
        query = query.filter(models.Venta.fecha >= utc_start)
    if end_date:
        _, utc_end = get_utc_boundaries(end_date)
        query = query.filter(models.Venta.fecha <= utc_end)

    results = query.group_by(models.Producto.id, models.Producto.nombre).all()

    report_data = []
    for row in results:
        net_profit = row.total_revenue - row.total_cost
        profit_margin = (net_profit / row.total_revenue) * 100 if row.total_revenue > 0 else 0
        report_data.append(schemas.ProductoRentabilidad(
            product_id=row.product_id,
            product_name=row.product_name,
            total_quantity_sold=row.total_quantity_sold,
            total_revenue=row.total_revenue,
            total_cost=row.total_cost,
            net_profit=net_profit,
            profit_margin=profit_margin
        ))
    
    return sorted(report_data, key=lambda x: x.net_profit, reverse=True)

def get_sales_by_day(db: Session, empresa_id: int, start_date: date, end_date: date):
    # ✅ FIX TOTAL PARA DIAGRAMA DE BARRAS/TENDENCIA (POSTGRES Y SQLITE COMPATIBLE)
    utc_start, _ = get_utc_boundaries(start_date)
    _, utc_end = get_utc_boundaries(end_date)

    ventas = db.query(models.Venta).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.fecha >= utc_start,
        models.Venta.fecha <= utc_end
    ).all()

    sales_map = {}
    for v in ventas:
        # Convertimos la fecha UTC guardada a la hora de Colombia para agrupar
        col_date = v.fecha.astimezone(BOGOTA_TZ).date()
        key = col_date.isoformat()
        sales_map[key] = sales_map.get(key, 0.0) + float(v.total or 0)

    all_days = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]
    return [
        schemas.SalesByDay(day=d, total=sales_map.get(d.isoformat(), 0.0))
        for d in all_days
    ]

def get_total_sales_today(db: Session, empresa_id: int) -> float:
    hoy = datetime.now(BOGOTA_TZ).date()
    inicio_utc, fin_utc = get_utc_boundaries(hoy)
    
    total = db.query(func.sum(models.Venta.total)).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.fecha >= inicio_utc,
        models.Venta.fecha <= fin_utc
    ).scalar()
    return float(total or 0)

def get_dashboard_data(db: Session, empresa_id: int) -> schemas.DashboardData:
    hoy_colombia = datetime.now(BOGOTA_TZ).date()
    inicio_utc_hoy, fin_utc_hoy = get_utc_boundaries(hoy_colombia)

    # ✅ Usamos los limites exactos en UTC
    ventas_hoy_records = db.query(models.Venta).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.fecha >= inicio_utc_hoy,
        models.Venta.fecha <= fin_utc_hoy
        # models.Venta.estado_pago == "pagado"
    ).all()
    ventas_hoy = sum(v.total or 0 for v in ventas_hoy_records)

    deudores = get_clientes_deudores(db, empresa_id)
    cuentas_por_cobrar = sum(d.total_debt_amount for d in deudores)

    productos_bajo_stock = len(get_low_stock(db, empresa_id))

    ordenes_recientes = get_ordenes_trabajo(db, empresa_id, skip=0, limit=5)

    end_date = hoy_colombia
    start_date = end_date - timedelta(days=29)
    ventas_ultimos_30_dias = get_sales_by_day(db, empresa_id, start_date, end_date)

    return schemas.DashboardData(
        ventas_hoy=ventas_hoy,
        cuentas_por_cobrar=cuentas_por_cobrar,
        productos_bajo_stock=productos_bajo_stock,
        ordenes_recientes=ordenes_recientes,
        ventas_ultimos_30_dias=ventas_ultimos_30_dias,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# ÓRDENES DE TRABAJO
# ═══════════════════════════════════════════════════════════════════════════════

def get_orden_trabajo(db: Session, empresa_id: int, orden_id: int):
    return db.query(models.OrdenTrabajo).options(
        joinedload(models.OrdenTrabajo.cliente),
        joinedload(models.OrdenTrabajo.operador),
        joinedload(models.OrdenTrabajo.productos).joinedload(models.OrdenProducto.producto),
        joinedload(models.OrdenTrabajo.servicios).joinedload(models.OrdenServicio.servicio),
        joinedload(models.OrdenTrabajo.evidencias)
    ).filter(
        models.OrdenTrabajo.id == orden_id,
        models.OrdenTrabajo.empresa_id == empresa_id 
    ).first()

def get_ordenes_trabajo(
    db: Session,
    empresa_id: int, 
    skip: int = 0,
    limit: int = 100,
    operador_id: Optional[int] = None,
    estado: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    cliente_id: Optional[int] = None
):
    query = db.query(models.OrdenTrabajo).options(
        joinedload(models.OrdenTrabajo.cliente),
        joinedload(models.OrdenTrabajo.operador)
    ).filter(
        models.OrdenTrabajo.empresa_id == empresa_id
    ).order_by(models.OrdenTrabajo.fecha_creacion.desc())

    if operador_id:
        query = query.filter(models.OrdenTrabajo.operador_id == operador_id)
    if estado:
        query = query.filter(models.OrdenTrabajo.estado == estado)
    
    if start_date:
        utc_start, _ = get_utc_boundaries(start_date)
        query = query.filter(models.OrdenTrabajo.fecha_creacion >= utc_start)
    if end_date:
        _, utc_end = get_utc_boundaries(end_date)
        query = query.filter(models.OrdenTrabajo.fecha_creacion <= utc_end)
    
    if cliente_id:
        query = query.filter(models.OrdenTrabajo.cliente_id == cliente_id)

    return query.offset(skip).limit(limit).all()

def create_orden_trabajo(db: Session, empresa_id: int, orden: schemas.OrdenTrabajoCreate, operador_id: int):
    cliente = get_cliente(db, empresa_id, orden.cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado o no pertenece a esta empresa")

    db_orden = models.OrdenTrabajo(
        cliente_id=orden.cliente_id,
        operador_id=operador_id,
        total=orden.total,
        estado='En produccion',
        empresa_id=empresa_id,
        fecha_creacion=datetime.now(timezone.utc),
        fecha_actualizacion=datetime.now(timezone.utc)
    )

    for producto_data in orden.productos:
        prod = get_producto(db, empresa_id, producto_data.producto_id)
        if not prod:
            raise HTTPException(
                status_code=404,
                detail=f"Producto {producto_data.producto_id} no encontrado"
            )
        db_orden.productos.append(models.OrdenProducto(**producto_data.dict()))

    for servicio_data in orden.servicios:
        serv = get_producto(db, empresa_id, servicio_data.servicio_id)
        if not serv:
            raise HTTPException(
                status_code=404,
                detail=f"Servicio {servicio_data.servicio_id} no encontrado"
            )
        db_orden.servicios.append(models.OrdenServicio(**servicio_data.dict()))

    db.add(db_orden)
    db.commit()
    db.refresh(db_orden)
    return db_orden

def update_orden_trabajo(db: Session, empresa_id: int, orden_id: int, orden: schemas.OrdenTrabajoCreate):
    db_orden = (
        db.query(models.OrdenTrabajo)
          .options(
              selectinload(models.OrdenTrabajo.productos),
              selectinload(models.OrdenTrabajo.servicios),
          )
          .filter(
              models.OrdenTrabajo.id == orden_id,
              models.OrdenTrabajo.empresa_id == empresa_id 
          )
          .first()
    )
    if not db_orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    db_orden.cliente_id = orden.cliente_id
    db_orden.total = orden.total
    if hasattr(orden, "operador_id") and orden.operador_id is not None:
        db_orden.operador_id = orden.operador_id

    db_orden.productos = []
    db_orden.servicios = []

    nuevos_productos = []
    for p in getattr(orden, "productos", []):
        nuevos_productos.append(
            models.OrdenProducto(
                producto_id=p.producto_id,
                cantidad=p.cantidad,
                precio_unitario=p.precio_unitario,
            )
        )

    nuevos_servicios = []
    for s in getattr(orden, "servicios", []):
        nuevos_servicios.append(
            models.OrdenServicio(
                servicio_id=s.servicio_id,
                cantidad=s.cantidad,
                precio_servicio=s.precio_servicio,
            )
        )

    db_orden.productos = nuevos_productos
    db_orden.servicios = nuevos_servicios
    db_orden.fecha_actualizacion = datetime.now(timezone.utc)

    db.commit()
    db.refresh(db_orden)
    return db_orden

def update_orden_trabajo_estado(db: Session, empresa_id: int, orden_id: int, estado: str, observaciones: Optional[str] = None):
    db_orden = get_orden_trabajo(db, empresa_id, orden_id)
    if db_orden:
        db_orden.estado = estado
        if observaciones:
            db_orden.observaciones_aprobador = observaciones
        db_orden.fecha_actualizacion = datetime.now(timezone.utc)
        db.commit()
        db.refresh(db_orden)
    return db_orden

def add_evidencia_orden_trabajo(db: Session, empresa_id: int, orden_id: int, file_path: str):
    db_orden = get_orden_trabajo(db, empresa_id, orden_id)
    if not db_orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    db_evidencia = models.Evidencia(orden_id=orden_id, file_path=file_path)
    db.add(db_evidencia)
    db.commit()
    db.refresh(db_evidencia)
    return db_evidencia

def aprobar_orden_trabajo(db: Session, empresa_id: int, orden_id: int, admin_user: models.User):
    db_orden = get_orden_trabajo(db, empresa_id, orden_id)
    if not db_orden or db_orden.estado != 'En revisión':
        return None

    db_orden.estado = 'Aprobada'
    db_orden.observaciones_aprobador = f"Aprobado por {admin_user.username}"
    db_orden.fecha_actualizacion = datetime.now(timezone.utc)

    detalles_venta = []
    for item in db_orden.productos:
        detalles_venta.append(schemas.DetalleVentaCreate(
            producto_id=item.producto_id,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario
        ))
    for item in db_orden.servicios:
        detalles_venta.append(schemas.DetalleVentaCreate(
            producto_id=item.servicio_id,
            cantidad=item.cantidad if item.cantidad is not None else 0.0,
            precio_unitario=item.precio_servicio
        ))

    venta_schema = schemas.VentaCreate(
        cliente_id=db_orden.cliente_id,
        detalles=detalles_venta,
        pagada=False
    )
    created_venta = create_venta(db, empresa_id, venta_schema) 
    
    db_orden.venta_id = created_venta.id

    for servicio in db_orden.servicios:
        valor_productividad_calculado = servicio.precio_servicio * servicio.cantidad
        modalidad_pago_defined = "por_servicio"

        prod_log = schemas.RegistroProductividadCreate(
            operador_id=db_orden.operador_id,
            orden_id=orden_id,
            servicio_id=servicio.servicio_id,
            valor_productividad=valor_productividad_calculado,
            modalidad_pago=modalidad_pago_defined
        )
        db.add(models.RegistroProductividad(**prod_log.dict()))

    db.commit()
    db.refresh(db_orden)
    return db_orden

def rechazar_orden_trabajo(db: Session, empresa_id: int, orden_id: int, observaciones: str, admin_user: models.User):
    db_orden = get_orden_trabajo(db, empresa_id, orden_id)
    if not db_orden or db_orden.estado != 'En revisión':
        return None

    db_orden.estado = 'Rechazada'
    db_orden.observaciones_aprobador = f"Rechazado por {admin_user.username}: {observaciones}"
    db_orden.fecha_actualizacion = datetime.now(timezone.utc)

    db.commit()
    db.refresh(db_orden)
    return db_orden

def cerrar_orden_trabajo(db: Session, empresa_id: int, orden_id: int, admin_user: models.User, close_data: schemas.OrdenTrabajoClose):
    db_orden = get_orden_trabajo(db, empresa_id, orden_id)
    if not db_orden or db_orden.estado not in ['Aprobada', 'Rechazada']:
        return None

    if not db_orden.venta_id:
        return None

    db_venta = get_venta(db, empresa_id, db_orden.venta_id)
    if not db_venta:
        return None

    if close_data.was_paid:
        if close_data.payment_type == "total":
            monto_a_pagar = db_venta.total - db_venta.monto_pagado
            if monto_a_pagar > 0:
                pago_schema = schemas.PagoCreate(
                    venta_id=db_venta.id,
                    monto=monto_a_pagar,
                    metodo_pago="Cierre de Orden (Pago Total)"
                )
                create_pago(db, empresa_id, pago_schema) 
            db_venta.estado_pago = "pagado"
            db_venta.monto_pagado = db_venta.total
        elif close_data.payment_type == "partial":
            if close_data.paid_amount is None or close_data.paid_amount <= 0:
                return None
            
            monto_pendiente = db_venta.total - db_venta.monto_pagado
            if close_data.paid_amount > monto_pendiente:
                return None

            pago_schema = schemas.PagoCreate(
                venta_id=db_venta.id,
                monto=close_data.paid_amount,
                metodo_pago="Cierre de Orden (Pago Parcial)"
            )
            create_pago(db, empresa_id, pago_schema) 
        
        db_venta.fecha_pago = datetime.now(timezone.utc)
    else:
        db_venta.estado_pago = "pendiente"

    db_orden.estado = 'Cerrada'
    db_orden.observaciones_aprobador = f"Cerrada por {admin_user.username}"
    db_orden.fecha_actualizacion = datetime.now(timezone.utc)

    db.commit()
    db.refresh(db_orden)
    db.refresh(db_venta)
    return db_orden

def get_total_ordenes_trabajo(
    db: Session,
    empresa_id: int, 
    operador_id: Optional[int] = None,
    estado: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    cliente_id: Optional[int] = None
) -> float:
    query = db.query(func.sum(models.OrdenTrabajo.total)).filter(
        models.OrdenTrabajo.empresa_id == empresa_id 
    )

    if operador_id:
        query = query.filter(models.OrdenTrabajo.operador_id == operador_id)
    if estado:
        query = query.filter(models.OrdenTrabajo.estado == estado)
    
    if start_date:
        utc_start, _ = get_utc_boundaries(start_date)
        query = query.filter(models.OrdenTrabajo.fecha_creacion >= utc_start)
    if end_date:
        _, utc_end = get_utc_boundaries(end_date)
        query = query.filter(models.OrdenTrabajo.fecha_creacion <= utc_end)
    
    if cliente_id:
        query = query.filter(models.OrdenTrabajo.cliente_id == cliente_id)
    
    total = query.scalar()
    return total if total is not None else 0.0

# ═══════════════════════════════════════════════════════════════════════════════
# PANEL DEL OPERADOR
# ═══════════════════════════════════════════════════════════════════════════════

def get_ordenes_pendientes_operador(db: Session, empresa_id: int, operador_id: int) -> List[schemas.PanelOrdenPendiente]:
    ordenes_pendientes = db.query(models.OrdenTrabajo).options(
        joinedload(models.OrdenTrabajo.cliente),
        joinedload(models.OrdenTrabajo.productos).joinedload(models.OrdenProducto.producto),
        joinedload(models.OrdenTrabajo.servicios).joinedload(models.OrdenServicio.servicio)
    ).filter(
        models.OrdenTrabajo.operador_id == operador_id,
        models.OrdenTrabajo.empresa_id == empresa_id, 
        models.OrdenTrabajo.estado != 'Cerrada'
    ).order_by(models.OrdenTrabajo.fecha_actualizacion.asc()).all()

    response = []
    for orden in ordenes_pendientes:
        response.append(schemas.PanelOrdenPendiente(
            id=orden.id,
            cliente_id=orden.cliente.id,
            cliente_nombre=orden.cliente.nombre,
            cliente_telefono=orden.cliente.telefono,
            cliente_direccion=orden.cliente.direccion,
            estado=orden.estado,
            fecha_creacion=orden.fecha_creacion,
            fecha_actualizacion=orden.fecha_actualizacion,
            total=orden.total,
            productos=orden.productos,
            servicios=orden.servicios
        ))
    return response

def get_productividad_operador(
    db: Session,
    empresa_id: int,
    operador_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> schemas.PanelProductividad:
    
    hoy_colombia = datetime.now(BOGOTA_TZ).date()
    week_start_date = hoy_colombia - timedelta(days=hoy_colombia.weekday())
    month_start_date = hoy_colombia.replace(day=1)

    today_utc_start, today_utc_end = get_utc_boundaries(hoy_colombia)
    week_utc_start, week_utc_end = get_utc_boundaries(week_start_date)
    month_utc_start, month_utc_end = get_utc_boundaries(month_start_date)

    def get_total_units_for_range(utc_start, utc_end):
        return (db.query(func.sum(models.OrdenServicio.cantidad))
                .select_from(models.OrdenServicio)
                .join(models.RegistroProductividad,
                      (models.OrdenServicio.orden_id == models.RegistroProductividad.orden_id) &
                      (models.OrdenServicio.servicio_id == models.RegistroProductividad.servicio_id))
                .filter(
                    models.RegistroProductividad.operador_id == operador_id,
                    models.RegistroProductividad.empresa_id == empresa_id, 
                    models.RegistroProductividad.fecha >= utc_start,
                    models.RegistroProductividad.fecha <= utc_end
                ).scalar() or 0)

    servicios_hoy = get_total_units_for_range(today_utc_start, today_utc_end)
    servicios_semana = get_total_units_for_range(week_utc_start, today_utc_end) 
    servicios_mes = get_total_units_for_range(month_utc_start, today_utc_end)

    ordenes_completadas_semana = db.query(func.count(models.OrdenTrabajo.id)).filter(
        models.OrdenTrabajo.operador_id == operador_id,
        models.OrdenTrabajo.empresa_id == empresa_id, 
        models.OrdenTrabajo.estado == 'Cerrada',
        models.OrdenTrabajo.fecha_actualizacion >= week_utc_start,
        models.OrdenTrabajo.fecha_actualizacion <= today_utc_end
    ).scalar() or 0

    if start_date and end_date:
        filtered_start_utc, _ = get_utc_boundaries(start_date)
        _, filtered_end_utc = get_utc_boundaries(end_date)
    else:
        filtered_start_utc = week_utc_start
        filtered_end_utc = today_utc_end

    servicios_agg_query = (
        db.query(
            models.Producto.nombre,
            func.sum(models.OrdenServicio.cantidad).label('cantidad')
        )
        .select_from(models.OrdenServicio)
        .join(
            models.Producto, models.OrdenServicio.servicio_id == models.Producto.id
        )
        .join(
            models.RegistroProductividad,
            (models.RegistroProductividad.orden_id == models.OrdenServicio.orden_id) &
            (models.RegistroProductividad.servicio_id == models.OrdenServicio.servicio_id)
        )
        .filter(
            models.RegistroProductividad.operador_id == operador_id,
            models.RegistroProductividad.empresa_id == empresa_id, 
            models.RegistroProductividad.fecha >= filtered_start_utc,
            models.RegistroProductividad.fecha <= filtered_end_utc
        )
        .group_by(models.Producto.nombre)
    )
    servicios_agg = servicios_agg_query.all()

    grafica_servicios_semana = [
        schemas.PanelProductividadDataPoint(name=nombre, value=cantidad)
        for nombre, cantidad in servicios_agg
    ]

    unidades_por_servicio_query = (
        db.query(
            models.Producto.id.label("servicio_id"),
            models.Producto.nombre.label("servicio_nombre"),
            func.coalesce(func.sum(models.OrdenServicio.cantidad), 0).label("total_unidades"),
            func.coalesce(func.sum(models.RegistroProductividad.valor_productividad), 0).label("total_valor"),
        )
        .join(
            models.OrdenServicio,
            (models.OrdenServicio.orden_id == models.RegistroProductividad.orden_id)
            & (models.OrdenServicio.servicio_id == models.RegistroProductividad.servicio_id),
        )
        .join(models.Producto, models.Producto.id == models.RegistroProductividad.servicio_id)
        .filter(
            models.RegistroProductividad.operador_id == operador_id,
            models.RegistroProductividad.empresa_id == empresa_id, 
            models.RegistroProductividad.fecha >= filtered_start_utc,
            models.RegistroProductividad.fecha <= filtered_end_utc
        )
        .group_by(
            models.Producto.id,
            models.Producto.nombre,
        )
        .order_by(models.Producto.nombre)
    )
    unidades_por_servicio_rows = unidades_por_servicio_query.all()

    unidades_por_servicio_filtrado = [
        schemas.ProductividadUnidadesPorServicio(
            servicio_id=row.servicio_id,
            servicio_nombre=row.servicio_nombre,
            total_unidades=float(row.total_unidades),
            total_valor=float(row.total_valor),
        ) for row in unidades_por_servicio_rows
    ]

    return schemas.PanelProductividad(
        servicios_hoy=servicios_hoy,
        servicios_semana=servicios_semana,
        servicios_mes=servicios_mes,
        ordenes_completadas_semana=ordenes_completadas_semana,
        grafica_servicios_semana=grafica_servicios_semana,
        unidades_por_servicio_filtrado=unidades_por_servicio_filtrado
    )

def get_historial_reciente_operador(db: Session, empresa_id: int, operador_id: int) -> List[schemas.PanelHistorialItem]:
    hoy_colombia = datetime.now(BOGOTA_TZ).date()
    hace_7_dias = hoy_colombia - timedelta(days=7)
    utc_inicio, _ = get_utc_boundaries(hace_7_dias)

    ordenes_recientes = db.query(models.OrdenTrabajo).options(
        joinedload(models.OrdenTrabajo.cliente),
        joinedload(models.OrdenTrabajo.venta_asociada)
    ).filter(
        models.OrdenTrabajo.operador_id == operador_id,
        models.OrdenTrabajo.empresa_id == empresa_id, 
        models.OrdenTrabajo.estado == 'Cerrada',
        models.OrdenTrabajo.fecha_actualizacion >= utc_inicio
    ).order_by(models.OrdenTrabajo.fecha_actualizacion.desc()).limit(10).all()

    response = []
    for orden in ordenes_recientes:
        estado_pago = "N/A"
        if orden.venta_asociada:
            estado_pago = orden.venta_asociada.estado_pago
        
        response.append(schemas.PanelHistorialItem(
            id=orden.id,
            cliente_nombre=orden.cliente.nombre,
            fecha_actualizacion=orden.fecha_actualizacion,
            total=orden.total,
            estado_pago_venta=estado_pago
        ))
    return response

def get_reporte_productividad(db: Session, empresa_id: int, start_date: date, end_date: date):
    utc_start, _ = get_utc_boundaries(start_date)
    _, utc_end = get_utc_boundaries(end_date)

    registros = (
        db.query(models.RegistroProductividad)
        .options(
            joinedload(models.RegistroProductividad.operador),
            joinedload(models.RegistroProductividad.servicio),
        )
        .filter(
            models.RegistroProductividad.empresa_id == empresa_id, 
            models.RegistroProductividad.fecha >= utc_start,
            models.RegistroProductividad.fecha <= utc_end,
        )
        .all()
    )

    productividad_por_operador: dict[int, schemas.ProductividadOperador] = {}

    for reg in registros:
        op_id = reg.operador_id
        if op_id not in productividad_por_operador:
            productividad_por_operador[op_id] = schemas.ProductividadOperador(
                operador_id=op_id,
                operador_username=reg.operador.username if reg.operador else str(op_id),
                total_ganado=0.0,
                desglose=[],
                desglose_unidades=[],
            )

        item = productividad_por_operador[op_id]
        valor = float(reg.valor_productividad or 0.0)
        item.total_ganado += valor
        item.desglose.append(
            schemas.ProductividadOperadorDetalle(
                orden_id=reg.orden_id,
                servicio_nombre=reg.servicio.nombre if reg.servicio else "",
                valor_ganado=valor,
            )
        )

    unidades_rows = (
        db.query(
            models.RegistroProductividad.operador_id.label("operador_id"),
            models.RegistroProductividad.servicio_id.label("servicio_id"),
            models.Producto.nombre.label("servicio_nombre"),
            func.coalesce(func.sum(models.OrdenServicio.cantidad), 0).label("total_unidades"),
            func.coalesce(func.sum(models.RegistroProductividad.valor_productividad), 0).label("total_valor"),
        )
        .join(
            models.OrdenServicio,
            (models.OrdenServicio.orden_id == models.RegistroProductividad.orden_id)
            & (models.OrdenServicio.servicio_id == models.RegistroProductividad.servicio_id),
        )
        .join(models.Producto, models.Producto.id == models.RegistroProductividad.servicio_id)
        .filter(
            models.RegistroProductividad.empresa_id == empresa_id, 
            models.RegistroProductividad.fecha >= utc_start,
            models.RegistroProductividad.fecha <= utc_end,
        )
        .group_by(
            models.RegistroProductividad.operador_id,
            models.RegistroProductividad.servicio_id,
            models.Producto.nombre,
        )
        .all()
    )

    for r in unidades_rows:
        op_id = int(r.operador_id)

        if op_id not in productividad_por_operador:
            user = db.query(models.User).get(op_id)
            productividad_por_operador[op_id] = schemas.ProductividadOperador(
                operador_id=op_id,
                operador_username=user.username if user else str(op_id),
                total_ganado=0.0,
                desglose=[],
                desglose_unidades=[],
            )

        productividad_por_operador[op_id].desglose_unidades.append(
            schemas.ProductividadUnidadesPorServicio(
                servicio_id=int(r.servicio_id),
                servicio_nombre=str(r.servicio_nombre),
                total_unidades=float(r.total_unidades or 0.0),
                total_valor=float(r.total_valor or 0.0),
            )
        )

    return schemas.ReporteProductividad(
        start_date=start_date,
        end_date=end_date,
        reporte=list(productividad_por_operador.values()),
    )

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
    db_lote = get_lote(db, empresa_id, lote_id)
    if not db_lote or db_lote.estado != "En produccion":
        raise ValueError("El lote no existe o ya ha sido procesado.")

    receta = db_lote.receta
    cantidad_teorica = db_lote.cantidad_a_producir
    cantidad_final = confirm_data.cantidad_real

    costo_total_acumulado = 0.0

    for item in receta.items:
        insumo = get_producto(db, empresa_id, item.insumo_id)
        if not insumo:
            raise ValueError(f"Insumo {item.insumo_id} no encontrado")
        
        cantidad_requerida = item.cantidad * cantidad_teorica
        if (insumo.stock_actual or 0) < cantidad_requerida:
            raise ValueError(f"Stock insuficiente para: {insumo.nombre}. Req: {cantidad_requerida}, Disp: {insumo.stock_actual}")
        
        costo_insumo_total = cantidad_requerida * (insumo.costo or 0.0)
        costo_total_acumulado += costo_insumo_total

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

    mov_entrada = schemas.InventoryMovementCreate(
        producto_id=receta.producto_id,
        tipo=schemas.MovementType.entrada,
        cantidad=cantidad_final,
        costo_unitario=costo_unitario_final,
        motivo="Producción - Finalizado",
        referencia=f"Lote #{db_lote.id}",
        observacion=f"Entrada con mermas aplicadas. Costo unitario calculado: {costo_unitario_final:.2f}"
    )
    create_movement(db, empresa_id, mov_entrada) 

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



# ═══════════════════════════════════════════════════════════════════════════════
# VALIDACIONES DE ELIMINACIÓN
# ═══════════════════════════════════════════════════════════════════════════════

def check_can_delete_cliente(db: Session, empresa_id: int, cliente_id: int) -> list:
    """✅ FILTRADO POR EMPRESA"""
    bloqueos = []
    ventas = db.query(models.Venta).filter(
        models.Venta.cliente_id == cliente_id,
        models.Venta.empresa_id == empresa_id  # ✅
    ).count()
    if ventas:
        bloqueos.append(f"{ventas} venta{'s' if ventas > 1 else ''}")
    
    compras = db.query(models.Compra).filter(
        models.Compra.proveedor_id == cliente_id,
        models.Compra.empresa_id == empresa_id  # ✅
    ).count()
    if compras:
        bloqueos.append(f"{compras} compra{'s' if compras > 1 else ''} como proveedor")
    
    ordenes = db.query(models.OrdenTrabajo).filter(
        models.OrdenTrabajo.cliente_id == cliente_id,
        models.OrdenTrabajo.empresa_id == empresa_id  # ✅
    ).count()
    if ordenes:
        bloqueos.append(f"{ordenes} orden{'es' if ordenes > 1 else ''} de trabajo")
    
    lotes = db.query(models.LoteProduccion).filter(
        models.LoteProduccion.cliente_id == cliente_id,
        models.LoteProduccion.empresa_id == empresa_id  # ✅
    ).count()
    if lotes:
        bloqueos.append(f"{lotes} lote{'s' if lotes > 1 else ''} de producción")
    
    return bloqueos

def check_can_delete_producto(db: Session, empresa_id: int, producto_id: int) -> list:
    """✅ FILTRADO POR EMPRESA - Productos pueden aparecer en ventas/compras de la misma empresa"""
    bloqueos = []
    
    # Revisar detalles de venta (join para filtrar por empresa de la venta)
    dv = db.query(models.DetalleVenta).join(models.Venta).filter(
        models.DetalleVenta.producto_id == producto_id,
        models.Venta.empresa_id == empresa_id  # ✅
    ).count()
    if dv:
        bloqueos.append(f"usado en {dv} venta{'s' if dv > 1 else ''}")
    
    dc = db.query(models.DetalleCompra).join(models.Compra).filter(
        models.DetalleCompra.producto_id == producto_id,
        models.Compra.empresa_id == empresa_id  # ✅
    ).count()
    if dc:
        bloqueos.append(f"usado en {dc} compra{'s' if dc > 1 else ''}")
    
    mov = db.query(models.InventoryMovement).filter(
        models.InventoryMovement.producto_id == producto_id,
        models.InventoryMovement.empresa_id == empresa_id  # ✅
    ).count()
    if mov:
        bloqueos.append(f"tiene {mov} movimiento{'s' if mov > 1 else ''} de inventario")
    
    receta = db.query(models.Receta).filter(
        models.Receta.producto_id == producto_id,
        models.Receta.empresa_id == empresa_id  # ✅
    ).first()
    if receta:
        bloqueos.append("tiene una receta de producción asociada")
    
    en_receta = db.query(models.RecetaItem).join(models.Receta).filter(
        models.RecetaItem.insumo_id == producto_id,
        models.Receta.empresa_id == empresa_id  # ✅
    ).count()
    if en_receta:
        bloqueos.append(f"es insumo en {en_receta} receta{'s' if en_receta > 1 else ''}")
    
    op = db.query(models.OrdenProducto).join(models.OrdenTrabajo).filter(
        models.OrdenProducto.producto_id == producto_id,
        models.OrdenTrabajo.empresa_id == empresa_id  # ✅
    ).count()
    if op:
        bloqueos.append(f"en {op} orden{'es' if op > 1 else ''} de trabajo")
    
    os_ = db.query(models.OrdenServicio).join(models.OrdenTrabajo).filter(
        models.OrdenServicio.servicio_id == producto_id,
        models.OrdenTrabajo.empresa_id == empresa_id  # ✅
    ).count()
    if os_:
        bloqueos.append(f"como servicio en {os_} orden{'es' if os_ > 1 else ''}")
    
    return bloqueos

def check_can_delete_venta(db: Session, empresa_id: int, venta_id: int) -> list:
    """✅ FILTRADO POR EMPRESA"""
    bloqueos = []
    devs = db.query(models.Devolucion).filter(
        models.Devolucion.venta_id == venta_id,
        models.Devolucion.empresa_id == empresa_id  # ✅
    ).count()
    if devs:
        bloqueos.append(f"tiene {devs} devolución{'es' if devs > 1 else ''} registrada{'s' if devs > 1 else ''}")
    
    orden = db.query(models.OrdenTrabajo).filter(
        models.OrdenTrabajo.venta_id == venta_id,
        models.OrdenTrabajo.empresa_id == empresa_id  # ✅
    ).first()
    if orden:
        bloqueos.append(f"vinculada a la orden de trabajo #{orden.id}")
    
    return bloqueos

def check_can_delete_receta(db: Session, empresa_id: int, receta_id: int) -> list:
    """✅ FILTRADO POR EMPRESA"""
    bloqueos = []
    lotes = db.query(models.LoteProduccion).filter(
        models.LoteProduccion.receta_id == receta_id,
        models.LoteProduccion.empresa_id == empresa_id  # ✅
    ).count()
    if lotes:
        bloqueos.append(f"tiene {lotes} lote{'s' if lotes > 1 else ''} de producción asociado{'s' if lotes > 1 else ''}")
    
    return bloqueos





# ═══════════════════════════════════════════════════════════════════════════════
# DEVOLUCIONES
# ═══════════════════════════════════════════════════════════════════════════════

def crear_devolucion(db: Session, empresa_id: int, data: schemas.DevolucionCreate) -> models.Devolucion:
    """✅ VALIDACIÓN POR EMPRESA"""
    venta = (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
            joinedload(models.Venta.cliente),
        )
        .filter(
            models.Venta.id == data.venta_id,
            models.Venta.empresa_id == empresa_id  # ✅
        )
        .first()
    )

    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    if not data.items:
        raise HTTPException(status_code=400, detail="Debe incluir al menos un ítem a devolver.")

    if not data.motivo or not data.motivo.strip():
        raise HTTPException(status_code=400, detail="El motivo es obligatorio.")

    total_dev = 0.0
    for item in data.items:
        if item.cantidad <= 0:
            raise HTTPException(status_code=400, detail="La cantidad debe ser mayor a 0.")
        if item.precio_unitario <= 0:
            raise HTTPException(status_code=400, detail="El precio unitario debe ser mayor a 0.")

        if item.detalle_id:
            detalle = next((d for d in venta.detalles if d.id == item.detalle_id), None)
            if detalle and item.cantidad > detalle.cantidad:
                nombre = detalle.producto.nombre if detalle.producto else f"ID {item.producto_id}"
                raise HTTPException(
                    status_code=400,
                    detail=f"No puede devolver {item.cantidad} de '{nombre}'. Solo se vendieron {detalle.cantidad}."
                )
        total_dev += item.cantidad * item.precio_unitario

    dev = models.Devolucion(
        venta_id=venta.id,
        motivo=data.motivo.strip(),
        monto_total=total_dev,
        tipo="parcial",
        estado="confirmada",
        empresa_id=empresa_id  # ✅
    )
    db.add(dev)
    db.flush()

    for item in data.items:
        db_item = models.DevolucionItem(
            devolucion_id=dev.id,
            producto_id=item.producto_id,
            detalle_id=item.detalle_id,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,
        )
        db.add(db_item)

        # Reponer inventario
        prod = get_producto(db, empresa_id, item.producto_id)
        if prod and not prod.es_servicio:
            prod.stock_actual = (prod.stock_actual or 0) + item.cantidad
            db.add(prod)

            mov = models.InventoryMovement(
                producto_id=item.producto_id,
                tipo="entrada",
                cantidad=item.cantidad,
                costo_unitario=prod.costo or 0.0,
                motivo="devolucion",
                referencia=f"Dev #{dev.id} / Venta #{data.venta_id}",
                observacion=f"Devolución: {data.motivo[:80]}",
                empresa_id=empresa_id  # ✅
            )
            db.add(mov)

    # Ajustar la venta
    if venta.estado_pago == "pagado":
        venta.total = max(0.0, venta.total - total_dev)
        venta.monto_pagado = max(0.0, venta.monto_pagado - total_dev)
    else:
        venta.total = max(0.0, venta.total - total_dev)

    # Recalcular estado_pago
    if venta.total <= 0:
        venta.estado_pago = "pagado"
        venta.monto_pagado = 0.0
    elif venta.monto_pagado >= venta.total:
        venta.estado_pago = "pagado"
    elif venta.monto_pagado > 0:
        venta.estado_pago = "parcial"
    else:
        venta.estado_pago = "pendiente"

    db.add(venta)

    # Notificar al admin
    cliente_nombre = venta.cliente.nombre if venta.cliente else "desconocido"
    admin_users = db.query(models.User).join(models.Role).filter(
        models.Role.name == "Admin",
        models.User.empresa_id == empresa_id  # ✅
    ).all()
    for admin in admin_users:
        db.add(models.Notificacion(
            usuario_id=admin.id,
            empresa_id=empresa_id,  # ✅
            mensaje=(
                f"↩️ Devolución — Venta #{data.venta_id} · {cliente_nombre} · "
                f"Nota crédito: ${total_dev:,.0f}"
            ),
            tipo="warning",
            leido=False,
        ))

    db.commit()
    db.refresh(dev)
    return dev

def get_devoluciones_by_venta(db: Session, empresa_id: int, venta_id: int) -> List[models.Devolucion]:
    """✅ FILTRADO POR EMPRESA"""
    return (
        db.query(models.Devolucion)
        .options(joinedload(models.Devolucion.items).joinedload(models.DevolucionItem.producto))
        .filter(
            models.Devolucion.venta_id == venta_id,
            models.Devolucion.empresa_id == empresa_id  # ✅
        )
        .order_by(models.Devolucion.fecha.desc())
        .all()
    )

def revertir_movimientos_venta(db: Session, empresa_id: int, venta: models.Venta):
    """✅ INYECCIÓN DE EMPRESA_ID"""
    for det in venta.detalles:
        prod = get_producto(db, empresa_id, det.producto_id)
        if not prod or prod.es_servicio:
            continue
        mov = models.InventoryMovement(
            producto_id=det.producto_id,
            tipo="entrada",
            cantidad=det.cantidad,
            costo_unitario=prod.costo or 0.0,
            motivo="reversa_venta",
            referencia=f"reversa venta #{venta.id}",
            observacion=f"Venta #{venta.id} eliminada el {datetime.now(timezone.utc).date()}",
            empresa_id=empresa_id  # ✅
        )
        db.add(mov)
        prod.stock_actual = (prod.stock_actual or 0) + det.cantidad
        db.add(prod)
    db.commit()

# ═══════════════════════════════════════════════════════════════════════════════
# COMPRAS
# ═══════════════════════════════════════════════════════════════════════════════

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
    """✅ INYECCIÓN DE EMPRESA_ID + VALIDACIÓN CROSS-TENANT"""
    # Validar que el proveedor pertenece a la empresa
    db_prov = db.query(models.Cliente).filter(
        models.Cliente.id == compra.proveedor_id,
        models.Cliente.empresa_id == empresa_id  # ✅
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
        empresa_id=empresa_id  # ✅
    )
    db.add(db_compra)
    db.flush()

    for item in compra.detalles:
        # Validar que el producto pertenece a la empresa
        prod = get_producto(db, empresa_id, item.producto_id)
        if not prod:
            raise HTTPException(
                status_code=404,
                detail=f"Producto {item.producto_id} no encontrado"
            )
        
        db_detalle = models.DetalleCompra(
            compra_id=db_compra.id,
            producto_id=item.producto_id,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,
            iva_porcentaje=0.0
        )
        db.add(db_detalle)

        payload_mov = schemas.InventoryMovementCreate(
            producto_id=item.producto_id,
            tipo=schemas.MovementType.entrada,
            cantidad=item.cantidad,
            costo_unitario=item.precio_unitario,
            motivo="Compra",
            referencia=f"Compra #{db_compra.id}",
            observacion=f"Factura: {compra.referencia_factura or 'N/A'}"
        )
        create_movement(db, empresa_id, payload_mov)  # ✅

        db_prod = get_producto(db, empresa_id, item.producto_id)
        if db_prod:
            db_prod.costo = item.precio_unitario

    db.commit()
    db.refresh(db_compra)
    return db_compra

def create_pago_compra(db: Session, empresa_id: int, pago: schemas.PagoCompraCreate):
    db_compra = get_compra(db, empresa_id, pago.compra_id)
    if not db_compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    db_pago = models.PagoCompra(**pago.dict())
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

# ═══════════════════════════════════════════════════════════════════════════════
# CAJA Y GASTOS
# ═══════════════════════════════════════════════════════════════════════════════

def calcular_totales_dia(db: Session, empresa_id: int) -> dict:
    # ✅ TIMEZONE FIX PARA CORTE DE CAJA DIARIO
    hoy_colombia = datetime.now(BOGOTA_TZ).date()
    inicio_utc, fin_utc = get_utc_boundaries(hoy_colombia)

    totales = {
        "efectivo": 0.0, "transferencia": 0.0, "tarjeta": 0.0, "otros": 0.0,
        "total_dia": 0.0, "total_gastos": 0.0, "ventas_contado": 0.0, "abonos_cartera": 0.0,
        "num_ventas": 0, "num_abonos": 0,
        "fecha": hoy_colombia.isoformat(),
    }

    def _clasificar_ingreso(metodo: str, monto: float):
        m = (metodo or "").lower().strip()
        totales["total_dia"] += monto
        if "efectivo" in m or m == "":
            totales["efectivo"] += monto
        elif "transfer" in m or "nequi" in m or "daviplata" in m or "pse" in m:
            totales["transferencia"] += monto
        elif "tarjeta" in m or "card" in m or "credito" in m or "debito" in m:
            totales["tarjeta"] += monto
        else:
            totales["otros"] += monto

    ventas_contado = (
        db.query(models.Venta)
        .options(joinedload(models.Venta.pagos))
        .filter(
            models.Venta.empresa_id == empresa_id, 
            models.Venta.fecha >= inicio_utc,
            models.Venta.fecha <= fin_utc,
            models.Venta.estado_pago == "pagado",
        ).all()
    )

    for v in ventas_contado:
        pagos_hoy = [p for p in v.pagos if inicio_utc <= p.fecha <= fin_utc]
        if not pagos_hoy:
            metodo = getattr(v, 'metodo_pago', None) or "Efectivo"
            _clasificar_ingreso(metodo, float(v.total or 0))
            totales["ventas_contado"] += float(v.total or 0)
            totales["num_ventas"] += 1

    abonos_dia = (
        db.query(models.Pago)
        .join(models.Venta)
        .filter(
            models.Venta.empresa_id == empresa_id, 
            models.Pago.fecha >= inicio_utc,
            models.Pago.fecha <= fin_utc
        )
        .all()
    )

    for p in abonos_dia:
        _clasificar_ingreso(p.metodo_pago or "Efectivo", float(p.monto or 0))
        totales["abonos_cartera"] += float(p.monto or 0)
        totales["num_abonos"] += 1

    gastos_dia = db.query(models.Gasto).filter(
        models.Gasto.empresa_id == empresa_id, 
        models.Gasto.fecha >= inicio_utc,
        models.Gasto.fecha <= fin_utc
    ).all()

    for g in gastos_dia:
        monto = float(g.monto or 0)
        totales["total_gastos"] += monto
        m = (g.metodo_pago or "Efectivo").lower().strip()
        if "efectivo" in m or m == "":
            totales["efectivo"] -= monto
        elif "transfer" in m or "nequi" in m or "daviplata" in m or "pse" in m:
            totales["transferencia"] -= monto
        elif "tarjeta" in m or "card" in m or "credito" in m or "debito" in m:
            totales["tarjeta"] -= monto
        else:
            totales["otros"] -= monto

    return totales

def crear_corte_caja(db: Session, empresa_id: int, usuario_id: int, efectivo_fisico: float,
                     observaciones: Optional[str] = None) -> models.CorteCaja:
    totales = calcular_totales_dia(db, empresa_id)
    diferencia = efectivo_fisico - totales["efectivo"]

    corte = models.CorteCaja(
        usuario_id=usuario_id,
        total_efectivo_ventas=totales["efectivo"],
        total_transferencia_ventas=totales["transferencia"],
        total_tarjeta_ventas=totales["tarjeta"],
        total_otros_ventas=totales["otros"],
        total_ventas_dia=totales["total_dia"],
        total_gastos=totales["total_gastos"],
        efectivo_fisico=efectivo_fisico,
        diferencia=diferencia,
        observaciones=observaciones,
        estado="cerrado",
        empresa_id=empresa_id 
    )
    db.add(corte)
    db.commit()
    db.refresh(corte)

    if abs(diferencia) > 1000:
        admin_users = db.query(models.User).join(models.Role).filter(
            models.Role.name.in_(["Admin", "Socio"]),
            models.User.empresa_id == empresa_id 
        ).all()
        tipo = "error" if diferencia < 0 else "warning"
        signo = "FALTANTE" if diferencia < 0 else "SOBRANTE"
        for admin in admin_users:
            db.add(models.Notificacion(
                usuario_id=admin.id,
                empresa_id=empresa_id, 
                mensaje=f"💰 Corte de caja: {signo} de ${abs(diferencia):,.0f} COP detectado.",
                tipo=tipo, leido=False
            ))
        db.commit()

    return corte

def get_cortes_caja(db: Session, empresa_id: int, skip: int = 0, limit: int = 30) -> List[models.CorteCaja]:
    return (
        db.query(models.CorteCaja)
        .filter(models.CorteCaja.empresa_id == empresa_id) 
        .order_by(models.CorteCaja.fecha.desc())
        .offset(skip).limit(limit).all()
    )

def crear_gasto(db: Session, empresa_id: int, usuario_id: int, data: schemas.GastoCreate) -> models.Gasto:
    if data.tercero_id:
        tercero = get_cliente(db, empresa_id, data.tercero_id)
        if not tercero:
            raise HTTPException(status_code=404, detail="Tercero no encontrado")

    db_gasto = models.Gasto(
        usuario_id=usuario_id,
        tercero_id=data.tercero_id,
        monto=data.monto,
        concepto=data.concepto,
        metodo_pago=data.metodo_pago,
        empresa_id=empresa_id 
    )
    db.add(db_gasto)
    db.commit()
    db.refresh(db_gasto)
    return db_gasto

def get_gastos(db: Session, empresa_id: int, skip: int = 0, limit: int = 100) -> List[models.Gasto]:
    return (
        db.query(models.Gasto)
        .options(joinedload(models.Gasto.tercero))
        .filter(models.Gasto.empresa_id == empresa_id) 
        .order_by(models.Gasto.fecha.desc())
        .offset(skip).limit(limit).all()
    )



# ═══════════════════════════════════════════════════════════════════════════════
# CARGAS MASIVAS - CON AISLAMIENTO MULTI-TENANT
# ═══════════════════════════════════════════════════════════════════════════════


def bulk_create_productos(db: Session, empresa_id: int, file: IO, filename: str):
    try:
        file_extension = filename.split('.')[-1].lower()
        
        # 1. Leer TODAS las hojas del archivo para no atascarnos en las instrucciones
        if file_extension == 'xlsx':
            dfs = pd.read_excel(file, engine='openpyxl', sheet_name=None)
        elif file_extension == 'xls':
            dfs = pd.read_excel(file, engine='xlrd', sheet_name=None)
        elif file_extension == 'csv':
            df = pd.read_csv(file)
            dfs = {"Sheet1": df}
        else:
            raise HTTPException(
                status_code=400,
                detail="Formato no soportado. Por favor cargue archivos .xlsx, .xls o .csv."
            )
            
        # 2. Seleccionar inteligentemente la hoja de datos
        if "Plantilla Datos" in dfs:
            df = dfs["Plantilla Datos"]
        else:
            # Fallback para plantillas antiguas o CSVs
            df = list(dfs.values())[0]

        # 3. Normalizar cabeceras: convertimos todo a minúsculas y quitamos espacios
        df.columns = [str(c).strip().lower().replace("\r", "").replace("\n", "") for c in df.columns]
        
        # Validación de seguridad
        if 'nombre' not in df.columns:
            raise HTTPException(
                status_code=400, 
                detail="El archivo no tiene la columna 'NOMBRE'. Asegúrese de llenar la pestaña 'Plantilla Datos'."
            )

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error procesando archivo: {e}")

    # 4. Forzar tipos de datos en las columnas numéricas
    numeric_cols = ['precio', 'costo', 'stock_minimo', 'grupo_item']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    created_count = 0
    errors = []

    def normalize_name(name: str) -> str:
        return "".join(str(name).lower().split())

    existing_names = {
        normalize_name(p.nombre) 
        for p in db.query(models.Producto).filter(
            models.Producto.empresa_id == empresa_id 
        ).all()
    }
    seen_names = set()

    def map_group(val):
        v = str(val).upper().strip()
        if 'MP' in v or 'MATERIA' in v or v == '1': return 1
        if 'PT' in v or 'TERMINADO' in v or v == '2': return 2
        if 'AF' in v or 'ACTIVO' in v or v == '3': return 3
        if 'INS' in v or 'INSUMO' in v or v == '4': return 4
        return 2 

    for index, row in df.iterrows():
        try:
            raw_name = str(row.get('nombre', '')).strip()
            
            # Ignorar filas totalmente vacías que Excel a veces genera por error
            if (not raw_name or raw_name == '0' or raw_name == 'nan') and pd.isna(row.get('precio')):
                continue

            if not raw_name or raw_name == '0' or raw_name == 'nan':
                errors.append(f"Fila {index + 2}: Nombre del producto es obligatorio.")
                continue

            norm_name = normalize_name(raw_name)
            
            if norm_name in existing_names:
                errors.append(f"Fila {index + 2}: Producto '{raw_name}' ya existe.")
                continue
            
            if norm_name in seen_names:
                errors.append(f"Fila {index + 2}: Producto '{raw_name}' duplicado en el archivo.")
                continue

            seen_names.add(norm_name)

            # Saneamiento del campo es_servicio (Para evitar fallos si el usuario deja en blanco)
            es_servicio_val = row.get('es_servicio', 0)
            es_servicio = bool(int(float(es_servicio_val))) if pd.notna(es_servicio_val) else False

            producto_data = schemas.ProductoCreate(
                nombre=raw_name,
                precio=float(row.get('precio', 0.0)),
                costo=float(row.get('costo', 0.0)),
                es_servicio=es_servicio,
                unidad_medida=str(row.get('unidad_medida', 'UND')).strip() if pd.notna(row.get('unidad_medida')) else 'UND',
                stock_minimo=float(row.get('stock_minimo', 0.0)),
                grupo_item=map_group(row.get('grupo_item', 'PT'))
            )
            create_producto(db, empresa_id, producto_data) 
            created_count += 1
            
        except Exception as e:
            errors.append(f"Fila {index + 2}: {str(e)}")

    return {
        "success": True if created_count > 0 else False,
        "message": f"Carga masiva finalizada. {created_count} productos creados."
                   + (f" Se omitieron {len(errors)} filas con errores." if errors else ""),
        "created_records": created_count,
        "errors": errors
    }
def bulk_create_clientes(db: Session, empresa_id: int, file: IO, filename: str):
    try:
        dfs = pd.read_excel(file, engine='openpyxl', sheet_name=None)
        df = dfs.get("Plantilla Datos", list(dfs.values())[0])
        df.columns = [str(c).strip().lower().replace("\r", "").replace("\n", "") for c in df.columns]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error leyendo Excel: {e}")

    created_count = 0
    errors = []
    existing_cedulas = {str(c.cedula) for c in db.query(models.Cliente).filter(models.Cliente.empresa_id == empresa_id).all() if c.cedula}
    seen_cedulas = set()

    for index, row in df.iterrows():
        try:
            nombre = str(row.get('nombre', '')).strip()
            cedula = str(row.get("cedula", "")).strip() if pd.notna(row.get("cedula")) else None
            
            # Omitir filas vacías
            if (not nombre or nombre == 'nan') and not cedula:
                continue

            if not cedula:
                errors.append(f"Fila {index + 2}: Cliente '{nombre}' sin cédula/NIT.")
                continue

            if cedula in existing_cedulas or cedula in seen_cedulas:
                errors.append(f"Fila {index + 2}: Cédula {cedula} ya existe o está duplicada.")
                continue

            seen_cedulas.add(cedula)

            # Convertir el texto 'SI'/'NO' a booleano
            es_cliente = str(row.get('es_cliente', 'SI')).strip().upper() == 'SI'
            es_proveedor = str(row.get('es_proveedor', 'NO')).strip().upper() == 'SI'

            cliente_data = schemas.ClienteCreate(
                nombre=nombre,
                cedula=cedula,
                telefono=str(row.get('telefono', '')) if pd.notna(row.get('telefono')) else None,
                direccion=str(row.get('direccion', '')) if pd.notna(row.get('direccion')) else None,
                cupo_credito=float(row.get('cupo_credito', 0.0)) if pd.notna(row.get('cupo_credito')) else 0.0,
                es_cliente=es_cliente,
                es_proveedor=es_proveedor
            )
            create_cliente(db, empresa_id, cliente_data) 
            created_count += 1
        except Exception as e:
            errors.append(f"Fila {index + 2}: {str(e)}")

    return {
        "success": created_count > 0,
        "message": f"Carga finalizada. {created_count} terceros creados.",
        "created_records": created_count,
        "errors": errors
    }


def bulk_create_movimientos(db: Session, empresa_id: int, file: IO, filename: str):
    try:
        dfs = pd.read_excel(file, engine='openpyxl', sheet_name=None)
        df = dfs.get("Plantilla Datos", list(dfs.values())[0])
        df.columns = [str(c).strip().lower().replace("\r", "").replace("\n", "") for c in df.columns]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error leyendo Excel: {e}")

    created_count = 0
    errors = []
    
    # Crear diccionario de productos para búsqueda rápida por nombre
    productos = db.query(models.Producto).filter(models.Producto.empresa_id == empresa_id).all()
    productos_by_name = {"".join(str(p.nombre).lower().split()): p for p in productos}

    for index, row in df.iterrows():
        try:
            raw_name = str(row.get('producto_nombre', '')).strip()
            
            # Omitir filas vacías
            if not raw_name or raw_name == 'nan':
                continue

            norm_name = "".join(raw_name.lower().split())
            prod = productos_by_name.get(norm_name)

            if not prod:
                errors.append(f"Fila {index+2}: El producto '{raw_name}' no existe en la base de datos.")
                continue

            tipo = str(row.get('tipo', '')).lower().strip()
            if tipo not in ["entrada", "salida", "ajuste"]:
                errors.append(f"Fila {index+2}: Tipo '{tipo}' no es válido.")
                continue

            cantidad = float(row.get("cantidad", 0)) if pd.notna(row.get("cantidad")) else 0
            if cantidad <= 0 and tipo in ["entrada", "salida"]:
                errors.append(f"Fila {index+2}: La cantidad debe ser mayor a 0.")
                continue

            if tipo == "salida" and (prod.stock_actual or 0) < cantidad:
                errors.append(f"Fila {index+2}: Stock insuficiente para '{raw_name}'. Disp: {prod.stock_actual}")
                continue

            payload = schemas.InventoryMovementCreate(
                producto_id=prod.id,
                tipo=tipo,
                cantidad=cantidad,
                costo_unitario=float(row.get('costo_unitario', 0.0)) if pd.notna(row.get('costo_unitario')) else 0.0,
                motivo=str(row.get('motivo', '')) if pd.notna(row.get('motivo')) else "",
                referencia=str(row.get('referencia', '')) if pd.notna(row.get('referencia')) else "",
                observacion=str(row.get('observacion', '')) if pd.notna(row.get('observacion')) else ""
            )
            create_movement(db, empresa_id, payload) 
            created_count += 1
        except Exception as e:
            errors.append(f"Error en fila {index+2}: {e}")

    return {
        "success": created_count > 0,
        "message": f"Inventario actualizado. {created_count} movimientos creados.",
        "created_records": created_count,
        "errors": errors
    }



# ═══════════════════════════════════════════════════════════════════════════════
# SAAS SUPERADMIN - EMPRESAS
# ═══════════════════════════════════════════════════════════════════════════════

def create_empresa(db: Session, empresa: schemas.EmpresaBase):
    db_empresa = models.Empresa(**empresa.dict())
    db.add(db_empresa)
    db.commit()
    db.refresh(db_empresa)
    return db_empresa

def get_empresas(db: Session, skip: int = 0, limit: int = 100):
    """Obtiene todas las empresas registradas en el SaaS"""
    return db.query(models.Empresa).order_by(models.Empresa.id.asc()).offset(skip).limit(limit).all()

def toggle_empresa_status(db: Session, empresa_id: int):
    """Activa o suspende una empresa (bloquea el login de todos sus usuarios)"""
    db_empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if db_empresa:
        db_empresa.is_active = not db_empresa.is_active
        db.commit()
        db.refresh(db_empresa)
    return db_empresa

def create_empresa_with_admin(db: Session, data: schemas.EmpresaWithAdminCreate):
    """
    Crea una nueva Empresa y automáticamente le crea su primer usuario Admin.
    """
    existing_user = db.query(models.User).filter(models.User.username == data.admin_username).first()
    if existing_user:
        raise ValueError(f"El nombre de usuario '{data.admin_username}' ya está en uso.")

    db_empresa = models.Empresa(
        nombre=data.empresa.nombre,
        nit=data.empresa.nit,
        color_primario=data.empresa.color_primario,
        is_active=True
    )
    db.add(db_empresa)
    db.flush() 

    admin_role = db.query(models.Role).filter(models.Role.name == "Admin").first()
    if not admin_role:
        raise ValueError("El rol 'Admin' no existe en la base de datos.")

    hashed_password = pwd_context.hash(data.admin_password)

    db_user = models.User(
        username=data.admin_username,
        hashed_password=hashed_password,
        role_id=admin_role.id,
        empresa_id=db_empresa.id 
    )
    db.add(db_user)

    db.commit()
    db.refresh(db_empresa)
    return db_empresa

# ═══════════════════════════════════════════════════════════════════════════════
# NOTIFICACIONES Y DEMÁS FUNCIONES PERMANECEN IGUAL
# ═══════════════════════════════════════════════════════════════════════════════

def create_notificacion(db: Session, empresa_id: int, notificacion: schemas.NotificacionCreate):
    db_notificacion = models.Notificacion(**notificacion.dict(), empresa_id=empresa_id) 
    db.add(db_notificacion)
    db.commit()
    db.refresh(db_notificacion)
    return db_notificacion

def get_notificaciones_usuario(db: Session, empresa_id: int, usuario_id: int, skip: int = 0, limit: int = 20):
    return (
        db.query(models.Notificacion)
        .filter(
            models.Notificacion.usuario_id == usuario_id,
            models.Notificacion.empresa_id == empresa_id 
        )
        .order_by(models.Notificacion.fecha_creacion.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def marcar_notificacion_leida(db: Session, empresa_id: int, notificacion_id: int, usuario_id: int):
    db_notificacion = (
        db.query(models.Notificacion)
        .filter(
            models.Notificacion.id == notificacion_id,
            models.Notificacion.usuario_id == usuario_id,
            models.Notificacion.empresa_id == empresa_id 
        )
        .first()
    )
    if db_notificacion:
        db_notificacion.leido = True
        db.commit()
        db.refresh(db_notificacion)
    return db_notificacion

def check_and_notify_low_stock(db: Session, empresa_id: int, producto_ids: List[int]):
    admin_users = db.query(models.User).join(models.Role).filter(
        models.Role.name == "Admin",
        models.User.empresa_id == empresa_id 
    ).all()
    if not admin_users:
        return

    hoy_col = datetime.now(BOGOTA_TZ).date()

    for prod_id in set(producto_ids):
        prod = get_producto(db, empresa_id, prod_id)
        if not prod or prod.es_servicio:
            continue
        if (prod.stock_minimo or 0) > 0 and (prod.stock_actual or 0) < prod.stock_minimo:
            for admin in admin_users:
                # Evitar notificaciones duplicadas en el mismo día
                ya_notificado = db.query(models.Notificacion).filter(
                    models.Notificacion.usuario_id == admin.id,
                    models.Notificacion.empresa_id == empresa_id, 
                    models.Notificacion.mensaje.like(f"%{prod.nombre}%bajo stock%"),
                ).all()
                
                # Checkear si alguna fue hoy en local
                notificado_hoy = any(n.fecha_creacion.astimezone(BOGOTA_TZ).date() == hoy_col for n in ya_notificado)

                if notificado_hoy:
                    continue
                db.add(models.Notificacion(
                    usuario_id=admin.id,
                    empresa_id=empresa_id, 
                    mensaje=f"⚠️ '{prod.nombre}' está bajo stock mínimo. Actual: {prod.stock_actual:.1f} | Mínimo: {prod.stock_minimo:.1f}",
                    tipo="warning",
                    leido=False
                ))
    db.commit()