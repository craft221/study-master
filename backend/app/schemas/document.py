"""
Schémas Pydantic pour les Documents
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class DocumentType(str, Enum):
    """Types de documents supportés"""
    PDF = "pdf"
    WORD = "word"
    EXCEL = "excel"
    POWERPOINT = "powerpoint"
    IMAGE = "image"
    OTHER = "other"


# ==================== Schemas de base ====================

class DocumentBase(BaseModel):
    """Schéma de base pour les documents"""
    title: Optional[str] = Field(None, max_length=255, description="Titre personnalisé du document")
    description: Optional[str] = Field(None, description="Description du document")


class DocumentCreate(DocumentBase):
    """Schéma pour la création d'un document (métadonnées seulement, fichier uploadé séparément)"""
    subject_id: int = Field(..., description="ID de la matière associée")


class DocumentUpdate(BaseModel):
    """Schéma pour la mise à jour d'un document"""
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None


# ==================== Schemas de réponse ====================

class DocumentResponse(BaseModel):
    """Schéma de réponse pour un document"""
    id: int
    original_filename: str
    stored_filename: str
    file_type: str
    mime_type: str
    file_size: int
    file_extension: str
    title: Optional[str] = None
    description: Optional[str] = None
    subject_id: int
    user_id: int
    is_favorite: bool = False
    is_archived: bool = False
    is_text_extracted: bool = False
    download_count: int = 0
    view_count: int = 0
    created_at: datetime
    updated_at: datetime

    # Propriétés calculées
    file_size_formatted: Optional[str] = None
    file_type_icon: Optional[str] = None
    download_url: Optional[str] = None

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    """Schéma de réponse pour une liste de documents"""
    documents: List[DocumentResponse]
    total: int
    page: int
    page_size: int


class DocumentUploadResponse(BaseModel):
    """Schéma de réponse après upload d'un document"""
    document: DocumentResponse
    message: str = "Document uploadé avec succès"
    xp_earned: int = 5


class DocumentStatsResponse(BaseModel):
    """Statistiques des documents d'un utilisateur"""
    total_documents: int
    total_size_bytes: int
    total_size_formatted: str
    documents_by_type: dict
    documents_by_subject: dict


# ==================== Schemas pour filtres ====================

class DocumentFilter(BaseModel):
    """Filtres pour la recherche de documents"""
    subject_id: Optional[int] = None
    file_type: Optional[DocumentType] = None
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None
    search: Optional[str] = None


# ==================== Types de fichiers supportés ====================

ALLOWED_EXTENSIONS = {
    # PDF
    '.pdf': ('application/pdf', 'pdf'),
    # Word
    '.doc': ('application/msword', 'word'),
    '.docx': ('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'word'),
    # Excel
    '.xls': ('application/vnd.ms-excel', 'excel'),
    '.xlsx': ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'excel'),
    # PowerPoint
    '.ppt': ('application/vnd.ms-powerpoint', 'powerpoint'),
    '.pptx': ('application/vnd.openxmlformats-officedocument.presentationml.presentation', 'powerpoint'),
    # Images
    '.jpg': ('image/jpeg', 'image'),
    '.jpeg': ('image/jpeg', 'image'),
    '.png': ('image/png', 'image'),
    '.gif': ('image/gif', 'image'),
    '.bmp': ('image/bmp', 'image'),
    '.webp': ('image/webp', 'image'),
    # Texte
    '.txt': ('text/plain', 'other'),
    '.csv': ('text/csv', 'other'),
    '.md': ('text/markdown', 'other'),
}

# Taille maximale des fichiers (50 MB)
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB en bytes


def get_file_type_info(extension: str) -> tuple:
    """
    Retourne (mime_type, file_type) pour une extension donnée.
    Retourne des valeurs par défaut si l'extension n'est pas reconnue.
    """
    extension = extension.lower()
    if extension in ALLOWED_EXTENSIONS:
        return ALLOWED_EXTENSIONS[extension]
    return ('application/octet-stream', 'other')


def is_allowed_file(filename: str) -> bool:
    """Vérifie si le fichier a une extension autorisée"""
    if '.' not in filename:
        return False
    extension = '.' + filename.rsplit('.', 1)[1].lower()
    return extension in ALLOWED_EXTENSIONS


def format_file_size(size_bytes: int) -> str:
    """Formate la taille du fichier en unité lisible"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"
