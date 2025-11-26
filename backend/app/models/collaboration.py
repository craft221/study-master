"""
Module de collaboration - Réexporte depuis study_group pour compatibilité + nouvelles tables
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.models.study_group import (
    StudyGroup,
    StudyGroupMembership as StudyGroupMember,
    MembershipRole as MemberRole,
)
import enum


class StudyGroupStatus(enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"


class SharedGroupContent(Base):
    """Contenu partagé dans un groupe (notes, flashcards, quiz)"""
    __tablename__ = "shared_group_content"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("study_groups.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content_type = Column(String(50), nullable=False)  # note, flashcard_deck, quiz
    content_id = Column(Integer, nullable=False)  # ID de la note/deck/quiz
    content_data = Column(JSON, nullable=True)  # Métadonnées (titre, description, etc.)
    shared_at = Column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    group = relationship("StudyGroup", backref="shared_contents")
    user = relationship("User", backref="shared_group_contents")


class GroupStudySession(Base):
    """Session d'étude collaborative dans un groupe"""
    __tablename__ = "group_study_sessions"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("study_groups.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    session_type = Column(String(50), nullable=False)  # pomodoro, study, revision, exam_prep
    start_time = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), nullable=False, default="scheduled")  # scheduled, active, completed, cancelled
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    group = relationship("StudyGroup", backref="study_sessions")
    creator = relationship("User", backref="created_sessions")
    participants = relationship("GroupSessionParticipant", back_populates="session", cascade="all, delete-orphan")


class GroupSessionParticipant(Base):
    """Participant à une session de groupe"""
    __tablename__ = "group_session_participants"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("group_study_sessions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    session = relationship("GroupStudySession", back_populates="participants")
    user = relationship("User", backref="session_participations")


class GroupActivity(Base):
    """Activités dans un groupe (fil d'actualité)"""
    __tablename__ = "group_activities"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("study_groups.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    activity_type = Column(String(50), nullable=False)  # note_shared, flashcard_shared, session_created, quiz_shared, member_joined
    description = Column(Text, nullable=False)
    activity_metadata = Column(JSON, nullable=True)  # Données supplémentaires
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    group = relationship("StudyGroup", backref="activities")
    user = relationship("User", backref="group_activities")
