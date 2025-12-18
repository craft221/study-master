"""Merge all migration heads

Revision ID: merge_all_heads
Revises: add_mfa_fields, add_study_group_invitations
Create Date: 2024-12-15

This migration merges all divergent branches into a single head.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'merge_all_heads'
down_revision = ('add_mfa_fields', 'add_study_group_invitations')
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Nothing to do - this is just a merge point."""
    pass


def downgrade() -> None:
    """Nothing to do - this is just a merge point."""
    pass
