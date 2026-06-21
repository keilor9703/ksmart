# Comparativa de Proveedores de FE para ksmart360
## Informe para evaluación de casa de software — Junio 2026

---

## Resumen ejecutivo

Se evaluaron **8 proveedores** de Facturación Electrónica (FE) y Documento Equivalente
Electrónico (DEE) en Colombia con capacidad de operar bajo el modelo de **Casa de Software**
(un solo contrato que cubre múltiples empresas clientes). El único proveedor con precios
públicos, DEE confirmado y costo por documento competitivo es **Matias API**, que además
ya está integrado en ksmart360. Como segunda opción estratégica, **Aliaddo** merece
cotización por su posible inclusión de firma digital sin costo adicional para el cliente.

---

## 1. Matias API — Lopezsoft ⭐ *Proveedor actual integrado*

| Atributo | Detalle |
|---|---|
| Sitio web | matias-api.com |
| Habilitado DIAN | ✅ Sí |
| Modelo de precio | Paquetes anuales de documentos, sin mensualidad fija |
| Plan casa de software | ✅ Explícito, documentado |
| Requisito de entrada | Mínimo 5 clientes activos en los primeros 3 meses |
| Documentos soportados | 16+ tipos DIAN |
| Factura Electrónica (FE) | ✅ type_document_id = 7 |
| DEE / Tiquete POS | ✅ type_document_id = 20 |
| Nómina electrónica | ✅ |
| RADIAN | ✅ |
| API REST | ✅ Documentación pública |
| Sandbox gratuito | ✅ |
| Integración estimada | 1–2 días básica / 1–2 semanas completa |
| Soporte | WhatsApp + tickets, Lunes a Viernes 7:30–18:00 |
| Clientes activos (2025) | 700+ empresas, 8.75M+ documentos procesados |
| Certificado digital | No incluido — cliente lo obtiene por su cuenta (~$104,000/año) |

### Precios Casa de Software

| Paquete | Docs/año | Costo/año COP | Costo/mes equiv. | Costo/doc |
|---|---|---|---|---|
| Starter | 5,000 | $220,000 | $18,333 | **$44** |
| Básico | 10,000 | $400,000 | $33,333 | **$40** |
| **Popular ⭐** | **30,000** | **$630,000** | **$52,500** | **$21** |
| Avanzado | 50,000 | $850,000 | $70,833 | **$17** |

> El paquete es compartido entre todos los clientes de ksmart360 que tengan FE activa.

### Veredicto
✅ **Mantener como proveedor principal.** Mejor precio/doc verificado del mercado,
DEE confirmado y funcionando, integración ya lista en ksmart360. No hay razón para
cambiar en esta etapa.

---

## 2. Factus — factus.com.co ⭐ *Alternativa recomendada*

| Atributo | Detalle |
|---|---|
| Sitio web | factus.com.co / developers.factus.com.co |
| Habilitado DIAN | ✅ Sí |
| Modelo de precio | Plan gratuito (bajo volumen) + planes pagos por cotización |
| Plan casa de software | ✅ Existe, requiere contacto comercial |
| Factura Electrónica (FE) | ✅ |
| DEE / Tiquete POS | ✅ |
| Nómina electrónica | ✅ |
| API REST | ✅ Documentación pública (Postman + Bruno collections) |
| Sandbox gratuito | ✅ Ilimitado (diferenciador clave) |
| Integración estimada | Rápida (colecciones listas para testear) |
| Soporte | Email + documentación técnica |
| Certificado digital | Por confirmar en plan integrador |

### Precios conocidos
- **Plan gratuito:** ~10–20 facturas/mes (ideal para probar la integración)
- **Plan básico mencionado:** desde $310,000 COP (sin claridad en docs incluidos)
- **Plan casa de software:** **solo por cotización directa**

