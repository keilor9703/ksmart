


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
from fastapi import APIRouter
import shutil

import hashlib
import time
import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
# Tus otras importaciones
from fastapi import Request

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
# Asegúrate de importar tus modelos, schemas, y la dependencia get_db
# import models, schemas
# from database import get_db

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

# ─── Tablas + migraciones ─────────────────────────────────────────────────────
models.Base.metadata.create_all(bind=engine)
run_migrations()

app = FastAPI(title="Ksmart360 API Multi-Tenant", version="2.1.0")

# ─── CORS ─────────────────────────────────────────────────────────────────────
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://appksmp.vercel.app",
    "https://ksmart360.vercel.app",
    "https://www.appjeylor.com",
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

# 1. AUTO-HEALING: Asegurarnos de que la Empresa Maestra (1) exista Y ESTÉ ACTIVA
    empresa_default = db.query(models.Empresa).first()
    if not empresa_default:
        empresa_default = models.Empresa(
            nombre="Vialmar Cacao (Mi Fábrica)",
            nit="900000000-1",
            color_primario="#F43F5E",
            is_active=True
        )
        db.add(empresa_default)
        db.commit()
        db.refresh(empresa_default)
    else:
        # ✅ FIX 1: Reactivamos a la fuerza si estaba inactiva
        if not empresa_default.is_active:
            empresa_default.is_active = True
            db.commit()
            logger.info("✅ Empresa maestra reactivada automáticamente.")

        # ✅ FIX 2: Si no tiene fecha de creación (Quedó en NULL), le asignamos la de hoy
        if not empresa_default.created_at:
            empresa_default.created_at = utcnow()
            db.commit()

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
        {"name": "Caja",               "description": "Módulo de corte de caja diario.",                 "frontend_path": "/caja"},
         {"name": "Préstamos",               "description": "Módulo de gestión de préstamos.",            "frontend_path": "/prestamos"},
        {"name": "Ruta de Cobro",               "description": "Módulo de gestión de ruta de cobro.",    "frontend_path": "/ruta-cobro"},
    ]

    admin_role = crud.get_role_by_name(db, name="Admin")
    if not admin_role:
        admin_role = crud.create_role(db, schemas.RoleCreate(name="Admin"))

    created_modules = []
    for mod_data in default_modules_data:
        modulo = crud.get_modulo_by_frontend_path(
            db,
            frontend_path=mod_data["frontend_path"]
        )
        if not modulo:
            modulo = crud.create_modulo(
                db,
                schemas.ModuloCreate(**mod_data)
            )
        created_modules.append(modulo)

    crud.set_modules_for_role(db, admin_role.id, [m.id for m in created_modules])

    admin_user = crud.get_user_by_username(db, username="admin")
    if not admin_user:
        crud.create_user(db, schemas.UserCreate(username="admin", password="adminpass", role_id=admin_role.id), empresa_id=1)

@app.on_event("startup")
def startup_event():
    models.Base.metadata.create_all(bind=engine)
    run_migrations()
    db = SessionLocal()
    try:
        initialize_default_data(db)
    finally:
        db.close()

# ─── JWT helpers & DEPENDENCIAS DE SEGURIDAD ──────────────────────────────────
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

from fastapi import HTTPException, status

def get_current_active_user(current_user: schemas.User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=400, detail="Usuario inactivo")

    empresa = current_user.empresa
    if not empresa.is_active:
        raise HTTPException(status_code=403, detail="Suscripción suspendida. Contacte a soporte.")

    # ✅ EL GUARDIA DE VENCIMIENTO: Aplica para TODOS los planes, no solo para "trial"
    if empresa.trial_ends_at: 
        ahora_utc = datetime.now(timezone.utc)
        fecha_limite = empresa.trial_ends_at

        # Si la fecha viene de SQLite no tendrá tzinfo (es naive).
        if fecha_limite.tzinfo is None:
            fecha_limite = fecha_limite.replace(tzinfo=timezone.utc)

        # La comparación es universal, el vencimiento manda sobre el tipo de plan
        if ahora_utc > fecha_limite:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED, 
                detail="Suscripción expirada."
            )

    return current_user


