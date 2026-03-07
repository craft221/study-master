"""
Modèle EmailEvent - Logging et tracking des emails envoyés
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class EmailEvent(Base):
    """Log de tous les emails envoyés + événements de tracking"""
    __tablename__ = "email_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # Identifiant externe (Resend message ID)
    provider_id = Column(String(255), nullable=True, index=True)

    # Destinataire et contenu
    to_email = Column(String(255), nullable=False, index=True)
    subject = Column(String(500), nullable=False)
    email_type = Column(String(100), nullable=False, index=True)  # verification, welcome, streak_reminder, etc.

    # Statut
    status = Column(String(50), default="sent", index=True)  # sent, delivered, opened, clicked, bounced, complained

    # Tracking
    opened_at = Column(DateTime(timezone=True), nullable=True)
    clicked_at = Column(DateTime(timezone=True), nullable=True)
    bounced_at = Column(DateTime(timezone=True), nullable=True)
    complained_at = Column(DateTime(timezone=True), nullable=True)

    # Bounce/complaint details
    bounce_type = Column(String(50), nullable=True)  # hard, soft
    bounce_reason = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relations
    user = relationship("User", backref="email_events")

    # Index composites pour les requêtes admin
    __table_args__ = (
        Index("ix_email_events_type_status", "email_type", "status"),
        Index("ix_email_events_created_status", "created_at", "status"),
    )
