from sqlalchemy import func, outerjoin, text, inspect as sa_inspect
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
import logging, models, schemas
from crud.common import get_password_hash
from core.config import PERFILES

logger = logging.getLogger("crud.empresas")

def log_saas_event(db: Session, admin_id: int, accion: str, empresa_id: Optional[int] = None, detalle: Optional[dict] = None):
    """Registra una acción en el log de auditoría SaaS"""
    db_log = models.SaaSAuditLog(
        admin_id=admin_id,
        accion=accion,
        empresa_id=empresa_id,
        detalle=detalle
    )
    db.add(db_log)
    db.commit()

def get_empresas(db: Session, skip: int = 0, limit: int = 100):
    """Obtiene todas las empresas registradas en el SaaS con métricas básicas"""
    # Subconsultas para evitar N+1
    user_count = db.query(
        models.User.empresa_id, 
        func.count(models.User.id).label("users_count")
    ).group_by(models.User.empresa_id).subquery()

    venta_count = db.query(
        models.Venta.empresa_id, 
        func.count(models.Venta.id).label("ventas_count")
    ).group_by(models.Venta.empresa_id).subquery()

    prod_count = db.query(
        models.Producto.empresa_id, 
        func.count(models.Producto.id).label("prods_count")
    ).group_by(models.Producto.empresa_id).subquery()

    query = db.query(
        models.Empresa,
        func.coalesce(user_count.c.users_count, 0).label("count_usuarios"),
        func.coalesce(venta_count.c.ventas_count, 0).label("count_ventas"),
        func.coalesce(prod_count.c.prods_count, 0).label("count_productos")
    ).outerjoin(user_count, models.Empresa.id == user_count.c.empresa_id)\
     .outerjoin(venta_count, models.Empresa.id == venta_count.c.empresa_id)\
     .outerjoin(prod_count, models.Empresa.id == prod_count.c.empresa_id)\
     .order_by(models.Empresa.id.asc())\
     .offset(skip).limit(limit)

    results = []
    ahora = datetime.now(timezone.utc)
    for empresa, c_u, c_v, c_p in query.all():
        empresa_dict = empresa.__dict__.copy()
        empresa_dict["count_usuarios"] = c_u
        empresa_dict["count_ventas"] = c_v
        empresa_dict["count_productos"] = c_p
        
        # Calcular días restantes
        if empresa.trial_ends_at:
            # Normalizar trial_ends_at a aware si viene como naive desde la BD
            trial_end = empresa.trial_ends_at
            if trial_end.tzinfo is None:
                trial_end = trial_end.replace(tzinfo=timezone.utc)
            
            diff = trial_end - ahora
            empresa_dict["dias_restantes"] = max(0, diff.days)
        else:
            empresa_dict["dias_restantes"] = 9999 if empresa.id == 1 else 0
            
        results.append(empresa_dict)
    
    return results

def toggle_empresa_status(db: Session, empresa_id: int, admin_id: int):
    """Activa o suspende una empresa y registra el evento"""
    db_empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if db_empresa:
        old_status = db_empresa.is_active
        db_empresa.is_active = not db_empresa.is_active
        db.commit()
        
        accion = "ACTIVATE" if db_empresa.is_active else "SUSPEND"
        log_saas_event(db, admin_id, accion, empresa_id, {"old_status": old_status, "new_status": db_empresa.is_active})
        
        db.refresh(db_empresa)
    return db_empresa

def create_empresa_with_admin(db: Session, data: schemas.EmpresaWithAdminCreate, admin_id: Optional[int] = None):
    """
    Crea una nueva Empresa y automáticamente le crea su primer usuario Admin.
    Sincronizado con la lógica de auto-registro en auth.py.
    """
    existing_user = db.query(models.User).filter(models.User.username == data.admin_username).first()
    if existing_user:
        raise ValueError(f"El nombre de usuario '{data.admin_username}' ya está en uso.")

    ahora_utc = datetime.now(timezone.utc)
    fin_prueba = ahora_utc + timedelta(days=14) 

    # Determinar módulos según tipo de negocio
    tipo = data.empresa.tipo_negocio or "erp"
    modulos = PERFILES.get(tipo, PERFILES["erp"])

    db_empresa = models.Empresa(
        nombre=data.empresa.nombre,
        nit=data.empresa.nit,
        color_primario=data.empresa.color_primario,
        is_active=True,
        plan_type="trial",
        trial_ends_at=fin_prueba,
        modulos_habilitados=modulos
    )
    db.add(db_empresa)
    db.flush()

    # Crear el rol Admin para esta empresa
    admin_role = models.Role(
        name="Admin", 
        empresa_id=db_empresa.id
    )
    db.add(admin_role)
    db.flush()

    # Asignar módulos al rol
    modulos_db = db.query(models.Modulo).filter(models.Modulo.frontend_path.in_(modulos)).all()
    admin_role.modules = modulos_db
    db.flush()

    hashed_password = get_password_hash(data.admin_password)

    db_user = models.User(
        username=data.admin_username,
        hashed_password=hashed_password,
        role_id=admin_role.id,
        empresa_id=db_empresa.id,
        nombre_completo=data.admin_nombre_completo,
        email=data.admin_email,
        telefono=data.admin_telefono,
        is_active=True
    )
    db.add(db_user)

    if tipo == "restaurante":
        from crud.grupos_producto import seed_categorias_restaurante
        seed_categorias_restaurante(db, db_empresa.id)

    if admin_id:
        log_saas_event(db, admin_id, "CREATE_EMPRESA", db_empresa.id, {"nombre": db_empresa.nombre})

    db.commit()
    db.refresh(db_empresa)
    return db_empresa


