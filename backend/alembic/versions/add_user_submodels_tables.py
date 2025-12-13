"""Add user submodels tables (profile, preferences, subscription, gamification, stats, mascot, ai_usage)

Revision ID: add_user_submodels_tables
Revises: add_quiz_stats_columns
Create Date: 2025-12-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_user_submodels_tables'
down_revision = 'add_quiz_stats_columns'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Check which tables already exist
    result = conn.execute(sa.text("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
    """))
    existing_tables = [row[0] for row in result]

    # ==================== USER PROFILES ====================
    if 'user_profiles' not in existing_tables:
        op.create_table('user_profiles',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('avatar_url', sa.String(500), nullable=True),
            sa.Column('bio', sa.Text(), nullable=True),
            sa.Column('university', sa.String(200), nullable=True),
            sa.Column('major', sa.String(100), nullable=True),
            sa.Column('promotion', sa.String(50), nullable=True),
            sa.Column('student_id', sa.String(50), nullable=True),
            sa.Column('phone', sa.String(20), nullable=True),
            sa.Column('country', sa.String(100), nullable=True),
            sa.Column('city', sa.String(100), nullable=True),
            sa.Column('timezone', sa.String(50), server_default='UTC', nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_user_profiles_id', 'user_profiles', ['id'])
        op.create_index('ix_user_profiles_user_id', 'user_profiles', ['user_id'], unique=True)

    # ==================== USER PREFERENCES ====================
    if 'user_preferences' not in existing_tables:
        op.create_table('user_preferences',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('language', sa.String(10), server_default='fr', nullable=True),
            sa.Column('theme', sa.String(20), server_default='light', nullable=True),
            sa.Column('notifications_enabled', sa.Boolean(), server_default='true', nullable=True),
            sa.Column('email_notifications', sa.Boolean(), server_default='true', nullable=True),
            sa.Column('push_notifications', sa.Boolean(), server_default='true', nullable=True),
            sa.Column('daily_goal_minutes', sa.Integer(), server_default='30', nullable=True),
            sa.Column('reminder_time', sa.String(5), server_default='09:00', nullable=True),
            sa.Column('weekend_reminders', sa.Boolean(), server_default='false', nullable=True),
            sa.Column('profile_public', sa.Boolean(), server_default='true', nullable=True),
            sa.Column('show_in_leaderboard', sa.Boolean(), server_default='true', nullable=True),
            sa.Column('show_activity_status', sa.Boolean(), server_default='true', nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_user_preferences_id', 'user_preferences', ['id'])
        op.create_index('ix_user_preferences_user_id', 'user_preferences', ['user_id'], unique=True)

    # ==================== USER SUBSCRIPTIONS ====================
    if 'user_subscriptions' not in existing_tables:
        # Check if enum type exists
        enum_result = conn.execute(sa.text("""
            SELECT 1 FROM pg_type WHERE typname = 'subscriptiontype'
        """))
        if not enum_result.fetchone():
            conn.execute(sa.text("CREATE TYPE subscriptiontype AS ENUM ('FREE', 'PREMIUM', 'PREMIUM_PLUS', 'INSTITUTIONAL')"))

        op.create_table('user_subscriptions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('subscription_type', postgresql.ENUM('FREE', 'PREMIUM', 'PREMIUM_PLUS', 'INSTITUTIONAL', name='subscriptiontype', create_type=False), server_default='FREE', nullable=False),
            sa.Column('subscription_starts_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('subscription_ends_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('stripe_customer_id', sa.String(100), nullable=True),
            sa.Column('stripe_subscription_id', sa.String(100), nullable=True),
            sa.Column('ai_requests_limit', sa.Integer(), server_default='10', nullable=True),
            sa.Column('storage_limit_mb', sa.Integer(), server_default='100', nullable=True),
            sa.Column('auto_renew', sa.Boolean(), server_default='true', nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_user_subscriptions_id', 'user_subscriptions', ['id'])
        op.create_index('ix_user_subscriptions_user_id', 'user_subscriptions', ['user_id'], unique=True)

    # ==================== USER GAMIFICATION ====================
    if 'user_gamification' not in existing_tables:
        op.create_table('user_gamification',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('total_xp', sa.Integer(), server_default='0', nullable=True),
            sa.Column('level', sa.Integer(), server_default='1', nullable=True),
            sa.Column('current_streak', sa.Integer(), server_default='0', nullable=True),
            sa.Column('longest_streak', sa.Integer(), server_default='0', nullable=True),
            sa.Column('last_activity_date', sa.DateTime(timezone=True), nullable=True),
            sa.Column('unlocked_achievements', sa.JSON(), server_default='[]', nullable=True),
            sa.Column('achievement_points', sa.Integer(), server_default='0', nullable=True),
            sa.Column('badges', sa.JSON(), server_default='[]', nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_user_gamification_id', 'user_gamification', ['id'])
        op.create_index('ix_user_gamification_user_id', 'user_gamification', ['user_id'], unique=True)

    # ==================== USER STATS ====================
    if 'user_stats' not in existing_tables:
        op.create_table('user_stats',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('total_study_time_minutes', sa.Integer(), server_default='0', nullable=True),
            sa.Column('study_time_this_week', sa.Integer(), server_default='0', nullable=True),
            sa.Column('study_time_this_month', sa.Integer(), server_default='0', nullable=True),
            sa.Column('total_notes_created', sa.Integer(), server_default='0', nullable=True),
            sa.Column('total_notes_words', sa.Integer(), server_default='0', nullable=True),
            sa.Column('total_flashcards_created', sa.Integer(), server_default='0', nullable=True),
            sa.Column('total_flashcards_reviewed', sa.Integer(), server_default='0', nullable=True),
            sa.Column('flashcards_mastered', sa.Integer(), server_default='0', nullable=True),
            sa.Column('total_quizzes_created', sa.Integer(), server_default='0', nullable=True),
            sa.Column('total_quizzes_taken', sa.Integer(), server_default='0', nullable=True),
            sa.Column('total_quizzes_completed', sa.Integer(), server_default='0', nullable=True),
            sa.Column('average_quiz_score', sa.Float(), server_default='0', nullable=True),
            sa.Column('total_duels_played', sa.Integer(), server_default='0', nullable=True),
            sa.Column('duels_won', sa.Integer(), server_default='0', nullable=True),
            sa.Column('duels_lost', sa.Integer(), server_default='0', nullable=True),
            sa.Column('duel_win_streak', sa.Integer(), server_default='0', nullable=True),
            sa.Column('total_study_sessions', sa.Integer(), server_default='0', nullable=True),
            sa.Column('average_session_duration', sa.Integer(), server_default='0', nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('stats_reset_date', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_user_stats_id', 'user_stats', ['id'])
        op.create_index('ix_user_stats_user_id', 'user_stats', ['user_id'], unique=True)

    # ==================== USER MASCOTS (Spark) ====================
    if 'user_mascots' not in existing_tables:
        op.create_table('user_mascots',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(50), server_default='Spark', nullable=True),
            sa.Column('level', sa.Integer(), server_default='1', nullable=True),
            sa.Column('unlocked_accessories', sa.JSON(), server_default='[]', nullable=True),
            sa.Column('current_accessory', sa.String(50), nullable=True),
            sa.Column('happiness', sa.Integer(), server_default='100', nullable=True),
            sa.Column('last_interaction_date', sa.DateTime(timezone=True), nullable=True),
            sa.Column('interaction_count', sa.Integer(), server_default='0', nullable=True),
            sa.Column('color_variant', sa.String(20), server_default='orange', nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_user_mascots_id', 'user_mascots', ['id'])
        op.create_index('ix_user_mascots_user_id', 'user_mascots', ['user_id'], unique=True)

    # ==================== USER AI USAGE ====================
    if 'user_ai_usage' not in existing_tables:
        op.create_table('user_ai_usage',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('requests_today', sa.Integer(), server_default='0', nullable=True),
            sa.Column('requests_reset_date', sa.DateTime(timezone=True), nullable=True),
            sa.Column('total_requests', sa.Integer(), server_default='0', nullable=True),
            sa.Column('total_tokens_used', sa.Integer(), server_default='0', nullable=True),
            sa.Column('quiz_generations', sa.Integer(), server_default='0', nullable=True),
            sa.Column('flashcard_generations', sa.Integer(), server_default='0', nullable=True),
            sa.Column('note_summaries', sa.Integer(), server_default='0', nullable=True),
            sa.Column('explanations', sa.Integer(), server_default='0', nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_user_ai_usage_id', 'user_ai_usage', ['id'])
        op.create_index('ix_user_ai_usage_user_id', 'user_ai_usage', ['user_id'], unique=True)

    # ==================== POPULATE FOR EXISTING USERS ====================
    # Get all existing user IDs
    users_result = conn.execute(sa.text("SELECT id FROM users"))
    user_ids = [row[0] for row in users_result]

    for user_id in user_ids:
        # Check and insert user_profiles
        result = conn.execute(sa.text("SELECT 1 FROM user_profiles WHERE user_id = :uid"), {"uid": user_id})
        if not result.fetchone():
            conn.execute(sa.text("""
                INSERT INTO user_profiles (user_id, timezone)
                VALUES (:uid, 'UTC')
            """), {"uid": user_id})

        # Check and insert user_preferences
        result = conn.execute(sa.text("SELECT 1 FROM user_preferences WHERE user_id = :uid"), {"uid": user_id})
        if not result.fetchone():
            conn.execute(sa.text("""
                INSERT INTO user_preferences (user_id, language, theme, notifications_enabled, email_notifications, push_notifications, daily_goal_minutes, reminder_time, weekend_reminders, profile_public, show_in_leaderboard, show_activity_status)
                VALUES (:uid, 'fr', 'light', true, true, true, 30, '09:00', false, true, true, true)
            """), {"uid": user_id})

        # Check and insert user_subscriptions
        result = conn.execute(sa.text("SELECT 1 FROM user_subscriptions WHERE user_id = :uid"), {"uid": user_id})
        if not result.fetchone():
            conn.execute(sa.text("""
                INSERT INTO user_subscriptions (user_id, subscription_type, ai_requests_limit, storage_limit_mb, auto_renew)
                VALUES (:uid, 'FREE', 10, 100, true)
            """), {"uid": user_id})

        # Check and insert user_gamification
        result = conn.execute(sa.text("SELECT 1 FROM user_gamification WHERE user_id = :uid"), {"uid": user_id})
        if not result.fetchone():
            conn.execute(sa.text("""
                INSERT INTO user_gamification (user_id, total_xp, level, current_streak, longest_streak, unlocked_achievements, achievement_points, badges)
                VALUES (:uid, 0, 1, 0, 0, '[]', 0, '[]')
            """), {"uid": user_id})

        # Check and insert user_stats
        result = conn.execute(sa.text("SELECT 1 FROM user_stats WHERE user_id = :uid"), {"uid": user_id})
        if not result.fetchone():
            conn.execute(sa.text("""
                INSERT INTO user_stats (user_id, total_study_time_minutes, study_time_this_week, study_time_this_month, total_notes_created, total_notes_words, total_flashcards_created, total_flashcards_reviewed, flashcards_mastered, total_quizzes_created, total_quizzes_taken, total_quizzes_completed, average_quiz_score, total_duels_played, duels_won, duels_lost, duel_win_streak, total_study_sessions, average_session_duration)
                VALUES (:uid, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
            """), {"uid": user_id})

        # Check and insert user_mascots (Spark!)
        result = conn.execute(sa.text("SELECT 1 FROM user_mascots WHERE user_id = :uid"), {"uid": user_id})
        if not result.fetchone():
            conn.execute(sa.text("""
                INSERT INTO user_mascots (user_id, name, level, unlocked_accessories, happiness, interaction_count, color_variant)
                VALUES (:uid, 'Spark', 1, '[]', 100, 0, 'orange')
            """), {"uid": user_id})

        # Check and insert user_ai_usage
        result = conn.execute(sa.text("SELECT 1 FROM user_ai_usage WHERE user_id = :uid"), {"uid": user_id})
        if not result.fetchone():
            conn.execute(sa.text("""
                INSERT INTO user_ai_usage (user_id, requests_today, total_requests, total_tokens_used, quiz_generations, flashcard_generations, note_summaries, explanations)
                VALUES (:uid, 0, 0, 0, 0, 0, 0, 0)
            """), {"uid": user_id})


def downgrade():
    op.drop_table('user_ai_usage')
    op.drop_table('user_mascots')
    op.drop_table('user_stats')
    op.drop_table('user_gamification')
    op.drop_table('user_subscriptions')
    op.drop_table('user_preferences')
    op.drop_table('user_profiles')

    # Drop enum type
    conn = op.get_bind()
    conn.execute(sa.text("DROP TYPE IF EXISTS subscriptiontype"))
