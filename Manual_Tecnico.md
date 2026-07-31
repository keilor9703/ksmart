# Manual Técnico — Ksmart360
## Versión 3.0.0 | Arquitectura SaaS Multi-Tenant | Mayo 2026

Este documento describe la arquitectura, modelos de datos, lógica de negocio crítica, integraciones externas y procedimientos de despliegue y mantenimiento del sistema Ksmart360. Está orientado a desarrolladores backend/frontend y administradores de infraestructura.

---

## 1. Arquitectura General

Ksmart360 utiliza un enfoque desacoplado de tres capas:

```
┌─────────────────────────┐
│  React 18 SPA (Vercel)  │  ← Material UI v5, React Router v6, Axios
└────────────┬────────────┘
             │ HTTPS / JSON REST
┌────────────▼────────────┐
│  FastAPI (Render)        │  ← Python 3.11, SQLAlchemy, Pydantic v2, JWT
└────────────┬────────────┘
             │ ORM / SQL
┌────────────▼────────────┐
│  PostgreSQL (Supabase)   │  ← Shared Database, Shared Schema multi-tenant
└─────────────────────────┘
```

### 1.1 Patrón Multi-Tenant

Patrón: **Shared Database, Shared Schema**.  
Aislamiento mediante `empresa_id` obligatorio en cada tabla de negocio.

```python
class TenantMixin:
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False, index=True)
    empresa    = relationship("Empresa")
```

Todos los modelos de negocio heredan de `TenantMixin`. La dependencia de FastAPI `get_current_active_user` extrae el `empresa_id` del JWT y lo inyecta en todas las consultas, haciendo imposible el acceso cruzado entre tenants a nivel de aplicación.

### 1.2 Estructura de Directorios del Backend

```
backend/
├── main.py                        # App FastAPI, CORS, montaje de routers, migrations
├── models.py                      # 57 modelos SQLAlchemy (1 140 líneas)
├── schemas.py                     # Schemas Pydantic request/response (2 223 líneas)
├── database.py                    # Engine, SessionLocal, run_migrations()
├── core/
│   ├── config.py                  # Settings (SECRET_KEY, DATABASE_URL, etc.)
│   ├── security.py                # Hash de contraseñas, creación/verificación JWT
│   └── constants.py               # Constantes globales del dominio
├── crud/                          # Funciones CRUD modulares por dominio
├── services/                      # Lógica de negocio compleja (cálculos, notificaciones)
├── jobs_service.py                # Tareas programadas (cron-like)
└── api/v1/endpoints/              # 31 módulos de endpoints (ver sección 3)
```

---

## 2. Modelos de Datos (SQLAlchemy)

### 2.1 Modelo Central: Empresa (Tenant)

```python
class Empresa(Base):
    id                           # PK
    nombre, nit, email, telefono
    tipo_empresa                 # 'erp' | 'prestamista' | 'parqueadero' | 'lavadero'
    plan                         # 'trial' | 'premium' | 'vitalicio' | 'canceled'
    fecha_inicio_plan, fecha_fin_plan
    is_plan_expired              # @property calculado
    is_protected                 # Empresas de demo/sistema (no expiran)
    # DIAN / Facturación electrónica
    facturacion_electronica_activa: bool
    matias_api_key, matias_test_mode
    responsabilidad_fiscal_codes  # JSON list
    # SaaS / Pagos
    wompi_customer_id, wompi_payment_source_id
    # Catálogo virtual
    catalogo_slug, catalogo_whatsapp, catalogo_logo_base64
```

### 2.2 Usuarios y Roles

```python
class User(TenantMixin):
    username, hashed_password, email, nombre_completo
    role_id → Role
    is_active, is_superadmin

class Role(TenantMixin):
    nombre   # 'Admin' | 'Operador' | 'Cobrador'
    modules  → [RoleModule]  # módulos habilitados para el rol

class RoleModule(TenantMixin):
    role_id, module_key  # clave del módulo habilitado

class CredencialBiometrica(TenantMixin):
    user_id, credential_id, public_key, sign_count
    # FIDO2/WebAuthn — vinculada a user_id

class BiometricChallenge:
    challenge, created_at, expires_at
```

### 2.3 Inventario

