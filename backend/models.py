
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

from core.constants import PlanType, AccessStatus, SaaSJobStatus, SaaSAnnouncementType

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

    # 👇 NUEVOS CAMPOS CATÁLOGO VIRTUAL
    slug_catalogo     = Column(String(100), unique=True, index=True, nullable=True)
    whatsapp_pedidos  = Column(String(20), nullable=True)
    logo_base64       = Column(Text, nullable=True) # WebP comprimido

    # Opcional: relación inversa para acceder a sus usuarios
    usuarios = relationship("User", back_populates="empresa")

    plan_type = Column(String, default=PlanType.TRIAL) # trial, premium, vitalicio, canceled
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)

    # 👇 NUEVAS COLUMNAS PARA WOMPI (Cobro Recurrente)
    wompi_customer_id = Column(String, nullable=True) # Identificador del cliente en Wompi
    wompi_payment_source_id = Column(String, nullable=True) # El "Token" de la tarjeta encriptada

    # 👇 NUEVA COLUMNA PARA CONTROL SAAS (Feature Toggles)
    # Guardará una lista de paths, ej: ["/clientes", "/prestamos", "/ruta-cobro"]
    # Si es NULL, significa que la empresa tiene acceso a TODO (retrocompatibilidad para tu fábrica actual)

    modulos_habilitados = Column(JSON, nullable=True) # Guarda ["/ruta1", "/ruta2"]

    # 👇 NUEVOS CAMPOS FASE 1 - VISIBILIDAD
    last_activity_at = Column(DateTime(timezone=True), nullable=True)

    # 👇 NUEVOS CAMPOS FASE 2 - AUTOMATIZACIÓN
    is_protected = Column(Boolean, default=False) # QA, Partners, Demos

    # 🧾 CAMPOS FACTURACIÓN ELECTRÓNICA (DIAN / MATIAS API)
    dv                    = Column(String(1), nullable=True)  # Dígito de Verificación
    tipo_organizacion_id  = Column(Integer, default=1)        # 1: Jurídica, 2: Natural
    tipo_regimen_id       = Column(Integer, default=48)       # 48: Responsable IVA, 49: No responsable
    responsabilidad_fiscal_codes = Column(String, default="O-13") # ej: "O-13, O-15"
    matricula_mercantil   = Column(String, nullable=True)
    departamento_code     = Column(String(5), nullable=True)  # ej: "05" (Antioquia)
    ciudad_code           = Column(String(5), nullable=True)  # ej: "05001" (Medellín)
    correo_facturacion    = Column(String, nullable=True)     # Donde llegan las notificaciones DIAN

    # Configuración de Integración
    facturacion_electronica_activa = Column(Boolean, default=False)
    matias_api_key        = Column(String, nullable=True)
    matias_test_mode      = Column(Boolean, default=True)

    # Configuración de ventas
    omitir_inventario     = Column(Boolean, default=False)

    # Programa de fidelización (puntos canjeables)
    fidelizacion_activa      = Column(Boolean, default=True)
    fidelizacion_earn_rate   = Column(Integer, default=1000)  # COP por punto ganado
    fidelizacion_redeem_rate = Column(Integer, default=100)   # COP de descuento por punto


class SaaSAnnouncement(Base):
    """Anuncios globales para todos los inquilinos"""
    __tablename__ = "saas_announcements"
    id          = Column(Integer, primary_key=True, index=True)
    titulo      = Column(String(100))
    mensaje     = Column(Text)
    tipo        = Column(String(20), default=SaaSAnnouncementType.INFO) 
    is_active   = Column(Boolean, default=True)
    expires_at  = Column(DateTime(timezone=True), nullable=True)
    created_at  = Column(DateTime(timezone=True), default=utcnow)
    created_by  = Column(Integer, ForeignKey("users.id"))


