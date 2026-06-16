"""
Servicio de integración con Matias API (proveedor FE colombiano).
Skeleton listo para conectar — los campos exactos del payload se marcan con TODO:
cuando se obtenga la documentación oficial de Matias.
"""

import json
import logging
import os
from datetime import datetime, timezone

import httpx

logger = logging.getLogger("matias_service")

# ─── URLs base ────────────────────────────────────────────────────────────────
MATIAS_SANDBOX_URL = os.getenv("MATIAS_SANDBOX_URL", "https://apiv2-test.mattias.co/api/v1")
MATIAS_PROD_URL    = os.getenv("MATIAS_PROD_URL",    "https://apiv2.mattias.co/api/v1")

# Datos de Consumidor Final DIAN
CONSUMIDOR_FINAL_NIT      = "222222222222"
CONSUMIDOR_FINAL_NOMBRE   = "Consumidor Final"
CONSUMIDOR_FINAL_TIPO_DOC = 13  # Cédula de ciudadanía

# Timeout para llamadas HTTP (segundos)
HTTP_TIMEOUT = 30


def get_matias_url(test_mode: bool) -> str:
    """Retorna la URL base según el modo (sandbox o producción)."""
    return MATIAS_SANDBOX_URL if test_mode else MATIAS_PROD_URL


def build_invoice_payload(venta, empresa, cliente, detalles) -> dict:
    """
    Construye el payload JSON para enviar a Matias API.

    - Si cliente es None o no tiene cédula, usa datos de Consumidor Final
      (NIT 222222222222, tipo_documento_id=13).
    - Los campos marcados con TODO: deben ajustarse cuando se tenga
      documentación oficial de Matias.

    Args:
        venta:    instancia de models.Venta (ya tiene numero_factura y resolucion)
        empresa:  instancia de models.Empresa (emisor)
        cliente:  instancia de models.Cliente | None
        detalles: lista de models.DetalleVenta

    Returns:
        dict con el payload listo para serializar a JSON
    """
    fecha_str = (
        venta.fecha.strftime("%Y-%m-%dT%H:%M:%S")
        if venta.fecha
        else datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    )

    # Separar prefijo y número del numero_factura (ej: "FE001" → prefijo="FE", numero=1)
    resolucion = getattr(venta, "resolucion", None)
    prefijo    = resolucion.prefijo if resolucion else ""
    if venta.numero_factura and prefijo:
        numero_str = venta.numero_factura[len(prefijo):]
    else:
        numero_str = venta.numero_factura or ""
    try:
        numero_int = int(numero_str)
    except (ValueError, TypeError):
        numero_int = 0

    # ── Datos del emisor (empresa) ──────────────────────────────────────────
    emisor = {
        # TODO: verificar nombre exacto del campo NIT en Matias
        "nit":                    empresa.nit or "",
        "dv":                     empresa.dv or "",
        "nombre":                 empresa.nombre or "",
        # TODO: verificar si Matias usa tipo_organizacion_id o tipo_persona
        "tipo_organizacion_id":   empresa.tipo_organizacion_id or 1,
        # TODO: verificar si Matias usa tipo_regimen_id o codigo_regimen
        "tipo_regimen_id":        empresa.tipo_regimen_id or 48,
        "responsabilidad_fiscal": empresa.responsabilidad_fiscal_codes or "O-13",
        "departamento_code":      empresa.departamento_code or "",
        "ciudad_code":            empresa.ciudad_code or "",
        "correo":                 empresa.correo_facturacion or "",
        # TODO: verificar campos adicionales del emisor requeridos por Matias
    }

    # ── Datos del receptor (cliente / consumidor final) ─────────────────────
    usar_consumidor_final = (
        cliente is None
        or not getattr(cliente, "cedula", None)
    )

    if usar_consumidor_final:
        receptor = {
            # TODO: verificar nombre exacto del campo documento en Matias
            "tipo_documento_id": CONSUMIDOR_FINAL_TIPO_DOC,
            "documento":         CONSUMIDOR_FINAL_NIT,
            "nombre":            CONSUMIDOR_FINAL_NOMBRE,
            "correo":            "",
            "ciudad_code":       empresa.ciudad_code or "",
            # TODO: verificar campos obligatorios adicionales para consumidor final
        }
    else:
        receptor = {
            "tipo_documento_id":      getattr(cliente, "tipo_documento_id", 13),
            "documento":              cliente.cedula or "",
            "dv":                     getattr(cliente, "dv", "") or "",
            "nombre":                 cliente.nombre or "",
            "correo":                 getattr(cliente, "email", "") or "",
            "ciudad_code":            getattr(cliente, "ciudad_code", "") or empresa.ciudad_code or "",
            "tipo_organizacion_id":   getattr(cliente, "tipo_organizacion_id", 2),
            "tipo_regimen_id":        getattr(cliente, "tipo_regimen_id", 49),
            "responsabilidad_fiscal": getattr(cliente, "responsabilidad_fiscal_codes", "R-99-PN") or "R-99-PN",
            # TODO: verificar campos adicionales del receptor requeridos por Matias
        }

    # ── Ítems de la factura ─────────────────────────────────────────────────
    items = []
    for det in detalles:
        nombre_item = (
            det.nombre_libre
            or (det.producto.nombre if det.producto else None)
            or "Ítem"
        )
        items.append({
            # TODO: verificar nombres de campos de ítems en Matias
            "descripcion":     nombre_item,
            "cantidad":        det.cantidad,
            "precio_unitario": det.precio_unitario,
            "descuento_pct":   getattr(det, "descuento_pct", 0.0) or 0.0,
            "iva_porcentaje":  getattr(det, "iva_porcentaje", 0.0) or 0.0,
            # TODO: verificar si Matias necesita unidad_medida, codigo, etc.
        })

    # ── Totales ─────────────────────────────────────────────────────────────
    totales = {
        # TODO: verificar nombres de campos de totales en Matias
        "subtotal":        round(venta.total - (venta.iva_total or 0), 2),
        "iva_total":       round(venta.iva_total or 0, 2),
        "descuento_total": round(getattr(venta, "descuento_total", 0) or 0, 2),
        "total":           round(venta.total or 0, 2),
    }

    # ── Datos de la resolución DIAN ─────────────────────────────────────────
    resolucion_payload = {}
    if resolucion:
        resolucion_payload = {
            # TODO: verificar nombres de campos de resolución en Matias
            "numero_resolucion": resolucion.numero_resolucion or "",
            "vigencia_desde":    resolucion.vigencia_desde.isoformat() if resolucion.vigencia_desde else "",
            "vigencia_hasta":    resolucion.vigencia_hasta.isoformat() if resolucion.vigencia_hasta else "",
            "rango_desde":       resolucion.numero_inicial,
            "rango_hasta":       resolucion.numero_final,
            "clave_tecnica":     resolucion.clave_tecnica or "",
        }

    payload = {
        # TODO: verificar estructura raíz del payload en Matias
        "numero":     numero_int,
        "prefijo":    prefijo,
        "fecha":      fecha_str,
        "emisor":     emisor,
        "receptor":   receptor,
        "items":      items,
        "totales":    totales,
        "resolucion": resolucion_payload,
        # TODO: añadir campos adicionales requeridos: tipo_factura, moneda, notas, etc.
    }

    return payload


