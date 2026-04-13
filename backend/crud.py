from sqlalchemy.orm import Session, joinedload,selectinload
from sqlalchemy import func
from typing import Optional, List, IO
from datetime import date, timedelta, datetime
from passlib.context import CryptContext
import models, schemas
import pandas as pd
from fastapi import HTTPException






pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

COL_TZ = "America/Bogota"

def _is_postgres(db: Session) -> bool:
    """
    Detecta si la sesión usa PostgreSQL.
    Usa get_bind() en lugar de db.bind (deprecado en SQLAlchemy 2.x).
    """
    try:
        dialect = db.get_bind().dialect.name
        return dialect == "postgresql"
    except Exception:
        # Fallback: leer la URL configurada
        try:
            from database import DATABASE_URL
            return "postgresql" in DATABASE_URL.lower()
        except Exception:
            return False


# ---------- Kardex (Promedio Ponderado) ----------
def get_kardex_promedio_ponderado(
    db: Session,
    producto_id: int,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> schemas.KardexResponse:
    prod = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not prod:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    q = db.query(models.InventoryMovement).filter(models.InventoryMovement.producto_id == producto_id)
    if start_date:
        q = q.filter(models.InventoryMovement.created_at >= start_date)
    if end_date:
        q = q.filter(models.InventoryMovement.created_at <= end_date)

    movimientos = q.order_by(models.InventoryMovement.created_at.asc(), models.InventoryMovement.id.asc()).all()

    saldo_cant = 0.0
    saldo_valor = 0.0
    saldo_costo_unit = 0.0

    items: List[schemas.KardexItem] = []
    for m in movimientos:
        tipo = m.tipo.value if hasattr(m.tipo, "value") else str(m.tipo)
        cant = float(m.cantidad or 0.0)
        costo_u = float(m.costo_unitario or 0.0)

        if tipo == "entrada" or (tipo == "ajuste" and cant > 0):
            # Entrada: aumenta stock y valor al costo de la entrada
            entrada_valor = cant * costo_u
            saldo_valor = saldo_valor + entrada_valor
            saldo_cant = saldo_cant + cant
            saldo_costo_unit = (saldo_valor / saldo_cant) if saldo_cant > 0 else 0.0
        else:
            # Salida: descuenta al costo promedio actual
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

# ---------- Inventario actual ----------
def get_inventario_actual(db: Session) -> schemas.InventarioSnapshot:
    prods = db.query(models.Producto).all()

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

# ---------- Rotación (ventas por periodo) ----------
def _ventas_agrupadas_por_producto(
    db: Session,
    start_date: Optional[date],
    end_date: Optional[date],
    incluir_servicios: bool = False,
):
    # join DetalleVenta -> Venta (para filtrar por fecha) -> Producto
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
    )

    if start_date:
        q = q.filter(models.Venta.fecha >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        q = q.filter(models.Venta.fecha <= datetime.combine(end_date, datetime.max.time()))
    if not incluir_servicios:
        q = q.filter(models.Producto.es_servicio == False)  # noqa: E712

    q = q.group_by(models.Producto.id, models.Producto.nombre, models.Producto.es_servicio)
    return q

def get_rotacion_productos(
    db: Session,
    start_date: Optional[date],
    end_date: Optional[date],
    limit: int = 10,
    incluir_servicios: bool = False,
) -> schemas.ReporteRotacion:
    q = _ventas_agrupadas_por_producto(db, start_date, end_date, incluir_servicios)

    # Top vendidos (por cantidad)
    top_rows = q.order_by(func.coalesce(func.sum(models.DetalleVenta.cantidad), 0).desc()).limit(limit).all()

    # Más lentos: por cantidad ASC (pero >0 para no listar los que no vendieron nada)
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



# --- Funciones de utilidad para contraseñas ---
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

# --- CRUD para Modulos ---
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

# --- CRUD para Roles ---
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

# --- CRUD para Usuarios ---
def get_user(db: Session, user_id: int):
    return db.query(models.User).options(joinedload(models.User.role).joinedload(models.Role.modules)).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).options(joinedload(models.User.role).joinedload(models.Role.modules)).filter(models.User.username == username).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).options(joinedload(models.User.role).joinedload(models.Role.modules)).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(username=user.username, hashed_password=hashed_password, role_id=user.role_id)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: int, user: schemas.UserCreate):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        for key, value in user.dict(exclude_unset=True).items():
            if key == "password":
                setattr(db_user, "hashed_password", get_password_hash(value))
            else:
                setattr(db_user, key, value)
        db.commit()
        db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        db.delete(db_user)
        db.commit()
    return db_user

# --- CRUD para Clientes ---
def get_cliente(db: Session, cliente_id: int):
    return db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()

def get_cliente_deuda(db: Session, cliente_id: int):
    ventas_cliente = db.query(models.Venta).filter(models.Venta.cliente_id == cliente_id).all()
    total_deuda = sum(v.total - v.monto_pagado for v in ventas_cliente)
    return total_deuda

def get_clientes(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Cliente).offset(skip).limit(limit).all()

def create_cliente(db: Session, cliente: schemas.ClienteCreate):
    db_cliente = models.Cliente(**cliente.dict())
    db.add(db_cliente)
    db.commit()
    db.refresh(db_cliente)
    return db_cliente

def update_cliente(db: Session, cliente_id: int, cliente: schemas.ClienteCreate):
    db_cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if db_cliente:
        for key, value in cliente.dict(exclude_unset=True).items():
            setattr(db_cliente, key, value)
        db.commit()
        db.refresh(db_cliente)
    return db_cliente

def delete_cliente(db: Session, cliente_id: int):
    db_cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if db_cliente:
        db.delete(db_cliente)
        db.commit()
    return db_cliente

# --- Historial de Cliente ---
def get_cliente_history(db: Session, cliente_id: int):
    cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if not cliente:
        return None

    ventas = db.query(models.Venta).options(
        joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto), # Carga detalles y sus productos
        joinedload(models.Venta.pagos)
    ).filter(models.Venta.cliente_id == cliente_id).all()

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

# --- CRUD para Productos ---
def get_producto(db: Session, producto_id: int):
    return db.query(models.Producto).filter(models.Producto.id == producto_id).first()

def get_productos(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Producto).offset(skip).limit(limit).all()

def create_producto(db: Session, producto: schemas.ProductoCreate):
    db_producto = models.Producto(**producto.dict())
    db.add(db_producto)
    db.commit()
    db.refresh(db_producto)
    return db_producto

def update_producto(db: Session, producto_id: int, producto: schemas.ProductoCreate):
    db_producto = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if db_producto:
        for key, value in producto.dict(exclude_unset=True).items():
            setattr(db_producto, key, value)
        db.commit()
        db.refresh(db_producto)
    return db_producto

def delete_producto(db: Session, producto_id: int):
    db_producto = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if db_producto:
        db.delete(db_producto)
        db.commit()
    return db_producto

# --- CRUD para Ventas ---

def get_ventas(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.cliente),
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
            joinedload(models.Venta.pagos),
        )
        .order_by(models.Venta.fecha.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# ── TAMBIÉN: get_venta (singular) ─────────────────────────────────────────────

def get_venta(db: Session, venta_id: int):
    return (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.cliente),
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
            joinedload(models.Venta.pagos),
        )
        .filter(models.Venta.id == venta_id)
        .first()
    )


def create_venta(db, venta):
    """
    Versión de referencia de create_venta con metodo_pago incluido.
    AJUSTA según la lógica real de tu crud.py.
    """
    from sqlalchemy.orm import Session
    import models

    # Calcular total
    total_bruto = 0.0
    detalles_objs = []

    for d in venta.detalles:
        prod = db.query(models.Producto).get(d.producto_id)
        precio = d.precio_unitario if d.precio_unitario is not None else (prod.precio if prod else 0)
        subtotal = precio * d.cantidad
        total_bruto += subtotal

        detalle = models.DetalleVenta(
            producto_id     = d.producto_id,
            cantidad        = d.cantidad,
            precio_unitario = precio,
            descuento_pct   = getattr(d, 'descuento_pct', 0.0),
            iva_porcentaje  = getattr(d, 'iva_porcentaje', 0.0),
        )
        detalles_objs.append(detalle)

    # IVA incluido en el precio (no se suma, solo se registra)
    iva_porc  = float(getattr(venta, 'iva_porcentaje', 0) or 0)
    iva_total = total_bruto * iva_porc / (100 + iva_porc) if iva_porc > 0 else 0.0

    db_venta = models.Venta(
        cliente_id      = venta.cliente_id,
        total           = total_bruto,
        iva_total       = iva_total,
        iva_porcentaje  = iva_porc,
        monto_pagado    = total_bruto if venta.pagada else 0,
        estado_pago     = "pagado" if venta.pagada else "pendiente",
        metodo_pago     = venta.metodo_pago if venta.pagada else None,  # ✅ FIX
    )
    db.add(db_venta)
    db.flush()  # obtener db_venta.id

    for det in detalles_objs:
        det.venta_id = db_venta.id
        db.add(det)

    db.commit()
    db.refresh(db_venta)
    return db_venta


def update_venta(db: Session, venta_id: int, venta: schemas.VentaCreate):
    db_venta = db.query(models.Venta).filter(models.Venta.id == venta_id).first()
    if db_venta:
        # Actualizar cliente_id si se proporciona
        if venta.cliente_id is not None:
            db_venta.cliente_id = venta.cliente_id

        # Eliminar detalles de venta existentes
        db.query(models.DetalleVenta).filter(models.DetalleVenta.venta_id == venta_id).delete()
        db.flush() # Asegura que los detalles se eliminen antes de añadir nuevos

        total_venta = 0.0
        new_detalles = []
        for detalle_data in venta.detalles:
            producto = get_producto(db, detalle_data.producto_id)
            if not producto:
                # Esto debería ser manejado por la validación de FastAPI antes de llegar aquí
                # Pero como fallback, puedes lanzar una excepción o manejarlo de otra forma
                raise HTTPException(status_code=404, detail=f"Producto con ID {detalle_data.producto_id} no encontrado.")
            
            # Usar el precio unitario del request si está disponible, si no, usar el de la BD
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
        # Recargar las relaciones después de la actualización
        db.refresh(db_venta, attribute_names=["detalles", "pagos"])
    return db_venta

def delete_venta(db: Session, venta_id: int):
    db_venta = db.query(models.Venta).filter(models.Venta.id == venta_id).first()
    if db_venta:
        db.delete(db_venta)
        db.commit()
    return db_venta


# CRUD para Movimientos de Inventario

