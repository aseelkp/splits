from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Exercise, ExerciseSet, Run, RunMode, SessionType, Unit, WorkoutSession


def make_session(db: Session) -> WorkoutSession:
    bench = Exercise(name="Bench press")
    s = WorkoutSession(date=date(2026, 10, 31), type=SessionType.push)
    s.sets = [
        ExerciseSet(exercise=bench, set_order=1, weight=Decimal("60"), unit=Unit.kg, reps=10),
        ExerciseSet(exercise=bench, set_order=2, weight=Decimal("62.5"), unit=Unit.kg, reps=8),
    ]
    s.run = Run(mode=RunMode.indoor, duration_seconds=600, distance_km=Decimal("1.5"))
    db.add(s)
    db.commit()
    return s


def test_session_holds_sets_and_a_run(db):
    s = make_session(db)
    assert [x.set_order for x in s.sets] == [1, 2]
    assert s.run.distance_km == Decimal("1.50")
    assert s.created_at is not None
    assert s.sets[0].is_warmup is False


def test_deleting_session_deletes_sets_and_run_but_keeps_exercise(db):
    s = make_session(db)
    db.delete(s)
    db.commit()
    assert db.scalars(select(ExerciseSet)).all() == []
    assert db.scalars(select(Run)).all() == []
    assert len(db.scalars(select(Exercise)).all()) == 1


def test_exercise_names_are_unique(db):
    db.add_all([Exercise(name="Squat"), Exercise(name="Squat")])
    with pytest.raises(IntegrityError):
        db.commit()


def test_cannot_delete_exercise_that_has_sets(db):
    s = make_session(db)
    db.delete(s.sets[0].exercise)
    with pytest.raises(IntegrityError):
        db.commit()
