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
    ("1",    "ACTIVO",                                "activo",     "debito",  1, None,  False),
    ("11",   "Disponible",                            "activo",     "debito",  2, "1",   False),
    ("1105", "Caja",                                  "activo",     "debito",  3, "11",  True),
    ("1110", "Bancos y equivalentes",                 "activo",     "debito",  3, "11",  True),
    ("13",   "Deudores",                              "activo",     "debito",  2, "1",   False),
    ("1305", "Clientes (cuentas por cobrar)",         "activo",     "debito",  3, "13",  True),
    ("1330", "Anticipos y avances",                   "activo",     "debito",  3, "13",  True),
    ("1355", "IVA descontable (IVA en compras)",      "activo",     "debito",  3, "13",  True),
    ("1360", "Retención en la fuente a favor",        "activo",     "debito",  3, "13",  True),
    ("14",   "Inventarios",                           "activo",     "debito",  2, "1",   False),
    ("1430", "Inventario de mercancías",              "activo",     "debito",  3, "14",  True),
    ("16",   "Intangibles",                           "activo",     "debito",  2, "1",   False),
    ("1605", "Créditos activos (cartera préstamos)",  "activo",     "debito",  3, "16",  True),
    # PASIVOS
    ("2",    "PASIVO",                                "pasivo",     "credito", 1, None,  False),
    ("22",   "Proveedores",                           "pasivo",     "credito", 2, "2",   False),
    ("2205", "Proveedores nacionales (CxP)",          "pasivo",     "credito", 3, "22",  True),
    ("24",   "Impuestos, gravámenes y tasas",         "pasivo",     "credito", 2, "2",   False),
    ("2408", "IVA generado (por pagar)",              "pasivo",     "credito", 3, "24",  True),
    ("2365", "Retención en la fuente por pagar",      "pasivo",     "credito", 3, "24",  True),
    ("2370", "ICA por pagar",                         "pasivo",     "credito", 3, "24",  True),
    # PATRIMONIO
    ("3",    "PATRIMONIO",                            "patrimonio", "credito", 1, None,  False),
    ("31",   "Capital",                               "patrimonio", "credito", 2, "3",   False),
    ("3105", "Capital de persona natural",            "patrimonio", "credito", 3, "31",  True),
    ("36",   "Resultados del ejercicio",              "patrimonio", "credito", 2, "3",   False),
    ("3605", "Utilidad del ejercicio",                "patrimonio", "credito", 3, "36",  True),
    ("3610", "Pérdida del ejercicio",                 "patrimonio", "debito",  3, "36",  True),
    # INGRESOS
    ("4",    "INGRESOS",                              "ingreso",    "credito", 1, None,  False),
    ("41",   "Ingresos operacionales",                "ingreso",    "credito", 2, "4",   False),
    ("4135", "Venta de mercancías",                   "ingreso",    "credito", 3, "41",  True),
    ("4175", "Ingresos por servicios",                "ingreso",    "credito", 3, "41",  True),
    ("42",   "Ingresos no operacionales",             "ingreso",    "credito", 2, "4",   False),
    ("4210", "Intereses y rendimientos (préstamos)",  "ingreso",    "credito", 3, "42",  True),
    ("4250", "Recuperaciones y otros ingresos",       "ingreso",    "credito", 3, "42",  True),
    # COSTOS
    ("6",    "COSTOS DE VENTAS",                      "costo",      "debito",  1, None,  False),
    ("61",   "Costo de ventas y servicios",           "costo",      "debito",  2, "6",   False),
    ("6135", "Costo de mercancías vendidas",          "costo",      "debito",  3, "61",  True),
    ("6175", "Costo de servicios prestados",          "costo",      "debito",  3, "61",  True),
    # GASTOS
    ("5",    "GASTOS",                                "gasto",      "debito",  1, None,  False),
    ("51",   "Gastos operacionales de administración","gasto",      "debito",  2, "5",   False),
    ("5105", "Gastos de personal y nómina",           "gasto",      "debito",  3, "51",  True),
    ("5110", "Honorarios",                            "gasto",      "debito",  3, "51",  True),
    ("5115", "Arrendamientos",                        "gasto",      "debito",  3, "51",  True),
    ("5120", "Servicios públicos",                    "gasto",      "debito",  3, "51",  True),
    ("5195", "Gastos generales y diversos",           "gasto",      "debito",  3, "51",  True),
    ("53",   "Gastos no operacionales",               "gasto",      "debito",  2, "5",   False),
    ("5305", "Gastos financieros e intereses",        "gasto",      "debito",  3, "53",  True),
    ("5315", "Gastos extraordinarios",                "gasto",      "debito",  3, "53",  True),
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
    """Consecutivo del libro diario por empresa. UPDATE atómico sobre el
    contador de la empresa: dos transacciones concurrentes nunca reciben el
    mismo número (el SELECT max+1 anterior sí podía duplicar consecutivos,
    inaceptable en un libro diario)."""
    from crud.consecutivos import next_consecutivo
    return next_consecutivo(db, empresa_id, "ultimo_numero_asiento")


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

        # Costo de la mercancía vendida (para el asiento 6135/1430): suma de
        # cantidad x costo de cada producto físico de la venta. Sin este
        # asiento el estado de resultados no refleja utilidad bruta real.
        # LIMITACIÓN: usa el costo ACTUAL del producto — para ventas en vivo es
        # el costo del momento, pero el backfill de ventas históricas registra
        # el COGS a costo de hoy (aproximación; el costo histórico no se
        # almacena por venta).
        costo_venta = 0.0
        try:
            for det in (venta.detalles or []):
                p = getattr(det, "producto", None)
                if p is not None and not getattr(p, "es_servicio", False):
                    costo_venta += float(det.cantidad or 0) * float(p.costo or 0)
        except Exception:
            costo_venta = 0.0
        costo_venta = round(costo_venta, 2)

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
        cuenta_costo   = _get_cuenta(db, empresa_id, "6135") if costo_venta > 0 else None
        cuenta_inv     = _get_cuenta(db, empresa_id, "1430") if costo_venta > 0 else None

        if not cuenta_caja or not cuenta_ingreso:
            logger.warning("Contabilidad: cuentas no encontradas para empresa %s", empresa_id)
            return

        num_visible = getattr(venta, "numero_venta", None) or venta.id
        desc_metodo = venta.metodo_pago or "Efectivo"
        incluir_costo = bool(cuenta_costo and cuenta_inv and costo_venta > 0)
        total_asiento = total + (costo_venta if incluir_costo else 0.0)
        numero = _siguiente_numero(db, empresa_id)
        asiento = models.AsientoContable(
            empresa_id=empresa_id,
            numero=numero,
            fecha=venta.fecha_pago or venta.fecha or datetime.now(timezone.utc),
            descripcion=f"Venta #{num_visible} — {desc_metodo}",
            tipo_origen="venta",
            referencia_id=venta.id,
            referencia_tipo="Venta",
            total_debitos=total_asiento,
            total_creditos=total_asiento,
        )
        db.add(asiento)
        db.flush()

        lineas = [
            models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_caja.id,
                descripcion=f"Recaudo venta #{num_visible}", debito=total, credito=0.0, orden=1),
            models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_ingreso.id,
                descripcion=f"Ingreso venta #{num_visible}", debito=0.0, credito=base, orden=2),
        ]
        if cuenta_iva and iva > 0:
            lineas.append(models.LineaAsiento(
                empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_iva.id,
                descripcion=f"IVA venta #{num_visible}", debito=0.0, credito=iva, orden=3,
            ))
        if incluir_costo:
            lineas.append(models.LineaAsiento(
                empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_costo.id,
                descripcion=f"Costo mercancía venta #{num_visible}",
                debito=costo_venta, credito=0.0, orden=len(lineas) + 1,
            ))
            lineas.append(models.LineaAsiento(
                empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_inv.id,
                descripcion=f"Salida inventario venta #{num_visible}",
                debito=0.0, credito=costo_venta, orden=len(lineas) + 1,
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


# ─── ASIENTO POR COMPRA ───────────────────────────────────────────────────────

def registrar_asiento_compra(db: Session, compra, pago=None) -> None:
    """
    Partida doble para una compra.
    Al crear la compra (inventario entra):
      Débito  1430  Inventario de mercancías
      Crédito 2205  Proveedores (CxP)

    Al registrar un pago a proveedor:
      Débito  2205  Proveedores (CxP)
      Crédito 1105/1110  Caja/Bancos
    """
    try:
        empresa_id = compra.empresa_id
        inicializar_puc(db, empresa_id)

        if pago is not None:
            # Asiento de PAGO al proveedor
            monto = float(pago.monto or 0)
            if monto <= 0:
                return
            ya_existe = db.query(models.AsientoContable).filter(
                models.AsientoContable.empresa_id == empresa_id,
                models.AsientoContable.tipo_origen == "pago_compra",
                models.AsientoContable.referencia_id == pago.id,
            ).first()
            if ya_existe:
                return

            cuenta_cxp   = _get_cuenta(db, empresa_id, "2205")
            metodo       = getattr(pago, "metodo_pago", None)
            codigo_caja  = _cuenta_caja(db, empresa_id, metodo)
            cuenta_caja  = _get_cuenta(db, empresa_id, codigo_caja)
            if not cuenta_cxp or not cuenta_caja:
                return

            numero  = _siguiente_numero(db, empresa_id)
            asiento = models.AsientoContable(
                empresa_id=empresa_id, numero=numero,
                fecha=getattr(pago, "fecha", None) or datetime.now(timezone.utc),
                descripcion=f"Pago compra #{compra.id} — {metodo or 'Efectivo'}",
                tipo_origen="pago_compra",
                referencia_id=pago.id, referencia_tipo="PagoCompra",
                total_debitos=monto, total_creditos=monto,
            )
            db.add(asiento)
            db.flush()
            db.add_all([
                models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
                    cuenta_contable_id=cuenta_cxp.id,
                    descripcion=f"Cancelación CxP compra #{compra.id}", debito=monto, credito=0.0, orden=1),
                models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
                    cuenta_contable_id=cuenta_caja.id,
                    descripcion=f"Salida de caja pago proveedor", debito=0.0, credito=monto, orden=2),
            ])
            db.flush()

        else:
            # Asiento de ENTRADA de inventario (compra creada)
            total = float(compra.total or 0)
            if total <= 0:
                return
            ya_existe = db.query(models.AsientoContable).filter(
                models.AsientoContable.empresa_id == empresa_id,
                models.AsientoContable.tipo_origen == "compra",
                models.AsientoContable.referencia_id == compra.id,
            ).first()
            if ya_existe:
                return

            # IVA descontable separado (1355): el inventario entra por la BASE
            # y el IVA de la compra va al activo fiscal — sin esto la
            # declaración de IVA no puede descontar compras y el inventario
            # queda sobrevalorado.
            iva_compra = float(getattr(compra, "iva_total", 0) or 0)
            iva_compra = min(iva_compra, total)
            base_compra = total - iva_compra

            num_compra = getattr(compra, "numero_compra", None) or compra.id
            cuenta_inv = _get_cuenta(db, empresa_id, "1430")
            cuenta_cxp = _get_cuenta(db, empresa_id, "2205")
            cuenta_iva_desc = _get_cuenta(db, empresa_id, "1355") if iva_compra > 0 else None
            if not cuenta_inv or not cuenta_cxp:
                return

            numero  = _siguiente_numero(db, empresa_id)
            asiento = models.AsientoContable(
                empresa_id=empresa_id, numero=numero,
                fecha=getattr(compra, "fecha", None) or datetime.now(timezone.utc),
                descripcion=f"Compra #{num_compra} — {getattr(compra, 'referencia_factura', '') or 'Sin factura'}",
                tipo_origen="compra",
                referencia_id=compra.id, referencia_tipo="Compra",
                total_debitos=total, total_creditos=total,
            )
            db.add(asiento)
            db.flush()
            lineas = [
                models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
                    cuenta_contable_id=cuenta_inv.id,
                    descripcion=f"Entrada inventario compra #{num_compra}",
                    debito=(base_compra if cuenta_iva_desc else total), credito=0.0, orden=1),
            ]
            if cuenta_iva_desc:
                lineas.append(models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
                    cuenta_contable_id=cuenta_iva_desc.id,
                    descripcion=f"IVA descontable compra #{num_compra}",
                    debito=iva_compra, credito=0.0, orden=2))
            lineas.append(models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_cxp.id,
                descripcion=f"Obligación con proveedor #{getattr(compra, 'proveedor_id', '')}",
                debito=0.0, credito=total, orden=len(lineas) + 1))
            db.add_all(lineas)
            db.flush()

            # Compra pagada de contado: cancelar la CxP inmediatamente contra
            # caja/bancos. Sin este asiento la cuenta 2205 quedaba acreditada
            # para siempre (proveedores inflados y caja sin la salida).
            if getattr(compra, "estado_pago", None) == "pagado":
                ya_pago = db.query(models.AsientoContable).filter(
                    models.AsientoContable.empresa_id == empresa_id,
                    models.AsientoContable.tipo_origen == "pago_compra_contado",
                    models.AsientoContable.referencia_id == compra.id,
                ).first()
                # Solo si tampoco hay pagos registrados en PagoCompra
                tiene_pagos = db.query(models.PagoCompra).filter(
                    models.PagoCompra.compra_id == compra.id
                ).first() is not None
                if not ya_pago and not tiene_pagos:
                    cuenta_caja = _get_cuenta(db, empresa_id, "1105")
                    if cuenta_caja:
                        numero_p = _siguiente_numero(db, empresa_id)
                        asiento_p = models.AsientoContable(
                            empresa_id=empresa_id, numero=numero_p,
                            fecha=getattr(compra, "fecha", None) or datetime.now(timezone.utc),
                            descripcion=f"Pago de contado compra #{num_compra}",
                            tipo_origen="pago_compra_contado",
                            referencia_id=compra.id, referencia_tipo="Compra",
                            total_debitos=total, total_creditos=total,
                        )
                        db.add(asiento_p)
                        db.flush()
                        db.add_all([
                            models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento_p.id,
                                cuenta_contable_id=cuenta_cxp.id,
                                descripcion=f"Cancelación CxP compra #{num_compra}",
                                debito=total, credito=0.0, orden=1),
                            models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento_p.id,
                                cuenta_contable_id=cuenta_caja.id,
                                descripcion="Salida de caja pago de contado",
                                debito=0.0, credito=total, orden=2),
                        ])
                        db.flush()
    except Exception as exc:
        logger.exception("Error generando asiento para compra: %s", exc)


