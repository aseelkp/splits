# Splits: personal gym + running tracker

Monorepo: `backend/` (FastAPI, SQLAlchemy 2.0, Alembic, MCP) and `frontend/` (React + Vite PWA).
Product context is in `PRODUCT.md`. Deploys as one Vercel project (Services: frontend at `/`, FastAPI at `/api`).

## Rules

- **Every new table must enable Row Level Security in the same Alembic migration that creates it**
  (`ALTER TABLE <name> ENABLE ROW LEVEL SECURITY`, Postgres only, no policies). Supabase exposes
  `public` tables through its REST API otherwise. Also add the table to the list in the RLS migration
  pattern (see `backend/alembic/versions/*enable_row_level_security.py`).
- Schema changes go through Alembic migrations only, never by hand in the Supabase dashboard.
  Autogenerate against SQLite leaks SQLite-only defaults: review each migration and check
  Postgres SQL with `DATABASE_URL=postgresql://u:p@localhost/db uv run alembic upgrade head --sql`.
- Architecture: all business logic lives in the service layer. REST routes and MCP tools are thin
  adapters; no SQL or business logic in route handlers or MCP tools.
- Backend routes live under the `/api` prefix (Vercel forwards the original path).
- Never commit secrets. `.env` and `.claude/settings.local.json` are git-ignored; keep `.env.example` current.
- Dates and times use Asia/Kolkata. Units (kg/lbs) are stored per set and never converted.

## Commands (run from `backend/`)

- `uv run pytest` runs the tests
- `uv run alembic upgrade head` applies migrations (uses `DATABASE_URL` from `backend/.env`)
- `uv run alembic revision --autogenerate -m "msg"` creates a migration
