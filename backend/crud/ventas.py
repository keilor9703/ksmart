from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, timezone, date
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ, get_utc_boundaries
from crud.clientes import get_cliente
from crud.productos import get_producto
from services.contabilidad import registrar_asiento_venta

# ═══════════════════════════════════════════════════════════════════════════════
# VENTAS
# ═══════════════════════════════════════════════════════════════════════════════

def get_ventas(
    db: Session,
    empresa_id: int,
    skip: int = 0,
    limit: int = 25,
    search: str = "",
    fecha_inicio=None,
    fecha_fin=None,
    estado_pago: str = "",
):
    from sqlalchemy import cast, String, or_
    q = (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.cliente),
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
            joinedload(models.Venta.pagos),
        )
        .filter(models.Venta.empresa_id == empresa_id, models.Venta.tipo == "venta")
    )
    def _build_search_filter(search_str):
        import re
        term = f"%{search_str}%"
        conditions = [
            models.Cliente.nombre.ilike(term),
            models.Venta.numero_factura.ilike(term),
            cast(models.Venta.id, String).ilike(term),
            models.DetalleVenta.nombre_libre.ilike(term),
            models.Producto.nombre.ilike(term),
        ]
        # Support V0141 / V-0141 formats: extract numeric part and match by ID
        m = re.match(r'^[Vv]-?0*(\d+)$', search_str.strip())
        if m:
            try:
                conditions.append(models.Venta.id == int(m.group(1)))
            except ValueError:
                pass
        return or_(*conditions)

    if search:
        q = (
            q.outerjoin(models.Venta.cliente)
             .outerjoin(models.Venta.detalles)
             .outerjoin(models.DetalleVenta.producto)
             .filter(_build_search_filter(search))
        ).distinct()
    if estado_pago:
        q = q.filter(models.Venta.estado_pago == estado_pago)
    if fecha_inicio:
        q = q.filter(models.Venta.fecha >= fecha_inicio)
    if fecha_fin:
        q = q.filter(models.Venta.fecha <= fecha_fin)

    total = q.count()
    items = q.order_by(models.Venta.fecha.desc()).offset(skip).limit(limit).all()

    # Aggregate stats for the filtered set (before pagination)
    from sqlalchemy import func as sqlfunc
    agg = db.query(
        sqlfunc.coalesce(sqlfunc.sum(models.Venta.total), 0).label("sum_total"),
        sqlfunc.coalesce(sqlfunc.sum(models.Venta.monto_pagado), 0).label("sum_pagado"),
    ).filter(models.Venta.empresa_id == empresa_id, models.Venta.tipo == "venta")
    if search:
        agg = (
            agg.outerjoin(models.Venta.cliente)
               .outerjoin(models.Venta.detalles)
               .outerjoin(models.DetalleVenta.producto)
               .filter(_build_search_filter(search))
               .distinct()
        )
    if estado_pago:
        agg = agg.filter(models.Venta.estado_pago == estado_pago)
    if fecha_inicio:
        agg = agg.filter(models.Venta.fecha >= fecha_inicio)
    if fecha_fin:
        agg = agg.filter(models.Venta.fecha <= fecha_fin)
    agg_result = agg.one()

    stats = {
        "sum_total":    float(agg_result.sum_total),
        "sum_pagado":   float(agg_result.sum_pagado),
        "sum_pendiente": float(agg_result.sum_total) - float(agg_result.sum_pagado),
    }
    return total, items, stats

def get_venta(db: Session, empresa_id: int, venta_id: int):
    return (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.cliente),
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto),
            joinedload(models.Venta.pagos),
        )
        .filter(
            models.Venta.id == venta_id,
            models.Venta.empresa_id == empresa_id
        )
        .first()
    )

