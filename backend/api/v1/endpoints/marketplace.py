import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List, Optional
import models, schemas
from api import deps
from core.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter()

MARKETPLACE_MAX_LIMIT = 100


def _suscripcion_activa_filter():
    """Versión SQL de crud.common.empresa_suscripcion_activa, para usar en
    listados (no en lookups de una sola empresa). Una empresa con el plan/
    período de prueba vencido no debe seguir siendo descubrible en el
    directorio público, aunque nadie haya entrado a desactivar el toggle."""
    ahora = datetime.now(timezone.utc)
    return or_(
        models.Empresa.id == 1,
        models.Empresa.is_protected == True,
        models.Empresa.trial_ends_at.is_(None),
        models.Empresa.trial_ends_at >= ahora,
    )

# ═══════════════════════════════════════════════════════════════════════════════
# CENTRO COMERCIAL VIRTUAL (PÚBLICO, SIN AUTH)
#
# Directorio opt-in de empresas que exponen su catálogo virtual bajo un mismo
# dominio ("mall"). A diferencia de /catalogo/{slug} (una tienda puntual, se
# accede sabiendo el link), este listado es DESCUBRIBLE — solo debe incluir
# empresas que activaron explícitamente `visible_marketplace` desde su propio
# panel de configuración (nunca automático, ver CatalogoConfigUpdate).
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/empresas", response_model=List[schemas.MarketplaceEmpresaOut])
@limiter.limit("60/minute")
def listar_empresas_marketplace(
    request: Request,
    search: Optional[str] = None,
    categoria: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(deps.get_db),
):
    """Listado público de empresas visibles en el Centro Comercial Virtual."""
    limit = max(1, min(limit, MARKETPLACE_MAX_LIMIT))

    query = db.query(models.Empresa).filter(
        models.Empresa.visible_marketplace == True,
        models.Empresa.is_active == True,
        models.Empresa.slug_catalogo.isnot(None),
        # Defensa en profundidad: los restaurantes no deberían poder activar
        # visible_marketplace (bloqueado en PUT /catalogo/config), pero un
        # registro ya existente o un bug futuro no debe filtrar aquí igual.
        models.Empresa.tipo_negocio != "restaurante",
        _suscripcion_activa_filter(),
    )
    if search:
        query = query.filter(models.Empresa.nombre.ilike(f"%{search}%"))
    if categoria:
        query = query.filter(models.Empresa.categoria_marketplace == categoria)

    empresas = query.order_by(models.Empresa.nombre.asc()).offset(skip).limit(limit).all()

    resultado = []
    for emp in empresas:
        total_productos = db.query(models.Producto).filter(
            models.Producto.empresa_id == emp.id,
            models.Producto.mostrar_en_catalogo == True,
            models.Producto.vigente == True,
        ).count()
        resultado.append(schemas.MarketplaceEmpresaOut(
            nombre=emp.nombre,
            slug_catalogo=emp.slug_catalogo,
            logo_base64=emp.logo_base64,
            color_primario=emp.color_primario,
            descripcion=emp.descripcion,
            categoria_marketplace=emp.categoria_marketplace,
            tipo_negocio=emp.tipo_negocio or "erp",
            total_productos=total_productos,
        ))
    return resultado


@router.get("/categorias", response_model=List[str])
@limiter.limit("60/minute")
def listar_categorias_marketplace(request: Request, db: Session = Depends(deps.get_db)):
    """Categorías distintas entre las empresas visibles — para los chips de filtro."""
    rows = db.query(models.Empresa.categoria_marketplace).filter(
        models.Empresa.visible_marketplace == True,
        models.Empresa.is_active == True,
        models.Empresa.slug_catalogo.isnot(None),
        models.Empresa.categoria_marketplace.isnot(None),
        models.Empresa.tipo_negocio != "restaurante",
        _suscripcion_activa_filter(),
    ).distinct().all()
    return sorted({r[0] for r in rows if r[0]})


