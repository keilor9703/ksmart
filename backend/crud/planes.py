from sqlalchemy.orm import Session
from typing import List
import models, schemas


def get_planes(db: Session, include_inactive: bool = False):
    query = db.query(models.PlanSuscripcion)
    if not include_inactive:
        query = query.filter(models.PlanSuscripcion.is_active == True)
    return query.all()

def create_plan(db: Session, plan: schemas.PlanSuscripcionCreate):
    db_plan = models.PlanSuscripcion(**plan.model_dump())
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan

def update_plan(db: Session, plan_id: int, plan_update: schemas.PlanSuscripcionUpdate):
    db_plan = db.query(models.PlanSuscripcion).filter(models.PlanSuscripcion.id == plan_id).first()
    if db_plan:
        update_data = plan_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_plan, key, value)
        db.commit()
        db.refresh(db_plan)
    return db_plan
