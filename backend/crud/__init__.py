# Re-exporta todo el paquete crud para mantener compatibilidad con `import crud`
# en los endpoints existentes. Ningún endpoint necesita cambiar.

from crud.common import (
    pwd_context, COL_TZ, BOGOTA_TZ, UTC_TZ,
    _is_postgres, get_utc_boundaries, verify_password, get_password_hash,
)

from crud.modulos_roles import (
    get_modulo, get_modulo_by_name, get_modulo_by_frontend_path,
    get_modulos, create_modulo, update_modulo, delete_modulo,
    get_role, get_role_by_name, get_roles, create_role,
    add_modules_to_role, remove_modules_from_role, set_modules_for_role,
)

from crud.usuarios import (
    get_user, get_user_by_username, get_users,
    create_user, update_user, delete_user, toggle_user_status,
)

from crud.clientes import (
    get_cliente, get_cliente_deuda, get_clientes,
    create_cliente, update_cliente, delete_cliente, get_cliente_history,
)

from crud.productos import (
    get_producto, get_productos, create_producto, update_producto, delete_producto,
)

from crud.ventas import (
    get_ventas, get_venta, create_venta, update_venta, delete_venta,
    _get_resolucion_activa, _asignar_numero_factura, _ejecutar_movimientos_venta,
)

from crud.inventario import (
    create_movement, list_movements, get_low_stock, update_producto_stock_minimo,
    get_kardex_promedio_ponderado, get_inventario_actual, get_rotacion_productos,
)

from crud.pagos import (
    create_pago, get_pago, update_pago,
)

from crud.reportes import (
    get_ventas_summary, get_cuentas_por_cobrar_por_cliente, get_productos_vendidos,
    get_clientes_compradores, get_clientes_deudores, get_rentabilidad_por_producto,
    get_sales_by_day, get_total_sales_today, get_dashboard_data,
)

from crud.ordenes_trabajo import (
    get_orden_trabajo, get_ordenes_trabajo, create_orden_trabajo, update_orden_trabajo,
    update_orden_trabajo_estado, add_evidencia_orden_trabajo,
    aprobar_orden_trabajo, rechazar_orden_trabajo, cerrar_orden_trabajo,
    get_total_ordenes_trabajo, get_ordenes_pendientes_operador,
    get_productividad_operador, get_historial_reciente_operador, get_reporte_productividad,
)

from crud.produccion import (
    get_recetas, get_receta, get_receta_by_producto, create_receta, update_receta, delete_receta,
    get_lotes, get_lote, create_lote,
    get_or_create_cliente_interno, confirmar_lote_produccion, cancelar_lote,
)

from crud.validaciones import (
    check_can_delete_cliente, check_can_delete_producto,
    check_can_delete_venta, check_can_delete_receta,
)

from crud.devoluciones import (
    crear_devolucion, get_devoluciones_by_venta, revertir_movimientos_venta,
)

from crud.compras import (
    get_compras, get_compra, create_compra, create_pago_compra,
)

from crud.caja import (
    calcular_totales_dia, crear_corte_caja, get_cortes_caja, crear_gasto, get_gastos,
)

from crud.bulk_operations import (
    bulk_create_productos, bulk_create_clientes, bulk_create_movimientos,
)

from crud.empresas import (
    get_empresas, toggle_empresa_status,
    create_empresa_with_admin, update_empresa_plan,
    log_saas_event,
)

from crud.notificaciones import (
    create_notificacion, get_notificaciones_usuario,
    marcar_notificacion_leida, check_and_notify_low_stock,
)

from crud.planes import (
    get_planes, create_plan, update_plan,
)

from crud.prestamos import (
    crear_prestamo, get_calendario_cobros, get_reporte_financiero_prestamos,
    get_resumen_calendario_cobros, calcular_mora_cuota, aplicar_abono_capital,
)

from crud.perecederos import (
    crear_lote_existencia, get_lotes_producto, get_todos_los_lotes, ajustar_lote,
    get_lotes_fefo, consumir_stock_fefo, sugerencia_fefo,
    get_alertas_vencimiento, get_resumen_alertas, notificar_vencimientos_proximos,
    _enriquecer_lote,
)
get_resumen_alertas_vencimiento = get_resumen_alertas  # alias para compatibilidad

from crud.facturacion_dian import (
    get_resoluciones, create_resolucion, update_resolucion,
    activar_resolucion, delete_resolucion,
)

from crud.cotizaciones import (
    get_cotizaciones, create_cotizacion, get_cotizacion,
    convertir_cotizacion_a_venta, delete_cotizacion,
)

# Parqueadero — config y helpers
from crud.parqueadero.config import (
    get_or_create_parq_config, update_parq_config,
    _calcular_fecha_vencimiento, _obtener_tarifa_por_tipo,
    _actualizar_estado_pago, _enriquecer_suscripcion, _enriquecer_vehiculo,
)

# Parqueadero — vehículos
from crud.parqueadero.vehiculos import (
    get_vehiculo, get_vehiculo_por_placa, list_vehiculos,
    create_vehiculo, update_vehiculo, delete_vehiculo, dar_baja_vehiculo,
)

# Parqueadero — suscripciones
from crud.parqueadero.suscripciones import (
    get_suscripcion_activa, list_suscripciones_vehiculo, list_todas_suscripciones,
    create_suscripcion, create_suscripcion_retroactiva,
    cancelar_suscripcion, registrar_pago_suscripcion,
)

# Parqueadero — acceso por horas
from crud.parqueadero.horas import (
    registrar_entrada_horas, registrar_salida_horas,
)

# Parqueadero — reportes y búsqueda
from crud.parqueadero.reportes import (
    buscar_por_placa, get_baja_info, get_dashboard_parqueadero,
    reporte_ingresos_parqueadero, notificar_vencimientos_parqueadero,
)

# Parqueadero — métodos de pago
from crud.parqueadero.metodos_pago import (
    listar_metodos_pago, get_metodo_por_modalidad,
    upsert_metodo_pago, delete_metodo_pago,
    _normalizar_telefono_whatsapp, _formato_moneda_co, _formato_fecha_es,
)

# Parqueadero — WhatsApp
from crud.parqueadero.whatsapp import (
    get_plantilla, listar_plantillas, update_plantilla,
    restaurar_plantilla_default, generar_link_whatsapp, listar_envios_whatsapp,
)

# Biometría WebAuthn
from crud.biometria import (
    biometric_register_options, biometric_register_verify,
    biometric_login_options, biometric_login_verify,
    listar_credenciales_usuario, eliminar_credencial,
)
