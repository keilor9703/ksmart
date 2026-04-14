import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger("database")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

# ─── URL de conexión ──────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sales.db").strip()
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

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

# ─── Helpers de migración ─────────────────────────────────────────────────────

def _ensure_schema_meta(conn):
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
    if IS_SQLITE:
        conn.execute(
            text("INSERT INTO _schema_meta(key, value) VALUES (:key, :value) ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
            {"key": key, "value": value},
        )
    else:
        conn.execute(
            text("INSERT INTO _schema_meta(key, value) VALUES (:key, :value) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"),
            {"key": key, "value": value},
        )

def _column_exists(conn, table_name: str, column_name: str) -> bool:
    if IS_SQLITE:
        rows = conn.execute(text(f"PRAGMA table_info({table_name});")).fetchall()
        return any(r[1] == column_name for r in rows)
    else:
        row = conn.execute(
            text("SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :col"),
            {"table": table_name, "col": column_name},
        ).fetchone()
        return row is not None

def _table_exists(conn, table_name: str) -> bool:
    if IS_SQLITE:
        row = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
            {"name": table_name},
        ).fetchone()
        return row is not None
    else:
        row = conn.execute(
            text("SELECT 1 FROM information_schema.tables WHERE table_name=:name"),
            {"name": table_name},
        ).fetchone()
        return row is not None

def _add_column_if_missing(conn, table_name: str, column_sql: str, column_name: str):
    if _column_exists(conn, table_name, column_name):
        logger.info("Columna ya existe: %s.%s", table_name, column_name)
        return
    logger.info("Agregando columna: %s.%s", table_name, column_name)
    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_sql}"))

# ─── Migraciones ─────────────────────────────────────────────────────────────