def get_current_admin_user(current_user: schemas.User = Depends(get_current_user)):
    if current_user.role.name != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes")
    return current_user

def get_current_superadmin_user(current_user: schemas.User = Depends(get_current_user)):
    """
    Solo los usuarios Admin de la Empresa 1 (Dueños del SaaS) pueden acceder a estas rutas.
    """
    if current_user.role.name != "Admin" or current_user.empresa_id != 1:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado: Solo SuperAdmin")
    return current_user


# ─── 1. CONFIGURACIÓN DE ENCRIPTACIÓN (Si no la tienes ya definida) ───
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session



@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def registrar_nuevo_cliente(data: schemas.RegistroSaaS, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Usuario en uso.")

    # 🚀 CONFIGURACIÓN DE PERFILES (FLEXIBILIDAD TOTAL)
    PERFILES = {
        "erp": ["/ventas", "/compras", "/clientes", "/productos", "/inventario", "/caja", "/produccion/lotes", "/ordenes-trabajo", "/panel-operador", "/reportes"],
        "prestamos": ["/clientes", "/prestamos", "/ruta-cobro", "/caja", "/reportes"] # ✅ AGREGAR /reportes AQUÍ
    }
    modulos = PERFILES.get(data.tipo_negocio, PERFILES["erp"])

    try:
        nueva_emp = models.Empresa(
            nombre=data.nombre_empresa, is_active=True, plan_type="trial",
            trial_ends_at=datetime.now(timezone.utc) + timedelta(days=14),
            modulos_habilitados=modulos
        )
        db.add(nueva_emp)
        db.flush()

        # Crear Admin
        rol_admin = db.query(models.Role).filter(models.Role.name == "Admin").first()
        nuevo_user = models.User(username=data.username, hashed_password=crud.get_password_hash(data.password), role_id=rol_admin.id, empresa_id=nueva_emp.id)
        db.add(nuevo_user)
        db.commit()
        return {"message": "Éxito"}
    except:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error de configuración")

# ═══════════════════════════════════════════════════════════════════════════════
# AUTENTICACIÓN MULTI-TENANT
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, username=form_data.username)
    if not user or not crud.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Validar suspensiones manuales
    if not getattr(user, 'is_active', True):
        raise HTTPException(status_code=403, detail="Cuenta suspendida por el administrador.")

    if not user.empresa_id or not user.empresa:
        raise HTTPException(status_code=403, detail="El usuario no está vinculado a ninguna empresa válida.")

    empresa = user.empresa

    if not empresa.is_active:
        raise HTTPException(status_code=403, detail="La suscripción de la empresa se encuentra suspendida. Contacte a soporte.")

    # 2. EVALUAR VENCIMIENTO (Pero NO lanzamos error, calculamos la bandera)
    is_expired = False
    if empresa.trial_ends_at:
        ahora_utc = datetime.now(timezone.utc)
        fecha_limite = empresa.trial_ends_at
        if fecha_limite.tzinfo is None:
            fecha_limite = fecha_limite.replace(tzinfo=timezone.utc)

        if ahora_utc > fecha_limite:
            is_expired = True

    # 3. Generar el Token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.username,
            "role": user.role.name,
            "empresa_id": user.empresa_id,
            "modules": [m.frontend_path for m in user.role.modules]
        },
        expires_delta=access_token_expires
    )

    # 4. Retornar el token JUNTO con el estado de expiración
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "is_expired": is_expired
    }

# ═══════════════════════════════════════════════════════════════════════════════
# RUTAS DEL SUPERADMIN (DUEÑO DEL SAAS)
# ═══════════════════════════════════════════════════════════════════════════════

superadmin_router = APIRouter(prefix="/superadmin", tags=["SaaS SuperAdmin"],
                              dependencies=[Depends(get_current_superadmin_user)])

