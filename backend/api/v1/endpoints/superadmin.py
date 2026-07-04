from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
import os, requests as http_requests, logging

from crud import empresas as crud_empresas
from crud import planes as crud_planes
from crud import perecederos as crud_perecederos
import models
import schemas
from api.deps import get_db, get_current_superadmin_user
from core.security import create_access_token

logger = logging.getLogger("superadmin")

router = APIRouter(
    tags=["SaaS SuperAdmin"],
    dependencies=[Depends(get_current_superadmin_user)]
)

from services.jobs_service import SaaSJobService
from services import matias_service as _ms

@router.get("/empresas", response_model=List[schemas.EmpresaMetricsOut])
def listar_empresas(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud_empresas.get_empresas(db, skip=skip, limit=limit)


@router.get("/recursos-oracle")
def recursos_oracle():
    """Uso de recursos del host (VM Oracle Cloud) vs límites Always Free."""
    from services.host_metrics import get_recursos
    return get_recursos()

@router.post("/empresas", response_model=schemas.EmpresaOut)
def registrar_nueva_empresa(
    data: schemas.EmpresaWithAdminCreate, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user)
):
    try:
        return crud_empresas.create_empresa_with_admin(db, data, admin_id=current_admin.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/empresas/{empresa_id}")
def eliminar_empresa(
    empresa_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user),
):
    if empresa_id == 1:
        raise HTTPException(status_code=400, detail="No puedes eliminar la empresa maestra del SaaS.")
    try:
        result = crud_empresas.delete_empresa(db, empresa_id, admin_id=current_admin.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result


@router.patch("/empresas/{empresa_id}/toggle", response_model=schemas.EmpresaOut)
def suspender_activar_empresa(
    empresa_id: int, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user)
):
    if empresa_id == 1:
        raise HTTPException(status_code=400, detail="No puedes suspender la empresa maestra del SaaS.")
    empresa = crud_empresas.toggle_empresa_status(db, empresa_id, admin_id=current_admin.id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return empresa

@router.patch("/empresas/{empresa_id}/plan", response_model=schemas.EmpresaOut)
def actualizar_plan_empresa(
    empresa_id: int, 
    plan_data: schemas.EmpresaPlanUpdate, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user)
):
    if empresa_id == 1:
        raise HTTPException(status_code=400, detail="La empresa maestra no puede modificar su plan vitalicio.")
    empresa = crud_empresas.update_empresa_plan(db, empresa_id, plan_data, admin_id=current_admin.id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return empresa

@router.patch("/empresas/{empresa_id}/modulos", response_model=schemas.EmpresaOut)
def actualizar_modulos_empresa(
    empresa_id: int, 
    modulos_data: schemas.EmpresaModulosUpdate, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user)
):
    if empresa_id == 1:
        raise HTTPException(status_code=400, detail="No puedes modificar los módulos de la empresa maestra desde aquí.")
    empresa = crud_empresas.update_empresa_modulos(db, empresa_id, modulos_data.modulos, admin_id=current_admin.id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return empresa

@router.patch("/empresas/{empresa_id}/protection", response_model=schemas.EmpresaOut)
def toggle_protection_empresa(
    empresa_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user)
):
    """Protege una empresa contra automatizaciones de expiración"""
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    empresa.is_protected = not empresa.is_protected
    crud_empresas.log_saas_event(db, current_admin.id, "TOGGLE_PROTECTION", empresa_id, {"is_protected": empresa.is_protected})
    db.commit()
    db.refresh(empresa)
    return empresa

