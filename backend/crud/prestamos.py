from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, Date, cast, text
from typing import Optional, List
from datetime import date, datetime, timedelta, timezone
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ


def crear_prestamo(db: Session, prestamo: schemas.PrestamoCreate, empresa_id: int):
    # 1. Cálculos matemáticos (Interés Simple)
    # Ejemplo: Presta 100,000 al 20%. Interés = 20,000. Total = 120,000.
    interes_total = prestamo.monto_prestado * (prestamo.tasa_interes / 100)
    monto_total = prestamo.monto_prestado + interes_total
    monto_por_cuota = monto_total / prestamo.cantidad_cuotas

    # 2. Crear el encabezado del Préstamo
  # En crud.crear_prestamo, al crear db_prestamo:
    db_prestamo = models.Prestamo(
        empresa_id      = empresa_id,
        cliente_id      = prestamo.cliente_id,
        monto_prestado  = prestamo.monto_prestado,
        tasa_interes    = prestamo.tasa_interes,
        cantidad_cuotas = prestamo.cantidad_cuotas,
        modalidad       = prestamo.modalidad,
        monto_total_pagar = monto_total,
        tasa_mora       = prestamo.tasa_mora,   # ← nuevo
    )
    db.add(db_prestamo)
    db.commit()
    db.refresh(db_prestamo)

    # 3. Generar la amortización (Proyectar las cuotas)
    if prestamo.fecha_inicio:
        fecha_base = prestamo.fecha_inicio.replace(tzinfo=None) if prestamo.fecha_inicio.tzinfo else prestamo.fecha_inicio
    else:
        fecha_base = datetime.now(timezone.utc).replace(tzinfo=None)
    db_prestamo.fecha_inicio = fecha_base
    dias_sumar = {"Diario": 1, "Semanal": 7, "Quincenal": 15, "Mensual": 30}
    incremento = dias_sumar.get(prestamo.modalidad, 30)

    for i in range(1, prestamo.cantidad_cuotas + 1):
        fecha_vence = fecha_base + timedelta(days=(incremento * i))

        # 💡 Opcional: Aquí podrías agregar lógica para saltar los domingos si es pago 'Diario'

        db_cuota = models.CuotaPrestamo(
            empresa_id=empresa_id,
            prestamo_id=db_prestamo.id,
            numero_cuota=i,
            monto_cuota=monto_por_cuota,
            saldo_pendiente=monto_por_cuota,
            fecha_vencimiento=fecha_vence
        )
        db.add(db_cuota)

    db.commit()
    db.refresh(db_prestamo)
    return db_prestamo


def get_calendario_cobros(db: Session, empresa_id: int):
    # Agrupamos cuotas pendientes por fecha de vencimiento
    resultados = db.query(
        cast(models.CuotaPrestamo.fecha_vencimiento, Date).label("fecha"),
        func.count(models.CuotaPrestamo.id).label("cantidad"),
        func.sum(models.CuotaPrestamo.saldo_pendiente).label("total")
    ).filter(
        models.CuotaPrestamo.empresa_id == empresa_id,
        models.CuotaPrestamo.estado_pago != "Pagado"
    ).group_by(text("fecha")).all()

    return [
        {"fecha": r.fecha, "cantidad_cuotas": r.cantidad, "monto_total": r.total}
        for r in resultados
    ]

