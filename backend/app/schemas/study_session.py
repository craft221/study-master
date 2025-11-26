from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.models.study_session import SessionType, SessionStatus


# ========== STUDY SESSION SCHEMAS ==========

class StudySessionBase(BaseModel):
    """Schéma de base pour StudySession"""
    subject_id: int
    session_type: SessionType = SessionType.POMODORO
    planned_duration_minutes: int = Field(default=25, ge=5, le=240)
    break_duration_minutes: int = Field(default=5, ge=1, le=60)
    notes: Optional[str] = None
    tags: Optional[str] = None


class StudySessionCreate(StudySessionBase):
    """Schéma pour créer une session d'étude"""
    pass


class StudySessionUpdate(BaseModel):
    """Schéma pour mettre à jour une session"""
    subject_id: Optional[int] = None
    session_type: Optional[SessionType] = None
    planned_duration_minutes: Optional[int] = Field(None, ge=5, le=240)
    break_duration_minutes: Optional[int] = Field(None, ge=1, le=60)
    notes: Optional[str] = None
    tags: Optional[str] = None
    actual_duration_minutes: Optional[int] = None
    productivity_rating: Optional[int] = Field(None, ge=1, le=5)


class StudySessionResponse(StudySessionBase):
    """Schéma de réponse pour StudySession"""
    id: int
    user_id: int
    status: SessionStatus
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    actual_duration_minutes: Optional[int]
    productivity_rating: Optional[int]
    focus_score: Optional[float]
    distractions_count: int
    breaks_taken: int
    xp_earned: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StudySessionListResponse(BaseModel):
    """Schéma pour liste de sessions avec pagination"""
    sessions: List[StudySessionResponse]
    total: int
    page: int
    page_size: int


class StudySessionStatsResponse(BaseModel):
    """Statistiques des sessions d'étude"""
    total_sessions: int
    total_minutes: int
    total_hours: float
    average_duration: float
    average_productivity: float
    average_focus: float
    sessions_by_type: dict
    sessions_by_subject: dict
    best_time_of_day: Optional[str]
    total_xp_earned: int


# ========== SCHEDULE SCHEMAS ==========

class ScheduleBase(BaseModel):
    """Schéma de base pour Schedule"""
    subject_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    event_type: str = Field(..., pattern="^(class|exam|homework|revision|other)$")
    location: Optional[str] = None
    start_time: datetime
    end_time: datetime
    day_of_week: Optional[str] = None
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None
    color: str = Field(default="#3B82F6", max_length=7)
    reminder_minutes_before: Optional[int] = Field(None, ge=0, le=1440)


class ScheduleCreate(ScheduleBase):
    """Schéma pour créer un événement"""
    pass


class ScheduleUpdate(BaseModel):
    """Schéma pour mettre à jour un événement"""
    subject_id: Optional[int] = None
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    event_type: Optional[str] = None
    location: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    day_of_week: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence_pattern: Optional[str] = None
    color: Optional[str] = None
    reminder_minutes_before: Optional[int] = None
    is_completed: Optional[bool] = None


class ScheduleResponse(ScheduleBase):
    """Schéma de réponse pour Schedule"""
    id: int
    user_id: int
    is_completed: bool
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScheduleListResponse(BaseModel):
    """Liste d'événements avec pagination"""
    events: List[ScheduleResponse]
    total: int
    page: int
    page_size: int
