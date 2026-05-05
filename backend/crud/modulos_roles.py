from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
import models, schemas

# ═══════════════════════════════════════════════════════════════════════════════
# ROLES Y MÓDULOS
# ═══════════════════════════════════════════════════════════════════════════════

def get_modulo(db: Session, modulo_id: int):
    return db.query(models.Modulo).filter(models.Modulo.id == modulo_id).first()

def get_modulo_by_name(db: Session, name: str):
    return db.query(models.Modulo).filter(models.Modulo.name == name).first()


def get_modulo_by_frontend_path(db: Session, frontend_path: str):
    return db.query(models.Modulo).filter(
        models.Modulo.frontend_path == frontend_path
    ).first()

def get_modulos(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Modulo).offset(skip).limit(limit).all()

def create_modulo(db: Session, modulo: schemas.ModuloCreate):
    db_modulo = models.Modulo(**modulo.dict())
    db.add(db_modulo)
    db.commit()
    db.refresh(db_modulo)
    return db_modulo

def update_modulo(db: Session, modulo_id: int, modulo: schemas.ModuloCreate):
    db_modulo = db.query(models.Modulo).filter(models.Modulo.id == modulo_id).first()
    if db_modulo:
        for key, value in modulo.dict(exclude_unset=True).items():
            setattr(db_modulo, key, value)
        db.commit()
        db.refresh(db_modulo)
    return db_modulo

def delete_modulo(db: Session, modulo_id: int):
    db_modulo = db.query(models.Modulo).filter(models.Modulo.id == modulo_id).first()
    if db_modulo:
        db.delete(db_modulo)
        db.commit()
    return db_modulo


# ═══════════════════════════════════════════════════════════════════════════════
# ROLES (AHORA POR EMPRESA)
# ═══════════════════════════════════════════════════════════════════════════════

def get_role(db: Session, role_id: int, empresa_id: int):
    # ✅ Filtrar por ID y por la empresa del usuario
    return db.query(models.Role).options(joinedload(models.Role.modules)).filter(
        models.Role.id == role_id,
        models.Role.empresa_id == empresa_id
    ).first()

def get_role_by_name(db: Session, name: str, empresa_id: int):
    # ✅ Filtrar por nombre y por empresa
    return db.query(models.Role).options(joinedload(models.Role.modules)).filter(
        models.Role.name == name,
        models.Role.empresa_id == empresa_id
    ).first()

def get_roles(db: Session, empresa_id: int, skip: int = 0, limit: int = 100):
    # ✅ Traer solo los roles de ESA empresa
    return db.query(models.Role).options(joinedload(models.Role.modules)).filter(
        models.Role.empresa_id == empresa_id
    ).offset(skip).limit(limit).all()

def create_role(db: Session, role: schemas.RoleCreate, empresa_id: int):
    # ✅ Crear el rol asociándolo a la empresa
    db_role = models.Role(name=role.name, empresa_id=empresa_id)
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

# Funciones de asociación de módulos al rol
def add_modules_to_role(db: Session, role_id: int, module_ids: List[int], empresa_id: int):
    db_role = get_role(db, role_id, empresa_id) # Validación de tenant
    if not db_role:
        return None
    for module_id in module_ids:
        db_modulo = get_modulo(db, module_id)
        if db_modulo and db_modulo not in db_role.modules:
            db_role.modules.append(db_modulo)
    db.commit()
    db.refresh(db_role)
    return db_role

def remove_modules_from_role(db: Session, role_id: int, module_ids: List[int], empresa_id: int):
    db_role = get_role(db, role_id, empresa_id) # Validación de tenant
    if not db_role:
        return None
    for module_id in module_ids:
        db_modulo = get_modulo(db, module_id)
        if db_modulo and db_modulo in db_role.modules:
            db_role.modules.remove(db_modulo)
    db.commit()
    db.refresh(db_role)
    return db_role

def set_modules_for_role(db: Session, role_id: int, module_ids: List[int], empresa_id: int):
    db_role = get_role(db, role_id, empresa_id) # Validación de tenant
    if not db_role:
        return None
    db_role.modules.clear()
    for module_id in module_ids:
        db_modulo = get_modulo(db, module_id)
        if db_modulo:
            db_role.modules.append(db_modulo)
    db.commit()
    db.refresh(db_role)
    return db_role
