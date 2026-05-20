# Ksmart360 — Propuesta de Valor y Auditoría de Funcionalidades
## El Sistema Operativo para el Crecimiento de su Empresa
### Versión 3.0.0 | Mayo 2026

Este documento es el insumo estratégico para procesos de venta, marketing digital, campañas publicitarias y capacitación comercial. Describe en detalle cada módulo de Ksmart360 desde la perspectiva del valor que genera para el empresario. Solo resta agregar las capturas de pantalla reales del sistema en las secciones marcadas con `[📸 IMAGEN]`.

---

## Declaración de Valor

**Ksmart360** es la única plataforma en Colombia que unifica en un solo sistema de gestión: ERP comercial, préstamos con ruta de cobro, parqueadero de motos, lavadero de vehículos y catálogo virtual con pedidos por WhatsApp — todo con facturación electrónica DIAN nativa, autenticación biométrica y tecnología de clase mundial accesible desde cualquier celular, tableta o computador.

**Resultado:** Sus empleados dejan de usar cuadernos, hojas de cálculo y múltiples aplicaciones. Usted ve en tiempo real qué está pasando en su negocio, desde cualquier lugar.

---

## 1. Seguridad e Infraestructura de Nivel Empresarial

**Propuesta de valor:** Su información nunca ha estado tan protegida. Ksmart360 usa la misma tecnología de seguridad que los bancos digitales.

`[📸 IMAGEN: Pantalla de login con opción biométrica]`

### Funcionalidades

**Autenticación Biométrica (WebAuthn / FIDO2)**
Inicie sesión con su huella dactilar o rostro en menos de 2 segundos. Elimina el riesgo de contraseñas robadas. Compatible con lectores biométricos de cualquier celular o laptop moderno.

**Aislamiento Multi-Tenant (Búnker de Datos)**
La información de su empresa vive completamente separada de la de otros clientes en la plataforma. Es técnicamente imposible que otro usuario acceda a sus datos. Cada consulta al sistema verifica automáticamente que corresponde a su empresa.

**Control de Acceso por Roles (RBAC)**
Defina exactamente qué puede ver y hacer cada empleado:
- **Administrador**: acceso completo.
- **Cajero/Operador**: solo ventas y órdenes de trabajo asignadas.
- **Cobrador**: solo la ruta de cobro de sus clientes.

Ejemplo: su cajero puede registrar ventas pero **no puede** ver los costos de los productos ni los reportes de utilidad.

**Sesiones Seguras con JWT**
Cada sesión tiene una duración configurable. Tokens criptográficamente firmados. Si alguien roba el dispositivo, la sesión expira automáticamente.

**Tema Adaptativo al Dispositivo**
La interfaz detecta si su sistema operativo está en modo claro u oscuro y se adapta automáticamente. También puede cambiarlo manualmente desde la barra superior.

**Frases clave para marketing:**
> "Acceda con su huella. Olvídese de las contraseñas."
> "Sus datos, solo suyos. Nunca compartidos."
> "Control total sobre quién puede ver qué."

---

## 2. Punto de Venta (POS) de Última Generación

**Propuesta de valor:** Cobre más rápido, cometa menos errores y cumpla con la ley sin hacer nada extra.

`[📸 IMAGEN: POS modo clásico con productos en detalle]`
`[📸 IMAGEN: POS modo Touch con tarjetas de producto por categoría]`
`[📸 IMAGEN: Escáner de cámara activo con destello de confirmación verde]`

### Dos Modos de Operación

**Modo Clásico — El POS de Alta Velocidad**
Optimizado para teclado y lectores de código de barras USB. Busque cualquier producto por nombre, código o escanee el barcode. Agregue decenas de productos en segundos. Ideal para tiendas, droguerías, minimercados y puntos de venta con mostrador.

**Modo Touch — POS para Tableta y Restaurante**
Productos organizados en tarjetas visuales agrupadas por categoría, con foto, nombre y precio. Toque para agregar al carrito. Diseñado para operación sin teclado: restaurantes, fruterías, cafeterías, tiendas de moda. El carrito flotante muestra el total en tiempo real.

