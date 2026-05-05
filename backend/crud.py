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


def get_modulo_by_frontend_path(db: Session, frontend_path: str):
    return db.query(models.Modulo).filter(
        models.Modulo.frontend_path == frontend_path
    ).first()

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


# ═══════════════════════════════════════════════════════════════════════════════
# ROLES (AHORA POR EMPRESA)
# ═══════════════════════════════════════════════════════════════════════════════

def get_role(db: Session, role_id: int, empresa_id: int):
    # ✅ Filtrar por ID y por la empresa del usuario
    return db.query(models.Role).options(joinedload(models.Role.modules)).filter(
        models.Role.id == role_id,
        models.Role.empresa_id == empresa_id
    ).first()

def get_role_by_name(db: Session, name: str, empresa_id: int):
    # ✅ Filtrar por nombre y por empresa
    return db.query(models.Role).options(joinedload(models.Role.modules)).filter(
        models.Role.name == name,
        models.Role.empresa_id == empresa_id
    ).first()

def get_roles(db: Session, empresa_id: int, skip: int = 0, limit: int = 100):
    # ✅ Traer solo los roles de ESA empresa
    return db.query(models.Role).options(joinedload(models.Role.modules)).filter(
        models.Role.empresa_id == empresa_id
    ).offset(skip).limit(limit).all()

def create_role(db: Session, role: schemas.RoleCreate, empresa_id: int):
    # ✅ Crear el rol asociándolo a la empresa
    db_role = models.Role(name=role.name, empresa_id=empresa_id)
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

# Funciones de asociación de módulos al rol
def add_modules_to_role(db: Session, role_id: int, module_ids: List[int], empresa_id: int):
    db_role = get_role(db, role_id, empresa_id) # Validación de tenant
    if not db_role:
        return None
    for module_id in module_ids:
        db_modulo = get_modulo(db, module_id)
        if db_modulo and db_modulo not in db_role.modules:
            db_role.modules.append(db_modulo)
    db.commit()
    db.refresh(db_role)
    return db_role

def remove_modules_from_role(db: Session, role_id: int, module_ids: List[int], empresa_id: int):
    db_role = get_role(db, role_id, empresa_id) # Validación de tenant
    if not db_role:
        return None
    for module_id in module_ids:
        db_modulo = get_modulo(db, module_id)
        if db_modulo and db_modulo in db_role.modules:
            db_role.modules.remove(db_modulo)
    db.commit()
    db.refresh(db_role)
    return db_role

def set_modules_for_role(db: Session, role_id: int, module_ids: List[int], empresa_id: int):
    db_role = get_role(db, role_id, empresa_id) # Validación de tenant
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
    # ✅ 1. VERIFICAR QUE EL ROL ASIGNADO PERTENECE A ESTA EMPRESA
    rol_asignado = get_role(db, role_id=user.role_id, empresa_id=empresa_id)
    if not rol_asignado:
        raise HTTPException(
            status_code=400, 
            detail="El rol seleccionado no es válido o no pertenece a tu empresa."
        )

    # 2. VERIFICACIÓN DE LÍMITE DE USUARIOS (MONETIZACIÓN)
    total_users = db.query(models.User).filter(models.User.empresa_id == empresa_id).count()
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    
    limite = 6 if empresa.plan_type == "trial" else 50 
    
    if total_users >= limite:
        raise HTTPException(
            status_code=403, 
            detail=f"Has alcanzado el límite de {limite} usuarios de tu plan. Mejora tu suscripción para expandir tu equipo."
        )

    # 3. Creación normal
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        hashed_password=hashed_password,
        role_id=user.role_id,
        empresa_id=empresa_id,
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user_id: int, user: schemas.UserCreate, empresa_id: int):
    # ✨ NUEVA VALIDACIÓN: Verificar que el nuevo rol pertenezca a la empresa
    if user.role_id:
        rol_asignado = get_role(db, role_id=user.role_id, empresa_id=empresa_id)
        if not rol_asignado:
            raise HTTPException(status_code=400, detail="El rol seleccionado no pertenece a tu empresa.")

    db_user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.empresa_id == empresa_id 
    ).first()
    
    # ... (el resto de tu función queda exactamente igual) ...
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
    # ✅ 2. Borrado Lógico: Solo cambiamos el estado
    db_user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.empresa_id == empresa_id 
    ).first()
    
    if db_user:
        # Impedir que se desactive el admin principal
        if db_user.role.name == "Admin":
            admin_count = db.query(models.User).filter(
                models.User.empresa_id == empresa_id, 
                models.User.role.has(name="Admin"),
                models.User.is_active == True
            ).count()
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail="Debe existir al menos un administrador activo.")

        db_user.is_active = False 
        db.commit()
    return db_user

def toggle_user_status(db: Session, user_id: int, empresa_id: int):
    # Función extra para poder reactivar a un empleado si vuelve a la empresa
    db_user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.empresa_id == empresa_id 
    ).first()
    if db_user:
        db_user.is_active = not db_user.is_active
        db.commit()
        db.refresh(db_user)
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
        .filter(models.Venta.empresa_id == empresa_id, models.Venta.tipo == "venta")
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

    # Fase 2A: Numeración DIAN (solo para ventas reales, no cotizaciones)
        if getattr(venta, 'tipo', 'venta') == 'venta':
            _asignar_numero_factura(db, empresa_id, db_venta)

    #     # Fase 2B: campos extra
        db_venta.tipo         = getattr(venta, 'tipo', 'venta')
        db_venta.valida_hasta = getattr(venta, 'valida_hasta', None)
        db_venta.observaciones = getattr(venta, 'observaciones', None)
    



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



# 2. REEMPLAZA LA FUNCIÓN get_sales_by_day (Aprox Línea 770)
def get_sales_by_day(db: Session, empresa_id: int, start_date: date, end_date: date):
    utc_start, _ = get_utc_boundaries(start_date)
    _, utc_end = get_utc_boundaries(end_date)

    ventas = db.query(models.Venta).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.fecha >= utc_start,
        models.Venta.fecha <= utc_end
    ).all()

    sales_map = {}
    for v in ventas:
        col_date = v.fecha.astimezone(BOGOTA_TZ).date()
        key = col_date.isoformat()
        sales_map[key] = sales_map.get(key, 0.0) + float(v.total or 0)

    # ✅ NUEVA LÓGICA: DIBUJAR LA GRÁFICA CON LOS RECAUDOS DE PRÉSTAMOS
    cuotas_pagadas = db.query(models.CuotaPrestamo).filter(
        models.CuotaPrestamo.empresa_id == empresa_id,
        models.CuotaPrestamo.estado_pago == "Pagado",
        models.CuotaPrestamo.fecha_pago >= utc_start,
        models.CuotaPrestamo.fecha_pago <= utc_end
    ).all()

    for c in cuotas_pagadas:
        if c.fecha_pago:
            col_date = c.fecha_pago.astimezone(BOGOTA_TZ).date()
            key = col_date.isoformat()
            sales_map[key] = sales_map.get(key, 0.0) + float(c.monto_cuota or 0)

    all_days = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]
    return [
        schemas.SalesByDay(day=d, total=sales_map.get(d.isoformat(), 0.0))
        for d in all_days
    ]



# def get_sales_by_day(db: Session, empresa_id: int, start_date: date, end_date: date):
#     # ✅ FIX TOTAL PARA DIAGRAMA DE BARRAS/TENDENCIA (POSTGRES Y SQLITE COMPATIBLE)
#     utc_start, _ = get_utc_boundaries(start_date)
#     _, utc_end = get_utc_boundaries(end_date)

#     ventas = db.query(models.Venta).filter(
#         models.Venta.empresa_id == empresa_id,
#         models.Venta.fecha >= utc_start,
#         models.Venta.fecha <= utc_end
#     ).all()

#     sales_map = {}
#     for v in ventas:
#         # Convertimos la fecha UTC guardada a la hora de Colombia para agrupar
#         col_date = v.fecha.astimezone(BOGOTA_TZ).date()
#         key = col_date.isoformat()
#         sales_map[key] = sales_map.get(key, 0.0) + float(v.total or 0)

#     all_days = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]
#     return [
#         schemas.SalesByDay(day=d, total=sales_map.get(d.isoformat(), 0.0))
#         for d in all_days
#     ]

def get_total_sales_today(db: Session, empresa_id: int) -> float:
    hoy = datetime.now(BOGOTA_TZ).date()
    inicio_utc, fin_utc = get_utc_boundaries(hoy)
    
    total = db.query(func.sum(models.Venta.total)).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.fecha >= inicio_utc,
        models.Venta.fecha <= fin_utc
    ).scalar()
    return float(total or 0)

# 1. Reemplaza la función get_dashboard_data:
def get_dashboard_data(db: Session, empresa_id: int) -> schemas.DashboardData:
    hoy_colombia = datetime.now(BOGOTA_TZ).date()
    inicio_utc_hoy, fin_utc_hoy = get_utc_boundaries(hoy_colombia)

    # --- MÉTRICAS ERP (PRODUCTOS) ---
    # Ventas totales del día (creadas hoy)
    ventas_hoy_recs = db.query(models.Venta).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.fecha >= inicio_utc_hoy,
        models.Venta.fecha <= fin_utc_hoy,
        models.Venta.tipo == "venta",
    ).all()
    ventas_hoy = sum(v.total or 0 for v in ventas_hoy_recs)

    # ← NUEVO: sumar también los abonos a cartera recibidos hoy
    abonos_hoy = db.query(func.sum(models.Pago.monto)).join(models.Venta).filter(
        models.Venta.empresa_id == empresa_id,
        models.Pago.fecha >= inicio_utc_hoy,
        models.Pago.fecha <= fin_utc_hoy,
    ).scalar() or 0.0

    ventas_hoy += abonos_hoy   # el KPI del dashboard ahora refleja todo el dinero recibido hoy

    
    deudores = get_clientes_deudores(db, empresa_id)
    cuentas_por_cobrar = sum(d.total_debt_amount for d in deudores)
    productos_bajo_stock = len(get_low_stock(db, empresa_id))

    # --- MÉTRICAS PRÉSTAMOS ---
    recaudo_hoy = db.query(func.sum(models.CuotaPrestamo.monto_cuota)).filter(
        models.CuotaPrestamo.empresa_id == empresa_id,
        models.CuotaPrestamo.estado_pago == "Pagado",
        models.CuotaPrestamo.fecha_pago >= inicio_utc_hoy,
        models.CuotaPrestamo.fecha_pago <= fin_utc_hoy
    ).scalar() or 0.0

    capital_calle = db.query(func.sum(models.CuotaPrestamo.saldo_pendiente)).filter(
        models.CuotaPrestamo.empresa_id == empresa_id,
        models.CuotaPrestamo.estado_pago != "Pagado"
    ).scalar() or 0.0

    cuotas_mora = db.query(models.CuotaPrestamo).filter(
        models.CuotaPrestamo.empresa_id == empresa_id,
        models.CuotaPrestamo.fecha_vencimiento < hoy_colombia,
        models.CuotaPrestamo.estado_pago != "Pagado"
    ).count()

    # Gráfica de ventas (ERP)
    end_date = hoy_colombia
    start_date = end_date - timedelta(days=29)
    ventas_30 = get_sales_by_day(db, empresa_id, start_date, end_date)

    return schemas.DashboardData(
        ventas_hoy=ventas_hoy,
        cuentas_por_cobrar=cuentas_por_cobrar,
        productos_bajo_stock=productos_bajo_stock,
        recaudo_prestamos_hoy=float(recaudo_hoy),
        capital_en_calle=float(capital_calle),
        cuotas_mora=cuotas_mora,
        ordenes_recientes=get_ordenes_trabajo(db, empresa_id, skip=0, limit=5),
        ventas_ultimos_30_dias=ventas_30,
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
        estado='Pendiente', # ✅ CORREGIDO: Nace como Pendiente para que el Operador la inicie
        empresa_id=empresa_id,
        fecha_creacion=datetime.now(timezone.utc),
        fecha_actualizacion=datetime.now(timezone.utc)
    )
    # ... (El resto de la función queda igual)
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

# def create_compra(db: Session, empresa_id: int, compra: schemas.CompraCreate):
#     """✅ INYECCIÓN DE EMPRESA_ID + VALIDACIÓN CROSS-TENANT"""
#     # Validar que el proveedor pertenece a la empresa
#     db_prov = db.query(models.Cliente).filter(
#         models.Cliente.id == compra.proveedor_id,
#         models.Cliente.empresa_id == empresa_id  # ✅
#     ).first()
#     if not db_prov or not db_prov.es_proveedor:
#         raise HTTPException(status_code=400, detail="Proveedor no válido o no pertenece a esta empresa.")

#     total_bruto = 0.0
    
#     for item in compra.detalles:
#         total_bruto += item.cantidad * item.precio_unitario

#     iva_porc = compra.iva_porcentaje
#     subtotal_base = total_bruto / (1 + (iva_porc / 100))
#     iva_total_calc = total_bruto - subtotal_base

#     db_compra = models.Compra(
#         proveedor_id=compra.proveedor_id,
#         total=total_bruto,
#         iva_total=iva_total_calc,
#         iva_porcentaje=iva_porc,
#         referencia_factura=compra.referencia_factura,
#         monto_pagado=total_bruto if compra.pagada else 0.0,
#         estado_pago="pagado" if compra.pagada else "pendiente",
#         empresa_id=empresa_id  # ✅
#     )
#     db.add(db_compra)
#     db.flush()

#     for item in compra.detalles:
#         # Validar que el producto pertenece a la empresa
#         prod = get_producto(db, empresa_id, item.producto_id)
#         if not prod:
#             raise HTTPException(
#                 status_code=404,
#                 detail=f"Producto {item.producto_id} no encontrado"
#             )
        
#         db_detalle = models.DetalleCompra(
#             compra_id=db_compra.id,
#             producto_id=item.producto_id,
#             cantidad=item.cantidad,
#             precio_unitario=item.precio_unitario,
#             iva_porcentaje=0.0
#         )
#         db.add(db_detalle)

#         payload_mov = schemas.InventoryMovementCreate(
#             producto_id=item.producto_id,
#             tipo=schemas.MovementType.entrada,
#             cantidad=item.cantidad,
#             costo_unitario=item.precio_unitario,
#             motivo="Compra",
#             referencia=f"Compra #{db_compra.id}",
#             observacion=f"Factura: {compra.referencia_factura or 'N/A'}"
#         )
#         create_movement(db, empresa_id, payload_mov)  # ✅

#         db_prod = get_producto(db, empresa_id, item.producto_id)
#         if db_prod:
#             db_prod.costo = item.precio_unitario

#     db.commit()
#     db.refresh(db_compra)
#     return db_compra



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

        # # ─── LÓGICA INTELIGENTE DE ENTRADA (Lotes vs Regular) ───
        # if getattr(prod, "maneja_lotes", False):
        #     if not item.numero_lote or not item.fecha_vencimiento: raise ValueError(f"El producto '{prod.nombre}' es perecedero. Requiere Número de Lote y Fecha de Vencimiento.")
            
        #     payload_lote = schemas.LoteExistenciaCreate(
        #         producto_id=item.producto_id,
        #         numero_lote=item.numero_lote,
        #         fecha_vencimiento=item.fecha_vencimiento,
        #         fecha_fabricacion=item.fecha_fabricacion,
        #         cantidad_inicial=item.cantidad,
        #         costo_unitario=item.precio_unitario,
        #         proveedor_id=compra.proveedor_id,
        #         referencia_compra=compra.referencia_factura
        #     )
        #     # crear_lote_existencia ya actualiza el stock_actual y crea el movimiento.
        #     crear_lote_existencia(db, empresa_id, payload_lote)

        # ── Crear lote automático si el detalle trae datos de lote ──────────────
        if item.numero_lote and item.fecha_vencimiento:
            prod_obj = get_producto(db, empresa_id, item.producto_id)
            if prod_obj and getattr(prod_obj, 'maneja_lotes', False):
                if not item.numero_lote or not item.fecha_vencimiento: raise ValueError(f"El producto '{prod.nombre}' es perecedero. Requiere Número de Lote y Fecha de Vencimiento.")
                
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
    hoy_colombia = datetime.now(BOGOTA_TZ).date()
    inicio, fin = get_utc_boundaries(hoy_colombia)

    totales = {
        "efectivo": 0.0, "transferencia": 0.0, "tarjeta": 0.0, "otros": 0.0,
        "total_dia": 0.0, "total_gastos": 0.0,
        "ventas_contado": 0.0, "abonos_cartera": 0.0, "recaudo_prestamos": 0.0,
        "num_ventas": 0, "num_abonos": 0,
        "fecha": hoy_colombia.isoformat(),
    }

    def _clasificar(metodo, monto, cat):
        m = (metodo or "").lower()
        totales["total_dia"] += monto
        totales[cat] += monto
        if "efectivo" in m or m == "":
            totales["efectivo"] += monto
        elif any(x in m for x in ["transfer", "nequi", "pse", "bancolombia"]):
            totales["transferencia"] += monto
        elif any(x in m for x in ["tarjeta", "card", "datafono"]):
            totales["tarjeta"] += monto
        else:
            totales["otros"] += monto

    # ── 1. Ventas de contado (pagadas al momento de la venta) ────────────────
    # Solo ventas creadas HOY y que nacieron como pagadas (no abonos posteriores)
    ventas_contado = db.query(models.Venta).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.fecha >= inicio,
        models.Venta.fecha <= fin,
        models.Venta.tipo == "venta",
        models.Venta.estado_pago == "pagado",
        # Excluir ventas que tienen pagos en tabla pagos (esas son cartera cobrada)
        ~models.Venta.pagos.any()
    ).all()
    for v in ventas_contado:
        _clasificar(v.metodo_pago, float(v.total or 0), "ventas_contado")
        totales["num_ventas"] += 1

    # ── 2. Abonos a cartera (pagos registrados HOY desde CuentasPorCobrar) ───
    # Estos son los que faltaban — pagos de ventas previas (o del día) vía tabla pagos
    pagos_hoy = db.query(models.Pago).join(models.Venta).filter(
        models.Venta.empresa_id == empresa_id,
        models.Pago.fecha >= inicio,
        models.Pago.fecha <= fin,
    ).all()
    for p in pagos_hoy:
        _clasificar(p.metodo_pago, float(p.monto or 0), "abonos_cartera")
        totales["num_abonos"] += 1

    # ── 3. Recaudo de préstamos ──────────────────────────────────────────────
    cuotas = db.query(models.CuotaPrestamo).filter(
        models.CuotaPrestamo.empresa_id == empresa_id,
        models.CuotaPrestamo.estado_pago == "Pagado",
        models.CuotaPrestamo.fecha_pago >= inicio,
        models.CuotaPrestamo.fecha_pago <= fin,
    ).all()
    # ✅ DESPUÉS:
    for c in cuotas:
        monto_recaudado = float(c.monto_cuota or 0) - float(c.saldo_pendiente or 0)
        _clasificar(c.metodo_pago or "Efectivo", monto_recaudado, "recaudo_prestamos")

    # ── 4. Gastos (restan del efectivo) ─────────────────────────────────────
    gastos = db.query(models.Gasto).filter(
        models.Gasto.empresa_id == empresa_id,
        models.Gasto.fecha >= inicio,
        models.Gasto.fecha <= fin,
    ).all()
    for g in gastos:
        totales["total_gastos"] += float(g.monto)
        m = (g.metodo_pago or "").lower()
        if "efectivo" in m or m == "":
            totales["efectivo"] -= float(g.monto)
        elif any(x in m for x in ["transfer", "nequi", "pse"]):
            totales["transferencia"] -= float(g.monto)
        elif any(x in m for x in ["tarjeta", "card"]):
            totales["tarjeta"] -= float(g.monto)

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

    ahora_utc = datetime.now(timezone.utc)
    fin_prueba = ahora_utc + timedelta(days=14) # 14 días de prueba

    db_empresa = models.Empresa(
        nombre=data.empresa.nombre,
        nit=data.empresa.nit,
        color_primario=data.empresa.color_primario,
        is_active=True,
        plan_type="trial",
        trial_ends_at=fin_prueba # ✅ Inyectamos la fecha límite
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


def update_empresa_plan(db: Session, empresa_id: int, plan_data: schemas.EmpresaPlanUpdate):
    db_empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if db_empresa:
        db_empresa.plan_type = plan_data.plan_type
        db_empresa.trial_ends_at = plan_data.trial_ends_at
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




# =========================
# GESTIÓN DE PLANES SAAS
# =========================
def get_planes(db: Session, include_inactive: bool = False):
    query = db.query(models.PlanSuscripcion)
    if not include_inactive:
        query = query.filter(models.PlanSuscripcion.is_active == True)
    return query.all()

def create_plan(db: Session, plan: schemas.PlanSuscripcionCreate):
    db_plan = models.PlanSuscripcion(**plan.model_dump())
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan

def update_plan(db: Session, plan_id: int, plan_update: schemas.PlanSuscripcionUpdate):
    db_plan = db.query(models.PlanSuscripcion).filter(models.PlanSuscripcion.id == plan_id).first()
    if db_plan:
        update_data = plan_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_plan, key, value)
        db.commit()
        db.refresh(db_plan)
    return db_plan


