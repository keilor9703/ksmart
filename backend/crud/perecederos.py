from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import date, datetime, timedelta, timezone
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ


# ── Helper: clasifica urgencia según días restantes ──────────────────────────
def _urgencia(dias: int) -> str:
    if dias <= 0:  return "vencido"
    if dias <= 5:  return "critico"
    if dias <= 15: return "alerta"
    if dias <= 30: return "aviso"
    return "ok"


# ── Helper: enriquece un LoteExistencia con campos calculados ────────────────
def _enriquecer_lote(lote: models.LoteExistencia) -> dict:
    # dias = (lote.fecha_vencimiento - date.today()).days
  # ✅ FIX — construye el dict solo con columnas reales
    fv = lote.fecha_vencimiento.date() if isinstance(lote.fecha_vencimiento, datetime) else lote.fecha_vencimiento
    dias = (fv - date.today()).days
    pct = round(
        ((lote.cantidad_inicial - lote.cantidad_actual) / lote.cantidad_inicial * 100)
        if lote.cantidad_inicial > 0 else 0, 1
    )
    return {
        "id":                lote.id,
        "empresa_id":        lote.empresa_id,
        "producto_id":       lote.producto_id,
        "numero_lote":       lote.numero_lote,
        "fecha_vencimiento": fv,
        "fecha_fabricacion": lote.fecha_fabricacion,
        "cantidad_inicial":  lote.cantidad_inicial,
        "cantidad_actual":   lote.cantidad_actual,
        "costo_unitario":    lote.costo_unitario,
        "proveedor_id":      lote.proveedor_id,
        "referencia_compra": lote.referencia_compra,
        "observaciones":     lote.observaciones,
        "created_at":        lote.created_at,
        "producto_nombre":   lote.producto.nombre if lote.producto else None,
        "producto_barcode":  lote.producto.codigo_barras if lote.producto else None,
        "proveedor_nombre":  lote.proveedor.nombre if lote.proveedor else None,
        "dias_restantes":    dias,
        "urgencia":          _urgencia(dias),
        "porcentaje_consumo": pct,
    }


# ════════════════════════════════════════════════════════════════════════════
# CRUD BÁSICO DE LOTES
# ════════════════════════════════════════════════════════════════════════════

def crear_lote_existencia(
    db: Session,
    empresa_id: int,
    payload: schemas.LoteExistenciaCreate,
    commit: bool = True,
) -> models.LoteExistencia:
    """
    Crea o actualiza un lote de existencias.
    Si ya existe el mismo numero_lote para ese producto y empresa, suma la cantidad.
    """
    # Verificar que el producto pertenece a la empresa
    producto = db.query(models.Producto).filter(
        models.Producto.id         == payload.producto_id,
        models.Producto.empresa_id == empresa_id,
        models.Producto.vigente    == True,
    ).first()
    if not producto:
        raise HTTPException(404, "Producto no encontrado o no pertenece a esta empresa.")

    # Buscar si ya existe este lote
    lote = db.query(models.LoteExistencia).filter(
        models.LoteExistencia.empresa_id  == empresa_id,
        models.LoteExistencia.producto_id == payload.producto_id,
        models.LoteExistencia.numero_lote == payload.numero_lote,
    ).first()

    if lote:
        # Reposición del mismo lote — suma cantidades
        lote.cantidad_actual  += payload.cantidad_inicial
        lote.cantidad_inicial += payload.cantidad_inicial
        # Actualiza el costo al promedio ponderado
        total_unidades = lote.cantidad_actual
        lote.costo_unitario = (
            (lote.costo_unitario * (total_unidades - payload.cantidad_inicial)
             + payload.costo_unitario * payload.cantidad_inicial)
            / total_unidades
        ) if total_unidades > 0 else payload.costo_unitario
    else:
        lote = models.LoteExistencia(
            empresa_id        = empresa_id,
            producto_id       = payload.producto_id,
            numero_lote       = payload.numero_lote,
            fecha_vencimiento = payload.fecha_vencimiento,
            fecha_fabricacion = payload.fecha_fabricacion,
            cantidad_inicial  = payload.cantidad_inicial,
            cantidad_actual   = payload.cantidad_inicial,
            costo_unitario    = payload.costo_unitario,
            proveedor_id      = payload.proveedor_id,
            referencia_compra = payload.referencia_compra,
            observaciones     = payload.observaciones,
        )
        db.add(lote)

    # Actualizar stock_actual del producto sumando la cantidad ingresada
    producto.stock_actual = (producto.stock_actual or 0) + payload.cantidad_inicial

    # Flush para que un lote recién creado tenga id y el movimiento quede
    # ligado a él (trazabilidad por lote_id, no solo por texto)
    db.flush()

    # Registrar en inventory_movements para el Kardex
    db.add(models.InventoryMovement(
        producto_id    = payload.producto_id,
        tipo           = "entrada",
        cantidad       = payload.cantidad_inicial,
        costo_unitario = payload.costo_unitario,
        motivo         = "ingreso_lote",
        referencia     = payload.referencia_compra or f"Lote {payload.numero_lote}",
        observacion    = f"Vence: {payload.fecha_vencimiento} | Lote: {payload.numero_lote}",
        empresa_id     = empresa_id,
        lote_id        = lote.id,
        numero_lote    = payload.numero_lote,
    ))

    if commit:
        db.commit()
        db.refresh(lote)
    else:
        db.flush()
    return lote


