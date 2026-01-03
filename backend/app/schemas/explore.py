"""
Schemas pour l'API Explore
"""

from typing import Optional, List, Literal
from pydantic import BaseModel, Field
from datetime import datetime


# ================== Types ==================

ContentType = Literal["all", "notes", "flashcards", "quizzes"]
SortBy = Literal["recent", "popular", "rating"]
Language = Literal["fr", "en", "es", "all"]
ReportReason = Literal["inappropriate", "spam", "harassment", "copyright", "misinformation", "other"]


# ================== Sub-schemas ==================

class AuthorInfo(BaseModel):
    """Informations sur l'auteur"""
    id: int
    username: str
    avatar_url: Optional[str] = None


class SubjectInfo(BaseModel):
    """Informations sur la matière"""
    id: int
    name: str
    color: Optional[str] = None


# ================== Content Items ==================

class PublicNoteItem(BaseModel):
    """Note publique"""
    id: int
    type: str = "note"
    title: str
    content_preview: str
    subject: Optional[SubjectInfo] = None
    author: Optional[AuthorInfo] = None
    tags: List[str] = []
    language: str = "fr"
    created_at: Optional[str] = None


class PublicFlashcardDeckItem(BaseModel):
    """Deck de flashcards public"""
    id: Optional[int] = None  # ID du deck si disponible
    type: str = "flashcard_deck"
    deck_name: str
    card_count: int
    subject: Optional[SubjectInfo] = None
    author: AuthorInfo
    language: str = "fr"
    created_at: Optional[str] = None


class PublicQuizItem(BaseModel):
    """Quiz public"""
    id: int
    type: str = "quiz"
    title: str
    description: Optional[str] = None
    question_count: int
    difficulty: str = "medium"
    time_limit_minutes: Optional[int] = None
    total_plays: int = 0
    average_score: float = 0.0
    share_code: Optional[str] = None
    subject: Optional[SubjectInfo] = None
    author: Optional[AuthorInfo] = None
    is_ai_generated: bool = False
    language: str = "fr"
    created_at: Optional[str] = None


# ================== Request/Response ==================

class ExploreSearchRequest(BaseModel):
    """Paramètres de recherche"""
    content_type: ContentType = "all"
    query: Optional[str] = Field(None, min_length=1, max_length=200)
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    tags: Optional[List[str]] = None
    language: Language = "all"  # Filtre par langue
    sort_by: SortBy = "recent"
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=50)


class ExploreSearchResponse(BaseModel):
    """Résultats de recherche"""
    notes: List[PublicNoteItem] = []
    flashcards: List[PublicFlashcardDeckItem] = []
    quizzes: List[PublicQuizItem] = []
    total_count: int = 0
    page: int = 1
    limit: int = 20
    has_more: bool = False


class PopularSubjectItem(BaseModel):
    """Matière populaire"""
    id: int
    name: str
    color: Optional[str] = None
    content_count: int = 0


class PopularSubjectsResponse(BaseModel):
    """Liste des matières populaires"""
    subjects: List[PopularSubjectItem]


class TrendingQuizItem(BaseModel):
    """Quiz tendance"""
    id: int
    title: str
    total_plays: int
    share_code: Optional[str] = None
    author: AuthorInfo


class TrendingContentResponse(BaseModel):
    """Contenu tendance"""
    trending_quizzes: List[TrendingQuizItem] = []


# ================== Actions (rendre public) ==================

class MakePublicRequest(BaseModel):
    """Demande pour rendre un contenu public"""
    is_public: bool = True


class MakePublicResponse(BaseModel):
    """Réponse après modification de visibilité"""
    success: bool
    message: str
    is_public: bool


# ================== Report (Signalement) ==================

class ReportContentRequest(BaseModel):
    """Demande de signalement de contenu"""
    content_type: ContentType  # note, flashcard_deck, quiz (pas "all")
    content_id: int
    reason: ReportReason
    description: Optional[str] = Field(None, max_length=1000)


class ReportContentResponse(BaseModel):
    """Réponse après signalement"""
    success: bool
    message: str
    report_id: int


# ================== Duplication ==================

class DuplicateContentRequest(BaseModel):
    """Demande de duplication de contenu public"""
    content_type: ContentType  # note, flashcard_deck, quiz (pas "all")
    content_id: int
    # Pour les decks de flashcards (identifié par deck_name + subject_id + user_id)
    deck_name: Optional[str] = None
    deck_owner_id: Optional[int] = None
    deck_subject_id: Optional[int] = None


class DuplicateContentResponse(BaseModel):
    """Réponse après duplication"""
    success: bool
    message: str
    new_content_id: int
    content_type: str
