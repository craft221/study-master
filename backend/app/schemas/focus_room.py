"""
Schemas Pydantic pour Focus Rooms
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ==================== ENUMS ====================

class FocusRoomType(str, Enum):
    PUBLIC = "public"
    SUBJECT = "subject"
    UNIVERSITY = "university"
    PRIVATE = "private"
    EVENT = "event"


class FocusRoomCategory(str, Enum):
    GENERAL = "general"
    SCIENCES = "sciences"
    HUMANITIES = "humanities"
    LANGUAGES = "languages"
    BUSINESS = "business"
    TECHNOLOGY = "technology"
    MEDICINE = "medicine"
    LAW = "law"
    OTHER = "other"


class ParticipantStatus(str, Enum):
    FOCUSING = "focusing"
    DEEP_WORK = "deep_work"
    BREAK = "break"
    IDLE = "idle"
    AWAY = "away"


class FocusActivityType(str, Enum):
    USER_JOINED = "user_joined"
    USER_LEFT = "user_left"
    MILESTONE_30MIN = "milestone_30min"
    MILESTONE_1H = "milestone_1h"
    MILESTONE_2H = "milestone_2h"
    MILESTONE_3H = "milestone_3h"
    QUIZ_COMPLETED = "quiz_completed"
    FLASHCARDS_COMPLETED = "flashcards_completed"
    STREAK_ACHIEVED = "streak_achieved"
    FIRST_TODAY = "first_today"
    STATUS_CHANGED = "status_changed"
    POKE_SENT = "poke_sent"
    DEEP_WORK_STARTED = "deep_work_started"
    DEEP_WORK_COMPLETED = "deep_work_completed"


class InvitationStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"


# ==================== ROOM SCHEMAS ====================

class FocusRoomCreate(BaseModel):
    """Schema pour creer une room"""
    name: str = Field(..., min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    emoji: str = Field(default="📚", max_length=10)
    room_type: FocusRoomType = FocusRoomType.PUBLIC
    category: FocusRoomCategory = FocusRoomCategory.GENERAL
    max_participants: int = Field(default=100, ge=10, le=500)
    subject_id: Optional[int] = None
    university: Optional[str] = Field(None, max_length=200)
    promotion: Optional[str] = Field(None, max_length=50)
    is_private: bool = False
    starts_at: Optional[datetime] = None  # Pour events
    ends_at: Optional[datetime] = None    # Pour events

    @validator('ends_at')
    def validate_dates(cls, v, values):
        if v and values.get('starts_at'):
            if v <= values['starts_at']:
                raise ValueError('ends_at must be after starts_at')
        return v


class FocusRoomUpdate(BaseModel):
    """Schema pour modifier une room"""
    name: Optional[str] = Field(None, min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    emoji: Optional[str] = Field(None, max_length=10)
    category: Optional[FocusRoomCategory] = None
    max_participants: Optional[int] = Field(None, ge=10, le=500)
    is_active: Optional[bool] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class FocusRoomResponse(BaseModel):
    """Schema de reponse pour une room"""
    id: int
    name: str
    description: Optional[str]
    emoji: str
    room_type: FocusRoomType
    category: FocusRoomCategory
    subject_id: Optional[int]
    subject_name: Optional[str] = None
    university: Optional[str]
    promotion: Optional[str]
    max_participants: int
    is_active: bool
    is_private: bool
    invite_code: Optional[str] = None
    creator_id: int
    creator_username: Optional[str] = None
    creator_avatar: Optional[str] = None

    # Stats
    total_focus_minutes: int
    total_sessions: int
    total_unique_users: int
    today_focus_minutes: int
    today_sessions: int
    active_participants: int = 0

    # Event
    starts_at: Optional[datetime]
    ends_at: Optional[datetime]

    # Timestamps
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FocusRoomListResponse(BaseModel):
    """Schema pour la liste des rooms"""
    rooms: List[FocusRoomResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class FocusRoomDetailResponse(FocusRoomResponse):
    """Schema detaille avec participants"""
    participants: List['ParticipantResponse'] = []
    recent_activities: List['ActivityResponse'] = []
    stats: Optional['RoomStatsResponse'] = None


# ==================== PARTICIPANT SCHEMAS ====================

class JoinRoomRequest(BaseModel):
    """Schema pour rejoindre une room"""
    activity: Optional[str] = Field(None, max_length=200)
    subject_id: Optional[int] = None
    is_visible: bool = True
    show_activity: bool = True
    invite_code: Optional[str] = None  # Pour rooms privees


class UpdateStatusRequest(BaseModel):
    """Schema pour changer de statut"""
    status: ParticipantStatus


class UpdateActivityRequest(BaseModel):
    """Schema pour changer d'activite"""
    activity: Optional[str] = Field(None, max_length=200)
    subject_id: Optional[int] = None