@router.get("/dashboard-stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Métricas globales para el panel ejecutivo del SuperAdmin"""
    total_tenants = db.query(models.Empresa).count()
    activos = db.query(models.Empresa).filter(models.Empresa.is_active == True).count()
    premium = db.query(models.Empresa).filter(models.Empresa.plan_type == 'premium').count()
    
    # Recaudado total (simple sum)
    total_recaudado = db.query(func.sum(models.RegistroPago.monto)).scalar() or 0
    
    # Usuarios totales en todo el sistema
    total_usuarios = db.query(models.User).count()

    return {
        "total_tenants": total_tenants,
        "activos": activos,
        "premium": premium,
        "total_recaudado": total_recaudado,
        "total_usuarios": total_usuarios
    }

@router.get("/audit-logs", response_model=List[schemas.SaaSAuditLogOut])
def listar_logs_auditoria(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    logs = db.query(models.SaaSAuditLog).options(
        joinedload(models.SaaSAuditLog.admin),
        joinedload(models.SaaSAuditLog.empresa)
    ).order_by(models.SaaSAuditLog.fecha.desc()).offset(skip).limit(limit).all()
    
    return [
        {
            **log.__dict__,
            "admin_username": log.admin.username if log.admin else "Sistema",
            "empresa_nombre": log.empresa.nombre if log.empresa else "Global"
        }
        for log in logs
    ]

# ─── ANUNCIOS SAAS ────────────────────────────────────────────────────────────

@router.get("/announcements", response_model=List[schemas.SaaSAnnouncementOut])
def listar_anuncios(db: Session = Depends(get_db)):
    return db.query(models.SaaSAnnouncement).order_by(models.SaaSAnnouncement.created_at.desc()).all()

@router.post("/announcements", response_model=schemas.SaaSAnnouncementOut)
def crear_anuncio(
    data: schemas.SaaSAnnouncementCreate, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user)
):
    db_ann = models.SaaSAnnouncement(
        **data.dict(),
        created_by=current_admin.id
    )
    db.add(db_ann)
    db.commit()
    db.refresh(db_ann)
    crud_empresas.log_saas_event(db, current_admin.id, "CREATE_ANNOUNCEMENT", None, {"titulo": data.titulo})
    return db_ann

@router.patch("/announcements/{ann_id}/toggle")
def toggle_anuncio(
    ann_id: int, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user)
):
    db_ann = db.query(models.SaaSAnnouncement).filter(models.SaaSAnnouncement.id == ann_id).first()
    if not db_ann:
        raise HTTPException(status_code=404, detail="Anuncio no encontrado")
    db_ann.is_active = not db_ann.is_active
    db.commit()
    return {"msg": "Estado de anuncio actualizado"}

# ─── JOBS Y AUTOMATIZACIÓN ──────────────────────────────────────────────────

@router.post("/jobs/run-expiration")
def ejecutar_job_expiracion(
    dry_run: bool = False, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user)
):
    """Ejecuta manualmente el proceso de expiración de trials"""
    results = SaaSJobService.run_trial_expiration_job(db, dry_run=dry_run)
    return results

@router.get("/jobs/history", response_model=List[schemas.SaaSJobRegistryOut])
def listar_historial_jobs(limit: int = 20, db: Session = Depends(get_db)):
    return db.query(models.SaaSJobRegistry).order_by(models.SaaSJobRegistry.started_at.desc()).limit(limit).all()


@router.get("/planes", response_model=List[schemas.PlanSuscripcionOut])
def listar_planes_admin(db: Session = Depends(get_db)):
    return crud_planes.get_planes(db, include_inactive=True)

