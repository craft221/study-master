"""Add notification tables

Revision ID: add_notification_tables
Revises:
Create Date: 2024-12-04

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_notification_tables'
down_revision = '6b4b09e92147'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('priority', sa.String(20), default='normal'),
        sa.Column('channel', sa.String(20), default='in_app'),
        sa.Column('is_read', sa.Boolean(), default=False),
        sa.Column('read_at', sa.DateTime(), nullable=True),
        sa.Column('data', sa.Text(), nullable=True),
        sa.Column('action_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('email_sent', sa.Boolean(), default=False),
        sa.Column('email_sent_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_notifications_id', 'notifications', ['id'])
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_notifications_type', 'notifications', ['type'])
    op.create_index('ix_notifications_is_read', 'notifications', ['is_read'])
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'])

    # Create notification_preferences table
    op.create_table(
        'notification_preferences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('email_enabled', sa.Boolean(), default=True),
        sa.Column('push_enabled', sa.Boolean(), default=True),
        sa.Column('in_app_enabled', sa.Boolean(), default=True),
        sa.Column('duel_notifications', sa.Boolean(), default=True),
        sa.Column('calendar_notifications', sa.Boolean(), default=True),
        sa.Column('streak_notifications', sa.Boolean(), default=True),
        sa.Column('study_reminders', sa.Boolean(), default=True),
        sa.Column('achievement_notifications', sa.Boolean(), default=True),
        sa.Column('social_notifications', sa.Boolean(), default=True),
        sa.Column('quiet_hours_start', sa.Integer(), default=22),
        sa.Column('quiet_hours_end', sa.Integer(), default=8),
        sa.Column('email_digest', sa.Boolean(), default=False),
        sa.Column('email_digest_hour', sa.Integer(), default=18),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index('ix_notification_preferences_id', 'notification_preferences', ['id'])


def downgrade() -> None:
    op.drop_table('notification_preferences')
    op.drop_table('notifications')
