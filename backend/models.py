from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Enum, Text, func
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base, declared_attr
from datetime import datetime, timezone
import enum

Base = declarative_base()

# ─── Función helper para timestamps timezone-aware ────────────────────────────
def utcnow():
    """Siempre usar esta función en lugar de datetime.utcnow() (deprecada en Python 3.12)"""
    return datetime.now(timezone.utc)

# ═══════════════════════════════════════════════════════════════════════════════
# ARQUITECTURA MULTI-TENANT (SAAS)
# ═══════════════════════════════════════════════════════════════════════════════

class Empresa(Base):
    """Tabla madre: Cada cliente de tu SaaS es una Empresa"""
    __tablename__ = "empresas"
    id             = Column(Integer, primary_key=True, index=True)
    nombre         = Column(String, index=True, nullable=False)
    nit            = Column(String, nullable=True)
    logo_url       = Column(String, nullable=True)
    color_primario = Column(String, default="#F43F5E") # Para personalizar el frontend
    is_active      = Column(Boolean, default=True)     # Para suspender si no pagan
    created_at     = Column(DateTime(timezone=True), default=utcnow)

    # Opcional: relación inversa para acceder a sus usuarios
    usuarios = relationship("User", back_populates="empresa")


class TenantMixin:
    """
    Mixin mágico: Al heredar de esta clase, la tabla automáticamente
    recibe la columna empresa_id y su relación. 
    Nota: Se deja nullable=True temporalmente para que la base de datos
    no se rompa al migrar los datos existentes.
    """
    @declared_attr
    def empresa_id(cls):
        return Column(Integer, ForeignKey('empresas.id'), index=True, nullable=True)

    @declared_attr
    def empresa(cls):
        return relationship("Empresa")


# ═══════════════════════════════════════════════════════════════════════════════
# ROLES Y MÓDULOS (GLOBALES - NO LLEVAN TENANT MIXIN)
# ═══════════════════════════════════════════════════════════════════════════════

class Modulo(Base):
    __tablename__ = "modulos"
    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String, unique=True, index=True)
    description    = Column(String, nullable=True)
    frontend_path  = Column(String, unique=True)

class Role(Base):
    __tablename__ = "roles"
    id      = Column(Integer, primary_key=True, index=True)
    name    = Column(String, unique=True, index=True)

    users   = relationship("User", back_populates="role")
    modules = relationship("Modulo", secondary="role_modules", back_populates="roles")

class RoleModule(Base):
    __tablename__ = "role_modules"
    role_id   = Column(Integer, ForeignKey("roles.id"), primary_key=True)
    module_id = Column(Integer, ForeignKey("modulos.id"), primary_key=True)

Modulo.roles = relationship("Role", secondary="role_modules", back_populates="modules")


# ═══════════════════════════════════════════════════════════════════════════════
# TABLAS DEL SISTEMA (TODAS HEREDAN DE TenantMixin)
# ═══════════════════════════════════════════════════════════════════════════════

class User(Base, TenantMixin):
    __tablename__ = "users"
    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role_id         = Column(Integer, ForeignKey("roles.id"))

    role              = relationship("Role", back_populates="users")
    empresa           = relationship("Empresa", back_populates="usuarios")
    ordenes_trabajo   = relationship("OrdenTrabajo", back_populates="operador")
    notificaciones    = relationship("Notificacion", back_populates="usuario")

class Cliente(Base, TenantMixin):
    __tablename__ = "clientes"
    id            = Column(Integer, primary_key=True, index=True)
    nombre        = Column(String, index=True)
    cedula        = Column(String, index=True, nullable=True) # Ya no puede ser unique=True a nivel DB porque 2 empresas distintas pueden registrar al mismo cliente
    telefono      = Column(String, nullable=True)
    direccion     = Column(String, nullable=True)
    cupo_credito  = Column(Float, default=0.0)
    es_cliente    = Column(Boolean, default=True)
    es_proveedor  = Column(Boolean, default=False)

    ventas          = relationship("Venta", back_populates="cliente")
    ordenes_trabajo = relationship("OrdenTrabajo", back_populates="cliente")

class Producto(Base, TenantMixin):
    __tablename__ = "productos"
    id            = Column(Integer, primary_key=True, index=True)
    nombre        = Column(String, index=True)
    precio        = Column(Float)
    costo         = Column(Float, default=0.0)
    es_servicio   = Column(Boolean, default=False)
    unidad_medida = Column(String, default="UND")
    stock_actual  = Column(Float, default=0.0)
    stock_minimo  = Column(Float, default=0.0)
    grupo_item    = Column(Integer, default=2)