class SaaSJobRegistry(Base):
    """Control de ejecución y locking de tareas programadas"""
    __tablename__ = "saas_jobs_registry"
    id              = Column(Integer, primary_key=True, index=True)
    job_name        = Column(String(100), index=True) # ej: "AUTO_EXPIRATION"
    execution_id    = Column(String(100), unique=True)
    status          = Column(String(20)) # running, success, failed
    started_at      = Column(DateTime(timezone=True), default=utcnow)
    finished_at     = Column(DateTime(timezone=True), nullable=True)
    metrics         = Column(JSON, nullable=True) # Summary statistics
    error_log       = Column(Text, nullable=True)


class SaaSAuditLog(Base):
    """Registro de acciones críticas realizadas por SuperAdmins"""
    __tablename__ = "saas_audit_logs"
    id          = Column(Integer, primary_key=True, index=True)
    admin_id    = Column(Integer, ForeignKey("users.id"))
    empresa_id  = Column(Integer, ForeignKey("empresas.id"), nullable=True)
    accion      = Column(String(100)) # ej: "CHANGE_PLAN", "SUSPEND", "ACTIVATE"
    detalle     = Column(JSON, nullable=True)
    fecha       = Column(DateTime(timezone=True), default=utcnow)

    admin   = relationship("User")
    empresa = relationship("Empresa")


class TipoNegocioConfig(Base):
    """Módulos por defecto según tipo de negocio (configurable por SuperAdmin)"""
    __tablename__ = "tipo_negocio_config"
    tipo    = Column(String(50), primary_key=True)
    label   = Column(String(100), nullable=True)
    modulos = Column(JSON, nullable=False)


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


# ... (tus otros imports)

class Role(Base, TenantMixin): # ✅ 1. Heredar de TenantMixin
    __tablename__ = "roles"
    id      = Column(Integer, primary_key=True, index=True)
    name    = Column(String, index=True) # ✅ 2. Quitar el unique=True de aquí

    users   = relationship("User", back_populates="role")
    modules = relationship("Modulo", secondary="role_modules", back_populates="roles")

    # ✅ 3. Añadir restricción: El nombre del rol no se puede repetir DENTRO de la misma empresa
    __table_args__ = (
        UniqueConstraint('name', 'empresa_id', name='uq_role_name_per_empresa'),
    )

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
    __table_args__ = (
        UniqueConstraint('username', 'empresa_id', name='uq_user_username_empresa'),
    )
    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String, index=True)
    hashed_password = Column(String)
    role_id         = Column(Integer, ForeignKey("roles.id"))

    is_active       = Column(Boolean, default=True)
    nombre_completo = Column(String(120), nullable=True)
    email           = Column(String(120), nullable=True, index=True)
    telefono        = Column(String(30),  nullable=True)

    # PIN de acceso rápido (4-6 dígitos, almacenado como bcrypt hash)
    pin_hash            = Column(String, nullable=True)
    pin_attempts        = Column(Integer, default=0)
    pin_locked_until    = Column(DateTime(timezone=True), nullable=True)


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

    # 🧾 CAMPOS FACTURACIÓN ELECTRÓNICA (DIAN)
    email                 = Column(String, index=True, nullable=True) # Obligatorio para FE
    tipo_documento_id     = Column(Integer, default=13)       # 13: Cédula, 31: NIT, etc.
    dv                    = Column(String(1), nullable=True)  # Dígito de Verificación (para NIT)
    tipo_organizacion_id  = Column(Integer, default=2)        # 1: Jurídica, 2: Natural
    tipo_regimen_id       = Column(Integer, default=49)       # 48: Responsable IVA, 49: No responsable
    responsabilidad_fiscal_codes = Column(String, default="R-99-PN")
    departamento_code     = Column(String(5), nullable=True)
    ciudad_code           = Column(String(5), nullable=True)

    # 🌍 LOGÍSTICA & RUTAS
    zona = Column(String(60), nullable=True, index=True) # ej: "Norte", "Barrio El Centro", "Ruta 1"
    latitud = Column(Float, nullable=True)
    longitud = Column(Float, nullable=True)
    puntos_fidelidad = Column(Integer, default=0)

    ventas          = relationship("Venta", back_populates="cliente")
    ordenes_trabajo = relationship("OrdenTrabajo", back_populates="cliente")
    movimientos_puntos = relationship("MovimientoPuntos", back_populates="cliente", cascade="all, delete-orphan")