def create_venta(db: Session, empresa_id: int, venta: schemas.VentaCreate, commit: bool = True):
    if venta.cliente_id is not None:
        cliente = get_cliente(db, empresa_id, venta.cliente_id)
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente no encontrado o no pertenece a esta empresa")

    total_bruto = 0.0
    detalles_objs = []

    for d in venta.detalles:
        if d.producto_id is None:
            # Ítem libre — no product, no stock, no inventory
            precio = d.precio_unitario or 0.0
            subtotal = precio * (d.cantidad or 1)
            total_bruto += subtotal
            detalle = models.DetalleVenta(
                producto_id=None,
                nombre_libre=getattr(d, 'nombre_libre', None) or 'Ítem libre',
                cantidad=d.cantidad or 1,
                precio_unitario=precio,
                descuento_pct=getattr(d, 'descuento_pct', 0.0),
                iva_porcentaje=getattr(d, 'iva_porcentaje', 0.0),
            )
            detalles_objs.append(detalle)
            continue

        prod = get_producto(db, empresa_id, d.producto_id)
        if not prod:
            raise HTTPException(
                status_code=404,
                detail=f"Producto {d.producto_id} no encontrado o no pertenece a esta empresa"
            )

        # Resolver variante si viene variante_id
        variante_id     = getattr(d, 'variante_id', None)
        nombre_variante = getattr(d, 'nombre_variante', None)
        variante_obj    = None
        if variante_id:
            variante_obj = db.query(models.ProductoVariante).filter(
                models.ProductoVariante.id == variante_id,
                models.ProductoVariante.producto_id == d.producto_id,
            ).first()
            if not variante_obj:
                raise HTTPException(status_code=404, detail=f"Variante {variante_id} no encontrada")

        # Precio: variante > payload > producto padre
        if d.precio_unitario is not None:
            precio = d.precio_unitario
        elif variante_obj and variante_obj.precio is not None:
            precio = variante_obj.precio
        else:
            precio = prod.precio

        subtotal = precio * d.cantidad
        total_bruto += subtotal

        detalle = models.DetalleVenta(
            producto_id=d.producto_id,
            variante_id=variante_id,
            nombre_variante=nombre_variante or (variante_obj.nombre if variante_obj else None),
            cantidad=d.cantidad,
            precio_unitario=precio,
            descuento_pct=getattr(d, 'descuento_pct', 0.0),
            iva_porcentaje=getattr(d, 'iva_porcentaje', 0.0),
        )
        # Asociar la relación producto explícitamente para que la FE (Matias)
        # tenga el nombre y código disponibles sin depender de lazy-load.
        detalle.producto = prod
        detalles_objs.append(detalle)

    iva_porc = float(getattr(venta, 'iva_porcentaje', 0) or 0)
    # IVA incluido: el precio ya contiene el IVA; se extrae por retrocálculo
    iva_total = total_bruto * iva_porc / (100 + iva_porc) if iva_porc > 0 else 0.0
    descuento_puntos = float(getattr(venta, 'descuento_puntos', 0) or 0)
    total_final = max(0.0, total_bruto - descuento_puntos)

    # Usamos timezone explícito para Postgres
    ahora_utc = datetime.now(timezone.utc)

    db_venta = models.Venta(
        cliente_id=venta.cliente_id,
        total=total_final,
        iva_total=iva_total,
        iva_porcentaje=iva_porc,
        monto_pagado=total_final if venta.pagada else 0,
        estado_pago="pagado" if venta.pagada else "pendiente",
        metodo_pago=venta.metodo_pago if venta.pagada else None,
        empresa_id=empresa_id,
        fecha=ahora_utc,  # Forzado explicito para no depender del default base
        solicita_fe=getattr(venta, 'solicita_fe', False),
    )
    db.add(db_venta)
    db.flush()

    for det in detalles_objs:
        det.venta_id = db_venta.id
        db.add(det)

    # Fase 2A+2C: Numeración DIAN + emisión del documento electrónico.
    # emitir_fe_venta decide automáticamente entre Factura Electrónica (cliente la
    # pide o venta ≥ 5 UVT) y Documento Equivalente POS (DEE) para el resto, asigna
    # el número de la resolución del tipo correcto y emite a Matías. Nunca lanza.
    if getattr(venta, 'tipo', 'venta') == 'venta':
        cliente_fe = None
        if db_venta.cliente_id:
            cliente_fe = db.query(models.Cliente).filter(
                models.Cliente.id         == db_venta.cliente_id,
                models.Cliente.empresa_id == empresa_id,
            ).first()
        emitir_fe_venta(db, empresa_id, db_venta, detalles_objs, cliente_fe)

    # Fase 2B: campos extra
    db_venta.tipo           = getattr(venta, 'tipo', 'venta')
    db_venta.valida_hasta   = getattr(venta, 'valida_hasta', None)
    db_venta.observaciones  = getattr(venta, 'observaciones', None)
    db_venta.operador_id    = getattr(venta, 'operador_id', None)
    db_venta.placa_vehiculo = getattr(venta, 'placa_vehiculo', None)




    if commit:
        db.commit()
        db.refresh(db_venta)
        if db_venta.estado_pago == "pagado":
            registrar_asiento_venta(db, db_venta)
            db.commit()
    return db_venta

