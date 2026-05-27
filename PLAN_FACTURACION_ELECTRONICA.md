# Plan de Implementación — Facturación Electrónica DIAN (Matías API)

**Documento de trabajo interno — KSmart ERP**  
**Fecha de redacción:** 2026-05-27  
**Estado:** En espera de suscripción a Matías API  
**Autor:** Claude Code (auditoría completa del sistema)

---

## 1. CONTEXTO Y ESTADO ACTUAL DEL SISTEMA

### 1.1 ¿Qué ya existe y funciona?

El sistema tiene una base sólida. No hay que construir desde cero. Lo que ya existe:

| Componente | Archivo | Estado |
|---|---|---|
| Modelo `ResolucionDian` en BD | `backend/models.py` línea 352 | ✅ Completo |
| Modelo `Venta` con campos FE | `backend/models.py` línea 399 | ✅ Completo |
| Modelo `Empresa` con config Matías | `backend/models.py` línea 80 | ✅ Completo |
| Migraciones BD (V45-V53) | `backend/database.py` | ✅ Aplicadas |
| CRUD de resoluciones | `backend/crud/facturacion_dian.py` | ✅ Completo |
| API REST de resoluciones | `backend/api/v1/endpoints/resoluciones.py` | ✅ Completo |
| Numeración de facturas | `backend/crud/facturacion_dian.py:_asignar_numero_factura` | ✅ Funciona |
| UI gestión de resoluciones | `frontend/src/features/dian/ResolucionesDian.js` | ✅ Completo |

### 1.2 Campos ya en la base de datos

**Tabla `empresas`** (ya en producción):
```sql
facturacion_electronica_activa  BOOLEAN DEFAULT FALSE
matias_api_key                  TEXT NULL
matias_test_mode                BOOLEAN DEFAULT TRUE
```

**Tabla `ventas`** (ya en producción):
```sql
numero_factura      VARCHAR(20)   -- ej: "FE-00001"
resolucion_id       INTEGER FK    -- resolución DIAN usada
cufe                TEXT          -- Código Único de Factura Electrónica
qr_data             TEXT          -- datos QR (generalmente es el CUFE)
xml_url             TEXT          -- URL del XML firmado en servidor de Matías
pdf_url             TEXT          -- URL del PDF de la factura
estado_electronico  VARCHAR       -- 'no_enviado' | 'pendiente' | 'exitoso' | 'fallido'
mensaje_proveedor   TEXT          -- respuesta cruda de Matías (para debug)
```

### 1.3 Flujo actual (incompleto)

```
POST /ventas/
    ↓
create_venta() en crud/ventas.py
    ↓
_asignar_numero_factura()
    → incrementa resolución
    → asigna numero_factura a la venta
    → si facturacion_electronica_activa == True:
        estado_electronico = "pendiente"
    ↓
db.commit()
    ↓
🚨 FIN — nadie llama a Matías. La venta queda "pendiente" eternamente.
```

### 1.4 Lo que NO existe (todo esto hay que construir)

- ❌ Llamada HTTP a la API de Matías
- ❌ Servicio de construcción del payload para Matías
- ❌ Lógica de "Consumidor Final" (para ventas sin cliente)
- ❌ Endpoint manual `POST /ventas/{id}/emitir-factura`
- ❌ Webhook para recibir respuestas asíncronas de Matías
- ❌ Worker/tarea para procesar backlog de ventas pendientes
- ❌ Reintentos automáticos en caso de fallo
- ❌ UI para ver estado FE en lista de ventas
- ❌ Botón "Reenviar factura" en el frontend
- ❌ Log de intentos de transmisión

---

## 2. MARCO LEGAL EN COLOMBIA (DIAN)

### 2.1 Obligatoriedad

Bajo la **Resolución DIAN 000042 de 2020** y sus modificaciones, TODAS las empresas obligadas a facturar electrónicamente deben emitir FE por cada transacción comercial, sin excepción.

**No existe una venta que quede exenta.** Incluso las ventas en efectivo a personas naturales que no piden factura deben transmitirse a la DIAN.

### 2.2 Ventas a consumidores que no piden factura (B2C)

Para ventas donde el cliente no se identifica o no quiere factura a su nombre, la DIAN establece el receptor estándar "Consumidor Final":

