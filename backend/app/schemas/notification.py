"""
Schémas Pydantic pour les Notifications
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class NotificationBase(BaseModel):
    """Base pour les notifications"""
    title: str = Field(..., max_length=255)
    message: str
    type: str
    priority: str = "normal"
    action_url: Optional[str] = None
    data: Optional[str] = None


class NotificationCreate(NotificationBase):
    """Création de notification (usage interne)"""
    user_id: int
    channel: str = "in_app"


class NotificationResponse(BaseModel):
    """Réponse notification"""
    id: int
    user_id: int
    type: str
    title: str
    message: str
    priority: str
    channel: str
    is_read: bool
    read_at: Optional[datetime] = None
    action_url: Optional[str] = None
    data: Optional[str] = None
    created_at: datetime
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    """Liste de notifications avec pagination"""
    notifications: List[NotificationResponse]
    total: int
    unread_count: int
    page: int = 1
    page_size: int = 20


class NotificationMarkRead(BaseModel):
    """Marquer des notifications comme lues"""
    notification_ids: List[int] = Field(..., min_length=1)


class NotificationMarkAllRead(BaseModel):
    """Marquer toutes les notifications comme lues"""
    before_date: Optional[datetime] = None


class NotificationPreferenceUpdate(BaseModel):
    """Mise à jour des préférences de notification"""
    email_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    in_app_enabled: Optional[bool] = None
    duel_notifications: Optional[bool] = None
    calendar_notifications: Optional[bool] = None
    streak_notifications: Optional[bool] = None
    study_reminders: Optional[bool] = None
    achievement_notifications: Optional[bool] = None
    social_notifications: Optional[bool] = None
    quiet_hours_start: Optional[int] = Field(None, ge=0, le=23)
    quiet_hours_end: Optional[int] = Field(None, ge=0, le=23)
    email_digest: Optional[bool] = None
    email_digest_hour: Optional[int] = Field(None, ge=0, le=23)


class NotificationPreferenceResponse(BaseModel):
    """Réponse des préférences de notification"""
    id: int
    user_id: int
    email_enabled: bool
    push_enabled: bool
    in_app_enabled: bool
    duel_notifications: bool
    calendar_notifications: bool
    streak_notifications: bool
    study_reminders: bool
    achievement_notifications: bool
    social_notifications: bool
    quiet_hours_start: int
    quiet_hours_end: int
    email_digest: bool
    email_digest_hour: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    """Nombre de notifications non lues"""
    unread_count: int
    by_type: dict = {}
