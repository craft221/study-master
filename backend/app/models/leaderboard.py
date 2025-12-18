"""
Modèles pour les Classements et Ligues
======================================

Système de compétition avec:
- Leaderboards hebdomadaires/mensuels
- Ligues (Bronze, Argent, Or, Diamant, Maître)
- Historique des positions
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, JSON, Index
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.datetime_utils import utc_now


class LeagueTier(str, Enum):
    """Niveaux de ligue"""
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    DIAMOND = "diamond"
    MASTER = "master"


class LeaderboardPeriod(str, Enum):
    """Périodes de classement"""
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    ALL_TIME = "all_time"


class LeaderboardType(str, Enum):
    """Types de classement"""
    XP = "xp"
    STREAK = "streak"
    QUIZZES = "quizzes"
    FLASHCARDS = "flashcards"
    STUDY_TIME = "study_time"


# Configuration des ligues
LEAGUE_CONFIG = {
    LeagueTier.BRONZE: {
        "name": "Bronze",
        "min_xp": 0,
        "color": "#CD7F32",
        "icon": "🥉",
        "promotion_slots": 10,  # Top 10 montent
        "demotion_slots": 0,    # Personne ne descend
    },
    LeagueTier.SILVER: {
        "name": "Argent",
        "min_xp": 500,
        "color": "#C0C0C0",
        "icon": "🥈",
        "promotion_slots": 10,
        "demotion_slots": 5,    # Bottom 5 descendent
    },
    LeagueTier.GOLD: {
        "name": "Or",
        "min_xp": 2000,
        "color": "#FFD700",
        "icon": "🥇",
        "promotion_slots": 5,
        "demotion_slots": 5,
    },
    LeagueTier.DIAMOND: {
        "name": "Diamant",
        "min_xp": 5000,
        "color": "#B9F2FF",
        "icon": "💎",
        "promotion_slots": 3,
        "demotion_slots": 5,
    },
    LeagueTier.MASTER: {
        "name": "Maître",
        "min_xp": 15000,
        "color": "#9B59B6",
        "icon": "👑",
        "promotion_slots": 0,   # Déjà au top
        "demotion_slots": 10,
    },
}


class UserLeague(Base):
    """Position de l'utilisateur dans sa ligue"""
    __tablename__ = "user_leagues"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    # Ligue actuelle
    current_tier = Column(String(20), default="bronze", nullable=False)

    # XP de la semaine en cours (reset chaque lundi)
    weekly_xp = Column(Integer, default=0, nullable=False)

    # Position dans la ligue
    current_rank = Column(Integer, nullable=True)

    # Historique
    highest_tier_reached = Column(String(20), default="bronze", nullable=False)
    weeks_in_current_tier = Column(Integer, default=0, nullable=False)
    total_promotions = Column(Integer, default=0, nullable=False)
    total_demotions = Column(Integer, default=0, nullable=False)

    # Timestamps
    joined_league_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    last_promotion_at = Column(DateTime(timezone=True), nullable=True)
    last_demotion_at = Column(DateTime(timezone=True), nullable=True)

    # Relations
    user = relationship("User", back_populates="league")

    __table_args__ = (
        Index("ix_user_leagues_tier_xp", "current_tier", "weekly_xp"),
    )

    @property
    def tier_config(self):
        """Retourne la configuration de la ligue actuelle"""
        tier_enum = LeagueTier(self.current_tier)
        return LEAGUE_CONFIG[tier_enum]

    @property
    def next_tier(self) -> Optional[LeagueTier]:
        """Retourne la prochaine ligue"""
        tiers = list(LeagueTier)
        current_enum = LeagueTier(self.current_tier)
        current_idx = tiers.index(current_enum)
        if current_idx < len(tiers) - 1:
            return tiers[current_idx + 1]
        return None

    @property
    def previous_tier(self) -> Optional[LeagueTier]:
        """Retourne la ligue précédente"""
        tiers = list(LeagueTier)
        current_enum = LeagueTier(self.current_tier)
        current_idx = tiers.index(current_enum)
        if current_idx > 0:
            return tiers[current_idx - 1]
        return None


class LeaderboardEntry(Base):
    """Entrée dans un classement (snapshot périodique)"""
    __tablename__ = "leaderboard_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Type et période
    leaderboard_type = Column(String(20), nullable=False)
    period = Column(String(20), nullable=False)

    # Période spécifique (ex: "2024-W01" pour semaine 1, "2024-01" pour janvier)
    period_key = Column(String(20), nullable=False)

    # Score et position
    score = Column(Integer, default=0, nullable=False)
    rank = Column(Integer, nullable=True)

    # Ligue au moment du classement
    league_tier = Column(String(20), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relations
    user = relationship("User")

    __table_args__ = (
        Index("ix_leaderboard_entries_lookup", "leaderboard_type", "period", "period_key"),
        Index("ix_leaderboard_entries_ranking", "leaderboard_type", "period", "period_key", "score"),
    )


class LeagueHistory(Base):
    """Historique des changements de ligue"""
    __tablename__ = "league_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Changement
    from_tier = Column(String(20), nullable=False)
    to_tier = Column(String(20), nullable=False)

    # Contexte
    period_key = Column(String(20), nullable=False)  # ex: "2024-W01"
    final_rank = Column(Integer, nullable=True)
    final_xp = Column(Integer, nullable=True)

    # Promotion ou rétrogradation
    is_promotion = Column(Boolean, nullable=False)

    # Timestamp
    changed_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relations
    user = relationship("User")

    __table_args__ = (
        Index("ix_league_history_user", "user_id", "changed_at"),
    )