### Escáner de Código de Barras por Cámara

No necesita un lector físico. Abra la cámara del celular o tableta, apunte al código de barras y el sistema lo detecta instantáneamente. **La cámara permanece activa** para escanear múltiples productos en secuencia, sin necesidad de volver a abrirla entre productos. Un destello verde confirma cada lectura exitosa.

Formatos soportados: EAN-13, EAN-8, Code-128, QR, UPC-E, Code-39, ITF.

### Pagos Híbridos (Multi-Método)

Una sola factura puede combinar múltiples formas de pago:
- **Efectivo**: calcula el cambio automáticamente.
- **Transferencia / Nequi / Daviplata**: registre la referencia.
- **Tarjeta débito/crédito**.
- **Por Cobrar (Crédito)**: suma a la cartera del cliente con control de cupo.

### Control de Cupo de Crédito

Si un cliente tiene saldo pendiente de pago, el sistema verifica automáticamente que no supere su límite de crédito. Si lo supera, le advierte antes de registrar la venta. Usted decide si aprueba la excepción.

### Devoluciones y Notas Crédito

Proceso de devolución simplificado: seleccione la factura, elija los productos a devolver y confirme. El stock se reingresa automáticamente y la nota crédito queda registrada para la DIAN.

**Frases clave para marketing:**
> "Venda con teclado, con táctil o con la cámara del celular."
> "Combine efectivo, Nequi y tarjeta en la misma factura."
> "El POS más rápido de Colombia, ahora en modo tableta."

---

## 3. Inventario Inteligente con Trazabilidad Total

**Propuesta de valor:** Sepa exactamente cuánto tiene, cuánto vale y quién movió cada producto, en cualquier momento.

`[📸 IMAGEN: Listado de productos con indicadores de stock (verde/amarillo/rojo)]`
`[📸 IMAGEN: Kardex de un producto con historial de movimientos]`
`[📸 IMAGEN: Vista de grupos de productos con colores en el Touch POS]`

### Catálogo Visual con Imágenes

Cada producto puede tener hasta 3 fotografías en alta calidad (formato WebP). Las imágenes se muestran en el POS Touch para facilitar la identificación visual. Sin fotos: el sistema muestra un avatar con la inicial del producto.

### Barcode AI — Registro Automático con Red Global

Al agregar un producto nuevo, simplemente escanee el código de barras. El sistema busca automáticamente en:
1. Su propio inventario (búsqueda local instantánea).
2. OpenFoodFacts (base global de alimentos).
3. UPCitemdb (millones de productos retail y electrónicos).
4. OpenBeautyFacts (cosméticos) + OpenPetFoodFacts (mascotas).

Si lo encuentra, completa nombre, descripción y categoría. Usted solo asigna precio y costo.

### Grupos y Categorías con Color

Organice su catálogo en grupos personalizados con colores identificadores. Los grupos se muestran como secciones colapsables en el modo Touch POS, con un punto de color para identificación rápida. Reordenar los grupos: arrastre y suelte.

### Kardex por Promedio Ponderado

Cada movimiento de inventario queda registrado: compra, venta, ajuste, producción, devolución. El costo promedio ponderado se actualiza automáticamente con cada entrada. Exporte el kardex completo a Excel.

### Control de Lotes y Vencimientos (FEFO)

Para productos perecederos (alimentos, medicamentos, insumos con fecha de caducidad):
- Cada entrada registra el número de lote y la fecha de vencimiento.
- En cada venta, el sistema descuenta automáticamente los lotes más próximos a vencer (FEFO: First Expiration First Out).
- Alertas proactivas cuando productos están próximos a vencer.
- Trazabilidad completa: sepa de qué lote salió cada unidad vendida.

### Alertas de Reabastecimiento

Defina el stock mínimo de cada producto. Cuando el inventario caiga por debajo de ese nivel, el sistema envía una notificación automática al administrador y marca el producto en rojo en el listado.

### Carga Masiva por Excel

Ingrese cientos de productos en minutos descargando la plantilla Excel, completándola y subiéndola. El sistema importa nombre, código, precio, costo y stock sin errores.