def get_lotes_producto(
    db: Session,
    empresa_id: int,
    producto_id: int,
    solo_activos: bool = True,
) -> list:
    """Lista todos los lotes de un producto, ordenados FEFO."""
    q = db.query(models.LoteExistencia).filter(
        models.LoteExistencia.empresa_id  == empresa_id,
        models.LoteExistencia.producto_id == producto_id,
    )
    if solo_activos:
        q = q.filter(models.LoteExistencia.cantidad_actual > 0)

    lotes = q.order_by(models.LoteExistencia.fecha_vencimiento.asc()).all()
    return [_enriquecer_lote(l) for l in lotes]


def get_todos_los_lotes(
    db: Session,
    empresa_id: int,
    solo_activos: bool = True,
    producto_id: int = None,
) -> list:
    """Lista todos los lotes de la empresa."""
    q = (
        db.query(models.LoteExistencia)
        .join(models.Producto)
        .filter(models.LoteExistencia.empresa_id == empresa_id)
    )
    if solo_activos:
        q = q.filter(models.LoteExistencia.cantidad_actual > 0)
    if producto_id:
        q = q.filter(models.LoteExistencia.producto_id == producto_id)

    lotes = q.order_by(models.LoteExistencia.fecha_vencimiento.asc()).all()
    return [_enriquecer_lote(l) for l in lotes]


def ajustar_lote(
    db: Session,
    empresa_id: int,
    lote_id: int,
    ajuste: schemas.LoteAjusteCreate,
) -> models.LoteExistencia:
    """Ajuste manual de cantidad en un lote (positivo=entrada, negativo=salida)."""
    lote = db.query(models.LoteExistencia).filter(
        models.LoteExistencia.id         == lote_id,
        models.LoteExistencia.empresa_id == empresa_id,
    ).first()
    if not lote:
        raise HTTPException(404, "Lote no encontrado.")

    nueva_cantidad = lote.cantidad_actual + ajuste.cantidad
    if nueva_cantidad < 0:
        raise HTTPException(400, f"Ajuste inválido: la cantidad resultante sería negativa "
                                 f"({nueva_cantidad:.2f}).")

    lote.cantidad_actual = nueva_cantidad

    # Actualizar stock del producto
    producto = db.query(models.Producto).filter(
        models.Producto.id         == lote.producto_id,
        models.Producto.empresa_id == empresa_id,
        models.Producto.vigente    == True,
    ).first()
    if producto:
        producto.stock_actual = (producto.stock_actual or 0) + ajuste.cantidad

    # Registrar movimiento
    db.add(models.InventoryMovement(
        producto_id    = lote.producto_id,
        tipo           = "entrada" if ajuste.cantidad > 0 else "salida",
        cantidad       = abs(ajuste.cantidad),
        costo_unitario = lote.costo_unitario,
        motivo         = f"ajuste_lote: {ajuste.motivo}",
        referencia     = ajuste.referencia or f"Lote {lote.numero_lote}",
        empresa_id     = empresa_id,
        lote_id        = lote.id,
        numero_lote    = lote.numero_lote,
    ))

    db.commit()
    db.refresh(lote)
    return lote