### Veredicto
🔍 **Cotizar como alternativa de respaldo.** El sandbox ilimitado gratuito permite
mantener una integración paralela con Factus sin costo, lo que da seguridad ante
cualquier problema con Matias. Integrar los dos en modo "fallback" es perfectamente
viable técnicamente y protege la continuidad del servicio.

---

## 3. Aliaddo — aliaddo.com

| Atributo | Detalle |
|---|---|
| Sitio web | aliaddo.com/productos/api |
| Habilitado DIAN | ✅ Sí |
| Modelo de precio | Paquetes anuales/mensuales — precios de API solo por cotización |
| Plan casa de software | ✅ API para integradores |
| Factura Electrónica (FE) | ✅ |
| DEE / Tiquete POS | ✅ |
| Nómina electrónica | ✅ |
| RADIAN | ✅ |
| API REST | ✅ |
| **Firma digital propia** | ✅ **Incluida — clientes no compran certificado** |
| Soporte | Equipo comercial |

### Diferenciador clave
Aliaddo **presta su propia firma digital** a los emisores, lo que elimina el costo
de ~$104,000 COP/año por empresa que cada cliente de ksmart360 actualmente paga en
certificado externo (Certicámara, GSE). Si esto aplica en el plan integrador, el ahorro
para el cliente mejora significativamente la propuesta comercial de ksmart360.

### Precios
No publicados para el plan API/integrador. Requiere cotización directa.

### Veredicto
🔍 **Cotizar urgente.** Si confirman que la firma digital está incluida para clientes
a través del integrador, esto puede ser una ventaja comercial real: "activa FE sin
pagar certificado adicional". Depende del precio por documento que ofrezcan.

---

## 4. Saphety Colombia — saphety.co

| Atributo | Detalle |
|---|---|
| Sitio web | saphety.co |
| Habilitado DIAN | ✅ Sí |
| Presencia | 50+ países, empresa global (portuguesa) |
| Modelo de precio | Prepago anual por documentos |
| Plan casa de software | ✅ Dos modelos: Operador Virtual (marca blanca) + Distribuidor |
| Factura Electrónica (FE) | ✅ |
| DEE / Tiquete POS | ✅ Solución "Factura POS" con DEE sin límite de monto |
| API REST | ✅ Habilitación en menos de 24 horas |
| Integración con ERP | < 40 días (con soporte técnico) |
| Aliados activos en Colombia | 30+ integradores |
| Certificado digital | No especificado |

### Precios publicados (planes directos por empresa — NO casa de software)

| Plan | Docs/año | Costo/año COP | Costo/doc |
|---|---|---|---|
| Básico | 100 | $150,000 | $1,500 |
| Estándar | 1,000 | $720,000 | $720 |
| Avanzado | 2,000 | $1,200,000 | $600 |

> ⚠️ Estos precios son para empresas individuales, **no para el plan de integrador**.
> El modelo de Operador Virtual (casa de software) tiene precios por cotización.
> En cualquier caso, el costo/doc es significativamente mayor que Matias API.

### Veredicto
⚠️ **No competitivo en precio en su plan directo.** El plan individual de Saphety
cobra $600–$1,500/doc vs $21/doc de Matias. El plan de Operador Virtual puede
ser diferente, pero la referencia de precio no es alentadora. Solo evaluar si el
plan integrador tiene precios radicalmente distintos y si el respaldo internacional
y el programa de aliados justifica el cambio.

---

## 5. Dataico — dataico.com.co

| Atributo | Detalle |
|---|---|
| Sitio web | dataico.com |
| Habilitado DIAN | ✅ Sí |
| Clientes actuales | 8,000 pymes, 450,000 docs/mes |
| Modelo de precio | Por documentos procesados, sin cargos por funcionalidad |
| Plan casa de software | ✅ API para ERP/POS/software |
| Factura Electrónica (FE) | ✅ |
| DEE / Tiquete POS | ✅ Confirmado |
| API REST | ✅ JSON, integración en días |
| Usuarios | Ilimitados en todos los planes |
| **Certificado digital** | ✅ **Incluido gratis en todos los planes** |
| Sin cláusula de permanencia | ✅ |
| Soporte | Equipo comercial |

