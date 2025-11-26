from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from app.core.database import Base


class UserRole(str, enum.Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class SubscriptionType(str, enum.Enum):
    FREE = "free"
    PREMIUM = "premium"
    PREMIUM_PLUS = "premium_plus"
    INSTITUTIONAL = "institutional"


class User(Base):
    __tablename__ = "users"
    
    # Primary Info
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    
    # Role & Subscription
    role = Column(Enum(UserRole), default=UserRole.STUDENT, nullable=False)
    subscription_type = Column(Enum(SubscriptionType), default=SubscriptionType.FREE, nullable=False)
    subscription_ends_at = Column(DateTime(timezone=True), nullable=True)
    
    # Profile
    avatar_url = Column(String(500))
    bio = Column(Text)
    university = Column(String(200))
    major = Column(String(100))  # Spécialité
    promotion = Column(String(50))  # Année/Promotion
    student_id = Column(String(50))  # Numéro étudiant
    
    # Contact
    phone = Column(String(20))
    country = Column(String(100))
    city = Column(String(100))
    timezone = Column(String(50), default="UTC")
    
    # Preferences
    language = Column(String(10), default="fr")
    theme = Column(String(20), default="light")  # light, dark, auto
    notifications_enabled = Column(Boolean, default=True)
    email_notifications = Column(Boolean, default=True)
    
    # Gamification
    total_xp = Column(Integer, default=0)
    level = Column(Integer, default=1)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_activity_date = Column(DateTime(timezone=True))
    
    # Statistics
    total_study_time_minutes = Column(Integer, default=0)
    total_notes_created = Column(Integer, default=0)
    total_flashcards_created = Column(Integer, default=0)
    total_flashcards_reviewed = Column(Integer, default=0)
    total_quizzes_created = Column(Integer, default=0)
    total_quizzes_taken = Column(Integer, default=0)
    total_quizzes_completed = Column(Integer, default=0)
    
    # AI Usage (pour limites)
    ai_requests_today = Column(Integer, default=0)
    ai_requests_reset_date = Column(DateTime(timezone=True))
    total_ai_requests = Column(Integer, default=0)
    
    # Account Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    is_online = Column(Boolean, default=False)
    last_login_at = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    subjects = relationship("Subject", back_populates="user", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="user", cascade="all, delete-orphan")
    flashcards = relationship("Flashcard", back_populates="user", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User {self.username} ({self.email})>"
    
    def calculate_level(self) -> int:
        """Calcule le niveau basé sur l'XP"""
        # Formule: niveau = floor(sqrt(xp / 100))
        import math
        return max(1, math.floor(math.sqrt(self.total_xp / 100)))
    
    def xp_for_next_level(self) -> int:
        """Calcule l'XP nécessaire pour le prochain niveau"""
        next_level = self.level + 1
        return (next_level ** 2) * 100
    
    def xp_progress_percentage(self) -> float:
        """Pourcentage de progression vers le prochain niveau"""
        current_level_xp = (self.level ** 2) * 100
        next_level_xp = self.xp_for_next_level()
        xp_in_current_level = self.total_xp - current_level_xp
        xp_needed_for_level = next_level_xp - current_level_xp
        return (xp_in_current_level / xp_needed_for_level) * 100 if xp_needed_for_level > 0 else 0
