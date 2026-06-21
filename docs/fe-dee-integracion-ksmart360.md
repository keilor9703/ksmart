# Facturación Electrónica en ksmart360
## Documento informativo para socios — Junio 2026

---

## Introducción

Este documento explica de forma completa y accesible todo lo que necesitas saber sobre la **Facturación Electrónica (FE)** y el **Documento Equivalente Electrónico (DEE)** en Colombia, cómo ksmart360 los integra en su plataforma, qué implica esto para la empresa y para nuestros clientes, y cómo debe estructurarse la oferta comercial.

No se asume conocimiento previo sobre facturación electrónica.

---

## PARTE 1: El contexto legal en Colombia

### ¿Qué es la Facturación Electrónica?

La Factura Electrónica (FE) es el único documento fiscal válido en Colombia para respaldar una venta de bienes o servicios. Reemplazó definitivamente a la factura en papel. La genera el vendedor, la valida la DIAN en tiempo real y la recibe el comprador.

No es opcional. La DIAN ha establecido por ley que **toda empresa o persona natural que venda bienes o preste servicios está obligada a emitir FE**, con un calendario de implementación que ya cubrió a la gran mayoría del sector comercial colombiano.

### ¿Qué pasa si una empresa no factura electrónicamente?

Las sanciones son severas:

- **Multa del 5% sobre las operaciones no facturadas**, con tope de 950 UVT (~$49,755,000 COP en 2026)
- **Cierre del establecimiento entre 3 y 10 días** en caso de reincidencia
- Imposibilidad de que los compradores descuenten el IVA de esas compras

### ¿Qué es el Documento Equivalente Electrónico (DEE)?

Aquí está el punto que la mayoría de la gente desconoce, y que cambia completamente la dinámica de nuestro negocio.

Existen **dos tipos de documentos electrónicos** según la normativa colombiana (Resolución DIAN 000165 del 1 de noviembre de 2023):

| Documento | Cuándo se emite | A nombre de quién |
|---|---|---|
| **Factura Electrónica (FE)** | Cuando el comprador es una empresa o persona que necesita soportar el gasto (pide factura con NIT/CC) | Cliente identificado |
| **Documento Equivalente Electrónico / Tiquete POS (DEE)** | Cuando el comprador es un consumidor final que NO pide factura | "Consumidor Final" |

**Lo que muy pocas personas saben:** el DEE no es opcional. No se puede simplemente "no emitir nada" cuando el cliente no pide factura. La ley exige que por **cada transacción** se emita uno de los dos documentos. El DEE reemplazó al tiquete POS en papel, que ya no es válido fiscalmente desde julio de 2024.

### La regla de los 5 UVT

Existe un caso especial: cuando una venta es igual o superior a **5 UVT** (aproximadamente $261,030 COP en 2026), la empresa debe emitir una **Factura Electrónica obligatoriamente**, aunque el cliente no la pida. El DEE no es válido para montos tan altos.

### Resumen del marco legal

```
Cada venta → UN documento electrónico obligatorio → enviado a la DIAN en tiempo real

    Cliente pide factura
    o venta ≥ $261,030    →   FACTURA ELECTRÓNICA (FE)   →  con CUFE
    
    Cliente no pide factura
    y venta < $261,030    →   TIQUETE POS ELECTRÓNICO     →  con CUDE
                               (DEE / Documento Equivalente)
```

No existe la posibilidad legal de acumular varias ventas en un solo documento al final del día. Cada venta, en el momento de la venta, genera su propio documento.

---

## PARTE 2: Cómo lo integra ksmart360

### La visión del producto

ksmart360 resuelve esto de forma transparente para el operador. El cajero no necesita saber qué es un CUFE ni un CUDE. El sistema decide automáticamente qué documento emitir y lo envía a la DIAN sin intervención humana.

### El flujo en pantalla (lo que ve el cajero)