@router.post("/planes", response_model=schemas.PlanSuscripcionOut)
def crear_plan(plan: schemas.PlanSuscripcionCreate, db: Session = Depends(get_db)):
    existente = db.query(models.PlanSuscripcion).filter(
        models.PlanSuscripcion.codigo_interno == plan.codigo_interno
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe un plan con este código interno.")
    return crud_planes.create_plan(db, plan)

@router.patch("/planes/{plan_id}", response_model=schemas.PlanSuscripcionOut)
def actualizar_plan(plan_id: int, plan_update: schemas.PlanSuscripcionUpdate, db: Session = Depends(get_db)):
    plan_actualizado = crud_planes.update_plan(db, plan_id, plan_update)
    if not plan_actualizado:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    return plan_actualizado

@router.get("/historial-pagos", response_model=List[schemas.RegistroPagoOut])
def listar_historial_pagos(db: Session = Depends(get_db)):
    pagos = db.query(models.RegistroPago).options(
        joinedload(models.RegistroPago.empresa),
        joinedload(models.RegistroPago.plan)
    ).order_by(models.RegistroPago.fecha_pago.desc()).all()

    return [
        {
            **p.__dict__,
            "empresa_nombre":        p.empresa.nombre if p.empresa else "—",
            "plan_nombre":           p.plan.nombre    if p.plan    else "—",
            "numero_factura_ksmart": p.numero_factura_ksmart,
            "estado_fe":             p.estado_fe,
            "cufe_fe":               p.cufe_fe,
            "pdf_url_fe":            p.pdf_url_fe,
        }
        for p in pagos
    ]

class RecuperarPagoRequest(BaseModel):
    wompi_id: str
    empresa_id: Optional[int] = None   # requerido solo si WOMPI_PRIVATE_KEY no está configurada
    plan_id:   Optional[int] = None    # requerido solo si no se puede obtener de Wompi


@router.post("/recuperar-pago-wompi")
def recuperar_pago_wompi(
    payload: RecuperarPagoRequest,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user),
):
    """
    Herramienta de recuperación para pagos de Wompi que no se registraron
    (webhook no llegó, servidor caído, error de red, etc.).

    Flujo:
    1. Si WOMPI_PRIVATE_KEY está configurada: verifica el pago con la API de
       Wompi, extrae empresa_id / plan_id de la referencia y activa la suscripción.
    2. Si no está configurada: usa empresa_id y plan_id del body (modo manual
       de emergencia), registra el pago y activa sin verificar con Wompi.

    En ambos casos es idempotente: si el wompi_id ya existe en registros_pagos
    solo activa la suscripción sin crear duplicado.
    """
    wompi_id = payload.wompi_id.strip()

    # ── Idempotencia ────────────────────────────────────────────────────────
    existing = db.query(models.RegistroPago).filter(
        models.RegistroPago.bold_tx_id == wompi_id
    ).first()

    if existing:
        # El pago ya está registrado. Solo verificar que la empresa esté activa.
        empresa = db.query(models.Empresa).filter(
            models.Empresa.id == existing.empresa_id
        ).first()
        if empresa:
            ahora = datetime.now(timezone.utc)
            if empresa.trial_ends_at and empresa.trial_ends_at <= ahora:
                # El pago existe pero el plan expiró igual (raro) — extender
                plan = db.query(models.PlanSuscripcion).filter(
                    models.PlanSuscripcion.id == existing.plan_id
                ).first()
                if plan:
                    empresa.trial_ends_at = ahora + timedelta(days=plan.dias_duracion)
                    empresa.is_active = True
                    empresa.plan_type = "premium"
                    db.commit()
            return {
                "status": "ok",
                "mensaje": f"Pago ya registrado. Empresa '{empresa.nombre}' activada.",
                "empresa_id": empresa.id,
                "modo": "idempotente",
            }

    # ── Intentar verificar con Wompi API ────────────────────────────────────
    WOMPI_PRIVATE_KEY = os.getenv("WOMPI_PRIVATE_KEY", "")
    WOMPI_PUBLIC_KEY  = os.getenv("WOMPI_PUBLIC_KEY", "pub_test_...")
    base_url = (
        "https://sandbox.wompi.co/v1"
        if WOMPI_PUBLIC_KEY.startswith("pub_test")
        else "https://production.wompi.co/v1"
    )

    tx = None
    if WOMPI_PRIVATE_KEY:
        try:
            resp = http_requests.get(
                f"{base_url}/transactions/{wompi_id}",
                headers={"Authorization": f"Bearer {WOMPI_PRIVATE_KEY}"},
                timeout=10,
            )
            if resp.status_code == 200:
                tx = resp.json().get("data", {})
                logger.info(f"recuperar-pago: Wompi confirmó {wompi_id} status={tx.get('status')}")
            elif resp.status_code == 404:
                raise HTTPException(400, "La transacción no existe en Wompi. Verifica el ID.")
            else:
                logger.warning(f"recuperar-pago: Wompi respondió {resp.status_code} para {wompi_id}")
        except http_requests.exceptions.RequestException as e:
            logger.error(f"recuperar-pago: error de red con Wompi: {e}")
            if not payload.empresa_id:
                raise HTTPException(503, "No se pudo contactar a Wompi y no se proporcionó empresa_id manual.")

    # ── Extraer empresa_id y plan_id ────────────────────────────────────────
    if tx:
        if tx.get("status") != "APPROVED":
            raise HTTPException(400, f"La transacción no está aprobada (estado: {tx.get('status')}).")
        reference = tx.get("reference", "")
        amount_cents  = tx.get("amount_in_cents", 0)
        currency      = tx.get("currency", "COP")
        payment_method = tx.get("payment_method_type")
        customer_email = tx.get("customer_email")
    else:
        # Modo manual de emergencia (sin verificación con API)
        if not payload.empresa_id or not payload.plan_id:
            raise HTTPException(
                400,
                "WOMPI_PRIVATE_KEY no está configurada. "
                "Proporciona empresa_id y plan_id para activar manualmente."
            )
        reference      = f"KSMART-{payload.empresa_id}-{payload.plan_id}-0"
        amount_cents   = 0
        currency       = "COP"
        payment_method = "MANUAL_RECOVERY"
        customer_email = None

    # Parsear empresa_id / plan_id desde la referencia
    if reference.startswith("KSMART-"):
        partes = reference.split("-")
        try:
            empresa_id_ref = int(partes[1])
            plan_id_ref    = int(partes[2])
        except (ValueError, IndexError):
            empresa_id_ref = payload.empresa_id
            plan_id_ref    = payload.plan_id
    else:
        empresa_id_ref = payload.empresa_id
        plan_id_ref    = payload.plan_id

    if not empresa_id_ref or not plan_id_ref:
        raise HTTPException(400, "No se pudo determinar empresa_id o plan_id.")

    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id_ref).first()
    plan    = db.query(models.PlanSuscripcion).filter(models.PlanSuscripcion.id == plan_id_ref).first()

    if not empresa:
        raise HTTPException(404, f"Empresa {empresa_id_ref} no encontrada.")
    if not plan:
        raise HTTPException(404, f"Plan {plan_id_ref} no encontrado.")

    # ── Activar suscripción ──────────────────────────────────────────────────
    empresa.is_active  = True
    empresa.plan_type  = "premium"
    ahora = datetime.now(timezone.utc)
    base  = empresa.trial_ends_at if empresa.trial_ends_at and empresa.trial_ends_at > ahora else ahora
    empresa.trial_ends_at = base + timedelta(days=plan.dias_duracion)

    nuevo_pago = models.RegistroPago(
        empresa_id    = empresa_id_ref,
        plan_id       = plan_id_ref,
        monto         = amount_cents / 100 if amount_cents else plan.precio,
        moneda        = currency,
        metodo_pago   = payment_method,
        bold_tx_id    = wompi_id,
        email_pagador = customer_email,
        payload_auditoria = {
            "wompi_id":       wompi_id,
            "recuperado_por": current_admin.username,
            "verificado_api": tx is not None,
            "fecha_recuperacion": ahora.isoformat(),
        },
    )
    db.add(nuevo_pago)
    db.commit()

    logger.info(
        f"✅ Pago recuperado por superadmin {current_admin.username}: "
        f"wompi_id={wompi_id} empresa={empresa.nombre} plan={plan.nombre}"
    )
    return {
        "status":      "ok",
        "empresa_id":  empresa_id_ref,
        "empresa":     empresa.nombre,
        "plan":        plan.nombre,
        "dias":        plan.dias_duracion,
        "activo_hasta": empresa.trial_ends_at.isoformat(),
        "verificado_con_wompi_api": tx is not None,
        "modo": "api_wompi" if tx else "manual_emergencia",
    }


