# Ksmart360 — ERP & SaaS Multi-Tenant para Empresas Colombianas

> Plataforma integral de gestión empresarial: ventas POS, inventario FEFO, producción BOM, compras, órdenes de trabajo, préstamos con ruta de cobro, parqueadero, lavadero, catálogo virtual y facturación electrónica DIAN.

---

## Descripción

**Ksmart360** es un sistema ERP SaaS **multi-tenant** diseñado para pequeñas y medianas empresas colombianas. Desde un único punto de acceso centraliza todas las operaciones del negocio con aislamiento completo de datos por empresa, control de roles por módulo y soporte de facturación electrónica DIAN.

El sistema detecta automáticamente el perfil de la empresa (ERP comercial, Prestamista, Parqueadero, Lavadero) y habilita los módulos correspondientes desde el momento del registro.

---

## Módulos del Sistema

| # | Módulo | Descripción |
|---|--------|-------------|
| 1 | **Ventas / POS** | POS clásico y modo Touch con escáner de código de barras por cámara, 4 métodos de pago, control de cupo de crédito |
| 2 | **Inventario** | Kardex por promedio ponderado, lotes FEFO, alertas de stock mínimo, importación masiva Excel, grupos con colores |
| 3 | **Cotizaciones** | Preventas y cotizaciones que se convierten en factura en un clic |
| 4 | **Clientes / Terceros** | Clientes y proveedores con historial de compras, cupo de crédito, campos DIAN |
| 5 | **Compras** | Órdenes de compra con actualización automática de costos y stock |
| 6 | **Producción / Recetas** | Bill of Materials (BOM), lotes de producción, costos de transformación, mermas |
| 7 | **Órdenes de Trabajo** | Flujo Admin→Operador, evidencias fotográficas, consumo de repuestos, productividad |
| 8 | **Reportes** | 9 tipos: ventas, rentabilidad, CXC, IVA neto, kardex, productividad, P&L, préstamos, producción |
| 9 | **Caja** | Corte diario, gastos operativos, integración de recaudos de préstamos |
| 10 | **Préstamos** | Simulador de amortización, cuotas diarias/semanales/quincenales/mensuales, mora automática, abono a capital |
| 11 | **Ruta de Cobro** | App de campo para cobradores, evidencia con GPS, reprogramación de visitas, recibo PDF/WhatsApp |
| 12 | **Parqueadero** | Entrada/salida de motos, tarifas multi-modal, suscripciones mensuales, alertas WhatsApp |
| 13 | **Lavadero / Car Wash** | POS de servicios de lavado, asignación de operadores, reportes de productividad |
| 14 | **Catálogo Virtual** | Tienda pública por slug, sincronización de inventario, pedidos por WhatsApp |
| 15 | **Facturación DIAN** | Resoluciones DIAN, numeración automática, CUFE, XML/PDF, Matias API |
| 16 | **Dashboard** | KPIs en tiempo real: ventas, cartera, stock bajo mínimos, precio cacao |
| 17 | **Admin / SaaS** | Gestión de usuarios, roles, módulos por empresa, planes de suscripción, Wompi |

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Material UI v5 |
| Backend | FastAPI (Python 3.11) |
| Base de datos | PostgreSQL (producción) / SQLite (desarrollo) |
| ORM | SQLAlchemy |
| Autenticación | JWT (python-jose) + WebAuthn / FIDO2 (biométrico) |
| PDF | ReportLab |
| Despliegue Frontend | Vercel |
| Despliegue Backend | Render |
| Pagos SaaS | Wompi (Colombia) |
| Facturación electrónica | Matias API (DIAN Colombia) |
| Barcode lookup | OpenFoodFacts · UPCitemdb · OpenBeautyFacts |
| Mensajería | WhatsApp Cloud API |
| Monitoreo de mercado | Yahoo Finance (ICE Futures cacao) · Datos.gov.co (TRM) |

---

## Arquitectura

```
Frontend (React SPA)  ←→  Backend (FastAPI REST)  ←→  DB (PostgreSQL)
                                    ↓
                         Multi-tenant: empresa_id en cada tabla
                         TenantMixin → aislamiento automático por tenant
                         27 módulos inicializados por empresa
                         Roles: SuperAdmin · Admin · Operador · Cobrador
```

### Aislamiento Multi-Tenant

Patrón **Shared Database, Shared Schema**: todas las tablas de negocio heredan de `TenantMixin`, el cual inyecta `empresa_id` como FK obligatorio. La dependencia `get_current_active_user` en FastAPI extrae el `empresa_id` del JWT y lo aplica a todas las consultas, impidiendo acceso cruzado entre empresas.

---

## Estructura del Proyecto

