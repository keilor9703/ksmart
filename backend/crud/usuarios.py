from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from fastapi import HTTPException
import models, schemas
from crud.common import verify_password, get_password_hash
from crud.modulos_roles import get_role

# ═══════════════════════════════════════════════════════════════════════════════
# USUARIOS
# ═══════════════════════════════════════════════════════════════════════════════

def get_user(db: Session, user_id: int):
    return db.query(models.User).options(
        joinedload(models.User.role).joinedload(models.Role.modules)
    ).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str, empresa_id: Optional[int] = None):
    q = db.query(models.User).options(
        joinedload(models.User.role).joinedload(models.Role.modules),
        joinedload(models.User.empresa)
    ).filter(models.User.username == username)
    if empresa_id is not None:
        q = q.filter(models.User.empresa_id == empresa_id)
    return q.first()

def get_users_by_username(db: Session, username: str):
    """Returns ALL users with this username across all companies."""
    return db.query(models.User).options(
        joinedload(models.User.role).joinedload(models.Role.modules),
        joinedload(models.User.empresa)
    ).filter(models.User.username == username).all()

def get_users(db: Session, empresa_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.User).options(
        joinedload(models.User.role).joinedload(models.Role.modules)
    ).filter(
        models.User.empresa_id == empresa_id
    ).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate, empresa_id: int):
    # ✅ 1. VERIFICAR QUE EL ROL ASIGNADO PERTENECE A ESTA EMPRESA
    rol_asignado = get_role(db, role_id=user.role_id, empresa_id=empresa_id)
    if not rol_asignado:
        raise HTTPException(
            status_code=400,
            detail="El rol seleccionado no es válido o no pertenece a tu empresa."
        )

    # 1b. Verificar unicidad del username dentro de esta empresa
    if db.query(models.User).filter(
        models.User.username == user.username,
        models.User.empresa_id == empresa_id
    ).first():
        raise HTTPException(status_code=400, detail="Este nombre de usuario ya existe en tu empresa.")

    # 2. VERIFICACIÓN DE LÍMITE DE USUARIOS (MONETIZACIÓN)
    total_users = db.query(models.User).filter(models.User.empresa_id == empresa_id).count()
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()

    limite = 6 if empresa.plan_type == "trial" else 50

    if total_users >= limite:
        raise HTTPException(
            status_code=403,
            detail=f"Has alcanzado el límite de {limite} usuarios de tu plan. Mejora tu suscripción para expandir tu equipo."
        )

    # 3. Creación normal
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        hashed_password=hashed_password,
        role_id=user.role_id,
        empresa_id=empresa_id,
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user_id: int, user: schemas.UserCreate, empresa_id: int):
    # ✨ NUEVA VALIDACIÓN: Verificar que el nuevo rol pertenezca a la empresa
    if user.role_id:
        rol_asignado = get_role(db, role_id=user.role_id, empresa_id=empresa_id)
        if not rol_asignado:
            raise HTTPException(status_code=400, detail="El rol seleccionado no pertenece a tu empresa.")

    db_user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.empresa_id == empresa_id
    ).first()

    # ... (el resto de tu función queda exactamente igual) ...
    if db_user:
        for key, value in user.dict(exclude_unset=True).items():
            if key == "password":
                setattr(db_user, "hashed_password", get_password_hash(value))
            else:
                setattr(db_user, key, value)
        db.commit()
        db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int, empresa_id: int):
    # ✅ 2. Borrado Lógico: Solo cambiamos el estado
    db_user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.empresa_id == empresa_id
    ).first()

    if db_user:
        # Impedir que se desactive el admin principal
        if db_user.role.name == "Admin":
            admin_count = db.query(models.User).filter(
                models.User.empresa_id == empresa_id,
                models.User.role.has(name="Admin"),
                models.User.is_active == True
            ).count()
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail="Debe existir al menos un administrador activo.")

        db_user.is_active = False
        db.commit()
    return db_user

def toggle_user_status(db: Session, user_id: int, empresa_id: int):
    # Función extra para poder reactivar a un empleado si vuelve a la empresa
    db_user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.empresa_id == empresa_id
    ).first()
    if db_user:
        db_user.is_active = not db_user.is_active
        db.commit()
        db.refresh(db_user)
    return db_user
