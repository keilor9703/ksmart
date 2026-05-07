================================================================================
MANUAL DE USUARIO EMPRESARIAL - KSMART360
Sistema: Ecosistema Empresarial Multi-Tenant (ERP, Parqueadero, Préstamos)
Versión: 2026.5.1
================================================================================

¡Bienvenido a Ksmart360! Esta guía exhaustiva le mostrará de forma quirúrgica cada funcionalidad, botón y flujo del sistema para que usted tenga el control absoluto de su negocio.

-- ÍNDICE TEMÁTICO --
1. Conceptos Fundamentales y Multi-Tenant
2. Suscripción SaaS, Periodo de Prueba y Pagos (Wompi)
3. Acceso y Seguridad (Login y Autenticación Biométrica)
4. Módulo de Productos e Inventario (Barcode AI, Lotes y Kardex)
5. Módulo de Ventas y Punto de Venta (POS, Cotizaciones y DIAN)
6. Módulo de Parqueadero de Motos (Control de Cupos y Mensualidades)
7. Módulo de Préstamos y Cobranzas (Simulador y Ruta de Cobro)
8. Módulo de Órdenes de Trabajo y Taller (Evidencias y Productividad)
9. Módulo de Producción (Recetas y Transformación de Materia Prima)
10. Gestión de Clientes, Proveedores y Cuentas por Cobrar (CXC)
11. Módulo de Finanzas (Caja, Gastos y Arqueo Ciego)
12. Reportes, Estadísticas y Auditoría

================================================================================
1. CONCEPTOS FUNDAMENTALES Y MULTI-TENANT
================================================================================
Ksmart360 funciona bajo un modelo de aislamiento total por empresa:
- **Aislamiento Multi-Tenant:** Sus datos (clientes, ventas, inventario) son invisibles para cualquier otra empresa en el sistema.
- **Sincronización Total:** Cada acción tiene una reacción en cadena. Una venta descuenta stock, registra el ingreso en caja, calcula el IVA y actualiza la rentabilidad del producto.
- **Trazabilidad de Usuario:** Cada registro guarda el ID del usuario que lo creó, permitiendo auditorías sobre quién realizó cada movimiento.

================================================================================
2. SUSCRIPCIÓN SAAS, PERIODO DE PRUEBA Y PAGOS (WOMPI)
================================================================================
El sistema se gestiona como un servicio bajo suscripción:
- **Periodo de Prueba (Trial):** Al registrarse, dispone de 14 días gratuitos. Un banner en el dashboard le indicará los días restantes.
- **Bloqueo por Expiración:** Si el plazo vence, el sistema mostrará una pantalla de "Suscripción Expirada", bloqueando todos los módulos operativos.
- **Pasarela Wompi:** Para reactivar, use el botón "Activar mi cuenta".
    - **Métodos Soportados:** Nequi, PSE (Ahorros/Corriente), Tarjeta de Crédito, Botón Bancolombia.
    - **Proceso:** El pago se procesa en una ventana segura. Una vez aprobado, el sistema recibe una señal (Webhook) y habilita sus módulos automáticamente.

================================================================================
3. ACCESO Y SEGURIDAD (LOGIN Y BIOMETRÍA)
================================================================================
**3.1 Inicio de Sesión Convencional**
- Ingrese su Nombre de Usuario y Contraseña definidos en el registro.

**3.2 Autenticación Biométrica (WebAuthn)**
- **Registro de Huella:** Dentro de su perfil, use el botón "Registrar Huella/Rostro". Siga las instrucciones de su sistema operativo (Windows Hello, TouchID, Android Biometrics).
- **Uso:** En la pantalla de login, presione el icono de huella dactilar. El sistema reconocerá su dispositivo y le dará acceso sin pedir contraseña.

