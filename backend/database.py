import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

# ---------------------------------------------------------------------
# Logging básico (puedes integrarlo luego con logging/uvicorn/structlog)
# ---------------------------------------------------------------------
logger = logging.getLogger("database")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------------
# Configuración de conexión
# ---------------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sales.db").strip()

IS_SQLITE = DATABASE_URL.startswith("sqlite")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,
)


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)

Base = declarative_base()

# ---------------------------------------------------------------------
# Helpers para migraciones manuales (sin Alembic)
# ---------------------------------------------------------------------
def _ensure_schema_meta(conn):
    """
    Crea la tabla de control de migraciones si no existe.
    """
    if IS_SQLITE:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS _schema_meta(
                key TEXT PRIMARY KEY,
                value TEXT
            );
        """))
    else:
        # Postgres
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS _schema_meta(
                key TEXT PRIMARY KEY,
                value TEXT
            );
        """))


def _migration_already_applied(conn, key: str) -> bool:
    row = conn.execute(
        text("SELECT value FROM _schema_meta WHERE key = :key"),
        {"key": key},
    ).fetchone()
    return row is not None


def _mark_migration_applied(conn, key: str, value: str = "done"):
    """
    Inserta/actualiza el estado de una migración.
    Compatible con SQLite y Postgres.
    """
    if IS_SQLITE:
        conn.execute(
            text("""
                INSERT INTO _schema_meta(key, value)
                VALUES (:key, :value)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """),
            {"key": key, "value": value},
        )
    else:
        conn.execute(
            text("""
                INSERT INTO _schema_meta(key, value)
                VALUES (:key, :value)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            """),
            {"key": key, "value": value},
        )


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    """
    Verifica si una columna existe en una tabla, soportando SQLite y Postgres.
    """
    if IS_SQLITE:
        rows = conn.execute(text(f"PRAGMA table_info({table_name});")).fetchall()
        return any(r[1] == column_name for r in rows)  # r[1] = name
    else:
        row = conn.execute(
            text("""
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = :table
                  AND column_name = :col
            """),
            {"table": table_name, "col": column_name},
        ).fetchone()
        return row is not None


def _add_column_if_missing(conn, table_name: str, column_sql: str, column_name: str):
    """
    Agrega una columna si no existe.
    `column_sql` debe ser el fragmento SQL para el ALTER (tipo y default incluidos).
    """
    if _column_exists(conn, table_name, column_name):
        logger.info("Migración: columna ya existe: %s.%s", table_name, column_name)
        return

    logger.info("Migración: agregando columna %s.%s", table_name, column_name)
    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_sql}"))


# ---------------------------------------------------------------------
# Migraciones
# ---------------------------------------------------------------------
def run_migrations():
    """
    Migraciones manuales simples.
    Debe llamarse al iniciar la app (idealmente en startup), después de create_all().
    """
    migration_key = "inv_v10"

    try:
        # begin() abre transacción y hace commit automático si todo sale bien
        with engine.begin() as conn:
            _ensure_schema_meta(conn)

            if _migration_already_applied(conn, migration_key):
                logger.info("Migraciones: %s ya aplicada, no se ejecuta de nuevo.", migration_key)
                return

            # --- Tabla Productos ---
            _add_column_if_missing(conn, "productos", "stock_actual REAL DEFAULT 0", "stock_actual")
            _add_column_if_missing(conn, "productos", "stock_minimo REAL DEFAULT 0", "stock_minimo")
            _add_column_if_missing(conn, "productos", "grupo_item INTEGER DEFAULT 2", "grupo_item")

            # --- Tabla Terceros ---
            _add_column_if_missing(conn, "clientes", "es_cliente BOOLEAN DEFAULT 1", "es_cliente")
            _add_column_if_missing(conn, "clientes", "es_proveedor BOOLEAN DEFAULT 0", "es_proveedor")

            # --- Tabla Pagos Compras (Trazabilidad) ---
            _add_column_if_missing(conn, "pagos_compra", "detalle_pago TEXT", "detalle_pago")

            # --- Tabla Receta Servicios (Muchos a Muchos) ---
            if IS_SQLITE:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS receta_servicios (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        receta_id INTEGER REFERENCES recetas(id),
                        servicio_id INTEGER REFERENCES productos(id)
                    );
                """))
            else:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS receta_servicios (
                        id SERIAL PRIMARY KEY,
                        receta_id INTEGER REFERENCES recetas(id),
                        servicio_id INTEGER REFERENCES productos(id)
                    );
                """))

            _mark_migration_applied(conn, migration_key, "done")
            logger.info("Migraciones: %s aplicada correctamente.", migration_key)

    except Exception as e:
        # NO tragar errores: si algo falla, lo ves claro
        logger.exception("Error ejecutando migraciones: %s", e)
        raise
