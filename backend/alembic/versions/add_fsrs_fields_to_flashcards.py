"""Add FSRS (Free Spaced Repetition Scheduler) fields to flashcards table

This migration adds the new FSRS algorithm fields to the flashcards table:
- stability: Memory stability (days until 90% recall probability)
- fsrs_difficulty: Intrinsic difficulty of the card (1-10)
- lapses: Number of times the card was forgotten

FSRS is a modern spaced repetition algorithm that offers ~30% fewer reviews
for the same retention rate compared to SM-2.

Revision ID: add_fsrs_fields
Revises: 1b50340c48fc
Create Date: 2024-12-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_fsrs_fields'
down_revision = '1b50340c48fc'  # Last migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add FSRS fields to flashcards table."""

    # Add stability column
    # Represents how long (in days) until the memory's retrievability falls to 90%
    op.add_column(
        'flashcards',
        sa.Column('stability', sa.Float(), nullable=True, server_default='0.0')
    )

    # Add fsrs_difficulty column
    # Intrinsic difficulty of the card (scale 1-10)
    op.add_column(
        'flashcards',
        sa.Column('fsrs_difficulty', sa.Float(), nullable=True, server_default='5.0')
    )

    # Add lapses column
    # Number of times the card was forgotten (answered "Again")
    op.add_column(
        'flashcards',
        sa.Column('lapses', sa.Integer(), nullable=True, server_default='0')
    )

    # Migrate existing data: Convert SM-2 ease_factor to FSRS fields
    # ease_factor (1.3-3.0) -> fsrs_difficulty (1-10)
    # Higher ease_factor = easier card = lower difficulty
    op.execute("""
        UPDATE flashcards
        SET
            fsrs_difficulty = GREATEST(1.0, LEAST(10.0, 11.0 - (ease_factor * 3))),
            stability = GREATEST(0.1, interval * 0.9),
            lapses = times_seen_as_again
        WHERE stability IS NULL OR stability = 0
    """)


def downgrade() -> None:
    """Remove FSRS fields from flashcards table."""
    op.drop_column('flashcards', 'lapses')
    op.drop_column('flashcards', 'fsrs_difficulty')
    op.drop_column('flashcards', 'stability')
