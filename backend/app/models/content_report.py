"""
Modèle ContentReport - Signalement de contenu inapproprié
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base
from app.core.datetime_utils import utc_now


class ContentType(enum.Enum):
    """Type de contenu signalé"""
    NOTE = "note"
    FLASHCARD_DECK = "flashcard_deck"
    QUIZ = "quiz"


class ReportReason(enum.Enum):
    """Raison du signalement"""
    INAPPROPRIATE = "inappropriate"  # Contenu inapproprié
    SPAM = "spam"  # Spam / Publicité
    HARASSMENT = "harassment"  # Harcèlement
    COPYRIGHT = "copyright"  # Violation de droits d'auteur
    MISINFORMATION = "misinformation"  # Fausses informations
    OTHER = "other"  # Autre


class ReportStatus(enum.Enum):
    """Statut du signalement"""
    PENDING = "pending"  # En attente de review
    REVIEWED = "reviewed"  # Examiné
    RESOLVED = "resolved"  # Résolu (action prise)
    DISMISSED = "dismissed"  # Rejeté (faux signalement)


class ContentReport(Base):
    """Signalement de contenu public inapproprié"""
    __tablename__ = "content_reports"

    id = Column(Integer, primary_key=True, index=True)

    # Qui signale
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Contenu signalé
    content_type = Column(Enum(ContentType), nullable=False)
    content_id = Column(Integer, nullable=False)  # ID de la note, deck ou quiz
    content_title = Column(String(255), nullable=True)  # Copie du titre pour référence
    content_owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Détails du signalement
    reason = Column(Enum(ReportReason), nullable=False)
    description = Column(Text, nullable=True)  # Description optionnelle

    # Statut et modération
    status = Column(Enum(ReportStatus), default=ReportStatus.PENDING)
    moderator_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    moderator_notes = Column(Text, nullable=True)
    action_taken = Column(String(100), nullable=True)  # ex: "content_hidden", "user_warned"

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=utc_now, server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Relations
    reporter = relationship("User", foreign_keys=[reporter_id], backref="reports_made")
    content_owner = relationship("User", foreign_keys=[content_owner_id])
    moderator = relationship("User", foreign_keys=[moderator_id])
