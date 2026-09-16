from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import HTTPException
import models, schemas
from crud.common import BOGOTA_TZ
from crud.parqueadero.config import _enriquecer_vehiculo, get_or_create_parq_config


def get_vehiculo(db: Session, empresa_id: int, vehiculo_id: int) -> Optional[models.Vehiculo]:
    return (
        db.query(models.Vehiculo)
        .options(joinedload(models.Vehiculo.cliente))
        .filter(
            models.Vehiculo.id == vehiculo_id,
            models.Vehiculo.empresa_id == empresa_id,
        )
        .first()
    )


def get_vehiculo_por_placa(db: Session, empresa_id: int, placa: str) -> Optional[models.Vehiculo]:
    placa_norm = placa.strip().upper().replace(" ", "").replace("-", "")
    return (
        db.query(models.Vehiculo)
        .options(joinedload(models.Vehiculo.cliente))
        .filter(
            models.Vehiculo.empresa_id == empresa_id,
            models.Vehiculo.placa == placa_norm,
        )
        .first()
    )


def list_vehiculos(
    db: Session, empresa_id: int, skip: int = 0, limit: int = 200,
    search: Optional[str] = None, solo_activos: bool = True,
) -> List[dict]:
    q = (
        db.query(models.Vehiculo)
        .options(joinedload(models.Vehiculo.cliente))
        .filter(models.Vehiculo.empresa_id == empresa_id)
    )
    if solo_activos:
        q = q.filter(models.Vehiculo.is_active == True)
    if search:
        s = f"%{search.strip().upper()}%"
        q = q.outerjoin(models.Cliente, models.Vehiculo.cliente_id == models.Cliente.id).filter(
            or_(
                models.Vehiculo.placa.ilike(s),
                models.Cliente.nombre.ilike(s),
                models.Cliente.cedula.ilike(s),
            )
        )
    vehiculos = q.order_by(models.Vehiculo.created_at.desc()).offset(skip).limit(limit).all()
    return [_enriquecer_vehiculo(v) for v in vehiculos]


def create_vehiculo(
    db: Session, empresa_id: int, payload: schemas.VehiculoCreate
) -> models.Vehiculo:
    # Validar que el cliente existe y pertenece a la empresa
    from crud.clientes import get_cliente
    cliente = get_cliente(db, empresa_id, payload.cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Propietario no encontrado en esta empresa.")

    # Validar placa única
    existente = get_vehiculo_por_placa(db, empresa_id, payload.placa)
    if existente:
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe un vehículo con placa {payload.placa} en este parqueadero."
        )

    veh = models.Vehiculo(empresa_id=empresa_id, **payload.dict())
    db.add(veh)
    db.commit()
    db.refresh(veh)
    return veh


def update_vehiculo(
    db: Session, empresa_id: int, vehiculo_id: int, payload: schemas.VehiculoUpdate
) -> Optional[models.Vehiculo]:
    veh = get_vehiculo(db, empresa_id, vehiculo_id)
    if not veh:
        return None

    data = payload.dict(exclude_unset=True)

    # Si se cambia la placa, validar unicidad
    if "placa" in data and data["placa"] != veh.placa:
        otro = get_vehiculo_por_placa(db, empresa_id, data["placa"])
        if otro and otro.id != vehiculo_id:
            raise HTTPException(status_code=400, detail="Ya existe otro vehículo con esa placa.")

    for k, v in data.items():
        setattr(veh, k, v)
    db.commit()
    db.refresh(veh)
    return veh


def delete_vehiculo(db: Session, empresa_id: int, vehiculo_id: int) -> bool:
    """
    🛠️ DEPRECATED en favor de dar_baja_vehiculo() con flags.
    Esta versión solo permite dar de baja si NO hay actividad pendiente.
    Para casos con suscripciones activas o accesos abiertos, usar el nuevo flow.
    """
    veh = get_vehiculo(db, empresa_id, vehiculo_id)
    if not veh:
        return False
    if not veh.is_active:
        return True   # ya está inactiva, idempotente

    # Verificar que no haya nada pendiente
    from crud.parqueadero.reportes import get_baja_info
    info = get_baja_info(db, empresa_id, vehiculo_id)
    if not info["puede_dar_baja_directo"]:
        raise HTTPException(
            status_code=409,   # 409 Conflict
            detail={
                "msg": "El vehículo tiene actividad pendiente. Usa el flujo nuevo de baja con confirmación.",
                "advertencias":           info["advertencias"],
                "saldo_total_pendiente":  info["saldo_total_pendiente"],
                "requiere_confirmacion":  True,
            }
        )

    veh.is_active   = False
    veh.fecha_baja  = datetime.now(timezone.utc)
    db.commit()
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# 5. NUEVA — dar_baja_vehiculo (transacción atómica con flags)
#    REEMPLAZA tu delete_vehiculo viejo por este nuevo
# ═══════════════════════════════════════════════════════════════════════════════