# =========================
# PRESTAMISTAS
# =========================


from datetime import timedelta

def crear_prestamo(db: Session, prestamo: schemas.PrestamoCreate, empresa_id: int):
    # 1. Cálculos matemáticos (Interés Simple)
    # Ejemplo: Presta 100,000 al 20%. Interés = 20,000. Total = 120,000.
    interes_total = prestamo.monto_prestado * (prestamo.tasa_interes / 100)
    monto_total = prestamo.monto_prestado + interes_total
    monto_por_cuota = monto_total / prestamo.cantidad_cuotas
    
    # 2. Crear el encabezado del Préstamo
  # En crud.crear_prestamo, al crear db_prestamo:
    db_prestamo = models.Prestamo(
        empresa_id      = empresa_id,
        cliente_id      = prestamo.cliente_id,
        monto_prestado  = prestamo.monto_prestado,
        tasa_interes    = prestamo.tasa_interes,
        cantidad_cuotas = prestamo.cantidad_cuotas,
        modalidad       = prestamo.modalidad,
        monto_total_pagar = monto_total,
        tasa_mora       = prestamo.tasa_mora,   # ← nuevo
    )
    db.add(db_prestamo)
    db.commit()
    db.refresh(db_prestamo)

    # 3. Generar la amortización (Proyectar las cuotas)
    if prestamo.fecha_inicio:
        fecha_base = prestamo.fecha_inicio.replace(tzinfo=None) if prestamo.fecha_inicio.tzinfo else prestamo.fecha_inicio
    else:
        fecha_base = datetime.now(timezone.utc).replace(tzinfo=None)
    db_prestamo.fecha_inicio = fecha_base
    dias_sumar = {"Diario": 1, "Semanal": 7, "Quincenal": 15, "Mensual": 30}
    incremento = dias_sumar.get(prestamo.modalidad, 30)

    for i in range(1, prestamo.cantidad_cuotas + 1):
        fecha_vence = fecha_base + timedelta(days=(incremento * i))
        
        # 💡 Opcional: Aquí podrías agregar lógica para saltar los domingos si es pago 'Diario'
        
        db_cuota = models.CuotaPrestamo(
            empresa_id=empresa_id,
            prestamo_id=db_prestamo.id,
            numero_cuota=i,
            monto_cuota=monto_por_cuota,
            saldo_pendiente=monto_por_cuota,
            fecha_vencimiento=fecha_vence
        )
        db.add(db_cuota)
    
    db.commit()
    db.refresh(db_prestamo)
    return db_prestamo






def get_calendario_cobros(db: Session, empresa_id: int):
    # Agrupamos cuotas pendientes por fecha de vencimiento
    resultados = db.query(
        cast(models.CuotaPrestamo.fecha_vencimiento, Date).label("fecha"),
        func.count(models.CuotaPrestamo.id).label("cantidad"),
        func.sum(models.CuotaPrestamo.saldo_pendiente).label("total")
    ).filter(
        models.CuotaPrestamo.empresa_id == empresa_id,
        models.CuotaPrestamo.estado_pago != "Pagado"
    ).group_by(text("fecha")).all()

    return [
        {"fecha": r.fecha, "cantidad_cuotas": r.cantidad, "monto_total": r.total}
        for r in resultados
    ]

def get_reporte_financiero_prestamos(db: Session, empresa_id: int):
    prestamos = db.query(models.Prestamo).filter(
        models.Prestamo.empresa_id == empresa_id
    ).all()

    capital_prestado              = sum(p.monto_prestado for p in prestamos)
    intereses_totales_proyectados = sum(
        p.monto_total_pagar - p.monto_prestado for p in prestamos
    )

    cuotas = db.query(models.CuotaPrestamo).filter(
        models.CuotaPrestamo.empresa_id == empresa_id
    ).all()

    intereses_recaudados = 0.0
    capital_recuperado   = 0.0
    total_en_mora        = 0.0
    hoy = datetime.now(BOGOTA_TZ).date()  # date puro

    for c in cuotas:
        p = c.prestamo
        factor_capital = (
            p.monto_prestado / p.monto_total_pagar
            if p.monto_total_pagar > 0 else 0
        )
        monto_pagado_cuota = c.monto_cuota - c.saldo_pendiente
        capital_recuperado   += monto_pagado_cuota * factor_capital
        intereses_recaudados += monto_pagado_cuota * (1 - factor_capital)

        # FIX: normalizar fecha_vencimiento a date antes de comparar
        fecha_venc = (
            c.fecha_vencimiento.date()
            if isinstance(c.fecha_vencimiento, datetime)
            else c.fecha_vencimiento
        )
        if c.estado_pago != "Pagado" and fecha_venc < hoy:
            total_en_mora += c.saldo_pendiente

    # Proyección: próximos 30 días de cobros pendientes
    hoy_dt  = datetime.now(BOGOTA_TZ)
    fin_dt  = hoy_dt + timedelta(days=30)
    proyeccion_map: dict[str, float] = {}

    for c in cuotas:
        if c.estado_pago == "Pagado":
            continue
        fv = c.fecha_vencimiento
        if isinstance(fv, datetime):
            fv_date = fv.date()
        else:
            fv_date = fv
        if hoy <= fv_date <= fin_dt.date():
            key = fv_date.isoformat()
            proyeccion_map[key] = proyeccion_map.get(key, 0.0) + float(c.saldo_pendiente)

    proyeccion_recaudo_mes = [
        {"day": k, "total": v}
        for k, v in sorted(proyeccion_map.items())
    ]

    return {
        "resumen": {
            "capital_prestado":       capital_prestado,
            "capital_recuperado":     capital_recuperado,
            "capital_pendiente":      capital_prestado - capital_recuperado,
            "intereses_esperados":    intereses_totales_proyectados,
            "intereses_recaudados":   intereses_recaudados,
            "intereses_pendientes":   intereses_totales_proyectados - intereses_recaudados,
            "total_en_mora":          total_en_mora,
        },
        "proyeccion_recaudo_mes": proyeccion_recaudo_mes,
    }


from sqlalchemy import func, Date, cast

def get_resumen_calendario_cobros(db: Session, empresa_id: int):
    # Usamos cast para asegurar que tratamos el campo como Date
    # Y lo agrupamos directamente por la columna de la base de datos
    query = db.query(
        models.CuotaPrestamo.fecha_vencimiento,
        func.count(models.CuotaPrestamo.id).label("total_cuotas")
    ).filter(
        models.CuotaPrestamo.empresa_id == empresa_id,
        models.CuotaPrestamo.estado_pago != "Pagado"
    ).group_by(models.CuotaPrestamo.fecha_vencimiento).all()

    # Procesamos los resultados en Python para evitar errores de tipos con los drivers
    resumen = {}
    for r in query:
        # Extraemos solo la parte de la fecha (YYYY-MM-DD) si viene con hora
        fecha_str = r[0].isoformat().split('T')[0] if hasattr(r[0], 'isoformat') else str(r[0]).split(' ')[0]
        
        if fecha_str in resumen:
            resumen[fecha_str] += r.total_cuotas
        else:
            resumen[fecha_str] = r.total_cuotas

    # Retornamos una lista de diccionarios limpia para el frontend
    return [
        {"fecha": fecha, "total_cuotas": cantidad} 
        for fecha, cantidad in resumen.items()
    ]



# ─── Calcula mora de una cuota al vuelo ──────────────────────────────────────
def calcular_mora_cuota(cuota: models.CuotaPrestamo, tasa_mora_mensual: float) -> dict:
    """
    Retorna mora en pesos, días vencido y total a pagar.
    La mora NO se guarda en BD — se calcula en tiempo real.
    """
    if cuota.estado_pago == "Pagado" or cuota.saldo_pendiente <= 0:
        return {"mora": 0.0, "dias": 0, "total": cuota.saldo_pendiente}

    hoy = datetime.now(BOGOTA_TZ).date()
    fv  = cuota.fecha_vencimiento
    if isinstance(fv, datetime):
        fv = fv.date()

    if fv >= hoy:
        return {"mora": 0.0, "dias": 0, "total": float(cuota.saldo_pendiente)}

    dias_vencido = (hoy - fv).days
    tasa_diaria  = (tasa_mora_mensual / 100) / 30
    mora         = round(float(cuota.saldo_pendiente) * tasa_diaria * dias_vencido, 2)

    return {
        "mora":  mora,
        "dias":  dias_vencido,
        "total": round(float(cuota.saldo_pendiente) + mora, 2),
    }


# ─── Abono a capital: redistribuye excedente entre cuotas pendientes ─────────
def aplicar_abono_capital(db: Session, empresa_id: int, prestamo_id: int, monto_abono: float) -> dict:
    prestamo = db.query(models.Prestamo).filter(
        models.Prestamo.id         == prestamo_id,
        models.Prestamo.empresa_id == empresa_id,
    ).first()
    if not prestamo:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    cuotas_pendientes = (
        db.query(models.CuotaPrestamo)
        .filter(
            models.CuotaPrestamo.prestamo_id == prestamo_id,
            models.CuotaPrestamo.empresa_id  == empresa_id,
            models.CuotaPrestamo.estado_pago != "Pagado",
        )
        .order_by(models.CuotaPrestamo.numero_cuota.asc())
        .all()
    )

    if not cuotas_pendientes:
        raise HTTPException(status_code=400, detail="No hay cuotas pendientes en este préstamo")

    saldo_total = sum(c.saldo_pendiente for c in cuotas_pendientes)

    if monto_abono >= saldo_total:
        for c in cuotas_pendientes:
            c.saldo_pendiente = 0
            c.estado_pago     = "Pagado"
            c.fecha_pago      = datetime.now(BOGOTA_TZ)
        prestamo.estado = "Pagado"
        db.commit()
        return {
            "msg":               "Préstamo liquidado completamente con abono a capital",
            "saldo_anterior":    round(saldo_total, 2),
            "abono_aplicado":    round(monto_abono, 2),
            "nuevo_saldo":       0.0,
            "cuotas_restantes":  0,
            "nuevo_valor_cuota": 0.0,
        }

    nuevo_saldo      = saldo_total - monto_abono
    num_cuotas       = len(cuotas_pendientes)
    nuevo_monto_cuota = round(nuevo_saldo / num_cuotas, 2)

    for i, c in enumerate(cuotas_pendientes):
        # La última cuota absorbe el centavo de diferencia por redondeo
        if i == num_cuotas - 1:
            c.saldo_pendiente = round(nuevo_saldo - nuevo_monto_cuota * (num_cuotas - 1), 2)
        else:
            c.saldo_pendiente = nuevo_monto_cuota
        c.monto_cuota = c.saldo_pendiente

    db.commit()
    return {
        "msg":               f"Abono de {monto_abono:,.0f} aplicado al capital",
        "saldo_anterior":    round(saldo_total, 2),
        "abono_aplicado":    round(monto_abono, 2),
        "nuevo_saldo":       round(nuevo_saldo, 2),
        "cuotas_restantes":  num_cuotas,
        "nuevo_valor_cuota": nuevo_monto_cuota,
    }


# ═══════════════════════════════════════════════════════════════════════════
# AÑADIR A crud.py — Gestión de Perecederos (Lotes + FEFO + Alertas)
# ═══════════════════════════════════════════════════════════════════════════

from datetime import date, datetime, timedelta, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException
import models, schemas


# ── Helper: clasifica urgencia según días restantes ──────────────────────────
def _urgencia(dias: int) -> str:
    if dias <= 0:  return "vencido"
    if dias <= 5:  return "critico"
    if dias <= 15: return "alerta"
    if dias <= 30: return "aviso"
    return "ok"


# ── Helper: enriquece un LoteExistencia con campos calculados ────────────────
def _enriquecer_lote(lote: models.LoteExistencia) -> dict:
    # dias = (lote.fecha_vencimiento - date.today()).days
  # ✅ FIX — construye el dict solo con columnas reales
    fv = lote.fecha_vencimiento.date() if isinstance(lote.fecha_vencimiento, datetime) else lote.fecha_vencimiento
    dias = (fv - date.today()).days
    pct = round(
        ((lote.cantidad_inicial - lote.cantidad_actual) / lote.cantidad_inicial * 100)
        if lote.cantidad_inicial > 0 else 0, 1
    )
    return {
        "id":                lote.id,
        "empresa_id":        lote.empresa_id,
        "producto_id":       lote.producto_id,
        "numero_lote":       lote.numero_lote,
        "fecha_vencimiento": fv,
        "fecha_fabricacion": lote.fecha_fabricacion,
        "cantidad_inicial":  lote.cantidad_inicial,
        "cantidad_actual":   lote.cantidad_actual,
        "costo_unitario":    lote.costo_unitario,
        "proveedor_id":      lote.proveedor_id,
        "referencia_compra": lote.referencia_compra,
        "observaciones":     lote.observaciones,
        "created_at":        lote.created_at,
        "producto_nombre":   lote.producto.nombre if lote.producto else None,
        "proveedor_nombre":  lote.proveedor.nombre if lote.proveedor else None,
        "dias_restantes":    dias,
        "urgencia":          _urgencia(dias),
        "porcentaje_consumo": pct,
    }


# ════════════════════════════════════════════════════════════════════════════
# CRUD BÁSICO DE LOTES
# ════════════════════════════════════════════════════════════════════════════

def crear_lote_existencia(
    db: Session,
    empresa_id: int,
    payload: schemas.LoteExistenciaCreate,
) -> models.LoteExistencia:
    """
    Crea o actualiza un lote de existencias.
    Si ya existe el mismo numero_lote para ese producto y empresa, suma la cantidad.
    """
    # Verificar que el producto pertenece a la empresa
    producto = db.query(models.Producto).filter(
        models.Producto.id         == payload.producto_id,
        models.Producto.empresa_id == empresa_id,
    ).first()
    if not producto:
        raise HTTPException(404, "Producto no encontrado o no pertenece a esta empresa.")

    # Buscar si ya existe este lote
    lote = db.query(models.LoteExistencia).filter(
        models.LoteExistencia.empresa_id  == empresa_id,
        models.LoteExistencia.producto_id == payload.producto_id,
        models.LoteExistencia.numero_lote == payload.numero_lote,
    ).first()

    if lote:
        # Reposición del mismo lote — suma cantidades
        lote.cantidad_actual  += payload.cantidad_inicial
        lote.cantidad_inicial += payload.cantidad_inicial
        # Actualiza el costo al promedio ponderado
        total_unidades = lote.cantidad_actual
        lote.costo_unitario = (
            (lote.costo_unitario * (total_unidades - payload.cantidad_inicial)
             + payload.costo_unitario * payload.cantidad_inicial)
            / total_unidades
        ) if total_unidades > 0 else payload.costo_unitario
    else:
        lote = models.LoteExistencia(
            empresa_id        = empresa_id,
            producto_id       = payload.producto_id,
            numero_lote       = payload.numero_lote,
            fecha_vencimiento = payload.fecha_vencimiento,
            fecha_fabricacion = payload.fecha_fabricacion,
            cantidad_inicial  = payload.cantidad_inicial,
            cantidad_actual   = payload.cantidad_inicial,
            costo_unitario    = payload.costo_unitario,
            proveedor_id      = payload.proveedor_id,
            referencia_compra = payload.referencia_compra,
            observaciones     = payload.observaciones,
        )
        db.add(lote)

    # Actualizar stock_actual del producto sumando la cantidad ingresada
    producto.stock_actual = (producto.stock_actual or 0) + payload.cantidad_inicial

    # Registrar en inventory_movements para el Kardex
    db.add(models.InventoryMovement(
        producto_id    = payload.producto_id,
        tipo           = "entrada",
        cantidad       = payload.cantidad_inicial,
        costo_unitario = payload.costo_unitario,
        motivo         = "ingreso_lote",
        referencia     = payload.referencia_compra or f"Lote {payload.numero_lote}",
        observacion    = f"Vence: {payload.fecha_vencimiento} | Lote: {payload.numero_lote}",
        empresa_id     = empresa_id,
        numero_lote    = payload.numero_lote,
    ))

    db.commit()
    db.refresh(lote)
    return lote


