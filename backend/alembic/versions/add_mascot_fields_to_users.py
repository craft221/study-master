"""Add mascot fields to users table for Spark the Squirrel

Revision ID: add_mascot_fields_to_users
Revises: add_message_reactions_and_replies
Create Date: 2025-12-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_mascot_fields_to_users'
down_revision = 'add_message_reactions_and_replies'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add mascot-related fields to users table"""

    # Add mascot fields
    op.add_column('users', sa.Column('mascot_name', sa.String(50), nullable=True, server_default='Spark'))
    op.add_column('users', sa.Column('mascot_level', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('users', sa.Column('mascot_unlocked_accessories', postgresql.JSON(), nullable=True))
    op.add_column('users', sa.Column('mascot_current_accessory', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('mascot_last_interaction_date', sa.DateTime(timezone=True), nullable=True))

    # Update existing users to have default mascot values
    op.execute("UPDATE users SET mascot_name = 'Spark' WHERE mascot_name IS NULL")
    op.execute("UPDATE users SET mascot_level = 1 WHERE mascot_level IS NULL")
    op.execute("UPDATE users SET mascot_unlocked_accessories = '[]' WHERE mascot_unlocked_accessories IS NULL")


def downgrade() -> None:
    """Remove mascot fields from users table"""

    op.drop_column('users', 'mascot_last_interaction_date')
    op.drop_column('users', 'mascot_current_accessory')
    op.drop_column('users', 'mascot_unlocked_accessories')
    op.drop_column('users', 'mascot_level')
    op.drop_column('users', 'mascot_name')
