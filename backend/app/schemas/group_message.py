"""
Schémas pour les messages de groupe
"""

from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional


class GroupMessageCreate(BaseModel):
    """Créer un message"""
    content: str = Field(..., min_length=1, max_length=5000)
    reply_to_message_id: Optional[int] = None
    mentions: Optional[list[int]] = None  # List of user IDs mentioned


class GroupMessageUpdate(BaseModel):
    """Mettre à jour un message"""
    content: str = Field(..., min_length=1, max_length=5000)


class ReactionCount(BaseModel):
    """Nombre de réactions par emoji"""
    emoji: str
    count: int
    user_ids: list[int]  # IDs des utilisateurs qui ont réagi


class ReplyToMessage(BaseModel):
    """Info du message auquel on répond"""
    id: int
    user_id: int
    username: str
    content: str


class MentionedUser(BaseModel):
    """Utilisateur mentionné"""
    id: int
    username: str


class GroupMessageResponse(BaseModel):
    """Réponse message"""
    id: int
    group_id: int
    user_id: int
    username: str
    avatar_url: Optional[str]
    content: str
    is_edited: bool
    is_deleted: bool = False
    reply_to_message_id: Optional[int] = None
    reply_to: Optional[ReplyToMessage] = None
    mentions: Optional[list[int]] = None
    mentioned_users: Optional[list[MentionedUser]] = None
    reactions: Optional[list[ReactionCount]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GroupMessageListResponse(BaseModel):
    """Liste de messages"""
    messages: list[GroupMessageResponse]
    total: int
    page: int
    page_size: int


class MessageReactionCreate(BaseModel):
    """Ajouter une réaction"""
    emoji: str = Field(..., min_length=1, max_length=10)


class MessageReactionResponse(BaseModel):
    """Réponse réaction"""
    id: int
    message_id: int
    user_id: int
    username: str
    emoji: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
