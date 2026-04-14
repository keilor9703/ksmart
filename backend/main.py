import os
import logging
import secrets
from fastapi import FastAPI, Depends, HTTPException, Response, status, File, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import date, datetime, timedelta, timezone
from jose import JWTError, jwt
import crud, models, schemas
from database import SessionLocal, engine, run_migrations
from models import Base, utcnow
from fastapi.responses import StreamingResponse
from io import BytesIO
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Query
import shutil
import os

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

# ─── Tablas + migraciones ─────────────────────────────────────────────────────
models.Base.metadata.create_all(bind=engine)
run_migrations()

app = FastAPI(title="Ksmart360 API", version="2.0.0")

# ─── CORS ─────────────────────────────────────────────────────────────────────
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://appksmp.vercel.app",
    "https://ksmart360.vercel.app",
    "https://app.appjeylor.com",
    "https://appjeylor.com",
    "https://api.appjeylor.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── JWT ──────────────────────────────────────────────────────────────────────
# ✅ SECRET_KEY desde variable de entorno. Si no está, genera una aleatoria
# (solo para desarrollo — en producción SIEMPRE usar variable de entorno).
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    SECRET_KEY = secrets.token_urlsafe(32)
    logger.warning(
        "⚠️  SECRET_KEY no está configurada en las variables de entorno. "
        "Se generó una clave aleatoria que cambiará en cada reinicio. "
        "Todos los tokens JWT actuales quedarán inválidos. "
        "Configura SECRET_KEY=<clave_segura> en tu entorno de producción."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# ─── Sesión BD ────────────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ─── Datos iniciales ──────────────────────────────────────────────────────────
def initialize_default_data(db: Session):
    default_modules_data = [
        {"name": "Ventas",             "description": "Módulo para la gestión de ventas.",              "frontend_path": "/ventas"},
        {"name": "Clientes",           "description": "Módulo para la gestión de clientes.",             "frontend_path": "/clientes"},
        {"name": "Productos",          "description": "Módulo para la gestión de productos.",            "frontend_path": "/productos"},
        {"name": "Reportes",           "description": "Módulo para la visualización de reportes.",       "frontend_path": "/reportes"},
        {"name": "Gestion Usuarios",   "description": "Módulo de administración de usuarios.",           "frontend_path": "/admin/users"},
        {"name": "Gestion Roles",      "description": "Módulo de administración de roles.",              "frontend_path": "/admin/roles"},
        {"name": "Gestion Modulos",    "description": "Módulo de administración de módulos.",            "frontend_path": "/admin/modules"},
        {"name": "Órdenes de Trabajo", "description": "Módulo para la gestión de órdenes de trabajo.",  "frontend_path": "/ordenes-trabajo"},
        {"name": "Panel del Operador", "description": "Panel de productividad para operadores.",         "frontend_path": "/panel-operador"},
        {"name": "Recetas",            "description": "Gestión de fórmulas de producción (BOM).",        "frontend_path": "/produccion/recetas"},
        {"name": "Producción",         "description": "Gestión de lotes y transformaciones.",            "frontend_path": "/produccion/lotes"},
        {"name": "Compras",            "description": "Módulo para la gestión de compras.",              "frontend_path": "/compras"},
        {"name": "Inventarios",        "description": "Módulo para movimientos y alertas de stock.",     "frontend_path": "/inventario"},
        {"name": "Reportes inventario","description": "Reportes de inventario y kardex.",                "frontend_path": "/reportes-inventario"},
        {"name": "Caja",               "description": "Módulo de corte de caja diario.",                 "frontend_path": "/caja"},  # ✅ NUEVO
    ]

    admin_role = crud.get_role_by_name(db, name="Admin")
    if not admin_role:
        admin_role = crud.create_role(db, schemas.RoleCreate(name="Admin"))

    created_modules = []
    for mod_data in default_modules_data:
        modulo = crud.get_modulo_by_name(db, name=mod_data["name"])
        if not modulo:
            modulo = crud.create_modulo(db, schemas.ModuloCreate(**mod_data))
        created_modules.append(modulo)

    crud.set_modules_for_role(db, admin_role.id, [m.id for m in created_modules])

    admin_user = crud.get_user_by_username(db, username="admin")
    if not admin_user:
        crud.create_user(db, schemas.UserCreate(username="admin", password="adminpass", role_id=admin_role.id))

@app.on_event("startup")
def startup_event():
    models.Base.metadata.create_all(bind=engine)
    run_migrations()
    db = SessionLocal()
    try:
        initialize_default_data(db)
    finally:
        db.close()

# ─── JWT helpers ──────────────────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = crud.get_user_by_username(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

def get_current_active_user(current_user: schemas.User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=400, detail="Usuario inactivo")
    return current_user

def get_current_admin_user(current_user: schemas.User = Depends(get_current_user)):
    if current_user.role.name != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes")
    return current_user

# ═══════════════════════════════════════════════════════════════════════════════
# AUTENTICACIÓN
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, username=form_data.username)
    if not user or not crud.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.username,
            "role": user.role.name,
            "modules": [m.frontend_path for m in user.role.modules]
        },
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# ═══════════════════════════════════════════════════════════════════════════════
# ROLES / MÓDULOS / USUARIOS
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/roles/", response_model=schemas.Role)
def create_role(role: schemas.RoleCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_admin_user)):
    if crud.get_role_by_name(db, name=role.name):
        raise HTTPException(status_code=400, detail="Rol ya registrado")
    return crud.create_role(db=db, role=role)

@app.get("/roles/", response_model=List[schemas.Role])
def read_roles(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_admin_user)):
    return crud.get_roles(db, skip=skip, limit=limit)

