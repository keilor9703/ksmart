# Ksmart360 — ERP & SaaS Multi-Tenant para Empresas Colombianas

> Plataforma integral de gestión empresarial: ventas POS, inventario FEFO, producción BOM, compras, órdenes de trabajo, préstamos con ruta de cobro, parqueadero, lavadero, catálogo virtual y facturación electrónica DIAN.

---

## Descripción

**Ksmart360** es un sistema ERP SaaS **multi-tenant** diseñado para pequeñas y medianas empresas colombianas. Desde un único punto de acceso centraliza todas las operaciones del negocio con aislamiento completo de datos por empresa, control de roles por módulo y soporte de facturación electrónica DIAN.

El sistema detecta automáticamente el perfil de la empresa (ERP comercial, Prestamista, Parqueadero, Lavadero, Restaurante) y habilita los módulos correspondientes desde el momento del registro.

---

## Módulos del Sistema

| # | Módulo | Descripción |
|---|--------|-------------|
| 1 | **Ventas / POS** | POS clásico y modo Touch con escáner de código de barras, 4 métodos de pago, control de cupo de crédito |
| 2 | **Inventario** | Kardex por promedio ponderado, lotes FEFO, alertas de stock mínimo, importación masiva Excel |
| 3 | **Cotizaciones** | Preventas que se convierten en factura en un clic |
| 4 | **Clientes / Terceros** | Clientes y proveedores con historial de compras, cupo de crédito, campos DIAN |
| 5 | **Compras** | Órdenes de compra con actualización automática de costos y stock |
| 6 | **Producción / Recetas** | Bill of Materials (BOM), lotes de producción, costos de transformación, mermas |
| 7 | **Órdenes de Trabajo** | Flujo Admin→Operador, evidencias fotográficas, consumo de repuestos, productividad |
| 8 | **Reportes** | 9 tipos: ventas, rentabilidad, CXC, IVA neto, kardex, productividad, P&L, préstamos, producción |
| 9 | **Caja** | Corte diario, gastos operativos, integración de recaudos de préstamos |
| 10 | **Préstamos** | Simulador de amortización, cuotas diarias/semanales/quincenales/mensuales, mora automática |
| 11 | **Ruta de Cobro** | App de campo para cobradores, evidencia con GPS, recibo PDF/WhatsApp |
| 12 | **Parqueadero** | Entrada/salida de motos, tarifas multi-modal, suscripciones mensuales, alertas WhatsApp |
| 13 | **Lavadero / Car Wash** | POS de servicios de lavado, asignación de operadores, reportes de productividad |
| 14 | **Catálogo Virtual** | Tienda pública por slug, sincronización de inventario, pedidos por WhatsApp |
| 15 | **Facturación DIAN** | Resoluciones DIAN, numeración automática, CUFE, XML/PDF, Matias API |
| 16 | **Dashboard** | KPIs en tiempo real: ventas, cartera, stock bajo mínimos |
| 17 | **Restaurante** | Mapa de mesas, comandas, pantalla de cocina, caja de restaurante |
| 18 | **Admin / SaaS** | Gestión de usuarios, roles, módulos por empresa, planes de suscripción, Wompi |

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

---

## Arquitectura

```
Frontend (React SPA)  ←→  Backend (FastAPI REST)  ←→  DB (PostgreSQL)
                                    ↓
                         Multi-tenant: empresa_id en cada tabla
                         TenantMixin → aislamiento automático por tenant
                         Roles: SuperAdmin · Admin · Operador · Cobrador
```

### Aislamiento Multi-Tenant

Patrón **Shared Database, Shared Schema**: todas las tablas de negocio heredan de `TenantMixin`, el cual inyecta `empresa_id` como FK obligatorio. La dependencia `get_current_active_user` en FastAPI extrae el `empresa_id` del JWT y lo aplica a todas las consultas, impidiendo acceso cruzado entre empresas.

---

## Estructura del Proyecto

