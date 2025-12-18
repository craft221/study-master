"""
Exam Mode - Modèles pour la préparation intelligente aux examens
================================================================

Feature PREMIUM qui génère un plan de révision personnalisé basé sur:
- La date de l'examen
- Le contenu à réviser (notes, cours)
- L'algorithme de répétition espacée
- Les performances de l'utilisateur
"""

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, Float,
    ForeignKey, Enum, JSON, Date
)
from sqlalchemy.orm import relationship
from datetime import datetime, date, timedelta
from enum import Enum as PyEnum
from typing import List, Optional, Dict, Any

from app.core.database import Base
from app.core.datetime_utils import utc_now


class ExamSessionStatus(str, PyEnum):
    """Statut d'une session d'examen"""
    PLANNING = "planning"          # En cours de création
    ACTIVE = "active"              # Plan actif, révisions en cours
    PAUSED = "paused"              # Mis en pause
    COMPLETED = "completed"        # Examen passé
    ABANDONED = "abandoned"        # Abandonné


class StudyTaskType(str, PyEnum):
    """Type de tâche d'étude"""
    READ = "read"                  # Lire le contenu
    FLASHCARDS = "flashcards"      # Réviser avec flashcards
    QUIZ = "quiz"                  # Faire un quiz
    REVIEW = "review"              # Révision (répétition espacée)
    PRACTICE_EXAM = "practice_exam"  # Examen blanc
    SUMMARY = "summary"            # Lire/créer un résumé
    WEAK_POINTS = "weak_points"    # Réviser les points faibles


class StudyTaskStatus(str, PyEnum):
    """Statut d'une tâche"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class DifficultyLevel(str, PyEnum):
    """Niveau de difficulté estimé"""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class ExamSession(Base):
    """
    Session de préparation à un examen

    Représente un examen à préparer avec toutes ses métadonnées
    et le plan de révision associé.
    """
    __tablename__ = "exam_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Informations sur l'examen
    exam_name = Column(String(255), nullable=False)
    exam_description = Column(Text, nullable=True)
    exam_date = Column(Date, nullable=False, index=True)
    exam_time = Column(String(10), nullable=True)  # Format "HH:MM"

    # Matière liée (optionnel)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)

    # Contenu à réviser
    note_ids = Column(JSON, default=list)  # Liste des IDs de notes sélectionnées
    total_content_pages = Column(Integer, default=0)  # Estimation du volume
    total_content_words = Column(Integer, default=0)

    # Paramètres de planification
    study_hours_per_day = Column(Float, default=2.0)  # Heures d'étude par jour
    preferred_study_times = Column(JSON, default=list)  # ["morning", "afternoon", "evening"]
    include_weekends = Column(Boolean, default=True)
    difficulty_level = Column(
        Enum(DifficultyLevel, values_callable=lambda obj: [e.value for e in obj]),
        default=DifficultyLevel.MEDIUM
    )

    # Progression
    status = Column(
        Enum(ExamSessionStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=ExamSessionStatus.PLANNING,
        index=True
    )
    current_day = Column(Integer, default=0)
    total_days = Column(Integer, default=0)

    # Statistiques de progression
    tasks_completed = Column(Integer, default=0)
    tasks_total = Column(Integer, default=0)
    progress_percentage = Column(Float, default=0.0)

    # Prédiction de réussite (mis à jour au fil du temps)
    predicted_score = Column(Float, nullable=True)  # 0-100%
    confidence_level = Column(Float, nullable=True)  # Confiance dans la prédiction

    # Statistiques d'étude
    total_study_minutes = Column(Integer, default=0)
    total_flashcards_reviewed = Column(Integer, default=0)
    total_quizzes_taken = Column(Integer, default=0)
    average_quiz_score = Column(Float, default=0.0)

    # Points faibles identifiés
    weak_points = Column(JSON, default=list)  # Liste de concepts/chapitres difficiles
    strong_points = Column(JSON, default=list)

    # Notifications
    notifications_enabled = Column(Boolean, default=True)
    reminder_time = Column(String(10), default="09:00")  # Heure de rappel quotidien

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)  # Quand les révisions ont commencé
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relations
    user = relationship("User", back_populates="exam_sessions")
    subject = relationship("Subject", back_populates="exam_sessions")
    study_days = relationship("StudyDay", back_populates="exam_session", cascade="all, delete-orphan", order_by="StudyDay.day_number")

    def __repr__(self):
        return f"<ExamSession {self.id}: {self.exam_name} ({self.exam_date})>"

    @property
    def days_until_exam(self) -> int:
        """Nombre de jours avant l'examen"""
        if isinstance(self.exam_date, date):
            return (self.exam_date - date.today()).days
        return 0

    @property
    def is_overdue(self) -> bool:
        """L'examen est-il passé?"""
        return self.days_until_exam < 0

    @property
    def is_urgent(self) -> bool:
        """Moins de 3 jours avant l'examen"""
        return 0 <= self.days_until_exam <= 3

    def calculate_progress(self) -> float:
        """Calcule le pourcentage de progression"""
        if self.tasks_total == 0:
            return 0.0
        return round((self.tasks_completed / self.tasks_total) * 100, 1)

    def get_status_display(self) -> Dict[str, Any]:
        """Retourne un affichage du statut"""
        return {
            "status": self.status.value,
            "days_until_exam": self.days_until_exam,
            "is_urgent": self.is_urgent,
            "progress": self.calculate_progress(),
            "predicted_score": self.predicted_score,
            "tasks_remaining": self.tasks_total - self.tasks_completed
        }


