"""
Modèle Quiz
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, JSON, Float, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base
from app.core.datetime_utils import utc_now


class QuizDifficulty(enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class QuizType(enum.Enum):
    PRACTICE = "practice"
    TEST = "test"
    EXAM = "exam"


class QuestionType(enum.Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"
    ESSAY = "essay"


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    source_note_id = Column(Integer, ForeignKey("notes.id"), nullable=True)
    quiz_type = Column(String, nullable=True)  # practice, test, exam
    difficulty = Column(String, nullable=True)  # easy, medium, hard
    questions_data = Column(JSON, nullable=True)  # Questions stored as JSON
    total_points = Column(Integer, nullable=True)
    passing_score = Column(Float, default=60.0)
    # Note: time_limit_minutes est le champ principal, time_limit est gardé pour compatibilité
    time_limit_minutes = Column(Integer, nullable=True)  # Durée en minutes
    is_timed = Column(Boolean, default=False)
    allow_multiple_attempts = Column(Boolean, default=True)
    show_correct_answers = Column(Boolean, default=True)
    randomize_questions = Column(Boolean, default=False)
    randomize_options = Column(Boolean, default=False)
    is_ai_generated = Column(Boolean, default=False)
    ai_prompt_used = Column(Text, nullable=True)  # Prompt utilisé pour générer le quiz
    is_public = Column(Boolean, default=False)
    is_published = Column(Boolean, default=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    # Stats du quiz
    total_attempts = Column(Integer, default=0)
    average_score = Column(Float, default=0.0)
    highest_score = Column(Float, default=0.0)
    completion_rate = Column(Float, default=0.0)
    # Champs pour la viralité
    share_code = Column(String(12), unique=True, nullable=True, index=True)  # Code unique pour partage
    total_plays = Column(Integer, default=0)  # Nombre total de parties (inclut invités)
    total_shares = Column(Integer, default=0)  # Nombre de partages
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relations
    user = relationship("User", back_populates="quizzes")
    subject = relationship("Subject", back_populates="quizzes")
    questions = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    question = Column(Text, nullable=False)
    question_type = Column(String, nullable=False)  # multiple_choice, true_false, short_answer
    options = Column(JSON, nullable=True)  # For multiple choice
    correct_answer = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)
    points = Column(Integer, default=1)
    order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relations
    quiz = relationship("Quiz", back_populates="questions")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Numéro de tentative (1ère, 2ème, etc.)
    attempt_number = Column(Integer, default=1)

    # Réponses et score
    answers = Column(JSON, nullable=False)
    score = Column(Float, nullable=False)
    points_earned = Column(Integer, nullable=True)
    points_possible = Column(Integer, nullable=True)
    is_passed = Column(Boolean, nullable=True)

    # Temps
    time_started = Column(DateTime(timezone=True), nullable=True)
    time_completed = Column(DateTime(timezone=True), nullable=True)
    time_taken = Column(Integer, nullable=True)  # seconds (gardé pour rétrocompatibilité)

    # Statut
    is_completed = Column(Boolean, default=True)
    is_abandoned = Column(Boolean, default=False)

    # Feedback IA
    ai_feedback = Column(Text, nullable=True)
    strengths = Column(JSON, nullable=True)  # Points forts identifiés
    weaknesses = Column(JSON, nullable=True)  # Points faibles identifiés
    recommendations = Column(JSON, nullable=True)  # Recommandations d'étude

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relations
    quiz = relationship("Quiz", back_populates="attempts")
    user = relationship("User")


class GuestQuizAttempt(Base):
    """Tentatives de quiz par des invités (non-inscrits) - pour la viralité"""
    __tablename__ = "guest_quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    guest_name = Column(String(100), nullable=False)  # Pseudo choisi par l'invité
    guest_session_id = Column(String(64), nullable=False, index=True)  # Session unique
    answers = Column(JSON, nullable=False)
    score = Column(Float, nullable=False, default=0)
    correct_count = Column(Integer, default=0)
    total_questions = Column(Integer, default=0)
    time_taken_seconds = Column(Integer, nullable=True)
    is_completed = Column(Boolean, default=False)
    referrer_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Qui a partagé
    converted_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Si l'invité s'inscrit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relations
    quiz = relationship("Quiz")
    referrer = relationship("User", foreign_keys=[referrer_user_id])
    converted_user = relationship("User", foreign_keys=[converted_to_user_id])
