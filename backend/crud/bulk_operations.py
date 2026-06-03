from sqlalchemy.orm import Session
from typing import Optional, List, IO
from datetime import datetime
from fastapi import HTTPException
import models, schemas, pandas as pd
from crud.common import BOGOTA_TZ
from crud.productos import get_producto, create_producto
from crud.clientes import create_cliente
from crud.inventario import create_movement
from crud.grupos_producto import resolve_grupo_by_name


def bulk_create_productos(db: Session, empresa_id: int, file: IO, filename: str):
    try:
        file_extension = filename.split('.')[-1].lower()

        # 1. Leer TODAS las hojas del archivo para no atascarnos en las instrucciones
        if file_extension == 'xlsx':
            dfs = pd.read_excel(file, engine='openpyxl', sheet_name=None)
        elif file_extension == 'xls':
            dfs = pd.read_excel(file, engine='xlrd', sheet_name=None)
        elif file_extension == 'csv':
            df = pd.read_csv(file)
            dfs = {"Sheet1": df}
        else:
            raise HTTPException(
                status_code=400,
                detail="Formato no soportado. Por favor cargue archivos .xlsx, .xls o .csv."
            )

        # 2. Seleccionar inteligentemente la hoja de datos
        if "Plantilla Datos" in dfs:
            df = dfs["Plantilla Datos"]
        else:
            # Fallback para plantillas antiguas o CSVs
            df = list(dfs.values())[0]

        # 3. Normalizar cabeceras: convertimos todo a minúsculas y quitamos espacios
        df.columns = [str(c).strip().lower().replace("\r", "").replace("\n", "") for c in df.columns]

        # Validación de seguridad
        if 'nombre' not in df.columns:
            raise HTTPException(
                status_code=400,
                detail="El archivo no tiene la columna 'NOMBRE'. Asegúrese de llenar la pestaña 'Plantilla Datos'."
            )

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error procesando archivo: {e}")

    # 4. Forzar tipos de datos en las columnas numéricas
    numeric_cols = ['precio', 'costo', 'stock_minimo', 'grupo_item']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    created_count = 0
    errors = []

    def normalize_name(name: str) -> str:
        return "".join(str(name).lower().split())

    existing_names = {
        normalize_name(p.nombre)
        for p in db.query(models.Producto).filter(
            models.Producto.empresa_id == empresa_id,
            models.Producto.vigente == True,
        ).all()
    }
    seen_names = set()

    def map_group(val):
        return resolve_grupo_by_name(db, empresa_id, str(val))

    for index, row in df.iterrows():
        try:
            raw_name = str(row.get('nombre', '')).strip()

            # Ignorar filas totalmente vacías que Excel a veces genera por error
            if (not raw_name or raw_name == '0' or raw_name == 'nan') and pd.isna(row.get('precio')):
                continue

            if not raw_name or raw_name == '0' or raw_name == 'nan':
                errors.append(f"Fila {index + 2}: Nombre del producto es obligatorio.")
                continue

            norm_name = normalize_name(raw_name)

            if norm_name in existing_names:
                errors.append(f"Fila {index + 2}: Producto '{raw_name}' ya existe.")
                continue

            if norm_name in seen_names:
                errors.append(f"Fila {index + 2}: Producto '{raw_name}' duplicado en el archivo.")
                continue

            seen_names.add(norm_name)

            # Saneamiento del campo es_servicio (Para evitar fallos si el usuario deja en blanco)
            es_servicio_val = row.get('es_servicio', 0)
            es_servicio = bool(int(float(es_servicio_val))) if pd.notna(es_servicio_val) else False

            producto_data = schemas.ProductoCreate(
                nombre=raw_name,
                precio=float(row.get('precio', 0.0)),
                costo=float(row.get('costo', 0.0)),
                es_servicio=es_servicio,
                unidad_medida=str(row.get('unidad_medida', 'UND')).strip() if pd.notna(row.get('unidad_medida')) else 'UND',
                stock_minimo=float(row.get('stock_minimo', 0.0)),
                grupo_item=map_group(row.get('grupo_item', 'PT'))
            )
            create_producto(db, empresa_id, producto_data)
            created_count += 1

        except Exception as e:
            errors.append(f"Fila {index + 2}: {str(e)}")

    return {
        "success": True if created_count > 0 else False,
        "message": f"Carga masiva finalizada. {created_count} productos creados."
                   + (f" Se omitieron {len(errors)} filas con errores." if errors else ""),
        "created_records": created_count,
        "errors": errors
    }