# ─── ASIENTO POR CUOTA DE PRÉSTAMO ────────────────────────────────────────────

def registrar_asiento_cuota_prestamo(
    db: Session, empresa_id: int, cuota, monto_recibido: float, metodo_pago: Optional[str] = None
) -> None:
    """
    Partida doble para el cobro de una cuota de préstamo.
    El pago se descompone en capital + intereses:
      Débito  1105/1110  Caja/Bancos         (total recibido)
      Crédito 1605       Cartera (capital)    (proporción capital)
      Crédito 4210       Intereses            (proporción intereses)
    """
    try:
        inicializar_puc(db, empresa_id)

        prestamo_id = getattr(cuota, "prestamo_id", None)
        cuota_id    = getattr(cuota, "id", None)
        monto       = float(monto_recibido or 0)
        if monto <= 0:
            return

        ya_existe = db.query(models.AsientoContable).filter(
            models.AsientoContable.empresa_id == empresa_id,
            models.AsientoContable.tipo_origen == "cuota_prestamo",
            models.AsientoContable.referencia_id == cuota_id,
        ).first()
        if ya_existe:
            return

        # Calcular split capital/intereses usando tasa del préstamo
        from sqlalchemy.orm import Session as _S
        prestamo = db.query(models.Prestamo).filter(
            models.Prestamo.id == prestamo_id,
            models.Prestamo.empresa_id == empresa_id,
        ).first() if prestamo_id else None

        if prestamo and prestamo.monto_total_pagar and prestamo.monto_prestado:
            tasa_interes = prestamo.tasa_interes or 0
            factor_capital = prestamo.monto_prestado / prestamo.monto_total_pagar
        else:
            factor_capital = 0.7  # fallback: 70% capital, 30% intereses

        capital    = round(monto * factor_capital, 2)
        intereses  = round(monto - capital, 2)

        codigo_caja   = _cuenta_caja(db, empresa_id, metodo_pago)
        cuenta_caja   = _get_cuenta(db, empresa_id, codigo_caja)
        cuenta_cartera = _get_cuenta(db, empresa_id, "1605")
        cuenta_int     = _get_cuenta(db, empresa_id, "4210")

        if not cuenta_caja or not cuenta_cartera or not cuenta_int:
            return

        numero  = _siguiente_numero(db, empresa_id)
        asiento = models.AsientoContable(
            empresa_id=empresa_id, numero=numero,
            fecha=getattr(cuota, "fecha_pago", None) or datetime.now(timezone.utc),
            descripcion=f"Cobro cuota préstamo #{prestamo_id} — cuota {getattr(cuota, 'numero_cuota', '?')}",
            tipo_origen="cuota_prestamo",
            referencia_id=cuota_id, referencia_tipo="CuotaPrestamo",
            total_debitos=monto, total_creditos=monto,
        )
        db.add(asiento)
        db.flush()

        lineas = [
            models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_caja.id,
                descripcion=f"Recaudo cuota {getattr(cuota,'numero_cuota','?')} préstamo #{prestamo_id}",
                debito=monto, credito=0.0, orden=1),
            models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_cartera.id,
                descripcion=f"Recuperación capital", debito=0.0, credito=capital, orden=2),
        ]
        if intereses > 0:
            lineas.append(models.LineaAsiento(
                empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_int.id,
                descripcion=f"Intereses cobrados", debito=0.0, credito=intereses, orden=3,
            ))
        db.add_all(lineas)
        db.flush()
    except Exception as exc:
        logger.exception("Error generando asiento para cuota préstamo: %s", exc)


