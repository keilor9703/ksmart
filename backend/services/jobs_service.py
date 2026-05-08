import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
import models
from core.constants import PlanType, SaaSJobStatus, AccessStatus
from services.saas_service import TenantAccessService

class SaaSJobService:
    @staticmethod
    def start_job(db: Session, job_name: str) -> Optional[str]:
        """
        Intenta registrar el inicio de un job con un lock lógico.
        Retorna execution_id si tuvo éxito, None si ya hay un job corriendo.
        """
        # Limpieza de locks huérfanos (Stale Locks > 1 hora)
        stale_limit = datetime.now(timezone.utc) - timedelta(hours=1)
        db.query(models.SaaSJobRegistry).filter(
            models.SaaSJobRegistry.job_name == job_name,
            models.SaaSJobRegistry.status == SaaSJobStatus.RUNNING,
            models.SaaSJobRegistry.started_at < stale_limit
        ).update({"status": SaaSJobStatus.STALE, "finished_at": datetime.now(timezone.utc)})
        db.commit()

        # Verificar si hay uno corriendo
        active_job = db.query(models.SaaSJobRegistry).filter(
            models.SaaSJobRegistry.job_name == job_name,
            models.SaaSJobRegistry.status == SaaSJobStatus.RUNNING
        ).first()

        if active_job:
            return None

        execution_id = str(uuid.uuid4())
        new_job = models.SaaSJobRegistry(
            job_name=job_name,
            execution_id=execution_id,
            status=SaaSJobStatus.RUNNING,
            started_at=datetime.now(timezone.utc)
        )
        db.add(new_job)
        db.commit()
        return execution_id

    @staticmethod
    def finish_job(db: Session, execution_id: str, status: str, metrics: Optional[Dict] = None, error_log: Optional[str] = None):
        """Registra la finalización de un job"""
        job = db.query(models.SaaSJobRegistry).filter(models.SaaSJobRegistry.execution_id == execution_id).first()
        if job:
            job.status = status
            job.finished_at = datetime.now(timezone.utc)
            job.metrics = metrics
            job.error_log = error_log
            db.commit()

    @staticmethod
    def run_trial_expiration_job(db: Session, dry_run: bool = False) -> Dict[str, Any]:
        """
        Ejecuta el proceso de expiración de trials vencidos.
        Lógica Idempotente y Auditada.
        """
        job_name = "AUTO_EXPIRATION"
        exec_id = SaaSJobService.start_job(db, job_name)
        
        if not exec_id:
            return {"error": "Job already running or lock active"}

        metrics = {
            "tenants_scanned": 0,
            "tenants_expired": 0,
            "errors": [],
            "dry_run": dry_run
        }
        
        start_time = datetime.now(timezone.utc)

        try:
            # Seleccionar empresas candidatas: Trial + Activas + Fecha vencida
            ahora = datetime.now(timezone.utc)
            query = db.query(models.Empresa).filter(
                models.Empresa.plan_type == PlanType.TRIAL,
                models.Empresa.is_active == True,
                models.Empresa.is_protected == False,
                models.Empresa.id != 1,
                models.Empresa.trial_ends_at < ahora
            )
            
            tenants = query.all()
            metrics["tenants_scanned"] = len(tenants)

            for tenant in tenants:
                try:
                    if not dry_run:
                        # Cambio de estado
                        previous_status = "ACTIVE"
                        tenant.is_active = False
                        
                        # Auditoría Estructurada
                        audit_detail = {
                            "metadata": {"version": "1.0", "execution_id": exec_id, "source": "SYSTEM_JOB"},
                            "payload": {
                                "tenant_id": tenant.id,
                                "event": "AUTOMATIC_EXPIRATION",
                                "transition": {"from_active": True, "to_active": False},
                                "reason": "Trial period ended",
                                "trial_ends_at": str(tenant.trial_ends_at)
                            }
                        }
                        
                        db_log = models.SaaSAuditLog(
                            admin_id=None, # ID 0 o None para Sistema
                            empresa_id=tenant.id,
                            accion="AUTO_EXPIRE",
                            detalle=audit_detail
                        )
                        db.add(db_log)
                        metrics["tenants_expired"] += 1
                except Exception as e:
                    metrics["errors"].append({"id": tenant.id, "error": str(e)})

            if not dry_run:
                db.commit()

            status = SaaSJobStatus.SUCCESS
        except Exception as e:
            status = SaaSJobStatus.FAILED
            metrics["fatal_error"] = str(e)
        
        end_time = datetime.now(timezone.utc)
        metrics["duration_ms"] = int((end_time - start_time).total_seconds() * 1000)
        
        SaaSJobService.finish_job(db, exec_id, status, metrics, metrics.get("fatal_error"))
        
        return metrics