class MovimientoPuntos(Base, TenantMixin):
    __tablename__ = "movimientos_puntos"
    id          = Column(Integer, primary_key=True, index=True)
    cliente_id  = Column(Integer, ForeignKey("clientes.id"), nullable=False, index=True)
    puntos      = Column(Integer, nullable=False)           # positivo=ganado, negativo=canjeado
    tipo        = Column(String(20), nullable=False)        # 'ganado' | 'canjeado'
    venta_id    = Column(Integer, ForeignKey("ventas.id"), nullable=True)
    descripcion = Column(String(255), nullable=True)
    created_at  = Column(DateTime(timezone=True), default=utcnow)

    cliente = relationship("Cliente", back_populates="movimientos_puntos")


class GrupoProducto(Base):
    """
    Categorías/grupos de productos.
    - empresa_id = NULL → grupo predefinido del sistema (compartido por todos los tenants)
    - empresa_id = X   → grupo personalizado creado por el tenant X
    Los productos referencian el id de esta tabla en grupo_item.
    Los flags requiere_cocina y visible_pos pueden ser sobreescritos por empresa
    usando la tabla empresa_grupo_config.
    """
    __tablename__ = "grupos_producto"
    id             = Column(Integer, primary_key=True, index=True)
    empresa_id     = Column(Integer, ForeignKey('empresas.id'), nullable=True, index=True)
    nombre         = Column(String(100), nullable=False)
    codigo         = Column(String(20), nullable=False)
    color          = Column(String(20), default='#94a3b8')
    es_predefinido = Column(Boolean, default=False)
    orden          = Column(Integer, default=99)
    requiere_cocina = Column(Boolean, default=False)
    visible_pos    = Column(Boolean, default=True, nullable=False)

    empresa = relationship("Empresa")


class EmpresaGrupoConfig(Base):
    """
    Override por-empresa de los flags de una categoría (predefinida o custom).
    Si existe una fila aquí para (empresa_id, grupo_id), sus valores prevalecen
    sobre los del GrupoProducto compartido.
    """
    __tablename__ = "empresa_grupo_config"
    empresa_id      = Column(Integer, ForeignKey('empresas.id'), primary_key=True)
    grupo_id        = Column(Integer, ForeignKey('grupos_producto.id'), primary_key=True)
    requiere_cocina = Column(Boolean, nullable=True)  # None → usar valor del grupo
    visible_pos     = Column(Boolean, nullable=True)  # None → usar valor del grupo


class Producto(Base, TenantMixin):
    __tablename__ = "productos"
    id            = Column(Integer, primary_key=True, index=True)
    sku           = Column(String, index=True, nullable=True)
    nombre        = Column(String, index=True)
    codigo_barras = Column(String, index=True, nullable=True) # ✨ NUEVO: Para búsqueda ágil
    descripcion   = Column(Text, nullable=True)               # ✨ NUEVO: Característica opcional
    precio        = Column(Float)
    costo         = Column(Float, default=0.0)
    es_servicio   = Column(Boolean, default=False)
    unidad_medida = Column(String, default="UND")
    stock_actual  = Column(Float, default=0.0)
    stock_minimo  = Column(Float, default=0.0)
    grupo_item    = Column(Integer, default=2)
    vigente       = Column(Boolean, default=True, nullable=False, index=True)
    
    # 👇 NUEVA COLUMNA: Control maestro para perecederos
    maneja_lotes  = Column(Boolean, default=False)

    # 👇 NUEVOS CAMPOS CATÁLOGO VIRTUAL
    imagenes            = Column(JSON, nullable=True) # JSON list de WebP comprimidos
    mostrar_en_catalogo = Column(Boolean, default=False, index=True)

    comision_pct = Column(Float, nullable=True)  # Per-service commission override; None = use global

    # Ej: caja de 4 carnes → costo=$12.000, unidades_por_empaque=4 → costo real por unidad=$3.000
    unidades_por_empaque = Column(Float, default=1.0, nullable=False)

    tiene_variantes = Column(Boolean, default=False)
    variantes = relationship("ProductoVariante", back_populates="producto", cascade="all, delete-orphan")
    lotes = relationship("LoteExistencia", back_populates="producto", cascade="all, delete-orphan")
    grupo = relationship("GrupoProducto", foreign_keys=[grupo_item], primaryjoin="Producto.grupo_item == GrupoProducto.id", lazy="joined")

    @property
    def requiere_cocina(self) -> bool:
        return bool(self.grupo and self.grupo.requiere_cocina)

    @property
    def categoria(self) -> str:
        return self.grupo.nombre if self.grupo else 'Sin categoría'

