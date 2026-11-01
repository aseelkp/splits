import os
import subprocess
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app import mcp_server
from app.main import app

SECRET = os.environ["MCP_SECRET"]
URL = f"/mcp/{SECRET}"
HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}
TOOLS = {
    "log_session",
    "get_recent_sessions",
    "get_last_session",
    "get_exercise_history",
    "list_exercises",
    "update_set",
    "delete_set",
    "delete_session",
    "get_routine",
    "set_routine",
}


@pytest.fixture
def client(db, monkeypatch):
    # Tools open their own DB session; point them at the test database.
    monkeypatch.setattr(mcp_server, "SessionLocal", sessionmaker(bind=db.get_bind(), expire_on_commit=False))
    with TestClient(app) as c:
        yield c


def rpc(client, method, params=None, id=1):
    r = client.post(URL, headers=HEADERS, json={"jsonrpc": "2.0", "id": id, "method": method, "params": params or {}})
    assert r.status_code == 200, r.text
    return r.json()


def call(client, tool, **arguments):
    """Call a tool; returns (is_error, structured_content, text)."""
    body = rpc(client, "tools/call", {"name": tool, "arguments": arguments})
    result = body["result"]
    return result.get("isError", False), result.get("structuredContent"), result["content"][0]["text"]


def log(client, **kw):
    args = {"type": "push", "date": "2026-10-01", "sets": [{"exercise": "Bench press", "shorthand": "60x2x10"}], **kw}
    is_error, data, text = call(client, "log_session", **args)
    assert not is_error, text
    return data


# ---------- the secret path ----------


@pytest.mark.parametrize("path", ["/mcp", "/mcp/", "/mcp/wrong-secret", f"{URL}/extra", "/", "/nothing", "/mcp/" + SECRET[:-1]])
def test_any_other_path_is_404(client, path):
    for method in ("GET", "POST"):
        assert client.request(method, path, headers=HEADERS, json={}).status_code == 404, f"{method} {path}"


