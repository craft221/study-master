"""add_spark_quota_columns

Revision ID: 2c8f66565adf
Revises: add_exam_mode_tables
Create Date: 2025-12-19 19:20:46.753310

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2c8f66565adf'
down_revision = 'add_exam_mode_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add Spark quota columns to user_ai_usage table."""
    # Add columns for Spark hybrid quota system
    op.add_column('user_ai_usage',
        sa.Column('spark_chat_today', sa.Integer(), nullable=True, server_default='0')
    )
    op.add_column('user_ai_usage',
        sa.Column('spark_tutor_today', sa.Integer(), nullable=True, server_default='0')
    )
    op.add_column('user_ai_usage',
        sa.Column('spark_ask_today', sa.Integer(), nullable=True, server_default='0')
    )


def downgrade() -> None:
    """Remove Spark quota columns from user_ai_usage table."""
    op.drop_column('user_ai_usage', 'spark_ask_today')
    op.drop_column('user_ai_usage', 'spark_tutor_today')
    op.drop_column('user_ai_usage', 'spark_chat_today')
