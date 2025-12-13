"""
Modèle Notification - Système de notifications en temps réel
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base
from app.core.datetime_utils import utc_now


class NotificationType(enum.Enum):
    """Types de notifications"""
    # Duels
    DUEL_CHALLENGE = "duel_challenge"
    DUEL_ACCEPTED = "duel_accepted"
    DUEL_DECLINED = "duel_declined"
    DUEL_COMPLETED = "duel_completed"
    DUEL_WON = "duel_won"
    DUEL_LOST = "duel_lost"

    # Calendrier
    EVENT_REMINDER = "event_reminder"
    EXAM_REMINDER = "exam_reminder"

    # Streak & Étude
    STREAK_REMINDER = "streak_reminder"
    STREAK_LOST = "streak_lost"
    STREAK_MILESTONE = "streak_milestone"

    # Flashcards & Quiz
    FLASHCARD_REVIEW = "flashcard_review"
    QUIZ_REMINDER = "quiz_reminder"

    # Achievements
    ACHIEVEMENT_UNLOCKED = "achievement_unlocked"
    LEVEL_UP = "level_up"
    XP_GAINED = "xp_gained"

    # Social
    GROUP_INVITE = "group_invite"
    GROUP_MESSAGE = "group_message"

    # Focus Rooms
    FOCUS_ROOM_INVITE = "focus_room_invite"
    FOCUS_ROOM_INVITE_ACCEPTED = "focus_room_invite_accepted"

    # Système
    SYSTEM = "system"
    WELCOME = "welcome"


class NotificationPriority(enum.Enum):
    """Priorité des notifications"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class NotificationChannel(enum.Enum):
    """Canaux de notification"""
    IN_APP = "in_app"
    EMAIL = "email"
    PUSH = "push"
    ALL = "all"


class Notification(Base):
    """Modèle de notification"""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Type et contenu
    type = Column(SQLEnum(NotificationType), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)

    # Priorité et canal
    priority = Column(SQLEnum(NotificationPriority), default=NotificationPriority.NORMAL)
    channel = Column(SQLEnum(NotificationChannel), default=NotificationChannel.IN_APP)

    # État
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)

    # Données additionnelles (JSON string)
    data = Column(Text, nullable=True)  # JSON: {"duel_id": 1, "opponent": "John"}

    # Action link
    action_url = Column(String(500), nullable=True)  # "/duels/123"

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Pour les notifications temporaires

    # Email tracking
    email_sent = Column(Boolean, default=False)
    email_sent_at = Column(DateTime(timezone=True), nullable=True)

    # Relations
    user = relationship("User", back_populates="notifications")


class NotificationPreference(Base):
    """Préférences de notification par utilisateur"""
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)

    # Canaux activés
    email_enabled = Column(Boolean, default=True)
    push_enabled = Column(Boolean, default=True)
    in_app_enabled = Column(Boolean, default=True)

    # Types de notifications (par catégorie)
    duel_notifications = Column(Boolean, default=True)
    calendar_notifications = Column(Boolean, default=True)
    streak_notifications = Column(Boolean, default=True)
    study_reminders = Column(Boolean, default=True)
    achievement_notifications = Column(Boolean, default=True)
    social_notifications = Column(Boolean, default=True)

    # Horaires de notification (éviter la nuit)
    quiet_hours_start = Column(Integer, default=22)  # 22h00
    quiet_hours_end = Column(Integer, default=8)     # 08h00

    # Email digest
    email_digest = Column(Boolean, default=False)  # Résumé quotidien au lieu d'emails individuels
    email_digest_hour = Column(Integer, default=18)  # Heure du digest (18h)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relations
    user = relationship("User", back_populates="notification_preferences")