def update_empresa_plan(db: Session, empresa_id: int, plan_data: schemas.EmpresaPlanUpdate, admin_id: int):
    """Actualiza el plan de una empresa y registra el evento"""
    db_empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if db_empresa:
        old_plan = db_empresa.plan_type
        db_empresa.plan_type = plan_data.plan_type
        db_empresa.trial_ends_at = plan_data.trial_ends_at
        
        log_saas_event(db, admin_id, "CHANGE_PLAN", empresa_id, {
            "old_plan": old_plan, 
            "new_plan": plan_data.plan_type,
            "new_expiry": str(plan_data.trial_ends_at)
        })
        
        db.commit()
        db.refresh(db_empresa)
    return db_empresa

def update_empresa_modulos(db: Session, empresa_id: int, modulos: List[str], admin_id: int):
    """Actualiza la lista de módulos habilitados para una empresa"""
    db_empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if db_empresa:
        old_modulos = db_empresa.modulos_habilitados
        db_empresa.modulos_habilitados = modulos

        log_saas_event(db, admin_id, "UPDATE_MODULES", empresa_id, {
            "old_count": len(old_modulos) if old_modulos else 0,
            "new_count": len(modulos)
        })

        db.commit()
        db.refresh(db_empresa)
    return db_empresa