class ProductoVariante(Base, TenantMixin):
    __tablename__ = "producto_variantes"
    id           = Column(Integer, primary_key=True, index=True)
    producto_id  = Column(Integer, ForeignKey("productos.id", ondelete="CASCADE"), nullable=False, index=True)
    sku          = Column(String(100), nullable=False, index=True)
    nombre       = Column(String(200), nullable=False)
    atributos    = Column(JSON, default={})   # {"color": "Azul", "talla": "M", "presentacion": "500g"}
    precio       = Column(Float, nullable=True)   # None = inherit from parent
    costo        = Column(Float, nullable=True)   # None = inherit from parent
    stock_actual = Column(Float, default=0.0)
    stock_minimo = Column(Float, default=0.0)
    activo       = Column(Boolean, default=True)
    producto     = relationship("Producto", back_populates="variantes")


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
    usuario_id     = Column(Integer, ForeignKey("users.id"), nullable=True)

    lote_id     = Column(Integer, ForeignKey("lotes_existencias.id"), nullable=True)
    numero_lote = Column(String(100), nullable=True)
    lote        = relationship("LoteExistencia", back_populates="movimientos")

    producto = relationship("Producto", lazy="joined")
    usuario  = relationship("User", foreign_keys=[usuario_id])

class DetalleVenta(Base, TenantMixin):
    __tablename__ = "detalles_venta"
    id               = Column(Integer, primary_key=True, index=True)
    venta_id         = Column(Integer, ForeignKey("ventas.id"))
    producto_id      = Column(Integer, ForeignKey("productos.id"), nullable=True)   # nullable: libre items have no product
    nombre_libre     = Column(String(200), nullable=True)   # description for libre items
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
    clave_tecnica     = Column(String(200), nullable=True)   # Clave técnica DIAN para FE
    nota              = Column(Text, nullable=True)           # Observaciones internas



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

    # 🧾 CAMPOS FACTURACIÓN ELECTRÓNICA (DIAN / MATIAS API)
    cufe                = Column(String, nullable=True, index=True)
    qr_data             = Column(Text, nullable=True)
    xml_url             = Column(String, nullable=True)
    pdf_url             = Column(String, nullable=True)
    estado_electronico  = Column(String, default="no_enviado") # 'no_enviado', 'exitoso', 'fallido'
    mensaje_proveedor   = Column(Text, nullable=True)

    # Lavadero de vehículos
    operador_id     = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    placa_vehiculo  = Column(String(15), nullable=True)
    tipo_vehiculo   = Column(String(20), nullable=True)

    cliente                = relationship("Cliente", back_populates="ventas")
    detalles               = relationship("DetalleVenta", back_populates="venta", cascade="all, delete-orphan")
    pagos                  = relationship("Pago", back_populates="venta", cascade="all, delete-orphan")
    orden_trabajo_asociada = relationship("OrdenTrabajo", back_populates="venta_asociada", uselist=False)
    operador               = relationship("User", foreign_keys=[operador_id])

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
    categoria   = Column(String, nullable=True)  # ej: Arriendo, Servicios, Nómina
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
    is_featured = Column(Boolean, default=False)


