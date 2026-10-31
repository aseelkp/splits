import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import make_engine
from app.models import Base, Exercise, ExerciseSet, Run, SessionType, Unit, WorkoutSession
from app.services import exercises, importer, workouts

BACKEND = Path(__file__).resolve().parent.parent
EXAMPLE = BACKEND.parent / "docs" / "import-example.json"


def load(obj) -> importer.ImportFile:
    data, errors = importer.parse_file(json.dumps(obj))
    assert not errors, errors
    return data


def run_import(db, obj, replace=False):
    plan = importer.build_plan(db, load(obj), replace=replace)
    assert not plan.errors, plan.errors
    importer.apply_plan(db, plan)
    return plan


def errors_for(db, obj) -> list[str]:
    data, errors = importer.parse_file(json.dumps(obj))
    if data is not None:
        errors = importer.build_plan(db, data).errors
    return errors


def count(db, model) -> int:
    return db.scalar(select(func.count()).select_from(model))


def simple(sets, **extra):
    return {"version": 1, "sessions": [{"date": "2026-10-01", "type": "push", "sets": sets}], **extra}


# ---- the example file ----


def test_example_file_imports_and_is_idempotent(db):
    obj = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    plan = run_import(db, obj)
    assert plan.count("create") == 4
    assert count(db, WorkoutSession) == 4
    assert count(db, Run) == 2
    assert count(db, ExerciseSet) == 15  # 7 push + 5 lower + 0 run + 3 push
    assert count(db, Exercise) == 5  # 3 listed + Pull-up and Leg press created from the sets
    sets_before = count(db, ExerciseSet)

    again = run_import(db, obj)  # second run: everything already exists
    assert again.count("skip") == 4 and again.count("create") == 0
    assert again.new_exercises == []
    assert count(db, WorkoutSession) == 4
    assert count(db, ExerciseSet) == sets_before


def test_units_are_stored_as_given_and_never_converted(db):
    run_import(db, json.loads(EXAMPLE.read_text(encoding="utf-8")))
    squat = [s for s in db.scalars(select(ExerciseSet).join(Exercise)).all() if s.exercise.name == "Back squat"]
    assert {s.unit for s in squat} == {Unit.lbs}
    assert sorted(float(s.weight) for s in squat) == [135, 185, 205, 205]


# ---- run object ----


def test_run_accepts_every_field_and_only_mode_is_required(db):
    full = {"mode": "outdoor", "duration_seconds": 1800, "distance_km": 5.25, "incline_percent": 1.5,
            "avg_hr": 150, "max_hr": 171, "structure": "5x(4 run/1 walk)", "remark": "windy"}
    obj = {"version": 1, "sessions": [
        {"date": "2026-10-01", "type": "run", "run": full},
        {"date": "2026-10-02", "type": "run", "run": {"mode": "indoor"}},
    ]}
    run_import(db, obj)
    runs = {r.session.date.isoformat(): r for r in db.scalars(select(Run))}
    r = runs["2026-10-01"]
    assert (r.mode, r.duration_seconds, float(r.distance_km), float(r.incline_percent)) == ("outdoor", 1800, 5.25, 1.5)
    assert (r.avg_hr, r.max_hr, r.structure, r.remark) == (150, 171, "5x(4 run/1 walk)", "windy")
    assert runs["2026-10-02"].distance_km is None
    assert any("mode" in e for e in errors_for(db, {"version": 1, "sessions": [{"date": "2026-10-01", "type": "run", "run": {"distance_km": 1}}]}))


# ---- unit priority ----


def test_unit_priority_set_then_exercise_then_file_default(db):
    exercises.create_exercise(db, importer.ExerciseIn(name="Leg press", default_unit="lbs"))
    obj = simple(
        [
            {"exercise": "Leg press", "weight": 100, "reps": 5},                    # database default: lbs
            {"exercise": "Leg press", "weight": 100, "reps": 5, "unit": "kg"},      # the set wins: kg
            {"exercise": "Row", "weight": 30, "reps": 5},                           # listed default: lbs
            {"exercise": "Curl", "weight": 10, "reps": 5},                          # file default: kg
        ],
        exercises=[{"name": "Row", "default_unit": "lbs"}],
        default_unit="kg",
    )
    run_import(db, obj)
    units = [(s.exercise.name, s.unit) for s in db.scalars(select(ExerciseSet).order_by(ExerciseSet.set_order))]
    assert units == [("Leg press", "lbs"), ("Leg press", "kg"), ("Row", "lbs"), ("Curl", "kg")]