**Frases clave para marketing:**
> "Escanee, y el sistema completa el nombre, la descripción y la categoría."
> "Sepa en tiempo real cuánto vale su inventario."
> "Nunca más venda un producto vencido: FEFO automático."

---

## 4. Cotizaciones Profesionales que se Convierten en Venta

**Propuesta de valor:** Gane más negocios con presupuestos de alta presentación, y conviértalos en facturas en un solo clic.

`[📸 IMAGEN: Formulario de cotización]`
`[📸 IMAGEN: Historial de cotizaciones con estados]`

### Funcionalidades

- Genere cotizaciones numeradas con sus productos, precios y condiciones.
- Defina la vigencia de la oferta.
- Comparta el PDF por WhatsApp o correo.
- Cuando el cliente apruebe: haga clic en **"Facturar"** y la cotización se convierte en venta instantáneamente. El stock se descuenta y la factura queda registrada.
- Control de estados: Borrador, Enviada, Aprobada, Facturada, Vencida.

**Frases clave para marketing:**
> "Del presupuesto a la factura en un clic."
> "Cotizaciones que proyectan profesionalismo."

---

## 5. Compras y Gestión de Proveedores

**Propuesta de valor:** Cada compra actualiza automáticamente el inventario, el costo y los lotes. Cero digitación doble.

`[📸 IMAGEN: Formulario de compra con detalle de productos]`

### Funcionalidades

- Registro de órdenes de compra con proveedor, productos, cantidades y costos.
- Actualización automática del stock y del costo promedio ponderado al guardar la compra.
- Para productos con lotes: ingrese número de lote y fecha de vencimiento al registrar la compra.
- Historial de compras por proveedor con montos y fechas.
- Integración con IVA: el IVA de las compras queda registrado como IVA descontable en el reporte fiscal.

---

## 6. Gestión de Clientes y Cartera

**Propuesta de valor:** Conozca a sus clientes, controle lo que le deben y cóbre por WhatsApp en segundos.

`[📸 IMAGEN: Ficha de cliente con historial y cartera]`
`[📸 IMAGEN: Reporte de deudores con aging]`

### Funcionalidades

**Ficha Completa del Cliente**
Nombre, identificación, correo, teléfono, dirección, ciudad. Campos DIAN completos para facturación electrónica: tipo de documento, dígito de verificación (DV), responsabilidades fiscales.

**Historial de Compras**
Todo el historial de transacciones del cliente en un solo lugar: fecha, monto, productos comprados, método de pago, saldo pendiente.

**Cupo de Crédito Controlado**
Asigne un límite máximo de crédito por cliente. El POS bloquea automáticamente ventas que superen el cupo.

**Cuentas por Cobrar con Aging**
Reporte de deudores clasificado por días de mora: 0-30, 31-60, 61-90, más de 90 días. Vea quién le debe, cuánto y hace cuánto días. Envíe un mensaje de cobro por WhatsApp directamente desde el reporte con un clic.

**Frases clave para marketing:**
> "Sepa en tiempo real cuánto dinero tiene en la calle."
> "Cobre por WhatsApp en un clic desde el reporte de deudores."

---

## 7. Órdenes de Trabajo — Taller y Servicios

**Propuesta de valor:** Gestione reparaciones y servicios con evidencias fotográficas, sin reclamos y con control total sobre sus operarios.

`[📸 IMAGEN: Lista de órdenes de trabajo con estados y colores]`
`[📸 IMAGEN: Detalle de orden con galería de fotos antes/después]`
`[📸 IMAGEN: Panel del operador en móvil]`

### Funcionalidades

**Flujo de Estados con Aprobación**
```
Borrador → En Proceso → Pendiente de Aprobación → Finalizado
```
El administrador aprueba o rechaza las órdenes. El operario solo avanza hasta donde su rol lo permite.

**Evidencias Fotográficas Obligatorias**
El sistema puede requerir fotos del estado del equipo antes y después del servicio. Galería visual en la ficha de la orden. Elimina reclamaciones por daños preexistentes.

