from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class SubjectBasic(BaseModel):
    """Schéma basique pour subject inclus dans les notes"""
    id: int
    name: str
    color: str

    class Config:
        from_attributes = True


class NoteTypeEnum(str, Enum):
    REGULAR = "regular"
    LECTURE = "lecture"
    CHAPTER = "chapter"
    SUMMARY = "summary"
    EXAM_PREP = "exam_prep"


class NoteVisibilityEnum(str, Enum):
    PRIVATE = "private"
    SHARED = "shared"
    PUBLIC = "public"
    MARKETPLACE = "marketplace"


class NoteBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1)
    subject_id: int
    parent_id: Optional[int] = None
    note_type: Optional[NoteTypeEnum] = NoteTypeEnum.REGULAR
    tags: Optional[List[str]] = []
    visibility: Optional[NoteVisibilityEnum] = NoteVisibilityEnum.PRIVATE


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    content: Optional[str] = Field(None, min_length=1)
    subject_id: Optional[int] = None
    parent_id: Optional[int] = None
    note_type: Optional[NoteTypeEnum] = None
    tags: Optional[List[str]] = None
    visibility: Optional[NoteVisibilityEnum] = None
    is_pinned: Optional[bool] = None
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None


class NoteResponse(BaseModel):
    id: int
    title: str
    content: str
    subject_id: int
    subject: Optional[SubjectBasic] = None
    user_id: Optional[int] = None  # For compatibility - maps to author_id
    author_id: Optional[int] = None
    parent_id: Optional[int] = None
    note_type: Optional[NoteTypeEnum] = NoteTypeEnum.REGULAR
    tags: Optional[List[str]] = []
    visibility: Optional[NoteVisibilityEnum] = NoteVisibilityEnum.PRIVATE
    order: Optional[int] = 0

    content_html: Optional[str] = None
    summary: Optional[str] = None
    keywords: Optional[List[str]] = []

    attachments: Optional[List[dict]] = []
    gallery_images: Optional[List[str]] = []

    is_collaborative: Optional[bool] = False
    collaborators: Optional[List[int]] = []

    is_for_sale: Optional[bool] = False
    price: Optional[float] = None
    sales_count: Optional[int] = 0

    quality_score: Optional[float] = 0.0
    rating_average: Optional[float] = 0.0
    rating_count: Optional[int] = 0
    views_count: Optional[int] = 0

    word_count: Optional[int] = 0
    read_time_minutes: Optional[int] = 0

    version: Optional[int] = 1
    is_latest_version: Optional[bool] = True

    is_ai_generated: Optional[bool] = False
    is_indexed: Optional[bool] = False

    is_pinned: Optional[bool] = False
    is_favorite: Optional[bool] = False
    is_archived: Optional[bool] = False
    is_published: Optional[bool] = False

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_model(cls, note) -> "NoteResponse":
        """Create NoteResponse from ORM model with proper field mapping"""
        return cls(
            id=note.id,
            title=note.title,
            content=note.content,
            subject_id=note.subject_id,
            user_id=note.user_id,
            author_id=note.user_id,  # Map user_id to author_id
            parent_id=note.parent_id,
            tags=note.tags or [],
            gallery_images=note.gallery_images or [],
            is_pinned=note.is_pinned or False,
            is_favorite=note.is_favorite or False,
            is_archived=note.is_archived or False,
            is_indexed=note.is_indexed or False,
            created_at=note.created_at,
            updated_at=note.updated_at,
        )


class NoteListResponse(BaseModel):
    notes: List[NoteResponse]
    total: int
    page: int
    page_size: int


class NoteWithChildren(NoteResponse):
    """Note avec ses enfants (hiérarchie)"""
    children: List['NoteWithChildren'] = []


NoteWithChildren.model_rebuild()