### Precios publicados (plataforma directa — plan integrador por cotización)

| Plan | Costo/año COP |
|---|---|
| Básico | $264,000 |
| Intermedio | ~$480,000 |
| Avanzado | $712,800 |

> El plan de plataforma directa cuesta solo $20,000 COP/mes por empresa — muy
> accesible. El plan API para integradores no tiene precio publicado.

### Diferenciador
Dataico también **incluye el certificado digital sin costo adicional**, igual que
Aliaddo. Esto elimina los $104,000/año de Certicámara que cada cliente actualmente debe pagar.

### Veredicto
🔍 **Cotizar.** Empresa sólida (8,000 pymes), certificado incluido, API confirmada
y DEE soportado. El precio del plan integrador podría ser competitivo. La ausencia
de permanencia forzada es un plus.

---

## 6. Alanube — alanube.co

| Atributo | Detalle |
|---|---|
| Sitio web | alanube.co/colombia |
| Modelo | BaaS puro (Backend as a Service) — API únicamente, sin interfaz |
| Plan casa de software | ✅ Diseñado para integradores y ERP |
| Factura Electrónica (FE) | ✅ |
| DEE / Tiquete POS | ✅ |
| Multi-país | ✅ Colombia, Costa Rica, Rep. Dominicana |
| API REST | ✅ Webhooks nativos, documentación técnica excelente |
| Respaldo | Alianza con Alegra (proveedor autorizado DIAN) |
| Soporte | Técnico dedicado para integración |
| Precios | Solo por cotización |

### Veredicto
🌎 **Para cuando ksmart360 quiera expandirse a LATAM.** Alanube permite operar en
múltiples países con una sola API y un solo contrato. Hoy no tiene ventaja sobre
Matias para el mercado colombiano. En 12–18 meses, si hay plan de expansión regional,
es el candidato natural.

---

## 7. Gosocket — gosocket.net

| Atributo | Detalle |
|---|---|
| Sitio web | gosocket.net |
| Perfil | Corporativo — SAP, Oracle, grandes ERPs |
| Plan casa de software | ✅ Pero orientado a empresas grandes |
| Factura Electrónica (FE) | ✅ |
| DEE / Tiquete POS | ✅ Solución xPOS |
| Presencia | 15 países LATAM |
| API REST | ✅ OAuth 2.0 |
| Precios | 100% por cotización, contratos corporativos |

### Veredicto
❌ **No aplica para la etapa actual.** Gosocket está orientado a grandes empresas
con SAP/Oracle. Sus contratos son corporativos y costosos. Evaluar solo cuando
ksmart360 tenga 100+ clientes con FE y quiera infraestructura de nivel enterprise.

---

## 8. Plemsi — plemsi.com

| Atributo | Detalle |
|---|---|
| Sitio web | plemsi.com |
| Modelo | Paquetes por NIT individual — NO tiene modelo de casa de software |
| Plan casa de software | ❌ No disponible |
| Factura Electrónica (FE) | ✅ |
| DEE / Tiquete POS | ✅ |
| Precios publicados | ✅ Desde $95,000/mes por 100 docs (1 empresa) |

> Plemsi cobra por NIT. Para ksmart360, tendría que pagar un paquete separado
> por cada cliente — inviable económicamente como casa de software.

### Veredicto
❌ **No aplica.** Modelo incompatible con casa de software.

---

## Tabla comparativa final