```
Tipo documento:       NIT (código 31)
NIT:                  222222222222  (doce doses)
Nombre:               Consumidor Final
Tipo organización:    Natural (código 2)
Régimen:              No responsable de IVA (código 49)
Responsabilidad:      R-99-PN
```

Esta factura se transmite a la DIAN igual que cualquier otra. El cliente final no la recibe necesariamente, pero el emisor cumple su obligación.

### 2.3 Tipos de documentos electrónicos relevantes

| Código DIAN | Nombre | Uso en KSmart |
|---|---|---|
| `01` | Factura de Venta | Ventas normales (tipo="venta") |
| `02` | Factura de Exportación | No aplica por ahora |
| `03` | Factura por Contingencia | Cuando Matías no responde |
| `91` | Nota Crédito | Devoluciones |
| `92` | Nota Débito | Ajustes de precio al alza |

**Prioridad:** Implementar primero `01` (venta normal). Nota Crédito puede venir después.

### 2.4 CUFE — Código Único de Factura Electrónica

El CUFE es el identificador único que la DIAN asigna a cada factura. Sin él, la factura no es válida. Matías API lo genera y devuelve en su respuesta.

---

## 3. LO QUE DEBES PREGUNTARLE AL USUARIO CUANDO TENGA LA SUSCRIPCIÓN

Antes de escribir una sola línea de código de integración, necesitas las respuestas a estas preguntas. Pídelas todas de una sola vez:

### Preguntas obligatorias (sin esto no se puede empezar):

1. **¿Cuál es la URL base de la API de Matías?**
   - Producción (ej: `https://api.matias.com.co/v1`)
   - Sandbox/pruebas (ej: `https://sandbox.matias.com.co/v1`)

2. **¿Cómo se autentica?**
   - ¿Header `Authorization: Bearer {api_key}`?
   - ¿Header `x-api-key: {api_key}`?
   - ¿OAuth 2.0 con client_id + client_secret?

3. **¿Qué endpoint se usa para emitir una factura?**
   - ¿`POST /invoices`? ¿`POST /facturas`? ¿`POST /documents`?

4. **¿Matías genera el XML o tú le envías el XML?**
   - **Opción A (más común):** Tú envías JSON con los datos → Matías genera el XML, lo firma, lo envía a la DIAN y te devuelve CUFE + URLs
   - **Opción B (menos común):** Tú generas y firmas el XML → Matías solo lo transmite
   - **Esto cambia completamente la implementación.**

5. **¿El proceso es síncrono o asíncrono?**
   - **Síncrono:** La respuesta del POST tiene el CUFE directamente (más simple)
   - **Asíncrono:** El POST acepta el documento y luego Matías hace POST a tu webhook con el resultado

6. **¿Cuál es el formato del payload de creación?** Pide un ejemplo completo en JSON.

7. **¿Cómo manejar errores de validación DIAN?** ¿Matías devuelve los códigos de rechazo de la DIAN?

8. **¿Hay un SDK oficial (Python)?** Algunos proveedores tienen librerías que simplifican el trabajo.

### Preguntas deseables (mejoran la implementación):

9. ¿Matías envía webhooks para cambios de estado?
10. ¿Cómo se consulta el estado de una factura ya enviada? (`GET /invoices/{id}`)
11. ¿Hay límite de rate (requests por minuto/hora)?
12. ¿Qué documento técnico de la DIAN sigue Matías? (UBL 2.1 estándar colombiano)

---

## 4. ARQUITECTURA DEL MÓDULO A CONSTRUIR

### 4.1 Archivos nuevos a crear

```
backend/
  services/
    matias_service.py          ← cliente HTTP + construcción del payload
  api/v1/endpoints/
    facturacion_electronica.py ← endpoints manuales (emitir, reintentar, estado)
  tasks/
    fe_worker.py               ← worker para procesar backlog "pendiente"
```

### 4.2 Archivos existentes a modificar

```
backend/
  api/v1/endpoints/
    ventas.py                  ← disparar FE automáticamente al crear venta
    webhooks.py                ← agregar handler POST /webhooks/matias
  api/v1/api.py                ← registrar router de facturacion_electronica
  models.py                    ← agregar tabla IntentoFE (log de intentos)

frontend/src/
  features/sales/
    Ventas.js                  ← columna "Estado FE" + botón reintentar
  features/dian/
    ResolucionesDian.js        ← ya existe, agregar sección de facturas pendientes
```

