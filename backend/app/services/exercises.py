from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Exercise, ExerciseSet, Unit, WorkoutSession
from app.schemas import ExerciseIn, ExerciseOut, ExerciseUpdate, HistorySet
from app.services.errors import ConflictError, InvalidInputError, NotFoundError
from app.services.serializers import set_out


def _clean(name: str) -> str:
    name = " ".join(name.split())
    if not name:
        raise InvalidInputError("Exercise name cannot be empty.")
    return name


def find_exercise(db: Session, name: str) -> Exercise | None:
    """Case-insensitive, so "bench press" and "Bench press" are the same exercise."""
    return db.scalar(select(Exercise).where(func.lower(Exercise.name) == _clean(name).lower()))


def get_or_create_exercise(db: Session, name: str, unit: Unit | None = None) -> tuple[Exercise, bool]:
    """Returns (exercise, was_created). Flushes but does not commit; the caller owns the transaction."""
    exercise = find_exercise(db, name)
    if exercise:
        return exercise, False
    exercise = Exercise(name=_clean(name), default_unit=unit or Unit.kg)
    db.add(exercise)
    db.flush()
    return exercise, True


def _get(db: Session, exercise_id: int) -> Exercise:
    exercise = db.get(Exercise, exercise_id)
    if not exercise:
        raise NotFoundError(f"No exercise with id {exercise_id}. Use list_exercises to see valid ids.")
    return exercise


def list_exercises(db: Session) -> list[ExerciseOut]:
    rows = db.scalars(select(Exercise).order_by(func.lower(Exercise.name)))
    return [ExerciseOut.model_validate(e) for e in rows]


def get_exercise(db: Session, exercise_id: int) -> ExerciseOut:
    return ExerciseOut.model_validate(_get(db, exercise_id))


def create_exercise(db: Session, data: ExerciseIn, commit: bool = True) -> ExerciseOut:
    if find_exercise(db, data.name):
        raise ConflictError(f'Exercise "{_clean(data.name)}" already exists.')
    exercise = Exercise(**{**data.model_dump(), "name": _clean(data.name)})
    db.add(exercise)
    db.commit() if commit else db.flush()
    return ExerciseOut.model_validate(exercise)


def update_exercise(db: Session, exercise_id: int, data: ExerciseUpdate) -> ExerciseOut:
    exercise = _get(db, exercise_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        if key == "name":
            value = _clean(value)
            clash = find_exercise(db, value)
            if clash and clash.id != exercise.id:
                raise ConflictError(f'Exercise "{value}" already exists (id {clash.id}).')
        elif value is None and key != "notes":
            raise InvalidInputError(f"{key} cannot be cleared.")
        setattr(exercise, key, value)
    db.commit()
    return ExerciseOut.model_validate(exercise)


def delete_exercise(db: Session, exercise_id: int) -> None:
    exercise = _get(db, exercise_id)
    used = db.scalar(select(func.count()).select_from(ExerciseSet).where(ExerciseSet.exercise_id == exercise_id))
    if used:
        raise ConflictError(f'"{exercise.name}" has {used} logged sets, so it cannot be deleted.')
    db.delete(exercise)
    db.commit()


def get_exercise_history(db: Session, exercise: str | int, limit: int = 50) -> list[HistorySet]:
    """Sets of one exercise (by name or id), newest first, then in set order within a session."""
    if isinstance(exercise, int):
        found = _get(db, exercise)
    else:
        found = find_exercise(db, exercise)
        if not found:
            raise NotFoundError(f'No exercise named "{exercise}". Use list_exercises to see exact names.')
    rows = db.execute(
        select(ExerciseSet, WorkoutSession.date)
        .join(WorkoutSession, ExerciseSet.session_id == WorkoutSession.id)
        .where(ExerciseSet.exercise_id == found.id)
        .order_by(WorkoutSession.date.desc(), WorkoutSession.id.desc(), ExerciseSet.set_order)
        .limit(limit)
    )
    return [HistorySet(**set_out(s).model_dump(), date=d) for s, d in rows]

