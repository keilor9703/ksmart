import io
import httpx
import openpyxl
import pandas as pd
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation

import crud
import models
import schemas
from api.deps import get_db, get_current_active_user



import httpx

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional


router = APIRouter()

# ─── FUNCIONES DE BÚSQUEDA EN APIs EXTERNAS ─────────────────────────────────────

async def fetch_openfoodfacts(client: httpx.AsyncClient, barcode: str):
    """Busca en la base de datos de alimentos"""
    try:
        response = await client.get(f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json")
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == 1:
                p = data.get("product", {})
                return {
                    "nombre": p.get("product_name") or p.get("generic_name", ""),
                    "descripcion": p.get("brands", "")
                }
    except Exception:
        pass
    return None

async def fetch_upcitemdb(client: httpx.AsyncClient, barcode: str):
    """Busca en una de las bases de datos de retail más grandes (Electrónica, ropa, etc.)"""
    try:
        # Nota: La API gratuita de UPCitemdb permite ~100 peticiones diarias
        response = await client.get(f"https://api.upcitemdb.com/prod/trial/lookup?upc={barcode}")
        if response.status_code == 200:
            data = response.json()
            items = data.get("items", [])
            if items:
                item = items[0]
                return {
                    "nombre": item.get("title", ""),
                    "descripcion": item.get("brand", "") or item.get("description", "")
                }
    except Exception:
        pass
    return None

async def fetch_openbeauty_and_pets(client: httpx.AsyncClient, barcode: str):
    """Busca en bases de datos hermanas de OFF (Belleza y Mascotas)"""
    urls = [
        f"https://world.openbeautyfacts.org/api/v0/product/{barcode}.json",
        f"https://world.openpetfoodfacts.org/api/v0/product/{barcode}.json"
    ]
    for url in urls:
        try:
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == 1:
                    p = data.get("product", {})
                    return {
                        "nombre": p.get("product_name", ""),
                        "descripcion": p.get("brands", "")
                    }
        except Exception:
            continue
    return None

# ─── ENDPOINT PRINCIPAL ─────────────────────────────────────────────────────────

@router.get("/sku-preview")
def preview_sku(
    grupo_id: int = Query(...),
    nombre: str = Query(...),
    atributos: Optional[str] = Query(None),  # JSON string
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Returns what the auto-generated SKU would look like without saving."""
    import json
    attrs = {}
    if atributos:
        try:
            attrs = json.loads(atributos)
        except Exception:
            pass
    from crud.productos import _generate_smart_sku, sku_exists
    return {"sku": _generate_smart_sku(db, current_user.empresa_id, grupo_id, nombre, variante_attrs=attrs or None)}


@router.get("/sku/{sku}", response_model=Optional[schemas.Producto])
def get_producto_por_sku(
    sku: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Busca un producto por su SKU interno (exacto, solo en la empresa del usuario)."""
    return db.query(models.Producto).filter(
        models.Producto.sku == sku.upper(),
        models.Producto.empresa_id == current_user.empresa_id,
        models.Producto.vigente == True,
    ).first()


@router.post("/{producto_id}/variantes", response_model=schemas.ProductoVarianteOut)
def crear_variante(
    producto_id: int,
    payload: schemas.ProductoVarianteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    try:
        return crud.create_variante(db, empresa_id=current_user.empresa_id, producto_id=producto_id, payload=payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{producto_id}/variantes", response_model=List[schemas.ProductoVarianteOut])
def listar_variantes(
    producto_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.list_variantes(db, empresa_id=current_user.empresa_id, producto_id=producto_id)


@router.put("/{producto_id}/variantes/{variante_id}", response_model=schemas.ProductoVarianteOut)
def actualizar_variante(
    producto_id: int,
    variante_id: int,
    payload: schemas.ProductoVarianteUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    try:
        return crud.update_variante(db, empresa_id=current_user.empresa_id, variante_id=variante_id, payload=payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{producto_id}/variantes/{variante_id}")
def eliminar_variante(
    producto_id: int,
    variante_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    crud.delete_variante(db, empresa_id=current_user.empresa_id, variante_id=variante_id)
    return {"ok": True}


@router.get("/barcode/{barcode}", response_model=Optional[schemas.Producto])
async def get_producto_por_barcode(
    barcode: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    import asyncio
    # 1. Buscar SOLO en la empresa del usuario autenticado (sin cross-tenant)
    local_prod = db.query(models.Producto).filter(
        models.Producto.codigo_barras == barcode,
        models.Producto.empresa_id == current_user.empresa_id,
        models.Producto.vigente == True,
    ).first()

    if local_prod:
        return local_prod

    # 2. BÚSQUEDA PARALELA EN APIs PÚBLICAS (no se comparten datos entre tenants)
    async with httpx.AsyncClient(timeout=4.0) as client:
        results = await asyncio.gather(
            fetch_openfoodfacts(client, barcode),
            fetch_upcitemdb(client, barcode),
            fetch_openbeauty_and_pets(client, barcode),
            return_exceptions=True,
        )
        for resultado_api in results:
            if resultado_api and not isinstance(resultado_api, Exception) and resultado_api.get("nombre"):
                return {
                    "id": 0,
                    "nombre": resultado_api["nombre"],
                    "codigo_barras": barcode,
                    "unidad_medida": "UND",
                    "grupo_item": 2,
                    "precio": 0.0,
                    "costo": 0.0,
                    "descripcion": resultado_api.get("descripcion", ""),
                    "empresa_id": current_user.empresa_id
                }

    return None

@router.get("/template")
def get_productos_template(current_user: models.User = Depends(get_current_active_user)):
    wb = openpyxl.Workbook()

    ws_inst = wb.active
    ws_inst.title = "Instrucciones"
    ws_inst.sheet_properties.tabColor = "8B5CF6"
    ws_inst.cell(row=2, column=2, value="🛠 CÓMO USAR ESTA PLANTILLA").font = Font(size=14, bold=True, color="8B5CF6")
    instrucciones = [
        "1. Ve a la pestaña 'Plantilla Datos' para registrar tu inventario.",
        "2. IMPORTANTE: No modifiques, renombres ni elimines la fila 1 (Cabeceras).",
        "3. GRUPO_ITEM: Usa el desplegable (1=Materia Prima, 2=Prod. Terminado, 3=Activo Fijo, 4=Insumo).",
        "4. ES_SERVICIO: Usa el desplegable (0 = Producto Físico, 1 = Servicio Intangible).",
        "5. UNIDAD_MEDIDA: Usa el desplegable (UND, Kg, Lts, etc.).",
        "6. COSTO: Si marcas el ítem como Servicio (1), el costo debe ser 0."
    ]
    for i, inst in enumerate(instrucciones, 4):
        ws_inst.cell(row=i, column=2, value=inst).font = Font(size=11)
    ws_inst.column_dimensions['B'].width = 80

    ws_datos = wb.create_sheet(title="Plantilla Datos")
    headers = ["nombre", "precio", "costo", "grupo_item", "unidad_medida", "es_servicio", "stock_minimo"]
    header_fill = PatternFill(start_color="8B5CF6", end_color="8B5CF6", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)

    for col_num, header in enumerate(headers, 1):
        cell = ws_datos.cell(row=1, column=col_num, value=header.upper())
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        ws_datos.column_dimensions[openpyxl.utils.get_column_letter(col_num)].width = 20

    dv_grupo = DataValidation(type="list", formula1='"1,2,3,4"', allow_blank=True)
    dv_grupo.error = 'Selecciona una opción válida de la lista'
    ws_datos.add_data_validation(dv_grupo)
    dv_grupo.add("D2:D1000")

    dv_unidad = DataValidation(type="list", formula1='"UND,Kg,MTS,Lts,Gr"', allow_blank=True)
    ws_datos.add_data_validation(dv_unidad)
    dv_unidad.add("E2:E1000")

    dv_servicio = DataValidation(type="list", formula1='"0,1"', allow_blank=True)
    ws_datos.add_data_validation(dv_servicio)
    dv_servicio.add("F2:F1000")

    ejemplos = [
        ["Cacao Tostado", 5000, 3000, 1, "Kg", 0, 10],
        ["Chocolatina 80g", 12000, 4500, 2, "UND", 0, 5],
        ["Servicio Maquila", 2500, 0, 2, "UND", 1, 0]
    ]
    for r_idx, row_data in enumerate(ejemplos, 2):
        for c_idx, value in enumerate(row_data, 1):
            ws_datos.cell(row=r_idx, column=c_idx, value=value)

    ws_datos.freeze_panes = 'A2'
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="plantilla_productos_PRO.xlsx"'}
    )

@router.post("/upload", response_model=schemas.BulkLoadResponse)
def upload_productos(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.bulk_create_productos(db=db, empresa_id=current_user.empresa_id, file=file.file, filename=file.filename)

@router.post("/{producto_id}/duplicate", response_model=schemas.Producto)
def duplicate_producto(
    producto_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    original = crud.get_producto(db, empresa_id=current_user.empresa_id, producto_id=producto_id)
    if not original:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    import copy
    nuevo = schemas.ProductoCreate(
        nombre=f"Copia de {original.nombre}",
        precio=original.precio,
        costo=original.costo,
        es_servicio=original.es_servicio,
        unidad_medida=original.unidad_medida,
        grupo_item=original.grupo_item,
        stock_minimo=original.stock_minimo,
        maneja_lotes=original.maneja_lotes,
        descripcion=original.descripcion,
        mostrar_en_catalogo=False,
        imagenes=list(original.imagenes or []),
        # SKU y barcode no se copian para evitar duplicados
    )
    return crud.create_producto(db=db, empresa_id=current_user.empresa_id, producto=nuevo)


@router.post("/", response_model=schemas.Producto)
def create_producto(producto: schemas.ProductoCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    # Validar barcode único en la empresa
    if producto.codigo_barras:
        existing = db.query(models.Producto).filter(
            models.Producto.empresa_id == current_user.empresa_id,
            models.Producto.codigo_barras == producto.codigo_barras,
            models.Producto.vigente == True,
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"Ya existe un producto con el código de barras '{producto.codigo_barras}'.")
    return crud.create_producto(db=db, empresa_id=current_user.empresa_id, producto=producto)

@router.get("/low-stock", response_model=List[schemas.Producto])
def get_low_stock(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Productos físicos con stock_actual < stock_minimo."""
    from sqlalchemy import and_
    items = db.query(models.Producto).filter(
        models.Producto.empresa_id == current_user.empresa_id,
        models.Producto.vigente == True,
        models.Producto.es_servicio == False,
        models.Producto.stock_actual < models.Producto.stock_minimo,
    ).order_by(models.Producto.stock_actual.asc()).all()
    from crud.impuestos import attach_impuestos_to_productos
    return attach_impuestos_to_productos(db, current_user.empresa_id, items)


@router.get("/", response_model=List[schemas.Producto])
def read_productos(
    skip: int = 0,
    limit: int = 500,
    solo_pos: bool = False,
    q: Optional[str] = Query(None, description="Buscar por nombre, SKU, barcode, categoría"),
    grupo: Optional[str] = Query(None, description="ID de grupo o 'servicio'"),
    stock: Optional[str] = Query(None, description="ok | bajo | sinStock"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_productos(
        db,
        empresa_id=current_user.empresa_id,
        skip=skip,
        limit=limit,
        solo_pos=solo_pos,
        search=q,
        filter_group=grupo,
        filter_stock=stock,
    )

@router.put("/{producto_id}", response_model=schemas.Producto)
def update_producto(producto_id: int, producto: schemas.ProductoCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    if producto.codigo_barras:
        existing = db.query(models.Producto).filter(
            models.Producto.empresa_id == current_user.empresa_id,
            models.Producto.codigo_barras == producto.codigo_barras,
            models.Producto.vigente == True,
            models.Producto.id != producto_id,
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"Ya existe otro producto con el código de barras '{producto.codigo_barras}'.")
    db_producto = crud.update_producto(db, empresa_id=current_user.empresa_id, producto_id=producto_id, producto=producto)
    if db_producto is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return db_producto

@router.delete("/{producto_id}")
def delete_producto(producto_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    db_producto = crud.get_producto(db, empresa_id=current_user.empresa_id, producto_id=producto_id)
    if db_producto is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    crud.delete_producto(db, empresa_id=current_user.empresa_id, producto_id=producto_id)
    return {"message": f"Producto '{db_producto.nombre}' eliminado correctamente"}

@router.get("/export")
def exportar_productos(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    prods = crud.get_productos(db, empresa_id=current_user.empresa_id)
    groups = {1: 'MP', 2: 'PT', 3: 'AF', 4: 'INS'}
    rows = [
        {
            "id": p.id, "nombre": p.nombre, "precio": p.precio, "costo": p.costo,
            "grupo_item": groups.get(p.grupo_item, 'PT'), "es_servicio": "SÍ" if p.es_servicio else "NO",
            "unidad_medida": p.unidad_medida, "stock_minimo": float(p.stock_minimo or 0),
            "stock_actual": float(p.stock_actual or 0)
        }
        for p in prods
    ]
    df = pd.DataFrame(rows)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Productos")
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="productos_existentes.xlsx"'}
    )

@router.patch("/{producto_id}/stock-minimo")
def actualizar_stock_minimo(
    producto_id: int,
    body: schemas.ProductoStockUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    prod = crud.update_producto_stock_minimo(db, empresa_id=current_user.empresa_id, producto_id=producto_id, minimo=body.stock_minimo or 0)
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"ok": True}
