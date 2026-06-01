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

            # V37 - Reparar índice UNIQUE en Roles para SQLite (Multi-tenant)
            migration_v37 = "inv_v37_fix_roles_unique_sqlite"
            if IS_SQLITE and not _migration_already_applied(conn, migration_v37):
                # Asegurar que empresa_id exista en roles antes de crear el índice
                if not _column_exists(conn, "roles", "empresa_id"):
                    conn.execute(text("ALTER TABLE roles ADD COLUMN empresa_id INTEGER REFERENCES empresas(id)"))
                    logger.info("V37: añadido roles.empresa_id")

                if _index_exists(conn, "ix_roles_name"):
                    conn.execute(text("DROP INDEX ix_roles_name"))
                    logger.info("V37: Eliminado índice global ix_roles_name")
                
                if not _index_exists(conn, "uq_role_name_per_empresa"):
                    conn.execute(text(
                        "CREATE UNIQUE INDEX uq_role_name_per_empresa ON roles(name, empresa_id)"
                    ))
                    logger.info("V37: Creado índice multi-tenant uq_role_name_per_empresa")
                
                _mark_migration_applied(conn, migration_v37)
                logger.info("V37 (Fix Roles Unique SQLite) aplicada.")

            # V38 - Añadir código de barras a productos
            migration_v38 = "inv_v38_productos_codigo_barras"
            if not _migration_already_applied(conn, migration_v38):
                if not _column_exists(conn, "productos", "codigo_barras"):
                    if IS_SQLITE:
                        conn.execute(text(
                            "ALTER TABLE productos ADD COLUMN codigo_barras TEXT NULL"
                        ))
                    else:
                        conn.execute(text(
                            "ALTER TABLE productos ADD COLUMN codigo_barras VARCHAR(255) NULL"
                        ))
                    logger.info("V38: añadido productos.codigo_barras")

                if not _index_exists(conn, "ix_productos_codigo_barras"):
                    conn.execute(text(
                        "CREATE INDEX ix_productos_codigo_barras ON productos(codigo_barras)"
                    ))
                    logger.info("V38: creado índice ix_productos_codigo_barras")

                _mark_migration_applied(conn, migration_v38)
                logger.info("V38 (Código de barras a productos) aplicada.")

            # V39 - Añadir descripción a productos
            migration_v39 = "inv_v39_productos_descripcion"
            if not _migration_already_applied(conn, migration_v39):
                if not _column_exists(conn, "productos", "descripcion"):
                    if IS_SQLITE:
                        conn.execute(text(
                            "ALTER TABLE productos ADD COLUMN descripcion TEXT NULL"
                        ))
                    else:
                        conn.execute(text(
                            "ALTER TABLE productos ADD COLUMN descripcion TEXT NULL"
                        ))
                    logger.info("V39: añadido productos.descripcion")

                _mark_migration_applied(conn, migration_v39)
                logger.info("V39 (Descripción a productos) aplicada.")

            # V40 - SaaS Telemetry y Audit Logs (Fase 1)
            migration_v40 = "inv_v40_saas_telemetry_audit"
            if not _migration_already_applied(conn, migration_v40):
                
                # 1. Añadir last_activity_at a empresas
                if not _column_exists(conn, "empresas", "last_activity_at"):
                    if IS_SQLITE:
                        conn.execute(text("ALTER TABLE empresas ADD COLUMN last_activity_at TIMESTAMP NULL"))
                    else:
                        conn.execute(text("ALTER TABLE empresas ADD COLUMN last_activity_at TIMESTAMPTZ NULL"))
                    logger.info("V40: añadido empresas.last_activity_at")

                # 2. Crear tabla saas_audit_logs
                if not _table_exists(conn, "saas_audit_logs"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE saas_audit_logs (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                admin_id INTEGER NOT NULL,
                                empresa_id INTEGER,
                                accion TEXT NOT NULL,
                                detalle TEXT, -- SQLite guarda JSON como texto
                                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY(admin_id) REFERENCES users(id),
                                FOREIGN KEY(empresa_id) REFERENCES empresas(id)
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE saas_audit_logs (
                                id SERIAL PRIMARY KEY,
                                admin_id INTEGER NOT NULL REFERENCES users(id),
                                empresa_id INTEGER REFERENCES empresas(id),
                                accion VARCHAR(100) NOT NULL,
                                detalle JSONB,
                                fecha TIMESTAMPTZ DEFAULT NOW()
                            )
                        """))
                    logger.info("V40: creada tabla saas_audit_logs")

                _mark_migration_applied(conn, migration_v40)
                logger.info("V40 (SaaS Telemetry y Audit) aplicada.")

            # V41 - Índices de performance para SaaS Audit Logs
            migration_v41 = "inv_v41_saas_audit_indices"
            if not _migration_already_applied(conn, migration_v41):
                if not _index_exists(conn, "ix_saas_audit_empresa_id"):
                    conn.execute(text("CREATE INDEX ix_saas_audit_empresa_id ON saas_audit_logs(empresa_id)"))
                    logger.info("V41: creado índice ix_saas_audit_empresa_id")
                
                if not _index_exists(conn, "ix_saas_audit_fecha"):
                    conn.execute(text("CREATE INDEX ix_saas_audit_fecha ON saas_audit_logs(fecha)"))
                    logger.info("V41: creado índice ix_saas_audit_fecha")

                _mark_migration_applied(conn, migration_v41)
                logger.info("V41 (Índices Audit SaaS) aplicada.")

            # V42 - SaaS Phase 2: Communication, Jobs and Protection
            migration_v42 = "inv_v42_saas_comm_jobs_prot"
            if not _migration_already_applied(conn, migration_v42):
                
                # 1. Añadir is_protected a empresas
                if not _column_exists(conn, "empresas", "is_protected"):
                    # Fix for PostgreSQL: use FALSE instead of 0 for BOOLEAN
                    if IS_SQLITE:
                        conn.execute(text("ALTER TABLE empresas ADD COLUMN is_protected BOOLEAN DEFAULT 0"))
                    else:
                        conn.execute(text("ALTER TABLE empresas ADD COLUMN is_protected BOOLEAN DEFAULT FALSE"))
                    logger.info("V42: añadido empresas.is_protected")

                # 2. Crear tabla saas_announcements
                if not _table_exists(conn, "saas_announcements"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE saas_announcements (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                titulo TEXT NOT NULL,
                                mensaje TEXT NOT NULL,
                                tipo TEXT DEFAULT 'info',
                                is_active BOOLEAN DEFAULT 1,
                                expires_at TIMESTAMP,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                created_by INTEGER,
                                FOREIGN KEY(created_by) REFERENCES users(id)
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE saas_announcements (
                                id SERIAL PRIMARY KEY,
                                titulo VARCHAR(100) NOT NULL,
                                mensaje TEXT NOT NULL,
                                tipo VARCHAR(20) DEFAULT 'info',
                                is_active BOOLEAN DEFAULT TRUE,
                                expires_at TIMESTAMPTZ,
                                created_at TIMESTAMPTZ DEFAULT NOW(),
                                created_by INTEGER REFERENCES users(id)
                            )
                        """))
                    logger.info("V42: creada tabla saas_announcements")

                # 3. Crear tabla saas_jobs_registry
                if not _table_exists(conn, "saas_jobs_registry"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE saas_jobs_registry (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                job_name TEXT NOT NULL,
                                execution_id TEXT UNIQUE NOT NULL,
                                status TEXT NOT NULL,
                                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                finished_at TIMESTAMP,
                                metrics TEXT, -- JSON en SQLite
                                error_log TEXT
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE saas_jobs_registry (
                                id SERIAL PRIMARY KEY,
                                job_name VARCHAR(100) NOT NULL,
                                execution_id VARCHAR(100) UNIQUE NOT NULL,
                                status VARCHAR(20) NOT NULL,
                                started_at TIMESTAMPTZ DEFAULT NOW(),
                                finished_at TIMESTAMPTZ,
                                metrics JSONB,
                                error_log TEXT
                            )
                        """))
                    
                    if not _index_exists(conn, "ix_saas_jobs_name"):
                        conn.execute(text("CREATE INDEX ix_saas_jobs_name ON saas_jobs_registry(job_name)"))
                    
                    logger.info("V42: creada tabla saas_jobs_registry")

                _mark_migration_applied(conn, migration_v42)
                logger.info("V42 (SaaS Phase 2 Infrastructure) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V43 - GRUPOS DE PRODUCTO DINÁMICOS (multitenant)
            # ═══════════════════════════════════════════════════════════════

            migration_v43 = "inv_v43_grupos_producto_dinamicos"

            if not _migration_already_applied(conn, migration_v43):

                if not _table_exists(conn, "grupos_producto"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE grupos_producto (
                                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id     INTEGER REFERENCES empresas(id),
                                nombre         VARCHAR(100) NOT NULL,
                                codigo         VARCHAR(20)  NOT NULL,
                                color          VARCHAR(20)  DEFAULT '#94a3b8',
                                es_predefinido BOOLEAN      DEFAULT 0,
                                orden          INTEGER      DEFAULT 99
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE grupos_producto (
                                id             SERIAL PRIMARY KEY,
                                empresa_id     INTEGER REFERENCES empresas(id),
                                nombre         VARCHAR(100) NOT NULL,
                                codigo         VARCHAR(20)  NOT NULL,
                                color          VARCHAR(20)  DEFAULT '#94a3b8',
                                es_predefinido BOOLEAN      DEFAULT FALSE,
                                orden          INTEGER      DEFAULT 99
                            )
                        """))
                    conn.execute(text("CREATE INDEX ix_grupos_producto_empresa ON grupos_producto(empresa_id)"))
                    logger.info("V43: tabla grupos_producto creada")

                # Insertar los 4 grupos predefinidos si no existen (empresa_id NULL)
                existing = conn.execute(
                    text("SELECT COUNT(*) FROM grupos_producto WHERE es_predefinido = :v"),
                    {"v": True if not IS_SQLITE else 1}
                ).scalar()

                if existing == 0:
                    predefinidos = [
                        (1, "Materia Prima",      "MP",  "#3B82F6", 1),
                        (2, "Producto Terminado", "PT",  "#10B981", 2),
                        (3, "Activo Fijo",        "AF",  "#F59E0B", 3),
                        (4, "Insumos",            "INS", "#8B5CF6", 4),
                    ]
                    for gid, nombre, codigo, color, orden in predefinidos:
                        if IS_SQLITE:
                            conn.execute(text("""
                                INSERT INTO grupos_producto(id, empresa_id, nombre, codigo, color, es_predefinido, orden)
                                VALUES(:id, NULL, :nombre, :codigo, :color, 1, :orden)
                            """), {"id": gid, "nombre": nombre, "codigo": codigo, "color": color, "orden": orden})
                        else:
                            conn.execute(text("""
                                INSERT INTO grupos_producto(id, empresa_id, nombre, codigo, color, es_predefinido, orden)
                                VALUES(:id, NULL, :nombre, :codigo, :color, TRUE, :orden)
                                ON CONFLICT (id) DO NOTHING
                            """), {"id": gid, "nombre": nombre, "codigo": codigo, "color": color, "orden": orden})

                    # Resetear la secuencia en PostgreSQL para que el próximo auto-increment sea 5+
                    if not IS_SQLITE:
                        conn.execute(text("SELECT setval('grupos_producto_id_seq', 4, true)"))

                    logger.info("V43: 4 grupos predefinidos insertados")

                _mark_migration_applied(conn, migration_v43)
                logger.info("V43 (grupos de producto dinámicos) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V44 - CATÁLOGO VIRTUAL (Nuevos campos)
            # ═══════════════════════════════════════════════════════════════

            migration_v44 = "inv_v44_catalogo_virtual_fields"
            logger.info("Verificando migración V44...")

            if not _migration_already_applied(conn, migration_v44):
                logger.info("Aplicando migración V44...")
                
                # ── Campos en EMPRESAS ──
                if not _column_exists(conn, "empresas", "slug_catalogo"):
                    conn.execute(text("ALTER TABLE empresas ADD COLUMN slug_catalogo TEXT NULL"))
                    logger.info("V44: añadido empresas.slug_catalogo")
                
                if not _index_exists(conn, "ix_empresas_slug_catalogo"):
                    conn.execute(text("CREATE UNIQUE INDEX ix_empresas_slug_catalogo ON empresas(slug_catalogo)"))
                    logger.info("V44: creado índice UNIQUE ix_empresas_slug_catalogo")

                if not _column_exists(conn, "empresas", "whatsapp_pedidos"):
                    conn.execute(text("ALTER TABLE empresas ADD COLUMN whatsapp_pedidos TEXT NULL"))
                    logger.info("V44: añadido empresas.whatsapp_pedidos")

                if not _column_exists(conn, "empresas", "logo_base64"):
                    conn.execute(text("ALTER TABLE empresas ADD COLUMN logo_base64 TEXT NULL"))
                    logger.info("V44: añadido empresas.logo_base64")

                # ── Campos en PRODUCTOS ──
                if not _column_exists(conn, "productos", "imagenes"):
                    conn.execute(text("ALTER TABLE productos ADD COLUMN imagenes TEXT NULL"))
                    logger.info("V44: añadido productos.imagenes")

                if not _column_exists(conn, "productos", "mostrar_en_catalogo"):
                    if IS_SQLITE:
                        conn.execute(text("ALTER TABLE productos ADD COLUMN mostrar_en_catalogo BOOLEAN DEFAULT 0"))
                    else:
                        conn.execute(text("ALTER TABLE productos ADD COLUMN mostrar_en_catalogo BOOLEAN DEFAULT FALSE"))
                    logger.info("V44: añadido productos.mostrar_en_catalogo")

                if not _index_exists(conn, "ix_productos_mostrar_en_catalogo"):
                    conn.execute(text("CREATE INDEX ix_productos_mostrar_en_catalogo ON productos(mostrar_en_catalogo)"))
                    logger.info("V44: creado índice ix_productos_mostrar_en_catalogo")

                _mark_migration_applied(conn, migration_v44)
                logger.info("V44 (Catálogo Virtual fields) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V45 - FACTURACIÓN ELECTRÓNICA (Campos DIAN)
            # ═══════════════════════════════════════════════════════════════

            migration_v45 = "inv_v45_facturacion_electronica_fields"

            if not _migration_already_applied(conn, migration_v45):
                logger.info("Aplicando migración V45 (Facturación Electrónica)...")
                
                # Campos en EMPRESAS
                new_columns = [
                    ("dv", "TEXT NULL"),
                    ("tipo_organizacion_id", "INTEGER DEFAULT 1"),
                    ("tipo_regimen_id", "INTEGER DEFAULT 48"),
                    ("responsabilidad_fiscal_codes", "TEXT DEFAULT 'O-13'"),
                    ("matricula_mercantil", "TEXT NULL"),
                    ("departamento_code", "TEXT NULL"),
                    ("ciudad_code", "TEXT NULL"),
                    ("correo_facturacion", "TEXT NULL"),
                    ("facturacion_electronica_activa", "BOOLEAN DEFAULT 0" if IS_SQLITE else "BOOLEAN DEFAULT FALSE"),
                    ("matias_api_key", "TEXT NULL"),
                    ("matias_test_mode", "BOOLEAN DEFAULT 1" if IS_SQLITE else "BOOLEAN DEFAULT TRUE")
                ]

                for col_name, col_type in new_columns:
                    if not _column_exists(conn, "empresas", col_name):
                        conn.execute(text(f"ALTER TABLE empresas ADD COLUMN {col_name} {col_type}"))
                        logger.info(f"V45: añadido empresas.{col_name}")

                _mark_migration_applied(conn, migration_v45)
                logger.info("V45 (Facturación Electrónica fields) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V46 - FACTURACIÓN ELECTRÓNICA VENTAS (Campos DIAN)
            # ═══════════════════════════════════════════════════════════════

            migration_v46 = "inv_v46_facturacion_electronica_ventas"

            if not _migration_already_applied(conn, migration_v46):
                logger.info("Aplicando migración V46 (Facturación Electrónica Ventas)...")
                
                # 1. Asegurar tabla resoluciones_dian
                if not _table_exists(conn, "resoluciones_dian"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE resoluciones_dian (
                                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id        INTEGER REFERENCES empresas(id),
                                prefijo           TEXT DEFAULT '',
                                numero_resolucion TEXT,
                                numero_actual     INTEGER DEFAULT 0,
                                numero_inicial    INTEGER DEFAULT 1,
                                numero_final      INTEGER DEFAULT 99999999,
                                vigencia_desde    DATE,
                                vigencia_hasta    DATE,
                                is_active         BOOLEAN DEFAULT 0,
                                created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE resoluciones_dian (
                                id                SERIAL PRIMARY KEY,
                                empresa_id        INTEGER REFERENCES empresas(id),
                                prefijo           VARCHAR(10) DEFAULT '',
                                numero_resolucion VARCHAR(50),
                                numero_actual     INTEGER DEFAULT 0,
                                numero_inicial    INTEGER DEFAULT 1,
                                numero_final      INTEGER DEFAULT 99999999,
                                vigencia_desde    DATE,
                                vigencia_hasta    DATE,
                                is_active         BOOLEAN DEFAULT FALSE,
                                created_at        TIMESTAMPTZ DEFAULT NOW()
                            )
                        """))
                    logger.info("V46: creada tabla resoluciones_dian")

                # 2. Campos en VENTAS
                ventas_columns = [
                    ("numero_factura", "VARCHAR(20) NULL"),
                    ("resolucion_id", "INTEGER NULL REFERENCES resoluciones_dian(id)"),
                    ("cufe", "TEXT NULL"),
                    ("qr_data", "TEXT NULL"),
                    ("xml_url", "TEXT NULL"),
                    ("pdf_url", "TEXT NULL"),
                    ("estado_electronico", "TEXT DEFAULT 'no_enviado'"),
                    ("mensaje_proveedor", "TEXT NULL")
                ]

                for col_name, col_type in ventas_columns:
                    if not _column_exists(conn, "ventas", col_name):
                        # Ajuste para SQLite en tipo de columna si es necesario
                        actual_type = col_type
                        if IS_SQLITE and "VARCHAR" in col_type:
                            actual_type = "TEXT NULL"
                        
                        conn.execute(text(f"ALTER TABLE ventas ADD COLUMN {col_name} {actual_type}"))
                        logger.info(f"V46: añadido ventas.{col_name}")

                if not _index_exists(conn, "ix_ventas_numero_factura"):
                    conn.execute(text("CREATE INDEX ix_ventas_numero_factura ON ventas(numero_factura)"))

                _mark_migration_applied(conn, migration_v46)
                logger.info("V46 (Facturación Electrónica Ventas fields) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V47 - FACTURACIÓN ELECTRÓNICA CLIENTES (Campos DIAN)
            # ═══════════════════════════════════════════════════════════════

            migration_v47 = "inv_v47_facturacion_electronica_clientes"

            if not _migration_already_applied(conn, migration_v47):
                logger.info("Aplicando migración V47 (Facturación Electrónica Clientes)...")
                
                # Campos en CLIENTES
                clientes_columns = [
                    ("email", "TEXT NULL"),
                    ("tipo_documento_id", "INTEGER DEFAULT 13"),
                    ("dv", "TEXT NULL"),
                    ("tipo_organizacion_id", "INTEGER DEFAULT 2"),
                    ("tipo_regimen_id", "INTEGER DEFAULT 49"),
                    ("responsabilidad_fiscal_codes", "TEXT DEFAULT 'R-99-PN'"),
                    ("departamento_code", "TEXT NULL"),
                    ("ciudad_code", "TEXT NULL")
                ]

                for col_name, col_type in clientes_columns:
                    if not _column_exists(conn, "clientes", col_name):
                        conn.execute(text(f"ALTER TABLE clientes ADD COLUMN {col_name} {col_type}"))
                        logger.info(f"V47: añadido clientes.{col_name}")

                _mark_migration_applied(conn, migration_v47)
                logger.info("V47 (Facturación Electrónica Clientes fields) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V48 - REPARAR CLAVE FORÁNEA RESOLUCIONES (Producción Postgres)
            # ═══════════════════════════════════════════════════════════════

            migration_v48 = "inv_v48_fix_resoluciones_fk_postgres"

            if not _migration_already_applied(conn, migration_v48):
                logger.info("Aplicando migración V48 (Reparar FK Resoluciones)...")
                
                # 1. Asegurar columnas faltantes en VENTAS (por si acaso)
                if not _column_exists(conn, "ventas", "numero_factura"):
                    if IS_SQLITE:
                        conn.execute(text("ALTER TABLE ventas ADD COLUMN numero_factura TEXT NULL"))
                    else:
                        conn.execute(text("ALTER TABLE ventas ADD COLUMN numero_factura VARCHAR(20) NULL"))
                    logger.info("V48: añadido ventas.numero_factura")
                
                if not _index_exists(conn, "ix_ventas_numero_factura"):
                    conn.execute(text("CREATE INDEX ix_ventas_numero_factura ON ventas(numero_factura)"))

                if not _column_exists(conn, "ventas", "resolucion_id"):
                    conn.execute(text("ALTER TABLE ventas ADD COLUMN resolucion_id INTEGER NULL"))
                    logger.info("V48: añadido ventas.resolucion_id")

                # 2. Corregir restricción de clave foránea en Postgres
                if not IS_SQLITE:
                    try:
                        # Eliminar la restricción antigua que apunta a 'resoluciones_facturacion'
                        # El log indica que el nombre es 'ventas_resolucion_id_fkey'
                        conn.execute(text("ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_resolucion_id_fkey"))
                        
                        # Crear la nueva restricción apuntando a 'resoluciones_dian'
                        conn.execute(text("""
                            ALTER TABLE ventas 
                            ADD CONSTRAINT ventas_resolucion_id_fkey 
                            FOREIGN KEY (resolucion_id) REFERENCES resoluciones_dian(id)
                        """))
                        logger.info("V48: FK ventas_resolucion_id_fkey redirigida a resoluciones_dian")
                    except Exception as e:
                        logger.warning(f"V48: No se pudo actualizar la FK (posiblemente ya está bien): {e}")

                _mark_migration_applied(conn, migration_v48)
                logger.info("V48 (Reparar FK Resoluciones) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V49 - TABLA DE CHALLENGES BIOMÉTRICOS (WebAuthn Multi-Worker)
            # ═══════════════════════════════════════════════════════════════

            migration_v49 = "inv_v49_biometric_challenges_table"

            if not _migration_already_applied(conn, migration_v49):
                logger.info("Aplicando migración V49 (Tabla de Challenges)...")
                
                if not _table_exists(conn, "biometric_challenges"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE biometric_challenges (
                                key TEXT PRIMARY KEY,
                                challenge TEXT NOT NULL,
                                expires_at REAL NOT NULL
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE biometric_challenges (
                                key VARCHAR(100) PRIMARY KEY,
                                challenge TEXT NOT NULL,
                                expires_at DOUBLE PRECISION NOT NULL
                            )
                        """))
                    
                    if not _index_exists(conn, "ix_biometric_challenges_key"):
                        conn.execute(text("CREATE INDEX ix_biometric_challenges_key ON biometric_challenges(key)"))
                    
                    logger.info("V49: creada tabla biometric_challenges")

                _mark_migration_applied(conn, migration_v49)
                logger.info("V49 (Challenges Biométricos) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V50 - CAMPOS LAVADERO EN VENTAS
            # ═══════════════════════════════════════════════════════════════

            migration_v50 = "inv_v50_lavadero_ventas_campos"
            if not _migration_already_applied(conn, migration_v50):
                if not _column_exists(conn, "ventas", "operador_id"):
                    conn.execute(text("ALTER TABLE ventas ADD COLUMN operador_id INTEGER REFERENCES users(id)"))
                    logger.info("V50: columna operador_id agregada a ventas")

                if not _column_exists(conn, "ventas", "placa_vehiculo"):
                    if IS_SQLITE:
                        conn.execute(text("ALTER TABLE ventas ADD COLUMN placa_vehiculo TEXT NULL"))
                    else:
                        conn.execute(text("ALTER TABLE ventas ADD COLUMN placa_vehiculo VARCHAR(15) NULL"))
                    logger.info("V50: columna placa_vehiculo agregada a ventas")

                _mark_migration_applied(conn, migration_v50)
                logger.info("V50 (campos lavadero en ventas) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V51 - LOGÍSTICA & RUTAS CLIENTES (zona, latitud, longitud)
            # ═══════════════════════════════════════════════════════════════

            migration_v51 = "inv_v51_clientes_logistica_fields"

            if not _migration_already_applied(conn, migration_v51):
                logger.info("Aplicando migración V51 (Logística & Rutas Clientes)...")
                
                # Campos en CLIENTES
                logistica_columns = [
                    ("zona", "TEXT NULL"),
                    ("latitud", "FLOAT NULL"),
                    ("longitud", "FLOAT NULL")
                ]

                for col_name, col_type in logistica_columns:
                    if not _column_exists(conn, "clientes", col_name):
                        conn.execute(text(f"ALTER TABLE clientes ADD COLUMN {col_name} {col_type}"))
                        logger.info(f"V51: añadido clientes.{col_name}")

                if not _index_exists(conn, "ix_clientes_zona"):
                    conn.execute(text("CREATE INDEX ix_clientes_zona ON clientes(zona)"))
                    logger.info("V51: creado índice ix_clientes_zona")

                _mark_migration_applied(conn, migration_v51)
                logger.info("V51 (Logística & Rutas Clientes fields) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V52 - CATEGORÍA EN GASTOS
            # ═══════════════════════════════════════════════════════════════

            migration_v52 = "inv_v52_gastos_categoria_field"

            if not _migration_already_applied(conn, migration_v52):
                logger.info("Aplicando migración V52 (Categoría en Gastos)...")
                
                if not _column_exists(conn, "gastos", "categoria"):
                    if IS_SQLITE:
                        conn.execute(text("ALTER TABLE gastos ADD COLUMN categoria TEXT NULL"))
                    else:
                        conn.execute(text("ALTER TABLE gastos ADD COLUMN categoria VARCHAR(100) NULL"))
                    logger.info("V52: añadido gastos.categoria")

                _mark_migration_applied(conn, migration_v52)
                logger.info("V52 (Categoría en Gastos) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V54 - LAVADERO: tipo_vehiculo en ventas
            # ═══════════════════════════════════════════════════════════════

            migration_v54 = "inv_v54_ventas_tipo_vehiculo"

            if not _migration_already_applied(conn, migration_v54):
                logger.info("Aplicando migración V54 (Lavadero tipo_vehiculo)...")
                if not _column_exists(conn, "ventas", "tipo_vehiculo"):
                    if IS_SQLITE:
                        conn.execute(text("ALTER TABLE ventas ADD COLUMN tipo_vehiculo TEXT NULL"))
                    else:
                        conn.execute(text("ALTER TABLE ventas ADD COLUMN tipo_vehiculo VARCHAR(20) NULL"))
                    logger.info("V54: añadido ventas.tipo_vehiculo")
                _mark_migration_applied(conn, migration_v54)
                logger.info("V54 (Lavadero tipo_vehiculo) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V53 - RESOLUCIONES DIAN: clave_tecnica + nota
            # ═══════════════════════════════════════════════════════════════

            migration_v53 = "inv_v53_resoluciones_dian_extra_fields"

            if not _migration_already_applied(conn, migration_v53):
                logger.info("Aplicando migración V53 (Resoluciones DIAN extra fields)...")

                if not _column_exists(conn, "resoluciones_dian", "clave_tecnica"):
                    if IS_SQLITE:
                        conn.execute(text("ALTER TABLE resoluciones_dian ADD COLUMN clave_tecnica TEXT NULL"))
                    else:
                        conn.execute(text("ALTER TABLE resoluciones_dian ADD COLUMN clave_tecnica VARCHAR(200) NULL"))
                    logger.info("V53: añadido resoluciones_dian.clave_tecnica")

                if not _column_exists(conn, "resoluciones_dian", "nota"):
                    conn.execute(text("ALTER TABLE resoluciones_dian ADD COLUMN nota TEXT NULL"))
                    logger.info("V53: añadido resoluciones_dian.nota")

                _mark_migration_applied(conn, migration_v53)
                logger.info("V53 (Resoluciones DIAN extra fields) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V56 - TABLAS DE IMPUESTOS POR PRODUCTO
            # ═══════════════════════════════════════════════════════════════
            migration_v56 = "inv_v56_tipos_impuesto_producto"
            if not _migration_already_applied(conn, migration_v56):
                logger.info("Aplicando migración V56 (Impuestos por Producto)...")

                if not _table_exists(conn, "tipos_impuesto"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE tipos_impuesto (
                                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id  INTEGER NOT NULL REFERENCES empresas(id),
                                nombre      TEXT NOT NULL,
                                codigo      TEXT NOT NULL,
                                porcentaje  REAL NOT NULL DEFAULT 0.0,
                                descripcion TEXT NULL,
                                is_active   INTEGER NOT NULL DEFAULT 1,
                                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE tipos_impuesto (
                                id          SERIAL PRIMARY KEY,
                                empresa_id  INTEGER NOT NULL REFERENCES empresas(id),
                                nombre      VARCHAR(100) NOT NULL,
                                codigo      VARCHAR(20)  NOT NULL,
                                porcentaje  DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                                descripcion TEXT NULL,
                                is_active   BOOLEAN NOT NULL DEFAULT TRUE,
                                created_at  TIMESTAMPTZ DEFAULT NOW()
                            )
                        """))
                    conn.execute(text("CREATE INDEX ix_tipos_impuesto_empresa ON tipos_impuesto(empresa_id)"))
                    logger.info("V56: creada tabla tipos_impuesto")

                if not _table_exists(conn, "producto_impuestos"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE producto_impuestos (
                                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                                producto_id INTEGER NOT NULL REFERENCES productos(id),
                                impuesto_id INTEGER NOT NULL REFERENCES tipos_impuesto(id),
                                empresa_id  INTEGER NOT NULL REFERENCES empresas(id),
                                UNIQUE(producto_id, empresa_id)
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE producto_impuestos (
                                id          SERIAL PRIMARY KEY,
                                producto_id INTEGER NOT NULL REFERENCES productos(id),
                                impuesto_id INTEGER NOT NULL REFERENCES tipos_impuesto(id),
                                empresa_id  INTEGER NOT NULL REFERENCES empresas(id),
                                UNIQUE(producto_id, empresa_id)
                            )
                        """))
                    conn.execute(text("CREATE INDEX ix_producto_impuestos_empresa ON producto_impuestos(empresa_id)"))
                    logger.info("V56: creada tabla producto_impuestos")

                _mark_migration_applied(conn, migration_v56)
                logger.info("V56 (Impuestos por Producto) aplicada.")

            # V58 - Variantes de productos
            migration_v58 = "inv_v58_producto_variantes"
            if not _migration_already_applied(conn, migration_v58):
                # Add tiene_variantes to productos
                if not _column_exists(conn, "productos", "tiene_variantes"):
                    conn.execute(text("ALTER TABLE productos ADD COLUMN tiene_variantes BOOLEAN NOT NULL DEFAULT 0" if IS_SQLITE else "ALTER TABLE productos ADD COLUMN tiene_variantes BOOLEAN NOT NULL DEFAULT FALSE"))
                    logger.info("V58: añadido productos.tiene_variantes")
                # Create producto_variantes table
                if IS_SQLITE:
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS producto_variantes (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            empresa_id INTEGER NOT NULL,
                            producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
                            sku VARCHAR(100) NOT NULL,
                            nombre VARCHAR(200) NOT NULL,
                            atributos TEXT DEFAULT '{}',
                            precio REAL NULL,
                            costo REAL NULL,
                            stock_actual REAL NOT NULL DEFAULT 0.0,
                            stock_minimo REAL NOT NULL DEFAULT 0.0,
                            activo INTEGER NOT NULL DEFAULT 1
                        )
                    """))
                else:
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS producto_variantes (
                            id SERIAL PRIMARY KEY,
                            empresa_id INTEGER NOT NULL,
                            producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
                            sku VARCHAR(100) NOT NULL,
                            nombre VARCHAR(200) NOT NULL,
                            atributos JSONB DEFAULT '{}',
                            precio FLOAT NULL,
                            costo FLOAT NULL,
                            stock_actual FLOAT NOT NULL DEFAULT 0.0,
                            stock_minimo FLOAT NOT NULL DEFAULT 0.0,
                            activo BOOLEAN NOT NULL DEFAULT TRUE
                        )
                    """))
                logger.info("V58: creada tabla producto_variantes")
                _mark_migration_applied(conn, migration_v58)
                logger.info("V58 (Variantes de productos) aplicada.")

            # V57 - SKU en productos
            migration_v57 = "inv_v57_productos_sku"
            if not _migration_already_applied(conn, migration_v57):
                if not _column_exists(conn, "productos", "sku"):
                    conn.execute(text("ALTER TABLE productos ADD COLUMN sku VARCHAR(100) NULL"))
                    logger.info("V57: añadido productos.sku")
                # Autogenerar SKU para productos existentes que no tienen uno
                if IS_SQLITE:
                    conn.execute(text(
                        "UPDATE productos SET sku = 'P' || printf('%06d', id) WHERE sku IS NULL OR sku = ''"
                    ))
                else:
                    conn.execute(text(
                        "UPDATE productos SET sku = 'P' || LPAD(id::text, 6, '0') WHERE sku IS NULL OR sku = ''"
                    ))
                logger.info("V57: SKUs autogenerados para productos existentes")
                _mark_migration_applied(conn, migration_v57)
                logger.info("V57 (SKU en productos) aplicada.")

            # V55 - PIN de acceso rápido en usuarios
            migration_v55 = "inv_v55_users_pin_fields"
            if not _migration_already_applied(conn, migration_v55):
                for col, typedef_sqlite, typedef_pg in [
                    ("pin_hash",         "TEXT NULL",                    "VARCHAR(128) NULL"),
                    ("pin_attempts",     "INTEGER NOT NULL DEFAULT 0",   "INTEGER NOT NULL DEFAULT 0"),
                    ("pin_locked_until", "TIMESTAMP NULL",               "TIMESTAMPTZ NULL"),
                ]:
                    if not _column_exists(conn, "users", col):
                        typedef = typedef_sqlite if IS_SQLITE else typedef_pg
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {typedef}"))
                        logger.info(f"V55: añadido users.{col}")
                _mark_migration_applied(conn, migration_v55)
                logger.info("V55 (PIN de acceso rápido) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V59 - GRUPOS CON BANDERA requiere_cocina + grupo Platos
            # ═══════════════════════════════════════════════════════════════
            migration_v59 = "inv_v59_grupos_requiere_cocina"
            if not _migration_already_applied(conn, migration_v59):
                # Añadir columna a grupos_producto
                if not _column_exists(conn, "grupos_producto", "requiere_cocina"):
                    if IS_SQLITE:
                        conn.execute(text("ALTER TABLE grupos_producto ADD COLUMN requiere_cocina BOOLEAN NOT NULL DEFAULT 0"))
                    else:
                        conn.execute(text("ALTER TABLE grupos_producto ADD COLUMN requiere_cocina BOOLEAN NOT NULL DEFAULT FALSE"))
                    logger.info("V59: añadida grupos_producto.requiere_cocina")

                # Insertar grupo predefinido id=5 "Platos y Preparados" si no existe
                existe_plato = conn.execute(text("SELECT COUNT(*) FROM grupos_producto WHERE id = 5")).scalar()
                if not existe_plato:
                    if IS_SQLITE:
                        conn.execute(text("""
                            INSERT INTO grupos_producto(id, empresa_id, nombre, codigo, color, es_predefinido, orden, requiere_cocina)
                            VALUES(5, NULL, 'Platos y Preparados', 'PLATO', '#EC4899', 1, 5, 1)
                        """))
                    else:
                        conn.execute(text("""
                            INSERT INTO grupos_producto(id, empresa_id, nombre, codigo, color, es_predefinido, orden, requiere_cocina)
                            VALUES(5, NULL, 'Platos y Preparados', 'PLATO', '#EC4899', TRUE, 5, TRUE)
                            ON CONFLICT (id) DO NOTHING
                        """))
                        conn.execute(text("SELECT setval('grupos_producto_id_seq', 5, true)"))
                    logger.info("V59: grupo predefinido 'Platos y Preparados' (id=5) insertado")

                _mark_migration_applied(conn, migration_v59)
                logger.info("V59 (requiere_cocina en grupos de producto) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V60 - ComandaItem.va_a_cocina
            # ═══════════════════════════════════════════════════════════════
            migration_v60 = "inv_v60_comanda_item_va_a_cocina"
            if not _migration_already_applied(conn, migration_v60):
                if not _column_exists(conn, "restaurante_comanda_items", "va_a_cocina"):
                    if IS_SQLITE:
                        conn.execute(text("ALTER TABLE restaurante_comanda_items ADD COLUMN va_a_cocina BOOLEAN NOT NULL DEFAULT 1"))
                    else:
                        conn.execute(text("ALTER TABLE restaurante_comanda_items ADD COLUMN va_a_cocina BOOLEAN NOT NULL DEFAULT TRUE"))
                    logger.info("V60: añadida restaurante_comanda_items.va_a_cocina")
                _mark_migration_applied(conn, migration_v60)
                logger.info("V60 (va_a_cocina en ítems de comanda) aplicada.")

            # V61 - Módulos de restaurante en tabla modulos
            migration_v61 = "v61_modulos_restaurante"
            if not _migration_already_applied(conn, migration_v61):
                conn.execute(text("""
                    INSERT INTO modulos (name, description, frontend_path)
                    VALUES
                      ('Mapa de Mesas',     'Gestión de mesas y comandas del restaurante.', '/restaurante'),
                      ('Pantalla Cocina',   'Pantalla de órdenes para el área de cocina.',  '/restaurante/cocina'),
                      ('Config Restaurante','Configuración de áreas y mesas.',               '/restaurante/config')
                    ON CONFLICT (frontend_path) DO NOTHING
                """))
                _mark_migration_applied(conn, migration_v61)
                logger.info("V61 (módulos restaurante insertados) aplicada.")

            # V62 - Columnas faltantes en inventory_movements
            migration_v62 = "v62_inventory_movements_columns"
            if not _migration_already_applied(conn, migration_v62):
                conn.execute(text("""
                    ALTER TABLE inventory_movements
                      ADD COLUMN IF NOT EXISTS usuario_id  INTEGER REFERENCES users(id),
                      ADD COLUMN IF NOT EXISTS lote_id     INTEGER REFERENCES lotes_existencias(id),
                      ADD COLUMN IF NOT EXISTS numero_lote VARCHAR(100)
                """))
                _mark_migration_applied(conn, migration_v62)
                logger.info("V62 (inventory_movements: usuario_id, lote_id, numero_lote) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V63 - Integridad de datos: unique bold_tx_id + check constraints
            # ═══════════════════════════════════════════════════════════════
            migration_v63 = "v63_data_integrity_constraints"
            if not _migration_already_applied(conn, migration_v63):
                if not IS_SQLITE:
                    # Unique en bold_tx_id para evitar doble activación de suscripción
                    conn.execute(text("""
                        DO $$
                        BEGIN
                          IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint
                            WHERE conname = 'uq_registros_pagos_bold_tx_id'
                          ) THEN
                            ALTER TABLE registros_pagos
                              ADD CONSTRAINT uq_registros_pagos_bold_tx_id
                              UNIQUE (bold_tx_id);
                          END IF;
                        END $$
                    """))
                    # Check: precio de producto no puede ser negativo
                    conn.execute(text("""
                        DO $$
                        BEGIN
                          IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint
                            WHERE conname = 'ck_productos_precio_nonneg'
                          ) THEN
                            ALTER TABLE productos
                              ADD CONSTRAINT ck_productos_precio_nonneg
                              CHECK (precio IS NULL OR precio >= 0);
                          END IF;
                        END $$
                    """))
                    # Check: total de venta no puede ser negativo
                    conn.execute(text("""
                        DO $$
                        BEGIN
                          IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint
                            WHERE conname = 'ck_ventas_total_nonneg'
                          ) THEN
                            ALTER TABLE ventas
                              ADD CONSTRAINT ck_ventas_total_nonneg
                              CHECK (total >= 0);
                          END IF;
                        END $$
                    """))
                _mark_migration_applied(conn, migration_v63)
                logger.info("V63 (unique bold_tx_id + check constraints precio/total) aplicada.")

            # V64 - Puntos de fidelización + plan is_featured
            migration_v64 = "v64_loyalty_points_plan_featured"
            if not _migration_already_applied(conn, migration_v64):
                conn.execute(text("""
                    ALTER TABLE clientes ADD COLUMN IF NOT EXISTS puntos_fidelidad INTEGER DEFAULT 0;
                """))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS movimientos_puntos (
                        id          SERIAL PRIMARY KEY,
                        empresa_id  INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
                        cliente_id  INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
                        puntos      INTEGER NOT NULL,
                        tipo        VARCHAR(20) NOT NULL,
                        venta_id    INTEGER REFERENCES ventas(id) ON DELETE SET NULL,
                        descripcion VARCHAR(255),
                        created_at  TIMESTAMPTZ DEFAULT NOW()
                    );
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_movimientos_puntos_empresa_cliente
                        ON movimientos_puntos(empresa_id, cliente_id);
                """))
                conn.execute(text("""
                    ALTER TABLE planes_suscripcion
                        ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
                """))
                _mark_migration_applied(conn, migration_v64)
                logger.info("V64 (puntos fidelización + plan is_featured) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V65 - Link de pago POS por empresa
            # ═══════════════════════════════════════════════════════════════
            migration_v65 = "v65_links_pago_empresa"
            if not _migration_already_applied(conn, migration_v65):
                conn.execute(text("""
                    DO $$
                    BEGIN
                      IF NOT EXISTS (
                        SELECT 1 FROM pg_type WHERE typname = 'tipolinkpago'
                      ) THEN
                        CREATE TYPE tipolinkpago AS ENUM ('qr_imagen', 'url');
                      END IF;
                    END $$
                """))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS links_pago_empresa (
                        id            SERIAL PRIMARY KEY,
                        empresa_id    INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
                        nombre        VARCHAR(100) NOT NULL,
                        tipo          tipolinkpago NOT NULL DEFAULT 'url',
                        link_url      VARCHAR(500),
                        qr_base64     TEXT,
                        qr_mime_type  VARCHAR(40),
                        instrucciones TEXT,
                        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
                        created_at    TIMESTAMPTZ DEFAULT NOW(),
                        updated_at    TIMESTAMPTZ DEFAULT NOW()
                    );
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_links_pago_empresa_empresa_id
                        ON links_pago_empresa(empresa_id);
                """))
                _mark_migration_applied(conn, migration_v65)
                logger.info("V65 (links_pago_empresa) aplicada.")

    except Exception as e:
        logger.exception("Error ejecutando migraciones: %s", e)
        raise