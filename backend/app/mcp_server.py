"""MCP tools for Claude. Thin adapter over the service layer, like the REST routers.

Tool design follows .claude/skills/tool-design: verb_noun names, descriptions that say what the
tool does / when to use it / what it returns, constrained parameters with examples, and errors
that say how to fix the call.
"""

import datetime as dt
from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager, contextmanager
from typing import Annotated

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from starlette.responses import PlainTextResponse
from starlette.types import Receive, Scope, Send

from app.db import SessionLocal
from app.models import SessionType
from app.schemas import (
    ExerciseOut,
    HistorySet,
    LogResult,
    RoutineIn,
    RoutineOut,
    RunIn,
    SessionIn,
    SessionOut,
    SetIn,
    SetOut,
    SetUpdate,
)
from app.services import exercises, routines, workouts
from app.services.errors import ServiceError

INSTRUCTIONS = """\
Personal gym and running logbook (single user). Dates are Asia/Kolkata. Weights keep the unit they \
were logged in (kg or lbs) and are never converted.

Workflow: to record a workout call log_session once. Read the result: it lists every set with its \
id, unit and date, and says which exercises were newly created. If something is wrong, fix it with \
update_set, delete_set or delete_session using the ids from the result, rather than logging again. \
To compare with history use get_last_session or get_exercise_history. Call list_exercises first if \
you are unsure of the exact exercise names, so you reuse them instead of creating near-duplicates. \
A routine is the planned exercise list for a kind of session (push, pull, ...): read it with \
get_routine and change it with set_routine.\
"""

mcp = MCPServer("Splits", instructions=INSTRUCTIONS)

READ_ONLY = ToolAnnotations(read_only_hint=True)


@contextmanager
def _db() -> Iterator[Session]:
    """One database session per tool call. Service errors become tool errors Claude can act on."""
    with SessionLocal() as db:
        try:
            yield db
        except ServiceError as e:
            raise ToolError(str(e)) from e


# Lists are returned inside a named object: an empty bare list produces no text content at all,
# which would look like a blank answer to Claude.
class SessionList(BaseModel):
    sessions: list[SessionOut]


class ExerciseHistory(BaseModel):
    exercise: str
    sets: list[HistorySet] = Field(description="Newest first. Empty if the exercise has no logged sets yet.")


class ExerciseList(BaseModel):
    exercises: list[ExerciseOut]


class LastSession(BaseModel):
    session: SessionOut | None = Field(description="The most recent session of that type, or null if none exists.")
    note: str


@mcp.tool(annotations=ToolAnnotations(destructive_hint=False, idempotent_hint=False))
def log_session(
    type: Annotated[SessionType, Field(description="push, pull, lower, upper, run or other.")],
    sets: Annotated[
        list[SetIn],
        Field(
            description="Sets in the order performed. Each needs an exercise name plus either `shorthand` "
            'or reps/duration_seconds. Example: [{"exercise": "Bench press", "shorthand": "60x2x10"}, '
            '{"exercise": "Plank", "duration_seconds": 60}]. Leave empty for a run-only session.'
        ),
    ] = [],
    date: Annotated[
        str | None, Field(description="YYYY-MM-DD, e.g. 2026-10-31. Defaults to today (Asia/Kolkata).")
    ] = None,
    remark: Annotated[str | None, Field(description="Free-text note about the whole session.")] = None,
    run: Annotated[RunIn | None, Field(description="Optional run (treadmill or outdoor) done in this session.")] = None,
) -> LogResult:
    """Record one workout: a gym session, a run, or both together (e.g. push day plus a treadmill run).

    Use when the user says what they did in the gym or on a run. Call it once per workout.

    Shorthand per exercise: "35x10" = weight 35, 10 reps (1 set); "30x2x10" = weight 30, 2 sets of 10;
    "40x10, 80x12, 90x2x10" = several sets in order; "bwx12" = bodyweight, 12 reps. Weight is in `unit`
    (default: that exercise's usual unit). Unknown exercise names are created automatically.

    Returns the saved session: id, date, type, every set (id, exercise, weight, unit, reps) and the run,
    plus `created_exercises` listing any exercises that did not exist before. Check it against what
    the user said. Not idempotent: calling twice creates two sessions, so before retrying after an
    error or timeout check get_recent_sessions. Errors name the exercise and the part that could not
    be read (for example a bad shorthand) so you can correct it and call again.
    """
    try:
        parsed_date = dt.date.fromisoformat(date) if date else None
    except ValueError as e:
        raise ToolError(f'date "{date}" is not valid. Use YYYY-MM-DD, for example 2026-10-31.') from e
    with _db() as db:
        return workouts.create_session(db, SessionIn(date=parsed_date, type=type, remark=remark, sets=sets, run=run))


