from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

import crud
import models
import schemas
from api.deps import get_db, get_current_superadmin_user
from core.security import create_access_token

router = APIRouter(
    tags=["SaaS SuperAdmin"],
    dependencies=[Depends(get_current_superadmin_user)]
)

from services.jobs_service import SaaSJobService

@router.get("/empresas", response_model=List[schemas.EmpresaMetricsOut])
def listar_empresas(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_empresas(db, skip=skip, limit=limit)

@router.post("/empresas", response_model=schemas.EmpresaOut)
def registrar_nueva_empresa(
    data: schemas.EmpresaWithAdminCreate, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user)
):
    try:
        return crud.create_empresa_with_admin(db, data, admin_id=current_admin.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/empresas/{empresa_id}/toggle", response_model=schemas.EmpresaOut)
def suspender_activar_empresa(
    empresa_id: int, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user)
):
    if empresa_id == 1:
        raise HTTPException(status_code=400, detail="No puedes suspender la empresa maestra del SaaS.")
    empresa = crud.toggle_empresa_status(db, empresa_id, admin_id=current_admin.id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return empresa

@router.patch("/empresas/{empresa_id}/plan", response_model=schemas.EmpresaOut)
def actualizar_plan_empresa(
    empresa_id: int, 
    plan_data: schemas.EmpresaPlanUpdate, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user)
):
    if empresa_id == 1:
        raise HTTPException(status_code=400, detail="La empresa maestra no puede modificar su plan vitalicio.")
    empresa = crud.update_empresa_plan(db, empresa_id, plan_data, admin_id=current_admin.id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return empresa

@router.patch("/empresas/{empresa_id}/protection", response_model=schemas.EmpresaOut)
def toggle_protection_empresa(
    empresa_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user)
):
    """Protege una empresa contra automatizaciones de expiración"""
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    empresa.is_protected = not empresa.is_protected
    crud.log_saas_event(db, current_admin.id, "TOGGLE_PROTECTION", empresa_id, {"is_protected": empresa.is_protected})
    db.commit()
    db.refresh(empresa)
    return empresa

@router.get("/dashboard-stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Métricas globales para el panel ejecutivo del SuperAdmin"""
    total_tenants = db.query(models.Empresa).count()
    activos = db.query(models.Empresa).filter(models.Empresa.is_active == True).count()
    premium = db.query(models.Empresa).filter(models.Empresa.plan_type == 'premium').count()
    
    # Recaudado total (simple sum)
    total_recaudado = db.query(func.sum(models.RegistroPago.monto)).scalar() or 0
    
    # Usuarios totales en todo el sistema
    total_usuarios = db.query(models.User).count()

    return {
        "total_tenants": total_tenants,
        "activos": activos,
        "premium": premium,
        "total_recaudado": total_recaudado,
        "total_usuarios": total_usuarios
    }

@router.get("/audit-logs", response_model=List[schemas.SaaSAuditLogOut])
def listar_logs_auditoria(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    logs = db.query(models.SaaSAuditLog).options(
        joinedload(models.SaaSAuditLog.admin),
        joinedload(models.SaaSAuditLog.empresa)
    ).order_by(models.SaaSAuditLog.fecha.desc()).offset(skip).limit(limit).all()
    
    return [
        {
            **log.__dict__,
            "admin_username": log.admin.username if log.admin else "Sistema",
            "empresa_nombre": log.empresa.nombre if log.empresa else "Global"
        }
        for log in logs
    ]

# ─── ANUNCIOS SAAS ────────────────────────────────────────────────────────────

@router.get("/announcements", response_model=List[schemas.SaaSAnnouncementOut])
def listar_anuncios(db: Session = Depends(get_db)):
    return db.query(models.SaaSAnnouncement).order_by(models.SaaSAnnouncement.created_at.desc()).all()

@router.post("/announcements", response_model=schemas.SaaSAnnouncementOut)
def crear_anuncio(
    data: schemas.SaaSAnnouncementCreate, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user)
):
    db_ann = models.SaaSAnnouncement(
        **data.dict(),
        created_by=current_admin.id
    )
    db.add(db_ann)
    db.commit()
    db.refresh(db_ann)
    crud.log_saas_event(db, current_admin.id, "CREATE_ANNOUNCEMENT", None, {"titulo": data.titulo})
    return db_ann

@router.patch("/announcements/{ann_id}/toggle")
def toggle_anuncio(
    ann_id: int, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user)
):
    db_ann = db.query(models.SaaSAnnouncement).filter(models.SaaSAnnouncement.id == ann_id).first()
    if not db_ann:
        raise HTTPException(status_code=404, detail="Anuncio no encontrado")
    db_ann.is_active = not db_ann.is_active
    db.commit()
    return {"msg": "Estado de anuncio actualizado"}

