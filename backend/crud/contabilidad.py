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
    gastos_personal = _suma(["5105"], es_debito_resta=True)
    gastos_generales= _suma(["5195"], es_debito_resta=True)
    gastos_no_oper  = _suma(["5305"], es_debito_resta=True)
    total_gastos    = gastos_personal + gastos_generales + gastos_no_oper
    utilidad_neta   = utilidad_bruta - total_gastos

    return schemas.EstadoResultados(
        ingresos_operacionales=ing_operacional,
        ingresos_servicios=ing_servicios,
        ingresos_financieros=ing_financiero,
        total_ingresos=total_ingresos,
        costo_ventas=costo_ventas,
        utilidad_bruta=utilidad_bruta,
        gastos_personal=gastos_personal,
        gastos_operacionales=gastos_generales,
        gastos_no_operacionales=gastos_no_oper,
        total_gastos=total_gastos,
        utilidad_neta=utilidad_neta,
        periodo_inicio=fecha_inicio,
        periodo_fin=fecha_fin,
    )


# ─── Balance General ──────────────────────────────────────────────────────────

def get_balance_general(
    db: Session,
    empresa_id: int,
    fecha_corte: Optional[datetime] = None,
) -> dict:
    inicializar_puc(db, empresa_id)
    db.commit()

    if fecha_corte is None:
        from datetime import timezone
        fecha_corte = datetime.now(timezone.utc)

    cuentas = (
        db.query(models.CuentaContable)
        .filter(
            models.CuentaContable.empresa_id == empresa_id,
            models.CuentaContable.is_active == True,
            models.CuentaContable.permite_movimiento == True,
        )
        .all()
    )

    secciones: dict = {
        "activos": [],
        "pasivos": [],
        "patrimonio": [],
        "total_activos": 0.0,
        "total_pasivos": 0.0,
        "total_patrimonio": 0.0,
        "fecha_corte": fecha_corte,
    }

    for cuenta in cuentas:
        row = db.query(
            func.coalesce(func.sum(models.LineaAsiento.debito), 0).label("d"),
            func.coalesce(func.sum(models.LineaAsiento.credito), 0).label("c"),
        ).join(
            models.AsientoContable,
            models.LineaAsiento.asiento_id == models.AsientoContable.id,
        ).filter(
            models.LineaAsiento.cuenta_contable_id == cuenta.id,
            models.LineaAsiento.empresa_id == empresa_id,
            models.AsientoContable.fecha <= fecha_corte,
        ).one()

        d, c = float(row.d), float(row.c)
        if d == 0 and c == 0:
            continue

        saldo = (d - c) if cuenta.naturaleza == "debito" else (c - d)
        if saldo == 0:
            continue

        item = {"codigo": cuenta.codigo, "nombre": cuenta.nombre, "saldo": saldo}

        if cuenta.tipo == "activo":
            secciones["activos"].append(item)
            secciones["total_activos"] += saldo
        elif cuenta.tipo == "pasivo":
            secciones["pasivos"].append(item)
            secciones["total_pasivos"] += saldo
        elif cuenta.tipo == "patrimonio":
            secciones["patrimonio"].append(item)
            secciones["total_patrimonio"] += saldo

    # Incorporar utilidad del período (ingresos - costos - gastos)
    # como parte del patrimonio (Resultados del Ejercicio)
    er = get_estado_resultados(db, empresa_id)
    if er.utilidad_neta != 0:
        secciones["patrimonio"].append({
            "codigo": "3605",
            "nombre": "Utilidad / (Pérdida) del período",
            "saldo": er.utilidad_neta,
        })
        secciones["total_patrimonio"] += er.utilidad_neta

    secciones["total_pasivos_patrimonio"] = secciones["total_pasivos"] + secciones["total_patrimonio"]
    return secciones


# ─── Resumen IVA (para declaración bimestral DIAN) ───────────────────────────

