import re

import pytest
from fastapi.testclient import TestClient

from app import auth
from app.config import Settings
from app.db import get_db
from app.main import app

PASSWORD = "correct horse"
OPEN_PATHS = {"/api/health", "/api/docs", "/api/openapi.json", "/api/auth/login", "/api/auth/logout", "/api/auth/me"}


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(auth, "get_settings", lambda: Settings(app_password=PASSWORD, session_secret="test-secret"))


@pytest.fixture
def client(db, configured):
    app.dependency_overrides[get_db] = lambda: db
    # https base URL: the session cookie is marked Secure, so it is only sent back over https.
    with TestClient(app, base_url="https://testserver") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def api(client):
    assert client.post("/api/auth/login", json={"password": PASSWORD}).status_code == 200
    return client


def make_session(api, **overrides):
    body = {"date": "2026-10-01", "type": "push", "sets": [{"exercise": "Bench press", "shorthand": "60x2x10"}]}
    r = api.post("/api/sessions", json={**body, **overrides})
    assert r.status_code == 201, r.text
    return r.json()


# ---------- auth ----------


def test_every_route_requires_login_except_the_open_ones(client):
    # The OpenAPI schema lists every path and method, however the routers are nested.
    checked = 0
    for path, methods in app.openapi()["paths"].items():
        if path in OPEN_PATHS:
            continue
        for method in methods:
            url = re.sub(r"\{\w+\}", "1", path)
            r = client.request(method.upper(), url, json={})
            assert r.status_code == 401, f"{method.upper()} {path} is not protected"
            checked += 1
    assert checked >= 15  # guards against this test silently checking nothing


def test_health_is_public(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_login_logout_and_me(client):
    assert client.get("/api/auth/me").json() == {"authenticated": False}
    assert client.post("/api/auth/login", json={"password": "nope"}).status_code == 401
    assert client.get("/api/sessions").status_code == 401

    r = client.post("/api/auth/login", json={"password": PASSWORD})
    assert r.status_code == 200
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "secure" in cookie and "samesite=lax" in cookie

    assert client.get("/api/auth/me").json() == {"authenticated": True}
    assert client.get("/api/sessions").status_code == 200
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/sessions").status_code == 401


def test_forged_cookie_is_rejected(client):
    client.cookies.set("splits_session", "eyJhdXRoIjogdHJ1ZX0=.abc.def")
    assert client.get("/api/sessions").status_code == 401


def test_login_fails_closed_when_not_configured(db, monkeypatch):
    monkeypatch.setattr(auth, "get_settings", lambda: Settings(app_password="", session_secret=""))
    with TestClient(app, base_url="https://testserver") as c:
        assert c.post("/api/auth/login", json={"password": ""}).status_code == 503


# ---------- sessions ----------


def test_session_lifecycle(api):
    created = make_session(api, remark="felt good", run={"mode": "indoor", "distance_km": 2.5})
    sid = created["session"]["id"]
    assert created["created_exercises"] == ["Bench press"]
    assert [(s["weight"], s["reps"], s["unit"]) for s in created["session"]["sets"]] == [(60, 10, "kg")] * 2
    assert created["session"]["run"]["distance_km"] == 2.5

    assert api.get(f"/api/sessions/{sid}").json()["remark"] == "felt good"
    assert [s["id"] for s in api.get("/api/sessions?limit=5").json()] == [sid]

    patched = api.patch(f"/api/sessions/{sid}", json={"remark": "great"}).json()
    assert patched["remark"] == "great" and patched["type"] == "push"

    run = api.put(f"/api/sessions/{sid}/run", json={"mode": "outdoor", "distance_km": 5}).json()
    assert run["mode"] == "outdoor" and run["distance_km"] == 5

    assert api.delete(f"/api/sessions/{sid}").status_code == 204
    assert api.get(f"/api/sessions/{sid}").status_code == 404


def test_last_session_by_type_and_null_when_none(api):
    assert api.get("/api/sessions/last?type=push").json() is None
    make_session(api, date="2026-10-01")
    newest = make_session(api, date="2026-10-08")["session"]["id"]
    make_session(api, date="2026-10-09", type="pull")
    last = api.get("/api/sessions/last?type=push").json()
    assert last["id"] == newest and len(last["sets"]) == 2
    assert api.get("/api/sessions/last?type=bogus").status_code == 422


def test_add_update_and_delete_sets(api):
    sid = make_session(api)["session"]["id"]
    added = api.post(f"/api/sessions/{sid}/sets", json=[{"exercise": "Row", "weight": 50, "reps": 8}]).json()
    assert [s["set_order"] for s in added["session"]["sets"]] == [1, 2, 3]
    set_id = added["session"]["sets"][0]["id"]

    assert api.patch(f"/api/sets/{set_id}", json={"weight": 62.5}).json()["weight"] == 62.5
    assert api.delete(f"/api/sets/{set_id}").status_code == 204
    assert len(api.get(f"/api/sessions/{sid}").json()["sets"]) == 2
    assert api.delete(f"/api/sets/{set_id}").status_code == 404


def test_errors_map_to_http_statuses_with_helpful_messages(api):
    missing = api.get("/api/sessions/999")
    assert missing.status_code == 404 and "get_recent_sessions" in missing.json()["detail"]

    bad = api.post("/api/sessions", json={"type": "push", "sets": [{"exercise": "Bench", "shorthand": "oops"}]})
    assert bad.status_code == 422 and "Could not read" in bad.json()["detail"]

    no_reps = api.post("/api/sessions", json={"type": "push", "sets": [{"exercise": "Bench", "weight": 50}]})
    assert no_reps.status_code == 422

    assert api.get("/api/sessions?limit=0").status_code == 422


# ---------- exercises ----------


def test_exercise_crud_and_history(api):
    ex = api.post("/api/exercises", json={"name": "Deadlift", "category": "pull", "default_unit": "lbs"})
    assert ex.status_code == 201
    ex_id = ex.json()["id"]
    assert api.post("/api/exercises", json={"name": "deadlift"}).status_code == 409

    assert api.patch(f"/api/exercises/{ex_id}", json={"notes": "conventional"}).json()["notes"] == "conventional"
    assert [e["name"] for e in api.get("/api/exercises").json()] == ["Deadlift"]

    make_session(api, date="2026-10-01", sets=[{"exercise": "Deadlift", "shorthand": "100x5"}])
    make_session(api, date="2026-10-08", sets=[{"exercise": "Deadlift", "shorthand": "110x5"}])
    history = api.get(f"/api/exercises/{ex_id}/history").json()
    assert [(h["date"], h["weight"], h["unit"]) for h in history] == [("2026-10-08", 110, "lbs"), ("2026-10-01", 100, "lbs")]

    assert api.delete(f"/api/exercises/{ex_id}").status_code == 409
    assert api.get("/api/exercises/999/history").status_code == 404
