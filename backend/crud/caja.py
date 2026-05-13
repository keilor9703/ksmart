from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional, List
from datetime import date, datetime
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ, get_utc_boundaries, _is_postgres
from crud.clientes import get_cliente


def calcular_totales_dia(db: Session, empresa_id: int) -> dict:
    hoy_colombia = datetime.now(BOGOTA_TZ).date()
    inicio, fin = get_utc_boundaries(hoy_colombia)

    totales = {
        "efectivo": 0.0, "transferencia": 0.0, "tarjeta": 0.0, "otros": 0.0,
        "total_dia": 0.0, "total_gastos": 0.0,
        "ventas_contado": 0.0, "abonos_cartera": 0.0, "recaudo_prestamos": 0.0,
        "num_ventas": 0, "num_abonos": 0,
        "fecha": hoy_colombia.isoformat(),
    }

    def _clasificar(metodo, monto, cat):
        m = (metodo or "").lower()
        totales["total_dia"] += monto
        totales[cat] += monto
        if "efectivo" in m or m == "":
            totales["efectivo"] += monto
        elif any(x in m for x in ["transfer", "nequi", "pse", "bancolombia"]):
            totales["transferencia"] += monto
        elif any(x in m for x in ["tarjeta", "card", "datafono"]):
            totales["tarjeta"] += monto
        else:
            totales["otros"] += monto

    # ── 1. Ventas de contado (pagadas al momento de la venta) ────────────────
    # Solo ventas creadas HOY y que nacieron como pagadas (no abonos posteriores)
    ventas_contado = db.query(models.Venta).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.fecha >= inicio,
        models.Venta.fecha <= fin,
        models.Venta.tipo == "venta",
        models.Venta.estado_pago == "pagado",
        # Excluir ventas que tienen pagos en tabla pagos (esas son cartera cobrada)
        ~models.Venta.pagos.any()
    ).all()
    for v in ventas_contado:
        _clasificar(v.metodo_pago, float(v.total or 0), "ventas_contado")
        totales["num_ventas"] += 1

    # ── 2. Abonos a cartera (pagos registrados HOY desde CuentasPorCobrar) ───
    # Estos son los que faltaban — pagos de ventas previas (o del día) vía tabla pagos
    pagos_hoy = db.query(models.Pago).join(models.Venta).filter(
        models.Venta.empresa_id == empresa_id,
        models.Pago.fecha >= inicio,
        models.Pago.fecha <= fin,
    ).all()
    for p in pagos_hoy:
        _clasificar(p.metodo_pago, float(p.monto or 0), "abonos_cartera")
        totales["num_abonos"] += 1

    # ── 3. Recaudo de préstamos ──────────────────────────────────────────────
    cuotas = db.query(models.CuotaPrestamo).filter(
        models.CuotaPrestamo.empresa_id == empresa_id,
        models.CuotaPrestamo.estado_pago == "Pagado",
        models.CuotaPrestamo.fecha_pago >= inicio,
        models.CuotaPrestamo.fecha_pago <= fin,
    ).all()
    # ✅ DESPUÉS:
    for c in cuotas:
        monto_recaudado = float(c.monto_cuota or 0) - float(c.saldo_pendiente or 0)
        _clasificar(c.metodo_pago or "Efectivo", monto_recaudado, "recaudo_prestamos")

    # ── 4. Gastos (restan del efectivo) ─────────────────────────────────────
    gastos = db.query(models.Gasto).filter(
        models.Gasto.empresa_id == empresa_id,
        models.Gasto.fecha >= inicio,
        models.Gasto.fecha <= fin,
    ).all()
    for g in gastos:
        totales["total_gastos"] += float(g.monto)
        m = (g.metodo_pago or "").lower()
        if "efectivo" in m or m == "":
            totales["efectivo"] -= float(g.monto)
        elif any(x in m for x in ["transfer", "nequi", "pse"]):
            totales["transferencia"] -= float(g.monto)
        elif any(x in m for x in ["tarjeta", "card"]):
            totales["tarjeta"] -= float(g.monto)

    return totales


