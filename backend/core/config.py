import os
import secrets
import logging

logger = logging.getLogger("config")

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    _env = os.getenv("ENVIRONMENT", "development").lower()
    if _env == "production":
        raise RuntimeError(
            "SECRET_KEY no está configurada. Establece la variable de entorno SECRET_KEY "
            "antes de iniciar el servidor en producción."
        )
    SECRET_KEY = secrets.token_urlsafe(32)
    logger.warning("⚠️ SECRET_KEY no configurada. Usando clave temporal (solo válido en desarrollo).")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))

# Otros parámetros de configuración pueden ir aquí
PROJECT_NAME = "Ksmart360 API"
VERSION = "2.1.0"

CRON_API_KEY = os.getenv("CRON_API_KEY", "")

# Perfiles de módulos por defecto según el tipo de negocio
PERFILES = {
    "erp": [
        "/ventas", "/cotizaciones", "/admin/resoluciones", "/compras", 
        "/clientes", "/productos", "/inventario", "/inventario/lotes", 
        "/reportes-inventario", "/caja", "/produccion/recetas", "/produccion/lotes", 
        "/ordenes-trabajo", "/panel-operador", "/reportes", "/admin/usuarios",
    ],
    "prestamos": [
        "/clientes", "/prestamos", "/ruta-cobro", "/caja", "/reportes",
        "/admin/usuarios",
    ],
    "parqueadero": [
        "/parqueadero", "/parqueadero/buscar", "/parqueadero/vehiculos",
        "/parqueadero/suscripciones", "/parqueadero/config", "/clientes",
        "/caja", "/reportes", "/admin/usuarios",
    ],
    "lavadero": [
        "/lavadero/ventas",
        "/lavadero/reporte",
        "/clientes",
        "/productos",
        "/caja",
        "/reportes",
        "/admin/usuarios",
    ],
    "restaurante": [
        "/restaurante", "/restaurante/cocina", "/restaurante/config", "/restaurante/caja",
        "/ventas", "/cotizaciones", "/clientes", "/productos",
        "/inventario", "/inventario/lotes", "/reportes-inventario",
        "/compras", "/caja", "/reportes", "/admin/usuarios",
    ],
}