```
ksmart/
├── backend/
│   ├── main.py                    # App FastAPI, CORS, routers, inicialización
│   ├── models.py                  # 57 modelos SQLAlchemy
│   ├── schemas.py                 # Schemas Pydantic (request/response)
│   ├── database.py                # Conexión + migraciones automáticas
│   ├── .env.example               # Plantilla de variables de entorno
│   ├── core/                      # Config, constantes, seguridad
│   ├── crud/                      # Lógica de negocio modular
│   ├── services/                  # Servicios de dominio
│   └── api/v1/endpoints/          # Módulos de endpoints
│       ├── setup.py               # Wizard de primer arranque
│       ├── auth.py + biometric.py
│       ├── superadmin.py
│       └── ... (30 módulos más)
│
└── frontend/
    ├── .env.example               # Plantilla de variables de entorno
    └── src/
        ├── features/
        │   ├── auth/
        │   │   ├── Login.js
        │   │   └── FirstTimeSetup.js  # Wizard de primer arranque
        │   └── ... (demás módulos)
        ├── layout/                # Sidebar.js, TopBar.js
        ├── api.js                 # Cliente Axios + interceptores JWT
        └── App.js                 # Router, ThemeProvider, auth global
```

---

## Instalación Local (Desarrollo)

### Requisitos

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ *(en desarrollo local funciona con SQLite sin configuración adicional)*

### 1. Clonar el repositorio

```bash
git clone https://github.com/keilor9703/ksmart.git
cd ksmart
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env               # Editar con tus valores reales
uvicorn main:app --reload --port 8000
```

Al arrancar por primera vez, el backend:
1. Crea todas las tablas automáticamente.
2. Aplica las migraciones de esquema (sin Alembic).
3. Detecta si la BD está vacía y deja el sistema listo para el wizard.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env               # Editar REACT_APP_API_URL
npm start                          # Inicia en http://localhost:3000
```

### 4. Wizard de primer arranque

La primera vez que abras `http://localhost:3000` con una base de datos vacía, el sistema mostrará automáticamente el **Wizard de Configuración Inicial** donde podrás ingresar:

- Nombre y NIT de tu empresa
- Logo (PNG/JPG hasta 2 MB)
- Color principal de la marca
- Usuario y contraseña del administrador dueño del sistema

Una vez completado el wizard, el sistema quedará listo para operar y podrás iniciar sesión.

> **Alternativa sin wizard:** Si prefieres configurar los datos iniciales vía variables de entorno, define `SUPERADMIN_EMPRESA_NOMBRE`, `SUPERADMIN_USERNAME` y `SUPERADMIN_PASSWORD` en el `.env` antes de arrancar el backend. El wizard no aparecerá si la BD ya tiene datos.

---

## Variables de Entorno

### Backend (`.env`)

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `DATABASE_URL` | URL de conexión PostgreSQL (`postgresql://user:pass@host/db`) | ✅ Producción |
| `SECRET_KEY` | Clave para firmar JWT — genera con `python -c "import secrets; print(secrets.token_urlsafe(64))"` | ✅ Producción |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Duración del token en minutos (default: 120) | ⬜ |
| `SUPERADMIN_EMPRESA_NOMBRE` | Nombre de la empresa dueña del sistema (si no usas el wizard) | ⬜ |
| `SUPERADMIN_EMPRESA_NIT` | NIT de la empresa dueña | ⬜ |
| `SUPERADMIN_COLOR` | Color principal en hex (default: `#F43F5E`) | ⬜ |
| `SUPERADMIN_USERNAME` | Nombre de usuario del superadmin (default: `admin`) | ⬜ |
| `SUPERADMIN_PASSWORD` | Contraseña del superadmin — **cambiar siempre en producción** | ✅ Producción |
| `EXTRA_CORS_ORIGINS` | URLs adicionales de CORS separadas por coma | ⬜ |
| `WOMPI_PUBLIC_KEY` | Llave pública Wompi | ⬜ |
| `WOMPI_PRIVATE_KEY` | Llave privada Wompi | ⬜ |
| `MATIAS_API_KEY` | API Key para facturación electrónica DIAN | ⬜ |
| `CRON_API_KEY` | Clave para proteger endpoints de tareas programadas | ⬜ |

### Frontend (`.env`)

| Variable | Descripción |
|----------|-------------|
| `REACT_APP_API_URL` | URL base del backend sin barra final (ej: `https://api.tudominio.com`) |

---

## Migraciones de Base de Datos

Las migraciones se ejecutan automáticamente al iniciar el servidor vía `run_migrations()` en `database.py`. No se requiere Alembic ni comandos adicionales.

---

## Módulos por Perfil de Empresa

Al registrar una empresa se selecciona el tipo de negocio, que determina los módulos disponibles:

