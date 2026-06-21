# Estrategia de Precios ksmart360 — Análisis Completo
**Última actualización:** Junio 2026

---

## 1. Contexto y Objetivo

ksmart360 es un SaaS de gestión para PYMES colombianas (restaurantes, tiendas, parqueaderos) que incluye POS, inventario, compras, clientes, caja diaria y facturación electrónica DIAN. El objetivo de este documento es definir la estrategia de precios sostenible considerando el costo real de la facturación electrónica (FE) via Matias API.

---

## 2. Proveedor de Facturación Electrónica: Matias API

ksmart360 usa **Matias API** como intermediario habilitado ante la DIAN para emitir facturas electrónicas. El modelo de costos es por paquete anual de documentos para Casas de Software.

### Planes disponibles (Casa de Software)

| Paquete | Docs/año | Docs/mes equiv. | Costo/año COP | Costo/mes equiv. | Costo/doc |
|---------|----------|-----------------|---------------|------------------|-----------|
| 5,000 | 5,000 | 417 | $220,000 | $18,333 | $44 |
| 10,000 | 10,000 | 833 | $400,000 | $33,333 | $40 |
| **30,000** | **30,000** | **2,500** | **$630,000** | **$52,500** | **$21** |
| 50,000 | 50,000 | 4,167 | $850,000 | $70,833 | $17 |

### Plan inicial: **Paquete 30,000 documentos/año**

**Razones:**
- Mejor relación costo/beneficio del mercado ("Más Vendido" en Matias)
- Costo por doc ($21) competitivo vs planes más pequeños ($40–$44)
- Buen punto de arranque mientras la base de clientes con documento electrónico es pequeña

> ⚠️ **Importante (modelo corregido):** como **cada venta consume 1 documento**
> (FE o DEE-POS), el paquete se dimensiona por el **total de ventas mensuales de
> toda la base**, no por número de clientes. 30,000/año ≈ 2,500 docs/mes en total
> — suficiente para ~5 clientes pequeños (500 docs/mes) o **un solo** negocio
> mediano (3,000 docs/mes). Hay que monitorear el consumo agregado de cerca.

### Cómo escalar (por consumo total, no por nº de clientes):
- **≤ 2,500 docs/mes totales:** Paquete 30,000
- **≤ 4,167 docs/mes totales:** Paquete 50,000 ($17/doc)
- **> 4,167 docs/mes totales:** Paquetes de 100,000+ a cotizar por volumen

---

## 3. Consumo Real de Documentos Electrónicos

> ⚠️ **CORRECCIÓN LEGAL (actualizado).** El modelo de "consolidar las ventas sin
> factura en UNA sola FE al final del día" **NO es válido ante la DIAN**. La
> normativa (Resolución 000165 de 2023) exige **un documento electrónico por cada
> venta, en el momento de la venta**. No existe tope de tiempo ni de monto para
> agrupar varias ventas en un solo documento.

### Modelo correcto (implementado): un documento por venta

En el momento del cobro, el cajero pregunta *"¿El cliente requiere factura electrónica?"*:

- **Sí** (o venta ≥ 5 UVT, obligatorio) → **Factura Electrónica** (FE, con CUFE),
  con los datos del cliente → consume **1 documento Matias**.
- **No** (consumidor final, la mayoría) → **Documento Equivalente Electrónico /
  Tiquete POS** (DEE, con CUDE), a "Consumidor Final" → consume **1 documento Matias**.

> **Implicación económica clave:** *cada* venta consume 1 documento Matias,
> independientemente de si el cliente pide factura o no. El consumo NO es ~5% de las
> ventas — es **el 100%**. Matias cobra lo mismo por una FE que por un DEE-POS.

### Consumo por tamaño de negocio

| Negocio | Ventas/día | Documentos/mes (FE + DEE) |
|---|---|---|
| Tienda pequeña | 30 | ~900 |
| Negocio mediano | 100 | ~3,000 |
| Restaurante/parqueadero ocupado | 250 | ~7,500 |

> El DEE/POS requiere su **propia resolución DIAN** (prefijo distinto, ej. `FPOS`),
> separada de la resolución de Factura Electrónica. El sistema soporta ambas
> resoluciones activas simultáneamente (módulo Resoluciones DIAN → tipo "FE" / "POS").

### Cómo se cobra al cliente

Como cada venta consume un documento, los planes con documento electrónico se
ofrecen por **bandas de volumen de documentos/mes** (no "ilimitado"), con un
sobrecargo por excedente. Ver Sección 5.

