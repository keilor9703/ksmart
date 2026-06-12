from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
import models, schemas


GRUPOS_PREDEFINIDOS = [
    {"id": 1, "nombre": "Materia Prima",       "codigo": "MP",    "color": "#3B82F6", "orden": 1, "requiere_cocina": False},
    {"id": 2, "nombre": "Producto Terminado",  "codigo": "PT",    "color": "#10B981", "orden": 2, "requiere_cocina": False},
    {"id": 3, "nombre": "Activo Fijo",         "codigo": "AF",    "color": "#F59E0B", "orden": 3, "requiere_cocina": False},
    {"id": 4, "nombre": "Insumos",             "codigo": "INS",   "color": "#8B5CF6", "orden": 4, "requiere_cocina": False},
    {"id": 5, "nombre": "Platos y Preparaciones", "codigo": "PLATO", "color": "#EC4899", "orden": 5, "requiere_cocina": True},
    {"id": 6, "nombre": "Envases/Empaque",     "codigo": "ENV",   "color": "#14B8A6", "orden": 6, "requiere_cocina": False},
]

CATEGORIAS_RESTAURANTE = [
    {"nombre": "Entradas",            "codigo": "ENT", "color": "#F97316", "orden": 10, "requiere_cocina": True,  "visible_pos": True},
    {"nombre": "Platos Principales",  "codigo": "PRI", "color": "#EF4444", "orden": 11, "requiere_cocina": True,  "visible_pos": True},
    {"nombre": "Menú del Día",        "codigo": "MEN", "color": "#10B981", "orden": 12, "requiere_cocina": True,  "visible_pos": True},
    {"nombre": "Adiciones",           "codigo": "ADI", "color": "#F59E0B", "orden": 13, "requiere_cocina": False, "visible_pos": True},
    {"nombre": "Postres",             "codigo": "POS", "color": "#EC4899", "orden": 14, "requiere_cocina": True,  "visible_pos": True},
    {"nombre": "Bebidas sin Alcohol", "codigo": "BSA", "color": "#06B6D4", "orden": 15, "requiere_cocina": False, "visible_pos": True},
    {"nombre": "Bebidas Alcohólicas", "codigo": "BAL", "color": "#8B5CF6", "orden": 16, "requiere_cocina": False, "visible_pos": True},
]


def seed_categorias_restaurante(db: Session, empresa_id: int):
    """Añade las categorías por defecto de restaurante a la sesión (sin commit)."""
    codigos_existentes = {
        r.codigo for r in db.query(models.GrupoProducto.codigo).filter(
            models.GrupoProducto.empresa_id == empresa_id
        ).all()
    }
    for cat in CATEGORIAS_RESTAURANTE:
        if cat["codigo"] not in codigos_existentes:
            db.add(models.GrupoProducto(
                empresa_id=empresa_id,
                nombre=cat["nombre"],
                codigo=cat["codigo"],
                color=cat["color"],
                orden=cat["orden"],
                requiere_cocina=cat["requiere_cocina"],
                visible_pos=cat["visible_pos"],
                es_predefinido=False,
            ))


def _apply_empresa_overrides(grupos: list, overrides: dict) -> list:
    """Aplica el overlay por-empresa sobre la lista de grupos."""
    for g in grupos:
        if g.id in overrides:
            ov = overrides[g.id]
            if ov.requiere_cocina is not None:
                g.requiere_cocina = ov.requiere_cocina
            if ov.visible_pos is not None:
                g.visible_pos = ov.visible_pos
    return grupos


def _get_overrides(db: Session, empresa_id: int) -> dict:
    rows = db.query(models.EmpresaGrupoConfig).filter(
        models.EmpresaGrupoConfig.empresa_id == empresa_id
    ).all()
    return {r.grupo_id: r for r in rows}


def get_grupos(db: Session, empresa_id: int):
    grupos = (
        db.query(models.GrupoProducto)
        .filter(
            or_(
                models.GrupoProducto.empresa_id.is_(None),
                models.GrupoProducto.empresa_id == empresa_id,
            )
        )
        .order_by(models.GrupoProducto.orden, models.GrupoProducto.id)
        .all()
    )
    return _apply_empresa_overrides(grupos, _get_overrides(db, empresa_id))


