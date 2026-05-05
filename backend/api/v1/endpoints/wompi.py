import os
import hashlib
import time
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import models
import schemas
from api.deps import get_db, get_current_user

router = APIRouter()
logger = logging.getLogger("wompi")

WOMPI_PUBLIC_KEY = os.getenv("WOMPI_PUBLIC_KEY", "pub_test_...")
WOMPI_INTEGRITY_SECRET = os.getenv("WOMPI_INTEGRITY_SECRET", "prod_integrity_...")

@router.post("/generar-hash")
def generar_hash_wompi(
    request_data: schemas.BoldHashRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    plan = db.query(models.PlanSuscripcion).filter(
        models.PlanSuscripcion.codigo_interno == request_data.plan_name,
        models.PlanSuscripcion.is_active == True
    ).first()
    if not plan:
        raise HTTPException(status_code=400, detail="El plan no existe.")

    monto_en_centavos = str(int(plan.precio * 100))
    divisa = "COP"
    timestamp = int(time.time())
    referencia = f"KSMART-{current_user.empresa_id}-{plan.id}-{timestamp}"
    cadena_concatenada = f"{referencia}{monto_en_centavos}{divisa}{WOMPI_INTEGRITY_SECRET}"
    hash_integridad = hashlib.sha256(cadena_concatenada.encode('utf-8')).hexdigest()

    return {
        "reference": referencia,
        "amount_in_cents": monto_en_centavos,
        "currency": divisa,
        "signature": hash_integridad,
        "public_key": WOMPI_PUBLIC_KEY
    }
