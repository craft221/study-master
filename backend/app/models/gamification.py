"""
Modèles Gamification (Achievements et Récompenses)
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class AchievementCategory(enum.Enum):
    LEARNING = "learning"
    STREAK = "streak"
    MASTERY = "mastery"
    SOCIAL = "social"
    SPECIAL = "special"


class AchievementRarity(enum.Enum):
    COMMON = "common"
    RARE = "rare"
    EPIC = "epic"
    LEGENDARY = "legendary"


class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(Enum(AchievementCategory), nullable=False)
    rarity = Column(Enum(AchievementRarity), default=AchievementRarity.COMMON)
    icon = Column(String, nullable=True)
    xp_reward = Column(Integer, default=0)
    requirement_value = Column(Integer, nullable=False)
    requirement_type = Column(String, nullable=False)  # e.g., "notes_created", "streak_days"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    user_achievements = relationship("UserAchievement", back_populates="achievement", cascade="all, delete-orphan")


class UserAchievement(Base):
    __tablename__ = "user_achievements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    achievement_id = Column(Integer, ForeignKey("achievements.id"), nullable=False)
    progress = Column(Integer, default=0)
    is_unlocked = Column(Boolean, default=False)
    unlocked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    user = relationship("User")
    achievement = relationship("Achievement", back_populates="user_achievements")


class LeaderboardType(enum.Enum):
    XP = "xp"
    STREAK = "streak"
    NOTES = "notes"
    FLASHCARDS = "flashcards"
    QUIZZES = "quizzes"


class LeaderboardPeriod(enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    ALL_TIME = "all_time"


class Leaderboard(Base):
    __tablename__ = "leaderboards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    leaderboard_type = Column(Enum(LeaderboardType), nullable=False)
    period = Column(Enum(LeaderboardPeriod), nullable=False)
    score = Column(Integer, default=0)
    rank = Column(Integer, nullable=True)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    user = relationship("User")


class DuelStatus(enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DECLINED = "declined"
    CANCELLED = "cancelled"


class Duel(Base):
    __tablename__ = "duels"

    id = Column(Integer, primary_key=True, index=True)
    challenger_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    opponent_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=True)
    status = Column(Enum(DuelStatus), default=DuelStatus.PENDING)
    challenger_score = Column(Integer, nullable=True)
    opponent_score = Column(Integer, nullable=True)
    winner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    challenger = relationship("User", foreign_keys=[challenger_id])
    opponent = relationship("User", foreign_keys=[opponent_id])
    winner = relationship("User", foreign_keys=[winner_id])
    subject = relationship("Subject")
    quiz = relationship("Quiz")
