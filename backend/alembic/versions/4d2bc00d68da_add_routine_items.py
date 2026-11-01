"""add routine items

Revision ID: 4d2bc00d68da
Revises: b6d68dd01b96
Create Date: 2026-11-01 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d2bc00d68da'
down_revision: Union[str, Sequence[str], None] = 'b6d68dd01b96'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('routine_items',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('session_type', sa.Enum('push', 'pull', 'lower', 'upper', 'run', 'other', name='ck_routine_items_session_type', native_enum=False, create_constraint=True, length=16), nullable=False),
    sa.Column('exercise_id', sa.Integer(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('target_sets', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('session_type', 'exercise_id', name='uq_routine_items_type_exercise')
    )
    with op.batch_alter_table('routine_items', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_routine_items_exercise_id'), ['exercise_id'], unique=False)

    # Every table enables Row Level Security in the migration that creates it (see CLAUDE.md):
    # Supabase would otherwise expose it through its public REST API. Postgres only; no policies.
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE routine_items ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    with op.batch_alter_table('routine_items', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_routine_items_exercise_id'))

    op.drop_table('routine_items')