```python
class Producto(TenantMixin):
    nombre, codigo_barras, referencia, descripcion
    precio_venta, costo, iva_porcentaje
    stock_actual, stock_minimo
    unidades_por_empaque          # empaque vs. unidad de venta
    maneja_lotes: bool            # activa FEFO
    imagenes                      # JSON list de base64 WebP
    grupo_item → GrupoProducto
    es_servicio: bool             # servicios no descuentan stock
    mostrar_en_catalogo: bool     # visible en catálogo virtual

class GrupoProducto(TenantMixin):
    nombre, codigo, color, orden  # para UI Touch POS
    es_predefinido: bool

class LoteExistencia(TenantMixin):
    producto_id, numero_lote, fecha_vencimiento
    cantidad_disponible

class InventoryMovement(TenantMixin):
    producto_id, tipo              # 'ENTRADA' | 'SALIDA' | 'AJUSTE'
    cantidad, costo_unitario
    motivo                         # 'venta' | 'compra' | 'ajuste' | 'produccion'
    lote_id → LoteExistencia       # nullable; trazabilidad FEFO
    user_id, venta_id, compra_id   # FK de origen
```

### 2.4 Ventas y Pagos

```python
class Venta(TenantMixin):
    numero_factura, cliente_id → Cliente
    total, iva_total, descuento_total
    estado_pago                    # 'pendiente' | 'pagado' | 'parcial'
    monto_pagado
    # Facturación electrónica DIAN
    cufe, qr_data, xml_url, pdf_url
    estado_electronico             # 'pendiente' | 'enviado' | 'aceptado' | 'rechazado'
    mensaje_proveedor              # respuesta Matias API
    detalles → [DetalleVenta]
    pagos    → [Pago]

class DetalleVenta(TenantMixin):
    venta_id, producto_id → Producto
    cantidad, precio_unitario, iva_porcentaje, descuento

class Pago(TenantMixin):
    venta_id, metodo               # 'efectivo' | 'transferencia' | 'tarjeta' | 'credito'
    monto, referencia
```

### 2.5 Clientes / Terceros

```python
class Cliente(TenantMixin):
    nombre, identificacion, tipo_identificacion
    # Campos DIAN obligatorios
    tipo_documento_id, dv          # dígito verificación NIT
    responsabilidad_fiscal_codes   # JSON list (gran contribuyente, etc.)
    email, telefono, direccion, ciudad
    cupo_credito, saldo_cartera
    es_proveedor: bool
```

### 2.6 Préstamos y Cartera

```python
class Prestamo(TenantMixin):
    cliente_id, monto_capital, tasa_interes, tasa_mora
    periodicidad                   # 'diario' | 'semanal' | 'quincenal' | 'mensual'
    num_cuotas, estado             # 'activo' | 'cancelado' | 'vencido'
    cuotas → [CuotaPrestamo]

class CuotaPrestamo(TenantMixin):
    prestamo_id, numero_cuota, fecha_vencimiento
    valor_cuota, valor_pagado, valor_mora
    estado                         # 'pendiente' | 'pagado' | 'vencido'
    cobrador_id → User             # cobrador asignado
    fecha_pago, metodo_pago
    evidencias → [EvidenciaCobro]

class EvidenciaCobro(TenantMixin):
    cuota_id, foto_url
    latitud, longitud              # GPS del cobrador en campo
    notas, fecha_registro
```

### 2.7 Producción

```python
class Receta(TenantMixin):
    nombre, producto_terminado_id → Producto
    rendimiento_unidades

class RecetaItem(TenantMixin):
    receta_id, ingrediente_id → Producto
    cantidad, unidad_medida

class LoteProduccion(TenantMixin):
    receta_id, cantidad_producida
    estado                         # 'en_proceso' | 'finalizado'
    costo_total, costo_unitario
    fecha_inicio, fecha_fin
```

### 2.8 Parqueadero

```python
class ConfigParqueadero(TenantMixin):
    capacidad_total, capacidad_disponible
    tarifa_hora, tarifa_fraccion, tarifa_dia
    tarifa_mensual

class Vehiculo(TenantMixin):
    placa, tipo                    # 'moto' | 'carro' | 'camioneta'
    propietario_nombre, propietario_telefono
    foto_url
    suscripciones → [SuscripcionParqueadero]

class SuscripcionParqueadero(TenantMixin):
    vehiculo_id, tipo              # 'mensual' | 'hora'
    fecha_inicio, fecha_fin
    monto_pagado, metodo_pago
    estado                         # 'vigente' | 'vencida'
```

### 2.9 Facturación DIAN

```python
class ResolucionDian(TenantMixin):
    numero_resolucion, prefijo
    rango_inicio, rango_fin, numero_actual
    clave_tecnica                  # para CUFE
    vigencia_desde, vigencia_hasta
    es_activa: bool
```

