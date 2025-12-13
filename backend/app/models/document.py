"""
Modèle Document - Gestion des fichiers (PDF, Word, etc.) par matière
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum as PyEnum

from app.core.database import Base


class DocumentType(str, PyEnum):
    """Types de documents supportés"""
    PDF = "pdf"
    WORD = "word"
    EXCEL = "excel"
    POWERPOINT = "powerpoint"
    IMAGE = "image"
    OTHER = "other"


class Document(Base):
    """
    Modèle pour stocker les documents uploadés par matière.
    Les fichiers sont stockés localement dans /uploads/documents/
    """
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)

    # Informations du fichier
    original_filename = Column(String(255), nullable=False)  # Nom original du fichier
    stored_filename = Column(String(255), nullable=False, unique=True)  # Nom stocké (UUID)
    file_type = Column(String(50), nullable=False)  # Type de document (pdf, word, etc.)
    mime_type = Column(String(100), nullable=False)  # Type MIME complet
    file_size = Column(BigInteger, nullable=False)  # Taille en bytes
    file_extension = Column(String(20), nullable=False)  # Extension (.pdf, .docx, etc.)

    # Stockage
    storage_path = Column(String(500), nullable=False)  # Chemin relatif du fichier

    # Métadonnées
    title = Column(String(255), nullable=True)  # Titre personnalisé (optionnel)
    description = Column(Text, nullable=True)  # Description du document

    # Relations
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Flags
    is_favorite = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)

    # Extraction de texte (optionnel, pour recherche)
    extracted_text = Column(Text, nullable=True)  # Texte extrait par OCR si applicable
    is_text_extracted = Column(Boolean, default=False)

    # Statistiques
    download_count = Column(Integer, default=0)
    view_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relations ORM
    user = relationship("User", back_populates="documents")
    subject = relationship("Subject", back_populates="documents")

    def __repr__(self):
        return f"<Document {self.id}: {self.original_filename}>"

    @property
    def file_size_formatted(self) -> str:
        """Retourne la taille du fichier formatée"""
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"

    @property
    def file_type_icon(self) -> str:
        """Retourne une icône emoji selon le type de fichier"""
        icons = {
            "pdf": "📄",
            "word": "📝",
            "excel": "📊",
            "powerpoint": "📽️",
            "image": "🖼️",
            "other": "📁"
        }
        return icons.get(self.file_type, "📁")
