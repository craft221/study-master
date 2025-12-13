"""Add MFA fields to users table

Revision ID: add_mfa_fields
Revises: (auto)
Create Date: 2025-12-13

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_mfa_fields'
down_revision = 'add_is_public_explore'  # Previous head migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add MFA/2FA fields to users table"""

    # Add MFA columns to users table
    op.add_column('users', sa.Column('mfa_enabled', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('users', sa.Column('mfa_secret', sa.String(32), nullable=True))
    op.add_column('users', sa.Column('mfa_backup_codes', sa.JSON(), nullable=True))
    op.add_column('users', sa.Column('mfa_verified_at', sa.DateTime(timezone=True), nullable=True))

    # Set default value for existing rows
    op.execute("UPDATE users SET mfa_enabled = false WHERE mfa_enabled IS NULL")

    # Make mfa_enabled non-nullable after setting defaults
    op.alter_column('users', 'mfa_enabled', nullable=False, server_default='false')


def downgrade() -> None:
    """Remove MFA fields from users table"""

    op.drop_column('users', 'mfa_verified_at')
    op.drop_column('users', 'mfa_backup_codes')
    op.drop_column('users', 'mfa_secret')
    op.drop_column('users', 'mfa_enabled')
