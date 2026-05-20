# Manual Técnico de Arquitectura y Desarrollo - Ksmart360
## Versión: 2.5.0 | Arquitectura SaaS Multi-Tenant

Este documento detalla la estructura técnica, lógica y de despliegue de Ksmart360 para desarrolladores y administradores de sistemas.

---

## 1. Arquitectura del Sistema
Ksmart360 utiliza un enfoque desacoplado basado en una API REST asíncrona y una Single Page Application (SPA).

*   **Backend:** Python 3.10+ con **FastAPI**.
*   **Frontend:** React 18 con **Material UI (MUI)**.
*   **Base de Datos:** PostgreSQL (Producción) / SQLite (Desarrollo).
*   **Aislamiento:** Multi-tenant mediante el patrón de **Shared Database, Shared Schema**, utilizando un `empresa_id` obligatorio en cada tabla.

---

## 2. Core Multi-Tenant y Seguridad
El aislamiento de datos se garantiza en la capa de modelos mediante un `TenantMixin`.

### 2.1 TenantMixin (SQLAlchemy)
Casi todos los modelos heredan de `TenantMixin`, el cual inyecta:
*   `empresa_id`: Foreign Key hacia la tabla `empresas`.
*   Relación `empresa`: Para acceso directo al objeto tenant.

### 2.2 Seguridad JWT y WebAuthn
*   **JWT:** El token contiene el `empresa_id` y los módulos habilitados. Este ID se extrae en el backend mediante la dependencia `get_current_active_user`, impidiendo que un usuario acceda a datos de otro tenant.
*   **WebAuthn:** Implementado para autenticación biométrica sin contraseñas. Utiliza el estándar FIDO2 para almacenar claves públicas vinculadas al `user_id`.

---

## 3. Módulos y Lógica de Negocio Crítica

### 3.1 Inventario e Inteligencia de Datos
*   **Integración Barcode:** El endpoint `/productos/search-barcode` implementa una búsqueda en cascada: Local -> Ksmart Global -> OpenFoodFacts -> UPCitemdb.
*   **Kardex:** Los movimientos de inventario se registran en la tabla `inventory_movements` con tipos `ENTRADA`, `SALIDA` y `AJUSTE`.

### 3.2 Motor de Pagos y Suscripciones (SaaS)
*   **Pasarela Wompi:** Integración mediante Webhooks para la activación automática de planes.
*   **Middleware 402:** El backend verifica en cada mutación (POST/PUT/DELETE) si la empresa tiene una suscripción vigente. Si no, retorna un status code 402 (Payment Required).

### 3.3 Módulo de Préstamos
*   **Cálculo de Mora:** Un cron-job diario o disparador de vista calcula los intereses de mora basados en el `saldo_pendiente` de las cuotas vencidas.
*   **Evidencias GPS:** La tabla `evidencias_cobro` almacena coordenadas de geolocalización y URLs de imágenes alojadas en S3/Cloudinary.

---

## 4. Integraciones y APIs Externas
*   **DIAN (Facturación Electrónica):** Integración mediante la API de **Matias API**. Manejo de prefijos, CUFE y generación de archivos XML/PDF.
*   **WhatsApp Cloud API:** Generación dinámica de mensajes codificados para notificaciones de parqueadero y cobranza.
*   **Market Data (Cacao):** Web scraping y consumo de APIs de Yahoo Finance (ICE Futures) y Datos.gov.co (TRM) para el cálculo de precios locales.

---

## 5. Comandos de Despliegue y Mantenimiento

### Backend (Producción/Render)
```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Migraciones Automáticas
El sistema utiliza un motor de migraciones personalizado en `database.py` que se ejecuta al inicio de la aplicación, asegurando que el esquema esté actualizado sin necesidad de Alembic.

### Monitoreo de Tareas (Jobs)
El servicio `jobs_service.py` gestiona tareas programadas como:
*   Expiración automática de periodos de prueba.
*   Actualización de precios de mercado (Cacao).
*   Alertas de vencimiento de parqueadero.

---
**Ksmart360 Engineering - Mayo 2026**
