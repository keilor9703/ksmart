"""
Módulo Restaurante — endpoints para mesas, comandas y cocina.

Flujo principal:
  1. Admin configura mesas y zonas (/restaurante/config, /restaurante/mesas)
  2. Mesero abre comanda en una mesa (/restaurante/comandas POST)
  3. Mesero agrega ítems → llegan a cocina (/restaurante/comandas/{id}/items POST)
  4. Cocinero ve pantalla cocina y marca ítems listos (/restaurante/cocina)
  5. Mesero cierra la cuenta → se genera una Venta (/restaurante/comandas/{id}/cerrar)
"""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

import crud
import models
import schemas
from api.deps import get_db, get_current_active_user, get_current_admin_user

router = APIRouter()


# ─── helpers ──────────────────────────────────────────────────────────────────

def _get_empresa_id(user: models.User) -> int:
    return user.empresa_id


def _recalc_total(comanda: models.Comanda):
    comanda.total = sum(
        i.subtotal for i in comanda.items if i.estado != "cancelado"
    )


def _numero_comanda_hoy(db: Session, empresa_id: int) -> int:
    hoy = datetime.now(timezone.utc).date()
    count = db.query(models.Comanda).filter(
        models.Comanda.empresa_id == empresa_id,
        func.date(models.Comanda.fecha_apertura) == hoy,
    ).count()
    return count + 1