class RegistroPago(Base):
    __tablename__ = "registros_pagos"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"))
    plan_id = Column(Integer, ForeignKey("planes_suscripcion.id"))
    monto = Column(Float)
    moneda = Column(String)
    metodo_pago = Column(String)
    bold_tx_id = Column(String, unique=True, index=True)
    email_pagador = Column(String)
    fecha_pago = Column(DateTime(timezone=True), server_default=func.now())
    payload_auditoria = Column(JSON)

    empresa = relationship("Empresa")
    plan = relationship("PlanSuscripcion")

    __table_args__ = (
        UniqueConstraint('bold_tx_id', name='uq_registros_pagos_bold_tx_id'),
    )



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
    tasa_mora = Column(Float, default=2.0)  # % mensual

    # Para refinanciación
    prestamo_anterior_id = Column(Integer, ForeignKey("prestamos.id"), nullable=True)

    cliente = relationship("Cliente")
    cuotas = relationship("CuotaPrestamo", back_populates="prestamo", cascade="all, delete-orphan")

    usuario_asignado_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    cobrador = relationship("User")
    
    refinanciado_de = relationship("Prestamo", remote_side=[id])

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
    metodo_pago = Column(String, nullable=True)  # Efectivo, Transferencia, Nequi, Tarjeta
    usuario_asignado_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    cobrador = relationship("User")
    prestamo = relationship("Prestamo", back_populates="cuotas")
    evidencias = relationship("EvidenciaCobro", back_populates="cuota", cascade="all, delete-orphan")

class EvidenciaCobro(Base, TenantMixin):
    """Registro fotográfico y geolocalizado de visitas de cobro (No encontrado, Local cerrado, etc)"""
    __tablename__ = "evidencias_cobro"
    id           = Column(Integer, primary_key=True, index=True)
    cuota_id     = Column(Integer, ForeignKey("cuotas_prestamo.id"), index=True)
    usuario_id   = Column(Integer, ForeignKey("users.id"))
    tipo         = Column(String(30)) # "No encontrado", "Local cerrado", "Promesa de pago", "Otro"
    comentario   = Column(Text, nullable=True)
    foto_url     = Column(String(255), nullable=True)
    latitud      = Column(Float, nullable=True)
    longitud     = Column(Float, nullable=True)
    fecha        = Column(DateTime(timezone=True), default=utcnow)

    cuota        = relationship("CuotaPrestamo", back_populates="evidencias")
    usuario      = relationship("User")



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
    tipo_impresora_parq   = Column(String(10), default='p80')
    preferir_impresion    = Column(Boolean, default=False)
    created_at            = Column(DateTime(timezone=True), default=utcnow)
    updated_at            = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


# ─── 2. Vehículos ────────────────────────────────────────────────────────────
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
    fecha_baja      = Column(DateTime(timezone=True), nullable=True)
    motivo_baja     = Column(String(500), nullable=True)

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


# ─── 6. Histórico de precios del Cacao ───────────────────────────────────────
class HistoricoPrecioCacao(Base):
    """
    Almacena el histórico de precios internacionales (USD) y locales (COP) del cacao.
    Permite calcular tendencias a corto y largo plazo.
    """
    __tablename__ = "historico_precio_cacao"

    id             = Column(Integer, primary_key=True, index=True)
    precio_cop_kg  = Column(Float, nullable=False)
    precio_usd_ton = Column(Float, nullable=False)
    trm_cop        = Column(Float, nullable=False)
    fecha          = Column(DateTime(timezone=True), default=utcnow, index=True)


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

# ═══════════════════════════════════════════════════════════════════════════════
# WEBAUTHN CHALLENGES (PERSISTENCIA PARA MULTI-WORKER)
# ═══════════════════════════════════════════════════════════════════════════════

class BiometricChallenge(Base):
    """
    Almacena temporalmente los challenges de WebAuthn para que funcionen
    en entornos con múltiples workers (Gunicorn/Uvicorn).
    """
    __tablename__ = "biometric_challenges"

    key        = Column(String(100), primary_key=True, index=True) # ej: "reg:5" o "auth:12"
    challenge  = Column(Text, nullable=False)                      # Challenge en base64
    expires_at = Column(Float, nullable=False)                     # Timestamp de expiración


# ═══════════════════════════════════════════════════════════════════════════════
# PEDIDOS TIENDA VIRTUAL
# ═══════════════════════════════════════════════════════════════════════════════