**Consumo de Repuestos Integrado**
Los repuestos utilizados en cada reparación se descuentan automáticamente del inventario al cerrar la orden. Sin digitación manual, sin pérdidas de stock.

**Panel del Operador (Mobile-First)**
El operario accede desde su celular al panel personalizado: solo ve las órdenes asignadas a él. Puede subir fotos, registrar repuestos y avanzar el estado desde el campo.

**Control de Productividad**
El administrador puede ver en **Reportes → Productividad**: cuántas órdenes completó cada operario, en qué tiempo promedio y qué servicios realizó. Base para liquidación de comisiones.

**Frases clave para marketing:**
> "Cero reclamos por daños: evidencias fotográficas en cada trabajo."
> "Sus operarios trabajan desde el celular, usted ve el avance en tiempo real."

---

## 8. Producción y Recetas (BOM)

**Propuesta de valor:** Conozca el costo exacto de lo que fabrica y controle sus insumos automáticamente.

`[📸 IMAGEN: Editor de receta con ingredientes y cantidades]`
`[📸 IMAGEN: Orden de producción con estado y costo calculado]`

### Funcionalidades

**Fórmulas Maestras (Bill of Materials)**
Defina exactamente cuántos gramos, mililitros o unidades de cada insumo se necesitan para fabricar una unidad del producto terminado. El sistema calcula el costo de fabricación automáticamente.

**Órdenes de Producción**
Al iniciar un lote de producción:
- El sistema valida que haya stock suficiente de todos los insumos.
- Descuenta los insumos del inventario al iniciar.
- Agrega el producto terminado al stock al finalizar.
- Calcula el costo total del lote: materia prima + mano de obra configurada.

**Manejo de Mermas y Sub-productos**
Registre pérdidas de proceso para calcular el costo real de fabricación, no el teórico.

**Frases clave para marketing:**
> "Por fin sepa cuánto le cuesta realmente lo que fabrica."
> "Del insumo al producto terminado: trazabilidad completa."

---

## 9. Caja, Gastos y Corte Diario

**Propuesta de valor:** Cierre su caja en minutos, con arqueo exacto y sin sorpresas.

`[📸 IMAGEN: Dashboard de caja con ingresos del día]`
`[📸 IMAGEN: Pantalla de cierre de caja con cuadre]`

### Funcionalidades

- Apertura de caja con monto inicial registrado.
- Registro de gastos operativos durante el día (arriendo, servicios, papelería, etc.) con categoría y descripción.
- Cierre de caja: el sistema consolida ventas en efectivo, transferencias, recaudo de préstamos y gastos.
- Cuente el efectivo físico e ingrese el monto. El sistema calcula sobrante o faltante al instante.
- Historial de arqueos: todos los cierres quedan guardados con fecha, hora y quién los realizó.

---

## 10. Reportes Financieros y Analítica — Su CFO Digital

**Propuesta de valor:** Deje de tomar decisiones por intuición. Ksmart360 le dice exactamente qué está pasando en su negocio con números reales.

`[📸 IMAGEN: Dashboard principal con KPIs en tiempo real]`
`[📸 IMAGEN: Reporte de rentabilidad por producto]`
`[📸 IMAGEN: Reporte de IVA neto]`
`[📸 IMAGEN: Estado de resultados (P&L)]`

### Los 9 Reportes del Sistema

**1. Dashboard en Tiempo Real**
KPIs instantáneos: ventas del día, dinero en cartera, productos bajo stock mínimo, mora de préstamos. Vista global de la salud del negocio en una sola pantalla.

**2. Resumen de Ventas**
Ventas por período con total facturado, número de transacciones, ticket promedio y desglose por método de pago. Compare períodos para ver tendencias.

**3. Productos Más Vendidos y Rentabilidad**
¿Qué productos generan más ingresos? ¿Cuáles dejan más margen? Ranking por unidades vendidas y por utilidad bruta. Identifique los campeones y los que le generan pérdidas.

**4. Clientes Compradores**
Historial de compras por cliente: frecuencia, monto promedio, última compra. Identifique a sus mejores clientes y a los que no han vuelto.

