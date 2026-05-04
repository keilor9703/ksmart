
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Enum, Text, func, Date
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base, declared_attr
from datetime import datetime, timezone
import enum
from sqlalchemy import JSON 
from sqlalchemy import UniqueConstraint

from sqlalchemy import (
   Column, Integer, String, Text, BigInteger, DateTime, ForeignKey, Boolean,
   Float, Date, Enum, UniqueConstraint)

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
    pais            = Column(String(4),  nullable=True)
    ciudad          = Column(String(80), nullable=True)
    tamano_negocio  = Column(String(20), nullable=True)
    origen_marketing = Column(String(60), nullable=True)


    # Opcional: relación inversa para acceder a sus usuarios
    usuarios = relationship("User", back_populates="empresa")

    plan_type = Column(String, default="trial") # Puede ser: 'trial', 'premium', 'anual'
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)

    # 👇 NUEVAS COLUMNAS PARA WOMPI (Cobro Recurrente)
    wompi_customer_id = Column(String, nullable=True) # Identificador del cliente en Wompi
    wompi_payment_source_id = Column(String, nullable=True) # El "Token" de la tarjeta encriptada

    # 👇 NUEVA COLUMNA PARA CONTROL SAAS (Feature Toggles)
    # Guardará una lista de paths, ej: ["/clientes", "/prestamos", "/ruta-cobro"]
    # Si es NULL, significa que la empresa tiene acceso a TODO (retrocompatibilidad para tu fábrica actual)
    
    modulos_habilitados = Column(JSON, nullable=True) # Guarda ["/ruta1", "/ruta2"]


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
    
    is_active       = Column(Boolean, default=True) # ✅ NUEVO: Para el Soft Delete (Trazabilidad)
    nombre_completo = Column(String(120), nullable=True)
    email           = Column(String(120), nullable=True, index=True)
    telefono        = Column(String(30),  nullable=True)


    role              = relationship("Role", back_populates="users")
    empresa           = relationship("Empresa", back_populates="usuarios")
    ordenes_trabajo   = relationship("OrdenTrabajo", back_populates="operador")
    notificaciones    = relationship("Notificacion", back_populates="usuario")
    credenciales_biometricas = relationship(
        "CredencialBiometrica",
         back_populates="usuario",
         cascade="all, delete-orphan"    )


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
    
    # 👇 NUEVA COLUMNA: Control maestro para perecederos
    maneja_lotes  = Column(Boolean, default=False)

    lotes = relationship("LoteExistencia", back_populates="producto", cascade="all, delete-orphan")

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

    lote_id     = Column(Integer, ForeignKey("lotes_existencias.id"), nullable=True)
    numero_lote = Column(String(100), nullable=True)
    lote        = relationship("LoteExistencia", back_populates="movimientos")


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



class ResolucionDian(Base, TenantMixin):
    """
    Resolución de numeración emitida por la DIAN para facturación electrónica.
    Solo puede haber una activa por empresa (is_active=True).
    La numeración auto-incrementa en cada nueva venta.
    """
    __tablename__ = "resoluciones_dian"

    id                = Column(Integer, primary_key=True, index=True)
    prefijo           = Column(String(10), default="")          # Ej: "FE", "FAC", ""
    numero_resolucion = Column(String(50), nullable=True)       # Nro. DIAN oficial
    numero_actual     = Column(Integer, nullable=False, default=0)    # Último asignado
    numero_inicial    = Column(Integer, nullable=False, default=1)    # Inicio del rango
    numero_final      = Column(Integer, nullable=False, default=99999999)  # Fin del rango
    vigencia_desde    = Column(Date, nullable=True)
    vigencia_hasta    = Column(Date, nullable=True)
    is_active         = Column(Boolean, default=False)
    created_at        = Column(DateTime(timezone=True), default=utcnow)



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

        # Fase 2A — Numeración DIAN
    numero_factura  = Column(String(20), nullable=True, index=True)
    resolucion_id   = Column(Integer, ForeignKey("resoluciones_dian.id"), nullable=True)
    resolucion      = relationship("ResolucionDian")

    # Fase 2B — Cotizaciones
    tipo            = Column(String(20), default="venta")    # 'venta' | 'cotizacion'
    valida_hasta    = Column(DateTime(timezone=True), nullable=True)
    observaciones   = Column(Text, nullable=True)

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
    producto_id = Column(Integer, ForeignKey("productos.id")) 
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

