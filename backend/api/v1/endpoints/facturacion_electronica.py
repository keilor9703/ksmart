"""
Endpoints de Facturación Electrónica (FE) con Matias API.

Rutas:
    POST  /fe/ventas/{venta_id}/emitir  — emite o re-emite la FE de una venta
    GET   /fe/pendientes                — lista ventas pendientes o fallidas
    POST  /webhooks/matias              — recibe callbacks de Matias (sin auth)
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session, joinedload

import models
from api.deps import get_db, get_current_active_user
from services import matias_service

logger = logging.getLogger("facturacion_electronica")

# Secret para validar webhooks de Matias (configurable por variable de entorno)
MATIAS_WEBHOOK_SECRET = os.getenv("MATIAS_WEBHOOK_SECRET", "")

router          = APIRouter()
webhooks_router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _registrar_intento(
    db: Session,
    venta_id: int,
    empresa_id: int,
    resultado: dict,
) -> None:
    """Guarda un registro de auditoría en intentos_fe."""
    try:
        intento = models.IntentoFE(
            venta_id           = venta_id,
            empresa_id         = empresa_id,
            timestamp          = datetime.now(timezone.utc),
            estado             = resultado.get("estado"),
            payload_enviado    = resultado.get("payload_enviado"),
            respuesta_recibida = resultado.get("respuesta_recibida"),
            cufe               = resultado.get("cufe"),
            mensaje            = resultado.get("mensaje"),
        )
        db.add(intento)
        db.flush()
    except Exception as exc:
        # Auditoría no debe bloquear el flujo principal
        logger.warning("No se pudo registrar intento FE: %s", exc)


def _aplicar_resultado_a_venta(
    db: Session,
    venta: models.Venta,
    resultado: dict,
) -> None:
    """Actualiza los campos FE de la venta según el resultado de Matias."""
    venta.estado_electronico = resultado["estado"]
    venta.mensaje_proveedor  = resultado.get("mensaje")
    if resultado.get("cufe"):
        venta.cufe    = resultado["cufe"]
    if resultado.get("pdf_url"):
        venta.pdf_url = resultado["pdf_url"]
    if resultado.get("xml_url"):
        venta.xml_url = resultado["xml_url"]
    if resultado.get("qr_url"):
        venta.qr_data = resultado["qr_url"]
    db.add(venta)


# ═══════════════════════════════════════════════════════════════════════════════
# POST /fe/ventas/{venta_id}/emitir
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/ventas/{venta_id}/emitir")
def emitir_fe(
    venta_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """
    Emite o re-emite la Factura Electrónica de una venta.

    1. Valida que la venta pertenece a la empresa del usuario autenticado.
    2. Verifica que la empresa tiene FE activa y api_key configurada.
    3. Construye el payload y llama a Matias API.
    4. Actualiza la venta con CUFE, URLs y estado.
    5. Registra el intento en intentos_fe para auditoría.
    """
    empresa_id = current_user.empresa_id

    # Cargar venta
    venta = (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.cliente),
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
            joinedload(models.Venta.resolucion),
        )
        .filter(
            models.Venta.id         == venta_id,
            models.Venta.empresa_id == empresa_id,
        )
        .first()
    )
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    if not venta.numero_factura:
        raise HTTPException(
            status_code=400,
            detail="La venta no tiene número de factura asignado (sin resolución activa)"
        )

    # Cargar empresa
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if not empresa.facturacion_electronica_activa:
        raise HTTPException(
            status_code=400,
            detail="La empresa no tiene Facturación Electrónica activada"
        )

    # Validación en vivo: el plan vigente debe incluir FE
    from crud.ventas import plan_incluye_fe
    if not plan_incluye_fe(db, empresa_id):
        raise HTTPException(
            status_code=403,
            detail="Tu plan actual no incluye facturación electrónica. Actualiza tu suscripción."
        )

    if not empresa.matias_api_key:
        raise HTTPException(
            status_code=400,
            detail="La empresa no tiene configurada la API Key de Matias"
        )

    # Cargar cliente (puede ser None — Consumidor Final)
    cliente = None
    if venta.cliente_id:
        cliente = db.query(models.Cliente).filter(
            models.Cliente.id         == venta.cliente_id,
            models.Cliente.empresa_id == empresa_id,
        ).first()

    # Llamar a Matias — usar token sandbox o producción según modo
    test_mode = empresa.matias_test_mode
    api_key   = empresa.matias_sandbox_api_key if test_mode else empresa.matias_api_key
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No hay API Key configurada para el modo activo (sandbox)" if test_mode else "La empresa no tiene configurada la API Key de Matias"
        )

    resultado = matias_service.emitir_factura(
        venta    = venta,
        empresa  = empresa,
        cliente  = cliente,
        detalles = venta.detalles,
        api_key  = api_key,
        test_mode= test_mode,
    )

    # Actualizar venta
    _aplicar_resultado_a_venta(db, venta, resultado)

    # Registrar auditoría
    _registrar_intento(db, venta_id=venta.id, empresa_id=empresa_id, resultado=resultado)

    db.commit()

    return {
        "venta_id":          venta.id,
        "numero_factura":    venta.numero_factura,
        "estado":            resultado["estado"],
        "cufe":              resultado.get("cufe"),
        "pdf_url":           resultado.get("pdf_url"),
        "xml_url":           resultado.get("xml_url"),
        "mensaje":           resultado.get("mensaje"),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /fe/pendientes
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/pendientes")
def listar_pendientes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """
    Lista ventas con estado_electronico='pendiente' o 'fallido' de la empresa
    del usuario autenticado.
    """
    empresa_id = current_user.empresa_id

    ventas = (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.cliente),
        )
        .filter(
            models.Venta.empresa_id        == empresa_id,
            models.Venta.estado_electronico.in_(["pendiente", "fallido"]),
        )
        .order_by(models.Venta.fecha.desc())
        .limit(200)
        .all()
    )

    return [
        {
            "id":                 v.id,
            "numero_factura":     v.numero_factura,
            "cliente":            v.cliente.nombre if v.cliente else "Consumidor Final",
            "total":              v.total,
            "fecha":              v.fecha.isoformat() if v.fecha else None,
            "estado_electronico": v.estado_electronico,
            "mensaje_proveedor":  v.mensaje_proveedor,
        }
        for v in ventas
    ]


@router.get("/intentos")
def listar_intentos(
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Lista intentos de FE paginados (10 por página por defecto)."""
    empresa_id = current_user.empresa_id
    page_size  = min(max(page_size, 1), 100)
    offset     = (max(page, 1) - 1) * page_size

    base = db.query(models.IntentoFE).filter(models.IntentoFE.empresa_id == empresa_id)
    total    = base.count()
    intentos = base.order_by(models.IntentoFE.timestamp.desc()).offset(offset).limit(page_size).all()

    return {
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "pages":     (total + page_size - 1) // page_size,
        "items": [
            {
                "id":        i.id,
                "venta_id":  i.venta_id,
                "timestamp": i.timestamp.isoformat() if i.timestamp else None,
                "estado":    i.estado,
                "cufe":      i.cufe,
                "mensaje":   i.mensaje,
            }
            for i in intentos
        ],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# POST /webhooks/matias  (sin autenticación de usuario — valida secret en header)
# ═══════════════════════════════════════════════════════════════════════════════

@webhooks_router.post("/matias")
def webhook_matias(
    payload: dict,
    db: Session = Depends(get_db),
    x_matias_secret: Optional[str] = Header(default=None),
):
    """
    Recibe callbacks (webhooks) de Matias API cuando cambia el estado de una
    factura (ej: aceptada por DIAN, rechazada, etc.).

    Validación: compara el header X-Matias-Secret con MATIAS_WEBHOOK_SECRET.
    Si la variable de entorno está vacía, el secret no se valida (desarrollo).

    TODO: ajustar nombres de campos del payload cuando se tenga documentación
    de los eventos de Matias.
    """
    # Validar secret si está configurado
    if MATIAS_WEBHOOK_SECRET:
        if x_matias_secret != MATIAS_WEBHOOK_SECRET:
            logger.warning("Webhook de Matias rechazado — secret inválido")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Secret inválido",
            )

    # TODO: ajustar los nombres de campos según documentación de Matias
    cufe       = payload.get("cufe")
    nuevo_estado = payload.get("estado") or payload.get("status")
    mensaje    = payload.get("message") or payload.get("mensaje") or ""

    if not cufe:
        logger.info("Webhook Matias recibido sin CUFE — ignorado. Payload: %s", payload)
        return {"ok": True, "procesado": False, "razon": "sin_cufe"}

    # Buscar venta por CUFE
    venta = db.query(models.Venta).filter(models.Venta.cufe == cufe).first()
    if not venta:
        logger.info("Webhook Matias: no se encontró venta con CUFE %s", cufe)
        return {"ok": True, "procesado": False, "razon": "venta_no_encontrada"}

    # Mapear estado de Matias a nuestro vocabulario interno
    # TODO: ajustar el mapeo según los valores reales que envíe Matias
    estado_mapeado = {
        "accepted":  "exitoso",
        "rejected":  "fallido",
        "pending":   "pendiente",
        "exitoso":   "exitoso",
        "fallido":   "fallido",
        "pendiente": "pendiente",
    }.get(str(nuevo_estado).lower(), "fallido")

    venta.estado_electronico = estado_mapeado
    venta.mensaje_proveedor  = mensaje or venta.mensaje_proveedor

    # Registrar auditoría del callback
    _registrar_intento(
        db,
        venta_id   = venta.id,
        empresa_id = venta.empresa_id,
        resultado  = {
            "estado":             estado_mapeado,
            "cufe":               cufe,
            "mensaje":            f"[WEBHOOK] {mensaje}",
            "payload_enviado":    None,
            "respuesta_recibida": json.dumps(payload, default=str),
        },
    )

    db.add(venta)
    db.commit()

    logger.info(
        "Webhook Matias procesado: venta %s, CUFE %s → %s",
        venta.id, cufe, estado_mapeado,
    )
    return {"ok": True, "procesado": True, "venta_id": venta.id, "estado": estado_mapeado}
