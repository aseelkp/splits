import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    false,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Unit(enum.StrEnum):
    kg = "kg"
    lbs = "lbs"


class Category(enum.StrEnum):
    push = "push"
    pull = "pull"
    legs = "legs"
    core = "core"
    other = "other"


class SessionType(enum.StrEnum):
    push = "push"
    pull = "pull"
    lower = "lower"
    upper = "upper"
    run = "run"
    other = "other"


class RunMode(enum.StrEnum):
    indoor = "indoor"
    outdoor = "outdoor"


def _enum(e: type[enum.Enum], name: str) -> Enum:
    # Stored as plain text plus a CHECK constraint (not a native Postgres ENUM),
    # so adding a value later is a simple migration.
    return Enum(e, native_enum=False, create_constraint=True, length=16, validate_strings=True, name=name)


class Base(DeclarativeBase):
    pass


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    category: Mapped[Category] = mapped_column(_enum(Category, "ck_exercises_category"), default=Category.other)
    default_unit: Mapped[Unit] = mapped_column(_enum(Unit, "ck_exercises_default_unit"), default=Unit.kg)
    notes: Mapped[str | None] = mapped_column(Text)


class WorkoutSession(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    type: Mapped[SessionType] = mapped_column(_enum(SessionType, "ck_sessions_type"))
    remark: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sets: Mapped[list["ExerciseSet"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ExerciseSet.set_order",
    )
    run: Mapped["Run | None"] = relationship(
        back_populates="session", cascade="all, delete-orphan", uselist=False
    )


class ExerciseSet(Base):
    """One row per set. Named ExerciseSet because `Set` is a Python builtin type."""

    __tablename__ = "sets"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"), index=True)
    set_order: Mapped[int] = mapped_column(Integer)
    weight: Mapped[Decimal | None] = mapped_column(Numeric(7, 2))  # null = bodyweight
    unit: Mapped[Unit] = mapped_column(_enum(Unit, "ck_sets_unit"))
    reps: Mapped[int | None] = mapped_column(Integer)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)  # planks, hangs
    remark: Mapped[str | None] = mapped_column(Text)
    is_warmup: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())

    session: Mapped[WorkoutSession] = relationship(back_populates="sets")
    exercise: Mapped[Exercise] = relationship()


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    # unique => at most one run per session
    session_id: Mapped[int] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), unique=True
    )
    mode: Mapped[RunMode] = mapped_column(_enum(RunMode, "ck_runs_mode"))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    distance_km: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    incline_percent: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    avg_hr: Mapped[int | None] = mapped_column(Integer)
    max_hr: Mapped[int | None] = mapped_column(Integer)
    structure: Mapped[str | None] = mapped_column(Text)  # e.g. "5x(4 run/1 walk) at 8 km/h"
    remark: Mapped[str | None] = mapped_column(Text)

    session: Mapped[WorkoutSession] = relationship(back_populates="run")