# ---------------------------------------------------------------------------
# Deletion order: children before parents to satisfy FK constraints.
# Uses :eid named parameter (SQLAlchemy-safe, works with PostgreSQL & SQLite).
# ---------------------------------------------------------------------------
_DELETE_STEPS = [
    "DELETE FROM evidencias_cobro WHERE cuota_id IN (SELECT id FROM cuotas_prestamo WHERE prestamo_id IN (SELECT id FROM prestamos WHERE empresa_id=:eid))",
    "DELETE FROM cuotas_prestamo WHERE prestamo_id IN (SELECT id FROM prestamos WHERE empresa_id=:eid)",
    "DELETE FROM devolucion_items WHERE devolucion_id IN (SELECT id FROM devoluciones WHERE empresa_id=:eid)",
    "DELETE FROM detalles_compra WHERE compra_id IN (SELECT id FROM compras WHERE empresa_id=:eid)",
    "DELETE FROM pagos_compra WHERE compra_id IN (SELECT id FROM compras WHERE empresa_id=:eid)",
    "DELETE FROM receta_items WHERE receta_id IN (SELECT id FROM recetas WHERE empresa_id=:eid)",
    "DELETE FROM receta_servicios WHERE receta_id IN (SELECT id FROM recetas WHERE empresa_id=:eid)",
    "DELETE FROM lotes_produccion WHERE receta_id IN (SELECT id FROM recetas WHERE empresa_id=:eid)",
    "DELETE FROM detalles_pedido_virtual WHERE pedido_id IN (SELECT id FROM pedidos_virtuales WHERE empresa_id=:eid)",
    "DELETE FROM restaurante_comanda_items WHERE comanda_id IN (SELECT id FROM restaurante_comandas WHERE empresa_id=:eid)",
    "DELETE FROM orden_productos WHERE empresa_id=:eid",
    "DELETE FROM orden_servicios WHERE empresa_id=:eid",
    "DELETE FROM evidencias WHERE empresa_id=:eid",
    "DELETE FROM pagos_parqueadero WHERE empresa_id=:eid",
    "DELETE FROM credenciales_biometricas WHERE user_id IN (SELECT id FROM users WHERE empresa_id=:eid)",
    "DELETE FROM role_modules WHERE role_id IN (SELECT id FROM roles WHERE empresa_id=:eid)",
    "DELETE FROM prestamos WHERE empresa_id=:eid",
    "DELETE FROM devoluciones WHERE empresa_id=:eid",
    "DELETE FROM compras WHERE empresa_id=:eid",
    "DELETE FROM recetas WHERE empresa_id=:eid",
    "DELETE FROM restaurante_comandas WHERE empresa_id=:eid",
    "DELETE FROM pedidos_virtuales WHERE empresa_id=:eid",
    "DELETE FROM ordenes_trabajo WHERE empresa_id=:eid",
    "DELETE FROM suscripciones_parqueadero WHERE empresa_id=:eid",
    "DELETE FROM accesos_parqueadero WHERE empresa_id=:eid",
    "DELETE FROM envios_whatsapp_parqueadero WHERE empresa_id=:eid",
    "DELETE FROM vehiculos WHERE empresa_id=:eid",
    "DELETE FROM users WHERE empresa_id=:eid",
    "DELETE FROM roles WHERE empresa_id=:eid",
    "DELETE FROM lavadero_orden_detalles WHERE empresa_id=:eid",
    "DELETE FROM lavadero_ordenes WHERE empresa_id=:eid",
    "DELETE FROM detalles_venta WHERE empresa_id=:eid",
    "DELETE FROM pagos WHERE empresa_id=:eid",
    "DELETE FROM ventas WHERE empresa_id=:eid",
    "DELETE FROM movimientos_puntos WHERE empresa_id=:eid",
    "DELETE FROM clientes WHERE empresa_id=:eid",
    "DELETE FROM producto_impuestos WHERE empresa_id=:eid",
    "DELETE FROM inventory_movements WHERE empresa_id=:eid",
    "DELETE FROM lotes_existencias WHERE empresa_id=:eid",
    "DELETE FROM producto_variantes WHERE empresa_id=:eid",
    "DELETE FROM productos WHERE empresa_id=:eid",
    "DELETE FROM tipos_impuesto WHERE empresa_id=:eid",
    "DELETE FROM empresa_grupo_config WHERE empresa_id=:eid",
    "DELETE FROM grupos_producto WHERE empresa_id=:eid",
    "DELETE FROM lavadero_config WHERE empresa_id=:eid",
    "DELETE FROM parqueadero_config WHERE empresa_id=:eid",
    "DELETE FROM metodos_pago_parqueadero WHERE empresa_id=:eid",
    "DELETE FROM plantillas_whatsapp WHERE empresa_id=:eid",
    "DELETE FROM restaurante_mesas WHERE empresa_id=:eid",
    "DELETE FROM restaurante_config WHERE empresa_id=:eid",
    "DELETE FROM links_pago_empresa WHERE empresa_id=:eid",
    "DELETE FROM notificaciones WHERE empresa_id=:eid",
    "DELETE FROM registros_productividad WHERE empresa_id=:eid",
    "DELETE FROM cortes_caja WHERE empresa_id=:eid",
    "DELETE FROM gastos WHERE empresa_id=:eid",
    "DELETE FROM resoluciones_dian WHERE empresa_id=:eid",
    "DELETE FROM registros_pagos WHERE empresa_id=:eid",
    "DELETE FROM saas_audit_logs WHERE empresa_id=:eid",
    "DELETE FROM empresas WHERE id=:eid",
]


def delete_empresa(db: Session, empresa_id: int, admin_id: int) -> dict:
    """
    Elimina una empresa y todos sus registros en orden FK-safe.
    Compatible con PostgreSQL y SQLite.
    """
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if not empresa:
        raise ValueError(f"Empresa {empresa_id} no encontrada")
    if empresa_id == 1:
        raise ValueError("No se puede eliminar la empresa maestra del SaaS")

    nombre_empresa = empresa.nombre

    # Detect which tables exist (handles partial DB migrations)
    try:
        inspector = sa_inspect(db.get_bind())
        existing_tables = set(inspector.get_table_names())
    except Exception:
        existing_tables = None  # Skip table-existence check; let DB raise on missing tables

    total_rows = 0
    tablas_afectadas = 0

    for sql in _DELETE_STEPS:
        # Extract table name: "DELETE FROM <table> ..."
        parts = sql.split()
        table = parts[2] if len(parts) > 2 else ""

        if existing_tables is not None and table and table not in existing_tables:
            continue

        try:
            result = db.execute(text(sql), {"eid": empresa_id})
            rows = result.rowcount or 0
            if rows:
                total_rows += rows
                tablas_afectadas += 1
        except Exception as exc:
            logger.warning("delete_empresa %s — error en tabla %s: %s", empresa_id, table, exc)

    # Audit log with empresa_id=None since the empresa no longer exists
    db.add(models.SaaSAuditLog(
        admin_id=admin_id,
        accion="DELETE_EMPRESA",
        empresa_id=None,
        detalle={"empresa_id": empresa_id, "nombre": nombre_empresa, "filas_eliminadas": total_rows},
    ))
    db.commit()

    logger.info("Empresa %s ('%s') eliminada por admin_id=%s — %d filas en %d tablas",
                empresa_id, nombre_empresa, admin_id, total_rows, tablas_afectadas)

    return {"empresa_id": empresa_id, "nombre": nombre_empresa, "filas_eliminadas": total_rows}
