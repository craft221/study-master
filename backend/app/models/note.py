"""
Modèle Note
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, JSON
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.datetime_utils import utc_now


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)  # Legacy: texte brut/HTML
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("notes.id"), nullable=True)
    tags = Column(JSON, default=list)

    # Nouveau: Contenu structuré en blocs (Notion-like)
    # Format: {"version": 1, "blocks": [{...}, {...}]}
    blocks = Column(JSON, nullable=True, default=None)

    is_favorite = Column(Boolean, default=False)
    is_pinned = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    is_indexed = Column(Boolean, default=False)
    is_public = Column(Boolean, default=False)  # Visible dans la page Explore
    language = Column(String(5), default="fr")  # fr, en, es - pour filtrer dans Explore
    gallery_images = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relations
    user = relationship("User", back_populates="notes")
    subject = relationship("Subject", back_populates="notes")
    study_tasks = relationship("StudyTask", back_populates="note")

    @property
    def uses_blocks(self) -> bool:
        """Vérifie si la note utilise le format blocs"""
        return self.blocks is not None and len(self.blocks) > 0
