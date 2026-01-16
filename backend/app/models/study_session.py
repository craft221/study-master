"""
Modèle StudySession (Session d'étude)
"""

from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base
from app.core.datetime_utils import utc_now


class SessionType(enum.Enum):
    STUDY = "study"
    REVIEW = "review"
    PRACTICE = "practice"
    EXAM = "exam"
    POMODORO = "pomodoro"
    SCHEDULED = "scheduled"


class SessionStatus(enum.Enum):
    PLANNED = "planned"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)

    # Durées
    duration = Column(Integer, nullable=False, default=0)  # deprecated, use actual_duration_minutes
    planned_duration_minutes = Column(Integer, nullable=True, default=25)
    break_duration_minutes = Column(Integer, nullable=True, default=5)
    actual_duration_minutes = Column(Integer, nullable=True)

    # Status et type
    status = Column(
        Enum(SessionStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=SessionStatus.ACTIVE
    )
    session_type = Column(
        Enum(SessionType, values_callable=lambda obj: [e.value for e in obj]),
        default=SessionType.STUDY
    )

    # Métriques
    productivity_rating = Column(Integer, nullable=True)  # 1-5
    focus_score = Column(Float, nullable=True)  # 0-100
    xp_earned = Column(Integer, default=0)

    # Compteurs
    notes_reviewed = Column(Integer, default=0)
    flashcards_reviewed = Column(Integer, default=0)
    quizzes_completed = Column(Integer, default=0)

    # Notes et tags
    notes = Column(String, nullable=True)
    tags = Column(JSON, nullable=True)

    # Timestamps
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)

    # Relations
    user = relationship("User")
    subject = relationship("Subject")