# ─── ASIENTO POR DEVOLUCIÓN ───────────────────────────────────────────────────

def registrar_asiento_devolucion(db: Session, devolucion, venta) -> None:
    """
    Reversa contable de una devolución de venta:
      Débito  4135/4175  Ingresos (base devuelta)
      Débito  2408       IVA generado (IVA proporcional devuelto)
      Crédito 1105/1110  Caja/Bancos (total devuelto)
    Y la reversa del costo (mercancía que vuelve al inventario):
      Débito  1430  Inventario
      Crédito 6135  Costo de ventas
    """
    try:
        empresa_id = venta.empresa_id
        inicializar_puc(db, empresa_id)

        ya_existe = db.query(models.AsientoContable).filter(
            models.AsientoContable.empresa_id == empresa_id,
            models.AsientoContable.tipo_origen == "devolucion",
            models.AsientoContable.referencia_id == devolucion.id,
        ).first()
        if ya_existe:
            return

        total_dev = float(getattr(devolucion, "monto_total", 0) or getattr(devolucion, "total", 0) or 0)
        if total_dev <= 0:
            return

        # IVA proporcional según el porcentaje de la venta original
        iva_pct = float(getattr(venta, "iva_porcentaje", 0) or 0)
        iva_dev = round(total_dev * iva_pct / (100 + iva_pct), 2) if iva_pct > 0 else 0.0
        base_dev = total_dev - iva_dev

        # Costo de la mercancía devuelta (vuelve al inventario)
        costo_dev = 0.0
        try:
            for it in (devolucion.items or []):
                p = getattr(it, "producto", None)
                if p is None:
                    p = db.query(models.Producto).filter(
                        models.Producto.id == it.producto_id,
                        models.Producto.empresa_id == empresa_id,
                    ).first()
                if p is not None and not getattr(p, "es_servicio", False):
                    costo_dev += float(it.cantidad or 0) * float(p.costo or 0)
        except Exception:
            costo_dev = 0.0
        costo_dev = round(costo_dev, 2)

        origen = getattr(venta, "origen", "erp") or "erp"
        codigo_ingreso = "4175" if origen in ("lavadero", "parqueadero_horas", "parqueadero_suscripcion") else "4135"

        cuenta_ingreso = _get_cuenta(db, empresa_id, codigo_ingreso)
        cuenta_caja    = _get_cuenta(db, empresa_id, _cuenta_caja(db, empresa_id, venta.metodo_pago))
        cuenta_iva     = _get_cuenta(db, empresa_id, "2408") if iva_dev > 0 else None
        cuenta_inv     = _get_cuenta(db, empresa_id, "1430") if costo_dev > 0 else None
        cuenta_costo   = _get_cuenta(db, empresa_id, "6135") if costo_dev > 0 else None
        if not cuenta_ingreso or not cuenta_caja:
            return

        num_venta = getattr(venta, "numero_venta", None) or venta.id
        incluir_costo = bool(cuenta_inv and cuenta_costo and costo_dev > 0)
        total_asiento = total_dev + (costo_dev if incluir_costo else 0.0)

        numero = _siguiente_numero(db, empresa_id)
        asiento = models.AsientoContable(
            empresa_id=empresa_id, numero=numero,
            fecha=getattr(devolucion, "fecha", None) or datetime.now(timezone.utc),
            descripcion=f"Devolución #{devolucion.id} de venta #{num_venta}",
            tipo_origen="devolucion",
            referencia_id=devolucion.id, referencia_tipo="Devolucion",
            total_debitos=total_asiento, total_creditos=total_asiento,
        )
        db.add(asiento)
        db.flush()

        lineas = [
            models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_ingreso.id,
                descripcion=f"Reversa ingreso venta #{num_venta}",
                debito=base_dev, credito=0.0, orden=1),
        ]
        if cuenta_iva and iva_dev > 0:
            lineas.append(models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_iva.id,
                descripcion=f"Reversa IVA venta #{num_venta}",
                debito=iva_dev, credito=0.0, orden=len(lineas) + 1))
        lineas.append(models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
            cuenta_contable_id=cuenta_caja.id,
            descripcion=f"Salida caja devolución #{devolucion.id}",
            debito=0.0, credito=total_dev, orden=len(lineas) + 1))
        if incluir_costo:
            lineas.append(models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_inv.id,
                descripcion="Reingreso mercancía a inventario",
                debito=costo_dev, credito=0.0, orden=len(lineas) + 1))
            lineas.append(models.LineaAsiento(empresa_id=empresa_id, asiento_id=asiento.id,
                cuenta_contable_id=cuenta_costo.id,
                descripcion="Reversa costo de ventas",
                debito=0.0, credito=costo_dev, orden=len(lineas) + 1))
        db.add_all(lineas)
        db.flush()
    except Exception as exc:
        logger.exception("Error generando asiento para devolución %s: %s", getattr(devolucion, "id", "?"), exc)