@superadmin_router.get("/empresas", response_model=List[schemas.EmpresaOut])
def listar_empresas(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_empresas(db, skip=skip, limit=limit)

@superadmin_router.post("/empresas", response_model=schemas.EmpresaOut)
def registrar_nueva_empresa(data: schemas.EmpresaWithAdminCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_empresa_with_admin(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@superadmin_router.patch("/empresas/{empresa_id}/toggle", response_model=schemas.EmpresaOut)
def suspender_activar_empresa(empresa_id: int, db: Session = Depends(get_db)):
    # Protección para no auto-suspenderte a ti mismo (Empresa 1)
    if empresa_id == 1:
        raise HTTPException(status_code=400, detail="No puedes suspender la empresa maestra del SaaS.")

    empresa = crud.toggle_empresa_status(db, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return empresa

@superadmin_router.patch("/empresas/{empresa_id}/plan", response_model=schemas.EmpresaOut)
def actualizar_plan_empresa(empresa_id: int, plan_data: schemas.EmpresaPlanUpdate, db: Session = Depends(get_db)):
    if empresa_id == 1:
        raise HTTPException(status_code=400, detail="La empresa maestra no puede modificar su plan vitalicio.")
    empresa = crud.update_empresa_plan(db, empresa_id, plan_data)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return empresa

# --- Rutas de SuperAdmin para Planes ---
@superadmin_router.get("/planes", response_model=List[schemas.PlanSuscripcionOut])
def listar_planes_admin(db: Session = Depends(get_db)):
    return crud.get_planes(db, include_inactive=True) # El admin ve todos, incluso los inactivos

@superadmin_router.post("/planes", response_model=schemas.PlanSuscripcionOut)
def crear_plan(plan: schemas.PlanSuscripcionCreate, db: Session = Depends(get_db)):
    # Validar que el código interno no exista ya
    existente = db.query(models.PlanSuscripcion).filter(models.PlanSuscripcion.codigo_interno == plan.codigo_interno).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe un plan con este código interno.")
    return crud.create_plan(db, plan)

@superadmin_router.patch("/planes/{plan_id}", response_model=schemas.PlanSuscripcionOut)
def actualizar_plan(plan_id: int, plan_update: schemas.PlanSuscripcionUpdate, db: Session = Depends(get_db)):
    plan_actualizado = crud.update_plan(db, plan_id, plan_update)
    if not plan_actualizado:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    return plan_actualizado

from sqlalchemy.orm import joinedload

@superadmin_router.get("/historial-pagos", response_model=List[schemas.RegistroPagoOut])
def listar_historial_pagos(db: Session = Depends(get_db)):
    # Traemos los pagos con la info de empresa y plan unificada (JOIN)
    pagos = db.query(models.RegistroPago).options(
        joinedload(models.RegistroPago.empresa),
        joinedload(models.RegistroPago.plan)
    ).order_by(models.RegistroPago.fecha_pago.desc()).all()

    return [
        {
            **p.__dict__,
            "empresa_nombre": p.empresa.nombre,
            "plan_nombre": p.plan.nombre
        } for p in pagos
    ]



# Asegúrate de importar create_access_token de tu archivo de seguridad
# from auth import create_access_token (o como lo tengas importado)

# Asegúrate de importar create_access_token
# from auth import create_access_token 
@superadmin_router.post("/impersonate/{empresa_id}")
def impersonate_company(
    empresa_id: int, 
    db: Session = Depends(get_db), 
    current_admin: schemas.User = Depends(get_current_superadmin_user)
):
    # 1. Buscamos al usuario dueño de esa empresa
    target_user = db.query(models.User).filter(
        models.User.empresa_id == empresa_id
    ).first()

    if not target_user:
        raise HTTPException(status_code=404, detail="No se encontró un usuario para esta empresa.")

    # 2. Creamos un Token especial que dice "is_impersonated: True"
    access_token = create_access_token(
        data={
            "sub": target_user.username,
            "empresa_id": target_user.empresa_id,
            # 👇 CORRECCIÓN: Usamos .name para sacar el texto, no el objeto de BD
            "role": target_user.role.name if target_user.role else "Admin", 
            "is_impersonated": True 
        }
    )

    return {"access_token": access_token, "token_type": "bearer"}


# --- Rutas de SuperAdmin para roles  ---


from pydantic import BaseModel
from typing import List

class ModulosEmpresaRequest(BaseModel):
    modulos: List[str] # Lista de rutas frontend permitidas

@app.patch("/superadmin/empresas/{empresa_id}/modulos")
def actualizar_modulos_empresa(
    empresa_id: int, 
    req: ModulosEmpresaRequest, 
    db: Session = Depends(get_db),
    # Asegúrate de usar la dependencia que protege tus rutas de superadmin
    current_user: schemas.User = Depends(get_current_user) 
):
    # Validamos que seas tú (SuperAdmin)
    if current_user.role.name != "Admin" or current_user.empresa_id != 1:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    empresa.modulos_habilitados = req.modulos
    db.commit()

    return {"msg": "Módulos de la empresa actualizados correctamente"}

app.include_router(superadmin_router)




# ═══════════════════════════════════════════════════════════════════════════════
# ROLES / MÓDULOS (GLOBALES - SIN EMPRESA_ID)
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

# ═══════════════════════════════════════════════════════════════════════════════
# USUARIOS - CON EMPRESA_ID
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/users/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_admin_user)):
    if crud.get_user_by_username(db, username=user.username):
        raise HTTPException(status_code=400, detail="Nombre de usuario ya registrado")
    return crud.create_user(db=db, user=user, empresa_id=current_user.empresa_id)

@app.get("/users/me", response_model=schemas.User)
def read_users_me(current_user: schemas.User = Depends(get_current_active_user)):
    return current_user

@app.get("/users/", response_model=List[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_admin_user)):
    return crud.get_users(db, empresa_id=current_user.empresa_id, skip=skip, limit=limit)

@app.put("/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int, user: schemas.UserCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_admin_user)):
    db_user = crud.update_user(db, user_id=user_id, user=user, empresa_id=current_user.empresa_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return db_user

@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_admin_user)):
    if crud.delete_user(db, user_id=user_id, empresa_id=current_user.empresa_id) is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"message": "Usuario eliminado"}

# Nuevo Endpoint para alternar estado:
@app.patch("/users/{user_id}/toggle")
def toggle_user(user_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_admin_user)):
    db_user = db.query(models.User).filter(
        models.User.id == user_id, 
        models.User.empresa_id == current_user.empresa_id
    ).first()
    if not db_user: raise HTTPException(status_code=404)

    db_user.is_active = not db_user.is_active
    db.commit()
    return {"status": "ok", "new_state": db_user.is_active}