def bulk_create_clientes(db: Session, empresa_id: int, file: IO, filename: str):
    try:
        dfs = pd.read_excel(file, engine='openpyxl', sheet_name=None)
        df = dfs.get("Plantilla Datos", list(dfs.values())[0])
        df.columns = [str(c).strip().lower().replace("\r", "").replace("\n", "") for c in df.columns]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error leyendo Excel: {e}")

    created_count = 0
    errors = []
    existing_cedulas = {str(c.cedula) for c in db.query(models.Cliente).filter(models.Cliente.empresa_id == empresa_id).all() if c.cedula}
    seen_cedulas = set()

    for index, row in df.iterrows():
        try:
            nombre = str(row.get('nombre', '')).strip()
            cedula = str(row.get("cedula", "")).strip() if pd.notna(row.get("cedula")) else None

            # Omitir filas vacías
            if (not nombre or nombre == 'nan') and not cedula:
                continue

            if not cedula:
                errors.append(f"Fila {index + 2}: Cliente '{nombre}' sin cédula/NIT.")
                continue

            if cedula in existing_cedulas or cedula in seen_cedulas:
                errors.append(f"Fila {index + 2}: Cédula {cedula} ya existe o está duplicada.")
                continue

            seen_cedulas.add(cedula)

            # Convertir el texto 'SI'/'NO' a booleano
            es_cliente = str(row.get('es_cliente', 'SI')).strip().upper() == 'SI'
            es_proveedor = str(row.get('es_proveedor', 'NO')).strip().upper() == 'SI'

            cliente_data = schemas.ClienteCreate(
                nombre=nombre,
                cedula=cedula,
                telefono=str(row.get('telefono', '')) if pd.notna(row.get('telefono')) else None,
                direccion=str(row.get('direccion', '')) if pd.notna(row.get('direccion')) else None,
                cupo_credito=float(row.get('cupo_credito', 0.0)) if pd.notna(row.get('cupo_credito')) else 0.0,
                es_cliente=es_cliente,
                es_proveedor=es_proveedor
            )
            create_cliente(db, empresa_id, cliente_data)
            created_count += 1
        except Exception as e:
            errors.append(f"Fila {index + 2}: {str(e)}")

    return {
        "success": created_count > 0,
        "message": f"Carga finalizada. {created_count} terceros creados.",
        "created_records": created_count,
        "errors": errors
    }


def bulk_create_movimientos(db: Session, empresa_id: int, file: IO, filename: str):
    try:
        dfs = pd.read_excel(file, engine='openpyxl', sheet_name=None)
        df = dfs.get("Plantilla Datos", list(dfs.values())[0])
        df.columns = [str(c).strip().lower().replace("\r", "").replace("\n", "") for c in df.columns]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error leyendo Excel: {e}")

    created_count = 0
    errors = []

    # Crear diccionario de productos para búsqueda rápida por nombre
    productos = db.query(models.Producto).filter(
        models.Producto.empresa_id == empresa_id,
        models.Producto.vigente == True,
    ).all()
    productos_by_name = {"".join(str(p.nombre).lower().split()): p for p in productos}

    for index, row in df.iterrows():
        try:
            raw_name = str(row.get('producto_nombre', '')).strip()

            # Omitir filas vacías
            if not raw_name or raw_name == 'nan':
                continue

            norm_name = "".join(raw_name.lower().split())
            prod = productos_by_name.get(norm_name)

            if not prod:
                errors.append(f"Fila {index+2}: El producto '{raw_name}' no existe en la base de datos.")
                continue

            tipo = str(row.get('tipo', '')).lower().strip()
            if tipo not in ["entrada", "salida", "ajuste"]:
                errors.append(f"Fila {index+2}: Tipo '{tipo}' no es válido.")
                continue

            cantidad = float(row.get("cantidad", 0)) if pd.notna(row.get("cantidad")) else 0
            if cantidad <= 0 and tipo in ["entrada", "salida"]:
                errors.append(f"Fila {index+2}: La cantidad debe ser mayor a 0.")
                continue

            if tipo == "salida" and (prod.stock_actual or 0) < cantidad:
                errors.append(f"Fila {index+2}: Stock insuficiente para '{raw_name}'. Disp: {prod.stock_actual}")
                continue

            payload = schemas.InventoryMovementCreate(
                producto_id=prod.id,
                tipo=tipo,
                cantidad=cantidad,
                costo_unitario=float(row.get('costo_unitario', 0.0)) if pd.notna(row.get('costo_unitario')) else 0.0,
                motivo=str(row.get('motivo', '')) if pd.notna(row.get('motivo')) else "",
                referencia=str(row.get('referencia', '')) if pd.notna(row.get('referencia')) else "",
                observacion=str(row.get('observacion', '')) if pd.notna(row.get('observacion')) else ""
            )
            create_movement(db, empresa_id, payload)
            created_count += 1
        except Exception as e:
            errors.append(f"Error en fila {index+2}: {e}")

    return {
        "success": created_count > 0,
        "message": f"Inventario actualizado. {created_count} movimientos creados.",
        "created_records": created_count,
        "errors": errors
    }