================================================================================
4. MÓDULO DE PRODUCTOS E INVENTARIO
================================================================================
**4.1 Crear Productos y Servicios (Campos Obligatorios)**
- **Nombre:** Identificación clara del ítem.
- **Código de Barras:** Escanee con pistola o cámara.
- **Descripción:** Detalles adicionales, marca o especificaciones.
- **Precio de Venta:** Valor final al público.
- **Costo:** Valor de adquisición (sirve para calcular utilidad).
- **Es Servicio:** Active este check para ítems intangibles (ej: "Mano de Obra") para que no resten stock.
- **Unidad de Medida:** Selección entre UND, Kg, Lts, Mts, Gr.
- **Stock Actual:** Cantidad física en bodega.
- **Stock Mínimo:** Cantidad para disparar alertas de reabastecimiento.
- **Grupo de Ítem:** Materia Prima, Producto Terminado, Activo Fijo o Insumo.

**4.2 Registro Ágil con Inteligencia de Barcode**
Si escanea un código desconocido, el sistema consulta en cascada APIs globales (Open Food Facts, UPCitemdb). Si lo encuentra, autocompleta Nombre y Descripción para que usted solo asigne el precio.

**4.3 Gestión de Lotes y Vencimientos**
Para productos perecederos (Alimentos, Medicamentos):
- Registre el **Número de Lote** y la **Fecha de Vencimiento**.
- El sistema prioriza la salida de los lotes más próximos a vencer (LIFO/FIFO según configuración).

**4.4 Carga Masiva (Excel)**
1. Botón "Descargar Plantilla": Obtendrá un archivo con las columnas exactas.
2. Llene los datos respetando las validaciones.
3. Botón "Subir Excel": El sistema procesa la carga y reporta si hubo errores en filas específicas.

**4.5 Kardex y Movimientos Manuales**
- **Entrada:** Registra llegada de mercancía.
- **Salida:** Registra bajas por daño, pérdida o consumo interno.
- **Ajuste:** Fuerza el inventario a un número específico tras un conteo físico.
- **Consulta:** Filtre por fecha y producto para ver quién movió qué y por qué motivo.

================================================================================
5. MÓDULO DE VENTAS Y PUNTO DE VENTA (POS)
================================================================================
**5.1 Punto de Venta (POS)**
- **Búsqueda:** Escriba el nombre o escanee el código.
- **Carrito:** Ajuste cantidades con botones +/-, elimine con el icono de papelera.
- **Descuentos:** Aplique descuentos individuales o un % global a la factura.
- **IVA:** El sistema calcula automáticamente el impuesto según el porcentaje del producto.
- **Cliente:** Busque por cédula o nombre. Si no existe, use el botón "+" para crearlo sin salir de la venta.
- **Cierre de Venta:** 
    - Botón "Pagar": Abre el diálogo de medios de pago.
    - Soporte para: Efectivo, Transferencia (Nequi/Daviplata), Tarjeta, Crédito.

**5.2 Cotizaciones**
- Genere documentos para clientes sin afectar inventario.
- **Convertir a Venta:** En el listado de cotizaciones, use el botón "Facturar" para cargar todo al POS de inmediato.

**5.3 Devoluciones y Notas Crédito**
1. Ubique la factura en el historial.
2. Presione "Devolver". Seleccione las cantidades a retornar.
3. El sistema reintegra el stock y genera el movimiento contable de devolución de dinero o saldo a favor.

**5.4 Resoluciones DIAN**
Gestione sus prefijos y rangos de facturación legal (Prefijo, Número Inicial, Número Final, Fecha de Vigencia). El sistema bloqueará la facturación si llega al número final o si la fecha expira.

================================================================================
6. MÓDULO DE PARQUEADERO DE MOTOS
================================================================================
**6.1 Panel de Control (Dashboard)**
- Visualice el **Cupo Disponible** en tiempo real.
- Barra de **Ocupación** porcentual.
- KPIs de Ingresos del día y Mes.

**6.2 Registro de Vehículos**
- Campos: Placa (Única), Marca, Modelo, Color, Foto del Vehículo, Observaciones y Propietario.

**6.3 Control de Accesos (Por Horas/Minutos)**
- **Entrada:** Digite la placa. Si es cliente ocasional, el sistema pide Nombre y Teléfono. Imprime o envía comprobante por WhatsApp.
- **Salida:** El sistema calcula el tiempo exacto.
    - **Tarifa Mínima:** Si está configurada (ej. 30 min), cobrará el mínimo si sale antes.
    - **Tarifa por Fracción:** Calcula el valor exacto por minuto u hora.

