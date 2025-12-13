"""Add leagues and social share tables

Revision ID: add_leagues_social
Revises: add_daily_quests_tables
Create Date: 2024-12-11

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_leagues_social'
down_revision: Union[str, None] = 'add_daily_quests'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # =========================================================================
    # TABLE: user_leagues
    # =========================================================================
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_leagues (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            current_tier VARCHAR(20) NOT NULL DEFAULT 'bronze',
            weekly_xp INTEGER NOT NULL DEFAULT 0,
            current_rank INTEGER,
            highest_tier_reached VARCHAR(20) NOT NULL DEFAULT 'bronze',
            weeks_in_current_tier INTEGER NOT NULL DEFAULT 0,
            total_promotions INTEGER NOT NULL DEFAULT 0,
            total_demotions INTEGER NOT NULL DEFAULT 0,
            joined_league_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            last_promotion_at TIMESTAMP WITH TIME ZONE,
            last_demotion_at TIMESTAMP WITH TIME ZONE,
            UNIQUE(user_id)
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_user_leagues_tier_xp ON user_leagues(current_tier, weekly_xp)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_leagues_user_id ON user_leagues(user_id)")

    # =========================================================================
    # TABLE: leaderboard_entries
    # =========================================================================
    op.execute("""
        CREATE TABLE IF NOT EXISTS leaderboard_entries (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            leaderboard_type VARCHAR(20) NOT NULL,
            period VARCHAR(20) NOT NULL,
            period_key VARCHAR(20) NOT NULL,
            score INTEGER NOT NULL DEFAULT 0,
            rank INTEGER,
            league_tier VARCHAR(20),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_leaderboard_entries_lookup ON leaderboard_entries(leaderboard_type, period, period_key)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_leaderboard_entries_ranking ON leaderboard_entries(leaderboard_type, period, period_key, score)")

    # =========================================================================
    # TABLE: league_history
    # =========================================================================
    op.execute("""
        CREATE TABLE IF NOT EXISTS league_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            from_tier VARCHAR(20) NOT NULL,
            to_tier VARCHAR(20) NOT NULL,
            period_key VARCHAR(20) NOT NULL,
            final_rank INTEGER,
            final_xp INTEGER,
            is_promotion BOOLEAN NOT NULL,
            changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_league_history_user ON league_history(user_id, changed_at)")

    # =========================================================================
    # TABLE: social_shares
    # =========================================================================
    op.execute("""
        CREATE TABLE IF NOT EXISTS social_shares (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            share_type VARCHAR(30) NOT NULL,
            platform VARCHAR(20) NOT NULL,
            content_data JSONB,
            share_url VARCHAR(500),
            share_image_url VARCHAR(500),
            share_code VARCHAR(50) NOT NULL UNIQUE,
            clicks INTEGER NOT NULL DEFAULT 0,
            conversions INTEGER NOT NULL DEFAULT 0,
            shared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_social_shares_user_type ON social_shares(user_id, share_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_social_shares_code ON social_shares(share_code)")

    # =========================================================================
    # TABLE: share_stats
    # =========================================================================
    op.execute("""
        CREATE TABLE IF NOT EXISTS share_stats (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            whatsapp_shares INTEGER NOT NULL DEFAULT 0,
            twitter_shares INTEGER NOT NULL DEFAULT 0,
            facebook_shares INTEGER NOT NULL DEFAULT 0,
            instagram_shares INTEGER NOT NULL DEFAULT 0,
            linkedin_shares INTEGER NOT NULL DEFAULT 0,
            telegram_shares INTEGER NOT NULL DEFAULT 0,
            other_shares INTEGER NOT NULL DEFAULT 0,
            total_shares INTEGER NOT NULL DEFAULT 0,
            total_clicks INTEGER NOT NULL DEFAULT 0,
            total_conversions INTEGER NOT NULL DEFAULT 0,
            share_badges JSONB NOT NULL DEFAULT '[]'::jsonb,
            first_share_at TIMESTAMP WITH TIME ZONE,
            last_share_at TIMESTAMP WITH TIME ZONE,
            UNIQUE(user_id)
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_share_stats_user_id ON share_stats(user_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS share_stats CASCADE")
    op.execute("DROP TABLE IF EXISTS social_shares CASCADE")
    op.execute("DROP TABLE IF EXISTS league_history CASCADE")
    op.execute("DROP TABLE IF EXISTS leaderboard_entries CASCADE")
    op.execute("DROP TABLE IF EXISTS user_leagues CASCADE")