@app.get("/admin/usuarios", response_model=List[schemas.User])
def listar_usuarios_empresa(
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_active_user)
):
    # 🛡️ Seguridad: Solo el Admin de la empresa puede ver la lista de empleados
    if current_user.role.name != "Admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para ver la lista de usuarios")

    # Obtenemos todos los usuarios que pertenecen a la misma empresa que el Admin
    usuarios = db.query(models.User).filter(
        models.User.empresa_id == current_user.empresa_id
    ).all()

    return usuarios



import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation
from fastapi.responses import StreamingResponse

# ═══════════════════════════════════════════════════════════════════════════════
# PLANTILLAS INTELIGENTES (EXCEL) - ¡DEBEN IR ANTES DE LAS RUTAS CON {id}!
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/clientes/template")
def get_clientes_template(current_user: schemas.User = Depends(get_current_active_user)):
    wb = openpyxl.Workbook()

    # 1. INSTRUCCIONES
    ws_inst = wb.active
    ws_inst.title = "Instrucciones"
    ws_inst.sheet_properties.tabColor = "3B82F6"
    ws_inst.cell(row=2, column=2, value="🛠 CÓMO REGISTRAR TERCEROS").font = Font(size=14, bold=True, color="3B82F6")
    instrucciones = [
        "1. Usa la pestaña 'Plantilla Datos' para registrar clientes o proveedores.",
        "2. La CÉDULA/NIT no debe repetirse. Si ya existe, se omitirá.",
        "3. ES_CLIENTE y ES_PROVEEDOR: Usa la lista desplegable (SI / NO).",
        "4. No modifiques ni elimines la Fila 1."
    ]
    for i, inst in enumerate(instrucciones, 4):
        ws_inst.cell(row=i, column=2, value=inst).font = Font(size=11)
    ws_inst.column_dimensions['B'].width = 80

    # 2. DATOS Y CABECERAS
    ws_datos = wb.create_sheet(title="Plantilla Datos")
    headers = ["NOMBRE", "CEDULA", "TELEFONO", "DIRECCION", "CUPO_CREDITO", "ES_CLIENTE", "ES_PROVEEDOR"]
    header_fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)

    for col_num, header in enumerate(headers, 1):
        cell = ws_datos.cell(row=1, column=col_num, value=header)
        cell.fill, cell.font = header_fill, header_font
        ws_datos.column_dimensions[openpyxl.utils.get_column_letter(col_num)].width = 20

    # 3. VALIDACIÓN (SI/NO)
    dv_bool = DataValidation(type="list", formula1='"SI,NO"', allow_blank=True)
    ws_datos.add_data_validation(dv_bool)
    dv_bool.add("F2:G1000")

    # 4. EJEMPLOS
    ejemplos = [
        ["Distribuidora XYZ", "900123456", "3001234567", "Calle 10", 5000000, "NO", "SI"],
        ["Juan Pérez", "10203040", "3100000000", "Cra 5", 0, "SI", "NO"]
    ]
    for r_idx, row in enumerate(ejemplos, 2):
        for c_idx, val in enumerate(row, 1):
            ws_datos.cell(row=r_idx, column=c_idx, value=val)

    ws_datos.freeze_panes = 'A2'
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": 'attachment; filename="plantilla_terceros_PRO.xlsx"'})

