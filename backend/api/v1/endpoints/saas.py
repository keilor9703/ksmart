from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import models, schemas
from api.deps import get_db, get_current_active_user

router = APIRouter()

@router.get("/announcements", response_model=List[schemas.SaaSAnnouncementOut])
def get_active_announcements(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Obtiene los anuncios globales activos que no han expirado"""
    ahora = datetime.now(timezone.utc)
    
    query = db.query(models.SaaSAnnouncement).filter(
        models.SaaSAnnouncement.is_active == True,
        (models.SaaSAnnouncement.expires_at == None) | (models.SaaSAnnouncement.expires_at > ahora)
    ).order_by(models.SaaSAnnouncement.created_at.desc())
    
    return query.all()
