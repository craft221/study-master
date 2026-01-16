"""Add document_ids to exam_sessions for document support

Revision ID: add_document_ids_exam
Revises: add_ai_tasks
Create Date: 2026-01-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_document_ids_exam'
down_revision = 'add_ai_tasks'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Check if column already exists
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'exam_sessions' AND column_name = 'document_ids'
    """))

    if not result.fetchone():
        op.add_column('exam_sessions',
            sa.Column('document_ids', postgresql.JSON(astext_type=sa.Text()),
                      nullable=True, server_default='[]')
        )
        print("Added document_ids column to exam_sessions")
    else:
        print("Column document_ids already exists in exam_sessions")


def downgrade():
    op.drop_column('exam_sessions', 'document_ids')
