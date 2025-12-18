"""Add study group invitations table

Revision ID: add_study_group_invitations
Revises: add_leagues_and_social_share_tables
Create Date: 2025-01-10

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_study_group_invitations'
down_revision = 'add_leagues_social'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the study_group_invitations table if it doesn't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS study_group_invitations (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
            inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            invitee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            message TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            responded_at TIMESTAMP WITH TIME ZONE
        )
    """)

    # Create indexes for better query performance
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_study_group_invitations_group_id
        ON study_group_invitations(group_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_study_group_invitations_invitee_id
        ON study_group_invitations(invitee_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_study_group_invitations_status
        ON study_group_invitations(status)
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS study_group_invitations CASCADE")