class EstadoPedidoVirtual(str, enum.Enum):
    nuevo          = "nuevo"
    confirmado     = "confirmado"
    en_preparacion = "en_preparacion"
    enviado        = "enviado"
    entregado      = "entregado"
    cancelado      = "cancelado"


class PedidoVirtual(Base, TenantMixin):
    __tablename__ = "pedidos_virtuales"

    id               = Column(Integer, primary_key=True, index=True)
    nombre_cliente   = Column(String(200), nullable=False)
    celular_cliente  = Column(String(30),  nullable=False)
    email_cliente    = Column(String(200), nullable=True)
    tipo_entrega     = Column(String(20),  default="tienda")   # "domicilio" | "tienda"
    direccion_entrega= Column(String(300), nullable=True)
    comentarios      = Column(Text,        nullable=True)
    estado           = Column(Enum(EstadoPedidoVirtual), default=EstadoPedidoVirtual.nuevo, index=True)
    total            = Column(Float, default=0.0)
    stock_descontado = Column(Boolean, default=False)
    venta_id         = Column(Integer, ForeignKey("ventas.id"), nullable=True)
    notas_internas   = Column(Text, nullable=True)
    fecha_creacion        = Column(DateTime(timezone=True), default=utcnow)
    fecha_actualizacion   = Column(DateTime(timezone=True), nullable=True)

    detalles = relationship("DetallePedidoVirtual", back_populates="pedido", cascade="all, delete-orphan")
    venta    = relationship("Venta", foreign_keys=[venta_id])


class DetallePedidoVirtual(Base, TenantMixin):
    __tablename__ = "detalles_pedido_virtual"

    id              = Column(Integer, primary_key=True, index=True)
    pedido_id       = Column(Integer, ForeignKey("pedidos_virtuales.id"), nullable=False)
    producto_id     = Column(Integer, ForeignKey("productos.id"), nullable=True)
    nombre_producto = Column(String(300), nullable=False)   # snapshot del nombre
    cantidad        = Column(Float, nullable=False)
    precio_unitario = Column(Float, nullable=False)
    subtotal        = Column(Float, nullable=False)

    pedido   = relationship("PedidoVirtual", back_populates="detalles")
    producto = relationship("Producto", lazy="joined")


# ═══════════════════════════════════════════════════════════════════════════════
# IMPUESTOS
# ═══════════════════════════════════════════════════════════════════════════════

class TipoImpuesto(Base):
    """Catálogo de tipos de impuesto por empresa (IVA 19%, IVA 5%, INC 8%, Excluido…)"""
    __tablename__ = "tipos_impuesto"

    id          = Column(Integer, primary_key=True, index=True)
    empresa_id  = Column(Integer, ForeignKey("empresas.id"), nullable=False, index=True)
    nombre      = Column(String(100), nullable=False)
    codigo      = Column(String(20),  nullable=False)
    porcentaje  = Column(Float, nullable=False, default=0.0)
    descripcion = Column(Text, nullable=True)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), default=utcnow)

    empresa = relationship("Empresa")


class ProductoImpuesto(Base):
    """Relación Producto ↔ TipoImpuesto (one-to-one por tenant)"""
    __tablename__ = "producto_impuestos"

    id          = Column(Integer, primary_key=True, index=True)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)
    impuesto_id = Column(Integer, ForeignKey("tipos_impuesto.id"), nullable=False)
    empresa_id  = Column(Integer, ForeignKey("empresas.id"), nullable=False, index=True)

    __table_args__ = (UniqueConstraint("producto_id", "empresa_id", name="uq_producto_empresa_impuesto"),)

    producto      = relationship("Producto")
    tipo_impuesto = relationship("TipoImpuesto")


# ═══════════════════════════════════════════════════════════════════════════════
# MÓDULO RESTAURANTE
# ═══════════════════════════════════════════════════════════════════════════════