def dar_baja_vehiculo(
    db: Session, empresa_id: int, usuario_id: int,
    vehiculo_id: int, payload: schemas.DarBajaRequest,
) -> dict:
    """
    Da de baja un vehículo aplicando los flags que el usuario marcó en el
    diálogo. TODO se ejecuta en una transacción atómica: si algo falla,
    nada se aplica.

    Reglas:
      - Si hay suscripciones activas pero cancelar_suscripciones=False → error 400
      - Si hay accesos abiertos pero ni cerrar_accesos_abiertos ni
        cobrar_acceso_abierto están activos → error 400
      - cobrar_acceso_abierto tiene prioridad sobre cerrar_accesos_abiertos
        (si ambos están en True, se cobra)
    """
    veh = get_vehiculo(db, empresa_id, vehiculo_id)
    if not veh:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")
    if not veh.is_active:
        raise HTTPException(status_code=400, detail="Este vehículo ya está dado de baja.")

    hoy = datetime.now(BOGOTA_TZ).date()

    # ── Validar consistencia ANTES de hacer cambios ──────────────────────────
    suscripciones_activas = (
        db.query(models.SuscripcionParqueadero)
        .filter(
            models.SuscripcionParqueadero.empresa_id == empresa_id,
            models.SuscripcionParqueadero.vehiculo_id == vehiculo_id,
            models.SuscripcionParqueadero.estado != "cancelada",
        )
        .all()
    )
    # Filtrar a las relevantes (vigentes o con saldo)
    suscripciones_a_actuar = [
        s for s in suscripciones_activas
        if s.fecha_vencimiento >= hoy or (s.monto_total or 0) > (s.monto_pagado or 0)
    ]

    accesos_abiertos = db.query(models.AccesoParqueadero).filter(
        models.AccesoParqueadero.empresa_id == empresa_id,
        models.AccesoParqueadero.vehiculo_id == vehiculo_id,
        models.AccesoParqueadero.estado == "dentro",
    ).all()

    if suscripciones_a_actuar and not payload.cancelar_suscripciones:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Este vehículo tiene {len(suscripciones_a_actuar)} suscripción(es) activa(s). "
                f"Marca 'cancelar suscripciones' para continuar."
            )
        )

    if accesos_abiertos and not (payload.cerrar_accesos_abiertos or payload.cobrar_acceso_abierto):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Este vehículo tiene {len(accesos_abiertos)} acceso(s) por horas abierto(s). "
                f"Indica si cobrar o cerrar sin cobrar."
            )
        )

    # ── Ejecutar todo en una transacción ─────────────────────────────────────
    suscripciones_canceladas = 0
    accesos_cerrados = 0
    accesos_cobrados = 0
    monto_cobrado_accesos = 0.0
    saldo_marcado_incobrable = 0.0
    accesos_a_facturar = []  # (acceso, monto, minutos) — generan Venta tras el commit

    try:
        # 1. Cancelar suscripciones (si así lo pidió)
        if payload.cancelar_suscripciones:
            for s in suscripciones_a_actuar:
                saldo = (s.monto_total or 0) - (s.monto_pagado or 0)
                s.estado = "cancelada"
                obs_extra = f" | Cancelada por baja de vehículo"
                if payload.marcar_saldo_incobrable and saldo > 0:
                    obs_extra += f" | Saldo ${saldo:,.0f} marcado como incobrable"
                    saldo_marcado_incobrable += saldo
                if payload.motivo:
                    obs_extra += f" | Motivo: {payload.motivo}"
                s.observaciones = (s.observaciones or "") + obs_extra
                suscripciones_canceladas += 1

        # 2. Manejar accesos abiertos
        if accesos_abiertos:
            cfg = get_or_create_parq_config(db, empresa_id)
            ahora = datetime.now(timezone.utc)

            for a in accesos_abiertos:
                if payload.cobrar_acceso_abierto:
                    # Cobrar y cerrar con el MISMO cálculo que la salida normal
                    # (tarifa plena/minuto + mínimos). Antes se cobraba siempre
                    # por minuto plano, ignorando la configuración.
                    import math
                    from crud.parqueadero.reportes import _calcular_monto_estimado
                    entrada = a.fecha_entrada
                    if entrada.tzinfo is None:
                        entrada = entrada.replace(tzinfo=timezone.utc)
                    delta = ahora - entrada
                    minutos_reales = max(1, math.ceil(delta.total_seconds() / 60))
                    minutos_cobrar, monto = _calcular_monto_estimado(cfg, minutos_reales)

                    a.fecha_salida     = ahora
                    a.minutos_cobrados = minutos_cobrar
                    a.horas_cobradas   = round(minutos_cobrar / 60, 2)
                    a.monto_cobrado    = monto
                    a.metodo_pago      = payload.metodo_pago_acceso or "Efectivo"
                    a.estado           = "salio"
                    a.observaciones    = (a.observaciones or "") + " | Cerrado por baja del vehículo (cobrado)"

                    accesos_cobrados += 1
                    monto_cobrado_accesos += monto
                    accesos_a_facturar.append((a, monto, minutos_cobrar))
                else:
                    # Cerrar sin cobrar
                    a.fecha_salida     = ahora
                    a.minutos_cobrados = 0
                    a.horas_cobradas   = 0
                    a.monto_cobrado    = 0
                    a.estado           = "salio"
                    a.observaciones    = (a.observaciones or "") + " | Cerrado por baja del vehículo (sin cobro)"
                    accesos_cerrados += 1

        # 3. Marcar el vehículo como inactivo + auditoría
        veh.is_active   = False
        veh.fecha_baja  = datetime.now(timezone.utc)
        veh.motivo_baja = (payload.motivo or "")[:500] if payload.motivo else None

        # 4. Commit todo de una vez
        db.commit()

        # 5. Si entró dinero, cada acceso cobrado genera su Venta (con
        #    consecutivo, asiento contable y documento DIAN), IGUAL que la
        #    salida normal. Antes el dinero quedaba solo en el acceso y no
        #    aparecía en ventas/contabilidad/FE.
        if accesos_a_facturar:
            import models as _models
            from crud import ventas as _crud_ventas
            from crud.consecutivos import next_consecutivo
            metodo = payload.metodo_pago_acceso or "Efectivo"
            for a, monto_v, minutos_v in accesos_a_facturar:
                try:
                    venta_parq = _models.Venta(
                        numero_venta = next_consecutivo(db, empresa_id, "ultimo_numero_venta"),
                        empresa_id   = empresa_id,
                        total        = monto_v,
                        monto_pagado = monto_v,
                        estado_pago  = "pagado",
                        metodo_pago  = metodo,
                        origen       = "parqueadero_horas",
                        tipo         = "venta",
                        placa_vehiculo = a.placa or '',
                        fecha_pago   = datetime.now(timezone.utc),
                        solicita_fe  = False,
                        observaciones = f"Acceso cobrado al dar de baja el vehículo | Placa: {a.placa} | {minutos_v} min",
                    )
                    db.add(venta_parq)
                    db.commit()
                    db.refresh(venta_parq)

                    try:
                        from services.contabilidad import registrar_asiento_venta
                        registrar_asiento_venta(db, venta_parq)
                        db.commit()
                    except Exception:
                        db.rollback()

                    detalle = _crud_ventas._DetalleSintetico(
                        descripcion=f"Parqueadero {minutos_v} min — Placa {a.placa} (baja de vehículo)",
                        monto=float(monto_v),
                    )
                    _crud_ventas.emitir_fe_venta(db, empresa_id, venta_parq, [detalle], cliente=None)
                    db.commit()
                except Exception:
                    # La baja ya quedó registrada; un fallo al facturar no debe
                    # revertirla. El acceso conserva el monto para conciliación.
                    db.rollback()

    except HTTPException:
        db.rollback()
        raise
    except Exception as ex:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error al dar de baja: {str(ex)}"
        )

    # ── Construir respuesta ──────────────────────────────────────────────────
    partes_msg = [f"Vehículo {veh.placa} dado de baja."]
    if suscripciones_canceladas:
        partes_msg.append(f"{suscripciones_canceladas} suscripción(es) cancelada(s).")
    if accesos_cobrados:
        partes_msg.append(f"{accesos_cobrados} acceso(s) cobrado(s) por ${monto_cobrado_accesos:,.0f}.")
    if accesos_cerrados:
        partes_msg.append(f"{accesos_cerrados} acceso(s) cerrado(s) sin cobro.")
    if saldo_marcado_incobrable > 0:
        partes_msg.append(f"${saldo_marcado_incobrable:,.0f} marcado(s) como incobrable.")

    return {
        "vehiculo_id":              veh.id,
        "placa":                    veh.placa,
        "suscripciones_canceladas": suscripciones_canceladas,
        "accesos_cerrados":         accesos_cerrados,
        "accesos_cobrados":         accesos_cobrados,
        "monto_cobrado_accesos":    monto_cobrado_accesos,
        "saldo_marcado_incobrable": saldo_marcado_incobrable,
        "mensaje":                  " ".join(partes_msg),
    }