### 4.3 Tabla nueva sugerida: `intentos_fe`

Para tener trazabilidad completa de cada intento de transmisión. Agregar en `models.py`:

```python
class IntentoFE(Base, TenantMixin):
    """Log de cada intento de transmisión a Matías API."""
    __tablename__ = "intentos_fe"

    id          = Column(Integer, primary_key=True, index=True)
    venta_id    = Column(Integer, ForeignKey("ventas.id"), nullable=False)
    timestamp   = Column(DateTime(timezone=True), default=utcnow)
    resultado   = Column(String(20))   # 'exitoso' | 'fallido' | 'timeout'
    http_status = Column(Integer, nullable=True)
    request_payload  = Column(JSON, nullable=True)
    response_payload = Column(JSON, nullable=True)
    cufe_obtenido    = Column(String, nullable=True)
    error_mensaje    = Column(Text, nullable=True)

    venta = relationship("Venta")
```

Y agregar la migración correspondiente en `database.py`.

---

## 5. PLAN DE IMPLEMENTACIÓN DETALLADO (PASO A PASO)

### FASE 1 — Servicio Matías (backend/services/matias_service.py)

Este es el archivo central. Su única responsabilidad: tomar una `Venta` del ORM y transmitirla.

**Estructura del archivo:**

```python
"""
Servicio de integración con Matías API para facturación electrónica DIAN Colombia.

IMPORTANTE: Antes de usar, configurar en la empresa:
  - empresa.matias_api_key
  - empresa.facturacion_electronica_activa = True
  - empresa.matias_test_mode (True = sandbox, False = producción)
"""
import httpx
import logging
from typing import Optional
from sqlalchemy.orm import Session
import models

logger = logging.getLogger("matias_fe")

# ── ESTAS URLS SE LLENAN CUANDO TENGAS LA DOCUMENTACIÓN ──────────────────────
MATIAS_URL_PROD    = "https://PENDIENTE_URL_PRODUCCION"
MATIAS_URL_SANDBOX = "https://PENDIENTE_URL_SANDBOX"
TIMEOUT_SEGUNDOS   = 30


def _get_base_url(empresa: models.Empresa) -> str:
    return MATIAS_URL_SANDBOX if empresa.matias_test_mode else MATIAS_URL_PROD


def _get_headers(empresa: models.Empresa) -> dict:
    # PENDIENTE: Ajustar según documentación de autenticación de Matías
    # Opción A (Bearer):
    return {"Authorization": f"Bearer {empresa.matias_api_key}", "Content-Type": "application/json"}
    # Opción B (x-api-key):
    # return {"x-api-key": empresa.matias_api_key, "Content-Type": "application/json"}


def _construir_payload(venta: models.Venta, empresa: models.Empresa) -> dict:
    """
    Construye el JSON que Matías espera.
    ⚠️ PENDIENTE: Ajustar la estructura al schema exacto de Matías.
    La estructura aquí es una estimación basada en estándar UBL 2.1 colombiano.
    """

    # Receptor: cliente real o Consumidor Final
    if venta.cliente and venta.cliente.cedula and venta.cliente.tipo_documento_id == 31:
        # Cliente B2B con NIT
        receptor = {
            "tipo_documento": "31",
            "numero_documento": venta.cliente.cedula,
            "dv": venta.cliente.dv or "",
            "nombre": venta.cliente.nombre,
            "tipo_organizacion": str(venta.cliente.tipo_organizacion_id or "2"),
            "tipo_regimen": str(venta.cliente.tipo_regimen_id or "49"),
            "responsabilidad_fiscal": venta.cliente.responsabilidad_fiscal_codes or "R-99-PN",
            "email": venta.cliente.email or None,
            "telefono": venta.cliente.telefono or None,
            "direccion": venta.cliente.direccion or None,
        }
    else:
        # Consumidor Final (B2C o cliente sin NIT) — estándar DIAN
        receptor = {
            "tipo_documento": "31",
            "numero_documento": "222222222222",
            "dv": "0",
            "nombre": "Consumidor Final",
            "tipo_organizacion": "2",
            "tipo_regimen": "49",
            "responsabilidad_fiscal": "R-99-PN",
            "email": None,
            "telefono": None,
            "direccion": None,
        }

    # Líneas de detalle
    items = []
    for det in venta.detalles:
        prod = det.producto
        items.append({
            # PENDIENTE: Ajustar nombres de campo a lo que Matías espera
            "descripcion": prod.nombre if prod else f"Producto {det.producto_id}",
            "cantidad": det.cantidad,
            "precio_unitario": det.precio_unitario,
            "descuento_pct": det.descuento_pct or 0.0,
            "iva_porcentaje": det.iva_porcentaje or 0.0,
            "unidad_medida": prod.unidad_medida if prod else "UND",
            "codigo_producto": prod.sku if prod else None,
        })

    return {
        # PENDIENTE: Ajustar nombre de campos al schema de Matías
        "numero_factura": venta.numero_factura,
        "prefijo": venta.resolucion.prefijo if venta.resolucion else "",
        "numero_resolucion": venta.resolucion.numero_resolucion if venta.resolucion else "",
        "clave_tecnica": venta.resolucion.clave_tecnica if venta.resolucion else "",
        "fecha_emision": venta.fecha.isoformat(),
        "fecha_vencimiento": venta.fecha.isoformat(),   # mismo día para ventas contado
        "moneda": "COP",
        "observaciones": venta.observaciones or "",

        "emisor": {
            # PENDIENTE: Cargar desde tabla Empresa o config DIAN
            "nit": empresa.nit if hasattr(empresa, "nit") else "PENDIENTE",
            "nombre": empresa.nombre,
            # ... otros campos del emisor según Matías
        },

        "receptor": receptor,
        "items": items,

        "totales": {
            "subtotal": venta.total - venta.iva_total,
            "iva": venta.iva_total,
            "total": venta.total,
        },
    }


def emitir_factura(
    db: Session,
    venta: models.Venta,
    empresa: models.Empresa,
) -> dict:
    """
    Envía la factura a Matías API y actualiza el estado en la BD.

    Returns:
        dict con keys: exito (bool), cufe (str|None), mensaje (str)

    Actualiza en venta:
        - estado_electronico: 'exitoso' o 'fallido'
        - cufe, qr_data, xml_url, pdf_url (si exitoso)
        - mensaje_proveedor: respuesta cruda de Matías
    """
    if not empresa.matias_api_key:
        return {"exito": False, "cufe": None, "mensaje": "No hay API key de Matías configurada."}

    payload = _construir_payload(venta, empresa)
    url = f"{_get_base_url(empresa)}/PENDIENTE_ENDPOINT_EMISION"
    headers = _get_headers(empresa)

    try:
        with httpx.Client(timeout=TIMEOUT_SEGUNDOS) as client:
            resp = client.post(url, json=payload, headers=headers)

        venta.mensaje_proveedor = resp.text[:2000]  # guardar siempre para debug

        if resp.status_code in (200, 201):
            data = resp.json()

            # PENDIENTE: Ajustar rutas de campos según respuesta real de Matías
            # ej: data["cufe"], data["qr"], data["links"]["xml"], data["links"]["pdf"]
            venta.cufe              = data.get("cufe") or data.get("CUFE")
            venta.qr_data           = data.get("qr") or data.get("qrData") or venta.cufe
            venta.xml_url           = data.get("xml_url") or data.get("xmlUrl")
            venta.pdf_url           = data.get("pdf_url") or data.get("pdfUrl")
            venta.estado_electronico = "exitoso"
            db.add(venta)
            db.commit()

            logger.info(f"✅ FE emitida: venta #{venta.id} → CUFE {venta.cufe}")
            return {"exito": True, "cufe": venta.cufe, "mensaje": "Factura electrónica emitida correctamente."}

        else:
            venta.estado_electronico = "fallido"
            db.add(venta)
            db.commit()

            logger.error(f"❌ FE fallida: venta #{venta.id} → HTTP {resp.status_code}: {resp.text[:500]}")
            return {"exito": False, "cufe": None, "mensaje": f"Error {resp.status_code}: {resp.text[:300]}"}

    except httpx.TimeoutException:
        venta.estado_electronico = "fallido"
        venta.mensaje_proveedor = "Timeout: Matías no respondió en tiempo."
        db.add(venta)
        db.commit()
        logger.error(f"⏱ FE timeout: venta #{venta.id}")
        return {"exito": False, "cufe": None, "mensaje": "Timeout al conectar con Matías API."}

    except Exception as e:
        venta.estado_electronico = "fallido"
        venta.mensaje_proveedor = str(e)[:500]
        db.add(venta)
        db.commit()
        logger.error(f"💥 FE excepción: venta #{venta.id}: {e}")
        return {"exito": False, "cufe": None, "mensaje": f"Error inesperado: {str(e)}"}
```

