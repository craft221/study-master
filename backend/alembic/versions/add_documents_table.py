"""Add documents table for file management per subject

Revision ID: add_documents_table
Revises: add_user_submodels_tables
Create Date: 2025-12-06

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_documents_table'
down_revision = 'add_user_submodels_tables'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Check which tables already exist
    result = conn.execute(sa.text("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
    """))
    existing_tables = [row[0] for row in result]

    # ==================== DOCUMENTS TABLE ====================
    if 'documents' not in existing_tables:
        # Check if enum type exists
        enum_result = conn.execute(sa.text("""
            SELECT 1 FROM pg_type WHERE typname = 'documenttype'
        """))
        if not enum_result.fetchone():
            conn.execute(sa.text("CREATE TYPE documenttype AS ENUM ('pdf', 'word', 'excel', 'powerpoint', 'image', 'other')"))

        op.create_table('documents',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('original_filename', sa.String(255), nullable=False),
            sa.Column('stored_filename', sa.String(255), nullable=False),
            sa.Column('file_type', sa.String(50), nullable=False),
            sa.Column('mime_type', sa.String(100), nullable=False),
            sa.Column('file_size', sa.BigInteger(), nullable=False),
            sa.Column('file_extension', sa.String(20), nullable=False),
            sa.Column('storage_path', sa.String(500), nullable=False),
            sa.Column('title', sa.String(255), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('subject_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('is_favorite', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('is_archived', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('extracted_text', sa.Text(), nullable=True),
            sa.Column('is_text_extracted', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('download_count', sa.Integer(), server_default='0', nullable=False),
            sa.Column('view_count', sa.Integer(), server_default='0', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_documents_id', 'documents', ['id'])
        op.create_index('ix_documents_user_id', 'documents', ['user_id'])
        op.create_index('ix_documents_subject_id', 'documents', ['subject_id'])
        op.create_index('ix_documents_stored_filename', 'documents', ['stored_filename'], unique=True)
        op.create_index('ix_documents_file_type', 'documents', ['file_type'])
        op.create_index('ix_documents_is_favorite', 'documents', ['is_favorite'])
        op.create_index('ix_documents_is_archived', 'documents', ['is_archived'])

    # ==================== ADD total_documents_count TO SUBJECTS ====================
    # Check if column exists
    column_result = conn.execute(sa.text("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subjects' AND column_name = 'total_documents_count'
    """))
    if not column_result.fetchone():
        op.add_column('subjects', sa.Column('total_documents_count', sa.Integer(), server_default='0', nullable=True))


def downgrade():
    # Drop indexes first
    op.drop_index('ix_documents_is_archived', table_name='documents')
    op.drop_index('ix_documents_is_favorite', table_name='documents')
    op.drop_index('ix_documents_file_type', table_name='documents')
    op.drop_index('ix_documents_stored_filename', table_name='documents')
    op.drop_index('ix_documents_subject_id', table_name='documents')
    op.drop_index('ix_documents_user_id', table_name='documents')
    op.drop_index('ix_documents_id', table_name='documents')

    # Drop table
    op.drop_table('documents')

    # Remove column from subjects
    op.drop_column('subjects', 'total_documents_count')

    # Drop enum type
    conn = op.get_bind()
    conn.execute(sa.text("DROP TYPE IF EXISTS documenttype"))
