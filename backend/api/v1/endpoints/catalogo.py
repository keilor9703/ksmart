import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
import models, schemas
from api import deps
from crud import pedidos_virtuales as crud_pv
from crud.common import empresa_suscripcion_activa
from core.limiter import limiter
import base64
import json
import time

logger = logging.getLogger(__name__)

router = APIRouter()

CATALOGO_MAX_LIMIT = 100


def _mapear_variantes_publico(producto: models.Producto):
    """Solo variantes activas — el cliente público no debe ver opciones
    descontinuadas, aunque sigan existiendo en el sistema."""
    if not producto.tiene_variantes:
        return []
    return [
        schemas.CatalogoVarianteOut(
            id=v.id,
            nombre=v.nombre,
            atributos=v.atributos or {},
            precio=v.precio,
            stock=v.stock_actual or 0.0,
        )
        for v in (producto.variantes or []) if v.activo
    ]

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN (PROTEGIDO)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/config")
def get_catalogo_config(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """Devuelve la configuración del catálogo de la empresa."""
    emp = db.query(models.Empresa).filter(models.Empresa.id == current_user.empresa_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empresa no encontrada.")
    return {
        "slug_catalogo":    emp.slug_catalogo,
        "whatsapp_pedidos": emp.whatsapp_pedidos,
        "logo_base64":      emp.logo_base64,
        "color_primario":   emp.color_primario,
        "descripcion":      emp.descripcion,
        "visible_marketplace":   emp.visible_marketplace,
        "categoria_marketplace": emp.categoria_marketplace,
        "instagram_url":    emp.instagram_url,
        "facebook_url":     emp.facebook_url,
    }


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
    
    if payload.visible_marketplace and not payload.slug_catalogo:
        raise HTTPException(status_code=400, detail="Debes configurar el slug del catálogo antes de aparecer en el Centro Comercial Virtual.")
    # Por ahora el Centro Comercial Virtual solo admite comercio/retail — un
    # restaurante no maneja stock ni cuentas por variante de la misma forma
    # y su flujo de pedido (mesa/autoservicio) no encaja con el directorio.
    if payload.visible_marketplace and (db_empresa.tipo_negocio or "erp") == "restaurante":
        raise HTTPException(status_code=400, detail="Los restaurantes aún no pueden aparecer en el Centro Comercial Virtual.")

    db_empresa.slug_catalogo = payload.slug_catalogo
    db_empresa.whatsapp_pedidos = payload.whatsapp_pedidos
    if payload.logo_base64 is not None:
        db_empresa.logo_base64 = payload.logo_base64
    if payload.color_primario is not None:
        db_empresa.color_primario = payload.color_primario
    if payload.direccion_recogida is not None:
        db_empresa.ciudad = payload.direccion_recogida
    if payload.descripcion is not None:
        db_empresa.descripcion = payload.descripcion
    if payload.visible_marketplace is not None:
        db_empresa.visible_marketplace = payload.visible_marketplace
    if payload.categoria_marketplace is not None:
        db_empresa.categoria_marketplace = payload.categoria_marketplace or None
    if payload.instagram_url is not None:
        db_empresa.instagram_url = payload.instagram_url or None
    if payload.facebook_url is not None:
        db_empresa.facebook_url = payload.facebook_url or None

    db.commit()
    db.refresh(db_empresa)
    return db_empresa

# ═══════════════════════════════════════════════════════════════════════════════
# CATÁLOGO PÚBLICO (SIN AUTH)
# ═══════════════════════════════════════════════════════════════════════════════

def _normalizar_whatsapp(numero: Optional[str]) -> Optional[str]:
    """
    Deja el WhatsApp del negocio en el formato que exige Evolution: solo
    dígitos, con indicativo de país.

    El campo es de texto libre y cada empresa lo escribe distinto: '312 613
    7615', '+57 312...', '(312) 613-7615'. Sin indicativo, Evolution responde
    `exists: false` y el aviso al negocio nunca llega —sin que nadie se entere,
    porque el cliente sí recibió su respuesta—.

    Se asume Colombia (57) para los celulares de 10 dígitos que empiezan por 3,
    que es el formato nacional. Cualquier otra longitud se devuelve tal cual:
    es preferible fallar visiblemente que reescribir mal un número extranjero.
    """
    if not numero:
        return None
    digitos = "".join(c for c in numero if c.isdigit())
    if not digitos:
        return None
    if len(digitos) == 10 and digitos.startswith("3"):
        return "57" + digitos
    return digitos


@router.get("/por-instancia/{instancia}")
@limiter.limit("60/minute")
def resolver_empresa_por_instancia(
    request: Request, instancia: str, db: Session = Depends(deps.get_db)
):
    """
    Traduce una instancia de WhatsApp al catálogo de su empresa.

    Es lo que permite que UNA sola automatización atienda a todas las
    empresas: el mensaje entrante trae el nombre de la instancia, y con este
    endpoint se resuelve a qué tienda pertenece antes de leer su catálogo.

    Público a propósito (igual que el resto del catálogo) y devuelve solo
    datos que ya son públicos: nombre de la tienda y su slug.
    """
    empresa = db.query(models.Empresa).filter(
        models.Empresa.whatsapp_instancia == instancia
    ).first()
    if not empresa or not empresa.slug_catalogo:
        raise HTTPException(
            status_code=404,
            detail=f"No hay una tienda vinculada a la instancia '{instancia}'.",
        )
    if not empresa_suscripcion_activa(empresa):
        raise HTTPException(status_code=403, detail="La suscripción de esta tienda no está activa.")

    return {
        "slug": empresa.slug_catalogo,
        "empresa": empresa.nombre,
        "instancia": instancia,
        # Datos públicos del negocio: permiten que la automatización responda
        # preguntas frecuentes (dónde quedan, a qué se dedican, redes) sin una
        # consulta extra. Son los mismos que ya muestra el catálogo público.
        "descripcion": empresa.descripcion,
        "ciudad": empresa.ciudad,
        "horario": empresa.horario_atencion,
        # Normalizado para que la automatización pueda escribirle al negocio
        # sin depender de cómo lo haya tecleado cada empresa.
        "whatsapp": _normalizar_whatsapp(empresa.whatsapp_pedidos),
        # Destino de los avisos ("un cliente pide hablar con alguien"). Cae al
        # número de pedidos si no hay uno aparte, pero entonces el aviso llega
        # al mismo WhatsApp que atiende el bot y en la práctica no se ve: por
        # eso `alertas_utiles` avisa si esa configuración quedó a medias.
        "whatsapp_alertas": _normalizar_whatsapp(
            empresa.whatsapp_notificaciones or empresa.whatsapp_pedidos
        ),
        "alertas_utiles": bool(empresa.whatsapp_notificaciones),
        "instagram": empresa.instagram_url,
        "facebook": empresa.facebook_url,
        "catalogo_url": f"https://catalogo.ksmart360.com/{empresa.slug_catalogo}",
        # Saludo personalizado del bot: si la empresa no lo configuró, viene
        # null y la automatización debe usar su saludo genérico por defecto.
        "mensaje_bienvenida": empresa.mensaje_bienvenida_bot,
    }


# ─── Anti-duplicados de la automatización de WhatsApp ─────────────────────────
#
# Cuando un cliente escribe tres mensajes seguidos ("hola" / "quiero 2
# chocolatinas" / "para la calle 45"), el webhook dispara TRES ejecuciones en
# paralelo y el cliente recibe tres respuestas descoordinadas.
#
# La solución es que solo la ejecución del último mensaje siga adelante. Eso
# exige un contador compartido entre ejecuciones, y el almacenamiento estático
# de n8n no lo es. Aquí sí: un único proceso, un único diccionario.

# {(instancia, destino): (marca, expira_en, [mensajes_acumulados])}
_ultimo_mensaje: dict = {}
_DEBOUNCE_TTL = 300  # 5 min: más que suficiente para cualquier espera del flujo


def _purgar_debounce(ahora: float):
    """Evita que el diccionario crezca sin límite con clientes que ya no escriben."""
    if len(_ultimo_mensaje) < 500:
        return
    for k in [k for k, v in _ultimo_mensaje.items() if v[1] < ahora]:
        _ultimo_mensaje.pop(k, None)


@router.post("/por-instancia/{instancia}/debounce")
@limiter.limit("120/minute")
def marcar_mensaje(
    request: Request,
    instancia: str,
    payload: schemas.DebounceMarcarIn,
):
    """
    Registra "este es el mensaje más reciente de este cliente" y devuelve una
    marca. La automatización espera unos segundos y luego pregunta en
    /debounce/es-ultimo si su marca sigue siendo la vigente.
    """
    ahora = time.time()
    _purgar_debounce(ahora)

    # La marca se deriva del reloj para que sea monótona incluso si dos mensajes
    # entran en el mismo milisegundo (se desempata por el contador de longitud).
    marca = int(ahora * 1000)
    clave = (instancia, payload.destino)
    anterior = _ultimo_mensaje.get(clave)
    if anterior and anterior[0] >= marca:
        marca = anterior[0] + 1

    # Si dentro de la misma ventana de espera llegan varios mensajes seguidos
    # ("quiero 2 chocolatinas" / "y una gaseosa"), se acumulan aquí: solo la
    # ejecución del último los ve todos, las anteriores se descartan en
    # es_ultimo_mensaje() sin haber usado su texto.
    mensajes_previos = anterior[2] if anterior else []
    mensajes = mensajes_previos + ([payload.mensaje] if payload.mensaje else [])

    _ultimo_mensaje[clave] = (marca, ahora + _DEBOUNCE_TTL, mensajes)
    return {"marca": marca}


@router.post("/por-instancia/{instancia}/debounce/es-ultimo")
@limiter.limit("120/minute")
def es_ultimo_mensaje(
    request: Request,
    instancia: str,
    payload: schemas.DebounceVerificarIn,
):
    """
    ¿Sigue siendo esta la ejecución del último mensaje del cliente?

    Si mientras esperaba llegó otro mensaje, responde `false` y esa ejecución
    se detiene: el cliente recibirá UNA sola respuesta, ya con todo el contexto.
    """
    clave = (instancia, payload.destino)
    actual = _ultimo_mensaje.get(clave)
    # Si no hay registro (reinicio del backend, TTL vencido) se deja pasar:
    # ante la duda, es preferible responderle al cliente que dejarlo sin nada.
    es_ultimo = actual is None or actual[0] == payload.marca
    mensaje_acumulado = "\n".join(actual[2]) if actual and actual[2] else None
    if es_ultimo and actual:
        # Ya se le entregó el texto acumulado al ganador: limpiar para que la
        # próxima tanda de mensajes de este cliente empiece de cero.
        _ultimo_mensaje.pop(clave, None)
    return {"es_ultimo": es_ultimo, "mensaje_acumulado": mensaje_acumulado}


@router.get("/{slug}", response_model=schemas.CatalogoPublicoOut)
@limiter.limit("60/minute")
def get_public_catalogo(
    request: Request,
    slug: str,
    db: Session = Depends(deps.get_db)
):
    """Obtiene la información básica de la empresa y sus productos públicos."""
    db_empresa = db.query(models.Empresa).filter(models.Empresa.slug_catalogo == slug).first()
    if not db_empresa or not empresa_suscripcion_activa(db_empresa):
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
            tiene_variantes=bool(p.tiene_variantes),
            variantes=_mapear_variantes_publico(p),
        ))

    empresa_out = schemas.CatalogoEmpresaOut(
        nombre=db_empresa.nombre,
        slug_catalogo=db_empresa.slug_catalogo,
        whatsapp_pedidos=db_empresa.whatsapp_pedidos,
        logo_base64=db_empresa.logo_base64,
        color_primario=db_empresa.color_primario,
        direccion=db_empresa.ciudad,
        tipo_negocio=db_empresa.tipo_negocio or "erp",
        descripcion=db_empresa.descripcion,
        instagram_url=db_empresa.instagram_url,
        facebook_url=db_empresa.facebook_url,
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
@limiter.limit("60/minute")
def get_catalogo_productos(
    request: Request,
    slug: str,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    categoria_id: Optional[int] = None,
    db: Session = Depends(deps.get_db)
):
    """Listado paginado y filtrado de productos para el catálogo público."""
    limit = max(1, min(limit, CATALOGO_MAX_LIMIT))
    db_empresa = db.query(models.Empresa).filter(models.Empresa.slug_catalogo == slug).first()
    if not db_empresa or not empresa_suscripcion_activa(db_empresa):
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
            tiene_variantes=bool(p.tiene_variantes),
            variantes=_mapear_variantes_publico(p),
        ))
    
    return results