# ════════════════════════════════════════════════════════════════════════════
# FEFO — FIRST EXPIRED, FIRST OUT
# ════════════════════════════════════════════════════════════════════════════

def get_lotes_fefo(
    db: Session,
    empresa_id: int,
    producto_id: int,
) -> list[models.LoteExistencia]:
    """
    Retorna los lotes vigentes del producto ordenados por fecha de vencimiento ASC.
    No incluye lotes ya vencidos ni sin stock.
    """
    from sqlalchemy import or_
    hoy = date.today()
    return (
        db.query(models.LoteExistencia)
        .filter(
            models.LoteExistencia.empresa_id      == empresa_id,
            models.LoteExistencia.producto_id     == producto_id,
            models.LoteExistencia.cantidad_actual >  0,
            or_(
                models.LoteExistencia.fecha_vencimiento == None,  # noqa: E711 — sin caducidad
                models.LoteExistencia.fecha_vencimiento >= hoy,
            ),
        )
        .order_by(models.LoteExistencia.fecha_vencimiento.asc().nullslast())
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
) -> list[dict]:
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
            "fecha_vencimiento": lote.fecha_vencimiento.isoformat() if lote.fecha_vencimiento else None,
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


def sugerencia_fefo(
    db: Session,
    empresa_id: int,
    producto_id: int,
    cantidad_requerida: float,
) -> dict:
    """
    Devuelve la sugerencia FEFO SIN modificar la BD.
    Útil para mostrar al usuario qué lotes se van a consumir antes de confirmar.
    """
    lotes    = get_lotes_fefo(db, empresa_id, producto_id)
    restante = cantidad_requerida
    plan     = []
    factible = True

    for lote in lotes:
        if restante <= 0:
            break
        consumo = min(lote.cantidad_actual, restante)
        restante -= consumo
        fv = lote.fecha_vencimiento.date() if isinstance(lote.fecha_vencimiento, datetime) else lote.fecha_vencimiento
        plan.append({
            "lote_id":             lote.id,
            "numero_lote":         lote.numero_lote,
            "fecha_vencimiento":   fv.isoformat() if fv else None,
            "dias_restantes":      (fv - date.today()).days if fv else None,
            "cantidad_disponible": lote.cantidad_actual,
            "a_consumir":          consumo,
            "costo_unitario":      lote.costo_unitario,
        })

    if restante > 0:
        factible = False

    return {
        "factible":          factible,
        "cantidad_requerida": cantidad_requerida,
        "faltante":          restante if not factible else 0,
        "lotes_sugeridos":   plan,
    }


# ════════════════════════════════════════════════════════════════════════════
# TRAZABILIDAD POR LOTE (recall / auditoría INVIMA)
# ════════════════════════════════════════════════════════════════════════════