### 2.10 Otros Modelos Relevantes

```python
class Compra(TenantMixin) + DetalleCompra
class OrdenTrabajo(TenantMixin) + EvidenciaOT
class CorteCaja(TenantMixin) + Gasto
class Notificacion(TenantMixin)           # centro de notificaciones in-app
class SaaSAnnouncement                    # banners globales del sistema
class SaaSJobRegistry                     # registro de jobs programados
class SaaSAuditLog                        # trazabilidad de acciones admin
class HistoricoPrecioCacao                # precios de mercado del cacao
class PlantillaWhatsApp + EnvioWhatsApp   # sistema de mensajería
```

---

## 3. Endpoints FastAPI (31 módulos)

### 3.1 Autenticación y SaaS

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth/register` | Registro de empresa: crea tenant, admin, módulos y rol Admin |
| POST | `/auth/token` | Login OAuth2PasswordRequestForm → JWT |
| POST | `/auth/biometric/register` | Registrar credencial FIDO2/WebAuthn |
| POST | `/auth/biometric/authenticate` | Challenge-response biométrico |
| GET | `/superadmin/empresas` | Listar todos los tenants |
| PATCH | `/superadmin/empresas/{id}/plan` | Cambiar plan (trial/premium/vitalicio/canceled) |
| POST | `/superadmin/impersonate/{id}` | Emitir JWT temporal con identidad de otra empresa |
| POST | `/wompi/webhook` | Procesamiento de pago Wompi → activación de plan |

### 3.2 Ventas

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/ventas/` | Crear venta: valida stock, cupo crédito, consume lotes FEFO |
| GET | `/ventas/` | Listar con paginación (skip, limit) |
| PUT | `/ventas/{id}` | Actualizar estado/datos de venta |
| DELETE | `/ventas/{id}` | Eliminar con reversión completa de stock |
| GET | `/devoluciones/` | Listar devoluciones |
| POST | `/devoluciones/` | Crear nota crédito + reingreso de stock |
| GET | `/cotizaciones/` | Listar cotizaciones |
| POST | `/cotizaciones/` | Crear cotización |
| POST | `/cotizaciones/{id}/facturar` | Convertir cotización en venta |

### 3.3 Inventario

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET/POST/PUT/DELETE | `/productos/` | CRUD completo de productos |
| GET | `/productos/barcode/{code}` | Búsqueda en cascada: Local → OpenFoodFacts → UPCitemdb → OpenBeautyFacts |
| GET/POST/PUT/DELETE | `/grupos-producto/` | Grupos con color, orden para Touch POS |
| GET | `/inventario/kardex/{id}` | Kardex por promedio ponderado |
| GET | `/inventario/kardex/{id}/export` | Exportar kardex Excel/CSV |
| POST | `/inventario/movimientos` | Registrar entrada/salida/ajuste manual |
| GET | `/inventario/movimientos/template` | Plantilla Excel para carga masiva |
| GET/POST/PUT/DELETE | `/lotes/` | Gestión de lotes (fechas de vencimiento) |

### 3.4 Préstamos

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/prestamos/` | Crear préstamo con plan de cuotas automático |
| GET | `/prestamos/` | Listar préstamos del tenant |
| GET | `/prestamos/cuotas-pendientes` | Ruta del día (filtro zona opcional) |
| POST | `/prestamos/{id}/pagar-cuota` | Registrar pago con método y monto |
| POST | `/prestamos/{id}/reprogramar-cuota` | Nueva fecha (solo fechas futuras) |
| POST | `/prestamos/{id}/abono-capital` | Abono: recalcula cuotas restantes |
| POST | `/prestamos/{id}/asignar-cobrador` | Asignar cobrador a cuota(s) |
| GET | `/prestamos/cuotas/{id}/recibo-pdf` | Generar recibo PDF (ReportLab) |

### 3.5 Parqueadero

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET/PUT | `/parqueadero/config` | Tarifas y capacidad |
| GET/POST/PUT/DELETE | `/parqueadero/vehiculos` | Gestión de vehículos |
| POST | `/parqueadero/vehiculos/entrada` | Registrar entrada y timestamp |
| POST | `/parqueadero/vehiculos/salida` | Calcular cobro según tarifa y registrar salida |
| GET/POST | `/parqueadero/suscripciones` | Crear suscripción mensual |
| POST | `/parqueadero/suscripciones/retroactiva` | Suscripción con fecha de inicio pasada |
| GET | `/parqueadero/reportes/ingresos` | Ingresos por rango de fechas |
| GET | `/cron/parqueadero/expirar` | Job: marcar suscripciones vencidas |

### 3.6 Reportes

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/reportes/dashboard` | KPIs: ventas hoy, cartera total, stock bajo, mora |
| GET | `/reportes/ventas_summary` | Totales de ventas por período |
| GET | `/reportes/productos_vendidos` | Top productos por unidades y monto |
| GET | `/reportes/clientes_compradores` | Historial de compras por cliente |
| GET | `/reportes/clientes_deudores` | Deudores con días de mora |
| GET | `/reportes/rentabilidad_productos` | Margen bruto por producto |
| GET | `/reportes/cuentas_por_cobrar` | Aging de cuentas por cobrar |
| GET | `/reportes/iva-neto` | IVA generado (ventas) vs descontable (compras) |
| GET | `/reportes/productividad` | Métricas por operario en período |
| GET | `/reportes/produccion-summary` | Estado de lotes de producción |