class PlanSuscripcion(Base):
    __tablename__ = "planes_suscripcion"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)              
    codigo_interno = Column(String, unique=True, index=True, nullable=False) 
    precio = Column(Float, nullable=False)               
    dias_duracion = Column(Integer, nullable=False)      
    caracteristicas = Column(String, nullable=True)     
    is_active = Column(Boolean, default=True)


class RegistroPago(Base):
    __tablename__ = "registros_pagos"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"))
    plan_id = Column(Integer, ForeignKey("planes_suscripcion.id"))
    monto = Column(Float)
    moneda = Column(String)
    metodo_pago = Column(String) 
    bold_tx_id = Column(String)  # Reutilizaremos esta misma columna para el ID de Wompi para no dañar tu BD
    email_pagador = Column(String)
    fecha_pago = Column(DateTime(timezone=True), server_default=func.now())
    payload_auditoria = Column(JSON) 

    empresa = relationship("Empresa")
    plan = relationship("PlanSuscripcion")



# class Prestamo(Base, TenantMixin):
#     __tablename__ = "prestamos"
#     id = Column(Integer, primary_key=True, index=True)
#     cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
#     monto_prestado = Column(Float, nullable=False)
#     tasa_interes = Column(Float, nullable=False) # Ej: 5.0 para 5%
#     modalidad = Column(String) # Ej: "Diario", "Semanal", "Mensual"
#     fecha_inicio = Column(DateTime(timezone=True), default=utcnow)
#     estado = Column(String, default="Activo") # Activo, Pagado, Mora

#     cliente = relationship("Cliente")
#     cuotas = relationship("CuotaPrestamo", back_populates="prestamo", cascade="all, delete-orphan")

# class CuotaPrestamo(Base, TenantMixin):
#     __tablename__ = "cuotas_prestamo"
#     id = Column(Integer, primary_key=True, index=True)
#     prestamo_id = Column(Integer, ForeignKey("prestamos.id"), nullable=False)
#     numero_cuota = Column(Integer)
#     monto_cuota = Column(Float, nullable=False)
#     fecha_vencimiento = Column(DateTime(timezone=True), nullable=False)
#     estado_pago = Column(String, default="Pendiente") # Pendiente, Pagado
#     fecha_pago = Column(DateTime(timezone=True), nullable=True)

#     prestamo = relationship("Prestamo", back_populates="cuotas")




class Prestamo(Base, TenantMixin):
    __tablename__ = "prestamos"
    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    monto_prestado = Column(Float, nullable=False)
    tasa_interes = Column(Float, nullable=False) # Porcentaje. Ej: 20.0 para 20%
    cantidad_cuotas = Column(Integer, nullable=False)
    modalidad = Column(String, nullable=False) # 'Diario', 'Semanal', 'Quincenal', 'Mensual'
    monto_total_pagar = Column(Float, nullable=False) # Capital + Intereses
    fecha_inicio = Column(DateTime(timezone=True), default=utcnow)
    estado = Column(String, default="Activo") # Activo, Pagado, En Mora
    # Dentro de class Prestamo(Base):
    tasa_mora = Column(Float, default=2.0)  # % mensual, ej: 2% = 0.066% diario

    cliente = relationship("Cliente")
    cuotas = relationship("CuotaPrestamo", back_populates="prestamo", cascade="all, delete-orphan")

    usuario_asignado_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # Y la relación
    cobrador = relationship("User")

class CuotaPrestamo(Base, TenantMixin):
    __tablename__ = "cuotas_prestamo"
    id = Column(Integer, primary_key=True, index=True)
    prestamo_id = Column(Integer, ForeignKey("prestamos.id"), nullable=False)
    numero_cuota = Column(Integer, nullable=False)
    monto_cuota = Column(Float, nullable=False)
    saldo_pendiente = Column(Float, nullable=False) # Por si el cliente abona una parte de la cuota
    fecha_vencimiento = Column(DateTime(timezone=True), nullable=False)
    estado_pago = Column(String, default="Pendiente") # Pendiente, Parcial, Pagado
    fecha_pago = Column(DateTime(timezone=True), nullable=True)

    # Dentro de la clase CuotaPrestamo en models.py
    usuario_asignado_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relación para poder saber quién es el cobrador desde la cuota
    cobrador = relationship("User")

    prestamo = relationship("Prestamo", back_populates="cuotas")