| Módulo | ERP/Comercio | Prestamista | Parqueadero | Lavadero | Restaurante |
|--------|:---:|:---:|:---:|:---:|:---:|
| Ventas / POS | ✅ | ⬜ | ⬜ | ⬜ | ✅ |
| Inventario | ✅ | ⬜ | ⬜ | ⬜ | ✅ |
| Compras | ✅ | ⬜ | ⬜ | ⬜ | ✅ |
| Producción / Recetas | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| Órdenes de Trabajo | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| Cotizaciones | ✅ | ⬜ | ⬜ | ⬜ | ✅ |
| Resoluciones DIAN | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| Clientes | ✅ | ✅ | ⬜ | ✅ | ✅ |
| Caja | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reportes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Préstamos | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| Ruta de Cobro | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| Parqueadero | ⬜ | ⬜ | ✅ | ⬜ | ⬜ |
| Catálogo Virtual | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| POS Lavadero | ⬜ | ⬜ | ⬜ | ✅ | ⬜ |
| Mapa de Mesas | ⬜ | ⬜ | ⬜ | ⬜ | ✅ |
| Pantalla Cocina | ⬜ | ⬜ | ⬜ | ⬜ | ✅ |

---

## Roles de Usuario

| Rol | Permisos |
|-----|----------|
| **SuperAdmin** | Gestión global: empresas, planes, módulos, impersonación. Tiene acceso a todos los módulos incluyendo "Mi Suscripción" |
| **Admin** | Gestión completa de su empresa, todos los módulos habilitados para su tenant |
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

La empresa dueña del sistema (ID=1) tiene el flag `is_protected=true` y nunca expira.

---

## API — Endpoints Principales

```
# Setup (primer arranque)
GET    /setup/status                       # ¿Está el sistema inicializado?
POST   /setup/init                         # Wizard: crear empresa+admin (solo BD vacía)

# Autenticación
POST   /auth/register                      # Registro de empresa + admin
POST   /auth/token                         # Login → JWT
POST   /auth/biometric/register            # Registrar credencial biométrica
POST   /auth/biometric/authenticate        # Login biométrico (WebAuthn/FIDO2)

# Suscripción
GET    /suscripcion/mi-suscripcion         # Estado del plan de la empresa actual

# Ventas
POST   /ventas/                            # Crear venta con validación de stock y cupo
GET    /ventas/                            # Listar ventas paginadas

# Inventario
GET    /productos/                         # Listar productos
GET    /inventario/kardex/{producto_id}    # Kardex por promedio ponderado

# Clientes
GET    /clientes/                          # Listar clientes y proveedores
POST   /clientes/                          # Crear cliente con campos DIAN

# Reportes
GET    /reportes/dashboard                 # KPIs: ventas hoy, cartera, stock bajo
GET    /reportes/ventas_summary            # Resumen de ventas por período
GET    /reportes/rentabilidad_productos    # Margen por producto

# SuperAdmin
GET    /superadmin/empresas                # Listar todos los tenants
PATCH  /superadmin/empresas/{id}/plan      # Actualizar plan de suscripción
POST   /superadmin/impersonate/{id}        # Soporte: entrar como empresa
```

Documentación Swagger UI completa: `{API_URL}/docs`

---

## Despliegue en Producción

### Backend en Render

```
Build command:  pip install -r requirements.txt
Start command:  uvicorn main:app --host 0.0.0.0 --port $PORT
```

Variables de entorno a configurar en Render:
- `DATABASE_URL` (PostgreSQL)
- `SECRET_KEY` (clave segura generada)
- `SUPERADMIN_PASSWORD` (contraseña segura)
- `ENVIRONMENT=production`

Las migraciones y la inicialización ocurren automáticamente al arrancar. En el primer despliegue con BD vacía, abre la URL del frontend y completa el wizard de configuración.

### Frontend en Vercel

```
Build command:    npm run build
Output directory: build
```

Configurar en Vercel:
- `REACT_APP_API_URL`: URL de tu backend en Render

El archivo `vercel.json` debe incluir rewrite de rutas SPA hacia `index.html`.

### Docker Compose (local o VPS)

```bash
docker-compose up -d
```

El `docker-compose.yml` incluye PostgreSQL, PgBouncer y el backend. El frontend puede servirse con Nginx o desplegarse en Vercel/Netlify.

---

## Licencia

Proyecto privado — Todos los derechos reservados © 2026 KSMP Systems.

## Autor

**KSMP Systems**  
Desarrollado para empresas colombianas  
[appjeylor.com](https://appjeylor.com)