def update_venta(db: Session, empresa_id: int, venta_id: int, venta: schemas.VentaCreate):
    db_venta = db.query(models.Venta).filter(
        models.Venta.id == venta_id,
        models.Venta.empresa_id == empresa_id
    ).first()
    if not db_venta:
        return None

    if venta.cliente_id is not None:
        db_venta.cliente_id = venta.cliente_id

    db.query(models.DetalleVenta).filter(models.DetalleVenta.venta_id == venta_id).delete()
    db.flush()

    total_venta = 0.0
    new_detalles = []
    for detalle_data in venta.detalles:
        producto = get_producto(db, empresa_id, detalle_data.producto_id)
        if not producto:
            raise HTTPException(
                status_code=404,
                detail=f"Producto {detalle_data.producto_id} no encontrado"
            )

        precio_unitario = detalle_data.precio_unitario if detalle_data.precio_unitario is not None else producto.precio
        detalle_total = precio_unitario * detalle_data.cantidad
        total_venta += detalle_total

        db_detalle = models.DetalleVenta(
            venta_id=venta_id,
            producto_id=detalle_data.producto_id,
            cantidad=detalle_data.cantidad,
            precio_unitario=precio_unitario
        )
        new_detalles.append(db_detalle)

    db.add_all(new_detalles)

    iva_porc = float(getattr(venta, 'iva_porcentaje', 0) or db_venta.iva_porcentaje or 0)
    # IVA incluido
    iva_total = total_venta * iva_porc / (100 + iva_porc) if iva_porc > 0 else 0.0
    total_final = total_venta

    db_venta.total = total_final
    db_venta.iva_total = iva_total
    db_venta.iva_porcentaje = iva_porc
    db_venta.monto_pagado = total_final if venta.pagada else 0.0
    db_venta.estado_pago = "pagado" if venta.pagada else "pendiente"

    db.commit()
    db.refresh(db_venta)
    return db_venta

def delete_venta(db: Session, empresa_id: int, venta_id: int):
    db_venta = db.query(models.Venta).filter(
        models.Venta.id == venta_id,
        models.Venta.empresa_id == empresa_id
    ).first()
    if not db_venta:
        return None

    # Nullear FK opcionales que apuntan a ventas.id sin ON DELETE SET NULL
    # para evitar FK constraint errors en PostgreSQL y SQLite con FK activadas.
    db.query(models.MovimientoPuntos).filter(
        models.MovimientoPuntos.venta_id == venta_id
    ).update({"venta_id": None}, synchronize_session=False)

    # ordenes de producción vinculadas
    try:
        from models import OrdenProduccion
        db.query(OrdenProduccion).filter(
            OrdenProduccion.venta_id == venta_id
        ).update({"venta_id": None}, synchronize_session=False)
    except Exception:
        pass

    # pedidos del catálogo virtual vinculados
    try:
        from models import PedidoVirtual
        db.query(PedidoVirtual).filter(
            PedidoVirtual.venta_id == venta_id
        ).update({"venta_id": None}, synchronize_session=False)
    except Exception:
        pass

    # comandas de restaurante/lavadero vinculadas
    try:
        from models import Comanda
        db.query(Comanda).filter(
            Comanda.venta_id == venta_id
        ).update({"venta_id": None}, synchronize_session=False)
    except Exception:
        pass

    try:
        from models import LavaderoOrden
        db.query(LavaderoOrden).filter(
            LavaderoOrden.venta_id == venta_id
        ).update({"venta_id": None}, synchronize_session=False)
    except Exception:
        pass

    # asientos contables vinculados
    try:
        from models import AsientoContable
        db.query(AsientoContable).filter(
            AsientoContable.venta_id == venta_id
        ).update({"venta_id": None}, synchronize_session=False)
    except Exception:
        pass

    db.delete(db_venta)
    db.commit()
    return db_venta


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS DE VENTAS (copiados desde líneas ~3916-3987 de crud.py)
# ═══════════════════════════════════════════════════════════════════════════════