class StudyDay(Base):
    """
    Jour de révision dans le plan

    Chaque jour contient des tâches spécifiques à accomplir.
    """
    __tablename__ = "study_days"

    id = Column(Integer, primary_key=True, index=True)
    exam_session_id = Column(Integer, ForeignKey("exam_sessions.id", ondelete="CASCADE"), nullable=False, index=True)

    # Position dans le plan
    day_number = Column(Integer, nullable=False)  # Jour 1, 2, 3...
    study_date = Column(Date, nullable=False, index=True)

    # Thème du jour
    title = Column(String(255), nullable=False)  # Ex: "Chapitres 1-2: Introduction"
    description = Column(Text, nullable=True)

    # Contenu à couvrir ce jour
    chapters = Column(JSON, default=list)  # Liste des chapitres/sections
    note_ids = Column(JSON, default=list)  # Notes spécifiques pour ce jour

    # Type de jour
    is_review_day = Column(Boolean, default=False)  # Jour de révision (répétition espacée)
    is_practice_exam_day = Column(Boolean, default=False)  # Jour d'examen blanc
    is_rest_day = Column(Boolean, default=False)  # Jour de repos (avant exam)

    # Durée estimée
    estimated_minutes = Column(Integer, default=120)
    actual_minutes = Column(Integer, default=0)

    # Progression
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Statistiques du jour
    tasks_completed = Column(Integer, default=0)
    tasks_total = Column(Integer, default=0)
    score = Column(Float, nullable=True)  # Score moyen des quiz/flashcards du jour

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relations
    exam_session = relationship("ExamSession", back_populates="study_days")
    tasks = relationship("StudyTask", back_populates="study_day", cascade="all, delete-orphan", order_by="StudyTask.order")

    def __repr__(self):
        return f"<StudyDay {self.day_number}: {self.title}>"

    @property
    def is_today(self) -> bool:
        """Est-ce aujourd'hui?"""
        return self.study_date == date.today()

    @property
    def is_past(self) -> bool:
        """Ce jour est-il passé?"""
        return self.study_date < date.today()

    @property
    def is_future(self) -> bool:
        """Ce jour est-il dans le futur?"""
        return self.study_date > date.today()

    def calculate_progress(self) -> float:
        """Pourcentage de progression du jour"""
        if self.tasks_total == 0:
            return 0.0
        return round((self.tasks_completed / self.tasks_total) * 100, 1)


