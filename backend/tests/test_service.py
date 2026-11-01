from datetime import date

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from app.models import Exercise, ExerciseSet, SessionType, Unit
from app.schemas import ExerciseIn, ExerciseUpdate, RunIn, SessionIn, SessionUpdate, SetIn, SetUpdate
from app.services import exercises, workouts
from app.services.errors import ConflictError, InvalidInputError, NotFoundError

D1, D2 = date(2026, 10, 1), date(2026, 10, 8)


def log(db, d=D1, type="push", sets=None, **kw):
    sets = sets if sets is not None else [SetIn(exercise="Bench press", shorthand="60x2x10")]
    return workouts.create_session(db, SessionIn(date=d, type=type, sets=sets, **kw))


def test_create_session_expands_shorthand_into_one_row_per_set(db):
    result = log(db, sets=[SetIn(exercise="Bench press", shorthand="40x10, 80x12, 90x2x10")])
    sets = result.session.sets
    assert [(s.set_order, s.weight, s.reps) for s in sets] == [(1, 40, 10), (2, 80, 12), (3, 90, 10), (4, 90, 10)]
    assert all(s.unit == Unit.kg and s.exercise == "Bench press" and s.id for s in sets)


def test_unknown_exercises_are_created_and_reported(db):
    result = log(db, sets=[SetIn(exercise="Cable fly", shorthand="20x12", unit="lbs")])
    assert result.created_exercises == ["Cable fly"]
    assert exercises.find_exercise(db, "cable fly").default_unit == Unit.lbs
    again = log(db, sets=[SetIn(exercise="CABLE FLY", shorthand="25x12")])
    assert again.created_exercises == []
    assert db.scalar(select(func.count()).select_from(Exercise)) == 1


def test_unit_defaults_to_exercise_default_but_is_stored_per_set_and_never_converted(db):
    exercises.create_exercise(db, ExerciseIn(name="Squat", default_unit="lbs"))
    result = log(
        db,
        type="lower",
        sets=[
            SetIn(exercise="Squat", weight=135, reps=5),
            SetIn(exercise="Squat", weight=60, unit="kg", reps=5),
        ],
    )
    assert [(s.weight, s.unit) for s in result.session.sets] == [(135, Unit.lbs), (60, Unit.kg)]


def test_plain_set_bodyweight_duration_and_warmup(db):
    result = log(
        db,
        sets=[
            SetIn(exercise="Pull-up", reps=8),
            SetIn(exercise="Plank", duration_seconds=60, remark="shaky"),
            SetIn(exercise="Bench press", weight=20, reps=15, is_warmup=True),
        ],
    )
    pullup, plank, warm = result.session.sets
    assert pullup.weight is None and pullup.reps == 8
    assert plank.duration_seconds == 60 and plank.remark == "shaky"
    assert warm.is_warmup is True


def test_session_with_sets_and_run(db):
    run = RunIn(
        mode="indoor",
        duration_seconds=1200,
        distance_km=3.2,
        incline_percent=1.5,
        avg_hr=150,
        structure="5x(4 run/1 walk) at 8 km/h",
    )
    s = log(db, run=run).session
    assert s.run.distance_km == 3.2 and s.run.incline_percent == 1.5 and s.run.structure.startswith("5x")
    assert len(s.sets) == 2


def test_created_at_always_has_a_timezone_offset(db):
    # SQLite stores naive timestamps; strict JSON-schema clients reject date-times without an offset.
    created_at = log(db).session.created_at
    assert created_at.utcoffset() is not None
    assert created_at.isoformat().endswith("+00:00")


def test_date_defaults_to_today_in_configured_timezone(db):
    s = workouts.create_session(db, SessionIn(type="other")).session
    assert s.date == workouts.today()


def test_bad_shorthand_is_rejected_with_exercise_name_and_nothing_is_saved(db):
    with pytest.raises(InvalidInputError, match="Bench press.*oops"):
        log(db, sets=[SetIn(exercise="Bench press", shorthand="oops")])
    db.rollback()
    assert db.scalar(select(func.count()).select_from(ExerciseSet)) == 0


def test_set_input_needs_reps_duration_or_shorthand_not_both():
    with pytest.raises(ValidationError):
        SetIn(exercise="Bench press", weight=50)
    with pytest.raises(ValidationError):
        SetIn(exercise="Bench press", shorthand="50x5", reps=5)


def test_recent_sessions_newest_first_and_limited(db):
    a, b, c = log(db, D1).session, log(db, D2).session, log(db, D2).session
    assert [s.id for s in workouts.list_recent_sessions(db, limit=10)] == [c.id, b.id, a.id]
    assert [s.id for s in workouts.list_recent_sessions(db, limit=2)] == [c.id, b.id]


