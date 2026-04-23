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

# ─── Motor de Migraciones ─────────────────────────────────────────────────────

def run_migrations():
    try:
        with engine.begin() as conn:
            _ensure_schema_meta(conn)

            # Las migraciones V18 a V28 han sido consolidadas/limpiadas del script.
            # SQLAlchemy crea la estructura actual automáticamente mediante Base.metadata.create_all().

            # =================================================================
            # V29 - FASE 2C: MÚLTIPLES IMPUESTOS POR PRODUCTO
            # =================================================================
            migration_v29 = "inv_v29_impuestos_producto"
            if not _migration_already_applied(conn, migration_v29):

                # 🛠️ AUTO-RECUPERACIÓN: Si la tabla se creó rota en un despliegue fallido anterior, la borramos
                if _table_exists(conn, "tipos_impuesto") and not _column_exists(conn, "tipos_impuesto", "codigo"):
                    conn.execute(text("DROP TABLE tipos_impuesto CASCADE" if not IS_SQLITE else "DROP TABLE tipos_impuesto"))
                if _table_exists(conn, "producto_impuestos") and not _column_exists(conn, "producto_impuestos", "empresa_id"):
                    conn.execute(text("DROP TABLE producto_impuestos CASCADE" if not IS_SQLITE else "DROP TABLE producto_impuestos"))

                # 1. Catálogo de tipos de impuesto por empresa
                if not _table_exists(conn, "tipos_impuesto"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE tipos_impuesto (
                                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id  INTEGER NOT NULL,
                                nombre      TEXT    NOT NULL,
                                codigo      TEXT    NOT NULL DEFAULT 'IVA',
                                porcentaje  REAL    NOT NULL DEFAULT 0,
                                descripcion TEXT,
                                is_active   INTEGER DEFAULT 1,
                                created_at  TEXT    DEFAULT (datetime('now')),
                                UNIQUE(empresa_id, codigo)
                            )"""))
                    else:
                        conn.execute(text("""
                            CREATE TABLE tipos_impuesto (
                                id          SERIAL PRIMARY KEY,
                                empresa_id  INTEGER NOT NULL,
                                nombre      TEXT    NOT NULL,
                                codigo      TEXT    NOT NULL DEFAULT 'IVA',
                                porcentaje  REAL    NOT NULL DEFAULT 0,
                                descripcion TEXT,
                                is_active   BOOLEAN DEFAULT TRUE,
                                created_at  TIMESTAMPTZ DEFAULT NOW(),
                                UNIQUE(empresa_id, codigo)
                            )"""))
                    logger.info("Tabla 'tipos_impuesto' creada.")

                # 2. Relación muchos-a-muchos producto ↔ impuesto
                if not _table_exists(conn, "producto_impuestos"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE producto_impuestos (
                                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                                producto_id INTEGER NOT NULL,
                                impuesto_id INTEGER NOT NULL,
                                empresa_id  INTEGER NOT NULL,
                                UNIQUE(producto_id, impuesto_id)
                            )"""))
                    else:
                        conn.execute(text("""
                            CREATE TABLE producto_impuestos (
                                id          SERIAL PRIMARY KEY,
                                producto_id INTEGER NOT NULL,
                                impuesto_id INTEGER NOT NULL,
                                empresa_id  INTEGER NOT NULL,
                                UNIQUE(producto_id, impuesto_id)
                            )"""))
                    logger.info("Tabla 'producto_impuestos' creada.")

                # 3. Índices
                if not _index_exists(conn, "idx_prod_imp_producto"):
                    conn.execute(text("CREATE INDEX idx_prod_imp_producto ON producto_impuestos(producto_id)"))
                if not _index_exists(conn, "idx_prod_imp_empresa"):
                    conn.execute(text("CREATE INDEX idx_prod_imp_empresa ON producto_impuestos(empresa_id)"))
                if not _index_exists(conn, "idx_tipos_imp_empresa"):
                    conn.execute(text("CREATE INDEX idx_tipos_imp_empresa ON tipos_impuesto(empresa_id, is_active)"))

                # 4. Columnas en detalles_venta — snapshot de impuestos al momento de la venta
                _add_column_if_missing(conn, "detalles_venta", "impuesto_total REAL DEFAULT 0", "impuesto_total")
                _add_column_if_missing(conn, "detalles_venta", "impuestos_json TEXT", "impuestos_json")

                # 5. Impuestos predeterminados para empresa 1 (idempotente)
                conn.execute(text("""
                    INSERT INTO tipos_impuesto (empresa_id, nombre, codigo, porcentaje, descripcion)
                    VALUES
                        (1, 'IVA 19%',   'IVA19', 19.0, 'Impuesto al Valor Agregado estándar Colombia'),
                        (1, 'IVA 5%',    'IVA5',   5.0, 'IVA tarifa diferencial'),
                        (1, 'INC 8%',    'INC8',   8.0, 'Impuesto Nacional al Consumo bebidas'),
                        (1, 'INC 16%',   'INC16', 16.0, 'Impuesto Nacional al Consumo restaurantes'),
                        (1, 'Excluido',  'EXC',    0.0, 'Producto excluido de IVA')
                    ON CONFLICT (empresa_id, codigo) DO NOTHING
                """))

                _mark_migration_applied(conn, migration_v29)
                logger.info("Migración V29 aplicada con éxito.")

    except Exception as e:
        logger.exception("Error ejecutando migraciones: %s", e)
        raise