# ═══════════════════════════════════════════════════════════════════════════
# AÑADIR A models.py — Modelo LoteExistencia
# Pega este bloque dentro de tu models.py existente
# ═══════════════════════════════════════════════════════════════════════════

class LoteExistencia(Base):
    """
    Representa un lote físico de un producto con fecha de vencimiento.
    Un producto puede tener múltiples lotes activos simultáneamente.
    """
    __tablename__ = "lotes_existencias"

    id                = Column(Integer, primary_key=True, index=True)
    empresa_id        = Column(Integer, ForeignKey("empresas.id"), nullable=False)
    producto_id       = Column(Integer, ForeignKey("productos.id"), nullable=False)
    numero_lote       = Column(String(100), nullable=False)
    fecha_vencimiento = Column(Date, nullable=False)
    fecha_fabricacion = Column(Date, nullable=True)
    cantidad_inicial  = Column(Float, default=0)
    cantidad_actual   = Column(Float, default=0)
    costo_unitario    = Column(Float, default=0)
    proveedor_id      = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    referencia_compra = Column(String(100), nullable=True)
    observaciones     = Column(Text, nullable=True)
    created_at        = Column(DateTime(timezone=True), default=utcnow)

    # Relaciones
    empresa   = relationship("Empresa")
    producto  = relationship("Producto", back_populates="lotes")
    proveedor = relationship("Cliente", foreign_keys=[proveedor_id])
    movimientos = relationship("InventoryMovement", back_populates="lote")


# ── También añade en el modelo Producto existente ────────────────────────────
# Dentro de class Producto(Base): agrega esta línea:
#
#     lotes = relationship("LoteExistencia", back_populates="producto",
#                          cascade="all, delete-orphan")
#
# ── Y en InventoryMovement agrega estas dos columnas y la relación: ──────────
#
#     lote_id     = Column(Integer, ForeignKey("lotes_existencias.id"), nullable=True)
#     numero_lote = Column(String(100), nullable=True)
#     lote        = relationship("LoteExistencia", back_populates="movimientos")

# ═══════════════════════════════════════════════════════════════════════════════
# MÓDULO PARQUEADERO DE MOTOS — Pega este bloque AL FINAL de tu models.py
# Versión: V31 (compatible con la arquitectura multi-tenant existente)
# ═══════════════════════════════════════════════════════════════════════════════


# ─── 1. Configuración global de tarifas y cupo del parqueadero ───────────────
class ParqueaderoConfig(Base, TenantMixin):
    """
    Configuración única por empresa: tarifas estándar y cupo total.
    Solo debe existir UN registro por empresa_id.
    """
    __tablename__ = "parqueadero_config"

    id                    = Column(Integer, primary_key=True, index=True)
    tarifa_mensual        = Column(Float, default=0.0)
    tarifa_quincenal      = Column(Float, default=0.0)
    tarifa_diaria         = Column(Float, default=0.0)
    tarifa_hora           = Column(Float, default=0.0)
    tarifa_minuto         = Column(Float, default=0.0)        # ✨ NUEVO
    cobro_minimo_minutos  = Column(Integer, default=30)       # ✨ NUEVO (0 = desactivado)
    cupo_total            = Column(Integer, default=0)
    nombre_parqueadero    = Column(String(120), nullable=True)
    direccion             = Column(String(200), nullable=True)
    horario_apertura      = Column(String(5), default="06:30")  # "HH:MM"
    horario_cierre        = Column(String(5), default="20:00")  # "HH:MM"
    created_at            = Column(DateTime(timezone=True), default=utcnow)
    updated_at            = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