def test_error_only_when_no_unit_anywhere_and_bodyweight_needs_none(db):
    errs = errors_for(db, simple([{"exercise": "Curl", "weight": 10, "reps": 5}]))
    assert len(errs) == 1 and errs[0].startswith("sessions[0].sets[0]:") and "no unit" in errs[0]
    assert any("no unit" in e for e in errors_for(db, simple([{"exercise": "Curl", "shorthand": "10x5, bwx5"}])))

    run_import(db, simple([{"exercise": "Pull-up", "shorthand": "bwx8, bwx7"}, {"exercise": "Dip", "reps": 10}]))
    assert count(db, ExerciseSet) == 3
    assert {s.weight for s in db.scalars(select(ExerciseSet))} == {None}


# ---- all or nothing ----


def test_failure_midway_rolls_back_everything(db, monkeypatch):
    obj = {"version": 1, "sessions": [
        {"date": f"2026-10-0{i}", "type": "push", "sets": [{"exercise": f"Ex{i}", "weight": 10, "unit": "kg", "reps": 5}]}
        for i in range(1, 4)
    ]}
    real = workouts.create_session
    calls = []

    def flaky(*a, **kw):
        calls.append(1)
        if len(calls) == 3:
            raise RuntimeError("connection dropped")
        return real(*a, **kw)

    monkeypatch.setattr(workouts, "create_session", flaky)
    plan = importer.build_plan(db, load(obj))
    with pytest.raises(RuntimeError):
        importer.apply_plan(db, plan)
    assert len(calls) == 3  # two sessions were written before the failure...
    assert count(db, WorkoutSession) == 0  # ...and none of it stayed
    assert count(db, Exercise) == 0 and count(db, ExerciseSet) == 0


def test_replace_delete_and_insert_share_the_transaction(db, monkeypatch):
    run_import(db, simple([{"exercise": "Bench", "weight": 60, "unit": "kg", "reps": 10}]))
    new = simple([{"exercise": "Bench", "weight": 65, "unit": "kg", "reps": 8}])

    def boom(*a, **kw):
        raise RuntimeError("insert failed")

    monkeypatch.setattr(workouts, "create_session", boom)
    plan = importer.build_plan(db, load(new), replace=True)
    assert plan.count("replace") == 1
    with pytest.raises(RuntimeError):
        importer.apply_plan(db, plan)
    monkeypatch.undo()
    # The delete was rolled back too: the original session is still there, unchanged.
    assert [float(s.weight) for s in db.scalars(select(ExerciseSet))] == [60.0]


# ---- skip and replace ----


def test_existing_date_and_type_is_skipped_by_default_and_replaced_on_request(db):
    run_import(db, simple([{"exercise": "Bench", "weight": 60, "unit": "kg", "reps": 10}]))
    changed = simple([{"exercise": "Bench", "weight": 70, "unit": "kg", "reps": 5}])

    plan = run_import(db, changed)
    assert plan.count("skip") == 1
    assert [float(s.weight) for s in db.scalars(select(ExerciseSet))] == [60.0]

    plan = run_import(db, changed, replace=True)
    assert plan.count("replace") == 1
    assert [float(s.weight) for s in db.scalars(select(ExerciseSet))] == [70.0]
    assert count(db, WorkoutSession) == 1


def test_different_type_on_same_day_is_a_different_session(db):
    obj = {"version": 1, "sessions": [{"date": "2026-10-01", "type": "push"}, {"date": "2026-10-01", "type": "run"}]}
    assert run_import(db, obj).count("create") == 2


# ---- validation: everything is checked first, errors say where ----


