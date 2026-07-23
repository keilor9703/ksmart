

# =========================
# MULTI-TENANT (EMPRESAS) & SAAS
# =========================

import json
from pydantic import BaseModel, ConfigDict, validator, field_validator, Field, EmailStr
from typing import Optional, List
from datetime import datetime, date, timezone
from enum import Enum

# Helper para normalizar datetimes en toda la API
def ensure_utc(v):
    if v and isinstance(v, datetime) and v.tzinfo is None:
        return v.replace(tzinfo=timezone.utc)
    return v

class EmpresaBase(BaseModel):
    nombre: str
    nit: Optional[str] = None
    logo_url: Optional[str] = None
    color_primario: str = "#F43F5E"
    plan_type: Optional[str] = "trial"
    trial_ends_at: Optional[datetime] = None
    modulos_habilitados: Optional[List[str]] = None
    is_protected: bool = False
    tipo_negocio: Optional[str] = "erp"

    # 👇 NUEVOS CAMPOS CATÁLOGO VIRTUAL
    slug_catalogo: Optional[str] = None
    whatsapp_pedidos: Optional[str] = None
    logo_base64: Optional[str] = None
    ciudad: Optional[str] = None
    descripcion: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None

    # 👇 CENTRO COMERCIAL VIRTUAL (directorio público multi-empresa)
    visible_marketplace: bool = False
    categoria_marketplace: Optional[str] = None

    # 🧾 CAMPOS FACTURACIÓN ELECTRÓNICA
    dv: Optional[str] = None
    tipo_organizacion_id: int = 1
    tipo_regimen_id: int = 48
    responsabilidad_fiscal_codes: str = "O-13"
    matricula_mercantil: Optional[str] = None
    departamento_code: Optional[str] = None
    ciudad_code: Optional[str] = None
    correo_facturacion: Optional[str] = None
    facturacion_electronica_activa: bool = False
    matias_api_key: Optional[str] = None
    matias_test_mode: bool = True

    # ✅ FIX: La BD guarda esto como string JSON, Pydantic necesita lista
    @validator('modulos_habilitados', pre=True, always=True)
    def parse_modulos_habilitados(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return []
        return v  # Si ya es lista o None, pasa directo

class EmpresaCreate(EmpresaBase):
    tipo_negocio: Optional[str] = "erp"

class Empresa(EmpresaBase):
    id: int
    is_active: bool
    is_plan_expired: bool = False  # 🚀 CAMBIO CORE: Disponible en todo el sistema
    model_config = ConfigDict(from_attributes=True)

    @validator('is_plan_expired', pre=True, always=True)
    def check_expiration(cls, v, values):
        """Calcula si el plan ha expirado en tiempo real"""
        # En Pydantic v1/v2, 'values' puede ser un dict o el objeto base
        trial_ends_at = values.get('trial_ends_at')
        empresa_id = values.get('id')
        is_protected = values.get('is_protected', False)

        if not trial_ends_at or empresa_id == 1 or is_protected:
            return False
            
        ahora = datetime.now(timezone.utc)
        # Aseguramos que trial_ends_at sea timezone-aware
        if trial_ends_at.tzinfo is None:
            trial_ends_at = trial_ends_at.replace(tzinfo=timezone.utc)
            
        return ahora > trial_ends_at

class EmpresaOut(EmpresaBase):
    id: int
    is_active: bool
    is_plan_expired: bool = False
    created_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

    @validator('created_at', 'last_activity_at', pre=True, always=True)
    def normalize_dt(cls, v):
        return ensure_utc(v)
    
    # Redundante aquí pero mantenemos por consistencia de tipos
    @validator('is_plan_expired', pre=True, always=True)
    def check_expiration_out(cls, v, values):
        trial_ends_at = values.get('trial_ends_at')
        empresa_id = values.get('id')
        is_protected = values.get('is_protected', False)
        if not trial_ends_at or empresa_id == 1 or is_protected: return False
        ahora = datetime.now(timezone.utc)
        if trial_ends_at.tzinfo is None: trial_ends_at = trial_ends_at.replace(tzinfo=timezone.utc)
        return ahora > trial_ends_at

class EmpresaMetricsOut(EmpresaOut):
    count_usuarios: int = 0
    count_ventas: int = 0
    count_productos: int = 0
    dias_restantes: int = 0

class SaaSAuditLogOut(BaseModel):
    id: int
    admin_id: Optional[int] = None
    admin_username: Optional[str] = None
    empresa_id: Optional[int] = None
    empresa_nombre: Optional[str] = None
    accion: str
    detalle: Optional[dict] = None
    fecha: datetime
    model_config = ConfigDict(from_attributes=True)

    @validator('fecha', pre=True, always=True)
    def normalize_fecha(cls, v):
        return ensure_utc(v)

class SaaSAnnouncementBase(BaseModel):
    titulo: str
    mensaje: str
    tipo: str = "info"
    is_active: bool = True
    expires_at: Optional[datetime] = None

class SaaSAnnouncementCreate(SaaSAnnouncementBase):
    pass

class SaaSAnnouncementOut(SaaSAnnouncementBase):
    id: int
    created_at: datetime
    created_by: int
    model_config = ConfigDict(from_attributes=True)

class SaaSJobRegistryOut(BaseModel):
    id: int
    job_name: str
    execution_id: str
    status: str
    started_at: datetime
    finished_at: Optional[datetime] = None
    metrics: Optional[dict] = None
    error_log: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class EmpresaWithAdminCreate(BaseModel):
    empresa: EmpresaCreate
    admin_username: str
    admin_password: str
    admin_nombre_completo: Optional[str] = None
    admin_email: Optional[str] = None
    admin_telefono: Optional[str] = None

# =========================
# MÓDULOS / ROLES / USUARIOS
# =========================
class ModuloBase(BaseModel):
    name: str
    description: Optional[str] = None
    frontend_path: str

class ModuloCreate(ModuloBase):
    pass

class Modulo(ModuloBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class RoleBase(BaseModel):
    name: str

class RoleCreate(RoleBase):
    pass

class Role(RoleBase):
    id: int
    empresa_id: Optional[int] = None # ✅ Añadir esto
    modules: List[Modulo] = []
    model_config = ConfigDict(from_attributes=True)
class UserBase(BaseModel):
    username: str
    role_id: int
    nombre_completo: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool = True # ✅ Añadir esto
    role: Role
    empresa_id: Optional[int] = None
    empresa: Optional[Empresa] = None
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# =========================
# CLIENTES / TERCEROS
# =========================
class ClienteBase(BaseModel):
    nombre: str
    cedula: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    cupo_credito: Optional[float] = 0.0
    es_cliente: bool = True
    es_proveedor: bool = False
    puntos_fidelidad: int = 0

    # 🧾 CAMPOS FACTURACIÓN ELECTRÓNICA (DIAN)
    email: Optional[EmailStr] = None
    tipo_documento_id: int = 13       # 13: Cédula, 31: NIT
    dv: Optional[str] = None

    @field_validator('email', mode='before')
    @classmethod
    def _empty_email_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v
    tipo_organizacion_id: int = 2     # 1: Jurídica, 2: Natural
    tipo_regimen_id: int = 49          # 48: Responsable IVA, 49: No responsable
    responsabilidad_fiscal_codes: str = "R-99-PN"
    departamento_code: Optional[str] = None
    ciudad_code: Optional[str] = None
    zona: Optional[str] = None
    fecha_nacimiento: Optional[date] = None

class ClienteCreate(ClienteBase):
    pass

class Cliente(ClienteBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class ClienteDetails(Cliente):
    deuda_actual: float

# =========================
# GRUPOS DE PRODUCTO
# =========================

class GrupoProductoBase(BaseModel):
    nombre: str
    codigo: str
    color: str = '#94a3b8'
    orden: int = 99
    requiere_cocina: bool = False
    visible_pos: bool = True

class GrupoProductoCreate(GrupoProductoBase):
    pass

class GrupoProductoUpdate(BaseModel):
    nombre: Optional[str] = None
    codigo: Optional[str] = None
    color: Optional[str] = None
    orden: Optional[int] = None
    requiere_cocina: Optional[bool] = None
    visible_pos: Optional[bool] = None

class GrupoProductoOut(GrupoProductoBase):
    id: int
    empresa_id: Optional[int] = None
    es_predefinido: bool
    model_config = ConfigDict(from_attributes=True)

class GrupoConfigUpdate(BaseModel):
    """Payload para actualizar solo los dos flags por empresa."""
    requiere_cocina: Optional[bool] = None
    visible_pos: Optional[bool] = None


# =========================
# PRODUCTOS / INVENTARIO
# =========================
# En schemas.py, busca la clase ProductoBase y añádelo al final:
class ProductoBase(BaseModel):
    sku: Optional[str] = None
    nombre: str
    codigo_barras: Optional[str] = None # ✨ NUEVO
    descripcion: Optional[str] = None   # ✨ NUEVO
    precio: float = 0.0
    costo: float = 0.0
    es_servicio: bool = False
    unidad_medida: Optional[str] = "UND"
    stock_minimo: float = 0.0
    grupo_item: int = 2

    # 👇 AGENDAMIENTO: si es un servicio, puede habilitarse para reservas de citas
    agendable: bool = False
    duracion_minutos: Optional[int] = None
    
    # 👇 NUEVO CAMPO: Se valida desde la API
    maneja_lotes: bool = False

    # 👇 NUEVOS CAMPOS CATÁLOGO VIRTUAL
    imagenes: Optional[List[str]] = None # Lista de Base64
    mostrar_en_catalogo: bool = False

    # Cuántas unidades individuales trae el empaque/caja/paquete que se compra
    # Ej: caja de 4 → 4.0 | paquete de 28 lonchas → 28.0 | por unidad → 1.0 (default)
    unidades_por_empaque: Optional[float] = 1.0

    # ✅ FIX: La BD guarda esto como string JSON, Pydantic necesita lista
    @validator('imagenes', pre=True, always=True)
    def parse_imagenes(cls, v):
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except:
                return []
        return v or []

class ProductoCreate(ProductoBase):
    stock_inicial:     Optional[float] = 0.0
    numero_lote:       Optional[str]   = None
    fecha_vencimiento: Optional[date]  = None

# ← AÑADIR ESTE VALIDATOR:
    @validator('maneja_lotes', pre=True, always=True)
    def coerce_maneja_lotes(cls, v):
        if v is None:
            return False
        return bool(v)   # convierte 0→False, 1→True, None→False

class ImpuestoInfo(BaseModel):
    """Subconjunto de TipoImpuesto embebido en la respuesta de Producto."""
    id: int
    nombre: str
    codigo: str
    porcentaje: float
    model_config = ConfigDict(from_attributes=True)

class ProductoVarianteBase(BaseModel):
    nombre: str
    atributos: dict = {}
    precio: Optional[float] = None
    costo: Optional[float] = None
    stock_minimo: float = 0.0

class ProductoVarianteCreate(ProductoVarianteBase):
    sku: Optional[str] = None
    stock_inicial: float = 0.0

class ProductoVarianteUpdate(BaseModel):
    nombre: Optional[str] = None
    atributos: Optional[dict] = None
    precio: Optional[float] = None
    costo: Optional[float] = None
    stock_minimo: Optional[float] = None
    activo: Optional[bool] = None

class ProductoVarianteOut(ProductoVarianteBase):
    id: int
    sku: str
    stock_actual: float = 0.0
    activo: bool = True
    model_config = ConfigDict(from_attributes=True)

class Producto(ProductoBase):
    id: int
    stock_actual: float = 0.0
    tiene_variantes: bool = False
    variantes: List['ProductoVarianteOut'] = []
    impuesto: Optional[ImpuestoInfo] = None
    requiere_cocina: bool = False
    categoria: Optional[str] = None
    costo_produccion: Optional[float] = None  # Calculado del último lote de producción confirmado
    # Stock vendible: stock_actual menos lo atrapado en lotes VENCIDOS.
    # None para productos sin manejo de lotes (usar stock_actual).
    stock_vigente: Optional[float] = None
    # Solo lo llena el lookup de código de barras cuando el resultado viene de
    # la búsqueda web (último recurso, sin catálogo estructurado que lo
    # respalde) — el frontend debe advertir claramente que no está verificado,
    # a diferencia de un match real de OpenFoodFacts/UPCitemDB/etc.
    fuente: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class MovementType(str, Enum):
    entrada = "entrada"
    salida = "salida"
    ajuste = "ajuste"

class InventoryMovementCreate(BaseModel):
    producto_id: int
    tipo: MovementType
    cantidad: float
    costo_unitario: float = 0.0
    motivo: Optional[str] = ""
    referencia: Optional[str] = ""
    observacion: Optional[str] = ""
    usuario_id: Optional[int] = None
    variante_id: Optional[int] = None

class InventoryMovementOut(BaseModel):
    id: int
    producto_id: int
    producto: Optional[Producto] = None
    tipo: MovementType
    cantidad: float
    costo_unitario: float
    motivo: Optional[str] = None
    referencia: Optional[str] = None
    observacion: Optional[str] = None
    # Trazabilidad por lote (el modelo siempre los tuvo; sin exponerlos el
    # historial por lote del módulo Perecederos quedaba vacío)
    lote_id: Optional[int] = None
    numero_lote: Optional[str] = None
    # Consecutivo visible por empresa
    numero_movimiento: Optional[int] = None
    variante_id: Optional[int] = None
    nombre_variante: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class InventoryAlertOut(BaseModel):
    producto_id: int
    nombre: str
    stock_actual: float
    stock_minimo: float

class ProductoStockUpdate(BaseModel):
    stock_minimo: Optional[float] = None

# =========================
# VENTAS Y PAGOS
# =========================
class PagoCreate(BaseModel):
    venta_id: int
    monto: float
    metodo_pago: Optional[str] = None
    detalle_pago: Optional[str] = None

class PagoUpdate(BaseModel):
    monto: Optional[float] = None
    metodo_pago: Optional[str] = None
    detalle_pago: Optional[str] = None

class Pago(PagoCreate):
    id: int
    fecha: datetime
    model_config = ConfigDict(from_attributes=True)

class DetalleVentaCreate(BaseModel):
    producto_id: Optional[int] = None     # None for libre items
    variante_id: Optional[int] = None     # None if product has no variants
    nombre_libre: Optional[str] = None    # description for libre items
    nombre_variante: Optional[str] = None # snapshot nombre variante
    cantidad: Optional[float] = 1.0
    precio_unitario: Optional[float] = None
    descuento_pct: float = 0.0
    iva_porcentaje: float = 0.0

class DetalleVentaBase(BaseModel):
    producto_id: Optional[int] = None
    variante_id: Optional[int] = None
    cantidad: Optional[float]

class DetalleVenta(DetalleVentaBase):
    id: int
    venta_id: int
    producto_id: Optional[int] = None
    variante_id: Optional[int] = None
    nombre_libre: Optional[str] = None
    nombre_variante: Optional[str] = None
    precio_unitario: float
    producto: Optional[Producto] = None
    variante: Optional[ProductoVarianteOut] = None
    model_config = ConfigDict(from_attributes=True)

class VentaBase(BaseModel):
    cliente_id: Optional[int] = None
    detalles: List[DetalleVentaCreate]
    pagada: bool = True
    iva_porcentaje: float = 0.0
    metodo_pago: Optional[str] = None
    # Cuando metodo_pago == "Link de Pago": cuál de los links/QR configurados
    # (Nequi, Bancolombia, etc.) usó el cliente.
    link_pago_nombre: Optional[str] = None
    # ← Nuevos campos Fase 2
    tipo: str = "venta"                          # 'venta' | 'cotizacion'
    valida_hasta: Optional[datetime] = None      # Solo cotizaciones
    observaciones: Optional[str] = None          # Notas internas
    # Lavadero
    operador_id: Optional[int] = None
    placa_vehiculo: Optional[str] = None
    tipo_vehiculo: Optional[str] = None
    # Fidelización
    descuento_puntos: float = 0.0               # Descuento en COP por puntos canjeados
    puntos_canjeados: int = 0                    # Puntos descontados (para log)
    # Por-venta: no persiste en BD, solo controla lógica en el endpoint
    omitir_inventario: bool = False
    # FE individual: True = emitir FE ahora; False (default) = acumular para consolidado
    solicita_fe: bool = False
    # Agendamiento: si la venta proviene de cobrar una cita, su id para vincularla.
    cita_id: Optional[int] = None


class VentaCreate(VentaBase):
    pass

class Venta(VentaBase):
    id: int
    total: float
    iva_total: float
    iva_porcentaje: float
    fecha: datetime
    monto_pagado: float
    estado_pago: str
    cliente_id: Optional[int]
    cliente: Optional[Cliente]
    detalles: List[DetalleVenta] = []
    pagos: List[Pago] = []
    # Consecutivo visible por empresa (V-0001…)
    numero_venta: Optional[int] = None
    # Fidelización: puntos ganados en esta venta y saldo del cliente justo
    # después de aplicarla (snapshot al momento de la venta).
    puntos_ganados: Optional[int] = 0
    saldo_puntos_cliente: Optional[int] = None
    # ← Nuevos campos Fase 2
    numero_factura: Optional[str] = None
    resolucion_id: Optional[int] = None
    
    # 🧾 CAMPOS FACTURACIÓN ELECTRÓNICA
    cufe: Optional[str] = None
    qr_data: Optional[str] = None
    xml_url: Optional[str] = None
    pdf_url: Optional[str] = None
    estado_electronico: str = "no_enviado"
    mensaje_proveedor: Optional[str] = None
    origen: Optional[str] = "erp"

    model_config = ConfigDict(from_attributes=True)

# =========================
# VENTAS — BORRADORES (POS)
# =========================
class VentaBorradorCreate(BaseModel):
    cliente_nombre: Optional[str] = None
    total_aproximado: float = 0.0
    datos: dict   # snapshot completo del carrito, opaco para el backend

class VentaBorradorOut(BaseModel):
    id: int
    cliente_nombre: Optional[str] = None
    total_aproximado: float = 0.0
    created_at: datetime
    creado_por_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class VentaBorradorDetalle(VentaBorradorOut):
    datos: dict

# =========================
# DEVOLUCIONES
# =========================
class DevolucionItemCreate(BaseModel):
    detalle_id: Optional[int] = None
    producto_id: int
    cantidad: float
    precio_unitario: float

class DevolucionCreate(BaseModel):
    venta_id: int
    motivo: str
    items: List[DevolucionItemCreate]

class DevolucionItemOut(BaseModel):
    id: int
    producto_id: int
    cantidad: float
    precio_unitario: float
    detalle_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class DevolucionOut(BaseModel):
    id: int
    venta_id: int
    motivo: str
    monto_total: float = 0.0
    fecha: datetime
    tipo: str = "parcial"
    estado: str = "confirmada"
    items: List[DevolucionItemOut] = []
    model_config = ConfigDict(from_attributes=True)

# =========================
# ÓRDENES DE TRABAJO
# =========================
class EvidenciaBase(BaseModel):
    file_path: str

class EvidenciaCreate(EvidenciaBase):
    pass

class Evidencia(EvidenciaBase):
    id: int
    orden_id: int
    uploaded_at: datetime
    model_config = ConfigDict(from_attributes=True)

class OrdenProductoBase(BaseModel):
    producto_id: int
    cantidad: float
    precio_unitario: float

class OrdenProductoCreate(OrdenProductoBase):
    pass

class OrdenProducto(OrdenProductoBase):
    id: int
    orden_id: int
    producto: Producto
    model_config = ConfigDict(from_attributes=True)

class OrdenServicioBase(BaseModel):
    servicio_id: int
    cantidad: float
    precio_servicio: float

class OrdenServicioCreate(OrdenServicioBase):
    pass

class OrdenServicio(OrdenServicioBase):
    id: int
    orden_id: int
    servicio: Producto
    cantidad: Optional[float]
    model_config = ConfigDict(from_attributes=True)

class OrdenTrabajoBase(BaseModel):
    cliente_id: int
    total: float
    operador_id: Optional[int] = None

class OrdenTrabajoCreate(OrdenTrabajoBase):
    productos: List[OrdenProductoCreate] = []
    servicios: List[OrdenServicioCreate] = []

class OrdenTrabajoUpdate(BaseModel):
    estado: Optional[str] = None
    observaciones_aprobador: Optional[str] = None

class OrdenTrabajoClose(BaseModel):
    was_paid: bool
    payment_type: Optional[str] = None 
    paid_amount: Optional[float] = None

class OrdenTrabajo(OrdenTrabajoBase):
    id: int
    operador_id: int
    estado: str
    fecha_creacion: datetime       # ✅ CAMBIADO DE date a datetime (Solución Bug 500)
    fecha_actualizacion: datetime  # ✅ CAMBIADO DE date a datetime
    observaciones_aprobador: Optional[str] = None
    cliente: Cliente
    operador: User
    productos: List[OrdenProducto] = []
    servicios: List[OrdenServicio] = []
    evidencias: List[Evidencia] = []
    model_config = ConfigDict(from_attributes=True)

# =========================
# PRODUCTIVIDAD Y PANEL OPERADOR
# =========================
class RegistroProductividadBase(BaseModel):
    operador_id: int
    orden_id: int
    servicio_id: int
    valor_productividad: float
    modalidad_pago: str

class RegistroProductividadCreate(RegistroProductividadBase):
    pass

class RegistroProductividad(RegistroProductividadBase):
    id: int
    fecha: datetime
    servicio: Producto
    model_config = ConfigDict(from_attributes=True)

class ProductividadOperadorDetalle(BaseModel):
    orden_id: int
    servicio_nombre: str
    valor_ganado: float

class ProductividadUnidadesPorServicio(BaseModel):
    servicio_id: int
    servicio_nombre: str
    total_unidades: float
    total_valor: float

class ProductividadOperador(BaseModel):
    operador_id: int
    operador_username: str
    total_ganado: float
    desglose: List[ProductividadOperadorDetalle]
    desglose_unidades: List[ProductividadUnidadesPorServicio] = []

class ReporteProductividad(BaseModel):
    start_date: date
    end_date: date
    reporte: List[ProductividadOperador] = []

class PanelOrdenPendiente(BaseModel):
    id: int
    cliente_id: int
    cliente_nombre: str
    cliente_telefono: Optional[str] = None
    cliente_direccion: Optional[str] = None
    estado: str
    fecha_creacion: datetime       # ✅ CAMBIADO DE date a datetime
    fecha_actualizacion: datetime  # ✅ CAMBIADO DE date a datetime
    total: float
    productos: List[OrdenProducto] = []
    servicios: List[OrdenServicio] = []
    model_config = ConfigDict(from_attributes=True)

class PanelProductividadDataPoint(BaseModel):
    name: str
    value: int

class PanelProductividad(BaseModel):
    servicios_hoy: int
    servicios_semana: int
    servicios_mes: int
    ordenes_completadas_semana: int
    grafica_servicios_semana: List[PanelProductividadDataPoint]
    unidades_por_servicio_filtrado: List[ProductividadUnidadesPorServicio] = []

class PanelHistorialItem(BaseModel):
    id: int
    cliente_nombre: str
    fecha_actualizacion: datetime
    total: float
    estado_pago_venta: str
    model_config = ConfigDict(from_attributes=True)

# =========================
# COMPRAS
# =========================
class DetalleCompraBase(BaseModel):
    producto_id: Optional[int] = None
    nombre_libre: Optional[str] = None
    sort_order: int = 0
    cantidad: float
    precio_unitario: float
    numero_lote: Optional[str] = None
    fecha_vencimiento: Optional[date] = None
    fecha_fabricacion: Optional[date] = None
    variante_id: Optional[int] = None


class DetalleCompraCreate(DetalleCompraBase):
    pass

class DetalleCompra(DetalleCompraBase):
    id: int
    compra_id: int
    producto: Optional[Producto] = None
    nombre_variante: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class CompraBase(BaseModel):
    proveedor_id: int
    referencia_factura: Optional[str] = None
    # fecha: Optional[date] = None
    fecha: datetime

class CompraCreate(BaseModel):
    proveedor_id: int
    referencia_factura: Optional[str] = None
    detalles: List[DetalleCompraCreate]
    pagada: bool = False
    iva_porcentaje: float = 0.0

class CompraUpdate(BaseModel):
    proveedor_id: Optional[int] = None
    referencia_factura: Optional[str] = None
    fecha: Optional[datetime] = None
    iva_porcentaje: Optional[float] = None
    detalles: Optional[List[DetalleCompraCreate]] = None
    pagada: Optional[bool] = None

class Compra(CompraBase):
    id: int
    # Consecutivo visible por empresa (OC-2026-0001…)
    numero_compra: Optional[int] = None
    total: float
    iva_total: float
    iva_porcentaje: float
    monto_pagado: float
    estado_pago: str
    proveedor: Cliente
    detalles: List[DetalleCompra] = []
    pagos: List['PagoCompra'] = []
    model_config = ConfigDict(from_attributes=True)

class PagoCompraCreate(BaseModel):
    compra_id: int
    monto: float
    metodo_pago: Optional[str] = None
    detalle_pago: Optional[str] = None

class PagoCompra(BaseModel):
    id: int
    compra_id: int
    monto: float
    fecha: datetime
    metodo_pago: Optional[str] = None
    detalle_pago: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# =========================
# PRODUCCIÓN (RECETAS Y LOTES)
# =========================
class RecetaItemBase(BaseModel):
    insumo_id: int
    cantidad: float
    merma_pct: float = 0.0

class RecetaItemCreate(RecetaItemBase):
    pass

class RecetaItem(RecetaItemBase):
    id: int
    receta_id: int
    insumo: Producto
    model_config = ConfigDict(from_attributes=True)

class RecetaServicioBase(BaseModel):
    servicio_id: int
    cantidad: float = 1.0

class RecetaServicio(RecetaServicioBase):
    id: int
    receta_id: int
    servicio: Producto
    model_config = ConfigDict(from_attributes=True)

class RecetaBase(BaseModel):
    producto_id: int
    nombre: str
    descripcion: Optional[str] = None
    rendimiento_esperado: float = 1.0
    notas_tecnicas: Optional[str] = None
    precio_sugerido: Optional[float] = None
    porciones: int = 1

class RecetaCreate(RecetaBase):
    items: List[RecetaItemCreate]
    servicios: List[RecetaServicioBase] = []

class Receta(RecetaBase):
    id: int
    created_at: datetime
    items: List[RecetaItem]
    servicios_maquila: List[RecetaServicio] = []
    producto_resultante: Producto
    model_config = ConfigDict(from_attributes=True)

class LoteProduccionBase(BaseModel):
    receta_id: int
    cantidad_a_producir: float
    cliente_id: Optional[int] = None
    observaciones: Optional[str] = None

class LoteProduccionCreate(LoteProduccionBase):
    numero_lote_produccion: Optional[str] = None

class LoteServicioPrecio(BaseModel):
    servicio_id: int
    precio: float

# class LoteProduccionConfirm(BaseModel):
#     cantidad_real: float
#     precios_servicios: List[LoteServicioPrecio] = []
#     observaciones: Optional[str] = None


class LoteProduccionConfirm(BaseModel):
    cantidad_real: float
    precios_servicios: List[LoteServicioPrecio] = []
    observaciones: Optional[str] = None
    # 👇 NUEVOS CAMPOS PARA PRODUCCIÓN FEFO
    numero_lote: Optional[str] = None
    fecha_vencimiento: Optional[date] = None
    fecha_fabricacion: Optional[date] = None
    # Si el producto resultante maneja variantes, a cuál se le acredita el
    # stock producido (obligatorio en ese caso).
    variante_id: Optional[int] = None

class LoteProduccion(LoteProduccionBase):
    id: int
    cantidad_real: Optional[float] = None
    costo_total: float
    costo_unitario_resultado: float
    fecha_planificada: datetime
    fecha_confirmacion: Optional[datetime] = None
    estado: str
    receta: Receta
    cliente: Optional[Cliente] = None
    venta_id: Optional[int] = None
    numero_lote_produccion: Optional[str] = None
    # Consecutivo visible por empresa (ORDEN #1, #2…)
    numero_orden: Optional[int] = None
    costo_insumos: float = 0.0
    costo_maquila: float = 0.0
    variante_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

# =========================
# GASTOS Y CAJA
# =========================
class TerceroReducido(BaseModel):
    id: int
    nombre: str
    model_config = ConfigDict(from_attributes=True)

class GastoCreate(BaseModel):
    tercero_id: int
    monto: float
    concepto: str
    categoria: Optional[str] = None
    metodo_pago: str = "Efectivo"

class GastoOut(BaseModel):
    id: int
    usuario_id: int
    tercero_id: Optional[int] = None
    tercero: Optional[TerceroReducido] = None
    monto: float
    concepto: str
    categoria: Optional[str] = None
    metodo_pago: str
    fecha: datetime
    model_config = ConfigDict(from_attributes=True)

class CorteCajaCreate(BaseModel):
    efectivo_fisico: float
    observaciones: Optional[str] = None

class CorteCajaOut(BaseModel):
    id: int
    usuario_id: int
    fecha: datetime
    total_efectivo_ventas: float
    total_transferencia_ventas: float
    total_tarjeta_ventas: float
    total_otros_ventas: float
    total_ventas_dia: float
    efectivo_fisico: float
    diferencia: float
    observaciones: Optional[str] = None
    estado: str
    total_gastos: float 
    model_config = ConfigDict(from_attributes=True)

class CorteCajaPreview(BaseModel):
    efectivo: float
    transferencia: float
    tarjeta: float
    otros: float
    total_dia: float
    total_gastos: float
    fecha: str

# =========================
# REPORTES Y DASHBOARD
# =========================
class KardexItem(BaseModel):
    fecha: datetime
    tipo: str
    cantidad: float
    costo_unitario: float
    referencia: Optional[str] = None
    saldo_cantidad: float
    saldo_costo_unitario: float
    saldo_valor: float
    model_config = ConfigDict(from_attributes=True)

class KardexResponse(BaseModel):
    producto_id: int
    producto_nombre: str
    items: List[KardexItem]

class InventarioItem(BaseModel):
    id: int
    nombre: str
    es_servicio: bool
    unidad_medida: Optional[str]
    stock_actual: float
    stock_minimo: float
    costo: float
    precio: float
    valor_costo: float
    valor_venta: float
    variante_id: Optional[int] = None
    nombre_variante: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class InventarioSnapshot(BaseModel):
    items: List[InventarioItem]
    total_valor_costo: float
    total_valor_venta: float

class ProductoRotacionItem(BaseModel):
    producto_id: int
    nombre: str
    es_servicio: bool
    total_cantidad_vendida: float
    total_ingresos: float

class ReporteRotacion(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    top: List[ProductoRotacionItem]
    slow: List[ProductoRotacionItem]

class VentasSummary(BaseModel):
    total_pagado: float
    total_pendiente: float
    total_general: float
    total_ventas_hoy: float
    total_compras: float = 0.0
    total_gastos: float = 0.0
    model_config = ConfigDict(from_attributes=True)

class ClienteCuentasPorCobrar(BaseModel):
    cliente_id: int
    cliente_nombre: str
    monto_pendiente: float
    ventas_pendientes: List[Venta] = []

class ProveedorCuentasPorPagar(BaseModel):
    proveedor_id: int
    proveedor_nombre: str
    monto_pendiente: float
    compras_pendientes: List[Compra] = []

class VentaHistoryItem(BaseModel):
    id: int
    detalles: List[DetalleVenta] = []
    total: float
    fecha: datetime
    monto_pagado: float
    estado_pago: str
    pagos: List[Pago] = []
    model_config = ConfigDict(from_attributes=True)

class ClienteHistory(BaseModel):
    cliente: Cliente
    ventas: List[VentaHistoryItem] = []
    total_deuda: float
    total_pagado_general: float
    total_ventas_general: float
    model_config = ConfigDict(from_attributes=True)

class ProductoVendido(BaseModel):
    product_id: int
    product_name: str
    total_quantity_sold: float
    es_servicio: bool
    total_revenue: float
    model_config = ConfigDict(from_attributes=True)

class ReporteProductosVendidos(BaseModel):
    productos: List[ProductoVendido]
    servicios: List[ProductoVendido]

class VarianteVendida(BaseModel):
    product_id: int
    product_name: str
    variante_id: Optional[int] = None
    variante_name: str  # "Sin variante" para lo vendido antes de que el producto tuviera variantes
    total_quantity_sold: float
    total_revenue: float

class ClienteComprador(BaseModel):
    client_id: int
    client_name: str
    total_purchase_amount: float
    model_config = ConfigDict(from_attributes=True)

class ClienteDeudor(BaseModel):
    client_id: int
    client_name: str
    total_debt_amount: float
    model_config = ConfigDict(from_attributes=True)

class ProductoRentabilidad(BaseModel):
    product_id: int
    product_name: str
    total_quantity_sold: float
    total_revenue: float
    total_cost: float
    net_profit: float
    profit_margin: float

class SalesByDay(BaseModel):
    day: date
    total: float

# ─── Reporte ventas por vendedor ──────────────────────────────────────────────

class VendedorVentaStats(BaseModel):
    vendedor_id:       int
    nombre:            str
    email:             Optional[str] = None
    total_ventas:      int
    total_ingresos:    float
    total_cobrado:     float
    total_pendiente:   float
    ticket_promedio:   float
    ventas_pagadas:    int
    ventas_pendientes: int
    pct_total:         float = 0.0

class VentaVendedorItem(BaseModel):
    id:           int
    fecha:        datetime
    cliente:      Optional[str] = None
    num_items:    int
    total:        float
    monto_pagado: float
    estado_pago:  str
    metodo_pago:  Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ReporteVentasVendedor(BaseModel):
    vendedores:              List[VendedorVentaStats]
    total_ingresos_periodo:  float
    total_ventas_periodo:    int

class DashboardData(BaseModel):
    # --- MÉTRICAS ERP COMERCIAL ---
    ventas_hoy: float
    cuentas_por_cobrar: float
    productos_bajo_stock: int
    ventas_ultimos_30_dias: List[SalesByDay]
    
    # --- MÉTRICAS MÓDULO PRÉSTAMOS (NUEVAS / SEPARADAS) ---
    recaudo_prestamos_hoy: float = 0.0
    capital_en_calle: float = 0.0
    cuotas_mora: int = 0
    intereses_cobrados_hoy: float = 0.0
    recaudo_ultimos_30_dias: List[SalesByDay] = [] # Gráfica independiente

    # --- COMPARACIÓN PERÍODO ANTERIOR ---
    ventas_ayer: float = 0.0

    # Comunes
    ordenes_recientes: List[OrdenTrabajo]

    tipo_negocio: str = "erp"
    # Parqueadero
    ingresos_parq_hoy: float = 0.0
    ocupacion_actual: int = 0
    suscripciones_vigentes: int = 0
    # Lavadero
    ingresos_lavadero_hoy: float = 0.0
    ordenes_lavadero_hoy: int = 0
    total_productos: int = 0

# Al final del archivo schemas.py, mantén la reconstrucción:
DashboardData.model_rebuild()
# =========================
# NOTIFICACIONES
# =========================
class NotificacionBase(BaseModel):
    usuario_id: int
    mensaje: str
    orden_id: Optional[int] = None

class NotificacionCreate(NotificacionBase):
    pass

class Notificacion(BaseModel):
    id: int
    usuario_id: int
    mensaje: str
    leido: bool
    tipo: str = "info"
    fecha_creacion: datetime
    orden_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

# =========================
# CARGAS MASIVAS (EXCEL)
# =========================
class ProductoExcel(BaseModel):
    nombre: str
    precio: float
    costo: float = 0.0
    es_servicio: bool = False
    unidad_medida: Optional[str] = "UND"
    stock_minimo: float = 0.0
    stock_inicial: float = 0.0

class ClienteExcel(BaseModel):
    nombre: str
    cedula: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    cupo_credito: Optional[float] = 0.0

class BulkLoadResponse(BaseModel):
    success: bool
    message: str
    created_records: int = 0
    errors: List[str] = []

class MovementExcel(BaseModel):
    producto_id: Optional[int]
    producto_nombre: Optional[str]
    tipo: str
    cantidad: float
    costo_unitario: Optional[float] = 0.0
    motivo: Optional[str] = None
    referencia: Optional[str] = None
    observacion: Optional[str] = None

# =========================
# RECONSTRUCCIÓN DE REFERENCIAS FORWARD
# =========================
DashboardData.model_rebuild()


class EmpresaPlanUpdate(BaseModel):
    plan_type: str
    trial_ends_at: Optional[datetime] = None

class EmpresaModulosUpdate(BaseModel):
    modulos: List[str]


class TipoNegocioConfigOut(BaseModel):
    tipo: str
    label: Optional[str] = None
    modulos: List[str] = []
    model_config = ConfigDict(from_attributes=True)

class TipoNegocioConfigUpdate(BaseModel):
    modulos: List[str]
    label: Optional[str] = None



# =========================
# REGISTRO AUTOSERVICIO (SAAS)
# =========================

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional

class RegistroSaaS(BaseModel):
    # ── Negocio (paso 1) ─────────────────────────────────────────────────────
    nombre_empresa:  str = Field(..., min_length=2, max_length=120)
    nit:             Optional[str] = Field(None, max_length=20) # ✨ NUEVO
    tipo_negocio:    str = Field("erp", description="erp | prestamos | parqueadero | lavadero | restaurante")
    pais:            Optional[str] = Field(None, max_length=4,  description="Código país: CO, MX, PE…")
    ciudad:          Optional[str] = Field(None, max_length=80)
    tamano_negocio:  Optional[str] = Field(None, description="solo | pequeno | mediano | grande")

    # ── Cuenta del usuario (paso 2) ──────────────────────────────────────────
    nombre_completo: Optional[str] = Field(None, min_length=3, max_length=120)
    email:           Optional[EmailStr] = None
    telefono:        Optional[str] = Field(None, max_length=30)
    username:        str = Field(..., min_length=3, max_length=40)
    password:        str = Field(..., min_length=1, max_length=80)

    # ── Marketing (opcional) ─────────────────────────────────────────────────
    origen:          Optional[str] = Field(None, max_length=60)

    @validator('tipo_negocio')
    def _tipo_valido(cls, v):
        validos = {'erp', 'prestamos', 'parqueadero', 'lavadero', 'restaurante'}
        if v not in validos:
            raise ValueError(f'Tipo de negocio inválido: {v}. Válidos: {", ".join(sorted(validos))}')
        return v

    @validator('username')
    def _username_limpio(cls, v):
        v = v.strip().lower()
        if ' ' in v:
            raise ValueError('El usuario no puede contener espacios')
        return v


# =========================
# INTEGRACIÓN BOLD (PAGOS SAAS)
# =========================
class BoldHashRequest(BaseModel):
    plan_name: str  # Ej: "premium_mensual" o "premium_anual"
    codigo_promo: Optional[str] = None  # Código promocional opcional


# ─── Códigos promocionales ──────────────────────────────────────────────────
class CodigoPromocionalBase(BaseModel):
    codigo: str
    descripcion: Optional[str] = None
    tipo: str = "porcentaje"  # 'porcentaje' | 'fijo'
    valor: float
    activo: bool = True
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    max_usos: Optional[int] = None
    un_uso_por_empresa: bool = True
    planes_aplicables: Optional[List[int]] = None

class CodigoPromocionalCreate(CodigoPromocionalBase):
    pass

class CodigoPromocionalUpdate(BaseModel):
    descripcion: Optional[str] = None
    tipo: Optional[str] = None
    valor: Optional[float] = None
    activo: Optional[bool] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    max_usos: Optional[int] = None
    un_uso_por_empresa: Optional[bool] = None
    planes_aplicables: Optional[List[int]] = None

class CodigoPromocionalOut(CodigoPromocionalBase):
    id: int
    usos_actuales: int = 0
    model_config = ConfigDict(from_attributes=True)

class ValidarCodigoRequest(BaseModel):
    codigo: str
    plan_id: Optional[int] = None
    plan_name: Optional[str] = None  # codigo_interno del plan (alternativa a plan_id)

class ValidarCodigoResponse(BaseModel):
    valido: bool
    motivo: Optional[str] = None
    codigo: Optional[str] = None
    tipo: Optional[str] = None
    valor: Optional[float] = None
    descuento: float = 0.0
    precio_original: float = 0.0
    precio_final: float = 0.0

class BoldHashResponse(BaseModel):
    order_id: str
    amount: str
    currency: str
    hash_integridad: str
    api_key: str





# --- Añadir al final de schemas.py ---

class PlanSuscripcionBase(BaseModel):
    nombre: str
    codigo_interno: str
    precio: float
    dias_duracion: int
    caracteristicas: Optional[str] = None
    is_active: bool = True
    is_featured: bool = False
    empresa_id_exclusivo: Optional[int] = None
    incluye_fe: bool = True
    max_documentos_mes: Optional[int] = None  # None = sin límite; 0 = sin FE

class PlanSuscripcionCreate(PlanSuscripcionBase):
    pass

class PlanSuscripcionUpdate(BaseModel):
    nombre: Optional[str] = None
    precio: Optional[float] = None
    dias_duracion: Optional[int] = None
    caracteristicas: Optional[str] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    empresa_id_exclusivo: Optional[int] = None
    max_documentos_mes: Optional[int] = None

class PlanSuscripcionOut(PlanSuscripcionBase):
    id: int
    nombre_empresa_exclusiva: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_with_empresa(cls, plan):
        obj = cls.model_validate(plan)
        obj.nombre_empresa_exclusiva = plan.empresa_exclusiva.nombre if plan.empresa_exclusiva else None
        return obj


class PagoDigitalPosRequest(BaseModel):
    monto: float


class MovimientoPuntosOut(BaseModel):
    id: int
    puntos: int
    tipo: str
    venta_id: Optional[int] = None
    descripcion: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)




class RegistroPagoOut(BaseModel):
    id: int
    monto: float
    moneda: Optional[str] = None
    metodo_pago: Optional[str] = None
    bold_tx_id: Optional[str] = None
    email_pagador: Optional[str] = None
    fecha_pago: datetime
    empresa_nombre: str
    plan_nombre: str
    numero_factura_ksmart: Optional[str] = None
    estado_fe: Optional[str] = None
    cufe_fe: Optional[str] = None
    pdf_url_fe: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# =========================
# PRESTAMISTA
# =========================


from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class PrestamoCreate(BaseModel):
    cliente_id: int
    monto_prestado: float
    tasa_interes: float
    cantidad_cuotas: int
    modalidad: str
    tasa_mora: float = 2.0          # ← nuevo: mora mensual por defecto 2%
    fecha_inicio: Optional[datetime] = None
    prestamo_anterior_id: Optional[int] = None # ✨ NUEVO: Para refinanciar cartera antigua

class EvidenciaCobroCreate(BaseModel):
    cuota_id:   int
    tipo:       str  # "No encontrado", "Local cerrado", "Promesa de pago", "Otro"
    comentario: Optional[str] = None
    foto_url:   Optional[str] = None
    latitud:    Optional[float] = None
    longitud:   Optional[float] = None

class EvidenciaCobroOut(EvidenciaCobroCreate):
    id:         int
    usuario_id: int
    fecha:      datetime
    class Config:
        from_attributes = True

class ProyeccionCuota(BaseModel):
    numero_cuota: int
    monto_cuota: float
    fecha_vencimiento: datetime

class ProyeccionPrestamo(BaseModel):
    cliente_nombre: str
    monto_prestado: float
    tasa_interes: float
    total_intereses: float
    total_a_pagar: float
    cuotas: List[ProyeccionCuota]
    

class CuotaResponse(BaseModel):
    id: int
    numero_cuota: int
    monto_cuota: float
    saldo_pendiente: float
    fecha_vencimiento: datetime
    estado_pago: str
    fecha_pago: Optional[datetime] = None
    mora_calculada: float = 0.0     # ← nuevo: mora calculada al vuelo
    dias_vencido: int = 0           # ← nuevo: días de atraso
    total_a_pagar: float = 0.0      # ← nuevo: saldo + mora

    class Config:
        from_attributes = True

class PrestamoResponse(BaseModel):
    id: int
    cliente_id: int
    monto_prestado: float
    tasa_interes: float
    tasa_mora: float                # ← nuevo
    cantidad_cuotas: int
    modalidad: str
    monto_total_pagar: float
    fecha_inicio: datetime
    estado: str
    cuotas: List[CuotaResponse] = []

    class Config:
        from_attributes = True





class MetricasPrestamos(BaseModel):
    capital_prestado: float
    capital_recuperado: float
    capital_pendiente: float
    intereses_esperados: float
    intereses_recaudados: float
    intereses_pendientes: float
    total_en_mora: float

class ReporteFinancieroPrestamos(BaseModel):
    resumen: MetricasPrestamos
    proyeccion_recaudo_mes: List[SalesByDay]



class DiaCobroResumen(BaseModel):
    fecha: date
    cantidad_cuotas: int
    monto_total: float


# ═══════════════════════════════════════════════════════════════════════════
# AÑADIR A schemas.py — Schemas de Lotes de Existencias
# ═══════════════════════════════════════════════════════════════════════════

from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import date, datetime


# ── Schema para crear un lote ─────────────────────────────────────────────────
class LoteExistenciaCreate(BaseModel):
    producto_id:       int
    numero_lote:       str   = Field(..., min_length=1, max_length=100)
    fecha_vencimiento: date
    fecha_fabricacion: Optional[date]  = None
    cantidad_inicial:  float = Field(..., gt=0)
    costo_unitario:    float = Field(..., ge=0)
    proveedor_id:      Optional[int]   = None
    referencia_compra: Optional[str]   = None
    observaciones:     Optional[str]   = None

    # @validator("fecha_vencimiento")
    # def vencimiento_futuro(cls, v):
    #     if v <= date.today():
    #         raise ValueError("La fecha de vencimiento debe ser una fecha futura.")
    #     return v

    # En LoteExistenciaCreate — quitar la restricción de fecha futura para compras
    @validator("fecha_vencimiento")
    def vencimiento_valido(cls, v):
        # Permite fechas pasadas (lotes que ya vencieron pero se están registrando tarde)
        return v

    @validator("fecha_fabricacion")
    def fabricacion_antes_vencimiento(cls, v, values):
        if v and "fecha_vencimiento" in values and v >= values["fecha_vencimiento"]:
            raise ValueError("La fecha de fabricación debe ser anterior a la de vencimiento.")
        return v


# ── Schema de salida de un lote ───────────────────────────────────────────────
class LoteExistenciaOut(BaseModel):
    id:                int
    empresa_id:        int
    producto_id:       int
    producto_nombre:   Optional[str]   = None   # enriquecido en el endpoint
    numero_lote:       str
    fecha_vencimiento: date
    fecha_fabricacion: Optional[date]  = None
    cantidad_inicial:  float
    cantidad_actual:   float
    costo_unitario:    float
    proveedor_id:      Optional[int]   = None
    proveedor_nombre:  Optional[str]   = None   # enriquecido
    referencia_compra: Optional[str]   = None
    observaciones:     Optional[str]   = None
    created_at:        Optional[datetime] = None

    # Campos calculados
    dias_restantes:    Optional[int]   = None
    urgencia:          Optional[str]   = None   # 'critico' | 'alerta' | 'aviso' | 'ok'
    porcentaje_consumo:Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


# ── Schema para ajuste manual de un lote ─────────────────────────────────────
class LoteAjusteCreate(BaseModel):
    cantidad:  float = Field(..., description="Positivo=entrada, negativo=salida")
    motivo:    str   = Field(..., min_length=3)
    referencia:Optional[str] = None


# ── Schema para el reporte de proximidad a vencimiento ───────────────────────
class AlertaVencimientoOut(BaseModel):
    lote_id:           int
    producto_id:       int
    producto_nombre:   str
    numero_lote:       str
    cantidad_actual:   float
    unidad_medida:     Optional[str]
    fecha_vencimiento: date
    dias_restantes:    int
    urgencia:          str           # 'critico' (≤5d) | 'alerta' (≤15d) | 'aviso' (≤30d)
    valor_en_riesgo:   float         # cantidad_actual × costo_unitario


# ── Schema de resumen FEFO para una venta ────────────────────────────────────
class LoteConsumidoOut(BaseModel):
    lote_id:           int
    numero_lote:       str
    fecha_vencimiento: date
    consumido:         float





# ════════════════════════════════════════════════════════════════════════════
# FASE 2A — RESOLUCIONES DIAN
# ════════════════════════════════════════════════════════════════════════════

class ResolucionDianCreate(BaseModel):
    tipo: str = "fe"  # "fe"=Factura Electrónica | "pos"=Documento Equivalente POS
    prefijo: str = ""
    numero_resolucion: Optional[str] = None
    numero_inicial: int = 1
    numero_final: int = 99999999
    vigencia_desde: Optional[date] = None
    vigencia_hasta: Optional[date] = None
    clave_tecnica: Optional[str] = None
    nota: Optional[str] = None

class ResolucionDianUpdate(BaseModel):
    tipo: Optional[str] = None
    prefijo: Optional[str] = None
    numero_resolucion: Optional[str] = None
    numero_inicial: Optional[int] = None
    numero_final: Optional[int] = None
    vigencia_desde: Optional[date] = None
    vigencia_hasta: Optional[date] = None
    clave_tecnica: Optional[str] = None
    nota: Optional[str] = None

class ResolucionDianAjusteNumero(BaseModel):
    nuevo_numero: int
    motivo: str

class ResolucionDianOut(BaseModel):
    id: int
    empresa_id: Optional[int] = None
    tipo: str = "fe"
    prefijo: str = ""
    numero_resolucion: Optional[str] = None
    numero_actual: int
    numero_inicial: int
    numero_final: int
    vigencia_desde: Optional[date] = None
    vigencia_hasta: Optional[date] = None
    is_active: bool
    created_at: Optional[datetime] = None
    clave_tecnica: Optional[str] = None
    nota: Optional[str] = None
    # Campos calculados
    numeros_disponibles: Optional[int] = None
    porcentaje_usado: Optional[float] = None
    esta_vigente: Optional[bool] = None
    dias_para_vencer: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


# ════════════════════════════════════════════════════════════════════════════
# FASE 2B — COTIZACIONES
# ════════════════════════════════════════════════════════════════════════════

class CotizacionCreate(BaseModel):
    """Schema para crear una cotización (subset de VentaCreate, sin pago)."""
    cliente_id: int
    detalles: List[DetalleVentaCreate]
    iva_porcentaje: float = 0.0
    valida_hasta: Optional[datetime] = None
    observaciones: Optional[str] = None

class CotizacionConvertir(BaseModel):
    """Payload para convertir una cotización en venta real."""
    pagada: bool = True
    metodo_pago: Optional[str] = "Efectivo"

class CotizacionOut(BaseModel):
    """Response schema de cotización (enriquecida con estado calculado)."""
    id: int
    cliente_id: Optional[int] = None
    cliente: Optional[Cliente] = None
    total: float
    iva_total: float
    iva_porcentaje: float
    fecha: datetime
    valida_hasta: Optional[datetime] = None
    observaciones: Optional[str] = None
    detalles: List[DetalleVenta] = []
    tipo: str = "cotizacion"
    # Estado calculado
    estado_cotizacion: Optional[str] = None  # 'vigente' | 'vencida' | 'convertida'
    numero_factura: Optional[str] = None     # Populated when converted
    model_config = ConfigDict(from_attributes=True)



# ═══════════════════════════════════════════════════════════════════════════════
# SCHEMAS DEL MÓDULO PARQUEADERO — Pega este bloque AL FINAL de tu schemas.py
# ═══════════════════════════════════════════════════════════════════════════════

from pydantic import BaseModel, Field, validator
from datetime import datetime, date
from typing import Optional, List
from enum import Enum


# ═══════════════════════════════════════════════════════════════════════════════
# ENUMS
# ═══════════════════════════════════════════════════════════════════════════════

class TipoSuscripcionEnum(str, Enum):
    MENSUAL    = "mensual"
    QUINCENAL  = "quincenal"
    DIARIA     = "diaria"


class EstadoSuscripcionEnum(str, Enum):
    VIGENTE   = "vigente"
    VENCIDA   = "vencida"
    CANCELADA = "cancelada"


class EstadoAccesoEnum(str, Enum):
    DENTRO = "dentro"
    SALIO  = "salio"


# ═══════════════════════════════════════════════════════════════════════════════
# 1. PARQUEADERO CONFIG (Tarifas y cupo)
# ═══════════════════════════════════════════════════════════════════════════════

class ParqueaderoConfigBase(BaseModel):
    tarifa_mensual:     float   = Field(0.0, ge=0)
    tarifa_quincenal:   float   = Field(0.0, ge=0)
    tarifa_diaria:      float   = Field(0.0, ge=0)
    tarifa_hora:        float   = Field(0.0, ge=0)
    tarifa_minuto:         float   = Field(0.0, ge=0)
    cobro_minimo_minutos:  int     = Field(30, ge=0, le=1440)
    usar_tarifa_plena:     bool    = Field(False)
    tarifa_minima:         float   = Field(0.0, ge=0)
    tarifa_plena:          float   = Field(0.0, ge=0)
    fraccion_minutos:      int     = Field(30, ge=1, le=1440)
    cupo_total:         int     = Field(0, ge=0)
    nombre_parqueadero: Optional[str] = None
    direccion:          Optional[str] = None
    horario_apertura:   Optional[str] = "06:30"
    horario_cierre:     Optional[str] = "20:00"
    tipo_impresora_parq: Optional[str] = 'p80'
    preferir_impresion:  Optional[bool] = False


class ParqueaderoConfigUpdate(ParqueaderoConfigBase):
    pass


class ParqueaderoConfigOut(ParqueaderoConfigBase):
    id:         int
    empresa_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# 2. VEHÍCULO
# ═══════════════════════════════════════════════════════════════════════════════

class VehiculoBase(BaseModel):
    placa:         str             = Field(..., min_length=3, max_length=10)
    cliente_id:    int             = Field(..., gt=0)
    marca:         Optional[str]   = None
    modelo:        Optional[str]   = None
    color:         Optional[str]   = None
    foto_url:      Optional[str]   = None
    observaciones: Optional[str]   = None

    @validator('placa')
    def normalizar_placa(cls, v):
        return v.strip().upper().replace(' ', '').replace('-', '')


class VehiculoCreate(VehiculoBase):
    pass


class VehiculoUpdate(BaseModel):
    placa:         Optional[str]   = None
    cliente_id:    Optional[int]   = None
    marca:         Optional[str]   = None
    modelo:        Optional[str]   = None
    color:         Optional[str]   = None
    foto_url:      Optional[str]   = None
    observaciones: Optional[str]   = None
    is_active:     Optional[bool]  = None

    @validator('placa')
    def normalizar_placa(cls, v):
        if v is None:
            return v
        return v.strip().upper().replace(' ', '').replace('-', '')


class VehiculoOut(VehiculoBase):
    id:             int
    empresa_id:     int
    is_active:      bool
    created_at:     datetime
    # Datos del cliente para no hacer doble query
    cliente_nombre:    Optional[str] = None
    cliente_telefono:  Optional[str] = None
    cliente_cedula:    Optional[str] = None

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# 3. SUSCRIPCIONES
# ═══════════════════════════════════════════════════════════════════════════════

class SuscripcionCreate(BaseModel):
    vehiculo_id:           int
    tipo:                  TipoSuscripcionEnum
    monto_personalizado:   Optional[float] = Field(
        None, ge=0,
        description="Si se envía, sobrescribe la tarifa global. Útil para descuentos puntuales."
    )
    metodo_pago_inicial:   Optional[str] = "Efectivo"
    monto_pagado:          Optional[float] = Field(
        0.0, ge=0,
        description="Monto que el cliente paga AL MOMENTO de crear la suscripción. Puede ser parcial o total."
    )
    fecha_inicio:          Optional[date] = Field(
        None,
        description="Si NO se envía, se asume HOY. Para suscripciones retroactivas, enviar la fecha pasada."
    )
    es_retroactiva:        bool = False
    observaciones:         Optional[str] = None


class SuscripcionRetroactivaCreate(BaseModel):
    """
    Schema para el caso especial: cliente con mensualidad vencida que SÍ entró durante esos días.
    Crea automáticamente la suscripción retroactiva + opcionalmente otra desde HOY.
    """
    vehiculo_id:               int
    tipo_retroactivo:          TipoSuscripcionEnum  # mensual o diaria (depende de cómo escoja pagar)
    dias_vencidos_a_cobrar:    int = Field(..., ge=1, le=365)
    crear_nueva_desde_hoy:     bool = True
    tipo_nueva_suscripcion:    Optional[TipoSuscripcionEnum] = None
    monto_pagado_total:        float = Field(0.0, ge=0)
    metodo_pago:               Optional[str] = "Efectivo"
    observaciones:             Optional[str] = None


class PagoParqueaderoCreate(BaseModel):
    suscripcion_id: int
    monto:          float = Field(..., gt=0)
    metodo_pago:    str   = "Efectivo"
    observaciones:  Optional[str] = None


class PagoParqueaderoOut(BaseModel):
    id:              int
    suscripcion_id:  int
    monto:           float
    metodo_pago:     str
    fecha:           datetime
    observaciones:   Optional[str]
    usuario_id:      Optional[int]
    usuario_username: Optional[str] = None  # Se llena en el response

    class Config:
        from_attributes = True


class SuscripcionOut(BaseModel):
    id:                  int
    empresa_id:          int
    vehiculo_id:         int
    tipo:                TipoSuscripcionEnum
    fecha_inicio:        date
    fecha_vencimiento:   date
    monto_total:         float
    monto_pagado:        float
    saldo_pendiente:     float = 0.0   # calculado en runtime
    estado_pago:         str
    estado:              EstadoSuscripcionEnum
    metodo_pago_inicial: Optional[str]
    observaciones:       Optional[str]
    es_retroactiva:      bool
    dias_restantes:      int = 0       # calculado en runtime: positivo = vigente, negativo = vencida
    created_at:          datetime

    # Datos enriquecidos
    placa:               Optional[str] = None
    cliente_nombre:      Optional[str] = None
    pagos:               List[PagoParqueaderoOut] = []

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# 4. ACCESOS POR HORAS (ocasionales)
# ═══════════════════════════════════════════════════════════════════════════════

class AccesoUpdate(BaseModel):
    telefono:         Optional[str] = Field(None, max_length=20)
    nombre_ocasional: Optional[str] = Field(None, max_length=120)
    observaciones:    Optional[str] = None


class AccesoEntradaCreate(BaseModel):
    """Registra el ingreso de un cliente que paga por minutos."""
    placa:            str = Field(..., min_length=3, max_length=10)
    vehiculo_id:      Optional[int] = None
    nombre_ocasional: Optional[str] = Field(None, max_length=120)
    telefono:         Optional[str] = Field(None, max_length=20)
    observaciones:    Optional[str] = None
    enviar_whatsapp:  bool = False  # Si True, devuelve también la wa_url al crear

    @validator('placa')
    def normalizar_placa(cls, v):
        return v.strip().upper().replace(' ', '').replace('-', '')


class AccesoSalidaCreate(BaseModel):
    """Registra la salida y calcula el cobro automático."""
    acceso_id:      int
    metodo_pago:    str = "Efectivo"
    monto_manual:   Optional[float] = Field(
        None, ge=0,
        description="Si se envía, sobrescribe el cálculo automático (descuento o ajuste manual)."
    )
    observaciones:  Optional[str] = None
    cliente_nit:    Optional[str] = Field(None, description="NIT o CC para emitir FE individual.")
    cliente_nombre: Optional[str] = Field(None, description="Nombre del cliente para FE individual.")
    solicita_fe:    bool = Field(False, description="True si el cliente quiere factura electrónica individual.")


class AccesoOut(BaseModel):
    id:               int
    empresa_id:       int
    vehiculo_id:      Optional[int]
    placa:            str
    nombre_ocasional: Optional[str] = None        # ✨ NUEVO
    telefono:         Optional[str] = None        # ✨ NUEVO
    fecha_entrada:    datetime
    fecha_salida:     Optional[datetime]
    minutos_cobrados: Optional[int] = None        # ✨ NUEVO
    horas_cobradas:   Optional[float] = None
    monto_cobrado:    Optional[float] = None
    metodo_pago:      Optional[str] = None
    estado:           EstadoAccesoEnum
    observaciones:    Optional[str] = None
    usuario_id:       Optional[int] = None

    class Config:
        from_attributes = True


class AccesoEntradaResponse(BaseModel):
    """
    Respuesta al registrar entrada. Si se pidió enviar_whatsapp=True y hay
    teléfono, devuelve también la wa_url lista para abrir.
    """
    acceso:        AccesoOut
    wa_url:        Optional[str] = None     # URL wa.me/ si se pidió enviar
    mensaje:       Optional[str] = None     # Texto del mensaje (preview)
    advertencia:   Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# 5. BUSCAR PLACA (la pantalla estrella)
# ═══════════════════════════════════════════════════════════════════════════════

class BuscarPlacaResponse(BaseModel):
    """
    Respuesta unificada cuando el operario escribe una placa.
    Devuelve TODO lo que necesita la UI en una sola llamada para evitar parpadeos.

    Casos posibles del campo `tipo_resultado`:
      - 'vehiculo_al_dia'       → Veh. registrado + suscripción vigente. La moto entra.
      - 'vehiculo_vencido'      → Veh. registrado + suscripción vencida. Pregunta cómo cobrar.
      - 'vehiculo_sin_susc'     → Veh. registrado pero sin suscripción activa nunca o cancelada.
      - 'vehiculo_no_registrado' → Placa nueva. Ofrecer registrar o cobrar por horas.
      - 'tiene_acceso_abierto'  → La moto está dentro pagando por horas (cliente ocasional).
    """
    tipo_resultado:      str
    placa:               str

    # Cuando el vehículo existe
    vehiculo:            Optional[VehiculoOut] = None
    suscripcion_actual:  Optional[SuscripcionOut] = None
    historico_resumen:   Optional[dict] = None  # {"total_pagado": X, "ultima_visita": ..., etc}

    # Cuando hay vencimiento
    dias_vencido:        Optional[int] = None
    fecha_vencimiento:   Optional[date] = None

    # Cuando está dentro pagando por horas
    acceso_abierto:      Optional[AccesoOut] = None
    horas_transcurridas: Optional[float] = None
    monto_estimado:      Optional[float] = None

    # Mensaje user-friendly listo para mostrar
    mensaje:             str
    color_semaforo:      str  # 'verde' | 'amarillo' | 'rojo' | 'azul' | 'gris'


# ═══════════════════════════════════════════════════════════════════════════════
# 6. DASHBOARD PARQUEADERO
# ═══════════════════════════════════════════════════════════════════════════════

class DashboardParqueadero(BaseModel):
    # Cupo
    cupo_total:               int
    cupo_ocupado_estimado:    int     # mensuales activos + accesos por hora abiertos
    cupo_disponible:          int
    porcentaje_ocupacion:     float

    # Mensualidades
    mensualidades_activas:    int
    por_vencer_5_dias:        int
    vencidas:                 int

    # Ingresos
    ingresos_hoy:             float
    ingresos_semana:          float
    ingresos_mes:             float

    # Listas para mostrar en el dashboard
    proximos_vencimientos:    List[dict] = []   # [{placa, propietario, fecha_vence, dias_restantes}]
    suscripciones_vencidas:   List[dict] = []
    accesos_dentro:           List[AccesoOut] = []

    # Total de vehículos del parqueadero
    total_vehiculos:          int

    # 👇 Añade esto al final de la clase
    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# 7. REPORTES
# ═══════════════════════════════════════════════════════════════════════════════

class IngresoPorDiaParq(BaseModel):
    fecha:               date
    total_suscripciones: float = 0.0
    total_horas:         float = 0.0
    total_general:       float = 0.0
    cantidad_pagos:      int   = 0


class ReporteIngresosParqueadero(BaseModel):
    start_date:    date
    end_date:      date
    total_general: float
    desglose_por_dia: List[IngresoPorDiaParq]
    desglose_por_metodo: dict  # {"Efectivo": 1200000, "Transferencia": 450000, ...}
    desglose_por_tipo:   dict  # {"mensual": 6000000, "quincenal": 800000, ...}


class TopClienteParq(BaseModel):
    cliente_id:        int
    cliente_nombre:    str
    cantidad_motos:    int
    total_pagado:      float
    cliente_desde:     date
    ultima_renovacion: Optional[date]




# ═══════════════════════════════════════════════════════════════════════════════
# SCHEMAS — WHATSAPP + MÉTODOS DE PAGO
# Pega al final de schemas.py
# ═══════════════════════════════════════════════════════════════════════════════

from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List
from enum import Enum


# ─── Enums ───────────────────────────────────────────────────────────────────
class ModalidadPagoEnum(str, Enum):
    MENSUAL    = "mensual"
    QUINCENAL  = "quincenal"
    DIARIA     = "diaria"
    LIBRE      = "libre"


class TipoPlantillaEnum(str, Enum):
    PAGO                  = "pago"
    RECORDATORIO          = "recordatorio"
    MANUAL                = "manual"
    COMPROBANTE_ENTRADA   = "comprobante_entrada"   # ✨ NUEVO
    RECIBO_SALIDA         = "recibo_salida"         # ✨ NUEVO



# ═══════════════════════════════════════════════════════════════════════════════
# 1. MÉTODOS DE PAGO
# ═══════════════════════════════════════════════════════════════════════════════

class MetodoPagoBase(BaseModel):
    modalidad:     ModalidadPagoEnum
    nombre_metodo: Optional[str] = Field(None, max_length=60)
    link_pago:     Optional[str] = Field(None, max_length=500)
    qr_base64:     Optional[str] = None         # data URI o solo el base64
    qr_mime_type:  Optional[str] = Field(None, max_length=40)
    instrucciones: Optional[str] = None
    is_active:     bool = True

    @validator('link_pago')
    def validar_link(cls, v):
        if v is None or v.strip() == '':
            return None
        v = v.strip()
        if not (v.startswith('http://') or v.startswith('https://') or v.startswith('31')):
            raise ValueError('El link debe empezar con http:// o https://')
        return v

    @validator('qr_base64')
    def limpiar_qr(cls, v):
        """Acepta data URI (data:image/png;base64,XXX) o base64 puro."""
        if not v:
            return None
        if v.startswith('data:'):
            # Es data URI → extraer solo el base64
            try:
                header, b64 = v.split(',', 1)
                return b64
            except ValueError:
                return v
        return v


class MetodoPagoCreate(MetodoPagoBase):
    pass


class MetodoPagoUpdate(BaseModel):
    nombre_metodo: Optional[str] = None
    link_pago:     Optional[str] = None
    qr_base64:     Optional[str] = None
    qr_mime_type:  Optional[str] = None
    instrucciones: Optional[str] = None
    is_active:     Optional[bool] = None


class MetodoPagoOut(MetodoPagoBase):
    id:         int
    empresa_id: int
    created_at: datetime
    updated_at: datetime

    # Campo calculado para no enviar el base64 enorme cuando solo se necesita saber si hay QR
    tiene_qr:        bool = False
    tiene_link:      bool = False
    qr_data_uri:     Optional[str] = None  # data URI completo listo para <img src=...>

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# 2. PLANTILLAS DE WHATSAPP
# ═══════════════════════════════════════════════════════════════════════════════

class PlantillaWhatsAppBase(BaseModel):
    tipo:      TipoPlantillaEnum
    mensaje:   str = Field(..., min_length=10)
    is_active: bool = True


class PlantillaWhatsAppUpdate(BaseModel):
    mensaje:   Optional[str] = None
    is_active: Optional[bool] = None


class PlantillaWhatsAppOut(PlantillaWhatsAppBase):
    id:         int
    empresa_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# 3. GENERACIÓN DE LINK WHATSAPP
# ═══════════════════════════════════════════════════════════════════════════════

class GenerarWhatsAppRequest(BaseModel):
    """
    Request para generar el link wa.me/.
    Caso típico: el operario está en 'Buscar placa' y quiere enviar mensaje.
    """
    vehiculo_id:    Optional[int] = None
    suscripcion_id: Optional[int] = None
    telefono:       Optional[str] = None  # Si no se envía, se toma del cliente del vehículo
    tipo:           TipoPlantillaEnum = TipoPlantillaEnum.PAGO
    monto_override: Optional[float] = None  # Para pagos libres

    # Contexto adicional para plantillas de horas (recibo_salida / comprobante_entrada)
    acceso_id:        Optional[int] = None   # Para resolver placa/nombre de vehículos ocasionales
    minutos:          Optional[int] = None   # Para variable {minutos} en recibo_salida
    metodo_pago_text: Optional[str] = None   # Para variable {metodo_pago} en recibo_salida

    # Permitir editar el mensaje antes de enviarlo (la UI muestra preview editable)
    mensaje_personalizado: Optional[str] = None


class GenerarWhatsAppResponse(BaseModel):
    wa_url:        str          # https://wa.me/573001234567?text=...
    mensaje:       str          # Mensaje sin url-encode (para mostrar en preview)
    telefono:      str          # Teléfono normalizado E.164 (sin +)
    tiene_qr:      bool
    qr_data_uri:   Optional[str] = None  # Si hay QR, se devuelve para mostrarlo
    metodo_nombre: Optional[str] = None  # "Nequi", "Bold"...
    advertencia:   Optional[str] = None  # ej. "El cliente no tiene teléfono registrado"


# ═══════════════════════════════════════════════════════════════════════════════
# 4. HISTORIAL DE ENVÍOS
# ═══════════════════════════════════════════════════════════════════════════════

class EnvioWhatsAppOut(BaseModel):
    id:               int
    empresa_id:       int
    vehiculo_id:      Optional[int]
    suscripcion_id:   Optional[int]
    telefono:         str
    tipo:             TipoPlantillaEnum
    mensaje_enviado:  Optional[str]
    usuario_id:       Optional[int]
    fecha:            datetime
    # Enriquecimiento
    placa:            Optional[str] = None
    cliente_nombre:   Optional[str] = None
    usuario_username: Optional[str] = None

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# 5. PLANTILLAS POR DEFECTO (referencia para inicialización)
# ═══════════════════════════════════════════════════════════════════════════════

PLANTILLAS_DEFAULT = {
    "pago": (
        "Hola {nombre} 👋\n\n"
        "Te escribo desde *{parqueadero}* para informarte sobre el parqueo de tu moto *{placa}*.\n\n"
        "📋 *Resumen:*\n"
        "• Plan: {tipo_plan}\n"
        "• Vence: {fecha_vence}\n"
        "• Valor a pagar: *{monto}*\n"
        "{saldo_linea}\n"
        "💳 *Paga aquí:*\n"
        "{link_pago}\n\n"
        "{instrucciones}\n"
        "Cualquier duda me escribes por aquí. ¡Gracias!"
    ),
    "recordatorio": (
        "Hola {nombre} 👋\n\n"
        "Te recuerdo que la mensualidad de tu moto *{placa}* en *{parqueadero}* vence el *{fecha_vence}* "
        "(en {dias_restantes} días).\n\n"
        "💰 Valor: *{monto}*\n\n"
        "Para evitar contratiempos, puedes pagar desde ya:\n"
        "{link_pago}\n\n"
        "{instrucciones}\n"
        "¡Gracias por confiar en nosotros!"
    ),
    "manual": (
        "Hola {nombre} 👋\n\n"
        "Te contacto desde *{parqueadero}*.\n\n"
        "Sobre tu moto *{placa}*:\n"
        "• Plan: {tipo_plan}\n"
        "• Estado: {fecha_vence}\n"
        "• Valor: {monto}\n\n"
        "{link_pago}\n\n"
        "Quedo atento."
    ),
    # ✨ NUEVA PLANTILLA
    "comprobante_entrada": (
        "Hola {nombre} 👋\n\n"
        "Tu moto *{placa}* ingresó a *{parqueadero}* el {hora_entrada}.\n\n"
        "💰 *Tarifa:*\n"
        "• {tarifa_minuto} por minuto\n"
        "• Equivalente a {tarifa_hora} por hora (referencial)\n"
        "{cobro_minimo_linea}\n"
        "Cuando salgas con tu moto te diremos el valor exacto a pagar según el tiempo.\n\n"
        "💳 *Cuando llegues, paga rápido aquí:*\n"
        "{link_pago}\n\n"
        "{instrucciones}\n"
        "Conserva este mensaje como comprobante de tu ingreso. ¡Gracias!"
    ),
    # ✨ NUEVA PLANTILLA — recibo al salir
    "recibo_salida": (
        "Hola {nombre} 👋\n\n"
        "Confirmamos la salida de tu moto *{placa}* de *{parqueadero}*.\n\n"
        "📋 *Resumen:*\n"
        "• Tiempo total: {minutos} min\n"
        "• Valor pagado: *{monto}*\n"
        "• Método: {metodo_pago}\n\n"
        "Gracias por preferirnos. ¡Vuelve pronto!"
    ),
}


# ═══════════════════════════════════════════════════════════════════════════════
# SCHEMAS — WebAuthn / Biometría
# Pega al final de tu schemas.py
# ═══════════════════════════════════════════════════════════════════════════════

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Any


# ═══════════════════════════════════════════════════════════════════════════════
# REGISTRO DE NUEVA CREDENCIAL
# ═══════════════════════════════════════════════════════════════════════════════

class BiometricRegisterOptionsResponse(BaseModel):
    """
    Respuesta del endpoint /auth/biometric/register/options
    Contiene las opciones que el navegador necesita para crear la credencial.
    El campo 'options' contiene el JSON completo de PublicKeyCredentialCreationOptions.
    """
    options: Any   # dict con challenge, user, rp, pubKeyCredParams, etc.


class BiometricRegisterVerifyRequest(BaseModel):
    """
    Lo que el frontend envía después de que el navegador generó la credencial.
    """
    credential:    Any                    # respuesta del navegador (PublicKeyCredential)
    device_name:   Optional[str] = None   # "iPhone de Keilor", "Samsung Galaxy A52"


class BiometricRegisterVerifyResponse(BaseModel):
    success:        bool
    credential_id:  Optional[int] = None
    device_name:    Optional[str] = None
    message:        str


# ═══════════════════════════════════════════════════════════════════════════════
# LOGIN CON BIOMETRÍA
# ═══════════════════════════════════════════════════════════════════════════════

class BiometricLoginOptionsRequest(BaseModel):
    """
    Para iniciar el login. El usuario es opcional: si lo envía, el sistema
    busca solo credenciales de ese usuario. Si no, el navegador permite al
    usuario elegir cuál huella usar (estilo "passkey").
    """
    username: Optional[str] = None


class BiometricLoginOptionsResponse(BaseModel):
    options: Any   # PublicKeyCredentialRequestOptions


class BiometricLoginVerifyRequest(BaseModel):
    """
    Lo que envía el frontend tras autenticarse con la huella.
    """
    credential: Any   # respuesta del navegador


class BiometricLoginVerifyResponse(BaseModel):
    """
    Respuesta exitosa: JWT completo idéntico al login por contraseña.
    """
    access_token:     str
    token_type:       str = "bearer"
    user_id:          int
    username:         str
    empresa_id:       int
    rol:              Optional[str] = None
    nombre_completo:  Optional[str] = None
    device_name:      Optional[str] = None
    is_expired:       bool = False


# ═══════════════════════════════════════════════════════════════════════════════
# GESTIÓN DE CREDENCIALES (vista en "Mi Perfil")
# ═══════════════════════════════════════════════════════════════════════════════

class CredencialBiometricaOut(BaseModel):
    id:           int
    device_name:  Optional[str]
    user_agent:   Optional[str]
    last_used_at: Optional[datetime]
    created_at:   datetime

    class Config:
        from_attributes = True

# ═══════════════════════════════════════════════════════════════════════════════
# SCHEMAS — Dar de baja con flujo mixto
# Pega al final de schemas.py
# ═══════════════════════════════════════════════════════════════════════════════

class SuscripcionEnBaja(BaseModel):
    """Resumen de una suscripción afectada al dar de baja."""
    id:                int
    tipo:              str            # mensual / quincenal / diaria
    fecha_vencimiento: date
    monto_total:       float
    monto_pagado:      float
    saldo_pendiente:   float
    dias_para_vencer:  int            # negativo si ya está vencida
    es_vigente:        bool

    class Config:
        from_attributes = True


class AccesoAbiertoEnBaja(BaseModel):
    """Resumen de un acceso por horas abierto al dar de baja."""
    id:                int
    fecha_entrada:     datetime
    minutos_dentro:    int
    monto_estimado:    float

    class Config:
        from_attributes = True


class VehiculoBajaInfo(BaseModel):
    """Respuesta del endpoint GET /parqueadero/vehiculos/{id}/baja-info"""
    vehiculo_id:               int
    placa:                     str
    cliente_nombre:            Optional[str] = None
    cliente_cedula:            Optional[str] = None
    suscripciones_activas:     List[SuscripcionEnBaja] = []
    accesos_abiertos:          List[AccesoAbiertoEnBaja] = []
    saldo_total_pendiente:     float = 0.0
    puede_dar_baja_directo:    bool = True   # True solo si NO hay suscripciones ni accesos
    advertencias:              List[str] = []


# ─── Solicitud para dar de baja con flags ─────────────────────────────────

class DarBajaRequest(BaseModel):
    """
    Body del POST /parqueadero/vehiculos/{id}/dar-baja
    El frontend manda los flags según los checkboxes que marque el usuario.
    """
    cancelar_suscripciones:    bool = False    # Cancela todas las activas
    marcar_saldo_incobrable:   bool = False    # Solo aplica si cancelar_suscripciones=True
    cerrar_accesos_abiertos:   bool = False    # Cierra accesos sin cobrar
    cobrar_acceso_abierto:     bool = False    # Si True, registra el cobro y luego cierra
    metodo_pago_acceso:        Optional[str] = "Efectivo"  # solo si cobrar_acceso_abierto=True
    motivo:                    Optional[str] = None        # opcional, queda en motivo_baja


class DarBajaResponse(BaseModel):
    """Respuesta tras dar de baja exitosamente."""
    vehiculo_id:                  int
    placa:                        str
    suscripciones_canceladas:     int = 0
    accesos_cerrados:             int = 0
    accesos_cobrados:             int = 0
    monto_cobrado_accesos:        float = 0.0
    saldo_marcado_incobrable:     float = 0.0
    mensaje:                      str


# =========================
# CATÁLOGO VIRTUAL
# =========================

class CatalogoConfigUpdate(BaseModel):
    slug_catalogo: str = Field(..., pattern=r"^[a-z0-9-]+$")
    whatsapp_pedidos: Optional[str] = None
    logo_base64: Optional[str] = None
    color_primario: Optional[str] = None
    direccion_recogida: Optional[str] = None
    descripcion: Optional[str] = None
    visible_marketplace: Optional[bool] = None
    categoria_marketplace: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None

class CatalogoEmpresaOut(BaseModel):
    nombre: str
    slug_catalogo: str
    whatsapp_pedidos: Optional[str] = None
    logo_base64: Optional[str] = None
    color_primario: str
    direccion: Optional[str] = None
    tipo_negocio: str = "erp"
    descripcion: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None

class MarketplaceEmpresaOut(BaseModel):
    nombre: str
    slug_catalogo: str
    logo_base64: Optional[str] = None
    color_primario: str
    descripcion: Optional[str] = None
    categoria_marketplace: Optional[str] = None
    tipo_negocio: str = "erp"
    total_productos: int = 0

    model_config = ConfigDict(from_attributes=True)

class MarketplaceProductoOut(BaseModel):
    id: int
    nombre: str
    precio: float
    image_count: int = 0
    categoria: Optional[str] = None
    tiene_variantes: bool = False
    empresa_nombre: str
    empresa_slug: str
    empresa_color: str

class CatalogoMesaOut(BaseModel):
    numero: str
    nombre: Optional[str] = None
    zona: Optional[str] = None
    estado: str = "libre"

class CatalogoVarianteOut(BaseModel):
    id: int
    nombre: str
    atributos: dict = {}
    precio: Optional[float] = None
    stock: float = 0.0

    model_config = ConfigDict(from_attributes=True)

class CatalogoProductoOut(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    precio: float
    categoria: Optional[str] = None
    image_count: int = 0
    stock: float = 0.0
    es_servicio: bool = False
    tiene_variantes: bool = False
    variantes: List[CatalogoVarianteOut] = []

    model_config = ConfigDict(from_attributes=True)

class CatalogoPublicoOut(BaseModel):
    empresa: CatalogoEmpresaOut
    productos: List[CatalogoProductoOut]
    total_productos: int
    mesas: List[CatalogoMesaOut] = []


# ── Pedido de restaurante desde catálogo público ──────────────────────────────
class CatalogoItemRestaurante(BaseModel):
    producto_id: int
    nombre_producto: str
    cantidad: float = Field(1.0, gt=0)
    precio_unitario: float = Field(..., ge=0)
    notas: Optional[str] = None
    variante_id: Optional[int] = None

class PedidoRestaurantePublicoIn(BaseModel):
    mesa_numero: str
    items: List[CatalogoItemRestaurante]

class PedidoRestauranteCreatedOut(BaseModel):
    comanda_id: int
    numero_comanda: int
    mesa_numero: str
    total: float


# =========================
# PEDIDOS TIENDA VIRTUAL
# =========================

class DetallePedidoVirtualIn(BaseModel):
    producto_id: int
    cantidad: float = Field(..., gt=0)
    precio_unitario: float = Field(..., ge=0)
    variante_id: Optional[int] = None

class PedidoVirtualCreate(BaseModel):
    nombre_cliente:    str  = Field(..., min_length=2, max_length=200)
    celular_cliente:   str  = Field(..., min_length=7, max_length=30)
    email_cliente:     Optional[str] = None
    tipo_entrega:      str  = "tienda"
    direccion_entrega: Optional[str] = None
    comentarios:       Optional[str] = None
    detalles:          List[DetallePedidoVirtualIn]

class PedidoVirtualCreatedOut(BaseModel):
    id:            int
    numero_pedido: Optional[int] = None
    total:         float
    estado:        str

class PedidoEstadoConsultaIn(BaseModel):
    numero_pedido:   int
    celular_cliente: str = Field(..., min_length=7, max_length=30)

class PedidoEstadoConsultaOut(BaseModel):
    numero_pedido:       Optional[int]
    estado:              str
    estado_label:        str
    cancelado:           bool
    # Etapas del flujo normal (sin contar "cancelado", que es una salida
    # aparte) — para que el cliente vea "estás en el paso 2 de 5", no solo
    # una palabra suelta.
    etapas:              List[str]
    etapas_labels:       List[str]
    etapa_actual_index:  Optional[int] = None   # None si está cancelado
    total_etapas:        int
    total:               float
    fecha_creacion:      Optional[datetime]
    fecha_actualizacion: Optional[datetime]
    tipo_entrega:        str
    direccion_entrega:   Optional[str] = None
    nombre_cliente:      str
    cantidad_items:      int
    empresa_nombre:      str
    empresa_telefono:    Optional[str] = None

class DetallePedidoVirtualOut(BaseModel):
    id:              int
    producto_id:     Optional[int]
    nombre_producto: str
    cantidad:        float
    precio_unitario: float
    subtotal:        float
    variante_id:     Optional[int] = None
    nombre_variante: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class PedidoVirtualOut(BaseModel):
    id:               int
    numero_pedido:    Optional[int] = None
    empresa_id:       int
    nombre_cliente:   str
    celular_cliente:  str
    email_cliente:    Optional[str]
    tipo_entrega:     str
    direccion_entrega:Optional[str]
    comentarios:      Optional[str]
    estado:           str
    total:            float
    stock_descontado: bool
    venta_id:         Optional[int]
    notas_internas:   Optional[str]
    fecha_creacion:       Optional[datetime]
    fecha_actualizacion:  Optional[datetime]
    detalles:         List[DetallePedidoVirtualOut] = []
    model_config = ConfigDict(from_attributes=True)

class PedidoEstadoUpdate(BaseModel):
    estado:          str
    notas_internas:  Optional[str] = None
    motivo_cancelacion: Optional[str] = None

class PedidoVirtualUpdate(BaseModel):
    nombre_cliente:   Optional[str] = None
    celular_cliente:  Optional[str] = None
    email_cliente:    Optional[str] = None
    tipo_entrega:     Optional[str] = None
    direccion_entrega: Optional[str] = None
    comentarios:      Optional[str] = None
    notas_internas:   Optional[str] = None

class ConvertirVentaRequest(BaseModel):
    metodo_pago: str = "Efectivo"
    omitir_inventario: bool = False
    iva_porcentaje: float = 0.0

class PedidoWhatsAppMessage(BaseModel):
    mensaje: str

class PedidoVirtualStats(BaseModel):
    nuevo:          int = 0
    confirmado:     int = 0
    en_preparacion: int = 0
    enviado:        int = 0
    entregado:      int = 0
    cancelado:      int = 0
    total:          int = 0


# ═══════════════════════════════════════════════════════════════════════════════
# PIN DE ACCESO RÁPIDO
# ═══════════════════════════════════════════════════════════════════════════════

class PinSetRequest(BaseModel):
    pin: str  # 4-6 dígitos

class PinVerifyRequest(BaseModel):
    username: str
    pin: str

class PasswordResetRequest(BaseModel):
    email: EmailStr

class RecoverBuscarRequest(BaseModel):
    username: str
    empresa_nit: str

class RecoverVerificarRequest(BaseModel):
    username: str
    empresa_nit: str
    nombre_completo: str

class RecoverCambiarRequest(BaseModel):
    recovery_token: str
    nueva_password: str = Field(..., min_length=1, max_length=80)

class PinVerifyResponse(BaseModel):
    access_token:    str
    token_type:      str = "bearer"
    user_id:         int
    username:        str
    empresa_id:      int
    rol:             Optional[str] = None
    nombre_completo: Optional[str] = None
    is_expired:      bool = False


# ═══════════════════════════════════════════════════════════════════════════════
# MI CUENTA (empresa + admin)
# ═══════════════════════════════════════════════════════════════════════════════

class MiCuentaUpdate(BaseModel):
    empresa_nombre:  Optional[str] = None
    ciudad:          Optional[str] = None
    pais:            Optional[str] = None
    tamano_negocio:  Optional[str] = None
    nombre_completo: Optional[str] = None
    email:           Optional[str] = None
    telefono:        Optional[str] = None

class CambiarPasswordMiCuentaRequest(BaseModel):
    nueva_password:  str = Field(..., min_length=6, max_length=80)


# ═══════════════════════════════════════════════════════════════════════════════
# IMPUESTOS
# ═══════════════════════════════════════════════════════════════════════════════

class TipoImpuestoBase(BaseModel):
    nombre:      str
    codigo:      str
    porcentaje:  float = 0.0
    descripcion: Optional[str] = None
    is_active:   bool  = True

class TipoImpuestoCreate(TipoImpuestoBase):
    pass

class TipoImpuestoUpdate(BaseModel):
    nombre:      Optional[str]   = None
    codigo:      Optional[str]   = None
    porcentaje:  Optional[float] = None
    descripcion: Optional[str]   = None
    is_active:   Optional[bool]  = None

class TipoImpuestoOut(TipoImpuestoBase):
    id:         int
    empresa_id: int
    model_config = ConfigDict(from_attributes=True)

class ProductoImpuestoCreate(BaseModel):
    impuesto_id: int

class ProductoImpuestoOut(BaseModel):
    id:          int
    producto_id: int
    impuesto_id: int
    empresa_id:  int
    impuesto:    Optional[TipoImpuestoOut] = None
    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# LINK DE PAGO POS
# ═══════════════════════════════════════════════════════════════════════════════

class LinkPagoCreate(BaseModel):
    nombre:        str
    tipo:          str  # "qr_imagen" | "url" | "texto"
    link_url:      Optional[str] = None
    qr_base64:     Optional[str] = None
    qr_mime_type:  Optional[str] = None
    texto_pago:    Optional[str] = None   # datos bancarios en texto libre (tipo="texto")
    instrucciones: Optional[str] = None
    is_active:     bool = True

class LinkPagoOut(BaseModel):
    id:            int
    empresa_id:    int
    nombre:        str
    tipo:          str
    link_url:      Optional[str] = None
    qr_base64:     Optional[str] = None
    qr_mime_type:  Optional[str] = None
    texto_pago:    Optional[str] = None
    instrucciones: Optional[str] = None
    is_active:     bool
    model_config = ConfigDict(from_attributes=True)


# =========================
# CONTABILIDAD AUTOMÁTICA
# =========================

class CuentaContableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    codigo: str
    nombre: str
    tipo: str
    naturaleza: str
    nivel: int
    padre_codigo: Optional[str] = None
    permite_movimiento: bool
    is_active: bool

class LineaAsientoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    cuenta_contable_id: int
    descripcion: Optional[str] = None
    debito: float
    credito: float
    orden: int
    cuenta: Optional[CuentaContableOut] = None

class AsientoContableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    numero: int
    fecha: datetime
    descripcion: str
    tipo_origen: str
    referencia_id: Optional[int] = None
    referencia_tipo: Optional[str] = None
    total_debitos: float
    total_creditos: float
    created_at: datetime
    lineas: List[LineaAsientoOut] = []

class BalanceComprobacionItem(BaseModel):
    codigo: str
    nombre: str
    tipo: str
    naturaleza: str
    total_debitos: float
    total_creditos: float
    saldo_debito: float
    saldo_credito: float

class EstadoResultados(BaseModel):
    ingresos_operacionales: float = 0.0
    ingresos_servicios: float = 0.0
    ingresos_financieros: float = 0.0
    total_ingresos: float = 0.0
    costo_ventas: float = 0.0
    utilidad_bruta: float = 0.0
    gastos_personal: float = 0.0
    gastos_operacionales: float = 0.0
    gastos_no_operacionales: float = 0.0
    total_gastos: float = 0.0
    utilidad_neta: float = 0.0
    periodo_inicio: Optional[datetime] = None
    periodo_fin: Optional[datetime] = None

class AsientosListResponse(BaseModel):
    items: List[AsientoContableOut]
    total: int
    page: int
    page_size: int

class BalanceGeneralItem(BaseModel):
    codigo: str
    nombre: str
    saldo: float

class BalanceGeneral(BaseModel):
    activos: List[BalanceGeneralItem] = []
    pasivos: List[BalanceGeneralItem] = []
    patrimonio: List[BalanceGeneralItem] = []
    total_activos: float = 0.0
    total_pasivos: float = 0.0
    total_patrimonio: float = 0.0
    total_pasivos_patrimonio: float = 0.0
    fecha_corte: Optional[datetime] = None

class ResumenIVA(BaseModel):
    iva_generado: float = 0.0
    iva_descontable: float = 0.0
    iva_a_pagar: float = 0.0
    iva_a_favor: float = 0.0
    periodo_inicio: Optional[datetime] = None
    periodo_fin: Optional[datetime] = None

class LineaAsientoManual(BaseModel):
    cuenta_codigo: str
    descripcion: Optional[str] = None
    debito: float = 0.0
    credito: float = 0.0

class AsientoManualCreate(BaseModel):
    fecha: datetime
    descripcion: str
    lineas: List[LineaAsientoManual]

class CierreContableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    periodo_inicio: datetime
    periodo_fin: datetime
    descripcion: Optional[str] = None
    utilidad_neta: float
    created_at: datetime

class CierreContableCreate(BaseModel):
    periodo_inicio: datetime
    periodo_fin: datetime
    descripcion: Optional[str] = None


# =========================
# 📅 AGENDAMIENTO DE CITAS
# =========================

class TrabajadorMini(BaseModel):
    id: int
    nombre_completo: Optional[str] = None
    username: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ServicioAgendableUpdate(BaseModel):
    """Configura un producto como servicio agendable."""
    agendable: bool = True
    duracion_minutos: Optional[int] = 30
    trabajador_ids: List[int] = []


class ServicioAgendable(BaseModel):
    id: int
    nombre: str
    agendable: bool = False
    duracion_minutos: Optional[int] = None
    precio: Optional[float] = None
    trabajadores: List[TrabajadorMini] = []
    model_config = ConfigDict(from_attributes=True)


class CitaBase(BaseModel):
    producto_id: int
    user_id: int
    cliente_id: Optional[int] = None
    fecha_inicio: datetime
    cliente_nombre: Optional[str] = None
    cliente_telefono: Optional[str] = None
    cliente_email: Optional[str] = None
    notas: Optional[str] = None


class CitaCreate(CitaBase):
    pass


class CitaUpdate(BaseModel):
    producto_id: Optional[int] = None
    user_id: Optional[int] = None
    cliente_id: Optional[int] = None
    fecha_inicio: Optional[datetime] = None
    estado: Optional[str] = None
    cliente_nombre: Optional[str] = None
    cliente_telefono: Optional[str] = None
    cliente_email: Optional[str] = None
    notas: Optional[str] = None


class Cita(BaseModel):
    id: int
    producto_id: int
    user_id: int
    cliente_id: Optional[int] = None
    fecha_inicio: datetime
    fecha_fin: datetime
    estado: str
    cliente_nombre: Optional[str] = None
    cliente_telefono: Optional[str] = None
    cliente_email: Optional[str] = None
    notas: Optional[str] = None
    # Datos enriquecidos para la UI
    producto_nombre: Optional[str] = None
    trabajador_nombre: Optional[str] = None
    cliente_display: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class FranjaDisponible(BaseModel):
    inicio: datetime
    fin: datetime
    user_id: int
    trabajador_nombre: Optional[str] = None


class DisponibilidadResponse(BaseModel):
    fecha: date
    producto_id: int
    duracion_minutos: int
    franjas: List[FranjaDisponible] = []


# --- Portal público de agendamiento ---
class ServicioPublico(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    precio: Optional[float] = None
    duracion_minutos: Optional[int] = None
    image_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class LinkPagoPublico(BaseModel):
    """Datos mínimos del link de pago expuestos al portal público (sin IDs internos)."""
    tipo:          str
    link_url:      Optional[str] = None
    qr_base64:     Optional[str] = None
    qr_mime_type:  Optional[str] = None
    texto_pago:    Optional[str] = None
    instrucciones: Optional[str] = None


class AgendamientoPublicoInfo(BaseModel):
    empresa_nombre: str
    slug: str
    logo_base64: Optional[str] = None
    servicios: List[ServicioPublico] = []
    whatsapp: Optional[str] = None
    requiere_anticipo: bool = False
    porcentaje_anticipo: int = 50
    link_pago: Optional[LinkPagoPublico] = None


class CitaPublicaCreate(BaseModel):
    producto_id: int
    user_id: int
    fecha_inicio: datetime
    cliente_nombre: str
    cliente_telefono: Optional[str] = None
    cliente_email: Optional[str] = None
    notas: Optional[str] = None


class CitaPublicaResponse(BaseModel):
    id: int
    producto_nombre: Optional[str] = None
    trabajador_nombre: Optional[str] = None
    fecha_inicio: datetime
    fecha_fin: datetime
    estado: str


# --- Configuración de agendamiento ---
class AgendamientoConfigUpdate(BaseModel):
    hora_apertura: Optional[int] = None
    hora_cierre: Optional[int] = None
    hora_descanso_inicio: Optional[int] = None
    hora_descanso_fin: Optional[int] = None
    dias_laborales: Optional[List[int]] = None
    dias_no_laborales: Optional[List[str]] = None
    whatsapp: Optional[str] = None
    requiere_anticipo: Optional[bool] = None
    porcentaje_anticipo: Optional[int] = None
    mensaje_recordatorio: Optional[str] = None


class AgendamientoConfigOut(BaseModel):
    hora_apertura: int = 8
    hora_cierre: int = 18
    hora_descanso_inicio: Optional[int] = None
    hora_descanso_fin: Optional[int] = None
    dias_laborales: List[int] = [0, 1, 2, 3, 4, 5]
    dias_no_laborales: List[str] = []
    whatsapp: Optional[str] = None
    requiere_anticipo: bool = False
    porcentaje_anticipo: int = 50
    mensaje_recordatorio: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# --- Preparación de cobro de cita ---
# El cobro de citas ya NO se hace en el módulo de agendamiento: al oprimir
# "Cobrar" el frontend pide esta preparación (que garantiza el cliente y reúne
# servicio + trabajador) y redirige a Ventas (POS), donde se registra la venta.
class CitaCobroPrep(BaseModel):
    cita_id: int
    precio: float
    cliente: Cliente
    producto: Producto
    trabajador_id: int
    trabajador_nombre: Optional[str] = None


# --- Cita enriquecida (con precio y venta_id) ---
class CitaFull(BaseModel):
    id: int
    producto_id: int
    user_id: int
    cliente_id: Optional[int] = None
    fecha_inicio: datetime
    fecha_fin: datetime
    estado: str
    cliente_nombre: Optional[str] = None
    cliente_telefono: Optional[str] = None
    cliente_email: Optional[str] = None
    notas: Optional[str] = None
    producto_nombre: Optional[str] = None
    producto_precio: Optional[float] = None
    trabajador_nombre: Optional[str] = None
    cliente_display: Optional[str] = None
    venta_id: Optional[int] = None
    anticipo_monto: Optional[float] = None
    anticipo_pagado: bool = False
    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# TALLER DE MECÁNICA
# ═══════════════════════════════════════════════════════════════════════════════

class VehiculoTallerCreate(BaseModel):
    placa: str = Field(..., min_length=3, max_length=20)
    tipo: str = "carro"  # moto | carro
    marca: Optional[str] = None
    modelo: Optional[str] = None
    anio: Optional[int] = None
    color: Optional[str] = None
    kilometraje: Optional[int] = None
    origen: str = "cliente"  # cliente | compra_reventa
    cliente_id: Optional[int] = None
    foto_ingreso: Optional[str] = None


class VehiculoTallerUpdate(BaseModel):
    marca: Optional[str] = None
    modelo: Optional[str] = None
    anio: Optional[int] = None
    color: Optional[str] = None
    kilometraje: Optional[int] = None
    foto_ingreso: Optional[str] = None


class VehiculoTallerOut(BaseModel):
    id: int
    placa: str
    tipo: str
    marca: Optional[str] = None
    modelo: Optional[str] = None
    anio: Optional[int] = None
    color: Optional[str] = None
    kilometraje: Optional[int] = None
    origen: str
    cliente_id: Optional[int] = None
    cliente_nombre: Optional[str] = None
    foto_ingreso: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class DetalleOrdenTallerCreate(BaseModel):
    tipo: str = "repuesto"  # repuesto | mano_obra | servicio_externo
    producto_id: Optional[int] = None
    descripcion: str = Field(..., min_length=1, max_length=200)
    cantidad: float = Field(1.0, gt=0)
    costo_unitario: float = Field(..., ge=0)


class DetalleOrdenTallerOut(BaseModel):
    id: int
    tipo: str
    producto_id: Optional[int] = None
    descripcion: str
    cantidad: float
    costo_unitario: float
    subtotal: float
    fecha: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class OrdenTallerCreate(BaseModel):
    vehiculo_id: Optional[int] = None       # si ya existe el vehículo
    vehiculo: Optional[VehiculoTallerCreate] = None  # o crearlo junto con la orden
    tipo_orden: str = "reparacion_cliente"  # reparacion_cliente | remanufactura_reventa
    mecanico_id: Optional[int] = None
    descripcion_problema: Optional[str] = None
    fecha_estimada_entrega: Optional[datetime] = None
    precio_compra_vehiculo: Optional[float] = None   # remanufactura_reventa


class OrdenTallerUpdate(BaseModel):
    mecanico_id: Optional[int] = None
    diagnostico: Optional[str] = None
    descripcion_problema: Optional[str] = None
    fecha_estimada_entrega: Optional[datetime] = None
    valor_cobrado: Optional[float] = None
    precio_venta_sugerido: Optional[float] = None
    notas_internas: Optional[str] = None


class OrdenTallerEstadoUpdate(BaseModel):
    estado: str
    notificar_cliente: bool = True


class OrdenTallerCerrarCliente(BaseModel):
    """Cierre del flujo reparacion_cliente: cobra y entrega."""
    valor_cobrado: float = Field(..., ge=0)
    metodo_pago: Optional[str] = "Efectivo"


class OrdenTallerCerrarReventa(BaseModel):
    """Cierre del flujo remanufactura_reventa: vende el vehículo.

    El precio de venta se reparte entre hasta 3 formas de pago, que pueden
    combinarse libremente (ej: parte efectivo + parte a crédito + un
    vehículo recibido en permuta): monto_efectivo + monto_credito +
    permuta_valor = precio total de la venta.
    """
    monto_efectivo: float = Field(0, ge=0)
    metodo_pago_efectivo: Optional[str] = "Efectivo"
    monto_credito: float = Field(0, ge=0)          # queda como cuenta por cobrar del comprador
    comprador_cliente_id: Optional[int] = None      # obligatorio si monto_credito > 0
    permuta_valor: float = Field(0, ge=0)           # valor asignado al vehículo recibido en permuta
    permuta_vehiculo: Optional[VehiculoTallerCreate] = None  # obligatorio si permuta_valor > 0


class OrdenTallerOut(BaseModel):
    id: int
    vehiculo_id: int
    vehiculo: Optional[VehiculoTallerOut] = None
    tipo_orden: str
    mecanico_id: Optional[int] = None
    mecanico_nombre: Optional[str] = None
    estado: str
    descripcion_problema: Optional[str] = None
    diagnostico: Optional[str] = None
    fecha_ingreso: Optional[datetime] = None
    fecha_estimada_entrega: Optional[datetime] = None
    fecha_entrega_real: Optional[datetime] = None
    valor_cobrado: Optional[float] = None
    estado_pago: str
    precio_compra_vehiculo: Optional[float] = None
    precio_venta_sugerido: Optional[float] = None
    precio_venta_final: Optional[float] = None
    venta_id: Optional[int] = None
    notas_internas: Optional[str] = None
    detalles: List[DetalleOrdenTallerOut] = []
    costo_acumulado: float = 0.0
    margen: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)


class TallerStatsOut(BaseModel):
    ordenes_activas: int = 0
    vehiculos_en_reparacion: int = 0
    vehiculos_en_reventa: int = 0
    ingresos_servicios_mes: float = 0.0
    invertido_reventa_mes: float = 0.0
    vendido_reventa_mes: float = 0.0
    margen_reventa_mes: float = 0.0
