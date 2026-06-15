from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
import models, schemas
from api import deps
from crud import pedidos_virtuales as crud_pv
import base64
import json

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
    if not db_empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada.")

    # Validar unicidad del slug si ha cambiado
    if payload.slug_catalogo != db_empresa.slug_catalogo:
        existing = db.query(models.Empresa).filter(models.Empresa.slug_catalogo == payload.slug_catalogo).first()
        if existing:
            raise HTTPException(status_code=400, detail="El slug del catálogo ya está en uso por otra empresa.")
    
    db_empresa.slug_catalogo = payload.slug_catalogo
    db_empresa.whatsapp_pedidos = payload.whatsapp_pedidos
    if payload.logo_base64 is not None:
        db_empresa.logo_base64 = payload.logo_base64
    if payload.color_primario is not None:
        db_empresa.color_primario = payload.color_primario
    if payload.direccion_recogida is not None:
        db_empresa.direccion = payload.direccion_recogida
        
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
        models.Producto.mostrar_en_catalogo == True,
        models.Producto.vigente == True,
    )
    
    total = productos_query.count()
    db_productos = productos_query.limit(50).all()
    
    # Mapear a esquema de catálogo (sin el Base64 de la imagen para ligereza)
    productos_out = []
    for p in db_productos:
        # Contar cuántas imágenes tiene (manejo robusto de string vs list)
        count = 0
        if p.imagenes:
            if isinstance(p.imagenes, list):
                count = len(p.imagenes)
            elif isinstance(p.imagenes, str):
                try:
                    imgs = json.loads(p.imagenes)
                    count = len(imgs) if isinstance(imgs, list) else 0
                except: pass

        # Buscar nombre de categoría
        categoria = db.query(models.GrupoProducto).filter(models.GrupoProducto.id == p.grupo_item).first()
        productos_out.append(schemas.CatalogoProductoOut(
            id=p.id,
            nombre=p.nombre,
            descripcion=p.descripcion,
            precio=p.precio,
            categoria=categoria.nombre if categoria else "General",
            image_count=count,
            stock=p.stock_actual or 0.0,
            es_servicio=bool(p.es_servicio),
        ))

    empresa_out = schemas.CatalogoEmpresaOut(
        nombre=db_empresa.nombre,
        slug_catalogo=db_empresa.slug_catalogo,
        whatsapp_pedidos=db_empresa.whatsapp_pedidos,
        logo_base64=db_empresa.logo_base64,
        color_primario=db_empresa.color_primario,
        direccion=db_empresa.ciudad,
        tipo_negocio=db_empresa.tipo_negocio or "erp",
        descripcion=getattr(db_empresa, "descripcion", None),
    )

    # Para restaurantes, incluir lista de mesas activas
    mesas_out = []
    if db_empresa.tipo_negocio == "restaurante":
        db_mesas = db.query(models.Mesa).filter(
            models.Mesa.empresa_id == db_empresa.id,
            models.Mesa.is_active == True,
        ).order_by(models.Mesa.numero).all()
        mesas_out = [
            schemas.CatalogoMesaOut(
                numero=m.numero,
                nombre=m.nombre,
                zona=m.zona,
                estado=m.estado,
            )
            for m in db_mesas
        ]

    return schemas.CatalogoPublicoOut(
        empresa=empresa_out,
        productos=productos_out,
        total_productos=total,
        mesas=mesas_out,
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
        models.Producto.mostrar_en_catalogo == True,
        models.Producto.vigente == True,
    )

    if search:
        query = query.filter(models.Producto.nombre.ilike(f"%{search}%"))
    
    if categoria_id:
        query = query.filter(models.Producto.grupo_item == categoria_id)

    db_productos = query.offset(skip).limit(limit).all()
    
    results = []
    for p in db_productos:
        # Contar cuántas imágenes tiene (manejo robusto)
        count = 0
        if p.imagenes:
            if isinstance(p.imagenes, list):
                count = len(p.imagenes)
            elif isinstance(p.imagenes, str):
                try:
                    imgs = json.loads(p.imagenes)
                    count = len(imgs) if isinstance(imgs, list) else 0
                except: pass

        cat = db.query(models.GrupoProducto).filter(models.GrupoProducto.id == p.grupo_item).first()
        results.append(schemas.CatalogoProductoOut(
            id=p.id,
            nombre=p.nombre,
            descripcion=p.descripcion,
            precio=p.precio,
            categoria=cat.nombre if cat else "General",
            image_count=count,
            stock=p.stock_actual or 0.0,
            es_servicio=bool(p.es_servicio),
        ))
    
    return results

