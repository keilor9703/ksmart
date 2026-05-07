from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
import models, schemas
from crud.common import get_password_hash
from core.config import PERFILES


def create_empresa(db: Session, empresa: schemas.EmpresaBase):
    db_empresa = models.Empresa(**empresa.dict())
    db.add(db_empresa)
    db.commit()
    db.refresh(db_empresa)
    return db_empresa

def get_empresas(db: Session, skip: int = 0, limit: int = 100):
    """Obtiene todas las empresas registradas en el SaaS"""
    return db.query(models.Empresa).order_by(models.Empresa.id.asc()).offset(skip).limit(limit).all()

def toggle_empresa_status(db: Session, empresa_id: int):
    """Activa o suspende una empresa (bloquea el login de todos sus usuarios)"""
    db_empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if db_empresa:
        db_empresa.is_active = not db_empresa.is_active
        db.commit()
        db_empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    return db_empresa

def create_empresa_with_admin(db: Session, data: schemas.EmpresaWithAdminCreate):
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

    db.commit()
    db.refresh(db_empresa)
    return db_empresa


def update_empresa_plan(db: Session, empresa_id: int, plan_data: schemas.EmpresaPlanUpdate):
    db_empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if db_empresa:
        db_empresa.plan_type = plan_data.plan_type
        db_empresa.trial_ends_at = plan_data.trial_ends_at
        db.commit()
        db.refresh(db_empresa)
    return db_empresa
