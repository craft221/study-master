"""
Modèle StudySession (Session d'étude)
"""

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


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
    duration = Column(Integer, nullable=False)  # minutes
    notes_reviewed = Column(Integer, default=0)
    flashcards_reviewed = Column(Integer, default=0)
    quizzes_completed = Column(Integer, default=0)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

    # Relations
    user = relationship("User")
    subject = relationship("Subject")
