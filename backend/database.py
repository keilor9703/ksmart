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
    try:
        with engine.begin() as conn:
            _ensure_schema_meta(conn)

            # =================================================================
            # V18 - MIGRACIÓN MULTI-TENANT (BASE)
            # =================================================================
            migration_v18 = "inv_v18_multitenant"
            if not _migration_already_applied(conn, migration_v18):
                # 1. Crear tabla empresas si no existe
                if not _table_exists(conn, "empresas"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE empresas (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                nombre TEXT NOT NULL,
                                nit TEXT,
                                logo_url TEXT,
                                color_primario TEXT DEFAULT '#F43F5E',
                                is_active INTEGER DEFAULT 1,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            );
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE empresas (
                                id SERIAL PRIMARY KEY,
                                nombre TEXT NOT NULL,
                                nit TEXT,
                                logo_url TEXT,
                                color_primario TEXT DEFAULT '#F43F5E',
                                is_active BOOLEAN DEFAULT TRUE,
                                created_at TIMESTAMPTZ DEFAULT NOW()
                            );
                        """))
                    logger.info("Tabla 'empresas' creada.")

                # 2. Insertar la empresa por defecto
                conn.execute(text("""
                    INSERT INTO empresas (id, nombre, nit, color_primario) 
                    VALUES (1, 'Ksmart360 (Mi Fábrica)', '900000000-1', '#F43F5E')
                    ON CONFLICT DO NOTHING;
                """))

                # 3. Lista COMPLETA de tablas que necesitan empresa_id
                tablas_tenant = [
                    'users', 'clientes', 'productos', 'inventory_movements', 
                    'ventas', 'detalles_venta', 'pagos', 'ordenes_trabajo', 
                    'orden_productos', 'orden_servicios', 'evidencias', 
                    'notificaciones', 'registros_productividad', 'recetas', 
                    'receta_servicios', 'receta_items', 'lotes_produccion', 
                    'compras', 'detalles_compra', 'pagos_compra', 
                    'devoluciones', 'devolucion_items', 'cortes_caja', 'gastos'
                ]

                # 4. Agregar la columna empresa_id y actualizar datos huérfanos
                for tabla in tablas_tenant:
                    if _table_exists(conn, tabla):
                        _add_column_if_missing(conn, tabla, "empresa_id INTEGER", "empresa_id")
                        conn.execute(text(f"UPDATE {tabla} SET empresa_id = 1 WHERE empresa_id IS NULL;"))

                _mark_migration_applied(conn, migration_v18)
                logger.info("Migración %s aplicada correctamente. Sistema Multi-tenant listo.", migration_v18)


            # =================================================================
            # V19 - MIGRACIÓN SAAS Y TRIAL PERIODS
            # =================================================================
            migration_v19 = "inv_v20_saas_trial"
            if not _migration_already_applied(conn, migration_v19):
                if _table_exists(conn, "empresas"):
                    
                    # 1. Agregar plan_type a empresas
                    _add_column_if_missing(conn, "empresas", "plan_type TEXT DEFAULT 'trial'", "plan_type")
                    
                    # 2. Agregar trial_ends_at (dependiendo del motor de base de datos)
                    if IS_SQLITE:
                        _add_column_if_missing(conn, "empresas", "trial_ends_at TIMESTAMP", "trial_ends_at")
                    else:
                        _add_column_if_missing(conn, "empresas", "trial_ends_at TIMESTAMPTZ", "trial_ends_at")

                    # 3. BLINDAJE: Hacer que la empresa 1 (SuperAdmin) tenga plan premium de por vida
                    # Esto evita que te auto-bloquees del sistema a los 14 días.
                    conn.execute(text("UPDATE empresas SET plan_type = 'premium' WHERE id = 1;"))

                _mark_migration_applied(conn, migration_v19)
                logger.info("Migración %s aplicada. Campos de Trial y Facturación añadidos.", migration_v19)




                # =================================================================
            # V20 - MIGRACIÓN WOMPI (COBRO RECURRENTE)
            # =================================================================
            migration_v20 = "inv_v21_wompi"
            if not _migration_already_applied(conn, migration_v20):
                if _table_exists(conn, "empresas"):
                    _add_column_if_missing(conn, "empresas", "wompi_customer_id TEXT", "wompi_customer_id")
                    _add_column_if_missing(conn, "empresas", "wompi_payment_source_id TEXT", "wompi_payment_source_id")
                _mark_migration_applied(conn, migration_v20)
                logger.info("Migración %s aplicada. Columnas Wompi añadidas a empresas.", migration_v20)

    except Exception as e:
        logger.exception("Error ejecutando migraciones en base de datos: %s", e)
        raise

  