"""Add is_deleted column to group_messages for soft delete

Revision ID: add_is_deleted_to_group_messages
Revises: add_ai_tasks_table
Create Date: 2025-01-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_is_deleted_to_group_messages'
down_revision = 'add_ai_tasks_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_deleted column to group_messages for WhatsApp-style soft delete
    op.add_column('group_messages', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    # Drop is_deleted column
    op.drop_column('group_messages', 'is_deleted')