@router.get("/productos/destacados", response_model=List[schemas.MarketplaceProductoOut])
@limiter.limit("60/minute")
def productos_destacados_marketplace(
    request: Request,
    limit: int = 8,
    db: Session = Depends(deps.get_db),
):
    """Muestra de productos CON foto real, tomados de varias tiendas del mall —
    usado por el landing para mostrar la variedad real de productos (fotos
    reales, no íconos/emoji) sin depender de que el visitante ya haya
    buscado algo."""
    limit = max(1, min(limit, 20))

    filas = (
        db.query(models.Producto, models.Empresa)
        .join(models.Empresa, models.Producto.empresa_id == models.Empresa.id)
        .filter(
            models.Empresa.visible_marketplace == True,
            models.Empresa.is_active == True,
            models.Empresa.slug_catalogo.isnot(None),
            models.Empresa.tipo_negocio != "restaurante",
            _suscripcion_activa_filter(),
            models.Producto.mostrar_en_catalogo == True,
            models.Producto.vigente == True,
            models.Producto.imagenes.isnot(None),
        )
        .order_by(models.Producto.id.desc())
        .limit(limit * 3)
        .all()
    )

    resultado = []
    for prod, emp in filas:
        imgs = prod.imagenes
        if isinstance(imgs, str):
            import json
            try:
                imgs = json.loads(imgs)
            except Exception:
                imgs = None
        count = len(imgs) if isinstance(imgs, list) else 0
        if not count:
            continue
        cat = db.query(models.GrupoProducto).filter(models.GrupoProducto.id == prod.grupo_item).first()
        resultado.append(schemas.MarketplaceProductoOut(
            id=prod.id,
            nombre=prod.nombre,
            precio=prod.precio,
            image_count=count,
            categoria=cat.nombre if cat else None,
            empresa_nombre=emp.nombre,
            empresa_slug=emp.slug_catalogo,
            empresa_color=emp.color_primario or "#4F46E5",
        ))
        if len(resultado) >= limit:
            break
    return resultado


@router.get("/productos", response_model=List[schemas.MarketplaceProductoOut])
@limiter.limit("60/minute")
def buscar_productos_marketplace(
    request: Request,
    search: str,
    categoria: Optional[str] = None,
    limit: int = 30,
    db: Session = Depends(deps.get_db),
):
    """Búsqueda de productos A TRAVÉS DE todas las tiendas opt-in del mall —
    esto es lo que diferencia al directorio de simplemente enlistar marcas:
    el cliente puede buscar "tenis" sin saber en qué tienda está.
    Requiere `search` con al menos 2 caracteres para evitar escanear todo el
    catálogo combinado en cada tecla."""
    if not search or len(search.strip()) < 2:
        return []
    limit = max(1, min(limit, MARKETPLACE_MAX_LIMIT))

    query = (
        db.query(models.Producto, models.Empresa)
        .join(models.Empresa, models.Producto.empresa_id == models.Empresa.id)
        .filter(
            models.Empresa.visible_marketplace == True,
            models.Empresa.is_active == True,
            models.Empresa.slug_catalogo.isnot(None),
            models.Empresa.tipo_negocio != "restaurante",
            _suscripcion_activa_filter(),
            models.Producto.mostrar_en_catalogo == True,
            models.Producto.vigente == True,
            models.Producto.nombre.ilike(f"%{search.strip()}%"),
        )
    )
    if categoria:
        query = query.filter(models.Empresa.categoria_marketplace == categoria)

    filas = query.order_by(models.Producto.nombre.asc()).limit(limit).all()

    resultado = []
    for prod, emp in filas:
        count = 0
        if prod.imagenes:
            if isinstance(prod.imagenes, list):
                count = len(prod.imagenes)
            elif isinstance(prod.imagenes, str):
                import json
                try:
                    imgs = json.loads(prod.imagenes)
                    count = len(imgs) if isinstance(imgs, list) else 0
                except Exception:
                    pass
        cat = db.query(models.GrupoProducto).filter(models.GrupoProducto.id == prod.grupo_item).first()
        resultado.append(schemas.MarketplaceProductoOut(
            id=prod.id,
            nombre=prod.nombre,
            precio=prod.precio,
            image_count=count,
            categoria=cat.nombre if cat else None,
            tiene_variantes=bool(prod.tiene_variantes),
            empresa_nombre=emp.nombre,
            empresa_slug=emp.slug_catalogo,
            empresa_color=emp.color_primario,
        ))
    return resultado
