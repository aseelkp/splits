from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.config import get_settings
from app.models import ExerciseSet, Run, SessionType, WorkoutSession
from app.schemas import LogResult, RunIn, RunOut, SessionIn, SessionOut, SessionUpdate, SetIn, SetOut, SetUpdate
from app.services.errors import InvalidInputError, NotFoundError
from app.services.exercises import get_or_create_exercise
from app.services.serializers import session_out, set_out
from app.services.shorthand import ShorthandError, parse_shorthand

_LOAD = (selectinload(WorkoutSession.sets).joinedload(ExerciseSet.exercise), joinedload(WorkoutSession.run))


def today() -> date:
    return datetime.now(ZoneInfo(get_settings().timezone)).date()


def _dec(value: float | None) -> Decimal | None:
    return None if value is None else Decimal(str(value))


def _get_session(db: Session, session_id: int) -> WorkoutSession:
    ws = db.scalar(select(WorkoutSession).where(WorkoutSession.id == session_id).options(*_LOAD))
    if not ws:
        raise NotFoundError(f"No session with id {session_id}. Use get_recent_sessions to see valid ids.")
    return ws


def _build_sets(db: Session, items: list[SetIn], first_order: int) -> tuple[list[ExerciseSet], list[str]]:
    """Turn input sets (some are shorthand for many) into one ExerciseSet row each."""
    rows: list[ExerciseSet] = []
    created: list[str] = []
    for item in items:
        exercise, was_created = get_or_create_exercise(db, item.exercise, item.unit)
        if was_created:
            created.append(exercise.name)
        unit = item.unit or exercise.default_unit

        if item.shorthand is not None:
            try:
                parsed = parse_shorthand(item.shorthand)
            except ShorthandError as e:
                raise InvalidInputError(f'{exercise.name}: {e}') from e
            values = [{"weight": p.weight, "reps": p.reps} for p in parsed]
        else:
            values = [{"weight": _dec(item.weight), "reps": item.reps, "duration_seconds": item.duration_seconds}]

        for v in values:
            rows.append(
                ExerciseSet(
                    exercise=exercise,
                    set_order=first_order + len(rows),
                    unit=unit,
                    remark=item.remark,
                    is_warmup=item.is_warmup,
                    **v,
                )
            )
    return rows, created


def _build_run(data: RunIn) -> Run:
    values = data.model_dump()
    values["distance_km"] = _dec(values["distance_km"])
    values["incline_percent"] = _dec(values["incline_percent"])
    return Run(**values)


def create_session(db: Session, data: SessionIn) -> LogResult:
    ws = WorkoutSession(date=data.date or today(), type=data.type, remark=data.remark)
    ws.sets, created = _build_sets(db, data.sets, first_order=1)
    if data.run:
        ws.run = _build_run(data.run)
    db.add(ws)
    db.commit()
    return LogResult(session=session_out(_get_session(db, ws.id)), created_exercises=created)


def get_session(db: Session, session_id: int) -> SessionOut:
    return session_out(_get_session(db, session_id))


def list_recent_sessions(db: Session, limit: int = 10) -> list[SessionOut]:
    rows = db.scalars(
        select(WorkoutSession)
        .order_by(WorkoutSession.date.desc(), WorkoutSession.id.desc())
        .limit(limit)
        .options(*_LOAD)
    )
    return [session_out(ws) for ws in rows]


def get_last_session(db: Session, type: SessionType) -> SessionOut | None:
    ws = db.scalar(
        select(WorkoutSession)
        .where(WorkoutSession.type == type)
        .order_by(WorkoutSession.date.desc(), WorkoutSession.id.desc())
        .limit(1)
        .options(*_LOAD)
    )
    return session_out(ws) if ws else None


def update_session(db: Session, session_id: int, data: SessionUpdate) -> SessionOut:
    ws = _get_session(db, session_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        if value is None and key != "remark":
            raise InvalidInputError(f"{key} cannot be cleared.")
        setattr(ws, key, value)
    db.commit()
    return session_out(ws)


def delete_session(db: Session, session_id: int) -> None:
    db.delete(_get_session(db, session_id))
    db.commit()


def add_sets(db: Session, session_id: int, items: list[SetIn]) -> LogResult:
    ws = _get_session(db, session_id)
    last = db.scalar(select(func.max(ExerciseSet.set_order)).where(ExerciseSet.session_id == session_id)) or 0
    rows, created = _build_sets(db, items, first_order=last + 1)
    ws.sets.extend(rows)
    db.commit()
    return LogResult(session=session_out(_get_session(db, session_id)), created_exercises=created)


def _get_set(db: Session, set_id: int) -> ExerciseSet:
    s = db.get(ExerciseSet, set_id)
    if not s:
        raise NotFoundError(f"No set with id {set_id}. Get set ids from get_recent_sessions or get_last_session.")
    return s


def update_set(db: Session, set_id: int, data: SetUpdate) -> SetOut:
    s = _get_set(db, set_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        if value is None and key in ("unit", "is_warmup"):
            raise InvalidInputError(f"{key} cannot be cleared.")
        setattr(s, key, _dec(value) if key == "weight" else value)
    db.commit()
    return set_out(s)


def delete_set(db: Session, set_id: int) -> None:
    db.delete(_get_set(db, set_id))
    db.commit()


def upsert_run(db: Session, session_id: int, data: RunIn) -> RunOut:
    """Set the session's run, replacing the existing one (a session has at most one)."""
    ws = _get_session(db, session_id)
    new = _build_run(data)
    if ws.run is None:
        ws.run = new
    else:
        # Update in place: swapping in a new row would be inserted before the old one is
        # deleted and trip the one-run-per-session unique constraint.
        for column in Run.__table__.columns.keys():
            if column not in ("id", "session_id"):
                setattr(ws.run, column, getattr(new, column))
    db.commit()
    return RunOut.model_validate(ws.run)