class StartDeepWorkRequest(BaseModel):
    """Schema pour demarrer le mode Deep Work"""
    duration_minutes: int = Field(default=90, ge=30, le=180)


class DeepWorkStatusResponse(BaseModel):
    """Schema de reponse pour le statut Deep Work"""
    in_deep_work: bool
    started_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    remaining_minutes: int = 0
    sessions_completed: int = 0
    notifications_blocked: bool = False


class EventCountdownResponse(BaseModel):
    """Schema de reponse pour le compte a rebours d'un evenement"""
    status: str  # upcoming, active, ended, not_event, no_dates
    starts_in_seconds: Optional[int] = None
    starts_in_minutes: Optional[int] = None
    starts_at: Optional[datetime] = None
    ends_in_seconds: Optional[int] = None
    ends_in_minutes: Optional[int] = None
    ends_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class CreateEventRoomRequest(FocusRoomCreate):
    """Schema pour creer une salle evenement/temporaire"""
    starts_at: datetime = Field(..., description="Date/heure de debut de l'evenement")
    ends_at: datetime = Field(..., description="Date/heure de fin de l'evenement")

    @validator('ends_at')
    def validate_event_dates(cls, v, values):
        if 'starts_at' in values and v <= values['starts_at']:
            raise ValueError('ends_at must be after starts_at')
        return v


class ParticipantResponse(BaseModel):
    """Schema de reponse pour un participant"""
    id: int
    user_id: int
    username: str
    avatar_url: Optional[str]
    level: int
    status: ParticipantStatus
    current_activity: Optional[str]
    current_subject_name: Optional[str] = None
    joined_at: datetime
    focus_minutes: int  # Minutes dans cette session
    today_focus_minutes: int
    milestones_reached: List[str] = []
    is_visible: bool = True

    class Config:
        from_attributes = True


# ==================== ACTIVITY SCHEMAS ====================

class ActivityResponse(BaseModel):
    """Schema de reponse pour une activite"""
    id: int
    activity_type: FocusActivityType
    user_id: int
    username: str
    avatar_url: Optional[str]
    message: Optional[str]
    extra_data: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== INVITATION SCHEMAS ====================

class InviteRequest(BaseModel):
    """Schema pour inviter quelqu'un"""
    invitee_id: int
    message: Optional[str] = Field(None, max_length=500)


class JoinByCodeRequest(BaseModel):
    """Schema pour rejoindre par code"""
    code: str = Field(..., min_length=8, max_length=8)
    activity: Optional[str] = Field(None, max_length=200)
    subject_id: Optional[int] = None


class InvitationResponse(BaseModel):
    """Schema de reponse pour une invitation"""
    id: int
    room_id: int
    room_name: str
    room_emoji: str
    inviter_id: int
    inviter_username: str
    inviter_avatar: Optional[str]
    invitee_id: int
    invitee_username: str
    status: InvitationStatus
    message: Optional[str]
    created_at: datetime
    expires_at: datetime
    responded_at: Optional[datetime]

    class Config:
        from_attributes = True


# ==================== POKE SCHEMAS ====================

class PokeRequest(BaseModel):
    """Schema pour envoyer un poke"""
    target_user_id: int
    message: Optional[str] = Field(None, max_length=200)


class PokeResponse(BaseModel):
    """Schema de reponse pour un poke"""
    id: int
    from_user_id: int
    from_username: str
    to_user_id: int
    message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== STATS SCHEMAS ====================

class RoomStatsResponse(BaseModel):
    """Stats d'une room"""
    active_participants: int
    today_focus_minutes: int
    today_sessions: int
    total_focus_minutes: int
    total_sessions: int
    total_unique_users: int
    peak_participants: int
    top_focuser: Optional[Dict[str, Any]] = None  # {user_id, username, minutes}
    hourly_distribution: Optional[Dict[int, int]] = None  # {hour: count}


class UserFocusStatsResponse(BaseModel):
    """Stats Focus Room d'un utilisateur"""
    total_focus_room_minutes: int
    total_focus_room_sessions: int
    total_rooms_joined: int
    total_rooms_created: int
    focus_room_streak_days: int
    best_focus_room_streak: int
    longest_session_minutes: int
    best_focus_score: int
    favorite_room_id: Optional[int]
    favorite_room_name: Optional[str]
    preferred_hour: Optional[int]
    total_xp_earned: int
    total_xp_bonus: int
    achievements: List[str] = []

    class Config:
        from_attributes = True


