from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Enum, Text, func
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timezone

import enum

Base = declarative_base()

class Cliente(Base):
    __tablename__ = "clientes"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True)
    cedula = Column(String, unique=True, index=True, nullable=True)
    telefono = Column(String, nullable=True)
    direccion = Column(String, nullable=True)
    cupo_credito = Column(Float, default=0.0)
    es_cliente = Column(Boolean, default=True)
    es_proveedor = Column(Boolean, default=False)

    ventas = relationship("Venta", back_populates="cliente")
    ordenes_trabajo = relationship("OrdenTrabajo", back_populates="cliente")

class Producto(Base):
    __tablename__ = "productos"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True)
    precio = Column(Float)
    costo = Column(Float, default=0.0)
    es_servicio = Column(Boolean, default=False)
    unidad_medida = Column(String, default="UND")
    stock_actual = Column(Float, default=0.0) # New field for current stock
    stock_minimo = Column(Float, default=0.0) # New field for minimum
    grupo_item = Column(Integer, default=2) # 1:MP, 2:PT, 3:AF, 4:INS (Default PT)
    
class MovementType(str, enum.Enum):
    ENTRADA = "entrada"
    SALIDA = "salida"
    AJUSTE = "ajuste"

class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)
    tipo = Column(Enum(MovementType), nullable=False)
    cantidad = Column(Float, nullable=False)
    costo_unitario = Column(Float, default=0.0)   # por si más adelante calculas valorización
    motivo = Column(String(100), default="")
    referencia = Column(String(100), default="")  # ej: venta #, orden #
    observacion = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # producto = relationship("Producto", backref="movimientos")
    producto = relationship("Producto", lazy="joined")  # 👈
    
class DetalleVenta(Base):
    __tablename__ = "detalles_venta"
    id = Column(Integer, primary_key=True, index=True)
    venta_id = Column(Integer, ForeignKey("ventas.id"))
    producto_id = Column(Integer, ForeignKey("productos.id"))
    cantidad = Column(Float)
    precio_unitario = Column(Float)
    iva_porcentaje = Column(Float, default=0.0)

    venta = relationship("Venta", back_populates="detalles")
    producto = relationship("Producto")

class Pago(Base):
    __tablename__ = "pagos"
    id = Column(Integer, primary_key=True, index=True)
    venta_id = Column(Integer, ForeignKey("ventas.id"))
    monto = Column(Float)
    fecha = Column(DateTime, default=datetime.utcnow)
    metodo_pago = Column(String, nullable=True)

    venta = relationship("Venta", back_populates="pagos")

class Venta(Base):
    __tablename__ = "ventas"
    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"))
    total = Column(Float)
    iva_total = Column(Float, default=0.0)
    iva_porcentaje = Column(Float, default=0.0) # <--- IVA Global de la venta
    fecha = Column(DateTime, default=datetime.utcnow)
    monto_pagado = Column(Float, default=0.0)
    estado_pago = Column(String, default="pendiente") # pagado, parcial, pendiente
    fecha_pago = Column(DateTime, nullable=True) # New field for payment date

    cliente = relationship("Cliente", back_populates="ventas")
    detalles = relationship("DetalleVenta", back_populates="venta", cascade="all, delete-orphan")
    pagos = relationship("Pago", back_populates="venta", cascade="all, delete-orphan")
    orden_trabajo_asociada = relationship("OrdenTrabajo", back_populates="venta_asociada", uselist=False)

class Modulo(Base):
    __tablename__ = "modulos"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    frontend_path = Column(String, unique=True)

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

    users = relationship("User", back_populates="role")
    modules = relationship("Modulo", secondary="role_modules", back_populates="roles")

class RoleModule(Base):
    __tablename__ = "role_modules"
    role_id = Column(Integer, ForeignKey("roles.id"), primary_key=True)
    module_id = Column(Integer, ForeignKey("modulos.id"), primary_key=True)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role_id = Column(Integer, ForeignKey("roles.id"))

    role = relationship("Role", back_populates="users")
    ordenes_trabajo = relationship("OrdenTrabajo", back_populates="operador")
    notificaciones = relationship("Notificacion", back_populates="usuario")

