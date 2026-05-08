from datetime import datetime, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session
import models
from core.constants import PlanType, AccessStatus

class TenantAccessService:
    @staticmethod
    def evaluate_access(db: Session, empresa_id: int) -> Tuple[bool, str, Optional[str]]:
        """
        Determina si una empresa tiene permiso de acceso y en qué modalidad.
        Retorna: (can_login, access_mode, reason)
        """
        # 1. Protección Defensiva (Empresa Maestra y Protegidas)
        if empresa_id == 1:
            return True, AccessStatus.ACTIVE, None
            
        empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
        if not empresa:
            return False, AccessStatus.BLOCKED, "TENANT_NOT_FOUND"

        if empresa.is_protected:
            return True, AccessStatus.ACTIVE, "PROTECTED_TENANT"

        # 2. Lógica de Suspensión Manual (SuperAdmin)
        # Si está desactivada manualmente y NO es por expiración de trial
        if not empresa.is_active and empresa.plan_type != PlanType.TRIAL:
            return False, AccessStatus.BLOCKED, "MANUAL_SUSPENSION"

        # 3. Lógica de Expiración de Trial
        if empresa.plan_type == PlanType.TRIAL:
            ahora = datetime.now(timezone.utc)
            trial_end = empresa.trial_ends_at
            
            if trial_end:
                if trial_end.tzinfo is None:
                    trial_end = trial_end.replace(tzinfo=timezone.utc)
                
                if ahora > trial_end:
                    # Aquí decidimos si bloqueamos total o restringimos
                    # Por ahora el diseño dice BLOCKED para trial vencido,
                    # pero RESTRICTED si queremos que vea su data.
                    # Implementamos BLOCKED por ahora para ser consistentes con is_active=False
                    return False, AccessStatus.BLOCKED, "TRIAL_EXPIRED"

        # 4. Caso por defecto
        if not empresa.is_active:
            return False, AccessStatus.BLOCKED, "INACTIVE"

        return True, AccessStatus.ACTIVE, None

    @staticmethod
    def is_mutation_allowed(access_mode: str, method: str) -> bool:
        """Determina si un método HTTP está permitido según el modo de acceso"""
        if access_mode == AccessStatus.ACTIVE:
            return True
        if access_mode == AccessStatus.RESTRICTED:
            return method in ["GET", "HEAD", "OPTIONS"]
        return False