---

### FASE 2 — Endpoint de emisión manual y consulta

**Nuevo archivo: `backend/api/v1/endpoints/facturacion_electronica.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models, schemas
from api.deps import get_db, get_current_active_user
from services.matias_service import emitir_factura

router = APIRouter()


@router.post("/ventas/{venta_id}/emitir")
def emitir_factura_electronica(
    venta_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """
    Emite o reintenta la factura electrónica de una venta.
    Se puede llamar manualmente desde el frontend o desde el worker automático.
    """
    empresa = db.query(models.Empresa).filter(models.Empresa.id == current_user.empresa_id).first()
    if not empresa or not empresa.facturacion_electronica_activa:
        raise HTTPException(400, "Facturación electrónica no activada para esta empresa.")

    venta = db.query(models.Venta).filter(
        models.Venta.id == venta_id,
        models.Venta.empresa_id == current_user.empresa_id,
        models.Venta.tipo == "venta",
    ).first()
    if not venta:
        raise HTTPException(404, "Venta no encontrada.")

    if not venta.numero_factura:
        raise HTTPException(400, "Esta venta no tiene número de factura asignado.")

    if venta.estado_electronico == "exitoso":
        raise HTTPException(400, "Esta factura ya fue emitida exitosamente.")

    resultado = emitir_factura(db, venta, empresa)
    if not resultado["exito"]:
        raise HTTPException(500, resultado["mensaje"])

    return {
        "mensaje": resultado["mensaje"],
        "cufe": resultado["cufe"],
        "pdf_url": venta.pdf_url,
        "xml_url": venta.xml_url,
        "estado": venta.estado_electronico,
    }


@router.get("/ventas/{venta_id}/fe-estado")
def estado_factura_electronica(
    venta_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Consulta el estado de FE de una venta sin hacer nada."""
    venta = db.query(models.Venta).filter(
        models.Venta.id == venta_id,
        models.Venta.empresa_id == current_user.empresa_id,
    ).first()
    if not venta:
        raise HTTPException(404, "Venta no encontrada.")

    return {
        "estado_electronico": venta.estado_electronico,
        "cufe": venta.cufe,
        "qr_data": venta.qr_data,
        "xml_url": venta.xml_url,
        "pdf_url": venta.pdf_url,
        "numero_factura": venta.numero_factura,
        "mensaje_proveedor": venta.mensaje_proveedor,
    }


@router.get("/fe-pendientes")
def listar_fe_pendientes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Lista todas las ventas con estado FE pendiente o fallido (para reintento masivo)."""
    ventas = db.query(models.Venta).filter(
        models.Venta.empresa_id == current_user.empresa_id,
        models.Venta.tipo == "venta",
        models.Venta.estado_electronico.in_(["pendiente", "fallido"]),
    ).order_by(models.Venta.fecha.desc()).limit(100).all()

    return [
        {
            "id": v.id,
            "numero_factura": v.numero_factura,
            "fecha": v.fecha,
            "total": v.total,
            "estado_electronico": v.estado_electronico,
            "mensaje_proveedor": v.mensaje_proveedor,
            "cliente": v.cliente.nombre if v.cliente else "Consumidor Final",
        }
        for v in ventas
    ]
```

