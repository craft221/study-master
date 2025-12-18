"""
Schémas Pydantic pour Exam Mode
================================

Validation et sérialisation des données pour la feature Exam Mode.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date, time
from enum import Enum


# ==================== ENUMS ====================

class ExamSessionStatusEnum(str, Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class StudyTaskTypeEnum(str, Enum):
    READ = "read"
    FLASHCARDS = "flashcards"
    QUIZ = "quiz"
    REVIEW = "review"
    PRACTICE_EXAM = "practice_exam"
    SUMMARY = "summary"
    WEAK_POINTS = "weak_points"


class StudyTaskStatusEnum(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class DifficultyLevelEnum(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


# ==================== CRÉATION ====================

class ExamSessionCreate(BaseModel):
    """Création d'une session d'examen"""
    exam_name: str = Field(..., min_length=1, max_length=255, description="Nom de l'examen")
    exam_description: Optional[str] = Field(None, max_length=1000)
    exam_date: date = Field(..., description="Date de l'examen")
    exam_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$", description="Heure de l'examen (HH:MM)")

    subject_id: Optional[int] = Field(None, description="ID de la matière liée")
    note_ids: List[int] = Field(default=[], description="IDs des notes à réviser")

    study_hours_per_day: float = Field(default=2.0, ge=0.5, le=12.0, description="Heures d'étude par jour")
    preferred_study_times: List[str] = Field(default=["morning", "afternoon"], description="Moments préférés")
    include_weekends: bool = Field(default=True, description="Inclure les weekends")
    difficulty_level: DifficultyLevelEnum = Field(default=DifficultyLevelEnum.MEDIUM)

    notifications_enabled: bool = Field(default=True)
    reminder_time: str = Field(default="09:00", pattern=r"^\d{2}:\d{2}$")

    @field_validator('exam_date')
    @classmethod
    def exam_date_must_be_future(cls, v):
        if v < date.today():
            raise ValueError("La date de l'examen doit être dans le futur")
        return v

    @field_validator('preferred_study_times')
    @classmethod
    def validate_study_times(cls, v):
        valid_times = ["morning", "afternoon", "evening", "night"]
        for t in v:
            if t not in valid_times:
                raise ValueError(f"Moment invalide: {t}. Valides: {valid_times}")
        return v


class ExamSessionUpdate(BaseModel):
    """Mise à jour d'une session"""
    exam_name: Optional[str] = Field(None, min_length=1, max_length=255)
    exam_description: Optional[str] = None
    exam_date: Optional[date] = None
    exam_time: Optional[str] = None

    study_hours_per_day: Optional[float] = Field(None, ge=0.5, le=12.0)
    preferred_study_times: Optional[List[str]] = None
    include_weekends: Optional[bool] = None
    difficulty_level: Optional[DifficultyLevelEnum] = None

    notifications_enabled: Optional[bool] = None
    reminder_time: Optional[str] = None

    status: Optional[ExamSessionStatusEnum] = None


# ==================== RÉPONSES ====================

class StudyTaskResponse(BaseModel):
    """Réponse pour une tâche d'étude"""
    id: int
    task_type: StudyTaskTypeEnum
    order: int
    title: str
    description: Optional[str] = None

    note_id: Optional[int] = None
    quiz_id: Optional[int] = None
    flashcard_deck_id: Optional[int] = None

    estimated_minutes: int
    actual_minutes: int

    target_score: float
    achieved_score: Optional[float] = None
    items_count: int

    status: StudyTaskStatusEnum

    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StudyDayResponse(BaseModel):
    """Réponse pour un jour d'étude"""
    id: int
    day_number: int
    study_date: date

    title: str
    description: Optional[str] = None

    chapters: List[str] = []
    note_ids: List[int] = []

    is_review_day: bool
    is_practice_exam_day: bool
    is_rest_day: bool

    estimated_minutes: int
    actual_minutes: int

    is_completed: bool
    completed_at: Optional[datetime] = None

    tasks_completed: int
    tasks_total: int
    score: Optional[float] = None

    # Propriétés calculées
    is_today: bool = False
    is_past: bool = False
    is_future: bool = False
    progress_percentage: float = 0.0

    tasks: List[StudyTaskResponse] = []

    class Config:
        from_attributes = True


