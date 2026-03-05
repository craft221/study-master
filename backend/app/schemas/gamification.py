"""
Schémas Pydantic pour la Gamification
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class AchievementBase(BaseModel):
    name: str
    description: str
    category: str
    rarity: str
    icon: Optional[str] = None
    xp_reward: int = 0
    requirement_value: int
    requirement_type: str


class AchievementResponse(AchievementBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AchievementListResponse(BaseModel):
    achievements: List[AchievementResponse]
    total: int


class UserAchievementBase(BaseModel):
    achievement_id: int
    progress: int = 0


class UserAchievementResponse(BaseModel):
    id: int
    user_id: int
    achievement_id: int
    progress: int
    is_unlocked: bool
    unlocked_at: Optional[datetime] = None
    created_at: datetime
    achievement: Optional[AchievementResponse] = None

    class Config:
        from_attributes = True


class UserAchievementListResponse(BaseModel):
    achievements: List[UserAchievementResponse]
    total: int


class LeaderboardResponse(BaseModel):
    id: int
    user_id: int
    leaderboard_type: str
    period: str
    score: int
    rank: Optional[int] = None
    period_start: datetime
    period_end: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    username: str
    score: int
    avatar_url: Optional[str] = None
    level: int = 1
    streak: int = 0


class LeaderboardListResponse(BaseModel):
    leaderboard_type: str
    period: str
    entries: List[LeaderboardEntry]
    total_participants: int
    user_rank: Optional[int] = None
    user_score: Optional[int] = None


# Alias pour rétrocompatibilité
LeaderboardEntryResponse = LeaderboardEntry


class DuelCreate(BaseModel):
    opponent_id: int
    subject_id: Optional[int] = None
    quiz_id: Optional[int] = None
    stakes_xp: int = 50
    duration_minutes: int = 30


class DuelComplete(BaseModel):
    """Données pour compléter un duel manuellement"""
    challenger_score: int = Field(..., ge=0, le=100)
    opponent_score: int = Field(..., ge=0, le=100)


class UserBrief(BaseModel):
    """Info utilisateur pour affichage"""
    id: int
    username: str
    avatar_url: Optional[str] = None
    level: int

    class Config:
        from_attributes = True


class QuizBrief(BaseModel):
    """Info quiz pour affichage"""
    id: int
    title: str

    class Config:
        from_attributes = True


class DuelResponse(BaseModel):
    id: int
    challenger_id: int
    opponent_id: int
    subject_id: Optional[int] = None
    quiz_id: Optional[int] = None
    status: str
    challenger_score: Optional[int] = None
    opponent_score: Optional[int] = None
    winner_id: Optional[int] = None
    stakes_xp: int = 50
    duration_minutes: int = 30
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    # Relations optionnelles
    challenger: Optional[UserBrief] = None
    opponent: Optional[UserBrief] = None
    quiz: Optional[QuizBrief] = None

    class Config:
        from_attributes = True


class DuelListResponse(BaseModel):
    duels: List[DuelResponse]
    total: int
    page: int = 1
    page_size: int = 20
