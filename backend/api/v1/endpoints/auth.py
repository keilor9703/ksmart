from datetime import datetime, timedelta, timezone
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

import crud
import models
import schemas
from api.deps import get_db, get_current_active_user
from core import security
from core.config import ACCESS_TOKEN_EXPIRE_MINUTES, PERFILES
from core.limiter import limiter

router = APIRouter()
logger = logging.getLogger("auth")

PIN_MAX_ATTEMPTS = 5
PIN_LOCKOUT_MINUTES = 15

@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def registrar_nuevo_cliente(request: Request, data: schemas.RegistroSaaS, db: Session = Depends(get_db)):
    # Username only needs to be unique within this empresa (multitenancy)
    # No global username uniqueness check needed here

    if data.email:
        existing_email = db.query(models.User).filter(models.User.email == data.email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Este correo ya está registrado. ¿Quieres iniciar sesión?")

    config_db = db.query(models.TipoNegocioConfig).filter(models.TipoNegocioConfig.tipo == data.tipo_negocio).first()
    modulos = config_db.modulos if config_db else PERFILES.get(data.tipo_negocio, PERFILES["erp"])

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
            tipo_negocio        = data.tipo_negocio,
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

        if data.tipo_negocio == "restaurante":
            from crud.grupos_producto import seed_categorias_restaurante
            seed_categorias_restaurante(db, nueva_emp.id)

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
        logger.error(f"Error de integridad en BD durante registro: {e.orig}")
        raise HTTPException(
            status_code=400,
            detail="El nombre de usuario o correo ya está registrado. Intenta con otros datos."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error no controlado en registro: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/token")
@limiter.limit("10/minute")
def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    remember_me: bool = Query(default=False),
    empresa_nit: Optional[str] = Query(default=None),
    db: Session = Depends(get_db)
):
    from sqlalchemy.orm import joinedload

    # Build base query for all users with this username
    users_q = db.query(models.User).options(
        joinedload(models.User.role).joinedload(models.Role.modules),
        joinedload(models.User.empresa)
    ).filter(models.User.username == form_data.username)

    # If empresa NIT provided, filter immediately (no ambiguity)
    if empresa_nit and empresa_nit.strip():
        empresa_filtro = db.query(models.Empresa).filter(
            models.Empresa.nit == empresa_nit.strip()
        ).first()
        if empresa_filtro:
            users_q = users_q.filter(models.User.empresa_id == empresa_filtro.id)

    all_users = users_q.all()

    if not all_users:
        logger.warning(f"Login fallido: usuario '{form_data.username}' no existe en BD")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Disambiguate by password when multiple companies share the same username
    if len(all_users) == 1:
        user = all_users[0]
        if not user.hashed_password or not security.verify_password(form_data.password, user.hashed_password):
            logger.warning(f"Login fallido: contraseña incorrecta para '{form_data.username}'")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario o contraseña incorrectos",
                headers={"WWW-Authenticate": "Bearer"},
            )
    else:
        matching = [u for u in all_users if u.hashed_password and security.verify_password(form_data.password, u.hashed_password)]
        if len(matching) == 0:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario o contraseña incorrectos",
                headers={"WWW-Authenticate": "Bearer"},
            )
        elif len(matching) > 1:
            # Same username + same password in multiple companies — ask for NIT
            raise HTTPException(
                status_code=409,
                detail="EMPRESA_REQUERIDA",
            )
        user = matching[0]

    if not user.hashed_password:
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
@limiter.limit("5/minute")
def verify_pin(
    request: Request,
    data: schemas.PinVerifyRequest,
    db: Session = Depends(get_db),
):
    """Verifica el PIN y retorna un JWT completo (sin necesidad de contraseña)."""
    # For PIN, find the specific user by username (unique within each empresa)
    # If multiple companies share the username, pick the one with PIN set and active
    candidates = db.query(models.User).filter(
        (models.User.username == data.username) | (models.User.email == data.username)
    ).all()
    user = None
    for c in candidates:
        if c.is_active and c.pin_hash:
            user = c
            break
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


