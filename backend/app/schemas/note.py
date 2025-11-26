from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


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


class NoteResponse(NoteBase):
    id: int
    author_id: int
    order: int
    
    content_html: Optional[str] = None
    summary: Optional[str] = None
    keywords: Optional[List[str]] = []
    
    attachments: Optional[List[dict]] = []
    
    is_collaborative: bool
    collaborators: Optional[List[int]] = []
    
    is_for_sale: bool
    price: Optional[float] = None
    sales_count: int
    
    quality_score: float
    rating_average: float
    rating_count: int
    views_count: int
    
    word_count: int
    read_time_minutes: int
    
    version: int
    is_latest_version: bool
    
    is_ai_generated: bool
    
    is_pinned: bool
    is_favorite: bool
    is_archived: bool
    is_published: bool
    
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class NoteListResponse(BaseModel):
    notes: List[NoteResponse]
    total: int
    page: int
    page_size: int


class NoteWithChildren(NoteResponse):
    """Note avec ses enfants (hiérarchie)"""
    children: List['NoteWithChildren'] = []


NoteWithChildren.model_rebuild()