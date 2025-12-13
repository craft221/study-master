"""Add quiz stats columns

Revision ID: add_quiz_stats_columns
Revises: add_virality_features
Create Date: 2025-12-04

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_quiz_stats_columns'
down_revision = 'add_virality_features'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Check which columns exist
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'quizzes'
    """))
    existing_columns = [row[0] for row in result]

    # Add missing columns
    if 'ai_prompt_used' not in existing_columns:
        op.add_column('quizzes', sa.Column('ai_prompt_used', sa.Text(), nullable=True))
    if 'is_published' not in existing_columns:
        op.add_column('quizzes', sa.Column('is_published', sa.Boolean(), server_default='false', nullable=True))
    if 'published_at' not in existing_columns:
        op.add_column('quizzes', sa.Column('published_at', sa.DateTime(), nullable=True))
    if 'total_attempts' not in existing_columns:
        op.add_column('quizzes', sa.Column('total_attempts', sa.Integer(), server_default='0', nullable=True))
    if 'average_score' not in existing_columns:
        op.add_column('quizzes', sa.Column('average_score', sa.Float(), server_default='0', nullable=True))
    if 'highest_score' not in existing_columns:
        op.add_column('quizzes', sa.Column('highest_score', sa.Float(), server_default='0', nullable=True))
    if 'completion_rate' not in existing_columns:
        op.add_column('quizzes', sa.Column('completion_rate', sa.Float(), server_default='0', nullable=True))


def downgrade():
    op.drop_column('quizzes', 'completion_rate')
    op.drop_column('quizzes', 'highest_score')
    op.drop_column('quizzes', 'average_score')
    op.drop_column('quizzes', 'total_attempts')
    op.drop_column('quizzes', 'published_at')
    op.drop_column('quizzes', 'is_published')
    op.drop_column('quizzes', 'ai_prompt_used')
