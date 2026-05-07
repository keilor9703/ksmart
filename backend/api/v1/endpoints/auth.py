from datetime import datetime, timedelta, timezone
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

import crud
import models
import schemas
from api.deps import get_db
from core import security
from core.config import ACCESS_TOKEN_EXPIRE_MINUTES, PERFILES

router = APIRouter()
logger = logging.getLogger("auth")

@router.post("/register", status_code=status.HTTP_201_CREATED)
def registrar_nuevo_cliente(data: schemas.RegistroSaaS, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Este usuario ya está en uso. Prueba con otro.")

    if data.email:
        existing_email = db.query(models.User).filter(models.User.email == data.email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Este correo ya está registrado. ¿Quieres iniciar sesión?")

    modulos = PERFILES.get(data.tipo_negocio, PERFILES["erp"])

    try:
        nueva_emp = models.Empresa(
            nombre              = data.nombre_empresa.strip(),
            nit                 = data.nit, # ✨ NUEVO: Guardar NIT
            is_active           = True,
            plan_type           = "trial",
            trial_ends_at       = datetime.now(timezone.utc) + timedelta(days=14),
            modulos_habilitados = modulos,
            pais                = data.pais,
            ciudad              = data.ciudad,
            tamano_negocio      = data.tamano_negocio,
            origen_marketing    = data.origen,
        )
        db.add(nueva_emp)
        db.flush()

        nuevo_rol_admin = models.Role(
            name="Admin", 
            empresa_id=nueva_emp.id
        )
        db.add(nuevo_rol_admin)
        db.flush()

        modulos_db = db.query(models.Modulo).filter(models.Modulo.frontend_path.in_(modulos)).all()
        nuevo_rol_admin.modules = modulos_db
        db.flush()

        nuevo_user = models.User(
            username        = data.username,
            hashed_password = security.get_password_hash(data.password),
            role_id         = nuevo_rol_admin.id,
            empresa_id      = nueva_emp.id,
            nombre_completo = data.nombre_completo,
            email           = data.email,
            telefono        = data.telefono,
            is_active       = True
        )
        db.add(nuevo_user)
        db.commit()

        logger.info(
            f"✅ Nuevo registro: empresa={nueva_emp.nombre} (id={nueva_emp.id}) | "
            f"user={data.username}"
        )

        return {
            "message":     "Cuenta creada con éxito",
            "empresa_id":  nueva_emp.id,
            "trial_until": nueva_emp.trial_ends_at.isoformat(),
        }

    except IntegrityError as e:
        db.rollback()
        error_exacto = str(e.orig)
        logger.error(f"Error de integridad en BD: {error_exacto}")
        raise HTTPException(
            status_code=400, 
            detail=f"Error en la base de datos: {error_exacto}"
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error no controlado en registro: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/token")
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_username(db, username=form_data.username)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not getattr(user, 'is_active', True):
        raise HTTPException(status_code=403, detail="Cuenta suspendida por el administrador.")

    if not user.empresa_id or not user.empresa:
        raise HTTPException(status_code=403, detail="El usuario no está vinculado a ninguna empresa válida.")

    empresa = user.empresa
    if not empresa.is_active:
        raise HTTPException(status_code=403, detail="La suscripción de la empresa se encuentra suspendida. Contacte a soporte.")

    is_expired = False
    if empresa.trial_ends_at:
        ahora_utc = datetime.now(timezone.utc)
        fecha_limite = empresa.trial_ends_at
        if fecha_limite.tzinfo is None:
            fecha_limite = fecha_limite.replace(tzinfo=timezone.utc)
        if ahora_utc > fecha_limite:
            is_expired = True

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={
            "sub": user.username,
            "role": user.role.name if user.role else "User",
            "empresa_id": user.empresa_id,
            "modules": [m.frontend_path for m in user.role.modules] if user.role else []
        },
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "is_expired": is_expired
    }