def get_trazabilidad_lote(db: Session, empresa_id: int, lote_id: int) -> dict:
    """
    Libro completo de un lote: todos sus movimientos (entrada, salidas por
    venta/producción, ajustes) y, para recall sanitario, las ventas y clientes
    a los que se despachó ese lote.
    """
    import re
    from sqlalchemy import or_, and_

    lote = db.query(models.LoteExistencia).filter(
        models.LoteExistencia.id         == lote_id,
        models.LoteExistencia.empresa_id == empresa_id,
    ).first()
    if not lote:
        raise HTTPException(404, "Lote no encontrado.")

    # Movimientos ligados por lote_id, y también por numero_lote del mismo
    # producto (cubre movimientos antiguos grabados solo con el texto)
    movs = (
        db.query(models.InventoryMovement)
        .filter(
            models.InventoryMovement.empresa_id == empresa_id,
            or_(
                models.InventoryMovement.lote_id == lote_id,
                and_(
                    models.InventoryMovement.producto_id == lote.producto_id,
                    models.InventoryMovement.numero_lote == lote.numero_lote,
                ),
            ),
        )
        .order_by(models.InventoryMovement.created_at.asc(), models.InventoryMovement.id.asc())
        .all()
    )

    # Resolver las ventas referenciadas ("venta #12", "Venta #12") -> cliente
    venta_ids = set()
    for m in movs:
        match = re.search(r"venta\s*#(\d+)", m.referencia or "", re.IGNORECASE)
        if match:
            venta_ids.add(int(match.group(1)))

    ventas_afectadas = []
    if venta_ids:
        ventas = (
            db.query(models.Venta)
            .filter(models.Venta.id.in_(venta_ids), models.Venta.empresa_id == empresa_id)
            .all()
        )
        for v in ventas:
            ventas_afectadas.append({
                "venta_id":         v.id,
                "numero_venta":     v.numero_venta,
                "fecha":            v.fecha.isoformat() if v.fecha else None,
                "cliente_id":       v.cliente_id,
                "cliente_nombre":   v.cliente.nombre if v.cliente else "Consumidor final",
                "cliente_telefono": getattr(v.cliente, "telefono", None) if v.cliente else None,
                "total":            v.total,
            })
        ventas_afectadas.sort(key=lambda x: x["fecha"] or "")

    def _tipo_str(m):
        return m.tipo.value if hasattr(m.tipo, "value") else str(m.tipo)

    consumido_ventas = sum(
        m.cantidad for m in movs
        if _tipo_str(m).lower().endswith("salida")
        and re.search(r"venta", (m.referencia or "") + (m.motivo or ""), re.IGNORECASE)
    )

    return {
        "lote": _enriquecer_lote(lote),
        "movimientos": [
            {
                "id":             m.id,
                "tipo":           _tipo_str(m),
                "cantidad":       m.cantidad,
                "costo_unitario": m.costo_unitario,
                "motivo":         m.motivo,
                "referencia":     m.referencia,
                "observacion":    m.observacion,
                "created_at":     m.created_at.isoformat() if m.created_at else None,
            }
            for m in movs
        ],
        "ventas_afectadas":          ventas_afectadas,
        "total_consumido_en_ventas": consumido_ventas,
    }


# ════════════════════════════════════════════════════════════════════════════
# ALERTAS DE VENCIMIENTO
# ════════════════════════════════════════════════════════════════════════════

def get_alertas_vencimiento(
    db: Session,
    empresa_id: int,
    dias: int = 30,
) -> list[dict]:
    """
    Retorna lotes con stock > 0 cuya fecha de vencimiento está dentro de `dias` días.
    Incluye lotes ya vencidos (dias_restantes < 0).
    """
    limite = date.today() + timedelta(days=dias)

    lotes = (
        db.query(models.LoteExistencia)
        .join(models.Producto)
        .filter(
            models.LoteExistencia.empresa_id        == empresa_id,
            models.LoteExistencia.cantidad_actual   >  0,
            models.LoteExistencia.fecha_vencimiento <= limite,
        )
        .order_by(models.LoteExistencia.fecha_vencimiento.asc())
        .all()
    )

    return [
        {
            "lote_id":           l.id,
            "producto_id":       l.producto_id,
            "producto_nombre":   l.producto.nombre,
            "producto_barcode":  l.producto.codigo_barras,
            "numero_lote":       l.numero_lote,
            "cantidad_actual":   l.cantidad_actual,
            "unidad_medida":     l.producto.unidad_medida,
            "fecha_vencimiento": l.fecha_vencimiento.isoformat(),
            "dias_restantes":    (l.fecha_vencimiento - date.today()).days,
            "urgencia":          _urgencia((l.fecha_vencimiento - date.today()).days),
            "valor_en_riesgo":   round(l.cantidad_actual * l.costo_unitario, 2),
        }
        for l in lotes
    ]


