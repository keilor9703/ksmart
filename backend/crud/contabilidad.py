from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

import models
import schemas
from services.contabilidad import inicializar_puc, PUC_DEFAULT
from crud.common import get_utc_boundaries


def _rango_utc(fecha_inicio: Optional[datetime], fecha_fin: Optional[datetime]):
    """Convierte fechas del período (día local de Colombia) a límites UTC.

    Los asientos se almacenan con fecha UTC. Comparar directamente contra la
    fecha local recibida excluía el último día del período y asignaba las
    transacciones nocturnas (19:00–23:59 hora Colombia = día siguiente en UTC)
    al mes equivocado — fatal para declaraciones de IVA.
    """
    utc_ini = utc_fin = None
    if fecha_inicio is not None:
        d = fecha_inicio.date() if isinstance(fecha_inicio, datetime) else fecha_inicio
        utc_ini, _ = get_utc_boundaries(d)
    if fecha_fin is not None:
        d = fecha_fin.date() if isinstance(fecha_fin, datetime) else fecha_fin
        _, utc_fin = get_utc_boundaries(d)
    return utc_ini, utc_fin


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
    fecha_inicio, fecha_fin = _rango_utc(fecha_inicio, fecha_fin)
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

    fecha_inicio, fecha_fin = _rango_utc(fecha_inicio, fecha_fin)
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

        # Saldo NETO en la columna que corresponda a su signo real (una cuenta
        # puede cerrar contraria a su naturaleza — p.ej. sobregiro bancario o
        # ingresos netos débito por devoluciones). El clamp anterior forzaba
        # esos casos a 0 y descuadraba el balance de prueba.
        neto = total_d - total_c
        saldo_d = neto if neto > 0 else 0.0
        saldo_c = -neto if neto < 0 else 0.0

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

    fecha_inicio, fecha_fin = _rango_utc(fecha_inicio, fecha_fin)

    # Saldos por CUENTA de resultado en una sola consulta agregada. El PyG se
    # construye desde el TIPO de cuenta (ingreso/costo/gasto) — no desde una
    # lista fija de códigos — para que ningún asiento quede por fuera del
    # total y el estado de resultados concilie con el balance de prueba.
    q = db.query(
        models.CuentaContable.codigo,
        models.CuentaContable.tipo,
        models.CuentaContable.naturaleza,
        func.coalesce(func.sum(models.LineaAsiento.debito), 0).label("d"),
        func.coalesce(func.sum(models.LineaAsiento.credito), 0).label("c"),
    ).join(
        models.LineaAsiento,
        models.LineaAsiento.cuenta_contable_id == models.CuentaContable.id,
    ).join(
        models.AsientoContable,
        models.LineaAsiento.asiento_id == models.AsientoContable.id,
    ).filter(
        models.CuentaContable.empresa_id == empresa_id,
        models.CuentaContable.tipo.in_(["ingreso", "costo", "gasto"]),
        models.LineaAsiento.empresa_id == empresa_id,
        models.AsientoContable.empresa_id == empresa_id,
        models.AsientoContable.tipo_origen != "cierre",
    )
    if fecha_inicio:
        q = q.filter(models.AsientoContable.fecha >= fecha_inicio)
    if fecha_fin:
        q = q.filter(models.AsientoContable.fecha <= fecha_fin)
    rows = q.group_by(
        models.CuentaContable.codigo,
        models.CuentaContable.tipo,
        models.CuentaContable.naturaleza,
    ).all()

    saldos = {}          # codigo -> saldo con su signo natural
    total_ingresos = costo_ventas_total = total_gastos = 0.0
    for codigo, tipo, naturaleza, d, c in rows:
        saldo = (float(c) - float(d)) if naturaleza == "credito" else (float(d) - float(c))
        saldos[codigo] = saldos.get(codigo, 0.0) + saldo
        if tipo == "ingreso":
            total_ingresos += saldo
        elif tipo == "costo":
            costo_ventas_total += saldo
        elif tipo == "gasto":
            total_gastos += saldo

    ing_operacional = saldos.get("4135", 0.0)
    ing_servicios   = saldos.get("4175", 0.0)
    ing_financiero  = saldos.get("4210", 0.0)
    costo_ventas    = costo_ventas_total
    utilidad_bruta  = total_ingresos - costo_ventas
    gastos_personal = saldos.get("5105", 0.0)
    gastos_generales= saldos.get("5195", 0.0)
    gastos_no_oper  = saldos.get("5305", 0.0)
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
    else:
        _, fecha_corte = _rango_utc(None, fecha_corte)

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

    # Incorporar utilidad acumulada HASTA la fecha de corte (mismo corte que
    # los saldos de activo/pasivo — antes se usaba la utilidad de toda la vida
    # sin importar el corte y la ecuación contable no cerraba)
    er = get_estado_resultados(db, empresa_id, fecha_fin=fecha_corte)
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

    fecha_inicio, fecha_fin = _rango_utc(fecha_inicio, fecha_fin)

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

    from fastapi import HTTPException
    if abs(total_d - total_c) > 0.01:
        raise HTTPException(status_code=400, detail=f"El asiento no cuadra: débitos={total_d:.2f} ≠ créditos={total_c:.2f}")

    # Un período cerrado es inmodificable: registrar en él invalidaría
    # declaraciones ya presentadas.
    if periodo_esta_cerrado(db, empresa_id, fecha):
        raise HTTPException(status_code=400,
            detail="La fecha pertenece a un período contable ya cerrado. Registra el asiento en el período vigente.")

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