def get_resumen_iva(
    db: Session,
    empresa_id: int,
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
) -> dict:
    def _saldo_cuenta(codigo: str) -> float:
        cuenta = db.query(models.CuentaContable).filter(
            models.CuentaContable.empresa_id == empresa_id,
            models.CuentaContable.codigo == codigo,
        ).first()
        if not cuenta:
            return 0.0
        q = db.query(
            func.coalesce(func.sum(models.LineaAsiento.debito), 0).label("d"),
            func.coalesce(func.sum(models.LineaAsiento.credito), 0).label("c"),
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
        d, c = float(row.d), float(row.c)
        return (c - d) if cuenta.naturaleza == "credito" else (d - c)

    iva_generado     = _saldo_cuenta("2408")   # IVA cobrado en ventas
    iva_descontable  = _saldo_cuenta("1355")   # IVA pagado en compras
    iva_a_pagar      = max(0.0, iva_generado - iva_descontable)
    iva_a_favor      = max(0.0, iva_descontable - iva_generado)

    return {
        "iva_generado":    round(iva_generado, 2),
        "iva_descontable": round(iva_descontable, 2),
        "iva_a_pagar":     round(iva_a_pagar, 2),
        "iva_a_favor":     round(iva_a_favor, 2),
        "periodo_inicio":  fecha_inicio,
        "periodo_fin":     fecha_fin,
    }


# ─── Crear asiento manual ─────────────────────────────────────────────────────

def crear_asiento_manual(
    db: Session,
    empresa_id: int,
    fecha: datetime,
    descripcion: str,
    lineas: List[dict],  # [{"cuenta_codigo": "1105", "debito": 0, "credito": 100, "descripcion": "..."}]
) -> models.AsientoContable:
    from services.contabilidad import _siguiente_numero

    total_d = sum(float(l.get("debito", 0)) for l in lineas)
    total_c = sum(float(l.get("credito", 0)) for l in lineas)

    if abs(total_d - total_c) > 0.01:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"El asiento no cuadra: débitos={total_d:.2f} ≠ créditos={total_c:.2f}")

    numero = _siguiente_numero(db, empresa_id)
    asiento = models.AsientoContable(
        empresa_id=empresa_id,
        numero=numero,
        fecha=fecha,
        descripcion=descripcion,
        tipo_origen="manual",
        total_debitos=total_d,
        total_creditos=total_c,
    )
    db.add(asiento)
    db.flush()

    for i, l in enumerate(lineas):
        codigo = l.get("cuenta_codigo") or l.get("codigo")
        cuenta = db.query(models.CuentaContable).filter(
            models.CuentaContable.empresa_id == empresa_id,
            models.CuentaContable.codigo == codigo,
        ).first()
        if not cuenta:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail=f"Cuenta {codigo} no encontrada")
        db.add(models.LineaAsiento(
            empresa_id=empresa_id,
            asiento_id=asiento.id,
            cuenta_contable_id=cuenta.id,
            descripcion=l.get("descripcion"),
            debito=float(l.get("debito", 0)),
            credito=float(l.get("credito", 0)),
            orden=i + 1,
        ))

    db.commit()
    db.refresh(asiento)
    return asiento


# ─── Cierre Contable ──────────────────────────────────────────────────────────

def listar_cierres(db: Session, empresa_id: int) -> List[models.CierreContable]:
    return (
        db.query(models.CierreContable)
        .filter(models.CierreContable.empresa_id == empresa_id)
        .order_by(models.CierreContable.periodo_fin.desc())
        .all()
    )


def periodo_esta_cerrado(db: Session, empresa_id: int, fecha: datetime) -> bool:
    return db.query(models.CierreContable).filter(
        models.CierreContable.empresa_id == empresa_id,
        models.CierreContable.periodo_inicio <= fecha,
        models.CierreContable.periodo_fin >= fecha,
    ).first() is not None