---

### FASE 3 — Disparo automático al crear venta

En `backend/api/v1/endpoints/ventas.py`, al final del endpoint `POST /`, después de retornar la venta, agregar:

```python
# Al final de create_venta endpoint, DESPUÉS de db_venta = crud.create_venta(...)
# Si la empresa tiene FE activa, intentar emitir inmediatamente
# (Si falla, queda "fallido" y el worker o el admin pueden reintentar)
if current_user.empresa and current_user.empresa.facturacion_electronica_activa:
    from services.matias_service import emitir_factura
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if empresa and db_venta.numero_factura:
        try:
            emitir_factura(db, db_venta, empresa)
        except Exception as e:
            # No fallar la venta si FE falla — la venta se guarda igual
            # El estado queda "fallido" y el admin puede reintentar
            logger.error(f"FE no emitida para venta #{db_venta.id}: {e}")
```

**NOTA IMPORTANTE:** Si la API de Matías es asíncrona (devuelve solo un ID y luego hace webhook), este bloque cambia: solo se envía el request y se espera el webhook. La venta queda "pendiente" hasta que Matías confirme.

---

### FASE 4 — Webhook de Matías (si usa callback asíncrono)

En `backend/api/v1/endpoints/webhooks.py`, agregar:

```python
@router.post("/matias")
async def webhook_matias(request: Request, db: Session = Depends(get_db)):
    """
    Recibe notificaciones asíncronas de Matías API sobre el resultado
    de facturas enviadas.

    PENDIENTE: Implementar verificación de firma de Matías
    (similar a la verificación de Wompi ya implementada).
    """
    try:
        payload = await request.json()
    except Exception:
        return {"status": "error", "message": "Invalid JSON"}

    # PENDIENTE: verificar firma del webhook
    # signature = request.headers.get("x-matias-signature")
    # if not _verify_matias_signature(payload, signature):
    #     raise HTTPException(401, "Firma inválida")

    # PENDIENTE: Ajustar según la estructura real del webhook de Matías
    numero_factura = payload.get("numero_factura") or payload.get("reference")
    estado = payload.get("estado") or payload.get("status")
    cufe = payload.get("cufe") or payload.get("CUFE")

    if not numero_factura:
        return {"status": "ok", "message": "Sin numero_factura, ignorado"}

    venta = db.query(models.Venta).filter(
        models.Venta.numero_factura == numero_factura,
    ).first()

    if not venta:
        logger.warning(f"Webhook Matías: venta con numero_factura={numero_factura} no encontrada")
        return {"status": "ok"}

    if estado in ("aprobada", "exitosa", "APPROVED", "ACCEPTED"):
        venta.estado_electronico = "exitoso"
        venta.cufe = cufe
        venta.qr_data = payload.get("qr") or cufe
        venta.xml_url = payload.get("xml_url")
        venta.pdf_url = payload.get("pdf_url")
    else:
        venta.estado_electronico = "fallido"
        venta.mensaje_proveedor = str(payload)[:1000]

    db.add(venta)
    db.commit()
    logger.info(f"Webhook Matías procesado: factura {numero_factura} → {venta.estado_electronico}")
    return {"status": "ok"}
```

