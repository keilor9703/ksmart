# Ksmart360 — Contenido técnico complementario para la página web
## Secciones adicionales · Junio 2026

> Estos bloques complementan la sección "Técnico" actual (stack + seguridad + Oracle Cloud).
> El tono es de confianza técnica — no de venta. Cada sección puede ir como bloque independiente en la página.

---

## BLOQUE A — Integraciones nativas

**Título:** Conectado con el ecosistema colombiano

**Subtítulo:**
Ksmart360 no vive en una burbuja. Está integrado de forma nativa con los servicios que ya usa tu negocio y con las entidades que lo regulan.

**Cards de integración:**

| Integración | Descripción |
|-------------|-------------|
| **DIAN** | Facturación electrónica UBL 2.1 vía proveedor habilitado. CUFE, QR y firma digital incluidos. |
| **Wompi** | Pasarela de pagos colombiana. Pago seguro con tarjeta, débito y PSE. Activación automática vía webhook. |
| **WhatsApp** | Cobros, recibos, recordatorios y catálogo virtual integrados sin apps adicionales. |
| **Códigos de barras globales** | Auto-completado de productos desde bases internacionales al escanear cualquier código. |
| **WebAuthn / FIDO2** | Estándar internacional de autenticación biométrica — el mismo que usan Google y Apple. |

---

## BLOQUE B — API y disponibilidad

**Título:** Una API robusta detrás de cada acción

**Texto:**
Cada función que ves en pantalla es el resultado de una API RESTful versionada, documentada automáticamente y diseñada para responder en milisegundos. Más de 200 endpoints organizados por dominio de negocio, con esquemas de validación estrictos y respuestas predecibles.

**Indicadores (formato chips o métricas):**

- `REST API v1` — versionada desde el primer día
- `Swagger / OpenAPI` — documentación automática siempre actualizada
- `Validación Pydantic v2` — ningún dato inválido llega al negocio
- `< 200 ms` — tiempo de respuesta promedio en operaciones de lectura
- `Rate limiting` — protección automática contra abuso y picos de tráfico

---

## BLOQUE C — Datos y continuidad

**Título:** Tus datos, siempre disponibles. Siempre seguros.

**Texto:**
Los datos de tu negocio son el activo más valioso que administramos. Por eso aplicamos una política de protección en tres niveles:

**Tres niveles de protección:**

**1. Aislamiento multi-tenant**
Los datos de cada empresa están completamente separados a nivel lógico. Ningún cliente puede ver, acceder ni interferir con los datos de otro — por diseño, no por configuración.

**2. Backups automáticos diarios**
Cada noche el sistema genera una copia de seguridad comprimida de la base de datos. Se mantienen los últimos 15 días de respaldo. La recuperación ante un fallo puede completarse en minutos.

**3. Infraestructura con alta disponibilidad**
El sistema corre sobre servidores Oracle Cloud en un datacenter certificado, con monitoreo activo del servicio las 24 horas. El proceso de backend se reinicia automáticamente ante cualquier interrupción inesperada.

> Si tu plan vence o decides hacer una pausa, tus datos permanecen intactos. Son tuyos.

---

## BLOQUE D — Cumplimiento normativo colombiano

**Título:** Construido para el mercado colombiano

**Texto:**
Ksmart360 no es un sistema extranjero adaptado — fue diseñado desde cero para la realidad tributaria, comercial y operativa de Colombia.

**Cumplimiento nativo:**

- **Facturación electrónica DIAN** — Resolución, prefijo, rango, CUFE y QR según normativa vigente
- **Plan Único de Cuentas (PUC)** — Contabilidad automática alineada al PUC colombiano
- **IVA colombiano** — Tarifas del 0%, 5% y 19% con separación automática de IVA generado y descontable
- **Retención en la fuente** — Cuentas contables disponibles en el PUC predefinido
- **Formato de moneda** — Pesos colombianos con punto como separador de miles y coma para decimales ($1.250.000,50)
- **NIT y tipo de documento** — Validación de dígito verificador y tipos de identificación colombianos

---

## BLOQUE E — Rendimiento y escala

**Título:** Diseñado para crecer contigo

**Texto:**
La arquitectura de Ksmart360 no tiene techo práctico para una empresa en crecimiento. Desde una tienda con un cajero hasta una operación con múltiples sedes y decenas de usuarios simultáneos — el mismo sistema, sin migraciones ni cambios de plan técnico.

**Cómo está construido para escalar:**

- **Sin estado en el servidor** — cada solicitud es independiente; el sistema puede atender múltiples usuarios en paralelo sin degradarse
- **Multi-tenant eficiente** — una sola instancia atiende a N empresas sin que una afecte el rendimiento de otra
- **Base de datos probada** — PostgreSQL 17, el motor relacional más confiable del mercado open source, con soporte para millones de transacciones
- **Frontend en CDN global** — la interfaz se carga desde el servidor más cercano al usuario, en cualquier país

---

## BLOQUE F — Actualizaciones continuas

**Título:** El sistema mejora solo

**Texto:**
Con Ksmart360 no compras una versión que envejece — accedes a un sistema que se actualiza continuamente. Cada mejora, corrección y nueva funcionalidad llega automáticamente a tu cuenta sin que tengas que hacer nada.

**Cómo funciona:**

Cuando el equipo de desarrollo aprueba un cambio, el sistema de despliegue continuo lo lleva a producción de forma automática. Las migraciones de base de datos se ejecutan solas, sin interrupciones del servicio. Al día siguiente simplemente encuentras el sistema mejorado.

- Sin descargas
- Sin instalaciones
- Sin ventanas de mantenimiento que interrumpan tu operación
- Sin costos adicionales por actualizaciones

> Las nuevas funcionalidades que pediste hoy, disponibles mañana.

---

*Ksmart360 — Junio 2026*