@router.post("/password-reset-request", status_code=200)
@limiter.limit("3/minute")
def request_password_reset(request: Request, data: schemas.PasswordResetRequest, db: Session = Depends(get_db)):
    """Solicita restablecer contraseña. Siempre devuelve 200 para no filtrar si el email existe."""
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if user:
        logger.info(f"Solicitud de reset de contraseña para: {data.email}")
        # TODO: enviar email con token de reset cuando se configure el servicio de correo
    return {"message": "Si el correo está registrado, recibirás las instrucciones."}


# ─── RECUPERACIÓN NATIVA SIN EMAIL ──────────────────────────────────────────

def _mask(value: str) -> str:
    """Enmascara un string dejando los primeros 2 y último carácter visibles."""
    v = value.strip()
    if len(v) <= 3:
        return "*" * len(v)
    return v[:2] + "*" * (len(v) - 3) + v[-1]


@router.post("/recover/buscar")
@limiter.limit("10/minute")
def recover_buscar_usuario(request: Request, data: schemas.RecoverBuscarRequest, db: Session = Depends(get_db)):
    """Paso 1: identifica el usuario por username + NIT de empresa y devuelve pistas enmascaradas."""
    empresa = db.query(models.Empresa).filter(models.Empresa.nit == data.empresa_nit.strip()).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="No encontramos ninguna empresa con ese NIT. Verifica e intenta de nuevo.")

    user = db.query(models.User).filter(
        models.User.username == data.username.strip(),
        models.User.empresa_id == empresa.id
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="No encontramos ese usuario en la empresa indicada. Verifica los datos.")

    hints: dict = {}
    if user.nombre_completo:
        hints["nombre_completo"] = _mask(user.nombre_completo)

    return {"username": user.username, "empresa_nombre": empresa.nombre, "hints": hints}


@router.post("/recover/verificar")
@limiter.limit("5/minute")
def recover_verificar_identidad(request: Request, data: schemas.RecoverVerificarRequest, db: Session = Depends(get_db)):
    """Paso 2: verifica nombre_completo del usuario identificado por username + NIT."""
    empresa = db.query(models.Empresa).filter(models.Empresa.nit == data.empresa_nit.strip()).first()
    if not empresa:
        raise HTTPException(status_code=400, detail="Los datos ingresados no coinciden. Intenta de nuevo.")

    user = db.query(models.User).filter(
        models.User.username == data.username.strip(),
        models.User.empresa_id == empresa.id
    ).first()
    if not user:
        raise HTTPException(status_code=400, detail="Los datos ingresados no coinciden. Intenta de nuevo.")

    if not user.nombre_completo:
        raise HTTPException(status_code=400, detail="Este usuario no tiene nombre registrado. Contacta al administrador.")

    if not data.nombre_completo.strip():
        raise HTTPException(status_code=400, detail="Debes ingresar tu nombre completo.")

    if data.nombre_completo.strip().lower() != user.nombre_completo.strip().lower():
        logger.warning(f"Verificación fallida para '{data.username}' en empresa '{empresa.nombre}'")
        raise HTTPException(status_code=400, detail="El nombre ingresado no coincide con el registrado. Verifica e intenta de nuevo.")

    # Store user.id (not username) to handle multitenancy unambiguously
    recovery_token = security.create_access_token(
        data={"sub": str(user.id), "type": "password_recovery"},
        expires_delta=timedelta(minutes=10),
    )
    logger.info(f"Identidad verificada para recuperación: user_id={user.id} empresa='{empresa.nombre}'")
    return {"recovery_token": recovery_token}


@router.post("/recover/cambiar")
@limiter.limit("5/minute")
def recover_cambiar_password(request: Request, data: schemas.RecoverCambiarRequest, db: Session = Depends(get_db)):
    """Paso 3: cambia la contraseña usando el token de recuperación (válido 10 min)."""
    from jose import jwt, JWTError
    from core.config import SECRET_KEY, ALGORITHM

    try:
        payload = jwt.decode(data.recovery_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "password_recovery":
            raise HTTPException(status_code=400, detail="Token inválido.")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=400, detail="El tiempo de verificación expiró (10 min). Inicia el proceso nuevamente.")

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    user.hashed_password = security.get_password_hash(data.nueva_password)
    db.commit()
    logger.info(f"Contraseña cambiada exitosamente para: user_id={user_id} username={user.username}")
    return {"message": "Contraseña actualizada. Inicia sesión con tu nueva contraseña.", "username": user.username}

