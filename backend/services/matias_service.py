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
from datetime import datetime, timezone, timedelta
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
TYPE_DOCUMENT_FACTURA_VENTA   = 7    # Factura de venta (FE, CUFE)
TYPE_DOCUMENT_POS_ELECTRONICO = 20   # Documento Equivalente Electrónico / Tiquete POS (DEE, CUDE)
OPERATION_TYPE_STANDARD       = 1    # Operación estándar nacional

# Datos del fabricante del software (software_manufacturer) — obligatorio en DEE POS.
# Identifican al proveedor tecnológico (Ksmart360) ante la DIAN. Configurables por env.
SW_MANUFACTURER_OWNER   = os.getenv("MATIAS_SW_OWNER_NAME",   "KSMART360")
SW_MANUFACTURER_COMPANY = os.getenv("MATIAS_SW_COMPANY_NAME", "KSMART360 SAS")
SW_MANUFACTURER_NAME    = os.getenv("MATIAS_SW_SOFTWARE_NAME", "KSMART360 POS")

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
    if any(w in mp for w in ["tarjeta", "débito", "debito", "crédito", "credito"]):
        return MEANS_TARJETA
    if any(w in mp for w in ["transferencia", "consignación", "consignacion", "banco",
                              "pse", "nequi", "daviplata", "qr", "link", "wompi", "digital"]):
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


def _normalizar_dni(dni: Optional[str]) -> str:
    """
    Matias exige que customer.dni sea alfanumérico (sin puntos, guiones ni espacios).
    Quita el dígito verificador de NIT (900123456-1 → 900123456) y caracteres no válidos.
    """
    if not dni:
        return ""
    s = str(dni).strip()
    # Quitar dígito verificador si viene como NIT con guion
    if "-" in s:
        s = s.split("-")[0]
    # Conservar solo caracteres alfanuméricos
    return "".join(c for c in s if c.isalnum())


