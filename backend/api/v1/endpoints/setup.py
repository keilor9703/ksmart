import os
import base64
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

import models, crud, schemas
from api.deps import get_db

logger = logging.getLogger("setup")
router = APIRouter()


def _is_system_initialized(db: Session) -> bool:
    """Retorna True si ya existe al menos una empresa en la base de datos."""
    return db.query(models.Empresa).count() > 0


@router.get("/status")
def get_setup_status(db: Session = Depends(get_db)):
    """Indica si el sistema ya fue configurado por primera vez."""
    return {"initialized": _is_system_initialized(db)}


class SetupPayload(BaseModel):
    empresa_nombre: str
    empresa_nit: str = ""
    empresa_color: str = "#F43F5E"
    logo_base64: str | None = None
    admin_username: str
    admin_password: str


@router.post("/init")
def run_first_time_setup(payload: SetupPayload, db: Session = Depends(get_db)):
    """
    Wizard de primer arranque.
    Solo puede ejecutarse una vez: cuando la BD está completamente vacía.
    """
    if _is_system_initialized(db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El sistema ya fue inicializado. Este endpoint no puede ejecutarse nuevamente."
        )

    if len(payload.admin_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La contraseña debe tener al menos 6 caracteres."
        )

    # 1. Crear empresa dueña
    empresa = models.Empresa(
        nombre=payload.empresa_nombre.strip(),
        nit=payload.empresa_nit.strip(),
        color_primario=payload.empresa_color,
        logo_base64=payload.logo_base64,
        is_active=True,
        is_protected=True,
    )
    db.add(empresa)
    db.commit()
    db.refresh(empresa)

    # 2. Crear módulos del sistema
    default_modules_data = [
        {"name": "Ventas",              "description": "Gestión de ventas.",                              "frontend_path": "/ventas"},
        {"name": "Cotizaciones",        "description": "Gestión de cotizaciones.",                        "frontend_path": "/cotizaciones"},
        {"name": "Resoluciones DIAN",   "description": "Gestión de resoluciones DIAN.",                   "frontend_path": "/admin/resoluciones"},
        {"name": "Clientes",            "description": "Gestión de clientes.",                            "frontend_path": "/clientes"},
        {"name": "Productos",           "description": "Gestión de productos.",                           "frontend_path": "/productos"},
        {"name": "Reportes",            "description": "Visualización de reportes.",                      "frontend_path": "/reportes"},
        {"name": "Gestion Modulos",     "description": "Administración de módulos.",                      "frontend_path": "/admin/modules"},
        {"name": "Órdenes de Trabajo",  "description": "Gestión de órdenes de trabajo.",                  "frontend_path": "/ordenes-trabajo"},
        {"name": "Panel del Operador",  "description": "Panel de productividad para operadores.",         "frontend_path": "/panel-operador"},
        {"name": "Recetas",             "description": "Gestión de fórmulas de producción (BOM).",        "frontend_path": "/produccion/recetas"},
        {"name": "Producción",          "description": "Gestión de lotes y transformaciones.",            "frontend_path": "/produccion/lotes"},
        {"name": "Compras",             "description": "Gestión de compras.",                             "frontend_path": "/compras"},
        {"name": "Inventarios",         "description": "Movimientos y alertas de stock.",                 "frontend_path": "/inventario"},
        {"name": "Lotes",               "description": "Productos perecederos.",                          "frontend_path": "/inventario/lotes"},
        {"name": "Reportes inventario", "description": "Reportes de inventario y kardex.",                "frontend_path": "/reportes-inventario"},
        {"name": "Caja",                "description": "Corte de caja diario.",                           "frontend_path": "/caja"},
        {"name": "Préstamos",           "description": "Gestión de préstamos.",                           "frontend_path": "/prestamos"},
        {"name": "Ruta de Cobro",       "description": "Gestión de ruta de cobro.",                       "frontend_path": "/ruta-cobro"},
        {"name": "Parqueadero",         "description": "Dashboard del parqueadero.",                      "frontend_path": "/parqueadero"},
        {"name": "Buscar Placa",        "description": "Búsqueda rápida de placas.",                      "frontend_path": "/parqueadero/buscar"},
        {"name": "Vehículos",           "description": "Gestión de vehículos.",                           "frontend_path": "/parqueadero/vehiculos"},
        {"name": "Suscripciones Parq.", "description": "Renovaciones y pagos.",                           "frontend_path": "/parqueadero/suscripciones"},
        {"name": "Config Parqueadero",  "description": "Tarifas y cupo total.",                           "frontend_path": "/parqueadero/config"},
        {"name": "Cierre Caja FE Parq.", "description": "Factura electrónica consolidada diaria.",          "frontend_path": "/parqueadero/cierre-fe"},
        {"name": "POS Lavadero",        "description": "Punto de venta para lavadero.",                   "frontend_path": "/lavadero/ventas"},
        {"name": "Reporte Lavadero",    "description": "Reporte de productividad por trabajador.",        "frontend_path": "/lavadero/reporte"},
        {"name": "Config Lavadero",     "description": "Comisiones e impresión del lavadero.",            "frontend_path": "/lavadero/config"},
        {"name": "Gestión Usuarios",    "description": "Administración de usuarios y roles.",              "frontend_path": "/admin/usuarios"},
        {"name": "Catálogo Virtual",    "description": "Tienda virtual con pedidos por WhatsApp.",         "frontend_path": "/admin/catalogo"},
        {"name": "Pedidos Virtuales",   "description": "Pedidos recibidos desde la tienda virtual.",       "frontend_path": "/pedidos-virtuales"},
        {"name": "Mapa de Mesas",         "description": "Gestión de mesas y comandas.",                    "frontend_path": "/restaurante"},
        {"name": "Pantalla Cocina",       "description": "Pantalla de órdenes para cocina.",                "frontend_path": "/restaurante/cocina"},
        {"name": "Config Restaurante",    "description": "Configuración de áreas y mesas.",                 "frontend_path": "/restaurante/config"},
        {"name": "Caja Restaurante",      "description": "Cobro de mesas y cierre de comandas.",            "frontend_path": "/restaurante/caja"},
        {"name": "Reportes Restaurante",  "description": "Reportes de ventas e historial con FE.",          "frontend_path": "/restaurante/reportes"},
    ]

    created_modules = []
    for mod_data in default_modules_data:
        modulo = crud.get_modulo_by_frontend_path(db, frontend_path=mod_data["frontend_path"])
        if not modulo:
            modulo = crud.create_modulo(db, schemas.ModuloCreate(**mod_data))
        created_modules.append(modulo)

    # 3. Crear rol Admin para la empresa dueña
    admin_role = models.Role(name="Admin", empresa_id=empresa.id)
    db.add(admin_role)
    db.commit()
    db.refresh(admin_role)
    crud.set_modules_for_role(db, role_id=admin_role.id, module_ids=[m.id for m in created_modules], empresa_id=empresa.id)

    # 4. Crear usuario superadmin
    crud.create_user(
        db,
        schemas.UserCreate(
            username=payload.admin_username.strip(),
            password=payload.admin_password,
            role_id=admin_role.id,
        ),
        empresa_id=empresa.id,
    )

    logger.info("✅ Sistema inicializado correctamente. Empresa: %s", empresa.nombre)
    return {"ok": True, "message": "Sistema inicializado correctamente. Ya puedes iniciar sesión."}