**5. Cuentas por Cobrar (CXC) con Aging**
¿Cuánto le deben y hace cuánto tiempo? Clasificación por días de mora (0-30, 31-60, 61-90, +90). Acceso directo a WhatsApp de cada deudor.

**6. IVA Neto para la DIAN**
IVA generado en ventas vs. IVA descontable en compras = IVA neto a pagar. Cálculo automático para su declaración de IVA. Exportable a Excel.

**7. Productividad por Operario**
Cuántas órdenes de trabajo completó cada empleado, en qué tiempo y qué ingresos generó. Base objetiva para bonificaciones y evaluaciones de desempeño.

**8. Kardex e Inventario**
Valor total del inventario a precio de costo y a precio de venta. Productos con baja rotación (capital inmovilizado). Movimientos detallados por período.

**9. Estado de Resultados (P&L)**
Ingresos menos costos de mercancía vendida menos gastos operativos = utilidad neta del período. La foto financiera completa de su negocio.

**Todos los reportes:** filtros por fecha, exportación a Excel y PDF.

**Frases clave para marketing:**
> "9 reportes. Una sola plataforma. Todas las decisiones."
> "Su contador agradecerá el reporte de IVA que el sistema calcula solo."
> "Por primera vez, sepa cuánto gana realmente su negocio."

---

## 11. Préstamos y Gestión de Cartera

**Propuesta de valor:** Escale su negocio de préstamos con control absoluto del riesgo, la mora y el recaudo — sin papeles, sin cuadernos.

`[📸 IMAGEN: Simulador de préstamos con cuota calculada]`
`[📸 IMAGEN: Plan de pagos de un préstamo activo]`
`[📸 IMAGEN: Recibo de pago generado en PDF]`

### Funcionalidades

**Simulador de Amortización**
Ingrese monto, tasa de interés, número de cuotas y periodicidad (diario, semanal, quincenal, mensual). El simulador muestra instantáneamente la cuota calculada, el total a pagar y el desglose capital + intereses. Con un clic, el préstamo se crea y el plan de pagos queda generado con fechas exactas.

**Mora Automática en Tiempo Real**
No más cálculos manuales. Cuando una cuota vence sin ser pagada, el sistema calcula automáticamente los intereses de mora por cada día transcurrido, basándose en la tasa configurada. El cobrador siempre sabe exactamente cuánto debe cobrar incluyendo la mora.

**Abono a Capital con Redistribución Inteligente**
Cuando un cliente quiere abonar más del valor de la cuota, el sistema aplica el excedente directamente al capital pendiente y redistribuye el saldo entre las cuotas restantes. La cuota siguiente baja automáticamente.

**Recibo de Pago Digital**
Al registrar cualquier pago, el sistema genera un recibo PDF con: nombre del cliente, número de cuota, valor de capital, intereses, mora y total pagado. El recibo se puede descargar, imprimir o enviar por WhatsApp en segundos.

**Historial Crediticio Interno**
Califique a sus clientes según su comportamiento de pago histórico en Ksmart360. Identifique quiénes pagan puntual y quiénes generan mora crónica.

**Frases clave para marketing:**
> "La mora se calcula sola. Usted solo cobra."
> "Del cuaderno al sistema: su cartera bajo control en menos de 24 horas."

---

## 12. Ruta de Cobro en Campo

**Propuesta de valor:** Sus cobradores trabajan más eficientemente, usted controla cada visita en tiempo real, y el recaudo aumenta.

`[📸 IMAGEN: Lista de clientes para cobrar (vista móvil)]`
`[📸 IMAGEN: Pantalla de registro de pago en campo]`
`[📸 IMAGEN: Evidencia fotográfica con mapa GPS]`

### Funcionalidades

**App de Campo Optimizada para Móvil**
El cobrador accede desde su celular y ve únicamente su ruta del día: clientes con cuotas vencidas o con fecha de cobro hoy, ordenados por zona. Interfaz clara, simple y diseñada para usarse en la calle.