def build_invoice_payload(venta, empresa, cliente, detalles, tipo_documento: str = "fe") -> dict:
    """
    Construye el payload JSON para POST /invoice de Matias API.

    tipo_documento:
        "fe"  → Factura Electrónica (type_document_id=7, cliente identificado, CUFE)
        "pos" → Documento Equivalente Electrónico / Tiquete POS
                (type_document_id=20, consumidor final por defecto, CUDE).
                Requiere los bloques point_of_sale y software_manufacturer.

    Estructura validada contra documentación oficial de Lopezsoft (junio 2026).
    La empresa emisora NO va en el payload — Matias la asocia al Bearer token.
    """
    es_pos = (tipo_documento == "pos")
    ahora = venta.fecha or datetime.now(timezone.utc)
    # Convertir a zona horaria de Colombia (UTC-5)
    tz_colombia = timezone(timedelta(hours=-5))
    ahora_col = ahora.astimezone(tz_colombia) if ahora.tzinfo else ahora.replace(tzinfo=timezone.utc).astimezone(tz_colombia)
    fecha_str = ahora_col.strftime("%Y-%m-%d")
    hora_str  = ahora_col.strftime("%H:%M:%S")

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
    # Si la cédula queda vacía tras normalizar (solo tenía caracteres inválidos),
    # se factura como consumidor final en lugar de enviar un dni inválido.
    _dni_norm = _normalizar_dni(getattr(cliente, "cedula", None)) if cliente else ""
    usar_consumidor_final = (cliente is None or not _dni_norm)

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
            "dni":                    _normalizar_dni(cliente.cedula),
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
        prod = getattr(det, "producto", None)
        nombre_item = (
            getattr(det, "nombre_libre", None)
            or (prod.nombre if prod else None)
            or "Ítem"
        )
        # Adjuntar nombre de variante si existe (ej: "Camiseta - Talla M")
        nombre_variante = getattr(det, "nombre_variante", None)
        if nombre_variante:
            nombre_item = f"{nombre_item} - {nombre_variante}"

        codigo_item = (
            (getattr(prod, "codigo_barras", None) or getattr(prod, "sku", None) or str(getattr(prod, "id", "")))
            if prod
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

    pago = {
        "payment_method_id": payment_method_id,
        "means_payment_id":  _medio_pago_id(metodo_pago),
        "value_paid":        f"{total_pagar:.2f}",
    }
    # A crédito (payment_method_id=2): Matias exige fecha de vencimiento.
    if payment_method_id == 2:
        venc = getattr(venta, "fecha_vencimiento", None)
        if venc:
            venc_str = venc.astimezone(tz_colombia).strftime("%Y-%m-%d") if getattr(venc, "tzinfo", None) else venc.strftime("%Y-%m-%d")
        else:
            # Sin fecha definida → 30 días desde la emisión (default razonable)
            venc_str = (ahora_col + timedelta(days=30)).strftime("%Y-%m-%d")
        pago["payment_due_date"] = venc_str

    payments = [pago]

    # ── Payload final ────────────────────────────────────────────────────────
    payload = {
        "resolution_number": resolucion.numero_resolucion if resolucion else "",
        "prefix":            prefijo,
        "document_number":   str(numero_int),
        "date":              fecha_str,
        "time":              hora_str,
        "type_document_id":  TYPE_DOCUMENT_POS_ELECTRONICO if es_pos else TYPE_DOCUMENT_FACTURA_VENTA,
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

    # ── Bloques obligatorios del Documento Equivalente POS (DEE) ─────────────
    if es_pos:
        caja = getattr(empresa, "nombre", None) or "Caja principal"
        payload["point_of_sale"] = {
            "cashier_name":    (getattr(venta, "operador_nombre", None) or caja)[:100],
            "terminal_number": "CAJA01",
            "cashier_type":    "Caja principal",
            "sales_code":      "POS01",
            "address":         getattr(empresa, "direccion", None) or "No registra",
            "sub_total":       f"{base_sum:.2f}",
        }
        payload["software_manufacturer"] = {
            "owner_name":   SW_MANUFACTURER_OWNER,
            "company_name": SW_MANUFACTURER_COMPANY,
            "software_name": SW_MANUFACTURER_NAME,
        }

    return payload


def build_subscription_invoice_payload(registro_pago, empresa_cliente, plan, plataforma) -> dict:
    """
    Construye el payload para facturar una suscripción del sistema.
    La empresa emisora es el dueño del sistema (asociado al Bearer token de Matías,
    configurado en PlataformaConfig). El receptor es la empresa cliente que pagó.
    """
    ahora = registro_pago.fecha_pago or datetime.now(timezone.utc)
    tz_colombia = timezone(timedelta(hours=-5))
    ahora_col = ahora.astimezone(tz_colombia) if getattr(ahora, "tzinfo", None) else ahora.replace(tzinfo=timezone.utc).astimezone(tz_colombia)
    fecha_str = ahora_col.strftime("%Y-%m-%d")
    hora_str  = ahora_col.strftime("%H:%M:%S")

    prefijo   = (plataforma.resolucion_prefijo if plataforma else "") or ""
    siguiente = ((plataforma.resolucion_numero_actual or 0) + 1) if plataforma else 1

    # ── Cliente (empresa que pagó la suscripción) ───────────────────────────
    nit_cliente = getattr(empresa_cliente, "nit", None)
    if nit_cliente:
        customer = {
            "country_id":             COLOMBIA_ID,
            "city_id":                _ciudad_id(getattr(empresa_cliente, "ciudad_code", None)),
            "identity_document_id":   DOC_NIT,
            "type_organization_id":   getattr(empresa_cliente, "tipo_organizacion_id", 2),
            "tax_regime_id":          2,
            "tax_level_id":           5,
            "company_name":           empresa_cliente.nombre or "",
            "dni":                    _normalizar_dni(nit_cliente),
            "mobile":                 _normalizar_telefono(None),
            "email":                  getattr(empresa_cliente, "correo_facturacion", "") or getattr(empresa_cliente, "email", "") or "",
            "address":                getattr(empresa_cliente, "ciudad", "") or "No registra",
            "postal_code":            "110111",
        }
    else:
        customer = {
            "country_id":           COLOMBIA_ID,
            "city_id":              BOGOTA_ID,
            "identity_document_id": DOC_CC,
            "type_organization_id": 2,
            "tax_regime_id":        2,
            "tax_level_id":         5,
            "company_name":         empresa_cliente.nombre or CONSUMIDOR_FINAL_NOMBRE,
            "dni":                  CONSUMIDOR_FINAL_NIT,
            "mobile":               "0000000",
            "email":                getattr(empresa_cliente, "correo_facturacion", "") or "",
            "address":              "No registra",
            "postal_code":          "110111",
        }

    # ── Línea: servicio de suscripción (sin IVA — si aplica IVA ajustar aquí) ──
    precio = float(registro_pago.monto or plan.precio or 0)
    lines = [
        {
            "invoiced_quantity":            "1",
            "quantity_units_id":            UNIDAD_UND,
            "line_extension_amount":        f"{precio:.2f}",
            "free_of_charge_indicator":     False,
            "description":                  f"Suscripción KSmart360 — {plan.nombre}",
            "code":                         f"SUBS-{plan.codigo_interno.upper()}",
            "type_item_identifications_id": ITEM_TYPE_ID,
            "reference_price_id":           REF_PRICE_ID,
            "price_amount":                 f"{precio:.4f}",
            "base_quantity":                "1",
        }
    ]

    legal_monetary_totals = {
        "line_extension_amount": f"{precio:.2f}",
        "tax_exclusive_amount":  f"{precio:.2f}",
        "tax_inclusive_amount":  f"{precio:.2f}",
        "total_charges":         0,
        "total_allowance":       0,
        "payable_amount":        f"{precio:.2f}",
    }

    metodo_pago = getattr(registro_pago, "metodo_pago", None)
    pago = {
        "payment_method_id": 1,  # contado
        "means_payment_id":  _medio_pago_id(metodo_pago),
        "value_paid":        f"{precio:.2f}",
    }

    return {
        "resolution_number": (plataforma.resolucion_numero if plataforma else "") or "",
        "prefix":            prefijo,
        "document_number":   str(siguiente),
        "date":              fecha_str,
        "time":              hora_str,
        "type_document_id":  TYPE_DOCUMENT_FACTURA_VENTA,
        "operation_type_id": OPERATION_TYPE_STANDARD,
        "graphic_representation": 1,
        "send_email": 1 if customer.get("email") and nit_cliente else 0,
        "notes":      f"Pago suscripción plataforma. Ref: {registro_pago.bold_tx_id or ''}",
        "payments":   [pago],
        "customer":   customer,
        "lines":      lines,
        "legal_monetary_totals": legal_monetary_totals,
    }


def emitir_factura_suscripcion(
    registro_pago,
    empresa_cliente,
    plan,
    plataforma,
    api_key: str,
    test_mode: bool,
) -> dict:
    """
    Emite la factura electrónica de una suscripción usando las credenciales
    Matías del dueño del sistema (PlataformaConfig).

    Retorna dict con: estado, cufe_fe, pdf_url_fe, numero_factura, mensaje
    Nunca lanza excepción.
    """
    payload_dict: dict = {}
    respuesta_raw: dict = {}
    try:
        base_url     = get_matias_url(test_mode)
        payload_dict = build_subscription_invoice_payload(registro_pago, empresa_cliente, plan, plataforma)
        endpoint     = f"{base_url}/invoice"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type":  "application/json",
            "Accept":        "application/json",
        }
        prefijo   = payload_dict.get("prefix", "")
        doc_num   = payload_dict.get("document_number", "")
        logger.info("Emitiendo FE suscripción empresa %s → %s (test=%s)", getattr(empresa_cliente, "id", "?"), endpoint, test_mode)

        with httpx.Client(timeout=HTTP_TIMEOUT) as http_client:
            response = http_client.post(endpoint, json=payload_dict, headers=headers)
        try:
            respuesta_raw = response.json()
        except Exception:
            respuesta_raw = {"raw": response.text}

        success_flag = respuesta_raw.get("success", False)
        dian_resp    = respuesta_raw.get("data") or respuesta_raw.get("response") or {}
        is_valid     = str(dian_resp.get("IsValid", "false")).lower() == "true"

        if response.is_success and success_flag and is_valid:
            cufe    = dian_resp.get("XmlDocumentKey")
            pdf_url = (respuesta_raw.get("pdf") or {}).get("url")
            mensaje = dian_resp.get("StatusDescription", "Factura emitida exitosamente")
            logger.info("FE suscripción exitosa empresa %s — CUFE: %s", getattr(empresa_cliente, "id", "?"), cufe)
            return {
                "estado":            "exitoso",
                "cufe_fe":           cufe,
                "pdf_url_fe":        pdf_url,
                "numero_factura":    f"{prefijo}{doc_num}",
                "mensaje":           mensaje,
            }
        else:
            errors = respuesta_raw.get("errors", {})
            errores_lista = [f"{k}: {v[0] if isinstance(v, list) else v}" for k, v in errors.items()] if errors else []
            mensaje_error = "; ".join(errores_lista) or respuesta_raw.get("message") or f"HTTP {response.status_code}"
            logger.warning("FE suscripción fallida empresa %s: %s", getattr(empresa_cliente, "id", "?"), mensaje_error)
            return {"estado": "fallido", "cufe_fe": None, "pdf_url_fe": None, "numero_factura": None, "mensaje": str(mensaje_error)}

    except httpx.TimeoutException as exc:
        logger.error("Timeout Matias FE suscripción: %s", exc)
        return {"estado": "fallido", "cufe_fe": None, "pdf_url_fe": None, "numero_factura": None, "mensaje": f"Timeout ({HTTP_TIMEOUT}s)"}
    except Exception as exc:
        logger.error("Error inesperado FE suscripción: %s", exc)
        return {"estado": "fallido", "cufe_fe": None, "pdf_url_fe": None, "numero_factura": None, "mensaje": str(exc)}


def emitir_factura(
    venta,
    empresa,
    cliente,
    detalles,
    api_key: str,
    test_mode: bool,
    tipo_documento: str = "fe",
) -> dict:
    """
    Llama a POST /invoice de Matias API (sync con httpx.Client).

    tipo_documento: "fe" (Factura Electrónica) | "pos" (Documento Equivalente POS/DEE).

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
        payload_dict = build_invoice_payload(venta, empresa, cliente, detalles, tipo_documento=tipo_documento)
        endpoint     = f"{base_url}/invoice"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type":  "application/json",
            "Accept":        "application/json",
        }

        logger.info(
            "Emitiendo %s venta %s → %s (test_mode=%s)",
            "DEE-POS" if tipo_documento == "pos" else "FE",
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