# ─── Valor UVT (actualizar cada año — lo fija la DIAN) ─────────────────────────
# UVT 2026. La normativa exige Factura Electrónica individual (no documento
# equivalente) cuando una venta es igual o superior a 5 UVT, aunque el cliente no
# la solicite. Override por env para no tener que redeplegar al cambiar de año.
import os as _os
UVT_VALOR     = float(_os.getenv("UVT_VALOR", "52206"))   # COP por UVT (2026 ≈ 52.206)
UMBRAL_5_UVT  = 5 * UVT_VALOR


def _get_resolucion_activa(db: Session, empresa_id: int, tipo: str = "fe") -> Optional[models.ResolucionDian]:
    """
    Retorna la resolución activa de la empresa para el tipo indicado, si existe.
      tipo="fe"  → Factura Electrónica
      tipo="pos" → Documento Equivalente Electrónico / Tiquete POS
    Tolera registros antiguos sin columna 'tipo' (se asumen 'fe').
    """
    q = db.query(models.ResolucionDian).filter(
        models.ResolucionDian.empresa_id == empresa_id,
        models.ResolucionDian.is_active  == True,
    )
    if tipo == "fe":
        # 'fe' o NULL/'' (resoluciones creadas antes de la columna tipo)
        from sqlalchemy import or_
        q = q.filter(or_(
            models.ResolucionDian.tipo == "fe",
            models.ResolucionDian.tipo.is_(None),
            models.ResolucionDian.tipo == "",
        ))
    else:
        q = q.filter(models.ResolucionDian.tipo == tipo)
    return q.first()


def _asignar_numero_factura(db: Session, empresa_id: int, venta: models.Venta, tipo: str = "fe") -> Optional[str]:
    """
    Incrementa el consecutivo de la resolución activa (del tipo indicado) y asigna
    el numero_factura a la venta. Retorna el número asignado o None si no hay
    resolución activa de ese tipo. Llama ANTES de hacer db.commit().
    """
    resolucion = _get_resolucion_activa(db, empresa_id, tipo)
    if not resolucion:
        return None

    siguiente = resolucion.numero_actual + 1

    # Validación de rango
    if siguiente > resolucion.numero_final:
        raise HTTPException(
            status_code=400,
            detail=(
                f"La resolución DIAN ha llegado al límite de numeración "
                f"({resolucion.numero_final}). Configura una nueva resolución."
            )
        )

    resolucion.numero_actual = siguiente
    numero_str = f"{resolucion.prefijo}{siguiente}"
    venta.numero_factura = numero_str
    venta.resolucion_id  = resolucion.id

    # 👇 NUEVO: Marcar como pendiente si la empresa tiene FE activa
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if empresa and empresa.facturacion_electronica_activa:
        venta.estado_electronico = "pendiente"

    db.add(resolucion)
    return numero_str


class _DetalleSintetico:
    """
    Detalle 'en memoria' para emitir FE de servicios sin DetalleVenta persistido
    (parqueadero por horas, suscripciones, cierres consolidados).
    Expone exactamente los atributos que build_invoice_payload() consume.
    """
    def __init__(self, descripcion: str, monto: float, cantidad: float = 1):
        self.producto        = None
        self.nombre_libre    = descripcion
        self.nombre_variante = None
        self.cantidad        = cantidad
        self.precio_unitario = monto
        self.descuento_pct   = 0
        self.iva_porcentaje  = 0


def plan_incluye_fe(db: Session, empresa_id: int) -> bool:
    """
    Validación EN VIVO de si el plan vigente de la empresa incluye FE.

    Complementa al flag empresa.facturacion_electronica_activa (que se fija al
    activar FE o al pagar un plan). Esto cierra los bordes en que el flag no se
    recalcula solo: plan vencido sin renovar, o cambio retroactivo de incluye_fe
    en el plan. Si no hay pago/plan registrado (trial, vitalicio, cortesía), se
    permite por defecto — el flag sigue siendo el control principal.
    """
    ultimo_pago = (
        db.query(models.RegistroPago)
        .filter(models.RegistroPago.empresa_id == empresa_id)
        .order_by(models.RegistroPago.fecha_pago.desc())
        .first()
    )
    if not ultimo_pago or not ultimo_pago.plan:
        return True  # sin plan de pago registrado → no bloqueamos por esta vía
    incluye = getattr(ultimo_pago.plan, "incluye_fe", True)
    return True if incluye is None else bool(incluye)


