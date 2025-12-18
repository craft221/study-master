"""Add Exam Mode tables for intelligent exam preparation

Revision ID: add_exam_mode_tables
Revises: merge_all_heads
Create Date: 2025-12-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_exam_mode_tables'
down_revision = 'merge_all_heads'
branch_labels = None
depends_on = None

# Define enum types
examsessionstatus = postgresql.ENUM('planning', 'active', 'paused', 'completed', 'abandoned', name='examsessionstatus', create_type=False)
studytasktype = postgresql.ENUM('read', 'flashcards', 'quiz', 'review', 'practice_exam', 'summary', 'weak_points', name='studytasktype', create_type=False)
studytaskstatus = postgresql.ENUM('pending', 'in_progress', 'completed', 'skipped', name='studytaskstatus', create_type=False)
difficultylevel = postgresql.ENUM('easy', 'medium', 'hard', name='difficultylevel', create_type=False)


def upgrade():
    conn = op.get_bind()

    # Check which tables already exist
    result = conn.execute(sa.text("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
    """))
    existing_tables = [row[0] for row in result]

    # ==================== CREATE ENUM TYPES ====================
    enum_result = conn.execute(sa.text("""
        SELECT 1 FROM pg_type WHERE typname = 'examsessionstatus'
    """))
    if not enum_result.fetchone():
        examsessionstatus.create(conn)

    enum_result = conn.execute(sa.text("""
        SELECT 1 FROM pg_type WHERE typname = 'studytasktype'
    """))
    if not enum_result.fetchone():
        studytasktype.create(conn)

    enum_result = conn.execute(sa.text("""
        SELECT 1 FROM pg_type WHERE typname = 'studytaskstatus'
    """))
    if not enum_result.fetchone():
        studytaskstatus.create(conn)

    enum_result = conn.execute(sa.text("""
        SELECT 1 FROM pg_type WHERE typname = 'difficultylevel'
    """))
    if not enum_result.fetchone():
        difficultylevel.create(conn)

    # ==================== CREATE EXAM_SESSIONS TABLE ====================
    if 'exam_sessions' not in existing_tables:
        op.create_table('exam_sessions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('exam_name', sa.String(length=255), nullable=False),
            sa.Column('exam_description', sa.Text(), nullable=True),
            sa.Column('exam_date', sa.Date(), nullable=False),
            sa.Column('exam_time', sa.String(length=5), nullable=True),
            sa.Column('subject_id', sa.Integer(), nullable=True),
            sa.Column('note_ids', postgresql.JSON(astext_type=sa.Text()), nullable=True, server_default='[]'),
            sa.Column('total_content_pages', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('total_content_words', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('study_hours_per_day', sa.Float(), nullable=True, server_default='2.0'),
            sa.Column('preferred_study_times', postgresql.JSON(astext_type=sa.Text()), nullable=True, server_default='["morning", "afternoon"]'),
            sa.Column('include_weekends', sa.Boolean(), nullable=True, server_default='true'),
            sa.Column('difficulty_level', difficultylevel, nullable=True, server_default='medium'),
            sa.Column('status', examsessionstatus, nullable=True, server_default='planning'),
            sa.Column('current_day', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('total_days', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('tasks_completed', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('tasks_total', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('progress_percentage', sa.Float(), nullable=True, server_default='0.0'),
            sa.Column('predicted_score', sa.Float(), nullable=True),
            sa.Column('confidence_level', sa.Float(), nullable=True),
            sa.Column('total_study_minutes', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('total_flashcards_reviewed', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('total_quizzes_taken', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('average_quiz_score', sa.Float(), nullable=True, server_default='0.0'),
            sa.Column('weak_points', postgresql.JSON(astext_type=sa.Text()), nullable=True, server_default='[]'),
            sa.Column('strong_points', postgresql.JSON(astext_type=sa.Text()), nullable=True, server_default='[]'),
            sa.Column('notifications_enabled', sa.Boolean(), nullable=True, server_default='true'),
            sa.Column('reminder_time', sa.String(length=5), nullable=True, server_default="'09:00'"),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
            sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_exam_sessions_id'), 'exam_sessions', ['id'], unique=False)
        op.create_index(op.f('ix_exam_sessions_user_id'), 'exam_sessions', ['user_id'], unique=False)
        op.create_index(op.f('ix_exam_sessions_status'), 'exam_sessions', ['status'], unique=False)
        op.create_index(op.f('ix_exam_sessions_exam_date'), 'exam_sessions', ['exam_date'], unique=False)

    # ==================== CREATE STUDY_DAYS TABLE ====================
    if 'study_days' not in existing_tables:
        op.create_table('study_days',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('exam_session_id', sa.Integer(), nullable=False),
            sa.Column('day_number', sa.Integer(), nullable=False),
            sa.Column('study_date', sa.Date(), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('chapters', postgresql.JSON(astext_type=sa.Text()), nullable=True, server_default='[]'),
            sa.Column('note_ids', postgresql.JSON(astext_type=sa.Text()), nullable=True, server_default='[]'),
            sa.Column('is_review_day', sa.Boolean(), nullable=True, server_default='false'),
            sa.Column('is_practice_exam_day', sa.Boolean(), nullable=True, server_default='false'),
            sa.Column('is_rest_day', sa.Boolean(), nullable=True, server_default='false'),
            sa.Column('estimated_minutes', sa.Integer(), nullable=True, server_default='60'),
            sa.Column('actual_minutes', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('is_completed', sa.Boolean(), nullable=True, server_default='false'),
            sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('tasks_completed', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('tasks_total', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('score', sa.Float(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
            sa.ForeignKeyConstraint(['exam_session_id'], ['exam_sessions.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_study_days_id'), 'study_days', ['id'], unique=False)
        op.create_index(op.f('ix_study_days_exam_session_id'), 'study_days', ['exam_session_id'], unique=False)
        op.create_index(op.f('ix_study_days_study_date'), 'study_days', ['study_date'], unique=False)

    # ==================== CREATE STUDY_TASKS TABLE ====================
    if 'study_tasks' not in existing_tables:
        op.create_table('study_tasks',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('study_day_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('task_type', studytasktype, nullable=False),
            sa.Column('order', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('note_id', sa.Integer(), nullable=True),
            sa.Column('quiz_id', sa.Integer(), nullable=True),
            sa.Column('flashcard_deck_id', sa.Integer(), nullable=True),
            sa.Column('estimated_minutes', sa.Integer(), nullable=True, server_default='30'),
            sa.Column('actual_minutes', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('target_score', sa.Float(), nullable=True, server_default='80.0'),
            sa.Column('achieved_score', sa.Float(), nullable=True),
            sa.Column('items_count', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('status', studytaskstatus, nullable=True, server_default='pending'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
            sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['note_id'], ['notes.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['quiz_id'], ['quizzes.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['study_day_id'], ['study_days.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_study_tasks_id'), 'study_tasks', ['id'], unique=False)
        op.create_index(op.f('ix_study_tasks_study_day_id'), 'study_tasks', ['study_day_id'], unique=False)
        op.create_index(op.f('ix_study_tasks_user_id'), 'study_tasks', ['user_id'], unique=False)
        op.create_index(op.f('ix_study_tasks_status'), 'study_tasks', ['status'], unique=False)

    # ==================== CREATE EXAM_MODE_NOTIFICATIONS TABLE ====================
    if 'exam_mode_notifications' not in existing_tables:
        op.create_table('exam_mode_notifications',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('exam_session_id', sa.Integer(), nullable=False),
            sa.Column('notification_type', sa.String(length=50), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('message', sa.Text(), nullable=True),
            sa.Column('is_read', sa.Boolean(), nullable=True, server_default='false'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
            sa.ForeignKeyConstraint(['exam_session_id'], ['exam_sessions.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_exam_mode_notifications_id'), 'exam_mode_notifications', ['id'], unique=False)
        op.create_index(op.f('ix_exam_mode_notifications_exam_session_id'), 'exam_mode_notifications', ['exam_session_id'], unique=False)


def downgrade():
    conn = op.get_bind()

    # Drop tables in reverse order
    op.drop_table('exam_mode_notifications')
    op.drop_table('study_tasks')
    op.drop_table('study_days')
    op.drop_table('exam_sessions')

    # Drop enum types
    examsessionstatus.drop(conn, checkfirst=True)
    studytasktype.drop(conn, checkfirst=True)
    studytaskstatus.drop(conn, checkfirst=True)
    difficultylevel.drop(conn, checkfirst=True)
