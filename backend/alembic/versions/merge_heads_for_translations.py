"""Merge all open heads before adding translation tables

Revision ID: merge_heads_for_translations
Revises: add_daily_quests, add_is_deleted_to_group_messages, merge_all_heads, add_quiz_attempt_columns
Create Date: 2026-04-27

Consolidates all currently divergent heads into a single head so that
the subsequent translation-table migration can chain cleanly.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'merge_heads_for_translations'
down_revision = (
    'add_daily_quests',
    'add_is_deleted_to_group_messages',
    'merge_all_heads',
    'add_quiz_attempt_columns',
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Merge point only — no schema change."""
    pass


def downgrade() -> None:
    """Merge point only — no schema change."""
    pass