def create_movement(db: Session, payload: schemas.InventoryMovementCreate):
    # Ajusta stock
    prod = db.query(models.Producto).get(payload.producto_id)
    if not prod:
        raise ValueError("Producto no encontrado")

    delta = payload.cantidad
    if payload.tipo == schemas.MovementType.salida:
        delta = -abs(payload.cantidad)
    elif payload.tipo == schemas.MovementType.entrada:
        delta = abs(payload.cantidad)
    elif payload.tipo == schemas.MovementType.ajuste:
        # ajuste puede ser pos/neg, aquí lo dejamos literal
        delta = payload.cantidad

    new_stock = (prod.stock_actual or 0) + delta
    if new_stock < 0:
        raise ValueError("Stock insuficiente")

    prod.stock_actual = new_stock

    mov = models.InventoryMovement(
        producto_id=payload.producto_id,
        tipo=payload.tipo.value,
        cantidad=payload.cantidad,
        costo_unitario=payload.costo_unitario,
        motivo=payload.motivo or "",
        referencia=payload.referencia or "",
        observacion=payload.observacion or ""
    )
    db.add(mov)
    db.add(prod)
    db.commit()
    db.refresh(mov)
    return mov

def list_movements(db: Session, producto_id: int = None, limit: int = 100):
    q = db.query(models.InventoryMovement).order_by(models.InventoryMovement.created_at.desc())
    if producto_id:
        q = q.filter(models.InventoryMovement.producto_id == producto_id)
    return q.limit(limit).all()

def get_low_stock(db: Session):
    return db.query(models.Producto)\
        .filter(models.Producto.stock_minimo.isnot(None))\
        .filter(models.Producto.stock_minimo > 0)\
        .filter((models.Producto.stock_actual or 0) < models.Producto.stock_minimo).all()

def update_producto_stock_minimo(db: Session, producto_id: int, minimo: float):
    prod = db.query(models.Producto).get(producto_id)
    if not prod:
        return None
    prod.stock_minimo = minimo
    db.commit()
    db.refresh(prod)
    return prod



# --- CRUD para Pagos ---
def create_pago(db: Session, pago: schemas.PagoCreate):
    db_pago = models.Pago(**pago.dict())
    db.add(db_pago)
    db.commit()
    db.refresh(db_pago)

    # Actualizar el monto pagado y el estado de la venta
    db_venta = db.query(models.Venta).filter(models.Venta.id == pago.venta_id).first()
    if db_venta:
        # Recalcular monto_pagado sumando todos los pagos de la venta
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

def get_pago(db: Session, pago_id: int):
    return db.query(models.Pago).filter(models.Pago.id == pago_id).first()

def update_pago(db: Session, pago_id: int, pago: schemas.PagoUpdate):
    db_pago = db.query(models.Pago).filter(models.Pago.id == pago_id).first()
    if db_pago:
        for key, value in pago.dict(exclude_unset=True).items():
            setattr(db_pago, key, value)
        db.commit()
        db.refresh(db_pago)

        # Recalcular el monto pagado y el estado de la venta asociada
        db_venta = db.query(models.Venta).filter(models.Venta.id == db_pago.venta_id).first()
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

# --- Reportes ---


def get_ventas_summary(db: Session, start_date: Optional[date] = None, end_date: Optional[date] = None):
    query = db.query(models.Venta)

    if start_date:
        query = query.filter(models.Venta.fecha >= start_date)
    if end_date:
        # Para incluir todo el día de end_date, sumamos un día y usamos <
        query = query.filter(models.Venta.fecha < end_date + timedelta(days=1))

    ventas = query.all()

    total_pagado = sum(venta.monto_pagado for venta in ventas)
    total_pendiente = sum(venta.total - venta.monto_pagado for venta in ventas if venta.estado_pago != "pagado")
    total_general = sum(venta.total for venta in ventas)

    return schemas.VentasSummary(
        total_pagado=total_pagado,
        total_pendiente=total_pendiente,
        total_general=total_general,
        total_ventas_hoy=get_total_sales_today(db)
    )

def get_cuentas_por_cobrar_por_cliente(db: Session):
    # Obtener todos los clientes con ventas pendientes o parciales
    clientes_con_pendientes = db.query(models.Cliente).join(models.Venta).filter(
        (models.Venta.estado_pago == "pendiente") | (models.Venta.estado_pago == "parcial")
    ).distinct().all()

    result = []
    for cliente in clientes_con_pendientes:
        ventas_pendientes_cliente = db.query(models.Venta).options(
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto), # Carga detalles y sus productos
            joinedload(models.Venta.pagos)
        ).filter(
            models.Venta.cliente_id == cliente.id,
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

# --- Nuevos Reportes Detallados ---

def get_productos_vendidos(db: Session, start_date: Optional[date] = None, end_date: Optional[date] = None):
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
    )

    if start_date:
        query = query.filter(models.Venta.fecha >= start_date)
    if end_date:
        query = query.filter(models.Venta.fecha < end_date + timedelta(days=1))

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

def get_clientes_compradores(db: Session, start_date: Optional[date] = None, end_date: Optional[date] = None):
    query = (
        db.query(
            models.Cliente.id.label("client_id"),
            models.Cliente.nombre.label("client_name"),
            func.sum(models.Venta.total).label("total_purchase_amount")
        )
        .join(models.Venta, models.Cliente.id == models.Venta.cliente_id)
    )

    if start_date:
        query = query.filter(models.Venta.fecha >= start_date)
    if end_date:
        query = query.filter(models.Venta.fecha < end_date + timedelta(days=1))

    query = (
        query.group_by(models.Cliente.id, models.Cliente.nombre)
             .order_by(func.sum(models.Venta.total).desc())
    )

    return [schemas.ClienteComprador.from_orm(row) for row in query.all()]


def get_clientes_deudores(db: Session):
    query = (
        db.query(
            models.Cliente.id.label("client_id"),
            models.Cliente.nombre.label("client_name"),
            (func.sum(models.Venta.total) - func.sum(models.Venta.monto_pagado)).label("total_debt_amount")
        )
        .join(models.Venta, models.Cliente.id == models.Venta.cliente_id)
        .filter(models.Venta.estado_pago != "pagado")
    )

    query = (
        query.group_by(models.Cliente.id, models.Cliente.nombre)
             .having((func.sum(models.Venta.total) - func.sum(models.Venta.monto_pagado)) > 0)
             .order_by((func.sum(models.Venta.total) - func.sum(models.Venta.monto_pagado)).desc())
    )

    return [schemas.ClienteDeudor.from_orm(row) for row in query.all()]


def get_rentabilidad_por_producto(db: Session, start_date: Optional[date] = None, end_date: Optional[date] = None):
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
    )

    if start_date:
        query = query.filter(models.Venta.fecha >= start_date)
    if end_date:
        query = query.filter(models.Venta.fecha < end_date + timedelta(days=1))

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




    # ── Normalizar clave a "YYYY-MM-DD" sea cual sea el tipo del motor ──
    sales_map: dict = {}
    for r in rows:
        if r.day is None:
            continue
        if isinstance(r.day, str):
            key = r.day[:10]              # SQLite: "2024-01-15" o "2024-01-15 00:00"
        elif hasattr(r.day, "isoformat"):
            key = r.day.isoformat()[:10]  # Postgres datetime.date / datetime
        else:
            key = str(r.day)[:10]
        sales_map[key] = float(r.total or 0)

    # Rellenar días sin ventas con 0 para que la gráfica no tenga huecos
    all_days = [
        start_date + timedelta(days=i)
        for i in range((end_date - start_date).days + 1)
    ]
    return [
        schemas.SalesByDay(day=d, total=sales_map.get(d.isoformat(), 0.0))
        for d in all_days
    ]


def get_dashboard_data(db: Session) -> schemas.DashboardData:
    """
    Gathers all data required for the main dashboard.
    """
    # 1. Ventas Hoy
    ventas_hoy = get_total_sales_today(db)

    # 2. Cuentas por Cobrar
    deudores = get_clientes_deudores(db)
    cuentas_por_cobrar = sum(d.total_debt_amount for d in deudores)

    # 3. Productos Bajo Stock
    productos_bajo_stock = len(get_low_stock(db))

    # 4. Órdenes Recientes
    ordenes_recientes = get_ordenes_trabajo(db, skip=0, limit=5)

    # 5. Ventas últimos 30 días
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=29)
    ventas_ultimos_30_dias = get_sales_by_day(db, start_date, end_date)

    return schemas.DashboardData(
        ventas_hoy=ventas_hoy,
        cuentas_por_cobrar=cuentas_por_cobrar,
        productos_bajo_stock=productos_bajo_stock,
        ordenes_recientes=ordenes_recientes,
        ventas_ultimos_30_dias=ventas_ultimos_30_dias,
    )

# --- CRUD para Órdenes de Trabajo ---

def get_orden_trabajo(db: Session, orden_id: int):
    return db.query(models.OrdenTrabajo).options(
        joinedload(models.OrdenTrabajo.cliente),
        joinedload(models.OrdenTrabajo.operador),
        joinedload(models.OrdenTrabajo.productos).joinedload(models.OrdenProducto.producto),
        joinedload(models.OrdenTrabajo.servicios).joinedload(models.OrdenServicio.servicio),
        joinedload(models.OrdenTrabajo.evidencias)
    ).filter(models.OrdenTrabajo.id == orden_id).first()

def get_ordenes_trabajo(
    db: Session, 
    skip: int = 0, 
    limit: int = 100, 
    operador_id: Optional[int] = None, 
    estado: Optional[str] = None,
    start_date: Optional[date] = None, # New parameter
    end_date: Optional[date] = None,   # New parameter
    cliente_id: Optional[int] = None   # New parameter
):
    query = db.query(models.OrdenTrabajo).options(
        joinedload(models.OrdenTrabajo.cliente),
        joinedload(models.OrdenTrabajo.operador)
    ).order_by(models.OrdenTrabajo.fecha_creacion.desc())

    if operador_id:
        query = query.filter(models.OrdenTrabajo.operador_id == operador_id)
    if estado:
        query = query.filter(models.OrdenTrabajo.estado == estado)
    
    # New date filtering
    # Assuming user_tz_offset is consistent with the frontend/user's actual timezone
    # This offset should ideally come from the frontend or a user setting
    # For now, using the hardcoded one from get_total_sales_today
    user_tz_offset = timedelta(hours=-5) # Example: UTC-5

    if start_date:
        # Convert local start_date to UTC datetime for query
        start_datetime_local = datetime.combine(start_date, datetime.min.time())
        start_datetime_utc = start_datetime_local - user_tz_offset
        query = query.filter(models.OrdenTrabajo.fecha_creacion >= start_datetime_utc)
    if end_date:
        # Convert local end_date to UTC datetime for query
        # To include the entire end_date, we go to the end of that day in local time
        end_datetime_local = datetime.combine(end_date, datetime.max.time())
        end_datetime_utc = end_datetime_local - user_tz_offset
        query = query.filter(models.OrdenTrabajo.fecha_creacion <= end_datetime_utc) # Use <= for end of day
    
    # New client filtering
    if cliente_id:
        query = query.filter(models.OrdenTrabajo.cliente_id == cliente_id)

    return query.offset(skip).limit(limit).all()