```
ksmart/
├── backend/
│   ├── main.py                    # App FastAPI, CORS, routers, migrations
│   ├── models.py                  # 57 modelos SQLAlchemy
│   ├── schemas.py                 # Schemas Pydantic (request/response)
│   ├── database.py                # Conexión + migraciones automáticas
│   ├── core/                      # Config, constantes, seguridad
│   ├── crud/                      # Lógica de negocio modular
│   ├── services/                  # Servicios de dominio
│   ├── jobs_service.py            # Tareas programadas (pruebas, cacao, parqueadero)
│   └── api/v1/endpoints/          # 31 módulos de endpoints
│       ├── ventas.py
│       ├── inventario.py
│       ├── productos.py
│       ├── grupos_producto.py
│       ├── clientes.py
│       ├── compras.py
│       ├── produccion.py
│       ├── ordenes_trabajo.py
│       ├── panel_operador.py
│       ├── prestamos.py
│       ├── parqueadero.py
│       ├── lavadero.py
│       ├── cotizaciones.py
│       ├── reportes.py
│       ├── caja.py
│       ├── devoluciones.py
│       ├── resoluciones.py
│       ├── catalogo.py
│       ├── auth.py + biometric.py
│       ├── superadmin.py
│       ├── wompi.py + webhooks.py
│       └── mercado.py
│
└── frontend/
    └── src/
        ├── features/
        │   ├── sales/             # Ventas.js, TouchPOSMode.js, Cotizaciones.js
        │   ├── inventory/         # Productos.js, Lotes.js, AgileBarcodeRegistration.js
        │   ├── clients/           # Terceros.js, ClienteHistory.js
        │   ├── reports/           # Reportes.js + 9 sub-reportes
        │   ├── finance/           # Caja.js, CuentasPorCobrar.js
        │   ├── loans/             # PrestamoForm.js, RutaCobro.js
        │   ├── parking/           # ParqueaderoDashboard.jsx (12 archivos)
        │   ├── lavadero/          # LavaderoVentas.js, LavaderoReporte.js
        │   ├── workOrders/        # OrdenesTrabajo.js, PanelOperador.js
        │   ├── production/        # Recetas.js
        │   ├── purchases/         # Compras.js
        │   ├── dian/              # ResolucionesDian.js
        │   ├── admin/             # AdminUsuarios.js, GestionEmpresas.js
        │   ├── saas/              # CatalogoVirtual.js, CatalogoConfig.js
        │   ├── dashboard/         # Dashboard.js, CacaoPriceWidget.js
        │   ├── auth/              # Login.js, SuscripcionExpirada.js
        │   └── legal/             # LegalPages.jsx
        ├── layout/                # Sidebar.js, TopBar.js
        ├── api.js                 # Cliente Axios + interceptores JWT
        ├── theme.js               # getAppTheme(mode) — light/dark
        └── App.js                 # Router, ThemeProvider, auth global
```

---

## Instalación Local

### Requisitos

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ o cuenta Supabase (en desarrollo funciona con SQLite)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env             # Editar con tus valores
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env             # Editar VITE_API_URL
npm start                        # Desarrollo en http://localhost:3000
```

---

## Variables de Entorno

### Backend (`.env`)

| Variable | Descripción | Req. |
|----------|-------------|------|
| `SECRET_KEY` | Clave para firmar JWT (`python -c "import secrets; print(secrets.token_urlsafe(32))"`) | ✅ |
| `DATABASE_URL` | URL de conexión PostgreSQL (`postgresql://user:pass@host/db`) | ✅ |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Duración del token (default: 120) | ⬜ |
| `WOMPI_PUBLIC_KEY` | Llave pública Wompi | ⬜ |
| `WOMPI_INTEGRITY_SECRET` | Secreto de integridad Wompi | ⬜ |
| `MATIAS_API_KEY` | API Key para facturación electrónica DIAN | ⬜ |

### Frontend (`.env`)

| Variable | Descripción |
|----------|-------------|
| `REACT_APP_API_URL` | URL base del backend (sin `/` al final) |

---

## Migraciones de Base de Datos

Las migraciones se ejecutan automáticamente al iniciar el servidor vía `run_migrations()` en `database.py`. No se requiere Alembic. Para agregar columnas manualmente desde Supabase SQL Editor:

```sql
ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS tasa_mora FLOAT DEFAULT 2.0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS unidades_por_empaque INTEGER DEFAULT 1;
```

---

## Módulos por Perfil de Empresa

Al registrar una empresa se selecciona el tipo de negocio, que determina los 27 módulos disponibles:

| Módulo | ERP/Comercio | Prestamista | Parqueadero | Lavadero |
|--------|:---:|:---:|:---:|:---:|
| Ventas / POS | ✅ | ⬜ | ⬜ | ⬜ |
| Inventario | ✅ | ⬜ | ⬜ | ⬜ |
| Compras | ✅ | ⬜ | ⬜ | ⬜ |
| Producción / Recetas | ✅ | ⬜ | ⬜ | ⬜ |
| Órdenes de Trabajo | ✅ | ⬜ | ⬜ | ⬜ |
| Cotizaciones | ✅ | ⬜ | ⬜ | ⬜ |
| Resoluciones DIAN | ✅ | ⬜ | ⬜ | ⬜ |
| Clientes | ✅ | ✅ | ⬜ | ✅ |
| Caja | ✅ | ✅ | ✅ | ✅ |
| Reportes | ✅ | ✅ | ✅ | ✅ |
| Préstamos | ⬜ | ✅ | ⬜ | ⬜ |
| Ruta de Cobro | ⬜ | ✅ | ⬜ | ⬜ |
| Parqueadero | ⬜ | ⬜ | ✅ | ⬜ |
| Catálogo Virtual | ✅ | ⬜ | ⬜ | ⬜ |
| POS Lavadero | ⬜ | ⬜ | ⬜ | ✅ |

