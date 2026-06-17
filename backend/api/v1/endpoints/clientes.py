import io
import openpyxl
from typing import List
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from openpyxl.styles import Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

import crud
import models
import schemas
from api.deps import get_db, get_current_active_user

router = APIRouter()

@router.get("/template")
def get_clientes_template(current_user: models.User = Depends(get_current_active_user)):
    wb = openpyxl.Workbook()

    ws_inst = wb.active
    ws_inst.title = "Instrucciones"
    ws_inst.sheet_properties.tabColor = "3B82F6"
    ws_inst.cell(row=2, column=2, value="🛠 CÓMO REGISTRAR TERCEROS").font = Font(size=14, bold=True, color="3B82F6")
    instrucciones = [
        "1. Usa la pestaña 'Plantilla Datos' para registrar clientes o proveedores.",
        "2. La columna CEDULA (NIT o documento) no debe repetirse. Si ya existe, se omitirá.",
        "3. ES_CLIENTE y ES_PROVEEDOR: Usa la lista desplegable (SI / NO).",
        "4. No modifiques ni elimines la Fila 1."
    ]
    for i, inst in enumerate(instrucciones, 4):
        ws_inst.cell(row=i, column=2, value=inst).font = Font(size=11)
    ws_inst.column_dimensions['B'].width = 80

    ws_datos = wb.create_sheet(title="Plantilla Datos")
    headers = ["NOMBRE", "CEDULA", "TELEFONO", "DIRECCION", "CUPO_CREDITO", "ES_CLIENTE", "ES_PROVEEDOR"]
    header_fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)

    for col_num, header in enumerate(headers, 1):
        cell = ws_datos.cell(row=1, column=col_num, value=header)
        cell.fill, cell.font = header_fill, header_font
        ws_datos.column_dimensions[openpyxl.utils.get_column_letter(col_num)].width = 20

    dv = DataValidation(type="list", formula1='"SI,NO"', allow_blank=False)
    ws_datos.add_data_validation(dv)
    dv.add("F2:F1000")
    dv.add("G2:G1000")

    ejemplos = [
        ["Distribuidora XYZ S.A.S", "900123456-1", "3001234567", "Calle 10 # 5-20", 5000000, "NO", "SI"],
        ["Juan Pérez", "10203040", "3100000000", "Carrera 5 # 10-30", 0, "SI", "NO"]
    ]
    for r_idx, row in enumerate(ejemplos, 2):
        for c_idx, val in enumerate(row, 1):
            ws_datos.cell(row=r_idx, column=c_idx, value=val)

    ws_datos.freeze_panes = 'A2'
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="plantilla_terceros_PRO.xlsx"'}
    )

@router.post("/", response_model=schemas.Cliente)
def create_cliente(cliente: schemas.ClienteCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.create_cliente(db=db, empresa_id=current_user.empresa_id, cliente=cliente)

@router.post("/upload", response_model=schemas.BulkLoadResponse)
def upload_clientes(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.bulk_create_clientes(db=db, empresa_id=current_user.empresa_id, file=file.file, filename=file.filename)

@router.get("/", response_model=List[schemas.Cliente])
def read_clientes(skip: int = 0, limit: int = 500, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.get_clientes(db, empresa_id=current_user.empresa_id, skip=skip, limit=limit)

@router.get("/{cliente_id}", response_model=schemas.Cliente)
def read_cliente(cliente_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    db_cliente = crud.get_cliente(db, empresa_id=current_user.empresa_id, cliente_id=cliente_id)
    if db_cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return db_cliente

@router.put("/{cliente_id}", response_model=schemas.Cliente)
def update_cliente(cliente_id: int, cliente: schemas.ClienteCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    db_cliente = crud.update_cliente(db, empresa_id=current_user.empresa_id, cliente_id=cliente_id, cliente=cliente)
    if db_cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return db_cliente

@router.get("/{cliente_id}/details", response_model=schemas.ClienteDetails)
def get_cliente_details(cliente_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    db_cliente = crud.get_cliente(db, empresa_id=current_user.empresa_id, cliente_id=cliente_id)
    if db_cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    deuda_actual = crud.get_cliente_deuda(db, empresa_id=current_user.empresa_id, cliente_id=cliente_id)
    return schemas.ClienteDetails(**db_cliente.__dict__, deuda_actual=deuda_actual)

@router.delete("/{cliente_id}")
def delete_cliente(cliente_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    db_cliente = crud.get_cliente(db, empresa_id=current_user.empresa_id, cliente_id=cliente_id)
    if db_cliente is None:
        raise HTTPException(status_code=404, detail="Tercero no encontrado")
    bloqueos = crud.check_can_delete_cliente(db, empresa_id=current_user.empresa_id, cliente_id=cliente_id)
    if bloqueos:
        raise HTTPException(
            status_code=409,
            detail=(
                f"No se puede eliminar '{db_cliente.nombre}' porque tiene: "
                + ", ".join(bloqueos) + ". Desactívelo en lugar de eliminarlo."
            )
        )
    crud.delete_cliente(db, empresa_id=current_user.empresa_id, cliente_id=cliente_id)
    return {"message": f"Tercero '{db_cliente.nombre}' eliminado correctamente"}

@router.get("/{cliente_id}/history", response_model=schemas.ClienteHistory)
def get_cliente_history(cliente_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    history = crud.get_cliente_history(db, empresa_id=current_user.empresa_id, cliente_id=cliente_id)
    if history is None:
        raise HTTPException(status_code=404, detail="Historial no encontrado")
    return history
