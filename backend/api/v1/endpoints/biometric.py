from typing import List
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

import crud
import models
import schemas
from api.deps import get_db, get_current_active_user
from core.security import create_access_token

router = APIRouter()

@router.post("/register/options")
def biometric_register_options_endpoint(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.biometric_register_options(db, user=current_user)

@router.post("/register/verify", response_model=schemas.BiometricRegisterVerifyResponse)
def biometric_register_verify_endpoint(
    payload: schemas.BiometricRegisterVerifyRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    user_agent = request.headers.get('user-agent', '')
    return crud.biometric_register_verify(
        db, user=current_user, payload=payload, user_agent=user_agent,
    )

@router.post("/login/options")
def biometric_login_options_endpoint(
    payload: schemas.BiometricLoginOptionsRequest,
    db: Session = Depends(get_db),
):
    return crud.biometric_login_options(db, username=payload.username)

@router.post("/login/verify", response_model=schemas.BiometricLoginVerifyResponse)
def biometric_login_verify_endpoint(
    payload: schemas.BiometricLoginVerifyRequest,
    db: Session = Depends(get_db),
):
    return crud.biometric_login_verify(
        db, payload=payload,
        create_access_token_func=create_access_token,
    )

@router.get("/credentials", response_model=List[schemas.CredencialBiometricaOut])
def listar_mis_credenciales(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.listar_credenciales_usuario(db, user_id=current_user.id)

@router.delete("/credentials/{credencial_id}")
def eliminar_mi_credencial(
    credencial_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    if not crud.eliminar_credencial(db, user_id=current_user.id, credencial_id=credencial_id):
        raise HTTPException(404, "Credencial no encontrada.")
    return {"message": "Credencial eliminada."}
