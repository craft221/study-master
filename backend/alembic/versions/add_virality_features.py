"""Add virality features - share_code, guest attempts

Revision ID: add_virality_features
Revises: add_schedule_reminder_columns
Create Date: 2025-12-04

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_virality_features'
down_revision = 'add_schedule_reminder_cols'
branch_labels = None
depends_on = None


def upgrade():
    # Ajouter les colonnes de viralité à la table quizzes
    op.add_column('quizzes', sa.Column('share_code', sa.String(12), nullable=True))
    op.add_column('quizzes', sa.Column('total_plays', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('quizzes', sa.Column('total_shares', sa.Integer(), nullable=True, server_default='0'))

    # Créer un index unique sur share_code
    op.create_index('ix_quizzes_share_code', 'quizzes', ['share_code'], unique=True)

    # Créer la table guest_quiz_attempts
    op.create_table(
        'guest_quiz_attempts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('quiz_id', sa.Integer(), nullable=False),
        sa.Column('guest_name', sa.String(100), nullable=False),
        sa.Column('guest_session_id', sa.String(64), nullable=False),
        sa.Column('answers', sa.JSON(), nullable=False),
        sa.Column('score', sa.Float(), nullable=False, server_default='0'),
        sa.Column('correct_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('total_questions', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('time_taken_seconds', sa.Integer(), nullable=True),
        sa.Column('is_completed', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('referrer_user_id', sa.Integer(), nullable=True),
        sa.Column('converted_to_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['quiz_id'], ['quizzes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['referrer_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['converted_to_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    # Créer des index pour les performances
    op.create_index('ix_guest_quiz_attempts_quiz_id', 'guest_quiz_attempts', ['quiz_id'])
    op.create_index('ix_guest_quiz_attempts_session_id', 'guest_quiz_attempts', ['guest_session_id'])
    op.create_index('ix_guest_quiz_attempts_score', 'guest_quiz_attempts', ['score'])


def downgrade():
    # Supprimer les index
    op.drop_index('ix_guest_quiz_attempts_score', table_name='guest_quiz_attempts')
    op.drop_index('ix_guest_quiz_attempts_session_id', table_name='guest_quiz_attempts')
    op.drop_index('ix_guest_quiz_attempts_quiz_id', table_name='guest_quiz_attempts')

    # Supprimer la table
    op.drop_table('guest_quiz_attempts')

    # Supprimer les colonnes de quizzes
    op.drop_index('ix_quizzes_share_code', table_name='quizzes')
    op.drop_column('quizzes', 'total_shares')
    op.drop_column('quizzes', 'total_plays')
    op.drop_column('quizzes', 'share_code')
