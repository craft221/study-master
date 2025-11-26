"""
Modèle Flashcard (Carte mémoire)
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Float, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class FlashcardStatus(enum.Enum):
    NEW = "new"
    LEARNING = "learning"
    REVIEW = "review"
    RELEARNING = "relearning"


class FlashcardDifficulty(enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    hint = Column(Text, nullable=True)
    explanation = Column(Text, nullable=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    deck_name = Column(String, nullable=True)
    status = Column(Enum(FlashcardStatus), default=FlashcardStatus.NEW)
    ease_factor = Column(Float, default=2.5)
    interval = Column(Integer, default=0)
    repetitions = Column(Integer, default=0)
    next_review_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    user = relationship("User", back_populates="flashcards")
    subject = relationship("Subject", back_populates="flashcards")
    reviews = relationship("FlashcardReview", back_populates="flashcard", cascade="all, delete-orphan")


class FlashcardReview(Base):
    __tablename__ = "flashcard_reviews"

    id = Column(Integer, primary_key=True, index=True)
    flashcard_id = Column(Integer, ForeignKey("flashcards.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    quality = Column(Integer, nullable=False)  # 0-5 rating
    time_taken = Column(Integer, nullable=True)  # seconds
    reviewed_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    flashcard = relationship("Flashcard", back_populates="reviews")
    user = relationship("User")
