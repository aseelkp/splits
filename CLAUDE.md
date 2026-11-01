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

## Frontend (run from `frontend/`)

- `npm run dev` starts Vite on 5173 and proxies `/api` to FastAPI on 8000 (set `API_TARGET=http://localhost:PORT` to use another backend port). Log in with `APP_PASSWORD` from `backend/.env`.
- `npm test` runs the unit tests (plate maths, shorthand parser, stats, dates). `npm run build` makes `dist/`.
- Weights are kg or lbs and are never converted. Anything that compares weights (deltas, PRs, charts, totals) must compare the same unit only; see `src/lib/units.js` and `src/lib/stats.js`.
- "Last time" follows the exercise, not the session type: weights pre-fill from an exercise's latest working sets in any session (`lastTime` in `src/lib/stats.js`), and a link offers the latest one from this type of session when it differs. Which exercises a session starts with comes from the saved routine for that type (`routine_items`, edited in Settings), or, if none is saved, from the last session of that type.
- The in-progress session is a draft in localStorage (`src/store/draft.js`). Logged sets live on the server. The draft is only cleared by the Summary screen opening (or by `finish()` when nothing was saved): clearing it earlier trips the route guard and bounces you home.
- Design context: `PRODUCT.md`, the direction contract in `.impeccable/surfaces/`, and `DESIGN.md` once written.
