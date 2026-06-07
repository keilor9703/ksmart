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
    autoservicio: Optional[bool] = None,
    desde: Optional[str] = None,   # ISO datetime — solo comandas más nuevas que este timestamp
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
    if autoservicio is True:
        q = q.filter(models.Comanda.mesero_id == None)
    if desde:
        try:
            from datetime import datetime, timezone
            dt = datetime.fromisoformat(desde.replace('Z', '+00:00'))
            q = q.filter(models.Comanda.fecha_apertura > dt)
        except ValueError:
            pass
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
    modo_impresion = cfg.imprimir_comanda_auto if cfg else False  # True → impresora reemplaza pantalla cocina

    # Cargar overrides por-empresa una sola vez
    from crud.grupos_producto import _get_overrides
    overrides = _get_overrides(db, user.empresa_id)

    ahora = datetime.now(timezone.utc)

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

        # Si el restaurante trabaja con impresora (sin pantalla cocina),
        # los ítems nacen como "listo" para no aparecer en PantallaCocina.
        if modo_impresion:
            va_a_cocina = False

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
            estado="listo" if not va_a_cocina else "pendiente",
            timestamp_listo=ahora if not va_a_cocina else None,
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


# ═══════════════════════════════════════════════════════════════════════════════
# REPORTES
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/reportes/resumen")
def reporte_resumen(
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    """Resumen de ventas del restaurante en el período (comandas cerradas)."""
    from sqlalchemy import func as sqlfunc

    q = db.query(models.Comanda).filter(
        models.Comanda.empresa_id == user.empresa_id,
        models.Comanda.estado == "cerrada",
    )
    if desde:
        try:
            dt = datetime.fromisoformat(desde.replace("Z", "+00:00"))
            q = q.filter(models.Comanda.fecha_cierre >= dt)
        except ValueError:
            pass
    if hasta:
        try:
            dt = datetime.fromisoformat(hasta.replace("Z", "+00:00"))
            q = q.filter(models.Comanda.fecha_cierre <= dt)
        except ValueError:
            pass

    comandas = q.all()

    total_ventas   = sum(c.total or 0 for c in comandas)
    total_comandas = len(comandas)
    ticket_promedio = round(total_ventas / total_comandas, 2) if total_comandas else 0

    # Ventas por día
    por_dia: dict = {}
    for c in comandas:
        if c.fecha_cierre:
            dia = c.fecha_cierre.date().isoformat()
            por_dia[dia] = por_dia.get(dia, 0) + (c.total or 0)
    dias = [{"fecha": k, "total": round(v, 2)} for k, v in sorted(por_dia.items())]

    return {
        "total_ventas": round(total_ventas, 2),
        "total_comandas": total_comandas,
        "ticket_promedio": ticket_promedio,
        "por_dia": dias,
    }


@router.get("/reportes/mesas")
def reporte_mesas(
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    q = db.query(models.Comanda).filter(
        models.Comanda.empresa_id == user.empresa_id,
        models.Comanda.estado == "cerrada",
    )
    if desde:
        try:
            dt = datetime.fromisoformat(desde.replace("Z", "+00:00"))
            q = q.filter(models.Comanda.fecha_cierre >= dt)
        except ValueError:
            pass
    if hasta:
        try:
            dt = datetime.fromisoformat(hasta.replace("Z", "+00:00"))
            q = q.filter(models.Comanda.fecha_cierre <= dt)
        except ValueError:
            pass

    mesas_map: dict = {}
    for c in q.all():
        num = c.mesa.numero if c.mesa else "—"
        if num not in mesas_map:
            mesas_map[num] = {"mesa": num, "zona": c.mesa.zona if c.mesa else None, "total": 0, "comandas": 0}
        mesas_map[num]["total"] += c.total or 0
        mesas_map[num]["comandas"] += 1

    result = sorted(mesas_map.values(), key=lambda x: x["total"], reverse=True)
    for r in result:
        r["total"] = round(r["total"], 2)
    return result


@router.get("/reportes/meseros")
def reporte_meseros(
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    q = db.query(models.Comanda).filter(
        models.Comanda.empresa_id == user.empresa_id,
        models.Comanda.estado == "cerrada",
        models.Comanda.mesero_id != None,
    )
    if desde:
        try:
            dt = datetime.fromisoformat(desde.replace("Z", "+00:00"))
            q = q.filter(models.Comanda.fecha_cierre >= dt)
        except ValueError:
            pass
    if hasta:
        try:
            dt = datetime.fromisoformat(hasta.replace("Z", "+00:00"))
            q = q.filter(models.Comanda.fecha_cierre <= dt)
        except ValueError:
            pass

    meseros_map: dict = {}
    for c in q.all():
        mid = c.mesero_id
        if mid not in meseros_map:
            nombre = c.mesero.nombre_completo if c.mesero else f"Usuario #{mid}"
            meseros_map[mid] = {"mesero_id": mid, "nombre": nombre, "total": 0, "comandas": 0}
        meseros_map[mid]["total"] += c.total or 0
        meseros_map[mid]["comandas"] += 1

    result = sorted(meseros_map.values(), key=lambda x: x["total"], reverse=True)
    for r in result:
        r["total"] = round(r["total"], 2)
    return result


@router.get("/reportes/productos")
def reporte_productos(
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    q = db.query(models.ComandaItem).join(models.Comanda).filter(
        models.Comanda.empresa_id == user.empresa_id,
        models.Comanda.estado == "cerrada",
        models.ComandaItem.estado != "cancelado",
    )
    if desde:
        try:
            dt = datetime.fromisoformat(desde.replace("Z", "+00:00"))
            q = q.filter(models.Comanda.fecha_cierre >= dt)
        except ValueError:
            pass
    if hasta:
        try:
            dt = datetime.fromisoformat(hasta.replace("Z", "+00:00"))
            q = q.filter(models.Comanda.fecha_cierre <= dt)
        except ValueError:
            pass

    prods_map: dict = {}
    for item in q.all():
        nombre = item.nombre_producto
        if nombre not in prods_map:
            prods_map[nombre] = {"nombre": nombre, "cantidad": 0, "total": 0}
        prods_map[nombre]["cantidad"] += item.cantidad
        prods_map[nombre]["total"] += item.subtotal or 0

    result = sorted(prods_map.values(), key=lambda x: x["cantidad"], reverse=True)
    for r in result:
        r["total"] = round(r["total"], 2)
    return result[:30]


# ═══════════════════════════════════════════════════════════════════════════════
# TURNO
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/turno/resumen")
def resumen_turno(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    """Resumen del turno actual: ventas del día de hoy."""
    from sqlalchemy import func as sqlfunc

    hoy = datetime.now(timezone.utc).date()

    comandas_hoy = db.query(models.Comanda).filter(
        models.Comanda.empresa_id == user.empresa_id,
        models.Comanda.estado == "cerrada",
        sqlfunc.date(models.Comanda.fecha_cierre) == hoy,
    ).all()

    total = sum(c.total or 0 for c in comandas_hoy)
    num_comandas = len(comandas_hoy)

    # Desglose por método de pago (desde ventas)
    metodos: dict = {}
    for c in comandas_hoy:
        if c.venta_id:
            venta = db.query(models.Venta).filter(models.Venta.id == c.venta_id).first()
            if venta:
                m = venta.metodo_pago or "Otro"
                metodos[m] = metodos.get(m, 0) + (venta.total or 0)

    # Propinas (extraer de observaciones)
    propina_tarjeta = 0.0
    propina_efectivo = 0.0
    for c in comandas_hoy:
        if c.venta_id:
            venta = db.query(models.Venta).filter(models.Venta.id == c.venta_id).first()
            if venta and venta.observaciones:
                import re
                m1 = re.search(r"Propina tarjeta: \$([0-9]+)", venta.observaciones)
                m2 = re.search(r"Propina efectivo: \$([0-9]+)", venta.observaciones)
                if m1:
                    propina_tarjeta += float(m1.group(1))
                if m2:
                    propina_efectivo += float(m2.group(1))

    # Mesas activas aún abiertas
    mesas_abiertas = db.query(models.Mesa).filter(
        models.Mesa.empresa_id == user.empresa_id,
        models.Mesa.estado.in_(["ocupada", "en_cuenta"]),
        models.Mesa.is_active == True,
    ).count()

    return {
        "fecha": hoy.isoformat(),
        "total_ventas": round(total, 2),
        "num_comandas": num_comandas,
        "ticket_promedio": round(total / num_comandas, 2) if num_comandas else 0,
        "por_metodo": [{"metodo": k, "total": round(v, 2)} for k, v in sorted(metodos.items())],
        "propina_tarjeta": round(propina_tarjeta, 2),
        "propina_efectivo": round(propina_efectivo, 2),
        "mesas_abiertas": mesas_abiertas,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# RESERVAS
# ═══════════════════════════════════════════════════════════════════════════════

class ReservaCreate(BaseModel):
    nombre_cliente: str
    telefono: Optional[str] = None
    fecha: str      # "2025-12-25"
    hora: str       # "19:30"
    personas: int = 2
    mesa_id: Optional[int] = None
    notas: Optional[str] = None


class ReservaUpdate(BaseModel):
    nombre_cliente: Optional[str] = None
    telefono: Optional[str] = None
    fecha: Optional[str] = None
    hora: Optional[str] = None
    personas: Optional[int] = None
    mesa_id: Optional[int] = None
    notas: Optional[str] = None
    estado: Optional[str] = None


def _ser_reserva(r: models.Reserva) -> dict:
    return {
        "id": r.id,
        "nombre_cliente": r.nombre_cliente,
        "telefono": r.telefono,
        "fecha": r.fecha.isoformat() if r.fecha else None,
        "hora": r.hora,
        "personas": r.personas,
        "mesa_id": r.mesa_id,
        "mesa_numero": r.mesa.numero if r.mesa else None,
        "notas": r.notas,
        "estado": r.estado,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/reservas")
def listar_reservas(
    fecha: Optional[str] = None,
    estado: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    q = db.query(models.Reserva).filter(models.Reserva.empresa_id == user.empresa_id)
    if fecha:
        from datetime import date
        try:
            d = date.fromisoformat(fecha)
            q = q.filter(models.Reserva.fecha == d)
        except ValueError:
            pass
    if estado:
        q = q.filter(models.Reserva.estado == estado)
    return [_ser_reserva(r) for r in q.order_by(models.Reserva.fecha, models.Reserva.hora).all()]


@router.post("/reservas", status_code=201)
def crear_reserva(
    payload: ReservaCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    from datetime import date
    try:
        fecha = date.fromisoformat(payload.fecha)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido (use YYYY-MM-DD).")

    reserva = models.Reserva(
        empresa_id=user.empresa_id,
        mesa_id=payload.mesa_id,
        nombre_cliente=payload.nombre_cliente.strip(),
        telefono=payload.telefono,
        fecha=fecha,
        hora=payload.hora,
        personas=payload.personas,
        notas=payload.notas,
    )
    db.add(reserva)
    if payload.mesa_id:
        mesa = db.query(models.Mesa).filter(
            models.Mesa.id == payload.mesa_id,
            models.Mesa.empresa_id == user.empresa_id,
        ).first()
        if mesa and mesa.estado == "libre":
            mesa.estado = "reservada"
    db.commit()
    db.refresh(reserva)
    return _ser_reserva(reserva)


@router.put("/reservas/{reserva_id}")
def actualizar_reserva(
    reserva_id: int,
    payload: ReservaUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    reserva = db.query(models.Reserva).filter(
        models.Reserva.id == reserva_id,
        models.Reserva.empresa_id == user.empresa_id,
    ).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada.")

    data = payload.dict(exclude_none=True)
    if "fecha" in data:
        from datetime import date
        try:
            data["fecha"] = date.fromisoformat(data["fecha"])
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido.")
    for k, v in data.items():
        setattr(reserva, k, v)

    # Si se cancela o completa, liberar mesa si estaba reservada
    if payload.estado in ("cancelada", "completada") and reserva.mesa_id:
        mesa = db.query(models.Mesa).filter(models.Mesa.id == reserva.mesa_id).first()
        if mesa and mesa.estado == "reservada":
            mesa.estado = "libre"

    db.commit()
    db.refresh(reserva)
    return _ser_reserva(reserva)


@router.delete("/reservas/{reserva_id}", status_code=204)
def eliminar_reserva(
    reserva_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_active_user),
):
    reserva = db.query(models.Reserva).filter(
        models.Reserva.id == reserva_id,
        models.Reserva.empresa_id == user.empresa_id,
    ).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada.")
    db.delete(reserva)
    db.commit()


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