@router.post("/impersonate/{empresa_id}")
def impersonate_company(
    empresa_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user)
):
    target_user = db.query(models.User).filter(
        models.User.empresa_id == empresa_id
    ).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="No se encontró un usuario para esta empresa.")

    # Auditar: la suplantación da acceso total a los datos del tenant
    # (financieros, clientes, contabilidad). Debe quedar registro de quién
    # suplantó a quién y cuándo para trazabilidad y cumplimiento.
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    crud_empresas.log_saas_event(
        db, current_admin.id, "IMPERSONATE", empresa_id,
        {"empresa_nombre": empresa.nombre if empresa else None,
         "target_username": target_user.username},
    )

    access_token = create_access_token(
        data={
            "sub": target_user.username,
            "empresa_id": target_user.empresa_id,
            "role": target_user.role.name if target_user.role else "Admin",
            "is_impersonated": True
        }
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/tipos-negocio", response_model=List[schemas.TipoNegocioConfigOut])
def listar_tipos_negocio(db: Session = Depends(get_db)):
    """Lista los perfiles de módulos por defecto para cada tipo de negocio."""
    return db.query(models.TipoNegocioConfig).all()


@router.put("/tipos-negocio/{tipo}", response_model=schemas.TipoNegocioConfigOut)
def actualizar_tipo_negocio(
    tipo: str,
    data: schemas.TipoNegocioConfigUpdate,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user),
):
    """Actualiza los módulos por defecto de un tipo de negocio."""
    config = db.query(models.TipoNegocioConfig).filter(models.TipoNegocioConfig.tipo == tipo).first()
    if not config:
        raise HTTPException(status_code=404, detail=f"Tipo de negocio '{tipo}' no encontrado.")
    config.modulos = data.modulos
    if data.label is not None:
        config.label = data.label
    db.commit()
    db.refresh(config)
    crud_empresas.log_saas_event(db, current_admin.id, "UPDATE_TIPO_NEGOCIO", None, {"tipo": tipo, "modulos_count": len(data.modulos)})
    return config


