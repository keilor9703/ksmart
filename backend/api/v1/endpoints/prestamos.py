from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, Field, validator

import crud
import models
import schemas
from api.deps import get_db, get_current_active_user, get_current_admin_user

router = APIRouter()

# --- Schemas inline para el módulo de préstamos ---

class PagoCuotaRequest(BaseModel):
    monto_pagado: float = Field(..., gt=0, description="Monto a aplicar. Debe ser mayor a cero.")
    metodo_pago:  str   = Field("Efectivo", description="Efectivo, Transferencia, Nequi, Tarjeta")

class ReprogramarCuotaRequest(BaseModel):
    nueva_fecha: datetime

    @validator('nueva_fecha')
    def validar_fecha_futura(cls, v):
        ahora = datetime.now(timezone.utc)
        fecha = v if v.tzinfo else v.replace(tzinfo=timezone.utc)
        if fecha < ahora:
            raise ValueError("No puedes reprogramar a una fecha pasada.")
        if (fecha - ahora).days > 365:
            raise ValueError("La fecha no puede ser más de 1 año en el futuro.")
        return v

class AsignacionCobroRequest(BaseModel):
    usuario_id: int
    cuota_ids: Optional[List[int]] = None
    cliente_id: Optional[int] = None

class AbonoCapitalRequest(BaseModel):
    monto_abono: float = Field(..., gt=0, description="Monto a aplicar al capital")

# --- Endpoints ---