def _tipo_documento_dian(venta: models.Venta) -> str:
    """
    Decide qué documento electrónico corresponde a una venta:
      - "fe":  Factura Electrónica — cuando el cliente la solicita (solicita_fe)
               o cuando la venta es ≥ 5 UVT (obligatorio por normativa DIAN).
      - "pos": Documento Equivalente Electrónico / Tiquete POS — el resto de las
               ventas (consumidor final que no pide factura).
    """
    if getattr(venta, "solicita_fe", False):
        return "fe"
    if float(getattr(venta, "total", 0) or 0) >= UMBRAL_5_UVT:
        return "fe"
    return "pos"


def emitir_fe_venta(
    db: Session,
    empresa_id: int,
    venta: models.Venta,
    detalles: list,
    cliente=None,
) -> Optional[dict]:
    """
    Emisión canónica del documento electrónico DIAN para una Venta ya creada
    (usada por restaurante, lavadero y parqueadero). Decide automáticamente entre
    Factura Electrónica (cliente la pide o venta ≥ 5 UVT) y Documento Equivalente
    POS (DEE) para el resto. Asigna número DIAN del tipo correcto si falta, emite
    vía Matías, actualiza estado_electronico/cufe/pdf_url/xml_url/mensaje_proveedor
    y registra el IntentoFE de auditoría.

    Retorna el dict de resultado de Matías, o None si la empresa no tiene FE
    activa / el plan no la incluye / no hay resolución del tipo requerido. Nunca
    lanza excepción salvo el límite de resolución. El caller hace db.commit().
    """
    empresa_fe = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if not empresa_fe or not empresa_fe.facturacion_electronica_activa:
        return None
    # Doble capa: además del flag, validar en vivo que el plan vigente incluya FE
    if not plan_incluye_fe(db, empresa_id):
        return None
    if not (empresa_fe.matias_api_key or empresa_fe.matias_sandbox_api_key):
        return None

    tipo_doc = _tipo_documento_dian(venta)
    # En DEE/POS, si no hay cliente identificado, build_invoice_payload emite a
    # "CONSUMIDOR FINAL" automáticamente.

    # Asignar número DIAN del tipo correcto si la venta no tiene uno.
    # Si la venta ya traía un numero_factura asignado para el tipo equivocado,
    # se respeta (ya fue tomado de una resolución); el caso normal es sin número.
    if not venta.numero_factura:
        numero = _asignar_numero_factura(db, empresa_id, venta, tipo=tipo_doc)
        if not numero:
            # Sin resolución activa del tipo requerido → no se puede emitir.
            # (p.ej. empresa sin resolución POS configurada aún)
            return None

    try:
        from services import matias_service as _ms
        test_mode = empresa_fe.matias_test_mode
        api_key   = empresa_fe.matias_sandbox_api_key if test_mode else empresa_fe.matias_api_key

        resultado = _ms.emitir_factura(
            venta     = venta,
            empresa   = empresa_fe,
            cliente   = cliente,
            detalles  = detalles,
            api_key   = api_key or "",
            test_mode = test_mode,
            tipo_documento = tipo_doc,
        )

        venta.estado_electronico = resultado["estado"]
        venta.mensaje_proveedor  = resultado.get("mensaje")
        if resultado.get("cufe"):
            venta.cufe = resultado["cufe"]
        if resultado.get("pdf_url"):
            venta.pdf_url = resultado["pdf_url"]
        if resultado.get("xml_url"):
            venta.xml_url = resultado["xml_url"]
        if resultado.get("qr_url"):
            venta.qr_data = resultado["qr_url"]

        db.add(models.IntentoFE(
            venta_id           = venta.id,
            empresa_id         = empresa_id,
            estado             = resultado["estado"],
            payload_enviado    = resultado.get("payload_enviado"),
            respuesta_recibida = resultado.get("respuesta_recibida"),
            cufe               = resultado.get("cufe"),
            mensaje            = resultado.get("mensaje"),
        ))
        return resultado
    except Exception:
        import logging as _logging
        _logging.getLogger("crud.ventas").exception(
            "Error al emitir FE para venta %s — se guarda sin FE.", getattr(venta, "id", "?")
        )
        venta.estado_electronico = "fallido"
        return None


