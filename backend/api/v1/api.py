from fastapi import APIRouter
from .endpoints import (
    auth, superadmin, users, clientes, productos,
    inventario, ventas, pagos, reportes, caja,
    devoluciones, notificaciones, wompi, prestamos,
    resoluciones, cotizaciones, parqueadero, mercado,
    biometric, webhooks,
    compras, produccion, ordenes_trabajo, panel_operador, planes, saas,
    grupos_producto, lavadero, catalogo, pedidos_virtuales, impuestos,
    suscripcion, restaurante, puntos, empresa_config, setup, contabilidad,
    facturacion_electronica, agendamiento, promociones, marketplace, taller,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(saas.router, prefix="/saas", tags=["SaaS Core"])
api_router.include_router(superadmin.router, prefix="/superadmin", tags=["superadmin"])
api_router.include_router(planes.router, prefix="", tags=["planes"])
api_router.include_router(users.router, prefix="", tags=["users"])
api_router.include_router(clientes.router, prefix="/clientes", tags=["clientes"])
api_router.include_router(productos.router, prefix="/productos", tags=["productos"])
api_router.include_router(grupos_producto.router, prefix="/grupos-producto", tags=["grupos-producto"])
api_router.include_router(inventario.router, prefix="/inventario", tags=["inventario"])
api_router.include_router(ventas.router, prefix="/ventas", tags=["ventas"])
api_router.include_router(pagos.router, prefix="/pagos", tags=["pagos"])
api_router.include_router(reportes.router, prefix="/reportes", tags=["reportes"])
api_router.include_router(caja.router, prefix="/caja", tags=["caja"])
api_router.include_router(devoluciones.router, prefix="/devoluciones", tags=["devoluciones"])
api_router.include_router(notificaciones.router, prefix="/notificaciones", tags=["notificaciones"])
api_router.include_router(wompi.router, prefix="/wompi", tags=["wompi"])
api_router.include_router(promociones.router, prefix="/promociones", tags=["promociones"])
api_router.include_router(prestamos.router, prefix="/prestamos", tags=["prestamos"])
api_router.include_router(resoluciones.router, prefix="/resoluciones", tags=["resoluciones"])
api_router.include_router(cotizaciones.router, prefix="/cotizaciones", tags=["cotizaciones"])
api_router.include_router(parqueadero.router, prefix="/parqueadero", tags=["parqueadero"])
api_router.include_router(parqueadero.cron_router, prefix="/cron/parqueadero", tags=["cron"])
api_router.include_router(mercado.router, prefix="/mercado", tags=["mercado"])
api_router.include_router(biometric.router, prefix="/auth/biometric", tags=["biometric"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(compras.router, prefix="/compras", tags=["compras"])
api_router.include_router(produccion.router, prefix="/produccion", tags=["produccion"])
api_router.include_router(ordenes_trabajo.router, prefix="/ordenes-trabajo", tags=["ordenes-trabajo"])
api_router.include_router(panel_operador.router, prefix="/panel_operador", tags=["panel_operador"])
api_router.include_router(lavadero.router, prefix="/lavadero", tags=["lavadero"])
api_router.include_router(catalogo.router, prefix="/catalogo", tags=["catalogo"])
api_router.include_router(marketplace.router, prefix="/marketplace", tags=["marketplace"])
api_router.include_router(pedidos_virtuales.router, prefix="/pedidos-virtuales", tags=["pedidos-virtuales"])
api_router.include_router(impuestos.router, prefix="/impuestos", tags=["impuestos"])
api_router.include_router(suscripcion.router, prefix="/suscripcion", tags=["suscripcion"])
api_router.include_router(restaurante.router, prefix="/restaurante", tags=["restaurante"])
api_router.include_router(puntos.router, prefix="/clientes", tags=["puntos-fidelizacion"])
api_router.include_router(empresa_config.router, prefix="", tags=["empresa-config"])
api_router.include_router(setup.router, prefix="/setup", tags=["setup"])

api_router.include_router(contabilidad.router, prefix="/contabilidad", tags=["contabilidad"])

api_router.include_router(facturacion_electronica.router, prefix="/fe", tags=["facturacion-electronica"])
api_router.include_router(facturacion_electronica.webhooks_router, prefix="/webhooks", tags=["webhooks-fe"])

api_router.include_router(agendamiento.router, prefix="/agendamiento", tags=["agendamiento"])
api_router.include_router(taller.router, prefix="/taller", tags=["taller"])