class StudyTask(Base):
    """
    Tâche d'étude individuelle

    Représente une action concrète à faire (lire, quiz, flashcards, etc.)
    """
    __tablename__ = "study_tasks"

    id = Column(Integer, primary_key=True, index=True)
    study_day_id = Column(Integer, ForeignKey("study_days.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Type et ordre
    task_type = Column(
        Enum(StudyTaskType, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False
    )
    order = Column(Integer, default=0)

    # Description
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Contenu lié
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="SET NULL"), nullable=True)
    quiz_id = Column(Integer, nullable=True)  # Quiz généré pour cette tâche
    flashcard_deck_id = Column(Integer, nullable=True)  # Deck de flashcards

    # Paramètres
    estimated_minutes = Column(Integer, default=30)
    actual_minutes = Column(Integer, default=0)

    # Pour les quiz/flashcards
    target_score = Column(Float, default=80.0)  # Score cible (%)
    achieved_score = Column(Float, nullable=True)
    items_count = Column(Integer, default=0)  # Nombre de questions/cartes

    # Statut
    status = Column(
        Enum(StudyTaskStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=StudyTaskStatus.PENDING
    )

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Métadonnées additionnelles
    extra_data = Column(JSON, default=dict)  # Données supplémentaires flexibles

    # Relations
    study_day = relationship("StudyDay", back_populates="tasks")
    user = relationship("User", back_populates="study_tasks")
    note = relationship("Note", back_populates="study_tasks")

    def __repr__(self):
        return f"<StudyTask {self.id}: {self.task_type.value} - {self.title}>"

    @property
    def is_completed(self) -> bool:
        return self.status == StudyTaskStatus.COMPLETED

    @property
    def duration_minutes(self) -> int:
        """Durée réelle si terminé, sinon estimée"""
        return self.actual_minutes if self.actual_minutes > 0 else self.estimated_minutes

    def mark_completed(self, score: Optional[float] = None, minutes: Optional[int] = None):
        """Marque la tâche comme terminée"""
        self.status = StudyTaskStatus.COMPLETED
        self.completed_at = utc_now()
        if score is not None:
            self.achieved_score = score
        if minutes is not None:
            self.actual_minutes = minutes


class ExamModeNotification(Base):
    """
    Notifications liées à Exam Mode
    """
    __tablename__ = "exam_mode_notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exam_session_id = Column(Integer, ForeignKey("exam_sessions.id", ondelete="CASCADE"), nullable=False)

    # Type de notification
    notification_type = Column(String(50), nullable=False)  # daily_reminder, behind_schedule, exam_tomorrow, etc.

    # Contenu
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)

    # Statut
    is_read = Column(Boolean, default=False)
    is_sent = Column(Boolean, default=False)

    # Planification
    scheduled_for = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relations
    user = relationship("User")
    exam_session = relationship("ExamSession")


# ==================== CONSTANTES ====================

# XP rewards pour Exam Mode
EXAM_MODE_XP_REWARDS = {
    "create_plan": 50,           # Créer un plan de révision
    "complete_task": 10,         # Terminer une tâche
    "complete_day": 30,          # Terminer toutes les tâches du jour
    "perfect_day": 50,           # Jour parfait (tous les quiz > 90%)
    "complete_plan": 200,        # Terminer le plan complet
    "ahead_of_schedule": 25,     # En avance sur le planning
    "streak_3_days": 40,         # 3 jours consécutifs
    "streak_7_days": 100,        # 7 jours consécutifs
    "high_predicted_score": 75,  # Prédiction > 85%
}

# Durées estimées par type de tâche (minutes)
TASK_DURATION_ESTIMATES = {
    StudyTaskType.READ: 30,
    StudyTaskType.FLASHCARDS: 20,
    StudyTaskType.QUIZ: 15,
    StudyTaskType.REVIEW: 25,
    StudyTaskType.PRACTICE_EXAM: 60,
    StudyTaskType.SUMMARY: 20,
    StudyTaskType.WEAK_POINTS: 30,
}

# Intervalles de répétition espacée (en jours)
SPACED_REPETITION_INTERVALS = [1, 3, 7, 14]
