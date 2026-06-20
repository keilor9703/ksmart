"""
Cierre de caja con Facturación Electrónica consolidada para parqueaderos.

Modelo DIAN (Resolución 0015/2021): los parqueaderos atienden consumidores
finales no identificados. Cada acceso por horas genera un recibo POS, y al
cierre del día se emite UNA factura electrónica que consolida todos los
ingresos por horas de ese día a nombre de "Consumidor Final".

Las suscripciones se facturan individualmente (cliente identificable) y NO
entran en el cierre consolidado.

Para no duplicar ingresos en los reportes financieros, la Venta consolidada se
crea con origen="parqueadero_cierre_fe" y estado_pago="consolidado" (los
reportes suman solo origen IN (parqueadero_horas, parqueadero_suscripcion) y
estado_pago=="pagado").
"""
from datetime import datetime, timezone, time, date as date_cls
from fastapi import HTTPException
from sqlalchemy.orm import Session

import models
from crud.common import get_utc_boundaries


ORIGEN_HORAS    = "parqueadero_horas"
ORIGEN_CIERRE   = "parqueadero_cierre_fe"
ESTADO_CONSOLID = "consolidado"


def _ventas_horas_pendientes(db: Session, empresa_id: int, dia: date_cls):
    """Ventas por horas del día indicado aún no cubiertas por FE."""
    inicio_utc, fin_utc = get_utc_boundaries(dia, db)
    return (
        db.query(models.Venta)
        .filter(
            models.Venta.empresa_id == empresa_id,
            models.Venta.origen == ORIGEN_HORAS,
            models.Venta.fecha >= inicio_utc,
            models.Venta.fecha <= fin_utc,
            models.Venta.total > 0,
            # Pendientes: nunca enviadas ni ya consolidadas/exitosas
            (models.Venta.estado_electronico.is_(None))
            | (models.Venta.estado_electronico.in_(["no_enviado", "fallido"])),
        )
        .order_by(models.Venta.fecha.asc())
        .all()
    )


def preview_cierre_fe(db: Session, empresa_id: int, dia: date_cls) -> dict:
    """Resumen de lo que se consolidaría para el día indicado (sin emitir)."""
    pendientes = _ventas_horas_pendientes(db, empresa_id, dia)
    total = round(sum(float(v.total or 0) for v in pendientes), 2)
    return {
        "fecha":       dia.isoformat(),
        "num_accesos": len(pendientes),
        "total":       total,
        "puede_cerrar": len(pendientes) > 0,
    }


def ejecutar_cierre_fe(db: Session, empresa_id: int, dia: date_cls) -> dict:
    """
    Emite la FE consolidada del día. Crea una Venta-documento consolidada,
    la factura a Consumidor Final y marca las ventas por horas incluidas.
    """
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if not empresa or not empresa.facturacion_electronica_activa:
        raise HTTPException(status_code=400, detail="La facturación electrónica no está activa para esta empresa.")
    if not (empresa.matias_api_key or empresa.matias_sandbox_api_key):
        raise HTTPException(status_code=400, detail="Configura tu token de Matías antes de emitir FE.")

    pendientes = _ventas_horas_pendientes(db, empresa_id, dia)
    if not pendientes:
        raise HTTPException(status_code=400, detail="No hay accesos por horas pendientes de facturar para este día.")

    total = round(sum(float(v.total or 0) for v in pendientes), 2)
    num   = len(pendientes)

    # Venta-documento consolidada (no suma ingresos: origen/estado especiales)
    consolidada = models.Venta(
        empresa_id   = empresa_id,
        total        = total,
        monto_pagado = total,
        estado_pago  = ESTADO_CONSOLID,
        metodo_pago  = "Varios",
        origen       = ORIGEN_CIERRE,
        tipo         = "cierre",
        fecha_pago   = datetime.now(timezone.utc),
        observaciones = f"Cierre FE parqueadero {dia.isoformat()} — {num} accesos por horas",
    )
    db.add(consolidada)
    db.flush()

    from crud import ventas as _crud_ventas
    detalle = _crud_ventas._DetalleSintetico(
        descripcion=f"Servicio de parqueadero por horas — {dia.strftime('%d/%m/%Y')} ({num} accesos)",
        monto=total,
    )
    resultado = _crud_ventas.emitir_fe_venta(db, empresa_id, consolidada, [detalle], cliente=None)

    if not resultado:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo emitir la FE consolidada. Verifica que tengas una resolución DIAN activa."
        )

    # Marcar las ventas por horas como cubiertas por el cierre consolidado
    if consolidada.estado_electronico == "exitoso":
        for v in pendientes:
            v.estado_electronico = ESTADO_CONSOLID
            v.mensaje_proveedor  = f"Incluida en cierre FE #{consolidada.numero_factura}"

    db.commit()
    db.refresh(consolidada)

    return {
        "estado":          consolidada.estado_electronico,
        "numero_factura":  consolidada.numero_factura,
        "cufe":            consolidada.cufe,
        "pdf_url":         consolidada.pdf_url,
        "total":           total,
        "num_accesos":     num,
        "mensaje":         resultado.get("mensaje"),
    }


def listar_cierres_fe(db: Session, empresa_id: int, limit: int = 100) -> list:
    """Historial de cierres consolidados de FE."""
    cierres = (
        db.query(models.Venta)
        .filter(
            models.Venta.empresa_id == empresa_id,
            models.Venta.origen == ORIGEN_CIERRE,
        )
        .order_by(models.Venta.fecha.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id":             c.id,
            "fecha":          c.fecha.isoformat() if c.fecha else None,
            "total":          c.total,
            "numero_factura": c.numero_factura,
            "estado_fe":      c.estado_electronico if c.estado_electronico in ("exitoso", "fallido") else None,
            "cufe":           c.cufe,
            "pdf_url":        c.pdf_url,
            "observaciones":  c.observaciones,
        }
        for c in cierres
    ]