# ─── 2. Vehículos (motocicletas) ─────────────────────────────────────────────
class Vehiculo(Base, TenantMixin):
    """
    Una motocicleta registrada en el parqueadero. La placa es única por empresa.
    Un Cliente (propietario) puede tener N vehículos.
    """
    __tablename__ = "vehiculos"

    id              = Column(Integer, primary_key=True, index=True)
    placa           = Column(String(10), nullable=False, index=True)
    cliente_id      = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    marca           = Column(String(60), nullable=True)   # Yamaha, Honda…
    modelo          = Column(String(60), nullable=True)   # XTZ 125, CB 110…
    color           = Column(String(40), nullable=True)
    foto_url        = Column(String(255), nullable=True)
    observaciones   = Column(Text, nullable=True)
    is_active       = Column(Boolean, default=True)        # Para "darlo de baja" sin borrar histórico
    created_at      = Column(DateTime(timezone=True), default=utcnow)

    # Relaciones
    cliente         = relationship("Cliente", lazy="joined")
    suscripciones   = relationship(
        "SuscripcionParqueadero",
        back_populates="vehiculo",
        cascade="all, delete-orphan",
        order_by="desc(SuscripcionParqueadero.fecha_inicio)"
    )
    accesos         = relationship(
        "AccesoParqueadero",
        back_populates="vehiculo",
        cascade="all, delete-orphan"
    )


# ─── 3. Suscripciones (mensual / quincenal / diario) ─────────────────────────
class TipoSuscripcion(str, enum.Enum):
    MENSUAL    = "mensual"
    QUINCENAL  = "quincenal"
    DIARIA     = "diaria"
    # Nota: "por_horas" NO es suscripción, se maneja como AccesoParqueadero suelto


class EstadoSuscripcion(str, enum.Enum):
    VIGENTE   = "vigente"     # Aún no vencida
    VENCIDA   = "vencida"     # Pasó la fecha_vencimiento
    CANCELADA = "cancelada"   # Anulada manualmente por el dueño


class SuscripcionParqueadero(Base, TenantMixin):
    """
    Cada vez que un cliente paga (mensual/quincenal/diario) se crea una suscripción.
    El estado_pago funciona idéntico a tu modelo Venta: pagado / parcial / pendiente.
    """
    __tablename__ = "suscripciones_parqueadero"

    id                  = Column(Integer, primary_key=True, index=True)
    vehiculo_id         = Column(Integer, ForeignKey("vehiculos.id"), nullable=False, index=True)
    tipo                = Column(Enum(TipoSuscripcion), nullable=False)
    fecha_inicio        = Column(Date, nullable=False)
    fecha_vencimiento   = Column(Date, nullable=False, index=True)

    # Montos
    monto_total         = Column(Float, nullable=False)        # Lo que debe pagar (con override aplicado)
    monto_pagado        = Column(Float, default=0.0)
    estado_pago         = Column(String(20), default="pendiente")  # 'pagado' | 'parcial' | 'pendiente'

    # Estado de la suscripción
    estado              = Column(Enum(EstadoSuscripcion), default=EstadoSuscripcion.VIGENTE)

    # Trazabilidad
    metodo_pago_inicial = Column(String(40), nullable=True)
    observaciones       = Column(Text, nullable=True)

    # Si la suscripción fue retroactiva (cubre días vencidos previos)
    es_retroactiva      = Column(Boolean, default=False)

    created_at          = Column(DateTime(timezone=True), default=utcnow)
    updated_at          = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relaciones
    vehiculo            = relationship("Vehiculo", back_populates="suscripciones")
    pagos               = relationship(
        "PagoParqueadero",
        back_populates="suscripcion",
        cascade="all, delete-orphan"
    )


# ─── 4. Pagos (abonos) sobre suscripciones ───────────────────────────────────
class PagoParqueadero(Base, TenantMixin):
    """
    Pago / abono asociado a una suscripción. Permite pagos parciales.
    Se separa del modelo Pago general porque no apunta a 'ventas' sino a 'suscripciones'.
    """
    __tablename__ = "pagos_parqueadero"

    id              = Column(Integer, primary_key=True, index=True)
    suscripcion_id  = Column(Integer, ForeignKey("suscripciones_parqueadero.id"), nullable=False, index=True)
    monto           = Column(Float, nullable=False)
    metodo_pago     = Column(String(40), nullable=False)   # Efectivo, Transferencia, Nequi, Tarjeta
    fecha           = Column(DateTime(timezone=True), default=utcnow)
    observaciones   = Column(String(255), nullable=True)
    usuario_id      = Column(Integer, ForeignKey("users.id"), nullable=True)  # Quién registró el pago

    suscripcion     = relationship("SuscripcionParqueadero", back_populates="pagos")
    usuario         = relationship("User", lazy="joined")