Modulo.roles = relationship("Role", secondary="role_modules", back_populates="modules")

class OrdenProducto(Base):
    __tablename__ = "orden_productos"
    id = Column(Integer, primary_key=True, index=True)
    orden_id = Column(Integer, ForeignKey("ordenes_trabajo.id"))
    producto_id = Column(Integer, ForeignKey("productos.id"))
    cantidad = Column(Float)
    precio_unitario = Column(Float)

    orden = relationship("OrdenTrabajo", back_populates="productos")
    producto = relationship("Producto")

class OrdenServicio(Base):
    __tablename__ = "orden_servicios"
    id = Column(Integer, primary_key=True, index=True)
    orden_id = Column(Integer, ForeignKey("ordenes_trabajo.id"))
    servicio_id = Column(Integer, ForeignKey("productos.id")) # Un servicio es un producto
    cantidad = Column(Float)
    precio_servicio = Column(Float)

    orden = relationship("OrdenTrabajo", back_populates="servicios")
    servicio = relationship("Producto")

class Evidencia(Base):
    __tablename__ = "evidencias"
    id = Column(Integer, primary_key=True, index=True)
    orden_id = Column(Integer, ForeignKey("ordenes_trabajo.id"))
    file_path = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    orden = relationship("OrdenTrabajo", back_populates="evidencias")

class OrdenTrabajo(Base):
    __tablename__ = "ordenes_trabajo"
    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"))
    operador_id = Column(Integer, ForeignKey("users.id"))
    total = Column(Float)
    estado = Column(String, default="Borrador")
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    observaciones_aprobador = Column(String, nullable=True)
    venta_id = Column(Integer, ForeignKey("ventas.id"), nullable=True) # Foreign key to Venta

    cliente = relationship("Cliente", back_populates="ordenes_trabajo")
    operador = relationship("User", back_populates="ordenes_trabajo")
    productos = relationship("OrdenProducto", back_populates="orden", cascade="all, delete-orphan")
    servicios = relationship("OrdenServicio", back_populates="orden", cascade="all, delete-orphan")
    evidencias = relationship("Evidencia", back_populates="orden", cascade="all, delete-orphan")
    venta_asociada = relationship("Venta", back_populates="orden_trabajo_asociada", uselist=False) # Relationship to Venta

