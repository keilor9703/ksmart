import os
import json
import base64
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException

from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json,
)
from webauthn.helpers.cose import COSEAlgorithmIdentifier
from webauthn.helpers.structs import (
    PublicKeyCredentialDescriptor,
    UserVerificationRequirement,
    AuthenticatorSelectionCriteria,
    AuthenticatorAttachment,
    ResidentKeyRequirement,
)

import models, schemas


RP_ID = os.getenv("WEBAUTHN_RP_ID", "ksmart360.com")
RP_NAME = os.getenv("WEBAUTHN_RP_NAME", "Ksmart360")
ORIGIN_PROD = os.getenv("WEBAUTHN_ORIGIN", "https://ksmart360.com")

ALLOWED_ORIGINS = [
    ORIGIN_PROD,
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
]

def _save_challenge(db: Session, key: str, challenge: bytes, ttl_seconds: int = 300):
    """Guarda un challenge en la base de datos con expiración."""
    ahora = datetime.now(timezone.utc).timestamp()
    expira = ahora + ttl_seconds
    
    # Limpiar expirados antiguos de forma periódica (simple)
    if os.urandom(1)[0] % 10 == 0: # 10% de probabilidad de limpieza en cada guardado
        db.query(models.BiometricChallenge).filter(models.BiometricChallenge.expires_at < ahora).delete()

    challenge_b64 = base64.b64encode(challenge).decode('ascii')
    
    db_item = db.query(models.BiometricChallenge).filter(models.BiometricChallenge.key == key).first()
    if db_item:
        db_item.challenge = challenge_b64
        db_item.expires_at = expira
    else:
        db_item = models.BiometricChallenge(key=key, challenge=challenge_b64, expires_at=expira)
        db.add(db_item)
    
    db.commit()


def _get_challenge(db: Session, key: str) -> Optional[bytes]:
    """Recupera un challenge de la base de datos si aún es válido."""
    ahora = datetime.now(timezone.utc).timestamp()
    db_item = db.query(models.BiometricChallenge).filter(
        models.BiometricChallenge.key == key,
        models.BiometricChallenge.expires_at > ahora
    ).first()
    
    if not db_item:
        return None
    
    return base64.b64decode(db_item.challenge)


def _consume_challenge(db: Session, key: str) -> Optional[bytes]:
    """Recupera y elimina de la base de datos (un solo uso)."""
    challenge = _get_challenge(db, key)
    if challenge:
        db.query(models.BiometricChallenge).filter(models.BiometricChallenge.key == key).delete()
        db.commit()
    return challenge


def biometric_register_options(
    db: Session, user: models.User
) -> dict:
    """
    Genera las opciones que el navegador usa para crear una credencial nueva.
    Solo se llama desde un usuario YA autenticado (por contraseña).
    """
    existentes = db.query(models.CredencialBiometrica).filter(
        models.CredencialBiometrica.user_id == user.id
    ).all()

    exclude_credentials = []
    for c in existentes:
        try:
            cred_id_bytes = base64.urlsafe_b64decode(c.credential_id + '==')
            exclude_credentials.append(
                PublicKeyCredentialDescriptor(id=cred_id_bytes)
            )
        except Exception:
            continue

    options = generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_id=str(user.id).encode('utf-8'),
        user_name=user.username or user.email or f"user_{user.id}",
        user_display_name=user.nombre_completo or user.username or "Usuario",
        exclude_credentials=exclude_credentials,
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
            user_verification=UserVerificationRequirement.PREFERRED,
            resident_key=ResidentKeyRequirement.PREFERRED,
        ),
        supported_pub_key_algs=[
            COSEAlgorithmIdentifier.ECDSA_SHA_256,
            COSEAlgorithmIdentifier.RSASSA_PKCS1_v1_5_SHA_256,
        ],
    )

    _save_challenge(db, f"reg:{user.id}", options.challenge)
    return json.loads(options_to_json(options))


