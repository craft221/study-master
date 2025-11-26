"""
Schémas pour les messages de groupe
"""

from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional


class GroupMessageCreate(BaseModel):
    """Créer un message"""
    content: str = Field(..., min_length=1, max_length=5000)


class GroupMessageUpdate(BaseModel):
    """Mettre à jour un message"""
    content: str = Field(..., min_length=1, max_length=5000)


class GroupMessageResponse(BaseModel):
    """Réponse message"""
    id: int
    group_id: int
    user_id: int
    username: str
    avatar_url: Optional[str]
    content: str
    is_edited: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GroupMessageListResponse(BaseModel):
    """Liste de messages"""
    messages: list[GroupMessageResponse]
    total: int
    page: int
    page_size: int
