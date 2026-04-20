import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

import models

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

def _index_exists(conn, index_name: str) -> bool:
    if IS_SQLITE:
        row = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='index' AND name=:name"),
            {"name": index_name},
        ).fetchone()
        return row is not None
    else:
        row = conn.execute(
            text("SELECT 1 FROM pg_indexes WHERE indexname = :name"),
            {"name": index_name},
        ).fetchone()
        return row is not None


# ─── Migraciones ──────────────────────────────────────────────────────────────

def run_migrations():
    try:
        with engine.begin() as conn:
            _ensure_schema_meta(conn)

            # =================================================================
            # V18 - MIGRACIÓN MULTI-TENANT (BASE)
            # =================================================================
            migration_v18 = "inv_v18_multitenant"
            if not _migration_already_applied(conn, migration_v18):
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

                conn.execute(text("""
                    INSERT INTO empresas (id, nombre, nit, color_primario)
                    VALUES (1, 'Ksmart360 (Mi Fábrica)', '900000000-1', '#F43F5E')
                    ON CONFLICT DO NOTHING;
                """))

                tablas_tenant = [
                    'users', 'clientes', 'productos', 'inventory_movements',
                    'ventas', 'detalles_venta', 'pagos', 'ordenes_trabajo',
                    'orden_productos', 'orden_servicios', 'evidencias',
                    'notificaciones', 'registros_productividad', 'recetas',
                    'receta_servicios', 'receta_items', 'lotes_produccion',
                    'compras', 'detalles_compra', 'pagos_compra',
                    'devoluciones', 'devolucion_items', 'cortes_caja', 'gastos'
                ]
                for tabla in tablas_tenant:
                    if _table_exists(conn, tabla):
                        _add_column_if_missing(conn, tabla, "empresa_id INTEGER", "empresa_id")
                        conn.execute(text(f"UPDATE {tabla} SET empresa_id = 1 WHERE empresa_id IS NULL;"))

                _mark_migration_applied(conn, migration_v18)
                logger.info("Migración %s aplicada. Multi-tenant listo.", migration_v18)

            # =================================================================
            # V19 - SAAS Y TRIAL PERIODS
            # =================================================================
            migration_v19 = "inv_v20_saas_trial"
            if not _migration_already_applied(conn, migration_v19):
                if _table_exists(conn, "empresas"):
                    _add_column_if_missing(conn, "empresas", "plan_type TEXT DEFAULT 'trial'", "plan_type")
                    if IS_SQLITE:
                        _add_column_if_missing(conn, "empresas", "trial_ends_at TIMESTAMP", "trial_ends_at")
                    else:
                        _add_column_if_missing(conn, "empresas", "trial_ends_at TIMESTAMPTZ", "trial_ends_at")
                    conn.execute(text("UPDATE empresas SET plan_type = 'premium' WHERE id = 1;"))

                _mark_migration_applied(conn, migration_v19)
                logger.info("Migración %s aplicada. Trial y facturación añadidos.", migration_v19)

            # =================================================================
            # V20 - WOMPI (COBRO RECURRENTE)
            # =================================================================
            migration_v20 = "inv_v21_wompi"
            if not _migration_already_applied(conn, migration_v20):
                if _table_exists(conn, "empresas"):
                    _add_column_if_missing(conn, "empresas", "wompi_customer_id TEXT", "wompi_customer_id")
                    _add_column_if_missing(conn, "empresas", "wompi_payment_source_id TEXT", "wompi_payment_source_id")
                _mark_migration_applied(conn, migration_v20)
                logger.info("Migración %s aplicada. Columnas Wompi añadidas.", migration_v20)

            # =================================================================
            # V21 - MÓDULO DE PRÉSTAMOS
            # =================================================================
            migration_v21 = "inv_v22_prestamos"
            if not _migration_already_applied(conn, migration_v21):
                Base.metadata.create_all(bind=engine, tables=[
                    models.Prestamo.__table__,
                    models.CuotaPrestamo.__table__
                ])
                _mark_migration_applied(conn, migration_v21)
                logger.info("Migración %s aplicada. Tablas de préstamos creadas.", migration_v21)

            # =================================================================
            # V22 - MÓDULOS HABILITADOS POR EMPRESA
            # =================================================================
            migration_v22 = "inv_v22_modulos_empresas"
            if not _migration_already_applied(conn, migration_v22):
                _add_column_if_missing(conn, "empresas", "modulos_habilitados TEXT", "modulos_habilitados")
                _mark_migration_applied(conn, migration_v22)
                logger.info("Migración %s aplicada. modulos_habilitados añadido.", migration_v22)

            # =================================================================
            # V23 - ASIGNACIÓN DE COBRADORES A CUOTAS
            # =================================================================
            migration_v23 = "inv_v23_asignacion_cobradores"
            if not _migration_already_applied(conn, migration_v23):
                _add_column_if_missing(conn, "cuotas_prestamo", "usuario_asignado_id INTEGER", "usuario_asignado_id")
                _mark_migration_applied(conn, migration_v23)
                logger.info("Migración %s aplicada. usuario_asignado_id en cuotas.", migration_v23)

            # =================================================================
            # V24 - ASIGNACIÓN DE COBRADORES A LA CABECERA DEL PRÉSTAMO
            # =================================================================
            migration_v24 = "inv_v24_asignacion_cobradores_prestamo"
            if not _migration_already_applied(conn, migration_v24):
                _add_column_if_missing(conn, "prestamos", "usuario_asignado_id INTEGER", "usuario_asignado_id")
                _mark_migration_applied(conn, migration_v24)
                logger.info("Migración %s aplicada. usuario_asignado_id en prestamos.", migration_v24)

            # =================================================================
            # V25 - TASA DE MORA EN PRÉSTAMOS
            # =================================================================
            migration_v25 = "inv_v25_tasa_mora"
            if not _migration_already_applied(conn, migration_v25):
                _add_column_if_missing(conn, "prestamos", "tasa_mora REAL DEFAULT 2.0", "tasa_mora")
                _mark_migration_applied(conn, migration_v25)
                logger.info("Migración %s aplicada. tasa_mora añadida a prestamos.", migration_v25)

            # =================================================================
            # V26 - FASE 1: GESTIÓN DE PERECEDEROS (LOTES Y VENCIMIENTOS)
            # =================================================================
            migration_v26 = "inv_v26_lotes_perecederos"
            if not _migration_already_applied(conn, migration_v26):

                if not _table_exists(conn, "lotes_existencias"):
                    conn.execute(text("""
                        CREATE TABLE lotes_existencias (
                            id                INTEGER PRIMARY KEY AUTOINCREMENT,
                            empresa_id        INTEGER NOT NULL,
                            producto_id       INTEGER NOT NULL,
                            numero_lote       TEXT    NOT NULL,
                            fecha_vencimiento TEXT    NOT NULL,
                            fecha_fabricacion TEXT,
                            cantidad_inicial  REAL    NOT NULL DEFAULT 0,
                            cantidad_actual   REAL    NOT NULL DEFAULT 0,
                            costo_unitario    REAL    NOT NULL DEFAULT 0,
                            proveedor_id      INTEGER,
                            referencia_compra TEXT,
                            observaciones     TEXT,
                            created_at        TEXT    DEFAULT (datetime('now')),
                            UNIQUE(empresa_id, producto_id, numero_lote)
                        )
                    """))
                    logger.info("Tabla 'lotes_existencias' creada.")

                if not _index_exists(conn, "idx_lotes_vencimiento"):
                    conn.execute(text("""
                        CREATE INDEX idx_lotes_vencimiento
                        ON lotes_existencias(empresa_id, fecha_vencimiento)
                    """))

                if not _index_exists(conn, "idx_lotes_producto"):
                    conn.execute(text("""
                        CREATE INDEX idx_lotes_producto
                        ON lotes_existencias(empresa_id, producto_id)
                    """))

                _add_column_if_missing(conn, "inventory_movements", "lote_id INTEGER", "lote_id")
                _add_column_if_missing(conn, "inventory_movements", "numero_lote TEXT", "numero_lote")

                if not _index_exists(conn, "idx_movements_lote"):
                    conn.execute(text("""
                        CREATE INDEX idx_movements_lote ON inventory_movements(lote_id)
                    """))

                # maneja_lotes en productos
                if _table_exists(conn, "productos"):
                    _add_column_if_missing(conn, "productos", "maneja_lotes INTEGER DEFAULT 0", "maneja_lotes")

                _mark_migration_applied(conn, migration_v26)
                logger.info(
                    "Migración %s aplicada. "
                    "Tabla lotes_existencias + índices FEFO + columnas en inventory_movements + maneja_lotes.",
                    migration_v26,
                )

            # =================================================================
            # V27 - FASE 2A: RESOLUCIONES DIAN + NUMERACIÓN CONSECUTIVA
            # =================================================================
            migration_v27 = "inv_v27_resoluciones_dian"
            if not _migration_already_applied(conn, migration_v27):

                # 1. Tabla de resoluciones DIAN
                if not _table_exists(conn, "resoluciones_dian"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE resoluciones_dian (
                                id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id         INTEGER NOT NULL,
                                prefijo            TEXT    DEFAULT '',
                                numero_resolucion  TEXT,
                                numero_actual      INTEGER NOT NULL DEFAULT 0,
                                numero_inicial     INTEGER NOT NULL DEFAULT 1,
                                numero_final       INTEGER NOT NULL DEFAULT 99999999,
                                vigencia_desde     TEXT,
                                vigencia_hasta     TEXT,
                                is_active          INTEGER DEFAULT 0,
                                created_at         TEXT    DEFAULT (datetime('now'))
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE resoluciones_dian (
                                id                 SERIAL PRIMARY KEY,
                                empresa_id         INTEGER NOT NULL,
                                prefijo            TEXT    DEFAULT '',
                                numero_resolucion  TEXT,
                                numero_actual      INTEGER NOT NULL DEFAULT 0,
                                numero_inicial     INTEGER NOT NULL DEFAULT 1,
                                numero_final       INTEGER NOT NULL DEFAULT 99999999,
                                vigencia_desde     DATE,
                                vigencia_hasta     DATE,
                                is_active          BOOLEAN DEFAULT FALSE,
                                created_at         TIMESTAMPTZ DEFAULT NOW()
                            )
                        """))
                    logger.info("Tabla 'resoluciones_dian' creada.")

                # 2. Índice para búsqueda rápida de resolución activa por empresa
                if not _index_exists(conn, "idx_resoluciones_empresa"):
                    conn.execute(text("""
                        CREATE INDEX idx_resoluciones_empresa
                        ON resoluciones_dian(empresa_id, is_active)
                    """))

                # 3. Columnas en ventas para numeración y resolución
                _add_column_if_missing(conn, "ventas", "numero_factura TEXT", "numero_factura")
                _add_column_if_missing(conn, "ventas", "resolucion_id INTEGER", "resolucion_id")

                _mark_migration_applied(conn, migration_v27)
                logger.info(
                    "Migración %s aplicada. "
                    "Tabla resoluciones_dian + numero_factura + resolucion_id en ventas.",
                    migration_v27,
                )

            # =================================================================
            # V28 - FASE 2B: COTIZACIONES / PROFORMAS
            # =================================================================
            migration_v28 = "inv_v28_cotizaciones"
            if not _migration_already_applied(conn, migration_v28):

                # tipo: 'venta' | 'cotizacion'
                _add_column_if_missing(
                    conn, "ventas",
                    "tipo TEXT DEFAULT 'venta'",
                    "tipo"
                )

                # valida_hasta: hasta cuándo es válida la cotización
                if IS_SQLITE:
                    _add_column_if_missing(conn, "ventas", "valida_hasta TIMESTAMP", "valida_hasta")
                else:
                    _add_column_if_missing(conn, "ventas", "valida_hasta TIMESTAMPTZ", "valida_hasta")

                # observaciones: notas internas (útil tanto en ventas como cotizaciones)
                _add_column_if_missing(conn, "ventas", "observaciones TEXT", "observaciones")

                # Garantizar que los registros existentes tengan tipo='venta'
                conn.execute(text("UPDATE ventas SET tipo = 'venta' WHERE tipo IS NULL OR tipo = ''"))

                # Índice para filtrar por tipo rápidamente
                if not _index_exists(conn, "idx_ventas_tipo"):
                    conn.execute(text("""
                        CREATE INDEX idx_ventas_tipo ON ventas(empresa_id, tipo)
                    """))

                _mark_migration_applied(conn, migration_v28)
                logger.info(
                    "Migración %s aplicada. "
                    "Columnas tipo + valida_hasta + observaciones en ventas. Cotizaciones habilitadas.",
                    migration_v28,
                )

    except Exception as e:
        logger.exception("Error ejecutando migraciones en base de datos: %s", e)
        raise
