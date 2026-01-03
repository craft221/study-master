"""Add language field and content_reports table

Revision ID: add_language_reports
Revises: add_is_public_explore
Create Date: 2024-12-20

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_language_reports'
down_revision = '2c8f66565adf'
branch_labels = None
depends_on = None


def upgrade():
    # Ajouter le champ language aux tables existantes (flashcard_decks n'existe pas, on utilise flashcards)
    op.add_column('notes', sa.Column('language', sa.String(5), nullable=True, server_default='fr'))
    op.add_column('flashcards', sa.Column('language', sa.String(5), nullable=True, server_default='fr'))
    op.add_column('quizzes', sa.Column('language', sa.String(5), nullable=True, server_default='fr'))

    # Créer la table content_reports
    op.create_table(
        'content_reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('reporter_id', sa.Integer(), nullable=False),
        sa.Column('content_type', sa.String(20), nullable=False),
        sa.Column('content_id', sa.Integer(), nullable=False),
        sa.Column('content_title', sa.String(255), nullable=True),
        sa.Column('content_owner_id', sa.Integer(), nullable=True),
        sa.Column('reason', sa.String(20), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('moderator_id', sa.Integer(), nullable=True),
        sa.Column('moderator_notes', sa.Text(), nullable=True),
        sa.Column('action_taken', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['reporter_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['content_owner_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['moderator_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_content_reports_id', 'content_reports', ['id'], unique=False)
    op.create_index('ix_content_reports_content', 'content_reports', ['content_type', 'content_id'], unique=False)
    op.create_index('ix_content_reports_status', 'content_reports', ['status'], unique=False)


def downgrade():
    # Supprimer la table content_reports
    op.drop_index('ix_content_reports_status', table_name='content_reports')
    op.drop_index('ix_content_reports_content', table_name='content_reports')
    op.drop_index('ix_content_reports_id', table_name='content_reports')
    op.drop_table('content_reports')

    # Supprimer les colonnes language
    op.drop_column('quizzes', 'language')
    op.drop_column('flashcards', 'language')
    op.drop_column('notes', 'language')