**Registro de Pago al Instante**
Seleccione el cliente, ingrese el monto recibido y el método de pago (Efectivo, Nequi, Transferencia, Tarjeta). El sistema actualiza la cuota en tiempo real. El recibo se envía al cliente por WhatsApp inmediatamente.

**Evidencia de Visita con GPS**
Si el cliente no está o no puede pagar, el cobrador sube:
- Una foto del lugar de visita.
- La ubicación GPS automática (valida que el cobrador estuvo en el sitio).
- Una nota de la novedad.

El administrador ve desde el sistema todas las evidencias y los mapas de ubicación. Elimina el "ya fui y no estaba" sin respaldo.

**Reprogramación con Validación**
El cobrador puede programar una nueva fecha de visita. El sistema solo permite fechas futuras, garantizando que la reprogramación sea real y no un intento de evadir el cobro.

**Asignación de Rutas**
El administrador asigna qué cuotas atiende cada cobrador. Filtros por zona geográfica para optimizar las rutas diarias.

**Frases clave para marketing:**
> "Su cobrador en la calle, usted viendo cada visita en el mapa."
> "Elimine las excusas. El GPS no miente."
> "Aumente su índice de recaudo sin contratar más cobradores."

---

## 13. Parqueadero de Motos — Gestión Completa

**Propuesta de valor:** Elimine las fugas de dinero en el mostrador, automatice las mensualidades y modernice la imagen de su parqueadero.

`[📸 IMAGEN: Dashboard de ocupación con barra de cupos disponibles]`
`[📸 IMAGEN: Pantalla de entrada rápida por placa]`
`[📸 IMAGEN: Lista de suscripciones activas y vencidas]`

### Funcionalidades

**Dashboard de Ocupación en Tiempo Real**
Barra visual de cupos: disponibles / ocupados / total. Lista de vehículos dentro con tiempo transcurrido. Un vistazo y sabe si tiene espacio disponible.

**Entrada y Salida Ultra-Rápida**
- **Entrada**: digite o escanee la placa. El sistema registra la hora exacta y reduce el cupo disponible.
- **Salida**: ingrese la placa. El sistema calcula automáticamente el valor según las tarifas: por hora, fracción, día o tarifa plana. Seleccione el método de pago y confirme.

**Tarifas Multi-Modal Configurables**
Configure cobros por minuto, por fracción (primeros 15 minutos), por hora completa, por día o tarifa de mensualidad. El sistema aplica la tarifa correcta automáticamente según el tiempo transcurrido.

**Suscripciones Mensuales con Alertas WhatsApp**
- Registre mensualidades de clientes fijos con fecha de inicio y fin.
- El sistema alerta cuando un cliente mensual intenta ingresar con suscripción vencida.
- Envío automático de recordatorios de pago por WhatsApp antes del vencimiento.
- Recibos digitales de pago de mensualidad.

**Gestión de Vehículos**
Base de datos de clientes recurrentes con placa, tipo de vehículo (moto, carro, camioneta), nombre y teléfono. Historial de visitas y pagos.

**Pagos Digitales Integrados**
Efectivo, transferencia bancaria, Nequi, Daviplata, tarjeta. Registro de la referencia de pago para auditoría.

**Reportes de Ingresos**
Ingresos del día, la semana o el mes. Desglose por tipo de cobro (hora vs mensualidad). Horas pico de mayor flujo para optimizar personal.

**Frases clave para marketing:**
> "Cobre mensualidades automáticamente y alerte vencimientos por WhatsApp."
> "Fin de las fugas de dinero en el mostrador."
> "Moderno, digital, profesional — así es su parqueadero con Ksmart360."

---

## 14. Lavadero de Vehículos (Car Wash POS)

**Propuesta de valor:** Controle sus servicios, asigne trabajo a cada empleado y mida la productividad de su lavadero.

`[📸 IMAGEN: POS de lavadero con selección de vehículo y servicios]`
`[📸 IMAGEN: Reporte de productividad por operador]`

### Funcionalidades

