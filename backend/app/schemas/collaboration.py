from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.models.study_group import MembershipRole, InvitationStatus


# ========== STUDY GROUP SCHEMAS ==========

class StudyGroupBase(BaseModel):
    """Schéma de base pour StudyGroup"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    subject_id: Optional[int] = None
    university: Optional[str] = None
    promotion: Optional[str] = None
    max_members: int = Field(default=20, ge=2, le=100)
    is_private: bool = False
    cover_image_url: Optional[str] = None


class StudyGroupCreate(StudyGroupBase):
    """Créer un groupe d'étude"""
    pass


class StudyGroupUpdate(BaseModel):
    """Mettre à jour un groupe"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    subject_id: Optional[int] = None
    max_members: Optional[int] = Field(None, ge=2, le=100)
    is_private: Optional[bool] = None
    cover_image_url: Optional[str] = None
    status: Optional[str] = None


class StudyGroupMemberResponse(BaseModel):
    """Membre d'un groupe"""
    id: int
    user_id: int
    username: str
    avatar_url: Optional[str]
    role: MembershipRole
    joined_at: Optional[datetime] = None  # Peut être None pour les anciennes entrées
    contribution_score: int

    model_config = ConfigDict(from_attributes=True)


class StudyGroupMembershipResponse(BaseModel):
    """Réponse pour un membership de groupe"""
    id: int
    user_id: int
    username: str
    avatar_url: Optional[str]
    role: MembershipRole
    joined_at: Optional[datetime] = None  # Peut être None pour les anciennes entrées
    contribution_score: int

    model_config = ConfigDict(from_attributes=True)


class StudyGroupResponse(StudyGroupBase):
    """Réponse groupe d'étude"""
    id: int
    creator_id: int
    status: str
    current_members: int
    total_study_hours: int
    total_shared_notes: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StudyGroupDetailResponse(StudyGroupResponse):
    """Groupe avec détails complets"""
    members: List[StudyGroupMemberResponse]


class StudyGroupListResponse(BaseModel):
    """Liste de groupes"""
    groups: List[StudyGroupResponse]
    total: int
    page: int
    page_size: int


# ========== STUDY GROUP INVITATION SCHEMAS ==========

class StudyGroupInvitationCreate(BaseModel):
    """Créer une invitation"""
    invitee_id: int
    message: Optional[str] = Field(None, max_length=500)


class StudyGroupInvitationResponse(BaseModel):
    """Réponse invitation"""
    id: int
    group_id: int
    group_name: str
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

    model_config = ConfigDict(from_attributes=True)


# ========== NOTE SHARING SCHEMAS ==========

class NoteCommentCreate(BaseModel):
    """Créer un commentaire"""
    note_id: int
    content: str = Field(..., min_length=1, max_length=2000)
    parent_comment_id: Optional[int] = None


class NoteCommentResponse(BaseModel):
    """Commentaire sur une note"""
    id: int
    note_id: int
    user_id: int
    username: str
    avatar_url: Optional[str]
    content: str
    parent_comment_id: Optional[int]
    likes_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NoteReviewCreate(BaseModel):
    """Créer une review"""
    note_id: int
    rating: int = Field(..., ge=1, le=5)
    review_text: Optional[str] = None


class NoteReviewResponse(BaseModel):
    """Review d'une note"""
    id: int
    note_id: int
    reviewer_id: int
    reviewer_name: str
    rating: int
    review_text: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