def create_orden_trabajo(db: Session, orden: schemas.OrdenTrabajoCreate, operador_id: int):
    db_orden = models.OrdenTrabajo(
        cliente_id=orden.cliente_id,
        operador_id=operador_id,
        total=orden.total,
        estado='En produccion' # Siempre se crea como "En produccion"
    )

    # Añadir productos
    for producto_data in orden.productos:
        db_orden.productos.append(models.OrdenProducto(**producto_data.dict()))

    # Añadir servicios
    for servicio_data in orden.servicios:
        db_orden.servicios.append(models.OrdenServicio(**servicio_data.dict()))

    db.add(db_orden)
    db.commit()
    db.refresh(db_orden)
    return db_orden



def update_orden_trabajo(db, orden_id: int, orden: schemas.OrdenTrabajoCreate):
    db_orden = (
        db.query(models.OrdenTrabajo)
          .options(
              selectinload(models.OrdenTrabajo.productos),
              selectinload(models.OrdenTrabajo.servicios),
          )
          .filter(models.OrdenTrabajo.id == orden_id)
          .first()
    )
    if not db_orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    # Campos simples
    db_orden.cliente_id = orden.cliente_id
    db_orden.total = orden.total
    # si tu esquema trae operador_id opcional:
    if hasattr(orden, "operador_id") and orden.operador_id is not None:
        db_orden.operador_id = orden.operador_id

    # *** CLAVE: reemplazar colecciones completas ***
    # Vacía las relaciones; con delete-orphan se marcarán para borrado automáticamente
    db_orden.productos = []
    db_orden.servicios = []

    # Construye las nuevas líneas SIN reusar instancias antiguas
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

    # Asigna las nuevas listas ya construidas
    db_orden.productos = nuevos_productos
    db_orden.servicios = nuevos_servicios

    # No es necesario db.add(db_orden); ya está en la sesión
    db.commit()
    db.refresh(db_orden)
    return db_orden

def update_orden_trabajo_estado(db: Session, orden_id: int, estado: str, observaciones: Optional[str] = None):
    db_orden = get_orden_trabajo(db, orden_id)
    if db_orden:
        db_orden.estado = estado
        if observaciones:
            db_orden.observaciones_aprobador = observaciones
        db.commit()
        db.refresh(db_orden)
    return db_orden

def add_evidencia_orden_trabajo(db: Session, orden_id: int, file_path: str):
    db_evidencia = models.Evidencia(orden_id=orden_id, file_path=file_path)
    db.add(db_evidencia)
    db.commit()
    db.refresh(db_evidencia)
    return db_evidencia

# --- Lógica de Aprobación y Rechazo ---

def aprobar_orden_trabajo(db: Session, orden_id: int, admin_user: models.User):
    db_orden = get_orden_trabajo(db, orden_id)
    if not db_orden or db_orden.estado != 'En revisión':
        return None # O lanzar una excepción

    # 1. Actualizar estado de la orden
    db_orden.estado = 'Aprobada'
    db_orden.observaciones_aprobador = f"Aprobado por {admin_user.username}"

    # 2. Registrar la orden como una Venta
    detalles_venta = []
    # Incluir productos de la orden en la venta
    for item in db_orden.productos:
        detalles_venta.append(schemas.DetalleVentaCreate(
            producto_id=item.producto_id,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario
        ))
    # Incluir servicios de la orden en la venta
    for item in db_orden.servicios:
        detalles_venta.append(schemas.DetalleVentaCreate(
            producto_id=item.servicio_id,
            cantidad=item.cantidad if item.cantidad is not None else 0.0, # Usar la cantidad del servicio
            precio_unitario=item.precio_servicio
        ))

    venta_schema = schemas.VentaCreate(
        cliente_id=db_orden.cliente_id,
        detalles=detalles_venta,
        pagada=False # Las ventas de órdenes de trabajo inician como no pagadas
    )
    # Create the sale and get the created Venta object
    created_venta = create_venta(db, venta_schema)
    
    # Link the created Venta to the OrdenTrabajo
    db_orden.venta_id = created_venta.id

    # 3. Actualizar inventario (si aplica - Lógica a implementar)
    # Esta parte es un placeholder. La lógica real dependerá de cómo se maneje el inventario.
    for item in db_orden.productos:
        db_producto = get_producto(db, item.producto_id)
        # if db_producto and not db_producto.es_servicio:
        #     db_producto.stock -= item.cantidad # Asumiendo que hay un campo 'stock'

    # 4. Registrar la productividad del operador
    for servicio in db_orden.servicios:
        # Calcular el valor de productividad basado en el precio y cantidad del servicio
        # Asumimos que la productividad se mide por el valor total del servicio realizado
        valor_productividad_calculado = servicio.precio_servicio * servicio.cantidad
        modalidad_pago_defined = "por_servicio" # O definir una lógica más compleja si es necesario

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

def rechazar_orden_trabajo(db: Session, orden_id: int, observaciones: str, admin_user: models.User):
    db_orden = get_orden_trabajo(db, orden_id)
    if not db_orden or db_orden.estado != 'En revisión':
        return None

    # 1. Actualizar estado y añadir observaciones
    db_orden.estado = 'Rechazada'
    db_orden.observaciones_aprobador = f"Rechazado por {admin_user.username}: {observaciones}"

    db.commit()
    db.refresh(db_orden)
    return db_orden

def cerrar_orden_trabajo(db: Session, orden_id: int, admin_user: models.User, close_data: schemas.OrdenTrabajoClose):
    db_orden = get_orden_trabajo(db, orden_id)
    if not db_orden or db_orden.estado not in ['Aprobada', 'Rechazada']:
        return None # O lanzar una excepción si la orden no está en un estado que pueda ser cerrada

    # Ensure the order has an associated sale
    if not db_orden.venta_id:
        # This should ideally not happen if approval process is followed
        return None # Or raise an HTTPException

    db_venta = get_venta(db, db_orden.venta_id)
    if not db_venta:
        return None # Or raise an HTTPException

    # Payment logic
    if close_data.was_paid:
        if close_data.payment_type == "total":
            monto_a_pagar = db_venta.total - db_venta.monto_pagado
            if monto_a_pagar > 0:
                # Create a new payment for the remaining amount
                pago_schema = schemas.PagoCreate(
                    venta_id=db_venta.id,
                    monto=monto_a_pagar,
                    metodo_pago="Cierre de Orden (Pago Total)" # Or a more specific method
                )
                create_pago(db, pago_schema)
            db_venta.estado_pago = "pagado"
            db_venta.monto_pagado = db_venta.total # Ensure it's fully paid
        elif close_data.payment_type == "partial":
            if close_data.paid_amount is None or close_data.paid_amount <= 0:
                # This validation should ideally happen in main.py, but as a fallback
                return None # Or raise an HTTPException
            
            # Ensure paid_amount does not exceed remaining balance
            monto_pendiente = db_venta.total - db_venta.monto_pagado
            if close_data.paid_amount > monto_pendiente:
                # This validation should ideally happen in main.py, but as a fallback
                return None # Or raise an HTTPException

            pago_schema = schemas.PagoCreate(
                venta_id=db_venta.id,
                monto=close_data.paid_amount,
                metodo_pago="Cierre de Orden (Pago Parcial)"
            )
            create_pago(db, pago_schema) # create_pago already updates venta.monto_pagado and estado_pago
            # db_venta.monto_pagado += close_data.paid_amount # create_pago handles this
            # db_venta.estado_pago = "parcial" if db_venta.monto_pagado < db_venta.total else "pagado" # create_pago handles this
        
        # Update payment date for the sale
        db_venta.fecha_pago = datetime.utcnow() # Assuming a fecha_pago field in Venta model (need to add if not present)
    else: # Not paid
        db_venta.estado_pago = "pendiente" # Ensure it's marked as pending if not paid
        # No payment record created, monto_pagado remains as is

    # 1. Actualizar estado de la orden
    db_orden.estado = 'Cerrada'
    db_orden.observaciones_aprobador = f"Cerrada por {admin_user.username}"

    db.commit()
    db.refresh(db_orden)
    db.refresh(db_venta) # Refresh venta to reflect changes
    return db_orden

# --- CRUD para Notificaciones ---

def create_notificacion(db: Session, notificacion: schemas.NotificacionCreate):
    db_notificacion = models.Notificacion(**notificacion.dict())
    db.add(db_notificacion)
    db.commit()
    db.refresh(db_notificacion)
    return db_notificacion

