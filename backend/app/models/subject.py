"""
Modèle Subject (Matière)
"""

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.core.datetime_utils import utc_now


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    color = Column(String, default="#3B82F6")
    icon = Column(String, nullable=True)
    description = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_archived = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    is_favorite = Column(Boolean, default=False)
    semester = Column(String, nullable=True)

    # Academic Information
    code = Column(String(50), nullable=True)
    year = Column(String(20), nullable=True)
    credits_ects = Column(Integer, default=0)
    coefficient = Column(Float, default=1.0)

    # Professor Information
    professor_name = Column(String(100), nullable=True)
    professor_email = Column(String(255), nullable=True)
    professor_notes = Column(String, nullable=True)

    # Performance Tracking
    difficulty = Column(String(20), default='medium')
    target_grade = Column(Float, nullable=True)
    current_grade = Column(Float, nullable=True)

    # Exam Information
    exam_date = Column(DateTime(timezone=True), nullable=True)
    exam_type = Column(String(100), nullable=True)

    # Statistics
    total_notes_count = Column(Integer, default=0)
    total_flashcards_count = Column(Integer, default=0)
    total_quizzes_count = Column(Integer, default=0)
    total_documents_count = Column(Integer, default=0)
    total_study_time_minutes = Column(Integer, default=0)

    # Gamification
    xp_earned = Column(Integer, default=0)
    level = Column(Integer, default=1)
    mastery_percentage = Column(Float, default=0.0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relations
    user = relationship("User", back_populates="subjects")
    notes = relationship("Note", back_populates="subject", cascade="all, delete-orphan")
    flashcards = relationship("Flashcard", back_populates="subject", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="subject", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="subject", cascade="all, delete-orphan")
    exam_sessions = relationship("ExamSession", back_populates="subject")