@mcp.tool(annotations=READ_ONLY)
def get_recent_sessions(
    limit: Annotated[int, Field(ge=1, le=30, description="How many sessions to return, newest first.")] = 5,
) -> SessionList:
    """List the most recent sessions, newest first, each with all its sets and run.

    Use to see what was logged lately, to find a session or set id before correcting it, or to check
    whether a workout was already logged before retrying log_session. For the latest session of one
    type use get_last_session; for one exercise over time use get_exercise_history.

    Returns `sessions`: a list (id, date, type, remark, sets with ids and units, run), possibly empty.
    """
    with _db() as db:
        return SessionList(sessions=workouts.list_recent_sessions(db, limit))


@mcp.tool(annotations=READ_ONLY)
def get_last_session(
    type: Annotated[SessionType, Field(description="push, pull, lower, upper, run or other.")],
) -> LastSession:
    """Get the most recent session of one type, to compare today's numbers with last time.

    Use when the user asks what they did last push/pull/lower day, or wants to beat last time.

    Returns `session` (id, date, type, sets with ids, weights and units, run) or null with a note
    if no session of that type exists yet.
    """
    with _db() as db:
        found = workouts.get_last_session(db, type)
    return LastSession(session=found, note=f"No {type.value} session has been logged yet." if not found else "")


@mcp.tool(annotations=READ_ONLY)
def get_exercise_history(
    exercise: Annotated[str, Field(description='Exercise name, case-insensitive, e.g. "Bench press".')],
    limit: Annotated[int, Field(ge=1, le=200, description="Maximum number of sets, newest first.")] = 20,
) -> ExerciseHistory:
    """Get logged sets of one exercise over time, newest first, to show progress.

    Use when the user asks how an exercise is progressing, what their best or last weight was, or
    how many reps they did. Warm-up sets are included and flagged with is_warmup.

    Returns `exercise` (canonical name) and `sets` with date, session_id, set id, weight, unit, reps,
    duration_seconds and remark. Fails if the exercise does not exist; call list_exercises then.
    """
    with _db() as db:
        sets = exercises.get_exercise_history(db, exercise, limit)
        return ExerciseHistory(exercise=exercises.find_exercise(db, exercise).name, sets=sets)


@mcp.tool(annotations=READ_ONLY)
def list_exercises() -> ExerciseList:
    """List every known exercise with its id, category, default unit and notes, sorted by name.

    Use before logging when unsure of exact names, so you reuse "Bench press" instead of creating
    "Barbell bench". Returns `exercises`: a list, possibly empty.
    """
    with _db() as db:
        return ExerciseList(exercises=exercises.list_exercises(db))


@mcp.tool(annotations=ToolAnnotations(destructive_hint=True, idempotent_hint=True))
def update_set(
    set_id: Annotated[int, Field(description="Id of the set, from log_session, get_recent_sessions or get_last_session.")],
    changes: Annotated[
        SetUpdate,
        Field(
            description='Only the fields to change, e.g. {"weight": 62.5} or {"reps": 8, "remark": "easy"}. '
            "Omitted fields stay as they are. Send null to clear weight, reps, duration_seconds or remark."
        ),
    ],
) -> SetOut:
    """Correct one logged set (weight, unit, reps, duration, remark or warm-up flag).

    Use to fix a typo or a wrong number in an existing set. Changing `unit` only relabels the
    set; the weight is NOT converted, so also send the right weight if the unit was wrong.

    Returns the updated set. Fails if set_id does not exist.
    """
    with _db() as db:
        return workouts.update_set(db, set_id, changes)


