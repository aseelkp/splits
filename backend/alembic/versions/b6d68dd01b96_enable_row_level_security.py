"""enable row level security

Revision ID: b6d68dd01b96
Revises: 71818755e124
Create Date: 2026-10-31 12:54:28.599641

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b6d68dd01b96'
down_revision: Union[str, Sequence[str], None] = '71818755e124'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Supabase exposes every table in `public` through its REST API (anon key) unless
# Row Level Security is on. With RLS on and no policies, that API sees nothing. Our
# backend connects as the `postgres` role, which bypasses RLS, so the app is unaffected.
TABLES = ["alembic_version", "exercises", "sessions", "sets", "runs"]


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return  # SQLite (local dev) has no RLS
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
