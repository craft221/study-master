from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Any, Dict
from datetime import datetime
from enum import Enum

from app.schemas.blocks import BlockContent, Block, BlockType


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
    content: str = Field(default="", description="Contenu texte (legacy) - utilisé si blocks est vide")
    subject_id: int
    parent_id: Optional[int] = None
    note_type: Optional[NoteTypeEnum] = NoteTypeEnum.REGULAR
    tags: Optional[List[str]] = []
    visibility: Optional[NoteVisibilityEnum] = NoteVisibilityEnum.PRIVATE
    language: Optional[str] = Field("fr", max_length=5, description="Langue du contenu (fr, en, es)")
    # Nouveau: Contenu en blocs (Notion-like)
    blocks: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Contenu structuré en blocs (format Notion-like). Si présent, prend précédence sur 'content'"
    )


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    content: Optional[str] = Field(None)
    subject_id: Optional[int] = None
    parent_id: Optional[int] = None
    note_type: Optional[NoteTypeEnum] = None
    tags: Optional[List[str]] = None
    visibility: Optional[NoteVisibilityEnum] = None
    is_pinned: Optional[bool] = None
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None
    language: Optional[str] = Field(None, max_length=5)
    # Nouveau: Mise à jour des blocs
    blocks: Optional[List[Dict[str, Any]]] = None


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

    # Nouveau: Contenu en blocs
    blocks: Optional[List[Dict[str, Any]]] = None
    # Indique si la note utilise le format blocs
    uses_blocks: Optional[bool] = False

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
    language: Optional[str] = "fr"

    is_pinned: Optional[bool] = False
    is_favorite: Optional[bool] = False
    is_archived: Optional[bool] = False
    is_published: Optional[bool] = False

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @model_validator(mode='before')
    @classmethod
    def convert_is_public_to_visibility(cls, data: Any) -> Any:
        """Convert is_public boolean from ORM model to visibility enum"""
        if hasattr(data, '__dict__'):  # ORM model
            if hasattr(data, 'is_public') and data.is_public:
                # Create a dict from ORM and set visibility
                return {
                    **{k: getattr(data, k, None) for k in [
                        'id', 'title', 'content', 'subject_id', 'user_id', 'parent_id',
                        'note_type', 'tags', 'content_html', 'summary', 'keywords',
                        'attachments', 'gallery_images', 'is_collaborative', 'collaborators',
                        'is_for_sale', 'price', 'sales_count', 'quality_score', 'rating_average',
                        'rating_count', 'views_count', 'word_count', 'read_time_minutes',
                        'version', 'is_latest_version', 'is_ai_generated', 'is_indexed',
                        'is_pinned', 'is_favorite', 'is_archived', 'is_published',
                        'created_at', 'updated_at', 'published_at'
                    ]},
                    'subject': data.subject if hasattr(data, 'subject') else None,
                    'author_id': data.user_id if hasattr(data, 'user_id') else None,
                    'visibility': 'public' if data.is_public else 'private'
                }
        elif isinstance(data, dict):
            if data.get('is_public'):
                data['visibility'] = 'public'
        return data

    @classmethod
    def from_orm_model(cls, note) -> "NoteResponse":
        """Create NoteResponse from ORM model with proper field mapping"""
        # Convert is_public boolean to visibility enum
        visibility = NoteVisibilityEnum.PUBLIC if getattr(note, 'is_public', False) else NoteVisibilityEnum.PRIVATE

        return cls(
            id=note.id,
            title=note.title,
            content=note.content,
            subject_id=note.subject_id,
            user_id=note.user_id,
            author_id=note.user_id,  # Map user_id to author_id
            parent_id=note.parent_id,
            tags=note.tags or [],
            visibility=visibility,
            gallery_images=note.gallery_images or [],
            is_pinned=note.is_pinned or False,
            is_favorite=note.is_favorite or False,
            is_archived=note.is_archived or False,
            is_indexed=note.is_indexed or False,
            created_at=note.created_at,
            updated_at=note.updated_at,
        )

    @property
    def is_public(self) -> bool:
        """Helper to check if note is public"""
        return self.visibility == NoteVisibilityEnum.PUBLIC


class NoteListResponse(BaseModel):
    notes: List[NoteResponse]
    total: int
    page: int
    page_size: int


class NoteWithChildren(NoteResponse):
    """Note avec ses enfants (hiérarchie)"""
    children: List['NoteWithChildren'] = []


NoteWithChildren.model_rebuild()