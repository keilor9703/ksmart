from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
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

@router.get("/empresas", response_model=List[schemas.EmpresaOut])
def listar_empresas(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_empresas(db, skip=skip, limit=limit)

@router.post("/empresas", response_model=schemas.EmpresaOut)
def registrar_nueva_empresa(data: schemas.EmpresaWithAdminCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_empresa_with_admin(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/empresas/{empresa_id}/toggle", response_model=schemas.EmpresaOut)
def suspender_activar_empresa(empresa_id: int, db: Session = Depends(get_db)):
    if empresa_id == 1:
        raise HTTPException(status_code=400, detail="No puedes suspender la empresa maestra del SaaS.")
    empresa = crud.toggle_empresa_status(db, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return empresa

@router.patch("/empresas/{empresa_id}/plan", response_model=schemas.EmpresaOut)
def actualizar_plan_empresa(empresa_id: int, plan_data: schemas.EmpresaPlanUpdate, db: Session = Depends(get_db)):
    if empresa_id == 1:
        raise HTTPException(status_code=400, detail="La empresa maestra no puede modificar su plan vitalicio.")
    empresa = crud.update_empresa_plan(db, empresa_id, plan_data)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return empresa

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
