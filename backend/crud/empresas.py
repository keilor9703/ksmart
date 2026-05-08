from sqlalchemy import func, outerjoin
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
import models, schemas
from crud.common import get_password_hash
from core.config import PERFILES

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