def get_lotes_producto(
    db: Session,
    empresa_id: int,
    producto_id: int,
    solo_activos: bool = True,
) -> list:
    """Lista todos los lotes de un producto, ordenados FEFO."""
    q = db.query(models.LoteExistencia).filter(
        models.LoteExistencia.empresa_id  == empresa_id,
        models.LoteExistencia.producto_id == producto_id,
    )
    if solo_activos:
        q = q.filter(models.LoteExistencia.cantidad_actual > 0)

    lotes = q.order_by(models.LoteExistencia.fecha_vencimiento.asc()).all()
    return [_enriquecer_lote(l) for l in lotes]


def get_todos_los_lotes(
    db: Session,
    empresa_id: int,
    solo_activos: bool = True,
    producto_id: int = None,
) -> list:
    """Lista todos los lotes de la empresa."""
    q = (
        db.query(models.LoteExistencia)
        .join(models.Producto)
        .filter(models.LoteExistencia.empresa_id == empresa_id)
    )
    if solo_activos:
        q = q.filter(models.LoteExistencia.cantidad_actual > 0)
    if producto_id:
        q = q.filter(models.LoteExistencia.producto_id == producto_id)

    lotes = q.order_by(models.LoteExistencia.fecha_vencimiento.asc()).all()
    return [_enriquecer_lote(l) for l in lotes]


def ajustar_lote(
    db: Session,
    empresa_id: int,
    lote_id: int,
    ajuste: schemas.LoteAjusteCreate,
) -> models.LoteExistencia:
    """Ajuste manual de cantidad en un lote (positivo=entrada, negativo=salida)."""
    lote = db.query(models.LoteExistencia).filter(
        models.LoteExistencia.id         == lote_id,
        models.LoteExistencia.empresa_id == empresa_id,
    ).first()
    if not lote:
        raise HTTPException(404, "Lote no encontrado.")

    nueva_cantidad = lote.cantidad_actual + ajuste.cantidad
    if nueva_cantidad < 0:
        raise HTTPException(400, f"Ajuste inválido: la cantidad resultante sería negativa "
                                 f"({nueva_cantidad:.2f}).")

    lote.cantidad_actual = nueva_cantidad

    # Actualizar stock del producto
    producto = db.query(models.Producto).filter(
        models.Producto.id         == lote.producto_id,
        models.Producto.empresa_id == empresa_id,
    ).first()
    if producto:
        producto.stock_actual = (producto.stock_actual or 0) + ajuste.cantidad

    # Registrar movimiento
    db.add(models.InventoryMovement(
        producto_id    = lote.producto_id,
        tipo           = "entrada" if ajuste.cantidad > 0 else "salida",
        cantidad       = abs(ajuste.cantidad),
        costo_unitario = lote.costo_unitario,
        motivo         = f"ajuste_lote: {ajuste.motivo}",
        referencia     = ajuste.referencia or f"Lote {lote.numero_lote}",
        empresa_id     = empresa_id,
        lote_id        = lote.id,
        numero_lote    = lote.numero_lote,
    ))

    db.commit()
    db.refresh(lote)
    return lote


# ════════════════════════════════════════════════════════════════════════════
# FEFO — FIRST EXPIRED, FIRST OUT
# ════════════════════════════════════════════════════════════════════════════

def get_lotes_fefo(
    db: Session,
    empresa_id: int,
    producto_id: int,
) -> list[models.LoteExistencia]:
    """
    Retorna los lotes vigentes del producto ordenados por fecha de vencimiento ASC.
    No incluye lotes ya vencidos ni sin stock.
    """
    hoy = date.today()
    return (
        db.query(models.LoteExistencia)
        .filter(
            models.LoteExistencia.empresa_id        == empresa_id,
            models.LoteExistencia.producto_id       == producto_id,
            models.LoteExistencia.cantidad_actual   >  0,
            models.LoteExistencia.fecha_vencimiento >= hoy,
        )
        .order_by(models.LoteExistencia.fecha_vencimiento.asc())
        .all()
    )


def consumir_stock_fefo(
    db: Session,
    empresa_id: int,
    producto_id: int,
    cantidad_requerida: float,
    motivo: str = "venta",
    referencia: str = "",
    commit: bool = True,
) -> list[dict]:
    """
    Descuenta stock aplicando FEFO.
    Retorna lista de lotes afectados para trazabilidad en la factura.
    Lanza ValueError si no hay stock suficiente en lotes vigentes.
    """
    lotes    = get_lotes_fefo(db, empresa_id, producto_id)
    restante = cantidad_requerida
    afectados = []

    for lote in lotes:
        if restante <= 0:
            break

        consumo = min(lote.cantidad_actual, restante)
        lote.cantidad_actual -= consumo
        restante             -= consumo

        afectados.append({
            "lote_id":           lote.id,
            "numero_lote":       lote.numero_lote,
            "fecha_vencimiento": lote.fecha_vencimiento.isoformat(),
            "consumido":         consumo,
        })

        db.add(models.InventoryMovement(
            empresa_id     = empresa_id,
            producto_id    = producto_id,
            tipo           = "salida",
            cantidad       = consumo,
            costo_unitario = lote.costo_unitario,
            motivo         = motivo,
            referencia     = referencia,
            lote_id        = lote.id,
            numero_lote    = lote.numero_lote,
        ))

    if restante > 0:
        raise ValueError(
            f"Stock insuficiente en lotes vigentes para '{referencia}'. "
            f"Faltaron {restante:.2f} unidades."
        )

    if commit:
        db.commit()

    return afectados


def sugerencia_fefo(
    db: Session,
    empresa_id: int,
    producto_id: int,
    cantidad_requerida: float,
) -> dict:
    """
    Devuelve la sugerencia FEFO SIN modificar la BD.
    Útil para mostrar al usuario qué lotes se van a consumir antes de confirmar.
    """
    lotes    = get_lotes_fefo(db, empresa_id, producto_id)
    restante = cantidad_requerida
    plan     = []
    factible = True

    for lote in lotes:
        if restante <= 0:
            break
        consumo = min(lote.cantidad_actual, restante)
        restante -= consumo
        plan.append({
            "lote_id":           lote.id,
            "numero_lote":       lote.numero_lote,
            "fecha_vencimiento": lote.fecha_vencimiento.isoformat(),
            "dias_restantes":    (lote.fecha_vencimiento - date.today()).days,
            "cantidad_disponible": lote.cantidad_actual,
            "a_consumir":        consumo,
        })

    if restante > 0:
        factible = False

    return {
        "factible":          factible,
        "cantidad_requerida": cantidad_requerida,
        "faltante":          restante if not factible else 0,
        "lotes_sugeridos":   plan,
    }


# ════════════════════════════════════════════════════════════════════════════
# ALERTAS DE VENCIMIENTO
# ════════════════════════════════════════════════════════════════════════════

def get_alertas_vencimiento(
    db: Session,
    empresa_id: int,
    dias: int = 30,
) -> list[dict]:
    """
    Retorna lotes con stock > 0 cuya fecha de vencimiento está dentro de `dias` días.
    Incluye lotes ya vencidos (dias_restantes < 0).
    """
    limite = date.today() + timedelta(days=dias)

    lotes = (
        db.query(models.LoteExistencia)
        .join(models.Producto)
        .filter(
            models.LoteExistencia.empresa_id        == empresa_id,
            models.LoteExistencia.cantidad_actual   >  0,
            models.LoteExistencia.fecha_vencimiento <= limite,
        )
        .order_by(models.LoteExistencia.fecha_vencimiento.asc())
        .all()
    )

    return [
        {
            "lote_id":           l.id,
            "producto_id":       l.producto_id,
            "producto_nombre":   l.producto.nombre,
            "numero_lote":       l.numero_lote,
            "cantidad_actual":   l.cantidad_actual,
            "unidad_medida":     l.producto.unidad_medida,
            "fecha_vencimiento": l.fecha_vencimiento.isoformat(),
            "dias_restantes":    (l.fecha_vencimiento - date.today()).days,
            "urgencia":          _urgencia((l.fecha_vencimiento - date.today()).days),
            "valor_en_riesgo":   round(l.cantidad_actual * l.costo_unitario, 2),
        }
        for l in lotes
    ]


def get_resumen_alertas(db: Session, empresa_id: int) -> dict:
    """
    KPIs de alertas: cuántos lotes en cada categoría de urgencia.
    Para el dashboard.
    """
    alertas = get_alertas_vencimiento(db, empresa_id, dias=30)

    return {
        "vencidos":  sum(1 for a in alertas if a["urgencia"] == "vencido"),
        "criticos":  sum(1 for a in alertas if a["urgencia"] == "critico"),
        "alertas":   sum(1 for a in alertas if a["urgencia"] == "alerta"),
        "avisos":    sum(1 for a in alertas if a["urgencia"] == "aviso"),
        "valor_total_en_riesgo": sum(a["valor_en_riesgo"] for a in alertas),
        "detalle":   alertas,
    }


def notificar_vencimientos_proximos(db: Session) -> int:
    """
    Cron job: genera notificaciones para admins de empresas con lotes
    próximos a vencer (≤ 15 días). Se llama desde un endpoint superadmin.
    Retorna el número de notificaciones creadas.
    """
    limite  = date.today() + timedelta(days=15)
    hoy     = date.today()
    total   = 0

    empresas = db.query(models.Empresa).filter(models.Empresa.is_active == True).all()

    for empresa in empresas:
        lotes_criticos = db.query(models.LoteExistencia).join(models.Producto).filter(
            models.LoteExistencia.empresa_id        == empresa.id,
            models.LoteExistencia.cantidad_actual   >  0,
            models.LoteExistencia.fecha_vencimiento <= limite,
        ).all()

        if not lotes_criticos:
            continue

        vencidos = [l for l in lotes_criticos if l.fecha_vencimiento < hoy]
        criticos = [l for l in lotes_criticos if hoy <= l.fecha_vencimiento <= hoy + timedelta(days=5)]
        proximos = [l for l in lotes_criticos if l.fecha_vencimiento > hoy + timedelta(days=5)]

        admins = db.query(models.User).join(models.Role).filter(
            models.User.empresa_id == empresa.id,
            models.Role.name       == "Admin",
            models.User.is_active  == True,
        ).all()

        for admin in admins:
            if vencidos:
                db.add(models.Notificacion(
                    usuario_id    = admin.id,
                    empresa_id    = empresa.id,
                    mensaje       = f"🔴 {len(vencidos)} lote(s) VENCIDO(S). Retíralos del inventario inmediatamente.",
                    tipo          = "error",
                    leido         = False,
                ))
                total += 1

            if criticos:
                nombres = ", ".join(set(l.producto.nombre for l in criticos))
                db.add(models.Notificacion(
                    usuario_id    = admin.id,
                    empresa_id    = empresa.id,
                    mensaje       = f"🟠 {len(criticos)} lote(s) vencen en ≤5 días: {nombres[:80]}",
                    tipo          = "warning",
                    leido         = False,
                ))
                total += 1

            if proximos:
                db.add(models.Notificacion(
                    usuario_id    = admin.id,
                    empresa_id    = empresa.id,
                    mensaje       = f"🟡 {len(proximos)} lote(s) vencen en los próximos 15 días.",
                    tipo          = "info",
                    leido         = False,
                ))
                total += 1

    db.commit()
    return total




# ═══════════════════════════════════════════════════════════════════════════
# AÑADIR A crud.py — Fase 2A (Resoluciones DIAN) + Fase 2B (Cotizaciones)
# Pega este bloque AL FINAL de tu crud.py
# ═══════════════════════════════════════════════════════════════════════════


# ════════════════════════════════════════════════════════════════════════════
# HELPERS INTERNOS (usados por create_venta y convertir_cotizacion)
# ════════════════════════════════════════════════════════════════════════════

def _get_resolucion_activa(db: Session, empresa_id: int) -> Optional[models.ResolucionDian]:
    """Retorna la resolución activa de la empresa, si existe."""
    return db.query(models.ResolucionDian).filter(
        models.ResolucionDian.empresa_id == empresa_id,
        models.ResolucionDian.is_active  == True,
    ).first()


def _asignar_numero_factura(db: Session, empresa_id: int, venta: models.Venta) -> Optional[str]:
    """
    Incrementa el consecutivo de la resolución activa y asigna el numero_factura
    a la venta. Retorna el número asignado o None si no hay resolución activa.
    Llama ANTES de hacer db.commit().
    """
    resolucion = _get_resolucion_activa(db, empresa_id)
    if not resolucion:
        return None

    siguiente = resolucion.numero_actual + 1

    # Validación de rango
    if siguiente > resolucion.numero_final:
        raise HTTPException(
            status_code=400,
            detail=(
                f"La resolución DIAN ha llegado al límite de numeración "
                f"({resolucion.numero_final}). Configura una nueva resolución."
            )
        )

    resolucion.numero_actual = siguiente
    numero_str = f"{resolucion.prefijo}{siguiente}"
    venta.numero_factura = numero_str
    venta.resolucion_id  = resolucion.id
    db.add(resolucion)
    return numero_str


def _ejecutar_movimientos_venta(db: Session, empresa_id: int, db_venta: models.Venta):
    """
    Crea los movimientos de inventario para cada detalle de la venta.
    Aplica FEFO si el producto maneja lotes, descuento estándar en caso contrario.
    Reutilizable desde create_venta (main.py) y convertir_cotizacion.
    """
    for det in db_venta.detalles:
        prod = get_producto(db, empresa_id=empresa_id, producto_id=det.producto_id)
        if not prod or prod.es_servicio:
            continue

        if getattr(prod, "maneja_lotes", False):
            try:
                consumir_stock_fefo(
                    db, empresa_id=empresa_id,
                    producto_id=det.producto_id,
                    cantidad_requerida=det.cantidad,
                    referencia=f"Venta #{db_venta.id}",
                    commit=False,
                )
                prod.stock_actual = (prod.stock_actual or 0) - det.cantidad
                db.add(prod)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
        else:
            create_movement(db, empresa_id=empresa_id, payload=schemas.InventoryMovementCreate(
                producto_id    = det.producto_id,
                tipo           = schemas.MovementType.salida,
                cantidad       = det.cantidad,
                costo_unitario = prod.costo or 0.0,
                motivo         = "venta",
                referencia     = f"venta #{db_venta.id}",
            ))


# ════════════════════════════════════════════════════════════════════════════
# TAMBIÉN: ACTUALIZA create_venta para que asigne numero_factura automáticamente
# Agrega esta línea ANTES del db.commit() en tu crud.create_venta existente:
#
#     # Fase 2A: Numeración DIAN (solo para ventas reales, no cotizaciones)
#     if getattr(venta, 'tipo', 'venta') == 'venta':
#         _asignar_numero_factura(db, empresa_id, db_venta)
#
#     # Fase 2B: campos extra
#     db_venta.tipo         = getattr(venta, 'tipo', 'venta')
#     db_venta.valida_hasta = getattr(venta, 'valida_hasta', None)
#     db_venta.observaciones = getattr(venta, 'observaciones', None)
#
# ════════════════════════════════════════════════════════════════════════════


# ════════════════════════════════════════════════════════════════════════════
# FASE 2A — CRUD DE RESOLUCIONES DIAN
# ════════════════════════════════════════════════════════════════════════════

def get_resoluciones(db: Session, empresa_id: int) -> List[models.ResolucionDian]:
    """Lista todas las resoluciones de la empresa, ordenadas por id desc."""
    resoluciones = db.query(models.ResolucionDian).filter(
        models.ResolucionDian.empresa_id == empresa_id
    ).order_by(models.ResolucionDian.id.desc()).all()

    # Enriquecer con campos calculados
    hoy = date.today()
    resultado = []
    for r in resoluciones:
        r_dict = {
            "id":                   r.id,
            "empresa_id":           r.empresa_id,
            "prefijo":              r.prefijo or "",
            "numero_resolucion":    r.numero_resolucion,
            "numero_actual":        r.numero_actual,
            "numero_inicial":       r.numero_inicial,
            "numero_final":         r.numero_final,
            "vigencia_desde":       r.vigencia_desde,
            "vigencia_hasta":       r.vigencia_hasta,
            "is_active":            r.is_active,
            "created_at":           r.created_at,
            "numeros_disponibles":  r.numero_final - r.numero_actual,
            "porcentaje_usado":     round(
                ((r.numero_actual - r.numero_inicial) /
                 max(r.numero_final - r.numero_inicial, 1)) * 100, 1
            ) if r.numero_actual > 0 else 0.0,
            "esta_vigente": (
                (r.vigencia_hasta is None or r.vigencia_hasta >= hoy) and
                r.numero_actual < r.numero_final
            ),
        }
        resultado.append(r_dict)
    return resultado


def create_resolucion(
    db: Session,
    empresa_id: int,
    payload: schemas.ResolucionDianCreate,
) -> models.ResolucionDian:
    """Crea una resolución. Si is_active=True desactiva las demás."""
    resolucion = models.ResolucionDian(
        empresa_id        = empresa_id,
        prefijo           = payload.prefijo or "",
        numero_resolucion = payload.numero_resolucion,
        numero_actual     = payload.numero_inicial - 1,   # El primero asignado será numero_inicial
        numero_inicial    = payload.numero_inicial,
        numero_final      = payload.numero_final,
        vigencia_desde    = payload.vigencia_desde,
        vigencia_hasta    = payload.vigencia_hasta,
        is_active         = False,
    )
    db.add(resolucion)
    db.commit()
    db.refresh(resolucion)
    return resolucion


def update_resolucion(
    db: Session,
    empresa_id: int,
    resolucion_id: int,
    payload: schemas.ResolucionDianUpdate,
) -> Optional[models.ResolucionDian]:
    resolucion = db.query(models.ResolucionDian).filter(
        models.ResolucionDian.id         == resolucion_id,
        models.ResolucionDian.empresa_id == empresa_id,
    ).first()
    if not resolucion:
        return None

    for key, val in payload.dict(exclude_unset=True).items():
        setattr(resolucion, key, val)

    db.commit()
    db.refresh(resolucion)
    return resolucion


def activar_resolucion(
    db: Session,
    empresa_id: int,
    resolucion_id: int,
) -> Optional[models.ResolucionDian]:
    """Activa una resolución y desactiva todas las demás de la empresa."""
    # Desactivar todas
    db.query(models.ResolucionDian).filter(
        models.ResolucionDian.empresa_id == empresa_id,
    ).update({"is_active": False})

    # Activar la seleccionada
    resolucion = db.query(models.ResolucionDian).filter(
        models.ResolucionDian.id         == resolucion_id,
        models.ResolucionDian.empresa_id == empresa_id,
    ).first()
    if not resolucion:
        db.rollback()
        return None

    resolucion.is_active = True
    db.commit()
    db.refresh(resolucion)
    return resolucion


def delete_resolucion(
    db: Session,
    empresa_id: int,
    resolucion_id: int,
) -> bool:
    """Elimina una resolución solo si no ha emitido ningún comprobante."""
    resolucion = db.query(models.ResolucionDian).filter(
        models.ResolucionDian.id         == resolucion_id,
        models.ResolucionDian.empresa_id == empresa_id,
    ).first()
    if not resolucion:
        return False

    if resolucion.numero_actual > 0:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar una resolución que ya emitió comprobantes."
        )

    db.delete(resolucion)
    db.commit()
    return True