---

### FASE 5 — Worker de backlog (tareas programadas)

**Nuevo archivo: `backend/tasks/fe_worker.py`**

```python
"""
Worker para procesar el backlog de facturas electrónicas pendientes/fallidas.

Opciones de integración:
  A) APScheduler (más simple, ya puede estar en el proyecto)
  B) Celery + Redis (más robusto para alto volumen)
  C) Endpoint cron: POST /cron/procesar-fe (llamado por servidor cada X minutos)

Para KSmart (volumen medio), la opción C (endpoint cron) es suficiente.
"""
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import models
from services.matias_service import emitir_factura
import logging

logger = logging.getLogger("fe_worker")

MAX_INTENTOS = 3       # No reintentar indefinidamente
DELAY_REINTENTO_MIN = 5  # Esperar 5 min entre intentos


def procesar_backlog_fe(db: Session, empresa_id: int, limite: int = 50) -> dict:
    """
    Procesa hasta `limite` ventas con estado 'pendiente' o 'fallido'.
    Llamar desde un endpoint cron protegido.

    Returns: resumen { procesadas, exitosas, fallidas }
    """
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if not empresa or not empresa.facturacion_electronica_activa or not empresa.matias_api_key:
        return {"procesadas": 0, "exitosas": 0, "fallidas": 0, "mensaje": "FE no configurada"}

    # Solo tomar las que no han sido reintentadas muy recientemente
    corte_tiempo = datetime.now(timezone.utc) - timedelta(minutes=DELAY_REINTENTO_MIN)

    ventas = db.query(models.Venta).filter(
        models.Venta.empresa_id == empresa_id,
        models.Venta.tipo == "venta",
        models.Venta.estado_electronico.in_(["pendiente", "fallido"]),
        models.Venta.numero_factura.isnot(None),
        # No reprocesar ventas muy recientes (pueden estar en vuelo)
        models.Venta.fecha <= corte_tiempo,
    ).limit(limite).all()

    exitosas = 0
    fallidas = 0

    for venta in ventas:
        resultado = emitir_factura(db, venta, empresa)
        if resultado["exito"]:
            exitosas += 1
        else:
            fallidas += 1
            logger.warning(f"Backlog FE: fallo en venta #{venta.id}: {resultado['mensaje']}")

    return {
        "procesadas": len(ventas),
        "exitosas": exitosas,
        "fallidas": fallidas,
    }
```