---

## 4. Lógica de Negocio Crítica

### 4.1 POS — Punto de Venta

**Modos de operación:**
- **Clásico** (`Ventas.js`): búsqueda por teclado + código de barras, tabla de detalle editable.
- **Touch** (`TouchPOSMode.js`): tarjetas de producto por grupo, tap para agregar al carrito, optimizado para tablet.

**Escáner de código de barras:**
- API principal: `BarcodeDetector` (nativa Chrome/Android). Formatos: EAN-13, EAN-8, Code-128, QR, UPC-E, Code-39, ITF.
- Fallback: ZXing-js para navegadores sin `BarcodeDetector`.
- Loop `requestAnimationFrame` con tick de 120 ms, `useRef` de cooldown (1 500 ms) para evitar doble-lectura sin re-render.
- La cámara permanece activa tras escanear — flash verde de confirmación visual durante 380 ms.

**Validaciones en `POST /ventas/`:**
1. Stock suficiente por producto (excepto `es_servicio=True`).
2. Cupo de crédito del cliente (método de pago `credito`).
3. Si `maneja_lotes=True`, consume lotes por FEFO (`crud.consumir_stock_fefo()`).
4. Actualiza `saldo_cartera` del cliente si es venta a crédito.

**Reversión en `DELETE /ventas/{id}`:**
- `check_can_delete_venta()` bloquea eliminación si tiene pagos aplicados.
- Si pasa la validación: reingresa stock de cada `DetalleVenta`, elimina `InventoryMovement` relacionados.

### 4.2 Inventario FEFO

Para productos con `maneja_lotes=True`:
1. Al registrar una compra, se crea un `LoteExistencia` con `fecha_vencimiento`.
2. En cada venta, `consumir_stock_fefo()` ordena los lotes por `fecha_vencimiento ASC` y consume de los más próximos a vencer primero.
3. El `InventoryMovement` registra el `lote_id` para trazabilidad completa.

### 4.3 Barcode Lookup en Cascada

Endpoint `GET /productos/barcode/{code}`:
```
1. Buscar en tabla productos (empresa_id actual)     → si encuentra, retorna
2. OpenFoodFacts API (alimentos)                     → si encuentra, retorna metadatos
3. UPCitemdb API (retail/electrónicos)               → si encuentra, retorna
4. OpenBeautyFacts + OpenPetFoodFacts                → especialidades
5. Si nada: retorna 404 con sugerencia de crear manual
```
El frontend pre-rellena nombre, descripción y categoría. El usuario solo asigna precio.

### 4.4 Mora Automática en Préstamos

- `CuotaPrestamo.valor_mora` se calcula en tiempo real al consultar: `saldo_pendiente × tasa_mora_diaria × días_vencidos`.
- `tasa_mora` se almacena en `Prestamo` (configurable por préstamo).
- El recibo PDF incluye desglose: capital pendiente + intereses + mora.

### 4.5 Abono a Capital

`POST /prestamos/{id}/abono-capital`:
1. Aplica el monto al `monto_capital` del préstamo.
2. Recalcula el `valor_cuota` de las cuotas pendientes (`estado = 'pendiente'`).
3. La distribución es proporcional: `nuevo_valor = saldo_restante / num_cuotas_pendientes`.

### 4.6 Facturación Electrónica DIAN (Matias API)