class Notificacion(Base):
    __tablename__ = "notificaciones"
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("users.id"))
    mensaje = Column(String)
    leido = Column(Boolean, default=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    orden_id = Column(Integer, ForeignKey("ordenes_trabajo.id"), nullable=True)
    usuario = relationship("User", back_populates="notificaciones")
    orden = relationship("OrdenTrabajo")
    


class RegistroProductividad(Base):
    __tablename__ = "registros_productividad"
    id = Column(Integer, primary_key=True, index=True)
    operador_id = Column(Integer, ForeignKey("users.id"))
    orden_id = Column(Integer, ForeignKey("ordenes_trabajo.id"))
    servicio_id = Column(Integer, ForeignKey("productos.id"))
    valor_productividad = Column(Float)
    modalidad_pago = Column(String)
    fecha = Column(DateTime, default=datetime.utcnow)

    operador = relationship("User")
    orden = relationship("OrdenTrabajo")
    servicio = relationship("Producto")

# =========================
# NUEVOS MODELOS PRODUCCIÓN (VIALMAR)
# =========================

class Receta(Base):
    __tablename__ = "recetas"
    id = Column(Integer, primary_key=True, index=True)
    producto_id = Column(Integer, ForeignKey("productos.id"), unique=True) # Una receta por producto resultante
    nombre = Column(String, index=True)
    descripcion = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    producto_resultante = relationship("Producto", foreign_keys=[producto_id])
    items = relationship("RecetaItem", back_populates="receta", cascade="all, delete-orphan")
    servicios_maquila = relationship("RecetaServicio", back_populates="receta", cascade="all, delete-orphan")

class RecetaServicio(Base):
    __tablename__ = "receta_servicios"
    id = Column(Integer, primary_key=True, index=True)
    receta_id = Column(Integer, ForeignKey("recetas.id"))
    servicio_id = Column(Integer, ForeignKey("productos.id"))

    receta = relationship("Receta", back_populates="servicios_maquila")
    servicio = relationship("Producto")

class RecetaItem(Base):
    __tablename__ = "receta_items"
    id = Column(Integer, primary_key=True, index=True)
    receta_id = Column(Integer, ForeignKey("recetas.id"))
    insumo_id = Column(Integer, ForeignKey("productos.id"))
    cantidad = Column(Float) # Cantidad necesaria para producir 1 unidad del producto_resultante

    receta = relationship("Receta", back_populates="items")
    insumo = relationship("Producto")

class LoteProduccion(Base):
    __tablename__ = "lotes_produccion"
    id = Column(Integer, primary_key=True, index=True)
    receta_id = Column(Integer, ForeignKey("recetas.id"))
    cantidad_a_producir = Column(Float)

    cantidad_real = Column(Float, nullable=True)  # merma
    costo_total = Column(Float, default=0.0)
    costo_unitario_resultado = Column(Float, default=0.0)

    fecha_planificada = Column(DateTime, default=datetime.utcnow)
    fecha_confirmacion = Column(DateTime, nullable=True)

    estado = Column(String, default="En produccion")  # Borrador, Confirmado, Cancelado

    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=True)  # maquila
    venta_id = Column(Integer, ForeignKey("ventas.id"), nullable=True)  # venta por maquila

    observaciones = Column(Text, nullable=True)

    receta = relationship("Receta")
    cliente = relationship("Cliente")
    venta_asociada = relationship("Venta")

# =========================
# MÓDULO DE COMPRAS (VIALMAR)
# =========================

class Compra(Base):
    __tablename__ = "compras"
    id = Column(Integer, primary_key=True, index=True)
    proveedor_id = Column(Integer, ForeignKey("clientes.id")) # Reutilizamos tabla clientes/terceros
    total = Column(Float)
    iva_total = Column(Float, default=0.0)
    iva_porcentaje = Column(Float, default=0.0) # <--- IVA Global de la compra
    fecha = Column(DateTime, default=datetime.utcnow)
    monto_pagado = Column(Float, default=0.0)
    estado_pago = Column(String, default="pendiente") # pagado, parcial, pendiente
    referencia_factura = Column(String, nullable=True) # Num. factura proveedor

    proveedor = relationship("Cliente")
    detalles = relationship("DetalleCompra", back_populates="compra", cascade="all, delete-orphan")
    pagos = relationship("PagoCompra", back_populates="compra", cascade="all, delete-orphan")

class DetalleCompra(Base):
    __tablename__ = "detalles_compra"
    id = Column(Integer, primary_key=True, index=True)
    compra_id = Column(Integer, ForeignKey("compras.id"))
    producto_id = Column(Integer, ForeignKey("productos.id"))
    cantidad = Column(Float)
    precio_unitario = Column(Float) # Costo de compra
    iva_porcentaje = Column(Float, default=0.0)

    compra = relationship("Compra", back_populates="detalles")
    producto = relationship("Producto")

class PagoCompra(Base):
    __tablename__ = "pagos_compra"
    id = Column(Integer, primary_key=True, index=True)
    compra_id = Column(Integer, ForeignKey("compras.id"))
    monto = Column(Float)
    fecha = Column(DateTime, default=datetime.utcnow)
    metodo_pago = Column(String, nullable=True)
    detalle_pago = Column(String, nullable=True) # <--- NUEVO: Nro Cuenta, Nro Cheque, etc.

    compra = relationship("Compra", back_populates="pagos")