def get_reporte_financiero_prestamos(db: Session, empresa_id: int):
    prestamos = db.query(models.Prestamo).filter(
        models.Prestamo.empresa_id == empresa_id
    ).all()

    capital_prestado              = sum(p.monto_prestado for p in prestamos)
    intereses_totales_proyectados = sum(
        p.monto_total_pagar - p.monto_prestado for p in prestamos
    )

    cuotas = db.query(models.CuotaPrestamo).filter(
        models.CuotaPrestamo.empresa_id == empresa_id
    ).all()

    intereses_recaudados = 0.0
    capital_recuperado   = 0.0
    total_en_mora        = 0.0
    hoy = datetime.now(BOGOTA_TZ).date()  # date puro

    for c in cuotas:
        p = c.prestamo
        factor_capital = (
            p.monto_prestado / p.monto_total_pagar
            if p.monto_total_pagar > 0 else 0
        )
        monto_pagado_cuota = c.monto_cuota - c.saldo_pendiente
        capital_recuperado   += monto_pagado_cuota * factor_capital
        intereses_recaudados += monto_pagado_cuota * (1 - factor_capital)

        # FIX: normalizar fecha_vencimiento a date antes de comparar
        fecha_venc = (
            c.fecha_vencimiento.date()
            if isinstance(c.fecha_vencimiento, datetime)
            else c.fecha_vencimiento
        )
        if c.estado_pago != "Pagado" and fecha_venc < hoy:
            total_en_mora += c.saldo_pendiente

    # Proyección: próximos 30 días de cobros pendientes
    hoy_dt  = datetime.now(BOGOTA_TZ)
    fin_dt  = hoy_dt + timedelta(days=30)
    proyeccion_map: dict[str, float] = {}

    for c in cuotas:
        if c.estado_pago == "Pagado":
            continue
        fv = c.fecha_vencimiento
        if isinstance(fv, datetime):
            fv_date = fv.date()
        else:
            fv_date = fv
        if hoy <= fv_date <= fin_dt.date():
            key = fv_date.isoformat()
            proyeccion_map[key] = proyeccion_map.get(key, 0.0) + float(c.saldo_pendiente)

    proyeccion_recaudo_mes = [
        {"day": k, "total": v}
        for k, v in sorted(proyeccion_map.items())
    ]

    return {
        "resumen": {
            "capital_prestado":       capital_prestado,
            "capital_recuperado":     capital_recuperado,
            "capital_pendiente":      capital_prestado - capital_recuperado,
            "intereses_esperados":    intereses_totales_proyectados,
            "intereses_recaudados":   intereses_recaudados,
            "intereses_pendientes":   intereses_totales_proyectados - intereses_recaudados,
            "total_en_mora":          total_en_mora,
        },
        "proyeccion_recaudo_mes": proyeccion_recaudo_mes,
    }


def get_resumen_calendario_cobros(db: Session, empresa_id: int):
    # Usamos cast para asegurar que tratamos el campo como Date
    # Y lo agrupamos directamente por la columna de la base de datos
    query = db.query(
        models.CuotaPrestamo.fecha_vencimiento,
        func.count(models.CuotaPrestamo.id).label("total_cuotas")
    ).filter(
        models.CuotaPrestamo.empresa_id == empresa_id,
        models.CuotaPrestamo.estado_pago != "Pagado"
    ).group_by(models.CuotaPrestamo.fecha_vencimiento).all()

    # Procesamos los resultados en Python para evitar errores de tipos con los drivers
    resumen = {}
    for r in query:
        # Extraemos solo la parte de la fecha (YYYY-MM-DD) si viene con hora
        fecha_str = r[0].isoformat().split('T')[0] if hasattr(r[0], 'isoformat') else str(r[0]).split(' ')[0]

        if fecha_str in resumen:
            resumen[fecha_str] += r.total_cuotas
        else:
            resumen[fecha_str] = r.total_cuotas

    # Retornamos una lista de diccionarios limpia para el frontend
    return [
        {"fecha": fecha, "total_cuotas": cantidad}
        for fecha, cantidad in resumen.items()
    ]


# ─── Calcula mora de una cuota al vuelo ──────────────────────────────────────
def calcular_mora_cuota(cuota: models.CuotaPrestamo, tasa_mora_mensual: float) -> dict:
    """
    Retorna mora en pesos, días vencido y total a pagar.
    La mora NO se guarda en BD — se calcula en tiempo real.
    """
    if cuota.estado_pago == "Pagado" or cuota.saldo_pendiente <= 0:
        return {"mora": 0.0, "dias": 0, "total": cuota.saldo_pendiente}

    hoy = datetime.now(BOGOTA_TZ).date()
    fv  = cuota.fecha_vencimiento
    if isinstance(fv, datetime):
        fv = fv.date()

    if fv >= hoy:
        return {"mora": 0.0, "dias": 0, "total": float(cuota.saldo_pendiente)}

    dias_vencido = (hoy - fv).days
    tasa_diaria  = (tasa_mora_mensual / 100) / 30
    mora         = round(float(cuota.saldo_pendiente) * tasa_diaria * dias_vencido, 2)

    return {
        "mora":  mora,
        "dias":  dias_vencido,
        "total": round(float(cuota.saldo_pendiente) + mora, 2),
    }


