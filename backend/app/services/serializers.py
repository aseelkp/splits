"""ORM objects -> output schemas. Weights are Decimal in the database and plain numbers in JSON."""

from datetime import UTC, datetime

from app.models import ExerciseSet, WorkoutSession
from app.schemas import RunOut, SessionOut, SetOut


def set_out(s: ExerciseSet) -> SetOut:
    return SetOut(
        id=s.id,
        session_id=s.session_id,
        exercise_id=s.exercise_id,
        exercise=s.exercise.name,
        set_order=s.set_order,
        weight=s.weight,
        unit=s.unit,
        reps=s.reps,
        duration_seconds=s.duration_seconds,
        remark=s.remark,
        is_warmup=s.is_warmup,
    )


def _aware(moment: datetime) -> datetime:
    """SQLite hands back timestamps without a timezone (they are UTC); clients need an offset."""
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


def session_out(ws: WorkoutSession) -> SessionOut:
    return SessionOut(
        id=ws.id,
        date=ws.date,
        type=ws.type,
        remark=ws.remark,
        created_at=_aware(ws.created_at),
        sets=[set_out(s) for s in ws.sets],
        run=RunOut.model_validate(ws.run) if ws.run else None,
    )