# ─── BACKFILL HISTÓRICO ───────────────────────────────────────────────────────

def backfill_contabilidad(db: Session, empresa_id: int) -> dict:
    """
    Genera asientos contables para TODAS las transacciones históricas que
    aún no tienen asiento. Es idempotente: puede ejecutarse múltiples veces.
    Devuelve un resumen con cuántos asientos se crearon por tipo.
    """
    inicializar_puc(db, empresa_id)
    db.commit()

    resumen = {"ventas": 0, "gastos": 0, "compras": 0, "pagos_compra": 0, "cuotas": 0}

    # ── Ventas pagadas ────────────────────────────────────────────────────────
    ventas_sin_asiento = (
        db.query(models.Venta)
        .filter(
            models.Venta.empresa_id == empresa_id,
            models.Venta.estado_pago == "pagado",
        )
        .outerjoin(
            models.AsientoContable,
            (models.AsientoContable.tipo_origen == "venta") &
            (models.AsientoContable.referencia_id == models.Venta.id) &
            (models.AsientoContable.empresa_id == empresa_id),
        )
        .filter(models.AsientoContable.id == None)
        .all()
    )
    # Commit por lotes: cada asiento incrementa el contador en la fila de la
    # empresa (lock de fila en Postgres); mantenerlo hasta el final bloquearía
    # todas las ventas/compras concurrentes del tenant durante el backfill.
    for i, v in enumerate(ventas_sin_asiento, 1):
        registrar_asiento_venta(db, v)
        resumen["ventas"] += 1
        if i % 50 == 0:
            db.commit()
    db.commit()

    # ── Gastos ────────────────────────────────────────────────────────────────
    gastos_sin_asiento = (
        db.query(models.Gasto)
        .filter(models.Gasto.empresa_id == empresa_id)
        .outerjoin(
            models.AsientoContable,
            (models.AsientoContable.tipo_origen == "gasto") &
            (models.AsientoContable.referencia_id == models.Gasto.id) &
            (models.AsientoContable.empresa_id == empresa_id),
        )
        .filter(models.AsientoContable.id == None)
        .all()
    )
    for g in gastos_sin_asiento:
        registrar_asiento_gasto(db, g)
        resumen["gastos"] += 1
    db.commit()

    # ── Compras ───────────────────────────────────────────────────────────────
    compras_sin_asiento = (
        db.query(models.Compra)
        .filter(models.Compra.empresa_id == empresa_id)
        .outerjoin(
            models.AsientoContable,
            (models.AsientoContable.tipo_origen == "compra") &
            (models.AsientoContable.referencia_id == models.Compra.id) &
            (models.AsientoContable.empresa_id == empresa_id),
        )
        .filter(models.AsientoContable.id == None)
        .all()
    )
    for c in compras_sin_asiento:
        registrar_asiento_compra(db, c)
        resumen["compras"] += 1
    db.commit()

    # ── Pagos a proveedores ───────────────────────────────────────────────────
    pagos_sin_asiento = (
        db.query(models.PagoCompra)
        .join(models.Compra, models.PagoCompra.compra_id == models.Compra.id)
        .filter(models.Compra.empresa_id == empresa_id)
        .outerjoin(
            models.AsientoContable,
            (models.AsientoContable.tipo_origen == "pago_compra") &
            (models.AsientoContable.referencia_id == models.PagoCompra.id) &
            (models.AsientoContable.empresa_id == empresa_id),
        )
        .filter(models.AsientoContable.id == None)
        .all()
    )
    for p in pagos_sin_asiento:
        compra = db.query(models.Compra).get(p.compra_id)
        if compra:
            registrar_asiento_compra(db, compra, pago=p)
            resumen["pagos_compra"] += 1
    db.commit()

    # ── Cuotas de préstamo cobradas ───────────────────────────────────────────
    cuotas_sin_asiento = (
        db.query(models.CuotaPrestamo)
        .join(models.Prestamo, models.CuotaPrestamo.prestamo_id == models.Prestamo.id)
        .filter(
            models.Prestamo.empresa_id == empresa_id,
            models.CuotaPrestamo.estado_pago.in_(["Pagado", "Parcial", "pagado", "parcial"]),
        )
        .outerjoin(
            models.AsientoContable,
            (models.AsientoContable.tipo_origen == "cuota_prestamo") &
            (models.AsientoContable.referencia_id == models.CuotaPrestamo.id) &
            (models.AsientoContable.empresa_id == empresa_id),
        )
        .filter(models.AsientoContable.id == None)
        .all()
    )
    for cuota in cuotas_sin_asiento:
        monto = float(cuota.monto_cuota or 0) - float(cuota.saldo_pendiente or 0)
        if monto > 0:
            registrar_asiento_cuota_prestamo(db, empresa_id, cuota,
                monto_recibido=monto, metodo_pago=cuota.metodo_pago)
            resumen["cuotas"] += 1
    db.commit()

    resumen["total"] = sum(resumen.values())
    return resumen