class MovementType(str, enum.Enum):
    ENTRADA = "entrada"
    SALIDA  = "salida"
    AJUSTE  = "ajuste"

class InventoryMovement(Base, TenantMixin):
    __tablename__ = "inventory_movements"
    id             = Column(Integer, primary_key=True, index=True)
    producto_id    = Column(Integer, ForeignKey("productos.id"), nullable=False)
    tipo           = Column(Enum(MovementType), nullable=False)
    cantidad       = Column(Float, nullable=False)
    costo_unitario = Column(Float, default=0.0)
    motivo         = Column(String(100), default="")
    referencia     = Column(String(100), default="")
    observacion    = Column(Text, default="")
    created_at     = Column(DateTime(timezone=True), default=utcnow)

    producto = relationship("Producto", lazy="joined")

class DetalleVenta(Base, TenantMixin):
    __tablename__ = "detalles_venta"
    id               = Column(Integer, primary_key=True, index=True)
    venta_id         = Column(Integer, ForeignKey("ventas.id"))
    producto_id      = Column(Integer, ForeignKey("productos.id"))
    cantidad         = Column(Float)
    precio_unitario  = Column(Float)
    descuento_pct    = Column(Float, default=0.0)
    iva_porcentaje   = Column(Float, default=0.0)

    venta   = relationship("Venta", back_populates="detalles")
    producto = relationship("Producto")

class Pago(Base, TenantMixin):
    __tablename__ = "pagos"
    id           = Column(Integer, primary_key=True, index=True)
    venta_id     = Column(Integer, ForeignKey("ventas.id"))
    monto        = Column(Float)
    fecha        = Column(DateTime(timezone=True), default=utcnow)
    metodo_pago  = Column(String, nullable=True)
    detalle_pago = Column(String, nullable=True)

    venta = relationship("Venta", back_populates="pagos")

class Venta(Base, TenantMixin):
    __tablename__ = "ventas"
    id              = Column(Integer, primary_key=True, index=True)
    cliente_id      = Column(Integer, ForeignKey("clientes.id"))
    total           = Column(Float)
    iva_total       = Column(Float, default=0.0)
    iva_porcentaje  = Column(Float, default=0.0)
    descuento_total = Column(Float, default=0.0)
    fecha           = Column(DateTime(timezone=True), default=utcnow)
    monto_pagado    = Column(Float, default=0.0)
    estado_pago     = Column(String, default="pendiente")
    fecha_pago      = Column(DateTime(timezone=True), nullable=True)
    metodo_pago     = Column(String, nullable=True)

    cliente                = relationship("Cliente", back_populates="ventas")
    detalles               = relationship("DetalleVenta", back_populates="venta", cascade="all, delete-orphan")
    pagos                  = relationship("Pago", back_populates="venta", cascade="all, delete-orphan")
    orden_trabajo_asociada = relationship("OrdenTrabajo", back_populates="venta_asociada", uselist=False)

class OrdenProducto(Base, TenantMixin):
    __tablename__ = "orden_productos"
    id               = Column(Integer, primary_key=True, index=True)
    orden_id         = Column(Integer, ForeignKey("ordenes_trabajo.id"))
    producto_id      = Column(Integer, ForeignKey("productos.id"))
    cantidad         = Column(Float)
    precio_unitario  = Column(Float)

    orden   = relationship("OrdenTrabajo", back_populates="productos")
    producto = relationship("Producto")

class OrdenServicio(Base, TenantMixin):
    __tablename__ = "orden_servicios"
    id              = Column(Integer, primary_key=True, index=True)
    orden_id        = Column(Integer, ForeignKey("ordenes_trabajo.id"))
    servicio_id     = Column(Integer, ForeignKey("productos.id"))
    cantidad        = Column(Float)
    precio_servicio = Column(Float)

    orden   = relationship("OrdenTrabajo", back_populates="servicios")
    servicio = relationship("Producto")

class Evidencia(Base, TenantMixin):
    __tablename__ = "evidencias"
    id          = Column(Integer, primary_key=True, index=True)
    orden_id    = Column(Integer, ForeignKey("ordenes_trabajo.id"))
    file_path   = Column(String)
    uploaded_at = Column(DateTime(timezone=True), default=utcnow)

    orden = relationship("OrdenTrabajo", back_populates="evidencias")

