"""
Modèle pour les messages dans les groupes d'étude
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.core.datetime_utils import utc_now


class GroupMessage(Base):
    """Message dans un groupe d'étude"""
    __tablename__ = "group_messages"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("study_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    is_edited = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)  # Soft delete for WhatsApp-style "message deleted"
    reply_to_message_id = Column(Integer, ForeignKey("group_messages.id", ondelete="SET NULL"), nullable=True, index=True)
    mentions = Column(JSON, nullable=True)  # List of user IDs mentioned in the message
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relations
    group = relationship("StudyGroup", back_populates="messages")
    user = relationship("User")
    reply_to = relationship("GroupMessage", remote_side=[id], foreign_keys=[reply_to_message_id])
    reactions = relationship("MessageReaction", back_populates="message", cascade="all, delete-orphan")


class MessageReaction(Base):
    """Réaction emoji à un message"""
    __tablename__ = "message_reactions"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("group_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    emoji = Column(String(10), nullable=False)  # Emoji unicode character
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relations
    message = relationship("GroupMessage", back_populates="reactions")
    user = relationship("User")