def test_api_routes_are_not_shadowed_by_the_mcp_mount(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/api/sessions").status_code == 401  # still needs the login cookie


def test_mcp_is_disabled_when_secret_is_missing_or_short():
    for secret in ("", "short"):
        out = subprocess.run(
            [sys.executable, "-c", "from app.main import mcp_gateway; print(mcp_gateway is None)"],
            env={**os.environ, "MCP_SECRET": secret},
            capture_output=True,
            text=True,
        )
        assert out.stdout.strip() == "True", out.stderr


# ---------- tool catalog ----------


def test_lists_exactly_the_planned_tools_with_descriptions_and_hints(client):
    tools = {t["name"]: t for t in rpc(client, "tools/list")["result"]["tools"]}
    assert set(tools) == TOOLS
    for name, tool in tools.items():
        assert len(tool["description"]) > 100, f"{name} needs a real description"
        assert tool["inputSchema"]["type"] == "object"
    for name in ("get_recent_sessions", "get_last_session", "get_exercise_history", "list_exercises"):
        assert tools[name]["annotations"]["readOnlyHint"] is True
    for name in ("delete_set", "delete_session"):
        assert tools[name]["annotations"]["destructiveHint"] is True
    assert "shorthand" in str(tools["log_session"]["inputSchema"])


# ---------- using the tools ----------


def test_log_session_returns_ids_units_dates_and_created_exercises(client):
    data = log(client, run={"mode": "indoor", "distance_km": 2.5, "structure": "5x(4 run/1 walk) at 8 km/h"})
    session = data["session"]
    assert session["date"] == "2026-10-01" and session["type"] == "push" and session["id"]
    assert [(s["weight"], s["reps"], s["unit"]) for s in session["sets"]] == [(60, 10, "kg")] * 2
    assert all(s["id"] for s in session["sets"])
    assert session["run"]["distance_km"] == 2.5
    assert data["created_exercises"] == ["Bench press"]
    assert log(client)["created_exercises"] == []


def test_read_tools(client):
    first = log(client, date="2026-10-01")["session"]["id"]
    second = log(client, date="2026-10-08")["session"]["id"]

    _, recent, _ = call(client, "get_recent_sessions", limit=1)
    assert [s["id"] for s in recent["sessions"]] == [second]

    _, last, _ = call(client, "get_last_session", type="push")
    assert last["session"]["id"] == second and last["session"]["id"] != first

    _, none, _ = call(client, "get_last_session", type="pull")
    assert none["session"] is None and "pull" in none["note"]

    _, history, _ = call(client, "get_exercise_history", exercise="bench press", limit=3)
    assert history["exercise"] == "Bench press"
    assert [(h["date"], h["weight"], h["unit"]) for h in history["sets"]] == [("2026-10-08", 60, "kg")] * 2 + [("2026-10-01", 60, "kg")]

    _, names, _ = call(client, "list_exercises")
    assert [e["name"] for e in names["exercises"]] == ["Bench press"]


def test_correct_and_delete_with_ids_from_the_result(client):
    session = log(client)["session"]
    set_id = session["sets"][0]["id"]

    is_error, updated, _ = call(client, "update_set", set_id=set_id, changes={"weight": 62.5, "remark": "easy"})
    assert not is_error and updated["weight"] == 62.5 and updated["remark"] == "easy" and updated["reps"] == 10

    is_error, deleted, _ = call(client, "delete_set", set_id=set_id)
    assert not is_error and deleted["id"] == set_id and deleted["weight"] == 62.5

    is_error, gone, _ = call(client, "delete_session", session_id=session["id"])
    assert not is_error and gone["id"] == session["id"] and len(gone["sets"]) == 1

    _, recent, _ = call(client, "get_recent_sessions")
    assert recent["sessions"] == []


# ---------- errors Claude can act on ----------


def test_errors_are_tool_errors_that_say_how_to_fix_the_call(client):
    is_error, _, text = call(client, "log_session", type="push", sets=[{"exercise": "Bench press", "shorthand": "oops"}])
    assert is_error and "Bench press" in text and '"oops"' in text and "30x2x10" in text

    is_error, _, text = call(client, "log_session", type="push", date="31/10/2026")
    assert is_error and "YYYY-MM-DD" in text

    is_error, _, text = call(client, "delete_session", session_id=999)
    assert is_error and "get_recent_sessions" in text

    is_error, _, text = call(client, "get_exercise_history", exercise="Nope")
    assert is_error and "list_exercises" in text

    is_error, _, text = call(client, "update_set", set_id=999, changes={"reps": 5})
    assert is_error and "No set with id 999" in text


def test_failed_log_session_saves_nothing(client):
    call(client, "log_session", type="push", sets=[
        {"exercise": "Bench press", "shorthand": "60x10"},
        {"exercise": "Row", "shorthand": "oops"},
    ])
    _, recent, _ = call(client, "get_recent_sessions")
    assert recent["sessions"] == []


def test_routine_tools_read_and_replace_the_plan(client):
    log(client, type="upper", sets=[{"exercise": "Bench press", "shorthand": "60x10"}, {"exercise": "Row", "shorthand": "40x10"}])

    is_error, data, text = call(client, "get_routine", type="upper")
    assert not is_error, text
    assert data["saved"] is False and [i["exercise"] for i in data["items"]] == ["Bench press", "Row"]  # follows the last session

    is_error, data, text = call(client, "set_routine", type="upper", request={"items": [{"exercise": "Row", "target_sets": 4}, {"exercise": "Curl"}]})
    assert not is_error, text
    assert data["saved"] is True
    assert [(i["exercise"], i["position"], i["target_sets"]) for i in data["items"]] == [("Row", 1, 4), ("Curl", 2, None)]

    is_error, data, _ = call(client, "set_routine", type="upper", request={"items": []})  # empty list = remove it
    assert not is_error and data["saved"] is False

    is_error, _, text = call(client, "set_routine", type="run", request={"items": [{"exercise": "Row"}]})
    assert is_error and "no routine" in text
    is_error, _, text = call(client, "set_routine", type="push", request={"items": [{"exercise": "Row"}, {"exercise": "row"}]})
    assert is_error and "more than once" in text
