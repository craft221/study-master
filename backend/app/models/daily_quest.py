"""
Daily Quests Model - Système d'objectifs quotidiens style Duolingo
====================================================================

Génère 3 objectifs par jour pour chaque utilisateur:
- Objectif facile: 10 XP
- Objectif moyen: 25 XP
- Objectif difficile: 40 XP
- BONUS si les 3 complétés: 50 XP + Coffre mystère

Types d'objectifs:
- Réviser X flashcards
- Compléter un quiz
- Étudier X minutes
- Gagner X XP
- Maintenir son streak
- Créer X notes
- Défier quelqu'un en duel
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, Enum as SQLEnum, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from datetime import datetime, date

from app.core.database import Base
from app.core.datetime_utils import utc_now


class QuestType(enum.Enum):
    """Types d'objectifs quotidiens"""
    REVIEW_FLASHCARDS = "review_flashcards"      # Réviser X flashcards
    COMPLETE_QUIZ = "complete_quiz"              # Compléter X quiz
    STUDY_MINUTES = "study_minutes"              # Étudier X minutes
    EARN_XP = "earn_xp"                          # Gagner X XP
    MAINTAIN_STREAK = "maintain_streak"          # Maintenir son streak
    CREATE_NOTES = "create_notes"                # Créer X notes
    CREATE_FLASHCARDS = "create_flashcards"      # Créer X flashcards
    WIN_DUEL = "win_duel"                        # Gagner un duel
    JOIN_FOCUS_ROOM = "join_focus_room"          # Rejoindre une Focus Room
    PERFECT_QUIZ = "perfect_quiz"                # Obtenir 100% à un quiz


class QuestDifficulty(enum.Enum):
    """Difficulté des objectifs"""
    EASY = "easy"       # 10 XP
    MEDIUM = "medium"   # 25 XP
    HARD = "hard"       # 40 XP


class QuestStatus(enum.Enum):
    """Statut d'un objectif"""
    PENDING = "pending"         # Non commencé
    IN_PROGRESS = "in_progress" # En cours
    COMPLETED = "completed"     # Complété
    CLAIMED = "claimed"         # Récompense réclamée
    EXPIRED = "expired"         # Expiré (jour passé)


