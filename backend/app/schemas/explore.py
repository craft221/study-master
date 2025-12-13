"""
Schemas pour l'API Explore
"""

from typing import Optional, List, Literal
from pydantic import BaseModel, Field
from datetime import datetime


# ================== Types ==================

ContentType = Literal["all", "notes", "flashcards", "quizzes"]
SortBy = Literal["recent", "popular", "rating"]


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
    created_at: Optional[str] = None


class PublicFlashcardDeckItem(BaseModel):
    """Deck de flashcards public"""
    type: str = "flashcard_deck"
    deck_name: str
    card_count: int
    subject: Optional[SubjectInfo] = None
    author: AuthorInfo
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
    created_at: Optional[str] = None


# ================== Request/Response ==================

class ExploreSearchRequest(BaseModel):
    """Paramètres de recherche"""
    content_type: ContentType = "all"
    query: Optional[str] = Field(None, min_length=1, max_length=200)
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    tags: Optional[List[str]] = None
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
