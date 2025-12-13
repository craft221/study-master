"""Add daily quests tables

Revision ID: add_daily_quests
Revises: add_payment_tables
Create Date: 2025-12-12

Tables créées:
- daily_quests: Objectifs quotidiens style Duolingo
- daily_quest_streaks: Suivi des séries d'objectifs complétés
- mystery_chests: Coffres mystère gagnés
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'add_daily_quests'
down_revision = 'add_payment_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Créer les types ENUM
    quest_type_enum = postgresql.ENUM(
        'review_flashcards', 'complete_quiz', 'study_minutes', 'earn_xp',
        'maintain_streak', 'create_notes', 'create_flashcards', 'win_duel',
        'join_focus_room', 'perfect_quiz',
        name='questtype',
        create_type=False
    )

    quest_difficulty_enum = postgresql.ENUM(
        'easy', 'medium', 'hard',
        name='questdifficulty',
        create_type=False
    )

    quest_status_enum = postgresql.ENUM(
        'pending', 'in_progress', 'completed', 'claimed', 'expired',
        name='queststatus',
        create_type=False
    )

    # Créer les types dans la base
    quest_type_enum.create(op.get_bind(), checkfirst=True)
    quest_difficulty_enum.create(op.get_bind(), checkfirst=True)
    quest_status_enum.create(op.get_bind(), checkfirst=True)

    # Table daily_quests - Objectifs quotidiens
    op.create_table(
        'daily_quests',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),

        # Type et difficulté
        sa.Column('quest_type', quest_type_enum, nullable=False),
        sa.Column('difficulty', quest_difficulty_enum, nullable=False),

        # Description
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(50), default='🎯'),

        # Objectif
        sa.Column('target_value', sa.Integer(), nullable=False),  # Ex: 10 flashcards
        sa.Column('current_value', sa.Integer(), default=0),      # Progression actuelle

        # Récompense
        sa.Column('xp_reward', sa.Integer(), nullable=False),
        sa.Column('bonus_reward', sa.JSON(), nullable=True),  # {"type": "chest", "rarity": "common"}

        # Statut
        sa.Column('status', quest_status_enum, default='pending', index=True),

        # Date
        sa.Column('quest_date', sa.DateTime(timezone=True), nullable=False, index=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('claimed_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Table daily_quest_streaks - Suivi des séries
    op.create_table(
        'daily_quest_streaks',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, unique=True),

        # Série actuelle
        sa.Column('current_streak', sa.Integer(), default=0),  # Jours consécutifs avec 3/3
        sa.Column('longest_streak', sa.Integer(), default=0),

        # Stats
        sa.Column('total_quests_completed', sa.Integer(), default=0),
        sa.Column('total_bonus_claimed', sa.Integer(), default=0),  # Jours avec bonus 3/3
        sa.Column('total_xp_from_quests', sa.Integer(), default=0),

        # Dernier jour complété (3/3)
        sa.Column('last_perfect_day', sa.DateTime(timezone=True), nullable=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Table mystery_chests - Coffres mystère
    op.create_table(
        'mystery_chests',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),

        # Type de coffre
        sa.Column('rarity', sa.String(50), nullable=False),  # common, rare, epic, legendary
        sa.Column('source', sa.String(100), nullable=False),  # daily_quest, streak_milestone, etc.

        # Contenu (révélé à l'ouverture)
        sa.Column('contents', sa.JSON(), nullable=True),  # {"xp": 100, "accessory": "crown"}

        # Statut
        sa.Column('is_opened', sa.Boolean(), default=False),
        sa.Column('opened_at', sa.DateTime(timezone=True), nullable=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Créer les index (if_not_exists pour éviter les erreurs)
    from sqlalchemy import text
    conn = op.get_bind()
    conn.execute(text('CREATE INDEX IF NOT EXISTS ix_daily_quests_user_date ON daily_quests (user_id, quest_date)'))
    conn.execute(text('CREATE INDEX IF NOT EXISTS ix_daily_quests_status ON daily_quests (status)'))
    conn.execute(text('CREATE INDEX IF NOT EXISTS ix_mystery_chests_user_opened ON mystery_chests (user_id, is_opened)'))


def downgrade() -> None:
    # Supprimer les tables
    op.drop_table('mystery_chests')
    op.drop_table('daily_quest_streaks')
    op.drop_table('daily_quests')

    # Supprimer les types ENUM
    op.execute('DROP TYPE IF EXISTS queststatus')
    op.execute('DROP TYPE IF EXISTS questdifficulty')
    op.execute('DROP TYPE IF EXISTS questtype')
