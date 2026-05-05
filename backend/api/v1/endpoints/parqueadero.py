from typing import List, Optional
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

import crud
import models
import schemas
from api.deps import get_db, get_current_active_user, get_current_admin_user

router = APIRouter()

# --- 1. CONFIG (Tarifas + cupo) ---

@router.get("/config", response_model=schemas.ParqueaderoConfigOut)
def get_parqueadero_config(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_or_create_parq_config(db, empresa_id=current_user.empresa_id)

@router.put("/config", response_model=schemas.ParqueaderoConfigOut)
def update_parqueadero_config(
    payload: schemas.ParqueaderoConfigUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    return crud.update_parq_config(db, empresa_id=current_user.empresa_id, payload=payload)

# --- 2. VEHÍCULOS ---

@router.get("/vehiculos", response_model=List[schemas.VehiculoOut])
def listar_vehiculos(
    skip: int = 0,
    limit: int = Query(default=200, le=500),
    search: Optional[str] = None,
    solo_activos: bool = True,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.list_vehiculos(
        db, empresa_id=current_user.empresa_id,
        skip=skip, limit=limit, search=search, solo_activos=solo_activos,
    )

@router.get("/vehiculos/{vehiculo_id}", response_model=schemas.VehiculoOut)
def get_vehiculo_detalle(
    vehiculo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    veh = crud.get_vehiculo(db, empresa_id=current_user.empresa_id, vehiculo_id=vehiculo_id)
    if not veh:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")
    return crud._enriquecer_vehiculo(veh)

@router.post("/vehiculos", response_model=schemas.VehiculoOut)
def crear_vehiculo(
    payload: schemas.VehiculoCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    veh = crud.create_vehiculo(db, empresa_id=current_user.empresa_id, payload=payload)
    return crud._enriquecer_vehiculo(veh)

@router.put("/vehiculos/{vehiculo_id}", response_model=schemas.VehiculoOut)
def actualizar_vehiculo(
    vehiculo_id: int,
    payload: schemas.VehiculoUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    veh = crud.update_vehiculo(
        db, empresa_id=current_user.empresa_id, vehiculo_id=vehiculo_id, payload=payload,
    )
    if not veh:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")
    return crud._enriquecer_vehiculo(veh)

@router.delete("/vehiculos/{vehiculo_id}")
def eliminar_vehiculo(
    vehiculo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    if not crud.delete_vehiculo(db, empresa_id=current_user.empresa_id, vehiculo_id=vehiculo_id):
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")
    return {"message": "Vehículo dado de baja correctamente."}

# --- 3. SUSCRIPCIONES ---

@router.get("/suscripciones", response_model=List[dict])
def listar_suscripciones(
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    solo_vigentes: bool = False,
    solo_vencidas: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.list_todas_suscripciones(
        db, empresa_id=current_user.empresa_id,
        skip=skip, limit=limit,
        solo_vigentes=solo_vigentes, solo_vencidas=solo_vencidas,
    )

@router.get("/vehiculos/{vehiculo_id}/suscripciones", response_model=List[dict])
def historico_suscripciones_vehiculo(
    vehiculo_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.list_suscripciones_vehiculo(
        db, empresa_id=current_user.empresa_id, vehiculo_id=vehiculo_id, limit=limit,
    )

@router.post("/suscripciones", response_model=dict)
def crear_suscripcion(
    payload: schemas.SuscripcionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.create_suscripcion(
        db, empresa_id=current_user.empresa_id,
        usuario_id=current_user.id, payload=payload,
    )

@router.post("/suscripciones/retroactiva", response_model=dict)
def crear_suscripcion_retroactiva(
    payload: schemas.SuscripcionRetroactivaCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.create_suscripcion_retroactiva(
        db, empresa_id=current_user.empresa_id,
        usuario_id=current_user.id, payload=payload,
    )

@router.delete("/suscripciones/{suscripcion_id}")
def cancelar_suscripcion(
    suscripcion_id: int,
    motivo: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    if not crud.cancelar_suscripcion(
        db, empresa_id=current_user.empresa_id, suscripcion_id=suscripcion_id, motivo=motivo,
    ):
        raise HTTPException(status_code=404, detail="Suscripción no encontrada.")
    return {"message": "Suscripción cancelada."}

# --- 4. PAGOS / ABONOS ---

@router.post("/pagos", response_model=dict)
def registrar_pago(
    payload: schemas.PagoParqueaderoCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.registrar_pago_suscripcion(
        db, empresa_id=current_user.empresa_id,
        usuario_id=current_user.id, payload=payload,
    )

# --- 5. ACCESOS POR HORAS ---

@router.post("/accesos/entrada", response_model=schemas.AccesoEntradaResponse)
def registrar_entrada_horas(
    payload: schemas.AccesoEntradaCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.registrar_entrada_horas(
        db, empresa_id=current_user.empresa_id,
        usuario_id=current_user.id, payload=payload,
    )

@router.post("/accesos/salida", response_model=schemas.AccesoOut)
def registrar_salida_horas(
    payload: schemas.AccesoSalidaCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.registrar_salida_horas(
        db, empresa_id=current_user.empresa_id, payload=payload,
    )

@router.get("/accesos/dentro", response_model=List[schemas.AccesoOut])
def listar_accesos_dentro(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return db.query(models.AccesoParqueadero).filter(
        models.AccesoParqueadero.empresa_id == current_user.empresa_id,
        models.AccesoParqueadero.estado == "dentro",
    ).order_by(models.AccesoParqueadero.fecha_entrada.asc()).all()

# --- 6. BUSCAR PLACA ---

@router.get("/buscar/{placa}", response_model=schemas.BuscarPlacaResponse)
def buscar_placa(
    placa: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.buscar_por_placa(db, empresa_id=current_user.empresa_id, placa=placa)

# --- 7. DASHBOARD ---

@router.get("/dashboard", response_model=schemas.DashboardParqueadero)
def dashboard_parqueadero(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_dashboard_parqueadero(db, empresa_id=current_user.empresa_id)

# --- 8. REPORTES ---

@router.get("/reportes/ingresos", response_model=dict)
def reporte_ingresos(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date debe ser anterior a end_date.")
    return crud.reporte_ingresos_parqueadero(
        db, empresa_id=current_user.empresa_id,
        start_date=start_date, end_date=end_date,
    )

# --- 9. MÉTODOS DE PAGO ---

@router.get("/metodos-pago", response_model=List[schemas.MetodoPagoOut])
def listar_metodos_pago(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.listar_metodos_pago(db, empresa_id=current_user.empresa_id)

@router.put("/metodos-pago", response_model=schemas.MetodoPagoOut)
def upsert_metodo_pago(
    payload: schemas.MetodoPagoCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    return crud.upsert_metodo_pago(db, empresa_id=current_user.empresa_id, payload=payload)

@router.delete("/metodos-pago/{modalidad}")
def delete_metodo_pago(
    modalidad: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    if not crud.delete_metodo_pago(db, empresa_id=current_user.empresa_id, modalidad=modalidad):
        raise HTTPException(status_code=404, detail="Método no encontrado.")
    return {"message": "Método de pago eliminado."}

# --- 10. PLANTILLAS DE WHATSAPP ---

@router.get("/plantillas-whatsapp", response_model=List[schemas.PlantillaWhatsAppOut])
def listar_plantillas(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.listar_plantillas(db, empresa_id=current_user.empresa_id)

@router.put("/plantillas-whatsapp/{tipo}", response_model=schemas.PlantillaWhatsAppOut)
def actualizar_plantilla(
    tipo: str,
    payload: schemas.PlantillaWhatsAppUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    return crud.update_plantilla(
        db, empresa_id=current_user.empresa_id, tipo=tipo, payload=payload,
    )

@router.post("/plantillas-whatsapp/{tipo}/restaurar", response_model=schemas.PlantillaWhatsAppOut)
def restaurar_plantilla(
    tipo: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    return crud.restaurar_plantilla_default(
        db, empresa_id=current_user.empresa_id, tipo=tipo,
    )

# --- 11. LINK WHATSAPP ---

@router.post("/whatsapp/generar", response_model=schemas.GenerarWhatsAppResponse)
def generar_whatsapp(
    payload: schemas.GenerarWhatsAppRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.generar_link_whatsapp(
        db,
        empresa_id  = current_user.empresa_id,
        usuario_id  = current_user.id,
        payload     = payload,
    )

@router.get("/whatsapp/historial", response_model=List[schemas.EnvioWhatsAppOut])
def historial_envios(
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    vehiculo_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.listar_envios_whatsapp(
        db, empresa_id=current_user.empresa_id,
        skip=skip, limit=limit, vehiculo_id=vehiculo_id,
    )

# --- 12. BAJA VEHÍCULO ---

@router.get("/vehiculos/{vehiculo_id}/baja-info", response_model=schemas.VehiculoBajaInfo)
def get_vehiculo_baja_info_endpoint(
    vehiculo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_baja_info(db, current_user.empresa_id, vehiculo_id)

@router.post("/vehiculos/{vehiculo_id}/dar-baja", response_model=schemas.DarBajaResponse)
def dar_baja_vehiculo_endpoint(
    vehiculo_id: int,
    payload: schemas.DarBajaRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.dar_baja_vehiculo(
        db,
        empresa_id  = current_user.empresa_id,
        usuario_id  = current_user.id,
        vehiculo_id = vehiculo_id,
        payload     = payload,
    )

# --- CRON ---
cron_router = APIRouter()

@cron_router.post("/notificar-vencimientos", tags=["cron"])
def cron_notificar_vencimientos_parqueadero(
    x_cron_key: str = Header(..., alias="X-Cron-Key"),
    db: Session = Depends(get_db),
):
    from core.config import CRON_API_KEY
    if x_cron_key != CRON_API_KEY:
        raise HTTPException(status_code=403, detail="Clave de cron inválida.")
    total = crud.notificar_vencimientos_parqueadero(db)
    return {"msg": f"Se generaron {total} notificaciones de vencimiento de parqueadero."}
