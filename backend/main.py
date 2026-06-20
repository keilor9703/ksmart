import os
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session

import models, crud, schemas
from database import SessionLocal, engine, run_migrations
from models import Base, utcnow
from api.v1.api import api_router
from core.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from core.limiter import limiter

# --- Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

# --- Database & Migrations ---
models.Base.metadata.create_all(bind=engine)
run_migrations()

app = FastAPI(title="Ksmart360 API Multi-Tenant", version="2.2.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- CORS ---
_base_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://appksmp.vercel.app",
    "https://ksmart360.vercel.app",
    "https://www.appjeylor.com",
    "https://appjeylor.com",
    "https://api.appjeylor.com",
    "https://catalogo.appjeylor.com",
]
_extra = [o.strip() for o in os.getenv("EXTRA_CORS_ORIGINS", "").split(",") if o.strip()]
origins = _base_origins + _extra

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Static Files ---
EVIDENCE_DIR = "evidencias"
if not os.path.exists(EVIDENCE_DIR):
    os.makedirs(EVIDENCE_DIR)
app.mount("/evidencias", StaticFiles(directory=EVIDENCE_DIR), name="evidencias")

# --- Include Modular Router ---
app.include_router(api_router)

# --- Root Endpoints ---
@app.get("/")
def read_root():
    return {"message": "Ksmart360 API is running", "status": "online"}

@app.get("/ping")
def ping():
    return {"ping": "pong", "timestamp": datetime.now(timezone.utc)}

@app.get("/health")
def health():
    from sqlalchemy import text
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        db_status = str(e)
    finally:
        db.close()
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "2.2.0",
    }

