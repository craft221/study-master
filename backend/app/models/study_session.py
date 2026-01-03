"""
Modèle StudySession (Session d'étude)
"""

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum
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


class SessionStatus(enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    duration = Column(Integer, nullable=False, default=0)  # minutes
    status = Column(Enum(SessionStatus), default=SessionStatus.ACTIVE)
    session_type = Column(Enum(SessionType), default=SessionType.STUDY)
    notes_reviewed = Column(Integer, default=0)
    flashcards_reviewed = Column(Integer, default=0)
    quizzes_completed = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)

    # Relations
    user = relationship("User")
    subject = relationship("Subject")