# ════════════════════════════════════════════════════════════════════════════
# FASE 2B — CRUD DE COTIZACIONES
# ════════════════════════════════════════════════════════════════════════════

def get_cotizaciones(
    db: Session,
    empresa_id: int,
    skip: int = 0,
    limit: int = 100,
) -> List[dict]:
    """Lista cotizaciones de la empresa ordenadas por fecha desc."""
    cotizaciones = (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.cliente),
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
        )
        .filter(
            models.Venta.empresa_id == empresa_id,
            models.Venta.tipo       == "cotizacion",
        )
        .order_by(models.Venta.fecha.desc())
        .offset(skip).limit(limit).all()
    )

    hoy = datetime.now()
    resultado = []
    for c in cotizaciones:
        estado = "vigente"
        if c.numero_factura:          # fue convertida
            estado = "convertida"
        elif c.valida_hasta and c.valida_hasta < hoy:
            estado = "vencida"

        resultado.append({
            **{col.key: getattr(c, col.key)
               for col in models.Venta.__table__.columns},
            "cliente":           c.cliente,
            "detalles":          c.detalles,
            "estado_cotizacion": estado,
        })
    return resultado


def create_cotizacion(
    db: Session,
    empresa_id: int,
    payload: schemas.CotizacionCreate,
) -> models.Venta:
    """
    Crea una cotización. NO valida stock, NO crea movimientos de inventario.
    """
    cliente = get_cliente(db, empresa_id, payload.cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")

    total_bruto = 0.0
    detalles_objs = []

    for d in payload.detalles:
        prod = get_producto(db, empresa_id, d.producto_id)
        if not prod:
            raise HTTPException(status_code=404, detail=f"Producto {d.producto_id} no encontrado.")

        precio = d.precio_unitario if d.precio_unitario is not None else prod.precio
        subtotal = precio * d.cantidad
        total_bruto += subtotal

        detalles_objs.append(models.DetalleVenta(
            producto_id     = d.producto_id,
            cantidad        = d.cantidad,
            precio_unitario = precio,
            descuento_pct   = getattr(d, "descuento_pct", 0.0),
            iva_porcentaje  = 0.0,
        ))

    iva_porc  = float(payload.iva_porcentaje or 0)
    iva_total = total_bruto * iva_porc / (100 + iva_porc) if iva_porc > 0 else 0.0

    db_cot = models.Venta(
        cliente_id    = payload.cliente_id,
        total         = total_bruto,
        iva_total     = iva_total,
        iva_porcentaje = iva_porc,
        monto_pagado  = 0.0,
        estado_pago   = "pendiente",
        tipo          = "cotizacion",
        valida_hasta  = payload.valida_hasta,
        observaciones = payload.observaciones,
        empresa_id    = empresa_id,
        fecha         = datetime.now(timezone.utc),
    )
    db.add(db_cot)
    db.flush()

    for det in detalles_objs:
        det.venta_id   = db_cot.id
        det.empresa_id = empresa_id
        db.add(det)

    db.commit()
    db.refresh(db_cot)
    return db_cot


def convertir_cotizacion_a_venta(
    db: Session,
    empresa_id: int,
    cotizacion_id: int,
    payload: schemas.CotizacionConvertir,
) -> models.Venta:
    """
    Convierte una cotización en una venta real:
    1. Valida stock
    2. Crea movimientos de inventario (FEFO o estándar)
    3. Asigna numero_factura desde resolución activa
    4. Cambia tipo → 'venta'
    5. Marca estado_pago según payload.pagada
    """
    cotizacion = (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
            joinedload(models.Venta.cliente),
        )
        .filter(
            models.Venta.id         == cotizacion_id,
            models.Venta.empresa_id == empresa_id,
            models.Venta.tipo       == "cotizacion",
        )
        .first()
    )

    if not cotizacion:
        raise HTTPException(status_code=404, detail="Cotización no encontrada.")

    if cotizacion.numero_factura:
        raise HTTPException(status_code=400, detail="Esta cotización ya fue convertida a venta.")

    # ── 1. Validar stock ──────────────────────────────────────────────────
    for det in cotizacion.detalles:
        prod = get_producto(db, empresa_id, det.producto_id)
        if not prod or prod.es_servicio:
            continue
        if not getattr(prod, "maneja_lotes", False):
            stock_disp = prod.stock_actual or 0
            if stock_disp < det.cantidad:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para '{prod.nombre}'. "
                           f"Disponible: {stock_disp}, requerido: {det.cantidad}."
                )

    # ── 2. Crear movimientos de inventario ────────────────────────────────
    # Necesitamos que cotizacion.id sea conocido como venta primero
    cotizacion.tipo = "venta"
    db.flush()  # sincroniza el tipo antes de crear movimientos

    _ejecutar_movimientos_venta(db, empresa_id, cotizacion)

    # ── 3. Asignar numero_factura ─────────────────────────────────────────
    _asignar_numero_factura(db, empresa_id, cotizacion)

    # ── 4. Actualizar estado de pago ──────────────────────────────────────
    cotizacion.pagada      = payload.pagada
    cotizacion.estado_pago = "pagado" if payload.pagada else "pendiente"
    cotizacion.metodo_pago = payload.metodo_pago if payload.pagada else None
    cotizacion.monto_pagado = cotizacion.total if payload.pagada else 0.0
    cotizacion.fecha_pago   = datetime.now(timezone.utc) if payload.pagada else None

    db.commit()
    db.refresh(cotizacion)

    # Notificar bajo stock
    check_and_notify_low_stock(
        db, empresa_id=empresa_id,
        producto_ids=[d.producto_id for d in cotizacion.detalles]
    )

    return cotizacion


def delete_cotizacion(
    db: Session,
    empresa_id: int,
    cotizacion_id: int,
) -> bool:
    """Elimina una cotización. No puede eliminarse si ya fue convertida."""
    cotizacion = db.query(models.Venta).filter(
        models.Venta.id         == cotizacion_id,
        models.Venta.empresa_id == empresa_id,
        models.Venta.tipo       == "cotizacion",
    ).first()

    if not cotizacion:
        raise HTTPException(status_code=404, detail="Cotización no encontrada.")

    if cotizacion.numero_factura:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar una cotización ya convertida a venta."
        )

    db.delete(cotizacion)
    db.commit()
    return True





# ═══════════════════════════════════════════════════════════════════════════════
# CRUD DEL MÓDULO PARQUEADERO
# Pega este bloque AL FINAL de tu crud.py
#
# Reutiliza helpers existentes: BOGOTA_TZ, get_utc_boundaries, get_cliente
# ═══════════════════════════════════════════════════════════════════════════════

from datetime import date, datetime, timedelta, timezone
from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from fastapi import HTTPException
from dateutil.relativedelta import relativedelta   # ← clave para "mismo día del mes siguiente"

import models
import schemas


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS INTERNOS
# ═══════════════════════════════════════════════════════════════════════════════

def _calcular_fecha_vencimiento(fecha_inicio: date, tipo: str) -> date:
    """
    Calcula la fecha de vencimiento según el tipo de suscripción.
    - mensual:   mismo día del mes siguiente (relativedelta maneja febrero, etc.)
    - quincenal: 15 días exactos
    - diaria:    1 día
    """
    if tipo == "mensual":
        return fecha_inicio + relativedelta(months=+1)
    if tipo == "quincenal":
        return fecha_inicio + timedelta(days=15)
    if tipo == "diaria":
        return fecha_inicio + timedelta(days=1)
    raise ValueError(f"Tipo de suscripción desconocido: {tipo}")


def _obtener_tarifa_por_tipo(config: models.ParqueaderoConfig, tipo: str) -> float:
    """Devuelve la tarifa global configurada para el tipo de suscripción."""
    if tipo == "mensual":
        return config.tarifa_mensual or 0.0
    if tipo == "quincenal":
        return config.tarifa_quincenal or 0.0
    if tipo == "diaria":
        return config.tarifa_diaria or 0.0
    raise ValueError(f"Tipo no válido: {tipo}")


def _actualizar_estado_pago(suscripcion: models.SuscripcionParqueadero):
    """Recalcula estado_pago según monto_pagado vs monto_total."""
    if suscripcion.monto_pagado >= suscripcion.monto_total:
        suscripcion.estado_pago = "pagado"
    elif suscripcion.monto_pagado > 0:
        suscripcion.estado_pago = "parcial"
    else:
        suscripcion.estado_pago = "pendiente"


def _enriquecer_suscripcion(susc: models.SuscripcionParqueadero) -> dict:
    """Convierte una suscripción a dict con campos calculados (saldo, días restantes)."""
    hoy = datetime.now(BOGOTA_TZ).date()
    saldo = max(0.0, (susc.monto_total or 0) - (susc.monto_pagado or 0))
    dias_restantes = (susc.fecha_vencimiento - hoy).days

    pagos_data = []
    for p in (susc.pagos or []):
        pagos_data.append({
            "id":               p.id,
            "suscripcion_id":   p.suscripcion_id,
            "monto":            p.monto,
            "metodo_pago":      p.metodo_pago,
            "fecha":            p.fecha,
            "observaciones":    p.observaciones,
            "usuario_id":       p.usuario_id,
            "usuario_username": p.usuario.username if getattr(p, "usuario", None) else None,
        })

    return {
        "id":                  susc.id,
        "empresa_id":          susc.empresa_id,
        "vehiculo_id":         susc.vehiculo_id,
        "tipo":                susc.tipo,
        "fecha_inicio":        susc.fecha_inicio,
        "fecha_vencimiento":   susc.fecha_vencimiento,
        "monto_total":         susc.monto_total,
        "monto_pagado":        susc.monto_pagado,
        "saldo_pendiente":     saldo,
        "estado_pago":         susc.estado_pago,
        "estado":              susc.estado,
        "metodo_pago_inicial": susc.metodo_pago_inicial,
        "observaciones":       susc.observaciones,
        "es_retroactiva":      susc.es_retroactiva,
        "dias_restantes":      dias_restantes,
        "created_at":          susc.created_at,
        "placa":               susc.vehiculo.placa if susc.vehiculo else None,
        "cliente_nombre":      susc.vehiculo.cliente.nombre if (susc.vehiculo and susc.vehiculo.cliente) else None,
        "pagos":               pagos_data,
    }


def _enriquecer_vehiculo(veh: models.Vehiculo) -> dict:
    """Convierte un vehículo a dict con datos del cliente."""
    return {
        "id":                veh.id,
        "empresa_id":        veh.empresa_id,
        "placa":             veh.placa,
        "cliente_id":        veh.cliente_id,
        "marca":             veh.marca,
        "modelo":            veh.modelo,
        "color":             veh.color,
        "foto_url":          veh.foto_url,
        "observaciones":     veh.observaciones,
        "is_active":         veh.is_active,
        "created_at":        veh.created_at,
        "cliente_nombre":    veh.cliente.nombre if veh.cliente else None,
        "cliente_telefono":  veh.cliente.telefono if veh.cliente else None,
        "cliente_cedula":    veh.cliente.cedula if veh.cliente else None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 1. CONFIG (Tarifas + Cupo)
# ═══════════════════════════════════════════════════════════════════════════════

def get_or_create_parq_config(db: Session, empresa_id: int) -> models.ParqueaderoConfig:
    """Obtiene la config de la empresa, o la crea con valores por defecto."""
    cfg = db.query(models.ParqueaderoConfig).filter(
        models.ParqueaderoConfig.empresa_id == empresa_id
    ).first()
    if cfg:
        return cfg

    cfg = models.ParqueaderoConfig(empresa_id=empresa_id)
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg


def update_parq_config(
    db: Session, empresa_id: int, payload: schemas.ParqueaderoConfigUpdate
) -> models.ParqueaderoConfig:
    cfg = get_or_create_parq_config(db, empresa_id)
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(cfg, k, v)
    cfg.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(cfg)
    return cfg


# ═══════════════════════════════════════════════════════════════════════════════
# 2. VEHÍCULOS
# ═══════════════════════════════════════════════════════════════════════════════

def get_vehiculo(db: Session, empresa_id: int, vehiculo_id: int) -> Optional[models.Vehiculo]:
    return (
        db.query(models.Vehiculo)
        .options(joinedload(models.Vehiculo.cliente))
        .filter(
            models.Vehiculo.id == vehiculo_id,
            models.Vehiculo.empresa_id == empresa_id,
        )
        .first()
    )


def get_vehiculo_por_placa(db: Session, empresa_id: int, placa: str) -> Optional[models.Vehiculo]:
    placa_norm = placa.strip().upper().replace(" ", "").replace("-", "")
    return (
        db.query(models.Vehiculo)
        .options(joinedload(models.Vehiculo.cliente))
        .filter(
            models.Vehiculo.empresa_id == empresa_id,
            models.Vehiculo.placa == placa_norm,
        )
        .first()
    )


def list_vehiculos(
    db: Session, empresa_id: int, skip: int = 0, limit: int = 200,
    search: Optional[str] = None, solo_activos: bool = True,
) -> List[dict]:
    q = (
        db.query(models.Vehiculo)
        .options(joinedload(models.Vehiculo.cliente))
        .filter(models.Vehiculo.empresa_id == empresa_id)
    )
    if solo_activos:
        q = q.filter(models.Vehiculo.is_active == True)
    if search:
        s = f"%{search.strip().upper()}%"
        q = q.outerjoin(models.Cliente, models.Vehiculo.cliente_id == models.Cliente.id).filter(
            or_(
                models.Vehiculo.placa.ilike(s),
                models.Cliente.nombre.ilike(s),
                models.Cliente.cedula.ilike(s),
            )
        )
    vehiculos = q.order_by(models.Vehiculo.created_at.desc()).offset(skip).limit(limit).all()
    return [_enriquecer_vehiculo(v) for v in vehiculos]


def create_vehiculo(
    db: Session, empresa_id: int, payload: schemas.VehiculoCreate
) -> models.Vehiculo:
    # Validar que el cliente existe y pertenece a la empresa
    cliente = get_cliente(db, empresa_id, payload.cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Propietario no encontrado en esta empresa.")

    # Validar placa única
    existente = get_vehiculo_por_placa(db, empresa_id, payload.placa)
    if existente:
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe un vehículo con placa {payload.placa} en este parqueadero."
        )

    veh = models.Vehiculo(empresa_id=empresa_id, **payload.dict())
    db.add(veh)
    db.commit()
    db.refresh(veh)
    return veh


def update_vehiculo(
    db: Session, empresa_id: int, vehiculo_id: int, payload: schemas.VehiculoUpdate
) -> Optional[models.Vehiculo]:
    veh = get_vehiculo(db, empresa_id, vehiculo_id)
    if not veh:
        return None

    data = payload.dict(exclude_unset=True)

    # Si se cambia la placa, validar unicidad
    if "placa" in data and data["placa"] != veh.placa:
        otro = get_vehiculo_por_placa(db, empresa_id, data["placa"])
        if otro and otro.id != vehiculo_id:
            raise HTTPException(status_code=400, detail="Ya existe otro vehículo con esa placa.")

    for k, v in data.items():
        setattr(veh, k, v)
    db.commit()
    db.refresh(veh)
    return veh


def delete_vehiculo(db: Session, empresa_id: int, vehiculo_id: int) -> bool:
    """
    Borrado lógico: marca is_active=False. Conserva el histórico de suscripciones.
    """
    veh = get_vehiculo(db, empresa_id, vehiculo_id)
    if not veh:
        return False
    veh.is_active = False
    db.commit()
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# 3. SUSCRIPCIONES
# ═══════════════════════════════════════════════════════════════════════════════

def get_suscripcion_activa(
    db: Session, empresa_id: int, vehiculo_id: int
) -> Optional[models.SuscripcionParqueadero]:
    """
    Devuelve la suscripción VIGENTE más reciente. Si no hay vigente,
    devuelve la última vencida (para mostrar 'vencida hace X días').
    No considera las canceladas.
    """
    hoy = datetime.now(BOGOTA_TZ).date()

    vigente = (
        db.query(models.SuscripcionParqueadero)
        .options(joinedload(models.SuscripcionParqueadero.pagos))
        .filter(
            models.SuscripcionParqueadero.empresa_id == empresa_id,
            models.SuscripcionParqueadero.vehiculo_id == vehiculo_id,
            models.SuscripcionParqueadero.estado != "cancelada",
            models.SuscripcionParqueadero.fecha_vencimiento >= hoy,
        )
        .order_by(models.SuscripcionParqueadero.fecha_vencimiento.desc())
        .first()
    )
    if vigente:
        return vigente

    return (
        db.query(models.SuscripcionParqueadero)
        .options(joinedload(models.SuscripcionParqueadero.pagos))
        .filter(
            models.SuscripcionParqueadero.empresa_id == empresa_id,
            models.SuscripcionParqueadero.vehiculo_id == vehiculo_id,
            models.SuscripcionParqueadero.estado != "cancelada",
        )
        .order_by(models.SuscripcionParqueadero.fecha_vencimiento.desc())
        .first()
    )


def list_suscripciones_vehiculo(
    db: Session, empresa_id: int, vehiculo_id: int, limit: int = 50
) -> List[dict]:
    suscripciones = (
        db.query(models.SuscripcionParqueadero)
        .options(
            joinedload(models.SuscripcionParqueadero.vehiculo).joinedload(models.Vehiculo.cliente),
            joinedload(models.SuscripcionParqueadero.pagos),
        )
        .filter(
            models.SuscripcionParqueadero.empresa_id == empresa_id,
            models.SuscripcionParqueadero.vehiculo_id == vehiculo_id,
        )
        .order_by(models.SuscripcionParqueadero.fecha_inicio.desc())
        .limit(limit)
        .all()
    )
    return [_enriquecer_suscripcion(s) for s in suscripciones]


def list_todas_suscripciones(
    db: Session, empresa_id: int, skip: int = 0, limit: int = 100,
    solo_vigentes: bool = False, solo_vencidas: bool = False,
) -> List[dict]:
    hoy = datetime.now(BOGOTA_TZ).date()
    q = (
        db.query(models.SuscripcionParqueadero)
        .options(
            joinedload(models.SuscripcionParqueadero.vehiculo).joinedload(models.Vehiculo.cliente),
            joinedload(models.SuscripcionParqueadero.pagos),
        )
        .filter(
            models.SuscripcionParqueadero.empresa_id == empresa_id,
            models.SuscripcionParqueadero.estado != "cancelada",
        )
    )
    if solo_vigentes:
        q = q.filter(models.SuscripcionParqueadero.fecha_vencimiento >= hoy)
    elif solo_vencidas:
        q = q.filter(models.SuscripcionParqueadero.fecha_vencimiento < hoy)

    suscripciones = q.order_by(
        models.SuscripcionParqueadero.fecha_vencimiento.desc()
    ).offset(skip).limit(limit).all()

    return [_enriquecer_suscripcion(s) for s in suscripciones]


def create_suscripcion(
    db: Session, empresa_id: int, usuario_id: int, payload: schemas.SuscripcionCreate
) -> dict:
    """
    Crea una nueva suscripción. La regla del dueño:
      - Los días vencidos NO se cobran si el cliente NO entró durante ellos.
      - Por eso este endpoint asume "no entró" → arranca desde HOY (o fecha enviada).
      - Para el caso "sí entró durante los vencidos", usar create_suscripcion_retroactiva().
    """
    veh = get_vehiculo(db, empresa_id, payload.vehiculo_id)
    if not veh:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")

    cfg = get_or_create_parq_config(db, empresa_id)

    # Determinar monto: el operario puede usar tarifa global o un monto personalizado (descuento)
    monto_total = payload.monto_personalizado if payload.monto_personalizado is not None \
        else _obtener_tarifa_por_tipo(cfg, payload.tipo.value)

    if monto_total <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"No hay tarifa configurada para el tipo '{payload.tipo.value}'. Configúrala primero."
        )

    fecha_inicio = payload.fecha_inicio or datetime.now(BOGOTA_TZ).date()
    fecha_vence  = _calcular_fecha_vencimiento(fecha_inicio, payload.tipo.value)

    monto_pagado = min(payload.monto_pagado or 0.0, monto_total)

    susc = models.SuscripcionParqueadero(
        empresa_id          = empresa_id,
        vehiculo_id         = payload.vehiculo_id,
        tipo                = payload.tipo.value,
        fecha_inicio        = fecha_inicio,
        fecha_vencimiento   = fecha_vence,
        monto_total         = monto_total,
        monto_pagado        = monto_pagado,
        metodo_pago_inicial = payload.metodo_pago_inicial,
        observaciones       = payload.observaciones,
        es_retroactiva      = payload.es_retroactiva,
        estado              = "vigente",
    )
    _actualizar_estado_pago(susc)
    db.add(susc)
    db.flush()

    # Si pagó algo de entrada, registrar el primer pago
    if monto_pagado > 0:
        primer_pago = models.PagoParqueadero(
            empresa_id     = empresa_id,
            suscripcion_id = susc.id,
            monto          = monto_pagado,
            metodo_pago    = payload.metodo_pago_inicial or "Efectivo",
            usuario_id     = usuario_id,
            observaciones  = "Pago al crear la suscripción",
        )
        db.add(primer_pago)

    db.commit()
    db.refresh(susc)

    # Cargar relaciones para el response
    susc = (
        db.query(models.SuscripcionParqueadero)
        .options(
            joinedload(models.SuscripcionParqueadero.vehiculo).joinedload(models.Vehiculo.cliente),
            joinedload(models.SuscripcionParqueadero.pagos),
        )
        .filter(models.SuscripcionParqueadero.id == susc.id)
        .first()
    )
    return _enriquecer_suscripcion(susc)


