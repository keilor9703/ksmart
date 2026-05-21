from datetime import datetime, timedelta, timezone
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

import crud
import models
import schemas
from api.deps import get_db, get_current_active_user
from core import security
from core.config import ACCESS_TOKEN_EXPIRE_MINUTES, PERFILES

router = APIRouter()
logger = logging.getLogger("auth")

PIN_MAX_ATTEMPTS = 5
PIN_LOCKOUT_MINUTES = 15

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
    remember_me: bool = Query(default=False),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_username(db, username=form_data.username)
    if not user:
        logger.warning(f"Login fallido: usuario '{form_data.username}' no existe en BD")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.hashed_password:
        logger.error(f"Login fallido: usuario '{form_data.username}' existe pero hashed_password es NULL")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not security.verify_password(form_data.password, user.hashed_password):
        logger.warning(f"Login fallido: contraseña incorrecta para '{form_data.username}' (hash prefix: {user.hashed_password[:10]})")
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

    # 🚀 VALIDACIÓN DE EXPIRACIÓN (SaaS)
    is_expired = False
    if empresa.trial_ends_at and empresa.id != 1: # Ignorar empresa maestra
        ahora_utc = datetime.now(timezone.utc)
        fecha_limite = empresa.trial_ends_at
        if fecha_limite.tzinfo is None:
            fecha_limite = fecha_limite.replace(tzinfo=timezone.utc)
        
        if ahora_utc > fecha_limite:
            is_expired = True

    # remember_me: 30 días. Sesión normal: ACCESS_TOKEN_EXPIRE_MINUTES (defecto 120 min)
    access_token_expires = timedelta(days=30) if remember_me else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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


# ─── PIN de acceso rápido ────────────────────────────────────────────────────

@router.post("/pin/set", status_code=200)
def set_pin(
    data: schemas.PinSetRequest,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Establece o cambia el PIN del usuario autenticado."""
    pin = data.pin.strip()
    if not pin.isdigit() or not (4 <= len(pin) <= 6):
        raise HTTPException(400, "El PIN debe tener entre 4 y 6 dígitos numéricos.")
    current_user.pin_hash = security.get_password_hash(pin)
    current_user.pin_attempts = 0
    current_user.pin_locked_until = None
    db.commit()
    return {"message": "PIN configurado correctamente."}


@router.delete("/pin", status_code=200)
def remove_pin(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Elimina el PIN del usuario autenticado."""
    current_user.pin_hash = None
    current_user.pin_attempts = 0
    current_user.pin_locked_until = None
    db.commit()
    return {"message": "PIN eliminado."}


@router.post("/pin/verify")
def verify_pin(
    data: schemas.PinVerifyRequest,
    db: Session = Depends(get_db),
):
    """Verifica el PIN y retorna un JWT completo (sin necesidad de contraseña)."""
    user = db.query(models.User).filter(
        (models.User.username == data.username) | (models.User.email == data.username)
    ).first()
    if not user or not user.is_active or not user.pin_hash:
        raise HTTPException(401, "PIN no configurado o usuario no encontrado.")

    # Verificar bloqueo por intentos fallidos
    now = datetime.now(timezone.utc)
    if user.pin_locked_until:
        locked = user.pin_locked_until
        if locked.tzinfo is None:
            locked = locked.replace(tzinfo=timezone.utc)
        if now < locked:
            segundos = int((locked - now).total_seconds())
            raise HTTPException(429, f"PIN bloqueado. Intenta en {segundos // 60 + 1} minuto(s).")

    if not security.verify_password(data.pin, user.pin_hash):
        user.pin_attempts = (user.pin_attempts or 0) + 1
        if user.pin_attempts >= PIN_MAX_ATTEMPTS:
            user.pin_locked_until = now + timedelta(minutes=PIN_LOCKOUT_MINUTES)
            user.pin_attempts = 0
            db.commit()
            raise HTTPException(429, f"Demasiados intentos. PIN bloqueado por {PIN_LOCKOUT_MINUTES} minutos.")
        db.commit()
        restantes = PIN_MAX_ATTEMPTS - user.pin_attempts
        raise HTTPException(401, f"PIN incorrecto. {restantes} intento(s) restante(s).")

    # PIN correcto — resetear intentos
    user.pin_attempts = 0
    user.pin_locked_until = None
    db.commit()

    if not user.empresa_id or not user.empresa:
        raise HTTPException(403, "El usuario no está vinculado a ninguna empresa válida.")

    is_expired = False
    empresa = user.empresa
    if empresa.trial_ends_at and user.empresa_id != 1:
        fecha_limite = empresa.trial_ends_at
        if fecha_limite.tzinfo is None:
            fecha_limite = fecha_limite.replace(tzinfo=timezone.utc)
        if now > fecha_limite:
            is_expired = True

    access_token = security.create_access_token(data={
        "sub":        user.username,
        "role":       user.role.name if user.role else "User",
        "empresa_id": user.empresa_id,
        "modules":    [m.frontend_path for m in user.role.modules] if user.role else [],
    })

    return {
        "access_token":    access_token,
        "token_type":      "bearer",
        "user_id":         user.id,
        "username":        user.username,
        "empresa_id":      user.empresa_id,
        "rol":             user.role.name if user.role else None,
        "nombre_completo": user.nombre_completo,
        "is_expired":      is_expired,
    }