def crear_corte_caja(db: Session, empresa_id: int, usuario_id: int, efectivo_fisico: float,
                     observaciones: Optional[str] = None) -> models.CorteCaja:
    totales = calcular_totales_dia(db, empresa_id)
    diferencia = efectivo_fisico - totales["efectivo"]

    corte = models.CorteCaja(
        usuario_id=usuario_id,
        total_efectivo_ventas=totales["efectivo"],
        total_transferencia_ventas=totales["transferencia"],
        total_tarjeta_ventas=totales["tarjeta"],
        total_otros_ventas=totales["otros"],
        total_ventas_dia=totales["total_dia"],
        total_gastos=totales["total_gastos"],
        efectivo_fisico=efectivo_fisico,
        diferencia=diferencia,
        observaciones=observaciones,
        estado="cerrado",
        empresa_id=empresa_id
    )
    db.add(corte)
    db.commit()
    db.refresh(corte)

    if abs(diferencia) > 1000:
        admin_users = db.query(models.User).join(models.Role).filter(
            models.Role.name.in_(["Admin", "Socio"]),
            models.User.empresa_id == empresa_id
        ).all()
        tipo = "error" if diferencia < 0 else "warning"
        signo = "FALTANTE" if diferencia < 0 else "SOBRANTE"
        for admin in admin_users:
            db.add(models.Notificacion(
                usuario_id=admin.id,
                empresa_id=empresa_id,
                mensaje=f"💰 Corte de caja: {signo} de ${abs(diferencia):,.0f} COP detectado.",
                tipo=tipo, leido=False
            ))
        db.commit()

    return corte

def get_cortes_caja(db: Session, empresa_id: int, skip: int = 0, limit: int = 30) -> List[models.CorteCaja]:
    return (
        db.query(models.CorteCaja)
        .filter(models.CorteCaja.empresa_id == empresa_id)
        .order_by(models.CorteCaja.fecha.desc())
        .offset(skip).limit(limit).all()
    )

def crear_gasto(db: Session, empresa_id: int, usuario_id: int, data: schemas.GastoCreate) -> models.Gasto:
    if data.tercero_id:
        tercero = get_cliente(db, empresa_id, data.tercero_id)
        if not tercero:
            raise HTTPException(status_code=404, detail="Tercero no encontrado")

    db_gasto = models.Gasto(
        usuario_id=usuario_id,
        tercero_id=data.tercero_id,
        monto=data.monto,
        concepto=data.concepto,
        metodo_pago=data.metodo_pago,
        empresa_id=empresa_id
    )
    db.add(db_gasto)
    db.commit()
    db.refresh(db_gasto)
    return db_gasto

def get_gastos(db: Session, empresa_id: int, skip: int = 0, limit: int = 100) -> List[models.Gasto]:
    return (
        db.query(models.Gasto)
        .options(joinedload(models.Gasto.tercero))
        .filter(models.Gasto.empresa_id == empresa_id)
        .order_by(models.Gasto.fecha.desc())
        .offset(skip).limit(limit).all()
    )

def update_gasto(db: Session, empresa_id: int, gasto_id: int, data: schemas.GastoCreate) -> models.Gasto:
    db_gasto = db.query(models.Gasto).filter(
        models.Gasto.id == gasto_id,
        models.Gasto.empresa_id == empresa_id
    ).first()
    
    if not db_gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    
    if data.tercero_id:
        tercero = get_cliente(db, empresa_id, data.tercero_id)
        if not tercero:
            raise HTTPException(status_code=404, detail="Tercero no encontrado")
        db_gasto.tercero_id = data.tercero_id

    db_gasto.monto = data.monto
    db_gasto.concepto = data.concepto
    db_gasto.metodo_pago = data.metodo_pago
    
    db.commit()
    db.refresh(db_gasto)
    return db_gasto

def delete_gasto(db: Session, empresa_id: int, gasto_id: int) -> bool:
    db_gasto = db.query(models.Gasto).filter(
        models.Gasto.id == gasto_id,
        models.Gasto.empresa_id == empresa_id
    ).first()
    
    if not db_gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    
    db.delete(db_gasto)
    db.commit()
    return True