def test_errors_are_located_and_nothing_is_written(db):
    obj = {"version": 1, "sessions": [
        {"date": "2026-10-01", "type": "push", "sets": [
            {"exercise": "Bench", "weight": 60, "reps": 5, "unit": "stone"},
            {"exercise": "Bench", "weihgt": 60, "reps": 5, "unit": "kg"},
            {"exercise": "Bench", "shorthand": "sixty x 5", "unit": "kg"},
            {"exercise": "Bench", "unit": "kg"},
        ]},
        {"date": "2026-13-45", "type": "push"},
        {"date": "2026-10-03", "type": "swim"},
        {"date": "2026-10-01", "type": "push"},
    ]}
    errs = errors_for(db, obj)
    text = "\n".join(errs)
    assert "sessions[0].sets[0].unit" in text
    assert "sessions[0].sets[1].weihgt" in text  # a typo'd field is reported, not ignored
    assert "sessions[0].sets[3]" in text and "reps" in text
    assert "sessions[1].date" in text and "sessions[2].type" in text
    plan = importer.build_plan(db, load({"version": 1, "sessions": [
        {"date": "2026-10-01", "type": "push", "sets": [{"exercise": "B", "shorthand": "sixty x 5", "unit": "kg"}]},
        {"date": "2026-10-01", "type": "push"},
    ]}))
    joined = "\n".join(plan.errors)
    assert "sessions[0].sets[0].shorthand" in joined
    assert "sessions[1]" in joined and "sessions[0]" in joined and "One per date + type" in joined
    assert count(db, WorkoutSession) == 0


def test_bad_json_and_wrong_version_are_reported(db):
    data, errors = importer.parse_file("{not json")
    assert data is None and errors
    assert any("version" in e for e in errors_for(db, {"version": 2, "sessions": []}))


# ---- new exercises (what --dry-run shows) ----


def test_new_exercises_listed_with_lookalike_hints(db):
    exercises.create_exercise(db, importer.ExerciseIn(name="Lat pull down"))
    obj = simple(
        [
            {"exercise": "Lat pulldown", "weight": 40, "unit": "kg", "reps": 10},
            {"exercise": "lat  PULL-DOWN", "weight": 40, "unit": "kg", "reps": 10},
            {"exercise": "Bench press", "weight": 60, "unit": "lbs", "reps": 10},
        ],
        exercises=[{"name": "Plank", "category": "core"}],
    )
    plan = importer.build_plan(db, load(obj))
    by_name = {n.data.name: n for n in plan.new_exercises}
    # "lat PULL-DOWN" is a different name to the app (hyphen), so it is listed, and flagged.
    assert set(by_name) == {"Plank", "Lat pulldown", "lat PULL-DOWN", "Bench press"}
    assert "Lat pull down" in by_name["Lat pulldown"].similar_to
    assert "Lat pulldown" in by_name["lat PULL-DOWN"].similar_to
    assert by_name["Bench press"].similar_to == []
    assert by_name["Bench press"].data.default_unit == "lbs"  # taken from its first set
    assert by_name["Plank"].data.category == "core"
    text = "\n".join(importer.describe(plan, list_sessions=True))
    assert "New exercises to create (4)" in text and 'looks like: "Lat pull down"' in text
    assert count(db, Exercise) == 1  # planning wrote nothing


def test_exercises_only_used_by_skipped_sessions_are_not_created(db):
    run_import(db, simple([{"exercise": "Bench", "weight": 60, "unit": "kg", "reps": 10}]))
    plan = importer.build_plan(db, load(simple([{"exercise": "Brand new", "weight": 1, "unit": "kg", "reps": 1}])))
    assert plan.count("skip") == 1 and plan.new_exercises == []


# ---- the command line ----


def test_cli_dry_run_then_import_against_a_sqlite_file(tmp_path):
    db_file = tmp_path / "cli.db"
    engine = make_engine(f"sqlite:///{db_file}")
    Base.metadata.create_all(engine)
    engine.dispose()
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{db_file}"}  # env vars beat backend/.env

    def cli(*args):
        return subprocess.run(
            [sys.executable, "scripts/import_history.py", str(EXAMPLE), *args],
            cwd=BACKEND, env=env, capture_output=True, text=True,
        )

    dry = cli("--dry-run")
    assert dry.returncode == 0, dry.stderr
    assert "4 to create" in dry.stdout and "Dry run: nothing was written" in dry.stdout and "New exercises to create" in dry.stdout
    with Session(make_engine(f"sqlite:///{db_file}")) as s:
        assert count(s, WorkoutSession) == 0

    real = cli()
    assert real.returncode == 0, real.stderr
    assert "Done. 4 sessions" in real.stdout
    again = cli()
    assert "4 to skip" in again.stdout and "Nothing to do" in again.stdout

    bad = tmp_path / "bad.json"
    bad.write_text('{"version": 1, "sessions": [{"date": "nope", "type": "push"}]}')
    failed = subprocess.run([sys.executable, "scripts/import_history.py", str(bad)], cwd=BACKEND, env=env, capture_output=True, text=True)
    assert failed.returncode == 1 and "sessions[0].date" in failed.stderr and "Nothing was written" in failed.stderr