**POS Especializado para Lavadero**
- Registro de placa del vehículo con formato automático.
- Tipo de vehículo: Carro, Moto, Camioneta, Otro.
- Lista de servicios configurables: lavado básico, encerado, tapicería, motor, etc.
- Asignación directa del servicio a un operador específico.
- Múltiples métodos de pago.
- Opción "cliente mostrador" para clientes eventuales sin registro.

**Reporte de Productividad**
¿Cuántos vehículos lavó cada empleado? ¿Cuántos ingresos generó? ¿Qué servicios realizó? Datos reales para evaluar desempeño y calcular comisiones de forma objetiva.

---

## 15. Catálogo Virtual — Su Tienda Online con Pedidos por WhatsApp

**Propuesta de valor:** Venda 24/7 sin pagar plataformas de e-commerce. Su catálogo digital, sincronizado con su inventario, listo en minutos.

`[📸 IMAGEN: Configuración del catálogo (slug, logo, WhatsApp)]`
`[📸 IMAGEN: Vista pública del catálogo desde celular]`
`[📸 IMAGEN: Carrito de compras y botón "Pedir por WhatsApp"]`

### Funcionalidades

**Tienda Pública Personalizada**
Configure su URL única: `sistema.com/catalogo/su-negocio`. Suba su logo y elija el número de WhatsApp donde llegarán los pedidos. Sin código, sin hosting, sin complicaciones.

**Sincronización Automática con Inventario**
Los productos que publica en el catálogo son los mismos de su inventario. Si un producto se agota, desaparece automáticamente del catálogo. Los precios son siempre los precios reales del sistema.

**Carrito de Compras con Pedido por WhatsApp**
El cliente elige sus productos, los agrega al carrito y hace clic en **"Pedir por WhatsApp"**. Se abre automáticamente un mensaje pre-estructurado con la lista de productos, cantidades y total. El cliente solo presiona enviar.

**Buscador y Filtros**
El cliente puede buscar por nombre de producto o filtrar por categoría y precio. Interfaz mobile-first, ultra-rápida.

**Frases clave para marketing:**
> "Su tienda online lista en 5 minutos. Sin programadores, sin hosting."
> "Sus clientes piden desde Instagram, usted recibe el pedido en WhatsApp."
> "Catálogo digital que siempre muestra lo que tiene en stock."

---

## 16. Facturación Electrónica DIAN — Cumplimiento Legal Automático

**Propuesta de valor:** Cumpla con la DIAN sin procesos manuales al final del mes. Cada factura se envía sola.

`[📸 IMAGEN: Gestión de resoluciones DIAN]`
`[📸 IMAGEN: Venta con estado de factura electrónica (CUFE, QR)]`

### Funcionalidades

**Resoluciones DIAN Configuradas en el Sistema**
Ingrese su número de resolución, prefijo, rango de numeración y fechas de vigencia. El sistema lleva la numeración consecutiva automáticamente y le avisa cuando el rango esté próximo a agotarse o la resolución esté por vencer.

**Generación Automática al Vender**
Si tiene la facturación electrónica activa, cada venta genera automáticamente:
- Número de factura consecutivo según la resolución.
- XML de la factura en formato DIAN.
- CUFE (Código Único de Factura Electrónica).
- QR para verificación.
- PDF de la factura para el cliente.
- Envío al correo del cliente.

Todo a través de la integración con **Matias API**, el proveedor tecnológico autorizado por la DIAN.

**Control de Estado**
Cada factura muestra su estado: Pendiente / Enviado / Aceptado / Rechazado. Los mensajes de error de la DIAN aparecen directamente en el sistema para su corrección.

**Modo Prueba**
Active el modo de prueba para familiarizarse con la facturación electrónica sin afectar la numeración real de su resolución.

**Frases clave para marketing:**
> "La DIAN recibe su factura antes de que el cliente salga de la tienda."
> "Olvídese del informe mensual al contador. El sistema lo hace solo."

---

## 17. Monitor de Precio del Cacao (Módulo Especializado)

**Propuesta de valor:** Inteligencia de mercado en tiempo real para el sector cacaotero colombiano.

`[📸 IMAGEN: Widget de precio del cacao en el dashboard]`

### Funcionalidades

