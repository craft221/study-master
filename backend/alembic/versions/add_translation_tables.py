"""Add achievement_translations and quest_template_translations tables

Revision ID: add_translation_tables
Revises: merge_heads_for_translations
Create Date: 2026-04-27

Creates two i18n tables to localize gamification content:
- achievement_translations: name + description per (achievement_id, language)
- quest_template_translations: title + description per (quest_type, difficulty, language)

Seeding is performed by `backend/seed_translations.py` (separate, idempotent script),
not in this migration, to keep schema and data concerns separate and to make
re-seeding cheap.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_translation_tables'
down_revision = 'merge_heads_for_translations'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'achievement_translations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('achievement_id', sa.Integer(), nullable=False),
        sa.Column('language', sa.String(length=8), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ['achievement_id'], ['achievements.id'], ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'achievement_id', 'language', name='uq_achievement_translation_lang'
        ),
    )
    op.create_index(
        op.f('ix_achievement_translations_id'),
        'achievement_translations',
        ['id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_achievement_translations_achievement_id'),
        'achievement_translations',
        ['achievement_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_achievement_translations_language'),
        'achievement_translations',
        ['language'],
        unique=False,
    )

    op.create_table(
        'quest_template_translations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('quest_type', sa.String(length=50), nullable=False),
        sa.Column('difficulty', sa.String(length=20), nullable=False),
        sa.Column('language', sa.String(length=8), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'quest_type',
            'difficulty',
            'language',
            name='uq_quest_template_translation',
        ),
    )
    op.create_index(
        op.f('ix_quest_template_translations_id'),
        'quest_template_translations',
        ['id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_quest_template_translations_quest_type'),
        'quest_template_translations',
        ['quest_type'],
        unique=False,
    )
    op.create_index(
        op.f('ix_quest_template_translations_difficulty'),
        'quest_template_translations',
        ['difficulty'],
        unique=False,
    )
    op.create_index(
        op.f('ix_quest_template_translations_language'),
        'quest_template_translations',
        ['language'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_quest_template_translations_language'),
        table_name='quest_template_translations',
    )
    op.drop_index(
        op.f('ix_quest_template_translations_difficulty'),
        table_name='quest_template_translations',
    )
    op.drop_index(
        op.f('ix_quest_template_translations_quest_type'),
        table_name='quest_template_translations',
    )
    op.drop_index(
        op.f('ix_quest_template_translations_id'),
        table_name='quest_template_translations',
    )
    op.drop_table('quest_template_translations')

    op.drop_index(
        op.f('ix_achievement_translations_language'),
        table_name='achievement_translations',
    )
    op.drop_index(
        op.f('ix_achievement_translations_achievement_id'),
        table_name='achievement_translations',
    )
    op.drop_index(
        op.f('ix_achievement_translations_id'),
        table_name='achievement_translations',
    )
    op.drop_table('achievement_translations')
