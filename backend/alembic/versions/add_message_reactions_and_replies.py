"""Add message reactions, replies, and mentions

Revision ID: add_message_reactions_and_replies
Revises: add_group_collaboration_tables
Create Date: 2025-01-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_message_reactions_and_replies'
down_revision = 'add_group_collaboration_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add reply_to_message_id and mentions columns to group_messages
    op.add_column('group_messages', sa.Column('reply_to_message_id', sa.Integer(), nullable=True))
    op.add_column('group_messages', sa.Column('mentions', sa.JSON(), nullable=True))

    # Create foreign key for reply_to_message_id
    op.create_foreign_key(
        'fk_group_messages_reply_to',
        'group_messages',
        'group_messages',
        ['reply_to_message_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Create index for reply_to_message_id
    op.create_index('ix_group_messages_reply_to', 'group_messages', ['reply_to_message_id'])

    # Create message_reactions table
    op.create_table(
        'message_reactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('message_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('emoji', sa.String(10), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['message_id'], ['group_messages.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
    )

    # Create indexes for message_reactions
    op.create_index('ix_message_reactions_id', 'message_reactions', ['id'])
    op.create_index('ix_message_reactions_message_id', 'message_reactions', ['message_id'])
    op.create_index('ix_message_reactions_user_id', 'message_reactions', ['user_id'])

    # Create unique constraint to prevent duplicate reactions from same user
    op.create_unique_constraint(
        'uq_message_user_emoji',
        'message_reactions',
        ['message_id', 'user_id', 'emoji']
    )


def downgrade() -> None:
    # Drop message_reactions table
    op.drop_table('message_reactions')

    # Drop reply_to_message_id foreign key and column
    op.drop_constraint('fk_group_messages_reply_to', 'group_messages', type_='foreignkey')
    op.drop_index('ix_group_messages_reply_to', 'group_messages')
    op.drop_column('group_messages', 'reply_to_message_id')

    # Drop mentions column
    op.drop_column('group_messages', 'mentions')