@app.get("/inventario/movimientos/template")
def get_movimientos_template(current_user: schemas.User = Depends(get_current_active_user)):
    wb = openpyxl.Workbook()

    ws_inst = wb.active
    ws_inst.title = "Instrucciones"
    ws_inst.sheet_properties.tabColor = "10B981"
    ws_inst.cell(row=2, column=2, value="🛠 CÓMO CARGAR MOVIMIENTOS").font = Font(size=14, bold=True, color="10B981")
    instrucciones = [
        "1. Usa la pestaña 'Plantilla Datos'.",
        "2. El PRODUCTO_NOMBRE debe coincidir exactamente con uno existente en el sistema.",
        "3. TIPO: Usa la lista desplegable (entrada, salida, ajuste).",
        "4. CANTIDAD: Siempre positiva (el sistema deduce si es salida)."
    ]
    for i, inst in enumerate(instrucciones, 4):
        ws_inst.cell(row=i, column=2, value=inst).font = Font(size=11)
    ws_inst.column_dimensions['B'].width = 80

    ws_datos = wb.create_sheet(title="Plantilla Datos")
    headers = ["PRODUCTO_NOMBRE", "TIPO", "CANTIDAD", "COSTO_UNITARIO", "MOTIVO", "REFERENCIA", "OBSERVACION"]
    header_fill = PatternFill(start_color="10B981", end_color="10B981", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)

    for col_num, header in enumerate(headers, 1):
        cell = ws_datos.cell(row=1, column=col_num, value=header)
        cell.fill, cell.font = header_fill, header_font
        ws_datos.column_dimensions[openpyxl.utils.get_column_letter(col_num)].width = 22

    dv_tipo = DataValidation(type="list", formula1='"entrada,salida,ajuste"', allow_blank=False)
    ws_datos.add_data_validation(dv_tipo)
    dv_tipo.add("B2:B1000")

    ejemplos = [
        ["Cacao Tostado", "entrada", 50, 2500, "Compra inicial", "FACT-001", "Stock base"],
        ["Chocolatina 80g", "ajuste", 5, 0, "Dañado", "MERMA", "Se rompió empaque"]
    ]
    for r_idx, row in enumerate(ejemplos, 2):
        for c_idx, val in enumerate(row, 1):
            ws_datos.cell(row=r_idx, column=c_idx, value=val)

    ws_datos.freeze_panes = 'A2'
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": 'attachment; filename="plantilla_movimientos_PRO.xlsx"'})