def biometric_register_verify(
    db: Session, user: models.User, payload: schemas.BiometricRegisterVerifyRequest,
    user_agent: Optional[str] = None,
) -> dict:
    """
    Verifica la respuesta del navegador y guarda la credencial nueva en BD.
    """
    challenge = _consume_challenge(db, f"reg:{user.id}")
    if not challenge:
        raise HTTPException(
            status_code=400,
            detail="El registro expiró. Vuelve a intentarlo."
        )

    try:
        verification = verify_registration_response(
            credential=payload.credential,
            expected_challenge=challenge,
            expected_origin=ALLOWED_ORIGINS,
            expected_rp_id=RP_ID,
            require_user_verification=False,
        )
    except Exception as ex:
        raise HTTPException(
            status_code=400,
            detail=f"No se pudo verificar la huella: {str(ex)}"
        )

    cred_id_b64 = base64.urlsafe_b64encode(verification.credential_id).decode('ascii').rstrip('=')

    existente = db.query(models.CredencialBiometrica).filter(
        models.CredencialBiometrica.credential_id == cred_id_b64
    ).first()
    if existente:
        return {
            "success":       True,
            "credential_id": existente.id,
            "device_name":   existente.device_name,
            "message":       "Esta credencial ya estaba registrada.",
        }

    device_name = payload.device_name or _detectar_nombre_dispositivo(user_agent)
    pub_key_b64 = base64.urlsafe_b64encode(verification.credential_public_key).decode('ascii').rstrip('=')

    cred = models.CredencialBiometrica(
        user_id        = user.id,
        credential_id  = cred_id_b64,
        public_key     = pub_key_b64,
        sign_count     = verification.sign_count,
        device_name    = device_name,
        user_agent     = (user_agent or '')[:500],
        last_used_at   = datetime.now(timezone.utc),
    )
    db.add(cred)
    db.commit()
    db.refresh(cred)

    return {
        "success":       True,
        "credential_id": cred.id,
        "device_name":   cred.device_name,
        "message":       f"Huella registrada en este dispositivo ({cred.device_name}).",
    }


def biometric_login_options(
    db: Session, username: Optional[str] = None
) -> dict:
    """
    Genera opciones para autenticación. Si se pasa username, restringe a las
    credenciales de ese usuario.
    """
    allow_credentials = []
    user_for_challenge_key = "anon"

    if username:
        user = db.query(models.User).filter(
            (models.User.username == username) | (models.User.email == username)
        ).first()
        if user:
            user_for_challenge_key = str(user.id)
            credentials = db.query(models.CredencialBiometrica).filter(
                models.CredencialBiometrica.user_id == user.id
            ).all()
            for c in credentials:
                try:
                    cred_id_bytes = base64.urlsafe_b64decode(c.credential_id + '==')
                    allow_credentials.append(
                        PublicKeyCredentialDescriptor(id=cred_id_bytes)
                    )
                except Exception:
                    continue

    options = generate_authentication_options(
        rp_id=RP_ID,
        allow_credentials=allow_credentials if allow_credentials else None,
        user_verification=UserVerificationRequirement.PREFERRED,
    )

    _save_challenge(db, f"auth:{user_for_challenge_key}", options.challenge)
    return json.loads(options_to_json(options))