@app.put("/roles/{role_id}/modules", response_model=schemas.Role)
def set_role_modules(role_id: int, module_ids: List[int], db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_admin_user)):
    db_role = crud.set_modules_for_role(db, role_id=role_id, module_ids=module_ids)
    if db_role is None:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    return db_role

@app.post("/modulos/", response_model=schemas.Modulo)
def create_modulo(modulo: schemas.ModuloCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_admin_user)):
    if crud.get_modulo_by_name(db, name=modulo.name):
        raise HTTPException(status_code=400, detail="Módulo ya registrado")
    return crud.create_modulo(db=db, modulo=modulo)

@app.get("/modulos/", response_model=List[schemas.Modulo])
def read_modulos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_admin_user)):
    return crud.get_modulos(db, skip=skip, limit=limit)

@app.put("/modulos/{modulo_id}", response_model=schemas.Modulo)
def update_modulo(modulo_id: int, modulo: schemas.ModuloCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_admin_user)):
    db_modulo = crud.update_modulo(db, modulo_id=modulo_id, modulo=modulo)
    if db_modulo is None:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
    return db_modulo

@app.delete("/modulos/{modulo_id}")
def delete_modulo(modulo_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_admin_user)):
    if crud.delete_modulo(db, modulo_id=modulo_id) is None:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
    return {"message": "Módulo eliminado"}

@app.post("/users/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_admin_user)):
    if crud.get_user_by_username(db, username=user.username):
        raise HTTPException(status_code=400, detail="Nombre de usuario ya registrado")
    return crud.create_user(db=db, user=user)

@app.get("/users/me", response_model=schemas.User)
def read_users_me(current_user: schemas.User = Depends(get_current_active_user)):
    return current_user

@app.get("/users/", response_model=List[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_admin_user)):
    return crud.get_users(db, skip=skip, limit=limit)

@app.put("/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int, user: schemas.UserCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_admin_user)):
    db_user = crud.update_user(db, user_id=user_id, user=user)
    if db_user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return db_user

@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_admin_user)):
    if crud.delete_user(db, user_id=user_id) is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"message": "Usuario eliminado"}

