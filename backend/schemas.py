from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime, date
from enum import Enum

# =========================
# MULTI-TENANT (EMPRESAS) & SAAS
# =========================

class EmpresaBase(BaseModel):
    nombre: str
    nit: Optional[str] = None
    logo_url: Optional[str] = None
    color_primario: str = "#F43F5E"
    
    # ✅ CAMPOS PARA EL SAAS Y EL TRIAL
    plan_type: Optional[str] = "trial"
    trial_ends_at: Optional[datetime] = None
    
    # 👇 AÑADIDO: El campo mágico para ocultar/mostrar módulos en el Frontend
    modulos_habilitados: Optional[List[str]] = None

class EmpresaCreate(EmpresaBase):
    pass

class Empresa(EmpresaBase):
    id: int
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class EmpresaOut(EmpresaBase):
    id: int
    is_active: bool
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class EmpresaWithAdminCreate(BaseModel):
    empresa: EmpresaCreate
    admin_username: str
    admin_password: str

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
    modules: List[Modulo] = []
    model_config = ConfigDict(from_attributes=True)

class UserBase(BaseModel):
    username: str
    role_id: int

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

class ClienteCreate(ClienteBase):
    pass

class Cliente(ClienteBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class ClienteDetails(Cliente):
    deuda_actual: float

# =========================
# PRODUCTOS / INVENTARIO
# =========================
class ProductoBase(BaseModel):
    nombre: str
    precio: float
    costo: float = 0.0
    es_servicio: bool = False
    unidad_medida: Optional[str] = "UND"
    stock_minimo: float = 0.0
    grupo_item: int = 2 

class ProductoCreate(ProductoBase):
    pass

class Producto(ProductoBase):
    id: int
    stock_actual: float = 0.0
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
    producto_id: int
    cantidad: Optional[float]
    precio_unitario: Optional[float] = None
    descuento_pct: float = 0.0

class DetalleVentaBase(BaseModel):
    producto_id: int
    cantidad: Optional[float]

class DetalleVenta(DetalleVentaBase):
    id: int
    venta_id: int
    precio_unitario: float
    producto: Optional[Producto] = None
    model_config = ConfigDict(from_attributes=True)

class VentaBase(BaseModel):
    cliente_id: int
    detalles: List[DetalleVentaCreate]
    pagada: bool = True
    iva_porcentaje: float = 0.0
    metodo_pago: Optional[str] = None

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
    model_config = ConfigDict(from_attributes=True)

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
    producto_id: int
    cantidad: float
    precio_unitario: float

class DetalleCompraCreate(DetalleCompraBase):
    pass

class DetalleCompra(DetalleCompraBase):
    id: int
    compra_id: int
    producto: Producto
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

class Compra(CompraBase):
    id: int
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

class RecetaItemCreate(RecetaItemBase):
    pass

class RecetaItem(RecetaItemBase):
    id: int
    receta_id: int
    insumo: Producto
    model_config = ConfigDict(from_attributes=True)

class RecetaServicioBase(BaseModel):
    servicio_id: int

class RecetaServicio(RecetaServicioBase):
    id: int
    receta_id: int
    servicio: Producto
    model_config = ConfigDict(from_attributes=True)

class RecetaBase(BaseModel):
    producto_id: int
    nombre: str
    descripcion: Optional[str] = None

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
    pass

class LoteServicioPrecio(BaseModel):
    servicio_id: int
    precio: float

class LoteProduccionConfirm(BaseModel):
    cantidad_real: float
    precios_servicios: List[LoteServicioPrecio] = []
    observaciones: Optional[str] = None

class LoteProduccion(LoteProduccionBase):
    id: int
    cantidad_real: Optional[float] = None
    costo_total: float
    costo_unitario_resultado: float
    fecha_planificada: datetime
    fecha_confirmacion: Optional[date] = None
    estado: str
    receta: Receta
    cliente: Optional[Cliente] = None
    venta_id: Optional[int] = None
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
    metodo_pago: str = "Efectivo"

class GastoOut(BaseModel):
    id: int
    usuario_id: int
    tercero_id: Optional[int] = None
    tercero: Optional[TerceroReducido] = None
    monto: float
    concepto: str
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
    costo: float
    precio: float
    valor_costo: float
    valor_venta: float
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
    recaudo_ultimos_30_dias: List[SalesByDay] = [] # Gráfica independiente
    
    # Comunes
    ordenes_recientes: List[OrdenTrabajo]

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



# =========================
# REGISTRO AUTOSERVICIO (SAAS)
# =========================

class RegistroSaaS(BaseModel):
    nombre_empresa: str
    username: str
    password: str
    tipo_negocio: str  # Campo obligatorio para la clasificación automática


# =========================
# INTEGRACIÓN BOLD (PAGOS SAAS)
# =========================
class BoldHashRequest(BaseModel):
    plan_name: str  # Ej: "premium_mensual" o "premium_anual"

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

class PlanSuscripcionCreate(PlanSuscripcionBase):
    pass

class PlanSuscripcionUpdate(BaseModel):
    nombre: Optional[str] = None
    precio: Optional[float] = None
    dias_duracion: Optional[int] = None
    caracteristicas: Optional[str] = None
    is_active: Optional[bool] = None

class PlanSuscripcionOut(PlanSuscripcionBase):
    id: int
    model_config = ConfigDict(from_attributes=True)




class RegistroPagoOut(BaseModel):
    id: int
    monto: float
    moneda: str
    metodo_pago: str
    bold_tx_id: str
    email_pagador: str
    fecha_pago: datetime
    empresa_nombre: str
    plan_nombre: str
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
    modalidad: str # 'Diario', 'Semanal', 'Quincenal', 'Mensual'

class CuotaResponse(BaseModel):
    id: int
    numero_cuota: int
    monto_cuota: float
    saldo_pendiente: float
    fecha_vencimiento: datetime
    estado_pago: str
    fecha_pago: Optional[datetime] = None

    class Config:
        from_attributes = True

class PrestamoResponse(BaseModel):
    id: int
    cliente_id: int
    monto_prestado: float
    tasa_interes: float
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