```
1. El cajero registra los productos de la venta

2. Al momento de cobrar, aparece un switch simple:
   
   [ ] ¿El cliente requiere factura electrónica?

3a. Si el cliente dice SÍ → el cajero activa el switch
    → el sistema pide NIT o cédula del cliente
    → emite Factura Electrónica con datos del cliente
    → envía PDF al correo del cliente

3b. Si el cliente dice NO → el switch queda desactivado
    → el sistema emite automáticamente el Tiquete POS Electrónico
    → a nombre de "Consumidor Final"
    → sin intervención adicional del cajero

3c. Si la venta supera $261,030 → el sistema fuerza FE
    independientemente de lo que diga el cliente
```

El cajero solo hace una pregunta. El resto lo maneja ksmart360.

### Los módulos que ya tienen esto integrado

El sistema ya tiene la funcionalidad de FE/DEE en **todos los módulos de venta**:

- **POS de ventas generales** (tiendas, comercios)
- **Restaurante** (cobro de comandas por mesa)
- **Parqueadero** (salida por horas y suscripciones)
- **Lavadero** (cobro de servicios de lavado)

En todos ellos el flujo es idéntico: el operador ve el mismo switch y el sistema emite el documento correspondiente.

### Qué proveedor tecnológico usa ksmart360

ksmart360 se integra con **Matias API** (empresa colombiana, Lopezsoft SAS) para la emisión de documentos electrónicos ante la DIAN. Matias actúa como el intermediario tecnológico que:

1. Recibe el documento generado por ksmart360
2. Lo firma digitalmente con el certificado del cliente
3. Lo envía a la DIAN
4. Devuelve la respuesta de validación (CUFE/CUDE) en segundos
5. Genera el PDF descargable y el QR

Matias cobra por **documento emitido**, no por mes fijo. Este modelo de cobro es el que determina nuestra estructura de planes.

### Las dos resoluciones DIAN que necesita cada cliente

Antes de activar la FE, cada cliente de ksmart360 debe tramitar ante la DIAN **dos resoluciones de numeración**, una por tipo de documento:

| Resolución | Tipo | Ejemplo de prefijo | Uso |
|---|---|---|---|
| Resolución FE | `fe` | `FE`, `FAC` | Para Facturas Electrónicas |
| Resolución POS | `pos` | `FPOS`, `TPOS` | Para Tiquetes POS Electrónicos |

Estas resoluciones son gratuitas y se obtienen en el portal MUISCA de la DIAN. El cliente solo las tramita una vez (tienen vigencia de 2 a 5 años). En ksmart360, el cliente registra ambas en el módulo **Configuración → Resoluciones DIAN**, y el sistema las usa automáticamente según el tipo de venta.

---

## PARTE 3: Obligaciones y requisitos por parte del cliente

### Lo que la empresa cliente debe tener ANTES de activar FE en ksmart360

| Requisito | Descripción | Costo para el cliente | Dónde se tramita |
|---|---|---|---|
| RUT activo | Registro Único Tributario con actividad económica habilitada | Gratuito | Portal DIAN |
| Habilitación como facturador electrónico | Registro en la DIAN como emisor de FE | Gratuito | Portal MUISCA |
| Resolución FE | Rango de numeración autorizado para Facturas Electrónicas | Gratuito | Portal MUISCA |
| Resolución POS | Rango de numeración autorizado para Tiquetes POS Electrónicos | Gratuito | Gratuito, misma vía |
| Certificado de firma digital | Archivo .p12 o .pfx que firma los documentos digitalmente | **~$104,000 COP/año** | Certicámara, GSE o Andes SCD |
| Token de Matias API | Credencial para conectarse al sistema de emisión | **Incluido en el plan ksmart360** | Lo gestiona ksmart360 |

**Costo total externo que asume el cliente para activar FE: ~$104,000 COP al año** (solo el certificado digital).

Todo lo demás lo gestiona ksmart360 de forma guiada con un asistente de activación en 8 pasos integrado en la plataforma.

### Obligaciones operativas del cliente una vez activado

- Mantener el certificado digital vigente (renovar anualmente)
- Mantener las resoluciones DIAN dentro del rango disponible (ksmart360 alerta automáticamente cuando el rango se acerca al límite)
- Pagar el plan ksmart360 que incluya el volumen de documentos que su negocio genera

---

## PARTE 4: La estructura de costos de Matias API y su impacto en ksmart360

### Cómo cobra Matias

