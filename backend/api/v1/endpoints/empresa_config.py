from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import models, schemas
from api.deps import get_db, get_current_active_user

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
