import pytest
from sqlalchemy import func, select

from app.models import Exercise, RoutineItem, SessionType
from app.schemas import ExerciseIn, RoutineIn, RoutineItemIn, SessionIn, SetIn
from app.services import exercises, routines, workouts
from app.services.errors import InvalidInputError
from tests.test_api import api, client, configured  # noqa: F401  (pytest fixtures)


def log(db, type="upper", date="2026-10-01", **sets):
    items = [SetIn(exercise=name, shorthand=sh) for name, sh in sets.items()]
    return workouts.create_session(db, SessionIn(date=date, type=type, sets=items))


def routine(*items):
    return RoutineIn(items=[RoutineItemIn(exercise=n, target_sets=t) for n, t in items])


def names(r):
    return [i.exercise for i in r.items]


def count(db, model):
    return db.scalar(select(func.count()).select_from(model))


# ---- no saved routine: follow the last session ----


def test_without_a_saved_routine_it_follows_the_last_session_of_that_type(db):
    log(db, "push", "2026-10-01", **{"Bench press": "60x10", "Overhead press": "40x8"})
    log(db, "push", "2026-10-08", **{"Bench press": "62.5x3x8", "Incline press": "24x10"})
    log(db, "upper", "2026-10-09", **{"Row": "40x10"})
    r = routines.get_routine(db, SessionType.push)
    assert r.saved is False and names(r) == ["Bench press", "Incline press"]  # newest push, first-seen order
    assert [i.target_sets for i in r.items] == [None, None]
    assert names(routines.get_routine(db, SessionType.upper)) == ["Row"]
    assert routines.get_routine(db, SessionType.lower).items == []


# ---- saving, order, replacing ----


def test_set_routine_saves_in_order_and_creates_new_exercises(db):
    exercises.create_exercise(db, ExerciseIn(name="Bench press"))
    r = routines.set_routine(db, SessionType.upper, routine(("Row", 4), ("bench press", None), ("Curl", 3)))
    assert r.saved is True
    assert [(i.exercise, i.position, i.target_sets) for i in r.items] == [("Row", 1, 4), ("Bench press", 2, None), ("Curl", 3, 3)]
    assert count(db, Exercise) == 3  # Row and Curl were created, bench was reused


def test_set_routine_replaces_the_whole_list_and_a_saved_one_beats_the_last_session(db):
    log(db, "upper", **{"Bench press": "60x10", "Row": "40x10"})
    routines.set_routine(db, SessionType.upper, routine(("Row", None), ("Curl", None)))
    r = routines.set_routine(db, SessionType.upper, routine(("Curl", 2), ("Row", 5)))  # same exercises, new order
    assert [(i.exercise, i.target_sets) for i in r.items] == [("Curl", 2), ("Row", 5)]
    assert count(db, RoutineItem) == 2
    assert "Bench press" not in names(routines.get_routine(db, SessionType.upper))  # the last session no longer matters


def test_the_same_exercise_can_be_in_two_routines(db):
    routines.set_routine(db, SessionType.push, routine(("Incline press", 3)))
    routines.set_routine(db, SessionType.upper, routine(("Incline press", 4)))
    assert routines.get_routine(db, SessionType.push).items[0].target_sets == 3
    assert routines.get_routine(db, SessionType.upper).items[0].target_sets == 4


def test_an_empty_list_removes_the_saved_routine(db):
    log(db, "push", **{"Bench press": "60x10"})
    routines.set_routine(db, SessionType.push, routine(("Curl", 3)))
    r = routines.set_routine(db, SessionType.push, RoutineIn(items=[]))
    assert r.saved is False and names(r) == ["Bench press"]  # back to following the last session
    assert count(db, RoutineItem) == 0


# ---- rules ----


def test_duplicates_blank_names_and_runs_are_rejected(db):
    with pytest.raises(InvalidInputError, match="more than once"):
        routines.set_routine(db, SessionType.push, routine(("Row", None), ("  row ", None)))
    with pytest.raises(InvalidInputError, match="cannot be empty"):
        routines.set_routine(db, SessionType.push, routine(("   ", None)))
    with pytest.raises(InvalidInputError, match="no routine"):
        routines.set_routine(db, SessionType.run, routine(("Row", None)))
    with pytest.raises(InvalidInputError, match="no routine"):
        routines.get_routine(db, SessionType.run)
    assert count(db, RoutineItem) == 0  # nothing half-saved


def test_deleting_an_exercise_takes_it_out_of_routines(db):
    routines.set_routine(db, SessionType.push, routine(("Curl", 3), ("Row", 3)))
    exercises.delete_exercise(db, exercises.find_exercise(db, "Curl").id)
    assert names(routines.get_routine(db, SessionType.push)) == ["Row"]


def test_list_routines_covers_every_type_but_runs(db):
    got = [r.type for r in routines.list_routines(db)]
    assert got == [SessionType.push, SessionType.pull, SessionType.lower, SessionType.upper, SessionType.other]


# ---- HTTP ----


def test_http_get_put_and_validation(api):
    api.post("/api/sessions", json={"date": "2026-10-01", "type": "pull", "sets": [{"exercise": "Row", "shorthand": "40x10"}]})
    r = api.get("/api/routines/pull").json()
    assert r["saved"] is False and [i["exercise"] for i in r["items"]] == ["Row"]

    saved = api.put("/api/routines/pull", json={"items": [{"exercise": "Lat pulldown", "target_sets": 3}, {"exercise": "Row"}]})
    assert saved.status_code == 200
    assert [(i["exercise"], i["target_sets"]) for i in saved.json()["items"]] == [("Lat pulldown", 3), ("Row", None)]
    assert api.get("/api/routines").json()[1]["saved"] is True  # pull is second in the list

    assert api.put("/api/routines/pull", json={"items": [{"exercise": "Row", "target_sets": 0}]}).status_code == 422
    assert api.put("/api/routines/pull", json={"items": [{"exercise": "Row"}, {"exercise": "row"}]}).status_code == 422
    assert api.put("/api/routines/run", json={"items": []}).status_code == 422
    assert api.get("/api/routines/legs").status_code == 422


def test_http_routines_need_login(client):
    assert client.get("/api/routines").status_code == 401
    assert client.put("/api/routines/push", json={"items": []}).status_code == 401