def ejecutar_cierre_contable(
    db: Session,
    empresa_id: int,
    periodo_inicio: datetime,
    periodo_fin: datetime,
    descripcion: str,
    usuario_id: int,
) -> models.CierreContable:
    from fastapi import HTTPException
    from services.contabilidad import _siguiente_numero, _get_cuenta, inicializar_puc

    # Verificar que no existe cierre previo que se superponga
    solapado = db.query(models.CierreContable).filter(
        models.CierreContable.empresa_id == empresa_id,
        models.CierreContable.periodo_fin >= periodo_inicio,
        models.CierreContable.periodo_inicio <= periodo_fin,
    ).first()
    if solapado:
        raise HTTPException(400, detail=f"Ya existe un cierre que cubre este período: {solapado.descripcion}")

    inicializar_puc(db, empresa_id)

    # Calcular saldos de cuentas de resultado en el período
    cuentas_resultado = db.query(models.CuentaContable).filter(
        models.CuentaContable.empresa_id == empresa_id,
        models.CuentaContable.tipo.in_(["ingreso", "costo", "gasto"]),
        models.CuentaContable.permite_movimiento == True,
        models.CuentaContable.is_active == True,
    ).all()

    lineas_cierre = []
    utilidad_neta = 0.0

    for cuenta in cuentas_resultado:
        row = db.query(
            func.coalesce(func.sum(models.LineaAsiento.debito), 0).label("d"),
            func.coalesce(func.sum(models.LineaAsiento.credito), 0).label("c"),
        ).join(
            models.AsientoContable,
            models.LineaAsiento.asiento_id == models.AsientoContable.id,
        ).filter(
            models.LineaAsiento.cuenta_contable_id == cuenta.id,
            models.LineaAsiento.empresa_id == empresa_id,
            models.AsientoContable.fecha >= periodo_inicio,
            models.AsientoContable.fecha <= periodo_fin,
            models.AsientoContable.tipo_origen != "cierre",
        ).one()

        d, c = float(row.d), float(row.c)
        saldo = (c - d) if cuenta.naturaleza == "credito" else (d - c)
        if abs(saldo) < 0.01:
            continue

        # Para cerrar: invertir el saldo normal de cada cuenta
        if cuenta.naturaleza == "credito":  # ingresos
            # Débitar la cuenta de ingreso para llevarla a cero
            lineas_cierre.append((cuenta, saldo, 0.0))   # (cuenta, debito, credito)
            utilidad_neta += saldo
        else:  # costos y gastos
            # Acreditar la cuenta de gasto/costo para llevarla a cero
            lineas_cierre.append((cuenta, 0.0, saldo))
            utilidad_neta -= saldo

    if not lineas_cierre:
        raise HTTPException(400, detail="No hay saldos de resultado en el período indicado.")

    # Cuenta contrapartida: 3605 Utilidad o 3610 Pérdida
    codigo_resultado = "3605" if utilidad_neta >= 0 else "3610"
    cuenta_resultado = _get_cuenta(db, empresa_id, codigo_resultado)
    if not cuenta_resultado:
        raise HTTPException(500, detail=f"Cuenta {codigo_resultado} no encontrada en el PUC.")

    numero = _siguiente_numero(db, empresa_id)
    total_d = sum(l[1] for l in lineas_cierre)
    total_c = sum(l[2] for l in lineas_cierre)

    # La contrapartida cuadra el asiento
    if utilidad_neta >= 0:
        total_c += utilidad_neta   # Cr. 3605
    else:
        total_d += abs(utilidad_neta)  # Dr. 3610

    asiento = models.AsientoContable(
        empresa_id=empresa_id,
        numero=numero,
        fecha=periodo_fin,
        descripcion=descripcion or f"Cierre contable {periodo_inicio.strftime('%Y-%m-%d')} al {periodo_fin.strftime('%Y-%m-%d')}",
        tipo_origen="cierre",
        total_debitos=total_d,
        total_creditos=total_c,
    )
    db.add(asiento)
    db.flush()

    orden = 1
    for cuenta, deb, cred in lineas_cierre:
        db.add(models.LineaAsiento(
            empresa_id=empresa_id, asiento_id=asiento.id,
            cuenta_contable_id=cuenta.id,
            descripcion=f"Cierre {cuenta.codigo} — {cuenta.nombre}",
            debito=deb, credito=cred, orden=orden,
        ))
        orden += 1

    # Línea de contrapartida (resultado neto)
    db.add(models.LineaAsiento(
        empresa_id=empresa_id, asiento_id=asiento.id,
        cuenta_contable_id=cuenta_resultado.id,
        descripcion="Utilidad / Pérdida del período",
        debito=abs(utilidad_neta) if utilidad_neta < 0 else 0.0,
        credito=utilidad_neta if utilidad_neta >= 0 else 0.0,
        orden=orden,
    ))

    cierre = models.CierreContable(
        empresa_id=empresa_id,
        periodo_inicio=periodo_inicio,
        periodo_fin=periodo_fin,
        descripcion=asiento.descripcion,
        asiento_id=asiento.id,
        utilidad_neta=utilidad_neta,
        created_by_id=usuario_id,
    )
    db.add(cierre)
    db.commit()
    db.refresh(cierre)
    return cierre