# ─── JOBS Y AUTOMATIZACIÓN ──────────────────────────────────────────────────

@router.post("/jobs/run-expiration")
def ejecutar_job_expiracion(
    dry_run: bool = False, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user)
):
    """Ejecuta manualmente el proceso de expiración de trials"""
    results = SaaSJobService.run_trial_expiration_job(db, dry_run=dry_run)
    return results

@router.get("/jobs/history", response_model=List[schemas.SaaSJobRegistryOut])
def listar_historial_jobs(limit: int = 20, db: Session = Depends(get_db)):
    return db.query(models.SaaSJobRegistry).order_by(models.SaaSJobRegistry.started_at.desc()).limit(limit).all()


@router.get("/planes", response_model=List[schemas.PlanSuscripcionOut])
def listar_planes_admin(db: Session = Depends(get_db)):
    return crud.get_planes(db, include_inactive=True)

@router.post("/planes", response_model=schemas.PlanSuscripcionOut)
def crear_plan(plan: schemas.PlanSuscripcionCreate, db: Session = Depends(get_db)):
    existente = db.query(models.PlanSuscripcion).filter(
        models.PlanSuscripcion.codigo_interno == plan.codigo_interno
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe un plan con este código interno.")
    return crud.create_plan(db, plan)

@router.patch("/planes/{plan_id}", response_model=schemas.PlanSuscripcionOut)
def actualizar_plan(plan_id: int, plan_update: schemas.PlanSuscripcionUpdate, db: Session = Depends(get_db)):
    plan_actualizado = crud.update_plan(db, plan_id, plan_update)
    if not plan_actualizado:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    return plan_actualizado

@router.get("/historial-pagos", response_model=List[schemas.RegistroPagoOut])
def listar_historial_pagos(db: Session = Depends(get_db)):
    pagos = db.query(models.RegistroPago).options(
        joinedload(models.RegistroPago.empresa),
        joinedload(models.RegistroPago.plan)
    ).order_by(models.RegistroPago.fecha_pago.desc()).all()

    return [
        {**p.__dict__, "empresa_nombre": p.empresa.nombre, "plan_nombre": p.plan.nombre}
        for p in pagos
    ]

@router.post("/impersonate/{empresa_id}")
def impersonate_company(
    empresa_id: int,
    db: Session = Depends(get_db),
    current_admin: schemas.User = Depends(get_current_superadmin_user)
):
    target_user = db.query(models.User).filter(
        models.User.empresa_id == empresa_id
    ).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="No se encontró un usuario para esta empresa.")

    access_token = create_access_token(
        data={
            "sub": target_user.username,
            "empresa_id": target_user.empresa_id,
            "role": target_user.role.name if target_user.role else "Admin",
            "is_impersonated": True
        }
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/notificar-vencimientos-lotes", dependencies=[])
def notificar_vencimientos_lotes(db: Session = Depends(get_db)):
    """
    Genera notificaciones de vencimiento para todas las empresas activas.
    """
    total = crud.notificar_vencimientos_proximos(db)
    return {"msg": f"Se generaron {total} notificaciones de vencimiento."}
