import pytest
from datetime import datetime, timezone
from services.matias_service import build_invoice_payload

class MockEntity:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

def test_build_invoice_payload_mixed_taxes():
    # Arrange
    empresa = MockEntity(
        id=1,
        nombre="Mi Empresa Test",
        nit="123456789",
        ciudad_code="11001",
        direccion="Calle Falsa 123",
        correo_facturacion="factura@test.com"
    )
    
    cliente = MockEntity(
        id=10,
        nombre="Cliente B2B Test",
        cedula="900111222-3",
        tipo_documento_id=31, # NIT
        tipo_organizacion_id=1, # Jurídica
        ciudad_code="11001",
        email="cliente@test.com",
        telefono="3001234567",
        direccion="Av Siempre Viva 742"
    )

    resolucion = MockEntity(
        id=100,
        prefijo="FE",
        numero_resolucion="18762000001",
        clave_tecnica="clave123"
    )

    venta = MockEntity(
        id=50,
        fecha=datetime(2026, 7, 4, 15, 30, 0, tzinfo=timezone.utc),
        numero_factura="FE00123",
        resolucion=resolucion,
        solicita_fe=True,
        total=34300.0,
        iva_total=2400.0,
        iva_porcentaje=19.0, # General fallback (legacy)
        observaciones="Venta de prueba",
        metodo_pago="Efectivo",
        estado_pago="pagado"
    )

    # Detalle 1: Con 19% IVA (precio unitario con IVA = 11900 COP)
    # precio_sin_iva = 11900 / 1.19 = 10000
    # subtotal_linea = 10000 * 2 = 20000
    # iva_linea = 20000 * 0.19 = 3800
    det1 = MockEntity(
        producto=MockEntity(nombre="Producto A", sku="PROD-A", id=101),
        cantidad=2,
        precio_unitario=11900,
        iva_porcentaje=19,
        descuento_pct=0
    )

    # Detalle 2: Con 5% IVA (precio unitario con IVA = 10500 COP)
    # precio_sin_iva = 10500 / 1.05 = 10000
    # subtotal_linea = 10000 * 1 = 10000
    # iva_linea = 10000 * 0.05 = 500
    det2 = MockEntity(
        producto=MockEntity(nombre="Producto B", sku="PROD-B", id=102),
        cantidad=1,
        precio_unitario=10500,
        iva_porcentaje=5,
        descuento_pct=0
    )

    # Detalle 3: Exento de IVA (precio unitario = 2000 COP)
    # precio_sin_iva = 2000
    # subtotal_linea = 2000 * 2 = 4000
    # iva_linea = 0
    det3 = MockEntity(
        producto=MockEntity(nombre="Producto C", sku="PROD-C", id=103),
        cantidad=2,
        precio_unitario=2000,
        iva_porcentaje=0,
        descuento_pct=0
    )

    detalles = [det1, det2, det3]

    # Act
    payload = build_invoice_payload(venta, empresa, cliente, detalles, tipo_documento="fe")

    # Assert
    assert payload["resolution_number"] == "18762000001"
    assert payload["prefix"] == "FE"
    assert payload["document_number"] == "123"
    assert payload["date"] == "2026-07-04"
    
    # Valida la estructura del cliente
    assert payload["customer"]["dni"] == "900111222" # normalizado (sin -3)
    assert payload["customer"]["company_name"] == "Cliente B2B Test"
    assert payload["customer"]["identity_document_id"] == "1" # NIT
    
    # Valida las líneas
    assert len(payload["lines"]) == 3
    
    # Línea 1
    assert payload["lines"][0]["description"] == "Producto A"
    assert float(payload["lines"][0]["price_amount"]) == 10000.0
    assert float(payload["lines"][0]["line_extension_amount"]) == 20000.0
    assert len(payload["lines"][0]["tax_totals"]) == 1
    assert payload["lines"][0]["tax_totals"][0]["tax_amount"] == 3800.0
    
    # Línea 2
    assert payload["lines"][1]["description"] == "Producto B"
    assert float(payload["lines"][1]["price_amount"]) == 10000.0
    assert float(payload["lines"][1]["line_extension_amount"]) == 10000.0
    assert len(payload["lines"][1]["tax_totals"]) == 1
    assert payload["lines"][1]["tax_totals"][0]["tax_amount"] == 500.0
    
    # Línea 3 (exento)
    assert payload["lines"][2]["description"] == "Producto C"
    assert float(payload["lines"][2]["price_amount"]) == 2000.0
    assert float(payload["lines"][2]["line_extension_amount"]) == 4000.0
    assert "tax_totals" not in payload["lines"][2]

    # Totales monetarios globales
    # base total = 20000 + 10000 + 4000 = 34000
    # iva total = 3800 + 500 = 4300
    # total pagar = 34000 + 4300 = 38300
    assert float(payload["legal_monetary_totals"]["line_extension_amount"]) == 34000.0
    assert float(payload["legal_monetary_totals"]["payable_amount"]) == 38300.0

    # Agrupación de impuestos a nivel raíz
    assert len(payload["tax_totals"]) == 2
    
    # Buscar grupos de impuestos
    group_19 = next(g for g in payload["tax_totals"] if g["percent"] == 19)
    group_5 = next(g for g in payload["tax_totals"] if g["percent"] == 5)
    
    assert group_19["tax_amount"] == 3800.0
    assert group_19["taxable_amount"] == 20000.0
    
    assert group_5["tax_amount"] == 500.0
    assert group_5["taxable_amount"] == 10000.0
