"""Convert all TIMESTAMP WITHOUT TIME ZONE columns to TIMESTAMP WITH TIME ZONE

This migration converts all timestamp columns to be timezone-aware,
which is the recommended approach for handling dates across different timezones.
Existing data will be treated as UTC and converted accordingly.

Revision ID: convert_timestamps_to_timezone
Revises: add_focus_rooms_tables
Create Date: 2025-12-07

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'convert_timestamps_to_timezone'
down_revision = 'add_focus_rooms_tables'
branch_labels = None
depends_on = None


# Liste de toutes les tables et colonnes à migrer
COLUMNS_TO_MIGRATE = [
    ('achievements', 'created_at'),
    ('duels', 'created_at'),
    ('duels', 'ended_at'),
    ('duels', 'started_at'),
    ('duels', 'updated_at'),
    ('flashcard_reviews', 'reviewed_at'),
    ('flashcards', 'created_at'),
    ('flashcards', 'due_date'),
    ('flashcards', 'last_reviewed_at'),
    ('flashcards', 'next_review_at'),
    ('flashcards', 'updated_at'),
    ('group_activities', 'created_at'),
    ('group_messages', 'created_at'),
    ('group_messages', 'updated_at'),
    ('group_session_participants', 'joined_at'),
    ('group_study_sessions', 'created_at'),
    ('group_study_sessions', 'start_time'),
    ('group_study_sessions', 'updated_at'),
    ('guest_quiz_attempts', 'completed_at'),
    ('guest_quiz_attempts', 'created_at'),
    ('leaderboards', 'created_at'),
    ('leaderboards', 'period_end'),
    ('leaderboards', 'period_start'),
    ('leaderboards', 'updated_at'),
    ('message_reactions', 'created_at'),
    ('notes', 'created_at'),
    ('notes', 'updated_at'),
    ('notification_preferences', 'created_at'),
    ('notification_preferences', 'updated_at'),
    ('notifications', 'created_at'),
    ('notifications', 'email_sent_at'),
    ('notifications', 'expires_at'),
    ('notifications', 'read_at'),
    ('quiz_attempts', 'completed_at'),
    ('quiz_questions', 'created_at'),
    ('quizzes', 'created_at'),
    ('quizzes', 'published_at'),
    ('quizzes', 'updated_at'),
    ('schedules', 'completed_at'),
    ('schedules', 'created_at'),
    ('schedules', 'end_time'),
    ('schedules', 'start_time'),
    ('schedules', 'updated_at'),
    ('shared_group_content', 'shared_at'),
    ('study_group_memberships', 'joined_at'),
    ('study_groups', 'created_at'),
    ('study_groups', 'updated_at'),
    ('study_sessions', 'ended_at'),
    ('study_sessions', 'started_at'),
    ('subjects', 'created_at'),
    ('subjects', 'exam_date'),
    ('subjects', 'updated_at'),
    ('user_achievements', 'created_at'),
    ('user_achievements', 'unlocked_at'),
]


def upgrade():
    """
    Convertit toutes les colonnes TIMESTAMP WITHOUT TIME ZONE en TIMESTAMP WITH TIME ZONE.
    Les données existantes sont interprétées comme étant en UTC.
    """
    conn = op.get_bind()

    # Vérifier quelles tables existent réellement
    result = conn.execute(sa.text("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
    """))
    existing_tables = {row[0] for row in result}

    for table_name, column_name in COLUMNS_TO_MIGRATE:
        # Vérifier si la table existe
        if table_name not in existing_tables:
            print(f"Skipping {table_name}.{column_name} - table does not exist")
            continue

        # Vérifier si la colonne existe et est bien TIMESTAMP WITHOUT TIME ZONE
        col_result = conn.execute(sa.text(f"""
            SELECT data_type FROM information_schema.columns
            WHERE table_name = :table_name AND column_name = :column_name
        """), {"table_name": table_name, "column_name": column_name})
        col_type = col_result.scalar()

        if col_type is None:
            print(f"Skipping {table_name}.{column_name} - column does not exist")
            continue

        if col_type == 'timestamp with time zone':
            print(f"Skipping {table_name}.{column_name} - already has timezone")
            continue

        if col_type != 'timestamp without time zone':
            print(f"Skipping {table_name}.{column_name} - unexpected type: {col_type}")
            continue

        # Convertir la colonne en utilisant ALTER TABLE ... TYPE ... USING
        # La clause USING convertit les données existantes en UTC
        print(f"Converting {table_name}.{column_name} to TIMESTAMP WITH TIME ZONE...")
        try:
            conn.execute(sa.text(f"""
                ALTER TABLE {table_name}
                ALTER COLUMN {column_name}
                TYPE TIMESTAMP WITH TIME ZONE
                USING {column_name} AT TIME ZONE 'UTC'
            """))
            print(f"  Successfully converted {table_name}.{column_name}")
        except Exception as e:
            print(f"  Error converting {table_name}.{column_name}: {e}")
            raise


def downgrade():
    """
    Revenir à TIMESTAMP WITHOUT TIME ZONE.
    Note: Cette opération peut perdre des informations de timezone.
    """
    conn = op.get_bind()

    # Vérifier quelles tables existent
    result = conn.execute(sa.text("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
    """))
    existing_tables = {row[0] for row in result}

    for table_name, column_name in COLUMNS_TO_MIGRATE:
        if table_name not in existing_tables:
            continue

        col_result = conn.execute(sa.text(f"""
            SELECT data_type FROM information_schema.columns
            WHERE table_name = :table_name AND column_name = :column_name
        """), {"table_name": table_name, "column_name": column_name})
        col_type = col_result.scalar()

        if col_type != 'timestamp with time zone':
            continue

        print(f"Reverting {table_name}.{column_name} to TIMESTAMP WITHOUT TIME ZONE...")
        try:
            conn.execute(sa.text(f"""
                ALTER TABLE {table_name}
                ALTER COLUMN {column_name}
                TYPE TIMESTAMP WITHOUT TIME ZONE
                USING {column_name} AT TIME ZONE 'UTC'
            """))
        except Exception as e:
            print(f"  Error reverting {table_name}.{column_name}: {e}")
            raise
