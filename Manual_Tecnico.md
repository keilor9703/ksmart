================================================================================
MANUAL TÉCNICO DE ARQUITECTURA Y DESARROLLO - KSMART360
Sistema: SaaS Multi-Tenant (ERP, Parqueadero, Préstamos)
Versión: 2.1.0 (Producción)
================================================================================

-- ÍNDICE --
1. Resumen de la Arquitectura
2. Stack Tecnológico y Entornos
3. Modelo Multi-Tenant (Aislamiento de Datos)
4. Estructura del Backend (FastAPI)
5. Estructura del Frontend (React SPA)
6. Flujo de Autenticación y Seguridad (JWT + WebAuthn)
7. Integraciones Externas (Barcode APIs y WhatsApp)
8. Motor de Pagos SaaS (Wompi)
9. Sistema de Migraciones (Custom)
10. Lógica de Negocio Crítica y Módulos
11. Comandos de Ejecución Local

================================================================================
1. RESUMEN DE LA ARQUITECTURA
================================================================================
Ksmart360 es una plataforma SaaS distribuida bajo una arquitectura desacoplada:
- **Frontend:** Single-Page Application (SPA) reactiva.
- **Backend:** API RESTful asíncrona de alto rendimiento.
- **Base de Datos:** Patrón "Shared Database, Shared Schema". El aislamiento es lógico mediante el `empresa_id`.
- **Escalabilidad:** Diseñado para soportar miles de inquilinos (tenants) sobre una única infraestructura compartida.

================================================================================
2. STACK TECNOLÓGICO Y ENTORNOS
================================================================================
- **Backend:** Python 3.10+, FastAPI, SQLAlchemy (ORM), Pydantic v2 (Validación), python-jose (JWT).
- **Frontend:** React 18, Material-UI (MUI), Axios, Chart.js, Lucide Icons.
- **Base de Datos:** 
  - Producción: PostgreSQL (Gestionado).
  - Desarrollo: SQLite (`sales.db`).
- **Despliegue:**
  - Frontend: Vercel.
  - Backend: Render Cloud.

================================================================================
3. MODELO MULTI-TENANT (AISLAMIENTO DE DATOS)
================================================================================
El aislamiento se implementa mediante el `TenantMixin` en `models.py`.
- **Mixin Abstracto:** Inyecta automáticamente `empresa_id` (Integer, ForeignKey) y la relación `empresa`.
- **Inyección de Filtro:** Toda función en `crud.py` requiere el parámetro `empresa_id`.
  - Ejemplo: `db.query(models.Venta).filter(models.Venta.empresa_id == empresa_id)`.
- **Seguridad en Capa de Red:** El `empresa_id` NUNCA se recibe desde el frontend por parámetro body/query modificable; se extrae directamente del token JWT verificado en el servidor.

================================================================================
4. ESTRUCTURA DEL BACKEND (FastAPI)
================================================================================
- `main.py`: Punto de entrada, configuración de CORS, middlewares y registro de routers.
- `api/v1/api.py`: Orquestador de rutas.
- `api/v1/endpoints/`: Un archivo por módulo (auth, productos, ventas, parqueadero, prestamos, taller, etc.).
- `models.py`: Modelos SQLAlchemy con relaciones declarativas y `TenantMixin`.
- `schemas.py`: Esquemas Pydantic para Input/Output y validación de tipos.
- `crud/`: Directorio con lógica de base de datos modularizada.
  - `crud/common.py`: Funciones transversales y manejo de zonas horarias (Bogotá).

================================================================================
5. ESTRUCTURA DEL FRONTEND (React SPA)
================================================================================
- `src/App.js`: Router central y guardianes de ruta. Gestiona la lógica de "Suscripción Expirada" (Error 402).
- `src/features/`: Organización modular por dominio (dashboard, inventory, parking, loans, sales).
- `src/api.js`: Instancia de Axios con interceptor para inyectar el Header `Authorization`.
- `src/theme.js`: Configuración estética de MUI (Colores, Tipografía).

================================================================================
6. FLUJO DE AUTENTICACIÓN Y SEGURIDAD
================================================================================
- **JWT (JSON Web Tokens):** Flujo Stateless. El token contiene `sub`, `empresa_id`, `role` y `modules`.
- **WebAuthn (Biometría):** 
  - `biometric.py`: Endpoints para `register-options`, `verify-registration`, `authenticate-options` y `verify-authentication`.
  - Almacena Claves Públicas en la tabla `credenciales_biometricas`.
- **RBAC (Role-Based Access Control):** Los permisos se validan mediante la dependencia `get_current_active_user` y el check de la lista `modulos_habilitados` de la empresa.

================================================================================
7. INTEGRACIONES EXTERNAS
================================================================================
- **Barcode AI (Búsqueda en Cascada):**
  - Implementado en `api/v1/endpoints/productos.py`.
  - Consulta secuencial: Local -> Global Ksmart -> OpenFoodFacts -> UPCitemdb.
  - Utiliza `httpx.AsyncClient` con timeouts controlados para no bloquear el hilo de ejecución.
- **WhatsApp Cloud API:**
  - Generación de links `wa.me` dinámicos con mensajes codificados en `UTF-8`.
  - Seguimiento de envíos en la tabla `envios_whatsapp_parqueadero`.

================================================================================
8. MOTOR DE PAGOS SAAS (WOMPI)
================================================================================
- **Integridad:** El backend genera una firma HMAC SHA-256 (`WOMPI_INTEGRITY_SECRET`) para que el frontend pueda instanciar el widget de pago con valores inalterables.
- **Webhook de Notificación:**
  - Endpoint: `/webhooks/wompi`.
  - Valida firma de Wompi.
  - Implementa idempotencia basada en el ID de transacción.
  - Actualiza `trial_ends_at` sumando los meses adquiridos y activa la cuenta.

================================================================================
9. SISTEMA DE MIGRACIONES (CUSTOM)
================================================================================
- No utiliza Alembic. Utiliza un motor ligero en `database.py`.
- `run_migrations()`: Ejecuta sentencias SQL de forma condicional basándose en `PRAGMA table_info` (SQLite) o `information_schema` (PostgreSQL).
- Asegura la evolución del esquema sin pérdida de datos en despliegues automatizados.

================================================================================
10. LÓGICA DE NEGOCIO CRÍTICA
================================================================================
- **Kardex:** Cálculo dinámico basado en `InventoryMovement`.
- **Intereses de Mora (Préstamos):** Algoritmo diario que calcula el recargo sobre el saldo pendiente de cuotas vencidas.
- **Cupos de Parqueadero:** Lógica de concurrencia para evitar sobrepasar el cupo configurado en la tabla `parqueadero_config`.
- **Producción (BOM):** Gestión de estados (Planificada -> Confirmada) con validación de suficiencia de insumos antes de la ejecución.

================================================================================
11. COMANDOS DE EJECUCIÓN LOCAL
================================================================================

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm start
