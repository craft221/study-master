"""
Modèle StudyGroup (Groupe d'étude)
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base
from app.core.datetime_utils import utc_now


class MembershipRole(enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class InvitationStatus(enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"


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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

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
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relations
    group = relationship("StudyGroup", back_populates="memberships")
    user = relationship("User")


class StudyGroupInvitation(Base):
    """Model for study group invitations"""
    __tablename__ = "study_group_invitations"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("study_groups.id"), nullable=False)
    inviter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    invitee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="pending")  # VARCHAR compatible with migration
    message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    responded_at = Column(DateTime(timezone=True), nullable=True)

    # Relations
    group = relationship("StudyGroup")
    inviter = relationship("User", foreign_keys=[inviter_id])
    invitee = relationship("User", foreign_keys=[invitee_id])
