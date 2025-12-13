"""Add missing columns to quiz_attempts table

Revision ID: add_quiz_attempt_columns
Revises: convert_timestamps_to_timezone
Create Date: 2025-12-07

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_quiz_attempt_columns'
down_revision = 'convert_timestamps_to_timezone'
branch_labels = None
depends_on = None


def upgrade():
    # Ajouter les nouvelles colonnes à quiz_attempts

    # Numéro de tentative
    op.add_column('quiz_attempts', sa.Column('attempt_number', sa.Integer(), nullable=True, server_default='1'))

    # Points et passage
    op.add_column('quiz_attempts', sa.Column('points_earned', sa.Integer(), nullable=True))
    op.add_column('quiz_attempts', sa.Column('points_possible', sa.Integer(), nullable=True))
    op.add_column('quiz_attempts', sa.Column('is_passed', sa.Boolean(), nullable=True))

    # Temps
    op.add_column('quiz_attempts', sa.Column('time_started', sa.DateTime(timezone=True), nullable=True))
    op.add_column('quiz_attempts', sa.Column('time_completed', sa.DateTime(timezone=True), nullable=True))

    # Statut
    op.add_column('quiz_attempts', sa.Column('is_completed', sa.Boolean(), nullable=True, server_default='true'))
    op.add_column('quiz_attempts', sa.Column('is_abandoned', sa.Boolean(), nullable=True, server_default='false'))

    # Feedback IA
    op.add_column('quiz_attempts', sa.Column('ai_feedback', sa.Text(), nullable=True))
    op.add_column('quiz_attempts', sa.Column('strengths', sa.JSON(), nullable=True))
    op.add_column('quiz_attempts', sa.Column('weaknesses', sa.JSON(), nullable=True))
    op.add_column('quiz_attempts', sa.Column('recommendations', sa.JSON(), nullable=True))

    # Ajout de created_at si elle n'existe pas
    op.add_column('quiz_attempts', sa.Column('created_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()))


def downgrade():
    # Supprimer les colonnes ajoutées
    op.drop_column('quiz_attempts', 'created_at')
    op.drop_column('quiz_attempts', 'recommendations')
    op.drop_column('quiz_attempts', 'weaknesses')
    op.drop_column('quiz_attempts', 'strengths')
    op.drop_column('quiz_attempts', 'ai_feedback')
    op.drop_column('quiz_attempts', 'is_abandoned')
    op.drop_column('quiz_attempts', 'is_completed')
    op.drop_column('quiz_attempts', 'time_completed')
    op.drop_column('quiz_attempts', 'time_started')
    op.drop_column('quiz_attempts', 'is_passed')
    op.drop_column('quiz_attempts', 'points_possible')
    op.drop_column('quiz_attempts', 'points_earned')
    op.drop_column('quiz_attempts', 'attempt_number')