class ExamSessionResponse(BaseModel):
    """Réponse pour une session d'examen"""
    id: int
    user_id: int

    exam_name: str
    exam_description: Optional[str] = None
    exam_date: date
    exam_time: Optional[str] = None

    subject_id: Optional[int] = None
    subject_name: Optional[str] = None

    note_ids: List[int] = []
    total_content_pages: int
    total_content_words: int

    study_hours_per_day: float
    preferred_study_times: List[str] = []
    include_weekends: bool
    difficulty_level: DifficultyLevelEnum

    status: ExamSessionStatusEnum
    current_day: int
    total_days: int

    tasks_completed: int
    tasks_total: int
    progress_percentage: float

    predicted_score: Optional[float] = None
    confidence_level: Optional[float] = None

    total_study_minutes: int
    total_flashcards_reviewed: int
    total_quizzes_taken: int
    average_quiz_score: float

    weak_points: List[str] = []
    strong_points: List[str] = []

    notifications_enabled: bool
    reminder_time: str

    # Propriétés calculées
    days_until_exam: int = 0
    is_urgent: bool = False
    is_overdue: bool = False

    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExamSessionDetailResponse(ExamSessionResponse):
    """Réponse détaillée avec les jours d'étude"""
    study_days: List[StudyDayResponse] = []
    today_tasks: List[StudyTaskResponse] = []
    upcoming_tasks: List[StudyTaskResponse] = []


class ExamSessionListResponse(BaseModel):
    """Liste paginée des sessions"""
    sessions: List[ExamSessionResponse]
    total: int
    active_count: int
    completed_count: int


# ==================== ACTIONS ====================

class StartTaskRequest(BaseModel):
    """Démarrer une tâche"""
    task_id: int


class CompleteTaskRequest(BaseModel):
    """Terminer une tâche"""
    task_id: int
    score: Optional[float] = Field(None, ge=0, le=100, description="Score obtenu (%)")
    actual_minutes: Optional[int] = Field(None, ge=0, description="Durée réelle (minutes)")


class SkipTaskRequest(BaseModel):
    """Passer une tâche"""
    task_id: int
    reason: Optional[str] = None


class CompleteDayRequest(BaseModel):
    """Marquer un jour comme terminé"""
    day_id: int
    force: bool = Field(default=False, description="Forcer même si tâches non terminées")


class UpdateProgressRequest(BaseModel):
    """Mise à jour manuelle de la progression"""
    weak_points: Optional[List[str]] = None
    strong_points: Optional[List[str]] = None


# ==================== STATISTIQUES ====================

class ExamModeStatsResponse(BaseModel):
    """Statistiques globales Exam Mode"""
    total_exams_prepared: int
    total_exams_completed: int
    average_preparation_days: float
    average_predicted_score: float
    total_study_hours: float

    current_active_exams: int
    upcoming_exams_count: int

    best_score_achieved: Optional[float] = None
    longest_streak_days: int

    xp_earned_from_exam_mode: int


class DayProgressResponse(BaseModel):
    """Progression du jour actuel"""
    exam_session_id: int
    exam_name: str
    days_until_exam: int

    today: StudyDayResponse
    tasks_remaining: int
    estimated_time_remaining: int  # minutes

    streak_days: int
    is_on_track: bool
    motivation_message: str


class PredictionResponse(BaseModel):
    """Prédiction de réussite"""
    exam_session_id: int
    predicted_score: float  # 0-100
    confidence_level: float  # 0-100

    factors: Dict[str, Any] = {}  # Facteurs influençant la prédiction
    recommendations: List[str] = []  # Conseils pour améliorer


# ==================== GÉNÉRATION DE PLAN ====================

class GeneratePlanRequest(BaseModel):
    """Demande de génération de plan"""
    exam_session_id: int
    regenerate: bool = Field(default=False, description="Régénérer le plan existant")


class GeneratePlanResponse(BaseModel):
    """Résultat de la génération"""
    success: bool
    exam_session_id: int
    total_days: int
    total_tasks: int

    study_days: List[StudyDayResponse] = []

    estimated_total_hours: float
    message: str


# ==================== NOTIFICATIONS ====================

class ExamModeNotificationResponse(BaseModel):
    """Notification Exam Mode"""
    id: int
    notification_type: str
    title: str
    message: str

    exam_session_id: int
    exam_name: Optional[str] = None

    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== WIZARD ====================

class WizardStep1Response(BaseModel):
    """Étape 1: Infos de base de l'examen"""
    subjects: List[Dict[str, Any]]  # Liste des matières disponibles
    suggested_hours: float  # Heures suggérées par jour


class WizardStep2Response(BaseModel):
    """Étape 2: Sélection du contenu"""
    notes: List[Dict[str, Any]]  # Notes disponibles pour la matière
    total_words: int
    estimated_pages: int
    suggested_days: int


class WizardStep3Response(BaseModel):
    """Étape 3: Prévisualisation du plan"""
    plan_preview: List[Dict[str, Any]]  # Aperçu des jours
    total_days: int
    total_tasks: int
    estimated_hours: float
    predicted_readiness: float  # % de préparation estimé


# ==================== PREMIUM CHECK ====================

class ExamModePremiumStatus(BaseModel):
    """Statut premium pour Exam Mode"""
    is_premium: bool
    can_create_exam: bool
    active_exams_count: int
    max_active_exams: int  # FREE=1, PREMIUM=5, PREMIUM_PLUS=unlimited

    features_available: List[str]
    features_locked: List[str]

    upgrade_message: Optional[str] = None
