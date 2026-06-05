"""
Servicio de contabilidad automática.
Genera asientos contables (partida doble) a partir de transacciones existentes.
No reemplaza la lógica de negocio — se invoca DESPUÉS de cada commit.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

import models

logger = logging.getLogger("contabilidad")

# ─── PUC por defecto (colombiano simplificado) ────────────────────────────────
# (codigo, nombre, tipo, naturaleza, nivel, padre_codigo, permite_movimiento)
PUC_DEFAULT = [
    # ACTIVOS
    ("1",    "ACTIVO",                          "activo",     "debito",  1, None,  False),
    ("11",   "Disponible",                      "activo",     "debito",  2, "1",   False),
    ("1105", "Caja",                            "activo",     "debito",  3, "11",  True),
    ("1110", "Bancos y equivalentes",           "activo",     "debito",  3, "11",  True),
    ("13",   "Deudores",                        "activo",     "debito",  2, "1",   False),
    ("1305", "Clientes (cuentas por cobrar)",   "activo",     "debito",  3, "13",  True),
    ("14",   "Inventarios",                     "activo",     "debito",  2, "1",   False),
    ("1430", "Inventario de mercancías",        "activo",     "debito",  3, "14",  True),
    # PASIVOS
    ("2",    "PASIVO",                          "pasivo",     "credito", 1, None,  False),
    ("22",   "Proveedores",                     "pasivo",     "credito", 2, "2",   False),
    ("2205", "Proveedores nacionales (CxP)",    "pasivo",     "credito", 3, "22",  True),
    ("24",   "Impuestos por pagar",             "pasivo",     "credito", 2, "2",   False),
    ("2408", "IVA generado por pagar",          "pasivo",     "credito", 3, "24",  True),
    # PATRIMONIO
    ("3",    "PATRIMONIO",                      "patrimonio", "credito", 1, None,  False),
    ("31",   "Capital",                         "patrimonio", "credito", 2, "3",   False),
    ("3105", "Capital de persona natural",      "patrimonio", "credito", 3, "31",  True),
    ("36",   "Resultados del ejercicio",        "patrimonio", "credito", 2, "3",   False),
    ("3605", "Utilidad del ejercicio",          "patrimonio", "credito", 3, "36",  True),
    # INGRESOS
    ("4",    "INGRESOS",                        "ingreso",    "credito", 1, None,  False),
    ("41",   "Ingresos operacionales",          "ingreso",    "credito", 2, "4",   False),
    ("4135", "Venta de mercancías",             "ingreso",    "credito", 3, "41",  True),
    ("4175", "Ingresos por servicios",          "ingreso",    "credito", 3, "41",  True),
    ("42",   "Ingresos no operacionales",       "ingreso",    "credito", 2, "4",   False),
    ("4210", "Intereses y rendimientos",        "ingreso",    "credito", 3, "42",  True),
    # COSTOS
    ("6",    "COSTOS DE VENTAS",                "costo",      "debito",  1, None,  False),
    ("61",   "Costo de ventas",                 "costo",      "debito",  2, "6",   False),
    ("6135", "Costo de mercancías vendidas",    "costo",      "debito",  3, "61",  True),
    # GASTOS
    ("5",    "GASTOS",                          "gasto",      "debito",  1, None,  False),
    ("51",   "Gastos operacionales",            "gasto",      "debito",  2, "5",   False),
    ("5105", "Gastos de personal",              "gasto",      "debito",  3, "51",  True),
    ("5195", "Gastos generales y diversos",     "gasto",      "debito",  3, "51",  True),
    ("53",   "Gastos no operacionales",         "gasto",      "debito",  2, "5",   False),
    ("5305", "Gastos financieros",              "gasto",      "debito",  3, "53",  True),
]


def inicializar_puc(db: Session, empresa_id: int) -> None:
    """Crea el PUC por defecto para una empresa si aún no tiene cuentas."""
    existentes = db.query(models.CuentaContable).filter(
        models.CuentaContable.empresa_id == empresa_id
    ).count()
    if existentes > 0:
        return
    for codigo, nombre, tipo, naturaleza, nivel, padre_codigo, permite_mov in PUC_DEFAULT:
        db.add(models.CuentaContable(
            empresa_id=empresa_id,
            codigo=codigo,
            nombre=nombre,
            tipo=tipo,
            naturaleza=naturaleza,
            nivel=nivel,
            padre_codigo=padre_codigo,
            permite_movimiento=permite_mov,
        ))
    db.flush()


def _get_cuenta(db: Session, empresa_id: int, codigo: str) -> Optional[models.CuentaContable]:
    return db.query(models.CuentaContable).filter(
        models.CuentaContable.empresa_id == empresa_id,
        models.CuentaContable.codigo == codigo,
        models.CuentaContable.is_active == True,
    ).first()


def _siguiente_numero(db: Session, empresa_id: int) -> int:
    ultimo = (
        db.query(models.AsientoContable.numero)
        .filter(models.AsientoContable.empresa_id == empresa_id)
        .order_by(models.AsientoContable.numero.desc())
        .first()
    )
    return (ultimo[0] + 1) if ultimo else 1


def _cuenta_caja(db: Session, empresa_id: int, metodo_pago: Optional[str]) -> str:
    """Devuelve el código de cuenta según el método de pago."""
    if not metodo_pago:
        return "1105"
    mp = metodo_pago.lower()
    if any(x in mp for x in ("transferencia", "nequi", "daviplata", "pse", "tarjeta", "bancolombia")):
        return "1110"
    return "1105"


# ─── ASIENTO POR VENTA ────────────────────────────────────────────────────────

def registrar_asiento_venta(db: Session, venta: models.Venta) -> None:
    """
    Partida doble para una venta pagada:
      Débito  1105/1110  Caja/Bancos         (total)
      Crédito 4135/4175  Ingresos            (total - IVA)
      Crédito 2408       IVA por pagar       (IVA, si aplica)
    """
    try:
        empresa_id = venta.empresa_id
        inicializar_puc(db, empresa_id)

        if venta.estado_pago != "pagado" or (venta.monto_pagado or 0) <= 0:
            return

        # Verificar que no existe ya un asiento para esta venta
        ya_existe = db.query(models.AsientoContable).filter(
            models.AsientoContable.empresa_id == empresa_id,
            models.AsientoContable.tipo_origen == "venta",
            models.AsientoContable.referencia_id == venta.id,
        ).first()
        if ya_existe:
            return

        total = float(venta.monto_pagado or venta.total or 0)
        iva   = float(venta.iva_total or 0)
        base  = total - iva

        # Determinar cuenta de ingreso según origen
        origen = getattr(venta, "origen", "erp") or "erp"
        if origen in ("lavadero", "parqueadero_horas", "parqueadero_suscripcion"):
            codigo_ingreso = "4175"
        else:
            codigo_ingreso = "4135"

        codigo_caja = _cuenta_caja(db, empresa_id, venta.metodo_pago)
        cuenta_caja    = _get_cuenta(db, empresa_id, codigo_caja)
        cuenta_ingreso = _get_cuenta(db, empresa_id, codigo_ingreso)
        cuenta_iva     = _get_cuenta(db, empresa_id, "2408") if iva > 0 else None

        if not cuenta_caja or not cuenta_ingreso:
            logger.warning("Contabilidad: cuentas no encontradas para empresa %s", empresa_id)
            return

        desc_metodo = venta.metodo_pago or "Efectivo"
        numero = _siguiente_numero(db, empresa_id)
        asiento = models.AsientoContable(
            empresa_id=empresa_id,
            numero=numero,
            fecha=venta.fecha_pago or venta.fecha or datetime.now(timezone.utc),
            descripcion=f"Venta #{venta.id} — {desc_metodo}",
            tipo_origen="venta",
            referencia_id=venta.id,
            referencia_tipo="Venta",
            total_debitos=total,
            total_creditos=total,
        )
        db.add(asiento)
        db.flush()

        lineas = [
            models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_caja.id,
                descripcion=f"Recaudo venta #{venta.id}", debito=total, credito=0.0, orden=1),
            models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_ingreso.id,
                descripcion=f"Ingreso venta #{venta.id}", debito=0.0, credito=base, orden=2),
        ]
        if cuenta_iva and iva > 0:
            lineas.append(models.LineaAsiento(
                empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_iva.id,
                descripcion=f"IVA venta #{venta.id}", debito=0.0, credito=iva, orden=3,
            ))
        db.add_all(lineas)
        db.flush()
    except Exception as exc:
        logger.exception("Error generando asiento para venta %s: %s", getattr(venta, "id", "?"), exc)


# ─── ASIENTO POR GASTO ────────────────────────────────────────────────────────

_CATEGORIA_CUENTA = {
    "personal":    "5105",
    "nomina":      "5105",
    "arriendo":    "5195",
    "servicios":   "5195",
    "financiero":  "5305",
}

def registrar_asiento_gasto(db: Session, gasto: models.Gasto) -> None:
    """
    Partida doble para un gasto:
      Débito  51xx  Gastos (según categoría)
      Crédito 1105/1110  Caja/Bancos
    """
    try:
        empresa_id = gasto.empresa_id
        inicializar_puc(db, empresa_id)

        ya_existe = db.query(models.AsientoContable).filter(
            models.AsientoContable.empresa_id == empresa_id,
            models.AsientoContable.tipo_origen == "gasto",
            models.AsientoContable.referencia_id == gasto.id,
        ).first()
        if ya_existe:
            return

        monto = float(gasto.monto or 0)
        if monto <= 0:
            return

        categoria = (gasto.categoria or "").lower()
        codigo_gasto = _CATEGORIA_CUENTA.get(categoria, "5195")
        codigo_caja  = _cuenta_caja(db, empresa_id, gasto.metodo_pago)

        cuenta_gasto = _get_cuenta(db, empresa_id, codigo_gasto)
        cuenta_caja  = _get_cuenta(db, empresa_id, codigo_caja)

        if not cuenta_gasto or not cuenta_caja:
            return

        numero = _siguiente_numero(db, empresa_id)
        asiento = models.AsientoContable(
            empresa_id=empresa_id,
            numero=numero,
            fecha=gasto.fecha or datetime.now(timezone.utc),
            descripcion=f"Gasto #{gasto.id} — {gasto.concepto or 'Sin concepto'}",
            tipo_origen="gasto",
            referencia_id=gasto.id,
            referencia_tipo="Gasto",
            total_debitos=monto,
            total_creditos=monto,
        )
        db.add(asiento)
        db.flush()
        db.add_all([
            models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_gasto.id,
                descripcion=gasto.concepto, debito=monto, credito=0.0, orden=1),
            models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_caja.id,
                descripcion=f"Pago gasto #{gasto.id}", debito=0.0, credito=monto, orden=2),
        ])
        db.flush()
    except Exception as exc:
        logger.exception("Error generando asiento para gasto %s: %s", getattr(gasto, "id", "?"), exc)