---

## Roles de Usuario

| Rol | Permisos |
|-----|----------|
| **SuperAdmin** | Gestión global: empresas, planes, módulos, impersonación |
| **Admin** | Gestión completa de su empresa, todos los módulos habilitados |
| **Operador** | Órdenes de trabajo, panel de productividad |
| **Cobrador** | Ruta de cobro asignada (solo sus cuotas del día) |

---

## Planes SaaS

| Plan | Duración | Notas |
|------|----------|-------|
| `trial` | 14 días | Auto-expiración vía jobs_service |
| `premium` | Mensual/Anual | Activación automática por webhook Wompi |
| `vitalicio` | Sin vencimiento | Asignación manual SuperAdmin |
| `canceled` | — | Redirige a `/suscripcion-expirada` |

---

## API — Endpoints Principales

```
# Autenticación
POST   /auth/register                      # Registro de empresa + admin
POST   /auth/token                         # Login → JWT
POST   /auth/biometric/register            # Registrar credencial biométrica
POST   /auth/biometric/authenticate        # Login biométrico (WebAuthn/FIDO2)

# Ventas
POST   /ventas/                            # Crear venta con validación de stock y cupo
GET    /ventas/                            # Listar ventas paginadas
PUT    /ventas/{id}                        # Actualizar estado
DELETE /ventas/{id}                        # Eliminar con reversión de stock

# Inventario
GET    /productos/                         # Listar productos
GET    /productos/barcode/{code}           # Lookup: Local → OpenFoodFacts → UPCitemdb
GET    /inventario/kardex/{producto_id}    # Kardex por promedio ponderado
GET    /inventario/movimientos/template    # Plantilla Excel para carga masiva
GET    /grupos-producto/                   # Grupos/categorías con color y orden

# Clientes
GET    /clientes/                          # Listar clientes y proveedores
POST   /clientes/                          # Crear cliente con campos DIAN

# Reportes
GET    /reportes/dashboard                 # KPIs: ventas hoy, cartera, stock bajo
GET    /reportes/ventas_summary            # Resumen de ventas por período
GET    /reportes/rentabilidad_productos    # Margen por producto
GET    /reportes/clientes_deudores         # CXC con días de mora
GET    /reportes/iva-neto                  # IVA generado vs descontable
GET    /reportes/productividad             # Métricas por operario

# Préstamos
POST   /prestamos/                         # Crear préstamo con plan de cuotas
GET    /prestamos/cuotas-pendientes        # Ruta del día (filtro por zona)
POST   /prestamos/{id}/pagar-cuota        # Registrar pago de cuota
POST   /prestamos/{id}/reprogramar-cuota  # Nueva fecha de visita
POST   /prestamos/{id}/abono-capital      # Abonar a capital, redistribuir cuotas
GET    /prestamos/cuotas/{id}/recibo-pdf  # Descargar recibo PDF

# Parqueadero
GET    /parqueadero/config                 # Tarifas y capacidad
POST   /parqueadero/vehiculos/entrada      # Registrar entrada
POST   /parqueadero/vehiculos/salida       # Calcular cobro y registrar salida
POST   /parqueadero/suscripciones          # Crear suscripción mensual
GET    /parqueadero/reportes/ingresos      # Ingresos por rango de fechas

# Facturación DIAN
GET    /resoluciones/                      # Listar resoluciones activas
POST   /resoluciones/                      # Registrar nueva resolución DIAN

# SuperAdmin
GET    /superadmin/empresas                # Listar todos los tenants
PATCH  /superadmin/empresas/{id}/plan      # Actualizar plan de suscripción
POST   /superadmin/impersonate/{id}        # Soporte: entrar como empresa
```

Documentación Swagger UI completa: `{API_URL}/docs`

---

## Despliegue

### Backend en Render

```
Build command:  pip install -r requirements.txt
Start command:  uvicorn main:app --host 0.0.0.0 --port $PORT
```

El endpoint `GET /ping` mantiene el servidor activo evitando el cold start del plan gratuito. Las migraciones de base de datos se ejecutan automáticamente al arrancar.

### Frontend en Vercel

```
Build command:    npm run build
Output directory: build
```

Configurar `REACT_APP_API_URL` en las variables de entorno del proyecto Vercel. El archivo `vercel.json` debe incluir rewrite de rutas SPA hacia `index.html`.

---

## Licencia

Proyecto privado — Todos los derechos reservados © 2026 KSMP Systems.

## Autor

**KSMP Systems**  
Desarrollado para empresas colombianas  
[appjeylor.com](https://appjeylor.com)
