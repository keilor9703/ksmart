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

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _ensure_schema_meta(conn):
    conn.execute(text("CREATE TABLE IF NOT EXISTS _schema_meta(key TEXT PRIMARY KEY, value TEXT);"))

def _migration_already_applied(conn, key):
    return conn.execute(text("SELECT value FROM _schema_meta WHERE key=:key"), {"key": key}).fetchone() is not None

def _mark_migration_applied(conn, key, value="done"):
    if IS_SQLITE:
        conn.execute(text("INSERT INTO _schema_meta(key,value) VALUES(:key,:value) ON CONFLICT(key) DO UPDATE SET value=excluded.value"), {"key": key, "value": value})
    else:
        conn.execute(text("INSERT INTO _schema_meta(key,value) VALUES(:key,:value) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value"), {"key": key, "value": value})

def _column_exists(conn, table, col):
    if IS_SQLITE:
        return any(r[1] == col for r in conn.execute(text(f"PRAGMA table_info({table});")).fetchall())
    return conn.execute(text("SELECT 1 FROM information_schema.columns WHERE table_name=:t AND column_name=:c"), {"t": table, "c": col}).fetchone() is not None

def _table_exists(conn, table):
    if IS_SQLITE:
        return conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name=:n"), {"n": table}).fetchone() is not None
    return conn.execute(text("SELECT 1 FROM information_schema.tables WHERE table_name=:n"), {"n": table}).fetchone() is not None

def _add_column_if_missing(conn, table, col_sql, col_name):
    if _column_exists(conn, table, col_name):
        return
    logger.info("Agregando columna %s.%s", table, col_name)
    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_sql}"))

def _index_exists(conn, name):
    if IS_SQLITE:
        return conn.execute(text("SELECT name FROM sqlite_master WHERE type='index' AND name=:n"), {"n": name}).fetchone() is not None
    return conn.execute(text("SELECT 1 FROM pg_indexes WHERE indexname=:n"), {"n": name}).fetchone() is not None


