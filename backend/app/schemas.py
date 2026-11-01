"""Pydantic models: what goes into and comes out of the service layer.

The REST API and the MCP tools both use these, so they can't drift apart.
"""

import datetime as dt

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models import Category, RunMode, SessionType, Unit


class SetIn(BaseModel):
    """One set, or (with `shorthand`) several sets of one exercise."""

    exercise: str = Field(description='Exercise name, e.g. "Bench press". Created if it is new.')
    weight: float | None = Field(None, ge=0, description="Omit for bodyweight.")
    unit: Unit | None = Field(None, description="kg or lbs. Defaults to the exercise's default unit.")
    reps: int | None = Field(None, ge=0)
    duration_seconds: int | None = Field(None, ge=0, description="For timed holds like planks.")
    shorthand: str | None = Field(
        None, description='Instead of weight/reps: "30x2x10" = 30 for 2 sets of 10; "40x10, 80x12" = two sets.'
    )
    remark: str | None = None
    is_warmup: bool = False

    @model_validator(mode="after")
    def _check(self):
        if self.shorthand is not None:
            if self.weight is not None or self.reps is not None or self.duration_seconds is not None:
                raise ValueError("Give either shorthand or weight/reps/duration_seconds, not both.")
        elif self.reps is None and self.duration_seconds is None:
            raise ValueError("A set needs reps, duration_seconds or shorthand.")
        return self


class RunIn(BaseModel):
    mode: RunMode
    duration_seconds: int | None = Field(None, ge=0)
    distance_km: float | None = Field(None, ge=0)
    incline_percent: float | None = Field(None, ge=0)
    avg_hr: int | None = Field(None, ge=0)
    max_hr: int | None = Field(None, ge=0)
    structure: str | None = Field(None, description='e.g. "5x(4 run/1 walk) at 8 km/h"')
    remark: str | None = None


class SessionIn(BaseModel):
    date: dt.date | None = Field(None, description="YYYY-MM-DD. Defaults to today (Asia/Kolkata).")
    type: SessionType
    remark: str | None = None
    sets: list[SetIn] = []
    run: RunIn | None = None


class SessionUpdate(BaseModel):
    """Only the fields you send are changed."""

    date: dt.date | None = None
    type: SessionType | None = None
    remark: str | None = None


class SetUpdate(BaseModel):
    """Only the fields you send are changed. Send null to clear a nullable field."""

    weight: float | None = Field(None, ge=0)
    unit: Unit | None = None
    reps: int | None = Field(None, ge=0)
    duration_seconds: int | None = Field(None, ge=0)
    remark: str | None = None
    is_warmup: bool | None = None


class ExerciseIn(BaseModel):
    name: str
    category: Category = Category.other
    default_unit: Unit = Unit.kg
    notes: str | None = None


class ExerciseUpdate(BaseModel):
    name: str | None = None
    category: Category | None = None
    default_unit: Unit | None = None
    notes: str | None = None


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: Category
    default_unit: Unit
    notes: str | None


class SetOut(BaseModel):
    id: int
    session_id: int
    exercise_id: int
    exercise: str
    set_order: int
    weight: float | None
    unit: Unit
    reps: int | None
    duration_seconds: int | None
    remark: str | None
    is_warmup: bool


class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    mode: RunMode
    duration_seconds: int | None
    distance_km: float | None
    incline_percent: float | None
    avg_hr: int | None
    max_hr: int | None
    structure: str | None
    remark: str | None


class SessionOut(BaseModel):
    id: int
    date: dt.date
    type: SessionType
    remark: str | None
    created_at: dt.datetime
    sets: list[SetOut]
    run: RunOut | None


class LogResult(BaseModel):
    session: SessionOut
    created_exercises: list[str] = Field(description="Exercises that did not exist and were created.")


class RoutineItemIn(BaseModel):
    exercise: str = Field(description='Exercise name, e.g. "Bench press". Created if it is new.')
    target_sets: int | None = Field(
        None, ge=1, le=20, description="How many sets to plan. Leave out to plan the same as last time."
    )


class RoutineIn(BaseModel):
    items: list[RoutineItemIn] = Field(
        description="The whole routine, in order. An empty list removes the saved routine, so that kind of "
        "session goes back to following its last session."
    )


class RoutineItemOut(BaseModel):
    exercise_id: int
    exercise: str
    position: int
    target_sets: int | None


class RoutineOut(BaseModel):
    type: SessionType
    saved: bool = Field(description="False means no routine is saved: `items` are just the last session of this type.")
    items: list[RoutineItemOut]


class HistorySet(SetOut):
    date: dt.date
    session_type: SessionType  # push, pull, upper... so callers can tell where the set was done
