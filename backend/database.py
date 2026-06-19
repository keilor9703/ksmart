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

_engine_kwargs = dict(pool_pre_ping=True, future=True)
if not IS_SQLITE:
    # Con PgBouncer en transaction mode: pool moderado, reciclado frecuente.
    _engine_kwargs.update(
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
    )

engine = create_engine(DATABASE_URL, **_engine_kwargs)
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
                                INSERT INTO grupos_producto(id, empresa_id, nombre, codigo, color, es_predefinido, orden, visible_pos)
                                VALUES(:id, NULL, :nombre, :codigo, :color, 1, :orden, 1)
                            """), {"id": gid, "nombre": nombre, "codigo": codigo, "color": color, "orden": orden})
                        else:
                            conn.execute(text("""
                                INSERT INTO grupos_producto(id, empresa_id, nombre, codigo, color, es_predefinido, orden, visible_pos)
                                VALUES(:id, NULL, :nombre, :codigo, :color, TRUE, :orden, TRUE)
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
                            INSERT INTO grupos_producto(id, empresa_id, nombre, codigo, color, es_predefinido, orden, requiere_cocina, visible_pos)
                            VALUES(5, NULL, 'Platos y Preparaciones', 'PLATO', '#EC4899', 1, 5, 1, 1)
                        """))
                    else:
                        conn.execute(text("""
                            INSERT INTO grupos_producto(id, empresa_id, nombre, codigo, color, es_predefinido, orden, requiere_cocina, visible_pos)
                            VALUES(5, NULL, 'Platos y Preparaciones', 'PLATO', '#EC4899', TRUE, 5, TRUE, TRUE)
                            ON CONFLICT (id) DO NOTHING
                        """))
                        conn.execute(text(
                            "SELECT setval('grupos_producto_id_seq', GREATEST((SELECT MAX(id) FROM grupos_producto), 5), true)"
                        ))
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

            # ═══════════════════════════════════════════════════════════════
            # V66 - Corregir índice cedula: unique → no-unique, vacíos → NULL
            # ═══════════════════════════════════════════════════════════════
            migration_v66 = "v66_fix_clientes_cedula_index"
            if not _migration_already_applied(conn, migration_v66):
                # 1. Normalizar cédulas vacías a NULL para evitar colisiones
                conn.execute(text("""
                    UPDATE clientes SET cedula = NULL WHERE cedula = '';
                """))
                # 2. Eliminar el índice único legacy (si existe)
                conn.execute(text("""
                    DROP INDEX IF EXISTS ix_clientes_cedula;
                """))
                # 3. Recrear como índice simple no-único (cedula puede repetirse entre empresas)
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_clientes_cedula ON clientes(cedula);
                """))
                _mark_migration_applied(conn, migration_v66)
                logger.info("V66 (fix ix_clientes_cedula: unique→non-unique, cedula vacía→NULL) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V67 - Config ventas: omitir_inventario + ítem libre en detalles
            # ═══════════════════════════════════════════════════════════════
            migration_v67 = "v67_empresa_omitir_inventario"
            if not _migration_already_applied(conn, migration_v67):
                conn.execute(text("""
                    ALTER TABLE empresas ADD COLUMN IF NOT EXISTS omitir_inventario BOOLEAN DEFAULT FALSE;
                """))
                conn.execute(text("""
                    ALTER TABLE detalles_venta ADD COLUMN IF NOT EXISTS nombre_libre VARCHAR(200);
                """))
                conn.execute(text("""
                    ALTER TABLE detalles_venta ALTER COLUMN producto_id DROP NOT NULL;
                """))
                _mark_migration_applied(conn, migration_v67)
                logger.info("V67 (empresas.omitir_inventario + detalles_venta.nombre_libre + producto_id nullable) aplicada.")

            migration_v68 = "v68_restaurante_config_imprimir_comanda_auto"
            if not _migration_already_applied(conn, migration_v68):
                conn.execute(text("""
                    ALTER TABLE restaurante_config ADD COLUMN IF NOT EXISTS imprimir_comanda_auto BOOLEAN DEFAULT FALSE;
                """))
                _mark_migration_applied(conn, migration_v68)
                logger.info("V68 (restaurante_config.imprimir_comanda_auto) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V69 - Resincronizar secuencia grupos_producto con MAX(id)
            # V59 hacía setval(..., 5) incluso si ya había filas con id > 5,
            # dejando la secuencia por debajo del máximo real y causando
            # UniqueViolation al crear nuevas categorías personalizadas.
            # ═══════════════════════════════════════════════════════════════
            migration_v69 = "v69_fix_grupos_producto_seq"
            if not _migration_already_applied(conn, migration_v69):
                if not IS_SQLITE:
                    conn.execute(text("""
                        SELECT setval(
                            'grupos_producto_id_seq',
                            GREATEST((SELECT MAX(id) FROM grupos_producto), 5),
                            true
                        )
                    """))
                    logger.info("V69: secuencia grupos_producto_id_seq resincronizada con MAX(id)")
                _mark_migration_applied(conn, migration_v69)
                logger.info("V69 (fix secuencia grupos_producto) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V70 - Soft-delete en productos: columna vigente
            # ═══════════════════════════════════════════════════════════════
            migration_v70 = "v70_productos_vigente"
            if not _migration_already_applied(conn, migration_v70):
                if not _column_exists(conn, "productos", "vigente"):
                    if IS_SQLITE:
                        conn.execute(text("ALTER TABLE productos ADD COLUMN vigente BOOLEAN NOT NULL DEFAULT 1"))
                    else:
                        conn.execute(text("ALTER TABLE productos ADD COLUMN vigente BOOLEAN NOT NULL DEFAULT TRUE"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_productos_vigente ON productos(vigente)"))
                    logger.info("V70: añadida productos.vigente (soft-delete)")
                _mark_migration_applied(conn, migration_v70)
                logger.info("V70 (soft-delete productos) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V71 - visible_pos en grupos + rename "Platos y Preparados"
            # ═══════════════════════════════════════════════════════════════
            migration_v71 = "v71_grupos_visible_pos_y_rename"
            if not _migration_already_applied(conn, migration_v71):
                if not _column_exists(conn, "grupos_producto", "visible_pos"):
                    if IS_SQLITE:
                        conn.execute(text("ALTER TABLE grupos_producto ADD COLUMN visible_pos BOOLEAN NOT NULL DEFAULT 1"))
                    else:
                        conn.execute(text("ALTER TABLE grupos_producto ADD COLUMN visible_pos BOOLEAN NOT NULL DEFAULT TRUE"))
                    logger.info("V71: añadida grupos_producto.visible_pos")

                # Renombrar grupo predefinido id=5
                conn.execute(text(
                    "UPDATE grupos_producto SET nombre = 'Platos y Preparaciones' "
                    "WHERE id = 5 AND nombre = 'Platos y Preparados'"
                ))
                logger.info("V71: grupo id=5 renombrado a 'Platos y Preparaciones'")

                _mark_migration_applied(conn, migration_v71)
                logger.info("V71 (visible_pos + rename Platos) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V72 - empresa_grupo_config: overrides por-empresa de flags
            # ═══════════════════════════════════════════════════════════════
            migration_v72 = "v72_empresa_grupo_config"
            if not _migration_already_applied(conn, migration_v72):
                if not _table_exists(conn, "empresa_grupo_config"):
                    conn.execute(text("""
                        CREATE TABLE empresa_grupo_config (
                            empresa_id INTEGER NOT NULL REFERENCES empresas(id),
                            grupo_id   INTEGER NOT NULL REFERENCES grupos_producto(id),
                            requiere_cocina BOOLEAN,
                            visible_pos     BOOLEAN,
                            PRIMARY KEY (empresa_id, grupo_id)
                        )
                    """))
                    logger.info("V72: tabla empresa_grupo_config creada")
                _mark_migration_applied(conn, migration_v72)
                logger.info("V72 (empresa_grupo_config) aplicada.")

            # V73 - Caja Restaurante: módulo en BD + categorías para restaurantes existentes
            migration_v73 = "v73_caja_restaurante_modulo_y_categorias"
            if not _migration_already_applied(conn, migration_v73):
                # Insertar módulo Caja Restaurante
                conn.execute(text("""
                    INSERT INTO modulos (name, description, frontend_path)
                    VALUES ('Caja Restaurante', 'Panel de cobro de mesas para el cajero.', '/restaurante/caja')
                    ON CONFLICT (frontend_path) DO NOTHING
                """))

                # Seed categorías de restaurante para empresas ya existentes
                _cats = [
                    ("Entradas",            "ENT", "#F97316", 10, True,  True),
                    ("Platos Principales",  "PRI", "#EF4444", 11, True,  True),
                    ("Menú del Día",        "MEN", "#10B981", 12, True,  True),
                    ("Adiciones",           "ADI", "#F59E0B", 13, False, True),
                    ("Postres",             "POS", "#EC4899", 14, True,  True),
                    ("Bebidas sin Alcohol", "BSA", "#06B6D4", 15, False, True),
                    ("Bebidas Alcohólicas", "BAL", "#8B5CF6", 16, False, True),
                ]
                empresas_rest = conn.execute(text(
                    "SELECT id FROM empresas WHERE modulos_habilitados::text LIKE '%/restaurante%'"
                )).fetchall()
                for (emp_id,) in empresas_rest:
                    for nombre, codigo, color, orden, req_cocina, vis_pos in _cats:
                        existe = conn.execute(text(
                            "SELECT 1 FROM grupos_producto WHERE empresa_id = :eid AND codigo = :cod"
                        ), {"eid": emp_id, "cod": codigo}).fetchone()
                        if not existe:
                            conn.execute(text("""
                                INSERT INTO grupos_producto
                                    (empresa_id, nombre, codigo, color, orden,
                                     requiere_cocina, visible_pos, es_predefinido)
                                VALUES
                                    (:eid, :nombre, :codigo, :color, :orden,
                                     :req, :vis, FALSE)
                            """), {
                                "eid": emp_id, "nombre": nombre, "codigo": codigo,
                                "color": color, "orden": orden,
                                "req": req_cocina, "vis": vis_pos,
                            })
                _mark_migration_applied(conn, migration_v73)
                logger.info("V73 (Caja Restaurante: módulo + categorías restaurante) aplicada.")

            # V74 - restaurante_config.mesero_puede_cobrar_directo
            migration_v74 = "v74_restaurante_config_mesero_cobro_directo"
            if not _migration_already_applied(conn, migration_v74):
                conn.execute(text("""
                    ALTER TABLE restaurante_config
                    ADD COLUMN IF NOT EXISTS mesero_puede_cobrar_directo BOOLEAN DEFAULT FALSE;
                """))
                _mark_migration_applied(conn, migration_v74)
                logger.info("V74 (restaurante_config.mesero_puede_cobrar_directo) aplicada.")

            # V75 - restaurante_config.tipo_impresora
            migration_v75 = "v75_restaurante_config_tipo_impresora"
            if not _migration_already_applied(conn, migration_v75):
                conn.execute(text("""
                    ALTER TABLE restaurante_config
                    ADD COLUMN IF NOT EXISTS tipo_impresora VARCHAR(10) DEFAULT 'p80';
                """))
                _mark_migration_applied(conn, migration_v75)
                logger.info("V75 (restaurante_config.tipo_impresora) aplicada.")

            # V76 - parqueadero_config: tipo_impresora_parq + preferir_impresion
            migration_v76 = "v76_parqueadero_config_print_settings"
            if not _migration_already_applied(conn, migration_v76):
                conn.execute(text("""
                    ALTER TABLE parqueadero_config
                    ADD COLUMN IF NOT EXISTS tipo_impresora_parq VARCHAR(10) DEFAULT 'p80';
                """))
                conn.execute(text("""
                    ALTER TABLE parqueadero_config
                    ADD COLUMN IF NOT EXISTS preferir_impresion BOOLEAN DEFAULT FALSE;
                """))
                _mark_migration_applied(conn, migration_v76)
                logger.info("V76 (parqueadero_config print settings) aplicada.")

            # V77 - lavadero ordenes + config + comision_pct en productos
            migration_v77 = "v77_lavadero_ordenes_y_config"
            if not _migration_already_applied(conn, migration_v77):
                if not _table_exists(conn, "lavadero_ordenes"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE lavadero_ordenes (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id INTEGER REFERENCES empresas(id),
                                placa VARCHAR(15) NOT NULL,
                                tipo_vehiculo VARCHAR(20),
                                estado VARCHAR(20) NOT NULL DEFAULT 'recibido',
                                operador_id INTEGER REFERENCES users(id),
                                cliente_id INTEGER REFERENCES clientes(id),
                                observaciones TEXT,
                                fecha_entrada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                fecha_salida TIMESTAMP,
                                total REAL,
                                metodo_pago VARCHAR(50),
                                pagado INTEGER DEFAULT 0,
                                venta_id INTEGER REFERENCES ventas(id)
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE lavadero_ordenes (
                                id SERIAL PRIMARY KEY,
                                empresa_id INTEGER REFERENCES empresas(id),
                                placa VARCHAR(15) NOT NULL,
                                tipo_vehiculo VARCHAR(20),
                                estado VARCHAR(20) NOT NULL DEFAULT 'recibido',
                                operador_id INTEGER REFERENCES users(id),
                                cliente_id INTEGER REFERENCES clientes(id),
                                observaciones TEXT,
                                fecha_entrada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                fecha_salida TIMESTAMPTZ,
                                total REAL,
                                metodo_pago VARCHAR(50),
                                pagado BOOLEAN DEFAULT FALSE,
                                venta_id INTEGER REFERENCES ventas(id)
                            )
                        """))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_lav_orden_empresa ON lavadero_ordenes(empresa_id)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_lav_orden_estado ON lavadero_ordenes(estado)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_lav_orden_placa ON lavadero_ordenes(placa)"))

                if not _table_exists(conn, "lavadero_orden_detalles"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE lavadero_orden_detalles (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id INTEGER REFERENCES empresas(id),
                                orden_id INTEGER NOT NULL REFERENCES lavadero_ordenes(id),
                                producto_id INTEGER REFERENCES productos(id),
                                nombre_servicio VARCHAR(200) NOT NULL,
                                cantidad REAL DEFAULT 1.0,
                                precio_unitario REAL NOT NULL,
                                comision_pct REAL DEFAULT 0.0
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE lavadero_orden_detalles (
                                id SERIAL PRIMARY KEY,
                                empresa_id INTEGER REFERENCES empresas(id),
                                orden_id INTEGER NOT NULL REFERENCES lavadero_ordenes(id),
                                producto_id INTEGER REFERENCES productos(id),
                                nombre_servicio VARCHAR(200) NOT NULL,
                                cantidad REAL DEFAULT 1.0,
                                precio_unitario REAL NOT NULL,
                                comision_pct REAL DEFAULT 0.0
                            )
                        """))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_lav_det_orden ON lavadero_orden_detalles(orden_id)"))

                if not _table_exists(conn, "lavadero_config"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE lavadero_config (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id INTEGER REFERENCES empresas(id),
                                comision_pct_global REAL DEFAULT 30.0,
                                tipo_impresora VARCHAR(10) DEFAULT 'p80',
                                imprimir_recibo INTEGER DEFAULT 1,
                                nombre_lavadero VARCHAR(120),
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE lavadero_config (
                                id SERIAL PRIMARY KEY,
                                empresa_id INTEGER REFERENCES empresas(id),
                                comision_pct_global REAL DEFAULT 30.0,
                                tipo_impresora VARCHAR(10) DEFAULT 'p80',
                                imprimir_recibo BOOLEAN DEFAULT TRUE,
                                nombre_lavadero VARCHAR(120),
                                created_at TIMESTAMPTZ DEFAULT NOW(),
                                updated_at TIMESTAMPTZ DEFAULT NOW()
                            )
                        """))

                if not _column_exists(conn, "productos", "comision_pct"):
                    if IS_SQLITE:
                        conn.execute(text("ALTER TABLE productos ADD COLUMN comision_pct REAL NULL"))
                    else:
                        conn.execute(text("ALTER TABLE productos ADD COLUMN comision_pct REAL NULL"))

                _mark_migration_applied(conn, migration_v77)
                logger.info("V77 (Lavadero ordenes + config) aplicada.")

            # V78 - Configuración dinámica de módulos por tipo de negocio
            migration_v78 = "v78_tipo_negocio_config"
            if not _migration_already_applied(conn, migration_v78):
                if not _table_exists(conn, "tipo_negocio_config"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE tipo_negocio_config (
                                tipo VARCHAR(50) PRIMARY KEY,
                                label VARCHAR(100),
                                modulos JSON NOT NULL
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE tipo_negocio_config (
                                tipo VARCHAR(50) PRIMARY KEY,
                                label VARCHAR(100),
                                modulos JSONB NOT NULL
                            )
                        """))

                # Seed con los perfiles actuales de PERFILES en config.py
                perfiles_seed = [
                    ("erp",         "ERP General",     '["/ventas","/cotizaciones","/admin/resoluciones","/compras","/clientes","/productos","/inventario","/inventario/lotes","/reportes-inventario","/caja","/produccion/recetas","/produccion/lotes","/ordenes-trabajo","/panel-operador","/reportes","/admin/usuarios"]'),
                    ("prestamos",   "Préstamos",        '["/clientes","/prestamos","/ruta-cobro","/caja","/reportes","/admin/usuarios"]'),
                    ("parqueadero", "Parqueadero",      '["/parqueadero","/parqueadero/buscar","/parqueadero/vehiculos","/parqueadero/suscripciones","/parqueadero/config","/clientes","/caja","/reportes","/admin/usuarios"]'),
                    ("lavadero",    "Lavadero",         '["/lavadero/ventas","/lavadero/reporte","/clientes","/productos","/caja","/reportes","/admin/usuarios"]'),
                    ("restaurante", "Restaurante",      '["/restaurante","/restaurante/cocina","/restaurante/config","/restaurante/caja","/ventas","/cotizaciones","/clientes","/productos","/inventario","/inventario/lotes","/reportes-inventario","/compras","/caja","/reportes","/admin/usuarios"]'),
                ]
                for tipo, label, modulos_json in perfiles_seed:
                    if IS_SQLITE:
                        conn.execute(text("""
                            INSERT OR IGNORE INTO tipo_negocio_config(tipo, label, modulos)
                            VALUES(:tipo, :label, :modulos)
                        """), {"tipo": tipo, "label": label, "modulos": modulos_json})
                    else:
                        conn.execute(text("""
                            INSERT INTO tipo_negocio_config(tipo, label, modulos)
                            VALUES(:tipo, :label, CAST(:modulos AS jsonb))
                            ON CONFLICT(tipo) DO NOTHING
                        """), {"tipo": tipo, "label": label, "modulos": modulos_json})

                _mark_migration_applied(conn, migration_v78)
                logger.info("V78 (tipo_negocio_config) aplicada.")

            # V79 - Username único por empresa (multitenancy)
            migration_v79 = "v79_username_unique_per_empresa"
            if not _migration_already_applied(conn, migration_v79):
                if IS_SQLITE:
                    # Drop old global unique index if it exists
                    if _index_exists(conn, "ix_users_username"):
                        conn.execute(text("DROP INDEX ix_users_username"))
                        logger.info("V79: eliminado índice global ix_users_username en SQLite")
                    if not _index_exists(conn, "uq_user_username_empresa"):
                        conn.execute(text(
                            "CREATE UNIQUE INDEX uq_user_username_empresa ON users(username, empresa_id)"
                        ))
                        logger.info("V79: creado índice compuesto uq_user_username_empresa en SQLite")
                else:
                    # PostgreSQL: drop old unique constraint/index, create compound one
                    conn.execute(text("DROP INDEX IF EXISTS ix_users_username"))
                    conn.execute(text(
                        "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key"
                    ))
                    if not _index_exists(conn, "uq_user_username_empresa"):
                        conn.execute(text(
                            "CREATE UNIQUE INDEX uq_user_username_empresa ON users(username, empresa_id)"
                        ))
                        logger.info("V79: creado índice compuesto uq_user_username_empresa en PostgreSQL")
                _mark_migration_applied(conn, migration_v79)
                logger.info("V79 (username único por empresa) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V80 - tipo_negocio en empresas + origen en ventas
            # ═══════════════════════════════════════════════════════════════
            migration_v80 = "v80_tipo_negocio_origen_venta"
            if not _migration_already_applied(conn, migration_v80):
                if not _column_exists(conn, 'empresas', 'tipo_negocio'):
                    conn.execute(text("ALTER TABLE empresas ADD COLUMN tipo_negocio VARCHAR(30) NOT NULL DEFAULT 'erp'"))
                    logger.info("V80: añadido empresas.tipo_negocio")

                if not _column_exists(conn, 'ventas', 'origen'):
                    conn.execute(text("ALTER TABLE ventas ADD COLUMN origen VARCHAR(40) DEFAULT 'erp'"))
                    logger.info("V80: añadido ventas.origen")

                _mark_migration_applied(conn, migration_v80)
                logger.info("V80 (tipo_negocio en empresas + origen en ventas) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V81 - CONTABILIDAD AUTOMÁTICA (PUC colombiano)
            # ═══════════════════════════════════════════════════════════════
            migration_v81 = "v81_contabilidad_automatica"
            if not _migration_already_applied(conn, migration_v81):
                if not _table_exists(conn, "cuentas_contables"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE cuentas_contables (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id INTEGER NOT NULL REFERENCES empresas(id),
                                codigo VARCHAR(10) NOT NULL,
                                nombre VARCHAR(200) NOT NULL,
                                tipo VARCHAR(20) NOT NULL,
                                naturaleza VARCHAR(10) NOT NULL,
                                nivel INTEGER DEFAULT 3,
                                padre_codigo VARCHAR(10),
                                is_active BOOLEAN DEFAULT 1,
                                permite_movimiento BOOLEAN DEFAULT 1,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                UNIQUE(empresa_id, codigo)
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE cuentas_contables (
                                id SERIAL PRIMARY KEY,
                                empresa_id INTEGER NOT NULL REFERENCES empresas(id),
                                codigo VARCHAR(10) NOT NULL,
                                nombre VARCHAR(200) NOT NULL,
                                tipo VARCHAR(20) NOT NULL,
                                naturaleza VARCHAR(10) NOT NULL,
                                nivel INTEGER DEFAULT 3,
                                padre_codigo VARCHAR(10),
                                is_active BOOLEAN DEFAULT TRUE,
                                permite_movimiento BOOLEAN DEFAULT TRUE,
                                created_at TIMESTAMPTZ DEFAULT NOW(),
                                UNIQUE(empresa_id, codigo)
                            )
                        """))
                    logger.info("V81: tabla cuentas_contables creada")

                if not _table_exists(conn, "asientos_contables"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE asientos_contables (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id INTEGER NOT NULL REFERENCES empresas(id),
                                numero INTEGER NOT NULL,
                                fecha TIMESTAMP NOT NULL,
                                descripcion VARCHAR(500) NOT NULL,
                                tipo_origen VARCHAR(30) NOT NULL,
                                referencia_id INTEGER,
                                referencia_tipo VARCHAR(30),
                                total_debitos REAL DEFAULT 0,
                                total_creditos REAL DEFAULT 0,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE asientos_contables (
                                id SERIAL PRIMARY KEY,
                                empresa_id INTEGER NOT NULL REFERENCES empresas(id),
                                numero INTEGER NOT NULL,
                                fecha TIMESTAMPTZ NOT NULL,
                                descripcion VARCHAR(500) NOT NULL,
                                tipo_origen VARCHAR(30) NOT NULL,
                                referencia_id INTEGER,
                                referencia_tipo VARCHAR(30),
                                total_debitos DOUBLE PRECISION DEFAULT 0,
                                total_creditos DOUBLE PRECISION DEFAULT 0,
                                created_at TIMESTAMPTZ DEFAULT NOW()
                            )
                        """))
                    logger.info("V81: tabla asientos_contables creada")

                if not _table_exists(conn, "lineas_asiento"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE lineas_asiento (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id INTEGER NOT NULL REFERENCES empresas(id),
                                asiento_id INTEGER NOT NULL REFERENCES asientos_contables(id),
                                cuenta_contable_id INTEGER NOT NULL REFERENCES cuentas_contables(id),
                                descripcion VARCHAR(300),
                                debito REAL DEFAULT 0,
                                credito REAL DEFAULT 0,
                                orden INTEGER DEFAULT 0
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE lineas_asiento (
                                id SERIAL PRIMARY KEY,
                                empresa_id INTEGER NOT NULL REFERENCES empresas(id),
                                asiento_id INTEGER NOT NULL REFERENCES asientos_contables(id),
                                cuenta_contable_id INTEGER NOT NULL REFERENCES cuentas_contables(id),
                                descripcion VARCHAR(300),
                                debito DOUBLE PRECISION DEFAULT 0,
                                credito DOUBLE PRECISION DEFAULT 0,
                                orden INTEGER DEFAULT 0
                            )
                        """))
                    logger.info("V81: tabla lineas_asiento creada")

                _mark_migration_applied(conn, migration_v81)
                logger.info("V81 (contabilidad automática) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V82 - Registrar módulo Contabilidad en tabla modulos
            # ═══════════════════════════════════════════════════════════════
            migration_v82 = "v82_modulo_contabilidad"
            if not _migration_already_applied(conn, migration_v82):
                conn.execute(text("""
                    INSERT INTO modulos (name, description, frontend_path)
                    VALUES ('Contabilidad', 'Asientos automáticos, estado de resultados, balance general y reportes fiscales.', '/contabilidad')
                    ON CONFLICT (frontend_path) DO NOTHING
                """))
                _mark_migration_applied(conn, migration_v82)
                logger.info("V82 (módulo contabilidad registrado) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V83 - Tabla de cierres contables
            # ═══════════════════════════════════════════════════════════════
            migration_v83 = "v83_cierres_contables"
            if not _migration_already_applied(conn, migration_v83):
                if not _table_exists(conn, "cierres_contables"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE cierres_contables (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id INTEGER NOT NULL REFERENCES empresas(id),
                                periodo_inicio TIMESTAMP NOT NULL,
                                periodo_fin TIMESTAMP NOT NULL,
                                descripcion VARCHAR(300),
                                asiento_id INTEGER REFERENCES asientos_contables(id),
                                utilidad_neta REAL DEFAULT 0,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                created_by_id INTEGER REFERENCES users(id)
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE cierres_contables (
                                id SERIAL PRIMARY KEY,
                                empresa_id INTEGER NOT NULL REFERENCES empresas(id),
                                periodo_inicio TIMESTAMPTZ NOT NULL,
                                periodo_fin TIMESTAMPTZ NOT NULL,
                                descripcion VARCHAR(300),
                                asiento_id INTEGER REFERENCES asientos_contables(id),
                                utilidad_neta DOUBLE PRECISION DEFAULT 0,
                                created_at TIMESTAMPTZ DEFAULT NOW(),
                                created_by_id INTEGER REFERENCES users(id)
                            )
                        """))
                    logger.info("V83: tabla cierres_contables creada")
                _mark_migration_applied(conn, migration_v83)
                logger.info("V83 (cierres contables) aplicada.")

            # V84 - Columna orden en modulos
            migration_v84 = "V84_orden_modulos"
            if not _migration_already_applied(conn, migration_v84):
                if not _column_exists(conn, "modulos", "orden"):
                    conn.execute(text("ALTER TABLE modulos ADD COLUMN orden INTEGER DEFAULT 99"))
                    logger.info("V84: columna orden añadida a modulos")
                # Asignar orden por defecto según frontend_path conocidos
                orden_map = [
                    ("/ventas", 1), ("/pedidos-virtuales", 2), ("/cotizaciones", 3),
                    ("/admin/resoluciones", 4), ("/compras", 5), ("/clientes", 6),
                    ("/productos", 7), ("/inventario", 8), ("/inventario/lotes", 9),
                    ("/caja", 10), ("/produccion/lotes", 11), ("/produccion/recetas", 12),
                    ("/ordenes-trabajo", 13), ("/panel-operador", 14),
                    ("/prestamos", 15), ("/ruta-cobro", 16),
                    ("/reportes", 17), ("/reportes-inventario", 18),
                    ("/contabilidad", 19),
                    ("/parqueadero", 20), ("/parqueadero/buscar", 21),
                    ("/parqueadero/vehiculos", 22), ("/parqueadero/suscripciones", 23),
                    ("/parqueadero/config", 24),
                    ("/lavadero/ventas", 25), ("/lavadero/reporte", 26), ("/lavadero/config", 27),
                    ("/restaurante", 28), ("/restaurante/cocina", 29),
                    ("/restaurante/caja", 30), ("/restaurante/config", 31),
                ]
                for path, ord_val in orden_map:
                    conn.execute(text(
                        "UPDATE modulos SET orden = :o WHERE frontend_path = :p AND (orden IS NULL OR orden = 99)"
                    ), {"o": ord_val, "p": path})
                _mark_migration_applied(conn, migration_v84)
                logger.info("V84 (orden en modulos) aplicada.")

            # V86 - Tarifa plena en parqueadero
            migration_v86 = "v86_parqueadero_tarifa_plena"
            if not _migration_already_applied(conn, migration_v86):
                for col, typedef_sqlite, typedef_pg in [
                    ("usar_tarifa_plena", "BOOLEAN NOT NULL DEFAULT 0", "BOOLEAN NOT NULL DEFAULT FALSE"),
                    ("tarifa_minima",     "REAL NOT NULL DEFAULT 0.0",  "DOUBLE PRECISION NOT NULL DEFAULT 0.0"),
                    ("tarifa_plena",      "REAL NOT NULL DEFAULT 0.0",  "DOUBLE PRECISION NOT NULL DEFAULT 0.0"),
                    ("fraccion_minutos",  "INTEGER NOT NULL DEFAULT 30", "INTEGER NOT NULL DEFAULT 30"),
                ]:
                    if not _column_exists(conn, "parqueadero_config", col):
                        typedef = typedef_sqlite if IS_SQLITE else typedef_pg
                        conn.execute(text(f"ALTER TABLE parqueadero_config ADD COLUMN {col} {typedef}"))
                        logger.info(f"V86: añadido parqueadero_config.{col}")
                _mark_migration_applied(conn, migration_v86)
                logger.info("V86 (parqueadero tarifa plena) aplicada.")

            # V85 - Reservas de restaurante
            migration_v85 = "v85_restaurante_reservas"
            if not _migration_already_applied(conn, migration_v85):
                if not _table_exists(conn, "restaurante_reservas"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE restaurante_reservas (
                                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                                empresa_id     INTEGER NOT NULL REFERENCES empresas(id),
                                mesa_id        INTEGER REFERENCES restaurante_mesas(id),
                                nombre_cliente VARCHAR(120) NOT NULL,
                                telefono       VARCHAR(30),
                                fecha          DATE NOT NULL,
                                hora           VARCHAR(10) NOT NULL,
                                personas       INTEGER DEFAULT 2,
                                notas          TEXT,
                                estado         VARCHAR(20) NOT NULL DEFAULT 'pendiente',
                                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE restaurante_reservas (
                                id             SERIAL PRIMARY KEY,
                                empresa_id     INTEGER NOT NULL REFERENCES empresas(id),
                                mesa_id        INTEGER REFERENCES restaurante_mesas(id),
                                nombre_cliente VARCHAR(120) NOT NULL,
                                telefono       VARCHAR(30),
                                fecha          DATE NOT NULL,
                                hora           VARCHAR(10) NOT NULL,
                                personas       INTEGER DEFAULT 2,
                                notas          TEXT,
                                estado         VARCHAR(20) NOT NULL DEFAULT 'pendiente',
                                created_at     TIMESTAMPTZ DEFAULT NOW()
                            )
                        """))
                    conn.execute(text("CREATE INDEX ix_restaurante_reservas_empresa ON restaurante_reservas(empresa_id)"))
                    conn.execute(text("CREATE INDEX ix_restaurante_reservas_fecha ON restaurante_reservas(empresa_id, fecha)"))
                    logger.info("V85: tabla restaurante_reservas creada")

                # Insertar módulos nuevos si no existen
                for path, name, desc in [
                    ("/restaurante/reservas",  "Reservas",          "Gestión de reservas del restaurante."),
                    ("/restaurante/reportes",  "Reportes Restaurante", "Reportes de ventas del restaurante."),
                ]:
                    conn.execute(text("""
                        INSERT INTO modulos (name, description, frontend_path)
                        VALUES (:n, :d, :p)
                        ON CONFLICT (frontend_path) DO NOTHING
                    """), {"n": name, "d": desc, "p": path})

                _mark_migration_applied(conn, migration_v85)
                logger.info("V85 (restaurante_reservas + módulos) aplicada.")

            # V87 - variante_id y nombre_variante en detalles_venta
            migration_v87 = "v87_detalle_venta_variante"
            if not _migration_already_applied(conn, migration_v87):
                if not _column_exists(conn, "detalles_venta", "variante_id"):
                    if IS_SQLITE:
                        conn.execute(text(
                            "ALTER TABLE detalles_venta ADD COLUMN variante_id INTEGER REFERENCES producto_variantes(id)"
                        ))
                    else:
                        conn.execute(text(
                            "ALTER TABLE detalles_venta ADD COLUMN variante_id INTEGER REFERENCES producto_variantes(id) ON DELETE SET NULL"
                        ))
                    logger.info("V87: añadido detalles_venta.variante_id")

                if not _column_exists(conn, "detalles_venta", "nombre_variante"):
                    conn.execute(text(
                        "ALTER TABLE detalles_venta ADD COLUMN nombre_variante VARCHAR(200) NULL"
                    ))
                    logger.info("V87: añadido detalles_venta.nombre_variante")

                _mark_migration_applied(conn, migration_v87)
                logger.info("V87 (variante en detalles_venta) aplicada.")

            migration_v88 = "v88_venta_puntos_fidelizacion"
            if not _migration_already_applied(conn, migration_v88):
                for col, tipo in [("descuento_puntos", "FLOAT DEFAULT 0"), ("puntos_canjeados", "INTEGER DEFAULT 0")]:
                    try:
                        conn.execute(text(f"ALTER TABLE ventas ADD COLUMN {col} {tipo}"))
                        logger.info(f"V88: añadido ventas.{col}")
                    except Exception:
                        pass
                _mark_migration_applied(conn, migration_v88)
                logger.info("V88 (puntos fidelización en ventas) aplicada.")

            # ═══════════════════════════════════════════════════════════════
            # V89 - Compras: ítems libres + sort_order + grupo Envases
            # ═══════════════════════════════════════════════════════════════
            migration_v89 = "v89_compras_items_libres_sort_order"
            if not _migration_already_applied(conn, migration_v89):
                # Hacer producto_id nullable en detalles_compra
                if not IS_SQLITE:
                    conn.execute(text("""
                        ALTER TABLE detalles_compra
                            ALTER COLUMN producto_id DROP NOT NULL
                    """))
                # nombre_libre para ítems de única vez
                if not _column_exists(conn, "detalles_compra", "nombre_libre"):
                    if IS_SQLITE:
                        conn.execute(text("ALTER TABLE detalles_compra ADD COLUMN nombre_libre TEXT NULL"))
                    else:
                        conn.execute(text("ALTER TABLE detalles_compra ADD COLUMN nombre_libre VARCHAR(200) NULL"))
                    logger.info("V89: añadido detalles_compra.nombre_libre")

                # sort_order para preservar orden de ingreso
                if not _column_exists(conn, "detalles_compra", "sort_order"):
                    conn.execute(text("ALTER TABLE detalles_compra ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"))
                    logger.info("V89: añadido detalles_compra.sort_order")

                # Insertar grupo predefinido id=6 "Envases/Empaque" si no existe
                existe_env = conn.execute(text("SELECT COUNT(*) FROM grupos_producto WHERE id = 6")).scalar()
                if not existe_env:
                    if IS_SQLITE:
                        conn.execute(text("""
                            INSERT INTO grupos_producto(id, empresa_id, nombre, codigo, color, es_predefinido, orden, requiere_cocina, visible_pos)
                            VALUES(6, NULL, 'Envases/Empaque', 'ENV', '#14B8A6', 1, 6, 0, 0)
                        """))
                    else:
                        conn.execute(text("""
                            INSERT INTO grupos_producto(id, empresa_id, nombre, codigo, color, es_predefinido, orden, requiere_cocina, visible_pos)
                            VALUES(6, NULL, 'Envases/Empaque', 'ENV', '#14B8A6', TRUE, 6, FALSE, FALSE)
                            ON CONFLICT (id) DO NOTHING
                        """))
                        conn.execute(text(
                            "SELECT setval('grupos_producto_id_seq', GREATEST((SELECT MAX(id) FROM grupos_producto), 6), true)"
                        ))
                    logger.info("V89: grupo predefinido 'Envases/Empaque' (id=6) insertado")

                _mark_migration_applied(conn, migration_v89)
                logger.info("V89 (ítems libres en compras + sort_order + grupo Envases) aplicada.")

            # ── V90: planes privados por empresa ──────────────────────────────
            migration_v90 = "v90_planes_empresa_exclusivo"
            if not _migration_already_applied(conn, migration_v90):
                conn.execute(text("""
                    ALTER TABLE planes_suscripcion
                    ADD COLUMN IF NOT EXISTS empresa_id_exclusivo INTEGER
                    REFERENCES empresas(id) ON DELETE SET NULL
                """))
                _mark_migration_applied(conn, migration_v90)
                logger.info("V90 (planes privados por empresa) aplicada.")

            # ── V91: descripción pública de la empresa (catálogo virtual) ──────
            migration_v91 = "v91_empresa_descripcion_catalogo"
            if not _migration_already_applied(conn, migration_v91):
                conn.execute(text("ALTER TABLE empresas ADD COLUMN IF NOT EXISTS descripcion TEXT"))
                _mark_migration_applied(conn, migration_v91)
                logger.info("V91 (empresa.descripcion para catálogo) aplicada.")

            # ── V92: tabla intentos_fe para auditoría de emisión FE ──────────
            migration_v92 = "v92_intentos_fe"
            if not _migration_already_applied(conn, migration_v92):
                if not _table_exists(conn, "intentos_fe"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE intentos_fe (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
                                empresa_id INTEGER NOT NULL,
                                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                estado VARCHAR(20),
                                payload_enviado TEXT,
                                respuesta_recibida TEXT,
                                cufe VARCHAR(200),
                                mensaje TEXT
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE intentos_fe (
                                id SERIAL PRIMARY KEY,
                                venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
                                empresa_id INTEGER NOT NULL,
                                timestamp TIMESTAMPTZ DEFAULT NOW(),
                                estado VARCHAR(20),
                                payload_enviado TEXT,
                                respuesta_recibida TEXT,
                                cufe VARCHAR(200),
                                mensaje TEXT
                            )
                        """))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_intentos_fe_venta ON intentos_fe(venta_id)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_intentos_fe_empresa ON intentos_fe(empresa_id)"))
                    logger.info("V92: tabla intentos_fe creada.")
                _mark_migration_applied(conn, migration_v92)
                logger.info("V92 (intentos_fe — auditoría FE) aplicada.")

            # ── V93: columna matias_sandbox_api_key en empresas ──────────────
            migration_v93 = "v93_matias_sandbox_api_key"
            if not _migration_already_applied(conn, migration_v93):
                conn.execute(text(
                    "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS matias_sandbox_api_key TEXT NULL"
                ))
                _mark_migration_applied(conn, migration_v93)
                logger.info("V93 (empresas.matias_sandbox_api_key) aplicada.")

            # ── V94: producción avanzada (merma_pct, rendimiento_esperado, costo breakdown) ──
            migration_v94 = "v94_produccion_avanzada"
            if not _migration_already_applied(conn, migration_v94):
                sqls = [
                    "ALTER TABLE receta_items ADD COLUMN IF NOT EXISTS merma_pct FLOAT DEFAULT 0.0",
                    "ALTER TABLE receta_servicios ADD COLUMN IF NOT EXISTS cantidad FLOAT DEFAULT 1.0",
                    "ALTER TABLE recetas ADD COLUMN IF NOT EXISTS rendimiento_esperado FLOAT DEFAULT 1.0",
                    "ALTER TABLE recetas ADD COLUMN IF NOT EXISTS notas_tecnicas TEXT",
                    "ALTER TABLE lotes_produccion ADD COLUMN IF NOT EXISTS numero_lote_produccion VARCHAR(100)",
                    "ALTER TABLE lotes_produccion ADD COLUMN IF NOT EXISTS costo_insumos FLOAT DEFAULT 0.0",
                    "ALTER TABLE lotes_produccion ADD COLUMN IF NOT EXISTS costo_maquila FLOAT DEFAULT 0.0",
                ]
                for sql in sqls:
                    try:
                        conn.execute(text(sql))
                    except Exception:
                        pass  # Column may already exist in SQLite
                _mark_migration_applied(conn, migration_v94)
                logger.info("V94 (producción avanzada) aplicada.")

            migration_v95 = "v95_productos_indexes"
            if not _migration_already_applied(conn, migration_v95):
                idx_sqls = [
                    "CREATE INDEX IF NOT EXISTS ix_productos_empresa_sku ON productos (empresa_id, sku)",
                    "CREATE INDEX IF NOT EXISTS ix_productos_empresa_barcode ON productos (empresa_id, codigo_barras)",
                    "CREATE INDEX IF NOT EXISTS ix_productos_empresa_vigente ON productos (empresa_id, vigente)",
                ]
                for sql in idx_sqls:
                    try:
                        conn.execute(text(sql))
                    except Exception:
                        pass
                _mark_migration_applied(conn, migration_v95)
                logger.info("V95 (índices compuestos productos) aplicada.")

            # ── V96: columnas FE en registros_pagos ──────────────────────────
            migration_v96 = "v96_registros_pagos_fe"
            if not _migration_already_applied(conn, migration_v96):
                for col, col_type in [
                    ("numero_factura_ksmart", "VARCHAR(20)"),
                    ("estado_fe",             "VARCHAR(30) DEFAULT 'no_configurado'"),
                    ("cufe_fe",               "TEXT"),
                    ("pdf_url_fe",            "TEXT"),
                ]:
                    if not _column_exists(conn, "registros_pagos", col):
                        conn.execute(text(f"ALTER TABLE registros_pagos ADD COLUMN {col} {col_type}"))
                _mark_migration_applied(conn, migration_v96)
                logger.info("V96 (FE en registros_pagos) aplicada.")

            # ── V97: tabla plataforma_config (dueño del sistema, singleton) ───
            migration_v97 = "v97_plataforma_config"
            if not _migration_already_applied(conn, migration_v97):
                if not _table_exists(conn, "plataforma_config"):
                    if IS_SQLITE:
                        conn.execute(text("""
                            CREATE TABLE plataforma_config (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                nombre_empresa VARCHAR(150),
                                nit VARCHAR(20),
                                dv VARCHAR(1),
                                tipo_organizacion_id INTEGER DEFAULT 1,
                                tipo_regimen_id INTEGER DEFAULT 48,
                                responsabilidad_fiscal_codes VARCHAR DEFAULT 'O-13',
                                departamento_code VARCHAR(5),
                                ciudad_code VARCHAR(5),
                                correo_facturacion VARCHAR,
                                direccion VARCHAR,
                                telefono VARCHAR(20),
                                logo_base64 TEXT,
                                facturacion_electronica_activa BOOLEAN DEFAULT 0,
                                matias_api_key VARCHAR,
                                matias_sandbox_api_key VARCHAR,
                                matias_test_mode BOOLEAN DEFAULT 1,
                                resolucion_prefijo VARCHAR(10) DEFAULT '',
                                resolucion_numero VARCHAR(50),
                                resolucion_numero_actual INTEGER DEFAULT 0,
                                resolucion_numero_inicial INTEGER DEFAULT 1,
                                resolucion_numero_final INTEGER DEFAULT 99999999,
                                resolucion_vigencia_desde DATE,
                                resolucion_vigencia_hasta DATE,
                                resolucion_clave_tecnica VARCHAR(200),
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            )
                        """))
                    else:
                        conn.execute(text("""
                            CREATE TABLE plataforma_config (
                                id SERIAL PRIMARY KEY,
                                nombre_empresa VARCHAR(150),
                                nit VARCHAR(20),
                                dv VARCHAR(1),
                                tipo_organizacion_id INTEGER DEFAULT 1,
                                tipo_regimen_id INTEGER DEFAULT 48,
                                responsabilidad_fiscal_codes VARCHAR DEFAULT 'O-13',
                                departamento_code VARCHAR(5),
                                ciudad_code VARCHAR(5),
                                correo_facturacion VARCHAR,
                                direccion VARCHAR,
                                telefono VARCHAR(20),
                                logo_base64 TEXT,
                                facturacion_electronica_activa BOOLEAN DEFAULT FALSE,
                                matias_api_key VARCHAR,
                                matias_sandbox_api_key VARCHAR,
                                matias_test_mode BOOLEAN DEFAULT TRUE,
                                resolucion_prefijo VARCHAR(10) DEFAULT '',
                                resolucion_numero VARCHAR(50),
                                resolucion_numero_actual INTEGER DEFAULT 0,
                                resolucion_numero_inicial INTEGER DEFAULT 1,
                                resolucion_numero_final INTEGER DEFAULT 99999999,
                                resolucion_vigencia_desde DATE,
                                resolucion_vigencia_hasta DATE,
                                resolucion_clave_tecnica VARCHAR(200),
                                updated_at TIMESTAMPTZ DEFAULT NOW()
                            )
                        """))
                    logger.info("V97: tabla plataforma_config creada.")
                _mark_migration_applied(conn, migration_v97)
                logger.info("V97 (plataforma_config) aplicada.")

            # ── V98: ON DELETE SET NULL en FK opcionales de ventas ────────────
            # Evita FK constraint errors al eliminar una venta que tenga
            # movimientos de puntos, pedidos virtuales, asientos, comandas, etc.
            migration_v98 = "v98_ventas_fk_set_null"
            if not _migration_already_applied(conn, migration_v98):
                if not IS_SQLITE:
                    fk_fixes = [
                        ("movimientos_puntos", "movimientos_puntos_venta_id_fkey", "venta_id", "ventas"),
                        ("pedidos_virtuales",  "pedidos_virtuales_venta_id_fkey",  "venta_id", "ventas"),
                        ("comandas",           "comandas_venta_id_fkey",           "venta_id", "ventas"),
                        ("lavadero_ordenes",   "lavadero_ordenes_venta_id_fkey",   "venta_id", "ventas"),
                        ("asientos_contables", "asientos_contables_venta_id_fkey", "venta_id", "ventas"),
                        ("ordenes_produccion", "ordenes_produccion_venta_id_fkey", "venta_id", "ventas"),
                    ]
                    for tabla, constraint, col, ref_tabla in fk_fixes:
                        try:
                            if _column_exists(conn, tabla, col):
                                conn.execute(text(f"ALTER TABLE {tabla} DROP CONSTRAINT IF EXISTS {constraint}"))
                                conn.execute(text(
                                    f"ALTER TABLE {tabla} ADD CONSTRAINT {constraint} "
                                    f"FOREIGN KEY ({col}) REFERENCES {ref_tabla}(id) ON DELETE SET NULL"
                                ))
                        except Exception as _fk_exc:
                            logger.warning("V98: no se pudo actualizar FK %s.%s: %s", tabla, col, _fk_exc)
                _mark_migration_applied(conn, migration_v98)
                logger.info("V98 (ventas FK ON DELETE SET NULL) aplicada.")

            # ── V99: incluye_fe en planes_suscripcion ─────────────────────────
            migration_v99 = "v99_planes_incluye_fe"
            if not _migration_already_applied(conn, migration_v99):
                if not _column_exists(conn, "planes_suscripcion", "incluye_fe"):
                    if IS_SQLITE:
                        conn.execute(text(
                            "ALTER TABLE planes_suscripcion ADD COLUMN incluye_fe BOOLEAN DEFAULT 1"
                        ))
                    else:
                        conn.execute(text(
                            "ALTER TABLE planes_suscripcion ADD COLUMN incluye_fe BOOLEAN DEFAULT TRUE"
                        ))
                    logger.info("V99: añadido planes_suscripcion.incluye_fe")
                # Desactivar FE para planes Starter (case-insensitive)
                if IS_SQLITE:
                    conn.execute(text(
                        "UPDATE planes_suscripcion SET incluye_fe = 0 WHERE LOWER(nombre) LIKE '%starter%'"
                    ))
                else:
                    conn.execute(text(
                        "UPDATE planes_suscripcion SET incluye_fe = FALSE WHERE LOWER(nombre) LIKE '%starter%'"
                    ))
                logger.info("V99: incluye_fe = FALSE para planes Starter")
                _mark_migration_applied(conn, migration_v99)
                logger.info("V99 (incluye_fe en planes_suscripcion) aplicada.")

    except Exception as e:
        logger.exception("Error ejecutando migraciones: %s", e)
        raise