def create_suscripcion_retroactiva(
    db: Session, empresa_id: int, usuario_id: int, payload: schemas.SuscripcionRetroactivaCreate
) -> dict:
    """
    Caso especial: el cliente SÍ entró durante los días vencidos. Acumula deuda + opcional renovación.

    Lógica:
      1. Crea suscripción retroactiva por los días vencidos (tipo y monto según escoja)
      2. Opcionalmente, crea una nueva suscripción desde HOY
      3. Distribuye el monto_pagado_total entre ambas (primero la retroactiva)
    """
    veh = get_vehiculo(db, empresa_id, payload.vehiculo_id)
    if not veh:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")

    cfg = get_or_create_parq_config(db, empresa_id)
    hoy = datetime.now(BOGOTA_TZ).date()

    # ── 1. Suscripción retroactiva ────────────────────────────────────────────
    fecha_inicio_retro = hoy - timedelta(days=payload.dias_vencidos_a_cobrar)

    if payload.tipo_retroactivo.value == "diaria":
        # Cobrar X días sueltos a tarifa diaria
        monto_retro = (cfg.tarifa_diaria or 0) * payload.dias_vencidos_a_cobrar
        # El "vencimiento" técnico de esta retroactiva es ayer (ya pasó)
        fecha_vence_retro = hoy - timedelta(days=1)
    else:
        # Mensualidad/quincenal retroactiva: una sola tarifa que cubre desde el primer día vencido
        monto_retro = _obtener_tarifa_por_tipo(cfg, payload.tipo_retroactivo.value)
        fecha_vence_retro = _calcular_fecha_vencimiento(fecha_inicio_retro, payload.tipo_retroactivo.value)

    if monto_retro <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"Tarifa no configurada para el tipo retroactivo '{payload.tipo_retroactivo.value}'."
        )

    susc_retro = models.SuscripcionParqueadero(
        empresa_id          = empresa_id,
        vehiculo_id         = payload.vehiculo_id,
        tipo                = payload.tipo_retroactivo.value,
        fecha_inicio        = fecha_inicio_retro,
        fecha_vencimiento   = fecha_vence_retro,
        monto_total         = monto_retro,
        monto_pagado        = 0.0,
        metodo_pago_inicial = payload.metodo_pago,
        observaciones       = (
            f"Retroactiva: {payload.dias_vencidos_a_cobrar} días vencidos. "
            + (payload.observaciones or "")
        ).strip(),
        es_retroactiva      = True,
        estado              = "vencida" if fecha_vence_retro < hoy else "vigente",
    )
    db.add(susc_retro)
    db.flush()

    # ── 2. Nueva suscripción desde HOY (opcional) ──────────────────────────────
    susc_nueva = None
    monto_nueva = 0.0
    if payload.crear_nueva_desde_hoy and payload.tipo_nueva_suscripcion:
        monto_nueva = _obtener_tarifa_por_tipo(cfg, payload.tipo_nueva_suscripcion.value)
        if monto_nueva <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Tarifa no configurada para '{payload.tipo_nueva_suscripcion.value}'."
            )
        fecha_vence_nueva = _calcular_fecha_vencimiento(hoy, payload.tipo_nueva_suscripcion.value)

        susc_nueva = models.SuscripcionParqueadero(
            empresa_id          = empresa_id,
            vehiculo_id         = payload.vehiculo_id,
            tipo                = payload.tipo_nueva_suscripcion.value,
            fecha_inicio        = hoy,
            fecha_vencimiento   = fecha_vence_nueva,
            monto_total         = monto_nueva,
            monto_pagado        = 0.0,
            metodo_pago_inicial = payload.metodo_pago,
            observaciones       = "Renovación tras pagar deuda atrasada.",
            es_retroactiva      = False,
            estado              = "vigente",
        )
        db.add(susc_nueva)
        db.flush()

    # ── 3. Distribuir el pago: primero retro, luego nueva ──────────────────────
    monto_disponible = payload.monto_pagado_total
    metodo = payload.metodo_pago or "Efectivo"

    if monto_disponible > 0 and susc_retro:
        a_aplicar = min(monto_disponible, susc_retro.monto_total)
        susc_retro.monto_pagado = a_aplicar
        _actualizar_estado_pago(susc_retro)
        db.add(models.PagoParqueadero(
            empresa_id     = empresa_id,
            suscripcion_id = susc_retro.id,
            monto          = a_aplicar,
            metodo_pago    = metodo,
            usuario_id     = usuario_id,
            observaciones  = "Pago de deuda retroactiva",
        ))
        monto_disponible -= a_aplicar

    if monto_disponible > 0 and susc_nueva:
        a_aplicar = min(monto_disponible, susc_nueva.monto_total)
        susc_nueva.monto_pagado = a_aplicar
        _actualizar_estado_pago(susc_nueva)
        db.add(models.PagoParqueadero(
            empresa_id     = empresa_id,
            suscripcion_id = susc_nueva.id,
            monto          = a_aplicar,
            metodo_pago    = metodo,
            usuario_id     = usuario_id,
            observaciones  = "Pago de nueva suscripción",
        ))

    db.commit()
    db.refresh(susc_retro)
    if susc_nueva:
        db.refresh(susc_nueva)

    return {
        "msg": "Suscripción retroactiva procesada correctamente.",
        "suscripcion_retroactiva": _enriquecer_suscripcion(susc_retro),
        "suscripcion_nueva":       _enriquecer_suscripcion(susc_nueva) if susc_nueva else None,
        "total_facturado":         (susc_retro.monto_total + monto_nueva),
        "total_pagado":            payload.monto_pagado_total,
        "saldo_total":             max(0, (susc_retro.monto_total + monto_nueva) - payload.monto_pagado_total),
    }


def cancelar_suscripcion(
    db: Session, empresa_id: int, suscripcion_id: int, motivo: Optional[str] = None
) -> bool:
    susc = db.query(models.SuscripcionParqueadero).filter(
        models.SuscripcionParqueadero.id == suscripcion_id,
        models.SuscripcionParqueadero.empresa_id == empresa_id,
    ).first()
    if not susc:
        return False
    susc.estado = "cancelada"
    if motivo:
        susc.observaciones = (susc.observaciones or "") + f" | Cancelada: {motivo}"
    db.commit()
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# 4. PAGOS / ABONOS
# ═══════════════════════════════════════════════════════════════════════════════

def registrar_pago_suscripcion(
    db: Session, empresa_id: int, usuario_id: int, payload: schemas.PagoParqueaderoCreate
) -> dict:
    """Registra un abono sobre una suscripción existente y recalcula su estado_pago."""
    susc = db.query(models.SuscripcionParqueadero).filter(
        models.SuscripcionParqueadero.id == payload.suscripcion_id,
        models.SuscripcionParqueadero.empresa_id == empresa_id,
    ).first()
    if not susc:
        raise HTTPException(status_code=404, detail="Suscripción no encontrada.")

    saldo = (susc.monto_total or 0) - (susc.monto_pagado or 0)
    if payload.monto > saldo + 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"El abono ({payload.monto}) excede el saldo pendiente ({saldo:.0f})."
        )

    pago = models.PagoParqueadero(
        empresa_id     = empresa_id,
        suscripcion_id = susc.id,
        monto          = payload.monto,
        metodo_pago    = payload.metodo_pago,
        usuario_id     = usuario_id,
        observaciones  = payload.observaciones,
    )
    db.add(pago)

    susc.monto_pagado = (susc.monto_pagado or 0) + payload.monto
    _actualizar_estado_pago(susc)

    db.commit()
    db.refresh(susc)

    susc = (
        db.query(models.SuscripcionParqueadero)
        .options(
            joinedload(models.SuscripcionParqueadero.vehiculo).joinedload(models.Vehiculo.cliente),
            joinedload(models.SuscripcionParqueadero.pagos),
        )
        .filter(models.SuscripcionParqueadero.id == susc.id)
        .first()
    )
    return _enriquecer_suscripcion(susc)


# ═══════════════════════════════════════════════════════════════════════════════
# 5. ACCESOS POR HORAS (clientes ocasionales)
# ═══════════════════════════════════════════════════════════════════════════════


# ───────────────────────────────────────────────────────────────────────────────
# 2️⃣  HELPER NUEVO — generar comprobante de entrada por WhatsApp
# ───────────────────────────────────────────────────────────────────────────────

def _generar_comprobante_entrada_wa(
    db: Session, empresa_id: int, usuario_id: int,
    acceso: models.AccesoParqueadero, telefono_valido: str,
) -> dict:
    """
    Construye el mensaje de comprobante de entrada y la URL wa.me/
    Registra el envío en el historial.
    """
    cfg = get_or_create_parq_config(db, empresa_id)
    nombre_parq = cfg.nombre_parqueadero or "el parqueadero"

    # Obtener plantilla "comprobante_entrada", auto-crearla si no existe
    plantilla = get_plantilla(db, empresa_id, "comprobante_entrada")

    # Resolver método de pago (modalidad 'libre' es la indicada para ocasionales)
    metodo = get_metodo_por_modalidad(db, empresa_id, "libre")
    advertencia = None
    link_pago = "(Consulta al operario al salir)"
    instrucciones = ""

    if metodo:
        if metodo.link_pago:
            link_pago = metodo.link_pago
        if metodo.instrucciones:
            instrucciones = metodo.instrucciones
    else:
        advertencia = (
            "No tienes configurado un método de pago para 'Pago libre'. "
            "El mensaje se envía sin link."
        )

    # Construir línea de cobro mínimo (si está configurado)
    cobro_minimo_linea = ""
    if cfg.cobro_minimo_minutos and cfg.cobro_minimo_minutos > 0:
        monto_minimo = (cfg.tarifa_minuto or 0) * cfg.cobro_minimo_minutos
        cobro_minimo_linea = (
            f"• Cobro mínimo: {cfg.cobro_minimo_minutos} min "
            f"({_formato_moneda_co(monto_minimo)})\n"
        )

    # Hora de entrada en zona horaria local
    hora_entrada = acceso.fecha_entrada.astimezone(BOGOTA_TZ).strftime("%I:%M %p, %d/%m/%Y")

    # Nombre del cliente
    nombre_cliente = (acceso.nombre_ocasional or "").split()[0].title() \
        if acceso.nombre_ocasional else "cliente"

    try:
        mensaje = plantilla.mensaje.format(
            nombre              = nombre_cliente,
            placa               = acceso.placa,
            parqueadero         = nombre_parq,
            hora_entrada        = hora_entrada,
            tarifa_minuto       = _formato_moneda_co(cfg.tarifa_minuto or 0),
            tarifa_hora         = _formato_moneda_co(cfg.tarifa_hora or 0),
            cobro_minimo_linea  = cobro_minimo_linea,
            link_pago           = link_pago,
            instrucciones       = instrucciones or "",
        )
    except KeyError as e:
        raise ValueError(f"La plantilla 'comprobante_entrada' tiene una variable desconocida: {e}")

    mensaje = re.sub(r'\n{3,}', '\n\n', mensaje).strip()
    texto_url = urllib.parse.quote(mensaje, safe='')
    wa_url = f"https://wa.me/{telefono_valido}?text={texto_url}"

    # Registrar el envío
    db.add(models.EnvioWhatsApp(
        empresa_id      = empresa_id,
        vehiculo_id     = acceso.vehiculo_id,
        suscripcion_id  = None,
        telefono        = telefono_valido,
        tipo            = "comprobante_entrada",
        mensaje_enviado = mensaje,
        usuario_id      = usuario_id,
    ))
    db.commit()

    return {"wa_url": wa_url, "mensaje": mensaje, "advertencia": advertencia}


def registrar_entrada_horas(
    db: Session, empresa_id: int, usuario_id: int, payload: schemas.AccesoEntradaCreate
) -> dict:
    """
    Registra un ingreso por minutos. Permite teléfono + nombre opcional para
    enviar comprobante por WhatsApp inmediatamente.

    Devuelve dict con:
      - acceso: el modelo AccesoParqueadero recién creado
      - wa_url: opcional, link wa.me/ si se pidió enviar_whatsapp y hay teléfono válido
      - mensaje: opcional, preview del mensaje
      - advertencia: opcional, si algo no se pudo (ej. sin método de pago configurado)
    """
    placa_norm = payload.placa.strip().upper().replace(" ", "").replace("-", "")

    # Validar que esa placa NO tenga un acceso abierto
    abierto = db.query(models.AccesoParqueadero).filter(
        models.AccesoParqueadero.empresa_id == empresa_id,
        models.AccesoParqueadero.placa == placa_norm,
        models.AccesoParqueadero.estado == "dentro",
    ).first()
    if abierto:
        raise HTTPException(
            status_code=400,
            detail=f"La placa {placa_norm} ya tiene un acceso abierto desde {abierto.fecha_entrada}."
        )

    # Si la moto ya está registrada en el parqueadero, vincularla
    veh_id = payload.vehiculo_id
    if not veh_id:
        veh = get_vehiculo_por_placa(db, empresa_id, placa_norm)
        veh_id = veh.id if veh else None

    # Normalizar teléfono si lo envían
    telefono_norm = None
    if payload.telefono and payload.telefono.strip():
        telefono_norm = _normalizar_telefono_whatsapp(payload.telefono.strip())
        # Si el teléfono no es válido, lo guardamos crudo igual pero no enviamos WA
        if not telefono_norm and payload.telefono.strip():
            telefono_norm = payload.telefono.strip()  # lo guardamos como lo escribieron

    # Crear acceso
    acceso = models.AccesoParqueadero(
        empresa_id        = empresa_id,
        vehiculo_id       = veh_id,
        placa             = placa_norm,
        nombre_ocasional  = (payload.nombre_ocasional or "").strip() or None,
        telefono          = telefono_norm,
        fecha_entrada     = datetime.now(timezone.utc),
        estado            = "dentro",
        observaciones     = payload.observaciones,
        usuario_id        = usuario_id,
    )
    db.add(acceso)
    db.commit()
    db.refresh(acceso)

    # Construir el response base
    resultado = {
        "acceso":      acceso,
        "wa_url":      None,
        "mensaje":     None,
        "advertencia": None,
    }

    # ── Generar WhatsApp si se pidió y hay teléfono válido ──────────────────
    if payload.enviar_whatsapp:
        # Validar que el teléfono normalizado sea válido para wa.me/
        telefono_valido = _normalizar_telefono_whatsapp(telefono_norm) if telefono_norm else None

        if not telefono_valido:
            resultado["advertencia"] = (
                "No se envió WhatsApp: el teléfono no tiene formato válido."
            )
        else:
            try:
                wa_data = _generar_comprobante_entrada_wa(
                    db, empresa_id, usuario_id, acceso, telefono_valido,
                )
                resultado["wa_url"]      = wa_data["wa_url"]
                resultado["mensaje"]     = wa_data["mensaje"]
                resultado["advertencia"] = wa_data.get("advertencia")
            except Exception as ex:
                resultado["advertencia"] = f"No se pudo generar el WhatsApp: {ex}"

    return resultado
from datetime import timezone, datetime
from fastapi import HTTPException
import schemas, models
# Asegúrate de tener importado tu crud y config según tu archivo