class Mesa(Base):
    """Mesa física del restaurante — estado en tiempo real."""
    __tablename__ = "restaurante_mesas"

    id         = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False, index=True)
    numero     = Column(String(20), nullable=False)           # "1", "A3", "Barra-2"
    nombre     = Column(String(60), nullable=True)            # nombre descriptivo opcional
    capacidad  = Column(Integer, default=4)
    zona       = Column(String(60), nullable=True)            # "Salón", "Terraza", "Barra"
    estado     = Column(String(20), default="libre")          # libre | ocupada | en_cuenta | reservada
    pos_x      = Column(Float, default=10.0)                  # % horizontal en el mapa (0-100)
    pos_y      = Column(Float, default=10.0)                  # % vertical en el mapa (0-100)
    is_active  = Column(Boolean, default=True)

    empresa    = relationship("Empresa")
    comandas   = relationship("Comanda", back_populates="mesa")

    __table_args__ = (UniqueConstraint("empresa_id", "numero", "zona", name="uq_mesa_numero_zona_empresa"),)


class Comanda(Base):
    """Orden abierta para una mesa — puede tener múltiples rondas de pedidos."""
    __tablename__ = "restaurante_comandas"

    id              = Column(Integer, primary_key=True, index=True)
    empresa_id      = Column(Integer, ForeignKey("empresas.id"), nullable=False, index=True)
    mesa_id         = Column(Integer, ForeignKey("restaurante_mesas.id"), nullable=False)
    mesero_id       = Column(Integer, ForeignKey("users.id"), nullable=True)
    numero_comanda  = Column(Integer, nullable=False)          # consecutivo diario por empresa
    personas        = Column(Integer, default=1)
    notas           = Column(Text, nullable=True)
    estado          = Column(String(20), default="abierta")    # abierta | enviada | lista | cerrada | cancelada
    total           = Column(Float, default=0.0)
    venta_id        = Column(Integer, ForeignKey("ventas.id"), nullable=True)
    fecha_apertura  = Column(DateTime(timezone=True), default=utcnow)
    fecha_cierre    = Column(DateTime(timezone=True), nullable=True)

    empresa = relationship("Empresa")
    mesa    = relationship("Mesa", back_populates="comandas")
    mesero  = relationship("User")
    items   = relationship("ComandaItem", back_populates="comanda", cascade="all, delete-orphan")


class ComandaItem(Base):
    """Ítem individual de una comanda — snapshot de precio + estado de cocina."""
    __tablename__ = "restaurante_comanda_items"

    id              = Column(Integer, primary_key=True, index=True)
    comanda_id      = Column(Integer, ForeignKey("restaurante_comandas.id"), nullable=False)
    producto_id     = Column(Integer, ForeignKey("productos.id"), nullable=True)
    nombre_producto = Column(String(200), nullable=False)      # snapshot
    cantidad        = Column(Float, default=1.0)
    precio_unitario = Column(Float, default=0.0)              # snapshot
    subtotal        = Column(Float, default=0.0)
    notas           = Column(String(300), nullable=True)       # "sin cebolla", "extra picante"
    area_cocina     = Column(String(60), nullable=True)        # "Parrilla", "Bebidas", "Postres"
    estado          = Column(String(20), default="pendiente")  # pendiente | en_preparacion | listo | entregado | cancelado
    va_a_cocina     = Column(Boolean, default=True)  # False → bebidas/snacks, no aparece en pantalla cocina
    timestamp_pedido = Column(DateTime(timezone=True), default=utcnow)
    timestamp_listo  = Column(DateTime(timezone=True), nullable=True)

    comanda  = relationship("Comanda", back_populates="items")
    producto = relationship("Producto")


class ConfigRestaurante(Base):
    """Configuración del módulo restaurante por empresa."""
    __tablename__ = "restaurante_config"

    id                      = Column(Integer, primary_key=True, index=True)
    empresa_id              = Column(Integer, ForeignKey("empresas.id"), nullable=False, unique=True)
    areas_cocina            = Column(JSON, default=lambda: ["Cocina general"])
    zonas_sala              = Column(JSON, default=lambda: ["Salón principal"])
    tiempo_cocina_estimado  = Column(Integer, default=15)     # minutos estimados
    propina_sugerida_pct    = Column(Float, default=10.0)
    permitir_nota_por_item          = Column(Boolean, default=True)
    imprimir_comanda_auto           = Column(Boolean, default=False)
    tipo_impresora                  = Column(String(10), default='p80')
    mesero_puede_cobrar_directo     = Column(Boolean, default=False)

    empresa = relationship("Empresa")



