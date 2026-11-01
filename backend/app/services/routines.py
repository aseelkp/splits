"""Routines: which exercises a kind of session starts with, in what order.

A kind of session (push, pull, ...) either has a saved routine, or has none and simply follows its
last session. Saving never happens by itself: the routine only changes when you save it.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import RoutineItem, SessionType
from app.schemas import RoutineIn, RoutineItemOut, RoutineOut
from app.services import workouts
from app.services.errors import InvalidInputError
from app.services.exercises import get_or_create_exercise

# Runs have no exercises, so they have no routine.
ROUTINE_TYPES = [t for t in SessionType if t != SessionType.run]


def _check_type(type: SessionType) -> None:
    if type not in ROUTINE_TYPES:
        raise InvalidInputError(f"{type.value} sessions have no exercises, so there is no routine to set.")


def _saved(db: Session, type: SessionType) -> list[RoutineItem]:
    return list(
        db.scalars(select(RoutineItem).where(RoutineItem.session_type == type).order_by(RoutineItem.position))
    )


def _from_last_session(db: Session, type: SessionType) -> list[RoutineItemOut]:
    last = workouts.get_last_session(db, type)
    seen: dict[int, RoutineItemOut] = {}
    for s in last.sets if last else []:
        if s.exercise_id not in seen:
            seen[s.exercise_id] = RoutineItemOut(
                exercise_id=s.exercise_id, exercise=s.exercise, position=len(seen) + 1, target_sets=None
            )
    return list(seen.values())


def get_routine(db: Session, type: SessionType) -> RoutineOut:
    """The routine in effect: the saved one, or (if none is saved) the last session of this type."""
    _check_type(type)
    rows = _saved(db, type)
    if rows:
        items = [
            RoutineItemOut(exercise_id=r.exercise_id, exercise=r.exercise.name, position=r.position, target_sets=r.target_sets)
            for r in rows
        ]
        return RoutineOut(type=type, saved=True, items=items)
    return RoutineOut(type=type, saved=False, items=_from_last_session(db, type))


def list_routines(db: Session) -> list[RoutineOut]:
    return [get_routine(db, t) for t in ROUTINE_TYPES]


def set_routine(db: Session, type: SessionType, data: RoutineIn) -> RoutineOut:
    """Replace the whole routine for this kind of session. An empty list removes it."""
    _check_type(type)
    names = [" ".join(i.exercise.split()) for i in data.items]
    if any(not n for n in names):
        raise InvalidInputError("Exercise name cannot be empty.")
    first_spelling: dict[str, str] = {}
    dupes: list[str] = []
    for n in names:
        if n.lower() in first_spelling:
            dupes.append(first_spelling[n.lower()])
        first_spelling.setdefault(n.lower(), n)
    if dupes:
        raise InvalidInputError(f"{', '.join(dict.fromkeys(dupes))} appears more than once. Each exercise can be in a routine once.")

    for old in _saved(db, type):
        db.delete(old)
    db.flush()  # remove the old rows before inserting, so the unique (type, exercise) pair is free again
    for position, (name, item) in enumerate(zip(names, data.items, strict=True), start=1):
        exercise, _ = get_or_create_exercise(db, name)
        db.add(RoutineItem(session_type=type, exercise_id=exercise.id, position=position, target_sets=item.target_sets))
    db.commit()
    return get_routine(db, type)