---

### FASE 6 — Endpoint cron para el worker

En `backend/main.py` o en un router de admin, agregar:

```python
@router.post("/cron/procesar-fe")
def cron_procesar_fe(
    api_key: str = Header(None, alias="x-cron-key"),
    db: Session = Depends(get_db),
):
    """
    Endpoint llamado periódicamente (ej: cada 5 min desde cron job o heroku scheduler)
    para procesar el backlog de facturas electrónicas pendientes.

    Protegido con CRON_API_KEY (ya existe en core/config.py).
    """
    from core.config import CRON_API_KEY
    from tasks.fe_worker import procesar_backlog_fe

    if api_key != CRON_API_KEY:
        raise HTTPException(401, "No autorizado")

    # Procesar todas las empresas con FE activa
    empresas = db.query(models.Empresa).filter(
        models.Empresa.facturacion_electronica_activa == True,
        models.Empresa.matias_api_key.isnot(None),
    ).all()

    total = {"procesadas": 0, "exitosas": 0, "fallidas": 0}
    for empresa in empresas:
        res = procesar_backlog_fe(db, empresa.id)
        for k in total:
            total[k] += res.get(k, 0)

    return total
```

---

### FASE 7 — Registrar los routers nuevos

En `backend/api/v1/api.py`, agregar:

```python
from api.v1.endpoints import facturacion_electronica

# Dentro de api_router.include_router(...)
api_router.include_router(
    facturacion_electronica.router,
    prefix="/fe",
    tags=["Facturación Electrónica"],
)
```

Y en `webhooks.py`, el endpoint `/webhooks/matias` ya se registra automáticamente si está en el mismo router.

---

### FASE 8 — Frontend (ajustes en Ventas.js)

Agregar en la tabla de ventas una columna de estado FE y botón de reenvío:

```jsx
// En la columna de acciones de cada venta:
{empresa?.facturacion_electronica_activa && (
  <Tooltip title={
    venta.estado_electronico === 'exitoso' ? `CUFE: ${venta.cufe?.slice(0,12)}...` :
    venta.estado_electronico === 'pendiente' ? 'Pendiente de envío' :
    venta.estado_electronico === 'fallido' ? 'Error — clic para reintentar' :
    'Sin facturar'
  }>
    <Chip
      size="small"
      icon={
        venta.estado_electronico === 'exitoso' ? <CheckCircle /> :
        venta.estado_electronico === 'fallido' ? <ErrorOutline /> :
        <Schedule />
      }
      label={
        venta.estado_electronico === 'exitoso' ? 'FE OK' :
        venta.estado_electronico === 'fallido' ? 'FE Error' :
        venta.estado_electronico === 'pendiente' ? 'FE Pendiente' :
        'Sin FE'
      }
      color={
        venta.estado_electronico === 'exitoso' ? 'success' :
        venta.estado_electronico === 'fallido' ? 'error' : 'warning'
      }
      onClick={
        venta.estado_electronico !== 'exitoso'
          ? () => handleReenviarFE(venta.id)
          : undefined
      }
      clickable={venta.estado_electronico !== 'exitoso'}
    />
  </Tooltip>
)}

// Función:
const handleReenviarFE = async (ventaId) => {
  try {
    const res = await apiClient.post(`/fe/ventas/${ventaId}/emitir`);
    toast.success(`✅ Factura electrónica emitida. CUFE: ${res.data.cufe?.slice(0,16)}...`);
    fetchVentas(); // refrescar lista
  } catch (err) {
    toast.error(err?.response?.data?.detail || 'Error al emitir factura electrónica');
  }
};
```

---

## 6. CAMPOS QUE FALTARÍAN EN LA EMPRESA PARA FE

Al activar la facturación electrónica, la empresa necesita estos datos del emisor. Algunos ya existen en el modelo, otros pueden faltar. **Verificar y agregar si faltan:**