@router.post("/notificar-vencimientos-lotes")
def notificar_vencimientos_lotes(db: Session = Depends(get_db), _: models.User = Depends(get_current_superadmin_user)):
    """
    Genera notificaciones de vencimiento para todas las empresas activas.
    """
    total = crud_perecederos.notificar_vencimientos_proximos(db)
    return {"msg": f"Se generaron {total} notificaciones de vencimiento."}


# ═══════════════════════════════════════════════════════════════════════════════
# REINTENTO DE FACTURACIÓN ELECTRÓNICA DE SUSCRIPCIÓN
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/reintentar-fe/{pago_id}")
def reintentar_fe_suscripcion(
    pago_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user),
):
    """
    Reintenta la emisión de la factura electrónica para un registro de pago.
    Útil cuando la primera emisión falló por error de red, configuración incompleta, etc.
    """
    pago = db.query(models.RegistroPago).options(
        joinedload(models.RegistroPago.empresa),
        joinedload(models.RegistroPago.plan),
    ).filter(models.RegistroPago.id == pago_id).first()

    if not pago:
        raise HTTPException(status_code=404, detail="Registro de pago no encontrado.")
    if not pago.empresa or not pago.plan:
        raise HTTPException(status_code=400, detail="El pago no tiene empresa o plan asociados.")

    plataforma = db.query(models.PlataformaConfig).filter_by(id=1).first()
    if not plataforma or not plataforma.facturacion_electronica_activa:
        raise HTTPException(status_code=400, detail="La facturación electrónica de la plataforma no está activa.")
    if not plataforma.resolucion_numero:
        raise HTTPException(status_code=400, detail="No hay resolución DIAN configurada para la plataforma.")

    test_mode = plataforma.matias_test_mode if plataforma.matias_test_mode is not None else True
    api_key   = plataforma.matias_sandbox_api_key if test_mode else plataforma.matias_api_key
    if not api_key:
        raise HTTPException(status_code=400, detail="No hay API key de Matías configurada para la plataforma.")

    resultado = _ms.emitir_factura_suscripcion(
        registro_pago   = pago,
        empresa_cliente = pago.empresa,
        plan            = pago.plan,
        plataforma      = plataforma,
        api_key         = api_key,
        test_mode       = test_mode,
    )

    pago.estado_fe             = resultado["estado"]
    pago.cufe_fe               = resultado.get("cufe_fe")
    pago.pdf_url_fe            = resultado.get("pdf_url_fe")
    pago.numero_factura_ksmart = resultado.get("numero_factura") or pago.numero_factura_ksmart

    if resultado["estado"] == "exitoso":
        plataforma.resolucion_numero_actual = (plataforma.resolucion_numero_actual or 0) + 1

    db.commit()
    logger.info("Reintento FE pago %s: %s por admin %s", pago_id, resultado["estado"], current_admin.id)

    return {
        "estado":            resultado["estado"],
        "numero_factura":    pago.numero_factura_ksmart,
        "pdf_url_fe":        pago.pdf_url_fe,
        "cufe_fe":           pago.cufe_fe,
        "mensaje":           resultado.get("mensaje"),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN DE LA PLATAFORMA (DUEÑO DEL SISTEMA)
# ═══════════════════════════════════════════════════════════════════════════════

def _get_or_create_plataforma(db: Session) -> models.PlataformaConfig:
    cfg = db.query(models.PlataformaConfig).filter_by(id=1).first()
    if not cfg:
        cfg = models.PlataformaConfig(id=1)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


# Campos editables y si deben enmascararse en la respuesta GET
_PLATAFORMA_FIELDS = [
    "nombre_empresa", "nit", "dv", "tipo_organizacion_id", "tipo_regimen_id",
    "responsabilidad_fiscal_codes", "departamento_code", "ciudad_code",
    "correo_facturacion", "direccion", "telefono", "logo_base64",
    "facturacion_electronica_activa", "matias_api_key", "matias_sandbox_api_key",
    "matias_test_mode", "resolucion_prefijo", "resolucion_numero",
    "resolucion_numero_actual", "resolucion_numero_inicial", "resolucion_numero_final",
    "resolucion_vigencia_desde", "resolucion_vigencia_hasta", "resolucion_clave_tecnica",
]


def _serialize_plataforma(cfg: models.PlataformaConfig) -> dict:
    """Serializa la config. Las API keys se enmascaran (solo se indica si existen)."""
    def _mask(val):
        if not val:
            return None
        return f"••••••••{val[-4:]}" if len(val) > 4 else "••••"
    return {
        "nombre_empresa":               cfg.nombre_empresa,
        "nit":                          cfg.nit,
        "dv":                           cfg.dv,
        "tipo_organizacion_id":         cfg.tipo_organizacion_id,
        "tipo_regimen_id":              cfg.tipo_regimen_id,
        "responsabilidad_fiscal_codes": cfg.responsabilidad_fiscal_codes,
        "departamento_code":            cfg.departamento_code,
        "ciudad_code":                  cfg.ciudad_code,
        "correo_facturacion":           cfg.correo_facturacion,
        "direccion":                    cfg.direccion,
        "telefono":                     cfg.telefono,
        "logo_base64":                  cfg.logo_base64,
        "facturacion_electronica_activa": cfg.facturacion_electronica_activa,
        "matias_api_key_set":           bool(cfg.matias_api_key),
        "matias_api_key_preview":       _mask(cfg.matias_api_key),
        "matias_sandbox_api_key_set":   bool(cfg.matias_sandbox_api_key),
        "matias_sandbox_api_key_preview": _mask(cfg.matias_sandbox_api_key),
        "matias_test_mode":             cfg.matias_test_mode,
        "resolucion_prefijo":           cfg.resolucion_prefijo,
        "resolucion_numero":            cfg.resolucion_numero,
        "resolucion_numero_actual":     cfg.resolucion_numero_actual,
        "resolucion_numero_inicial":    cfg.resolucion_numero_inicial,
        "resolucion_numero_final":      cfg.resolucion_numero_final,
        "resolucion_vigencia_desde":    cfg.resolucion_vigencia_desde.isoformat() if cfg.resolucion_vigencia_desde else None,
        "resolucion_vigencia_hasta":    cfg.resolucion_vigencia_hasta.isoformat() if cfg.resolucion_vigencia_hasta else None,
        "resolucion_clave_tecnica":     cfg.resolucion_clave_tecnica,
    }


@router.get("/plataforma-config")
def get_plataforma_config(db: Session = Depends(get_db)):
    """Devuelve la configuración del dueño del sistema (datos fiscales + Matías)."""
    cfg = _get_or_create_plataforma(db)
    return _serialize_plataforma(cfg)


@router.put("/plataforma-config")
def update_plataforma_config(
    payload: dict,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_superadmin_user),
):
    """
    Actualiza la configuración del dueño del sistema.

    Las API keys solo se sobrescriben si vienen con un valor no vacío en el payload;
    enviar cadena vacía las borra explícitamente, omitirlas las deja intactas.
    """
    cfg = _get_or_create_plataforma(db)

    # Campos de texto/numéricos/booleanos directos
    simples = [
        "nombre_empresa", "nit", "dv", "tipo_organizacion_id", "tipo_regimen_id",
        "responsabilidad_fiscal_codes", "departamento_code", "ciudad_code",
        "correo_facturacion", "direccion", "telefono", "logo_base64",
        "facturacion_electronica_activa", "matias_test_mode",
        "resolucion_prefijo", "resolucion_numero", "resolucion_numero_actual",
        "resolucion_numero_inicial", "resolucion_numero_final", "resolucion_clave_tecnica",
    ]
    for campo in simples:
        if campo in payload:
            valor = payload[campo]
            if isinstance(valor, str) and campo not in ("logo_base64",):
                valor = valor.strip() or None
            setattr(cfg, campo, valor)

    # Fechas de vigencia
    from datetime import date as _date
    for campo in ("resolucion_vigencia_desde", "resolucion_vigencia_hasta"):
        if campo in payload:
            val = payload[campo]
            if val:
                try:
                    setattr(cfg, campo, _date.fromisoformat(str(val)[:10]))
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"Fecha inválida en {campo}.")
            else:
                setattr(cfg, campo, None)

    # API keys: solo sobrescribir si la clave viene en el payload
    for campo in ("matias_api_key", "matias_sandbox_api_key"):
        if campo in payload:
            val = payload[campo]
            setattr(cfg, campo, val.strip() if isinstance(val, str) and val.strip() else None)

    db.commit()
    db.refresh(cfg)
    crud_empresas.log_saas_event(db, current_admin.id, "UPDATE_PLATAFORMA_CONFIG", None, {})
    return _serialize_plataforma(cfg)
