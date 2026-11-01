# Splits

A personal gym and running tracker for one person. Log sets from your phone (or by asking Claude), see your
history and personal records, and keep it all on free hosting.

- **Backend** (`backend/`): Python, FastAPI, SQLAlchemy 2.0, Alembic, Postgres on Supabase. It also serves an
  [MCP](https://modelcontextprotocol.io) endpoint so Claude can log and read workouts.
- **Frontend** (`frontend/`): React + Vite installable web app (PWA).
- **Deploy**: one Vercel project. The frontend is served at `/`, FastAPI at `/api` and `/mcp`.

Weights are kg or lbs and are stored exactly as you log them. Nothing is ever converted. Dates use Asia/Kolkata.

More: [PRODUCT.md](PRODUCT.md) (what and why), [DESIGN.md](DESIGN.md) (look and feel),
[CLAUDE.md](CLAUDE.md) (rules for working on the code), [docs/import-format.md](docs/import-format.md) (history import).

## Run it locally

You need Python 3.13 with [uv](https://docs.astral.sh/uv/), and Node 22.

```bash
# 1. Backend
cd backend
cp .env.example .env          # then edit it (see "Environment variables")
uv sync
uv run alembic upgrade head   # creates the tables
uv run uvicorn app.main:app --reload     # http://localhost:8000  (API docs at /api/docs)

# 2. Frontend (second terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173, forwards /api to port 8000
```

Open http://localhost:5173 and log in with `APP_PASSWORD`. For a quick start without Supabase, set
`DATABASE_URL=sqlite:///./dev.db` in `backend/.env`.

Tests: `uv run pytest` in `backend/`, `npm test` in `frontend/`.

## Environment variables

Set these in `backend/.env` locally, and in the Vercel project settings for production.
Never commit real values (`.env` is git-ignored; `backend/.env.example` is the template).

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | yes | Supabase **Transaction pooler** connection string (port 6543). Paste it as-is. |
| `APP_PASSWORD` | yes | The password you type to log in to the web app. If empty, login is disabled. |
| `SESSION_SECRET` | yes | Long random string that signs the login cookie. If empty, login is disabled. |
| `MCP_SECRET` | for Claude | 16+ random characters. It is part of the MCP URL and its only protection. Shorter or empty disables MCP. |
| `COOKIE_SECURE` | no | Defaults to `true` (cookie only over https). Leave it on in production. |
| `TIMEZONE` | no | Defaults to `Asia/Kolkata`. |

Make secrets with `python -c "import secrets; print(secrets.token_urlsafe(32))"`.

## Database

Tables are created only by Alembic migrations, never by hand in the Supabase dashboard.

```bash
cd backend
uv run alembic upgrade head     # uses DATABASE_URL from backend/.env
```

Run this against Supabase **before** the first deploy, and again whenever you add a migration. Every table has Row Level
Security switched on with no policies, so Supabase's public REST API returns nothing. Only this app (using the direct
connection string) can read or write.

## Deploy to Vercel (free plan)

`vercel.json` at the repo root defines two **services** in one project (Vercel Services is in Beta, available on all plans):

| Request | Goes to |
|---|---|
| `/api/*` | FastAPI (`backend/`) |
| `/mcp/*` | FastAPI (the MCP endpoint) |
| everything else | the built frontend (`frontend/`), with `index.html` as the fallback for app routes |

Vercel passes the original path through, so FastAPI sees `/api/...` as written.

1. Run the migrations against Supabase (above).
2. Push the repo to GitHub.
3. In Vercel: **Add New > Project**, import the repo, leave the root directory as the repo root.
4. Add the environment variables from the table above (all environments).
5. Deploy. Then check `https://<your-domain>/api/health` returns `{"status":"ok"}` and that you can log in.

If the first deploy fails, the usual suspects are the `entrypoint` for the backend in `vercel.json`
(`app.main:app`) and the Python version (this project pins 3.13 in `backend/.python-version`).
Vercel's Services docs: https://vercel.com/docs/services

**Fallback if Services ever gets in the way:** two Vercel projects from the same repo, one with Root Directory
`frontend/` and one with `backend/`, plus a rewrite in the frontend project sending `/api/*` and `/mcp/*` to the backend's URL.
The app code does not change.

## Connect Claude (MCP)

The MCP endpoint is `https://<your-domain>/mcp/<MCP_SECRET>`. Anyone with that URL can read and change your workouts,
so treat it like a password and rotate `MCP_SECRET` (and redeploy) if it leaks.

1. On claude.ai go to **Settings > Connectors > Add custom connector**.
2. Name it "Splits" and paste the URL above. No OAuth or other auth settings are needed.
3. In a chat, enable the connector and try: "Log today's push session: bench 60x10, 62.5x2x8" or "What did I do last
   lower day?"

Tools it provides: `log_session`, `get_recent_sessions`, `get_last_session`, `get_exercise_history`, `list_exercises`,
`update_set`, `delete_set`, `delete_session`. Shorthand: `35x10` is one set, `30x2x10` is two sets of 10, `bwx12` is bodyweight.

To test the endpoint yourself, use the MCP Inspector:
`npx @modelcontextprotocol/inspector --cli https://<your-domain>/mcp/<MCP_SECRET> --transport http --method tools/list`

## Importing past workouts

```bash
cd backend
uv run python scripts/import_history.py history.json --dry-run   # look first, writes nothing
uv run python scripts/import_history.py history.json             # import (one transaction: all or nothing)
```

Format and rules: [docs/import-format.md](docs/import-format.md). It is safe to run twice: sessions that already exist
(same date and type) are skipped, unless you pass `--replace`.

## Install on your phone

Open the site in Chrome or Safari and use **Add to Home Screen**. It then opens full screen like an app. There is no
offline mode: it needs a connection to log sets.