class OrdenTrabajo(Base, TenantMixin):
    __tablename__ = "ordenes_trabajo"
    id                       = Column(Integer, primary_key=True, index=True)
    cliente_id               = Column(Integer, ForeignKey("clientes.id"))
    operador_id              = Column(Integer, ForeignKey("users.id"))
    total                    = Column(Float)
    estado                   = Column(String, default="Borrador")
    fecha_creacion           = Column(DateTime(timezone=True), default=utcnow)
    fecha_actualizacion      = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    observaciones_aprobador  = Column(String, nullable=True)
    venta_id                 = Column(Integer, ForeignKey("ventas.id"), nullable=True)

    cliente          = relationship("Cliente", back_populates="ordenes_trabajo")
    operador         = relationship("User", back_populates="ordenes_trabajo")
    productos        = relationship("OrdenProducto", back_populates="orden", cascade="all, delete-orphan")
    servicios        = relationship("OrdenServicio", back_populates="orden", cascade="all, delete-orphan")
    evidencias       = relationship("Evidencia", back_populates="orden", cascade="all, delete-orphan")
    venta_asociada   = relationship("Venta", back_populates="orden_trabajo_asociada", uselist=False)

class Notificacion(Base, TenantMixin):
    __tablename__ = "notificaciones"
    id              = Column(Integer, primary_key=True, index=True)
    usuario_id      = Column(Integer, ForeignKey("users.id"))
    mensaje         = Column(String)
    leido           = Column(Boolean, default=False)
    tipo            = Column(String, default="info")
    fecha_creacion  = Column(DateTime(timezone=True), default=utcnow)
    orden_id        = Column(Integer, ForeignKey("ordenes_trabajo.id"), nullable=True)

    usuario = relationship("User", back_populates="notificaciones")
    orden   = relationship("OrdenTrabajo")

class RegistroProductividad(Base, TenantMixin):
    __tablename__ = "registros_productividad"
    id                   = Column(Integer, primary_key=True, index=True)
    operador_id          = Column(Integer, ForeignKey("users.id"))
    orden_id             = Column(Integer, ForeignKey("ordenes_trabajo.id"))
    servicio_id          = Column(Integer, ForeignKey("productos.id"))
    valor_productividad  = Column(Float)
    modalidad_pago       = Column(String)
    fecha                = Column(DateTime(timezone=True), default=utcnow)

    operador = relationship("User")
    orden    = relationship("OrdenTrabajo")
    servicio = relationship("Producto")

class Receta(Base, TenantMixin):
    __tablename__ = "recetas"
    id          = Column(Integer, primary_key=True, index=True)
    producto_id = Column(Integer, ForeignKey("productos.id")) # Quité el unique=True para que 2 empresas puedan tener una receta con un producto que tenga el mismo ID local
    nombre      = Column(String, index=True)
    descripcion = Column(String, nullable=True)
    created_at  = Column(DateTime(timezone=True), default=utcnow)

    producto_resultante = relationship("Producto", foreign_keys=[producto_id])
    items               = relationship("RecetaItem", back_populates="receta", cascade="all, delete-orphan")
    servicios_maquila   = relationship("RecetaServicio", back_populates="receta", cascade="all, delete-orphan")

class RecetaServicio(Base, TenantMixin):
    __tablename__ = "receta_servicios"
    id          = Column(Integer, primary_key=True, index=True)
    receta_id   = Column(Integer, ForeignKey("recetas.id"))
    servicio_id = Column(Integer, ForeignKey("productos.id"))

    receta   = relationship("Receta", back_populates="servicios_maquila")
    servicio = relationship("Producto")

class RecetaItem(Base, TenantMixin):
    __tablename__ = "receta_items"
    id         = Column(Integer, primary_key=True, index=True)
    receta_id  = Column(Integer, ForeignKey("recetas.id"))
    insumo_id  = Column(Integer, ForeignKey("productos.id"))
    cantidad   = Column(Float)

    receta = relationship("Receta", back_populates="items")
    insumo = relationship("Producto")

class LoteProduccion(Base, TenantMixin):
    __tablename__ = "lotes_produccion"
    id                       = Column(Integer, primary_key=True, index=True)
    receta_id                = Column(Integer, ForeignKey("recetas.id"))
    cantidad_a_producir      = Column(Float)
    cantidad_real            = Column(Float, nullable=True)
    costo_total              = Column(Float, default=0.0)
    costo_unitario_resultado = Column(Float, default=0.0)
    fecha_planificada        = Column(DateTime(timezone=True), default=utcnow)
    fecha_confirmacion       = Column(DateTime(timezone=True), nullable=True)
    estado                   = Column(String, default="En produccion")
    cliente_id               = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    venta_id                 = Column(Integer, ForeignKey("ventas.id"), nullable=True)
    observaciones            = Column(Text, nullable=True)

    receta          = relationship("Receta")
    cliente         = relationship("Cliente")
    venta_asociada  = relationship("Venta")

