"""merge_spark_and_quiz

Revision ID: 1b50340c48fc
Revises: add_quiz_attempt_columns, add_spark_intelligence
Create Date: 2025-12-08 00:15:58.560159

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1b50340c48fc'
down_revision = ('add_quiz_attempt_columns', 'add_spark_intelligence')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