| Proveedor | Casa SW | FE | DEE | Cert. incluido | Precio/doc (público) | Recomendación |
|---|---|---|---|---|---|---|
| **Matias API** | ✅ | ✅ | ✅ | ❌ ($104k/año cliente) | **$21 COP** | ⭐ Mantener |
| **Factus** | ✅ | ✅ | ✅ | Sin confirmar | Sin publicar | 🔍 Cotizar backup |
| **Aliaddo** | ✅ | ✅ | ✅ | ✅ Incluido | Sin publicar | 🔍 Cotizar urgente |
| **Dataico** | ✅ | ✅ | ✅ | ✅ Incluido | Sin publicar | 🔍 Cotizar |
| **Saphety** | ✅ | ✅ | ✅ | Sin confirmar | $600–$1,500 (ref.) | ⚠️ Caro en referencia |
| **Alanube** | ✅ | ✅ | ✅ | Sin confirmar | Sin publicar | 🌎 Para expansión LATAM |
| **Gosocket** | ✅ | ✅ | ✅ | Sin confirmar | Sin publicar | ❌ Muy corporativo |
| **Plemsi** | ❌ | ✅ | ✅ | Sin confirmar | $1,056+/doc | ❌ Por NIT, no aplica |

---

## Plan de acción recomendado

### Inmediato (hoy)
✅ Mantener Matias API con el paquete de 30,000 docs/año ($630,000/año = $52,500/mes).
No hay evidencia de un competidor con precio/doc más bajo disponible públicamente.

### Corto plazo (1–4 semanas)
📞 **Cotizar Aliaddo y Dataico** con estas preguntas específicas:
1. ¿El plan de casa de software incluye la firma digital para las empresas clientes?
2. ¿Cuál es el precio por documento en volúmenes de 30,000 y 50,000 docs/año?
3. ¿Hay un panel centralizado de gestión multi-cliente?
4. ¿Cuánto tiempo toma la integración técnica desde cero?

Si Aliaddo o Dataico ofrecen $25/doc o menos **con** certificado digital incluido,
puede ser atractivo cambiarse porque eliminas el costo de $104,000/año que cada cliente
actualmente paga en Certicámara — lo que hace tu oferta comercialmente más limpia.

### Mediano plazo (3–6 meses)
🔧 Integrar **Factus como proveedor de respaldo** (fallback automático).
Su sandbox ilimitado gratuito permite mantener la integración lista sin costo.
Si Matias tiene una interrupción de servicio, el sistema redirige a Factus
automáticamente sin que el cliente lo note.

### Largo plazo (expansión LATAM)
🌎 Evaluar **Alanube** cuando haya planes de operar en más países.
Una sola integración para Colombia, Costa Rica y República Dominicana.

---

## Conclusión

Matias API es hoy la mejor opción disponible con precios verificados para casa de
software en Colombia. Los únicos factores que justificarían un cambio son:

1. **Aliaddo o Dataico confirman firma digital incluida a precio/doc competitivo**
   → Ahorro de $104k/año/cliente mejora la propuesta comercial de ksmart360
2. **Matias sube sus precios o tiene problemas de servicio recurrentes**
   → Tener Factus como backup integrado mitiga este riesgo sin costo adicional

---

*Investigación realizada en junio 2026. Precios sujetos a cambio — verificar directamente
con cada proveedor antes de tomar decisiones comerciales.*

**Fuentes principales:**
- [Matias API — Casa de Software](https://matias-api.com/casas-de-software/)
- [Factus — API Colombia](https://www.factus.com.co/)
- [Alanube — Colombia](https://www.alanube.co/colombia/)
- [Aliaddo — API FE](https://aliaddo.com/productos/api/)
- [Saphety — Planes y Precios](https://saphety.co/planes-y-precios/)
- [Dataico — Planes](https://www.dataico.com/planes-y-precios)
- [Plemsi — Precios FE](https://plemsi.com/precios-facturacion-electronica/)
- [Gosocket — API FE](https://gosocket.net/)
- [Comparasoftware Colombia](https://www.comparasoftware.co/facturacion-en-linea)
- [ProgramasContabilidad — Comparativa 2025](https://programascontabilidad.com/analisis-de-herramientas/mejor-software-de-facturacion-electronica-colombia/)
