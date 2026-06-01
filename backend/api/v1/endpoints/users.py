from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import crud
import models
import schemas
from api.deps import get_db, get_current_user, get_current_active_user, get_current_admin_user, get_current_superadmin_user

router = APIRouter()

# ─── ROLES ────────────────────────────────────────────────────────────────────

@router.post("/roles/", response_model=schemas.Role, tags=["roles"])
def create_role(role: schemas.RoleCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    if crud.get_role_by_name(db, name=role.name, empresa_id=current_user.empresa_id):
        raise HTTPException(status_code=400, detail="Ya tienes un rol con este nombre en tu empresa")
    return crud.create_role(db=db, role=role, empresa_id=current_user.empresa_id)

@router.get("/roles/", response_model=List[schemas.Role], tags=["roles"])
def read_roles(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    return crud.get_roles(db, empresa_id=current_user.empresa_id, skip=skip, limit=limit)

@router.put("/roles/{role_id}/modules", response_model=schemas.Role, tags=["roles"])
def set_role_modules(role_id: int, module_ids: List[int], db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    db_role = crud.set_modules_for_role(
        db, 
        role_id=role_id, 
        module_ids=module_ids, 
        empresa_id=current_user.empresa_id
    )
    if db_role is None:
        raise HTTPException(status_code=404, detail="Rol no encontrado o no pertenece a tu empresa")
    return db_role

# ─── MÓDULOS ──────────────────────────────────────────────────────────────────

@router.post("/modulos/", response_model=schemas.Modulo, tags=["modulos"])
def create_modulo(modulo: schemas.ModuloCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_superadmin_user)):
    if crud.get_modulo_by_name(db, name=modulo.name):
        raise HTTPException(status_code=400, detail="Módulo ya registrado")
    return crud.create_modulo(db=db, modulo=modulo)

@router.get("/modulos/", response_model=List[schemas.Modulo], tags=["modulos"])
def read_modulos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    return crud.get_modulos(db, skip=skip, limit=limit)

@router.put("/modulos/{modulo_id}", response_model=schemas.Modulo, tags=["modulos"])
def update_modulo(modulo_id: int, modulo: schemas.ModuloCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_superadmin_user)):
    db_modulo = crud.update_modulo(db, modulo_id=modulo_id, modulo=modulo)
    if db_modulo is None:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
    return db_modulo

@router.delete("/modulos/{modulo_id}", tags=["modulos"])
def delete_modulo(modulo_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_superadmin_user)):
    if crud.delete_modulo(db, modulo_id=modulo_id) is None:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
    return {"message": "Módulo eliminado"}

# ─── USUARIOS ─────────────────────────────────────────────────────────────────

@router.post("/users/", response_model=schemas.User, tags=["users"])
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    if crud.get_user_by_username(db, username=user.username):
        raise HTTPException(status_code=400, detail="Nombre de usuario ya registrado")
    return crud.create_user(db=db, user=user, empresa_id=current_user.empresa_id)

@router.get("/users/me", response_model=schemas.User, tags=["users"])
def read_users_me(current_user: models.User = Depends(get_current_user)):
    """
    IMPORTANTE: Usa get_current_user (sin validación de suscripción activa) 
    para permitir que el usuario vea su perfil incluso si su plan ha expirado.
    Esto es necesario para el flujo de renovación SaaS.
    """
    return current_user

@router.get("/users/", response_model=List[schemas.User], tags=["users"])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    return crud.get_users(db, empresa_id=current_user.empresa_id, skip=skip, limit=limit)

@router.put("/users/{user_id}", response_model=schemas.User, tags=["users"])
def update_user(user_id: int, user: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    db_user = crud.update_user(db, user_id=user_id, user=user, empresa_id=current_user.empresa_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return db_user

@router.delete("/users/{user_id}", tags=["users"])
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    if crud.delete_user(db, user_id=user_id, empresa_id=current_user.empresa_id) is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"message": "Usuario eliminado"}

@router.patch("/users/{user_id}/toggle", tags=["users"])
def toggle_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    db_user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.empresa_id == current_user.empresa_id
    ).first()
    if not db_user:
        raise HTTPException(status_code=404)
    db_user.is_active = not db_user.is_active
    db.commit()
    return {"status": "ok", "new_state": db_user.is_active}

@router.get("/admin/usuarios", response_model=List[schemas.User], tags=["users"])
def listar_usuarios_empresa(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    if current_user.role.name != "Admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para ver la lista de usuarios")
    return db.query(models.User).filter(models.User.empresa_id == current_user.empresa_id).all()
