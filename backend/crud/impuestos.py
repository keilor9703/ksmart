from sqlalchemy.orm import Session
import models, schemas


def list_tipos_impuesto(db: Session, empresa_id: int):
    return (
        db.query(models.TipoImpuesto)
        .filter(models.TipoImpuesto.empresa_id == empresa_id)
        .order_by(models.TipoImpuesto.nombre)
        .all()
    )


def get_tipo_impuesto(db: Session, empresa_id: int, impuesto_id: int):
    return db.query(models.TipoImpuesto).filter(
        models.TipoImpuesto.id == impuesto_id,
        models.TipoImpuesto.empresa_id == empresa_id,
    ).first()


def create_tipo_impuesto(db: Session, empresa_id: int, payload: schemas.TipoImpuestoCreate):
    obj = models.TipoImpuesto(**payload.dict(), empresa_id=empresa_id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update_tipo_impuesto(db: Session, empresa_id: int, impuesto_id: int, payload: schemas.TipoImpuestoUpdate):
    obj = get_tipo_impuesto(db, empresa_id, impuesto_id)
    if not obj:
        return None
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


def delete_tipo_impuesto(db: Session, empresa_id: int, impuesto_id: int):
    obj = get_tipo_impuesto(db, empresa_id, impuesto_id)
    if not obj:
        return False
    # Desvincular productos antes de eliminar
    db.query(models.ProductoImpuesto).filter(
        models.ProductoImpuesto.impuesto_id == impuesto_id,
        models.ProductoImpuesto.empresa_id == empresa_id,
    ).delete()
    db.delete(obj)
    db.commit()
    return True


# ─── Asignación producto ↔ impuesto ──────────────────────────────────────────

def get_impuesto_de_producto(db: Session, empresa_id: int, producto_id: int):
    row = db.query(models.ProductoImpuesto).filter(
        models.ProductoImpuesto.producto_id == producto_id,
        models.ProductoImpuesto.empresa_id == empresa_id,
    ).first()
    return row


def set_impuesto_para_producto(db: Session, empresa_id: int, producto_id: int, impuesto_id: int):
    """Upsert: un producto solo puede tener un impuesto asignado a la vez."""
    row = get_impuesto_de_producto(db, empresa_id, producto_id)
    if row:
        row.impuesto_id = impuesto_id
    else:
        row = models.ProductoImpuesto(
            producto_id=producto_id,
            impuesto_id=impuesto_id,
            empresa_id=empresa_id,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


def remove_impuesto_de_producto(db: Session, empresa_id: int, producto_id: int):
    row = get_impuesto_de_producto(db, empresa_id, producto_id)
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True


# ─── Utilidad para enriquecer listas de productos ────────────────────────────

def attach_impuestos_to_productos(db: Session, empresa_id: int, productos: list):
    """
    Adjunta el TipoImpuesto a cada objeto Producto en la lista.
    Realiza UNA sola consulta para evitar N+1.
    """
    if not productos:
        return productos

    ids = [p.id for p in productos]
    rows = (
        db.query(models.ProductoImpuesto, models.TipoImpuesto)
        .join(models.TipoImpuesto, models.TipoImpuesto.id == models.ProductoImpuesto.impuesto_id)
        .filter(
            models.ProductoImpuesto.empresa_id == empresa_id,
            models.ProductoImpuesto.producto_id.in_(ids),
        )
        .all()
    )
    impuesto_map = {pi.producto_id: ti for pi, ti in rows}
    for p in productos:
        p.__dict__['impuesto'] = impuesto_map.get(p.id)
    return productos
