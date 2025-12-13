"""Add Spark Intelligence tables

Tables pour le nouveau système Spark intelligent:
- spark_conversations: Historique des conversations
- spark_messages: Messages dans les conversations
- spark_user_insights: Insights générés par Spark
- spark_notifications: Notifications proactives
- spark_memories: Mémoire long-terme de Spark
- spark_daily_briefings: Briefings quotidiens

Revision ID: add_spark_intelligence
Revises: add_focus_rooms_tables
Create Date: 2024-12-08 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = 'add_spark_intelligence'
down_revision: Union[str, None] = None  # Sera mis à jour automatiquement
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ===========================================================
    # Table: spark_conversations
    # ===========================================================
    op.create_table(
        'spark_conversations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(200), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('context_type', sa.String(50), nullable=True),
        sa.Column('context_data', postgresql.JSON(astext_type=sa.Text()), nullable=True, server_default='{}'),
        sa.Column('message_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('last_message_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('key_topics', postgresql.JSON(astext_type=sa.Text()), nullable=True, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_spark_conversations_id', 'spark_conversations', ['id'], unique=False)
    op.create_index('ix_spark_conversations_user_id', 'spark_conversations', ['user_id'], unique=False)

    # ===========================================================
    # Table: spark_messages
    # ===========================================================
    op.create_table(
        'spark_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('conversation_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),  # 'user', 'spark', 'system'
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('mood', sa.String(30), nullable=True),
        sa.Column('animation', sa.String(50), nullable=True),
        sa.Column('suggestions', postgresql.JSON(astext_type=sa.Text()), nullable=True, server_default='[]'),
        sa.Column('context_snapshot', postgresql.JSON(astext_type=sa.Text()), nullable=True, server_default='{}'),
        sa.Column('was_helpful', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['conversation_id'], ['spark_conversations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_spark_messages_id', 'spark_messages', ['id'], unique=False)
    op.create_index('ix_spark_messages_conversation_id', 'spark_messages', ['conversation_id'], unique=False)

    # ===========================================================
    # Table: spark_user_insights
    # ===========================================================
    op.create_table(
        'spark_user_insights',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('insight_type', sa.String(50), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('data', postgresql.JSON(astext_type=sa.Text()), nullable=True, server_default='{}'),
        sa.Column('confidence', sa.Float(), nullable=True, server_default='0.8'),
        sa.Column('priority', sa.Integer(), nullable=True, server_default='5'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('is_acknowledged', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('valid_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_spark_user_insights_id', 'spark_user_insights', ['id'], unique=False)
    op.create_index('ix_spark_user_insights_user_id', 'spark_user_insights', ['user_id'], unique=False)

    # ===========================================================
    # Table: spark_notifications
    # ===========================================================
    op.create_table(
        'spark_notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('notification_type', sa.String(50), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('mood', sa.String(30), nullable=True, server_default='happy'),
        sa.Column('action_type', sa.String(50), nullable=True),
        sa.Column('action_data', postgresql.JSON(astext_type=sa.Text()), nullable=True, server_default='{}'),
        sa.Column('is_read', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('is_dismissed', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('scheduled_for', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_spark_notifications_id', 'spark_notifications', ['id'], unique=False)
    op.create_index('ix_spark_notifications_user_id', 'spark_notifications', ['user_id'], unique=False)

    # ===========================================================
    # Table: spark_memories
    # ===========================================================
    op.create_table(
        'spark_memories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('memory_type', sa.String(50), nullable=False),
        sa.Column('key', sa.String(100), nullable=False),
        sa.Column('value', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('source', sa.String(50), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True, server_default='0.8'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_spark_memories_id', 'spark_memories', ['id'], unique=False)
    op.create_index('ix_spark_memories_user_id', 'spark_memories', ['user_id'], unique=False)
    op.create_index('ix_spark_memories_key', 'spark_memories', ['key'], unique=False)

    # ===========================================================
    # Table: spark_daily_briefings
    # ===========================================================
    op.create_table(
        'spark_daily_briefings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('briefing_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('greeting', sa.Text(), nullable=False),
        sa.Column('streak_status', postgresql.JSON(astext_type=sa.Text()), nullable=True, server_default='{}'),
        sa.Column('today_goals', postgresql.JSON(astext_type=sa.Text()), nullable=True, server_default='[]'),
        sa.Column('pending_reviews', postgresql.JSON(astext_type=sa.Text()), nullable=True, server_default='{}'),
        sa.Column('upcoming_exams', postgresql.JSON(astext_type=sa.Text()), nullable=True, server_default='[]'),
        sa.Column('achievements_progress', postgresql.JSON(astext_type=sa.Text()), nullable=True, server_default='[]'),
        sa.Column('fun_fact', sa.Text(), nullable=True),
        sa.Column('motivation_quote', sa.Text(), nullable=True),
        sa.Column('mood', sa.String(30), nullable=True, server_default='happy'),
        sa.Column('tone', sa.String(50), nullable=True, server_default='encouraging'),
        sa.Column('is_viewed', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('viewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_spark_daily_briefings_id', 'spark_daily_briefings', ['id'], unique=False)
    op.create_index('ix_spark_daily_briefings_user_id', 'spark_daily_briefings', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_table('spark_daily_briefings')
    op.drop_table('spark_memories')
    op.drop_table('spark_notifications')
    op.drop_table('spark_user_insights')
    op.drop_table('spark_messages')
    op.drop_table('spark_conversations')