# ─── 5. Accesos por horas (solo para clientes ocasionales del 5%) ────────────
class EstadoAcceso(str, enum.Enum):
    DENTRO    = "dentro"
    SALIO     = "salio"


class AccesoParqueadero(Base, TenantMixin):
    """
    Solo se usa para clientes que pagan POR MINUTOS (ocasionales).
    """
    __tablename__ = "accesos_parqueadero"

    id              = Column(Integer, primary_key=True, index=True)
    vehiculo_id     = Column(Integer, ForeignKey("vehiculos.id"), nullable=True, index=True)
    placa           = Column(String(10), nullable=False, index=True)

    # ✨ NUEVOS CAMPOS para cliente ocasional
    nombre_ocasional = Column(String(120), nullable=True)   # Nombre tomado al ingresar
    telefono         = Column(String(20), nullable=True)    # Tel. del cliente ocasional para WhatsApp

    fecha_entrada   = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    fecha_salida    = Column(DateTime(timezone=True), nullable=True)

    minutos_cobrados = Column(Integer, nullable=True)        # ✨ NUEVO
    horas_cobradas  = Column(Float, nullable=True)           # se mantiene por compatibilidad
    monto_cobrado   = Column(Float, nullable=True)
    metodo_pago     = Column(String(40), nullable=True)
    estado          = Column(Enum(EstadoAcceso), default=EstadoAcceso.DENTRO)

    observaciones   = Column(String(255), nullable=True)
    usuario_id      = Column(Integer, ForeignKey("users.id"), nullable=True)

    vehiculo        = relationship("Vehiculo", back_populates="accesos")
    usuario         = relationship("User", lazy="joined")





# ═══════════════════════════════════════════════════════════════════════════════
# MÓDULO PARQUEADERO — WHATSAPP + MÉTODOS DE PAGO
# Pega este bloque AL FINAL de tu models.py (después de los modelos del paso anterior)
# ═══════════════════════════════════════════════════════════════════════════════


# ─── 1. Modalidades de pago ───────────────────────────────────────────────────
class ModalidadPago(str, enum.Enum):
    MENSUAL    = "mensual"
    QUINCENAL  = "quincenal"
    DIARIA     = "diaria"
    LIBRE      = "libre"     # pagos sin valor predefinido


# ─── 2. Métodos de pago configurados por modalidad ────────────────────────────
class MetodoPagoParqueadero(Base, TenantMixin):
    """
    Cada modalidad puede tener UN método de pago activo (link, QR o ambos).
    El QR se guarda como base64 directamente en la BD (a prueba de reinicios).
    """
    __tablename__ = "metodos_pago_parqueadero"

    id              = Column(Integer, primary_key=True, index=True)
    modalidad       = Column(Enum(ModalidadPago), nullable=False)
    nombre_metodo   = Column(String(60), nullable=True)    # "Nequi", "Bold", "Daviplata"
    link_pago       = Column(String(500), nullable=True)   # URL completa del link
    qr_base64       = Column(Text, nullable=True)          # Imagen QR codificada en base64
    qr_mime_type    = Column(String(40), nullable=True)    # ej: "image/png", "image/jpeg"
    instrucciones   = Column(Text, nullable=True)          # "Escanea con tu app de banco"
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), default=utcnow)
    updated_at      = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Solo un método activo por modalidad por empresa
    __table_args__ = (
        UniqueConstraint('empresa_id', 'modalidad', name='uq_metodo_empresa_modalidad'),
    )


# ─── 3. Tipos de plantilla de WhatsApp ───────────────────────────────────────
class TipoPlantillaWhatsApp(str, enum.Enum):
    PAGO                = "pago"
    RECORDATORIO        = "recordatorio"
    MANUAL              = "manual"
    COMPROBANTE_ENTRADA = "comprobante_entrada"  # ✨ NUEVO: Faltaba en tu código
    RECIBO_SALIDA       = "recibo_salida"       # ✨ NUEVO: Faltaba en tu código