def run_migrations():
    try:
        with engine.begin() as conn:
            _ensure_schema_meta(conn)

            # ═══════════════════════════════════════════════════════════════════════════════
            # MIGRACIÓN V32 - WhatsApp + Métodos de pago del Parqueadero
            # ═══════════════════════════════════════════════════════════════════════════════
            migration_v32 = "inv_v32_whatsapp_metodos_pago"
            if not _migration_already_applied(conn, migration_v32):

                # ── 1. metodos_pago_parqueadero ──────────────────────────────
                if not _table_exists(conn, "metodos_pago_parqueadero"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE metodos_pago_parqueadero (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id INTEGER NOT NULL,
                                modalidad TEXT NOT NULL,
                                nombre_metodo TEXT,
                                link_pago TEXT,
                                qr_base64 TEXT,
                                qr_mime_type TEXT,
                                instrucciones TEXT,
                                is_active INTEGER DEFAULT 1,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                UNIQUE(empresa_id, modalidad)
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE metodos_pago_parqueadero (
                                id SERIAL PRIMARY KEY,
                                empresa_id INTEGER NOT NULL,
                                modalidad VARCHAR(20) NOT NULL,
                                nombre_metodo VARCHAR(60),
                                link_pago VARCHAR(500),
                                qr_base64 TEXT,
                                qr_mime_type VARCHAR(40),
                                instrucciones TEXT,
                                is_active BOOLEAN DEFAULT TRUE,
                                created_at TIMESTAMPTZ DEFAULT NOW(),
                                updated_at TIMESTAMPTZ DEFAULT NOW(),
                                UNIQUE(empresa_id, modalidad)
                            )
                        """))
                    if not _index_exists(conn, "idx_metodos_empresa"):
                        conn.execute(text(
                            "CREATE INDEX idx_metodos_empresa ON metodos_pago_parqueadero(empresa_id)"
                        ))

                # ── 2. plantillas_whatsapp ──────────────────────────────────
                if not _table_exists(conn, "plantillas_whatsapp"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE plantillas_whatsapp (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id INTEGER NOT NULL,
                                tipo TEXT NOT NULL,
                                mensaje TEXT NOT NULL,
                                is_active INTEGER DEFAULT 1,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                UNIQUE(empresa_id, tipo)
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE plantillas_whatsapp (
                                id SERIAL PRIMARY KEY,
                                empresa_id INTEGER NOT NULL,
                                tipo VARCHAR(20) NOT NULL,
                                mensaje TEXT NOT NULL,
                                is_active BOOLEAN DEFAULT TRUE,
                                created_at TIMESTAMPTZ DEFAULT NOW(),
                                updated_at TIMESTAMPTZ DEFAULT NOW(),
                                UNIQUE(empresa_id, tipo)
                            )
                        """))
                    if not _index_exists(conn, "idx_plantillas_empresa"):
                        conn.execute(text(
                            "CREATE INDEX idx_plantillas_empresa ON plantillas_whatsapp(empresa_id)"
                        ))

                # ── 3. envios_whatsapp_parqueadero ──────────────────────────
                if not _table_exists(conn, "envios_whatsapp_parqueadero"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE envios_whatsapp_parqueadero (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id INTEGER NOT NULL,
                                vehiculo_id INTEGER,
                                suscripcion_id INTEGER,
                                telefono TEXT NOT NULL,
                                tipo TEXT NOT NULL,
                                mensaje_enviado TEXT,
                                usuario_id INTEGER,
                                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE envios_whatsapp_parqueadero (
                                id SERIAL PRIMARY KEY,
                                empresa_id INTEGER NOT NULL,
                                vehiculo_id INTEGER,
                                suscripcion_id INTEGER,
                                telefono VARCHAR(20) NOT NULL,
                                tipo VARCHAR(20) NOT NULL,
                                mensaje_enviado TEXT,
                                usuario_id INTEGER,
                                fecha TIMESTAMPTZ DEFAULT NOW()
                            )
                        """))
                    if not _index_exists(conn, "idx_envios_fecha"):
                        conn.execute(text(
                            "CREATE INDEX idx_envios_fecha ON envios_whatsapp_parqueadero(empresa_id, fecha)"
                        ))
                    if not _index_exists(conn, "idx_envios_vehiculo"):
                        conn.execute(text(
                            "CREATE INDEX idx_envios_vehiculo ON envios_whatsapp_parqueadero(vehiculo_id)"
                        ))

                _mark_migration_applied(conn, migration_v32)
                logger.info("V32 (WhatsApp + Métodos de pago) aplicada.")
            
            # ═══════════════════════════════════════════════════════════════════════════════
            # MIGRACIÓN V35 - Tarifa por minuto + datos del cliente ocasional
            # ═══════════════════════════════════════════════════════════════════════════════
            migration_v35 = "inv_v35_cobro_minutos_ocasional"
            if not _migration_already_applied(conn, migration_v35):

                # ── 1. parqueadero_config: añadir tarifa_minuto y cobro_minimo ─
                if _table_exists(conn, "parqueadero_config"):
                    if not _column_exists(conn, "parqueadero_config", "tarifa_minuto"):
                        conn.execute(text(
                            "ALTER TABLE parqueadero_config ADD COLUMN tarifa_minuto REAL DEFAULT 0"
                        ))
                    if not _column_exists(conn, "parqueadero_config", "cobro_minimo_minutos"):
                        conn.execute(text(
                            "ALTER TABLE parqueadero_config ADD COLUMN cobro_minimo_minutos INTEGER DEFAULT 30"
                        ))

                # ── 2. accesos_parqueadero: añadir telefono, nombre, minutos ──
                if _table_exists(conn, "accesos_parqueadero"):
                    if not _column_exists(conn, "accesos_parqueadero", "telefono"):
                        if IS_SQLITE:
                            conn.execute(text(
                                "ALTER TABLE accesos_parqueadero ADD COLUMN telefono TEXT"
                            ))
                        else:
                            conn.execute(text(
                                "ALTER TABLE accesos_parqueadero ADD COLUMN telefono VARCHAR(20)"
                            ))
                    if not _column_exists(conn, "accesos_parqueadero", "nombre_ocasional"):
                        if IS_SQLITE:
                            conn.execute(text(
                                "ALTER TABLE accesos_parqueadero ADD COLUMN nombre_ocasional TEXT"
                            ))
                        else:
                            conn.execute(text(
                                "ALTER TABLE accesos_parqueadero ADD COLUMN nombre_ocasional VARCHAR(120)"
                            ))
                    if not _column_exists(conn, "accesos_parqueadero", "minutos_cobrados"):
                        conn.execute(text(
                            "ALTER TABLE accesos_parqueadero ADD COLUMN minutos_cobrados INTEGER"
                        ))

                _mark_migration_applied(conn, migration_v35)
                logger.info("V35 (Cobro por minutos + cliente ocasional) aplicada.")

            # ═══════════════════════════════════════════════════════════════════════════════
            # MIGRACIÓN V36 - ACTUALIZAR ENUM DE POSTGRES (Nuevas plantillas WhatsApp)
            # ═══════════════════════════════════════════════════════════════════════════════
            migration_v36 = "inv_v36_update_enum_whatsapp"
            if not _migration_already_applied(conn, migration_v36):
                if not IS_SQLITE:
                    try:
                        # ALTER TYPE ADD VALUE en Postgres no puede correr en transacciones normales.
                        # Usamos una conexión paralela con autocommit exclusivo para esto.
                        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn_auto:
                            conn_auto.execute(text("ALTER TYPE tipoplantillawhatsapp ADD VALUE IF NOT EXISTS 'comprobante_entrada'"))
                            conn_auto.execute(text("ALTER TYPE tipoplantillawhatsapp ADD VALUE IF NOT EXISTS 'recibo_salida'"))
                    except Exception as e:
                        logger.warning("Aviso al alterar ENUM en Postgres: %s", e)
                
                _mark_migration_applied(conn, migration_v36)
                logger.info("V36 (Actualización Enum Postgres WhatsApp) aplicada.")


            # ═══════════════════════════════════════════════════════════════════════════════
            # MIGRACIÓN V37 - ELIMINAR RESTRICCIÓN ENUM EN POSTGRES (Solución Definitiva)
            # ═══════════════════════════════════════════════════════════════════════════════
            migration_v37 = "inv_v37_enum_to_varchar"
            if not _migration_already_applied(conn, migration_v37):
                if not IS_SQLITE:
                    # Convertimos las columnas de Enum a Texto plano (VARCHAR) en Postgres.
                    # Esto soluciona definitivamente el error "invalid input value for enum"
                    # y permite agregar cualquier plantilla en el futuro sin modificar la BD.
                    try:
                        conn.execute(text("ALTER TABLE plantillas_whatsapp ALTER COLUMN tipo TYPE VARCHAR(255) USING tipo::text;"))
                        conn.execute(text("ALTER TABLE envios_whatsapp_parqueadero ALTER COLUMN tipo TYPE VARCHAR(255) USING tipo::text;"))
                        # (Opcional) Borrar el tipo Enum viejo para limpiar la base de datos
                        conn.execute(text("DROP TYPE IF EXISTS tipoplantillawhatsapp CASCADE;"))
                    except Exception as e:
                        logger.error("Error convirtiendo ENUM a VARCHAR: %s", e)
                
                _mark_migration_applied(conn, migration_v37)
                logger.info("V37 (Conversión de ENUM a VARCHAR en Postgres) aplicada.")

    except Exception as e:
        logger.exception("Error ejecutando migraciones: %s", e)
        raise
