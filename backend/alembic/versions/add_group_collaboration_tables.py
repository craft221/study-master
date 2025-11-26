"""Add group collaboration tables (shared content, sessions, activities)

Revision ID: add_group_collaboration_tables
Revises: add_all_gamification_tables
Create Date: 2025-01-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_group_collaboration_tables'
down_revision = 'add_all_gamification_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Shared Group Content (notes, flashcards, quizzes)
    op.create_table(
        'shared_group_content',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('content_type', sa.String(50), nullable=False),
        sa.Column('content_id', sa.Integer(), nullable=False),
        sa.Column('content_data', sa.JSON(), nullable=True),
        sa.Column('shared_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['group_id'], ['study_groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
    )
    op.create_index('ix_shared_group_content_id', 'shared_group_content', ['id'])
    op.create_index('ix_shared_group_content_group_id', 'shared_group_content', ['group_id'])
    op.create_index('ix_shared_group_content_user_id', 'shared_group_content', ['user_id'])
    op.create_index('ix_shared_group_content_type', 'shared_group_content', ['content_type'])

    # Group Study Sessions
    op.create_table(
        'group_study_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('session_type', sa.String(50), nullable=False),
        sa.Column('start_time', sa.DateTime(), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('created_by_user_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='scheduled'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['group_id'], ['study_groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='CASCADE')
    )
    op.create_index('ix_group_study_sessions_id', 'group_study_sessions', ['id'])
    op.create_index('ix_group_study_sessions_group_id', 'group_study_sessions', ['group_id'])
    op.create_index('ix_group_study_sessions_created_by', 'group_study_sessions', ['created_by_user_id'])
    op.create_index('ix_group_study_sessions_start_time', 'group_study_sessions', ['start_time'])
    op.create_index('ix_group_study_sessions_status', 'group_study_sessions', ['status'])

    # Group Session Participants
    op.create_table(
        'group_session_participants',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('joined_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['session_id'], ['group_study_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('session_id', 'user_id', name='uq_session_user')
    )
    op.create_index('ix_group_session_participants_id', 'group_session_participants', ['id'])
    op.create_index('ix_group_session_participants_session_id', 'group_session_participants', ['session_id'])
    op.create_index('ix_group_session_participants_user_id', 'group_session_participants', ['user_id'])

    # Group Activities (activity feed)
    op.create_table(
        'group_activities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('activity_type', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('activity_metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['group_id'], ['study_groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
    )
    op.create_index('ix_group_activities_id', 'group_activities', ['id'])
    op.create_index('ix_group_activities_group_id', 'group_activities', ['group_id'])
    op.create_index('ix_group_activities_user_id', 'group_activities', ['user_id'])
    op.create_index('ix_group_activities_type', 'group_activities', ['activity_type'])
    op.create_index('ix_group_activities_created_at', 'group_activities', ['created_at'])


def downgrade() -> None:
    # Drop tables in reverse order (to respect foreign keys)
    op.drop_table('group_activities')
    op.drop_table('group_session_participants')
    op.drop_table('group_study_sessions')
    op.drop_table('shared_group_content')
