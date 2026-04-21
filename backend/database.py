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

            # =================================================================
            # V18 - MULTI-TENANT (BASE)
            # =================================================================
            migration_v18 = "inv_v18_multitenant"
            if not _migration_already_applied(conn, migration_v18):
                if not _table_exists(conn, "empresas"):
                    if IS_SQLITE:
                        conn.execute(text("CREATE TABLE empresas (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, nit TEXT, logo_url TEXT, color_primario TEXT DEFAULT '#F43F5E', is_active INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"))
                    else:
                        conn.execute(text("CREATE TABLE empresas (id SERIAL PRIMARY KEY, nombre TEXT NOT NULL, nit TEXT, logo_url TEXT, color_primario TEXT DEFAULT '#F43F5E', is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW());"))
                conn.execute(text("INSERT INTO empresas (id,nombre,nit,color_primario) VALUES (1,'Ksmart360 (Mi Fábrica)','900000000-1','#F43F5E') ON CONFLICT DO NOTHING;"))
                tablas_tenant = ['users','clientes','productos','inventory_movements','ventas','detalles_venta','pagos','ordenes_trabajo','orden_productos','orden_servicios','evidencias','notificaciones','registros_productividad','recetas','receta_servicios','receta_items','lotes_produccion','compras','detalles_compra','pagos_compra','devoluciones','devolucion_items','cortes_caja','gastos']
                for tabla in tablas_tenant:
                    if _table_exists(conn, tabla):
                        _add_column_if_missing(conn, tabla, "empresa_id INTEGER", "empresa_id")
                        conn.execute(text(f"UPDATE {tabla} SET empresa_id=1 WHERE empresa_id IS NULL;"))
                _mark_migration_applied(conn, migration_v18)
                logger.info("V18 aplicada.")

            # =================================================================
            # V19 - SAAS TRIAL
            # =================================================================
            migration_v19 = "inv_v20_saas_trial"
            if not _migration_already_applied(conn, migration_v19):
                if _table_exists(conn, "empresas"):
                    _add_column_if_missing(conn, "empresas", "plan_type TEXT DEFAULT 'trial'", "plan_type")
                    ts_type = "TIMESTAMP" if IS_SQLITE else "TIMESTAMPTZ"
                    _add_column_if_missing(conn, "empresas", f"trial_ends_at {ts_type}", "trial_ends_at")
                    conn.execute(text("UPDATE empresas SET plan_type='premium' WHERE id=1;"))
                _mark_migration_applied(conn, migration_v19)

            # =================================================================
            # V20 - WOMPI
            # =================================================================
            migration_v20 = "inv_v21_wompi"
            if not _migration_already_applied(conn, migration_v20):
                if _table_exists(conn, "empresas"):
                    _add_column_if_missing(conn, "empresas", "wompi_customer_id TEXT", "wompi_customer_id")
                    _add_column_if_missing(conn, "empresas", "wompi_payment_source_id TEXT", "wompi_payment_source_id")
                _mark_migration_applied(conn, migration_v20)

            # =================================================================
            # V21 - PRÉSTAMOS
            # =================================================================
            migration_v21 = "inv_v22_prestamos"
            if not _migration_already_applied(conn, migration_v21):
                Base.metadata.create_all(bind=engine, tables=[models.Prestamo.__table__, models.CuotaPrestamo.__table__])
                _mark_migration_applied(conn, migration_v21)

            # =================================================================
            # V22 - MÓDULOS HABILITADOS
            # =================================================================
            migration_v22 = "inv_v22_modulos_empresas"
            if not _migration_already_applied(conn, migration_v22):
                _add_column_if_missing(conn, "empresas", "modulos_habilitados TEXT", "modulos_habilitados")
                _mark_migration_applied(conn, migration_v22)

            # =================================================================
            # V23 - COBRADORES EN CUOTAS
            # =================================================================
            migration_v23 = "inv_v23_asignacion_cobradores"
            if not _migration_already_applied(conn, migration_v23):
                _add_column_if_missing(conn, "cuotas_prestamo", "usuario_asignado_id INTEGER", "usuario_asignado_id")
                _mark_migration_applied(conn, migration_v23)

            # =================================================================
            # V24 - COBRADORES EN PRÉSTAMOS
            # =================================================================
            migration_v24 = "inv_v24_asignacion_cobradores_prestamo"
            if not _migration_already_applied(conn, migration_v24):
                _add_column_if_missing(conn, "prestamos", "usuario_asignado_id INTEGER", "usuario_asignado_id")
                _mark_migration_applied(conn, migration_v24)

            # =================================================================
            # V25 - TASA MORA
            # =================================================================
            migration_v25 = "inv_v25_tasa_mora"
            if not _migration_already_applied(conn, migration_v25):
                _add_column_if_missing(conn, "prestamos", "tasa_mora REAL DEFAULT 2.0", "tasa_mora")
                _mark_migration_applied(conn, migration_v25)

            # =================================================================
            # V26 - LOTES PERECEDEROS
            # =================================================================
            migration_v26 = "inv_v26_lotes_perecederos"
            if not _migration_already_applied(conn, migration_v26):
                if not _table_exists(conn, "lotes_existencias"):
                    conn.execute(text("""
                        CREATE TABLE lotes_existencias (
                            id INTEGER PRIMARY KEY AUTOINCREMENT, empresa_id INTEGER NOT NULL,
                            producto_id INTEGER NOT NULL, numero_lote TEXT NOT NULL,
                            fecha_vencimiento TEXT NOT NULL, fecha_fabricacion TEXT,
                            cantidad_inicial REAL NOT NULL DEFAULT 0, cantidad_actual REAL NOT NULL DEFAULT 0,
                            costo_unitario REAL NOT NULL DEFAULT 0, proveedor_id INTEGER,
                            referencia_compra TEXT, observaciones TEXT,
                            created_at TEXT DEFAULT (datetime('now')),
                            UNIQUE(empresa_id, producto_id, numero_lote))"""))
                if not _index_exists(conn, "idx_lotes_vencimiento"):
                    conn.execute(text("CREATE INDEX idx_lotes_vencimiento ON lotes_existencias(empresa_id, fecha_vencimiento)"))
                if not _index_exists(conn, "idx_lotes_producto"):
                    conn.execute(text("CREATE INDEX idx_lotes_producto ON lotes_existencias(empresa_id, producto_id)"))
                _add_column_if_missing(conn, "inventory_movements", "lote_id INTEGER", "lote_id")
                _add_column_if_missing(conn, "inventory_movements", "numero_lote TEXT", "numero_lote")
                if not _index_exists(conn, "idx_movements_lote"):
                    conn.execute(text("CREATE INDEX idx_movements_lote ON inventory_movements(lote_id)"))
                if _table_exists(conn, "productos"):
                    _add_column_if_missing(conn, "productos", "maneja_lotes INTEGER DEFAULT 0", "maneja_lotes")
                _mark_migration_applied(conn, migration_v26)
                logger.info("V26 aplicada.")

            # =================================================================
            # V27 - RESOLUCIONES DIAN
            # =================================================================
            migration_v27 = "inv_v27_resoluciones_dian"
            if not _migration_already_applied(conn, migration_v27):
                if not _table_exists(conn, "resoluciones_dian"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE resoluciones_dian (
                                id INTEGER PRIMARY KEY AUTOINCREMENT, empresa_id INTEGER NOT NULL,
                                prefijo TEXT DEFAULT '', numero_resolucion TEXT,
                                numero_actual INTEGER NOT NULL DEFAULT 0,
                                numero_inicial INTEGER NOT NULL DEFAULT 1,
                                numero_final INTEGER NOT NULL DEFAULT 99999999,
                                vigencia_desde TEXT, vigencia_hasta TEXT,
                                is_active INTEGER DEFAULT 0,
                                created_at TEXT DEFAULT (datetime('now')))"""))
                    else:
                        conn.execute(text("""
                            CREATE TABLE resoluciones_dian (
                                id SERIAL PRIMARY KEY, empresa_id INTEGER NOT NULL,
                                prefijo TEXT DEFAULT '', numero_resolucion TEXT,
                                numero_actual INTEGER NOT NULL DEFAULT 0,
                                numero_inicial INTEGER NOT NULL DEFAULT 1,
                                numero_final INTEGER NOT NULL DEFAULT 99999999,
                                vigencia_desde DATE, vigencia_hasta DATE,
                                is_active BOOLEAN DEFAULT FALSE,
                                created_at TIMESTAMPTZ DEFAULT NOW())"""))
                if not _index_exists(conn, "idx_resoluciones_empresa"):
                    conn.execute(text("CREATE INDEX idx_resoluciones_empresa ON resoluciones_dian(empresa_id, is_active)"))
                _add_column_if_missing(conn, "ventas", "numero_factura TEXT", "numero_factura")
                _add_column_if_missing(conn, "ventas", "resolucion_id INTEGER", "resolucion_id")
                _mark_migration_applied(conn, migration_v27)
                logger.info("V27 aplicada.")

            # =================================================================
            # V28 - COTIZACIONES
            # =================================================================
            migration_v28 = "inv_v28_cotizaciones"
            if not _migration_already_applied(conn, migration_v28):
                _add_column_if_missing(conn, "ventas", "tipo TEXT DEFAULT 'venta'", "tipo")
                ts_type = "TIMESTAMP" if IS_SQLITE else "TIMESTAMPTZ"
                _add_column_if_missing(conn, "ventas", f"valida_hasta {ts_type}", "valida_hasta")
                _add_column_if_missing(conn, "ventas", "observaciones TEXT", "observaciones")
                conn.execute(text("UPDATE ventas SET tipo='venta' WHERE tipo IS NULL OR tipo=''"))
                if not _index_exists(conn, "idx_ventas_tipo"):
                    conn.execute(text("CREATE INDEX idx_ventas_tipo ON ventas(empresa_id, tipo)"))
                _mark_migration_applied(conn, migration_v28)
                logger.info("V28 aplicada.")

            # =================================================================
            # V29 - FASE 2C: MÚLTIPLES IMPUESTOS POR PRODUCTO
            # =================================================================
            migration_v29 = "inv_v29_impuestos_producto"
            if not _migration_already_applied(conn, migration_v29):

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
                    conn.execute(text("""
                        CREATE TABLE producto_impuestos (
                            id          INTEGER PRIMARY KEY AUTOINCREMENT,
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
                #    impuesto_total: suma en $ de todos los impuestos de esta línea
                #    impuestos_json: "[{nombre, codigo, porcentaje, monto}, ...]"
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
                        (1, 'Excluido',  'EXC',    0.0, 'Producto excluido de IVA — no genera impuesto')
                    ON CONFLICT DO NOTHING
                """))

                _mark_migration_applied(conn, migration_v29)
                logger.info(
                    "Migración %s aplicada. "
                    "tipos_impuesto + producto_impuestos + "
                    "impuesto_total + impuestos_json en detalles_venta.",
                    migration_v29,
                )

    except Exception as e:
        logger.exception("Error ejecutando migraciones: %s", e)
        raise