---

## 4. Benchmarking Competitivo (Colombia, 2026)

Datos verificados con fuentes oficiales de cada plataforma.

| Software | Plan | Precio/mes COP | FE incluida | Restricción |
|---|---|---|---|---|
| **Alegra POS** | Emprendedor | $25,900 | Ilimitada | Ingresos ≤ $10M/mes |
| | Pyme | $79,900 | Ilimitada | Ingresos ≤ $40M/mes |
| | Pro | $139,900 | Ilimitada | Ingresos ≤ $180M/mes |
| **Alegra Solo FE** | Emprendedor | $17,900 | Ilimitada | Ingresos ≤ $10M/mes |
| | Pyme | $49,900 | Ilimitada | Ingresos ≤ $40M/mes |
| **Siigo** | Gratis | $0 | 5/mes | — |
| | Profesional | ~$145,993 | Ilimitada | 1 usuario (anual) |
| **Loggro Restobar** | Básico | $108,990 | Ilimitada | Ingresos ≤ $10M/mes |
| | Estándar | $133,990 | Ilimitada | Ingresos ≤ $50M/mes |
| | Premium | $279,990 | Ilimitada | Sin límite |
| **World Office** | Empresarial | ~$125,000+ | Ilimitada | Medianas empresas |

### Hallazgo clave

El estándar del mercado es **"facturación ilimitada"** restringida por nivel de ingresos, no por cantidad de documentos. Los competidores pueden ofrecerlo porque tienen integración propia con la DIAN (no pagan por documento a un tercero). ksmart360 paga a Matias por documento y **cada venta consume uno** (FE o DEE-POS), por eso opta por transparencia: ofrecer **bandas de documentos/mes** con excedente, en lugar de un "ilimitado" que no podría sostener en costos.

### Posicionamiento de ksmart360 vs mercado

| Plan ksmart360 | Precio | Equivalente en competencia | Precio competidor |
|---|---|---|---|
| Plan Starter (sin FE) | $29,900 | Alegra POS Emprendedor sin FE | ~$25,900 |
| **Plan Pro (con FE)** | **$49,900** | **Alegra POS Pyme** | **$79,900** |
| | | Loggro Restobar Básico | $108,990 |
| | | Siigo Profesional | ~$145,993 |

**ksmart360 es 40–60% más económico que el mercado** con funcionalidades equivalentes.

---

## 5. Planes y Precios ksmart360

### Planes base

| | Plan Starter | Plan Pro |
|---|---|---|
| **Precio mensual** | **$29,900** | **$49,900** |
| POS clásico y touch | ✅ | ✅ |
| Inventario y compras | ✅ | ✅ |
| Clientes y cartera | ✅ | ✅ |
| Caja diaria con arqueo | ✅ | ✅ |
| Reportes y exportación | ✅ | ✅ |
| Facturación electrónica DIAN | ❌ | ✅ |
| FE individuales incluidas | — | **300/mes** |
| FE consolidada diaria | — | ✅ Automática |
| CUFE y QR automático | — | ✅ |
| Gestión de resolución DIAN | — | ✅ |
| Alerta de resolución próxima | — | ✅ |
| FE adicionales (excedente) | — | $80/FE adicional |

### Descuentos por periodo

| Plan | Mensual | Trimestral (−10%) | Anual (−20%) |
|---|---|---|---|
| **Starter** | $29,900 | $80,730 | $287,040 |
| **Pro** | $49,900 | $134,730 | $479,040 |

### Bandas de documentos y excedente

Como **cada venta consume 1 documento** (FE o DEE-POS), el plan con documento
electrónico se vende por bandas de volumen mensual, no como "ilimitado":

| Banda Pro | Documentos/mes incluidos | Precio/mes sugerido |
|---|---|---|
| Pro 500 | 500 | $49,900 |
| Pro 1,500 | 1,500 | $79,900 |
| Pro 3,000 | 3,000 | $119,900 |

Excedente: **$45–60 COP por documento adicional** (cubre el costo Matias de
~$21/doc con margen). El sistema notifica automáticamente al acercarse al límite.

> Negocios de muy alto volumen (>3,000 docs/mes) se cotizan a la medida, escalando
> el paquete Matias o migrando a un plan por volumen de ingresos al estilo de la
> competencia.

---

## 6. Economía del Modelo (Rentabilidad)

### Costo de Matias API con Paquete 30,000

- Costo mensual fijo: **$52,500 COP**
- Costo por documento consumido: **$21 COP**

### Margen por cliente Plan Pro 500 ($49,900/mes)