def test_last_session_of_a_type(db):
    log(db, D1, "push")
    newest_push = log(db, D2, "push").session
    log(db, D2, "pull")
    assert workouts.get_last_session(db, SessionType.push).id == newest_push.id
    assert workouts.get_last_session(db, SessionType.upper) is None


def test_add_sets_continues_set_order(db):
    s = log(db).session
    result = workouts.add_sets(db, s.id, [SetIn(exercise="Row", shorthand="50x8")])
    assert [x.set_order for x in result.session.sets] == [1, 2, 3]
    assert result.created_exercises == ["Row"]


def test_update_and_delete_set(db):
    s = log(db).session
    first = s.sets[0]
    updated = workouts.update_set(db, first.id, SetUpdate(weight=62.5, remark="felt easy"))
    assert updated.weight == 62.5 and updated.remark == "felt easy" and updated.reps == 10
    cleared = workouts.update_set(db, first.id, SetUpdate(remark=None))
    assert cleared.remark is None
    with pytest.raises(InvalidInputError):
        workouts.update_set(db, first.id, SetUpdate(unit=None))
    workouts.delete_set(db, first.id)
    assert len(workouts.get_session(db, s.id).sets) == 1
    with pytest.raises(NotFoundError):
        workouts.delete_set(db, first.id)


def test_update_session_changes_only_sent_fields(db):
    s = log(db, remark="old").session
    u = workouts.update_session(db, s.id, SessionUpdate(date=D2))
    assert u.date == D2 and u.remark == "old" and u.type == SessionType.push
    assert workouts.update_session(db, s.id, SessionUpdate(remark=None)).remark is None
    with pytest.raises(InvalidInputError):
        workouts.update_session(db, s.id, SessionUpdate(type=None))


def test_upsert_run_replaces_the_existing_run(db):
    s = log(db, run=RunIn(mode="indoor", distance_km=2)).session
    r = workouts.upsert_run(db, s.id, RunIn(mode="outdoor", distance_km=5))
    assert r.mode == "outdoor" and r.distance_km == 5
    assert workouts.get_session(db, s.id).run.id == r.id


def test_delete_session_removes_sets_and_run_but_keeps_exercises(db):
    s = log(db, run=RunIn(mode="indoor")).session
    workouts.delete_session(db, s.id)
    assert db.scalar(select(func.count()).select_from(ExerciseSet)) == 0
    assert len(exercises.list_exercises(db)) == 1
    with pytest.raises(NotFoundError, match="No session with id"):
        workouts.get_session(db, s.id)


def test_exercise_history_newest_first_across_sessions(db):
    log(db, D1, sets=[SetIn(exercise="Bench press", shorthand="60x8")])
    log(db, D2, sets=[SetIn(exercise="Bench press", shorthand="62.5x2x8"), SetIn(exercise="Row", shorthand="50x8")])
    history = exercises.get_exercise_history(db, "bench press")
    assert [(h.date, h.weight) for h in history] == [(D2, 62.5), (D2, 62.5), (D1, 60)]
    assert len(exercises.get_exercise_history(db, "Bench press", limit=1)) == 1
    with pytest.raises(NotFoundError, match="list_exercises"):
        exercises.get_exercise_history(db, "Nope")


def test_exercise_crud_rules(db):
    created = exercises.create_exercise(db, ExerciseIn(name="  Deadlift ", category="pull"))
    assert created.name == "Deadlift"
    with pytest.raises(ConflictError):
        exercises.create_exercise(db, ExerciseIn(name="deadlift"))
    other = exercises.create_exercise(db, ExerciseIn(name="Row"))
    with pytest.raises(ConflictError):
        exercises.update_exercise(db, other.id, ExerciseUpdate(name="DEADLIFT"))
    assert exercises.update_exercise(db, other.id, ExerciseUpdate(notes="barbell")).notes == "barbell"
    log(db, sets=[SetIn(exercise="Deadlift", shorthand="100x5")])
    with pytest.raises(ConflictError, match="logged sets"):
        exercises.delete_exercise(db, created.id)
    exercises.delete_exercise(db, other.id)
    assert [e.name for e in exercises.list_exercises(db)] == ["Deadlift"]


def test_exercise_history_says_which_session_type_each_set_was_done_in(db):
    # The same exercise in two different kinds of session: history is per exercise, tagged by session type.
    log(db, D1, type="upper", sets=[SetIn(exercise="Bench press", shorthand="10x10")])
    log(db, D2, type="push", sets=[SetIn(exercise="Bench press", shorthand="15x10")])
    history = exercises.get_exercise_history(db, "Bench press")
    assert [(h.date, h.session_type, h.weight) for h in history] == [(D2, "push", 15), (D1, "upper", 10)]