# ═══════════════════════════════════════════════════════════════════════════════
# CLIENTES / TERCEROS
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/clientes/", response_model=schemas.Cliente)
def create_cliente(cliente: schemas.ClienteCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.create_cliente(db=db, empresa_id=current_user.empresa_id, cliente=cliente)

@app.post("/clientes/upload", response_model=schemas.BulkLoadResponse)
def upload_clientes(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.bulk_create_clientes(db=db, empresa_id=current_user.empresa_id, file=file.file, filename=file.filename)

@app.get("/clientes/", response_model=List[schemas.Cliente])
def read_clientes(skip: int = 0, limit: int = 500, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.get_clientes(db, empresa_id=current_user.empresa_id, skip=skip, limit=limit)

@app.get("/clientes/{cliente_id}", response_model=schemas.Cliente)
def read_cliente(cliente_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    db_cliente = crud.get_cliente(db, empresa_id=current_user.empresa_id, cliente_id=cliente_id)
    if db_cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return db_cliente

@app.put("/clientes/{cliente_id}", response_model=schemas.Cliente)
def update_cliente(cliente_id: int, cliente: schemas.ClienteCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    db_cliente = crud.update_cliente(db, empresa_id=current_user.empresa_id, cliente_id=cliente_id, cliente=cliente)
    if db_cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return db_cliente

@app.get("/clientes/{cliente_id}/details", response_model=schemas.ClienteDetails)
def get_cliente_details(cliente_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    db_cliente = crud.get_cliente(db, empresa_id=current_user.empresa_id, cliente_id=cliente_id)
    if db_cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    deuda_actual = crud.get_cliente_deuda(db, empresa_id=current_user.empresa_id, cliente_id=cliente_id)
    return schemas.ClienteDetails(**db_cliente.__dict__, deuda_actual=deuda_actual)

@app.delete("/clientes/{cliente_id}")
def delete_cliente(cliente_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
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

@app.get("/clientes/{cliente_id}/history", response_model=schemas.ClienteHistory)
def get_cliente_history(cliente_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    history = crud.get_cliente_history(db, empresa_id=current_user.empresa_id, cliente_id=cliente_id)
    if history is None:
        raise HTTPException(status_code=404, detail="Historial no encontrado")
    return history

# @app.get("/clientes/template")
# def get_clientes_template(current_user: schemas.User = Depends(get_current_active_user)):
#     cols = ["nombre", "cedula", "telefono", "direccion", "cupo_credito", "es_cliente", "es_proveedor"]
#     examples = [
#         ["Tiendas D1", "900123456", "1234567", "Calle 10 #20-30", 0, 1, 1],
#         ["Juan Perez", "10203040", "3001234567", "Carrera 5 #15-10", 500000, 1, 0]
#     ]
#     df = pd.DataFrame(examples, columns=cols)
#     output = BytesIO()
#     with pd.ExcelWriter(output, engine="openpyxl") as writer:
#         df.to_excel(writer, index=False, sheet_name="Terceros")
#     output.seek(0)
#     return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
#                              headers={"Content-Disposition": 'attachment; filename="plantilla_terceros.xlsx"'})

# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCTOS
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/productos/upload", response_model=schemas.BulkLoadResponse)
def upload_productos(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.bulk_create_productos(db=db, empresa_id=current_user.empresa_id, file=file.file, filename=file.filename)

@app.post("/productos/", response_model=schemas.Producto)
def create_producto(producto: schemas.ProductoCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_active_user)):
    return crud.create_producto(db=db, empresa_id=current_user.empresa_id, producto=producto)

@app.get("/productos/", response_model=List[schemas.Producto])
def r