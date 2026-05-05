from sqlalchemy.orm import Session
from sqlalchemy import func, text, cast, Date
from typing import Optional, List, IO
from datetime import date, timedelta, datetime, timezone, time
from passlib.context import CryptContext
from zoneinfo import ZoneInfo
import models, schemas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
COL_TZ = "America/Bogota"

def _is_postgres(db: Session) -> bool:
    try:
        dialect = db.get_bind().dialect.name
        return dialect == "postgresql"
    except Exception:
        try:
            from database import DATABASE_URL
            return "postgresql" in DATABASE_URL.lower()
        except Exception:
            return False

# ─── MANEJO PROFESIONAL DE ZONAS HORARIAS ───
BOGOTA_TZ = ZoneInfo("America/Bogota")
UTC_TZ = ZoneInfo("UTC")

def get_utc_boundaries(local_date: date, db: Session = None):
    """
    Toma una fecha local (date) y devuelve el inicio y fin de ese día en UTC.
    Compatible tanto con Postgres (Producción) como SQLite (Local).
    """
    local_start = datetime.combine(local_date, time.min, tzinfo=BOGOTA_TZ)
    local_end = datetime.combine(local_date, time.max, tzinfo=BOGOTA_TZ)

    utc_start = local_start.astimezone(UTC_TZ)
    utc_end = local_end.astimezone(UTC_TZ)

    # Si pasamos la db y comprobamos que es SQLite, removemos el tzinfo
    # para que la comparación por string en SQLite funcione.
    if db and not _is_postgres(db):
        utc_start = utc_start.replace(tzinfo=None)
        utc_end = utc_end.replace(tzinfo=None)

    return utc_start, utc_end

# ═══════════════════════════════════════════════════════════════════════════════
# UTILIDADES
# ═══════════════════════════════════════════════════════════════════════════════

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)
