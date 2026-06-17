# Ksmart360 — Ficha Técnica
## Documento para Evaluación Técnica · Junio 2026

> Este documento está dirigido a equipos de ingeniería, arquitectos de software y casas de software interesadas en evaluar, adquirir u operar Ksmart360 como plataforma SaaS bajo licencia.

---

## Resumen Ejecutivo

Ksmart360 es un sistema ERP multi-tenant de gestión empresarial construido con arquitectura moderna, orientado a pequeñas y medianas empresas del mercado colombiano y latinoamericano. El sistema está en producción activa, con clientes reales, infraestructura enterprise y más de **21 módulos funcionales** completamente integrados.

El codebase es propio — desarrollado desde cero, sin dependencia de ERPs de terceros ni frameworks de negocio licenciados. Esto lo hace **adquirible, extensible y operable** por cualquier casa de software con capacidad técnica en Python y React.

---

## Stack Tecnológico

### Backend

| Componente | Tecnología |
|------------|------------|
| Lenguaje | Python 3.11 |
| Framework API | FastAPI |
| ORM | SQLAlchemy 2.0 |
| Base de datos | PostgreSQL 17 |
| Autenticación | JWT (python-jose) + WebAuthn/FIDO2 |
| Validación | Pydantic v2 |
| Generación de reportes | ReportLab (PDF), openpyxl / pandas (Excel) |
| Rate limiting | SlowAPI |
| Servidor ASGI | Uvicorn (con workers) |
| Hashing de contraseñas | bcrypt (passlib) |

### Frontend

| Componente | Tecnología |
|------------|------------|
| Framework | React 19 |
| UI Components | Material UI (MUI) v7 |
| Routing | React Router v7 |
| HTTP Client | Axios |
| Gráficas | Chart.js + react-chartjs-2 |
| Animaciones | Framer Motion |
| Escaneo de códigos | ZXing + html5-qrcode |
| Date/Time | Day.js + MUI X Date Pickers |
| Build | Create React App (react-scripts 5) |

### Infraestructura (producción actual)

