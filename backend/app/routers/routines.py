"""HTTP adapter for routines. Each handler just calls the service layer."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import protected
from app.db import get_db
from app.models import SessionType
from app.schemas import RoutineIn, RoutineOut
from app.services import routines

router = APIRouter(prefix="/api/routines", tags=["routines"], dependencies=protected)
DB = Annotated[Session, Depends(get_db)]


@router.get("")
def list_routines(db: DB) -> list[RoutineOut]:
    return routines.list_routines(db)


@router.get("/{type}")
def get_routine(type: SessionType, db: DB) -> RoutineOut:
    return routines.get_routine(db, type)


@router.put("/{type}")
def set_routine(type: SessionType, data: RoutineIn, db: DB) -> RoutineOut:
    """Replace the whole routine. An empty list removes it (the type follows its last session again)."""
    return routines.set_routine(db, type, data)
