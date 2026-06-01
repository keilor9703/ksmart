import math
from sqlalchemy.orm import Session
import models

EARN_RATE   = 1000  # COP por punto ganado (1 punto cada $1.000)
REDEEM_RATE = 100   # COP de descuento por punto canjeado (1 punto = $100)


def get_puntos_disponibles(db: Session, empresa_id: int, cliente_id: int) -> int:
    cliente = db.query(models.Cliente).filter(
        models.Cliente.empresa_id == empresa_id,
        models.Cliente.id == cliente_id,
    ).first()
    return int(cliente.puntos_fidelidad or 0) if cliente else 0


def ganar_puntos_venta(
    db: Session,
    empresa_id: int,
    cliente_id: int,
    total_venta: float,
    venta_id: int,
    commit: bool = True,
) -> int:
    puntos = math.floor(total_venta / EARN_RATE)
    if puntos <= 0:
        return 0

    cliente = db.query(models.Cliente).filter(
        models.Cliente.empresa_id == empresa_id,
        models.Cliente.id == cliente_id,
    ).first()
    if not cliente:
        return 0

    cliente.puntos_fidelidad = (cliente.puntos_fidelidad or 0) + puntos
    db.add(cliente)
    db.add(models.MovimientoPuntos(
        empresa_id=empresa_id,
        cliente_id=cliente_id,
        puntos=puntos,
        tipo="ganado",
        venta_id=venta_id,
        descripcion=f"Compra #{venta_id}",
    ))
    if commit:
        db.commit()
    return puntos


def canjear_puntos(
    db: Session,
    empresa_id: int,
    cliente_id: int,
    puntos_a_canjear: int,
    commit: bool = True,
) -> float:
    cliente = db.query(models.Cliente).filter(
        models.Cliente.empresa_id == empresa_id,
        models.Cliente.id == cliente_id,
    ).first()
    if not cliente:
        raise ValueError("Cliente no encontrado")
    disponibles = int(cliente.puntos_fidelidad or 0)
    if disponibles < puntos_a_canjear:
        raise ValueError(f"Puntos insuficientes. Disponibles: {disponibles}")

    descuento = puntos_a_canjear * REDEEM_RATE
    cliente.puntos_fidelidad = disponibles - puntos_a_canjear
    db.add(cliente)
    db.add(models.MovimientoPuntos(
        empresa_id=empresa_id,
        cliente_id=cliente_id,
        puntos=-puntos_a_canjear,
        tipo="canjeado",
        descripcion=f"Canje de {puntos_a_canjear} puntos (${descuento:,.0f} de descuento)",
    ))
    if commit:
        db.commit()
    return float(descuento)


def get_historial_puntos(
    db: Session,
    empresa_id: int,
    cliente_id: int,
    limit: int = 20,
):
    return (
        db.query(models.MovimientoPuntos)
        .filter(
            models.MovimientoPuntos.empresa_id == empresa_id,
            models.MovimientoPuntos.cliente_id == cliente_id,
        )
        .order_by(models.MovimientoPuntos.created_at.desc())
        .limit(limit)
        .all()
    )
