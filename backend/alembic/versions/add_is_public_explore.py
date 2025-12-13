"""Add is_public to notes and flashcards for Explore feature

Revision ID: add_is_public_explore
Revises: recalculate_levels
Create Date: 2024-12-12

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_is_public_explore'
down_revision: Union[str, None] = 'recalculate_levels'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_public to notes
    op.add_column('notes', sa.Column('is_public', sa.Boolean(), nullable=True, server_default='false'))

    # Add is_public to flashcards
    op.add_column('flashcards', sa.Column('is_public', sa.Boolean(), nullable=True, server_default='false'))

    # Create indexes for faster public content queries
    op.create_index('ix_notes_is_public', 'notes', ['is_public'], unique=False)
    op.create_index('ix_flashcards_is_public', 'flashcards', ['is_public'], unique=False)
    op.create_index('ix_quizzes_is_public', 'quizzes', ['is_public'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_quizzes_is_public', table_name='quizzes')
    op.drop_index('ix_flashcards_is_public', table_name='flashcards')
    op.drop_index('ix_notes_is_public', table_name='notes')
    op.drop_column('flashcards', 'is_public')
    op.drop_column('notes', 'is_public')