def get_notificaciones_usuario(db: Session, usuario_id: int, skip: int = 0, limit: int = 20):
    return (
        db.query(models.Notificacion)
        .filter(models.Notificacion.usuario_id == usuario_id)
        .order_by(models.Notificacion.fecha_creacion.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def marcar_notificacion_leida(db: Session, notificacion_id: int, usuario_id: int):
    db_notificacion = (
        db.query(models.Notificacion)
        .filter(
            models.Notificacion.id == notificacion_id,
            models.Notificacion.usuario_id == usuario_id
        )
        .first()
    )
    if db_notificacion:
        db_notificacion.leido = True
        db.commit()
        db.refresh(db_notificacion)
    return db_notificacion

# --- CRUD para Reporte de Productividad ---

def get_reporte_productividad(db: Session, start_date: date, end_date: date):
    """
    Reporte por operador:
      - total_ganado (suma de valor_productividad)
      - desglose (por orden: orden_id, servicio_nombre, valor_ganado)
      - desglose_unidades (por servicio: servicio_id, servicio_nombre, total_unidades, total_valor)
    """
    # Incluir todo el día de end_date
    end_date_inclusive = end_date + timedelta(days=1)

    # 1) Traer registros para armar total_ganado y desglose (por orden)
    registros = (
        db.query(models.RegistroProductividad)
        .options(
            joinedload(models.RegistroProductividad.operador),
            joinedload(models.RegistroProductividad.servicio),
        )
        .filter(
            models.RegistroProductividad.fecha >= start_date,
            models.RegistroProductividad.fecha < end_date_inclusive,
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
                desglose_unidades=[],  # 👈 campo nuevo en el schema
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

    # 2) Agregar "Unidades por Servicio" (por operador & servicio)
    #    JOIN RegistroProductividad ↔ OrdenServicio (por orden_id & servicio_id) ↔ Producto (nombre)
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
            models.RegistroProductividad.fecha >= start_date,
            models.RegistroProductividad.fecha < end_date_inclusive,
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

        # Si por algún motivo no se creó en el bloque anterior (no debería pasar), crear stub
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
                total_valor=float(r.total_valor or 0.0),  # 👈 usado por el frontend
            )
        )

    # 3) Construir respuesta
    return schemas.ReporteProductividad(
        start_date=start_date,
        end_date=end_date,
        reporte=list(productividad_por_operador.values()),
    )

def get_total_ordenes_trabajo(
    db: Session,
    operador_id: Optional[int] = None,
    estado: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    cliente_id: Optional[int] = None
) -> float:
    query = db.query(func.sum(models.OrdenTrabajo.total))

    if operador_id:
        query = query.filter(models.OrdenTrabajo.operador_id == operador_id)
    if estado:
        query = query.filter(models.OrdenTrabajo.estado == estado)
    
    if start_date:
        query = query.filter(models.OrdenTrabajo.fecha_creacion >= start_date)
    if end_date:
        query = query.filter(models.OrdenTrabajo.fecha_creacion < end_date + timedelta(days=1))
    
    if cliente_id:
        query = query.filter(models.OrdenTrabajo.cliente_id == cliente_id)
    
    total = query.scalar()
    return total if total is not None else 0.0


# --- CRUD para Panel del Operador ---

def get_ordenes_pendientes_operador(db: Session, operador_id: int) -> List[schemas.PanelOrdenPendiente]:
    """
    Obtiene las órdenes de trabajo pendientes (Aprobada, En ejecución) para un operador específico.
    """
    ordenes_pendientes = db.query(models.OrdenTrabajo).options(
        joinedload(models.OrdenTrabajo.cliente),
        joinedload(models.OrdenTrabajo.productos).joinedload(models.OrdenProducto.producto),
        joinedload(models.OrdenTrabajo.servicios).joinedload(models.OrdenServicio.servicio)
    ).filter(
        models.OrdenTrabajo.operador_id == operador_id,
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
    operador_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> schemas.PanelProductividad:
    """
    Calcula y obtiene las métricas de productividad para un operador específico, por unidades de servicio.
    Permite filtrar por rango de fechas para la gráfica y la tabla de unidades por servicio.
    """
    user_tz_offset = timedelta(hours=-5)  # Colombia Time (UTC-5)
    now_user_tz = datetime.utcnow() + user_tz_offset
    
    today_start_utc = datetime.combine(now_user_tz.date(), datetime.min.time()) - user_tz_offset
    week_start_date = now_user_tz.date() - timedelta(days=now_user_tz.weekday())
    week_start_utc = datetime.combine(week_start_date, datetime.min.time()) - user_tz_offset
    month_start_date = now_user_tz.date().replace(day=1)
    month_start_utc = datetime.combine(month_start_date, datetime.min.time()) - user_tz_offset

    # Helper function for fixed ranges (Hoy, Semana, Mes)
    def get_total_units_for_fixed_range(start_utc: datetime):
        return (db.query(func.sum(models.OrdenServicio.cantidad))
                .select_from(models.OrdenServicio)
                .join(models.RegistroProductividad,
                      (models.OrdenServicio.orden_id == models.RegistroProductividad.orden_id) &
                      (models.OrdenServicio.servicio_id == models.RegistroProductividad.servicio_id))
                .filter(
                    models.RegistroProductividad.operador_id == operador_id,
                    models.RegistroProductividad.fecha >= start_utc
                ).scalar() or 0)

    # 1. Hoy
    servicios_hoy = get_total_units_for_fixed_range(today_start_utc)

    # 2. Semana
    servicios_semana = get_total_units_for_fixed_range(week_start_utc)

    # 3. Mes
    servicios_mes = get_total_units_for_fixed_range(month_start_utc)

    # 4. Órdenes completadas en la semana
    ordenes_completadas_semana = db.query(func.count(models.OrdenTrabajo.id)).filter(
        models.OrdenTrabajo.operador_id == operador_id,
        models.OrdenTrabajo.estado == 'Cerrada',
        models.OrdenTrabajo.fecha_actualizacion >= week_start_utc
    ).scalar() or 0

    # Determine the date range for the graph and the new table
    # If start_date and end_date are provided, use them. Otherwise, default to the current week.
    if start_date and end_date:
        filtered_start_datetime_local = datetime.combine(start_date, datetime.min.time())
        filtered_start_utc = filtered_start_datetime_local - user_tz_offset
        filtered_end_datetime_local = datetime.combine(end_date, datetime.max.time())
        filtered_end_utc = filtered_end_datetime_local - user_tz_offset
    else:
        # Default to current week if no specific filter dates are provided
        filtered_start_utc = week_start_utc
        filtered_end_utc = datetime.combine(now_user_tz.date(), datetime.max.time()) - user_tz_offset # End of current day

    # 5. Gráfica de servicios (ahora con filtro opcional)
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

    # 6. Tabla de unidades por tipo de servicio (con filtro opcional)
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


def get_historial_reciente_operador(db: Session, operador_id: int) -> List[schemas.PanelHistorialItem]:
    """
    Obtiene las últimas 10 órdenes cerradas por un operador en los últimos 7 días.
    """
    user_tz_offset = timedelta(hours=-5)
    now_user_tz = datetime.utcnow() + user_tz_offset
    seven_days_ago_utc = datetime.combine(now_user_tz.date() - timedelta(days=7), datetime.min.time()) - user_tz_offset

    ordenes_recientes = db.query(models.OrdenTrabajo).options(
        joinedload(models.OrdenTrabajo.cliente),
        joinedload(models.OrdenTrabajo.venta_asociada)
    ).filter(
        models.OrdenTrabajo.operador_id == operador_id,
        models.OrdenTrabajo.estado == 'Cerrada',
        models.OrdenTrabajo.fecha_actualizacion >= seven_days_ago_utc
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

def bulk_create_clientes(db: Session, file: IO, filename: str):
    try:
        file_extension = filename.split('.')[-1].lower()
        if file_extension == 'xls':
            df = pd.read_excel(file, engine='xlrd')
        elif file_extension == 'xlsx':
            df = pd.read_excel(file, engine='openpyxl')
        elif file_extension == 'csv':
            df = pd.read_csv(file)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format: {file_extension}. Please upload a .xls, .xlsx, or .csv file."
            )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing file: {e}")

    created_count = 0
    errors = []

    # ✅ Guardar cédulas ya existentes en la BD
    existing_cedulas = {
        str(c.cedula)
        for c in db.query(models.Cliente).all()
        if c.cedula is not None
    }

    # ✅ Guardar cédulas vistas en este archivo
    seen_cedulas = set()

    for index, row in df.iterrows():
        try:
            cedula = str(row.get("cedula")).strip() if pd.notna(row.get("cedula")) else None

            # Validar si no tiene cédula
            if not cedula:
                errors.append(f"Row {index + 2}: Cliente sin cédula, no se puede registrar.")
                continue

            # Validar duplicados en la BD
            if cedula in existing_cedulas:
                errors.append(f"Row {index + 2}: Cliente con cédula {cedula} ya existe en la base de datos.")
                continue

            # Validar duplicados en el mismo archivo
            if cedula in seen_cedulas:
                errors.append(f"Row {index + 2}: Cliente con cédula {cedula} duplicado en el archivo.")
                continue

            # Marcar como visto
            seen_cedulas.add(cedula)

            # ✅ Asignación con valores por defecto y nuevos campos
            cliente_data = schemas.ClienteCreate(
                nombre=row['nombre'],
                cedula=cedula,
                telefono=str(row.get('telefono')) if pd.notna(row.get('telefono')) else None,
                direccion=row.get('direccion'),
                cupo_credito=float(row.get('cupo_credito', 0.0)),
                es_cliente=bool(row.get('es_cliente', True)), # Por defecto cliente
                es_proveedor=bool(row.get('es_proveedor', False))
            )
            create_cliente(db, cliente_data)
            created_count += 1

        except Exception as e:
            errors.append(f"Row {index + 2}: Error creando cliente -> {e}")

    return {
        "success": True,
        "message": f"BCarge masivo finalizado. {created_count} clientes creados."
                   + (f" Errors: {len(errors)} registros con problemas: {errors}" if errors else ""),
        "created_records": created_count,
        "errors": errors
    }

def bulk_create_productos(db: Session, file: IO, filename: str):
    try:
        file_extension = filename.split('.')[-1].lower()
        if file_extension == 'xlsx':
            df = pd.read_excel(file, engine='openpyxl')
        elif file_extension == 'xls':
            df = pd.read_excel(file, engine='xlrd')
        else:
            raise HTTPException(
                status_code=400,
                detail="Formato no soportado. Por favor cargue solo archivos Excel (.xlsx o .xls)."
            )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error procesando archivo: {e}")

    # ✅ Sanitización Global: Rellenar numéricos vacíos con 0
    numeric_cols = ['precio', 'costo', 'stock_minimo', 'grupo_item']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    created_count = 0
    errors = []

    def normalize_name(name: str) -> str:
        return "".join(str(name).lower().split())

    existing_names = {normalize_name(p.nombre) for p in db.query(models.Producto).all()}
    seen_names = set()

    # ✅ Mapeo inteligente de grupos
    def map_group(val):
        v = str(val).upper().strip()
        if 'MP' in v or 'MATERIA' in v or v == '1': return 1
        if 'PT' in v or 'TERMINADO' in v or v == '2': return 2
        if 'AF' in v or 'ACTIVO' in v or v == '3': return 3
        if 'INS' in v or 'INSUMO' in v or v == '4': return 4
        return 2 # Default PT si no se reconoce

    for index, row in df.iterrows():
        try:
            raw_name = str(row.get('nombre', '')).strip()
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

            # ✅ Asignación con mapeo de grupo
            producto_data = schemas.ProductoCreate(
                nombre=raw_name,
                precio=float(row.get('precio', 0.0)),
                costo=float(row.get('costo', 0.0)),
                es_servicio=bool(row.get('es_servicio', 0)),
                unidad_medida=str(row.get('unidad_medida', 'UND')) if pd.notna(row.get('unidad_medida')) else 'UND',
                stock_minimo=float(row.get('stock_minimo', 0.0)),
                grupo_item=map_group(row.get('grupo_item', 'PT'))
            )
            create_producto(db, producto_data)
            created_count += 1
        except Exception as e:
            errors.append(f"Fila {index + 2}: {str(e)}")

    return {
        "success": True,
        "message": f"Carga masiva finalizada. {created_count} productos creados.",
        "created_records": created_count,
        "errors": errors
    }


def bulk_create_movimientos(db: Session, file: IO, filename: str):
    try:
        file_extension = filename.split('.')[-1].lower()
        if file_extension == 'xls':
            df = pd.read_excel(file, engine='xlrd')
        elif file_extension == 'xlsx':
            df = pd.read_excel(file, engine='openpyxl')
        elif file_extension == 'csv':
            try:
                # 1. Intentar UTF-8
                df = pd.read_csv(file, encoding="utf-8")
            except UnicodeDecodeError:
                file.seek(0)
                # 2. Fallback Latin-1 (Excel en Windows)
                df = pd.read_csv(file, encoding="latin-1")
            except Exception:
                file.seek(0)
                # 3. Intentar con separador ;
                df = pd.read_csv(file, sep=";", encoding="latin-1")
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Formato no soportado: {file_extension}. Use .xls, .xlsx o .csv."
            )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error procesando archivo: {e}")

    # ✅ Normalizar encabezados
    df.columns = [str(c).strip().lower().replace("\r", "").replace("\n", "") for c in df.columns]
    print("DEBUG columnas normalizadas:", df.columns.tolist())

    # ✅ Alias de encabezados
    aliases = {
        "producto_id": ["producto_id", "id_producto"],
        "producto_nombre": ["producto_nombre", "producto_non", "nombre_producto"],
        "tipo": ["tipo"],
        "cantidad": ["cantidad", "qty"],
        "costo_unitario": ["costo_unitario", "costo"],
        "motivo": ["motivo"],
        "referencia": ["referencia"],
        "observacion": ["observacion", "observación"],
    }

    # Mapear columnas
    col_map = {}
    for expected, options in aliases.items():
        for opt in options:
            if opt in df.columns:
                col_map[expected] = opt
                break

    # Validar requeridas
    for col in ["tipo", "cantidad"]:
        if col not in col_map:
            raise HTTPException(
                status_code=400,
                detail=f"Falta la columna requerida '{col}'. Columnas detectadas: {df.columns.tolist()}"
            )

    created_count = 0
    errors = []

    # 🔎 Normalización de nombres de producto
    def normalize_name(name: str) -> str:
        return "".join(str(name).lower().split())

    # ✅ Convertir NaN a string vacío
    def safe_str(value):
        return "" if pd.isna(value) else str(value)

    # Mapas de productos
    productos = db.query(models.Producto).all()
    productos_by_id = {p.id: p for p in productos}
    productos_by_name = {normalize_name(p.nombre): p for p in productos}

    # ✅ Iterar filas
    for index, row in df.iterrows():
        try:
            producto_id = None
            prod = None

            # Opción 1: ID
            if "producto_id" in col_map and pd.notna(row.get(col_map["producto_id"])):
                try:
                    producto_id = int(row[col_map["producto_id"]])
                    prod = productos_by_id.get(producto_id)
                except Exception:
                    pass

            # Opción 2: Nombre
            if not prod and "producto_nombre" in col_map and pd.notna(row.get(col_map["producto_nombre"])):
                norm_name = normalize_name(row[col_map["producto_nombre"]])
                prod = productos_by_name.get(norm_name)
                if prod:
                    producto_id = prod.id

            if not prod:
                errors.append(
                    f"Fila {index+2}: Producto no encontrado "
                    f"(id='{row.get(col_map.get('producto_id'), '')}', "
                    f"nombre='{row.get(col_map.get('producto_nombre'), '')}')."
                )
                continue

            # Validar tipo
            tipo = str(row[col_map["tipo"]]).lower().strip()
            if tipo not in ["entrada", "salida", "ajuste"]:
                errors.append(f"Fila {index+2}: Tipo '{tipo}' no es válido (use entrada, salida o ajuste).")
                continue

            # Validar cantidad
            cantidad = float(row[col_map["cantidad"]]) if pd.notna(row[col_map["cantidad"]]) else 0
            if tipo in ["entrada", "salida"] and cantidad <= 0:
                errors.append(f"Fila {index+2}: Cantidad debe ser > 0 para entradas/salidas.")
                continue

            # Validar stock en salidas
            if tipo == "salida" and (prod.stock_actual or 0) < cantidad:
                errors.append(
                    f"Fila {index+2}: Stock insuficiente para salida de {cantidad}. "
                    f"Stock actual={prod.stock_actual}."
                )
                continue

            # Extras
            costo_unitario = (
                float(row.get(col_map["costo_unitario"], 0.0))
                if "costo_unitario" in col_map and pd.notna(row.get(col_map["costo_unitario"]))
                else 0.0
            )
            motivo = safe_str(row.get(col_map.get("motivo")))
            referencia = safe_str(row.get(col_map.get("referencia")))
            observacion = safe_str(row.get(col_map.get("observacion")))

            # ✅ Crear movimiento
            payload = schemas.InventoryMovementCreate(
                producto_id=producto_id,
                tipo=tipo,
                cantidad=cantidad,
                costo_unitario=costo_unitario,
                motivo=motivo,
                referencia=referencia,
                observacion=observacion
            )
            create_movement(db, payload)
            created_count += 1

        except Exception as e:
            errors.append(f"Error en fila {index+2}: {e}")

    return {
        "success": True if created_count > 0 else False,
        "message": f"Cargue masivo finalizado. {created_count} movimientos creados."
                   + (f" {len(errors)} errores encontrados." if errors else ""),
        "created_records": created_count,
        "errors": errors
    }


# =========================
# LÓGICA DE PRODUCCIÓN (VIALMAR)
# =========================

# --- Recetas ---

def get_recetas(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Receta).options(
        joinedload(models.Receta.producto_resultante),
        joinedload(models.Receta.items).joinedload(models.RecetaItem.insumo)
    ).offset(skip).limit(limit).all()

def get_receta(db: Session, receta_id: int):
    return db.query(models.Receta).options(
        joinedload(models.Receta.producto_resultante),
        joinedload(models.Receta.items).joinedload(models.RecetaItem.insumo)
    ).filter(models.Receta.id == receta_id).first()

def get_receta_by_producto(db: Session, producto_id: int):
    return db.query(models.Receta).filter(models.Receta.producto_id == producto_id).first()

def create_receta(db: Session, receta: schemas.RecetaCreate):
    # 1. Validar Insumos Permitidos (Solo MP=1 o INS=4)
    for item in receta.items:
        db_prod = db.query(models.Producto).get(item.insumo_id)
        if not db_prod:
            raise ValueError(f"Insumo con ID {item.insumo_id} no encontrado.")
        if db_prod.grupo_item not in [1, 4]:
            raise ValueError(f"El ítem '{db_prod.nombre}' no puede ser insumo. Solo se permiten Materias Primas o Insumos.")

    db_receta = models.Receta(
        producto_id=receta.producto_id,
        nombre=receta.nombre,
        descripcion=receta.descripcion
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
    
    # 2. Registrar Servicios de Maquila
    for srv in receta.servicios:
        db_srv = models.RecetaServicio(
            receta_id=db_receta.id,
            servicio_id=srv.servicio_id
        )
        db.add(db_srv)
    
    db.commit()
    db.refresh(db_receta)
    return db_receta

def delete_receta(db: Session, receta_id: int):
    db_receta = db.query(models.Receta).filter(models.Receta.id == receta_id).first()
    if db_receta:
        db.delete(db_receta)
        db.commit()
        return True
    return False

# --- Lotes de Producción ---

def get_lotes(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.LoteProduccion).options(
        joinedload(models.LoteProduccion.receta).joinedload(models.Receta.producto_resultante),
        joinedload(models.LoteProduccion.cliente)
    ).order_by(models.LoteProduccion.fecha_planificada.desc()).offset(skip).limit(limit).all()

def get_lote(db: Session, lote_id: int):
    return db.query(models.LoteProduccion).options(
        joinedload(models.LoteProduccion.receta).joinedload(models.Receta.producto_resultante),
        joinedload(models.LoteProduccion.receta).joinedload(models.Receta.items).joinedload(models.RecetaItem.insumo),
        joinedload(models.LoteProduccion.cliente)
    ).filter(models.LoteProduccion.id == lote_id).first()

def create_lote(db: Session, lote: schemas.LoteProduccionCreate):
    cliente_id = lote.cliente_id

    if cliente_id is None:
        interno = get_or_create_cliente_interno(db)
        cliente_id = interno.id

    db_lote = models.LoteProduccion(
        receta_id=lote.receta_id,
        cantidad_a_producir=lote.cantidad_a_producir,
        cliente_id=cliente_id,
        observaciones=lote.observaciones,
        estado="En produccion"
    )
    db.add(db_lote)
    db.commit()
    db.refresh(db_lote)
    return db_lote

def get_or_create_cliente_interno(db: Session) -> models.Cliente:
    # Usa una “cedula” fija para identificarlo
    interno = db.query(models.Cliente).filter(models.Cliente.cedula == "INTERNO").first()
    if interno:
        return interno

    interno = models.Cliente(
        nombre="Vialmar - Producción interna",
        cedula="INTERNO",
        es_cliente=True,
        es_proveedor=False
    )
    db.add(interno)
    db.commit()
    db.refresh(interno)
    return interno


def confirmar_lote_produccion(db: Session, lote_id: int, confirm_data: schemas.LoteProduccionConfirm):
    db_lote = get_lote(db, lote_id)
    if not db_lote or db_lote.estado != "En produccion":
        raise ValueError("El lote no existe o ya ha sido procesado.")

    receta = db_lote.receta
    cantidad_teorica = db_lote.cantidad_a_producir
    cantidad_final = confirm_data.cantidad_real

    costo_total_acumulado = 0.0

    # 1. Validar Stock e Iniciar Consumo (SALIDAS)
    for item in receta.items:
        insumo = item.insumo
        cantidad_requerida = item.cantidad * cantidad_teorica
        if (insumo.stock_actual or 0) < cantidad_requerida:
            raise ValueError(f"Stock insuficiente para: {insumo.nombre}. Req: {cantidad_requerida}, Disp: {insumo.stock_actual}")
        
        # Calcular costo basado en el costo actual del producto (Kardex promedio)
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
        create_movement(db, mov_salida)

    # 2. Calcular Costo Unitario del Resultado (Considerando Mermas)
    costo_unitario_final = (costo_total_acumulado / cantidad_final) if cantidad_final > 0 else 0.0

    # 3. Registrar ENTRADA del Producto Resultante con el NUEVO COSTO
    mov_entrada = schemas.InventoryMovementCreate(
        producto_id=receta.producto_id,
        tipo=schemas.MovementType.entrada,
        cantidad=cantidad_final,
        costo_unitario=costo_unitario_final,
        motivo="Producción - Finalizado",
        referencia=f"Lote #{db_lote.id}",
        observacion=f"Entrada con mermas aplicadas. Costo unitario calculado: {costo_unitario_final:.2f}"
    )
    create_movement(db, mov_entrada)

    # 4. Integración Comercial: Venta por Maquila (Si aplica)
    # if db_lote.cliente_id and db_lote.receta.servicios_maquila:
    #     detalles_venta = []
    #     # Crear un mapa de precios para búsqueda rápida
    #     precios_map = {p.servicio_id: p.precio for p in confirm_data.precios_servicios}

    #     for rs in db_lote.receta.servicios_maquila:
    #         detalles_venta.append(schemas.DetalleVentaCreate(
    #             producto_id=rs.servicio_id,
    #             cantidad=cantidad_final,
    #             precio_unitario=precios_map.get(rs.servicio_id, 0.0)
    #         ))

    #     if detalles_venta:
    #         venta_schema = schemas.VentaCreate(
    #             cliente_id=db_lote.cliente_id,
    #             detalles=detalles_venta,
    #             pagada=False,
    #             iva_porcentaje=0.0 # Por ahora 0, Fase IVA puede ajustar
    #         )
    #         db_venta = create_venta(db, venta_schema)
    #         db_lote.venta_id = db_venta.id

    # 5. Finalizar Lote
    db_lote.estado = "Confirmado"
    db_lote.cantidad_real = cantidad_final
    db_lote.costo_total = costo_total_acumulado
    db_lote.costo_unitario_resultado = costo_unitario_final
    db_lote.fecha_confirmacion = datetime.utcnow()
    if confirm_data.observaciones:
        db_lote.observaciones = (db_lote.observaciones or "") + " | Cierre: " + confirm_data.observaciones

    db.commit()
    db.refresh(db_lote)
    return db_lote

def cancelar_lote(db: Session, lote_id: int):
    db_lote = db.query(models.LoteProduccion).filter(models.LoteProduccion.id == lote_id).first()
    if db_lote and db_lote.estado == "En produccion":
        db_lote.estado = "Cancelado"
        db.commit()
        return True
    return False


# =========================
# MÓDULO DE COMPRAS (VIALMAR)
# =========================

def get_compras(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Compra).options(
        joinedload(models.Compra.proveedor),
        joinedload(models.Compra.detalles).joinedload(models.DetalleCompra.producto),
        joinedload(models.Compra.pagos) # <--- CARGAR PAGOS
    ).order_by(models.Compra.fecha.desc()).offset(skip).limit(limit).all()

def get_compra(db: Session, compra_id: int):
    return db.query(models.Compra).options(
        joinedload(models.Compra.proveedor),
        joinedload(models.Compra.detalles).joinedload(models.DetalleCompra.producto),
        joinedload(models.Compra.pagos) # <--- CARGAR PAGOS
    ).filter(models.Compra.id == compra_id).first()

def create_compra(db: Session, compra: schemas.CompraCreate):
    total_bruto = 0.0
    
    # 1. Calcular Total Bruto (Suma de items)
    for item in compra.detalles:
        total_bruto += item.cantidad * item.precio_unitario

    # 2. Calcular IVA Incluido
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
        estado_pago="pagado" if compra.pagada else "pendiente"
    )
    db.add(db_compra)
    db.flush()

    # 3. Registrar Detalles y Movimientos
    for item in compra.detalles:
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
        create_movement(db, payload_mov)

        db_prod = db.query(models.Producto).get(item.producto_id)
        if db_prod:
            db_prod.costo = item.precio_unitario

    db.commit()
    db.refresh(db_compra)
    return db_compra

def create_pago_compra(db: Session, pago: schemas.PagoCompraCreate):
    db_pago = models.PagoCompra(**pago.dict())
    db.add(db_pago)
    db.flush()

    db_compra = db.query(models.Compra).filter(models.Compra.id == pago.compra_id).first()
    if db_compra:
        # Recalcular monto pagado
        total_pagado = sum(p.monto for p in db_compra.pagos)
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
# ARCHIVO: crud_additions.py
#
# Estas funciones deben AGREGARSE al crud.py existente.
# No reemplaza el archivo completo — solo son los additions.
# ═══════════════════════════════════════════════════════════════════════════════

from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List
import models, schemas


# # ─── Fix 1: Revertir movimientos de inventario al eliminar una venta ──────────
# def revertir_movimientos_venta(db: Session, venta: models.Venta):
#     """
#     Al eliminar una venta, devuelve el stock de cada producto vendido.
#     Registra una ENTRADA de reversa para trazabilidad completa en el kardex.
#     """
#     for det in venta.detalles:
#         prod = db.query(models.Producto).get(det.producto_id)
#         if not prod or prod.es_servicio:
#             continue
#         # Entrada de reversa
#         mov = models.InventoryMovement(
#             producto_id=det.producto_id,
#             tipo="entrada",
#             cantidad=det.cantidad,
#             costo_unitario=prod.costo or 0.0,
#             motivo="reversa_venta",
#             referencia=f"reversa venta #{venta.id}",
#             observacion=f"Venta #{venta.id} eliminada el {datetime.now(timezone.utc).date()}"
#         )
#         db.add(mov)
#         prod.stock_actual = (prod.stock_actual or 0) + det.cantidad
#         db.add(prod)
#     db.commit()


# ─── Fix 2: Notificaciones automáticas de stock bajo ─────────────────────────
# def check_and_notify_low_stock(db: Session, producto_ids: List[int]):
#     """
#     Después de una venta, verifica si algún producto quedó bajo su stock mínimo
#     y crea notificaciones para todos los usuarios Admin.
#     """
#     admin_users = db.query(models.User).join(models.Role).filter(models.Role.name == "Admin").all()
#     if not admin_users:
#         return

#     for prod_id in set(producto_ids):
#         prod = db.query(models.Producto).get(prod_id)
#         if not prod or prod.es_servicio:
#             continue
#         if (prod.stock_minimo or 0) > 0 and (prod.stock_actual or 0) < prod.stock_minimo:
#             for admin in admin_users:
#                 # Evitar notificaciones duplicadas del mismo día
#                 hoy = datetime.now(timezone.utc).date()
#                 ya_notificado = db.query(models.Notificacion).filter(
#                     models.Notificacion.usuario_id == admin.id,
#                     models.Notificacion.mensaje.like(f"%{prod.nombre}%bajo stock%"),
#                     func.date(models.Notificacion.fecha_creacion) == hoy
#                 ).first()
#                 if ya_notificado:
#                     continue

#                 db.add(models.Notificacion(
#                     usuario_id=admin.id,
#                     mensaje=f"⚠️ '{prod.nombre}' está bajo stock mínimo. Actual: {prod.stock_actual:.1f} | Mínimo: {prod.stock_minimo:.1f}",
#                     tipo="warning",
#                     leido=False
#                 ))
#     db.commit()


# ─── Corte de Caja ────────────────────────────────────────────────────────────
# def calcular_totales_dia(db: Session) -> dict:
#     """
#     Calcula el dinero real que entró a caja en el día actual.
#     Hay DOS fuentes de dinero que deben sumarse:

#     1. VENTAS AL CONTADO — ventas con pagada=True registradas hoy.
#        Estas NO crean un registro en la tabla Pago, el dinero va directo
#        a Venta.monto_pagado = Venta.total al momento de crear la venta.
#        Método de pago: se toma de Venta.metodo_pago_contado (si existe)
#        o se clasifica como "Efectivo" por defecto.

#     2. ABONOS A CUENTAS POR COBRAR — registros en la tabla Pago hechos hoy.
#        Aplica a ventas que quedaron pendientes en días anteriores y hoy
#        el cliente abonó o pagó.

#     Usar solo la tabla Pago es incorrecto porque omite las ventas de contado.
#     """
#     tz_col    = timezone(timedelta(hours=-5))
#     ahora_col = datetime.now(tz_col)
#     inicio    = ahora_col.replace(hour=0, minute=0, second=0, microsecond=0)
#     fin       = ahora_col.replace(hour=23, minute=59, second=59)

#     inicio_utc = inicio.astimezone(timezone.utc)
#     fin_utc    = fin.astimezone(timezone.utc)

#     totales = {
#         "efectivo": 0.0,
#         "transferencia": 0.0,
#         "tarjeta": 0.0,
#         "otros": 0.0,
#         "total_dia": 0.0,
#         "ventas_contado": 0.0,    # informativo: cuánto fue de ventas directas
#         "abonos_cartera": 0.0,    # informativo: cuánto fue de abonos
#         "num_ventas": 0,
#         "num_abonos": 0,
#         "fecha": ahora_col.date().isoformat(),
#     }

#     def _clasificar(metodo: str, monto: float):
#         """Acumula el monto en la categoría correcta según el método."""
#         m = (metodo or "").lower().strip()
#         totales["total_dia"] += monto
#         if "efectivo" in m or m == "":
#             totales["efectivo"] += monto
#         elif "transfer" in m or "nequi" in m or "daviplata" in m or "pse" in m:
#             totales["transferencia"] += monto
#         elif "tarjeta" in m or "card" in m or "credito" in m or "debito" in m:
#             totales["tarjeta"] += monto
#         else:
#             totales["otros"] += monto

#     # ── FUENTE 1: Ventas al contado registradas hoy ───────────────────────────
#     # Son ventas con estado_pago = 'pagado' Y fecha en el rango del día.
#     # Excluimos las que tienen pagos en la tabla Pago (serían abonos de hoy
#     # sobre ventas viejas — esas las contamos en FUENTE 2).
#     ventas_contado = (
#         db.query(models.Venta)
#         .filter(
#             models.Venta.fecha >= inicio_utc,
#             models.Venta.fecha <= fin_utc,
#             models.Venta.estado_pago == "pagado",
#         )
#         .all()
#     )

#     for v in ventas_contado:
#         # Solo contar si NO tiene pagos registrados en tabla Pago hoy
#         pagos_registrados = [p for p in v.pagos if inicio_utc <= p.fecha <= fin_utc]
#         if not pagos_registrados:
#             # ✅ Usar el metodo_pago real de la venta si existe, sino "Efectivo"
#             metodo = getattr(v, 'metodo_pago', None) or "Efectivo"
#             _clasificar(metodo, float(v.total or 0))
#             totales["ventas_contado"] += float(v.total or 0)
#             totales["num_ventas"] += 1

#     # ── FUENTE 2: Abonos/pagos registrados hoy en tabla Pago ─────────────────
#     # Cubre dos casos:
#     # a) Ventas de hoy pagadas via abono (raro pero posible)
#     # b) Abonos de hoy a ventas de días anteriores (cuentas por cobrar)
#     abonos_dia = (
#         db.query(models.Pago)
#         .filter(
#             models.Pago.fecha >= inicio_utc,
#             models.Pago.fecha <= fin_utc,
#         )
#         .all()
#     )

#     for p in abonos_dia:
#         _clasificar(p.metodo_pago or "Efectivo", float(p.monto or 0))
#         totales["abonos_cartera"] += float(p.monto or 0)
#         totales["num_abonos"] += 1

#     return totales


# def crear_corte_caja(db: Session, usuario_id: int, efectivo_fisico: float, observaciones: Optional[str] = None) -> models.CorteCaja:
#     """
#     Crea un corte de caja para el día actual:
#       1. Calcula los totales del día por método de pago.
#       2. Compara el efectivo físico con el calculado.
#       3. Registra la diferencia (sobrante/faltante).
#     """
#     totales = calcular_totales_dia(db)

#     diferencia = efectivo_fisico - totales["efectivo"]

#     corte = models.CorteCaja(
#         usuario_id=usuario_id,
#         total_efectivo_ventas=totales["efectivo"],
#         total_transferencia_ventas=totales["transferencia"],
#         total_tarjeta_ventas=totales["tarjeta"],
#         total_otros_ventas=totales["otros"],
#         total_ventas_dia=totales["total_dia"],
#         efectivo_fisico=efectivo_fisico,
#         diferencia=diferencia,
#         observaciones=observaciones,
#         estado="cerrado"
#     )
#     db.add(corte)
#     db.commit()
#     db.refresh(corte)

#     # Notificar si hay diferencia significativa (> $1.000)
#     if abs(diferencia) > 1000:
#         admin_users = db.query(models.User).join(models.Role).filter(models.Role.name == "Admin").all()
#         tipo = "error" if diferencia < 0 else "warning"
#         signo = "FALTANTE" if diferencia < 0 else "SOBRANTE"
#         for admin in admin_users:
#             db.add(models.Notificacion(
#                 usuario_id=admin.id,
#                 mensaje=f"💰 Corte de caja: {signo} de ${abs(diferencia):,.0f} COP detectado.",
#                 tipo=tipo,
#                 leido=False
#             ))
#         db.commit()

#     return corte


# def get_cortes_caja(db: Session, skip: int = 0, limit: int = 30) -> List[models.CorteCaja]:
#     return (
#         db.query(models.CorteCaja)
#         .order_by(models.CorteCaja.fecha.desc())
#         .offset(skip)
#         .limit(limit)
#         .all()
#     )










# def crear_devolucion(db: Session, data: schemas.DevolucionCreate) -> models.Devolucion:
#     """
#     Registra una devolución:
#       1. Valida que la venta exista y que las cantidades no excedan lo vendido.
#       2. Crea el encabezado Devolucion y sus DevolucionItem.
#       3. Repone el stock (movimiento ENTRADA al inventario).
#       4. Ajusta el total y monto_pagado de la venta:
#          - Si la venta estaba PAGADA: descuenta del total (nota crédito).
#          - Si la venta estaba PENDIENTE/PARCIAL: descuenta del saldo pendiente.
#       5. Crea una notificación para el admin.
#     """
#     venta = db.query(models.Venta).options(
#         joinedload(models.Venta.detalles)
#     ).filter(models.Venta.id == data.venta_id).first()

#     if not venta:
#         raise HTTPException(status_code=404, detail="Venta no encontrada")

#     # Calcular total de la devolución y validar cantidades
#     total_dev = 0.0
#     for item in data.items:
#         if item.cantidad <= 0:
#             raise HTTPException(status_code=400, detail=f"La cantidad debe ser mayor a 0.")

#         # Buscar el detalle original para validar que no se devuelva más de lo vendido
#         if item.detalle_id:
#             detalle = next((d for d in venta.detalles if d.id == item.detalle_id), None)
#             if detalle and item.cantidad > detalle.cantidad:
#                 prod = db.query(models.Producto).get(item.producto_id)
#                 nombre = prod.nombre if prod else f"ID {item.producto_id}"
#                 raise HTTPException(
#                     status_code=400,
#                     detail=f"No puede devolver {item.cantidad} de '{nombre}'. Solo se vendieron {detalle.cantidad}."
#                 )
#         total_dev += item.cantidad * item.precio_unit

#     # Crear encabezado de devolución
#     dev = models.Devolucion(
#         venta_id=data.venta_id,
#         motivo=data.motivo,
#         monto_total=total_dev,
#     )
#     db.add(dev)
#     db.flush()  # obtener dev.id sin commit

#     # Crear ítems + reponer stock
#     for item in data.items:
#         db_item = models.DevolucionItem(
#             devolucion_id=dev.id,
#             producto_id=item.producto_id,
#             detalle_id=item.detalle_id,
#             cantidad=item.cantidad,
#             precio_unitario=item.precio_unit,
#         )
#         db.add(db_item)

#         # Reponer inventario: ENTRADA con motivo "devolucion"
#         prod = db.query(models.Producto).get(item.producto_id)
#         if prod and not prod.es_servicio:
#             prod.stock_actual = (prod.stock_actual or 0) + item.cantidad
#             mov = models.InventoryMovement(
#                 producto_id=item.producto_id,
#                 tipo="entrada",
#                 cantidad=item.cantidad,
#                 costo_unitario=prod.costo or 0.0,
#                 motivo="devolucion",
#                 referencia=f"Dev #{dev.id} / Venta #{data.venta_id}",
#                 observacion=f"Devolución: {data.motivo[:80]}"
#             )
#             db.add(mov)
#             db.add(prod)

#     # Ajustar la venta
#     if venta.estado_pago == "pagado":
#         # Venta ya cobrada: reducir el total (nota crédito)
#         venta.total       = max(0, venta.total - total_dev)
#         venta.monto_pagado = max(0, venta.monto_pagado - total_dev)
#     else:
#         # Venta pendiente/parcial: reducir solo el saldo pendiente
#         venta.total = max(0, venta.total - total_dev)

#     # Recalcular estado_pago
#     if venta.total <= 0:
#         venta.estado_pago = "pagado"
#         venta.monto_pagado = 0
#     elif venta.monto_pagado >= venta.total:
#         venta.estado_pago = "pagado"
#     elif venta.monto_pagado > 0:
#         venta.estado_pago = "parcial"
#     else:
#         venta.estado_pago = "pendiente"

#     db.add(venta)

#     # Notificación para admin
#     admin_users = db.query(models.User).join(models.Role).filter(models.Role.name == "Admin").all()
#     for admin in admin_users:
#         db.add(models.Notificacion(
#             usuario_id=admin.id,
#             mensaje=f"↩️ Devolución registrada — Venta #{data.venta_id} · {venta.cliente.nombre if venta.cliente else ''} · Nota crédito: ${total_dev:,.0f}",
#             tipo="warning",
#             leido=False,
#         ))

#     db.commit()
#     db.refresh(dev)
#     return dev


# def get_devoluciones_by_venta(db: Session, venta_id: int):
#     return (
#         db.query(models.Devolucion)
#         .options(joinedload(models.Devolucion.items))
#         .filter(models.Devolucion.venta_id == venta_id)
#         .order_by(models.Devolucion.fecha.desc())
#         .all()
#     )



# ═══════════════════════════════════════════════════════════════════════════════
# FIX: get_sales_by_day + get_total_sales_today
# Compatible con SQLite (local) y PostgreSQL (producción/Supabase)
#
# INSTRUCCIÓN: en crud.py, reemplaza completamente las funciones
#   get_sales_by_day()  y  get_total_sales_today()  con este código.
#   No toques nada más.
# ═══════════════════════════════════════════════════════════════════════════════

from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import date, timedelta, datetime
from typing import List
import models, schemas


# def get_sales_by_day(
#     db: Session,
#     start_date: date,
#     end_date: date
# ) -> List[schemas.SalesByDay]:
#     """
#     Retorna la suma de ventas agrupada por día en el rango indicado.

#     BUG en producción (Postgres):
#       - func.date(campo_TIMESTAMPTZ) en Postgres retorna datetime.date
#         pero en SQLite retorna str "YYYY-MM-DD"
#       - Sin zona horaria, ventas después de las 7pm Colombia (UTC-5)
#         aparecen en el día siguiente porque la BD guarda UTC
#       - El sales_map construido con .isoformat() no encuentra claves
#         cuando los tipos no coinciden → todos los días salen en 0

#     FIX:
#       - Postgres: func.timezone("America/Bogota", campo) convierte
#         correctamente antes de extraer la fecha
#       - Normalizar SIEMPRE la clave del sales_map a str "YYYY-MM-DD"
#         sin asumir el tipo que devuelve cada motor
#     """
#     is_pg = _is_postgres(db)

#     if is_pg:
#         # Convertir TIMESTAMPTZ a hora Colombia, luego extraer fecha
#         day_expr = func.date(
#             func.timezone(COL_TZ, models.Venta.fecha)
#         ).label("day")
#     else:
#         # SQLite no tiene timezone — func.date() funciona directamente
#         day_expr = func.date(models.Venta.fecha).label("day")

#     # Rango de fechas en UTC para el filtro
#     start_dt = datetime.combine(start_date, datetime.min.time())
#     end_dt   = datetime.combine(end_date,   datetime.max.time())

#     rows = (
#         db.query(day_expr, func.sum(models.Venta.total).label("total"))
#         .filter(models.Venta.fecha >= start_dt)
#         .filter(models.Venta.fecha <= end_dt)
#         .group_by(day_expr)
#         .order_by(day_expr)
#         .all()
#     )

#     # ── Normalizar clave a "YYYY-MM-DD" sea cual sea el tipo del motor ──
#     sales_map: dict = {}
#     for r in rows:
#         if r.day is None:
#             continue
#         if isinstance(r.day, str):
#             key = r.day[:10]              # SQLite: "2024-01-15" o "2024-01-15 00:00"
#         elif hasattr(r.day, "isoformat"):
#             key = r.day.isoformat()[:10]  # Postgres datetime.date / datetime
#         else:
#             key = str(r.day)[:10]
#         sales_map[key] = float(r.total or 0)

#     # Rellenar días sin ventas con 0 para que la gráfica no tenga huecos
#     all_days = [
#         start_date + timedelta(days=i)
#         for i in range((end_date - start_date).days + 1)
#     ]
#     return [
#         schemas.SalesByDay(day=d, total=sales_map.get(d.isoformat(), 0.0))
#         for d in all_days
#     ]


# def get_total_sales_today(db: Session) -> float:
#     """
#     Total de ventas del día actual en hora Colombia.

#     BUG en producción (Postgres):
#       Sin zona horaria, 'hoy' se calcula en UTC y puede excluir ventas
#       de la mañana en Colombia (que en UTC son del día anterior después
#       de las 7pm UTC-5 = medianoche UTC).

#     FIX:
#       - Postgres: SQL nativo con AT TIME ZONE para calcular el rango
#         exacto del día en Colombia
#       - SQLite: offset manual de -5 horas
#     """
#     is_pg = _is_postgres(db)

#     if is_pg:
#         result = db.execute(text("""
#             SELECT COALESCE(SUM(total), 0)
#             FROM ventas
#             WHERE DATE(fecha AT TIME ZONE 'America/Bogota')
#                 = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date
#         """)).scalar()
#         return float(result or 0)

#     else:
#         # SQLite: offset manual UTC-5
#         tz_offset = timedelta(hours=-5)
#         now_col   = datetime.utcnow() + tz_offset
#         today_col = now_col.date()
#         start_utc = datetime.combine(today_col, datetime.min.time()) - tz_offset
#         end_utc   = datetime.combine(today_col, datetime.max.time()) - tz_offset

#         total = db.query(func.sum(models.Venta.total)).filter(
#             models.Venta.fecha >= start_utc,
#             models.Venta.fecha <= end_utc,
#         ).scalar()
#         return float(total or 0)





# ═══════════════════════════════════════════════════════════════════════════════
# crud_additions.py — agregar TODO esto al final de crud.py
# ═══════════════════════════════════════════════════════════════════════════════
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, text
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List
import models, schemas
from fastapi import HTTPException


# ─── Revertir movimientos al eliminar una venta ───────────────────────────────
def revertir_movimientos_venta(db: Session, venta: models.Venta):
    for det in venta.detalles:
        prod = db.query(models.Producto).get(det.producto_id)
        if not prod or prod.es_servicio:
            continue
        mov = models.InventoryMovement(
            producto_id=det.producto_id,
            tipo="entrada",
            cantidad=det.cantidad,
            costo_unitario=prod.costo or 0.0,
            motivo="reversa_venta",
            referencia=f"reversa venta #{venta.id}",
            observacion=f"Venta #{venta.id} eliminada el {datetime.now(timezone.utc).date()}"
        )
        db.add(mov)
        prod.stock_actual = (prod.stock_actual or 0) + det.cantidad
        db.add(prod)
    db.commit()


# ─── Notificaciones automáticas de stock bajo ────────────────────────────────
def check_and_notify_low_stock(db: Session, producto_ids: List[int]):
    admin_users = db.query(models.User).join(models.Role).filter(models.Role.name == "Admin").all()
    if not admin_users:
        return

    for prod_id in set(producto_ids):
        prod = db.query(models.Producto).get(prod_id)
        if not prod or prod.es_servicio:
            continue
        if (prod.stock_minimo or 0) > 0 and (prod.stock_actual or 0) < prod.stock_minimo:
            for admin in admin_users:
                hoy = datetime.now(timezone.utc).date()
                ya_notificado = db.query(models.Notificacion).filter(
                    models.Notificacion.usuario_id == admin.id,
                    models.Notificacion.mensaje.like(f"%{prod.nombre}%bajo stock%"),
                    func.date(models.Notificacion.fecha_creacion) == hoy
                ).first()
                if ya_notificado:
                    continue
                db.add(models.Notificacion(
                    usuario_id=admin.id,
                    mensaje=f"⚠️ '{prod.nombre}' está bajo stock mínimo. Actual: {prod.stock_actual:.1f} | Mínimo: {prod.stock_minimo:.1f}",
                    tipo="warning",
                    leido=False
                ))
    db.commit()


# ─── Caja ─────────────────────────────────────────────────────────────────────
def calcular_totales_dia(db: Session) -> dict:
    tz_col    = timezone(timedelta(hours=-5))
    ahora_col = datetime.now(tz_col)
    inicio    = ahora_col.replace(hour=0, minute=0, second=0, microsecond=0)
    fin       = ahora_col.replace(hour=23, minute=59, second=59)
    inicio_utc = inicio.astimezone(timezone.utc)
    fin_utc    = fin.astimezone(timezone.utc)

    totales = {
        "efectivo": 0.0, "transferencia": 0.0, "tarjeta": 0.0, "otros": 0.0,
        "total_dia": 0.0, "ventas_contado": 0.0, "abonos_cartera": 0.0,
        "num_ventas": 0, "num_abonos": 0,
        "fecha": ahora_col.date().isoformat(),
    }

    def _clasificar(metodo: str, monto: float):
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
            models.Venta.fecha >= inicio_utc,
            models.Venta.fecha <= fin_utc,
            models.Venta.estado_pago == "pagado",
        ).all()
    )

    for v in ventas_contado:
        pagos_hoy = [p for p in v.pagos if inicio_utc <= p.fecha <= fin_utc]
        if not pagos_hoy:
            metodo = getattr(v, 'metodo_pago', None) or "Efectivo"
            _clasificar(metodo, float(v.total or 0))
            totales["ventas_contado"] += float(v.total or 0)
            totales["num_ventas"] += 1

    abonos_dia = (
        db.query(models.Pago)
        .filter(models.Pago.fecha >= inicio_utc, models.Pago.fecha <= fin_utc)
        .all()
    )

    for p in abonos_dia:
        _clasificar(p.metodo_pago or "Efectivo", float(p.monto or 0))
        totales["abonos_cartera"] += float(p.monto or 0)
        totales["num_abonos"] += 1

    return totales