@router.post("/", response_model=schemas.PrestamoResponse)
def crear_nuevo_prestamo(
    prestamo: schemas.PrestamoCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    cliente = db.query(models.Cliente).filter(
        models.Cliente.id == prestamo.cliente_id,
        models.Cliente.empresa_id == current_user.empresa_id
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado o no pertenece a tu empresa.")
    return crud.crear_prestamo(db=db, prestamo=prestamo, empresa_id=current_user.empresa_id)

@router.get("/", response_model=List[schemas.PrestamoResponse])
def listar_prestamos(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return (
        db.query(models.Prestamo)
        .filter(models.Prestamo.empresa_id == current_user.empresa_id)
        .order_by(models.Prestamo.fecha_inicio.desc())
        .all()
    )

@router.get("/cuotas-pendientes")
def cuotas_pendientes(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    query = (
        db.query(models.CuotaPrestamo, models.Prestamo, models.Cliente)
        .join(models.Prestamo, models.CuotaPrestamo.prestamo_id == models.Prestamo.id)
        .join(models.Cliente, models.Prestamo.cliente_id == models.Cliente.id)
        .filter(
            models.CuotaPrestamo.empresa_id == current_user.empresa_id,
            models.CuotaPrestamo.estado_pago != "Pagado"
        )
    )
    if current_user.role.name != "Admin":
        query = query.filter(models.CuotaPrestamo.usuario_asignado_id == current_user.id)

    cuotas = query.order_by(models.CuotaPrestamo.fecha_vencimiento.asc()).all()

    return [
        {
            "cuota_id": cuota.id, "prestamo_id": prestamo.id,
            "numero_cuota": cuota.numero_cuota, "monto_cuota": cuota.monto_cuota,
            "saldo_pendiente": cuota.saldo_pendiente, "fecha_vencimiento": cuota.fecha_vencimiento,
            "estado_pago": cuota.estado_pago, "cliente_nombre": cliente.nombre,
            "cliente_telefono": cliente.telefono, "cliente_direccion": cliente.direccion,
            "cliente_id": cliente.id, "usuario_asignado_id": cuota.usuario_asignado_id
        }
        for cuota, prestamo, cliente in cuotas
    ]

@router.post("/cuotas/{cuota_id}/pagar")
def pagar_cuota_cascada(
    cuota_id: int,
    req: PagoCuotaRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    if req.monto_pagado > 999_999_999:
        raise HTTPException(status_code=400, detail="Monto sospechosamente alto.")

    cuota_inicial = db.query(models.CuotaPrestamo).filter(
        models.CuotaPrestamo.id == cuota_id,
        models.CuotaPrestamo.empresa_id == current_user.empresa_id
    ).first()
    if not cuota_inicial:
        raise HTTPException(status_code=404, detail="Cuota no encontrada")

    monto_disponible = req.monto_pagado
    total_recibido = req.monto_pagado

    cuotas_pendientes_list = (
        db.query(models.CuotaPrestamo)
        .filter(
            models.CuotaPrestamo.prestamo_id == cuota_inicial.prestamo_id,
            models.CuotaPrestamo.estado_pago != "Pagado"
        )
        .order_by(models.CuotaPrestamo.numero_cuota.asc())
        .all()
    )

    cuotas_afectadas = 0
    for cuota in cuotas_pendientes_list:
        if monto_disponible <= 0:
            break
        saldo_actual = cuota.saldo_pendiente
        cuotas_afectadas += 1
        if monto_disponible >= saldo_actual:
            monto_disponible -= saldo_actual
            cuota.saldo_pendiente = 0
            cuota.estado_pago = "Pagado"
            cuota.fecha_pago = datetime.now(crud.BOGOTA_TZ)
            cuota.metodo_pago = req.metodo_pago
        else:
            cuota.saldo_pendiente -= monto_disponible
            cuota.estado_pago = "Parcial"
            cuota.fecha_pago = datetime.now(crud.BOGOTA_TZ)
            cuota.metodo_pago = req.metodo_pago
            monto_disponible = 0

    db.commit()
    return {
        "msg": "Pago procesado",
        "monto_total_recibido": total_recibido,
        "cuotas_afectadas": cuotas_afectadas
    }

@router.post("/cuotas/{cuota_id}/reprogramar")
def reprogramar_cuota(
    cuota_id: int,
    req: ReprogramarCuotaRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    cuota = db.query(models.CuotaPrestamo).filter(
        models.CuotaPrestamo.id == cuota_id,
        models.CuotaPrestamo.empresa_id == current_user.empresa_id
    ).first()
    if not cuota:
        raise HTTPException(status_code=404, detail="Cuota no encontrada")
    cuota.fecha_vencimiento = req.nueva_fecha
    db.commit()
    return {"msg": "Cuota reprogramada exitosamente"}

@router.post("/asignar-cobrador")
def asignar_cobrador(
    req: AsignacionCobroRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    if current_user.role.name != "Admin":
        raise HTTPException(status_code=403, detail="Solo el administrador puede asignar rutas")

    query = db.query(models.CuotaPrestamo).filter(
        models.CuotaPrestamo.empresa_id == current_user.empresa_id
    )
    if req.cliente_id:
        query = query.join(models.Prestamo).filter(
            models.Prestamo.cliente_id == req.cliente_id,
            models.CuotaPrestamo.estado_pago != "Pagado"
        )
    elif req.cuota_ids:
        query = query.filter(models.CuotaPrestamo.id.in_(req.cuota_ids))
    else:
        raise HTTPException(status_code=400, detail="Debe proporcionar cuotas o un cliente")

    cuotas_a_actualizar = query.all()
    for c in cuotas_a_actualizar:
        c.usuario_asignado_id = req.usuario_id
    db.commit()
    return {"msg": f"{len(cuotas_a_actualizar)} cobros asignados correctamente"}

@router.get("/calendario-resumen")
def calendario_resumen(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.get_calendario_cobros(db, current_user.empresa_id)

@router.post("/{prestamo_id}/abono-capital")
def abono_capital(
    prestamo_id: int,
    req: AbonoCapitalRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    if req.monto_abono > 999_999_999:
        raise HTTPException(status_code=400, detail="Monto sospechosamente alto")

    resultado = crud.aplicar_abono_capital(
        db,
        empresa_id=current_user.empresa_id,
        prestamo_id=prestamo_id,
        monto_abono=req.monto_abono,
    )

    try:
        cuota_huella = (
            db.query(models.CuotaPrestamo)
            .filter(
                models.CuotaPrestamo.prestamo_id == prestamo_id,
                models.CuotaPrestamo.empresa_id  == current_user.empresa_id,
            )
            .order_by(models.CuotaPrestamo.numero_cuota.asc())
            .first()
        )

        if cuota_huella:
            cuota_huella.metodo_pago = "Abono Capital"
            cuota_huella.fecha_pago  = datetime.now(crud.BOGOTA_TZ)
            db.commit()

    except Exception:
        pass

    return resultado

@router.get("/{prestamo_id}/mora")
def resumen_mora_prestamo(
    prestamo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    prestamo = db.query(models.Prestamo).filter(
        models.Prestamo.id         == prestamo_id,
        models.Prestamo.empresa_id == current_user.empresa_id,
    ).first()
    if not prestamo:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    cuotas = db.query(models.CuotaPrestamo).filter(
        models.CuotaPrestamo.prestamo_id == prestamo_id,
        models.CuotaPrestamo.estado_pago != "Pagado",
    ).all()

    detalle = []
    total_mora = 0.0
    for c in cuotas:
        info = crud.calcular_mora_cuota(c, prestamo.tasa_mora)
        total_mora += info["mora"]
        detalle.append({
            "cuota_id":       c.id,
            "numero_cuota":   c.numero_cuota,
            "saldo_pendiente": c.saldo_pendiente,
            "dias_vencido":   info["dias"],
            "mora":           info["mora"],
            "total_a_pagar":  info["total"],
        })

    return {
        "prestamo_id":  prestamo_id,
        "tasa_mora_mensual": prestamo.tasa_mora,
        "total_mora_acumulada": round(total_mora, 2),
        "cuotas_en_mora": [d for d in detalle if d["dias_vencido"] > 0],
    }

@router.get("/liquidacion-diaria")
def liquidacion_diaria_ruta(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    if current_user.role.name != "Admin":
        raise HTTPException(status_code=403, detail="Solo el Admin puede ver la liquidación")

    hoy = datetime.now(timezone.utc).date()

    cuotas_pagadas = (
        db.query(models.CuotaPrestamo)
        .options(
            joinedload(models.CuotaPrestamo.cobrador),
            joinedload(models.CuotaPrestamo.prestamo)
        )
        .filter(
            models.CuotaPrestamo.empresa_id == current_user.empresa_id,
            models.CuotaPrestamo.fecha_pago != None
        )
        .all()
    )

    resumen_cobradores = {}
    total_global = 0.0

    for c in cuotas_pagadas:
        if c.fecha_pago.date() != hoy:
            continue
        cobrador_id = c.usuario_asignado_id or 0
        cobrador_nombre = c.cobrador.username if c.cobrador else "Sin asignar"
        monto_recaudado = c.monto_cuota - c.saldo_pendiente

        if cobrador_id not in resumen_cobradores:
            resumen_cobradores[cobrador_id] = {
                "cobrador_id": cobrador_id,
                "cobrador_nombre": cobrador_nombre.upper(),
                "total_recaudado": 0.0,
                "cuotas_cobradas": 0
            }
        resumen_cobradores[cobrador_id]["total_recaudado"] += monto_recaudado
        resumen_cobradores[cobrador_id]["cuotas_cobradas"] += 1
        total_global += monto_recaudado

    return {
        "fecha": hoy.isoformat(),
        "total_global": total_global,
        "cobradores": list(resumen_cobradores.values())
    }

from reportlab.lib.pagesizes import A6
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.lib import colors
import io as _io

@router.get("/cuotas/{cuota_id}/recibo-pdf")
def descargar_recibo_pdf(
    cuota_id: int,
    monto_pagado: float,
    saldo_restante: float = 0.0,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    cuota = (
        db.query(models.CuotaPrestamo)
        .join(models.Prestamo)
        .join(models.Cliente)
        .filter(
            models.CuotaPrestamo.id == cuota_id,
            models.CuotaPrestamo.empresa_id == current_user.empresa_id,
        )
        .first()
    )
    if not cuota:
        raise HTTPException(status_code=404, detail="Cuota no encontrada")

    prestamo       = cuota.prestamo
    cliente        = prestamo.cliente
    empresa        = current_user.empresa
    ahora          = datetime.now(crud.BOGOTA_TZ)
    fecha_str      = ahora.strftime("%d/%m/%Y %H:%M")
    vence_str      = cuota.fecha_vencimiento.strftime("%d/%m/%Y") if cuota.fecha_vencimiento else "—"

    def fmt_cop(val: float) -> str:
        return f"$ {val:,.0f}".replace(",", ".")

    buffer = _io.BytesIO()
    W, H = 80 * mm, 140 * mm
    c = pdf_canvas.Canvas(buffer, pagesize=(W, H))

    GRAY    = colors.HexColor("#64748b")
    DARK    = colors.HexColor("#0f172a")
    ORANGE  = colors.HexColor("#FF6020")
    GREEN   = colors.HexColor("#10B981")
    RED     = colors.HexColor("#EF4444")

    def line_h(y, color=GRAY, width=0.5):
        c.setStrokeColor(color)
        c.setLineWidth(width)
        c.line(5 * mm, y, W - 5 * mm, y)

    y = H - 8 * mm

    # Cabecera
    c.setFillColor(ORANGE)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(W / 2, y, "KSMART360")
    y -= 5 * mm

    c.setFillColor(GRAY)
    c.setFont("Helvetica", 7)
    c.drawCentredString(W / 2, y, empresa.nombre.upper())
    y -= 4 * mm

    c.setFont("Helvetica", 7)
    c.drawCentredString(W / 2, y, "RECIBO DE PAGO")
    y -= 3 * mm

    line_h(y, ORANGE, 1)
    y -= 5 * mm

    # Filas de datos
    def row(label: str, value: str, bold_val: bool = False, val_color=DARK):
        nonlocal y
        c.setFillColor(GRAY)
        c.setFont("Helvetica", 7)
        c.drawString(5 * mm, y, label)
        c.setFillColor(val_color)
        c.setFont("Helvetica-Bold" if bold_val else "Helvetica", 7)
        c.drawRightString(W - 5 * mm, y, value)
        y -= 4.5 * mm

    row("Recibo N°",   f"{cuota_id:06d}")
    row("Fecha",       fecha_str)
    row("Empresa",     empresa.nombre[:28])
    y -= 1 * mm
    line_h(y)
    y -= 4 * mm

    row("Cliente",     cliente.nombre[:28])
    row("Préstamo #",  str(prestamo.id))
    row("Cuota #",     f"{cuota.numero_cuota} de {prestamo.cantidad_cuotas}")
    row("Vencimiento", vence_str)
    y -= 1 * mm
    line_h(y)
    y -= 5 * mm

    # Montos
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 7)
    c.drawCentredString(W / 2, y, "DETALLE DEL PAGO")
    y -= 5 * mm

    row("Valor recibido", fmt_cop(monto_pagado), bold_val=True, val_color=GREEN)

    if saldo_restante > 0:
        row("Saldo pendiente", fmt_cop(saldo_restante), val_color=ORANGE)
    else:
        row("Estado cuota", "SALDADA ✓", bold_val=True, val_color=GREEN)

    y -= 2 * mm
    line_h(y, ORANGE, 0.8)
    y -= 6 * mm

    # Monto grande central
    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(W / 2, y, fmt_cop(monto_pagado))
    y -= 5 * mm

    c.setFillColor(GRAY)
    c.setFont("Helvetica", 7)
    c.drawCentredString(W / 2, y, "VALOR RECIBIDO")
    y -= 8 * mm

    line_h(y)
    y -= 5 * mm

    # Footer
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 6)
    c.drawCentredString(W / 2, y, "Gracias por su pago")
    y -= 3.5 * mm
    c.drawCentredString(W / 2, y, f"Powered by KSMP Systems · {ahora.year}")

    c.save()
    buffer.seek(0)

    from fastapi.responses import StreamingResponse
    filename = f"recibo_cuota_{cuota_id}_{ahora.strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
