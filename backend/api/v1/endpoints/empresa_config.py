from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import models, schemas
from api.deps import get_db, get_current_active_user
from core import security

router = APIRouter()


def _get_link_activo(db: Session, empresa_id: int) -> Optional[models.LinkPagoEmpresa]:
    return (
        db.query(models.LinkPagoEmpresa)
        .filter_by(empresa_id=empresa_id, is_active=True)
        .first()
    )


@router.get("/empresa/link-pago", response_model=Optional[schemas.LinkPagoOut])
def get_link_pago(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Devuelve el link de pago activo de la empresa (o null si no tiene)."""
    return _get_link_activo(db, current_user.empresa_id)


@router.get("/empresa/link-pago/todos", response_model=List[schemas.LinkPagoOut])
def list_links_pago(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Lista todos los links de pago de la empresa."""
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
    """Crea o actualiza el link de pago de la empresa. Solo uno puede estar activo."""
    if payload.tipo == "url" and not payload.link_url:
        raise HTTPException(status_code=400, detail="Se requiere link_url para tipo 'url'.")
    if payload.tipo == "qr_imagen" and not payload.qr_base64:
        raise HTTPException(status_code=400, detail="Se requiere qr_base64 para tipo 'qr_imagen'.")

    # Si viene activo, desactivar el anterior
    if payload.is_active:
        db.query(models.LinkPagoEmpresa).filter_by(
            empresa_id=current_user.empresa_id, is_active=True
        ).update({"is_active": False})

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

    # Si se activa este, desactivar los demás
    if payload.is_active and not link.is_active:
        db.query(models.LinkPagoEmpresa).filter(
            models.LinkPagoEmpresa.empresa_id == current_user.empresa_id,
            models.LinkPagoEmpresa.id != link_id,
        ).update({"is_active": False})

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
    """Cambia la contraseña del usuario autenticado verificando la contraseña actual."""
    if not current_user.hashed_password or not security.verify_password(
        payload.password_actual, current_user.hashed_password
    ):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta.")
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
