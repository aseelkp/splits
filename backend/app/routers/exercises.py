"""HTTP adapter for exercises. Each handler just calls the service layer."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.auth import protected
from app.db import get_db
from app.schemas import ExerciseIn, ExerciseOut, ExerciseUpdate, HistorySet
from app.services import exercises

router = APIRouter(prefix="/api/exercises", tags=["exercises"], dependencies=protected)
DB = Annotated[Session, Depends(get_db)]


@router.get("")
def list_exercises(db: DB) -> list[ExerciseOut]:
    return exercises.list_exercises(db)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_exercise(data: ExerciseIn, db: DB) -> ExerciseOut:
    return exercises.create_exercise(db, data)


@router.get("/{exercise_id}")
def get_exercise(exercise_id: int, db: DB) -> ExerciseOut:
    return exercises.get_exercise(db, exercise_id)


@router.patch("/{exercise_id}")
def update_exercise(exercise_id: int, data: ExerciseUpdate, db: DB) -> ExerciseOut:
    return exercises.update_exercise(db, exercise_id, data)


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exercise(exercise_id: int, db: DB) -> None:
    exercises.delete_exercise(db, exercise_id)


@router.get("/{exercise_id}/history")
def exercise_history(exercise_id: int, db: DB, limit: Annotated[int, Query(ge=1, le=500)] = 50) -> list[HistorySet]:
    return exercises.get_exercise_history(db, exercise_id, limit)
