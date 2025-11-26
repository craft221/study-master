"""
Modèle StudyGroup (Groupe d'étude)
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class MembershipRole(enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class StudyGroup(Base):
    __tablename__ = "study_groups"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    university = Column(String, nullable=True)
    promotion = Column(String, nullable=True)
    max_members = Column(Integer, default=20)
    is_private = Column(Boolean, default=False)
    cover_image_url = Column(String, nullable=True)
    status = Column(String, default="active")
    current_members = Column(Integer, default=1)
    total_study_hours = Column(Integer, default=0)
    total_shared_notes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    creator = relationship("User", foreign_keys=[creator_id])
    subject = relationship("Subject", foreign_keys=[subject_id])
    memberships = relationship("StudyGroupMembership", back_populates="group", cascade="all, delete-orphan")
    messages = relationship("GroupMessage", back_populates="group", cascade="all, delete-orphan")


class StudyGroupMembership(Base):
    __tablename__ = "study_group_memberships"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("study_groups.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(Enum(MembershipRole), default=MembershipRole.MEMBER)
    contribution_score = Column(Integer, default=0)
    joined_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    group = relationship("StudyGroup", back_populates="memberships")
    user = relationship("User")