@router.post("/{slug}/pedido", response_model=schemas.PedidoVirtualCreatedOut, status_code=201)
def create_pedido_virtual_publico(
    slug: str,
    payload: schemas.PedidoVirtualCreate,
    db: Session = Depends(deps.get_db),
):
    """Recibe un pedido desde el catálogo público. No requiere autenticación."""
    try:
        pedido = crud_pv.create_pedido_publico(db, slug, payload)
        return schemas.PedidoVirtualCreatedOut(
            id=pedido.id,
            total=pedido.total,
            estado=pedido.estado.value if hasattr(pedido.estado, "value") else pedido.estado,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{slug}/pedido-restaurante", response_model=schemas.PedidoRestauranteCreatedOut, status_code=201)
def create_pedido_restaurante_publico(
    slug: str,
    payload: schemas.PedidoRestaurantePublicoIn,
    db: Session = Depends(deps.get_db),
):
    """
    Recibe un pedido desde el catálogo público de un restaurante (autoservicio de mesa).
    No requiere autenticación. Crea o reutiliza la comanda activa de la mesa.
    """
    db_empresa = db.query(models.Empresa).filter(models.Empresa.slug_catalogo == slug).first()
    if not db_empresa:
        raise HTTPException(status_code=404, detail="Catálogo no encontrado.")
    if db_empresa.tipo_negocio != "restaurante":
        raise HTTPException(status_code=400, detail="Este catálogo no es de un restaurante.")

    # Buscar la mesa por número
    mesa = db.query(models.Mesa).filter(
        models.Mesa.empresa_id == db_empresa.id,
        models.Mesa.numero == payload.mesa_numero,
        models.Mesa.is_active == True,
    ).first()
    if not mesa:
        raise HTTPException(status_code=404, detail=f"Mesa '{payload.mesa_numero}' no encontrada.")

    # Buscar comanda activa o crear una nueva
    comanda = db.query(models.Comanda).filter(
        models.Comanda.mesa_id == mesa.id,
        models.Comanda.empresa_id == db_empresa.id,
        models.Comanda.estado.in_(["abierta", "enviada", "lista"]),
    ).first()

    if not comanda:
        # Contar comandas del día para número consecutivo
        hoy = datetime.now(timezone.utc).date()
        count = db.query(models.Comanda).filter(
            models.Comanda.empresa_id == db_empresa.id,
            models.Comanda.fecha_apertura >= datetime(hoy.year, hoy.month, hoy.day, tzinfo=timezone.utc),
        ).count()
        comanda = models.Comanda(
            empresa_id=db_empresa.id,
            mesa_id=mesa.id,
            mesero_id=None,  # autoservicio
            numero_comanda=count + 1,
            personas=1,
            notas="Pedido desde catálogo (autoservicio)",
        )
        db.add(comanda)
        mesa.estado = "ocupada"
        db.flush()

    # Configuración de cocina de la empresa
    cfg = db.query(models.ConfigRestaurante).filter_by(empresa_id=db_empresa.id).first()
    areas = cfg.areas_cocina if cfg else ["Cocina general"]
    modo_impresion = cfg.imprimir_comanda_auto if cfg else False

    # Obtener overrides de grupos de producto
    from crud.grupos_producto import _get_overrides
    overrides = _get_overrides(db, db_empresa.id)

    ahora = datetime.now(timezone.utc)

    for it in payload.items:
        area = None
        va_a_cocina = True

        prod = db.query(models.Producto).filter(
            models.Producto.id == it.producto_id,
            models.Producto.empresa_id == db_empresa.id,
            models.Producto.vigente == True,
        ).first()

        if prod and prod.grupo_item:
            ov = overrides.get(prod.grupo_item)
            if ov and ov.requiere_cocina is not None:
                va_a_cocina = ov.requiere_cocina
            else:
                va_a_cocina = getattr(prod, "requiere_cocina", True)
            if va_a_cocina:
                area = areas[0] if areas else "Cocina general"

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

    # Transición de estado: abierta → enviada
    if comanda.estado == "abierta":
        comanda.estado = "enviada"

    db.flush()

    # Recalcular total
    total = sum(
        i.subtotal for i in comanda.items if i.estado != "cancelado"
    )
    comanda.total = round(total, 2)

    db.commit()
    db.refresh(comanda)

    return schemas.PedidoRestauranteCreatedOut(
        comanda_id=comanda.id,
        numero_comanda=comanda.numero_comanda,
        mesa_numero=mesa.numero,
        total=comanda.total,
    )


@router.get("/{slug}/productos/{producto_id}/imagen")
def get_producto_imagen(
    slug: str,
    producto_id: int,
    index: int = 0,
    db: Session = Depends(deps.get_db)
):
    """Sirve una imagen específica del producto como un stream binario con cache."""
    # PREVENCIÓN IDOR: Validar que el producto pertenezca a la empresa del slug
    db_empresa = db.query(models.Empresa).filter(models.Empresa.slug_catalogo == slug).first()
    if not db_empresa:
        raise HTTPException(status_code=404, detail="Catálogo no encontrado.")

    db_producto = db.query(models.Producto).filter(
        models.Producto.id == producto_id,
        models.Producto.empresa_id == db_empresa.id,
        models.Producto.mostrar_en_catalogo == True,
        models.Producto.vigente == True,
    ).first()

    if not db_producto or not db_producto.imagenes:
        raise HTTPException(status_code=404, detail="Imagen no disponible.")

    try:
        # Manejo robusto de string vs list para la extracción
        imgs = db_producto.imagenes
        if isinstance(imgs, str):
            imgs = json.loads(imgs)
            
        if not isinstance(imgs, list) or index < 0 or index >= len(imgs):
            raise HTTPException(status_code=404, detail="Índice de imagen no válido.")
        
        img_data = imgs[index]
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
    except HTTPException: raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al procesar la imagen.")