def crear_corte_caja(db: Session, usuario_id: int, efectivo_fisico: float,
                     observaciones: Optional[str] = None) -> models.CorteCaja:
    totales   = calcular_totales_dia(db)
    diferencia = efectivo_fisico - totales["efectivo"]

    corte = models.CorteCaja(
        usuario_id=usuario_id,
        total_efectivo_ventas=totales["efectivo"],
        total_transferencia_ventas=totales["transferencia"],
        total_tarjeta_ventas=totales["tarjeta"],
        total_otros_ventas=totales["otros"],
        total_ventas_dia=totales["total_dia"],
        efectivo_fisico=efectivo_fisico,
        diferencia=diferencia,
        observaciones=observaciones,
        estado="cerrado"
    )
    db.add(corte)
    db.commit()
    db.refresh(corte)

    if abs(diferencia) > 1000:
        admin_users = db.query(models.User).join(models.Role).filter(models.Role.name == "Admin").all()
        tipo  = "error" if diferencia < 0 else "warning"
        signo = "FALTANTE" if diferencia < 0 else "SOBRANTE"
        for admin in admin_users:
            db.add(models.Notificacion(
                usuario_id=admin.id,
                mensaje=f"💰 Corte de caja: {signo} de ${abs(diferencia):,.0f} COP detectado.",
                tipo=tipo, leido=False
            ))
        db.commit()

    return corte