def _mesa_or_404(db, empresa_id, mesa_id):
    m = db.query(models.Mesa).filter(
        models.Mesa.id == mesa_id, models.Mesa.empresa_id == empresa_id
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Mesa no encontrada.")
    return m


def _comanda_or_404(db, empresa_id, comanda_id):
    c = db.query(models.Comanda).filter(
        models.Comanda.id == comanda_id, models.Comanda.empresa_id == empresa_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Comanda no encontrada.")
    return c


# ─── serializers ──────────────────────────────────────────────────────────────

def _ser_item(i: models.ComandaItem) -> dict:
    return {
        "id": i.id, "comanda_id": i.comanda_id,
        "producto_id": i.producto_id, "nombre_producto": i.nombre_producto,
        "cantidad": i.cantidad, "precio_unitario": i.precio_unitario,
        "subtotal": i.subtotal, "notas": i.notas,
        "area_cocina": i.area_cocina, "estado": i.estado,
        "va_a_cocina": i.va_a_cocina,
        "timestamp_pedido": i.timestamp_pedido.isoformat() if i.timestamp_pedido else None,
        "timestamp_listo": i.timestamp_listo.isoformat() if i.timestamp_listo else None,
    }


def _ser_comanda(c: models.Comanda) -> dict:
    return {
        "id": c.id, "empresa_id": c.empresa_id,
        "mesa_id": c.mesa_id,
        "mesa_numero": c.mesa.numero if c.mesa else None,
        "mesa_zona": c.mesa.zona if c.mesa else None,
        "mesero_id": c.mesero_id,
        "mesero_nombre": c.mesero.nombre_completo if c.mesero else None,
        "numero_comanda": c.numero_comanda,
        "personas": c.personas, "notas": c.notas,
        "estado": c.estado, "total": c.total,
        "venta_id": c.venta_id,
        "fecha_apertura": c.fecha_apertura.isoformat() if c.fecha_apertura else None,
        "fecha_cierre": c.fecha_cierre.isoformat() if c.fecha_cierre else None,
        "items": [_ser_item(i) for i in c.items],
    }


def _ser_mesa(m: models.Mesa, comanda_activa=None) -> dict:
    return {
        "id": m.id, "empresa_id": m.empresa_id,
        "numero": m.numero, "nombre": m.nombre,
        "capacidad": m.capacidad, "zona": m.zona,
        "estado": m.estado, "pos_x": m.pos_x, "pos_y": m.pos_y,
        "is_active": m.is_active,
        "comanda_activa": _ser_comanda(comanda_activa) if comanda_activa else None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════════════════

class ConfigRestauranteIn(BaseModel):
    areas_cocina: Optional[List[str]] = None
    zonas_sala: Optional[List[str]] = None
    tiempo_cocina_estimado: Optional[int] = None
    propina_sugerida_pct: Optional[float] = None
    permitir_nota_por_item: Optional[bool] = None
    imprimir_comanda_auto: Optional[bool] = None
    tipo_impresora: Optional[str] = None
    mesero_puede_cobrar_directo: Optional[bool] = None


@router.get("/config")
def get_config(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    cfg = db.query(models.ConfigRestaurante).filter_by(empresa_id=user.empresa_id).first()
    if not cfg:
        cfg = models.ConfigRestaurante(empresa_id=user.empresa_id)
        db.add(cfg); db.commit(); db.refresh(cfg)
    return {
        "id": cfg.id,
        "areas_cocina": cfg.areas_cocina or ["Cocina general"],
        "zonas_sala": cfg.zonas_sala or ["Salón principal"],
        "tiempo_cocina_estimado": cfg.tiempo_cocina_estimado,
        "propina_sugerida_pct": cfg.propina_sugerida_pct,
        "permitir_nota_por_item": cfg.permitir_nota_por_item,
        "imprimir_comanda_auto": cfg.imprimir_comanda_auto,
        "tipo_impresora": cfg.tipo_impresora or 'p80',
        "mesero_puede_cobrar_directo": cfg.mesero_puede_cobrar_directo,
    }


@router.put("/config")
def update_config(
    payload: ConfigRestauranteIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_admin_user),
):
    cfg = db.query(models.ConfigRestaurante).filter_by(empresa_id=user.empresa_id).first()
    if not cfg:
        cfg = models.ConfigRestaurante(empresa_id=user.empresa_id)
        db.add(cfg)
    for field, val in payload.dict(exclude_none=True).items():
        setattr(cfg, field, val)
    db.commit(); db.refresh(cfg)
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
# MESAS
# ═══════════════════════════════════════════════════════════════════════════════

class MesaCreate(BaseModel):
    numero: str
    nombre: Optional[str] = None
    capacidad: int = 4
    zona: Optional[str] = None
    pos_x: float = 10.0
    pos_y: float = 10.0


class MesaUpdate(BaseModel):
    nombre: Optional[str] = None
    capacidad: Optional[int] = None
    zona: Optional[str] = None
    pos_x: Optional[float] = None
    pos_y: Optional[float] = None
    is_active: Optional[bool] = None


@router.get("/mesas")
def listar_mesas(
    zona: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    q = db.query(models.Mesa).filter(
        models.Mesa.empresa_id == user.empresa_id,
        models.Mesa.is_active == True,
    )
    if zona:
        q = q.filter(models.Mesa.zona == zona)
    mesas = q.order_by(models.Mesa.zona, models.Mesa.numero).all()

    # Adjuntar comanda activa a cada mesa
    result = []
    for m in mesas:
        comanda = db.query(models.Comanda).filter(
            models.Comanda.mesa_id == m.id,
            models.Comanda.estado.in_(["abierta", "enviada", "lista", "en_cuenta"]),
        ).first()
        result.append(_ser_mesa(m, comanda))
    return result


@router.post("/mesas", status_code=201)
def crear_mesa(
    payload: MesaCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_admin_user),
):
    existe = db.query(models.Mesa).filter(
        models.Mesa.empresa_id == user.empresa_id,
        models.Mesa.numero == payload.numero,
        models.Mesa.zona == payload.zona,
    ).first()
    if existe:
        raise HTTPException(status_code=400, detail=f"Ya existe la mesa '{payload.numero}' en la zona '{payload.zona}'.")
    mesa = models.Mesa(empresa_id=user.empresa_id, **payload.dict())
    db.add(mesa); db.commit(); db.refresh(mesa)
    return _ser_mesa(mesa)


@router.put("/mesas/{mesa_id}")
def actualizar_mesa(
    mesa_id: int,
    payload: MesaUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_admin_user),
):
    mesa = _mesa_or_404(db, user.empresa_id, mesa_id)
    for field, val in payload.dict(exclude_none=True).items():
        setattr(mesa, field, val)
    db.commit(); db.refresh(mesa)
    return _ser_mesa(mesa)


@router.delete("/mesas/{mesa_id}", status_code=204)
def eliminar_mesa(
    mesa_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_admin_user),
):
    mesa = _mesa_or_404(db, user.empresa_id, mesa_id)
    tiene_abierta = db.query(models.Comanda).filter(
        models.Comanda.mesa_id == mesa_id,
        models.Comanda.estado.in_(["abierta", "enviada", "lista", "en_cuenta"]),
    ).first()
    if tiene_abierta:
        raise HTTPException(status_code=400, detail="La mesa tiene una comanda activa. Ciérrala primero.")
    mesa.is_active = False
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# COMANDAS
# ═══════════════════════════════════════════════════════════════════════════════

class ComandaCreate(BaseModel):
    mesa_id: int
    personas: int = 1
    notas: Optional[str] = None


class ItemAdd(BaseModel):
    producto_id: Optional[int] = None
    nombre_producto: str
    cantidad: float = 1.0
    precio_unitario: float
    notas: Optional[str] = None
    area_cocina: Optional[str] = None


class ItemEstadoUpdate(BaseModel):
    estado: str   # pendiente | en_preparacion | listo | entregado | cancelado


class ComandaEstadoUpdate(BaseModel):
    estado: str   # abierta | enviada | lista | cerrada | cancelada


class CerrarComandaIn(BaseModel):
    metodo_pago: str = "Efectivo"
    propina: float = 0.0
    propina_efectivo: float = 0.0
    omitir_inventario: bool = False
    cobrado_por_cajero: bool = False


@router.get("/comandas")
def listar_comandas(
    estado: Optional[str] = None,
    mesa_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    q = db.query(models.Comanda).filter(models.Comanda.empresa_id == user.empresa_id)
    if estado:
        q = q.filter(models.Comanda.estado == estado)
    elif estado is None:
        # Por defecto: solo activas
        q = q.filter(models.Comanda.estado.in_(["abierta", "enviada", "lista"]))
    if mesa_id:
        q = q.filter(models.Comanda.mesa_id == mesa_id)
    return [_ser_comanda(c) for c in q.order_by(models.Comanda.fecha_apertura.desc()).all()]


@router.get("/comandas/{comanda_id}")
def get_comanda(
    comanda_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    return _ser_comanda(_comanda_or_404(db, user.empresa_id, comanda_id))


@router.post("/comandas", status_code=201)
def abrir_comanda(
    payload: ComandaCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    mesa = _mesa_or_404(db, user.empresa_id, payload.mesa_id)

    # No abrir segunda comanda en mesa ocupada o en cuenta
    activa = db.query(models.Comanda).filter(
        models.Comanda.mesa_id == mesa.id,
        models.Comanda.estado.in_(["abierta", "enviada", "lista", "en_cuenta"]),
    ).first()
    if activa:
        raise HTTPException(status_code=400, detail="La mesa ya tiene una comanda activa.")

    comanda = models.Comanda(
        empresa_id=user.empresa_id,
        mesa_id=mesa.id,
        mesero_id=user.id,
        numero_comanda=_numero_comanda_hoy(db, user.empresa_id),
        personas=payload.personas,
        notas=payload.notas,
    )
    db.add(comanda)
    mesa.estado = "ocupada"
    db.commit(); db.refresh(comanda)
    return _ser_comanda(comanda)


@router.post("/comandas/{comanda_id}/items", status_code=201)
def agregar_items(
    comanda_id: int,
    items: List[ItemAdd],
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    comanda = _comanda_or_404(db, user.empresa_id, comanda_id)
    if comanda.estado in ("cerrada", "cancelada", "en_cuenta"):
        raise HTTPException(status_code=400, detail="No se pueden agregar ítems a esta comanda.")

    cfg = db.query(models.ConfigRestaurante).filter_by(empresa_id=user.empresa_id).first()
    areas = cfg.areas_cocina if cfg else ["Cocina general"]

    # Cargar overrides por-empresa una sola vez
    from crud.grupos_producto import _get_overrides
    overrides = _get_overrides(db, user.empresa_id)

    for it in items:
        area = it.area_cocina
        va_a_cocina = True  # default: va a cocina

        if it.producto_id:
            prod = db.query(models.Producto).filter(
                models.Producto.id == it.producto_id,
                models.Producto.vigente == True,
            ).first()
            if prod and prod.grupo:
                ov = overrides.get(prod.grupo_item)
                if ov and ov.requiere_cocina is not None:
                    va_a_cocina = ov.requiere_cocina
                else:
                    va_a_cocina = prod.requiere_cocina
                if not area and va_a_cocina:
                    area = areas[0] if areas else "Cocina general"

        nuevo = models.ComandaItem(
            comanda_id=comanda.id,
            producto_id=it.producto_id,
            nombre_producto=it.nombre_producto,
            cantidad=it.cantidad,
            precio_unitario=it.precio_unitario,
            subtotal=round(it.cantidad * it.precio_unitario, 2),
            notas=it.notas,
            area_cocina=area or (areas[0] if areas else None),
            va_a_cocina=va_a_cocina,
            estado="pendiente" if va_a_cocina else "listo",
            timestamp_listo=None if va_a_cocina else datetime.now(timezone.utc),
        )
        db.add(nuevo)

    # Pasar a "enviada" automáticamente al agregar ítems
    if comanda.estado == "abierta":
        comanda.estado = "enviada"
        comanda.mesa.estado = "ocupada"

    db.flush()
    _recalc_total(comanda)

    # Si todos los ítems activos ya están listos (ninguno va a cocina) → comanda = "lista"
    activos = [i for i in comanda.items if i.estado != "cancelado"]
    if activos and all(i.estado in ("listo", "entregado") for i in activos):
        comanda.estado = "lista"
    db.commit(); db.refresh(comanda)
    return _ser_comanda(comanda)


@router.patch("/comandas/{comanda_id}/items/{item_id}")
def actualizar_item_estado(
    comanda_id: int,
    item_id: int,
    payload: ItemEstadoUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    comanda = _comanda_or_404(db, user.empresa_id, comanda_id)
    item = next((i for i in comanda.items if i.id == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado.")

    VALID = {"pendiente", "en_preparacion", "listo", "entregado", "cancelado"}
    if payload.estado not in VALID:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Válidos: {VALID}")

    item.estado = payload.estado
    if payload.estado == "listo":
        item.timestamp_listo = datetime.now(timezone.utc)

    # Si todos los ítems no cancelados están listos → comanda pasa a "lista"
    activos = [i for i in comanda.items if i.estado != "cancelado"]
    if activos and all(i.estado in ("listo", "entregado") for i in activos):
        comanda.estado = "lista"

    _recalc_total(comanda)
    db.commit()
    return _ser_comanda(comanda)


@router.delete("/comandas/{comanda_id}/items/{item_id}", status_code=204)
def eliminar_item(
    comanda_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    comanda = _comanda_or_404(db, user.empresa_id, comanda_id)
    item = next((i for i in comanda.items if i.id == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado.")
    if item.estado not in ("pendiente",):
        raise HTTPException(status_code=400, detail="Solo se pueden eliminar ítems pendientes. Usa cancelar si ya fue a cocina.")
    db.delete(item)
    db.flush()
    _recalc_total(comanda)
    db.commit()


@router.post("/comandas/{comanda_id}/cerrar")
def cerrar_comanda(
    comanda_id: int,
    payload: CerrarComandaIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    """Cierra la cuenta: genera una Venta con los ítems de la comanda."""
    comanda = _comanda_or_404(db, user.empresa_id, comanda_id)
    if comanda.estado == "cerrada":
        return {"status": "ok", "venta_id": comanda.venta_id, "mensaje": "Ya estaba cerrada."}
    if comanda.estado == "cancelada":
        raise HTTPException(status_code=400, detail="La comanda está cancelada.")

    items_activos = [i for i in comanda.items if i.estado != "cancelado" and i.producto_id]

    # ── 1. Pre-validar stock con bloqueo antes de crear la Venta ──────────────
    productos_locked: dict[int, models.Producto] = {}
    if not payload.omitir_inventario:
        for item in items_activos:
            pid = item.producto_id
            if pid in productos_locked:
                continue
            prod = (
                db.query(models.Producto)
                .filter(
                    models.Producto.id == pid,
                    models.Producto.empresa_id == user.empresa_id,
                    models.Producto.vigente == True,
                )
                .with_for_update(of=models.Producto)
                .first()
            )
            if prod:
                productos_locked[pid] = prod

        for item in items_activos:
            prod = productos_locked.get(item.producto_id)
            if not prod or prod.es_servicio or getattr(prod, "requiere_cocina", False):
                continue
            if (prod.stock_actual or 0) < item.cantidad:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para '{prod.nombre}'. Disponible: {prod.stock_actual or 0}, requerido: {item.cantidad}",
                )

    propina_total = payload.propina + payload.propina_efectivo
    total_con_propina = round(comanda.total + propina_total, 2)

    # ── 2. Crear Venta y detalles (flush, sin commit aún) ─────────────────────
    propina_obs = []
    if payload.propina: propina_obs.append(f"Propina tarjeta: ${payload.propina:.0f}")
    if payload.propina_efectivo: propina_obs.append(f"Propina efectivo: ${payload.propina_efectivo:.0f}")
    venta = models.Venta(
        empresa_id=user.empresa_id,
        operador_id=user.id,
        total=total_con_propina,
        iva_total=0,
        iva_porcentaje=0,
        monto_pagado=total_con_propina,
        estado_pago="pagado",
        metodo_pago=payload.metodo_pago,
        observaciones=(
            f"Mesa {comanda.mesa.numero} — Comanda #{comanda.numero_comanda}"
            + (" | " + " | ".join(propina_obs) if propina_obs else "")
            + (" | Cobrado en caja" if payload.cobrado_por_cajero else "")
        ),
    )
    db.add(venta)
    db.flush()

    for item in comanda.items:
        if item.estado == "cancelado":
            continue
        db.add(models.DetalleVenta(
            venta_id=venta.id,
            producto_id=item.producto_id,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,
        ))

    # ── 3. Deducir inventario en la misma transacción (sin commit aún) ────────
    if not payload.omitir_inventario:
        for item in items_activos:
            prod = productos_locked.get(item.producto_id)
            if not prod or prod.es_servicio or getattr(prod, "requiere_cocina", False):
                continue
            try:
                crud.create_movement(db, empresa_id=user.empresa_id, payload=schemas.InventoryMovementCreate(
                    producto_id=item.producto_id,
                    tipo=schemas.MovementType.salida,
                    cantidad=item.cantidad,
                    costo_unitario=prod.costo or 0.0,
                    motivo="venta restaurante",
                    referencia=f"venta #{venta.id}",
                    usuario_id=user.id,
                ), commit=False)
            except (ValueError, HTTPException) as e:
                db.rollback()
                raise HTTPException(status_code=400, detail=str(e))

    # ── 4. Actualizar estados y hacer commit atómico ───────────────────────────
    for item in comanda.items:
        if item.estado != "cancelado":
            item.estado = "entregado"

    comanda.estado = "cerrada"
    comanda.venta_id = venta.id
    comanda.fecha_cierre = datetime.now(timezone.utc)
    comanda.mesa.estado = "libre"

    db.commit()

    return {
        "status": "ok",
        "venta_id": venta.id,
        "total": total_con_propina,
        "mesa": comanda.mesa.numero,
        "comanda": comanda.numero_comanda,
    }


@router.patch("/comandas/{comanda_id}/solicitar-cuenta")
def solicitar_cuenta(
    comanda_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    """Mesero solicita la cuenta: el cliente irá a pagar a la caja."""
    comanda = _comanda_or_404(db, user.empresa_id, comanda_id)
    if comanda.estado == "en_cuenta":
        return _ser_comanda(comanda)
    if comanda.estado in ("cerrada", "cancelada"):
        raise HTTPException(status_code=400, detail=f"La comanda ya está {comanda.estado}.")
    comanda.estado = "en_cuenta"
    comanda.mesa.estado = "en_cuenta"
    db.commit()
    db.refresh(comanda)
    return _ser_comanda(comanda)


@router.patch("/comandas/{comanda_id}/reabrir-cuenta")
def reabrir_cuenta(
    comanda_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    """Revertir una comanda de 'en_cuenta' a 'lista' si el cliente vuelve a la mesa."""
    comanda = _comanda_or_404(db, user.empresa_id, comanda_id)
    if comanda.estado != "en_cuenta":
        raise HTTPException(status_code=400, detail="Solo se puede reabrir una comanda en estado 'en_cuenta'.")
    comanda.estado = "lista"
    comanda.mesa.estado = "ocupada"
    db.commit()
    db.refresh(comanda)
    return _ser_comanda(comanda)


@router.get("/caja/pendientes")
def caja_pendientes(
    buscar: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    """Cajero: lista comandas en estado 'en_cuenta' pendientes de cobro."""
    from sqlalchemy import cast, String, or_

    q = db.query(models.Comanda).filter(
        models.Comanda.empresa_id == user.empresa_id,
        models.Comanda.estado == "en_cuenta",
    )
    if buscar and buscar.strip():
        term = buscar.strip()
        q = q.join(models.Mesa, models.Comanda.mesa_id == models.Mesa.id).filter(
            or_(
                models.Mesa.numero.ilike(f"%{term}%"),
                cast(models.Comanda.numero_comanda, String).ilike(f"%{term}%"),
            )
        )
    return [_ser_comanda(c) for c in q.order_by(models.Comanda.fecha_apertura).all()]


@router.patch("/comandas/{comanda_id}/cancelar", status_code=200)
def cancelar_comanda(
    comanda_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    comanda = _comanda_or_404(db, user.empresa_id, comanda_id)
    if comanda.estado in ("cerrada", "cancelada"):
        raise HTTPException(status_code=400, detail="La comanda ya está cerrada o cancelada.")
    comanda.estado = "cancelada"
    comanda.mesa.estado = "libre"
    comanda.fecha_cierre = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
# PANTALLA COCINA
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/cocina")
def pantalla_cocina(
    area: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    """
    Devuelve todos los ítems pendientes/en_preparacion agrupados por comanda.
    Es el feed en tiempo real de la cocina — se consulta con polling cada 10s.
    """
    q = db.query(models.ComandaItem).join(models.Comanda).filter(
        models.Comanda.empresa_id == user.empresa_id,
        models.Comanda.estado.in_(["enviada", "lista", "abierta"]),
        models.ComandaItem.estado.in_(["pendiente", "en_preparacion"]),
        models.ComandaItem.va_a_cocina == True,
    )
    if area:
        q = q.filter(models.ComandaItem.area_cocina == area)

    items = q.order_by(models.ComandaItem.timestamp_pedido).all()

    # Agrupar por comanda
    comandas_map: dict = {}
    for item in items:
        cid = item.comanda_id
        if cid not in comandas_map:
            c = item.comanda
            comandas_map[cid] = {
                "comanda_id": c.id,
                "numero_comanda": c.numero_comanda,
                "mesa_numero": c.mesa.numero if c.mesa else "—",
                "mesa_zona": c.mesa.zona if c.mesa else None,
                "mesero": c.mesero.nombre_completo if c.mesero else "—",
                "fecha_apertura": c.fecha_apertura.isoformat() if c.fecha_apertura else None,
                "items": [],
            }
        comandas_map[cid]["items"].append(_ser_item(item))

    return list(comandas_map.values())


@router.patch("/cocina/items/{item_id}")
def cocina_actualizar_item(
    item_id: int,
    payload: ItemEstadoUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    """Cocinero marca un ítem como en_preparacion o listo."""
    item = db.query(models.ComandaItem).join(models.Comanda).filter(
        models.ComandaItem.id == item_id,
        models.Comanda.empresa_id == user.empresa_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado.")

    VALID_COCINA = {"en_preparacion", "listo"}
    if payload.estado not in VALID_COCINA:
        raise HTTPException(status_code=400, detail=f"Desde cocina solo puedes marcar: {VALID_COCINA}")

    item.estado = payload.estado
    if payload.estado == "listo":
        item.timestamp_listo = datetime.now(timezone.utc)

    # Si todos listos → comanda pasa a "lista"
    comanda = item.comanda
    activos = [i for i in comanda.items if i.estado != "cancelado"]
    if activos and all(i.estado in ("listo", "entregado") for i in activos):
        comanda.estado = "lista"

    db.commit()
    return {"ok": True, "item_id": item_id, "estado": payload.estado}