def get_lotes_fefo(
    db: Session,
    empresa_id: int,
    producto_id: int,
) -> list:
    """
    Retorna los lotes vigentes del producto ordenados por fecha de vencimiento ASC.
    Incluye lotes sin fecha de vencimiento (NULL = sin caducidad).
    Excluye lotes vencidos y sin stock.
    """
    from datetime import date as _date
    from sqlalchemy import or_
    hoy = _date.today()
    return (
        db.query(models.LoteExistencia)
        .filter(
            models.LoteExistencia.empresa_id      == empresa_id,
            models.LoteExistencia.producto_id     == producto_id,
            models.LoteExistencia.cantidad_actual >  0,
            or_(
                models.LoteExistencia.fecha_vencimiento == None,
                models.LoteExistencia.fecha_vencimiento >= hoy,
            ),
        )
        .order_by(
            models.LoteExistencia.fecha_vencimiento.asc().nullslast()
        )
        .all()
    )


def consumir_stock_fefo(
    db: Session,
    empresa_id: int,
    producto_id: int,
    cantidad_requerida: float,
    motivo: str = "venta",
    referencia: str = "",
    commit: bool = True,
) -> list:
    """
    Descuenta stock aplicando FEFO.
    Retorna lista de lotes afectados para trazabilidad en la factura.
    Lanza ValueError si no hay stock suficiente en lotes vigentes.
    """
    lotes    = get_lotes_fefo(db, empresa_id, producto_id)
    restante = cantidad_requerida
    afectados = []

    for lote in lotes:
        if restante <= 0:
            break

        consumo = min(lote.cantidad_actual, restante)
        lote.cantidad_actual -= consumo
        restante             -= consumo

        afectados.append({
            "lote_id":           lote.id,
            "numero_lote":       lote.numero_lote,
            "fecha_vencimiento": lote.fecha_vencimiento.isoformat(),
            "consumido":         consumo,
        })

        db.add(models.InventoryMovement(
            empresa_id     = empresa_id,
            producto_id    = producto_id,
            tipo           = "salida",
            cantidad       = consumo,
            costo_unitario = lote.costo_unitario,
            motivo         = motivo,
            referencia     = referencia,
            lote_id        = lote.id,
            numero_lote    = lote.numero_lote,
        ))

    if restante > 0:
        raise ValueError(
            f"Stock insuficiente en lotes vigentes para '{referencia}'. "
            f"Faltaron {restante:.2f} unidades."
        )

    if commit:
        db.commit()

    return afectados


def _ejecutar_movimientos_venta(db: Session, empresa_id: int, db_venta: models.Venta):
    """
    Crea los movimientos de inventario para cada detalle de la venta.
    Aplica FEFO si el producto maneja lotes, descuento estándar en caso contrario.
    Reutilizable desde create_venta (main.py) y convertir_cotizacion.
    """
    from crud.inventario import create_movement
    for det in db_venta.detalles:
        prod = get_producto(db, empresa_id=empresa_id, producto_id=det.producto_id)
        if not prod or prod.es_servicio:
            continue

        if getattr(prod, "maneja_lotes", False):
            try:
                consumir_stock_fefo(
                    db, empresa_id=empresa_id,
                    producto_id=det.producto_id,
                    cantidad_requerida=det.cantidad,
                    referencia=f"Venta #{db_venta.id}",
                    commit=False,
                )
                prod.stock_actual = (prod.stock_actual or 0) - det.cantidad
                db.add(prod)
                # También descontar de la variante si aplica
                if det.variante_id:
                    variante = db.query(models.ProductoVariante).filter(
                        models.ProductoVariante.id == det.variante_id
                    ).first()
                    if variante:
                        variante.stock_actual = (variante.stock_actual or 0) - det.cantidad
                        db.add(variante)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
        else:
            create_movement(db, empresa_id=empresa_id, payload=schemas.InventoryMovementCreate(
                producto_id    = det.producto_id,
                tipo           = schemas.MovementType.salida,
                cantidad       = det.cantidad,
                costo_unitario = prod.costo or 0.0,
                motivo         = "venta",
                referencia     = f"venta #{db_venta.id}",
            ))
            # Descontar stock de variante para modelo sin lotes
            if det.variante_id:
                variante = db.query(models.ProductoVariante).filter(
                    models.ProductoVariante.id == det.variante_id
                ).first()
                if variante:
                    variante.stock_actual = (variante.stock_actual or 0) - det.cantidad
                    db.add(variante)