def emitir_factura(
    venta,
    empresa,
    cliente,
    detalles,
    api_key: str,
    test_mode: bool,
) -> dict:
    """
    Llama a Matias API (sync con httpx.Client) para emitir la factura electrónica.

    Retorna un dict con:
        {
            "estado":             "exitoso" | "fallido",
            "cufe":               str | None,
            "pdf_url":            str | None,
            "xml_url":            str | None,
            "mensaje":            str,
            "payload_enviado":    str (JSON),
            "respuesta_recibida": str (JSON),
        }

    Nunca lanza excepción — captura cualquier error y retorna estado='fallido'.
    """
    payload_dict: dict = {}
    respuesta_raw: dict = {}

    try:
        base_url     = get_matias_url(test_mode)
        payload_dict = build_invoice_payload(venta, empresa, cliente, detalles)

        # TODO: ajustar el endpoint exacto de emisión cuando se tenga documentación
        endpoint = f"{base_url}/invoices"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type":  "application/json",
            "Accept":        "application/json",
        }

        with httpx.Client(timeout=HTTP_TIMEOUT) as http_client:
            response = http_client.post(endpoint, json=payload_dict, headers=headers)

        try:
            respuesta_raw = response.json()
        except Exception:
            respuesta_raw = {"raw": response.text}

        if response.is_success:
            # TODO: ajustar nombres de campos en la respuesta según documentación de Matias
            cufe    = respuesta_raw.get("cufe") or respuesta_raw.get("data", {}).get("cufe")
            pdf_url = respuesta_raw.get("pdf_url") or respuesta_raw.get("data", {}).get("pdf_url")
            xml_url = respuesta_raw.get("xml_url") or respuesta_raw.get("data", {}).get("xml_url")
            mensaje = (
                respuesta_raw.get("message")
                or respuesta_raw.get("mensaje")
                or "Factura emitida exitosamente"
            )

            return {
                "estado":             "exitoso",
                "cufe":               cufe,
                "pdf_url":            pdf_url,
                "xml_url":            xml_url,
                "mensaje":            str(mensaje),
                "payload_enviado":    json.dumps(payload_dict, default=str),
                "respuesta_recibida": json.dumps(respuesta_raw, default=str),
            }
        else:
            mensaje_error = (
                respuesta_raw.get("message")
                or respuesta_raw.get("error")
                or respuesta_raw.get("detail")
                or f"HTTP {response.status_code}"
            )
            logger.warning(
                "Matias API devolvió error %s para venta %s: %s",
                response.status_code, venta.id, mensaje_error,
            )
            return {
                "estado":             "fallido",
                "cufe":               None,
                "pdf_url":            None,
                "xml_url":            None,
                "mensaje":            str(mensaje_error),
                "payload_enviado":    json.dumps(payload_dict, default=str),
                "respuesta_recibida": json.dumps(respuesta_raw, default=str),
            }

    except httpx.TimeoutException as exc:
        logger.error("Timeout llamando Matias API para venta %s: %s", getattr(venta, "id", "?"), exc)
        return {
            "estado":             "fallido",
            "cufe":               None,
            "pdf_url":            None,
            "xml_url":            None,
            "mensaje":            f"Timeout al contactar Matias API: {exc}",
            "payload_enviado":    json.dumps(payload_dict, default=str),
            "respuesta_recibida": "{}",
        }
    except Exception as exc:
        logger.error(
            "Error inesperado en emitir_factura para venta %s: %s",
            getattr(venta, "id", "?"), exc,
        )
        return {
            "estado":             "fallido",
            "cufe":               None,
            "pdf_url":            None,
            "xml_url":            None,
            "mensaje":            f"Error interno al emitir FE: {exc}",
            "payload_enviado":    json.dumps(payload_dict, default=str),
            "respuesta_recibida": json.dumps(respuesta_raw, default=str),
        }
