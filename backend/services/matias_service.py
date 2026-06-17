"""
Servicio de integración con Matias API (Lopezsoft) — Facturación Electrónica DIAN.

Autenticación: Bearer token (JWT, validez 1 año).
El token se guarda en Empresa.matias_api_key y se obtiene una vez desde el portal
https://auth.matias-api.com — el usuario lo pega en la configuración de Ksmart360.

La empresa emisora NO va en el payload — Matias la asocia automáticamente al token.
Solo va: cliente, líneas, totales, resolución y consecutivo.
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger("matias_service")

# ─── URLs base ────────────────────────────────────────────────────────────────
MATIAS_PROD_URL    = os.getenv("MATIAS_PROD_URL",    "https://api-v2.matias-api.com/api/ubl2.1")
MATIAS_SANDBOX_URL = os.getenv("MATIAS_SANDBOX_URL", "https://sandbox-api.matias-api.com/api/ubl2.1")

# Consumidor Final — NIT DIAN oficial para ventas sin identificación
CONSUMIDOR_FINAL_NIT    = "222222222222"
CONSUMIDOR_FINAL_NOMBRE = "CONSUMIDOR FINAL"

# Constantes de catálogo Matias (obtenidas de GET /identity-documents, /cities, etc.)
DOC_NIT       = "1"   # NIT
DOC_CC        = "3"   # Cédula de ciudadanía
DOC_CE        = "2"   # Cédula de extranjería
COLOMBIA_ID   = "45"  # country_id Colombia
BOGOTA_ID     = "149" # city_id Bogotá (fallback)
UNIDAD_UND    = "1093"  # quantity_units_id: unidad
ITEM_TYPE_ID  = "4"     # type_item_identifications_id: estándar
REF_PRICE_ID  = "1"     # reference_price_id: precio de referencia

# Tipos de documento Matias
TYPE_DOCUMENT_FACTURA_VENTA = 7   # Factura de venta
OPERATION_TYPE_STANDARD     = 1   # Operación estándar nacional

# Medios de pago Matias
MEANS_EFECTIVO      = 10
MEANS_TARJETA       = 10  # fallback efectivo hasta confirmar ID correcto de Matias
MEANS_TRANSFERENCIA = 31  # transferencia bancaria según colección Postman oficial

HTTP_TIMEOUT = 30


def get_matias_url(test_mode: bool) -> str:
    return MATIAS_SANDBOX_URL if test_mode else MATIAS_PROD_URL


def _medio_pago_id(metodo_pago: Optional[str]) -> int:
    """Mapea el método de pago interno de Ksmart360 al means_payment_id de Matias."""
    if not metodo_pago:
        return MEANS_EFECTIVO
    mp = metodo_pago.lower()
    if any(w in mp for w in ["tarjeta", "débito", "debito", "crédito", "credito", "nequi", "daviplata"]):
        return MEANS_TARJETA
    if any(w in mp for w in ["transferencia", "consignación", "consignacion", "banco", "pse"]):
        return MEANS_TRANSFERENCIA
    return MEANS_EFECTIVO


def _ciudad_id(ciudad_code: Optional[str]) -> str:
    """
    Convierte el código DIAN de ciudad al city_id de Matias.
    Por ahora retorna el código directamente — ajustar si Matias usa IDs propios.
    """
    return ciudad_code or BOGOTA_ID


def _normalizar_telefono(telefono: Optional[str]) -> str:
    """
    Matias exige entre 7 y 15 dígitos en customer.mobile.
    Limpia el valor recibido y aplica fallback si está vacío o es inválido.
    """
    if not telefono:
        return "0000000"
    solo_digitos = "".join(c for c in str(telefono) if c.isdigit())
    if len(solo_digitos) < 7:
        return "0000000"
    return solo_digitos[:15]


def build_invoice_payload(venta, empresa, cliente, detalles) -> dict:
    """
    Construye el payload JSON para POST /invoice de Matias API.

    Estructura validada contra documentación oficial de Lopezsoft (junio 2026).
    La empresa emisora NO va en el payload — Matias la asocia al Bearer token.
    """
    ahora = venta.fecha or datetime.now(timezone.utc)
    fecha_str = ahora.strftime("%Y-%m-%d")
    hora_str  = ahora.strftime("%H:%M:%S")

    # Separar prefijo y número del numero_factura (ej: "FE00001" → prefijo="FE", numero=1)
    resolucion = getattr(venta, "resolucion", None)
    prefijo    = (resolucion.prefijo if resolucion else "") or ""
    raw_num    = venta.numero_factura or ""
    if prefijo and raw_num.startswith(prefijo):
        numero_str = raw_num[len(prefijo):]
    else:
        numero_str = raw_num
    try:
        numero_int = int(numero_str)
    except (ValueError, TypeError):
        numero_int = 0

    # ── Cliente (receptor) ──────────────────────────────────────────────────
    usar_consumidor_final = (
        cliente is None
        or not getattr(cliente, "cedula", None)
    )

    if usar_consumidor_final:
        customer = {
            "country_id":           COLOMBIA_ID,
            "city_id":              _ciudad_id(getattr(empresa, "ciudad_code", None)),
            "identity_document_id": DOC_CC,
            "type_organization_id": 2,   # Persona natural
            "tax_regime_id":        2,   # No responsable IVA (ID Matias)
            "tax_level_id":         5,   # No aplica (ID Matias)
            "company_name":         CONSUMIDOR_FINAL_NOMBRE,
            "dni":                  CONSUMIDOR_FINAL_NIT,
            "mobile":               "0000000",
            "email":                getattr(empresa, "correo_facturacion", "") or "",
            "address":              "No registra",
            "postal_code":          "110111",
        }
    else:
        # Determinar identity_document_id según tipo_documento_id interno
        tipo_doc = getattr(cliente, "tipo_documento_id", 13)
        if tipo_doc == 31:   # NIT
            id_doc = DOC_NIT
        else:                 # CC y otros
            id_doc = DOC_CC

        customer = {
            "country_id":             COLOMBIA_ID,
            "city_id":                _ciudad_id(getattr(cliente, "ciudad_code", None) or getattr(empresa, "ciudad_code", None)),
            "identity_document_id":   id_doc,
            "type_organization_id":   getattr(cliente, "tipo_organizacion_id", 2),
            "tax_regime_id":          2,   # No responsable IVA (ID Matias)
            "tax_level_id":           5,   # No aplica (ID Matias)
            "company_name":           cliente.nombre or "",
            "dni":                    cliente.cedula or "",
            "mobile":                 _normalizar_telefono(getattr(cliente, "telefono", None)),
            "email":                  getattr(cliente, "email", "") or "",
            "address":                getattr(cliente, "direccion", "") or "No registra",
            "postal_code":            "110111",
        }

    # ── Líneas de factura ───────────────────────────────────────────────────
    lines         = []
    iva_total_sum = 0.0
    base_sum      = 0.0

    for det in detalles:
        nombre_item = (
            getattr(det, "nombre_libre", None)
            or (det.producto.nombre if getattr(det, "producto", None) else None)
            or "Ítem"
        )
        codigo_item = (
            getattr(det.producto, "codigo_barra", None)
            if getattr(det, "producto", None)
            else None
        ) or "SIN-CODIGO"

        cantidad    = float(det.cantidad or 1)
        precio_unit = float(det.precio_unitario or 0)
        desc_pct    = float(getattr(det, "descuento_pct", 0) or 0)
        iva_pct     = float(getattr(det, "iva_porcentaje", 0) or 0)

        # Matias espera precios SIN IVA. Si el precio incluye IVA, extraerlo.
        # Ksmart360 guarda precios con IVA incluido — retroacalcular la base.
        if iva_pct > 0:
            precio_sin_iva = round(precio_unit / (1 + iva_pct / 100), 4)
        else:
            precio_sin_iva = precio_unit

        subtotal_linea = round(precio_sin_iva * cantidad, 2)

        # Descuento sobre la línea
        if desc_pct > 0:
            descuento_val  = round(subtotal_linea * desc_pct / 100, 2)
            subtotal_linea = round(subtotal_linea - descuento_val, 2)
        else:
            descuento_val = 0.0

        iva_linea = round(subtotal_linea * iva_pct / 100, 2)
        base_sum      += subtotal_linea
        iva_total_sum += iva_linea

        line = {
            "invoiced_quantity":           str(cantidad),
            "quantity_units_id":           UNIDAD_UND,
            "line_extension_amount":       f"{subtotal_linea:.2f}",
            "free_of_charge_indicator":    False,
            "description":                 nombre_item,
            "code":                        codigo_item,
            "type_item_identifications_id": ITEM_TYPE_ID,
            "reference_price_id":          REF_PRICE_ID,
            "price_amount":                f"{precio_sin_iva:.4f}",
            "base_quantity":               str(cantidad),
        }

        if iva_pct > 0:
            line["tax_totals"] = [
                {
                    "tax_id":         "1",  # IVA
                    "tax_amount":     round(iva_linea, 2),
                    "taxable_amount": round(subtotal_linea, 2),
                    "percent":        int(iva_pct),
                }
            ]

        if descuento_val > 0:
            line["allowance_charges"] = [
                {
                    "charge_indicator":        False,
                    "allowance_charge_reason": "Descuento comercial",
                    "amount":                  f"{descuento_val:.2f}",
                    "base_amount":             f"{round(precio_sin_iva * cantidad, 2):.2f}",
                    "discount_id":             1,
                }
            ]

        lines.append(line)

    # ── Totales legales ─────────────────────────────────────────────────────
    base_sum      = round(base_sum, 2)
    iva_total_sum = round(iva_total_sum, 2)
    total_pagar   = round(base_sum + iva_total_sum, 2)

    legal_monetary_totals = {
        "line_extension_amount": f"{base_sum:.2f}",
        "tax_exclusive_amount":  f"{base_sum:.2f}",
        "tax_inclusive_amount":  f"{total_pagar:.2f}",
        "total_charges":         0,
        "total_allowance":       0,
        "payable_amount":        f"{total_pagar:.2f}",
    }

    # tax_totals nivel raíz (suma de todos los impuestos)
    tax_totals_root = []
    if iva_total_sum > 0:
        iva_pct_general = float(getattr(venta, "iva_porcentaje", 0) or 0)
        tax_totals_root = [
            {
                "tax_id":         "1",
                "tax_amount":     iva_total_sum,
                "taxable_amount": base_sum,
                "percent":        int(iva_pct_general),
            }
        ]

    # ── Pago ────────────────────────────────────────────────────────────────
    metodo_pago   = getattr(venta, "metodo_pago", None)
    estado_pago   = getattr(venta, "estado_pago", "pendiente")
    payment_method_id = 1 if estado_pago == "pagado" else 2  # 1=contado, 2=crédito

    payments = [
        {
            "payment_method_id": payment_method_id,
            "means_payment_id":  _medio_pago_id(metodo_pago),
            "value_paid":        f"{total_pagar:.2f}",
        }
    ]

    # ── Payload final ────────────────────────────────────────────────────────
    payload = {
        "resolution_number": resolucion.numero_resolucion if resolucion else "",
        "prefix":            prefijo,
        "document_number":   str(numero_int),
        "date":              fecha_str,
        "time":              hora_str,
        "type_document_id":  TYPE_DOCUMENT_FACTURA_VENTA,
        "operation_type_id": OPERATION_TYPE_STANDARD,
        "graphic_representation": 1,  # Generar PDF
        "send_email":             1 if (not usar_consumidor_final and customer.get("email")) else 0,
        "notes":             getattr(venta, "observaciones", "") or "",
        "payments":          payments,
        "customer":          customer,
        "lines":             lines,
        "legal_monetary_totals": legal_monetary_totals,
    }

    if tax_totals_root:
        payload["tax_totals"] = tax_totals_root

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
    Llama a POST /invoice de Matias API (sync con httpx.Client).

    Retorna:
        {
            "estado":             "exitoso" | "fallido",
            "cufe":               str | None,
            "pdf_url":            str | None,
            "xml_url":            str | None,
            "qr_url":             str | None,
            "mensaje":            str,
            "payload_enviado":    str (JSON),
            "respuesta_recibida": str (JSON),
        }

    Nunca lanza excepción — un fallo de FE nunca debe bloquear la venta.
    """
    payload_dict: dict = {}
    respuesta_raw: dict = {}

    try:
        base_url     = get_matias_url(test_mode)
        payload_dict = build_invoice_payload(venta, empresa, cliente, detalles)
        endpoint     = f"{base_url}/invoice"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type":  "application/json",
            "Accept":        "application/json",
        }

        logger.info(
            "Emitiendo FE venta %s → %s (test_mode=%s)",
            getattr(venta, "id", "?"), endpoint, test_mode,
        )

        with httpx.Client(timeout=HTTP_TIMEOUT) as http_client:
            response = http_client.post(endpoint, json=payload_dict, headers=headers)

        try:
            respuesta_raw = response.json()
        except Exception:
            respuesta_raw = {"raw": response.text}

        success_flag = respuesta_raw.get("success", False)
        # Matias usa "data" en éxito y "response" en error
        dian_resp    = respuesta_raw.get("data") or respuesta_raw.get("response") or {}
        is_valid     = str(dian_resp.get("IsValid", "false")).lower() == "true"

        if response.is_success and success_flag:
            # Extraer campos de la respuesta según documentación oficial Matias
            cufe    = dian_resp.get("XmlDocumentKey")
            pdf_url = (respuesta_raw.get("pdf") or {}).get("url")
            xml_url = (respuesta_raw.get("AttachedDocument") or {}).get("url")
            qr_url  = (respuesta_raw.get("qr") or {}).get("qrDian")

            # Notificaciones DIAN (no son errores, solo avisos)
            dian_messages = (dian_resp.get("ErrorMessage") or {}).get("string", [])
            mensaje = dian_resp.get("StatusDescription", "Factura emitida exitosamente")

            if not is_valid:
                # Documento rechazado por DIAN (tiene success=True pero IsValid=false)
                logger.warning("DIAN rechazó factura venta %s: %s", venta.id, dian_messages)
                return {
                    "estado":             "fallido",
                    "cufe":               cufe,
                    "pdf_url":            None,
                    "xml_url":            None,
                    "qr_url":             None,
                    "mensaje":            f"Rechazada por DIAN: {'; '.join(dian_messages) if dian_messages else mensaje}",
                    "payload_enviado":    json.dumps(payload_dict, default=str),
                    "respuesta_recibida": json.dumps(respuesta_raw, default=str),
                }

            logger.info("FE exitosa venta %s — CUFE: %s", venta.id, cufe)
            return {
                "estado":             "exitoso",
                "cufe":               cufe,
                "pdf_url":            pdf_url,
                "xml_url":            xml_url,
                "qr_url":             qr_url,
                "mensaje":            mensaje,
                "payload_enviado":    json.dumps(payload_dict, default=str),
                "respuesta_recibida": json.dumps(respuesta_raw, default=str),
            }
        else:
            # Error HTTP o success=False de Matias
            errors = respuesta_raw.get("errors", {})
            errores_lista = [
                f"{k}: {v[0] if isinstance(v, list) else v}"
                for k, v in errors.items()
            ] if errors else []
            mensaje_error = (
                "; ".join(errores_lista)
                or respuesta_raw.get("message")
                or f"HTTP {response.status_code}"
            )
            logger.warning("Matias rechazó FE venta %s: %s", getattr(venta, "id", "?"), mensaje_error)
            return {
                "estado":             "fallido",
                "cufe":               None,
                "pdf_url":            None,
                "xml_url":            None,
                "qr_url":             None,
                "mensaje":            str(mensaje_error),
                "payload_enviado":    json.dumps(payload_dict, default=str),
                "respuesta_recibida": json.dumps(respuesta_raw, default=str),
            }

    except httpx.TimeoutException as exc:
        logger.error("Timeout Matias API venta %s: %s", getattr(venta, "id", "?"), exc)
        return {
            "estado": "fallido", "cufe": None, "pdf_url": None, "xml_url": None, "qr_url": None,
            "mensaje": f"Timeout al contactar Matias API ({HTTP_TIMEOUT}s)",
            "payload_enviado":    json.dumps(payload_dict, default=str),
            "respuesta_recibida": "{}",
        }
    except Exception as exc:
        logger.error("Error inesperado emitir_factura venta %s: %s", getattr(venta, "id", "?"), exc)
        return {
            "estado": "fallido", "cufe": None, "pdf_url": None, "xml_url": None, "qr_url": None,
            "mensaje": f"Error interno: {exc}",
            "payload_enviado":    json.dumps(payload_dict, default=str),
            "respuesta_recibida": json.dumps(respuesta_raw, default=str),
        }
