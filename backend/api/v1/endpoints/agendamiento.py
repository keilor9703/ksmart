"""
Endpoints del módulo de Agendamiento de Citas.

- Configuración: horario, días laborables, políticas de anticipo (admin).
- Servicios agendables y asignación de trabajadores.
- Disponibilidad (admin y portal público).
- CRUD de citas + cobro que genera una Venta en el sistema ERP.
- Portal público sin autenticación (/{slug}/agendar).
"""
from typing import List, Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import crud
import schemas
import models
from api.deps import get_db, get_current_active_user

router = APIRouter()


def _es_admin(user: models.User) -> bool:
    return bool(getattr(user, "role", None) and user.role.name == "Admin")


def _assert_puede_gestionar(db: Session, current_user: models.User, cita_id: int):
    """Un trabajador (no admin) solo puede gestionar sus propias citas."""
    if _es_admin(current_user):
        return
    cita = (
        db.query(models.Cita)
        .filter(models.Cita.id == cita_id, models.Cita.empresa_id == current_user.empresa_id)
        .first()
    )
    if cita and cita.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Solo puedes gestionar las citas asignadas a ti.",
        )


# ──────────────────────────────────────────────────────────────────────────────
# Configuración de horario y políticas
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/config", response_model=schemas.AgendamientoConfigOut)
def get_config(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_or_create_agendamiento_config(db, empresa_id=current_user.empresa_id)


@router.put("/config", response_model=schemas.AgendamientoConfigOut)
def update_config(
    payload: schemas.AgendamientoConfigUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.update_agendamiento_config(db, empresa_id=current_user.empresa_id, data=payload)


# ──────────────────────────────────────────────────────────────────────────────
# Servicios agendables y trabajadores
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/servicios", response_model=List[schemas.ServicioAgendable])
def listar_servicios_agendables(
    solo_activos: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_servicios_agendables(db, empresa_id=current_user.empresa_id, solo_activos=solo_activos)


@router.put("/servicios/{producto_id}", response_model=schemas.ServicioAgendable)
def configurar_servicio(
    producto_id: int,
    payload: schemas.ServicioAgendableUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    prod = crud.configurar_servicio_agendable(
        db, empresa_id=current_user.empresa_id, producto_id=producto_id, data=payload
    )
    if not prod:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    return prod


# ──────────────────────────────────────────────────────────────────────────────
# Disponibilidad
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/disponibilidad", response_model=schemas.DisponibilidadResponse)
def disponibilidad(
    producto_id: int = Query(...),
    fecha: date = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.calcular_disponibilidad(
        db, empresa_id=current_user.empresa_id, producto_id=producto_id, dia=fecha
    )


# ──────────────────────────────────────────────────────────────────────────────
# CRUD de Citas
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/citas", response_model=List[schemas.CitaFull])
def listar_citas(
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
    user_id: Optional[int] = None,
    estado: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    # Un trabajador (no admin) solo ve las citas asignadas a él, sin importar el filtro.
    if not _es_admin(current_user):
        user_id = current_user.id
    return crud.get_citas(
        db, empresa_id=current_user.empresa_id,
        desde=desde, hasta=hasta, user_id=user_id, estado=estado,
    )


@router.get("/citas/{cita_id}", response_model=schemas.CitaFull)
def obtener_cita(
    cita_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    cita = crud.get_cita(db, empresa_id=current_user.empresa_id, cita_id=cita_id)
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    return cita


@router.post("/citas", response_model=schemas.CitaFull)
def crear_cita(
    payload: schemas.CitaCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    try:
        return crud.create_cita(db, empresa_id=current_user.empresa_id, data=payload)
    except crud.AgendamientoError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.put("/citas/{cita_id}", response_model=schemas.CitaFull)
def actualizar_cita(
    cita_id: int,
    payload: schemas.CitaUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    _assert_puede_gestionar(db, current_user, cita_id)
    try:
        cita = crud.update_cita(db, empresa_id=current_user.empresa_id, cita_id=cita_id, data=payload)
    except crud.AgendamientoError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    return cita


@router.patch("/citas/{cita_id}/estado", response_model=schemas.CitaFull)
def cambiar_estado(
    cita_id: int,
    estado: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    _assert_puede_gestionar(db, current_user, cita_id)
    try:
        cita = crud.cambiar_estado_cita(db, empresa_id=current_user.empresa_id, cita_id=cita_id, estado=estado)
    except crud.AgendamientoError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    return cita


@router.post("/citas/{cita_id}/cobrar", response_model=schemas.CitaFull)
def cobrar_cita(
    cita_id: int,
    payload: schemas.CobrarCitaRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Convierte la cita en una Venta en el ERP y la marca como completada."""
    _assert_puede_gestionar(db, current_user, cita_id)
    try:
        return crud.cobrar_cita(db, empresa_id=current_user.empresa_id, cita_id=cita_id, data=payload)
    except crud.AgendamientoError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.delete("/citas/{cita_id}")
def eliminar_cita(
    cita_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    _assert_puede_gestionar(db, current_user, cita_id)
    ok = crud.delete_cita(db, empresa_id=current_user.empresa_id, cita_id=cita_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    return {"message": "Cita eliminada correctamente"}


# ──────────────────────────────────────────────────────────────────────────────
# 🌐 PORTAL PÚBLICO (sin autenticación)
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/publico/{slug}", response_model=schemas.AgendamientoPublicoInfo)
def info_publica(slug: str, db: Session = Depends(get_db)):
    empresa = crud.get_empresa_by_slug(db, slug=slug)
    if not empresa:
        raise HTTPException(status_code=404, detail="Página de agendamiento no encontrada")
    servicios = crud.get_servicios_agendables(db, empresa_id=empresa.id, solo_activos=True)
    servicios = [s for s in servicios if getattr(s, "trabajadores", None)]
    cfg = crud.get_or_create_agendamiento_config(db, empresa_id=empresa.id)

    import json as _json
    def _image_count(p):
        imgs = getattr(p, "imagenes", None)
        if not imgs:
            return 0
        if isinstance(imgs, list):
            return len(imgs)
        try:
            return len(_json.loads(imgs))
        except Exception:
            return 0

    servicios_out = [
        schemas.ServicioPublico(
            id=s.id,
            nombre=s.nombre,
            descripcion=getattr(s, "descripcion", None),
            precio=getattr(s, "precio", None),
            duracion_minutos=getattr(s, "duracion_minutos", None),
            image_count=_image_count(s),
        )
        for s in servicios
    ]

    # Link de pago activo para mostrar QR/enlace de anticipo en el portal público.
    link_pago_out = None
    if cfg.requiere_anticipo:
        link = (
            db.query(models.LinkPagoEmpresa)
            .filter_by(empresa_id=empresa.id, is_active=True)
            .first()
        )
        if link:
            link_pago_out = schemas.LinkPagoPublico(
                tipo=link.tipo,
                link_url=link.link_url,
                qr_base64=link.qr_base64,
                qr_mime_type=link.qr_mime_type,
                instrucciones=link.instrucciones,
            )

    return schemas.AgendamientoPublicoInfo(
        empresa_nombre=empresa.nombre,
        slug=slug,
        logo_base64=getattr(empresa, "logo_base64", None),
        servicios=servicios_out,
        whatsapp=cfg.whatsapp,
        requiere_anticipo=cfg.requiere_anticipo,
        porcentaje_anticipo=cfg.porcentaje_anticipo,
        link_pago=link_pago_out,
    )


@router.get("/publico/{slug}/disponibilidad", response_model=schemas.DisponibilidadResponse)
def disponibilidad_publica(
    slug: str,
    producto_id: int = Query(...),
    fecha: date = Query(...),
    db: Session = Depends(get_db),
):
    empresa = crud.get_empresa_by_slug(db, slug=slug)
    if not empresa:
        raise HTTPException(status_code=404, detail="Página de agendamiento no encontrada")
    return crud.calcular_disponibilidad(db, empresa_id=empresa.id, producto_id=producto_id, dia=fecha)


@router.post("/publico/{slug}/cita", response_model=schemas.CitaPublicaResponse, status_code=201)
def crear_cita_publica(
    slug: str,
    payload: schemas.CitaPublicaCreate,
    db: Session = Depends(get_db),
):
    empresa = crud.get_empresa_by_slug(db, slug=slug)
    if not empresa:
        raise HTTPException(status_code=404, detail="Página de agendamiento no encontrada")
    data = schemas.CitaCreate(
        producto_id=payload.producto_id,
        user_id=payload.user_id,
        cliente_id=None,
        fecha_inicio=payload.fecha_inicio,
        cliente_nombre=payload.cliente_nombre,
        cliente_telefono=payload.cliente_telefono,
        cliente_email=payload.cliente_email,
        notas=payload.notas,
    )
    try:
        cita = crud.create_cita(db, empresa_id=empresa.id, data=data, notificar=True)
    except crud.AgendamientoError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return cita
