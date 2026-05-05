import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

import models

logger = logging.getLogger("database")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sales.db").strip()

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

IS_SQLITE = DATABASE_URL.startswith("sqlite")

engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()

# ──────────────────────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def _ensure_schema_meta(conn):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS _schema_meta(
            key TEXT PRIMARY KEY,
            value TEXT
        );
    """))

def _migration_already_applied(conn, key):
    return conn.execute(
        text("SELECT 1 FROM _schema_meta WHERE key=:key"),
        {"key": key}
    ).fetchone() is not None

def _mark_migration_applied(conn, key, value="done"):
    if IS_SQLITE:
        conn.execute(text("""
            INSERT INTO _schema_meta(key,value)
            VALUES(:key,:value)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value
        """), {"key": key, "value": value})
    else:
        conn.execute(text("""
            INSERT INTO _schema_meta(key,value)
            VALUES(:key,:value)
            ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value
        """), {"key": key, "value": value})

def _table_exists(conn, table):
    if IS_SQLITE:
        return conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name=:n"),
            {"n": table}
        ).fetchone() is not None
    return conn.execute(
        text("SELECT 1 FROM information_schema.tables WHERE table_name=:n"),
        {"n": table}
    ).fetchone() is not None

def _index_exists(conn, name):
    if IS_SQLITE:
        return conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='index' AND name=:n"),
            {"n": name}
        ).fetchone() is not None
    return conn.execute(
        text("SELECT 1 FROM pg_indexes WHERE indexname=:n"),
        {"n": name}
    ).fetchone() is not None


def _column_exists(conn, table, column):
    if IS_SQLITE:
        # En SQLite no se pueden usar parámetros en PRAGMA
        result = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
        # La segunda columna del resultado es el nombre de la columna
        return any(r[1] == column for r in result)
    else:
        return conn.execute(
            text("""
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = :t AND column_name = :c
            """),
            {"t": table, "c": column}
        ).fetchone() is not None

# ──────────────────────────────────────────────────────────────────────────────
# MIGRACIONES
# ──────────────────────────────────────────────────────────────────────────────

def run_migrations():
    try:
        with engine.begin() as conn:
            _ensure_schema_meta(conn)

            # ═══════════════════════════════════════════════════════════════
            # V35 - CREDENCIALES BIOMÉTRICAS (WebAuthn)
            # ═══════════════════════════════════════════════════════════════

            migration_v35 = "inv_v35_credenciales_biometricas"

            if not _migration_already_applied(conn, migration_v35):

                if not _table_exists(conn, "credenciales_biometricas"):

                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE credenciales_biometricas (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                user_id INTEGER NOT NULL,
                                credential_id TEXT NOT NULL UNIQUE,
                                public_key TEXT NOT NULL,
                                sign_count INTEGER DEFAULT 0,
                                device_name TEXT,
                                user_agent TEXT,
                                transports TEXT,
                                last_used_at TIMESTAMP,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE credenciales_biometricas (
                                id SERIAL PRIMARY KEY,
                                user_id INTEGER NOT NULL,
                                credential_id TEXT NOT NULL UNIQUE,
                                public_key TEXT NOT NULL,
                                sign_count BIGINT DEFAULT 0,
                                device_name VARCHAR(120),
                                user_agent VARCHAR(500),
                                transports VARCHAR(120),
                                last_used_at TIMESTAMPTZ,
                                created_at TIMESTAMPTZ DEFAULT NOW()
                            )
                        """))

                    if not _index_exists(conn, "idx_credenciales_user"):
                        conn.execute(text("""
                            CREATE INDEX idx_credenciales_user 
                            ON credenciales_biometricas(user_id)
                        """))

                    if not _index_exists(conn, "idx_credenciales_credid"):
                        conn.execute(text("""
                            CREATE INDEX idx_credenciales_credid 
                            ON credenciales_biometricas(credential_id)
                        """))

                _mark_migration_applied(conn, migration_v35)
                logger.info("V35 (Credenciales biométricas) aplicada.")
            
            
            # V36 - Campos de auditoría para baja de vehículos
            migration_v36 = "inv_v36_vehiculos_baja_audit"
            if not _migration_already_applied(conn, migration_v36):

                # Añadir fecha_baja
                if not _column_exists(conn, "vehiculos", "fecha_baja"):
                    if IS_SQLITE:
                        conn.execute(text(
                            "ALTER TABLE vehiculos ADD COLUMN fecha_baja TIMESTAMP NULL"
                        ))
                    else:
                        conn.execute(text(
                            "ALTER TABLE vehiculos ADD COLUMN fecha_baja TIMESTAMPTZ NULL"
                        ))
                    logger.info("V36: añadido vehiculos.fecha_baja")

                # Añadir motivo_baja
                if not _column_exists(conn, "vehiculos", "motivo_baja"):
                    if IS_SQLITE:
                        conn.execute(text(
                            "ALTER TABLE vehiculos ADD COLUMN motivo_baja TEXT NULL"
                        ))
                    else:
                        conn.execute(text(
                            "ALTER TABLE vehiculos ADD COLUMN motivo_baja VARCHAR(500) NULL"
                        ))
                    logger.info("V36: añadido vehiculos.motivo_baja")

                _mark_migration_applied(conn, migration_v36)
                logger.info("V36 (Auditoría de baja de vehículos) aplicada.")


    except Exception as e:
        logger.exception("Error ejecutando migraciones: %s", e)
        raise