def upsert_grupo_config(db: Session, empresa_id: int, grupo_id: int, data: schemas.GrupoConfigUpdate):
    """Crea o actualiza el override por-empresa para una categoría."""
    cfg = db.query(models.EmpresaGrupoConfig).filter(
        models.EmpresaGrupoConfig.empresa_id == empresa_id,
        models.EmpresaGrupoConfig.grupo_id == grupo_id,
    ).first()
    if not cfg:
        cfg = models.EmpresaGrupoConfig(empresa_id=empresa_id, grupo_id=grupo_id)
        db.add(cfg)
    if data.requiere_cocina is not None:
        cfg.requiere_cocina = data.requiere_cocina
    if data.visible_pos is not None:
        cfg.visible_pos = data.visible_pos
    db.commit()
    db.refresh(cfg)
    # Devolver el grupo con el override aplicado
    grupo = db.query(models.GrupoProducto).filter(models.GrupoProducto.id == grupo_id).first()
    if cfg.requiere_cocina is not None:
        grupo.requiere_cocina = cfg.requiere_cocina
    if cfg.visible_pos is not None:
        grupo.visible_pos = cfg.visible_pos
    return grupo


def get_grupo(db: Session, empresa_id: int, grupo_id: int):
    return (
        db.query(models.GrupoProducto)
        .filter(
            models.GrupoProducto.id == grupo_id,
            or_(
                models.GrupoProducto.empresa_id.is_(None),
                models.GrupoProducto.empresa_id == empresa_id,
            ),
        )
        .first()
    )


def create_grupo(db: Session, empresa_id: int, data: schemas.GrupoProductoCreate):
    grupo = models.GrupoProducto(
        empresa_id=empresa_id,
        nombre=data.nombre,
        codigo=data.codigo.upper().strip(),
        color=data.color,
        orden=data.orden,
        es_predefinido=False,
        requiere_cocina=data.requiere_cocina,
        visible_pos=data.visible_pos,
    )
    db.add(grupo)
    db.commit()
    db.refresh(grupo)
    return grupo


def update_grupo(db: Session, empresa_id: int, grupo_id: int, data: schemas.GrupoProductoUpdate):
    grupo = (
        db.query(models.GrupoProducto)
        .filter(
            models.GrupoProducto.id == grupo_id,
            models.GrupoProducto.empresa_id == empresa_id,
            models.GrupoProducto.es_predefinido == False,
        )
        .first()
    )
    if not grupo:
        return None
    if data.nombre is not None:
        grupo.nombre = data.nombre
    if data.codigo is not None:
        grupo.codigo = data.codigo.upper().strip()
    if data.color is not None:
        grupo.color = data.color
    if data.orden is not None:
        grupo.orden = data.orden
    if data.requiere_cocina is not None:
        grupo.requiere_cocina = data.requiere_cocina
    if data.visible_pos is not None:
        grupo.visible_pos = data.visible_pos
    db.commit()
    db.refresh(grupo)
    return grupo


def delete_grupo(db: Session, empresa_id: int, grupo_id: int):
    grupo = (
        db.query(models.GrupoProducto)
        .filter(
            models.GrupoProducto.id == grupo_id,
            models.GrupoProducto.empresa_id == empresa_id,
            models.GrupoProducto.es_predefinido == False,
        )
        .first()
    )
    if not grupo:
        return False, "Grupo no encontrado o no se puede eliminar"

    tiene_productos = (
        db.query(models.Producto)
        .filter(
            models.Producto.empresa_id == empresa_id,
            models.Producto.grupo_item == grupo_id,
            models.Producto.vigente == True,
        )
        .first()
    )
    if tiene_productos:
        return False, "No se puede eliminar: hay productos vigentes asignados a este grupo"

    db.delete(grupo)
    db.commit()
    return True, "Eliminado"


def resolve_grupo_by_name(db: Session, empresa_id: int, name_or_code: str) -> int:
    """Used in bulk upload to find group ID by name or code."""
    val = name_or_code.upper().strip()
    grupo = (
        db.query(models.GrupoProducto)
        .filter(
            or_(
                models.GrupoProducto.empresa_id.is_(None),
                models.GrupoProducto.empresa_id == empresa_id,
            )
        )
        .all()
    )
    for g in grupo:
        if g.codigo.upper() == val or g.nombre.upper() == val:
            return g.id
    # fallback mapping for legacy values
    legacy = {"1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
               "MP": 1, "MATERIA": 1, "MATERIA PRIMA": 1,
               "PT": 2, "TERMINADO": 2, "PRODUCTO TERMINADO": 2,
               "AF": 3, "ACTIVO": 3, "ACTIVO FIJO": 3,
               "INS": 4, "INSUMO": 4, "INSUMOS": 4,
               "PLATO": 5, "PLATOS": 5, "PREPARADO": 5, "COCINA": 5}
    return legacy.get(val, 2)