def get_cortes_caja(db: Session, skip: int = 0, limit: int = 30) -> List[models.CorteCaja]:
    return (
        db.query(models.CorteCaja)
        .order_by(models.CorteCaja.fecha.desc())
        .offset(skip).limit(limit).all()
    )


# ─── Dashboard ────────────────────────────────────────────────────────────────
COL_TZ = "America/Bogota"

def _is_postgres(db: Session) -> bool:
    try:
        return db.get_bind().dialect.name == "postgresql"
    except Exception:
        try:
            from database import DATABASE_URL
            return "postgresql" in DATABASE_URL.lower()
        except Exception:
            return False


def get_sales_by_day(db: Session, start_date: date, end_date: date):
    is_pg = _is_postgres(db)
    day_expr = (
        func.date(func.timezone(COL_TZ, models.Venta.fecha)).label("day")
        if is_pg else
        func.date(models.Venta.fecha).label("day")
    )
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt   = datetime.combine(end_date,   datetime.max.time())

    rows = (
        db.query(day_expr, func.sum(models.Venta.total).label("total"))
        .filter(models.Venta.fecha >= start_dt, models.Venta.fecha <= end_dt)
        .group_by(day_expr).order_by(day_expr).all()
    )

    sales_map: dict = {}
    for r in rows:
        if r.day is None:
            continue
        key = r.day[:10] if isinstance(r.day, str) else r.day.isoformat()[:10]
        sales_map[key] = float(r.total or 0)

    all_days = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]
    return [
        schemas.SalesByDay(day=d, total=sales_map.get(d.isoformat(), 0.0))
        for d in all_days
    ]


