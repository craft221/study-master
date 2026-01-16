"""
Modèle AITask - Gestion des tâches IA en arrière-plan
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, JSON, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class AITaskType(str, enum.Enum):
    """Types de tâches IA"""
    FLASHCARDS_FROM_DOCUMENT = "flashcards_from_document"
    QUIZ_FROM_DOCUMENT = "quiz_from_document"
    FLASHCARDS_FROM_NOTE = "flashcards_from_note"
    QUIZ_FROM_NOTE = "quiz_from_note"
    SUMMARIZE_NOTE = "summarize_note"
    OCR_DOCUMENT = "ocr_document"


class AITaskStatus(str, enum.Enum):
    """Statuts des tâches IA"""
    PENDING = "pending"
    PROCESSING = "processing"
    EXTRACTING_TEXT = "extracting_text"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AITask(Base):
    """
    Modèle pour stocker et suivre les tâches IA en arrière-plan
    """
    __tablename__ = "ai_tasks"

    id = Column(Integer, primary_key=True, index=True)

    # Utilisateur
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Type et statut
    task_type = Column(String(50), nullable=False, index=True)
    status = Column(String(20), default=AITaskStatus.PENDING, nullable=False, index=True)

    # Source (document ou note)
    source_type = Column(String(20), nullable=False)  # "document" ou "note"
    source_id = Column(Integer, nullable=False)
    source_title = Column(String(255), nullable=True)

    # Paramètres de la tâche
    params = Column(JSON, nullable=True)  # count, difficulty, language, etc.

    # Progression
    progress = Column(Integer, default=0)  # 0-100
    progress_message = Column(String(255), nullable=True)

    # Résultat
    result = Column(JSON, nullable=True)  # Flashcards/Quiz générés
    result_count = Column(Integer, nullable=True)  # Nombre d'éléments générés

    # Erreur éventuelle
    error_message = Column(Text, nullable=True)
    error_code = Column(String(50), nullable=True)

    # Statistiques
    text_extracted_length = Column(Integer, nullable=True)  # Longueur du texte extrait
    processing_time_seconds = Column(Integer, nullable=True)  # Temps de traitement

    # Timestamps
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relations
    user = relationship("User")

    def __repr__(self):
        return f"<AITask {self.id}: {self.task_type} - {self.status}>"

    def to_dict(self):
        """Convertir en dictionnaire pour l'API"""
        return {
            "id": self.id,
            "task_type": self.task_type,
            "status": self.status,
            "source_type": self.source_type,
            "source_id": self.source_id,
            "source_title": self.source_title,
            "progress": self.progress,
            "progress_message": self.progress_message,
            "result_count": self.result_count,
            "error_message": self.error_message,
            "error_code": self.error_code,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "processing_time_seconds": self.processing_time_seconds
        }