Matias vende **paquetes de documentos anuales** para casas de software (empresas como ksmart360 que integran múltiples clientes). El paquete es compartido entre todos los clientes activos de ksmart360 que tengan FE habilitada.

| Paquete | Docs/año | Docs/mes equiv. | Costo/año | Costo/mes equiv. | Costo/doc |
|---|---|---|---|---|---|
| 5,000 | 5,000 | 417 | $220,000 | $18,333 | $44 |
| 10,000 | 10,000 | 833 | $400,000 | $33,333 | $40 |
| **30,000** | **30,000** | **2,500** | **$630,000** | **$52,500** | **$21** |
| 50,000 | 50,000 | 4,167 | $850,000 | $70,833 | $17 |

**El paquete de 30,000 es el de mejor relación costo/beneficio** y es el punto de partida recomendado para cuando tengamos los primeros clientes con FE activa.

### La realidad del consumo: cada venta = 1 documento

Este es el punto más importante para entender la economía del modelo:

> **Cada venta pagada genera exactamente 1 documento electrónico (FE o DEE-POS) y consume 1 documento del paquete Matias.**

No importa si es una Factura Electrónica o un Tiquete POS. El costo para ksmart360 es el mismo. Esto significa que el consumo del paquete depende del **volumen total de ventas** de todos los clientes con FE activa, no de cuántos piden factura.

### Cuántos documentos consume un negocio típico

| Tipo de negocio | Ventas estimadas/día | Documentos/mes |
|---|---|---|
| Tienda pequeña / papelería | 20–30 | 600–900 |
| Cafetería / panadería | 40–60 | 1,200–1,800 |
| Restaurante mediano | 80–120 | 2,400–3,600 |
| Parqueadero activo | 100–200 | 3,000–6,000 |
| Tienda grande / droguería | 200–400 | 6,000–12,000 |

### Cuántos clientes soporta cada paquete Matias

| Paquete | Docs/mes totales | Escenario representativo |
|---|---|---|
| 5,000/año | 417/mes | 1 tienda muy pequeña. Solo válido para pruebas |
| 10,000/año | 833/mes | 1 cafetería pequeña (28 ventas/día) |
| 30,000/año | 2,500/mes | 2–3 tiendas pequeñas, o 1 restaurante mediano |
| 50,000/año | 4,167/mes | 4–5 tiendas pequeñas, o 1 parqueadero activo |

---

## PARTE 5: Cómo debe vender ksmart360 los planes

### El problema del mercado

Los competidores (Alegra, Siigo, Loggro) ofrecen **"FE ilimitada"** porque tienen integración directa propia con la DIAN y no pagan por documento. ksmart360 paga a Matias $21 por cada documento emitido. **No podemos prometer ilimitado.**

Pero hay una ventaja clara frente a ellos: ksmart360 es un sistema **especializado por sector** (restaurante, parqueadero, lavadero) con funcionalidades que esos software genéricos no tienen. La FE es una funcionalidad más dentro de un sistema integral, no el producto principal.

### Los dos planes base

**Plan Starter — $29,900/mes**
- POS completo: ventas, inventario, clientes, reportes financieros
- Acceso a todos los módulos según el sector (restaurante, parqueadero, lavadero)
- **Sin facturación electrónica**
- Para negocios que aún no están en el radar de la DIAN, que facturan por fuera, o que prefieren no activarla aún

**Plan Pro — desde $59,900/mes (con FE incluida)**
- Todo lo del plan Starter
- Facturación electrónica activa (FE + DEE/Tiquete POS por cada venta)
- Asistente de activación guiado
- Alertas de resolución próxima a vencerse o agotarse
- Auditoría completa de documentos emitidos (CUFE, CUDE, PDF, XML)

### Las bandas de volumen del Plan Pro

Como cada venta consume 1 documento, el plan Pro se vende por bandas:

| Banda | Documentos/mes incluidos | Precio/mes | Ideal para |
|---|---|---|---|
| **Pro 1,000** | 1,000 docs | **$59,900** | Tienda con hasta 33 ventas/día |
| **Pro 3,000** | 3,000 docs | **$89,900** | Restaurante/negocio con hasta 100 ventas/día |
| **Pro 6,000** | 6,000 docs | **$129,900** | Parqueadero/tienda grande con hasta 200 ventas/día |
| **Pro Enterprise** | A la medida | Cotizar | Grandes volúmenes |

