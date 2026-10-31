# History import: JSON format

`backend/scripts/import_history.py` loads one JSON file of past sessions into the database. This file
defines the format. `docs/import-example.json` is a small, made-up example (placeholder data, not real history).

## Shape

```json
{
  "version": 1,
  "default_unit": "kg",
  "exercises": [ { "name": "Bench press", "category": "push", "default_unit": "kg", "notes": null } ],
  "sessions": [
    {
      "date": "2026-10-24",
      "type": "push",
      "remark": "felt strong",
      "sets": [ { "exercise": "Bench press", "weight": 60, "unit": "kg", "reps": 10 } ],
      "run": { "mode": "indoor", "duration_seconds": 1210, "distance_km": 3.2 }
    }
  ]
}
```

Only `sessions` is required (and `version`, which must be `1`).

## Top level

| Field | Required | Meaning |
|---|---|---|
| `version` | yes | Always `1`. |
| `default_unit` | no | `"kg"` or `"lbs"`. The last fallback for a set's unit (see "Which unit a set gets"). It never converts anything. |
| `exercises` | no | Exercises to create up front, to give them a category, default unit or notes. Any exercise named in a set but missing here (and not already in the database) is created with category `other`. An exercise that already exists is left alone: its entry here is ignored (the dry run notes it if they disagree). |
| `sessions` | yes | List of sessions, in any order. |

## Exercise

| Field | Required | Values |
|---|---|---|
| `name` | yes | Matched case-insensitively with extra spaces ignored: "bench press" and "Bench press" are one exercise. |
| `category` | no | `push`, `pull`, `legs`, `core`, `other` (default `other`) |
| `default_unit` | no | `kg` or `lbs` (default `kg`) |
| `notes` | no | Free text |

## Session

| Field | Required | Values |
|---|---|---|
| `date` | yes | `YYYY-MM-DD` (Asia/Kolkata calendar date) |
| `type` | yes | `push`, `pull`, `lower`, `upper`, `run`, `other` |
| `remark` | no | Free text |
| `sets` | no | List of sets (empty or missing for a run-only session) |
| `run` | no | One run. A session can have sets and a run. |

**One session per date and type.** The import identifies a session by `date` plus `type`, so a file may not contain
two sessions with the same pair (the script stops and tells you which). Two different types on one day is fine.

## Set

Each entry is either one set, or shorthand that expands to several sets of one exercise.

One set:

| Field | Required | Values |
|---|---|---|
| `exercise` | yes | Exercise name |
| `weight` | no | Number (`62.5`). Leave out or `null` for bodyweight. |
| `unit` | no\* | `kg` or `lbs`. Stored on the set exactly as given, never converted. \*Left out, it is filled in by the priority below. Bodyweight sets never need one. |
| `reps` | one of | Whole number |
| `duration_seconds` | one of | Whole number, for planks and hangs |
| `remark` | no | Free text |
| `is_warmup` | no | `true` or `false` (default `false`) |

A set needs `reps` or `duration_seconds`.

Shorthand (same rules as the app and Claude): `"shorthand": "40x10, 62.5x2x8"` replaces `weight`/`reps`. `35x10` is one set,
`30x2x10` is two sets of 10, `bwx12` is bodyweight. It still needs `exercise`; the unit follows the same priority as any set
(and is not needed if every part is `bw`). `remark` and `is_warmup` apply to every set it expands to. Do not mix `shorthand`
with `weight`/`reps`/`duration_seconds`.

### Which unit a set gets

First one that exists wins:

1. the set's own `unit`
2. the exercise's `default_unit`: from the database if the exercise already exists, otherwise from the file's `exercises` list
3. the file's top-level `default_unit`

It is an error only if all three are missing **and** the set has a weight. A bodyweight set with no unit is stored with the
exercise's default unit (a unit is always saved, but it means nothing without a weight).

A brand-new exercise that is not in the `exercises` list gets, as its own default unit, the unit of its first set in the file.

Sets are numbered in the order they appear in the file.

## Run

| Field | Required | Values |
|---|---|---|
| `mode` | yes | `indoor` or `outdoor` |
| `duration_seconds` | no | Whole number |
| `distance_km` | no | Number |
| `incline_percent` | no | Number |
| `avg_hr`, `max_hr` | no | Whole numbers |
| `structure` | no | Text, e.g. `"5x(4 run/1 walk) at 8 km/h"` |
| `remark` | no | Free text |

These are exactly the columns of the `runs` table (the file uses the same model as the app and Claude), so every run field can be
imported. Anything not in this list is rejected as an unknown field, which catches typos.

## How the import behaves

- **Validated first, written second.** The whole file is checked before anything is saved. Every problem is listed with
  its location (for example `sessions[3].sets[1]: no unit for "Curl"...`), and if there is any problem nothing is written.
  Unknown fields are errors too, so a typo like `weihgt` is caught instead of silently dropped.
- **One database transaction.** All sessions (and new exercises) are saved together, or none are. If anything fails
  halfway (a bad row, a dropped connection) the database is rolled back to exactly how it was, so there is never a partial
  import to clean up or continue from. Just fix the problem and run the same command again.
- **Idempotent.** A session whose `date` + `type` already exists in the database is skipped, not changed and not duplicated.
  Running the same file twice creates nothing the second time.
- **`--replace`** (optional flag): instead of skipping, delete the existing session with that date and type and import the
  file's version. The delete and the re-insert are part of the same single transaction, so a failure leaves the old
  session untouched. Use it when you corrected something in the file.
- **`--dry-run`**: validates, then prints how many sessions would be created / skipped / replaced (one line each), and the
  full list of **new exercises** that would be created. Each new name that looks like an existing one (or another new
  one) is flagged, e.g. `"Lat pulldown" <- looks like: "Lat pull down"`, so you can fix near-duplicate names in the file
  before importing. Nothing is written.
- Exercises: listed ones are always created if missing. Others are created only if a session that will actually be written
  uses them (an exercise used only by skipped sessions is not created).
- Weights are stored in the unit you give. Nothing is ever converted between kg and lbs.
- `created_at` is the time of import. It is not part of the format.
