"""Import past sessions from a JSON file (format: docs/import-format.md).

Three steps, kept apart so each is easy to test:
  1. parse_file     JSON text -> validated ImportFile (or a list of located errors)
  2. build_plan     compare with the database: what to create / skip / replace, which exercises are new
  3. apply_plan     write everything in ONE database transaction (all or nothing)
"""

import datetime as dt
import difflib
import re
from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel, ConfigDict, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Category, Exercise, SessionType, Unit, WorkoutSession
from app.schemas import ExerciseIn, RunIn, SessionIn, SetIn
from app.services import exercises, workouts
from app.services.shorthand import ShorthandError, parse_shorthand

# ---- 1. The file format. Reuses the app's own models, so the rules can't drift. ----


class ImportExercise(BaseModel):
    model_config = ConfigDict(extra="forbid")  # a typo like "catgeory" is an error, not silently ignored

    name: str
    category: Category = Category.other
    default_unit: Unit | None = None
    notes: str | None = None


class ImportSet(SetIn):
    model_config = ConfigDict(extra="forbid")


class ImportRun(RunIn):
    model_config = ConfigDict(extra="forbid")


class ImportSession(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: dt.date
    type: SessionType
    remark: str | None = None
    sets: list[ImportSet] = []
    run: ImportRun | None = None


class ImportFile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: Literal[1]
    default_unit: Unit | None = None
    exercises: list[ImportExercise] = []
    sessions: list[ImportSession]


def _location(loc: tuple) -> str:
    """('sessions', 3, 'sets', 1, 'unit') -> 'sessions[3].sets[1].unit'"""
    out = ""
    for part in loc:
        out += f"[{part}]" if isinstance(part, int) else (f".{part}" if out else str(part))
    return out or "file"


def parse_file(text: str) -> tuple[ImportFile | None, list[str]]:
    try:
        return ImportFile.model_validate_json(text), []
    except ValidationError as e:
        errors = []
        for err in e.errors():
            msg = err["msg"].removeprefix("Value error, ")
            errors.append(f"{_location(err['loc'])}: {msg}")
        return None, errors


# ---- 2. The plan ----

Action = Literal["create", "skip", "replace"]


@dataclass
class SessionPlan:
    index: int  # position in the file
    action: Action
    data: SessionIn
    existing_ids: list[int]  # sessions already in the database with this date + type
    set_count: int


@dataclass
class NewExercise:
    data: ExerciseIn
    similar_to: list[str] = field(default_factory=list)  # existing or other new names that look the same


@dataclass
class ImportPlan:
    sessions: list[SessionPlan] = field(default_factory=list)
    new_exercises: list[NewExercise] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def count(self, action: Action) -> int:
        return sum(1 for s in self.sessions if s.action == action)


def _key(name: str) -> str:
    """Same matching as the app: case-insensitive, extra spaces ignored."""
    return " ".join(name.split()).lower()


def _squash(name: str) -> str:
    """For spotting near-duplicates: "Lat pull-down" and "lat pulldown" both become "latpulldown"."""
    return re.sub(r"[\W_]+", "", name.lower())


def _similar(name: str, others: list[str]) -> list[str]:
    by_squashed: dict[str, list[str]] = {}
    for other in others:  # several names can squash to the same string, keep them all
        by_squashed.setdefault(_squash(other), []).append(other)
    close = difflib.get_close_matches(_squash(name), list(by_squashed), n=3, cutoff=0.85)
    return [other for c in close for other in by_squashed[c]][:3]


def build_plan(db: Session, data: ImportFile, replace: bool = False) -> ImportPlan:
    """Read-only: checks every rule against the file and the database, writes nothing."""
    plan = ImportPlan()
    err = plan.errors.append

    # Exercises listed in the file.
    listed: dict[str, ImportExercise] = {}
    for i, ex in enumerate(data.exercises):
        key = _key(ex.name)
        if not key:
            err(f"exercises[{i}].name: cannot be empty")
        elif key in listed:
            err(f'exercises[{i}]: "{ex.name}" is listed twice')
        else:
            listed[key] = ex

    in_db = {_key(e.name): e for e in db.scalars(select(Exercise))}
    for key, ex in listed.items():
        have = in_db.get(key)
        differs = ("category" in ex.model_fields_set and ex.category != have.category if have else False) or (
            ex.default_unit is not None and have is not None and ex.default_unit != have.default_unit
        )
        if differs:
            plan.warnings.append(
                f'"{have.name}" already exists ({have.category}, {have.default_unit}); '
                "the file's entry for it is ignored and the existing one is kept."
            )

    # Sessions already in the database, by (date, type).
    existing: dict[tuple[dt.date, SessionType], list[int]] = {}
    for sid, d, t in db.execute(select(WorkoutSession.id, WorkoutSession.date, WorkoutSession.type)):
        existing.setdefault((d, t), []).append(sid)

    first_unit: dict[str, Unit] = {}  # first unit seen per exercise, used as the default of new ones
    display: dict[str, str] = {}  # first spelling seen per exercise
    written: list[str] = []  # exercise keys used by sessions that will be written, in order
    seen: dict[tuple[dt.date, SessionType], int] = {}

    for si, s in enumerate(data.sessions):
        where = f"sessions[{si}]"
        pair = (s.date, s.type)
        if pair in seen:
            err(f"{where}: another session on {s.date} with type {s.type} is at sessions[{seen[pair]}]. One per date + type.")
        seen[pair] = si

        sets: list[SetIn] = []
        for ji, item in enumerate(s.sets):
            key = _key(item.exercise)
            if not key:
                err(f"{where}.sets[{ji}].exercise: cannot be empty")
                continue
            display.setdefault(key, " ".join(item.exercise.split()))

            if item.shorthand is not None:
                try:
                    has_weight = any(p.weight is not None for p in parse_shorthand(item.shorthand))
                except ShorthandError as e:
                    err(f"{where}.sets[{ji}].shorthand: {e}")
                    continue
            else:
                has_weight = item.weight is not None

            # Unit priority: the set's own, then the exercise's default (database wins over the
            # file's list), then the file-wide default. Bodyweight sets need none.
            exercise_default = in_db[key].default_unit if key in in_db else (listed[key].default_unit if key in listed else None)
            unit = item.unit or exercise_default or data.default_unit
            if unit is None and has_weight:
                err(
                    f'{where}.sets[{ji}]: no unit for "{item.exercise}". Give the set a unit, give the exercise '
                    "a default_unit in the exercises list, or set default_unit at the top of the file."
                )
                continue
            if unit is not None:
                first_unit.setdefault(key, unit)
            sets.append(SetIn.model_validate({**item.model_dump(), "unit": unit}))

        pair_ids = existing.get(pair, [])
        action: Action = ("replace" if replace else "skip") if pair_ids else "create"
        if action != "skip":
            written.extend(_key(x.exercise) for x in sets)
        run = RunIn.model_validate(s.run.model_dump()) if s.run else None
        plan.sessions.append(
            SessionPlan(
                index=si,
                action=action,
                data=SessionIn(date=s.date, type=s.type, remark=s.remark, sets=sets, run=run),
                existing_ids=pair_ids,
                set_count=len(s.sets),
            )
        )

    # Which exercises will be new? Listed ones always (you asked for them); the rest only if a
    # session that will actually be written uses them.
    new: list[ExerciseIn] = []
    for key, ex in listed.items():
        if key not in in_db:
            unit = ex.default_unit or first_unit.get(key) or data.default_unit or Unit.kg
            new.append(ExerciseIn(name=" ".join(ex.name.split()), category=ex.category, default_unit=unit, notes=ex.notes))
    for key in dict.fromkeys(written):  # de-duplicated, order kept
        if key not in in_db and key not in listed:
            unit = first_unit.get(key) or data.default_unit or Unit.kg
            new.append(ExerciseIn(name=display[key], default_unit=unit))

    names = [e.name for e in in_db.values()]
    for n in new:
        others = names + [x.name for x in new if x is not n]
        plan.new_exercises.append(NewExercise(n, _similar(n.name, others)))
    return plan


# ---- 3. Writing ----


def apply_plan(db: Session, plan: ImportPlan) -> None:
    """Write the plan in ONE transaction. Any failure rolls everything back.

    Nothing below commits: each service call is told commit=False, which only sends the SQL
    (a "flush"). The single db.commit() at the end is what makes it all permanent at once.
    """
    if plan.errors:
        raise ValueError("Refusing to write: the plan has errors.")
    try:
        for n in plan.new_exercises:
            exercises.create_exercise(db, n.data, commit=False)
        for item in plan.sessions:
            if item.action == "skip":
                continue
            for sid in item.existing_ids:  # only non-empty for "replace"
                workouts.delete_session(db, sid, commit=False)
            workouts.create_session(db, item.data, commit=False)
        db.commit()
    except BaseException:
        db.rollback()
        raise


def describe(plan: ImportPlan, list_sessions: bool) -> list[str]:
    """Human-readable summary, used by both --dry-run and the real run."""
    lines = [
        f"Sessions in file: {len(plan.sessions)}  ->  "
        f"{plan.count('create')} to create, {plan.count('skip')} to skip (already exist), {plan.count('replace')} to replace"
    ]
    if list_sessions:
        for s in plan.sessions:
            sets = f"{s.set_count} set{'' if s.set_count == 1 else 's'}" + (", run" if s.data.run else "")
            lines.append(f"  {s.action:<8} {s.data.date} {s.data.type:<6} ({sets})")
    for w in plan.warnings:
        lines.append(f"Note: {w}")
    if plan.new_exercises:
        lines.append(f"New exercises to create ({len(plan.new_exercises)}):")
        for n in plan.new_exercises:
            hint = f'   <- looks like: {", ".join(chr(34) + x + chr(34) for x in n.similar_to)}' if n.similar_to else ""
            lines.append(f'  - "{n.data.name}" ({n.data.category}, {n.data.default_unit}){hint}')
    else:
        lines.append("New exercises to create: none")
    return lines