class Compra(Base, TenantMixin):
    __tablename__ = "compras"
    id                  = Column(Integer, primary_key=True, index=True)
    proveedor_id        = Column(Integer, ForeignKey("clientes.id"))
    total               = Column(Float)
    iva_total           = Column(Float, default=0.0)
    iva_porcentaje      = Column(Float, default=0.0)
    fecha               = Column(DateTime(timezone=True), default=utcnow)
    monto_pagado        = Column(Float, default=0.0)
    estado_pago         = Column(String, default="pendiente")
    referencia_factura  = Column(String, nullable=True)

    proveedor = relationship("Cliente")
    detalles  = relationship("DetalleCompra", back_populates="compra", cascade="all, delete-orphan")
    pagos     = relationship("PagoCompra", back_populates="compra", cascade="all, delete-orphan")

class DetalleCompra(Base, TenantMixin):
    __tablename__ = "detalles_compra"
    id              = Column(Integer, primary_key=True, index=True)
    compra_id       = Column(Integer, ForeignKey("compras.id"))
    producto_id     = Column(Integer, ForeignKey("productos.id"))
    cantidad        = Column(Float)
    precio_unitario = Column(Float)
    iva_porcentaje  = Column(Float, default=0.0)

    compra   = relationship("Compra", back_populates="detalles")
    producto = relationship("Producto")

class PagoCompra(Base, TenantMixin):
    __tablename__ = "pagos_compra"
    id           = Column(Integer, primary_key=True, index=True)
    compra_id    = Column(Integer, ForeignKey("compras.id"))
    monto        = Column(Float)
    fecha        = Column(DateTime(timezone=True), default=utcnow)
    metodo_pago  = Column(String, nullable=True)
    detalle_pago = Column(String, nullable=True)

    compra = relationship("Compra", back_populates="pagos")

class DevolucionItem(Base, TenantMixin):
    __tablename__ = "devolucion_items"
    id              = Column(Integer, primary_key=True, index=True)
    devolucion_id   = Column(Integer, ForeignKey("devoluciones.id"), nullable=False)
    producto_id     = Column(Integer, ForeignKey("productos.id"), nullable=False)
    detalle_id      = Column(Integer, ForeignKey("detalles_venta.id"), nullable=True)
    cantidad        = Column(Float, nullable=False)
    precio_unitario = Column(Float, nullable=False)

    devolucion = relationship("Devolucion", back_populates="items")
    producto   = relationship("Producto")

class Devolucion(Base, TenantMixin):
    __tablename__ = "devoluciones"
    id          = Column(Integer, primary_key=True, index=True)
    venta_id    = Column(Integer, ForeignKey("ventas.id"), nullable=False)
    usuario_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    fecha       = Column(DateTime(timezone=True), default=utcnow)
    motivo      = Column(String(300), nullable=True)
    monto_total = Column(Float, default=0.0)
    tipo        = Column(String(20), default="parcial")
    estado      = Column(String(20), default="confirmada")

    venta   = relationship("Venta", back_populates="devoluciones")
    usuario = relationship("User")
    items   = relationship("DevolucionItem", back_populates="devolucion", cascade="all, delete-orphan")

Venta.devoluciones = relationship("Devolucion", back_populates="venta")

class CorteCaja(Base, TenantMixin):
    __tablename__ = "cortes_caja"
    id                          = Column(Integer, primary_key=True, index=True)
    usuario_id                  = Column(Integer, ForeignKey("users.id"))
    fecha                       = Column(DateTime(timezone=True), default=utcnow)
    total_efectivo_ventas       = Column(Float, default=0.0)
    total_transferencia_ventas  = Column(Float, default=0.0)
    total_tarjeta_ventas        = Column(Float, default=0.0)
    total_otros_ventas          = Column(Float, default=0.0)
    total_ventas_dia            = Column(Float, default=0.0)
    total_gastos                = Column(Float, default=0.0)
    efectivo_fisico             = Column(Float, default=0.0)
    diferencia                  = Column(Float, default=0.0)
    observaciones               = Column(Text, nullable=True)
    estado                      = Column(String, default="abierto")

    usuario = relationship("User")

class Gasto(Base, TenantMixin):
    __tablename__ = "gastos"
    id          = Column(Integer, primary_key=True, index=True)
    usuario_id  = Column(Integer, ForeignKey("users.id"))
    tercero_id  = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    monto       = Column(Float, default=0.0, nullable=False)
    concepto    = Column(Text, nullable=True)
    metodo_pago = Column(String, default="Efectivo")
    fecha       = Column(DateTime(timezone=True), default=utcnow)

    usuario = relationship("User")
    tercero = relationship("Cliente")