def registrar_salida_horas(
    db: Session, empresa_id: int, payload: schemas.AccesoSalidaCreate
) -> models.AccesoParqueadero:
    """
    Cierra un acceso, calcula MINUTOS y monto. Aplica cobro mínimo configurado.
    El operario puede sobrescribir el monto con `monto_manual` para descuentos.
    """
    acceso = db.query(models.AccesoParqueadero).filter(
        models.AccesoParqueadero.id == payload.acceso_id,
        models.AccesoParqueadero.empresa_id == empresa_id,
    ).first()
    
    if not acceso:
        raise HTTPException(status_code=404, detail="Acceso no encontrado.")
    if acceso.estado == "salio":
        raise HTTPException(status_code=400, detail="Este acceso ya fue cerrado.")

    cfg = get_or_create_parq_config(db, empresa_id) # Asegúrate de que esta función esté disponible
    ahora = datetime.now(timezone.utc)
    
    # --- FIX: Inyección de zona horaria UTC ---
    entrada = acceso.fecha_entrada
    if entrada.tzinfo is None:
        entrada = entrada.replace(tzinfo=timezone.utc)
        
    delta = ahora - entrada
    # ------------------------------------------
    
    minutos_reales = max(1, int(round(delta.total_seconds() / 60)))

    # Aplicar cobro mínimo configurado
    cobro_minimo = cfg.cobro_minimo_minutos or 0
    minutos_cobrar = max(minutos_reales, cobro_minimo) if cobro_minimo > 0 else minutos_reales

    # Calcular monto: tarifa por minuto × minutos cobrados
    tarifa_min = cfg.tarifa_minuto or 0
    monto_calc = round(minutos_cobrar * tarifa_min, 0)
    monto_final = payload.monto_manual if payload.monto_manual is not None else monto_calc

    # Compatibilidad con campo legacy horas_cobradas
    horas_compat = round(minutos_cobrar / 60, 2)

    acceso.fecha_salida    = ahora
    acceso.minutos_cobrados = minutos_cobrar
    acceso.horas_cobradas  = horas_compat
    acceso.monto_cobrado   = monto_final
    acceso.metodo_pago     = payload.metodo_pago
    acceso.estado          = "salio"
    
    if payload.observaciones:
        acceso.observaciones = (acceso.observaciones or "") + " | Salida: " + payload.observaciones

    db.commit()
    db.refresh(acceso)
    
    return acceso

# ═══════════════════════════════════════════════════════════════════════════════
# 6. BUSCAR PLACA (la pantalla estrella)
# ═══════════════════════════════════════════════════════════════════════════════

# def buscar_por_placa(db: Session, empresa_id: int, placa: str) -> dict:
#     """
#     EL endpoint más usado del sistema. En una sola llamada decide qué mostrar al operario.

#     Casos:
#       - vehiculo_al_dia          → 🟢 verde, "ENTRA"
#       - vehiculo_vencido         → 🔴 rojo, ofrecer cobrar
#       - vehiculo_sin_susc        → 🟡 amarillo, registrar nueva suscripción
#       - vehiculo_no_registrado   → 🔵 azul, ofrecer registrar o cobrar por horas
#       - tiene_acceso_abierto     → ⚫ gris, ofrecer registrar salida
#     """
#     placa_norm = placa.strip().upper().replace(" ", "").replace("-", "")
#     hoy = datetime.now(BOGOTA_TZ).date()

#     # 1. ¿Tiene acceso por horas abierto?
#     acceso_abierto = db.query(models.AccesoParqueadero).filter(
#         models.AccesoParqueadero.empresa_id == empresa_id,
#         models.AccesoParqueadero.placa == placa_norm,
#         models.AccesoParqueadero.estado == "dentro",
#     ).first()

#     if acceso_abierto:
#         cfg = get_or_create_parq_config(db, empresa_id)
#         delta = datetime.now(timezone.utc) - acceso_abierto.fecha_entrada
#         horas = round(delta.total_seconds() / 3600, 2)
#         horas_cobrar = max(1.0, horas)
#         monto_estim = round(horas_cobrar * (cfg.tarifa_hora or 0), 0)

#         return {
#             "tipo_resultado":      "tiene_acceso_abierto",
#             "placa":               placa_norm,
#             "acceso_abierto":      acceso_abierto,
#             "horas_transcurridas": horas_cobrar,
#             "monto_estimado":      monto_estim,
#             "mensaje":             f"Esta moto está dentro hace {horas_cobrar:.1f} horas. Cobro estimado: ${monto_estim:,.0f}",
#             "color_semaforo":      "gris",
#         }

#     # 2. ¿El vehículo está registrado?
#     veh = get_vehiculo_por_placa(db, empresa_id, placa_norm)

#     if not veh:
#         return {
#             "tipo_resultado":  "vehiculo_no_registrado",
#             "placa":           placa_norm,
#             "mensaje":         "Placa no registrada. ¿Registrar moto nueva o cobrar por horas?",
#             "color_semaforo":  "azul",
#         }

#     veh_dict = _enriquecer_vehiculo(veh)

#     # 3. ¿Tiene suscripción?
#     susc = get_suscripcion_activa(db, empresa_id, veh.id)

#     if not susc:
#         return {
#             "tipo_resultado":  "vehiculo_sin_susc",
#             "placa":           placa_norm,
#             "vehiculo":        veh_dict,
#             "mensaje":         f"{veh.cliente.nombre} ({placa_norm}) está registrado pero no tiene suscripción activa. Registrar pago.",
#             "color_semaforo":  "amarillo",
#         }

#     susc_dict = _enriquecer_suscripcion(susc)

#     # 4. ¿Está vigente o vencida?
#     if susc.fecha_vencimiento >= hoy:
#         dias_restantes = (susc.fecha_vencimiento - hoy).days
#         return {
#             "tipo_resultado":     "vehiculo_al_dia",
#             "placa":              placa_norm,
#             "vehiculo":           veh_dict,
#             "suscripcion_actual": susc_dict,
#             "fecha_vencimiento":  susc.fecha_vencimiento,
#             "mensaje":            (
#                 f"✅ {veh.cliente.nombre} · Mensualidad vigente · "
#                 f"Vence en {dias_restantes} día{'s' if dias_restantes != 1 else ''} ({susc.fecha_vencimiento.strftime('%d/%m/%Y')}). ENTRA."
#             ),
#             "color_semaforo":     "verde" if dias_restantes > 5 else "amarillo",
#         }
#     else:
#         dias_vencido = (hoy - susc.fecha_vencimiento).days
#         return {
#             "tipo_resultado":     "vehiculo_vencido",
#             "placa":              placa_norm,
#             "vehiculo":           veh_dict,
#             "suscripcion_actual": susc_dict,
#             "dias_vencido":       dias_vencido,
#             "fecha_vencimiento":  susc.fecha_vencimiento,
#             "mensaje":            (
#                 f"⚠️ {veh.cliente.nombre} · Mensualidad VENCIDA hace {dias_vencido} día{'s' if dias_vencido != 1 else ''}. "
#                 f"¿Cómo quiere cobrar?"
#             ),
#             "color_semaforo":     "rojo",
#         }



from datetime import timezone # Asegúrate de tener esta importación al inicio de tu archivo crud.py