# ─── Abono a capital: redistribuye excedente entre cuotas pendientes ─────────
def aplicar_abono_capital(db: Session, empresa_id: int, prestamo_id: int, monto_abono: float) -> dict:
    prestamo = db.query(models.Prestamo).filter(
        models.Prestamo.id         == prestamo_id,
        models.Prestamo.empresa_id == empresa_id,
    ).first()
    if not prestamo:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    cuotas_pendientes = (
        db.query(models.CuotaPrestamo)
        .filter(
            models.CuotaPrestamo.prestamo_id == prestamo_id,
            models.CuotaPrestamo.empresa_id  == empresa_id,
            models.CuotaPrestamo.estado_pago != "Pagado",
        )
        .order_by(models.CuotaPrestamo.numero_cuota.asc())
        .all()
    )

    if not cuotas_pendientes:
        raise HTTPException(status_code=400, detail="No hay cuotas pendientes en este préstamo")

    saldo_total = sum(c.saldo_pendiente for c in cuotas_pendientes)

    if monto_abono >= saldo_total:
        for c in cuotas_pendientes:
            c.saldo_pendiente = 0
            c.estado_pago     = "Pagado"
            c.fecha_pago      = datetime.now(BOGOTA_TZ)
        prestamo.estado = "Pagado"
        db.commit()
        return {
            "msg":               "Préstamo liquidado completamente con abono a capital",
            "saldo_anterior":    round(saldo_total, 2),
            "abono_aplicado":    round(monto_abono, 2),
            "nuevo_saldo":       0.0,
            "cuotas_restantes":  0,
            "nuevo_valor_cuota": 0.0,
        }

    nuevo_saldo      = saldo_total - monto_abono
    num_cuotas       = len(cuotas_pendientes)
    nuevo_monto_cuota = round(nuevo_saldo / num_cuotas, 2)

    for i, c in enumerate(cuotas_pendientes):
        # La última cuota absorbe el centavo de diferencia por redondeo
        if i == num_cuotas - 1:
            c.saldo_pendiente = round(nuevo_saldo - nuevo_monto_cuota * (num_cuotas - 1), 2)
        else:
            c.saldo_pendiente = nuevo_monto_cuota
        c.monto_cuota = c.saldo_pendiente

    db.commit()
    return {
        "msg":               f"Abono de {monto_abono:,.0f} aplicado al capital",
        "saldo_anterior":    round(saldo_total, 2),
        "abono_aplicado":    round(monto_abono, 2),
        "nuevo_saldo":       round(nuevo_saldo, 2),
        "cuotas_restantes":  num_cuotas,
        "nuevo_valor_cuota": nuevo_monto_cuota,
    }


def get_proyeccion_prestamo(db: Session, empresa_id: int, prestamo: schemas.PrestamoCreate) -> schemas.ProyeccionPrestamo:
    interes_total   = prestamo.monto_prestado * (prestamo.tasa_interes / 100)
    monto_total     = prestamo.monto_prestado + interes_total
    monto_por_cuota = monto_total / prestamo.cantidad_cuotas

    if prestamo.fecha_inicio:
        fecha_base = prestamo.fecha_inicio.replace(tzinfo=None) if prestamo.fecha_inicio.tzinfo else prestamo.fecha_inicio
    else:
        fecha_base = datetime.now(timezone.utc).replace(tzinfo=None)

    dias_sumar = {"Diario": 1, "Semanal": 7, "Quincenal": 15, "Mensual": 30}
    incremento = dias_sumar.get(prestamo.modalidad, 30)

    cuotas = [
        schemas.ProyeccionCuota(
            numero_cuota=i,
            monto_cuota=round(monto_por_cuota, 2),
            fecha_vencimiento=fecha_base + timedelta(days=incremento * i),
        )
        for i in range(1, prestamo.cantidad_cuotas + 1)
    ]

    return schemas.ProyeccionPrestamo(
        cliente_nombre="",
        monto_prestado=prestamo.monto_prestado,
        tasa_interes=prestamo.tasa_interes,
        total_intereses=round(interes_total, 2),
        total_a_pagar=round(monto_total, 2),
        cuotas=cuotas,
    )