**6.4 Mensualidades y Suscripciones**
- Tipos: Mensual, Quincenal, Diario.
- **Estado de Pago:** Pendiente, Parcial (Abono) o Pagado.
- **Vencimientos:** El dashboard alerta sobre mensualidades vencidas o por vencer en los próximos 5 días.

**6.5 WhatsApp y Cobros**
- Botones de WhatsApp integrados para:
    - Enviar Recordatorio de Vencimiento.
    - Enviar Recibo de Pago.
    - Enviar Link de Pago o QR de Nequi/Daviplata.
- **Plantillas:** Edite los mensajes predefinidos en `Configuración -> WhatsApp`.

================================================================================
7. MÓDULO DE PRÉSTAMOS Y COBRANZAS
================================================================================
**7.1 Creación de Préstamos**
- **Simulador:** Ingrese Monto, Tasa de Interés (%) y Cantidad de Cuotas.
- **Modalidades:** Diario, Semanal, Quincenal, Mensual.
- **Generación:** Crea automáticamente el plan de amortización con fechas exactas.

**7.2 Ruta de Cobro (Cobrador)**
- Pantalla optimizada para móviles.
- Lista de clientes pendientes por cobrar hoy.
- Botones para:
    - **Registrar Pago:** Abono a la cuota.
    - **Reprogramar:** Cambiar fecha de visita.
    - **WhatsApp:** Notificar al cliente.

**7.3 Liquidación y Mora**
- **Mora Automática:** Si una cuota vence, el sistema suma el recargo diario según la tasa de mora.
- **Liquidación Diaria:** Reporte de cuánto recaudó cada cobrador para el cierre de día del Admin.

================================================================================
8. MÓDULO DE ÓRDENES DE TRABAJO Y TALLER
================================================================================
**8.1 Flujo de la Orden**
1. **Creación:** Registro de datos del cliente, equipo/vehículo y falla reportada.
2. **Asignación:** Se asigna un Operador responsable.
3. **Evidencias:** El operario sube fotos del estado inicial y final desde la app.
4. **Cierre:** Se agregan repuestos y mano de obra.
5. **Facturación:** Al aprobarse, se genera la venta en el POS automáticamente.

**8.2 Productividad del Operario**
- Cálculo de comisiones o pago por servicio basado en las órdenes cerradas y aprobadas.

================================================================================
9. MÓDULO DE PRODUCCIÓN
================================================================================
**9.1 Recetas (BOM)**
- Defina qué insumos y en qué cantidades se necesitan para fabricar un producto (ej: para 1 torta: 500g harina, 3 huevos).
- Incluya servicios externos o mano de obra en el costo de la receta.

**9.2 Lotes de Producción**
- Inicie un lote indicando la cantidad a fabricar.
- El sistema reserva los insumos.
- Al "Confirmar Lote", se restan los insumos del inventario y se carga el producto terminado automáticamente.

================================================================================
10. GESTIÓN DE CLIENTES Y PROVEEDORES
================================================================================
- **Historial Financiero:** Vea cada factura, abono y deuda pendiente por tercero.
- **Cupo de Crédito:** Límite máximo de deuda permitido por cliente.
- **Cuentas por Cobrar (CXC):** Listado consolidado de facturas vencidas con días de atraso.

================================================================================
11. MÓDULO DE FINANZAS (CAJA Y GASTOS)
================================================================================
**11.1 Control de Caja**
- **Apertura:** Registro de base de efectivo.
- **Ventas y Gastos:** El sistema suma y resta automáticamente.
- **Arqueo Ciego:** El cajero debe contar y digitar el dinero físico. Solo el Admin ve si hay descuadre.

**11.2 Gastos**
- Registro de egresos con soporte de tercero y categoría (Nómina, Arriendo, Servicios, etc.).

================================================================================
12. REPORTES Y ESTADÍSTICAS
================================================================================
- **Dashboard Gerencial:** Gráficas de ventas de los últimos 30 días.
- **Reporte de IVA:** Detalle de impuestos generados por periodo.
- **Rentabilidad:** Informe de productos más vendidos y margen de utilidad real.
- **Auditoría:** Registro de movimientos de inventario y acciones de usuarios.
