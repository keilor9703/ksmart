import os
import secrets
import logging

logger = logging.getLogger("config")

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    SECRET_KEY = secrets.token_urlsafe(32)
    logger.warning("⚠️ SECRET_KEY no está configurada. Usando una clave temporal generada al vuelo.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))

# Otros parámetros de configuración pueden ir aquí
PROJECT_NAME = "Ksmart360 API"
VERSION = "2.1.0"

CRON_API_KEY = os.getenv("CRON_API_KEY", "ksmart-cron-internal")
