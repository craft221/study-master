"""
Module de collaboration - Réexporte depuis study_group pour compatibilité
"""

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
