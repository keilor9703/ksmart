from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

import models
import schemas
from services.contabilidad import inicializar_puc, PUC_DEFAULT


# ─── Cuentas contables ────────────────────────────────────────────────────────

def listar_cuentas(db: Session, empresa_id: int) -> List[models.CuentaContable]:
    inicializar_puc(db, empresa_id)
    db.commit()
    return (
        db.query(models.CuentaContable)
        .filter(models.CuentaContable.empresa_id == empresa_id,
                models.CuentaContable.is_active == True)
        .order_by(models.CuentaContable.codigo)
        .all()
    )


# ─── Asientos contables ───────────────────────────────────────────────────────

def listar_asientos(
    db: Session,
    empresa_id: int,
    skip: int = 0,
    limit: int = 50,
    tipo_origen: Optional[str] = None,
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
) -> Tuple[List[models.AsientoContable], int]:
    q = (
        db.query(models.AsientoContable)
        .options(
            joinedload(models.AsientoContable.lineas)
            .joinedload(models.LineaAsiento.cuenta)
        )
        .filter(models.AsientoContable.empresa_id == empresa_id)
    )
    if tipo_origen:
        q = q.filter(models.AsientoContable.tipo_origen == tipo_origen)
    if fecha_inicio:
        q = q.filter(models.AsientoContable.fecha >= fecha_inicio)
    if fecha_fin:
        q = q.filter(models.AsientoContable.fecha <= fecha_fin)

    total = q.count()
    items = q.order_by(models.AsientoContable.numero.desc()).offset(skip).limit(limit).all()
    return items, total


def get_asiento(db: Session, empresa_id: int, asiento_id: int) -> Optional[models.AsientoContable]:
    return (
        db.query(models.AsientoContable)
        .options(
            joinedload(models.AsientoContable.lineas)
            .joinedload(models.LineaAsiento.cuenta)
        )
        .filter(
            models.AsientoContable.empresa_id == empresa_id,
            models.AsientoContable.id == asiento_id,
        )
        .first()
    )


# ─── Balance de comprobación ──────────────────────────────────────────────────

def get_balance_comprobacion(
    db: Session,
    empresa_id: int,
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
) -> List[schemas.BalanceComprobacionItem]:
    inicializar_puc(db, empresa_id)
    db.commit()

    cuentas = (
        db.query(models.CuentaContable)
        .filter(
            models.CuentaContable.empresa_id == empresa_id,
            models.CuentaContable.is_active == True,
            models.CuentaContable.permite_movimiento == True,
        )
        .order_by(models.CuentaContable.codigo)
        .all()
    )

    result = []
    for cuenta in cuentas:
        q = db.query(
            func.coalesce(func.sum(models.LineaAsiento.debito), 0).label("total_d"),
            func.coalesce(func.sum(models.LineaAsiento.credito), 0).label("total_c"),
        ).join(
            models.AsientoContable,
            models.LineaAsiento.asiento_id == models.AsientoContable.id,
        ).filter(
            models.LineaAsiento.cuenta_contable_id == cuenta.id,
            models.LineaAsiento.empresa_id == empresa_id,
        )
        if fecha_inicio:
            q = q.filter(models.AsientoContable.fecha >= fecha_inicio)
        if fecha_fin:
            q = q.filter(models.AsientoContable.fecha <= fecha_fin)

        row = q.one()
        total_d = float(row.total_d)
        total_c = float(row.total_c)

        if total_d == 0 and total_c == 0:
            continue

        saldo_d = max(0.0, total_d - total_c) if cuenta.naturaleza == "debito" else 0.0
        saldo_c = max(0.0, total_c - total_d) if cuenta.naturaleza == "credito" else 0.0

        result.append(schemas.BalanceComprobacionItem(
            codigo=cuenta.codigo,
            nombre=cuenta.nombre,
            tipo=cuenta.tipo,
            naturaleza=cuenta.naturaleza,
            total_debitos=total_d,
            total_creditos=total_c,
            saldo_debito=saldo_d,
            saldo_credito=saldo_c,
        ))
    return result


# ─── Estado de resultados ─────────────────────────────────────────────────────

def get_estado_resultados(
    db: Session,
    empresa_id: int,
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
) -> schemas.EstadoResultados:
    inicializar_puc(db, empresa_id)
    db.commit()

    def _suma(codigos: List[str], es_debito_resta: bool = False) -> float:
        cuentas_ids = [
            c.id for c in db.query(models.CuentaContable).filter(
                models.CuentaContable.empresa_id == empresa_id,
                models.CuentaContable.codigo.in_(codigos),
            ).all()
        ]
        if not cuentas_ids:
            return 0.0
        q = db.query(
            func.coalesce(func.sum(models.LineaAsiento.debito), 0).label("d"),
            func.coalesce(func.sum(models.LineaAsiento.credito), 0).label("c"),
        ).join(
            models.AsientoContable,
            models.LineaAsiento.asiento_id == models.AsientoContable.id,
        ).filter(
            models.LineaAsiento.cuenta_contable_id.in_(cuentas_ids),
            models.LineaAsiento.empresa_id == empresa_id,
        )
        if fecha_inicio:
            q = q.filter(models.AsientoContable.fecha >= fecha_inicio)
        if fecha_fin:
            q = q.filter(models.AsientoContable.fecha <= fecha_fin)
        row = q.one()
        d, c = float(row.d), float(row.c)
        # Cuentas de ingreso (naturaleza crédito): saldo = credito - debito
        # Cuentas de gasto/costo (naturaleza débito): saldo = debito - credito
        return (d - c) if es_debito_resta else (c - d)

    ing_operacional = _suma(["4135"])
    ing_servicios   = _suma(["4175"])
    ing_financiero  = _suma(["4210"])
    total_ingresos  = ing_operacional + ing_servicios + ing_financiero
    costo_ventas    = _suma(["6135"], es_debito_resta=True)
    utilidad_bruta  = total_ingresos - costo_ventas
    gastos_oper     = _suma(["5105", "5195"], es_debito_resta=True)
    gastos_no_oper  = _suma(["5305"], es_debito_resta=True)
    total_gastos    = gastos_oper + gastos_no_oper
    utilidad_neta   = utilidad_bruta - total_gastos

    return schemas.EstadoResultados(
        ingresos_operacionales=ing_operacional,
        ingresos_servicios=ing_servicios,
        ingresos_financieros=ing_financiero,
        total_ingresos=total_ingresos,
        costo_ventas=costo_ventas,
        utilidad_bruta=utilidad_bruta,
        gastos_operacionales=gastos_oper,
        gastos_no_operacionales=gastos_no_oper,
        total_gastos=total_gastos,
        utilidad_neta=utilidad_neta,
        periodo_inicio=fecha_inicio,
        periodo_fin=fecha_fin,
    )
