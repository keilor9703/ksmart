from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

import crud
import schemas
from api.v1.endpoints.auth import get_current_active_user
from database import SessionLocal

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── Plan de cuentas ──────────────────────────────────────────────────────────

@router.get("/cuentas", response_model=list[schemas.CuentaContableOut])
def listar_cuentas(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return crud.listar_cuentas(db, current_user.empresa_id)


# ─── Libro diario ─────────────────────────────────────────────────────────────

@router.get("/asientos", response_model=schemas.AsientosListResponse)
def listar_asientos(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    tipo_origen: Optional[str] = Query(None),
    fecha_inicio: Optional[datetime] = Query(None),
    fecha_fin: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    skip = (page - 1) * page_size
    items, total = crud.listar_asientos(
        db, current_user.empresa_id,
        skip=skip, limit=page_size,
        tipo_origen=tipo_origen,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
    )
    return schemas.AsientosListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/asientos/{asiento_id}", response_model=schemas.AsientoContableOut)
def get_asiento(
    asiento_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    a = crud.get_asiento(db, current_user.empresa_id, asiento_id)
    if not a:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Asiento no encontrado")
    return a


# ─── Balance de comprobación ──────────────────────────────────────────────────

@router.get("/balance-comprobacion", response_model=list[schemas.BalanceComprobacionItem])
def balance_comprobacion(
    fecha_inicio: Optional[datetime] = Query(None),
    fecha_fin: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return crud.get_balance_comprobacion(
        db, current_user.empresa_id, fecha_inicio, fecha_fin
    )


# ─── Estado de resultados ─────────────────────────────────────────────────────

@router.get("/estado-resultados", response_model=schemas.EstadoResultados)
def estado_resultados(
    fecha_inicio: Optional[datetime] = Query(None),
    fecha_fin: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return crud.get_estado_resultados(
        db, current_user.empresa_id, fecha_inicio, fecha_fin
    )


# ─── Balance General ──────────────────────────────────────────────────────────

@router.get("/balance-general")
def balance_general(
    fecha_corte: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return crud.get_balance_general(db, current_user.empresa_id, fecha_corte)


# ─── Resumen IVA ──────────────────────────────────────────────────────────────

@router.get("/resumen-iva", response_model=schemas.ResumenIVA)
def resumen_iva(
    fecha_inicio: Optional[datetime] = Query(None),
    fecha_fin: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return crud.get_resumen_iva(db, current_user.empresa_id, fecha_inicio, fecha_fin)


# ─── Asiento manual ───────────────────────────────────────────────────────────

@router.post("/asientos", response_model=schemas.AsientoContableOut)
def crear_asiento_manual(
    data: schemas.AsientoManualCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    lineas = [l.dict() for l in data.lineas]
    return crud.crear_asiento_manual(
        db, current_user.empresa_id,
        fecha=data.fecha, descripcion=data.descripcion, lineas=lineas,
    )


# ─── Cierres contables ────────────────────────────────────────────────────────

@router.get("/cierres", response_model=list[schemas.CierreContableOut])
def listar_cierres(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return crud.listar_cierres(db, current_user.empresa_id)


@router.post("/cierres", response_model=schemas.CierreContableOut)
def ejecutar_cierre(
    data: schemas.CierreContableCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return crud.ejecutar_cierre_contable(
        db, current_user.empresa_id,
        periodo_inicio=data.periodo_inicio,
        periodo_fin=data.periodo_fin,
        descripcion=data.descripcion or "",
        usuario_id=current_user.id,
    )


# ─── Backfill histórico ───────────────────────────────────────────────────────

@router.post("/inicializar")
def inicializar_contabilidad(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """
    Inicializa el PUC y genera asientos contables para todas las transacciones
    históricas que aún no los tienen. Idempotente — puede ejecutarse varias veces.
    """
    from services.contabilidad import backfill_contabilidad
    resumen = backfill_contabilidad(db, current_user.empresa_id)
    return {"ok": True, "asientos_creados": resumen}


# ─── Exportaciones ────────────────────────────────────────────────────────────

from fastapi.responses import Response

def _empresa_nombre(current_user) -> str:
    return getattr(getattr(current_user, "empresa", None), "nombre", "Empresa") or "Empresa"


@router.get("/exportar/libro-diario.xlsx")
def exportar_libro_diario_excel(
    fecha_inicio: Optional[datetime] = Query(None),
    fecha_fin: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    from services.exportacion_contable import exportar_libro_diario_excel as _exp
    data = _exp(db, current_user.empresa_id, fecha_inicio, fecha_fin)
    return Response(content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=libro_diario.xlsx"})


@router.get("/exportar/libro-diario.pdf")
def exportar_libro_diario_pdf(
    fecha_inicio: Optional[datetime] = Query(None),
    fecha_fin: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    from services.exportacion_contable import exportar_libro_diario_pdf as _exp
    data = _exp(db, current_user.empresa_id, fecha_inicio, fecha_fin, _empresa_nombre(current_user))
    return Response(content=data, media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=libro_diario.pdf"})


@router.get("/exportar/balance-comprobacion.xlsx")
def exportar_balance_comprobacion_excel(
    fecha_inicio: Optional[datetime] = Query(None),
    fecha_fin: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    from services.exportacion_contable import exportar_balance_comprobacion_excel as _exp
    data = _exp(db, current_user.empresa_id, fecha_inicio, fecha_fin)
    return Response(content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=balance_comprobacion.xlsx"})


@router.get("/exportar/estado-resultados.pdf")
def exportar_estado_resultados_pdf(
    fecha_inicio: Optional[datetime] = Query(None),
    fecha_fin: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    from services.exportacion_contable import exportar_estado_resultados_pdf as _exp
    data = _exp(db, current_user.empresa_id, fecha_inicio, fecha_fin, _empresa_nombre(current_user))
    return Response(content=data, media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=estado_resultados.pdf"})


@router.get("/exportar/balance-general.pdf")
def exportar_balance_general_pdf(
    fecha_corte: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    from services.exportacion_contable import exportar_balance_general_pdf as _exp
    data = _exp(db, current_user.empresa_id, fecha_corte, _empresa_nombre(current_user))
    return Response(content=data, media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=balance_general.pdf"})
