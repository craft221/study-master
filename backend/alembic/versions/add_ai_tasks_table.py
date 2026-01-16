"""Add ai_tasks table for background AI processing

Revision ID: add_ai_tasks
Revises: add_language_reports
Create Date: 2025-01-14

Tables créées:
- ai_tasks: Suivi des tâches IA en arrière-plan (génération flashcards/quiz depuis documents)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'add_ai_tasks'
down_revision = 'add_language_reports'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Table ai_tasks - Tâches IA en arrière-plan
    op.create_table(
        'ai_tasks',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),

        # Type et statut
        sa.Column('task_type', sa.String(50), nullable=False, index=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending', index=True),

        # Source (document ou note)
        sa.Column('source_type', sa.String(20), nullable=False),
        sa.Column('source_id', sa.Integer(), nullable=False),
        sa.Column('source_title', sa.String(255), nullable=True),

        # Paramètres de la tâche
        sa.Column('params', postgresql.JSON, nullable=True),

        # Progression
        sa.Column('progress', sa.Integer(), server_default='0'),
        sa.Column('progress_message', sa.String(255), nullable=True),

        # Résultat
        sa.Column('result', postgresql.JSON, nullable=True),
        sa.Column('result_count', sa.Integer(), nullable=True),

        # Erreur éventuelle
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('error_code', sa.String(50), nullable=True),

        # Statistiques
        sa.Column('text_extracted_length', sa.Integer(), nullable=True),
        sa.Column('processing_time_seconds', sa.Integer(), nullable=True),

        # Timestamps
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Index composé pour recherche rapide des tâches récentes d'un utilisateur
    op.create_index('ix_ai_tasks_user_created', 'ai_tasks', ['user_id', 'created_at'])


def downgrade() -> None:
    op.drop_index('ix_ai_tasks_user_created', table_name='ai_tasks')
    op.drop_table('ai_tasks')
