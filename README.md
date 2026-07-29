# Ksmart360 — ERP & SaaS Multi-Tenant para Empresas Colombianas

> **La plataforma de gestión empresarial más completa para PYMEs colombianas.** Ventas POS, inventario FEFO con lotes, producción BOM, compras, órdenes de trabajo, préstamos con ruta de cobro, parqueadero, lavadero, restaurante, agendamiento de citas y servicios, catálogo virtual y facturación electrónica DIAN — todo en un solo sistema, desde la nube, con infraestructura Oracle Cloud de nivel enterprise.

<div align="center">

![Estado](https://img.shields.io/badge/Estado-Producción-green)
![Versión](https://img.shields.io/badge/Versión-2.3.0-blue)
![Colombia](https://img.shields.io/badge/Localización-Colombia-yellow)
![Multi--tenant](https://img.shields.io/badge/Arquitectura-Multi--Tenant-orange)

</div>

---

## ¿Qué es Ksmart360?

**Ksmart360** es un ERP SaaS **multi-tenant** nativo en la nube, diseñado desde cero para pequeñas y medianas empresas colombianas. En lugar de comprar módulos por separado o pagar por costosos sistemas importados, una empresa accede desde el navegador a todo lo que necesita para operar: punto de venta, inventario, compras, cartera, producción, reportes y facturación electrónica DIAN.

El sistema detecta automáticamente el perfil de negocio (Comercio ERP, Prestamista, Parqueadero, Lavadero, Restaurante) y habilita exactamente los módulos que esa industria necesita, sin configuración manual. Los negocios de servicios (barberías, spas, talleres, consultorios) cuentan además con un módulo de **agendamiento de citas** con portal público de reservas.

La interfaz sigue un lenguaje visual limpio y profesional (estilo Vercel/Linear): tipografía **Geist**, acento cian de marca, superficies neutras y separación por bordes, con soporte completo de modo claro/oscuro.

### Infraestructura Oracle Cloud — Nivel Enterprise

El backend de producción corre sobre **Oracle Cloud Free Tier Always-Free**, infraestructura de clase mundial con SLA garantizado:

- **Servidor:** Oracle VM.Standard.A1.Flex — 4 OCPU ARM · 24 GB RAM · 96 GB disco
- **OS:** Ubuntu 22.04 LTS — IP pública fija `158.101.127.148`
- **Base de datos:** PostgreSQL 17 auto-hospedado (sin dependencia de terceros)
- **Proxy inverso:** Nginx + Let's Encrypt SSL (HTTPS nativo)
- **Process manager:** systemd (`ksmart.service`) — reinicio automático ante fallos
- **CI/CD:** Webhook GitHub → deploy automático en cada push a `main`
- **API pública:** `https://api.ksmart360.com`

---

## Módulos del Sistema

### 🛒 Ventas & POS

| Funcionalidad | Detalle |
|--------------|---------|
| **POS Dual Mode** | Modo Clásico (teclado + escáner de código de barras) y Touch Mode táctil para pantallas |
| **Múltiples métodos de pago** | Efectivo, tarjeta, Nequi/Bancolombia, enlace de pago — hasta 4 métodos por factura |
| **Control de cupo de crédito** | Bloqueo automático si el cliente supera su límite; cálculo preciso con IVA implícito |
| **Ítems de servicio** | Líneas libres sin afectar inventario; precios con decimales (centavos exactos) |
| **Cotizaciones → Factura** | Preventas que se convierten en factura con un clic; sin re-digitación |
| **Programa de fidelización** | Puntos canjeables por compra; configuración de tasa earn/redeem por empresa |
| **Descuento por puntos** | El cajero aplica puntos del cliente directamente en la venta |
| **Cobro de citas integrado** | Al cobrar una cita del módulo de Agendamiento, el POS abre con el servicio, el cliente y el trabajador (vendedor) precargados; se pueden agregar más productos antes de cerrar la venta |

### 📦 Inventario

| Funcionalidad | Detalle |
|--------------|---------|
| **Kardex automático** | Costo promedio ponderado calculado en cada entrada/salida |
| **Lotes FEFO** | Control de perecederos por número de lote, fecha de vencimiento y fabricación |
| **Alertas de stock mínimo** | Notificación automática cuando un producto baja del umbral configurado |
| **Categorías diferenciadas** | Materia Prima · Producto Terminado · Insumos · **Envases/Empaque** · Activos Fijos · Platos |
| **Importación masiva Excel** | Carga de productos, clientes y movimientos desde plantilla descargable |
| **Movimientos de ajuste** | Entradas y salidas manuales con motivo, referencia y usuario trazable |
| **Variantes de producto** | Un mismo producto en múltiples presentaciones (talla, color, capacidad) con stock independiente |

### 🏭 Producción / Transformación

| Funcionalidad | Detalle |
|--------------|---------|
| **Recetas BOM** | Bill of Materials con ingredientes, rendimiento configurable y costo automático |
| **Lotes de producción** | Seguimiento desde materia prima hasta producto terminado, con cantidad real y merma |
| **Rollup de costos** | El costo del producto terminado se calcula automáticamente a partir de insumos |
| **Servicios de maquila** | Recetas que incluyen servicios externos con su costo |
| **Transformación de inventario** | Salida de materia prima + entrada de producto terminado en una sola operación |

### 🛍️ Compras

| Funcionalidad | Detalle |
|--------------|---------|
| **Órdenes de compra PDF** | Generación automática de OC con número correlativo anual |
| **Ítems de única vez** | Líneas libres (descripción + valor) sin necesidad de crear producto en catálogo |
| **Orden de ingreso preservado** | Los ítems de la factura física se muestran en el mismo orden que se digitaron |
| **Actualización automática de costos** | El costo del producto se actualiza al precio de la última compra |
| **Lotes en compras** | Registro de número de lote y fecha de vencimiento directamente en la orden de compra |
| **Gestión de pagos** | Registro de abonos parciales, estado pendiente/parcial/pagado |
| **Precios con decimales** | Soporte completo de centavos (ej: $30.000,56) para evitar descuadres contables |

### 💰 Préstamos & Cartera

| Funcionalidad | Detalle |
|--------------|---------|
| **Simulador de amortización** | Cálculo automático de cuotas diarias, semanales, quincenales o mensuales |
| **Mora automática** | Interés de mora calculado diariamente sobre cuotas vencidas |
| **Ruta de cobro** | App de campo para cobradores: cuotas del día, abono, evidencia fotográfica con GPS |
| **PDF de recibos** | Comprobante de pago descargable y enviable por WhatsApp |
| **Cuentas por cobrar aging** | Análisis de cartera por antigüedad: 0-30, 31-60, 61-90, +90 días |

### 🚗 Parqueadero

| Funcionalidad | Detalle |
|--------------|---------|
| **Entrada/Salida** | Registro de ingreso y salida de motos, carros y bicicletas |
| **Tarifas multi-modal** | Por hora, fracción, día o tarifa plana configurable por tipo de vehículo |
| **Suscripciones mensuales** | Abonados con fecha de expiración y alerta de vencimiento |
| **Ocupación en tiempo real** | Cupos disponibles y ocupados por categoría |
| **Alertas WhatsApp** | Notificación automática al suscriptor cuando su mensualidad está por vencer |

### 🚿 Lavadero / Car Wash

| Funcionalidad | Detalle |
|--------------|---------|
| **POS de servicios** | Registro de órdenes de lavado con placa, tipo de vehículo y servicios |
| **Asignación de operadores** | Cada servicio queda asignado al lavador responsable |
| **Comisiones automáticas** | Porcentaje de comisión por servicio calculado al cerrar la orden |
| **Reporte de productividad** | Servicios por operador, ingresos y comisiones del período |

### 🍽️ Restaurante

| Funcionalidad | Detalle |
|--------------|---------|
| **Mapa de mesas** | Vista visual interactiva de mesas por zona/área; estado en tiempo real |
| **Comandas digitales** | El mesero toma el pedido desde tablet; llega automáticamente a cocina |
| **Pantalla KDS** | Kitchen Display System — el cocinero ve cada ítem y marca como listo |
| **Categorías de menú** | Entradas, Platos Principales, Menú del Día, Adiciones, Postres, Bebidas |
| **Caja de restaurante** | Panel de cobro de mesas por parte del cajero; múltiples métodos de pago |
| **Impresión de comandas** | Impresión automática o manual de comandas en impresora P80 |

### 📅 Agendamiento de Citas & Servicios

Pensado para negocios de servicios (barberías, spas, talleres, consultorios, estéticas).

| Funcionalidad | Detalle |
|--------------|---------|
| **Servicios agendables** | Cualquier producto/servicio con duración en minutos se vuelve agendable; se asignan los trabajadores que pueden atenderlo |
| **Vistas de calendario** | Día (lista detallada), Semana, Mes y Agenda (lista) — estilo Outlook, con navegación por período |
| **Disponibilidad inteligente** | Calcula franjas libres por trabajador según horario laboral, días hábiles, festivos y duración del servicio; evita solapamientos |
| **Franja de descanso / almuerzo** | Rango horario configurable en el que no se ofrecen citas |
| **Portal público de reservas** | Página `/{slug}/agendar` donde el cliente reserva en línea; con QR/enlace de pago de anticipo opcional |
| **Política de anticipo** | Porcentaje de anticipo configurable, coordinado por WhatsApp |
| **Estados de cita** | Máquina de estados (pendiente → confirmada → en curso → completada / cancelada / no asistió) con transiciones validadas en backend |
| **Permisos por trabajador** | Cada trabajador ve y gestiona solo sus propias citas; el admin ve todas y filtra por trabajador |
| **Recordatorios WhatsApp** | Mensaje prellenado con el nombre real del negocio para confirmar la cita |
| **Notificaciones in-app** | Aviso a admins y al trabajador asignado cuando entra una reserva pública; auto-refresco de la agenda |
| **Cobro vía POS** | El cobro redirige a Ventas (POS) con todo precargado; al guardar la venta la cita queda completada y vinculada |

### 🧾 Facturación Electrónica DIAN

| Funcionalidad | Detalle |
|--------------|---------|
| **Resoluciones DIAN** | Configuración de prefijo, rango y vigencia; múltiples resoluciones por empresa |
| **Numeración automática** | El número de factura se asigna en orden al confirmar la venta |
| **Campos tributarios** | NIT, DV, tipo de organización, régimen, responsabilidades fiscales (DIAN) |
| **Integración Matias API** | Envío de XML/PDF a la DIAN y consulta del CUFE en tiempo real |
| **Modo pruebas / producción** | Switch configurable por empresa para habilitar el ambiente de pruebas DIAN |

### 📊 Reportes (9 tipos)

| Reporte | Información |
|---------|------------|
| Resumen de Ventas | Ventas por período, método de pago, vendedor |
| Rentabilidad por Producto | Margen bruto, costo vs precio de venta |
| Cuentas por Cobrar | Saldo de cada cliente, días vencidos, aging |
| IVA Neto | IVA generado en ventas menos IVA descontable en compras |
| Kardex de Inventario | Movimientos detallados de un producto con costos |
| P&L Simplificado | Ingresos − Costos − Gastos = Utilidad del período |
| Productividad Operadores | Órdenes completadas y valor generado por operador |
| Reporte de Préstamos | Cartera activa, cuotas cobradas, mora acumulada |
| Reporte de Producción | Lotes producidos, merma, costo unitario |

### ⚙️ Administración SaaS

| Funcionalidad | Detalle |
|--------------|---------|
| **Panel SuperAdmin** | Gestión de todos los tenants: empresas, planes, módulos, suspensión |
| **Impersonación** | El SuperAdmin puede entrar como cualquier empresa para soporte remoto |
| **Planes de suscripción** | Trial 14 días → Premium mensual/anual → Vitalicio; activación automática vía Wompi |
| **Códigos promocionales** | Descuentos (% o monto fijo) aplicables al pagar la suscripción; con vigencia, límite de usos, un uso por empresa y restricción por planes. El monto con descuento se firma en el servidor (anti-manipulación) |
| **Módulos por tipo de negocio** | Perfiles configurables por el SuperAdmin sin tocar código |
| **Audit log** | Registro de todas las acciones críticas del SuperAdmin con fecha y detalle |
| **Anuncios globales** | Notificaciones push a todos los tenants desde el panel SuperAdmin |
| **Jobs automáticos** | Expiración de trials, renovaciones, limpieza — con registro de ejecuciones |
| **Mi Suscripción** | Cada empresa ve su plan, fechas, módulos activos e información de la plataforma Oracle Cloud |

### 🔐 Seguridad

| Capa | Implementación |
|------|---------------|
| **Autenticación** | JWT firmado con `empresa_id` en payload; expiración configurable |
| **Biométrico** | WebAuthn / FIDO2 — huella dactilar o reconocimiento facial, sin contraseña |
| **PIN de acceso rápido** | PIN de 4-6 dígitos con bloqueo automático por intentos fallidos |
| **Roles y módulos** | RBAC: SuperAdmin · Admin · Operador · Cobrador; cada módulo se habilita individualmente |
| **Rate limiting** | SlowAPI — protección contra abuso de endpoints de autenticación |
| **Aislamiento multi-tenant** | `empresa_id` obligatorio en cada tabla; imposible el acceso cruzado entre tenants |
| **Contraseñas** | bcrypt con salt; nunca almacenadas en texto plano |
| **HTTPS** | SSL/TLS con Let's Encrypt; renovación automática vía Certbot |

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 18 + Material UI v7 + tipografía Geist |
| **Backend** | FastAPI (Python 3.11) + Pydantic v2 |
| **Base de datos** | PostgreSQL 17 (producción auto-hospedada) / SQLite (desarrollo) |
| **ORM** | SQLAlchemy 2.x |
| **Autenticación** | JWT (python-jose) + WebAuthn/FIDO2 (py_webauthn) |
| **PDF** | ReportLab |
| **Proceso backend** | systemd + uvicorn |
| **Proxy inverso** | Nginx + Let's Encrypt (Certbot) |
| **Infraestructura** | Oracle Cloud Free Tier — VM.Standard.A1.Flex (ARM64) |
| **CI/CD** | GitHub webhook → script de deploy automático en el servidor |
| **Despliegue Frontend** | Vercel (CDN global) |
| **Pagos SaaS** | Wompi (Colombia) — cobro recurrente con tarjeta |
| **Facturación electrónica** | Matias API (DIAN Colombia) |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENTES (Navegador / Móvil)                │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────────────────┐
│          Frontend React 18 SPA — Vercel CDN Global              │
│          Material UI · Framer Motion · Chart.js                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │ REST / JSON + JWT
┌─────────────────────▼───────────────────────────────────────────┐
│         Nginx (Proxy inverso + SSL Let's Encrypt)               │
│                    api.ksmart360.com                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │ localhost:8000
┌─────────────────────▼───────────────────────────────────────────┐
│    FastAPI Python 3.11 — uvicorn — systemd (auto-restart)       │
│    • Multi-tenant: empresa_id en cada endpoint                  │
│    • 30+ módulos de API · Pydantic v2 · SQLAlchemy ORM          │
│    • WebAuthn/FIDO2 · JWT · Rate limiting · Audit log           │
└─────────────────────┬───────────────────────────────────────────┘
                      │ SQLAlchemy
┌─────────────────────▼───────────────────────────────────────────┐
│    PostgreSQL 17 — Auto-hospedado en Oracle Cloud               │
│    • 70+ tablas · TenantMixin · empresa_id isolation            │
│    • Migraciones automáticas sin Alembic (V1 → V89)            │
└─────────────────────────────────────────────────────────────────┘

Oracle Cloud VM.Standard.A1.Flex — 4 OCPU ARM · 24 GB RAM · 96 GB SSD
Ubuntu 22.04 LTS · IP fija · Firewall iptables + Security List OCI
```

### Patrón Multi-Tenant (Shared Database, Shared Schema)

```python
class TenantMixin:
    @declared_attr
    def empresa_id(cls):
        return Column(Integer, ForeignKey('empresas.id'), index=True)

# Cada endpoint extrae el empresa_id del JWT y lo aplica automáticamente
# → Imposible el acceso cruzado entre tenants
```

Un solo backend atiende **N empresas simultáneamente**. El `empresa_id` del JWT se inyecta en todas las consultas; el patrón `TenantMixin` garantiza aislamiento sin esfuerzo adicional por parte del desarrollador.

---

## CI/CD — Deploy Automático

Cada push a `main` dispara un webhook en GitHub que invoca el servidor Oracle:

```
Push a GitHub main
       │
       ▼
GitHub Webhook → POST http://158.101.127.148:9000/hooks/deploy-ksmart
       │
       ▼
/home/ubuntu/deploy.sh
  git pull origin main
  pip install -r requirements.txt
  sudo systemctl restart ksmart
```

El servicio `webhook` (puerto 9000) corre bajo systemd con verificación HMAC-SHA256 para autenticar las llamadas de GitHub.

---

## Estructura del Proyecto

```
ksmart/
├── backend/
│   ├── main.py                    # App FastAPI, CORS, routers, inicialización
│   ├── models.py                  # 70+ modelos SQLAlchemy · TenantMixin
│   ├── schemas.py                 # Schemas Pydantic v2 (request/response)
│   ├── database.py                # Conexión + migraciones automáticas V1→V108
│   ├── core/
│   │   ├── config.py              # SECRET_KEY, algoritmos JWT, configuración
│   │   ├── constants.py           # PlanType, AccessStatus, enums SaaS
│   │   ├── limiter.py             # Rate limiting (SlowAPI)
│   │   └── security.py            # bcrypt, JWT encode/decode
│   ├── crud/                      # Lógica de negocio por dominio
│   │   ├── clientes.py · productos.py · ventas.py · compras.py
│   │   ├── inventario.py · perecederos.py · produccion.py
│   │   ├── prestamos.py · parqueadero.py · lavadero.py
│   │   ├── grupos_producto.py · puntos.py · biometria.py
│   │   ├── agendamiento.py · promociones.py
│   │   └── empresas.py · usuarios.py · reportes.py
│   ├── services/
│   │   ├── contabilidad.py        # Asientos automáticos PUC colombiano
│   │   └── jobs_service.py        # Tareas programadas (expiración, mora)
│   └── api/v1/endpoints/          # 35+ módulos de endpoints
│       ├── auth.py                # Login, registro, refresh token
│       ├── biometric.py           # WebAuthn/FIDO2 (registro + autenticación)
│       ├── ventas.py · compras.py · productos.py · clientes.py
│       ├── inventario.py · produccion.py · cotizaciones.py
│       ├── prestamos.py · ruta_cobro.py
│       ├── parqueadero.py · lavadero.py · restaurante.py
│       ├── agendamiento.py · promociones.py
│       ├── reportes.py · caja.py · gastos.py
│       ├── facturacion_electronica.py
│       ├── suscripcion.py · wompi.py
│       ├── superadmin.py          # Panel SuperAdmin multi-tenant
│       ├── setup.py               # Wizard de primer arranque
│       └── catalogo_virtual.py    # Tienda pública por slug
│
└── frontend/
    └── src/
        ├── features/
        │   ├── auth/              # Login, Setup Wizard, biométrico, PIN
        │   ├── pos/               # POS clásico + Touch Mode
        │   ├── purchases/         # Compras con ítems libres y sort_order
        │   ├── inventory/         # Productos, Kardex, Lotes, Alertas
        │   ├── produccion/        # Recetas y Lotes de Producción
        │   ├── clientes/          # CRM, cartera, fidelización
        │   ├── cotizaciones/      # Preventas
        │   ├── reportes/          # 9 tipos de reporte + dashboard
        │   ├── caja/              # Corte de caja, gastos
        │   ├── prestamos/         # Préstamos, cuotas, ruta de cobro
        │   ├── parqueadero/       # Módulo completo de parqueadero
        │   ├── lavadero/          # POS lavadero + reportes
        │   ├── restaurante/       # Mesas, comandas, cocina, caja
        │   ├── agendamiento/      # Citas, calendario, portal público de reservas
        │   ├── catalogo/          # Catálogo virtual público
        │   ├── ordenes_trabajo/   # Flujo Admin→Operador
        │   ├── facturacion/       # DIAN electrónica
        │   └── account/           # Mi Suscripción, configuración empresa
        ├── components/common/     # CurrencyField, DatePicker, QuickCreate, etc.
        ├── layout/                # Sidebar, TopBar, ThemeProvider
        ├── api.js                 # Cliente Axios + interceptores JWT
        └── App.js                 # Router, auth global, theme
```

---

## Instalación Local (Desarrollo)

### Requisitos

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ *(en desarrollo local funciona con SQLite automáticamente sin configuración)*

### 1. Clonar

```bash
git clone https://github.com/keilor9703/ksmart.git
cd ksmart
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env             # Editar con tus valores
uvicorn main:app --reload --port 8000
```

Al arrancar, el backend:
1. Crea todas las tablas automáticamente (`Base.metadata.create_all`)
2. Aplica las migraciones de esquema V1→V89 sin Alembic
3. Detecta BD vacía y activa el Wizard de primer arranque

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env             # Editar REACT_APP_API_URL=http://localhost:8000
npm start                        # http://localhost:3000
```

### 4. Wizard de primer arranque

La primera vez que abras el frontend con BD vacía, el sistema muestra el **Wizard de Configuración Inicial**:

- Nombre y NIT de la empresa
- Logo (PNG/JPG hasta 2 MB)
- Color principal de la marca
- Tipo de negocio (ERP, Prestamista, Parqueadero, Lavadero, Restaurante)
- Usuario y contraseña del administrador

> **Sin wizard:** Define `SUPERADMIN_EMPRESA_NOMBRE`, `SUPERADMIN_USERNAME` y `SUPERADMIN_PASSWORD` en `.env` para inicialización automática.

---

## Variables de Entorno

### Backend (`.env`)

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `DATABASE_URL` | `postgresql://user:pass@host/db` | ✅ Producción |
| `SECRET_KEY` | Clave JWT — `python -c "import secrets; print(secrets.token_urlsafe(64))"` | ✅ |
| `ENVIRONMENT` | `production` o `development` | ✅ |
| `TZ` | Zona horaria (`America/Bogota`) | ✅ |
| `SUPERADMIN_PASSWORD` | Contraseña del admin inicial | ✅ |
| `WEBAUTHN_ORIGIN` | Origen para FIDO2 (ej: `https://www.tudominio.com`) | ✅ Biométrico |
| `WEBAUTHN_RP_ID` | RP ID para FIDO2 (ej: `tudominio.com`) | ✅ Biométrico |
| `WOMPI_PUBLIC_KEY` | Llave pública Wompi | ⬜ SaaS |
| `WOMPI_PRIVATE_KEY` | Llave privada Wompi | ⬜ SaaS |
| `WOMPI_INTEGRITY_SECRET` | Secret de integridad Wompi | ⬜ SaaS |
| `WOMPI_EVENTS_SECRET` | Secret de eventos Wompi | ⬜ SaaS |
| `EXTRA_CORS_ORIGINS` | URLs adicionales separadas por coma | ⬜ |

### Frontend (`.env`)

| Variable | Descripción |
|----------|-------------|
| `REACT_APP_API_URL` | URL del backend (ej: `https://api.tudominio.com`) |

---

## Despliegue en Producción (Oracle Cloud)

### Servidor Oracle Cloud

```bash
# Instalar dependencias del sistema
sudo apt update && sudo apt install -y python3.11 python3.11-venv python3-pip \
  nginx certbot python3-certbot-nginx postgresql postgresql-client-17 \
  webhook netfilter-persistent

# Clonar y configurar backend
git clone https://github.com/keilor9703/ksmart.git /home/ubuntu/ksmart
cd /home/ubuntu/ksmart/backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # ← Editar con valores de producción
```

### systemd — Servicio Backend

```ini
# /etc/systemd/system/ksmart.service
[Unit]
Description=Ksmart Backend
After=network.target postgresql.service

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/ksmart/backend
EnvironmentFile=/home/ubuntu/ksmart/backend/.env
ExecStart=/home/ubuntu/ksmart/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable ksmart
sudo systemctl start ksmart
```

### Nginx + SSL

```nginx
# /etc/nginx/sites-available/ksmart
server {
    listen 443 ssl;
    server_name api.tudominio.com;
    ssl_certificate     /etc/letsencrypt/live/api.tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.tudominio.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo certbot --nginx -d api.tudominio.com
sudo systemctl reload nginx
```

### Deploy automático (CI/CD)

```bash
# /home/ubuntu/deploy.sh
#!/bin/bash
cd /home/ubuntu/ksmart
git pull origin main
source backend/venv/bin/activate
pip install -r backend/requirements.txt -q
sudo systemctl restart ksmart
echo "✅ Deploy completado"
```

```bash
chmod +x /home/ubuntu/deploy.sh
# El webhook escucha en :9000 y ejecuta este script en cada push a main
```

### Frontend en Vercel

```bash
# Variables de entorno en Vercel
REACT_APP_API_URL=https://api.tudominio.com
```

```json
// vercel.json — SPA routing
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

---

## Migraciones de Base de Datos

Las migraciones se aplican automáticamente al iniciar el servidor. No se requiere Alembic ni comandos adicionales. El sistema lleva registro en la tabla `_schema_meta` y nunca aplica una migración dos veces.

**Versión actual: V108** — incluye todas las tablas, columnas y grupos de producto predefinidos, además de las novedades recientes: franja de descanso en agendamiento (V107) y códigos promocionales en suscripciones (V108).

---

## Módulos por Perfil de Empresa

| Módulo | ERP/Comercio | Prestamista | Parqueadero | Lavadero | Restaurante |
|--------|:---:|:---:|:---:|:---:|:---:|
| Ventas / POS | ✅ | ⬜ | ⬜ | ⬜ | ✅ |
| Inventario | ✅ | ⬜ | ⬜ | ⬜ | ✅ |
| Compras | ✅ | ⬜ | ⬜ | ⬜ | ✅ |
| Producción / Recetas | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| Órdenes de Trabajo | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| Cotizaciones | ✅ | ⬜ | ⬜ | ⬜ | ✅ |
| Facturación DIAN | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| Catálogo Virtual | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| Clientes / CRM | ✅ | ✅ | ⬜ | ✅ | ✅ |
| Caja & Gastos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reportes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Préstamos | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| Ruta de Cobro | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| Parqueadero | ⬜ | ⬜ | ✅ | ⬜ | ⬜ |
| POS Lavadero | ⬜ | ⬜ | ⬜ | ✅ | ⬜ |
| Mapa de Mesas | ⬜ | ⬜ | ⬜ | ⬜ | ✅ |
| Pantalla Cocina KDS | ⬜ | ⬜ | ⬜ | ⬜ | ✅ |
| Fidelización de clientes | ✅ | ⬜ | ⬜ | ⬜ | ✅ |
| Agendamiento de Citas | ✅ | ⬜ | ⬜ | ✅ | ✅ |

> El módulo de **Agendamiento** se habilita para cualquier negocio de servicios; el SuperAdmin puede activarlo en el perfil de cualquier empresa. La categoría de productos *"Platos y Preparaciones"* se crea por defecto únicamente para empresas tipo Restaurante.

---

## Roles de Usuario

| Rol | Permisos |
|-----|----------|
| **SuperAdmin** | Gestión global de la plataforma: empresas, planes, módulos, audit log, impersonación |
| **Admin** | Gestión completa de su empresa; todos los módulos habilitados para su tenant |
| **Operador** | Órdenes de trabajo asignadas; panel de productividad |
| **Cobrador** | Ruta de cobro asignada; cuotas del día con evidencia GPS |

---

## Planes SaaS

| Plan | Duración | Activación |
|------|----------|-----------|
| `trial` | 14 días | Automática al registrarse |
| `premium` | Mensual o anual | Webhook Wompi (pago exitoso) |
| `vitalicio` | Sin vencimiento | Asignación manual SuperAdmin |
| `canceled` | — | Redirige a `/suscripcion-expirada` |

La empresa propietaria del sistema (`id=1`) tiene `is_protected=true` y nunca expira.

Al pagar la suscripción se puede aplicar un **código promocional** (descuento por porcentaje o monto fijo). El descuento se valida y se firma en el servidor antes de cobrar, manteniendo la protección anti-manipulación de precios del flujo de Wompi.

---

## API — Endpoints Principales

```
# Primer arranque
GET    /setup/status                         ¿Sistema inicializado?
POST   /setup/init                           Crear empresa + admin (BD vacía)

# Autenticación
POST   /auth/token                           Login → JWT
POST   /auth/biometric/register             Registrar credencial biométrica
POST   /auth/biometric/authenticate         Login biométrico FIDO2
POST   /auth/pin                             Login con PIN

# Ventas
POST   /ventas/                              Crear venta (valida stock, cupo, puntos)
GET    /ventas/                              Listar ventas paginadas
DELETE /ventas/{id}                          Eliminar y revertir inventario

# Inventario
GET    /productos/                           Listar productos con stock
GET    /inventario/kardex/{producto_id}      Kardex por costo promedio
GET    /inventario/alertas/bajo-stock        Productos bajo stock mínimo
GET    /inventario/movimientos/template      Plantilla Excel para importación

# Compras
POST   /compras/                             Registrar compra (con ítems libres)
GET    /compras/                             Historial de compras
POST   /compras/pagos/                       Abonar a una compra

# Reportes
GET    /reportes/dashboard                   KPIs en tiempo real
GET    /reportes/ventas_summary              Resumen de ventas por período
GET    /reportes/rentabilidad_productos      Margen bruto por producto
GET    /reportes/iva_neto                    IVA generado − IVA descontable
GET    /reportes/kardex                      Movimientos de inventario
GET    /reportes/cuentas_por_cobrar          Aging de cartera

# Agendamiento de citas
GET    /agendamiento/config                  Config de horario/anticipo/descanso
GET    /agendamiento/disponibilidad          Franjas libres por servicio y día
GET    /agendamiento/citas                    Citas (admin: todas · trabajador: las suyas)
POST   /agendamiento/citas                    Crear cita
PATCH  /agendamiento/citas/{id}/estado       Cambiar estado (transición validada)
POST   /agendamiento/citas/{id}/preparar-cobro  Prepara datos y redirige a POS
GET    /agendamiento/publico/{slug}          Info pública del portal de reservas
POST   /agendamiento/publico/{slug}/cita     Reserva pública del cliente

# Códigos promocionales
POST   /promociones/validar                  Previsualiza el descuento para un plan
GET    /promociones/admin                    Listar códigos (SuperAdmin)
POST   /promociones/admin                    Crear código (SuperAdmin)

# Pagos de suscripción (Wompi)
POST   /wompi/generar-hash                   Firma el monto (con código promo opcional)
POST   /wompi/confirmar-pago-widget          Activa la suscripción tras el pago

# SuperAdmin
GET    /superadmin/empresas                  Todos los tenants
PATCH  /superadmin/empresas/{id}/plan        Cambiar plan de suscripción
POST   /superadmin/impersonate/{id}          Soporte: entrar como empresa
GET    /superadmin/dashboard-stats           Métricas globales de la plataforma
GET    /superadmin/audit-logs                Historial de acciones críticas
```

Documentación Swagger completa en: `{API_URL}/docs`

---

## Integraciones

| Integración | Propósito |
|------------|-----------|
| **Wompi** | Cobro recurrente de suscripciones SaaS con tarjeta (Colombia) |
| **Matias API** | Facturación electrónica DIAN — UBL 2.1, CUFE, XML/PDF |
| **FIDO2/WebAuthn** | Autenticación biométrica sin contraseña (huella, cara) |
| **WhatsApp Cloud API** | Alertas de parqueadero, recibos de cobro, notificaciones |
| **TRM Datos.gov.co** | Tasa de cambio diaria del Banco de la República |
| **Oracle Cloud OCI** | Infraestructura ARM de alta disponibilidad |
| **Vercel CDN** | Frontend servido desde edge locations globales |
| **Let's Encrypt** | Certificados SSL gratuitos con renovación automática |

---

## Licencia

Proyecto privado — Todos los derechos reservados © 2026 Tech Stack Colombia SAS / KSMP Systems.

## Desarrollado por

**Tech Stack Colombia SAS**
Soluciones tecnológicas para empresas colombianas
🌐 [techstackcol.com](https://techstackcol.com) · 📧 keilor9703@gmail.com