# ═══════════════════════════════════════════════════════════════════════════════
# CLIENTES / TERCEROS
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/clientes/", response_model=schemas.Cliente)
def create_cliente(cliente: schemas.ClienteCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.create_cliente(db=db, cliente=cliente)

@app.post("/clientes/upload", response_model=schemas.BulkLoadResponse)
def upload_clientes(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.bulk_create_clientes(db=db, file=file.file, filename=file.filename)

@app.get("/clientes/", response_model=List[schemas.Cliente])
def read_clientes(skip: int = 0, limit: int = 500, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.get_clientes(db, skip=skip, limit=limit)

@app.get("/clientes/{cliente_id}", response_model=schemas.Cliente)
def read_cliente(cliente_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    db_cliente = crud.get_cliente(db, cliente_id=cliente_id)
    if db_cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return db_cliente

@app.put("/clientes/{cliente_id}", response_model=schemas.Cliente)
def update_cliente(cliente_id: int, cliente: schemas.ClienteCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    db_cliente = crud.update_cliente(db, cliente_id=cliente_id, cliente=cliente)
    if db_cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return db_cliente

@app.get("/clientes/{cliente_id}/details", response_model=schemas.ClienteDetails)
def get_cliente_details(cliente_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    db_cliente = crud.get_cliente(db, cliente_id=cliente_id)
    if db_cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    deuda_actual = crud.get_cliente_deuda(db, cliente_id=cliente_id)
    return schemas.ClienteDetails(**db_cliente.__dict__, deuda_actual=deuda_actual)

@app.delete("/clientes/{cliente_id}")
def delete_cliente(cliente_id: int, db: Session = Depends(get_db),
                   current_user: schemas.User = Depends(get_current_active_user)):
    db_cliente = crud.get_cliente(db, cliente_id=cliente_id)
    if db_cliente is None:
        raise HTTPException(status_code=404, detail="Tercero no encontrado")
    bloqueos = crud.check_can_delete_cliente(db, cliente_id)
    if bloqueos:
        raise HTTPException(
            status_code=409,
            detail=(
                f"No se puede eliminar '{db_cliente.nombre}' porque tiene: "
                + ", ".join(bloqueos) + ". Desactívelo en lugar de eliminarlo."
            )
        )
    crud.delete_cliente(db, cliente_id=cliente_id)
    return {"message": f"Tercero '{db_cliente.nombre}' eliminado correctamente"}

@app.get("/clientes/{cliente_id}/history", response_model=schemas.ClienteHistory)
def get_cliente_history(cliente_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    history = crud.get_cliente_history(db, cliente_id=cliente_id)
    if history is None:
        raise HTTPException(status_code=404, detail="Historial no encontrado")
    return history

@app.get("/clientes/template")
def get_clientes_template(current_user: schemas.User = Depends(get_current_active_user)):
    cols = ["nombre", "cedula", "telefono", "direccion", "cupo_credito", "es_cliente", "es_proveedor"]
    examples = [
        ["Tiendas D1", "900123456", "1234567", "Calle 10 #20-30", 0, 1, 1],
        ["Juan Perez", "10203040", "3001234567", "Carrera 5 #15-10", 500000, 1, 0]
    ]
    df = pd.DataFrame(examples, columns=cols)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Terceros")
    output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": 'attachment; filename="plantilla_terceros.xlsx"'})

# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCTOS
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/productos/", response_model=schemas.Producto)
def create_producto(producto: schemas.ProductoCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.create_producto(db=db, producto=producto)

@app.post("/productos/upload", response_model=schemas.BulkLoadResponse)
def upload_productos(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.bulk_create_productos(db=db, file=file.file, filename=file.filename)

@app.get("/productos/", response_model=List[schemas.Producto])
def read_productos(skip: int = 0, limit: int = 500, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.get_productos(db, skip=skip, limit=limit)

@app.put("/productos/{producto_id}", response_model=schemas.Producto)
def update_producto(producto_id: int, producto: schemas.ProductoCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    db_producto = crud.update_producto(db, producto_id=producto_id, producto=producto)
    if db_producto is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return db_producto

@app.delete("/productos/{producto_id}")
def delete_producto(producto_id: int, db: Session = Depends(get_db),
                    current_user: schemas.User = Depends(get_current_active_user)):
    db_producto = crud.get_producto(db, producto_id=producto_id)
    if db_producto is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    bloqueos = crud.check_can_delete_producto(db, producto_id)
    if bloqueos:
        raise HTTPException(
            status_code=409,
            detail=(
                f"No se puede eliminar '{db_producto.nombre}' porque está: "
                + ", ".join(bloqueos) + ". Archívelo en lugar de eliminarlo."
            )
        )
    crud.delete_producto(db, producto_id=producto_id)
    return {"message": f"Producto '{db_producto.nombre}' eliminado correctamente"}

@app.get("/productos/export")
def exportar_productos(db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    prods = crud.get_productos(db)
    groups = {1: 'MP', 2: 'PT', 3: 'AF', 4: 'INS'}
    rows = [{"id": p.id, "nombre": p.nombre, "precio": p.precio, "costo": p.costo,
             "grupo_item": groups.get(p.grupo_item, 'PT'), "es_servicio": "SÍ" if p.es_servicio else "NO",
             "unidad_medida": p.unidad_medida, "stock_minimo": float(p.stock_minimo or 0),
             "stock_actual": float(p.stock_actual or 0)} for p in prods]
    df = pd.DataFrame(rows)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Productos")
    output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": 'attachment; filename="productos_existentes.xlsx"'})

@app.get("/productos/template")
def get_productos_template(current_user: schemas.User = Depends(get_current_active_user)):
    cols = ["nombre", "precio", "costo", "grupo_item", "unidad_medida", "es_servicio", "stock_minimo"]
    examples = [
        ["Cacao en Grano", 5000, 3000, "MP - Materia Prima", "Kg", 0, 10],
        ["Chocolate 80g", 12000, 4500, "PT - Producto Terminado", "UND", 0, 5],
        ["Servicio Maquila", 2500, 0, "PT - Producto Terminado", "UND", 1, 0],
        ["Estantería", 0, 500000, "AF - Activo Fijo", "UND", 0, 0],
        ["Empaque Plástico", 200, 100, "INS - Insumo", "UND", 0, 100]
    ]
    df = pd.DataFrame(examples, columns=cols)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Plantilla")
    output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": 'attachment; filename="plantilla_productos.xlsx"'})

# ═══════════════════════════════════════════════════════════════════════════════
# VENTAS
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/ventas/", response_model=schemas.Venta)
def create_venta(venta: schemas.VentaCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    db_cliente = crud.get_cliente(db, cliente_id=venta.cliente_id)
    if not db_cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    if not venta.detalles:
        raise HTTPException(status_code=400, detail="Debe proporcionar al menos un producto.")

    for d in venta.detalles:
        prod = crud.get_producto(db, d.producto_id)
        if not prod:
            raise HTTPException(status_code=404, detail=f"Producto {d.producto_id} no existe")
        if not prod.es_servicio and prod.grupo_item != 2:
            raise HTTPException(status_code=400, detail=f"'{prod.nombre}' no es un Producto Terminado y no puede venderse.")
        if not prod.es_servicio:
            if (prod.stock_actual or 0) < d.cantidad:
                raise HTTPException(status_code=400, detail=f"Stock insuficiente para '{prod.nombre}'. Disponible: {prod.stock_actual}, requerido: {d.cantidad}")

    if not venta.pagada:
        total_nueva = sum(
            (d.precio_unitario if d.precio_unitario is not None else crud.get_producto(db, d.producto_id).precio) * d.cantidad
            for d in venta.detalles
        )
        deuda_actual = crud.get_cliente_deuda(db, venta.cliente_id)
        if (deuda_actual + total_nueva) > db_cliente.cupo_credito:
            cupo_disp = db_cliente.cupo_credito - deuda_actual
            raise HTTPException(status_code=400, detail=f"La venta excede el cupo de crédito. Disponible: {cupo_disp:.2f}")

    db_venta = crud.create_venta(db=db, venta=venta)

    # ✅ Movimientos de inventario (SALIDA)
    try:
        for det in db_venta.detalles:
            prod = crud.get_producto(db, det.producto_id)
            if getattr(prod, "es_servicio", False):
                continue
            crud.create_movement(db, schemas.InventoryMovementCreate(
                producto_id=det.producto_id,
                tipo=schemas.MovementType.salida,
                cantidad=det.cantidad,
                costo_unitario=prod.costo or 0.0,
                motivo="venta",
                referencia=f"venta #{db_venta.id}",
                observacion=""
            ))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # ✅ Disparar notificación de stock bajo
    crud.check_and_notify_low_stock(db, [det.producto_id for det in db_venta.detalles])

    return db_venta

@app.get("/ventas/", response_model=List[schemas.Venta])
def read_ventas(
    skip: int = 0,
    limit: int = Query(default=100, le=500),   # ✅ límite configurable, máx 500
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_active_user)
):
    return crud.get_ventas(db, skip=skip, limit=limit)

@app.get("/ventas/{venta_id}", response_model=schemas.Venta)
def read_venta(venta_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    db_venta = crud.get_venta(db, venta_id=venta_id)
    if db_venta is None:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return db_venta

@app.put("/ventas/{venta_id}", response_model=schemas.Venta)
def update_venta(venta_id: int, venta: schemas.VentaCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    if not crud.get_cliente(db, cliente_id=venta.cliente_id):
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    if not venta.detalles:
        raise HTTPException(status_code=400, detail="Debe proporcionar al menos un producto.")
    for detalle in venta.detalles:
        if not crud.get_producto(db, producto_id=detalle.producto_id):
            raise HTTPException(status_code=404, detail=f"Producto {detalle.producto_id} no encontrado.")
    db_venta = crud.update_venta(db, venta_id=venta_id, venta=venta)
    if db_venta is None:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return db_venta

@app.delete("/ventas/{venta_id}")
def delete_venta(venta_id: int, db: Session = Depends(get_db),
                 current_user: schemas.User = Depends(get_current_active_user)):
    db_venta = crud.get_venta(db, venta_id=venta_id)
    if db_venta is None:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    bloqueos = crud.check_can_delete_venta(db, venta_id)
    if bloqueos:
        raise HTTPException(
            status_code=409,
            detail=(
                f"No se puede eliminar la venta #{venta_id} porque "
                + ", ".join(bloqueos) + "."
            )
        )
    crud.revertir_movimientos_venta(db, db_venta)
    crud.delete_venta(db, venta_id=venta_id)
    return {"message": f"Venta #{venta_id} eliminada y stock revertido"}

# ═══════════════════════════════════════════════════════════════════════════════
# PAGOS
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/pagos/", response_model=schemas.Pago)
def create_pago(pago: schemas.PagoCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    db_venta = crud.get_venta(db, venta_id=pago.venta_id)
    if not db_venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    monto_pendiente = db_venta.total - db_venta.monto_pagado
    if pago.monto > monto_pendiente + 0.01:
        raise HTTPException(status_code=400, detail=f"El monto excede el saldo pendiente de {monto_pendiente:.2f}")
    return crud.create_pago(db=db, pago=pago)

@app.get("/pagos/", response_model=List[schemas.Pago])
def read_pagos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return db.query(models.Pago).offset(skip).limit(limit).all()

@app.put("/pagos/{pago_id}", response_model=schemas.Pago)
def update_pago(pago_id: int, pago: schemas.PagoUpdate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    db_pago = crud.update_pago(db, pago_id=pago_id, pago=pago)
    if db_pago is None:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return db_pago

# ═══════════════════════════════════════════════════════════════════════════════
# INVENTARIO
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/inventario/kardex/{producto_id}", response_model=schemas.KardexResponse)
def kardex_producto(producto_id: int, start_date: Optional[str] = Query(None), end_date: Optional[str] = Query(None),
                    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    sd = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
    ed = datetime.strptime(end_date, "%Y-%m-%d") if end_date else None
    return crud.get_kardex_promedio_ponderado(db, producto_id, sd, ed)

@app.get("/inventario/kardex/{producto_id}/export")
def kardex_export_csv(producto_id: int, start_date: Optional[str] = Query(None), end_date: Optional[str] = Query(None),
                      db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    sd = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
    ed = datetime.strptime(end_date, "%Y-%m-%d") if end_date else None
    rep = crud.get_kardex_promedio_ponderado(db, producto_id, sd, ed)
    lines = ["fecha,tipo,cantidad,costo_unit,referencia,saldo_cant,saldo_costo,saldo_valor"]
    for it in rep.items:
        lines.append(f"{it.fecha.isoformat()},{it.tipo},{it.cantidad},{it.costo_unitario},{it.referencia or ''},{it.saldo_cantidad},{it.saldo_costo_unitario},{it.saldo_valor}")
    return Response(content="\n".join(lines), headers={"Content-Disposition": f'attachment; filename="kardex_{producto_id}.csv"', "Content-Type": "text/csv; charset=utf-8"})

@app.get("/reportes/inventario-actual", response_model=schemas.InventarioSnapshot)
def inventario_actual(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_inventario_actual(db)

@app.get("/reportes/inventario-actual/export")
def inventario_actual_export(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    snap = crud.get_inventario_actual(db)
    lines = ["id,nombre,es_servicio,unidad,stock_actual,costo,precio,valor_costo,valor_venta"]
    for it in snap.items:
        lines.append(f"{it.id},{it.nombre},{1 if it.es_servicio else 0},{it.unidad_medida or ''},{it.stock_actual},{it.costo},{it.precio},{it.valor_costo},{it.valor_venta}")
    lines.append(f"TOTALS,,,,,,,{snap.total_valor_costo},{snap.total_valor_venta}")
    return Response(content="\n".join(lines), headers={"Content-Disposition": 'attachment; filename="inventario_actual.csv"', "Content-Type": "text/csv; charset=utf-8"})

@app.get("/reportes/rotacion", response_model=schemas.ReporteRotacion)
def reporte_rotacion(start_date: Optional[str] = Query(None), end_date: Optional[str] = Query(None),
                     limit: int = Query(10, ge=1, le=100), incluir_servicios: bool = Query(False),
                     db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    sd = datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else None
    ed = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else None
    return crud.get_rotacion_productos(db, sd, ed, limit=limit, incluir_servicios=incluir_servicios)

@app.post("/inventario/movimientos", response_model=schemas.InventoryMovementOut)
def crear_movimiento(payload: schemas.InventoryMovementCreate, db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
    try:
        return crud.create_movement(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/inventario/movimientos", response_model=List[schemas.InventoryMovementOut])
def listar_movimientos(producto_id: Optional[int] = None, limit: int = 100, db: Session = Depends(get_db),
                       current_user: models.User = Depends(get_current_user)):
    return crud.list_movements(db, producto_id=producto_id, limit=limit)

@app.get("/inventario/alertas/bajo-stock", response_model=List[schemas.InventoryAlertOut])
def alertas_bajo_stock(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    prods = crud.get_low_stock(db)
    return [schemas.InventoryAlertOut(producto_id=p.id, nombre=p.nombre, stock_actual=p.stock_actual or 0, stock_minimo=p.stock_minimo or 0) for p in prods]

@app.patch("/productos/{producto_id}/stock-minimo")
def actualizar_stock_minimo(producto_id: int, body: schemas.ProductoStockUpdate, db: Session = Depends(get_db),
                             current_user: models.User = Depends(get_current_user)):
    prod = crud.update_producto_stock_minimo(db, producto_id, body.stock_minimo or 0)
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"ok": True}

@app.post("/movimientos/upload", response_model=schemas.BulkLoadResponse)
def upload_movimientos(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.bulk_create_movimientos(db=db, file=file.file, filename=file.filename)

# ═══════════════════════════════════════════════════════════════════════════════
# REPORTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/reportes/ventas_summary", response_model=schemas.VentasSummary)
def get_ventas_summary(start_date: Optional[date] = None, end_date: Optional[date] = None,
                       db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.get_ventas_summary(db, start_date=start_date, end_date=end_date)

@app.get("/reportes/productos_vendidos", response_model=schemas.ReporteProductosVendidos)
def get_productos_vendidos(start_date: Optional[date] = None, end_date: Optional[date] = None,
                           db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.get_productos_vendidos(db, start_date=start_date, end_date=end_date)

@app.get("/reportes/clientes_compradores", response_model=List[schemas.ClienteComprador])
def get_clientes_compradores(start_date: Optional[date] = None, end_date: Optional[date] = None,
                             db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.get_clientes_compradores(db, start_date=start_date, end_date=end_date)

@app.get("/reportes/clientes_deudores", response_model=List[schemas.ClienteDeudor])
def get_clientes_deudores(db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.get_clientes_deudores(db)

@app.get("/reportes/rentabilidad_productos", response_model=List[schemas.ProductoRentabilidad])
def get_rentabilidad_productos(start_date: Optional[date] = None, end_date: Optional[date] = None,
                               db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.get_rentabilidad_por_producto(db, start_date=start_date, end_date=end_date)

@app.get("/reportes/cuentas_por_cobrar", response_model=List[schemas.ClienteCuentasPorCobrar])
def get_cuentas_por_cobrar(db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.get_cuentas_por_cobrar_por_cliente(db)

@app.get("/reportes/dashboard", response_model=schemas.DashboardData)
def get_dashboard_report(db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.get_dashboard_data(db)

@app.get("/reportes/iva-neto")
def get_iva_neto(start_date: Optional[date] = None, end_date: Optional[date] = None,
                 db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    from sqlalchemy import func
    query_v_iva   = db.query(func.sum(models.Venta.iva_total))
    query_v_total = db.query(func.sum(models.Venta.total))
    query_c_iva   = db.query(func.sum(models.Compra.iva_total))
    query_c_total = db.query(func.sum(models.Compra.total))
    if start_date:
        query_v_iva   = query_v_iva.filter(models.Venta.fecha >= start_date)
        query_v_total = query_v_total.filter(models.Venta.fecha >= start_date)
        query_c_iva   = query_c_iva.filter(models.Compra.fecha >= start_date)
        query_c_total = query_c_total.filter(models.Compra.fecha >= start_date)
    if end_date:
        td = timedelta(days=1)
        query_v_iva   = query_v_iva.filter(models.Venta.fecha < end_date + td)
        query_v_total = query_v_total.filter(models.Venta.fecha < end_date + td)
        query_c_iva   = query_c_iva.filter(models.Compra.fecha < end_date + td)
        query_c_total = query_c_total.filter(models.Compra.fecha < end_date + td)
    iva_v = query_v_iva.scalar() or 0.0
    tot_v = query_v_total.scalar() or 0.0
    iva_c = query_c_iva.scalar() or 0.0
    tot_c = query_c_total.scalar() or 0.0
    return {"periodo": {"desde": start_date, "hasta": end_date}, "iva_generado_ventas": iva_v,
            "iva_descontable_compras": iva_c, "iva_neto_resultado": iva_v - iva_c,
            "ventas_brutas": tot_v, "base_gravable_ventas": tot_v - iva_v,
            "compras_brutas": tot_c, "base_gravable_compras": tot_c - iva_c}

@app.get("/reportes/productividad", response_model=schemas.ReporteProductividad, dependencies=[Depends(get_current_admin_user)])
def get_productivity_report(start_date: date, end_date: date, db: Session = Depends(get_db)):
    return crud.get_reporte_productividad(db, start_date=start_date, end_date=end_date)

@app.get("/reportes/produccion-summary")
def get_produccion_summary(start_date: Optional[date] = None, end_date: Optional[date] = None,
                           db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    query = db.query(models.LoteProduccion).filter(models.LoteProduccion.estado == "Confirmado")
    if start_date:
        query = query.filter(models.LoteProduccion.fecha_confirmacion >= start_date)
    if end_date:
        query = query.filter(models.LoteProduccion.fecha_confirmacion < end_date + timedelta(days=1))
    lotes = query.all()
    return {"total_costo_produccion": sum(l.costo_total for l in lotes),
            "total_unidades_producidas": sum(l.cantidad_real for l in lotes if l.cantidad_real),
            "total_lotes_finalizados": len(lotes),
            "total_maquilas": len([l for l in lotes if l.cliente_id])}

@app.get("/reportes/consumo-insumos")
def get_consumo_insumos(start_date: Optional[date] = None, end_date: Optional[date] = None,
                        db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    query = (db.query(models.Producto.nombre,
                      func.sum(models.InventoryMovement.cantidad).label("cantidad_total"),
                      func.sum(models.InventoryMovement.cantidad * models.InventoryMovement.costo_unitario).label("costo_total"))
               .join(models.InventoryMovement, models.Producto.id == models.InventoryMovement.producto_id)
               .filter(models.InventoryMovement.tipo == "salida")
               .filter(models.InventoryMovement.motivo.like("%Producción%")))
    if start_date:
        query = query.filter(models.InventoryMovement.created_at >= start_date)
    if end_date:
        query = query.filter(models.InventoryMovement.created_at < end_date + timedelta(days=1))
    results = query.group_by(models.Producto.nombre).order_by(func.sum(models.InventoryMovement.cantidad).desc()).all()
    return [{"insumo": r.nombre, "cantidad": r.cantidad_total, "costo": r.costo_total} for r in results]

# ═══════════════════════════════════════════════════════════════════════════════
# DEVOLUCIONES  ✅ NUEVO
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/devoluciones/", response_model=schemas.DevolucionOut)
def crear_devolucion(
    data: schemas.DevolucionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Registra una devolución parcial o total de una venta.
    - Repone stock automáticamente por cada producto devuelto.
    - Reduce el total de la venta (nota crédito).
    - Genera notificación para el admin.
    """
    return crud.crear_devolucion(db, data)

@app.get("/devoluciones/venta/{venta_id}", response_model=List[schemas.DevolucionOut])
def get_devoluciones_venta(
    venta_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    return crud.get_devoluciones_by_venta(db, venta_id)

# ═══════════════════════════════════════════════════════════════════════════════
# CORTE DE CAJA  ✅ NUEVO
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/caja/corte", response_model=schemas.CorteCajaOut)
def crear_corte_caja(data: schemas.CorteCajaCreate, db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_active_user)):
    return crud.crear_corte_caja(db, usuario_id=current_user.id, efectivo_fisico=data.efectivo_fisico,
                                  observaciones=data.observaciones)

@app.get("/caja/cortes", response_model=List[schemas.CorteCajaOut])
def listar_cortes(skip: int = 0, limit: int = 30, db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_active_user)):
    return crud.get_cortes_caja(db, skip=skip, limit=limit)

@app.get("/caja/corte/preview")
def preview_corte(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    """Calcula los totales del día sin cerrar la caja — útil para que el cajero vea el resumen antes del arqueo."""
    return crud.calcular_totales_dia(db)

    

@app.post("/caja/gastos", response_model=schemas.GastoOut)
def registrar_gasto(data: schemas.GastoCreate, db: Session = Depends(get_db),
                    current_user: models.User = Depends(get_current_active_user)):
    return crud.crear_gasto(db, current_user.id, data)

@app.get("/caja/gastos", response_model=List[schemas.GastoOut])
def listar_gastos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_active_user)):
    return crud.get_gastos(db, skip=skip, limit=limit)

# ═══════════════════════════════════════════════════════════════════════════════
# NOTIFICACIONES  ✅ ACTIVADAS
# ═══════════════════════════════════════════════════════════════════════════════

notificaciones_router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"],
                                  dependencies=[Depends(get_current_active_user)])

@notificaciones_router.get("/", response_model=List[schemas.Notificacion])
def get_my_notifications(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.get_notificaciones_usuario(db, usuario_id=current_user.id)

@notificaciones_router.get("/unread-count")
def get_unread_count(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    count = db.query(models.Notificacion).filter(
        models.Notificacion.usuario_id == current_user.id,
        models.Notificacion.leido == False
    ).count()
    return {"unread": count}

@notificaciones_router.put("/{notificacion_id}/leida", response_model=schemas.Notificacion)
def mark_notification_as_read(notificacion_id: int, db: Session = Depends(get_db),
                               current_user: models.User = Depends(get_current_active_user)):
    db_notif = crud.marcar_notificacion_leida(db, notificacion_id=notificacion_id, usuario_id=current_user.id)
    if db_notif is None:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    return db_notif

@notificaciones_router.put("/mark-all-read")
def mark_all_read(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    db.query(models.Notificacion).filter(
        models.Notificacion.usuario_id == current_user.id,
        models.Notificacion.leido == False
    ).update({"leido": True})
    db.commit()
    return {"message": "Todas las notificaciones marcadas como leídas"}

app.include_router(notificaciones_router)  # ✅ ACTIVADO (antes estaba comentado)

# ═══════════════════════════════════════════════════════════════════════════════
# ÓRDENES DE TRABAJO
# ═══════════════════════════════════════════════════════════════════════════════

EVIDENCE_DIR = "evidencias"
os.makedirs(EVIDENCE_DIR, exist_ok=True)

ordenes_router = APIRouter(prefix="/ordenes-trabajo", tags=["Órdenes de Trabajo"],
                           dependencies=[Depends(get_current_active_user)])

@ordenes_router.post("/", response_model=schemas.OrdenTrabajo)
def create_orden_trabajo(orden: schemas.OrdenTrabajoCreate, db: Session = Depends(get_db),
                         current_user: models.User = Depends(get_current_active_user)):
    operador_id = current_user.id
    if current_user.role.name == 'Admin' and orden.operador_id is not None:
        if not crud.get_user(db, orden.operador_id):
            raise HTTPException(status_code=404, detail="Operador no encontrado")
        operador_id = orden.operador_id
    return crud.create_orden_trabajo(db=db, orden=orden, operador_id=operador_id)

@ordenes_router.get("/", response_model=List[schemas.OrdenTrabajo])
def read_ordenes_trabajo(skip: int = 0, limit: int = 100, estado: Optional[str] = None,
                         start_date: Optional[date] = None, end_date: Optional[date] = None,
                         cliente_id: Optional[int] = None,
                         filter_operador_id: Optional[int] = Query(None, alias="operador_id"),
                         db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    op_filter = filter_operador_id if current_user.role.name == 'Admin' else current_user.id
    return crud.get_ordenes_trabajo(db, skip=skip, limit=limit, operador_id=op_filter, estado=estado,
                                    start_date=start_date, end_date=end_date, cliente_id=cliente_id)

@ordenes_router.get("/total", response_model=float)
def get_total_ordenes(estado: Optional[str] = None, start_date: Optional[date] = None,
                      end_date: Optional[date] = None, cliente_id: Optional[int] = None,
                      filter_operador_id: Optional[int] = Query(None, alias="operador_id"),
                      db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    op_filter = filter_operador_id if current_user.role.name == 'Admin' else current_user.id
    return crud.get_total_ordenes_trabajo(db, operador_id=op_filter, estado=estado,
                                          start_date=start_date, end_date=end_date, cliente_id=cliente_id)

@ordenes_router.get("/{orden_id}", response_model=schemas.OrdenTrabajo)
def read_orden_trabajo(orden_id: int, db: Session = Depends(get_db)):
    db_orden = crud.get_orden_trabajo(db, orden_id=orden_id)
    if db_orden is None:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return db_orden

@ordenes_router.put("/{orden_id}", response_model=schemas.OrdenTrabajo)
def update_orden_trabajo(orden_id: int, orden: schemas.OrdenTrabajoCreate, db: Session = Depends(get_db),
                         current_user: models.User = Depends(get_current_active_user)):
    db_orden = crud.get_orden_trabajo(db, orden_id)
    if db_orden is None:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if db_orden.operador_id != current_user.id and current_user.role.name != 'Admin':
        raise HTTPException(status_code=403, detail="Sin permiso para editar esta orden")
    if not crud.get_cliente(db, cliente_id=orden.cliente_id):
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    updated = crud.update_orden_trabajo(db, orden_id=orden_id, orden=orden)
    if updated is None:
        raise HTTPException(status_code=500, detail="Error al actualizar")
    return updated

@ordenes_router.put("/{orden_id}/enviar-revision", response_model=schemas.OrdenTrabajo)
def enviar_revision(orden_id: int, db: Session = Depends(get_db),
                    current_user: models.User = Depends(get_current_active_user)):
    db_orden = crud.get_orden_trabajo(db, orden_id)
    if db_orden.operador_id != current_user.id and current_user.role.name != 'Admin':
        raise HTTPException(status_code=403, detail="Sin permiso")
    return crud.update_orden_trabajo_estado(db, orden_id=orden_id, estado="En revisión")

@ordenes_router.post("/{orden_id}/aprobar", response_model=schemas.OrdenTrabajo)
def approve_orden(orden_id: int, db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_admin_user)):
    db_orden = crud.aprobar_orden_trabajo(db, orden_id=orden_id, admin_user=current_user)
    if db_orden is None:
        raise HTTPException(status_code=404, detail="Orden no encontrada o no está en revisión")
    try:
        for item in getattr(db_orden, "productos", []):
            prod = crud.get_producto(db, item.producto_id)
            if not prod or getattr(prod, "es_servicio", False):
                continue
            if (prod.stock_actual or 0) < item.cantidad:
                raise HTTPException(status_code=400, detail=f"Stock insuficiente para '{prod.nombre}'")
            crud.create_movement(db, schemas.InventoryMovementCreate(
                producto_id=item.producto_id, tipo=schemas.MovementType.salida,
                cantidad=item.cantidad, costo_unitario=prod.costo or 0.0,
                motivo="orden_trabajo", referencia=f"OT #{orden_id}", observacion=""
            ))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return db_orden

@ordenes_router.post("/{orden_id}/rechazar", response_model=schemas.OrdenTrabajo)
def reject_orden(orden_id: int, observaciones: str, db: Session = Depends(get_db),
                 current_user: models.User = Depends(get_current_admin_user)):
    db_orden = crud.rechazar_orden_trabajo(db, orden_id=orden_id, observaciones=observaciones, admin_user=current_user)
    if db_orden is None:
        raise HTTPException(status_code=404, detail="Orden no encontrada o no está en revisión")
    return db_orden

@ordenes_router.put("/{orden_id}/cerrar", response_model=schemas.OrdenTrabajo)
def cerrar_orden(orden_id: int, close_data: schemas.OrdenTrabajoClose, db: Session = Depends(get_db),
                 current_user: models.User = Depends(get_current_admin_user)):
    if close_data.was_paid and close_data.payment_type == "partial":
        if not close_data.paid_amount or close_data.paid_amount <= 0:
            raise HTTPException(status_code=400, detail="Monto parcial requerido y debe ser > 0")
    db_orden = crud.cerrar_orden_trabajo(db, orden_id=orden_id, admin_user=current_user, close_data=close_data)
    if db_orden is None:
        raise HTTPException(status_code=404, detail="Orden no encontrada o no puede cerrarse")
    return db_orden

@ordenes_router.post("/{orden_id}/evidencia")
def upload_evidence(orden_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    file_path = os.path.join(EVIDENCE_DIR, f"{orden_id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    crud.add_evidencia_orden_trabajo(db, orden_id=orden_id, file_path=file_path)
    return {"filename": file.filename, "path": file_path}

app.include_router(ordenes_router)

# ═══════════════════════════════════════════════════════════════════════════════
# PANEL OPERADOR
# ═══════════════════════════════════════════════════════════════════════════════

panel_router = APIRouter(prefix="/panel_operador", tags=["Panel del Operador"],
                         dependencies=[Depends(get_current_active_user)])

@panel_router.get("/pendientes", response_model=List[schemas.PanelOrdenPendiente])
def get_pendientes(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    if current_user.role.name not in ('Operador', 'Admin'):
        raise HTTPException(status_code=403, detail="Acceso denegado")
    return crud.get_ordenes_pendientes_operador(db, operador_id=current_user.id)

@panel_router.get("/productividad", response_model=schemas.PanelProductividad)
def get_productividad(start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
                      db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    if current_user.role.name not in ('Operador', 'Admin'):
        raise HTTPException(status_code=403, detail="Acceso denegado")
    return crud.get_productividad_operador(db, operador_id=current_user.id, start_date=start_date, end_date=end_date)

@panel_router.get("/historial", response_model=List[schemas.PanelHistorialItem])
def get_historial(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    if current_user.role.name not in ('Operador', 'Admin'):
        raise HTTPException(status_code=403, detail="Acceso denegado")
    return crud.get_historial_reciente_operador(db, operador_id=current_user.id)

app.include_router(panel_router)

# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCCIÓN
# ═══════════════════════════════════════════════════════════════════════════════

produccion_router = APIRouter(prefix="/produccion", tags=["Producción"],
                              dependencies=[Depends(get_current_active_user)])

@produccion_router.get("/recetas/", response_model=List[schemas.Receta])
def read_recetas(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_recetas(db, skip=skip, limit=limit)

@produccion_router.get("/recetas/{receta_id}", response_model=schemas.Receta)
def read_receta(receta_id: int, db: Session = Depends(get_db)):
    db_r = crud.get_receta(db, receta_id=receta_id)
    if not db_r:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    return db_r

@produccion_router.post("/recetas/", response_model=schemas.Receta)
def create_receta(receta: schemas.RecetaCreate, db: Session = Depends(get_db)):
    if crud.get_receta_by_producto(db, receta.producto_id):
        raise HTTPException(status_code=400, detail="Este producto ya tiene una receta.")
    return crud.create_receta(db, receta)

@produccion_router.delete("/recetas/{receta_id}")
def delete_receta(receta_id: int, db: Session = Depends(get_db)):
    db_receta = crud.get_receta(db, receta_id=receta_id)
    if not db_receta:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    bloqueos = crud.check_can_delete_receta(db, receta_id)
    if bloqueos:
        raise HTTPException(
            status_code=409,
            detail=(
                f"No se puede eliminar la receta '{db_receta.nombre}' porque "
                + ", ".join(bloqueos) + "."
            )
        )
    crud.delete_receta(db, receta_id)
    return {"message": "Receta eliminada"}

@produccion_router.get("/lotes/", response_model=List[schemas.LoteProduccion])
def read_lotes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_lotes(db, skip=skip, limit=limit)

@produccion_router.get("/lotes/{lote_id}", response_model=schemas.LoteProduccion)
def read_lote(lote_id: int, db: Session = Depends(get_db)):
    db_l = crud.get_lote(db, lote_id=lote_id)
    if not db_l:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    return db_l

@produccion_router.post("/lotes/", response_model=schemas.LoteProduccion)
def create_lote(lote: schemas.LoteProduccionCreate, db: Session = Depends(get_db)):
    return crud.create_lote(db, lote)

@produccion_router.post("/lotes/{lote_id}/confirmar", response_model=schemas.LoteProduccion)
def confirmar_lote(lote_id: int, confirm_data: schemas.LoteProduccionConfirm, db: Session = Depends(get_db)):
    try:
        return crud.confirmar_lote_produccion(db, lote_id, confirm_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@produccion_router.put("/lotes/{lote_id}/cancelar")
def cancelar_lote(lote_id: int, db: Session = Depends(get_db)):
    if not crud.cancelar_lote(db, lote_id):
        raise HTTPException(status_code=404, detail="Lote no encontrado o no puede cancelarse")
    return {"message": "Lote cancelado"}

app.include_router(produccion_router)

# ═══════════════════════════════════════════════════════════════════════════════
# COMPRAS
# ═══════════════════════════════════════════════════════════════════════════════

compras_router = APIRouter(prefix="/compras", tags=["Compras"],
                           dependencies=[Depends(get_current_active_user)])

@compras_router.get("/", response_model=List[schemas.Compra])
def read_compras(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_compras(db, skip=skip, limit=limit)

@compras_router.post("/", response_model=schemas.Compra)
def create_compra(compra: schemas.CompraCreate, db: Session = Depends(get_db)):
    db_prov = db.query(models.Cliente).filter(models.Cliente.id == compra.proveedor_id).first()
    if not db_prov or not db_prov.es_proveedor:
        raise HTTPException(status_code=400, detail="Proveedor no válido.")
    return crud.create_compra(db, compra)

@compras_router.get("/{compra_id}", response_model=schemas.Compra)
def read_compra(compra_id: int, db: Session = Depends(get_db)):
    db_c = crud.get_compra(db, compra_id)
    if not db_c:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return db_c

@compras_router.post("/pagos/", response_model=schemas.PagoCompraCreate)
def add_pago_compra(pago: schemas.PagoCompraCreate, db: Session = Depends(get_db)):
    db_c = db.query(models.Compra).get(pago.compra_id)
    if not db_c:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    monto_pendiente = db_c.total - db_c.monto_pagado
    if pago.monto > (monto_pendiente + 0.01):
        raise HTTPException(status_code=400, detail=f"Pago excede el saldo de {monto_pendiente:.2f}")
    crud.create_pago_compra(db, pago)
    return pago

app.include_router(compras_router)

# ═══════════════════════════════════════════════════════════════════════════════
# ESTÁTICOS
# ═══════════════════════════════════════════════════════════════════════════════

from fastapi.staticfiles import StaticFiles
app.mount("/evidencias", StaticFiles(directory=EVIDENCE_DIR), name="evidencias")

@app.get("/")
def read_root():
    return {"message": "Ksmart360 API v2.0", "docs": "/docs"}