1. Al crear una `Venta`, si `empresa.facturacion_electronica_activa=True`:
   - Consulta la `ResolucionDian` activa.
   - Incrementa `numero_actual` y asigna `numero_factura = f"{prefijo}{numero_actual}"`.
   - Llama a Matias API con el XML de la factura.
   - Almacena `cufe`, `qr_data`, `xml_url`, `pdf_url` en la venta.
   - Actualiza `estado_electronico`: `'enviado'` / `'aceptado'` / `'rechazado'`.
2. Si `vigencia_hasta < hoy` o `numero_actual >= rango_fin`, el sistema bloquea la venta y notifica al admin.

### 4.7 Motor de Suscripciones SaaS

- **Trial**: Al registrar empresa, `plan='trial'`, `fecha_fin_plan = hoy + 14 días`.
- **Expiración**: `jobs_service.py` corre diariamente y marca `plan='canceled'` cuando `fecha_fin_plan < hoy`.
- **Activación Wompi**: El webhook `POST /wompi/webhook` verifica la firma HMAC, actualiza `plan='premium'` y registra `wompi_customer_id` + `wompi_payment_source_id`.
- **Middleware 402**: En cada mutación (POST/PUT/DELETE), el backend verifica `is_plan_expired`. Si expira, retorna `HTTP 402 Payment Required`. Las empresas `is_protected=True` nunca expiran.

### 4.8 Catálogo Virtual Público

- Ruta pública (sin autenticación): `GET /catalogo/{slug}`.
- Filtra productos donde `mostrar_en_catalogo=True` ordenados por grupo y nombre.
- El slug es único por empresa y configurable por el admin.
- El botón "Pedir por WhatsApp" genera un mensaje pre-estructurado con la lista del carrito codificado en URL.

---

## 5. Seguridad

### 5.1 JWT

```python
# Payload del token:
{
  "sub": username,
  "empresa_id": int,
  "modulos": ["ventas", "inventario", ...],  # módulos del rol
  "exp": timestamp
}
```

Todos los endpoints protegidos usan `Depends(get_current_active_user)` que:
1. Decodifica y valida el JWT.
2. Verifica que `user.is_active=True`.
3. Inyecta `current_user` con `empresa_id` para todas las queries.

### 5.2 WebAuthn / Biometría

1. `POST /auth/biometric/register`: genera desafío FIDO2, el cliente firma con TPM/biométrico, se almacena `public_key` y `credential_id` en `CredencialBiometrica`.
2. `POST /auth/biometric/authenticate`: nuevo desafío, cliente firma, servidor verifica con `public_key`, emite JWT normal.
3. No se transmite ni almacena datos biométricos. Solo la clave pública FIDO2.

### 5.3 CORS

Orígenes permitidos:
- `http://localhost:3000` (desarrollo)
- `https://appksmp.vercel.app`
- `https://ksmart360.vercel.app`
- `https://ksmart360.com`

---

## 6. Frontend — Arquitectura React

### 6.1 Theming

```js
// theme.js — getAppTheme(mode: 'light' | 'dark')
// Detecta automáticamente el tema del SO:
const [mode, setMode] = useState(() => {
  const saved = localStorage.getItem('themeMode');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
});
// Listener en vivo para cambios de OS theme:
useEffect(() => {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', (e) => {
    if (!localStorage.getItem('themeMode')) setMode(e.matches ? 'dark' : 'light');
  });
}, []);
```

Paleta: Acento `#FF6020`, Secundario `#10B981`, Error `#EF4444`, Fondo dark `#0d1117`.

### 6.2 Cliente Axios (`api.js`)

- Interceptor request: inyecta `Authorization: Bearer <token>` desde `localStorage`.
- Interceptor response: en `401` limpia token y redirige a `/login`.

### 6.3 Estructura de Módulos

Cada módulo en `features/` sigue el patrón:
```
features/módulo/
├── MóduloList.js      # Tabla/lista con paginación y filtros
├── MóduloForm.js      # Dialog de creación/edición
├── MóduloDetail.js    # Vista de detalle
└── index.js           # Re-exports
```

### 6.4 Touch POS Mode (`TouchPOSMode.js`)

- Componentes: `ProductCard`, `CartItemRow`, `CartPanel`, `GroupSection`.
- `ProductCard`: `onPointerDown/Up/Leave/Cancel` para animación de press (scale 0.92), badge de cantidad en top-right, imagen base64 o avatar inicial, barra de stock bajo.
- Layout responsive: Desktop → panel carrito fijo 306 px a la derecha. Mobile → FAB con contador → Dialog full-screen.
- Estado del carrito compartido con Ventas.js mediante props: `saleDetails`, `setSaleDetails`.

