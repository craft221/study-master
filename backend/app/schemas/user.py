from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


# Enums
class UserRoleEnum(str, Enum):
    STUDENT = "STUDENT"
    TEACHER = "TEACHER"
    MODERATOR = "MODERATOR"
    ADMIN = "ADMIN"


class SubscriptionTypeEnum(str, Enum):
    FREE = "FREE"
    PREMIUM = "PREMIUM"
    PREMIUM_PLUS = "PREMIUM_PLUS"
    INSTITUTIONAL = "INSTITUTIONAL"


# Auth Schemas
class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = Field(None, max_length=100)
    university: Optional[str] = Field(None, max_length=200)
    major: Optional[str] = Field(None, max_length=100)
    promotion: Optional[str] = Field(None, max_length=50)

    @validator('username')
    def username_alphanumeric(cls, v):
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Le username ne peut contenir que des lettres, chiffres, _ et -')
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None
    username: Optional[str] = None


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    university: Optional[str] = None
    major: Optional[str] = None
    promotion: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    bio: Optional[str] = None
    university: Optional[str] = None
    major: Optional[str] = None
    promotion: Optional[str] = None
    student_id: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    language: Optional[str] = None
    theme: Optional[str] = None
    notifications_enabled: Optional[bool] = None


class LanguageUpdate(BaseModel):
    """Mise à jour de la langue de l'utilisateur"""
    language: str

    @validator('language')
    def validate_language(cls, v):
        from app.core.i18n import SUPPORTED_LANGUAGES
        if v not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Langue non supportée. Langues supportées: {', '.join(SUPPORTED_LANGUAGES)}")
        return v


class UserResponse(UserBase):
    id: int
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    role: UserRoleEnum
    subscription_type: SubscriptionTypeEnum

    # Gamification
    total_xp: int
    level: int
    current_streak: int
    longest_streak: int

    # Stats
    total_study_time_minutes: int
    total_notes_created: int
    total_flashcards_created: int
    total_quizzes_completed: int

    # Status
    is_active: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserProfile(UserResponse):
    """Version détaillée du profil utilisateur"""
    student_id: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None
    theme: Optional[str] = None
    notifications_enabled: bool
    email_notifications: bool
    last_activity_date: Optional[datetime] = None
    subscription_ends_at: Optional[datetime] = None

    # AI Usage
    ai_requests_today: int
    total_ai_requests: int

    class Config:
        from_attributes = True


class UserStats(BaseModel):
    """Statistiques détaillées de l'utilisateur"""
    user_id: int

    # XP & Levels
    total_xp: int
    level: int
    xp_for_next_level: int
    xp_progress_percentage: float

    # Streaks
    current_streak: int
    longest_streak: int

    # Time Stats
    total_study_time_minutes: int
    total_study_time_hours: float
    average_study_time_per_day: float

    # Content Stats
    total_notes_created: int
    total_flashcards_created: int
    total_flashcards_reviewed: int
    total_quizzes_completed: int

    # Performance
    average_quiz_score: Optional[float] = None
    flashcards_mastery_percentage: Optional[float] = None

    # Subjects
    total_subjects: int
    active_subjects: int

    # Rankings (si disponible)
    global_rank: Optional[int] = None
    university_rank: Optional[int] = None
    promotion_rank: Optional[int] = None

    class Config:
        from_attributes = True


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str

    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Les mots de passe ne correspondent pas')
        return v

class PasswordReset(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str

    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Les mots de passe ne correspondent pas')
        return v


# Extended User Schemas for API
class UserProfileResponse(UserProfile):
    """Réponse complète du profil utilisateur pour API"""
    pass


class UserStatsResponse(BaseModel):
    """Statistiques complètes de l'utilisateur"""
    user_id: int
    username: str
    email: EmailStr
    full_name: Optional[str]
    avatar_url: Optional[str]

    # XP & Levels
    total_xp: int
    level: int
    xp_progress: int
    xp_needed_for_next_level: int

    # Streaks
    current_streak: int
    longest_streak: int

    # Content Stats
    total_subjects: int
    total_notes: int
    total_flashcards: int
    flashcards_due_today: int
    total_flashcards_reviewed: int
    total_quizzes: int
    completed_quiz_attempts: int
    average_quiz_score: float

    # Study Time
    total_study_time_minutes: int
    study_time_this_month: int

    # Weekly Activity
    notes_this_week: int
    flashcards_reviewed_this_week: int
    quizzes_taken_this_week: int

    # Membership
    member_since: datetime
    last_login: Optional[datetime]

    # Achievement Progress Stats
    duels_participated: int = 0
    duels_won: int = 0
    perfect_quizzes: int = 0
    pdfs_imported: int = 0
    daily_quests_completed: int = 0

    class Config:
        from_attributes = True


class UserActivityResponse(BaseModel):
    """Activité récente de l'utilisateur"""
    activities: List
    period_days: int
    total_activities: int