# --- Startup Logic ---
def initialize_default_data(db: Session):
    # Auto-healing for Master Company
    empresa_default = db.query(models.Empresa).first()
    if not empresa_default:
        empresa_default = models.Empresa(
            nombre=os.getenv("SUPERADMIN_EMPRESA_NOMBRE", "Mi Empresa"),
            nit=os.getenv("SUPERADMIN_EMPRESA_NIT", ""),
            color_primario=os.getenv("SUPERADMIN_COLOR", "#F43F5E"),
            is_active=True
        )
        db.add(empresa_default)
        db.commit()
        db.refresh(empresa_default)
    
    # Default Modules
    default_modules_data = [
        {"name": "Ventas",              "description": "Módulo para la gestión de ventas.",              "frontend_path": "/ventas"},
        {"name": "Cotizaciones",        "description": "Módulo para la gestión de cotizaciones.",          "frontend_path": "/cotizaciones"},
        {"name": "Resoluciones DIAN",   "description": "Módulo para la gestión de resoluciones de la DIAN.",    "frontend_path": "/admin/resoluciones"},
        {"name": "Clientes",            "description": "Módulo para la gestión de clientes.",              "frontend_path": "/clientes"},
        {"name": "Productos",           "description": "Módulo para la gestión de productos.",             "frontend_path": "/productos"},
        {"name": "Reportes",            "description": "Módulo para la visualización de reportes.",       "frontend_path": "/reportes"},
        # {"name": "Gestion Usuarios",    "description": "Módulo de administración de usuarios.",            "frontend_path": "/admin/users"},
        # {"name": "Gestion Roles",       "description": "Módulo de administración de roles.",               "frontend_path": "/admin/roles"},
        {"name": "Gestion Modulos",     "description": "Módulo de administración de módulos.",             "frontend_path": "/admin/modules"},
        {"name": "Órdenes de Trabajo",  "description": "Módulo para la gestión de órdenes de trabajo.",  "frontend_path": "/ordenes-trabajo"},
        {"name": "Panel del Operador",  "description": "Panel de productividad para operadores.",          "frontend_path": "/panel-operador"},
        {"name": "Recetas",             "description": "Gestión de fórmulas de producción (BOM).",        "frontend_path": "/produccion/recetas"},
        {"name": "Producción",          "description": "Gestión de lotes y transformaciones.",             "frontend_path": "/produccion/lotes"},
        {"name": "Compras",             "description": "Módulo para la gestión de compras.",               "frontend_path": "/compras"},
        {"name": "Inventarios",         "description": "Módulo para movimientos y alertas de stock.",      "frontend_path": "/inventario"},
        {"name": "Lotes",               "description": "Módulo para productos perecederos.",               "frontend_path": "/inventario/lotes"},
        {"name": "Reportes inventario", "description": "Reportes de inventario y kardex.",                "frontend_path": "/reportes-inventario"},
        {"name": "Caja",                "description": "Módulo de corte de caja diario.",                  "frontend_path": "/caja"},
        {"name": "Préstamos",           "description": "Módulo de gestión de préstamos.",                  "frontend_path": "/prestamos"},
        {"name": "Ruta de Cobro",       "description": "Módulo de gestión de ruta de cobro.",              "frontend_path": "/ruta-cobro"},
        {"name": "Parqueadero",         "description": "Dashboard del parqueadero.",                       "frontend_path": "/parqueadero"},
        {"name": "Buscar Placa",        "description": "Búsqueda rápida de placas.",                       "frontend_path": "/parqueadero/buscar"},
        {"name": "Vehículos",           "description": "Gestión de vehículos.",                            "frontend_path": "/parqueadero/vehiculos"},
        {"name": "Suscripciones Parq.", "description": "Renovaciones y pagos.",                            "frontend_path": "/parqueadero/suscripciones"},
        {"name": "Config Parqueadero",  "description": "Tarifas y cupo total.",                            "frontend_path": "/parqueadero/config"},
        {"name": "Cierre Caja FE Parq.","description": "Factura electrónica consolidada diaria.",          "frontend_path": "/parqueadero/cierre-fe"},
        {"name": "POS Lavadero",         "description": "Punto de venta especializado para lavadero.",       "frontend_path": "/lavadero/ventas"},
        {"name": "Reporte Lavadero",     "description": "Reporte de productividad por trabajador.",          "frontend_path": "/lavadero/reporte"},
        {"name": "Config Lavadero",      "description": "Comisiones e impresión del lavadero.",              "frontend_path": "/lavadero/config"},
        {"name": "Gestión Usuarios",     "description": "Administración de usuarios y roles.",               "frontend_path": "/admin/usuarios"},
        {"name": "Catálogo Virtual",     "description": "Tienda virtual con pedidos por WhatsApp.",          "frontend_path": "/admin/catalogo"},
        {"name": "Pedidos Virtuales",    "description": "Gestión de pedidos recibidos desde la tienda virtual.", "frontend_path": "/pedidos-virtuales"},
        {"name": "Mapa de Mesas",        "description": "Gestión de mesas y comandas del restaurante.",      "frontend_path": "/restaurante"},
        {"name": "Pantalla Cocina",      "description": "Pantalla de órdenes para el área de cocina.",       "frontend_path": "/restaurante/cocina"},
        {"name": "Config Restaurante",   "description": "Configuración de áreas y mesas.",                   "frontend_path": "/restaurante/config"},
        {"name": "Caja Restaurante",     "description": "Cobro de comandas y cierre de turno.",              "frontend_path": "/restaurante/caja"},
        {"name": "Reportes Restaurante", "description": "Reportes de ventas y desempeño del restaurante.",   "frontend_path": "/restaurante/reportes"},
    ]

    admin_role = crud.get_role_by_name(db, name="Admin", empresa_id=empresa_default.id)
    if not admin_role:
        admin_role = models.Role(name="Admin", empresa_id=empresa_default.id)
        db.add(admin_role)
        db.commit()
        db.refresh(admin_role)

    created_modules = []
    for mod_data in default_modules_data:
        modulo = crud.get_modulo_by_frontend_path(db, frontend_path=mod_data["frontend_path"])
        if not modulo:
            modulo = crud.create_modulo(db, schemas.ModuloCreate(**mod_data))
        created_modules.append(modulo)

    crud.set_modules_for_role(db, role_id=admin_role.id, module_ids=[m.id for m in created_modules], empresa_id=empresa_default.id)

    superadmin_username = os.getenv("SUPERADMIN_USERNAME", "admin")
    superadmin_password = os.getenv("SUPERADMIN_PASSWORD", "")
    if not superadmin_password:
        superadmin_password = "adminpass"
        logger.warning("⚠️ SUPERADMIN_PASSWORD no configurada. Usando contraseña por defecto.")

    admin_user = crud.get_user_by_username(db, username=superadmin_username)
    if not admin_user:
        crud.create_user(
            db,
            schemas.UserCreate(username=superadmin_username, password=superadmin_password, role_id=admin_role.id),
            empresa_id=empresa_default.id
        )

