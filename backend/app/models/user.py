"""
Modèle User refactoré - Séparé en sous-modèles pour une meilleure organisation
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Enum, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timezone
import enum
import math

from app.core.database import Base
from app.core.datetime_utils import utc_now


class UserRole(str, enum.Enum):
    """Rôles utilisateur"""
    STUDENT = "student"
    TEACHER = "teacher"
    MODERATOR = "moderator"
    ADMIN = "admin"


class SubscriptionType(str, enum.Enum):
    """Types d'abonnement"""
    FREE = "FREE"
    PREMIUM = "PREMIUM"
    PREMIUM_PLUS = "PREMIUM_PLUS"
    INSTITUTIONAL = "INSTITUTIONAL"


class User(Base):
    """
    Modèle principal User - Contient uniquement les informations d'authentification
    et les relations vers les sous-modèles
    """
    __tablename__ = "users"

    # ==================== IDENTIFICATION ====================
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))

    # ==================== RÔLE ====================
    role = Column(Enum(UserRole), default=UserRole.STUDENT, nullable=False)

    # ==================== STATUT DU COMPTE ====================
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    is_online = Column(Boolean, default=False)
    last_login_at = Column(DateTime(timezone=True))

    # ==================== MFA / 2FA ====================
    mfa_enabled = Column(Boolean, default=False)
    mfa_secret = Column(String(32), nullable=True)  # TOTP secret key (encrypted)
    mfa_backup_codes = Column(JSON, default=list)  # Backup codes (hashed)
    mfa_verified_at = Column(DateTime(timezone=True), nullable=True)  # When MFA was first set up

    # ==================== TIMESTAMPS ====================
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # ==================== RELATIONS VERS SOUS-MODÈLES ====================
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan", lazy="joined")
    preferences = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan", lazy="joined")
    subscription = relationship("UserSubscription", back_populates="user", uselist=False, cascade="all, delete-orphan", lazy="joined")
    gamification = relationship("UserGamification", back_populates="user", uselist=False, cascade="all, delete-orphan", lazy="joined")
    stats = relationship("UserStats", back_populates="user", uselist=False, cascade="all, delete-orphan", lazy="joined")
    mascot = relationship("UserMascot", back_populates="user", uselist=False, cascade="all, delete-orphan", lazy="joined")
    ai_usage = relationship("UserAIUsage", back_populates="user", uselist=False, cascade="all, delete-orphan", lazy="joined")

    # ==================== RELATIONS VERS AUTRES MODÈLES ====================
    subjects = relationship("Subject", back_populates="user", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="user", cascade="all, delete-orphan")
    flashcards = relationship("Flashcard", back_populates="user", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    notification_preferences = relationship("NotificationPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")

    # ==================== RELATIONS FOCUS ROOMS ====================
    created_focus_rooms = relationship("FocusRoom", back_populates="creator", cascade="all, delete-orphan")
    focus_room_participation = relationship("FocusRoomParticipant", back_populates="user", uselist=False, cascade="all, delete-orphan")
    focus_room_stats = relationship("UserFocusRoomStats", back_populates="user", uselist=False, cascade="all, delete-orphan")

    # ==================== RELATIONS DAILY QUESTS ====================
    daily_quests = relationship("DailyQuest", back_populates="user", cascade="all, delete-orphan")
    quest_streak = relationship("DailyQuestStreak", back_populates="user", uselist=False, cascade="all, delete-orphan")
    mystery_chests = relationship("MysteryChest", back_populates="user", cascade="all, delete-orphan")

    # ==================== RELATIONS LIGUES ET PARTAGE SOCIAL ====================
    league = relationship("UserLeague", back_populates="user", uselist=False, cascade="all, delete-orphan")
    social_shares = relationship("SocialShare", back_populates="user", cascade="all, delete-orphan")
    share_stats = relationship("ShareStats", back_populates="user", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.username} ({self.email})>"

    # ==================== PROPRIÉTÉS POUR RÉTROCOMPATIBILITÉ ====================
    @property
    def total_xp(self) -> int:
        """Accès rapide à l'XP total"""
        return self.gamification.total_xp if self.gamification else 0

    @property
    def level(self) -> int:
        """Calcul dynamique du niveau basé sur l'XP (formule style Duolingo)"""
        from app.services.xp_service import calculate_level
        if not self.gamification:
            return 1
        xp = self.gamification.total_xp or 0
        return calculate_level(xp)

    @property
    def current_streak(self) -> int:
        """Accès rapide au streak actuel"""
        return self.gamification.current_streak if self.gamification else 0

    @property
    def subscription_type(self) -> SubscriptionType:
        """Accès rapide au type d'abonnement"""
        return self.subscription.subscription_type if self.subscription else SubscriptionType.FREE

    @property
    def avatar_url(self) -> str:
        """Accès rapide à l'avatar"""
        return self.profile.avatar_url if self.profile else None

    @property
    def language(self) -> str:
        """Accès rapide à la langue"""
        return self.preferences.language if self.preferences else "fr"

    @property
    def theme(self) -> str:
        """Accès rapide au thème"""
        return self.preferences.theme if self.preferences else "light"

    @property
    def longest_streak(self) -> int:
        """Accès rapide au longest streak"""
        return self.gamification.longest_streak if self.gamification else 0

    @property
    def total_study_time_minutes(self) -> int:
        """Accès rapide au temps d'étude total"""
        return self.stats.total_study_time_minutes if self.stats else 0

    @property
    def total_notes_created(self) -> int:
        """Accès rapide au nombre de notes créées"""
        return self.stats.total_notes_created if self.stats else 0

    @total_notes_created.setter
    def total_notes_created(self, value: int):
        """Setter pour le nombre de notes créées"""
        if self.stats:
            self.stats.total_notes_created = value

    @property
    def total_flashcards_created(self) -> int:
        """Accès rapide au nombre de flashcards créées"""
        return self.stats.total_flashcards_created if self.stats else 0

    @total_flashcards_created.setter
    def total_flashcards_created(self, value: int):
        """Setter pour le nombre de flashcards créées"""
        if self.stats:
            self.stats.total_flashcards_created = value

    @property
    def total_quizzes_completed(self) -> int:
        """Accès rapide au nombre de quiz complétés"""
        return self.stats.total_quizzes_completed if self.stats else 0

    @total_quizzes_completed.setter
    def total_quizzes_completed(self, value: int):
        """Setter pour le nombre de quiz complétés"""
        if self.stats:
            self.stats.total_quizzes_completed = value

    @property
    def total_quizzes_created(self) -> int:
        """Accès rapide au nombre de quiz créés"""
        return self.stats.total_quizzes_created if self.stats else 0

    @total_quizzes_created.setter
    def total_quizzes_created(self, value: int):
        """Setter pour le nombre de quiz créés"""
        if self.stats:
            self.stats.total_quizzes_created = value

    @property
    def total_flashcards_reviewed(self) -> int:
        """Accès rapide au nombre de flashcards révisées"""
        return self.stats.total_flashcards_reviewed if self.stats else 0

    @total_flashcards_reviewed.setter
    def total_flashcards_reviewed(self, value: int):
        """Setter pour le nombre de flashcards révisées"""
        if self.stats:
            self.stats.total_flashcards_reviewed = value

    @property
    def total_quizzes_taken(self) -> int:
        """Accès rapide au nombre de quizzes effectués"""
        return self.stats.total_quizzes_taken if self.stats else 0

    @total_quizzes_taken.setter
    def total_quizzes_taken(self, value: int):
        """Setter pour le nombre de quizzes effectués"""
        if self.stats:
            self.stats.total_quizzes_taken = value

    @property
    def bio(self) -> str:
        """Accès rapide à la bio"""
        return self.profile.bio if self.profile else None

    @property
    def student_id(self) -> str:
        """Accès rapide au numéro étudiant"""
        return self.profile.student_id if self.profile else None

    @property
    def phone(self) -> str:
        """Accès rapide au téléphone"""
        return self.profile.phone if self.profile else None

    @property
    def country(self) -> str:
        """Accès rapide au pays"""
        return self.profile.country if self.profile else None

    @property
    def city(self) -> str:
        """Accès rapide à la ville"""
        return self.profile.city if self.profile else None

    @property
    def timezone(self) -> str:
        """Accès rapide au fuseau horaire"""
        return self.profile.timezone if self.profile else "UTC"

    @property
    def notifications_enabled(self) -> bool:
        """Accès rapide aux notifications"""
        return self.preferences.notifications_enabled if self.preferences else True

    @property
    def email_notifications(self) -> bool:
        """Accès rapide aux notifications email"""
        return self.preferences.email_notifications if self.preferences else True

    @property
    def last_activity_date(self) -> datetime:
        """Accès rapide à la dernière activité"""
        return self.gamification.last_activity_date if self.gamification else None

    @property
    def subscription_ends_at(self) -> datetime:
        """Accès rapide à la fin d'abonnement"""
        return self.subscription.subscription_ends_at if self.subscription else None

    @property
    def ai_requests_today(self) -> int:
        """Accès rapide aux requêtes IA du jour"""
        return self.ai_usage.requests_today if self.ai_usage else 0

    @property
    def ai_requests_reset_date(self):
        """Accès rapide à la date de reset des requêtes IA"""
        return self.ai_usage.requests_reset_date if self.ai_usage else None

    @property
    def total_ai_requests(self) -> int:
        """Accès rapide au total des requêtes IA"""
        return self.ai_usage.total_requests if self.ai_usage else 0

    @property
    def mascot_level(self) -> int:
        """Accès rapide au niveau de la mascotte"""
        return self.mascot.level if self.mascot else 1

    @mascot_level.setter
    def mascot_level(self, value: int):
        """Setter pour le niveau de la mascotte"""
        if self.mascot:
            self.mascot.level = value

    @property
    def mascot_name(self) -> str:
        """Accès rapide au nom de la mascotte"""
        return self.mascot.name if self.mascot else "Spark"

    @property
    def mascot_unlocked_accessories(self) -> list:
        """Accès rapide aux accessoires débloqués"""
        return self.mascot.unlocked_accessories if self.mascot else []

    @property
    def mascot_current_accessory(self) -> str:
        """Accès rapide à l'accessoire équipé"""
        return self.mascot.current_accessory if self.mascot else None

    @property
    def mascot_last_interaction_date(self):
        """Accès rapide à la dernière interaction"""
        return self.mascot.last_interaction_date if self.mascot else None

    @mascot_last_interaction_date.setter
    def mascot_last_interaction_date(self, value):
        """Setter pour la date de dernière interaction"""
        if self.mascot:
            self.mascot.last_interaction_date = value

    def calculate_mascot_level(self) -> int:
        """
        Calcule le niveau de Spark basé sur le niveau utilisateur.
        Spark évolue aux niveaux 5, 10, 15 et 20.
        """
        user_level = self.level
        if user_level < 5:
            return 1  # Spark bébé (niveaux 1-4)
        elif user_level < 10:
            return 2  # Spark junior (niveaux 5-9)
        elif user_level < 15:
            return 3  # Spark expert (niveaux 10-14)
        elif user_level < 20:
            return 4  # Spark sage (niveaux 15-19)
        else:
            return 5  # Spark légendaire (niveau 20+)


class UserProfile(Base):
    """Informations de profil utilisateur"""
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # Profil public
    avatar_url = Column(String(500))
    bio = Column(Text)

    # Informations académiques
    university = Column(String(200))
    major = Column(String(100))  # Spécialité
    promotion = Column(String(50))  # Année/Promotion
    student_id = Column(String(50))  # Numéro étudiant

    # Contact
    phone = Column(String(20))
    country = Column(String(100))
    city = Column(String(100))
    timezone = Column(String(50), default="UTC")

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relation
    user = relationship("User", back_populates="profile")

    def __repr__(self):
        return f"<UserProfile user_id={self.user_id}>"


class UserPreferences(Base):
    """Préférences utilisateur"""
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # Langue et affichage
    language = Column(String(10), default="fr")
    theme = Column(String(20), default="light")  # light, dark, auto

    # Notifications
    notifications_enabled = Column(Boolean, default=True)
    email_notifications = Column(Boolean, default=True)
    push_notifications = Column(Boolean, default=True)

    # Préférences d'étude
    daily_goal_minutes = Column(Integer, default=30)
    reminder_time = Column(String(5), default="09:00")  # HH:MM
    weekend_reminders = Column(Boolean, default=False)

    # Confidentialité
    profile_public = Column(Boolean, default=True)
    show_in_leaderboard = Column(Boolean, default=True)
    show_activity_status = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relation
    user = relationship("User", back_populates="preferences")

    def __repr__(self):
        return f"<UserPreferences user_id={self.user_id}>"


class UserSubscription(Base):
    """Informations d'abonnement"""
    __tablename__ = "user_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # Type d'abonnement
    subscription_type = Column(Enum(SubscriptionType), default=SubscriptionType.FREE, nullable=False)
    subscription_starts_at = Column(DateTime(timezone=True), nullable=True)
    subscription_ends_at = Column(DateTime(timezone=True), nullable=True)

    # Paiement
    stripe_customer_id = Column(String(100), nullable=True)
    stripe_subscription_id = Column(String(100), nullable=True)

    # Limites
    ai_requests_limit = Column(Integer, default=10)  # Par jour
    storage_limit_mb = Column(Integer, default=100)  # En MB

    # Auto-renouvellement
    auto_renew = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relation
    user = relationship("User", back_populates="subscription")

    def __repr__(self):
        return f"<UserSubscription user_id={self.user_id} type={self.subscription_type}>"

    def is_premium(self) -> bool:
        """Vérifie si l'utilisateur a un abonnement premium"""
        return self.subscription_type in [SubscriptionType.PREMIUM, SubscriptionType.PREMIUM_PLUS, SubscriptionType.INSTITUTIONAL]

    def is_active(self) -> bool:
        """Vérifie si l'abonnement est actif"""
        if self.subscription_type == SubscriptionType.FREE:
            return True
        if not self.subscription_ends_at:
            return False
        return self.subscription_ends_at > utc_now()


class UserGamification(Base):
    """Données de gamification (XP, niveau, streaks)"""
    __tablename__ = "user_gamification"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # XP et niveau
    total_xp = Column(Integer, default=0)
    level = Column(Integer, default=1)

    # Streaks
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_activity_date = Column(DateTime(timezone=True))

    # Achievements (stockés comme JSON pour flexibilité)
    unlocked_achievements = Column(JSON, default=list)
    achievement_points = Column(Integer, default=0)

    # Badges spéciaux
    badges = Column(JSON, default=list)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relation
    user = relationship("User", back_populates="gamification")

    def __repr__(self):
        return f"<UserGamification user_id={self.user_id} level={self.level} xp={self.total_xp}>"

    def calculate_level(self) -> int:
        """Calcule le niveau basé sur l'XP (formule style Duolingo)"""
        from app.services.xp_service import calculate_level
        return calculate_level(self.total_xp or 0)

    def xp_for_next_level(self) -> int:
        """Calcule l'XP total nécessaire pour le prochain niveau"""
        from app.services.xp_service import total_xp_for_level
        return total_xp_for_level(self.level + 1)

    def xp_progress_percentage(self) -> float:
        """Pourcentage de progression vers le prochain niveau"""
        from app.services.xp_service import get_level_progress
        progress = get_level_progress(self.total_xp or 0)
        return progress["progress_percent"]

    def get_xp_progress(self) -> dict:
        """Retourne les infos détaillées de progression"""
        from app.services.xp_service import get_level_progress
        return get_level_progress(self.total_xp or 0)

    def add_xp(self, amount: int) -> dict:
        """
        Ajoute de l'XP et vérifie le level up

        Returns:
            dict avec les informations de level up
        """
        old_level = self.level
        self.total_xp = (self.total_xp or 0) + amount
        new_level = self.calculate_level()

        leveled_up = new_level > old_level
        if leveled_up:
            self.level = new_level

        return {
            "xp_gained": amount,
            "total_xp": self.total_xp,
            "old_level": old_level,
            "new_level": new_level,
            "leveled_up": leveled_up
        }


class UserStats(Base):
    """Statistiques d'utilisation"""
    __tablename__ = "user_stats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # Temps d'étude
    total_study_time_minutes = Column(Integer, default=0)
    study_time_this_week = Column(Integer, default=0)
    study_time_this_month = Column(Integer, default=0)

    # Notes
    total_notes_created = Column(Integer, default=0)
    total_notes_words = Column(Integer, default=0)

    # Flashcards
    total_flashcards_created = Column(Integer, default=0)
    total_flashcards_reviewed = Column(Integer, default=0)
    flashcards_mastered = Column(Integer, default=0)

    # Quizzes
    total_quizzes_created = Column(Integer, default=0)
    total_quizzes_taken = Column(Integer, default=0)
    total_quizzes_completed = Column(Integer, default=0)
    average_quiz_score = Column(Float, default=0.0)

    # Duels
    total_duels_played = Column(Integer, default=0)
    duels_won = Column(Integer, default=0)
    duels_lost = Column(Integer, default=0)
    duel_win_streak = Column(Integer, default=0)

    # Sessions d'étude
    total_study_sessions = Column(Integer, default=0)
    average_session_duration = Column(Integer, default=0)  # En minutes

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    stats_reset_date = Column(DateTime(timezone=True))  # Pour les stats hebdo/mensuelles

    # Relation
    user = relationship("User", back_populates="stats")

    def __repr__(self):
        return f"<UserStats user_id={self.user_id}>"

    def get_duel_win_rate(self) -> float:
        """Calcule le taux de victoire en duel"""
        total = self.duels_won + self.duels_lost
        return (self.duels_won / total * 100) if total > 0 else 0.0

    def increment_stat(self, stat_name: str, amount: int = 1) -> bool:
        """Incrémente une statistique de manière sécurisée"""
        if hasattr(self, stat_name):
            current_value = getattr(self, stat_name) or 0
            setattr(self, stat_name, current_value + amount)
            return True
        return False


class UserMascot(Base):
    """Données de la mascotte Spark 🐿️⚡"""
    __tablename__ = "user_mascots"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # Identité de la mascotte
    name = Column(String(50), default="Spark")
    level = Column(Integer, default=1)

    # Accessoires
    unlocked_accessories = Column(JSON, default=list)  # ["glasses", "hat", "cape"]
    current_accessory = Column(String(50), nullable=True)  # Accessoire équipé

    # Humeur et interaction
    happiness = Column(Integer, default=100)  # 0-100
    last_interaction_date = Column(DateTime(timezone=True))
    interaction_count = Column(Integer, default=0)

    # Personnalisation
    color_variant = Column(String(20), default="orange")  # orange, blue, purple, gold

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relation
    user = relationship("User", back_populates="mascot")

    def __repr__(self):
        return f"<UserMascot {self.name} level={self.level}>"

    def calculate_level(self, user_level: int) -> int:
        """
        Calcule le niveau de Spark basé sur le niveau utilisateur.
        Spark évolue aux niveaux 5, 10, 15 et 20.

        Args:
            user_level: Le niveau de l'utilisateur (pas l'XP)
        """
        if user_level < 5:
            return 1  # Spark bébé (niveaux 1-4)
        elif user_level < 10:
            return 2  # Spark junior (niveaux 5-9)
        elif user_level < 15:
            return 3  # Spark expert (niveaux 10-14)
        elif user_level < 20:
            return 4  # Spark sage (niveaux 15-19)
        else:
            return 5  # Spark légendaire (niveau 20+)

    def get_unlockable_accessories(self, user_stats: 'UserStats', user_gamification: 'UserGamification') -> list:
        """Retourne les accessoires que l'utilisateur peut débloquer"""
        unlockable = []

        if user_stats:
            if user_stats.total_flashcards_created >= 100:
                unlockable.append("graduate_hat")
            if user_stats.total_notes_created >= 50:
                unlockable.append("mini_library")
            if user_stats.total_quizzes_completed >= 20:
                unlockable.append("trophy")

        if user_gamification:
            if user_gamification.current_streak >= 10:
                unlockable.append("glasses")
            if user_gamification.total_xp >= 1000:
                unlockable.append("golden_acorn")
            if user_gamification.level >= 10:
                unlockable.append("lightning_cape")
            if user_gamification.longest_streak >= 30:
                unlockable.append("crown")

        return unlockable

    def interact(self) -> dict:
        """Interaction avec la mascotte"""
        # Initialiser les valeurs si None (pas encore committé en DB)
        if self.interaction_count is None:
            self.interaction_count = 0
        if self.happiness is None:
            self.happiness = 50

        self.interaction_count += 1
        self.last_interaction_date = utc_now()

        # Augmenter le bonheur
        self.happiness = min(100, self.happiness + 5)

        return {
            "happiness": self.happiness,
            "interaction_count": self.interaction_count,
            "message": self._get_interaction_message()
        }

    def _get_interaction_message(self) -> str:
        """Génère un message d'interaction aléatoire basé sur l'état de Spark"""
        import random
        name = self.name or "Spark"
        happiness = self.happiness or 50
        interaction_count = self.interaction_count or 0

        # Messages variés selon le bonheur
        happy_messages = [
            f"{name} est super content de te voir ! 🐿️⚡",
            f"Hey ! {name} fait la fête ! 🎉🐿️",
            f"{name} te fait un câlin virtuel ! 🤗",
            f"Woohoo ! {name} adore quand tu passes ! 🌟",
            f"{name} danse de joie ! 💃🐿️",
            f"Tu as illuminé la journée de {name} ! ☀️",
            f"{name} te high-five ! ✋🐿️",
            f"Trop cool ! {name} est hyper motivé ! 🚀",
            f"{name} fait le tour de la joie ! 🎊",
            f"Yay ! {name} t'envoie plein d'énergie ! ⚡",
        ]

        normal_messages = [
            f"{name} te salue joyeusement ! 🐿️",
            f"Coucou ! {name} est là pour toi ! 👋",
            f"{name} te sourit ! 😊🐿️",
            f"Hello ! {name} te fait signe ! ✨",
            f"{name} est prêt à t'aider ! 💪",
            f"Hey ! Qu'est-ce qu'on fait aujourd'hui ? 🤔",
            f"{name} t'encourage à continuer ! 📚",
        ]

        sad_messages = [
            f"{name} a besoin d'attention... 🐿️💤",
            f"{name} se sent un peu seul... 😢",
            f"Ça fait longtemps ! {name} s'ennuyait... 🥺",
            f"{name} est content que tu sois revenu ! 💙",
        ]

        # Messages spéciaux selon le nombre d'interactions
        if interaction_count == 1:
            return f"Première interaction ! {name} est ravi de te rencontrer ! 🎉"
        elif interaction_count == 10:
            return f"10 interactions ! {name} t'adore déjà ! 💕"
        elif interaction_count == 50:
            return f"50 interactions ! Tu es le meilleur ami de {name} ! 🏆"
        elif interaction_count == 100:
            return f"100 interactions ! {name} et toi êtes inséparables ! 🌟"
        elif interaction_count % 25 == 0:
            return f"Milestone ! {interaction_count} interactions avec {name} ! 🎊"

        # Sélection aléatoire basée sur le bonheur
        if happiness >= 80:
            return random.choice(happy_messages)
        elif happiness >= 50:
            return random.choice(normal_messages)
        else:
            return random.choice(sad_messages)


class UserAIUsage(Base):
    """Suivi de l'utilisation de l'IA"""
    __tablename__ = "user_ai_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # Compteurs journaliers
    requests_today = Column(Integer, default=0)
    requests_reset_date = Column(DateTime(timezone=True))

    # Compteurs totaux
    total_requests = Column(Integer, default=0)
    total_tokens_used = Column(Integer, default=0)

    # Par type de requête
    quiz_generations = Column(Integer, default=0)
    flashcard_generations = Column(Integer, default=0)
    note_summaries = Column(Integer, default=0)
    explanations = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relation
    user = relationship("User", back_populates="ai_usage")

    def __repr__(self):
        return f"<UserAIUsage user_id={self.user_id} today={self.requests_today}>"

    def can_make_request(self, limit: int) -> bool:
        """Vérifie si l'utilisateur peut faire une requête IA"""
        self._check_reset()
        requests = self.requests_today or 0
        return requests < limit

    def record_request(self, request_type: str, tokens_used: int = 0) -> bool:
        """Enregistre une requête IA"""
        self._check_reset()

        # Initialiser les valeurs si None (pas encore committé en DB)
        if self.requests_today is None:
            self.requests_today = 0
        if self.total_requests is None:
            self.total_requests = 0
        if self.total_tokens_used is None:
            self.total_tokens_used = 0

        self.requests_today += 1
        self.total_requests += 1
        self.total_tokens_used += tokens_used

        # Incrémenter le compteur par type
        type_mapping = {
            "quiz": "quiz_generations",
            "flashcard": "flashcard_generations",
            "summary": "note_summaries",
            "explanation": "explanations"
        }

        if request_type in type_mapping:
            attr = type_mapping[request_type]
            current_val = getattr(self, attr) or 0
            setattr(self, attr, current_val + 1)

        return True

    def _check_reset(self):
        """Vérifie si le compteur journalier doit être réinitialisé"""
        now = utc_now()
        reset_date = self.requests_reset_date
        if not reset_date or (hasattr(reset_date, 'date') and reset_date.date() < now.date()):
            self.requests_today = 0
            self.requests_reset_date = now


# ==================== FONCTION HELPER POUR CRÉER UN UTILISATEUR COMPLET ====================
def create_user_with_defaults(
    email: str,
    username: str,
    hashed_password: str,
    full_name: str = None,
    role: UserRole = UserRole.STUDENT
) -> User:
    """
    Crée un utilisateur avec tous les sous-modèles initialisés

    Args:
        email: Email de l'utilisateur
        username: Nom d'utilisateur
        hashed_password: Mot de passe hashé
        full_name: Nom complet (optionnel)
        role: Rôle (défaut: STUDENT)

    Returns:
        User avec tous les sous-modèles
    """
    user = User(
        email=email,
        username=username,
        hashed_password=hashed_password,
        full_name=full_name,
        role=role,
        is_active=True,
        is_verified=False,
        is_deleted=False,
        is_online=False
    )

    # Créer les sous-modèles avec valeurs par défaut explicites
    # (SQLAlchemy default ne s'applique qu'au commit en DB)
    user.profile = UserProfile(timezone="UTC")
    user.preferences = UserPreferences(
        language="fr",
        theme="light",
        notifications_enabled=True,
        email_notifications=True,
        daily_goal_minutes=30,
        profile_public=True,
        show_in_leaderboard=True
    )
    user.subscription = UserSubscription(
        subscription_type=SubscriptionType.FREE,
        ai_requests_limit=5,  # Option 3: 5 requêtes/jour pour FREE
        storage_limit_mb=100,
        auto_renew=True
    )
    user.gamification = UserGamification(
        total_xp=0,
        level=1,
        current_streak=0,
        longest_streak=0,
        achievement_points=0
    )
    user.stats = UserStats(
        total_study_time_minutes=0,
        total_notes_created=0,
        total_flashcards_created=0,
        total_quizzes_completed=0,
        duels_won=0,
        duels_lost=0,
        total_duels_played=0
    )
    user.mascot = UserMascot(
        name="Spark",
        level=1,
        happiness=100,
        color_variant="orange",
        interaction_count=0
    )
    user.ai_usage = UserAIUsage(
        requests_today=0,
        total_requests=0,
        total_tokens_used=0,
        quiz_generations=0,
        flashcard_generations=0,
        note_summaries=0,
        explanations=0
    )

    return user