@mcp.tool(annotations=ToolAnnotations(destructive_hint=True, idempotent_hint=False))
def delete_set(
    set_id: Annotated[int, Field(description="Id of the set, from log_session, get_recent_sessions or get_last_session.")],
) -> SetOut:
    """Permanently delete one logged set. Cannot be undone.

    Use to remove a set that was logged by mistake. To remove a whole workout use delete_session.

    Returns the set that was deleted, so you can confirm it was the right one. Fails if set_id does
    not exist (it may already be deleted).
    """
    with _db() as db:
        return workouts.delete_set(db, set_id)


@mcp.tool(annotations=ToolAnnotations(destructive_hint=True, idempotent_hint=False))
def delete_session(
    session_id: Annotated[int, Field(description="Id of the session, from log_session or get_recent_sessions.")],
) -> SessionOut:
    """Permanently delete a whole session including all its sets and its run. Cannot be undone.

    Use to remove a workout that was logged by mistake or twice. Exercises themselves are kept.
    Confirm with the user first if they did not explicitly ask for the deletion.

    Returns the session that was deleted (with its sets), so you can confirm it was the right one.
    Fails if session_id does not exist (it may already be deleted).
    """
    with _db() as db:
        return workouts.delete_session(db, session_id)


@mcp.tool(annotations=READ_ONLY)
def get_routine(
    type: Annotated[SessionType, Field(description="push, pull, lower, upper or other. Runs have no routine.")],
) -> RoutineOut:
    """Get the planned exercise list (the routine) for one kind of session, in order.

    Use when the user asks what is in their push/pull/lower/upper routine, or before changing it
    so you keep what they did not ask to remove.

    Returns `type`, `saved` and `items` (exercise, position, target_sets). `saved` false means no routine
    has been saved yet: `items` are then simply the exercises of the last session of that type, and
    target_sets is null. target_sets null means "plan the same number of sets as last time".
    """
    with _db() as db:
        return routines.get_routine(db, type)


@mcp.tool(annotations=ToolAnnotations(destructive_hint=True, idempotent_hint=True))
def set_routine(
    type: Annotated[SessionType, Field(description="push, pull, lower, upper or other. Runs have no routine.")],
    request: Annotated[
        RoutineIn,
        Field(
            description='The WHOLE routine in order, e.g. {"items": [{"exercise": "Bench press", "target_sets": 3}, '
            '{"exercise": "Row"}]}. target_sets is optional. An empty list removes the saved routine, so that '
            "kind of session goes back to following its last session."
        ),
    ],
) -> RoutineOut:
    """Replace the routine for one kind of session: which exercises it starts with, in what order.

    Use when the user wants to add, remove, reorder or re-plan exercises for a kind of session, for
    example "move incline press from push to upper". It REPLACES the whole list, so call get_routine
    first and send the full list with your change applied. Unknown exercise names are created; call
    list_exercises first to reuse existing names. This only changes the plan for future sessions: it
    never edits logged sets.

    Returns the saved routine (same shape as get_routine). Fails if an exercise is listed twice.
    """
    with _db() as db:
        return routines.set_routine(db, type, request)


class McpGateway:
    """ASGI app mounted at "/" after the API routes. It serves the MCP endpoint at /mcp/<secret>.

    A fresh MCP app is built each time FastAPI starts (the SDK's session manager can only be
    started once). Every other path gets a plain 404.
    """

    def __init__(self, secret: str):
        self.secret = secret
        self._app = None

    @asynccontextmanager
    async def lifespan(self) -> AsyncIterator[None]:
        app = mcp.streamable_http_app(
            streamable_http_path=f"/mcp/{self.secret}",
            # Stateless + plain JSON: every request stands alone, which is what serverless needs.
            stateless_http=True,
            json_response=True,
            # DNS-rebinding protection is for servers on localhost. This one is public and its
            # guard is the secret in the path, so allow any Host header.
            transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
        )
        self._app = app
        try:
            async with mcp.session_manager.run():
                yield
        finally:
            self._app = None

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if self._app is None or scope["type"] != "http":
            await PlainTextResponse("Not Found", status_code=404)(scope, receive, send)
            return
        await self._app(scope, receive, send)