# ═══════════════════════════════════════════════════════════════════════════════
# LINK DE PAGO POS — Configuración por empresa
# ═══════════════════════════════════════════════════════════════════════════════

class TipoLinkPago(str, enum.Enum):
    QR_IMAGEN = "qr_imagen"   # imagen subida manualmente
    URL       = "url"         # URL → QR generado automáticamente en frontend


class LinkPagoEmpresa(Base, TenantMixin):
    """
    Un único link/QR de pago activo por empresa para usar en el POS.
    Permite a cada negocio configurar su propia pasarela (Nequi, Bold, Bancolombia, etc.)
    """
    __tablename__ = "links_pago_empresa"

    id            = Column(Integer, primary_key=True, index=True)
    nombre        = Column(String(100), nullable=False)          # "Nequi empresa", "Bold QR"
    tipo          = Column(Enum(TipoLinkPago), nullable=False, default=TipoLinkPago.URL)
    link_url      = Column(String(500), nullable=True)           # URL si tipo=URL
    qr_base64     = Column(Text, nullable=True)                  # base64 si tipo=QR_IMAGEN
    qr_mime_type  = Column(String(40), nullable=True)            # "image/png"
    instrucciones = Column(Text, nullable=True)                  # "Escanea y paga"
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime(timezone=True), default=utcnow)
    updated_at    = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    empresa = relationship("Empresa")


# ═══════════════════════════════════════════════════════════════════════════════
# MÓDULO LAVADERO — Tablero de órdenes con estados
# ═══════════════════════════════════════════════════════════════════════════════

class LavaderoOrden(Base, TenantMixin):
    __tablename__ = "lavadero_ordenes"
    id              = Column(Integer, primary_key=True, index=True)
    placa           = Column(String(15), nullable=False, index=True)
    tipo_vehiculo   = Column(String(20), nullable=True)
    estado          = Column(String(20), default='recibido', nullable=False, index=True)
    operador_id     = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    cliente_id      = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    observaciones   = Column(Text, nullable=True)
    fecha_entrada   = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    fecha_salida    = Column(DateTime(timezone=True), nullable=True)
    total           = Column(Float, nullable=True)
    metodo_pago     = Column(String(50), nullable=True)
    pagado          = Column(Boolean, default=False)
    venta_id        = Column(Integer, ForeignKey("ventas.id"), nullable=True)

    operador  = relationship("User", foreign_keys=[operador_id])
    cliente   = relationship("Cliente")
    detalles  = relationship("LavaderoOrdenDetalle", back_populates="orden", cascade="all, delete-orphan")


class LavaderoOrdenDetalle(Base, TenantMixin):
    __tablename__ = "lavadero_orden_detalles"
    id              = Column(Integer, primary_key=True, index=True)
    orden_id        = Column(Integer, ForeignKey("lavadero_ordenes.id"), nullable=False, index=True)
    producto_id     = Column(Integer, ForeignKey("productos.id"), nullable=True)
    nombre_servicio = Column(String(200), nullable=False)
    cantidad        = Column(Float, default=1.0)
    precio_unitario = Column(Float, nullable=False)
    comision_pct    = Column(Float, default=0.0)

    orden    = relationship("LavaderoOrden", back_populates="detalles")
    producto = relationship("Producto")


class LavaderoConfig(Base, TenantMixin):
    __tablename__ = "lavadero_config"
    id                  = Column(Integer, primary_key=True, index=True)
    comision_pct_global = Column(Float, default=30.0)
    tipo_impresora      = Column(String(10), default='p80')
    imprimir_recibo     = Column(Boolean, default=True)
    nombre_lavadero     = Column(String(120), nullable=True)
    created_at          = Column(DateTime(timezone=True), default=utcnow)
    updated_at          = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
