from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.models.flashcard import FlashcardStatus, FlashcardDifficulty


# ========== FLASHCARD SCHEMAS ==========

class FlashcardBase(BaseModel):
    """Schéma de base pour Flashcard"""
    subject_id: int
    source_note_id: Optional[int] = None
    front: str = Field(..., min_length=1, max_length=5000, description="Question/Prompt")
    back: str = Field(..., min_length=1, max_length=5000, description="Réponse")
    hint: Optional[str] = None
    explanation: Optional[str] = None
    front_image_url: Optional[str] = None
    back_image_url: Optional[str] = None
    front_audio_url: Optional[str] = None
    back_audio_url: Optional[str] = None
    tags: Optional[str] = None
    deck_name: Optional[str] = Field(None, max_length=200)
    is_ai_generated: bool = False
    language: Optional[str] = Field("fr", max_length=5, description="Langue du contenu (fr, en, es)")


class FlashcardCreate(FlashcardBase):
    """Schéma pour créer une Flashcard"""
    pass


class FlashcardUpdate(BaseModel):
    """Schéma pour mettre à jour une Flashcard"""
    subject_id: Optional[int] = None
    source_note_id: Optional[int] = None
    front: Optional[str] = Field(None, min_length=1, max_length=5000)
    back: Optional[str] = Field(None, min_length=1, max_length=5000)
    hint: Optional[str] = None
    explanation: Optional[str] = None
    front_image_url: Optional[str] = None
    back_image_url: Optional[str] = None
    front_audio_url: Optional[str] = None
    back_audio_url: Optional[str] = None
    tags: Optional[str] = None
    deck_name: Optional[str] = None
    is_suspended: Optional[bool] = None
    is_buried: Optional[bool] = None
    is_favorite: Optional[bool] = None
    language: Optional[str] = Field(None, max_length=5)


class FlashcardResponse(FlashcardBase):
    """Schéma de réponse pour Flashcard (avec métriques FSRS)"""
    id: int
    user_id: int
    status: FlashcardStatus

    # FSRS Core Parameters
    stability: Optional[float] = 0.0  # Durée estimée avant oubli (jours)
    fsrs_difficulty: Optional[float] = 5.0  # Difficulté intrinsèque (1-10)

    # Legacy SM-2 fields (pour rétrocompatibilité)
    ease_factor: float
    interval: int
    repetitions: int
    lapses: Optional[int] = 0  # Nombre d'échecs

    due_date: Optional[datetime]
    last_reviewed_at: Optional[datetime]
    next_review_at: Optional[datetime]
    total_reviews: int
    correct_reviews: int
    incorrect_reviews: int
    average_response_time_seconds: float
    mastery_percentage: float
    times_seen_as_again: int
    times_seen_as_hard: int
    times_seen_as_good: int
    times_seen_as_easy: int
    is_suspended: bool
    is_buried: bool
    is_favorite: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FlashcardListResponse(BaseModel):
    """Schéma pour la liste de Flashcards avec pagination"""
    flashcards: List[FlashcardResponse]
    total: int
    page: int
    page_size: int


class FlashcardReviewRequest(BaseModel):
    """Schéma pour soumettre une révision de flashcard"""
    quality: int = Field(..., ge=0, le=3, description="Qualité de la révision (0=AGAIN, 1=HARD, 2=GOOD, 3=EASY)")
    response_time_seconds: float = Field(..., ge=0, description="Temps de réponse en secondes")


class FlashcardReviewResponse(BaseModel):
    """Schéma de réponse après révision"""
    flashcard: FlashcardResponse
    xp_earned: int
    message: str
    next_review_in_days: int


class FSRSMetrics(BaseModel):
    """Métriques FSRS spécifiques"""
    stability: float  # Durée estimée avant oubli (jours)
    difficulty: float  # Difficulté intrinsèque (1-10)
    retrievability: float  # Probabilité de rappel actuelle (%)
    lapses: int  # Nombre d'échecs
    stability_display: str  # Affichage formaté de la stabilité


class FlashcardStatsResponse(BaseModel):
    """Schéma pour les statistiques d'une flashcard (avec métriques FSRS)"""
    flashcard_id: int
    total_reviews: int
    correct_reviews: int
    incorrect_reviews: int
    success_rate: float
    mastery_percentage: float
    average_response_time_seconds: float
    status: FlashcardStatus
    ease_factor: float
    interval: int
    repetitions: int
    next_review_at: Optional[datetime]
    difficulty_breakdown: dict
    recent_reviews: List[dict]
    # FSRS metrics
    fsrs_metrics: Optional[FSRSMetrics] = None

    model_config = ConfigDict(from_attributes=True)


# ========== FLASHCARD REVIEW SCHEMAS ==========

class FlashcardReviewHistoryResponse(BaseModel):
    """Schéma pour l'historique d'une révision"""
    id: int
    flashcard_id: int
    quality: int
    response_time_seconds: float
    ease_factor_before: Optional[float]
    interval_before: Optional[int]
    ease_factor_after: Optional[float]
    interval_after: Optional[int]
    next_review_at: Optional[datetime]
    reviewed_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ========== DECK SCHEMAS ==========

class SubjectInfo(BaseModel):
    """Info basique d'une matière"""
    id: int
    name: str
    color: str


class FlashcardDeckResponse(BaseModel):
    """Schéma de réponse pour un deck de flashcards"""
    id: str  # deck_name utilisé comme id
    title: str  # deck_name
    description: str
    subject_id: Optional[int]
    subject: Optional[SubjectInfo]
    total_cards: int
    cards_due: int
    mastered_cards: int
    created_at: Optional[datetime]  # Peut être None pour les anciennes flashcards
    last_reviewed_at: Optional[datetime]
