# Ksmart360 — ERP & Gestión de Cartera SaaS

> Plataforma multi-tenant para la gestión integral de negocios: ventas, inventario, producción, compras, préstamos y rutas de cobro.

---

## 📌 Descripción

**Ksmart360** es un sistema ERP SaaS diseñado para pequeñas y medianas empresas en Colombia. Permite gestionar desde un solo lugar todas las operaciones del negocio: ventas a crédito, inventarios con kardex, órdenes de trabajo, producción por lotes, compras, y un módulo completo de préstamos con rutas de cobro en campo.

El sistema es **multi-tenant**: cada empresa opera en su propio espacio aislado, con módulos configurables según su tipo de negocio (comercio/ERP o prestamista).

---

## 🚀 Funcionalidades principales

### 🏢 ERP Comercial
- **Ventas** — facturación con control de cupo de crédito por cliente, IVA configurable y descuentos por línea
- **Clientes / Terceros** — base de clientes y proveedores, historial de compras y cartera
- **Productos e Inventario** — kardex por promedio ponderado, alertas de stock mínimo, movimientos masivos por Excel
- **Compras** — registro de compras con proveedores, actualización automática de costos y stock
- **Producción** — recetas BOM, lotes de producción, simulador de faltantes, maquila
- **Órdenes de Trabajo** — flujo de aprobación Admin → Operador, evidencias fotográficas, productividad por servicio
- **Corte de Caja** — arqueo diario con recaudo de préstamos integrado, control de gastos
- **Reportes** — dashboard, IVA neto, rentabilidad por producto, rotación, cuentas por cobrar

### 💰 Módulo de Préstamos
- Simulador financiero con interés simple y proyección de cuotas
- Modalidades: Diario, Semanal, Quincenal, Mensual
- **Mora automática** — calculada en tiempo real por días vencidos sobre tasa mensual configurable
- **Abono a capital** — redistribuye el saldo restante entre las cuotas pendientes
- **Ruta de cobro** — asignación de cuotas a cobradores, filtro por fecha, mapa Google
- **Recibo de pago** — descarga PDF, impresión térmica y envío por WhatsApp
- **Reprogramación** — nueva fecha de visita con validación de fechas futuras
- **Liquidación diaria** — cierre por cobrador con total recaudado

### 🔐 Multi-Tenant & SaaS
- Registro de empresas con perfil de módulos automático (ERP o Prestamista)
- Trial de 14 días, planes de suscripción, pasarela de pagos Wompi
- SuperAdmin con impersonación, gestión de módulos por empresa
- Notificaciones en tiempo real: stock mínimo, mora, vencimientos

---

## 🛠 Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + Material UI v5 |
| Backend | FastAPI (Python 3.11) |
| Base de datos | PostgreSQL (Supabase) |
| ORM | SQLAlchemy |
| Autenticación | JWT (python-jose) + OAuth2 |
| PDF | ReportLab |
| Despliegue Frontend | Vercel |
| Despliegue Backend | Render |
| Pagos | Wompi (Colombia) |

---

## 📁 Estructura del proyecto

```
ksmart360/
├── backend/
│   ├── main.py          # Endpoints FastAPI
│   ├── crud.py          # Lógica de negocio y queries
│   ├── models.py        # Modelos SQLAlchemy
│   ├── schemas.py       # Schemas Pydantic
│   ├── database.py      # Conexión BD + migraciones
│   └── requirements.txt
│
└── frontend/
    └── src/
        ├── components/
        │   ├── Prestamos.jsx       # Módulo de préstamos y cartera
        │   ├── RutaCobro.jsx       # Ruta de cobro en campo
        │   ├── GestionSaaS.jsx     # Panel SuperAdmin
        │   ├── Notifications.jsx   # Centro de notificaciones
        │   ├── Login.jsx           # Autenticación y registro
        │   └── ...
        ├── api.js                  # Cliente Axios + interceptores
        └── utils/
            └── formatters.js       # Formateo de moneda y fechas
```

---

## ⚙️ Instalación local

### Requisitos
- Python 3.11+
- Node.js 18+
- PostgreSQL o cuenta en Supabase

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configura las variables de entorno (ver sección abajo)
cp .env.example .env

uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install

# Configura las variables de entorno
cp .env.example .env

npm run dev
```

---

## 🔑 Variables de entorno

### Backend (`.env`)

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `SECRET_KEY` | Clave para firmar JWT — genera con `python -c "import secrets; print(secrets.token_urlsafe(32))"` | ✅ |
| `DATABASE_URL` | URL de conexión PostgreSQL | ✅ |
| `WOMPI_PUBLIC_KEY` | Llave pública Wompi | ⬜ |
| `WOMPI_INTEGRITY_SECRET` | Secreto de integridad Wompi | ⬜ |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Expiración del token (default: 120) | ⬜ |

### Frontend (`.env`)

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL base del backend (sin `/` al final) |

---

## 🗄 Migraciones de base de datos

Las migraciones se ejecutan automáticamente al iniciar el servidor mediante `run_migrations()`. Para agregar columnas manualmente desde el SQL Editor de Supabase:

```sql
-- Ejemplo: columna tasa_mora en préstamos
ALTER TABLE prestamos
ADD COLUMN IF NOT EXISTS tasa_mora FLOAT DEFAULT 2.0;
```

---

## 🧩 Módulos por perfil de empresa

Al registrar una empresa se selecciona el tipo de negocio, lo que determina los módulos disponibles:

| Módulo | ERP / Comercio | Prestamista |
|--------|:--------------:|:-----------:|
| Ventas | ✅ | ⬜ |
| Inventario | ✅ | ⬜ |
| Compras | ✅ | ⬜ |
| Producción | ✅ | ⬜ |
| Órdenes de Trabajo | ✅ | ⬜ |
| Clientes | ✅ | ✅ |
| Caja | ✅ | ✅ |
| Reportes | ✅ | ✅ |
| Préstamos | ⬜ | ✅ |
| Ruta de Cobro | ⬜ | ✅ |

---

## 🔐 Roles de usuario

| Rol | Permisos |
|-----|----------|
| **SuperAdmin** | Gestión global de empresas, planes y suscripciones |
| **Admin** | Gestión completa dentro de su empresa |
| **Operador** | Acceso a órdenes de trabajo y panel de productividad |
| **Cobrador** | Acceso exclusivo a la ruta de cobro asignada |

---

## 📡 API — Endpoints principales

```
POST   /token                              # Login
POST   /auth/register                      # Registro de empresa

GET    /clientes/                          # Listar clientes
POST   /ventas/                            # Crear venta
GET    /reportes/dashboard                 # Dashboard principal
GET    /reportes/financiero-prestamos      # Reporte de cartera

POST   /prestamos/                         # Crear préstamo
GET    /prestamos/cuotas-pendientes        # Ruta de cobro
POST   /prestamos/cuotas/{id}/pagar        # Registrar pago
POST   /prestamos/cuotas/{id}/reprogramar  # Reprogramar cuota
POST   /prestamos/{id}/abono-capital       # Abono a capital
GET    /prestamos/cuotas/{id}/recibo-pdf   # Descargar recibo PDF

GET    /superadmin/empresas                # Listar inquilinos
PATCH  /superadmin/empresas/{id}/plan      # Gestionar suscripción
POST   /superadmin/impersonate/{id}        # Soporte — entrar como cliente
```

Documentación interactiva completa disponible en `{API_URL}/docs` (Swagger UI).

---

## 🚢 Despliegue

### Backend en Render

1. Conectar repositorio en [render.com](https://render.com)
2. Configurar variables de entorno en el panel de Render
3. **Build command:** `pip install -r requirements.txt`
4. **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`

> El endpoint `GET /ping` mantiene el servidor activo evitando el cold start del plan gratuito.

### Frontend en Vercel

1. Conectar repositorio en [vercel.com](https://vercel.com)
2. Configurar `VITE_API_URL` en las variables de entorno del proyecto
3. **Build command:** `npm run build`
4. **Output directory:** `dist`

---

## 📄 Licencia

Proyecto privado — Todos los derechos reservados © 2026 KSMP Systems.

---

## 👤 Autor

**KSMP Systems**  
Desarrollado con ❤️ para empresas colombianas  
[appjeylor.com](https://appjeylor.com)