class LeaderboardEntry(BaseModel):
    """Entree du leaderboard"""
    rank: int
    user_id: int
    username: str
    avatar_url: Optional[str]
    level: int
    focus_minutes: int
    sessions_count: int


class RoomLeaderboardResponse(BaseModel):
    """Leaderboard d'une room"""
    room_id: int
    room_name: str
    period: str  # today, week, month, all_time
    entries: List[LeaderboardEntry]
    user_rank: Optional[int] = None
    user_entry: Optional[LeaderboardEntry] = None


# ==================== SESSION SCHEMAS ====================

class FocusSessionResponse(BaseModel):
    """Schema de reponse pour une session"""
    id: int
    room_id: Optional[int]
    room_name: Optional[str]
    user_id: int
    subject_id: Optional[int]
    subject_name: Optional[str]
    started_at: datetime
    ended_at: Optional[datetime]
    focus_minutes: int
    break_minutes: int
    total_minutes: int
    focus_score: Optional[int]
    activities_completed: int
    milestones_reached: List[str]
    xp_earned: int
    xp_bonus: int

    class Config:
        from_attributes = True


# ==================== WEBSOCKET SCHEMAS ====================

class WSMessage(BaseModel):
    """Message WebSocket generique"""
    type: str
    data: Dict[str, Any]


class WSHeartbeat(BaseModel):
    """Heartbeat du client"""
    type: str = "heartbeat"


class WSStatusUpdate(BaseModel):
    """Mise a jour de statut"""
    type: str = "status_update"
    status: ParticipantStatus


class WSActivityUpdate(BaseModel):
    """Mise a jour d'activite"""
    type: str = "activity_update"
    activity: Optional[str]
    subject_id: Optional[int]


class WSPoke(BaseModel):
    """Envoyer un poke"""
    type: str = "poke"
    target_user_id: int
    message: Optional[str]


class WSRoomState(BaseModel):
    """Etat complet de la room"""
    type: str = "room_state"
    room: FocusRoomResponse
    participants: List[ParticipantResponse]
    activities: List[ActivityResponse]
    stats: RoomStatsResponse


class WSUserJoined(BaseModel):
    """Notification user rejoint"""
    type: str = "user_joined"
    user_id: int
    username: str
    avatar_url: Optional[str]
    level: int
    activity: Optional[str]
    timestamp: datetime


class WSUserLeft(BaseModel):
    """Notification user parti"""
    type: str = "user_left"
    user_id: int
    username: str
    session_minutes: int
    timestamp: datetime


class WSStatusChanged(BaseModel):
    """Notification changement statut"""
    type: str = "status_changed"
    user_id: int
    new_status: ParticipantStatus
    focus_minutes: int
    timestamp: datetime


class WSActivityChanged(BaseModel):
    """Notification changement activite"""
    type: str = "activity_changed"
    user_id: int
    activity: Optional[str]
    subject_id: Optional[int]
    timestamp: datetime


class WSMilestoneReached(BaseModel):
    """Notification milestone atteint"""
    type: str = "milestone_reached"
    user_id: int
    username: str
    milestone: str  # 30min, 1h, 2h, 3h
    total_minutes: int
    timestamp: datetime


class WSRoomStatsUpdate(BaseModel):
    """Mise a jour stats room"""
    type: str = "room_stats_update"
    active_participants: int
    today_focus_minutes: int
    top_focuser: Optional[Dict[str, Any]]


class WSPokeReceived(BaseModel):
    """Notification poke recu"""
    type: str = "poke_received"
    from_user_id: int
    from_username: str
    message: Optional[str]
    timestamp: datetime


# ==================== FILTER SCHEMAS ====================

class RoomFilters(BaseModel):
    """Filtres pour lister les rooms"""
    room_type: Optional[FocusRoomType] = None
    category: Optional[FocusRoomCategory] = None
    university: Optional[str] = None
    subject_id: Optional[int] = None
    search: Optional[str] = None
    hide_empty: bool = False
    hide_full: bool = False
    sort_by: str = "active_participants"  # active_participants, created_at, name
    sort_order: str = "desc"
    page: int = 1
    page_size: int = 20


# Forward references
FocusRoomDetailResponse.model_rebuild()
