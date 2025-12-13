"""
Schémas pour les endpoints IA
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ========== GÉNÉRATION DE FLASHCARDS ==========

class GenerateFlashcardsRequest(BaseModel):
    """Requête pour générer des flashcards depuis du contenu"""
    content: str = Field(..., min_length=50, description="Contenu à analyser")
    subject: str = Field(..., min_length=1, description="Matière/sujet")
    subject_id: int = Field(..., description="ID de la matière")
    deck_name: Optional[str] = Field(None, description="Nom du deck")
    num_flashcards: int = Field(20, ge=5, le=50, description="Nombre de flashcards à générer")


class GenerateFlashcardsResponse(BaseModel):
    """Réponse après demande de génération de flashcards"""
    task_id: str
    status: str = "PENDING"
    message: str = "Génération de flashcards en cours..."


# ========== GÉNÉRATION DE QUIZ ==========

class GenerateQuizRequest(BaseModel):
    """Requête pour générer un quiz depuis du contenu"""
    content: str = Field(..., min_length=50, description="Contenu à analyser")
    subject: str = Field(..., min_length=1, description="Matière/sujet")
    subject_id: int = Field(..., description="ID de la matière")
    difficulty: str = Field("medium", pattern="^(easy|medium|hard)$", description="Difficulté")
    num_questions: int = Field(10, ge=5, le=30, description="Nombre de questions")


class GenerateQuizResponse(BaseModel):
    """Réponse après demande de génération de quiz"""
    task_id: str
    status: str = "PENDING"
    message: str = "Génération du quiz en cours..."


# ========== RÉSUMÉ ==========

class SummarizeRequest(BaseModel):
    """Requête pour résumer du contenu"""
    content: str = Field(..., min_length=100, description="Contenu à résumer")
    max_length: int = Field(500, ge=100, le=2000, description="Longueur max du résumé en mots")


class SummarizeResponse(BaseModel):
    """Réponse après résumé"""
    summary: str
    word_count: int
    original_length: int


# ========== EXTRACTION DE MOTS-CLÉS ==========

class ExtractKeywordsRequest(BaseModel):
    """Requête pour extraire des mots-clés"""
    content: str = Field(..., min_length=50, description="Contenu à analyser")
    num_keywords: int = Field(10, ge=5, le=30, description="Nombre de mots-clés")
    language: str = Field("fr", description="Langue du contenu")


class ExtractKeywordsResponse(BaseModel):
    """Réponse après extraction de mots-clés"""
    keywords: List[str]
    concepts: List[Dict[str, Any]]  # [{keyword, importance, context}]


# ========== ANALYSE DE PROGRÈS ==========

class AnalyzeProgressResponse(BaseModel):
    """Réponse après analyse des progrès"""
    strengths: List[str]
    weaknesses: List[str]
    recommendations: List[str]
    next_steps: List[str]
    overall_score: float
    subject_mastery: Dict[str, float]


# ========== STATUT DE TÂCHE ==========

class TaskStatusResponse(BaseModel):
    """Statut d'une tâche Celery"""
    task_id: str
    status: str  # PENDING, STARTED, SUCCESS, FAILURE, RETRY
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    progress: Optional[int] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


# ========== GÉNÉRATION DE PLAN D'ÉTUDE ==========

class GenerateStudyPlanRequest(BaseModel):
    """Requête pour générer un plan d'étude personnalisé"""
    subject_id: int
    exam_date: Optional[datetime] = None
    available_hours_per_week: int = Field(10, ge=1, le=168)
    difficulty_level: str = Field("medium", pattern="^(beginner|intermediate|advanced)$")


class GenerateStudyPlanResponse(BaseModel):
    """Plan d'étude généré"""
    task_id: str
    status: str = "PENDING"
    message: str = "Génération du plan d'étude en cours..."