- **Precio internacional ICE Futures (Nueva York)**: actualización automática desde Yahoo Finance.
- **Conversión a COP/Kg**: usando la TRM oficial del día desde Datos.gov.co.
- **Histórico de precios**: gráfica de tendencia de la última semana para identificar si el precio está al alza o a la baja.

**Para quién:** Productores, acopiadores y comercializadores de cacao en Colombia que necesitan saber el momento óptimo de compra o venta.

---

## 18. Administración SaaS — Panel SuperAdmin

**Propuesta de valor (interno):** Control total de todos los clientes de la plataforma desde un único panel.

### Funcionalidades

- **Gestión de empresas**: listar todos los tenants con estado de suscripción, fecha de vencimiento y módulos habilitados.
- **Gestión de planes**: cambiar plan de cualquier empresa (trial → premium → vitalicio → canceled) manualmente.
- **Impersonación segura**: ingresar al sistema como cualquier empresa para soporte técnico, sin afectar los datos del cliente. El cliente no se entera.
- **Anuncios globales**: publicar banners informativos que aparecen a todos los usuarios de la plataforma.
- **Auditoría de acciones**: log de todas las acciones administrativas realizadas.
- **Módulos por empresa**: habilitar o deshabilitar módulos específicos para cada empresa sin tocar el código.

---

## Resumen Ejecutivo — Por Qué Ksmart360

| Necesidad del empresario | Solución Ksmart360 |
|-------------------------|-------------------|
| "No sé cuánto tengo en inventario" | Kardex en tiempo real con alertas de stock mínimo |
| "Mis empleados cometen errores en caja" | POS con validaciones automáticas y control de cupo |
| "No sé si mis clientes me están pagando" | CXC con aging y cobro por WhatsApp en un clic |
| "Tengo que hacer el informe de IVA a mano" | Reporte IVA neto generado automáticamente |
| "No controlo a mis cobradores en campo" | GPS + evidencias fotográficas por visita |
| "La DIAN me puede multar" | Facturación electrónica automática integrada |
| "No tengo tienda online" | Catálogo virtual con pedidos por WhatsApp en 5 minutos |
| "No sé cuánto me cuesta fabricar" | Producción BOM con costo calculado automáticamente |
| "Los vencimientos del parqueadero se me olvidan" | Alertas automáticas por WhatsApp al cliente |
| "Necesito controlar a mis operarios" | Panel de operador con productividad medible |

---

## Planes y Modelo de Negocio

| Plan | Descripción | Duración |
|------|-------------|----------|
| **Trial Gratuito** | Acceso completo a todos los módulos | 14 días |
| **Premium** | Todos los módulos activos, soporte incluido | Mensual / Anual |
| **Vitalicio** | Pago único, acceso de por vida | Sin vencimiento |

Activación inmediata al pago. Sin instalaciones. Funciona desde cualquier dispositivo con internet.

---

## Datos Técnicos de Respaldo para Ventas

- **Tecnología:** FastAPI + React 18 + Material UI v5 + PostgreSQL
- **Despliegue:** Vercel (frontend) + Render (backend) — uptime 99.9%
- **Seguridad:** JWT + WebAuthn FIDO2, aislamiento multi-tenant por empresa_id
- **Módulos:** 17 módulos de negocio, 27 submodulos configurables por empresa
- **API:** 31 grupos de endpoints REST documentados con Swagger UI
- **Modelos de datos:** 57 entidades de negocio
- **Formatos de barcode:** EAN-13, EAN-8, Code-128, QR, UPC-E, Code-39, ITF
- **Pasarela de pagos:** Wompi (Colombia) — débito, crédito, PSE
- **DIAN:** Integración Matias API para factura electrónica
- **Cumplimiento legal:** Ley 1581 de 2012 (Habeas Data), Decreto 1377 de 2013
- **WhatsApp:** Integración nativa en parqueadero, préstamos y catálogo

---

**Ksmart360 — Tecnología que trabaja por usted, no al revés.**

*Desarrollado por KSMP Systems para empresas colombianas.*  
*[appjeylor.com](https://appjeylor.com) | Todos los derechos reservados © 2026*
