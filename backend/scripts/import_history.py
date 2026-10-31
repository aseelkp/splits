"""Import past sessions from a JSON file. Format: docs/import-format.md

    uv run python scripts/import_history.py history.json --dry-run   # look first, write nothing
    uv run python scripts/import_history.py history.json             # import
    uv run python scripts/import_history.py history.json --replace   # overwrite sessions that already exist

Uses DATABASE_URL from backend/.env. The whole import is one database transaction: every
session is saved, or (on any error) none are.

This file only handles the command line. The real work is in app/services/importer.py.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # so `import app` works from scripts/

from app.db import SessionLocal, engine  # noqa: E402
from app.services import importer  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Import past sessions from a JSON file.")
    ap.add_argument("file", type=Path)
    ap.add_argument("--dry-run", action="store_true", help="show what would happen, write nothing")
    ap.add_argument("--replace", action="store_true", help="replace sessions that already exist (same date + type)")
    args = ap.parse_args(argv)

    try:
        text = args.file.read_text(encoding="utf-8-sig")
    except OSError as e:
        print(f"Cannot read {args.file}: {e}", file=sys.stderr)
        return 2

    # Never print the connection string (it holds the password): just the kind of database.
    url = engine.url
    target = url.database if url.get_backend_name() == "sqlite" else f"{url.get_backend_name()} at {url.host}"
    print(f"Database: {target}")

    data, errors = importer.parse_file(text)
    if data is None:
        return _fail(errors)

    with SessionLocal() as db:
        plan = importer.build_plan(db, data, replace=args.replace)
        if plan.errors:
            return _fail(plan.errors)

        print("\n".join(importer.describe(plan, list_sessions=args.dry_run)))
        if args.dry_run:
            print("\nDry run: nothing was written.")
            return 0

        written = plan.count("create") + plan.count("replace")
        if not written and not plan.new_exercises:
            print("\nNothing to do: every session in the file already exists (use --replace to overwrite).")
            return 0
        importer.apply_plan(db, plan)
        print(f"\nDone. {written} sessions and {len(plan.new_exercises)} new exercises saved in one transaction.")
    return 0


def _fail(errors: list[str]) -> int:
    print(f"\n{len(errors)} problem(s) found. Nothing was written.", file=sys.stderr)
    for e in errors:
        print(f"  - {e}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