def run_migrations():
   
    

    migration_key = "MIGRACION 10 - Corte de caja y devoluciones"

    try:
        with engine.begin() as conn:
            _ensure_schema_meta(conn)

            if _migration_already_applied(conn, migration_key):
                logger.info("Migración %s ya aplicada.", migration_key)
                return

            # ── Tabla productos ──────────────────────────────────────────────
            _add_column_if_missing(conn, "productos", "stock_actual REAL DEFAULT 0", "stock_actual")
            _add_column_if_missing(conn, "productos", "stock_minimo REAL DEFAULT 0", "stock_minimo")
            _add_column_if_missing(conn, "productos", "grupo_item INTEGER DEFAULT 2", "grupo_item")

            # ── Tabla clientes (terceros) ────────────────────────────────────
            if IS_SQLITE:
                _add_column_if_missing(conn, "clientes", "es_cliente INTEGER DEFAULT 1", "es_cliente")
                _add_column_if_missing(conn, "clientes", "es_proveedor INTEGER DEFAULT 0", "es_proveedor")
            else:
                _add_column_if_missing(conn, "clientes", "es_cliente BOOLEAN DEFAULT TRUE", "es_cliente")
                _add_column_if_missing(conn, "clientes", "es_proveedor BOOLEAN DEFAULT FALSE", "es_proveedor")

            # ── Tabla ventas ─────────────────────────────────────────────────
            _add_column_if_missing(conn, "ventas", "descuento_total REAL DEFAULT 0", "descuento_total")
            _add_column_if_missing(conn, "ventas", "fecha_pago TIMESTAMP", "fecha_pago")
            _add_column_if_missing(conn, "ventas", "metodo_pago TEXT", "metodo_pago")

            # ── Tablas devoluciones (NUEVAS) ──────────────────────────────────
            if not _table_exists(conn, "devoluciones"):
                if IS_SQLITE:
                    conn.execute(text("""
                        CREATE TABLE devoluciones (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            venta_id INTEGER NOT NULL REFERENCES ventas(id),
                            usuario_id INTEGER REFERENCES users(id),
                            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            motivo TEXT,
                            monto_total REAL DEFAULT 0,
                            tipo TEXT DEFAULT 'parcial',
                            estado TEXT DEFAULT 'confirmada'
                        );
                    """))
                else:
                    conn.execute(text("""
                        CREATE TABLE devoluciones (
                            id SERIAL PRIMARY KEY,
                            venta_id INTEGER NOT NULL REFERENCES ventas(id),
                            usuario_id INTEGER REFERENCES users(id),
                            fecha TIMESTAMPTZ DEFAULT NOW(),
                            motivo TEXT,
                            monto_total REAL DEFAULT 0,
                            tipo TEXT DEFAULT 'parcial',
                            estado TEXT DEFAULT 'confirmada'
                        );
                    """))
                logger.info("Tabla devoluciones creada.")

            if not _table_exists(conn, "devolucion_items"):
                if IS_SQLITE:
                    conn.execute(text("""
                        CREATE TABLE devolucion_items (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            devolucion_id INTEGER NOT NULL REFERENCES devoluciones(id),
                            producto_id INTEGER NOT NULL REFERENCES productos(id),
                            detalle_id INTEGER REFERENCES detalles_venta(id),
                            cantidad REAL NOT NULL,
                            precio_unitario REAL NOT NULL
                        );
                    """))
                else:
                    conn.execute(text("""
                        CREATE TABLE devolucion_items (
                            id SERIAL PRIMARY KEY,
                            devolucion_id INTEGER NOT NULL REFERENCES devoluciones(id),
                            producto_id INTEGER NOT NULL REFERENCES productos(id),
                            detalle_id INTEGER REFERENCES detalles_venta(id),
                            cantidad REAL NOT NULL,
                            precio_unitario REAL NOT NULL
                        );
                    """))
                logger.info("Tabla devolucion_items creada.")
            else:
                # Si la tabla ya existía (versión anterior sin detalle_id), agregar la columna
                _add_column_if_missing(conn, "devolucion_items", "detalle_id INTEGER", "detalle_id")

            # ── Tabla detalles_venta ─────────────────────────────────────────
            _add_column_if_missing(conn, "detalles_venta", "descuento_pct REAL DEFAULT 0", "descuento_pct")

            # ── Tabla pagos (consistencia con pagos_compra) ──────────────────
            _add_column_if_missing(conn, "pagos", "detalle_pago TEXT", "detalle_pago")

            # ── Tabla pagos_compra ───────────────────────────────────────────
            _add_column_if_missing(conn, "pagos_compra", "detalle_pago TEXT", "detalle_pago")

            # ── Tabla notificaciones ─────────────────────────────────────────
            _add_column_if_missing(conn, "notificaciones", "tipo TEXT DEFAULT 'info'", "tipo")

            # ── Tabla receta_servicios ───────────────────────────────────────
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

            # ── Tabla cortes_caja (NUEVA) ────────────────────────────────────
            if not _table_exists(conn, "cortes_caja"):
                if IS_SQLITE:
                    conn.execute(text("""
                        CREATE TABLE cortes_caja (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            usuario_id INTEGER REFERENCES users(id),
                            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            total_efectivo_ventas REAL DEFAULT 0,
                            total_transferencia_ventas REAL DEFAULT 0,
                            total_tarjeta_ventas REAL DEFAULT 0,
                            total_otros_ventas REAL DEFAULT 0,
                            total_ventas_dia REAL DEFAULT 0,
                            efectivo_fisico REAL DEFAULT 0,
                            diferencia REAL DEFAULT 0,
                            observaciones TEXT,
                            estado TEXT DEFAULT 'abierto'
                        );
                    """))
                else:
                    conn.execute(text("""
                        CREATE TABLE cortes_caja (
                            id SERIAL PRIMARY KEY,
                            usuario_id INTEGER REFERENCES users(id),
                            fecha TIMESTAMPTZ DEFAULT NOW(),
                            total_efectivo_ventas REAL DEFAULT 0,
                            total_transferencia_ventas REAL DEFAULT 0,
                            total_tarjeta_ventas REAL DEFAULT 0,
                            total_otros_ventas REAL DEFAULT 0,
                            total_ventas_dia REAL DEFAULT 0,
                            efectivo_fisico REAL DEFAULT 0,
                            diferencia REAL DEFAULT 0,
                            observaciones TEXT,
                            estado TEXT DEFAULT 'abierto'
                        );
                    """))
                logger.info("Tabla cortes_caja creada.")

                # ── Tabla cortes_caja (Actualización) ────────────────────────────
            # Agregamos la columna total_gastos si la tabla ya existe
            if _table_exists(conn, "cortes_caja"):
                _add_column_if_missing(conn, "cortes_caja", "total_gastos REAL DEFAULT 0", "total_gastos")

            # ── Tabla gastos (NUEVA) ─────────────────────────────────────────
            if not _table_exists(conn, "gastos"):
                if IS_SQLITE:
                    conn.execute(text("""
                        CREATE TABLE gastos (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            usuario_id INTEGER REFERENCES users(id),
                            tercero_id INTEGER REFERENCES clientes(id),
                            monto REAL NOT NULL,
                            concepto TEXT,
                            metodo_pago TEXT DEFAULT 'Efectivo',
                            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        );
                    """))
                else:
                    conn.execute(text("""
                        CREATE TABLE gastos (
                            id SERIAL PRIMARY KEY,
                            usuario_id INTEGER REFERENCES users(id),
                            tercero_id INTEGER REFERENCES clientes(id),
                            monto REAL NOT NULL,
                            concepto TEXT,
                            metodo_pago TEXT DEFAULT 'Efectivo',
                            fecha TIMESTAMPTZ DEFAULT NOW()
                        );
                    """))
                logger.info("Tabla gastos creada.")

            # ── Columnas de seguridad — por si la tabla existía con esquema viejo ──
            # (cuando la migración anterior usaba campo 'total' en vez de 'monto_total')
            _add_column_if_missing(conn, "devoluciones", "monto_total REAL DEFAULT 0", "monto_total")
            _add_column_if_missing(conn, "devoluciones", "tipo TEXT DEFAULT 'parcial'", "tipo")
            _add_column_if_missing(conn, "devoluciones", "estado TEXT DEFAULT 'confirmada'", "estado")
            _add_column_if_missing(conn, "devoluciones", "usuario_id INTEGER", "usuario_id")

            _mark_migration_applied(conn, migration_key)
            logger.info("Migración %s aplicada correctamente.", migration_key)

    except Exception as e:
        logger.exception("Error ejecutando migraciones: %s", e)
        raise
