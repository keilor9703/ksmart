from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import models, schemas
from api import deps
import base64

router = APIRouter()

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN (PROTEGIDO)
# ═══════════════════════════════════════════════════════════════════════════════

@router.put("/config", response_model=schemas.EmpresaOut)
def update_catalogo_config(
    payload: schemas.CatalogoConfigUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    """Actualiza la configuración del catálogo para la empresa del usuario actual."""
    db_empresa = db.query(models.Empresa).filter(models.Empresa.id == current_user.empresa_id).first()
    
    # Validar unicidad del slug si ha cambiado
    if payload.slug_catalogo != db_empresa.slug_catalogo:
        existing = db.query(models.Empresa).filter(models.Empresa.slug_catalogo == payload.slug_catalogo).first()
        if existing:
            raise HTTPException(status_code=400, detail="El slug del catálogo ya está en uso por otra empresa.")
    
    db_empresa.slug_catalogo = payload.slug_catalogo
    db_empresa.whatsapp_pedidos = payload.whatsapp_pedidos
    if payload.logo_base64 is not None:
        db_empresa.logo_base64 = payload.logo_base64
        
    db.commit()
    db.refresh(db_empresa)
    return db_empresa

# ═══════════════════════════════════════════════════════════════════════════════
# CATÁLOGO PÚBLICO (SIN AUTH)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/{slug}", response_model=schemas.CatalogoPublicoOut)
def get_public_catalogo(
    slug: str,
    db: Session = Depends(deps.get_db)
):
    """Obtiene la información básica de la empresa y sus productos públicos."""
    db_empresa = db.query(models.Empresa).filter(models.Empresa.slug_catalogo == slug).first()
    if not db_empresa:
        raise HTTPException(status_code=404, detail="Catálogo no encontrado.")

    # Obtener productos visibles (Paginación inicial de 50)
    productos_query = db.query(models.Producto).filter(
        models.Producto.empresa_id == db_empresa.id,
        models.Producto.mostrar_en_catalogo == True
    )
    
    total = productos_query.count()
    db_productos = productos_query.limit(50).all()
    
    # Mapear a esquema de catálogo (sin el Base64 de la imagen para ligereza)
    productos_out = []
    for p in db_productos:
        # Buscar nombre de categoría
        categoria = db.query(models.GrupoProducto).filter(models.GrupoProducto.id == p.grupo_item).first()
        productos_out.append(schemas.CatalogoProductoOut(
            id=p.id,
            nombre=p.nombre,
            descripcion=p.descripcion,
            precio=p.precio,
            categoria=categoria.nombre if categoria else "General",
            has_image=bool(p.imagen)
        ))

    empresa_out = schemas.CatalogoEmpresaOut(
        nombre=db_empresa.nombre,
        slug_catalogo=db_empresa.slug_catalogo,
        whatsapp_pedidos=db_empresa.whatsapp_pedidos,
        logo_base64=db_empresa.logo_base64,
        color_primario=db_empresa.color_primario,
        direccion=db_empresa.ciudad # O dirección si existiera un campo específico
    )

    return schemas.CatalogoPublicoOut(
        empresa=empresa_out,
        productos=productos_out,
        total_productos=total
    )

@router.get("/{slug}/productos", response_model=List[schemas.CatalogoProductoOut])
def get_catalogo_productos(
    slug: str,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    categoria_id: Optional[int] = None,
    db: Session = Depends(deps.get_db)
):
    """Listado paginado y filtrado de productos para el catálogo público."""
    db_empresa = db.query(models.Empresa).filter(models.Empresa.slug_catalogo == slug).first()
    if not db_empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada.")

    query = db.query(models.Producto).filter(
        models.Producto.empresa_id == db_empresa.id,
        models.Producto.mostrar_en_catalogo == True
    )

    if search:
        query = query.filter(models.Producto.nombre.ilike(f"%{search}%"))
    
    if categoria_id:
        query = query.filter(models.Producto.grupo_item == categoria_id)

    db_productos = query.offset(skip).limit(limit).all()
    
    results = []
    for p in db_productos:
        cat = db.query(models.GrupoProducto).filter(models.GrupoProducto.id == p.grupo_item).first()
        results.append(schemas.CatalogoProductoOut(
            id=p.id,
            nombre=p.nombre,
            descripcion=p.descripcion,
            precio=p.precio,
            categoria=cat.nombre if cat else "General",
            has_image=bool(p.imagen)
        ))
    
    return results

@router.get("/{slug}/productos/{producto_id}/imagen")
def get_producto_imagen(
    slug: str,
    producto_id: int,
    db: Session = Depends(deps.get_db)
):
    """Sirve la imagen del producto como un stream binario con cache."""
    # PREVENCIÓN IDOR: Validar que el producto pertenezca a la empresa del slug
    db_producto = db.query(models.Producto).join(models.Empresa).filter(
        models.Empresa.slug_catalogo == slug,
        models.Producto.id == producto_id,
        models.Producto.empresa_id == models.Empresa.id,
        models.Producto.mostrar_en_catalogo == True
    ).first()

    if not db_producto or not db_producto.imagen:
        raise HTTPException(status_code=404, detail="Imagen no disponible.")

    try:
        # La imagen está en Base64 (WebP)
        img_data = db_producto.imagen
        if "," in img_data:
            img_data = img_data.split(",")[1]
        
        binary_data = base64.b64decode(img_data)
        
        return Response(
            content=binary_data,
            media_type="image/webp",
            headers={
                "Cache-Control": "public, max-age=86400", # 24 horas de cache
                "Access-Control-Allow-Origin": "*"       # CORS explícito
            }
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Error al procesar la imagen.")