@router.get("/{slug}/ping")
@limiter.limit("30/minute")
def ping_catalogo(request: Request, slug: str, db: Session = Depends(deps.get_db)):
    """Endpoint de diagnóstico público. Verifica que el slug existe y que la API responde."""
    empresa = db.query(models.Empresa).filter(models.Empresa.slug_catalogo == slug).first()
    if not empresa or not empresa_suscripcion_activa(empresa):
        raise HTTPException(status_code=404, detail=f"No existe catálogo con slug '{slug}'")
    return {"ok": True, "empresa": empresa.nombre, "slug": slug}


@router.post("/{slug}/pedido", response_model=schemas.PedidoVirtualCreatedOut, status_code=201)
@limiter.limit("10/minute")
def create_pedido_virtual_publico(
    request: Request,
    slug: str,
    payload: schemas.PedidoVirtualCreate,
    db: Session = Depends(deps.get_db),
):
    """Recibe un pedido desde el catálogo público. No requiere autenticación."""
    try:
        pedido = crud_pv.create_pedido_publico(db, slug, payload)
        return schemas.PedidoVirtualCreatedOut(
            id=pedido.id,
            numero_pedido=pedido.numero_pedido,
            total=pedido.total,
            estado=pedido.estado.value if hasattr(pedido.estado, "value") else pedido.estado,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error inesperado creando pedido para slug=%s: %s", slug, e)
        raise HTTPException(status_code=500, detail=f"Error interno al guardar el pedido: {type(e).__name__}: {e}")


@router.get("/{slug}/pedido/estado", response_model=schemas.PedidoEstadoConsultaOut)
@limiter.limit("20/minute")
def consultar_estado_pedido_publico(
    request: Request,
    slug: str,
    numero_pedido: int,
    celular_cliente: str,
    db: Session = Depends(deps.get_db),
):
    """Consulta pública del estado de un pedido — el cliente necesita su
    número de pedido Y el celular con el que lo hizo (evita que cualquiera
    enumere pedidos ajenos probando números consecutivos)."""
    pedido = crud_pv.get_pedido_status_publico(db, slug, numero_pedido, celular_cliente)
    if not pedido:
        raise HTTPException(status_code=404, detail="No encontramos un pedido con esos datos.")

    estado = pedido.estado.value if hasattr(pedido.estado, "value") else pedido.estado
    cancelado = estado == "cancelado"
    etapa_idx = None if cancelado else (
        crud_pv.ETAPAS_FLUJO.index(estado) if estado in crud_pv.ETAPAS_FLUJO else None
    )

    return schemas.PedidoEstadoConsultaOut(
        numero_pedido=pedido.numero_pedido,
        estado=estado,
        estado_label=crud_pv.ETAPAS_LABELS.get(estado, estado),
        cancelado=cancelado,
        etapas=crud_pv.ETAPAS_FLUJO,
        etapas_labels=[crud_pv.ETAPAS_LABELS[e] for e in crud_pv.ETAPAS_FLUJO],
        etapa_actual_index=etapa_idx,
        total_etapas=len(crud_pv.ETAPAS_FLUJO),
        total=pedido.total,
        fecha_creacion=pedido.fecha_creacion,
        fecha_actualizacion=pedido.fecha_actualizacion,
        tipo_entrega=pedido.tipo_entrega,
        direccion_entrega=pedido.direccion_entrega,
        nombre_cliente=pedido.nombre_cliente,
        cantidad_items=len(pedido.detalles or []),
        empresa_nombre=pedido.empresa.nombre if pedido.empresa else "",
        empresa_telefono=pedido.empresa.whatsapp_pedidos if pedido.empresa else None,
    )


@router.post("/{slug}/pedido-restaurante", response_model=schemas.PedidoRestauranteCreatedOut, status_code=201)
@limiter.limit("15/minute")
def create_pedido_restaurante_publico(
    request: Request,
    slug: str,
    payload: schemas.PedidoRestaurantePublicoIn,
    db: Session = Depends(deps.get_db),
):
    """
    Recibe un pedido desde el catálogo público de un restaurante (autoservicio de mesa).
    No requiere autenticación. Crea o reutiliza la comanda activa de la mesa.
    """
    db_empresa = db.query(models.Empresa).filter(models.Empresa.slug_catalogo == slug).first()
    if not db_empresa or not empresa_suscripcion_activa(db_empresa):
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
            notas="Pedido desde menú digital (autoservicio)",
            origen="autoservicio",
        )
        db.add(comanda)
        mesa.estado = "ocupada"
        db.flush()
    else:
        # Si el cliente añade items a una comanda ya existente, marcarla como
        # autoservicio para que el personal sepa que el pedido llegó del menú digital.
        comanda.origen = "autoservicio"

    # Configuración de cocina de la empresa
    cfg = db.query(models.ConfigRestaurante).filter_by(empresa_id=db_empresa.id).first()
    areas = cfg.areas_cocina if cfg else ["Cocina general"]
    modo = getattr(cfg, "modo_impresion_comanda", None) or (
        "solo_impresion" if (cfg and cfg.imprimir_comanda_auto) else "solo_pantalla"
    )
    impresora_reemplaza_pantalla = (modo == "solo_impresion")

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
            models.Producto.mostrar_en_catalogo == True,
        ).first()
        if not prod:
            raise HTTPException(status_code=400, detail=f"Producto {it.producto_id} no encontrado en este menú.")

        # El precio SIEMPRE se recalcula desde la BD, nunca se confía en el
        # precio enviado por el cliente (evita manipulación de precios).
        precio_real = prod.precio
        if prod.tiene_variantes:
            if not it.variante_id:
                raise HTTPException(status_code=400, detail=f"Debes seleccionar una opción para '{prod.nombre}'.")
            variante = db.query(models.ProductoVariante).filter(
                models.ProductoVariante.id == it.variante_id,
                models.ProductoVariante.producto_id == prod.id,
                models.ProductoVariante.empresa_id == db_empresa.id,
                models.ProductoVariante.activo == True,
            ).first()
            if not variante:
                raise HTTPException(status_code=400, detail=f"La opción seleccionada para '{prod.nombre}' ya no está disponible.")
            if variante.precio is not None:
                precio_real = variante.precio

        if prod and prod.grupo_item:
            ov = overrides.get(prod.grupo_item)
            if ov and ov.requiere_cocina is not None:
                va_a_cocina = ov.requiere_cocina
            else:
                va_a_cocina = getattr(prod, "requiere_cocina", True)
            if va_a_cocina:
                area = areas[0] if areas else "Cocina general"

        if impresora_reemplaza_pantalla:
            va_a_cocina = False

        nuevo = models.ComandaItem(
            comanda_id=comanda.id,
            producto_id=it.producto_id,
            nombre_producto=it.nombre_producto,
            cantidad=it.cantidad,
            precio_unitario=precio_real,
            subtotal=round(it.cantidad * precio_real, 2),
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

    # ── Notificar al personal: nuevo pedido desde el menú digital ────────────
    # Se avisa a administradores, socios, meseros y cajeros para que atiendan
    # la mesa. La pantalla de cocina y el mapa de mesas también lo marcan visual-
    # mente vía el campo `origen="autoservicio"`.
    try:
        staff = db.query(models.User).join(models.Role).filter(
            models.User.empresa_id == db_empresa.id,
            models.Role.name.in_(["Admin", "Socio", "Mesero", "Cajero", "Administrador"]),
        ).all()
        mesa_label = mesa.nombre or f"Mesa {mesa.numero}"
        mensaje = f"🍽️ Nuevo pedido desde el menú digital — {mesa_label} (Comanda #{comanda.numero_comanda})"
        for u in staff:
            db.add(models.Notificacion(
                usuario_id=u.id,
                empresa_id=db_empresa.id,
                mensaje=mensaje,
                tipo="info",
                leido=False,
            ))
    except Exception:
        logger.exception("No se pudo crear notificación de pedido autoservicio (slug=%s)", slug)

    db.commit()
    db.refresh(comanda)

    return schemas.PedidoRestauranteCreatedOut(
        comanda_id=comanda.id,
        numero_comanda=comanda.numero_comanda,
        mesa_numero=mesa.numero,
        total=comanda.total,
    )


@router.get("/{slug}/productos/{producto_id}/imagen")
@limiter.limit("120/minute")
def get_producto_imagen(
    request: Request,
    slug: str,
    producto_id: int,
    index: int = 0,
    db: Session = Depends(deps.get_db)
):
    """Sirve una imagen específica del producto como un stream binario con cache."""
    # PREVENCIÓN IDOR: Validar que el producto pertenezca a la empresa del slug
    db_empresa = db.query(models.Empresa).filter(models.Empresa.slug_catalogo == slug).first()
    if not db_empresa or not empresa_suscripcion_activa(db_empresa):
        raise HTTPException(status_code=404, detail="Catálogo no encontrado.")

    from sqlalchemy import or_
    # Se sirve la imagen tanto para productos del catálogo como para servicios
    # agendables: la página pública de agendamiento muestra las fotos de los
    # servicios usando este mismo endpoint, y un servicio agendable puede tener
    # imágenes sin estar marcado como "mostrar en catálogo" — antes eso daba 404.
    db_producto = db.query(models.Producto).filter(
        models.Producto.id == producto_id,
        models.Producto.empresa_id == db_empresa.id,
        or_(models.Producto.mostrar_en_catalogo == True, models.Producto.agendable == True),
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
