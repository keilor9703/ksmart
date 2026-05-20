# Manual de Usuario — Ksmart360
## Versión 3.0.0 | Mayo 2026

Bienvenido a **Ksmart360**, el sistema operativo para su empresa. Este manual le guía paso a paso por cada módulo del sistema, desde el primer acceso hasta el análisis financiero avanzado.

---

## Contenido

1. [Primer Acceso y Configuración Inicial](#1-primer-acceso-y-configuración-inicial)
2. [Punto de Venta — POS Clásico y Touch](#2-punto-de-venta--pos-clásico-y-touch)
3. [Cotizaciones y Preventas](#3-cotizaciones-y-preventas)
4. [Inventario y Productos](#4-inventario-y-productos)
5. [Compras](#5-compras)
6. [Clientes y Terceros](#6-clientes-y-terceros)
7. [Órdenes de Trabajo](#7-órdenes-de-trabajo)
8. [Producción y Recetas](#8-producción-y-recetas)
9. [Caja y Corte Diario](#9-caja-y-corte-diario)
10. [Reportes y Análisis](#10-reportes-y-análisis)
11. [Préstamos y Cartera](#11-préstamos-y-cartera)
12. [Ruta de Cobro en Campo](#12-ruta-de-cobro-en-campo)
13. [Parqueadero](#13-parqueadero)
14. [Lavadero / Car Wash](#14-lavadero--car-wash)
15. [Catálogo Virtual](#15-catálogo-virtual)
16. [Facturación Electrónica DIAN](#16-facturación-electrónica-dian)
17. [Administración de Usuarios y Roles](#17-administración-de-usuarios-y-roles)
18. [Suscripción y Planes](#18-suscripción-y-planes)

---

## 1. Primer Acceso y Configuración Inicial

### 1.1 Registro de la Empresa

1. Ingrese a la aplicación y haga clic en **"Registrar mi empresa"**.
2. Complete: nombre de la empresa, NIT, correo, contraseña del administrador y tipo de negocio (ERP/Comercio, Prestamista, Parqueadero, Lavadero).
3. El sistema activará automáticamente los módulos correspondientes a su tipo de negocio.
4. Comenzará con un **período de prueba gratuito de 14 días** con acceso completo.

### 1.2 Inicio de Sesión

**Con usuario y contraseña:**
1. Ingrese su nombre de usuario y contraseña en la pantalla de inicio.
2. Haga clic en **"Ingresar"**.

**Con huella dactilar o reconocimiento facial (Biométrico):**
1. Inicie sesión con usuario y contraseña por primera vez.
2. Vaya a **Mi Perfil → Seguridad → Registrar huella / rostro**.
3. A partir de ese momento, solo presione el ícono de huella en la pantalla de login.

> El sistema detecta automáticamente el tema claro u oscuro de su dispositivo. También puede cambiarlo manualmente desde el ícono de luna/sol en la barra superior.

### 1.3 Configuración Inicial Recomendada

Antes de operar, complete estos pasos en el orden indicado:

| Paso | Módulo | Qué hacer |
|------|--------|-----------|
| 1 | Grupos de Productos | Crear categorías con colores (ej: "Bebidas" azul, "Snacks" verde) |
| 2 | Productos | Ingresar catálogo con precios, costos e imágenes |
| 3 | Clientes | Importar o crear base de clientes |
| 4 | Usuarios | Crear usuarios para cajeros, operadores, cobradores |
| 5 | Resoluciones DIAN | Configurar si factura electrónicamente |
| 6 | Caja | Realizar primera apertura de caja |

---

## 2. Punto de Venta — POS Clásico y Touch

El módulo de Ventas tiene dos modos de operación que puede alternar en cualquier momento con el ícono de teclado/pantalla táctil en la esquina superior derecha.

### 2.1 Modo Clásico (Teclado)

Ideal para cajas con teclado y lector de código de barras por USB.

**Realizar una venta:**
1. En el campo de búsqueda, escriba el nombre o código del producto, o escanee con el lector USB.
2. El producto se agrega al detalle. Ajuste la cantidad si es necesario.
3. Seleccione el cliente (puede dejar "Mostrador" para ventas al público).
4. Haga clic en **"Pagar"**.
5. Seleccione el método de pago:
   - **Efectivo**: ingrese el monto recibido y el sistema calcula el cambio.
   - **Transferencia / Nequi / Daviplata**: registre la referencia de la transferencia.
   - **Tarjeta**: el sistema registra la transacción.
   - **Por Cobrar**: la venta queda pendiente de pago y se suma a la cartera del cliente.
6. Puede combinar múltiples métodos de pago en una misma venta.
7. Haga clic en **"Registrar Venta"**.

> **Escáner por cámara:** Active la cámara haciendo clic en el ícono de cámara junto al campo de búsqueda. Apunte el código de barras al recuadro. El sistema detecta automáticamente — puede escanear varios productos seguidos sin cerrar la cámara. Un destello verde confirma la lectura.

**Devoluciones:**
1. Abra el historial de ventas (pestaña "Historial").
2. Busque la venta y haga clic en el ícono de devolución.
3. Seleccione los productos y cantidades a devolver.
4. El sistema genera la nota crédito y reingresa el stock automáticamente.

### 2.2 Modo Touch (Tableta)

Ideal para restaurantes, fruterías, tiendas con tablet.

1. Las tarjetas de producto aparecen organizadas por categoría/grupo.
2. Toque una tarjeta para agregar el producto al carrito. Toque múltiples veces para aumentar la cantidad.
3. El carrito se muestra en el panel derecho (o como botón flotante en celular).
4. Desde el carrito: ajuste cantidades, elimine ítems, aplique descuentos.
5. Seleccione cliente y método de pago igual que en el modo clásico.
6. Toque **"Registrar Venta"**.

> Use la barra de búsqueda en la parte superior para filtrar productos cuando tiene un catálogo extenso.

---

## 3. Cotizaciones y Preventas

1. Vaya a **Cotizaciones** en el menú lateral.
2. Haga clic en **"Nueva Cotización"**.
3. Agregue productos, cliente, condiciones y vigencia.
4. Guarde — se genera un número de cotización y puede compartirla.
5. Cuando el cliente apruebe, ubique la cotización en la lista y haga clic en **"Facturar"**. La cotización se convierte en venta y el stock se descuenta automáticamente.

---

## 4. Inventario y Productos

### 4.1 Crear un Producto

1. Vaya a **Productos** → **"Nuevo Producto"**.
2. Complete: nombre, código de barras, precio de venta, costo, IVA y stock inicial.
3. Asigne un grupo/categoría para organizarlo visualmente.
4. Agregue imágenes (hasta 3 fotos en WebP de alta calidad).
5. Si el producto es perecedero, active **"Maneja Lotes"** para control de vencimientos.
6. Guarde.

**Atajo con código de barras:**
- Escanee o escriba el código de barras en el campo correspondiente.
- Si el código está en nuestra base global o en OpenFoodFacts/UPCitemdb, el sistema completará el nombre y la descripción automáticamente.
- Usted solo debe asignar el precio de venta y el costo.

### 4.2 Grupos de Productos

- Vaya a **Productos → Grupos**.
- Cree grupos con nombre, código y **color identificador** (se usan en el modo Touch POS).
- Arrastre para reordenar los grupos según la frecuencia de uso.

### 4.3 Kardex y Trazabilidad

- En cualquier producto, haga clic en el ícono de historial (reloj).
- Verá cada movimiento: quién lo vendió, quién hizo el ajuste, la fecha exacta y el motivo.
- Exporte el kardex a Excel desde el botón de descarga.

### 4.4 Control de Lotes y Vencimientos (FEFO)

Cuando `Maneja Lotes = Sí`:
1. Al registrar una compra, el sistema solicita el número de lote y la fecha de vencimiento.
2. En las ventas, el sistema descuenta automáticamente los lotes más próximos a vencer primero (FEFO — First Expiration First Out).
3. Recibirá alertas cuando productos estén próximos a vencer.

### 4.5 Ajuste de Inventario

1. Vaya a **Inventario → Movimientos → Nuevo Movimiento**.
2. Seleccione: Entrada, Salida o Ajuste.
3. Elija el producto, cantidad y motivo (daño, robo, merma, donación).
4. El sistema registra quién hizo el ajuste y cuándo.

### 4.6 Carga Masiva por Excel

1. Descargue la plantilla desde **Inventario → Importar → Descargar Plantilla**.
2. Complete la planilla con nombre, código, precio, costo, stock.
3. Suba el archivo y el sistema importará todos los productos automáticamente.

### 4.7 Alertas de Stock Mínimo

- Defina el `stock_minimo` de cada producto al crearlo o editarlo.
- Cuando el stock caiga por debajo de este valor, el sistema enviará una notificación al administrador y mostrará el producto en rojo en el listado.

---

## 5. Compras

1. Vaya a **Compras** → **"Nueva Compra"**.
2. Seleccione el proveedor.
3. Agregue los productos comprados con cantidad, costo unitario e IVA.
4. Si el producto maneja lotes, ingrese el número de lote y fecha de vencimiento.
5. Guarde. El sistema actualiza automáticamente:
   - El stock de cada producto (entrada en el kardex).
   - El costo promedio ponderado del producto.
   - Los lotes disponibles para venta FEFO.

---

## 6. Clientes y Terceros

### 6.1 Crear un Cliente o Proveedor

1. Vaya a **Clientes/Terceros** → **"Nuevo"**.
2. Complete: nombre, identificación, correo, teléfono, dirección.
3. Para facturación electrónica DIAN: llene el tipo de documento, DV y responsabilidades fiscales.
4. Si es proveedor, active el switch **"Es Proveedor"**.
5. Defina el **cupo de crédito** máximo si le vende a crédito.

### 6.2 Historial del Cliente

- Haga clic en el cliente → pestaña **"Historial"**.
- Verá todas las compras, saldo de cartera, días promedio de pago y el monto total comprado.

### 6.3 Cartera / Cuentas por Cobrar

- Vaya a **Reportes → Cuentas por Cobrar** o **Clientes → Deudores**.
- Filtre por días de mora (0-30, 31-60, 61-90, +90 días).
- Haga clic en el ícono de WhatsApp para enviar un mensaje de cobro al cliente directamente.

---

## 7. Órdenes de Trabajo

Módulo para talleres mecánicos, de tecnología, lavaderos, servicios de mantenimiento, etc.

### 7.1 Crear una Orden de Trabajo

1. Vaya a **Órdenes de Trabajo** → **"Nueva Orden"**.
2. Complete: cliente, descripción del equipo/vehículo, falla reportada.
3. Tome o adjunte fotos del estado inicial del equipo ("antes").
4. Asigne un operador responsable.
5. Guarde — la orden queda en estado **"Borrador"**.

### 7.2 Flujo de Estados

```
Borrador → En Proceso → Pendiente de Aprobación → Finalizado
```

- El **Operador** avanza el estado desde su panel y sube evidencias fotográficas.
- El **Admin** aprueba o rechaza cuando llega a "Pendiente de Aprobación".
- Al finalizar, los repuestos utilizados se descuentan automáticamente del inventario.

### 7.3 Panel del Operador

- Los operadores acceden a **"Panel Operador"** donde solo ven las órdenes asignadas a ellos.
- Pueden subir fotos "antes y después", registrar los repuestos usados y marcar el avance.
- El administrador puede ver la productividad por operador en **Reportes → Productividad**.

---

## 8. Producción y Recetas

Ideal para panaderías, cocinas, laboratorios, fábricas pequeñas.

### 8.1 Crear una Receta (BOM)

1. Vaya a **Recetas** → **"Nueva Receta"**.
2. Seleccione el **producto terminado** que se va a fabricar.
3. Agregue los ingredientes/insumos con la cantidad exacta por unidad producida.
4. Guarde. El sistema calcula el costo de fabricación automáticamente.

### 8.2 Orden de Producción

1. Seleccione una receta y haga clic en **"Iniciar Producción"**.
2. Indique la cantidad de unidades a fabricar.
3. El sistema valida que haya stock suficiente de todos los insumos.
4. Al confirmar, los insumos se descuentan del inventario.
5. Al finalizar, el producto terminado se agrega al stock.

---

## 9. Caja y Corte Diario

### 9.1 Apertura de Caja

1. Vaya a **Caja** → **"Abrir Caja"**.
2. Ingrese el monto inicial en efectivo (base de caja).
3. Confirme la apertura.

### 9.2 Registro de Gastos

- Durante el día, registre gastos operativos desde **Caja → Gastos**: arriendo, servicios, papelería, etc.
- Cada gasto queda registrado con categoría, descripción y quién lo registró.

### 9.3 Corte de Caja

1. Al finalizar el día, haga clic en **"Cerrar Caja"**.
2. El sistema muestra: ventas en efectivo, ventas por transferencia, recaudo de préstamos y gastos del día.
3. Cuente el efectivo físico e ingrese el monto contado.
4. El sistema calcula si hay sobrante o faltante.
5. Confirme el cierre. El arqueo queda guardado con fecha, hora y responsable.

---

## 10. Reportes y Análisis

### 10.1 Dashboard Principal

Muestra en tiempo real:
- Ventas del día (total y número de transacciones).
- Cartera total en calle (cuentas por cobrar).
- Productos bajo stock mínimo (alerta).
- Recaudo de préstamos del día.
- Precio internacional del cacao (si aplica a su negocio).

### 10.2 Tipos de Reportes Disponibles

| Reporte | Qué muestra |
|---------|-------------|
| **Resumen de Ventas** | Ventas por período: total, número de facturas, ticket promedio, métodos de pago |
| **Productos Vendidos** | Top de productos: unidades vendidas, ingresos, margen bruto |
| **Rentabilidad** | Margen de ganancia por producto (precio venta - costo) |
| **Clientes Compradores** | Historial de compras por cliente, frecuencia y montos |
| **Cuentas por Cobrar** | Deudores con aging: 0-30, 31-60, 61-90, +90 días |
| **IVA Neto** | IVA generado en ventas vs. IVA descontable en compras |
| **Productividad** | Órdenes de trabajo por operario: cantidad, tiempo, servicios |
| **Inventario / Kardex** | Valor del inventario, rotación, productos bajo mínimo |
| **Estado de Resultados (P&L)** | Ingresos - costos - gastos = utilidad neta del período |

**Filtros disponibles en todos los reportes:** rango de fechas, producto, cliente, categoría, vendedor.

**Exportación:** todos los reportes pueden exportarse a Excel o PDF desde el ícono de descarga.

---

## 11. Préstamos y Cartera

### 11.1 Crear un Préstamo

1. Vaya a **Préstamos** → **"Nuevo Préstamo"**.
2. Seleccione el cliente.
3. Use el simulador: ingrese monto, tasa de interés (%), número de cuotas y periodicidad (diario / semanal / quincenal / mensual).
4. El simulador muestra la cuota calculada y el total a pagar.
5. Configure la tasa de mora (porcentaje mensual que se cobra por cuotas vencidas).
6. Confirme → el sistema genera automáticamente el plan de pagos con fechas exactas.

### 11.2 Ver el Estado de un Préstamo

- En el listado de préstamos, haga clic en cualquier préstamo.
- Verá: cuotas pagadas, cuotas pendientes, mora acumulada, saldo total.
- Los días de mora se calculan y actualizan automáticamente.

### 11.3 Abono a Capital

1. Abra el préstamo → **"Abono a Capital"**.
2. Ingrese el monto que el cliente desea abonar.
3. El sistema descuenta el monto del capital pendiente y redistribuye el saldo entre las cuotas restantes (el valor de las cuotas pendientes baja automáticamente).

### 11.4 Recibo de Pago

- Desde cualquier cuota, haga clic en **"Recibo"**.
- El sistema genera un recibo PDF con: nombre del cliente, monto pagado, fecha, número de cuota, capital + intereses + mora.
- Puede imprimir el recibo o enviarlo por WhatsApp con un clic.

---

## 12. Ruta de Cobro en Campo

Módulo diseñado para que los cobradores gestionen su cartera desde el celular.

### 12.1 Vista del Cobrador

El cobrador (con su usuario de rol "Cobrador") accede al módulo **Ruta de Cobro** y ve:
- La lista de clientes a visitar hoy (cuotas vencidas o con fecha de hoy).
- Ordenadas por zona/sector.
- Estado de cada cuota: pendiente, parcial, vencida.

### 12.2 Registrar un Pago

1. Seleccione la cuota del cliente.
2. Ingrese el monto recibido y el método (Efectivo, Nequi, Transferencia, Tarjeta).
3. Confirme. El sistema actualiza inmediatamente la cuota y el saldo del préstamo.
4. Envíe el recibo al cliente por WhatsApp desde la misma pantalla.

### 12.3 Evidencia de Visita

Si el cliente no está o no puede pagar:
1. Haga clic en **"Registrar Novedad"**.
2. Tome una foto del lugar de visita.
3. El sistema guarda automáticamente la ubicación GPS del cobrador.
4. Ingrese una nota de la novedad.
5. Programe una nueva fecha de visita (solo fechas futuras).

El administrador puede ver desde el sistema todas las evidencias y la ubicación geográfica de cada visita.

---

## 13. Parqueadero

### 13.1 Configuración Inicial

1. Vaya a **Parqueadero → Configuración**.
2. Defina la capacidad total de cupos.
3. Configure las tarifas: por hora, por fracción (ej: primeros 15 minutos), por día y mensualidad.
4. Guarde.

### 13.2 Registrar Entrada de Vehículo

1. Vaya a **Parqueadero → Buscar Placa** o al **Dashboard**.
2. Ingrese la placa del vehículo.
3. Si es cliente nuevo: registre nombre, teléfono y tipo de vehículo.
4. Confirme la entrada. El sistema registra la hora exacta y disminuye el cupo disponible.

### 13.3 Registrar Salida y Cobro

1. Ingrese la placa en **Buscar Placa**.
2. El sistema muestra el tiempo transcurrido y el valor a cobrar según las tarifas configuradas.
3. Seleccione el método de pago (Efectivo, Transferencia, Tarjeta).
4. Confirme. El cupo se libera automáticamente.

### 13.4 Suscripciones Mensuales

1. Vaya a **Parqueadero → Suscripciones** → **"Nueva Suscripción"**.
2. Seleccione el vehículo, fecha de inicio y duración (1 mes, 3 meses, etc.).
3. Registre el pago.
4. El sistema mostrará una alerta roja al escanear la placa si la mensualidad está vencida.
5. Use el botón de WhatsApp para enviar recordatorios de pago automáticamente.

### 13.5 Reportes de Parqueadero

- **Reportes → Ingresos**: total recaudado por período, desglose por tipo (hora/mensualidad).
- **Ocupación**: cuántos cupos disponibles en tiempo real en el dashboard.

---

## 14. Lavadero / Car Wash

### 14.1 Registrar un Servicio de Lavado

1. Vaya a **POS Lavadero**.
2. Ingrese la placa del vehículo y seleccione el tipo (Carro, Moto, Camioneta, Otro).
3. Seleccione los servicios: lavado básico, encerado, tapicería, motor, etc.
4. Asigne el operador que realizará el trabajo.
5. Seleccione el método de pago y confirme.

### 14.2 Reportes de Productividad

- Vaya a **Reporte Lavadero**.
- Filtre por operador y período.
- Vea: número de vehículos atendidos, ingresos generados y servicios realizados por cada trabajador.

---

## 15. Catálogo Virtual

Su tienda en línea, integrada con WhatsApp.

### 15.1 Configurar el Catálogo

1. Vaya a **Catálogo Virtual → Configuración**.
2. Asigne un **slug** único para su tienda (ej: `mi-tienda` → la URL será `sistema.com/catalogo/mi-tienda`).
3. Suba su logo.
4. Ingrese el número de WhatsApp donde llegarán los pedidos.
5. Guarde.

### 15.2 Seleccionar Productos Visibles

1. En el listado de productos, active el switch **"Mostrar en Catálogo"** para cada producto que desee publicar.
2. Los productos sin stock se ocultan automáticamente del catálogo.
3. Los precios y nombres se sincronizan en tiempo real desde el inventario.

### 15.3 Cómo Funciona para sus Clientes

1. El cliente entra a su enlace del catálogo.
2. Explora productos por categoría y filtra por precio.
3. Agrega productos al carrito.
4. Hace clic en **"Pedir por WhatsApp"**.
5. Se abre WhatsApp con el pedido ya estructurado (lista de productos, cantidades y total).
6. El cliente envía el mensaje y usted lo atiende.

---

## 16. Facturación Electrónica DIAN

### 16.1 Configurar la Empresa para Facturación Electrónica

1. Vaya a **Configuración de Empresa** (como Admin).
2. Active el switch **"Facturación Electrónica"**.
3. Ingrese su API Key de Matias API.
4. Si está en período de prueba DIAN, active **"Modo Prueba"**.

### 16.2 Registrar una Resolución DIAN

1. Vaya a **Resoluciones DIAN** → **"Nueva Resolución"**.
2. Complete: número de resolución, prefijo, rango (desde-hasta), fecha de vigencia.
3. El sistema usará esta resolución automáticamente en cada factura.
4. Recibirá una alerta cuando el rango esté próximo a agotarse o la fecha de vencimiento se acerque.

### 16.3 Cómo Funciona la Factura Electrónica

Al crear una venta con facturación electrónica activa:
1. El sistema asigna automáticamente el número de factura consecutivo.
2. Envía el XML a la DIAN a través de Matias API.
3. Recibe y almacena el CUFE (código único de factura electrónica) y el QR.
4. El cliente puede descargar su factura en PDF desde el enlace enviado a su correo.

El estado de cada factura (`Enviado / Aceptado / Rechazado`) es visible en el historial de ventas.

---

## 17. Administración de Usuarios y Roles

### 17.1 Crear un Usuario

1. Vaya a **Administración → Usuarios** → **"Nuevo Usuario"**.
2. Complete: nombre, nombre de usuario, correo, contraseña temporal.
3. Asigne un **Rol**: Admin, Operador, Cobrador.
4. El usuario recibirá acceso solo a los módulos habilitados para su rol.

### 17.2 Crear Roles Personalizados

1. Vaya a **Administración → Roles** → **"Nuevo Rol"**.
2. Asigne un nombre al rol.
3. Seleccione exactamente qué módulos puede ver y usar este rol.
4. Asigne el rol a los usuarios correspondientes.

**Roles predeterminados:**
- **Admin**: acceso completo a todos los módulos.
- **Operador**: solo órdenes de trabajo y panel de productividad.
- **Cobrador**: solo la ruta de cobro de sus cuotas asignadas.

### 17.3 Impersonar una Empresa (Solo SuperAdmin)

El SuperAdmin puede ingresar temporalmente como cualquier empresa para soporte:
1. Vaya a **Gestión de Empresas**.
2. Busque la empresa.
3. Haga clic en **"Ingresar como esta empresa"**.
4. Verá el sistema exactamente como lo ve el cliente, sin afectar sus datos.

---

## 18. Suscripción y Planes

### 18.1 Estado de su Plan

Vaya a **Mi Empresa** para ver:
- Plan actual (Trial / Premium / Vitalicio).
- Fecha de vencimiento.
- Módulos habilitados.

### 18.2 Renovar o Actualizar Plan

1. Haga clic en **"Ver Planes"** o vaya a la pantalla de suscripción expirada.
2. Seleccione el plan deseado.
3. Complete el pago con tarjeta de crédito/débito a través de Wompi (pasarela segura colombiana).
4. La activación es **inmediata y automática** — el sistema detecta el pago vía webhook.

### 18.3 Suscripción Expirada

Si su plan vence, el sistema le redirigirá a la pantalla de renovación. Sus datos están seguros y se mantienen intactos. Solo necesita renovar para volver a acceder.

---

## Consejos de Uso Diario

| Situación | Solución rápida |
|-----------|----------------|
| No encuentro un producto en el POS | Use el escáner de cámara o busque por código de barras |
| Un cliente no aparece | Cree el cliente en el momento desde el POS: botón "+" junto al selector de cliente |
| El stock no cuadra | Revise el Kardex del producto para ver qué movimiento lo afectó |
| Una cuota de préstamo tiene mora inesperada | Revise la tasa de mora del préstamo y los días desde el vencimiento |
| El catálogo no muestra mis productos | Active el switch "Mostrar en Catálogo" en cada producto |
| La factura electrónica fue rechazada | Revise el mensaje del proveedor en el historial de la venta |
| Necesito dar acceso a un empleado | Cree un usuario con el rol apropiado en Administración → Usuarios |

---

**Ksmart360 — Tecnología que trabaja por usted, no al revés.**  
Soporte: [appjeylor.com](https://appjeylor.com)  
*Mayo 2026*