def run_migrations():
    """Aplica migraciones de columnas nuevas sin romper datos existentes."""
    from sqlalchemy import text, inspect
    with engine.connect() as conn:
        inspector = inspect(engine)

        cols = [c['name'] for c in inspector.get_columns('productos')]
        if 'unidades_por_empaque' not in cols:
            conn.execute(text("ALTER TABLE productos ADD COLUMN unidades_por_empaque FLOAT NOT NULL DEFAULT 1.0"))
            conn.commit()

        # Pedidos virtuales tables
        tables = inspector.get_table_names()
        if 'pedidos_virtuales' not in tables:
            conn.execute(text("""
                CREATE TABLE pedidos_virtuales (
                    id SERIAL PRIMARY KEY,
                    empresa_id INTEGER REFERENCES empresas(id),
                    nombre_cliente VARCHAR(200) NOT NULL,
                    celular_cliente VARCHAR(30) NOT NULL,
                    email_cliente VARCHAR(200),
                    tipo_entrega VARCHAR(20) DEFAULT 'tienda',
                    direccion_entrega VARCHAR(300),
                    comentarios TEXT,
                    estado VARCHAR(20) DEFAULT 'nuevo',
                    total FLOAT DEFAULT 0,
                    stock_descontado BOOLEAN DEFAULT FALSE,
                    venta_id INTEGER REFERENCES ventas(id),
                    notas_internas TEXT,
                    fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
                    fecha_actualizacion TIMESTAMPTZ
                )
            """))
            conn.execute(text("CREATE INDEX idx_pv_empresa_id ON pedidos_virtuales(empresa_id)"))
            conn.execute(text("CREATE INDEX idx_pv_estado ON pedidos_virtuales(estado)"))
            conn.commit()

        if 'detalles_pedido_virtual' not in tables:
            conn.execute(text("""
                CREATE TABLE detalles_pedido_virtual (
                    id SERIAL PRIMARY KEY,
                    empresa_id INTEGER REFERENCES empresas(id),
                    pedido_id INTEGER NOT NULL REFERENCES pedidos_virtuales(id) ON DELETE CASCADE,
                    producto_id INTEGER REFERENCES productos(id),
                    nombre_producto VARCHAR(300) NOT NULL,
                    cantidad FLOAT NOT NULL,
                    precio_unitario FLOAT NOT NULL,
                    subtotal FLOAT NOT NULL
                )
            """))
            conn.execute(text("CREATE INDEX idx_dpv_pedido_id ON detalles_pedido_virtual(pedido_id)"))
            conn.commit()

        # V69 — unicidad de mesa por zona en lugar de global por empresa
        constraints = {c['name'] for c in inspector.get_unique_constraints('restaurante_mesas')}
        if 'uq_mesa_numero_empresa' in constraints and 'uq_mesa_numero_zona_empresa' not in constraints:
            conn.execute(text("ALTER TABLE restaurante_mesas DROP CONSTRAINT uq_mesa_numero_empresa"))
            conn.execute(text(
                "ALTER TABLE restaurante_mesas ADD CONSTRAINT uq_mesa_numero_zona_empresa "
                "UNIQUE (empresa_id, numero, zona)"
            ))
            conn.commit()

        # Programa de fidelización configurable por empresa
        emp_cols = [c['name'] for c in inspector.get_columns('empresas')]
        if 'fidelizacion_activa' not in emp_cols:
            conn.execute(text("ALTER TABLE empresas ADD COLUMN fidelizacion_activa BOOLEAN NOT NULL DEFAULT TRUE"))
            conn.commit()
        if 'fidelizacion_earn_rate' not in emp_cols:
            conn.execute(text("ALTER TABLE empresas ADD COLUMN fidelizacion_earn_rate INTEGER NOT NULL DEFAULT 1000"))
            conn.commit()
        if 'fidelizacion_redeem_rate' not in emp_cols:
            conn.execute(text("ALTER TABLE empresas ADD COLUMN fidelizacion_redeem_rate INTEGER NOT NULL DEFAULT 100"))
            conn.commit()

@app.on_event("startup")
def startup_event():
    run_migrations()
    db = SessionLocal()
    try:
        initialize_default_data(db)
    finally:
        db.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
