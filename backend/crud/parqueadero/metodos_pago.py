import re
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import HTTPException
import models, schemas


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _normalizar_telefono_whatsapp(telefono: str) -> Optional[str]:
    """
    Convierte un teléfono colombiano a formato E.164 sin '+', listo para wa.me/.
    Ejemplos:
      "300 123 4567"   → "573001234567"
      "+57 300 123..."  → "573001234567"
      "3001234567"      → "573001234567"
      "57 3001234567"   → "573001234567"
    """
    if not telefono:
        return None
    # Quitar todo lo que no sea dígito
    solo_digitos = re.sub(r'\D', '', telefono)
    if not solo_digitos:
        return None

    # Si ya empieza con 57 y tiene 12 dígitos → ya está normalizado
    if solo_digitos.startswith('57') and len(solo_digitos) == 12:
        return solo_digitos
    # Si tiene 10 dígitos y empieza con 3 → es celular colombiano sin prefijo
    if len(solo_digitos) == 10 and solo_digitos.startswith('3'):
        return '57' + solo_digitos
    # Si tiene 11+ dígitos pero no empieza con 57, asumimos que ya tiene prefijo
    if len(solo_digitos) >= 11:
        return solo_digitos
    # Casos raros (fijo, número corto): no es válido para WhatsApp
    return None


def _formato_moneda_co(valor: float) -> str:
    """Formatea un número como '$80.000' al estilo colombiano."""
    if valor is None:
        return "$0"
    try:
        return f"${int(round(valor)):,.0f}".replace(",", ".")
    except (ValueError, TypeError):
        return "$0"


def _formato_fecha_es(fecha) -> str:
    """20 de mayo de 2026"""
    if not fecha:
        return "—"
    if isinstance(fecha, str):
        try:
            fecha = datetime.fromisoformat(fecha).date()
        except ValueError:
            return fecha
    meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
             "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    return f"{fecha.day} de {meses[fecha.month - 1]} de {fecha.year}"


# ═══════════════════════════════════════════════════════════════════════════════
# 1. MÉTODOS DE PAGO
# ═══════════════════════════════════════════════════════════════════════════════

def listar_metodos_pago(db: Session, empresa_id: int) -> List[dict]:
    """Devuelve todos los métodos de pago configurados, con campos calculados."""
    metodos = db.query(models.MetodoPagoParqueadero).filter(
        models.MetodoPagoParqueadero.empresa_id == empresa_id
    ).all()
    return [_enriquecer_metodo(m) for m in metodos]


def _enriquecer_metodo(m: models.MetodoPagoParqueadero) -> dict:
    qr_uri = None
    if m.qr_base64:
        mime = m.qr_mime_type or "image/png"
        qr_uri = f"data:{mime};base64,{m.qr_base64}"

    return {
        "id":            m.id,
        "empresa_id":    m.empresa_id,
        "modalidad":     m.modalidad,
        "nombre_metodo": m.nombre_metodo,
        "link_pago":     m.link_pago,
        "qr_base64":     m.qr_base64,
        "qr_mime_type":  m.qr_mime_type,
        "instrucciones": m.instrucciones,
        "is_active":     m.is_active,
        "created_at":    m.created_at,
        "updated_at":    m.updated_at,
        "tiene_qr":      bool(m.qr_base64),
        "tiene_link":    bool(m.link_pago),
        "qr_data_uri":   qr_uri,
    }


def get_metodo_por_modalidad(
    db: Session, empresa_id: int, modalidad: str
) -> Optional[models.MetodoPagoParqueadero]:
    """Busca el método de pago activo para una modalidad específica."""
    return db.query(models.MetodoPagoParqueadero).filter(
        models.MetodoPagoParqueadero.empresa_id == empresa_id,
        models.MetodoPagoParqueadero.modalidad  == modalidad,
        models.MetodoPagoParqueadero.is_active  == True,
    ).first()


def upsert_metodo_pago(
    db: Session, empresa_id: int, payload: schemas.MetodoPagoCreate
) -> dict:
    """
    Crea o actualiza el método de pago para una modalidad.
    Como hay UNIQUE (empresa_id, modalidad), si ya existe lo actualiza.
    """
    existente = db.query(models.MetodoPagoParqueadero).filter(
        models.MetodoPagoParqueadero.empresa_id == empresa_id,
        models.MetodoPagoParqueadero.modalidad  == payload.modalidad,
    ).first()

    if existente:
        for k, v in payload.dict(exclude_unset=True).items():
            setattr(existente, k, v)
        existente.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existente)
        return _enriquecer_metodo(existente)

    nuevo = models.MetodoPagoParqueadero(
        empresa_id = empresa_id,
        **payload.dict(),
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return _enriquecer_metodo(nuevo)


def delete_metodo_pago(db: Session, empresa_id: int, modalidad: str) -> bool:
    """Elimina (físicamente) el método de pago de una modalidad."""
    metodo = db.query(models.MetodoPagoParqueadero).filter(
        models.MetodoPagoParqueadero.empresa_id == empresa_id,
        models.MetodoPagoParqueadero.modalidad  == modalidad,
    ).first()
    if not metodo:
        return False
    db.delete(metodo)
    db.commit()
    return True
