"""Add study sessions, schedules, achievements, leaderboards, study groups, and duels tables

Revision ID: add_all_gamification_tables
Revises: 
Create Date: 2024-01-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_all_gamification_tables'
down_revision = None  # Update this with your last migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Note: Certaines tables existent peut-être déjà
    # Vérifier avec: SELECT table_name FROM information_schema.tables WHERE table_schema='public';
    
    # Study Sessions
    op.create_table(
        'study_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('subject_id', sa.Integer(), nullable=True),
        sa.Column('session_type', sa.String(50), nullable=False, server_default='pomodoro'),
        sa.Column('status', sa.String(50), nullable=False, server_default='planned'),
        sa.Column('planned_duration_minutes', sa.Integer(), nullable=False, server_default='25'),
        sa.Column('actual_duration_minutes', sa.Integer(), nullable=True),
        sa.Column('break_duration_minutes', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('productivity_rating', sa.Integer(), nullable=True),
        sa.Column('focus_score', sa.Float(), nullable=True),
        sa.Column('distractions_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('breaks_taken', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('xp_earned', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('tags', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()'), onupdate=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ondelete='SET NULL')
    )
    op.create_index('ix_study_sessions_user_id', 'study_sessions', ['user_id'])
    op.create_index('ix_study_sessions_subject_id', 'study_sessions', ['subject_id'])
    op.create_index('ix_study_sessions_status', 'study_sessions', ['status'])
    
    # Schedules
    op.create_table(
        'schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('subject_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('location', sa.String(200), nullable=True),
        sa.Column('start_time', sa.DateTime(), nullable=False),
        sa.Column('end_time', sa.DateTime(), nullable=False),
        sa.Column('day_of_week', sa.String(20), nullable=True),
        sa.Column('is_recurring', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('recurrence_pattern', sa.String(100), nullable=True),
        sa.Column('color', sa.String(7), nullable=False, server_default='#3B82F6'),
        sa.Column('reminder_minutes_before', sa.Integer(), nullable=True),
        sa.Column('is_completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ondelete='SET NULL')
    )
    op.create_index('ix_schedules_user_id', 'schedules', ['user_id'])
    op.create_index('ix_schedules_start_time', 'schedules', ['start_time'])
    op.create_index('ix_schedules_event_type', 'schedules', ['event_type'])
    
    # Achievements
    op.create_table(
        'achievements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('rarity', sa.String(20), nullable=False),
        sa.Column('icon', sa.String(50), nullable=False, server_default='🏆'),
        sa.Column('xp_reward', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('requirements', postgresql.JSONB(), nullable=True),
        sa.Column('total_unlocked', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_achievements_category', 'achievements', ['category'])
    op.create_index('ix_achievements_rarity', 'achievements', ['rarity'])
    
    # User Achievements
    op.create_table(
        'user_achievements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('achievement_id', sa.Integer(), nullable=False),
        sa.Column('unlocked_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('progress', sa.Float(), nullable=False, server_default='0.0'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['achievement_id'], ['achievements.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'achievement_id', name='uq_user_achievement')
    )
    op.create_index('ix_user_achievements_user_id', 'user_achievements', ['user_id'])
    
    # Study Groups
    op.create_table(
        'study_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('creator_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('subject_id', sa.Integer(), nullable=True),
        sa.Column('university', sa.String(200), nullable=True),
        sa.Column('promotion', sa.String(100), nullable=True),
        sa.Column('max_members', sa.Integer(), nullable=False, server_default='20'),
        sa.Column('current_members', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_private', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('status', sa.String(50), nullable=False, server_default='active'),
        sa.Column('cover_image_url', sa.String(500), nullable=True),
        sa.Column('total_study_hours', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_shared_notes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ondelete='SET NULL')
    )
    op.create_index('ix_study_groups_creator_id', 'study_groups', ['creator_id'])
    op.create_index('ix_study_groups_university', 'study_groups', ['university'])
    
    # Study Group Members
    op.create_table(
        'study_group_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='member'),
        sa.Column('joined_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('contribution_score', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['group_id'], ['study_groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('group_id', 'user_id', name='uq_group_member')
    )
    op.create_index('ix_study_group_members_group_id', 'study_group_members', ['group_id'])
    op.create_index('ix_study_group_members_user_id', 'study_group_members', ['user_id'])
    
    # Duels
    op.create_table(
        'duels',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('challenger_id', sa.Integer(), nullable=False),
        sa.Column('opponent_id', sa.Integer(), nullable=False),
        sa.Column('subject_id', sa.Integer(), nullable=False),
        sa.Column('quiz_id', sa.Integer(), nullable=True),
        sa.Column('stakes_xp', sa.Integer(), nullable=False, server_default='50'),
        sa.Column('duration_minutes', sa.Integer(), nullable=False, server_default='15'),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('challenger_score', sa.Float(), nullable=True),
        sa.Column('opponent_score', sa.Float(), nullable=True),
        sa.Column('winner_id', sa.Integer(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['challenger_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['opponent_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['quiz_id'], ['quizzes.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['winner_id'], ['users.id'], ondelete='SET NULL')
    )
    op.create_index('ix_duels_challenger_id', 'duels', ['challenger_id'])
    op.create_index('ix_duels_opponent_id', 'duels', ['opponent_id'])
    op.create_index('ix_duels_status', 'duels', ['status'])


def downgrade() -> None:
    op.drop_table('duels')
    op.drop_table('study_group_members')
    op.drop_table('study_groups')
    op.drop_table('user_achievements')
    op.drop_table('achievements')
    op.drop_table('schedules')
    op.drop_table('study_sessions')
