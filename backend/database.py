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
# MIGRACIÓN V31 - MÓDULO PARQUEADERO
# Pega este bloque DENTRO de run_migrations(), DESPUÉS del V30
# ═══════════════════════════════════════════════════════════════════════════════

            # V31 - PARQUEADERO (Vehículos, Suscripciones, Pagos, Accesos por hora)
            migration_v31 = "inv_v31_parqueadero"
            if not _migration_already_applied(conn, migration_v31):

                # ── 1. parqueadero_config ────────────────────────────────────
                if not _table_exists(conn, "parqueadero_config"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE parqueadero_config (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id INTEGER NOT NULL,
                                tarifa_mensual REAL DEFAULT 0,
                                tarifa_quincenal REAL DEFAULT 0,
                                tarifa_diaria REAL DEFAULT 0,
                                tarifa_hora REAL DEFAULT 0,
                                cupo_total INTEGER DEFAULT 0,
                                nombre_parqueadero TEXT,
                                direccion TEXT,
                                horario_apertura TEXT DEFAULT '06:30',
                                horario_cierre TEXT DEFAULT '20:00',
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                UNIQUE(empresa_id)
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE parqueadero_config (
                                id SERIAL PRIMARY KEY,
                                empresa_id INTEGER NOT NULL,
                                tarifa_mensual REAL DEFAULT 0,
                                tarifa_quincenal REAL DEFAULT 0,
                                tarifa_diaria REAL DEFAULT 0,
                                tarifa_hora REAL DEFAULT 0,
                                cupo_total INTEGER DEFAULT 0,
                                nombre_parqueadero TEXT,
                                direccion TEXT,
                                horario_apertura VARCHAR(5) DEFAULT '06:30',
                                horario_cierre VARCHAR(5) DEFAULT '20:00',
                                created_at TIMESTAMPTZ DEFAULT NOW(),
                                updated_at TIMESTAMPTZ DEFAULT NOW(),
                                UNIQUE(empresa_id)
                            )
                        """))
                    if not _index_exists(conn, "idx_parq_config_empresa"):
                        conn.execute(text(
                            "CREATE INDEX idx_parq_config_empresa ON parqueadero_config(empresa_id)"
                        ))

                # ── 2. vehiculos ─────────────────────────────────────────────
                if not _table_exists(conn, "vehiculos"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE vehiculos (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id INTEGER NOT NULL,
                                placa TEXT NOT NULL,
                                cliente_id INTEGER NOT NULL,
                                marca TEXT,
                                modelo TEXT,
                                color TEXT,
                                foto_url TEXT,
                                observaciones TEXT,
                                is_active INTEGER DEFAULT 1,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                UNIQUE(empresa_id, placa)
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE vehiculos (
                                id SERIAL PRIMARY KEY,
                                empresa_id INTEGER NOT NULL,
                                placa VARCHAR(10) NOT NULL,
                                cliente_id INTEGER NOT NULL,
                                marca VARCHAR(60),
                                modelo VARCHAR(60),
                                color VARCHAR(40),
                                foto_url VARCHAR(255),
                                observaciones TEXT,
                                is_active BOOLEAN DEFAULT TRUE,
                                created_at TIMESTAMPTZ DEFAULT NOW(),
                                UNIQUE(empresa_id, placa)
                            )
                        """))
                    if not _index_exists(conn, "idx_vehiculos_empresa_placa"):
                        conn.execute(text(
                            "CREATE INDEX idx_vehiculos_empresa_placa ON vehiculos(empresa_id, placa)"
                        ))
                    if not _index_exists(conn, "idx_vehiculos_cliente"):
                        conn.execute(text(
                            "CREATE INDEX idx_vehiculos_cliente ON vehiculos(cliente_id)"
                        ))

                # ── 3. suscripciones_parqueadero ─────────────────────────────
                if not _table_exists(conn, "suscripciones_parqueadero"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE suscripciones_parqueadero (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id INTEGER NOT NULL,
                                vehiculo_id INTEGER NOT NULL,
                                tipo TEXT NOT NULL,
                                fecha_inicio DATE NOT NULL,
                                fecha_vencimiento DATE NOT NULL,
                                monto_total REAL NOT NULL,
                                monto_pagado REAL DEFAULT 0,
                                estado_pago TEXT DEFAULT 'pendiente',
                                estado TEXT DEFAULT 'vigente',
                                metodo_pago_inicial TEXT,
                                observaciones TEXT,
                                es_retroactiva INTEGER DEFAULT 0,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE suscripciones_parqueadero (
                                id SERIAL PRIMARY KEY,
                                empresa_id INTEGER NOT NULL,
                                vehiculo_id INTEGER NOT NULL,
                                tipo VARCHAR(20) NOT NULL,
                                fecha_inicio DATE NOT NULL,
                                fecha_vencimiento DATE NOT NULL,
                                monto_total REAL NOT NULL,
                                monto_pagado REAL DEFAULT 0,
                                estado_pago VARCHAR(20) DEFAULT 'pendiente',
                                estado VARCHAR(20) DEFAULT 'vigente',
                                metodo_pago_inicial VARCHAR(40),
                                observaciones TEXT,
                                es_retroactiva BOOLEAN DEFAULT FALSE,
                                created_at TIMESTAMPTZ DEFAULT NOW(),
                                updated_at TIMESTAMPTZ DEFAULT NOW()
                            )
                        """))
                    if not _index_exists(conn, "idx_susc_vehiculo"):
                        conn.execute(text(
                            "CREATE INDEX idx_susc_vehiculo ON suscripciones_parqueadero(vehiculo_id)"
                        ))
                    if not _index_exists(conn, "idx_susc_vencimiento"):
                        conn.execute(text(
                            "CREATE INDEX idx_susc_vencimiento ON suscripciones_parqueadero(empresa_id, fecha_vencimiento)"
                        ))

                # ── 4. pagos_parqueadero ─────────────────────────────────────
                if not _table_exists(conn, "pagos_parqueadero"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE pagos_parqueadero (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id INTEGER NOT NULL,
                                suscripcion_id INTEGER NOT NULL,
                                monto REAL NOT NULL,
                                metodo_pago TEXT NOT NULL,
                                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                observaciones TEXT,
                                usuario_id INTEGER
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE pagos_parqueadero (
                                id SERIAL PRIMARY KEY,
                                empresa_id INTEGER NOT NULL,
                                suscripcion_id INTEGER NOT NULL,
                                monto REAL NOT NULL,
                                metodo_pago VARCHAR(40) NOT NULL,
                                fecha TIMESTAMPTZ DEFAULT NOW(),
                                observaciones VARCHAR(255),
                                usuario_id INTEGER
                            )
                        """))
                    if not _index_exists(conn, "idx_pagos_parq_susc"):
                        conn.execute(text(
                            "CREATE INDEX idx_pagos_parq_susc ON pagos_parqueadero(suscripcion_id)"
                        ))
                    if not _index_exists(conn, "idx_pagos_parq_fecha"):
                        conn.execute(text(
                            "CREATE INDEX idx_pagos_parq_fecha ON pagos_parqueadero(empresa_id, fecha)"
                        ))

                # ── 5. accesos_parqueadero (por horas) ───────────────────────
                if not _table_exists(conn, "accesos_parqueadero"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE accesos_parqueadero (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id INTEGER NOT NULL,
                                vehiculo_id INTEGER,
                                placa TEXT NOT NULL,
                                fecha_entrada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                fecha_salida TIMESTAMP,
                                horas_cobradas REAL,
                                monto_cobrado REAL,
                                metodo_pago TEXT,
                                estado TEXT DEFAULT 'dentro',
                                observaciones TEXT,
                                usuario_id INTEGER
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE accesos_parqueadero (
                                id SERIAL PRIMARY KEY,
                                empresa_id INTEGER NOT NULL,
                                vehiculo_id INTEGER,
                                placa VARCHAR(10) NOT NULL,
                                fecha_entrada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                fecha_salida TIMESTAMPTZ,
                                horas_cobradas REAL,
                                monto_cobrado REAL,
                                metodo_pago VARCHAR(40),
                                estado VARCHAR(20) DEFAULT 'dentro',
                                observaciones VARCHAR(255),
                                usuario_id INTEGER
                            )
                        """))
                    if not _index_exists(conn, "idx_accesos_placa"):
                        conn.execute(text(
                            "CREATE INDEX idx_accesos_placa ON accesos_parqueadero(empresa_id, placa)"
                        ))
                    if not _index_exists(conn, "idx_accesos_estado"):
                        conn.execute(text(
                            "CREATE INDEX idx_accesos_estado ON accesos_parqueadero(empresa_id, estado)"
                        ))

                _mark_migration_applied(conn, migration_v31)
                logger.info("V31 (Parqueadero) aplicada.")


    except Exception as e:
        logger.exception("Error ejecutando migraciones: %s", e)
        raise
