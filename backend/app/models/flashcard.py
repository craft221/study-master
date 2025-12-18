"""
Modèle Flashcard (Carte mémoire)

Utilise l'algorithme FSRS (Free Spaced Repetition Scheduler) pour une
répétition espacée optimale basée sur la recherche scientifique moderne.
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Float, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base
from app.core.datetime_utils import utc_now


class FlashcardStatus(enum.Enum):
    """État de la carte dans le processus d'apprentissage FSRS"""
    NEW = "new"           # Jamais révisée
    LEARNING = "learning" # En cours d'apprentissage initial
    REVIEW = "review"     # En révision normale (long terme)
    RELEARNING = "relearning"  # Réapprentissage après un échec


class FlashcardDifficulty(enum.Enum):
    """Niveau de difficulté perçu (pour génération IA)"""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class FlashcardDeck(Base):
    """Groupe de flashcards (paquet/deck)"""
    __tablename__ = "flashcard_decks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=True)

    # Metadata
    is_ai_generated = Column(Boolean, default=False)
    is_public = Column(Boolean, default=False)
    card_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=utc_now, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), default=utc_now, server_default=func.now(), onupdate=utc_now)

    # Relations
    user = relationship("User", backref="flashcard_decks")
    flashcards = relationship("Flashcard", back_populates="deck", cascade="all, delete-orphan")


class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    hint = Column(Text, nullable=True)
    explanation = Column(Text, nullable=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    source_note_id = Column(Integer, ForeignKey("notes.id"), nullable=True)
    deck_id = Column(Integer, ForeignKey("flashcard_decks.id"), nullable=True)
    deck_name = Column(String, nullable=True)  # Legacy field

    # Media URLs
    front_image_url = Column(String, nullable=True)
    back_image_url = Column(String, nullable=True)
    front_audio_url = Column(String, nullable=True)
    back_audio_url = Column(String, nullable=True)

    # Tags and AI
    tags = Column(String, nullable=True)
    is_ai_generated = Column(Boolean, default=False)

    # ============== FSRS (Free Spaced Repetition Scheduler) ==============
    # Algorithme moderne de répétition espacée avec ~30% moins de révisions
    # pour le même taux de rétention comparé à SM-2

    status = Column(Enum(FlashcardStatus), default=FlashcardStatus.NEW)

    # FSRS Core Parameters
    # Stabilité: Durée estimée (jours) avant que la récupérabilité tombe à 90%
    # Plus elle est haute, plus la mémoire est stable et durable
    stability = Column(Float, default=0.0)

    # Difficulté intrinsèque de la carte (échelle 1-10)
    # Affecte la croissance de stabilité lors des révisions
    fsrs_difficulty = Column(Float, default=5.0)

    # Legacy SM-2 fields (kept for backward compatibility during migration)
    # Ces champs seront progressivement remplacés par stability et fsrs_difficulty
    ease_factor = Column(Float, default=2.5)  # Deprecated: use stability
    interval = Column(Integer, default=0)
    repetitions = Column(Integer, default=0)

    # Scheduling
    next_review_at = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    last_reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # FSRS Additional Metrics
    # Nombre d'échecs (réponses "Again") - important pour FSRS
    lapses = Column(Integer, default=0)

    # Statistics
    total_reviews = Column(Integer, default=0)
    correct_reviews = Column(Integer, default=0)
    incorrect_reviews = Column(Integer, default=0)
    average_response_time_seconds = Column(Float, default=0.0)
    mastery_percentage = Column(Float, default=0.0)
    times_seen_as_again = Column(Integer, default=0)
    times_seen_as_hard = Column(Integer, default=0)
    times_seen_as_good = Column(Integer, default=0)
    times_seen_as_easy = Column(Integer, default=0)

    # Flags
    is_suspended = Column(Boolean, default=False)
    is_buried = Column(Boolean, default=False)
    is_favorite = Column(Boolean, default=False)
    is_public = Column(Boolean, default=False)  # Visible dans la page Explore

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=utc_now, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), default=utc_now, server_default=func.now(), onupdate=utc_now)

    # Relations
    user = relationship("User", back_populates="flashcards")
    subject = relationship("Subject", back_populates="flashcards")
    deck = relationship("FlashcardDeck", back_populates="flashcards")
    reviews = relationship("FlashcardReview", back_populates="flashcard", cascade="all, delete-orphan")


class FlashcardReview(Base):
    __tablename__ = "flashcard_reviews"

    id = Column(Integer, primary_key=True, index=True)
    flashcard_id = Column(Integer, ForeignKey("flashcards.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    quality = Column(Integer, nullable=False)  # 0-5 rating
    time_taken = Column(Integer, nullable=True)  # seconds
    reviewed_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relations
    flashcard = relationship("Flashcard", back_populates="reviews")
    user = relationship("User")