Con consumo de 1 documento por venta, la rentabilidad depende del volumen real de
documentos de cada cliente, no de un porcentaje de ventas:

| Documentos/mes del cliente | Costo Matias ($21/doc) | Banda | Precio plan | Margen bruto |
|---|---|---|---|---|
| 500 | $10,500 | Pro 500 | $49,900 | $39,400 |
| 1,500 | $31,500 | Pro 1,500 | $79,900 | $48,400 |
| 3,000 | $63,000 | Pro 3,000 | $119,900 | $56,900 |

> Mientras el precio de cada banda cubra (costo Matias + margen), el modelo es
> rentable cliente por cliente. El excedente por documento protege el margen si el
> cliente supera su banda.

### Capacidad real del Paquete Matias

El paquete se consume por documentos totales, no por cliente. Cada venta cuenta:

| Paquete Matias | Docs/año | Docs/mes (pool) | Equivale a… |
|---|---|---|---|
| 30,000 | 30,000 | ~2,500 | ~5 clientes Pro 500, o 1 mediano |
| 50,000 | 50,000 | ~4,167 | ~8 clientes Pro 500 |
| 100,000+ | 100,000+ | ~8,333+ | a cotizar por volumen |

> **Regla práctica:** el paquete debe dimensionarse al **total de ventas mensuales
> de toda la base de clientes con documento electrónico**, no a un porcentaje. Hay
> que monitorear el consumo agregado y escalar el paquete a tiempo.

---

## 7. Requisitos para el Cliente (Plan Pro con FE)

Para activar facturación electrónica, el cliente debe cumplir:

### Requisitos ante la DIAN
1. **RUT activo** con actividad económica habilitada para FE
2. **Resolución de facturación DIAN** — rango de numeración autorizado
3. **Certificado de firma digital** (.p12 o .pfx) emitido por entidad certificadora habilitada (ej. Certicámara, Andes SCD, GSE)

### Costos que asume el cliente (externos a ksmart360)
| Concepto | Costo aprox. | Periodicidad |
|---|---|---|
| Certificado de firma digital | ~$104,000 COP/NIT | Anual (Certicámara o GSE) |
| Trámite resolución DIAN | Gratuito (virtual en MUISCA) | Cada 2–5 años |
| Renovación RUT / actualización | Gratuito | Cuando sea necesario |

### Lo que ksmart360 gestiona (incluido en Plan Pro)
- Habilitación ante la DIAN como facturador electrónico
- Configuración de la resolución de numeración
- Custodia y uso del certificado digital
- Generación de CUFE, QR y XML firmado
- Envío al correo del cliente comprador
- Alertas de vencimiento de resolución

---

## 8. Decisiones Clave Tomadas

| Decisión | Opción elegida | Razón |
|---|---|---|
| Proveedor FE | Matias API | Integrado en el sistema, precio/doc competitivo |
| Plan Matias | Paquete 30,000 | Mejor relación costo/volumen, escala a 25 clientes |
| Modelo de documento | 1 documento por venta (FE o DEE-POS) | Cumplimiento DIAN (Res. 000165/2023); la consolidación diaria es ilegal |
| Mensaje en planes | Bandas de documentos/mes (500 / 1,500 / 3,000) | Honestidad: cada venta consume 1 documento; no se promete "ilimitado" |
| DEE / Tiquete POS | Resolución DIAN propia (prefijo FPOS) | Requisito técnico de Matias y la DIAN para consumidor final |
| Precio Starter | $29,900/mes | Penetración agresiva, más barato que mercado |
| Precio Pro 500 | $49,900/mes | Cubre ~500 docs/mes con margen; competitivo |
| Excedente | $45–60/doc adicional | Cubre costo ($21) con margen |
| Escalado Matias | Dimensionar al total de ventas de toda la base | El pool se consume por documentos totales, no por % de ventas |

---

## 9. Fuentes

- [Alegra POS – Precios Colombia](https://www.alegra.com/colombia/pos/precios/)
- [Alegra Facturación Electrónica – Precios](https://www.alegra.com/colombia/facturacion-electronica/precios/)
- [Siigo – Planes y precios](https://www.siigo.com/precios-siigo/)
- [Loggro Restobar – Planes](https://loggro.com/restobar/planes/)
- [World Office – Facturación Electrónica](https://worldoffice.com.co/facturacion-electronica/)
- Matias API – Planes Casa de Software (imagen proporcionada por el cliente)

---

*Documento interno ksmart360 — confidencial*