| Componente | Tecnología |
|------------|------------|
| Servidor | Oracle Cloud VM.Standard.A1.Flex — ARM64 |
| CPU / RAM | 4 OCPU / 24 GB RAM |
| Almacenamiento | 96 GB SSD NVMe |
| OS | Ubuntu 22.04 LTS |
| Proxy inverso | Nginx con SSL/TLS (Let's Encrypt) |
| Proceso backend | systemd service (auto-restart) |
| CI/CD | GitHub Webhook → shell deploy script |
| Backups | pg_dump diario automatizado (retención 15 días) |
| Monitoreo | Endpoint `/health` con verificación de BD |
| Frontend hosting | Vercel (CDN global) |

---

## Arquitectura del Sistema

### Patrón Multi-Tenant

El sistema implementa el patrón **Shared Database, Shared Schema** con aislamiento por `empresa_id`:

- Cada tabla de negocio lleva `empresa_id` como columna de partición lógica.
- Todos los endpoints de la API validan el `empresa_id` extraído del JWT del usuario autenticado.
- No existe posibilidad de acceso cruzado entre empresas a nivel de capa de negocio.
- El SuperAdmin tiene un rol especial con capacidad de impersonación controlada para soporte.

### Autenticación y Seguridad

- **JWT stateless** con expiración configurable y firma HMAC-SHA256.
- **WebAuthn / FIDO2** para autenticación biométrica (huella, rostro) en dispositivos compatibles. El dato biométrico nunca abandona el dispositivo del usuario — el servidor almacena únicamente la clave pública criptográfica.
- **Rate limiting** por IP y por usuario en endpoints sensibles.
- **CORS** configurado por dominio autorizado.
- Contraseñas almacenadas con bcrypt (factor de costo configurable).

### API REST

- Arquitectura **RESTful** con versionado (`/api/v1/`).
- Más de **40 routers independientes** organizados por dominio de negocio.
- Respuestas estandarizadas con esquemas Pydantic v2.
- Documentación automática Swagger/OpenAPI en `/docs`.

### Migraciones de Base de Datos

- Sistema de migraciones **propio e idempotente**, sin dependencia de Alembic en producción.
- Cada migración tiene un identificador único de versión y se aplica una sola vez.
- Las migraciones se ejecutan automáticamente al iniciar el servicio — sin intervención manual en deploys.
- Actualmente en versión de migración **V89**.

### Procesamiento de Pagos

- Integración con **Wompi** (pasarela líder en Colombia) para suscripciones SaaS.
- Verificación de pagos vía **webhook con firma HMAC** — el sistema activa planes automáticamente al recibir la confirmación del pago.
- Soporte para tarjeta de crédito, tarjeta débito y PSE.

### Facturación Electrónica DIAN

- Integración con **Matias API** como proveedor tecnológico habilitado DIAN.
- Generación de XML UBL 2.1, firma digital, envío y recepción de CUFE.
- Soporte para ambiente de pruebas y producción desde la misma configuración.

---

## Métricas del Codebase

| Métrica | Valor |
|---------|-------|
| Módulos de negocio | 21 |
| Archivos Python (backend) | ~65 |
| Líneas de código backend | ~22.000 |
| Archivos React (frontend) | ~152 |
| Endpoints API | ~200+ |
| Versiones de migración BD | 89 |
| Tipos de negocio soportados | 5 |

---

## Módulos del Sistema

El sistema cubre de forma nativa los siguientes dominios de negocio, todos integrados entre sí:

| Módulo | Descripción |
|--------|-------------|
| POS Clásico y Touch | Punto de venta multi-dispositivo con escáner por cámara |
| Cotizaciones | Conversión automática a venta |
| Inventario | Kardex, FEFO, lotes, alertas, carga masiva |
| Compras | CxP, ítems libres, integración contable |
| Clientes / Terceros | CRM básico, cartera, WhatsApp integrado |
| Órdenes de Trabajo | Flujo de estados, panel operador, evidencia fotográfica |
| Producción / Recetas | BOM, órdenes de fabricación, costo automático |
| Caja | Apertura, gastos, corte con arqueo |
| Reportes | P&L, ventas, cartera, inventario, productividad |
| Préstamos | Simulador, plan de pagos, mora automática, abono a capital |
| Ruta de Cobro | GPS, evidencia fotográfica, WhatsApp |
| Parqueadero | Tarifas, cupos, mensualidades |
| Lavadero | POS especializado, productividad por operador |
| Catálogo Virtual | Tienda online con pedidos por WhatsApp |
| Facturación DIAN | XML UBL 2.1, CUFE, resoluciones |
| Contabilidad | Partida doble automática, PUC colombiano |
| Restaurante | Categorías de cocina, POS Touch especializado |
| Autenticación biométrica | WebAuthn/FIDO2, sin datos biométricos en servidor |
| Programa de Puntos | Acumulación y canje integrado en POS |
| Usuarios y Roles | RBAC granular, roles personalizados |
| Suscripción SaaS | Planes, Wompi, activación automática vía webhook |

---

## Modelo de Negocio SaaS

El sistema está diseñado y operando bajo modelo **Software as a Service**:

- **Registro de empresas**: autoservicio con onboarding automático.
- **Trial gratuito**: 14 días con acceso completo, sin tarjeta de crédito.
- **Planes de suscripción**: configurables por el operador del sistema.
- **Activación automática**: el pago activa el plan sin intervención humana.
- **Multi-tenant desde el primer día**: una sola instancia del sistema sirve a N empresas simultáneamente.
- **SuperAdmin separado**: panel de administración del operador SaaS con impersonación, gestión de planes y visibilidad global.

---

## Capacidad de Escalamiento

La arquitectura actual soporta escalamiento en dos dimensiones:

**Vertical (instancia única):**
La instancia Oracle Cloud A1 con 4 OCPU ARM y 24 GB RAM puede manejar cientos de empresas concurrentes con la configuración actual de Uvicorn + PostgreSQL.

**Horizontal (múltiples instancias):**
Al ser stateless (JWT sin sesión en servidor), el backend puede escalarse horizontalmente con un balanceador de carga frente a múltiples instancias Uvicorn apuntando a la misma base de datos PostgreSQL — sin modificaciones al código.

**Base de datos:**
PostgreSQL 17 soporta particionamiento por `empresa_id`, réplicas de lectura y conexión pooling (PgBouncer) para escenarios de alta demanda.

---

## Integraciones Externas

| Integración | Propósito |
|-------------|-----------|
| Wompi | Pasarela de pagos colombiana — suscripciones SaaS |
| Matias API | Proveedor tecnológico DIAN — facturación electrónica |
| OpenFoodFacts | Base global de productos — auto-completado por código de barras |
| UPCitemdb | Base global de productos — auto-completado complementario |
| WhatsApp (deeplink) | Cobros, recibos, recordatorios, catálogo virtual |
| WebAuthn/FIDO2 | Autenticación biométrica nativa en navegadores |
| GitHub Webhooks | CI/CD — deploy automático en push a main |

---

## Lo que obtiene un adquirente

Un equipo técnico que adquiera Ksmart360 recibe:

- Codebase completo (backend Python + frontend React) con arquitectura limpia y bien organizada.
- Sistema en producción activa con clientes reales — no un prototipo.
- Infraestructura documentada y reproducible.
- 21 módulos funcionales listos para operar.
- Modelo SaaS multi-tenant implementado y probado.
- Integraciones activas con DIAN, Wompi y bases globales de productos.
- Capacidad de personalizar, extender y re-brandear el sistema.

---

## Contexto de Adquisición

Ksmart360 es un activo tecnológico desarrollado íntegramente por su equipo propietario, sin componentes licenciados de terceros que restrinjan la transferencia. El sistema puede ser:

- **Adquirido en su totalidad** para operación independiente.
- **Licenciado** bajo acuerdo de operación con revenue sharing.
- **White-label** para casas de software que quieran ofrecerlo bajo su propia marca.

Para conversaciones de adquisición o licenciamiento, contactar directamente al equipo propietario.

---

*Ksmart360 — Construido para durar, diseñado para crecer.*  
*Junio 2026*
