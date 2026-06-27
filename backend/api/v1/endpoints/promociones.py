"""
Endpoints de códigos promocionales.

- POST /promociones/validar  — valida un código para un plan (usuario autenticado);
  devuelve el descuento y el precio final para previsualizar antes de pagar.
- CRUD bajo /promociones/admin — solo superadmin.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models, schemas
from api.deps import get_db, get_current_active_user, get_current_superadmin_user
from crud import promociones as crud_promo

router = APIRouter()


@router.post("/validar", response_model=schemas.ValidarCodigoResponse)
def validar_codigo(
    payload: schemas.ValidarCodigoRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    q = db.query(models.PlanSuscripcion).filter(models.PlanSuscripcion.is_active == True)
    if payload.plan_id is not None:
        plan = q.filter(models.PlanSuscripcion.id == payload.plan_id).first()
    elif payload.plan_name:
        plan = q.filter(models.PlanSuscripcion.codigo_interno == payload.plan_name).first()
    else:
        raise HTTPException(status_code=400, detail="Indica el plan (plan_id o plan_name).")
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado.")

    cod, descuento, motivo = crud_promo.validar_codigo(
        db, payload.codigo, plan, current_user.empresa_id
    )
    precio = float(plan.precio or 0)
    if motivo:
        return schemas.ValidarCodigoResponse(
            valido=False, motivo=motivo, precio_original=precio, precio_final=precio,
        )
    return schemas.ValidarCodigoResponse(
        valido=True, codigo=cod.codigo, tipo=cod.tipo, valor=cod.valor,
        descuento=descuento, precio_original=precio, precio_final=max(0.0, precio - descuento),
    )


# ── CRUD superadmin ───────────────────────────────────────────────────────────
@router.get("/admin", response_model=List[schemas.CodigoPromocionalOut],
            dependencies=[Depends(get_current_superadmin_user)])
def listar_codigos(db: Session = Depends(get_db)):
    return crud_promo.listar(db)


@router.post("/admin", response_model=schemas.CodigoPromocionalOut,
             dependencies=[Depends(get_current_superadmin_user)])
def crear_codigo(data: schemas.CodigoPromocionalCreate, db: Session = Depends(get_db)):
    if crud_promo.obtener_por_codigo(db, data.codigo):
        raise HTTPException(status_code=400, detail="Ya existe un código con ese nombre.")
    if data.tipo not in ("porcentaje", "fijo"):
        raise HTTPException(status_code=400, detail="Tipo inválido (porcentaje | fijo).")
    return crud_promo.crear(db, data)


@router.put("/admin/{codigo_id}", response_model=schemas.CodigoPromocionalOut,
            dependencies=[Depends(get_current_superadmin_user)])
def actualizar_codigo(codigo_id: int, data: schemas.CodigoPromocionalUpdate, db: Session = Depends(get_db)):
    cod = crud_promo.actualizar(db, codigo_id, data)
    if not cod:
        raise HTTPException(status_code=404, detail="Código no encontrado.")
    return cod


@router.delete("/admin/{codigo_id}", dependencies=[Depends(get_current_superadmin_user)])
def eliminar_codigo(codigo_id: int, db: Session = Depends(get_db)):
    if not crud_promo.eliminar(db, codigo_id):
        raise HTTPException(status_code=404, detail="Código no encontrado.")
    return {"status": "ok"}