---

## 7. Tareas Programadas (jobs_service.py)

| Job | Frecuencia | Acción |
|-----|-----------|--------|
| Expiración de trials | Diario | Marca `plan='canceled'` si `fecha_fin_plan < hoy` |
| Precio del cacao | Cada hora | Actualiza `HistoricoPrecioCacao` desde Yahoo Finance + TRM |
| Alertas parqueadero | Diario | Marca `SuscripcionParqueadero.estado='vencida'` |
| Notificaciones stock | Por evento | `check_and_notify_low_stock()` al registrar salida |

---

## 8. Integraciones Externas

| Servicio | Uso | Configuración |
|----------|-----|---------------|
| **Matias API** | Facturación electrónica DIAN (XML, CUFE, PDF) | `MATIAS_API_KEY` en `.env` |
| **Wompi** | Pagos SaaS (suscripciones) | `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET` |
| **OpenFoodFacts** | Lookup de productos alimentarios por barcode | Sin API key |
| **UPCitemdb** | Lookup de productos retail/electrónicos por barcode | Sin API key |
| **OpenBeautyFacts** | Lookup de cosméticos por barcode | Sin API key |
| **Yahoo Finance (ICE)** | Precio internacional del cacao en tiempo real | Sin API key |
| **Datos.gov.co** | TRM (Tasa Representativa del Mercado) diaria | Sin API key |
| **WhatsApp Cloud API** | Notificaciones parqueadero, recibos préstamos, pedidos catálogo | Número y token en `PlantillaWhatsApp` |
| **WebAuthn/FIDO2** | Autenticación biométrica sin contraseña | Estándar del navegador, sin API key |

---

## 9. Base de Datos — Migraciones

Las migraciones son manejadas por el motor personalizado en `database.py` mediante `run_migrations()`:

```python
def run_migrations(engine):
    # Crea tablas nuevas con CREATE TABLE IF NOT EXISTS
    Base.metadata.create_all(bind=engine)
    # Agrega columnas faltantes con ALTER TABLE ... ADD COLUMN IF NOT EXISTS
    # Ejemplo:
    add_column_if_missing(engine, "productos", "unidades_por_empaque", "INTEGER DEFAULT 1")
    add_column_if_missing(engine, "prestamos", "tasa_mora", "FLOAT DEFAULT 2.0")
```

No se requiere Alembic. Para agregar columnas en producción directamente:

```sql
-- PostgreSQL / Supabase
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cufe VARCHAR;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS estado_electronico VARCHAR DEFAULT 'pendiente';
```

---

## 10. Despliegue

### 10.1 Backend — Render

```yaml
# render.yaml (referencia)
services:
  - type: web
    name: ksmart360-backend
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: SECRET_KEY
        sync: false
```

El endpoint `GET /ping` retorna `{"status": "ok"}` para mantener el servicio activo (anti-cold-start en plan gratuito).

### 10.2 Frontend — Vercel

```json
// vercel.json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Build: `npm run build` → Output: `build/`  
Variables de entorno en Vercel: `REACT_APP_API_URL=https://tu-backend.onrender.com`

### 10.3 Variables de Entorno Completas

**Backend:**
```env
SECRET_KEY=<token_urlsafe_32>
DATABASE_URL=postgresql://user:pass@host:5432/ksmart360
ACCESS_TOKEN_EXPIRE_MINUTES=120
WOMPI_PUBLIC_KEY=pub_test_...
WOMPI_INTEGRITY_SECRET=...
MATIAS_API_KEY=...
```

**Frontend:**
```env
REACT_APP_API_URL=https://tu-api.onrender.com
```

---

## 11. Módulos del Sistema — Claves de Acceso

Los 27 módulos habilitables por empresa (campo `module_key` en `RoleModule`):

```
ventas               cotizaciones         clientes
productos            inventarios          lotes
grupos_producto      reportes             reportes_inventario
compras              produccion           recetas
ordenes_trabajo      panel_operador       gestion_usuarios
gestion_modulos      resoluciones_dian    caja
prestamos            ruta_cobro           parqueadero
buscar_placa         vehiculos            suscripciones_parq
config_parqueadero   pos_lavadero         reporte_lavadero
catalogo_virtual
```

---

**Ksmart360 Engineering — Mayo 2026**  
*Para soporte técnico: [ksmart360.com](https://ksmart360.com)*