def get_resumen_alertas(db: Session, empresa_id: int) -> dict:
    """
    KPIs de alertas: cuántos lotes en cada categoría de urgencia.
    Para el dashboard.
    """
    alertas = get_alertas_vencimiento(db, empresa_id, dias=30)

    return {
        "vencidos":  sum(1 for a in alertas if a["urgencia"] == "vencido"),
        "criticos":  sum(1 for a in alertas if a["urgencia"] == "critico"),
        "alertas":   sum(1 for a in alertas if a["urgencia"] == "alerta"),
        "avisos":    sum(1 for a in alertas if a["urgencia"] == "aviso"),
        "valor_total_en_riesgo": sum(a["valor_en_riesgo"] for a in alertas),
        "detalle":   alertas,
    }


def notificar_vencimientos_proximos(db: Session) -> int:
    """
    Cron job: genera notificaciones para admins de empresas con lotes
    próximos a vencer (≤ 15 días). Se llama desde un endpoint superadmin.
    Retorna el número de notificaciones creadas.
    """
    limite  = date.today() + timedelta(days=15)
    hoy     = date.today()
    total   = 0

    empresas = db.query(models.Empresa).filter(models.Empresa.is_active == True).all()

    for empresa in empresas:
        lotes_criticos = db.query(models.LoteExistencia).join(models.Producto).filter(
            models.LoteExistencia.empresa_id        == empresa.id,
            models.LoteExistencia.cantidad_actual   >  0,
            models.LoteExistencia.fecha_vencimiento <= limite,
        ).all()

        if not lotes_criticos:
            continue

        vencidos = [l for l in lotes_criticos if l.fecha_vencimiento < hoy]
        criticos = [l for l in lotes_criticos if hoy <= l.fecha_vencimiento <= hoy + timedelta(days=5)]
        proximos = [l for l in lotes_criticos if l.fecha_vencimiento > hoy + timedelta(days=5)]

        admins = db.query(models.User).join(models.Role).filter(
            models.User.empresa_id == empresa.id,
            models.Role.name       == "Admin",
            models.User.is_active  == True,
        ).all()

        for admin in admins:
            if vencidos:
                db.add(models.Notificacion(
                    usuario_id    = admin.id,
                    empresa_id    = empresa.id,
                    mensaje       = f"🔴 {len(vencidos)} lote(s) VENCIDO(S). Retíralos del inventario inmediatamente.",
                    tipo          = "error",
                    leido         = False,
                ))
                total += 1

            if criticos:
                nombres = ", ".join(set(l.producto.nombre for l in criticos))
                db.add(models.Notificacion(
                    usuario_id    = admin.id,
                    empresa_id    = empresa.id,
                    mensaje       = f"🟠 {len(criticos)} lote(s) vencen en ≤5 días: {nombres[:80]}",
                    tipo          = "warning",
                    leido         = False,
                ))
                total += 1

            if proximos:
                db.add(models.Notificacion(
                    usuario_id    = admin.id,
                    empresa_id    = empresa.id,
                    mensaje       = f"🟡 {len(proximos)} lote(s) vencen en los próximos 15 días.",
                    tipo          = "info",
                    leido         = False,
                ))
                total += 1

    db.commit()
    return total