def biometric_login_verify(
    db: Session, payload: schemas.BiometricLoginVerifyRequest,
    create_access_token_func,
) -> dict:
    """
    Verifica la firma del navegador. Si es válida, devuelve el JWT completo
    (con role, empresa_id y modules) — idéntico al login por contraseña.
    """
    raw_cred_id = payload.credential.get('rawId') or payload.credential.get('id')
    if not raw_cred_id:
        raise HTTPException(400, "Respuesta de huella inválida.")

    cred_id_normalizado = raw_cred_id.replace('+', '-').replace('/', '_').rstrip('=')

    cred = db.query(models.CredencialBiometrica).filter(
        models.CredencialBiometrica.credential_id == cred_id_normalizado
    ).first()
    if not cred:
        raise HTTPException(401, "Esta huella no está registrada en el sistema.")

    challenge = _consume_challenge(db, f"auth:{cred.user_id}")
    if not challenge:
        challenge = _consume_challenge(db, "auth:anon")
    if not challenge:
        raise HTTPException(400, "La sesión de huella expiró. Intenta de nuevo.")

    public_key_bytes = base64.urlsafe_b64decode(cred.public_key + '==')

    try:
        verification = verify_authentication_response(
            credential=payload.credential,
            expected_challenge=challenge,
            expected_origin=ALLOWED_ORIGINS,
            expected_rp_id=RP_ID,
            credential_public_key=public_key_bytes,
            credential_current_sign_count=cred.sign_count,
            require_user_verification=False,
        )
    except Exception as ex:
        raise HTTPException(401, f"La huella no coincide: {str(ex)}")

    cred.sign_count = verification.new_sign_count
    cred.last_used_at = datetime.now(timezone.utc)
    db.commit()

    user = db.query(models.User).filter(models.User.id == cred.user_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado.")
    if not user.is_active:
        raise HTTPException(403, "Tu cuenta está desactivada.")
    if not user.empresa_id or not user.empresa:
        raise HTTPException(403, "El usuario no está vinculado a ninguna empresa válida.")

    # Verificar expiración de suscripción (igual que login por contraseña)
    is_expired = False
    empresa = user.empresa
    if empresa.trial_ends_at and user.empresa_id != 1:
        fecha_limite = empresa.trial_ends_at
        if fecha_limite.tzinfo is None:
            fecha_limite = fecha_limite.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > fecha_limite:
            is_expired = True

    # JWT completo con role, empresa_id y modules — igual que login por contraseña
    access_token = create_access_token_func(data={
        "sub":        user.username,
        "role":       user.role.name if user.role else "User",
        "empresa_id": user.empresa_id,
        "modules":    [m.frontend_path for m in user.role.modules] if user.role else [],
    })

    return {
        "access_token":   access_token,
        "token_type":     "bearer",
        "user_id":        user.id,
        "username":       user.username,
        "empresa_id":     user.empresa_id,
        "rol":            user.role.name if user.role else None,
        "nombre_completo": user.nombre_completo,
        "device_name":    cred.device_name,
        "is_expired":     is_expired,
    }


def listar_credenciales_usuario(
    db: Session, user_id: int
) -> List[models.CredencialBiometrica]:
    return db.query(models.CredencialBiometrica).filter(
        models.CredencialBiometrica.user_id == user_id
    ).order_by(models.CredencialBiometrica.last_used_at.desc().nullslast()).all()


def eliminar_credencial(db: Session, user_id: int, credencial_id: int) -> bool:
    cred = db.query(models.CredencialBiometrica).filter(
        models.CredencialBiometrica.id == credencial_id,
        models.CredencialBiometrica.user_id == user_id,
    ).first()
    if not cred:
        return False
    db.delete(cred)
    db.commit()
    return True


def _detectar_nombre_dispositivo(user_agent: Optional[str]) -> str:
    """Genera un nombre amigable basado en el User-Agent."""
    if not user_agent:
        return "Dispositivo desconocido"

    ua = user_agent.lower()

    so = ""
    if "iphone" in ua:
        so = "iPhone"
    elif "ipad" in ua:
        so = "iPad"
    elif "android" in ua:
        import re
        match = re.search(r'\(.*?;\s*([^;]+?)\s+build', ua, re.IGNORECASE) or \
                re.search(r'\(.*?;\s*([^;)]+?)\)', ua)
        if match:
            modelo = match.group(1).strip()
            so = f"Android ({modelo})"
        else:
            so = "Android"
    elif "windows" in ua:
        so = "Windows"
    elif "mac os" in ua or "macintosh" in ua:
        so = "Mac"
    elif "linux" in ua:
        so = "Linux"
    else:
        so = "Dispositivo"

    nav = ""
    if "edg/" in ua:
        nav = "Edge"
    elif "chrome/" in ua and "chromium" not in ua:
        nav = "Chrome"
    elif "safari/" in ua and "chrome" not in ua:
        nav = "Safari"
    elif "firefox/" in ua:
        nav = "Firefox"

    if nav:
        return f"{so} - {nav}"
    return so
