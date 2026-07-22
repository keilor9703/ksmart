from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import models, schemas
from api.deps import get_db, get_current_active_user
from core import security

router = APIRouter()


def _get_link_activo(db: Session, empresa_id: int) -> Optional[models.LinkPagoEmpresa]:
    """El primero activo — usado solo por consumidores de "un solo link"
    (portal público de agendamiento), que no tienen selector de método de pago."""
    return (
        db.query(models.LinkPagoEmpresa)
        .filter_by(empresa_id=empresa_id, is_active=True)
        .order_by(models.LinkPagoEmpresa.id.asc())
        .first()
    )


@router.get("/empresa/link-pago")
def get_link_pago(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Devuelve el primer link de pago activo de la empresa (o null si no tiene).
    Se mantiene por compatibilidad con consumidores de "un solo link" (portal
    público de agendamiento) — el checkout de Ventas usa /empresa/link-pago/activos."""
    link = _get_link_activo(db, current_user.empresa_id)
    if link is None:
        return None
    empresa = db.query(models.Empresa).filter(models.Empresa.id == current_user.empresa_id).first()
    data = schemas.LinkPagoOut.model_validate(link).model_dump()
    data["logo_base64"] = getattr(empresa, "logo_base64", None)
    return data


@router.get("/empresa/link-pago/activos", response_model=List[schemas.LinkPagoOut])
def list_links_pago_activos(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Lista TODOS los links de pago activos de la empresa — cada uno se
    muestra como su propio método de pago al cobrar una venta (Nequi,
    Bancolombia, etc. pueden coexistir)."""
    links = (
        db.query(models.LinkPagoEmpresa)
        .filter_by(empresa_id=current_user.empresa_id, is_active=True)
        .order_by(models.LinkPagoEmpresa.nombre.asc())
        .all()
    )
    empresa = db.query(models.Empresa).filter(models.Empresa.id == current_user.empresa_id).first()
    logo_base64 = getattr(empresa, "logo_base64", None)
    result = []
    for link in links:
        data = schemas.LinkPagoOut.model_validate(link).model_dump()
        data["logo_base64"] = logo_base64
        result.append(data)
    return result


@router.get("/empresa/link-pago/todos", response_model=List[schemas.LinkPagoOut])
def list_links_pago(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Lista todos los links de pago de la empresa (activos e inactivos) — usado
    en la pantalla de configuración para administrarlos."""
    return (
        db.query(models.LinkPagoEmpresa)
        .filter_by(empresa_id=current_user.empresa_id)
        .order_by(models.LinkPagoEmpresa.id.desc())
        .all()
    )


@router.post("/empresa/link-pago", response_model=schemas.LinkPagoOut)
def create_link_pago(
    payload: schemas.LinkPagoCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Crea un nuevo link/QR de pago de la empresa. Una empresa puede tener
    varios simultáneamente (Nequi, Bancolombia, Daviplata, etc.), cada uno
    aparece como su propio método de pago al cobrar."""
    if payload.tipo == "url" and not payload.link_url:
        raise HTTPException(status_code=400, detail="Se requiere link_url para tipo 'url'.")
    if payload.tipo == "qr_imagen" and not payload.qr_base64:
        raise HTTPException(status_code=400, detail="Se requiere qr_base64 para tipo 'qr_imagen'.")

    link = models.LinkPagoEmpresa(
        empresa_id=current_user.empresa_id,
        nombre=payload.nombre,
        tipo=payload.tipo,
        link_url=payload.link_url,
        qr_base64=payload.qr_base64,
        qr_mime_type=payload.qr_mime_type,
        instrucciones=payload.instrucciones,
        is_active=payload.is_active,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.put("/empresa/link-pago/{link_id}", response_model=schemas.LinkPagoOut)
def update_link_pago(
    link_id: int,
    payload: schemas.LinkPagoCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    link = db.query(models.LinkPagoEmpresa).filter_by(
        id=link_id, empresa_id=current_user.empresa_id
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link de pago no encontrado.")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(link, field, val)
    db.commit()
    db.refresh(link)
    return link


@router.delete("/empresa/link-pago/{link_id}", status_code=204)
def delete_link_pago(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    link = db.query(models.LinkPagoEmpresa).filter_by(
        id=link_id, empresa_id=current_user.empresa_id
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link de pago no encontrado.")
    db.delete(link)
    db.commit()


@router.get("/empresa/config-ventas")
def get_config_ventas(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    empresa = db.query(models.Empresa).filter_by(id=current_user.empresa_id).first()
    return {
        "omitir_inventario":       getattr(empresa, "omitir_inventario",       False) or False,
        "fidelizacion_activa":     getattr(empresa, "fidelizacion_activa",     True)  if getattr(empresa, "fidelizacion_activa", None) is not None else True,
        "fidelizacion_earn_rate":  getattr(empresa, "fidelizacion_earn_rate",  1000)  or 1000,
        "fidelizacion_redeem_rate":getattr(empresa, "fidelizacion_redeem_rate",100)   or 100,
    }


@router.get("/empresa/mi-cuenta")
def get_mi_cuenta(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Devuelve los datos visibles de la empresa y del usuario administrador."""
    empresa = db.query(models.Empresa).filter_by(id=current_user.empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada.")
    return {
        "empresa": {
            "nombre":         empresa.nombre,
            "nit":            empresa.nit,
            "ciudad":         empresa.ciudad,
            "pais":           empresa.pais,
            "tamano_negocio": empresa.tamano_negocio,
            "logo_base64":    empresa.logo_base64,
        },
        "usuario": {
            "username":        current_user.username,
            "nombre_completo": current_user.nombre_completo,
            "email":           current_user.email,
            "telefono":        current_user.telefono,
        },
    }


@router.put("/empresa/mi-cuenta")
def update_mi_cuenta(
    payload: schemas.MiCuentaUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Actualiza los campos editables de la empresa y del usuario administrador."""
    empresa = db.query(models.Empresa).filter_by(id=current_user.empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada.")

    if payload.empresa_nombre is not None and payload.empresa_nombre.strip():
        empresa.nombre = payload.empresa_nombre.strip()
    if payload.ciudad is not None:
        empresa.ciudad = payload.ciudad.strip()
    if payload.pais is not None:
        empresa.pais = payload.pais
    if payload.tamano_negocio is not None:
        empresa.tamano_negocio = payload.tamano_negocio

    if payload.nombre_completo is not None:
        current_user.nombre_completo = payload.nombre_completo.strip()
    if payload.email is not None and payload.email.strip():
        email_lower = payload.email.strip().lower()
        taken = db.query(models.User).filter(
            models.User.email == email_lower,
            models.User.id != current_user.id
        ).first()
        if taken:
            raise HTTPException(status_code=400, detail="Este correo ya está en uso por otra cuenta.")
        current_user.email = email_lower
    if payload.telefono is not None:
        current_user.telefono = payload.telefono.strip()

    db.commit()
    return {"message": "Datos actualizados correctamente."}


@router.put("/empresa/mi-cuenta/password")
def change_password_mi_cuenta(
    payload: schemas.CambiarPasswordMiCuentaRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Cambia la contraseña del usuario autenticado (no requiere contraseña actual)."""
    current_user.hashed_password = security.get_password_hash(payload.nueva_password)
    db.commit()
    return {"message": "Contraseña actualizada correctamente."}


@router.put("/empresa/config-ventas")
def update_config_ventas(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    empresa = db.query(models.Empresa).filter_by(id=current_user.empresa_id).first()
    if empresa is None:
        raise HTTPException(status_code=404, detail="Empresa no encontrada.")
    if "omitir_inventario" in payload:
        empresa.omitir_inventario = bool(payload["omitir_inventario"])
    if "fidelizacion_activa" in payload:
        empresa.fidelizacion_activa = bool(payload["fidelizacion_activa"])
    if "fidelizacion_earn_rate" in payload:
        rate = int(payload["fidelizacion_earn_rate"])
        if rate < 1:
            raise HTTPException(status_code=400, detail="earn_rate debe ser >= 1.")
        empresa.fidelizacion_earn_rate = rate
    if "fidelizacion_redeem_rate" in payload:
        rate = int(payload["fidelizacion_redeem_rate"])
        if rate < 1:
            raise HTTPException(status_code=400, detail="redeem_rate debe ser >= 1.")
        empresa.fidelizacion_redeem_rate = rate
    db.commit()
    return {
        "omitir_inventario":        empresa.omitir_inventario,
        "fidelizacion_activa":      empresa.fidelizacion_activa,
        "fidelizacion_earn_rate":   empresa.fidelizacion_earn_rate,
        "fidelizacion_redeem_rate": empresa.fidelizacion_redeem_rate,
    }


@router.get("/empresa/config-fe")
def get_config_fe(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Devuelve la configuración de Facturación Electrónica de la empresa.

    Las API keys de Matías NUNCA se devuelven en texto plano: son secretos que
    autentican contra el proveedor de facturación electrónica, y reenviarlos
    en cada GET (a la pestaña de red del navegador, logs, extensiones) es
    superficie de exposición innecesaria. Se informa solo si cada una está
    configurada y una vista enmascarada (últimos 4 caracteres) para que el
    usuario confirme cuál tiene puesta sin volver a verla completa.
    """
    empresa = db.query(models.Empresa).filter_by(id=current_user.empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada.")

    def _mask(key: Optional[str]) -> Optional[str]:
        if not key:
            return None
        return f"••••{key[-4:]}" if len(key) > 4 else "••••"

    api_key         = getattr(empresa, "matias_api_key", None)
    sandbox_api_key = getattr(empresa, "matias_sandbox_api_key", None)
    return {
        "facturacion_electronica_activa": getattr(empresa, "facturacion_electronica_activa", False) or False,
        "matias_api_key_configurada":         bool(api_key),
        "matias_api_key_preview":             _mask(api_key),
        "matias_sandbox_api_key_configurada": bool(sandbox_api_key),
        "matias_sandbox_api_key_preview":     _mask(sandbox_api_key),
        "matias_test_mode":               getattr(empresa, "matias_test_mode", True) if getattr(empresa, "matias_test_mode", None) is not None else True,
    }


@router.put("/empresa/config-fe")
def update_config_fe(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Actualiza la configuración de Facturación Electrónica de la empresa."""
    empresa = db.query(models.Empresa).filter_by(id=current_user.empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada.")

    if "facturacion_electronica_activa" in payload:
        quiere_activar = bool(payload["facturacion_electronica_activa"])
        if quiere_activar:
            # Verificar que el plan activo incluya FE
            ultimo_pago = (
                db.query(models.RegistroPago)
                .filter(models.RegistroPago.empresa_id == current_user.empresa_id)
                .order_by(models.RegistroPago.fecha_pago.desc())
                .first()
            )
            plan_incluye_fe = True  # Por defecto se permite (trial, vitalicio, etc.)
            if ultimo_pago and ultimo_pago.plan:
                plan_incluye_fe = getattr(ultimo_pago.plan, "incluye_fe", True)
                if plan_incluye_fe is None:
                    plan_incluye_fe = True
            if not plan_incluye_fe:
                raise HTTPException(
                    status_code=403,
                    detail="Tu plan actual no incluye facturación electrónica. Actualiza tu suscripción.",
                )
        empresa.facturacion_electronica_activa = quiere_activar
    # Solo se actualiza la key si el usuario escribió un valor nuevo: el
    # frontend ya no conoce la key real (el GET la enmascara), así que un
    # campo vacío o ausente significa "no tocar la que ya está configurada".
    # Se rechaza además cualquier valor que luzca como el placeholder
    # enmascarado ("••••1234"), por si el frontend lo reenvía sin querer.
    if payload.get("matias_api_key"):
        key = payload["matias_api_key"].strip()
        if key and not key.startswith("••••"):
            empresa.matias_api_key = key
    if payload.get("matias_sandbox_api_key"):
        key = payload["matias_sandbox_api_key"].strip()
        if key and not key.startswith("••••"):
            empresa.matias_sandbox_api_key = key
    if "matias_test_mode" in payload:
        empresa.matias_test_mode = bool(payload["matias_test_mode"])

    db.commit()

    def _mask(key: Optional[str]) -> Optional[str]:
        if not key:
            return None
        return f"••••{key[-4:]}" if len(key) > 4 else "••••"

    return {
        "facturacion_electronica_activa":     empresa.facturacion_electronica_activa,
        "matias_api_key_configurada":         bool(empresa.matias_api_key),
        "matias_api_key_preview":             _mask(empresa.matias_api_key),
        "matias_sandbox_api_key_configurada": bool(empresa.matias_sandbox_api_key),
        "matias_sandbox_api_key_preview":     _mask(empresa.matias_sandbox_api_key),
        "matias_test_mode":                   empresa.matias_test_mode,
    }
