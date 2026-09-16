from typing import Generator, Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from database import SessionLocal
import models
import schemas
import crud
from core.config import SECRET_KEY, ALGORITHM
from services.saas_service import TenantAccessService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

def get_db() -> Generator:
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()

def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except JWTError:
        raise credentials_exception

    user = crud.get_user_by_username(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

def get_current_active_user(
    request: Request,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> models.User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Usuario inactivo")
    
    empresa = current_user.empresa
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada para este usuario")

    # 👇 EVALUACIÓN CENTRALIZADA DE ACCESO (Fase 2)
    can_login, access_mode, reason = TenantAccessService.evaluate_access(db, empresa.id)
    
    if not can_login:
        detail = "Acceso denegado."
        if reason == "TRIAL_EXPIRED": detail = "Suscripción expirada. Por favor contacte a soporte para renovar."
        if reason == "MANUAL_SUSPENSION": detail = "Cuenta suspendida temporalmente."
        
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

    # 👇 ENFORCEMENT DE MODO RESTRINGIDO (Read-Only)
    if not TenantAccessService.is_mutation_allowed(access_mode, request.method):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED, 
            detail="Modo lectura activo. Por favor renueve su suscripción para realizar cambios."
        )

    # 👇 ACTUALIZACIÓN DE TELEMETRÍA (Throttle 15 min para no saturar la BD)
    ahora = datetime.now(timezone.utc)
    last_act = empresa.last_activity_at
    if last_act and last_act.tzinfo is None:
        last_act = last_act.replace(tzinfo=timezone.utc)

    if not last_act or (ahora - last_act).total_seconds() > 900:
        empresa.last_activity_at = ahora
        db.add(empresa)
        db.commit()

    return current_user

def get_current_admin_user(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if current_user.role.name != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permisos insuficientes"
        )
    return current_user

def get_current_superadmin_user(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if current_user.role.name != "Admin" or current_user.empresa_id != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: Solo SuperAdmin"
        )
    return current_user