class DailyQuest(Base):
    """Modèle d'objectif quotidien"""
    __tablename__ = "daily_quests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Type et difficulté - utiliser les valeurs (minuscules) pour correspondre à PostgreSQL
    quest_type = Column(
        SQLEnum(QuestType, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    difficulty = Column(
        SQLEnum(QuestDifficulty, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )

    # Description
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(50), default="🎯")  # Emoji

    # Objectif
    target_value = Column(Integer, nullable=False)  # Ex: 10 flashcards
    current_value = Column(Integer, default=0)      # Progression actuelle

    # Récompense
    xp_reward = Column(Integer, nullable=False)
    bonus_reward = Column(JSON, nullable=True)  # {"type": "chest", "rarity": "common"}

    # Statut - utiliser les valeurs (minuscules) pour correspondre à PostgreSQL
    status = Column(
        SQLEnum(QuestStatus, values_callable=lambda x: [e.value for e in x]),
        default=QuestStatus.PENDING,
        index=True
    )

    # Date
    quest_date = Column(DateTime(timezone=True), nullable=False, index=True)  # Jour de l'objectif

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    claimed_at = Column(DateTime(timezone=True), nullable=True)

    # Relations
    user = relationship("User", back_populates="daily_quests")


class DailyQuestStreak(Base):
    """Suivi des séries d'objectifs quotidiens complétés"""
    __tablename__ = "daily_quest_streaks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)

    # Série actuelle
    current_streak = Column(Integer, default=0)  # Jours consécutifs avec 3/3
    longest_streak = Column(Integer, default=0)

    # Stats
    total_quests_completed = Column(Integer, default=0)
    total_bonus_claimed = Column(Integer, default=0)  # Jours avec bonus 3/3
    total_xp_from_quests = Column(Integer, default=0)

    # Dernier jour complété (3/3)
    last_perfect_day = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relations
    user = relationship("User", back_populates="quest_streak")


class MysteryChest(Base):
    """Coffres mystère gagnés"""
    __tablename__ = "mystery_chests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Type de coffre
    rarity = Column(String(50), nullable=False)  # common, rare, epic, legendary
    source = Column(String(100), nullable=False)  # daily_quest, streak_milestone, etc.

    # Contenu (révélé à l'ouverture)
    contents = Column(JSON, nullable=True)  # {"xp": 100, "accessory": "crown"}

    # Statut
    is_opened = Column(Boolean, default=False)
    opened_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Coffres temporaires

    # Relations
    user = relationship("User", back_populates="mystery_chests")


# Configuration des quêtes par difficulté
QUEST_CONFIG = {
    QuestDifficulty.EASY: {
        "xp_reward": 10,
        "templates": [
            {
                "type": QuestType.REVIEW_FLASHCARDS,
                "target_range": (5, 10),
                "title": "Révision rapide",
                "description": "Révise {target} flashcards",
                "icon": "🎴"
            },
            {
                "type": QuestType.STUDY_MINUTES,
                "target_range": (10, 15),
                "title": "Mini session",
                "description": "Étudie pendant {target} minutes",
                "icon": "⏱️"
            },
            {
                "type": QuestType.EARN_XP,
                "target_range": (20, 30),
                "title": "Gagne de l'XP",
                "description": "Gagne {target} XP aujourd'hui",
                "icon": "⚡"
            },
            {
                "type": QuestType.MAINTAIN_STREAK,
                "target_range": (1, 1),
                "title": "Garde la flamme",
                "description": "Maintiens ton streak actif",
                "icon": "🔥"
            }
        ]
    },
    QuestDifficulty.MEDIUM: {
        "xp_reward": 25,
        "templates": [
            {
                "type": QuestType.REVIEW_FLASHCARDS,
                "target_range": (15, 25),
                "title": "Session de révision",
                "description": "Révise {target} flashcards",
                "icon": "🎴"
            },
            {
                "type": QuestType.COMPLETE_QUIZ,
                "target_range": (1, 2),
                "title": "Quiz time",
                "description": "Complète {target} quiz",
                "icon": "📝"
            },
            {
                "type": QuestType.STUDY_MINUTES,
                "target_range": (25, 35),
                "title": "Focus session",
                "description": "Étudie pendant {target} minutes",
                "icon": "🧠"
            },
            {
                "type": QuestType.CREATE_NOTES,
                "target_range": (1, 2),
                "title": "Prends des notes",
                "description": "Crée {target} note(s)",
                "icon": "📝"
            },
            {
                "type": QuestType.JOIN_FOCUS_ROOM,
                "target_range": (1, 1),
                "title": "Étudie en groupe",
                "description": "Rejoins une Focus Room",
                "icon": "👥"
            }
        ]
    },
    QuestDifficulty.HARD: {
        "xp_reward": 40,
        "templates": [
            {
                "type": QuestType.REVIEW_FLASHCARDS,
                "target_range": (30, 50),
                "title": "Maître des cartes",
                "description": "Révise {target} flashcards",
                "icon": "🃏"
            },
            {
                "type": QuestType.PERFECT_QUIZ,
                "target_range": (1, 1),
                "title": "Score parfait",
                "description": "Obtiens 100% à un quiz",
                "icon": "💯"
            },
            {
                "type": QuestType.WIN_DUEL,
                "target_range": (1, 1),
                "title": "Champion",
                "description": "Gagne un duel",
                "icon": "⚔️"
            },
            {
                "type": QuestType.STUDY_MINUTES,
                "target_range": (45, 60),
                "title": "Marathon d'étude",
                "description": "Étudie pendant {target} minutes",
                "icon": "🏃"
            },
            {
                "type": QuestType.EARN_XP,
                "target_range": (100, 150),
                "title": "XP Hunter",
                "description": "Gagne {target} XP aujourd'hui",
                "icon": "🎯"
            }
        ]
    }
}

# Bonus pour compléter les 3 objectifs
DAILY_BONUS_XP = 50
DAILY_BONUS_CHEST_RARITY = "common"  # Coffre commun par défaut

# Streak bonus (jours consécutifs avec 3/3)
QUEST_STREAK_BONUSES = {
    7: {"xp": 100, "chest": "rare"},
    14: {"xp": 200, "chest": "rare"},
    30: {"xp": 500, "chest": "epic"},
    60: {"xp": 1000, "chest": "epic"},
    100: {"xp": 2000, "chest": "legendary"},
}
