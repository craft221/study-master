"""Add reminder columns to schedules table

Revision ID: add_schedule_reminder_cols
Revises: add_notification_tables
Create Date: 2024-12-04

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_schedule_reminder_cols'
down_revision = 'add_notification_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing columns to schedules table (only columns that don't exist)
    conn = op.get_bind()

    # Check which columns exist
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'schedules'
    """))
    existing_columns = [row[0] for row in result]

    if 'reminder_enabled' not in existing_columns:
        op.add_column('schedules', sa.Column('reminder_enabled', sa.Boolean(), server_default='true', nullable=True))
    if 'reminder_minutes_before' not in existing_columns:
        op.add_column('schedules', sa.Column('reminder_minutes_before', sa.Integer(), nullable=True))
    if 'reminders_sent' not in existing_columns:
        op.add_column('schedules', sa.Column('reminders_sent', sa.JSON(), nullable=True))
    if 'is_completed' not in existing_columns:
        op.add_column('schedules', sa.Column('is_completed', sa.Boolean(), server_default='false', nullable=True))
    if 'completed_at' not in existing_columns:
        op.add_column('schedules', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))
    if 'is_cancelled' not in existing_columns:
        op.add_column('schedules', sa.Column('is_cancelled', sa.Boolean(), server_default='false', nullable=True))


def downgrade() -> None:
    op.drop_column('schedules', 'is_cancelled')
    op.drop_column('schedules', 'completed_at')
    op.drop_column('schedules', 'is_completed')
    op.drop_column('schedules', 'reminders_sent')
    op.drop_column('schedules', 'reminder_minutes_before')
    op.drop_column('schedules', 'reminder_enabled')