**Excedente:** $50 COP por documento adicional cuando el cliente supera su banda. El sistema notifica automáticamente al cliente cuando se acerca al límite mensual.

### Pregunta clave al vender el plan Pro

Antes de activar FE a un cliente, se le debe preguntar:

> *"¿Cuántas ventas o transacciones hace su negocio en un día normal?"*

Con ese número se define la banda correcta. Es mejor asignar la banda superior que quedarse corto y generar incumplimiento DIAN.

### Posicionamiento frente a la competencia

| Software | Plan | Precio/mes | FE |
|---|---|---|---|
| Alegra POS | Emprendedor | $25,900 | "Ilimitada" (solo FE, sin DEE diferenciado) |
| Loggro Restobar | Básico | $108,990 | "Ilimitada" |
| Siigo | Profesional | ~$145,993 | "Ilimitada" |
| **ksmart360 Pro 1,000** | | **$59,900** | FE + DEE por cada venta |
| **ksmart360 Pro 3,000** | | **$89,900** | FE + DEE por cada venta |

ksmart360 es más económico que Loggro y Siigo. Frente a Alegra, el diferenciador no es el precio sino las funcionalidades sectoriales (mapas de mesas, control de parqueadero, módulo de lavadero).

---

## PARTE 6: La economía del modelo para ksmart360

### Margen por cliente según banda

Con Paquete Matias 30,000 ($52,500/mes):

| Cliente | Docs/mes | Costo Matias ($21/doc) | Precio plan | Margen bruto |
|---|---|---|---|---|
| Pro 1,000 | 1,000 | $21,000 | $59,900 | **$38,900** |
| Pro 3,000 | 3,000 | $63,000 | $89,900 | **$26,900** |
| Pro 6,000 | 6,000 | $126,000 | $129,900 | **$3,900** ⚠️ |

El cliente Pro 6,000 ya casi no deja margen con Paquete 30,000. Para ese perfil hay que usar Paquete 50,000 ($17/doc), lo que sube el margen a $29,900.

### Cuándo escalar el paquete Matias

| Escenario | Docs/mes totales | Paquete recomendado | Costo Matias/mes |
|---|---|---|---|
| Primeros 1–2 clientes pequeños | ≤ 833 | 10,000/año | $33,333 |
| 3–5 clientes | ≤ 2,500 | 30,000/año | $52,500 |
| 6–10 clientes | ≤ 4,167 | 50,000/año | $70,833 |
| Más de 10 clientes activos | > 4,167 | 100,000+ | Cotizar |

### Break-even del paquete 30,000

El paquete cuesta $52,500/mes. Con el Plan Pro 1,000:
- Ingreso por cliente: $59,900/mes
- Costo Matias por cliente (1,000 docs × $21): $21,000/mes
- **Margen neto por cliente: $38,900/mes**
- Con **2 clientes Pro 1,000** ya se cubre el costo del paquete Matias y empieza la ganancia

---

## PARTE 7: Lo que NO hace ksmart360 (límites del modelo)

Es importante ser transparentes con los clientes sobre lo que no está incluido o no es posible:

| Lo que NO hace ksmart360 | Razón |
|---|---|
| No tramita la resolución DIAN del cliente | Es un trámite personal del contribuyente en MUISCA |
| No emite el certificado digital | Lo expide una entidad certificadora autorizada (Certicámara, etc.) |
| No consolida varias ventas en una sola FE al final del día | Es ilegal según la Resolución DIAN 000165/2023. Cada venta requiere su propio documento |
| No ofrece FE "ilimitada" | ksmart360 paga por documento a Matias; el volumen está acotado por las bandas del plan |
| No emite FE si el cliente no tiene resolución DIAN activa | Sin resolución no hay numeración autorizada; el sistema registra la venta pero no puede emitir el documento |

---

## PARTE 8: El camino de activación para un cliente nuevo

Cuando un cliente de ksmart360 quiere activar la facturación electrónica, el proceso es el siguiente:

