from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.quiz import QuizDifficulty, QuizType, QuestionType


# ========== QUIZ SCHEMAS ==========

class QuestionSchema(BaseModel):
    """Schéma pour une question de quiz"""
    question: str = Field(..., min_length=1, max_length=1000)
    type: QuestionType
    options: Optional[List[str]] = None  # Pour multiple_choice
    correct_answer: str = Field(..., min_length=1, max_length=5000)
    explanation: Optional[str] = None
    points: int = Field(default=10, ge=1, le=100)


class QuizBase(BaseModel):
    """Schéma de base pour Quiz"""
    subject_id: int
    source_note_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=300)
    description: Optional[str] = None
    quiz_type: QuizType = QuizType.PRACTICE
    difficulty: QuizDifficulty = QuizDifficulty.MEDIUM
    questions: List[QuestionSchema] = Field(..., min_items=1, max_items=100)
    passing_score: int = Field(default=60, ge=0, le=100, description="Pourcentage minimum pour réussir")
    time_limit_minutes: Optional[int] = Field(None, ge=1, le=480)
    is_timed: bool = False
    allow_multiple_attempts: bool = True
    show_correct_answers: bool = True
    randomize_questions: bool = False
    randomize_options: bool = False
    is_ai_generated: bool = False


class QuizCreate(QuizBase):
    """Schéma pour créer un Quiz"""
    pass


class QuizUpdate(BaseModel):
    """Schéma pour mettre à jour un Quiz"""
    subject_id: Optional[int] = None
    source_note_id: Optional[int] = None
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    description: Optional[str] = None
    quiz_type: Optional[QuizType] = None
    difficulty: Optional[QuizDifficulty] = None
    questions: Optional[List[QuestionSchema]] = None
    passing_score: Optional[int] = Field(None, ge=0, le=100)
    time_limit_minutes: Optional[int] = None
    is_timed: Optional[bool] = None
    allow_multiple_attempts: Optional[bool] = None
    show_correct_answers: Optional[bool] = None
    randomize_questions: Optional[bool] = None
    randomize_options: Optional[bool] = None
    is_published: Optional[bool] = None


class QuizResponse(BaseModel):
    """Schéma de réponse pour Quiz"""
    id: int
    user_id: int
    subject_id: int
    source_note_id: Optional[int]
    title: str
    description: Optional[str]
    quiz_type: QuizType
    difficulty: QuizDifficulty
    questions: List[Dict[str, Any]]
    total_points: int
    passing_score: int
    time_limit_minutes: Optional[int]
    is_ai_generated: bool
    ai_prompt_used: Optional[str]
    total_attempts: int
    average_score: float
    highest_score: float
    completion_rate: float
    is_published: bool
    is_timed: bool
    allow_multiple_attempts: bool
    show_correct_answers: bool
    randomize_questions: bool
    randomize_options: bool
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class QuizListResponse(BaseModel):
    """Schéma pour la liste de Quizzes avec pagination"""
    quizzes: List[QuizResponse]
    total: int
    page: int
    page_size: int


class QuizSummaryResponse(BaseModel):
    """Schéma résumé pour Quiz (sans les questions complètes)"""
    id: int
    title: str
    description: Optional[str]
    quiz_type: QuizType
    difficulty: QuizDifficulty
    questions_count: int
    total_points: int
    passing_score: int
    time_limit_minutes: Optional[int]
    total_attempts: int
    average_score: float
    highest_score: float
    is_published: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ========== QUIZ ATTEMPT SCHEMAS ==========

class AnswerSchema(BaseModel):
    """Schéma pour une réponse d'utilisateur"""
    question_id: int = Field(..., ge=0, description="Index de la question (0-based)")
    user_answer: str = Field(..., min_length=1, max_length=5000)
    time_spent_seconds: Optional[float] = Field(None, ge=0)


class QuizAttemptCreate(BaseModel):
    """Schéma pour commencer une tentative de quiz"""
    quiz_id: int


class QuizAttemptSubmit(BaseModel):
    """Schéma pour soumettre les réponses d'un quiz"""
    answers: List[AnswerSchema] = Field(..., min_items=1)


class QuizAttemptResponse(BaseModel):
    """Schéma de réponse pour une tentative de quiz"""
    id: int
    user_id: int
    quiz_id: int
    attempt_number: int
    answers: List[Dict[str, Any]]
    score: float
    points_earned: int
    points_possible: int
    is_passed: bool
    time_started: Optional[datetime]
    time_completed: Optional[datetime]
    total_time_seconds: Optional[int]
    is_completed: bool
    is_abandoned: bool
    ai_feedback: Optional[str]
    strengths: Optional[List[str]]
    weaknesses: Optional[List[str]]
    recommendations: Optional[List[str]]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QuizResultsResponse(BaseModel):
    """Schéma détaillé des résultats d'un quiz"""
    attempt: QuizAttemptResponse
    quiz_title: str
    passing_score: int
    show_correct_answers: bool
    detailed_answers: List[Dict[str, Any]]  # Questions avec réponses correctes/incorrectes
    performance_summary: Dict[str, Any]
    xp_earned: int


class QuizAttemptListResponse(BaseModel):
    """Schéma pour la liste des tentatives avec pagination"""
    attempts: List[QuizAttemptResponse]
    total: int
    page: int
    page_size: int


class QuizStatsResponse(BaseModel):
    """Schéma pour les statistiques d'un quiz"""
    quiz_id: int
    total_attempts: int
    unique_users: int
    average_score: float
    highest_score: float
    lowest_score: float
    completion_rate: float
    average_time_seconds: Optional[float]
    pass_rate: float
    difficulty_breakdown: Dict[str, int]
    recent_attempts: List[Dict[str, Any]]

    model_config = ConfigDict(from_attributes=True)
