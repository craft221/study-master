from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from enum import Enum


class SubjectDifficultyEnum(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    VERY_HARD = "very_hard"


class SubjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    color: Optional[str] = Field("#3B82F6", pattern="^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = "📚"
    semester: Optional[str] = Field(None, max_length=50)
    year: Optional[str] = Field(None, max_length=20)
    credits_ects: Optional[int] = Field(0, ge=0, le=30)
    coefficient: Optional[float] = Field(1.0, ge=0, le=10)
    professor_name: Optional[str] = Field(None, max_length=100)
    professor_email: Optional[str] = Field(None, max_length=255)
    difficulty: Optional[SubjectDifficultyEnum] = SubjectDifficultyEnum.MEDIUM
    target_grade: Optional[float] = Field(None, ge=0, le=20)


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = None
    semester: Optional[str] = Field(None, max_length=50)
    year: Optional[str] = Field(None, max_length=20)
    credits_ects: Optional[int] = Field(None, ge=0, le=30)
    coefficient: Optional[float] = Field(None, ge=0, le=10)
    professor_name: Optional[str] = Field(None, max_length=100)
    professor_email: Optional[str] = Field(None, max_length=255)
    professor_notes: Optional[str] = None
    difficulty: Optional[SubjectDifficultyEnum] = None
    target_grade: Optional[float] = Field(None, ge=0, le=20)
    current_grade: Optional[float] = Field(None, ge=0, le=20)
    is_active: Optional[bool] = None
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None


class SubjectResponse(SubjectBase):
    id: int
    user_id: int
    professor_notes: Optional[str] = None
    current_grade: Optional[float] = None
    
    # Statistics
    total_notes_count: int
    total_flashcards_count: int
    total_quizzes_count: int
    total_study_time_minutes: int
    
    # Gamification
    xp_earned: int
    level: int
    mastery_percentage: float
    
    # Exam Info
    exam_date: Optional[datetime] = None
    exam_type: Optional[str] = None
    
    # Status
    is_active: bool
    is_favorite: bool
    is_archived: bool
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SubjectListResponse(BaseModel):
    subjects: list[SubjectResponse]
    total: int
    page: int
    page_size: int


class SubjectStats(BaseModel):
    """Statistiques détaillées d'une matière"""
    subject_id: int
    subject_name: str
    
    # Performance
    current_grade: Optional[float] = None
    target_grade: Optional[float] = None
    grade_progress: Optional[float] = None
    
    # Contenu
    total_notes: int
    total_flashcards: int
    total_quizzes: int
    
    # Temps
    total_study_time_minutes: int
    total_study_time_hours: float
    average_study_time_per_week: float
    
    # Performance
    average_quiz_score: Optional[float] = None
    flashcards_mastered: int
    flashcards_due: int
    
    # Progression
    xp_earned: int
    level: int
    mastery_percentage: float
    
    # Exam
    exam_date: Optional[datetime] = None
    days_until_exam: Optional[int] = None
    recommended_study_hours: Optional[float] = None