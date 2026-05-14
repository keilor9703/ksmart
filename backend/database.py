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

    except Exception as e:
        logger.exception("Error ejecutando migraciones: %s", e)
        raise