def get_total_sales_today(db: Session) -> float:
    if _is_postgres(db):
        result = db.execute(text("""
            SELECT COALESCE(SUM(total), 0)
            FROM ventas
            WHERE DATE(fecha AT TIME ZONE 'America/Bogota')
                = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date
        """)).scalar()
        return float(result or 0)
    else:
        tz_offset = timedelta(hours=-5)
        now_col   = datetime.utcnow() + tz_offset
        today_col = now_col.date()
        start_utc = datetime.combine(today_col, datetime.min.time()) - tz_offset
        end_utc   = datetime.combine(today_col, datetime.max.time()) - tz_offset
        total = db.query(func.sum(models.Venta.total)).filter(
            models.Venta.fecha >= start_utc, models.Venta.fecha <= end_utc
        ).scalar()
        return float(total or 0)


# ─── Devoluciones ─────────────────────────────────────────────────────────────
def crear_devolucion(db: Session, data: schemas.DevolucionCreate) -> models.Devolucion:
    """
    Registra una devolución parcial o total de una venta.

    FLUJO:
      1. Carga la venta con joinedload para evitar DetachedInstanceError en Postgres
      2. Valida que las cantidades no excedan lo vendido originalmente
      3. Crea el encabezado Devolucion (campo: monto_total)
      4. Crea DevolucionItem por cada línea (campo: precio_unitario)
      5. Repone stock con movimiento de ENTRADA
      6. Ajusta el total de la venta (nota crédito)
      7. Recalcula estado_pago
      8. Notifica al admin
    """
    # ── 1. Cargar venta con todas las relaciones necesarias ──────────────────
    venta = (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
            joinedload(models.Venta.cliente),   # ← necesario para la notificación
        )
        .filter(models.Venta.id == data.venta_id)
        .first()
    )

    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    if not data.items:
        raise HTTPException(status_code=400, detail="Debe incluir al menos un ítem a devolver.")

    if not data.motivo or not data.motivo.strip():
        raise HTTPException(status_code=400, detail="El motivo es obligatorio.")

    # ── 2. Validar cantidades ─────────────────────────────────────────────────
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

    # ── 3. Crear encabezado de devolución ─────────────────────────────────────
    # IMPORTANTE: el modelo usa 'monto_total', NO 'total'
    dev = models.Devolucion(
        venta_id=venta.id,
        motivo=data.motivo.strip(),
        monto_total=total_dev,          # ✅ campo correcto del modelo
        tipo="parcial",
        estado="confirmada",
    )
    db.add(dev)
    db.flush()   # obtenemos dev.id sin hacer commit todavía

    # ── 4. Crear ítems + reponer stock ────────────────────────────────────────
    for item in data.items:
        # IMPORTANTE: el modelo usa 'precio_unitario', NO 'precio_unit'
        db_item = models.DevolucionItem(
            devolucion_id=dev.id,
            producto_id=item.producto_id,
            detalle_id=item.detalle_id,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,   # ✅ campo correcto del modelo
        )
        db.add(db_item)

        # ── 5. Reponer inventario ─────────────────────────────────────────────
        prod = db.query(models.Producto).get(item.producto_id)
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
                observacion=f"Devolución: {data.motivo[:80]}"
            )
            db.add(mov)

    # ── 6. Ajustar el total de la venta ───────────────────────────────────────
    if venta.estado_pago == "pagado":
        # Ya cobrada → reducir total Y monto_pagado (nota crédito)
        venta.total        = max(0.0, venta.total - total_dev)
        venta.monto_pagado = max(0.0, venta.monto_pagado - total_dev)
    else:
        # Pendiente/parcial → solo reducir el total (el cliente debe menos)
        venta.total = max(0.0, venta.total - total_dev)

    # ── 7. Recalcular estado_pago ─────────────────────────────────────────────
    if venta.total <= 0:
        venta.estado_pago  = "pagado"
        venta.monto_pagado = 0.0
    elif venta.monto_pagado >= venta.total:
        venta.estado_pago = "pagado"
    elif venta.monto_pagado > 0:
        venta.estado_pago = "parcial"
    else:
        venta.estado_pago = "pendiente"

    db.add(venta)

    # ── 8. Notificar al admin ─────────────────────────────────────────────────
    # venta.cliente ya cargado con joinedload → no hay DetachedInstanceError
    cliente_nombre = venta.cliente.nombre if venta.cliente else "desconocido"
    admin_users = db.query(models.User).join(models.Role).filter(models.Role.name == "Admin").all()
    for admin in admin_users:
        db.add(models.Notificacion(
            usuario_id=admin.id,
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


def get_devoluciones_by_venta(db: Session, venta_id: int) -> List[models.Devolucion]:
    return (
        db.query(models.Devolucion)
        .options(joinedload(models.Devolucion.items).joinedload(models.DevolucionItem.producto))
        .filter(models.Devolucion.venta_id == venta_id)
        .order_by(models.Devolucion.fecha.desc())
        .all()
    )