```python
# En models.py clase Empresa — verificar que existan:
nit                    = Column(String, nullable=True)   # NIT sin DV
dv                     = Column(String(1), nullable=True) # Dígito verificador
nombre_comercial       = Column(String, nullable=True)
tipo_documento_empresa = Column(String, default="31")     # 31 = NIT
tipo_organizacion      = Column(String, default="1")      # 1 = Jurídica
tipo_regimen           = Column(String, default="48")     # 48 = Responsable IVA
responsabilidad_fiscal = Column(String, default="O-13")   # Gran contribuyente etc
municipio_code         = Column(String, nullable=True)    # Código DIAN del municipio
departamento_code      = Column(String, nullable=True)
direccion_fiscal       = Column(String, nullable=True)
telefono_empresa       = Column(String, nullable=True)
email_empresa          = Column(String, nullable=True)
```

Si alguno de estos no existe en el modelo actual, hay que agregar la migración en `database.py` siguiendo el patrón de las migraciones V45-V53 ya existentes.

---

## 7. FLUJO COMPLETO OBJETIVO (post-implementación)

```
POST /ventas/
    ↓
create_venta() → _asignar_numero_factura()
    ↓ numero_factura asignado, estado_electronico = "pendiente"
    ↓
emitir_factura(venta, empresa)  [inmediato, en el mismo request]
    ↓
POST {MATIAS_URL}/invoices  con payload construido
    ↓
    ├── HTTP 200/201 (síncrono):
    │       estado_electronico = "exitoso"
    │       cufe, qr_data, xml_url, pdf_url ← guardados
    │       → Response al frontend con CUFE incluido
    │
    ├── Error de red / timeout:
    │       estado_electronico = "fallido"
    │       → Response al frontend (venta guardada, FE fallida)
    │       → Worker reintenta en próximo ciclo de cron
    │
    └── Si Matías es asíncrono:
            estado_electronico = "pendiente"
            → Response al frontend (venta guardada, FE en proceso)
            → Matías hace POST /webhooks/matias cuando DIAN confirma
            → Webhook actualiza cufe, estado_electronico = "exitoso"
```

---

## 8. CHECKLIST FINAL ANTES DE ACTIVAR EN PRODUCCIÓN

- [ ] Empresa tiene `matias_api_key` configurada
- [ ] Empresa tiene `facturacion_electronica_activa = True`
- [ ] Empresa tiene `matias_test_mode = True` para pruebas (cambiar a False en producción)
- [ ] Resolución DIAN cargada y activa en el sistema
- [ ] `clave_tecnica` de la resolución cargada (Matías la puede necesitar)
- [ ] Todos los campos del emisor completos (NIT, DV, dirección, etc.)
- [ ] URLs de las MATIAS_URL_PROD / MATIAS_URL_SANDBOX actualizadas en `matias_service.py`
- [ ] Estructura del payload ajustada al schema real de Matías (sección `_construir_payload`)
- [ ] Rutas de los campos en la respuesta de Matías mapeadas (cufe, pdf_url, xml_url)
- [ ] Verificación de firma del webhook de Matías implementada
- [ ] Variable de entorno `WOMPI_EVENTS_SECRET` → análogo para Matías si usa firma
- [ ] Cron job configurado para llamar `POST /cron/procesar-fe` cada 5-10 minutos
- [ ] Prueba end-to-end en sandbox: crear venta → ver CUFE en respuesta → verificar en DIAN
- [ ] Al menos 10 facturas de prueba enviadas y validadas en portal DIAN (habilitación)

---

## 9. NOTAS PARA RETOMAR ESTA TAREA

Cuando tengas la suscripción de Matías y la documentación, comparte con Claude:

1. La URL base (sandbox y producción)
2. El método de autenticación exacto
3. Un ejemplo de payload de creación (JSON completo)
4. Un ejemplo de respuesta exitosa (para mapear los campos cufe, pdf_url, etc.)
5. Si es síncrono o asíncrono (webhook)
6. Si tienen SDK Python

Con esos 6 datos, Claude puede completar la implementación en una sola sesión, llenando los `PENDIENTE` marcados en el código de este documento.

Los archivos a modificar están listados, el código esqueleto está listo, la base de datos ya tiene todos los campos. El trabajo restante es principalmente **adaptar el payload y el parsing de la respuesta** al formato exacto de Matías.

---

*Documento generado por Claude Code — auditoría KSmart ERP 2026-05-27*
