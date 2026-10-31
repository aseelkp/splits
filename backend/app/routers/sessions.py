"""HTTP adapter for sessions, sets and runs. Each handler just calls the service layer."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.auth import protected
from app.db import get_db
from app.models import SessionType
from app.schemas import LogResult, RunIn, RunOut, SessionIn, SessionOut, SessionUpdate, SetIn, SetOut, SetUpdate
from app.services import workouts

router = APIRouter(prefix="/api", tags=["sessions"], dependencies=protected)
DB = Annotated[Session, Depends(get_db)]


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
def create_session(data: SessionIn, db: DB) -> LogResult:
    return workouts.create_session(db, data)


@router.get("/sessions")
def list_sessions(db: DB, limit: Annotated[int, Query(ge=1, le=200)] = 10) -> list[SessionOut]:
    return workouts.list_recent_sessions(db, limit)


# Declared before /sessions/{session_id}, otherwise "last" would be read as an id.
@router.get("/sessions/last")
def last_session(type: SessionType, db: DB) -> SessionOut | None:
    """Most recent session of a type, or null if there is none yet."""
    return workouts.get_last_session(db, type)


@router.get("/sessions/{session_id}")
def get_session(session_id: int, db: DB) -> SessionOut:
    return workouts.get_session(db, session_id)


@router.patch("/sessions/{session_id}")
def update_session(session_id: int, data: SessionUpdate, db: DB) -> SessionOut:
    return workouts.update_session(db, session_id, data)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: int, db: DB) -> None:
    workouts.delete_session(db, session_id)


@router.post("/sessions/{session_id}/sets", status_code=status.HTTP_201_CREATED)
def add_sets(session_id: int, items: list[SetIn], db: DB) -> LogResult:
    return workouts.add_sets(db, session_id, items)


@router.put("/sessions/{session_id}/run")
def set_run(session_id: int, data: RunIn, db: DB) -> RunOut:
    return workouts.upsert_run(db, session_id, data)


@router.patch("/sets/{set_id}")
def update_set(set_id: int, data: SetUpdate, db: DB) -> SetOut:
    return workouts.update_set(db, set_id, data)


@router.delete("/sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_set(set_id: int, db: DB) -> None:
    workouts.delete_set(db, set_id)
