import logging
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import models, schemas
from api import deps
from core.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter()

MARKETPLACE_MAX_LIMIT = 100

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
    ).distinct().all()
    return sorted({r[0] for r in rows if r[0]})