def buscar_por_placa(db: Session, empresa_id: int, placa: str) -> dict:
    """
    EL endpoint más usado del sistema. En una sola llamada decide qué mostrar al operario.

    Casos:
      - vehiculo_al_dia          → 🟢 verde, "ENTRA"
      - vehiculo_vencido         → 🔴 rojo, ofrecer cobrar
      - vehiculo_sin_susc        → 🟡 amarillo, registrar nueva suscripción
      - vehiculo_no_registrado   → 🔵 azul, ofrecer registrar o cobrar por horas
      - tiene_acceso_abierto     → ⚫ gris, ofrecer registrar salida
    """
    placa_norm = placa.strip().upper().replace(" ", "").replace("-", "")
    hoy = datetime.now(BOGOTA_TZ).date()

    # 1. ¿Tiene acceso por horas/minutos abierto?
    acceso_abierto = db.query(models.AccesoParqueadero).filter(
        models.AccesoParqueadero.empresa_id == empresa_id,
        models.AccesoParqueadero.placa == placa_norm,
        models.AccesoParqueadero.estado == "dentro",
    ).first()

    if acceso_abierto:
        cfg = get_or_create_parq_config(db, empresa_id)
        
        # --- FIX: Inyección de zona horaria UTC ---
        ahora_utc = datetime.now(timezone.utc)
        entrada = acceso_abierto.fecha_entrada
        
        # Si la fecha viene de SQLite (ingenua), le asignamos explícitamente UTC
        if entrada.tzinfo is None:
            entrada = entrada.replace(tzinfo=timezone.utc)
            
        delta = ahora_utc - entrada
        # ------------------------------------------

        minutos_reales = max(1, int(round(delta.total_seconds() / 60)))

        cobro_minimo = cfg.cobro_minimo_minutos or 0
        minutos_cobrar = max(minutos_reales, cobro_minimo) if cobro_minimo > 0 else minutos_reales

        monto_estim = round(minutos_cobrar * (cfg.tarifa_minuto or 0), 0)
        horas_display = round(minutos_cobrar / 60, 2)

        return {
            "tipo_resultado":      "tiene_acceso_abierto",
            "placa":               placa_norm,
            "acceso_abierto":      acceso_abierto,
            "horas_transcurridas": horas_display,        # se mantiene por compat con frontend
            "monto_estimado":      monto_estim,
            "mensaje":             (
                f"Esta moto está dentro hace {minutos_reales} min "
                f"({horas_display:.1f}h). Cobro: ${monto_estim:,.0f}"
                + (f" (mínimo {cobro_minimo} min)" if minutos_reales < cobro_minimo and cobro_minimo > 0 else "")
            ),
            "color_semaforo":      "gris",
        }
    # 2. ¿El vehículo está registrado?
    veh = get_vehiculo_por_placa(db, empresa_id, placa_norm)

    if not veh:
        return {
            "tipo_resultado":  "vehiculo_no_registrado",
            "placa":           placa_norm,
            "mensaje":         "Placa no registrada. ¿Registrar moto nueva o cobrar por horas?",
            "color_semaforo":  "azul",
        }

    veh_dict = _enriquecer_vehiculo(veh)

    # 3. ¿Tiene suscripción?
    susc = get_suscripcion_activa(db, empresa_id, veh.id)

    if not susc:
        return {
            "tipo_resultado":  "vehiculo_sin_susc",
            "placa":           placa_norm,
            "vehiculo":        veh_dict,
            "mensaje":         f"{veh.cliente.nombre} ({placa_norm}) está registrado pero no tiene suscripción activa. Registrar pago.",
            "color_semaforo":  "amarillo",
        }

    susc_dict = _enriquecer_suscripcion(susc)

    # 4. ¿Está vigente o vencida?
    if susc.fecha_vencimiento >= hoy:
        dias_restantes = (susc.fecha_vencimiento - hoy).days
        return {
            "tipo_resultado":     "vehiculo_al_dia",
            "placa":              placa_norm,
            "vehiculo":           veh_dict,
            "suscripcion_actual": susc_dict,
            "fecha_vencimiento":  susc.fecha_vencimiento,
            "mensaje":            (
                f"✅ {veh.cliente.nombre} · Mensualidad vigente · "
                f"Vence en {dias_restantes} día{'s' if dias_restantes != 1 else ''} ({susc.fecha_vencimiento.strftime('%d/%m/%Y')}). ENTRA."
            ),
            "color_semaforo":     "verde" if dias_restantes > 5 else "amarillo",
        }
    else:
        dias_vencido = (hoy - susc.fecha_vencimiento).days
        return {
            "tipo_resultado":     "vehiculo_vencido",
            "placa":              placa_norm,
            "vehiculo":           veh_dict,
            "suscripcion_actual": susc_dict,
            "dias_vencido":       dias_vencido,
            "fecha_vencimiento":  susc.fecha_vencimiento,
            "mensaje":            (
                f"⚠️ {veh.cliente.nombre} · Mensualidad VENCIDA hace {dias_vencido} día{'s' if dias_vencido != 1 else ''}. "
                f"¿Cómo quiere cobrar?"
            ),
            "color_semaforo":     "rojo",
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 7. DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════

def get_dashboard_parqueadero(db: Session, empresa_id: int) -> dict:
    """
    Resumen completo para la pantalla principal del operario:
    - Cupo
    - Vencimientos
    - Ingresos
    - Listas
    """
    hoy = datetime.now(BOGOTA_TZ).date()
    inicio_hoy_utc, fin_hoy_utc = get_utc_boundaries(hoy)
    inicio_semana = hoy - timedelta(days=hoy.weekday())
    inicio_mes    = hoy.replace(day=1)
    inicio_sem_utc, _ = get_utc_boundaries(inicio_semana)
    inicio_mes_utc, _ = get_utc_boundaries(inicio_mes)

    cfg = get_or_create_parq_config(db, empresa_id)

    # ── Cupo ──────────────────────────────────────────────────────────────────
    mensualidades_activas = db.query(models.SuscripcionParqueadero).filter(
        models.SuscripcionParqueadero.empresa_id == empresa_id,
        models.SuscripcionParqueadero.estado == "vigente",
        models.SuscripcionParqueadero.fecha_vencimiento >= hoy,
    ).count()

    accesos_dentro_count = db.query(models.AccesoParqueadero).filter(
        models.AccesoParqueadero.empresa_id == empresa_id,
        models.AccesoParqueadero.estado == "dentro",
    ).count()

    cupo_ocupado = mensualidades_activas + accesos_dentro_count
    cupo_disp    = max(0, (cfg.cupo_total or 0) - cupo_ocupado)
    pct_ocup     = round((cupo_ocupado / cfg.cupo_total * 100), 1) if (cfg.cupo_total or 0) > 0 else 0.0

    # ── Vencimientos ──────────────────────────────────────────────────────────
    en_5_dias = hoy + timedelta(days=5)

    por_vencer_q = (
        db.query(models.SuscripcionParqueadero)
        .options(joinedload(models.SuscripcionParqueadero.vehiculo).joinedload(models.Vehiculo.cliente))
        .filter(
            models.SuscripcionParqueadero.empresa_id == empresa_id,
            models.SuscripcionParqueadero.estado != "cancelada",
            models.SuscripcionParqueadero.fecha_vencimiento >= hoy,
            models.SuscripcionParqueadero.fecha_vencimiento <= en_5_dias,
        )
        .order_by(models.SuscripcionParqueadero.fecha_vencimiento.asc())
        .all()
    )
    proximos_vencimientos = [
        {
            "suscripcion_id":  s.id,
            "vehiculo_id":     s.vehiculo_id,
            "placa":           s.vehiculo.placa if s.vehiculo else "—",
            "propietario":     s.vehiculo.cliente.nombre if (s.vehiculo and s.vehiculo.cliente) else "—",
            "telefono":        s.vehiculo.cliente.telefono if (s.vehiculo and s.vehiculo.cliente) else None,
            "fecha_vence":     s.fecha_vencimiento,
            "dias_restantes":  (s.fecha_vencimiento - hoy).days,
            "tipo":            s.tipo,
        }
        for s in por_vencer_q
    ]

    vencidas_q = (
        db.query(models.SuscripcionParqueadero)
        .options(joinedload(models.SuscripcionParqueadero.vehiculo).joinedload(models.Vehiculo.cliente))
        .filter(
            models.SuscripcionParqueadero.empresa_id == empresa_id,
            models.SuscripcionParqueadero.estado != "cancelada",
            models.SuscripcionParqueadero.fecha_vencimiento < hoy,
        )
        .order_by(models.SuscripcionParqueadero.fecha_vencimiento.desc())
        .limit(50)
        .all()
    )

    # Filtrar solo las que NO han sido reemplazadas por una nueva vigente
    suscripciones_vencidas = []
    for s in vencidas_q:
        nueva = db.query(models.SuscripcionParqueadero).filter(
            models.SuscripcionParqueadero.empresa_id == empresa_id,
            models.SuscripcionParqueadero.vehiculo_id == s.vehiculo_id,
            models.SuscripcionParqueadero.fecha_vencimiento >= hoy,
            models.SuscripcionParqueadero.estado != "cancelada",
        ).first()
        if not nueva:
            suscripciones_vencidas.append({
                "suscripcion_id": s.id,
                "vehiculo_id":    s.vehiculo_id,
                "placa":          s.vehiculo.placa if s.vehiculo else "—",
                "propietario":    s.vehiculo.cliente.nombre if (s.vehiculo and s.vehiculo.cliente) else "—",
                "telefono":       s.vehiculo.cliente.telefono if (s.vehiculo and s.vehiculo.cliente) else None,
                "fecha_vence":    s.fecha_vencimiento,
                "dias_vencido":   (hoy - s.fecha_vencimiento).days,
                "tipo":           s.tipo,
            })

    # ── Ingresos ──────────────────────────────────────────────────────────────
    def _ingresos_rango(utc_start, utc_end):
        """Suma pagos de suscripciones + accesos por horas en el rango."""
        susc_total = db.query(func.sum(models.PagoParqueadero.monto)).filter(
            models.PagoParqueadero.empresa_id == empresa_id,
            models.PagoParqueadero.fecha >= utc_start,
            models.PagoParqueadero.fecha <= utc_end,
        ).scalar() or 0.0

        acc_total = db.query(func.sum(models.AccesoParqueadero.monto_cobrado)).filter(
            models.AccesoParqueadero.empresa_id == empresa_id,
            models.AccesoParqueadero.estado == "salio",
            models.AccesoParqueadero.fecha_salida >= utc_start,
            models.AccesoParqueadero.fecha_salida <= utc_end,
        ).scalar() or 0.0

        return float(susc_total) + float(acc_total)

    ingresos_hoy    = _ingresos_rango(inicio_hoy_utc, fin_hoy_utc)
    ingresos_semana = _ingresos_rango(inicio_sem_utc, fin_hoy_utc)
    ingresos_mes    = _ingresos_rango(inicio_mes_utc, fin_hoy_utc)

    # ── Accesos dentro (motos por horas) ──────────────────────────────────────
    accesos_dentro = db.query(models.AccesoParqueadero).filter(
        models.AccesoParqueadero.empresa_id == empresa_id,
        models.AccesoParqueadero.estado == "dentro",
    ).order_by(models.AccesoParqueadero.fecha_entrada.asc()).all()

    # ── Total vehículos ───────────────────────────────────────────────────────
    total_veh = db.query(models.Vehiculo).filter(
        models.Vehiculo.empresa_id == empresa_id,
        models.Vehiculo.is_active == True,
    ).count()

    return {
        "cupo_total":               cfg.cupo_total or 0,
        "cupo_ocupado_estimado":    cupo_ocupado,
        "cupo_disponible":          cupo_disp,
        "porcentaje_ocupacion":     pct_ocup,
        "mensualidades_activas":    mensualidades_activas,
        "por_vencer_5_dias":        len(proximos_vencimientos),
        "vencidas":                 len(suscripciones_vencidas),
        "ingresos_hoy":             ingresos_hoy,
        "ingresos_semana":          ingresos_semana,
        "ingresos_mes":             ingresos_mes,
        "proximos_vencimientos":    proximos_vencimientos,
        "suscripciones_vencidas":   suscripciones_vencidas,
        "accesos_dentro":           accesos_dentro,
        "total_vehiculos":          total_veh,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 8. REPORTES
# ═══════════════════════════════════════════════════════════════════════════════

def reporte_ingresos_parqueadero(
    db: Session, empresa_id: int, start_date: date, end_date: date
) -> dict:
    utc_start, _ = get_utc_boundaries(start_date)
    _, utc_end   = get_utc_boundaries(end_date)

    # ── Pagos de suscripciones ────────────────────────────────────────────────
    pagos = (
        db.query(models.PagoParqueadero)
        .options(joinedload(models.PagoParqueadero.suscripcion))
        .filter(
            models.PagoParqueadero.empresa_id == empresa_id,
            models.PagoParqueadero.fecha >= utc_start,
            models.PagoParqueadero.fecha <= utc_end,
        )
        .all()
    )

    # ── Accesos por horas cerrados ────────────────────────────────────────────
    accesos = db.query(models.AccesoParqueadero).filter(
        models.AccesoParqueadero.empresa_id == empresa_id,
        models.AccesoParqueadero.estado == "salio",
        models.AccesoParqueadero.fecha_salida >= utc_start,
        models.AccesoParqueadero.fecha_salida <= utc_end,
    ).all()

    # ── Agregaciones ──────────────────────────────────────────────────────────
    desglose_dia = {}
    desglose_metodo = {}
    desglose_tipo = {"mensual": 0.0, "quincenal": 0.0, "diaria": 0.0, "por_horas": 0.0}
    total_general = 0.0

    def _key_dia(dt) -> str:
        return dt.astimezone(BOGOTA_TZ).date().isoformat()

    for p in pagos:
        k = _key_dia(p.fecha)
        if k not in desglose_dia:
            desglose_dia[k] = {"total_suscripciones": 0.0, "total_horas": 0.0, "cantidad_pagos": 0}
        desglose_dia[k]["total_suscripciones"] += p.monto
        desglose_dia[k]["cantidad_pagos"]      += 1
        total_general += p.monto
        desglose_metodo[p.metodo_pago] = desglose_metodo.get(p.metodo_pago, 0.0) + p.monto
        if p.suscripcion:
            tipo = p.suscripcion.tipo
            if tipo in desglose_tipo:
                desglose_tipo[tipo] += p.monto

    for a in accesos:
        k = _key_dia(a.fecha_salida)
        if k not in desglose_dia:
            desglose_dia[k] = {"total_suscripciones": 0.0, "total_horas": 0.0, "cantidad_pagos": 0}
        desglose_dia[k]["total_horas"]    += (a.monto_cobrado or 0)
        desglose_dia[k]["cantidad_pagos"] += 1
        total_general += (a.monto_cobrado or 0)
        if a.metodo_pago:
            desglose_metodo[a.metodo_pago] = desglose_metodo.get(a.metodo_pago, 0.0) + (a.monto_cobrado or 0)
        desglose_tipo["por_horas"] += (a.monto_cobrado or 0)

    # ── Construir lista ordenada ──────────────────────────────────────────────
    desglose_list = []
    cur = start_date
    while cur <= end_date:
        k = cur.isoformat()
        d = desglose_dia.get(k, {"total_suscripciones": 0.0, "total_horas": 0.0, "cantidad_pagos": 0})
        desglose_list.append({
            "fecha":               cur,
            "total_suscripciones": d["total_suscripciones"],
            "total_horas":         d["total_horas"],
            "total_general":       d["total_suscripciones"] + d["total_horas"],
            "cantidad_pagos":      d["cantidad_pagos"],
        })
        cur += timedelta(days=1)

    return {
        "start_date":          start_date,
        "end_date":            end_date,
        "total_general":       round(total_general, 2),
        "desglose_por_dia":    desglose_list,
        "desglose_por_metodo": {k: round(v, 2) for k, v in desglose_metodo.items()},
        "desglose_por_tipo":   {k: round(v, 2) for k, v in desglose_tipo.items()},
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 9. NOTIFICACIONES AUTOMÁTICAS DE VENCIMIENTO (cron diario)
# ═══════════════════════════════════════════════════════════════════════════════

def notificar_vencimientos_parqueadero(db: Session) -> int:
    """
    Genera notificaciones para admins de empresas con tipo 'parqueadero'
    sobre suscripciones que vencen en ≤5 días o ya vencidas.
    Llamar diariamente desde un cron job.
    """
    hoy = datetime.now(BOGOTA_TZ).date()
    en_5_dias = hoy + timedelta(days=5)
    total_creadas = 0

    empresas = db.query(models.Empresa).filter(models.Empresa.is_active == True).all()

    for empresa in empresas:
        # Solo procesar empresas con módulo de parqueadero habilitado
        modulos = empresa.modulos_habilitados or []
        if "/parqueadero" not in modulos:
            continue

        por_vencer = db.query(models.SuscripcionParqueadero).filter(
            models.SuscripcionParqueadero.empresa_id == empresa.id,
            models.SuscripcionParqueadero.estado != "cancelada",
            models.SuscripcionParqueadero.fecha_vencimiento >= hoy,
            models.SuscripcionParqueadero.fecha_vencimiento <= en_5_dias,
        ).count()

        vencidas = db.query(models.SuscripcionParqueadero).filter(
            models.SuscripcionParqueadero.empresa_id == empresa.id,
            models.SuscripcionParqueadero.estado != "cancelada",
            models.SuscripcionParqueadero.fecha_vencimiento < hoy,
        ).count()

        if por_vencer == 0 and vencidas == 0:
            continue

        admins = db.query(models.User).join(models.Role).filter(
            models.User.empresa_id == empresa.id,
            models.Role.name == "Admin",
            models.User.is_active == True,
        ).all()

        for admin in admins:
            if vencidas > 0:
                db.add(models.Notificacion(
                    usuario_id = admin.id,
                    empresa_id = empresa.id,
                    mensaje    = f"🔴 Tienes {vencidas} mensualidad(es) VENCIDA(S) en el parqueadero.",
                    tipo       = "error",
                    leido      = False,
                ))
                total_creadas += 1
            if por_vencer > 0:
                db.add(models.Notificacion(
                    usuario_id = admin.id,
                    empresa_id = empresa.id,
                    mensaje    = f"🟡 {por_vencer} mensualidad(es) vence(n) en los próximos 5 días.",
                    tipo       = "warning",
                    leido      = False,
                ))
                total_creadas += 1

    db.commit()
    return total_creadas
# ═══════════════════════════════════════════════════════════════════════════════
# CRUD — WHATSAPP + MÉTODOS DE PAGO DEL PARQUEADERO
# Pega al final de crud.py
# ═══════════════════════════════════════════════════════════════════════════════

import re
import urllib.parse
from datetime import datetime, date
from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

import models, schemas
from schemas import PLANTILLAS_DEFAULT


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _normalizar_telefono_whatsapp(telefono: str) -> Optional[str]:
    """
    Convierte un teléfono colombiano a formato E.164 sin '+', listo para wa.me/.
    Ejemplos:
      "300 123 4567"   → "573001234567"
      "+57 300 123..."  → "573001234567"
      "3001234567"      → "573001234567"
      "57 3001234567"   → "573001234567"
    """
    if not telefono:
        return None
    # Quitar todo lo que no sea dígito
    solo_digitos = re.sub(r'\D', '', telefono)
    if not solo_digitos:
        return None

    # Si ya empieza con 57 y tiene 12 dígitos → ya está normalizado
    if solo_digitos.startswith('57') and len(solo_digitos) == 12:
        return solo_digitos
    # Si tiene 10 dígitos y empieza con 3 → es celular colombiano sin prefijo
    if len(solo_digitos) == 10 and solo_digitos.startswith('3'):
        return '57' + solo_digitos
    # Si tiene 11+ dígitos pero no empieza con 57, asumimos que ya tiene prefijo
    if len(solo_digitos) >= 11:
        return solo_digitos
    # Casos raros (fijo, número corto): no es válido para WhatsApp
    return None


def _formato_moneda_co(valor: float) -> str:
    """Formatea un número como '$80.000' al estilo colombiano."""
    if valor is None:
        return "$0"
    try:
        return f"${int(round(valor)):,.0f}".replace(",", ".")
    except (ValueError, TypeError):
        return "$0"


def _formato_fecha_es(fecha) -> str:
    """20 de mayo de 2026"""
    if not fecha:
        return "—"
    if isinstance(fecha, str):
        try:
            fecha = datetime.fromisoformat(fecha).date()
        except ValueError:
            return fecha
    meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
             "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    return f"{fecha.day} de {meses[fecha.month - 1]} de {fecha.year}"


# ═══════════════════════════════════════════════════════════════════════════════
# 1. MÉTODOS DE PAGO
# ═══════════════════════════════════════════════════════════════════════════════

def listar_metodos_pago(db: Session, empresa_id: int) -> List[dict]:
    """Devuelve todos los métodos de pago configurados, con campos calculados."""
    metodos = db.query(models.MetodoPagoParqueadero).filter(
        models.MetodoPagoParqueadero.empresa_id == empresa_id
    ).all()
    return [_enriquecer_metodo(m) for m in metodos]


def _enriquecer_metodo(m: models.MetodoPagoParqueadero) -> dict:
    qr_uri = None
    if m.qr_base64:
        mime = m.qr_mime_type or "image/png"
        qr_uri = f"data:{mime};base64,{m.qr_base64}"

    return {
        "id":            m.id,
        "empresa_id":    m.empresa_id,
        "modalidad":     m.modalidad,
        "nombre_metodo": m.nombre_metodo,
        "link_pago":     m.link_pago,
        "qr_base64":     m.qr_base64,
        "qr_mime_type":  m.qr_mime_type,
        "instrucciones": m.instrucciones,
        "is_active":     m.is_active,
        "created_at":    m.created_at,
        "updated_at":    m.updated_at,
        "tiene_qr":      bool(m.qr_base64),
        "tiene_link":    bool(m.link_pago),
        "qr_data_uri":   qr_uri,
    }


def get_metodo_por_modalidad(
    db: Session, empresa_id: int, modalidad: str
) -> Optional[models.MetodoPagoParqueadero]:
    """Busca el método de pago activo para una modalidad específica."""
    return db.query(models.MetodoPagoParqueadero).filter(
        models.MetodoPagoParqueadero.empresa_id == empresa_id,
        models.MetodoPagoParqueadero.modalidad  == modalidad,
        models.MetodoPagoParqueadero.is_active  == True,
    ).first()


def upsert_metodo_pago(
    db: Session, empresa_id: int, payload: schemas.MetodoPagoCreate
) -> dict:
    """
    Crea o actualiza el método de pago para una modalidad.
    Como hay UNIQUE (empresa_id, modalidad), si ya existe lo actualiza.
    """
    existente = db.query(models.MetodoPagoParqueadero).filter(
        models.MetodoPagoParqueadero.empresa_id == empresa_id,
        models.MetodoPagoParqueadero.modalidad  == payload.modalidad,
    ).first()

    if existente:
        for k, v in payload.dict(exclude_unset=True).items():
            setattr(existente, k, v)
        existente.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existente)
        return _enriquecer_metodo(existente)

    nuevo = models.MetodoPagoParqueadero(
        empresa_id = empresa_id,
        **payload.dict(),
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return _enriquecer_metodo(nuevo)


def delete_metodo_pago(db: Session, empresa_id: int, modalidad: str) -> bool:
    """Elimina (físicamente) el método de pago de una modalidad."""
    metodo = db.query(models.MetodoPagoParqueadero).filter(
        models.MetodoPagoParqueadero.empresa_id == empresa_id,
        models.MetodoPagoParqueadero.modalidad  == modalidad,
    ).first()
    if not metodo:
        return False
    db.delete(metodo)
    db.commit()
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# 2. PLANTILLAS DE WHATSAPP
# ═══════════════════════════════════════════════════════════════════════════════

def get_plantilla(
    db: Session, empresa_id: int, tipo: str
) -> Optional[models.PlantillaWhatsApp]:
    """Devuelve la plantilla para un tipo. Si no existe, la crea con el default."""
    p = db.query(models.PlantillaWhatsApp).filter(
        models.PlantillaWhatsApp.empresa_id == empresa_id,
        models.PlantillaWhatsApp.tipo       == tipo,
    ).first()
    if p:
        return p
    # Auto-crear con default
    default_msg = PLANTILLAS_DEFAULT.get(tipo, PLANTILLAS_DEFAULT["pago"])
    p = models.PlantillaWhatsApp(
        empresa_id = empresa_id,
        tipo       = tipo,
        mensaje    = default_msg,
        is_active  = True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


    # def listar_plantillas(db: Session, empresa_id: int) -> List[models.PlantillaWhatsApp]:
    #     """Lista las 3 plantillas. Si alguna no existe, la crea con el default."""
    #     resultado = []
    #     for tipo in ["pago", "recordatorio", "manual"]:
    #         resultado.append(get_plantilla(db, empresa_id, tipo))
    #     return resultado


def listar_plantillas(db: Session, empresa_id: int) -> List[models.PlantillaWhatsApp]:
    """Lista todas las plantillas disponibles. Si alguna no existe, la crea con el default."""
    resultado = []
    
    # Iterar dinámicamente sobre todas las llaves definidas en PLANTILLAS_DEFAULT
    for tipo in PLANTILLAS_DEFAULT.keys():
        resultado.append(get_plantilla(db, empresa_id, tipo))
        
    return resultado



def update_plantilla(
    db: Session, empresa_id: int, tipo: str, payload: schemas.PlantillaWhatsAppUpdate
) -> models.PlantillaWhatsApp:
    plantilla = get_plantilla(db, empresa_id, tipo)
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(plantilla, k, v)
    plantilla.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(plantilla)
    return plantilla


def restaurar_plantilla_default(
    db: Session, empresa_id: int, tipo: str
) -> models.PlantillaWhatsApp:
    """Vuelve la plantilla al texto por defecto."""
    plantilla = get_plantilla(db, empresa_id, tipo)
    plantilla.mensaje    = PLANTILLAS_DEFAULT.get(tipo, PLANTILLAS_DEFAULT["pago"])
    plantilla.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(plantilla)
    return plantilla


# ═══════════════════════════════════════════════════════════════════════════════
# 3. GENERAR MENSAJE Y LINK wa.me/
# ═══════════════════════════════════════════════════════════════════════════════

def generar_link_whatsapp(
    db: Session, empresa_id: int, usuario_id: int, payload: schemas.GenerarWhatsAppRequest
) -> dict:
    """
    Función estrella: arma el mensaje, lo url-encodea y devuelve la URL wa.me/
    Lista para abrir en una pestaña nueva del frontend.
    """
    advertencia = None

    # ── 1. Resolver vehículo / suscripción / cliente / teléfono ───────────────
    vehiculo = None
    suscripcion = None
    cliente_nombre = None
    placa = None
    telefono_raw = payload.telefono

    if payload.vehiculo_id:
        vehiculo = db.query(models.Vehiculo).options(
            joinedload(models.Vehiculo.cliente)
        ).filter(
            models.Vehiculo.id == payload.vehiculo_id,
            models.Vehiculo.empresa_id == empresa_id,
        ).first()
        if not vehiculo:
            raise HTTPException(404, "Vehículo no encontrado")
        placa = vehiculo.placa
        if vehiculo.cliente:
            cliente_nombre = vehiculo.cliente.nombre
            if not telefono_raw:
                telefono_raw = vehiculo.cliente.telefono

    if payload.suscripcion_id:
        suscripcion = db.query(models.SuscripcionParqueadero).filter(
            models.SuscripcionParqueadero.id == payload.suscripcion_id,
            models.SuscripcionParqueadero.empresa_id == empresa_id,
        ).first()
        if not suscripcion:
            raise HTTPException(404, "Suscripción no encontrada")
        # Si la suscripción tiene vehículo y aún no lo cargamos
        if not vehiculo and suscripcion.vehiculo_id:
            vehiculo = db.query(models.Vehiculo).options(
                joinedload(models.Vehiculo.cliente)
            ).filter(
                models.Vehiculo.id == suscripcion.vehiculo_id,
            ).first()
            if vehiculo:
                placa = vehiculo.placa
                if vehiculo.cliente:
                    cliente_nombre = vehiculo.cliente.nombre
                    if not telefono_raw:
                        telefono_raw = vehiculo.cliente.telefono

    # ── 2. Validar teléfono ──────────────────────────────────────────────────
    telefono_norm = _normalizar_telefono_whatsapp(telefono_raw)
    if not telefono_norm:
        raise HTTPException(
            400,
            "El cliente no tiene un número de WhatsApp válido. "
            "Edítalo en la ficha del propietario."
        )

    # ── 3. Obtener configuración del parqueadero ─────────────────────────────
    cfg = get_or_create_parq_config(db, empresa_id)
    nombre_parq = cfg.nombre_parqueadero or "el parqueadero"
    direccion   = cfg.direccion or ""

    # ── 4. Calcular variables del mensaje según el contexto ──────────────────
    hoy = datetime.now(BOGOTA_TZ).date()

    if suscripcion:
        tipo_plan = suscripcion.tipo
        fecha_venc = _formato_fecha_es(suscripcion.fecha_vencimiento)
        dias_rest = (suscripcion.fecha_vencimiento - hoy).days
        dias_venc = max(0, -dias_rest)
        monto_a_cobrar = (
            payload.monto_override if payload.monto_override is not None
            else (suscripcion.saldo_pendiente if hasattr(suscripcion, 'saldo_pendiente')
                  else max(0, (suscripcion.monto_total or 0) - (suscripcion.monto_pagado or 0))
                  or suscripcion.monto_total or 0)
        )
        saldo_pendiente = max(0, (suscripcion.monto_total or 0) - (suscripcion.monto_pagado or 0))
        modalidad_metodo = suscripcion.tipo  # mensual/quincenal/diaria
    else:
        # Caso: pago libre o sin suscripción (cliente nuevo)
        tipo_plan = "Por definir"
        fecha_venc = "—"
        dias_rest = 0
        dias_venc = 0
        monto_a_cobrar = payload.monto_override or 0
        saldo_pendiente = 0
        modalidad_metodo = "libre"

    # ── 5. Resolver método de pago según la modalidad ────────────────────────
    metodo = get_metodo_por_modalidad(db, empresa_id, modalidad_metodo)
    if not metodo:
        # Fallback: probar con 'libre'
        metodo = get_metodo_por_modalidad(db, empresa_id, "libre")

    link_pago = ""
    instrucciones = ""
    metodo_nombre = None
    qr_data_uri = None

    if metodo:
        metodo_nombre = metodo.nombre_metodo
        if metodo.link_pago:
            link_pago = metodo.link_pago
        if metodo.instrucciones:
            instrucciones = metodo.instrucciones
        if metodo.qr_base64:
            qr_data_uri = f"data:{metodo.qr_mime_type or 'image/png'};base64,{metodo.qr_base64}"

    if not link_pago and not qr_data_uri:
        advertencia = (
            f"No has configurado un método de pago para '{modalidad_metodo}'. "
            "El mensaje se enviará sin link de pago."
        )

    # ── 6. Construir el mensaje desde la plantilla ──────────────────────────
    if payload.mensaje_personalizado:
        mensaje = payload.mensaje_personalizado
    else:
        plantilla = get_plantilla(db, empresa_id, payload.tipo.value)

        # Línea condicional: solo se muestra si hay saldo
        saldo_linea = ""
        if saldo_pendiente > 0 and saldo_pendiente != monto_a_cobrar:
            saldo_linea = f"• Saldo pendiente: *{_formato_moneda_co(saldo_pendiente)}*\n"

        # Si hay QR pero no link, indicarlo en instrucciones
        instrucciones_completas = instrucciones
        if qr_data_uri and not link_pago:
            extra = "📲 Escanea el código QR que te enviamos a continuación para pagar."
            instrucciones_completas = (instrucciones_completas + "\n\n" + extra).strip()

        link_pago_display = link_pago if link_pago else "(El comerciante te enviará el QR)"

        try:
            mensaje = plantilla.mensaje.format(
                nombre          = (cliente_nombre or "estimado cliente").split()[0].title(),
                placa           = placa or "—",
                parqueadero     = nombre_parq,
                tipo_plan       = tipo_plan.title() if tipo_plan else "—",
                fecha_vence     = fecha_venc,
                dias_vencido    = dias_venc,
                dias_restantes  = max(0, dias_rest),
                monto           = _formato_moneda_co(monto_a_cobrar),
                saldo           = _formato_moneda_co(saldo_pendiente),
                saldo_linea     = saldo_linea,
                link_pago       = link_pago_display,
                instrucciones   = instrucciones_completas or "",
                direccion       = direccion,
            )
        except KeyError as e:
            # Variable desconocida en la plantilla → usar default
            raise HTTPException(
                400,
                f"La plantilla tiene una variable desconocida: {e}. "
                "Restaura la plantilla por defecto desde la configuración."
            )

    # Limpiar líneas vacías múltiples
    mensaje = re.sub(r'\n{3,}', '\n\n', mensaje).strip()

    # ── 7. Codificar y construir URL wa.me/ ──────────────────────────────────
    texto_url = urllib.parse.quote(mensaje, safe='')
    wa_url = f"https://wa.me/{telefono_norm}?text={texto_url}"

    # ── 8. Registrar el envío en el historial ────────────────────────────────
    envio = models.EnvioWhatsApp(
        empresa_id      = empresa_id,
        vehiculo_id     = vehiculo.id if vehiculo else None,
        suscripcion_id  = suscripcion.id if suscripcion else None,
        telefono        = telefono_norm,
        tipo            = payload.tipo.value,
        mensaje_enviado = mensaje,
        usuario_id      = usuario_id,
    )
    db.add(envio)
    db.commit()

    return {
        "wa_url":        wa_url,
        "mensaje":       mensaje,
        "telefono":      telefono_norm,
        "tiene_qr":      bool(qr_data_uri),
        "qr_data_uri":   qr_data_uri,
        "metodo_nombre": metodo_nombre,
        "advertencia":   advertencia,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 4. HISTORIAL DE ENVÍOS
# ═══════════════════════════════════════════════════════════════════════════════

def listar_envios_whatsapp(
    db: Session, empresa_id: int, skip: int = 0, limit: int = 100,
    vehiculo_id: Optional[int] = None,
) -> List[dict]:
    q = (
        db.query(models.EnvioWhatsApp)
        .options(
            joinedload(models.EnvioWhatsApp.vehiculo).joinedload(models.Vehiculo.cliente),
            joinedload(models.EnvioWhatsApp.usuario),
        )
        .filter(models.EnvioWhatsApp.empresa_id == empresa_id)
    )
    if vehiculo_id:
        q = q.filter(models.EnvioWhatsApp.vehiculo_id == vehiculo_id)

    envios = q.order_by(models.EnvioWhatsApp.fecha.desc()).offset(skip).limit(limit).all()

    resultado = []
    for e in envios:
        resultado.append({
            "id":              e.id,
            "empresa_id":      e.empresa_id,
            "vehiculo_id":     e.vehiculo_id,
            "suscripcion_id":  e.suscripcion_id,
            "telefono":        e.telefono,
            "tipo":            e.tipo,
            "mensaje_enviado": e.mensaje_enviado,
            "usuario_id":      e.usuario_id,
            "fecha":           e.fecha,
            "placa":           e.vehiculo.placa if e.vehiculo else None,
            "cliente_nombre":  e.vehiculo.cliente.nombre if (e.vehiculo and e.vehiculo.cliente) else None,
            "usuario_username": e.usuario.username if e.usuario else None,
        })
    return resultado




# ═══════════════════════════════════════════════════════════════════════════════
# CRUD — WebAuthn / Biometría
# Pega al final de tu crud.py
# ═══════════════════════════════════════════════════════════════════════════════

import os
import json
import base64
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException

from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json,
)
from webauthn.helpers.cose import COSEAlgorithmIdentifier
from webauthn.helpers.structs import (
    PublicKeyCredentialDescriptor,
    UserVerificationRequirement,
    AuthenticatorSelectionCriteria,
    AuthenticatorAttachment,
    ResidentKeyRequirement,
)

import models
import schemas


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN
# ═══════════════════════════════════════════════════════════════════════════════

# Estos valores se leen de variables de entorno para que funcionen tanto en
# localhost como en producción sin cambiar código.
#
# WEBAUTHN_RP_ID       = "appjeylor.com"  (sin https://, sin path)
# WEBAUTHN_RP_NAME     = "Ksmart360"
# WEBAUTHN_ORIGIN      = "https://appjeylor.com"  (con https://)
#
# Para localhost agregamos múltiples orígenes válidos.

RP_ID = os.getenv("WEBAUTHN_RP_ID", "appjeylor.com")
RP_NAME = os.getenv("WEBAUTHN_RP_NAME", "Ksmart360")
ORIGIN_PROD = os.getenv("WEBAUTHN_ORIGIN", "https://appjeylor.com")

# Lista de orígenes aceptados (para soportar localhost en desarrollo)
ALLOWED_ORIGINS = [
    ORIGIN_PROD,
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
]


# ═══════════════════════════════════════════════════════════════════════════════
# CHALLENGES — Almacén temporal en memoria
# ═══════════════════════════════════════════════════════════════════════════════
# Los challenges WebAuthn duran 5 minutos y son de un solo uso. Para evitar
# añadir Redis, los guardamos en un dict en memoria con expiración manual.
# En producción con múltiples workers conviene usar Redis, pero para arrancar
# esto es suficiente.

_challenges_store: dict = {}   # { user_id_o_session: (challenge_bytes, expira_en) }

def _save_challenge(key: str, challenge: bytes, ttl_seconds: int = 300):
    """Guarda un challenge con expiración."""
    expira = datetime.now(timezone.utc).timestamp() + ttl_seconds
    _challenges_store[key] = (challenge, expira)
    # Limpiar entradas expiradas (housekeeping pasivo)
    ahora = datetime.now(timezone.utc).timestamp()
    expirados = [k for k, (_, exp) in _challenges_store.items() if exp < ahora]
    for k in expirados:
        _challenges_store.pop(k, None)


def _get_challenge(key: str) -> Optional[bytes]:
    """Recupera un challenge si aún es válido."""
    item = _challenges_store.get(key)
    if not item:
        return None
    challenge, expira = item
    if datetime.now(timezone.utc).timestamp() > expira:
        _challenges_store.pop(key, None)
        return None
    return challenge


def _consume_challenge(key: str) -> Optional[bytes]:
    """Recupera y elimina (un solo uso)."""
    challenge = _get_challenge(key)
    _challenges_store.pop(key, None)
    return challenge


# ═══════════════════════════════════════════════════════════════════════════════
# 1. REGISTRO DE CREDENCIAL — Paso 1: generar opciones
# ═══════════════════════════════════════════════════════════════════════════════

def biometric_register_options(
    db: Session, user: models.User
) -> dict:
    """
    Genera las opciones que el navegador usa para crear una credencial nueva.
    Solo se llama desde un usuario YA autenticado (por contraseña).
    """
    # Obtener credenciales existentes para excluirlas (no permitir duplicar)
    existentes = db.query(models.CredencialBiometrica).filter(
        models.CredencialBiometrica.user_id == user.id
    ).all()

    exclude_credentials = []
    for c in existentes:
        try:
            cred_id_bytes = base64.urlsafe_b64decode(c.credential_id + '==')
            exclude_credentials.append(
                PublicKeyCredentialDescriptor(id=cred_id_bytes)
            )
        except Exception:
            continue

    # Generar opciones
    options = generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_id=str(user.id).encode('utf-8'),
        user_name=user.username or user.email or f"user_{user.id}",
        user_display_name=user.nombre_completo or user.username or "Usuario",
        exclude_credentials=exclude_credentials,
        authenticator_selection=AuthenticatorSelectionCriteria(
            # PLATFORM = el sensor del propio dispositivo (huella, faceid, windows hello)
            # CROSS_PLATFORM permitiría llaves USB tipo Yubikey
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
            user_verification=UserVerificationRequirement.PREFERRED,
            resident_key=ResidentKeyRequirement.PREFERRED,
        ),
        # Algoritmos soportados (de más seguro a menos)
        supported_pub_key_algs=[
            COSEAlgorithmIdentifier.ECDSA_SHA_256,
            COSEAlgorithmIdentifier.RSASSA_PKCS1_v1_5_SHA_256,
        ],
    )

    # Guardar el challenge para verificarlo después
    _save_challenge(f"reg:{user.id}", options.challenge)

    # Convertir a JSON para enviar al navegador
    return json.loads(options_to_json(options))


# ═══════════════════════════════════════════════════════════════════════════════
# 2. REGISTRO DE CREDENCIAL — Paso 2: verificar y guardar
# ═══════════════════════════════════════════════════════════════════════════════

def biometric_register_verify(
    db: Session, user: models.User, payload: schemas.BiometricRegisterVerifyRequest,
    user_agent: Optional[str] = None,
) -> dict:
    """
    Verifica la respuesta del navegador y guarda la credencial nueva en BD.
    """
    challenge = _consume_challenge(f"reg:{user.id}")
    if not challenge:
        raise HTTPException(
            status_code=400,
            detail="El registro expiró. Vuelve a intentarlo."
        )

    try:
        verification = verify_registration_response(
            credential=payload.credential,
            expected_challenge=challenge,
            expected_origin=ALLOWED_ORIGINS,
            expected_rp_id=RP_ID,
            require_user_verification=False,  # algunos dispositivos no piden PIN/huella obligatoriamente
        )
    except Exception as ex:
        raise HTTPException(
            status_code=400,
            detail=f"No se pudo verificar la huella: {str(ex)}"
        )

    # Codificar el credential_id como base64url para guardarlo
    cred_id_b64 = base64.urlsafe_b64encode(verification.credential_id).decode('ascii').rstrip('=')

    # Verificar que no exista ya (puede pasar si el usuario hace doble registro rápido)
    existente = db.query(models.CredencialBiometrica).filter(
        models.CredencialBiometrica.credential_id == cred_id_b64
    ).first()
    if existente:
        return {
            "success":       True,
            "credential_id": existente.id,
            "device_name":   existente.device_name,
            "message":       "Esta credencial ya estaba registrada.",
        }

    # Determinar nombre del dispositivo
    device_name = payload.device_name or _detectar_nombre_dispositivo(user_agent)

    # Codificar la public_key
    pub_key_b64 = base64.urlsafe_b64encode(verification.credential_public_key).decode('ascii').rstrip('=')

    # Guardar
    cred = models.CredencialBiometrica(
        user_id        = user.id,
        credential_id  = cred_id_b64,
        public_key     = pub_key_b64,
        sign_count     = verification.sign_count,
        device_name    = device_name,
        user_agent     = (user_agent or '')[:500],
        last_used_at   = datetime.now(timezone.utc),
    )
    db.add(cred)
    db.commit()
    db.refresh(cred)

    return {
        "success":       True,
        "credential_id": cred.id,
        "device_name":   cred.device_name,
        "message":       f"Huella registrada en este dispositivo ({cred.device_name}).",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 3. LOGIN CON BIOMETRÍA — Paso 1: generar opciones
# ═══════════════════════════════════════════════════════════════════════════════

def biometric_login_options(
    db: Session, username: Optional[str] = None
) -> dict:
    """
    Genera opciones para autenticación. Si se pasa username, restringe a las
    credenciales de ese usuario. Si no, permite usar cualquier credencial
    registrada (modo "passkey").
    """
    allow_credentials = []
    user_for_challenge_key = "anon"

    if username:
        user = db.query(models.User).filter(
            (models.User.username == username) | (models.User.email == username)
        ).first()
        if user:
            user_for_challenge_key = str(user.id)
            credentials = db.query(models.CredencialBiometrica).filter(
                models.CredencialBiometrica.user_id == user.id
            ).all()
            for c in credentials:
                try:
                    cred_id_bytes = base64.urlsafe_b64decode(c.credential_id + '==')
                    allow_credentials.append(
                        PublicKeyCredentialDescriptor(id=cred_id_bytes)
                    )
                except Exception:
                    continue

    options = generate_authentication_options(
        rp_id=RP_ID,
        allow_credentials=allow_credentials if allow_credentials else None,
        user_verification=UserVerificationRequirement.PREFERRED,
    )

    # Guardar challenge — usamos un key compartido si no hay user, para el caso
    # passkey-discovery donde el navegador elige el usuario.
    _save_challenge(f"auth:{user_for_challenge_key}", options.challenge)

    return json.loads(options_to_json(options))


# ═══════════════════════════════════════════════════════════════════════════════
# 4. LOGIN CON BIOMETRÍA — Paso 2: verificar firma y devolver JWT
# ═══════════════════════════════════════════════════════════════════════════════

def biometric_login_verify(
    db: Session, payload: schemas.BiometricLoginVerifyRequest,
    create_access_token_func,   # se inyecta desde main.py para no acoplar
) -> dict:
    """
    Verifica la firma del navegador. Si es válida, devuelve el JWT.

    create_access_token_func: función para generar el JWT (se pasa desde main.py
    para no duplicar la lógica de tokens que ya tienes).
    """
    # 1. Extraer el credential_id que envió el navegador
    raw_cred_id = payload.credential.get('rawId') or payload.credential.get('id')
    if not raw_cred_id:
        raise HTTPException(400, "Respuesta de huella inválida.")

    # Normalizar a base64url sin padding
    cred_id_normalizado = raw_cred_id.replace('+', '-').replace('/', '_').rstrip('=')

    # 2. Buscar la credencial en BD
    cred = db.query(models.CredencialBiometrica).filter(
        models.CredencialBiometrica.credential_id == cred_id_normalizado
    ).first()
    if not cred:
        raise HTTPException(401, "Esta huella no está registrada en el sistema.")

    # 3. Recuperar el challenge
    challenge = _consume_challenge(f"auth:{cred.user_id}")
    if not challenge:
        # Probar con el challenge anónimo (caso passkey-discovery)
        challenge = _consume_challenge("auth:anon")
    if not challenge:
        raise HTTPException(400, "La sesión de huella expiró. Intenta de nuevo.")

    # 4. Reconstruir bytes
    public_key_bytes = base64.urlsafe_b64decode(cred.public_key + '==')

    # 5. Verificar la firma
    try:
        verification = verify_authentication_response(
            credential=payload.credential,
            expected_challenge=challenge,
            expected_origin=ALLOWED_ORIGINS,
            expected_rp_id=RP_ID,
            credential_public_key=public_key_bytes,
            credential_current_sign_count=cred.sign_count,
            require_user_verification=False,
        )
    except Exception as ex:
        raise HTTPException(401, f"La huella no coincide: {str(ex)}")

    # 6. Actualizar metadata
    cred.sign_count = verification.new_sign_count
    cred.last_used_at = datetime.now(timezone.utc)
    db.commit()

    # 7. Cargar el usuario y emitir JWT
    user = db.query(models.User).filter(models.User.id == cred.user_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado.")
    if not user.is_active:
        raise HTTPException(403, "Tu cuenta está desactivada.")

    access_token = create_access_token_func(data={"sub": user.username})

    return {
        "access_token": access_token,
        "token_type":   "bearer",
        "user_id":      user.id,
        "username":     user.username,
        "empresa_id":   user.empresa_id,
        "rol":          user.role.name if getattr(user, 'role', None) else None,
        "device_name":  cred.device_name,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 5. GESTIÓN DE CREDENCIALES
# ═══════════════════════════════════════════════════════════════════════════════

def listar_credenciales_usuario(
    db: Session, user_id: int
) -> List[models.CredencialBiometrica]:
    return db.query(models.CredencialBiometrica).filter(
        models.CredencialBiometrica.user_id == user_id
    ).order_by(models.CredencialBiometrica.last_used_at.desc().nullslast()).all()


def eliminar_credencial(db: Session, user_id: int, credencial_id: int) -> bool:
    cred = db.query(models.CredencialBiometrica).filter(
        models.CredencialBiometrica.id == credencial_id,
        models.CredencialBiometrica.user_id == user_id,
    ).first()
    if not cred:
        return False
    db.delete(cred)
    db.commit()
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER: detectar nombre del dispositivo desde User-Agent
# ═══════════════════════════════════════════════════════════════════════════════

def _detectar_nombre_dispositivo(user_agent: Optional[str]) -> str:
    """Genera un nombre amigable basado en el User-Agent."""
    if not user_agent:
        return "Dispositivo desconocido"

    ua = user_agent.lower()

    # Detectar SO
    so = ""
    if "iphone" in ua:
        so = "iPhone"
    elif "ipad" in ua:
        so = "iPad"
    elif "android" in ua:
        # Intentar extraer modelo (ej: "; SM-A525F)")
        import re
        match = re.search(r'\(.*?;\s*([^;]+?)\s+build', ua, re.IGNORECASE) or \
                re.search(r'\(.*?;\s*([^;)]+?)\)', ua)
        if match:
            modelo = match.group(1).strip()
            so = f"Android ({modelo})"
        else:
            so = "Android"
    elif "windows" in ua:
        so = "Windows"
    elif "mac os" in ua or "macintosh" in ua:
        so = "Mac"
    elif "linux" in ua:
        so = "Linux"
    else:
        so = "Dispositivo"

    # Detectar navegador
    nav = ""
    if "edg/" in ua:
        nav = "Edge"
    elif "chrome/" in ua and "chromium" not in ua:
        nav = "Chrome"
    elif "safari/" in ua and "chrome" not in ua:
        nav = "Safari"
    elif "firefox/" in ua:
        nav = "Firefox"

    if nav:
        return f"{so} - {nav}"
    return so