# ─── 4. Plantillas editables ──────────────────────────────────────────────────
class PlantillaWhatsApp(Base, TenantMixin):
    __tablename__ = "plantillas_whatsapp"

    id              = Column(Integer, primary_key=True, index=True)
    # ✅ CAMBIO: Usamos String(255) en lugar de Enum para total compatibilidad con Postgres
    tipo            = Column(String(255), nullable=False) 
    mensaje         = Column(Text, nullable=False)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), default=utcnow)
    updated_at      = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        UniqueConstraint('empresa_id', 'tipo', name='uq_plantilla_empresa_tipo'),
    )


# ─── 5. Historial de envíos ───────────────────────────────────────────────────
class EnvioWhatsApp(Base, TenantMixin):
    __tablename__ = "envios_whatsapp_parqueadero"

    id              = Column(Integer, primary_key=True, index=True)
    vehiculo_id     = Column(Integer, ForeignKey("vehiculos.id"), nullable=True)
    suscripcion_id  = Column(Integer, ForeignKey("suscripciones_parqueadero.id"), nullable=True)
    telefono        = Column(String(20), nullable=False)
    # ✅ CAMBIO: Usamos String(255) aquí también
    tipo            = Column(String(255), nullable=False)
    mensaje_enviado = Column(Text, nullable=True)
    usuario_id      = Column(Integer, ForeignKey("users.id"), nullable=True)
    fecha           = Column(DateTime(timezone=True), default=utcnow, index=True)

    vehiculo        = relationship("Vehiculo", lazy="joined")
    usuario         = relationship("User", lazy="joined")





# ═══════════════════════════════════════════════════════════════════════════════
# MODELO — CredencialBiometrica
# Pega al final de tu models.py
# ═══════════════════════════════════════════════════════════════════════════════

class CredencialBiometrica(Base):
    """
    Una credencial WebAuthn registrada para un usuario en un dispositivo
    específico. Un usuario puede tener N credenciales (ej. su iPhone, su laptop,
    su PC del trabajo) y cada una se gestiona independientemente.

    NOTA: Esta tabla NO usa TenantMixin porque es global a nivel de usuario,
    no a nivel de empresa. Un usuario puede acceder con su huella sin importar
    en qué empresa está actuando.
    """
    __tablename__ = "credenciales_biometricas"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Identificador único generado por el dispositivo (base64url)
    credential_id   = Column(Text, nullable=False, unique=True, index=True)

    # Clave pública del par criptográfico (la privada nunca sale del dispositivo)
    public_key      = Column(Text, nullable=False)

    # Contador anti-replay (se incrementa en cada uso)
    sign_count      = Column(BigInteger, default=0)

    # Metadata para mostrar al usuario
    device_name     = Column(String(120), nullable=True)   # "Samsung Galaxy A52", "iPhone de Keilor"
    user_agent      = Column(String(500), nullable=True)   # browser/SO completo
    transports      = Column(String(120), nullable=True)   # "internal,hybrid" — cómo se autentica

    # Auditoría
    last_used_at    = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), default=utcnow)

    # Relación con User
    usuario         = relationship("User", back_populates="credenciales_biometricas", lazy="joined")


# ═══════════════════════════════════════════════════════════════════════════════
# MODIFICACIÓN AL MODELO USER — añadir relación inversa
# Busca tu clase User en models.py y añade esta línea junto a las otras
# relaciones (relationships) que ya tenga:
# ═══════════════════════════════════════════════════════════════════════════════

# class User(Base, TenantMixin):
#     __tablename__ = "users"
#     ... (campos existentes) ...
#
#     # ✨ AÑADIR esta relación junto a las demás:
#     credenciales_biometricas = relationship(
#         "CredencialBiometrica",
#         back_populates="usuario",
#         cascade="all, delete-orphan"
#     )


# ═══════════════════════════════════════════════════════════════════════════════
# IMPORTS NECESARIOS
# Verifica que en el TOPE de models.py tengas estos imports. Si falta alguno,
# agrégalo:
# ═══════════════════════════════════════════════════════════════════════════════

# from sqlalchemy import (
#     Column, Integer, String, Text, BigInteger, DateTime, ForeignKey, Boolean,
#     Float, Date, Enum, UniqueConstraint
# )
# from sqlalchemy.orm import relationship
# # ... resto de imports ...