```
PASO 1 — El cliente contrata el Plan Pro en ksmart360

PASO 2 — ksmart360 activa el módulo FE en su cuenta

PASO 3 — El cliente tramita en la DIAN (portal MUISCA):
           a. Habilitación como facturador electrónico
           b. Resolución de numeración FE (prefijo ej: FE, rango ej: 1–50,000)
           c. Resolución de numeración POS (prefijo ej: FPOS, rango ej: 1–100,000)

PASO 4 — El cliente compra su certificado de firma digital
           (~$104,000 COP en Certicámara o GSE)
           y lo sube en ksmart360 (Configuración → FE → Certificado)

PASO 5 — El cliente obtiene su token de Matias API
           desde el portal de Matias (ksmart360 le indica cómo)
           y lo pega en Configuración → FE → Token

PASO 6 — El cliente registra sus dos resoluciones en ksmart360
           (Configuración → Resoluciones DIAN → Nueva resolución)
           Una de tipo "FE" y otra de tipo "POS"

PASO 7 — ksmart360 hace una prueba en modo sandbox con Matias
           para verificar que todo esté configurado correctamente

PASO 8 — Se activa el modo producción. Desde ese momento,
           cada venta genera automáticamente su documento DIAN.
```

El sistema tiene un asistente guiado integrado con instrucciones paso a paso para cada etapa. El cliente no queda solo.

---

## PARTE 9: Preguntas frecuentes del socio

**¿Qué pasa si el cliente tiene el plan Starter y no activa FE?**
El negocio sigue vendiendo normalmente en ksmart360, pero la responsabilidad de cumplir con la DIAN es enteramente del cliente. ksmart360 no es responsable del incumplimiento fiscal de un cliente que eligió no activar FE.

**¿Si el cliente agota sus documentos del mes, qué pasa?**
ksmart360 le notifica cuando llega al 80% de su cuota. Si la agota, las ventas siguen registrándose en el sistema pero no se emiten documentos electrónicos hasta el siguiente mes o hasta que el cliente pague el excedente ($50/doc adicional). Esto crea un riesgo de incumplimiento DIAN para el cliente, por eso la notificación temprana es clave.

**¿Ksmart360 tiene que reportar algo a la DIAN?**
No directamente. Matias API se encarga de la transmisión a la DIAN en nombre del cliente (usando sus credenciales y certificado). ksmart360 solo genera el documento; Matias lo envía.

**¿Qué pasa si la DIAN rechaza un documento?**
El sistema guarda el intento y muestra el error. El operador puede reintentar la emisión desde el panel de ventas. El documento rechazado no se cuenta como consumido en el paquete Matias.

**¿Se puede usar ksmart360 en modo offline y emitir FE después?**
La FE debe emitirse en tiempo real según la normativa. Si hay corte de internet, la venta se registra localmente pero el documento electrónico debe emitirse en cuanto se restaure la conexión, el mismo día.

**¿Qué diferencia hay para el cliente entre una FE y un DEE en la práctica?**
Para el comprador final, casi ninguna visible. La FE le permite al comprador deducir el IVA y usarla como soporte de gasto ante la DIAN. El DEE (Tiquete POS) también es válido fiscalmente desde 2024 para deducir IVA y gastos, pero no participa en las rifas de la DIAN y no puede convertirse en título valor. Para el negocio vendedor, ambos son igualmente válidos como soporte de ingresos.

---

## Conclusión

La facturación electrónica en Colombia no es un diferenciador competitivo de ksmart360 — es una **obligación legal** que ksmart360 resuelve de forma transparente y automática dentro de su plataforma.

El modelo de negocio es claro:
- ksmart360 paga a Matias API por cada documento emitido (~$21/doc en el paquete de 30,000)
- El cliente paga un plan Pro con una banda de documentos incluidos al mes
- El excedente protege el margen si el cliente supera su banda
- El paquete Matias se escala conforme crece la base de clientes con FE activa

La propuesta de valor para el cliente no es "FE ilimitada barata" sino **"FE incluida en un sistema sectorial completo que ningún competidor genérico ofrece con la misma profundidad"**.

---

*Documento preparado internamente para socios de ksmart360 — Junio 2026*
*Versión 1.0 — Sujeto a actualizaciones según cambios normativos de la DIAN*
