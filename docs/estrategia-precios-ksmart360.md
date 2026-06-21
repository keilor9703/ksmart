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

### Plan elegido: **Paquete 30,000 documentos/año**

**Razones:**
- Mejor relación costo/beneficio del mercado ("Más Vendido" en Matias)
- Costo por doc ($21) es competitivo vs planes más pequeños ($40–$44)
- Capacidad para crecer sin urgencia de cambiar de plan (~25 clientes con FE activa)
- Con solo 2–3 clientes en Plan Pro se cubre el costo mensual de Matias

### Cómo escalar:
- **Hoy → 20 clientes con FE:** Paquete 30,000
- **20+ clientes con FE:** Migrar a Paquete 50,000 ($17/doc, mejor margen)

---

## 3. Consumo Real de Documentos FE

### Modelo de consumo consolidado (implementado en sistema)

> **El sistema NO consume un documento FE por cada venta.**
> En el momento del cobro, el cajero pregunta "¿El cliente quiere factura electrónica?"
> - **Sí (~5% ventas):** emite FE individual → consume 1 documento Matias
> - **No (~95% ventas):** registra la venta sin FE → al final del día se consolida UNA SOLA FE con el total de todas las ventas sin factura → consume 1 documento Matias

Esto significa que un negocio que hace 200 ventas/día consume:
- ~10 FE individuales (5% × 200)
- + 1 FE consolidada diaria
- = **~11 documentos/día** → ~330 documentos/mes

Sin el modelo consolidado, ese mismo negocio consumiría 200 docs/día = 6,000/mes.
**El modelo consolidado reduce el consumo real en ~95%.**

### Documentos ofrecidos en el plan Pro

| Cantidad anunciada | Consumo real esperado | Margen de seguridad |
|---|---|---|
| **300 FE individuales/mes** (+ consolidado diario incluido) | ~50–120 FE individuales | Alto |

> **Nota:** El FE consolidado diario NO cuenta dentro de las 300 — es automático y no le "cuesta" al cliente su cuota mensual.

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

El estándar del mercado es **"facturación ilimitada"** restringida por nivel de ingresos, no por cantidad de documentos. Los competidores pueden ofrecerlo porque tienen integración propia con la DIAN (no pagan por documento a un tercero). ksmart360 paga a Matias por documento, por eso opta por transparencia: indicar la cantidad exacta de FE individuales incluidas, con FE consolidada diaria automática.

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

### Excedente de FE

Cuando un cliente supera las 300 FE individuales del mes, el sistema notifica automáticamente y aplica un cargo de **$80 COP por FE adicional**. Esto cubre el costo de Matias ($21/doc) con un margen del 280%.

---

## 6. Economía del Modelo (Rentabilidad)

### Costo de Matias API con Paquete 30,000

- Costo mensual fijo: **$52,500 COP**
- Costo por documento consumido: **$21 COP**

### Margen por cliente Plan Pro ($49,900/mes)

El diferencial Pro vs Starter es $20,000/mes. Ese es el ingreso bruto que cubre la FE de cada cliente.

| Clientes activos con FE | Ingreso FE total | Costo Matias | Margen neto FE |
|---|---|---|---|
| 3 clientes | $60,000 | $52,500 | $7,500 |
| 5 clientes | $100,000 | $52,500 | $47,500 |
| 10 clientes | $200,000 | $52,500 | $147,500 |
| 20 clientes | $400,000 | $52,500 | $347,500 |
| 25 clientes (máx. pool) | $500,000 | $52,500 | $447,500 |

> **Break-even de Matias:** con **3 clientes en Plan Pro** ya se cubre el costo del paquete 30,000.
> A partir del 4.º cliente, todo es ganancia neta de FE.

### Capacidad del Paquete 30,000

Con el modelo consolidado (consumo real ~50–150 docs/mes por cliente):

| Consumo real/cliente | Máx. clientes soportados |
|---|---|
| 80 docs/mes | ~31 clientes |
| 100 docs/mes | ~25 clientes |
| 150 docs/mes (pesado) | ~16 clientes |

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
| Mensaje FE en planes | "300 FE individuales/mes" | Honestidad con el cliente, evita riesgo de abuso |
| FE consolidada | Automática, no cuenta en cuota | Reduce consumo real ~95%, sin costo extra para cliente |
| Precio Starter | $29,900/mes | Penetración agresiva, más barato que mercado |
| Precio Pro | $49,900/mes | 40% más barato que Alegra Pyme ($79,900) |
| Excedente FE | $80/FE adicional | Cubre costo ($21) con margen del 280% |
| Escalado Matias | A 50,000 docs cuando llegue a 20 clientes con FE | Reduce costo a $17/doc |

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
