"""
Modeles Focus Room - Salles d'etude virtuelles (Body Doubling)
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, Enum as SQLEnum, JSON, Float, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timedelta, timezone
import enum
import secrets

from app.core.database import Base
from app.core.datetime_utils import utc_now


# ==================== ENUMS ====================

class FocusRoomType(str, enum.Enum):
    """Types de rooms"""
    PUBLIC = "public"           # Ouverte a tous
    SUBJECT = "subject"         # Par matiere
    UNIVERSITY = "university"   # Par universite
    PRIVATE = "private"         # Sur invitation
    EVENT = "event"             # Evenement temporaire


class FocusRoomCategory(str, enum.Enum):
    """Categories de rooms"""
    GENERAL = "general"
    SCIENCES = "sciences"
    HUMANITIES = "humanities"
    LANGUAGES = "languages"
    BUSINESS = "business"
    TECHNOLOGY = "technology"
    MEDICINE = "medicine"
    LAW = "law"
    OTHER = "other"


class ParticipantStatus(str, enum.Enum):
    """Statuts des participants"""
    FOCUSING = "focusing"   # En train d'etudier activement
    DEEP_WORK = "deep_work" # Mode Deep Work (90 min, notifications bloquées)
    BREAK = "break"         # En pause (max 15 min)
    IDLE = "idle"           # Inactif (10+ min sans interaction)
    AWAY = "away"           # Absent manuellement


class FocusActivityType(str, enum.Enum):
    """Types d'activites dans le feed"""
    USER_JOINED = "user_joined"
    USER_LEFT = "user_left"
    MILESTONE_15MIN = "milestone_15min"
    MILESTONE_30MIN = "milestone_30min"
    MILESTONE_45MIN = "milestone_45min"
    MILESTONE_1H = "milestone_1h"
    MILESTONE_90MIN = "milestone_90min"
    MILESTONE_2H = "milestone_2h"
    MILESTONE_3H = "milestone_3h"
    MILESTONE_4H = "milestone_4h"
    QUIZ_COMPLETED = "quiz_completed"
    FLASHCARDS_COMPLETED = "flashcards_completed"
    STREAK_ACHIEVED = "streak_achieved"
    FIRST_TODAY = "first_today"
    STATUS_CHANGED = "status_changed"
    POKE_SENT = "poke_sent"
    DEEP_WORK_STARTED = "deep_work_started"
    DEEP_WORK_COMPLETED = "deep_work_completed"


class InvitationStatus(str, enum.Enum):
    """Statuts des invitations"""
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"


# ==================== MODELES ====================

class FocusRoom(Base):
    """
    Room de focus (salle d'etude virtuelle)
    """
    __tablename__ = "focus_rooms"

    id = Column(Integer, primary_key=True, index=True)

    # Informations de base
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    emoji = Column(String(10), default="📚")

    # Type et categorie - values_callable pour utiliser les valeurs (minuscules) au lieu des noms
    room_type = Column(
        SQLEnum(FocusRoomType, values_callable=lambda x: [e.value for e in x]),
        default=FocusRoomType.PUBLIC,
        nullable=False
    )
    category = Column(
        SQLEnum(FocusRoomCategory, values_callable=lambda x: [e.value for e in x]),
        default=FocusRoomCategory.GENERAL,
        nullable=False
    )

    # Filtres (selon le type)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    university = Column(String(200), nullable=True)
    promotion = Column(String(50), nullable=True)

    # Configuration
    max_participants = Column(Integer, default=100)
    is_active = Column(Boolean, default=True)
    is_private = Column(Boolean, default=False)
    invite_code = Column(String(8), unique=True, nullable=True, index=True)

    # Createur
    creator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Stats persistantes (mises a jour periodiquement)
    total_focus_minutes = Column(Integer, default=0)
    total_sessions = Column(Integer, default=0)
    total_unique_users = Column(Integer, default=0)
    peak_participants = Column(Integer, default=0)

    # Stats journalieres (reset a minuit)
    today_focus_minutes = Column(Integer, default=0)
    today_sessions = Column(Integer, default=0)
    stats_reset_date = Column(DateTime(timezone=True), nullable=True)

    # Pour les events
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relations
    creator = relationship("User", foreign_keys=[creator_id], back_populates="created_focus_rooms")
    subject = relationship("Subject", foreign_keys=[subject_id])
    participants = relationship("FocusRoomParticipant", back_populates="room", cascade="all, delete-orphan")
    sessions = relationship("FocusSession", back_populates="room", cascade="all, delete-orphan")
    activities = relationship("FocusRoomActivity", back_populates="room", cascade="all, delete-orphan")
    invitations = relationship("FocusRoomInvitation", back_populates="room", cascade="all, delete-orphan")

    # Index pour les recherches
    __table_args__ = (
        Index('ix_focus_rooms_type_active', 'room_type', 'is_active'),
        Index('ix_focus_rooms_university', 'university'),
        Index('ix_focus_rooms_category', 'category'),
    )

    def __repr__(self):
        return f"<FocusRoom {self.name} ({self.room_type.value})>"

    def generate_invite_code(self) -> str:
        """Genere un nouveau code d'invitation unique"""
        self.invite_code = secrets.token_urlsafe(6)[:8].upper()
        return self.invite_code

    def is_event_active(self) -> bool:
        """Verifie si un event est actuellement actif"""
        if self.room_type != FocusRoomType.EVENT:
            return True
        now = utc_now()
        if self.starts_at and self.ends_at:
            return self.starts_at <= now <= self.ends_at
        return True

    def reset_daily_stats_if_needed(self):
        """Reset les stats journalieres si necessaire"""
        now = utc_now()
        if not self.stats_reset_date or self.stats_reset_date.date() < now.date():
            self.today_focus_minutes = 0
            self.today_sessions = 0
            self.stats_reset_date = now


class FocusRoomParticipant(Base):
    """
    Participant actif dans une room
    Un user ne peut etre que dans UNE room a la fois
    """
    __tablename__ = "focus_room_participants"

    id = Column(Integer, primary_key=True, index=True)

    # References
    room_id = Column(Integer, ForeignKey("focus_rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Statut actuel
    status = Column(
        SQLEnum(ParticipantStatus, values_callable=lambda x: [e.value for e in x]),
        default=ParticipantStatus.FOCUSING,
        nullable=False
    )

    # Activite en cours
    current_activity = Column(String(200), nullable=True)  # Ex: "Flashcards Chimie"
    current_subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)

    # Timing
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_activity_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_heartbeat_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    focus_started_at = Column(DateTime(timezone=True), nullable=True)
    break_started_at = Column(DateTime(timezone=True), nullable=True)

    # Stats de la session en cours
    current_focus_minutes = Column(Integer, default=0)
    current_break_minutes = Column(Integer, default=0)

    # Stats du jour dans cette room
    today_focus_minutes = Column(Integer, default=0)
    today_sessions_count = Column(Integer, default=0)

    # Milestones atteints dans cette session
    milestones_reached = Column(JSON, default=list)  # ["30min", "1h", ...]

    # Deep Work Mode (90 min sans interruption)
    deep_work_started_at = Column(DateTime(timezone=True), nullable=True)
    deep_work_end_at = Column(DateTime(timezone=True), nullable=True)
    deep_work_sessions_completed = Column(Integer, default=0)

    # Visibilite
    is_visible = Column(Boolean, default=True)
    show_activity = Column(Boolean, default=True)

    # Relations
    room = relationship("FocusRoom", back_populates="participants")
    user = relationship("User", back_populates="focus_room_participation")
    current_subject = relationship("Subject", foreign_keys=[current_subject_id])

    # Contrainte: un user dans une seule room
    __table_args__ = (
        UniqueConstraint('user_id', name='uq_participant_user_one_room'),
        Index('ix_focus_participant_status', 'status'),
    )

    def __repr__(self):
        return f"<FocusRoomParticipant user={self.user_id} room={self.room_id} status={self.status.value}>"

    def start_focus(self):
        """Demarre une session de focus"""
        now = utc_now()
        self.status = ParticipantStatus.FOCUSING
        self.focus_started_at = now
        self.break_started_at = None
        self.last_activity_at = now

    def start_break(self):
        """Passe en pause"""
        now = utc_now()
        # Sauvegarder les minutes de focus
        if self.focus_started_at:
            elapsed = (now - self.focus_started_at).total_seconds() / 60
            self.current_focus_minutes += int(elapsed)
            self.today_focus_minutes += int(elapsed)

        self.status = ParticipantStatus.BREAK
        self.break_started_at = now
        self.focus_started_at = None
        self.last_activity_at = now

    def resume_focus(self):
        """Reprend le focus apres une pause"""
        now = utc_now()
        # Sauvegarder les minutes de break
        if self.break_started_at:
            elapsed = (now - self.break_started_at).total_seconds() / 60
            self.current_break_minutes += int(elapsed)

        self.status = ParticipantStatus.FOCUSING
        self.focus_started_at = now
        self.break_started_at = None
        self.last_activity_at = now

    def set_away(self):
        """Se met en absent"""
        self._save_current_time()
        self.status = ParticipantStatus.AWAY
        self.focus_started_at = None
        self.break_started_at = None

    def set_idle(self):
        """Passe en idle (automatique)"""
        self._save_current_time()
        self.status = ParticipantStatus.IDLE
        self.focus_started_at = None
        self.break_started_at = None
        self.deep_work_started_at = None
        self.deep_work_end_at = None

    def start_deep_work(self, duration_minutes: int = 90):
        """Démarre une session Deep Work (90 min par défaut)"""
        now = utc_now()
        self._save_current_time()
        self.status = ParticipantStatus.DEEP_WORK
        self.deep_work_started_at = now
        self.deep_work_end_at = now + timedelta(minutes=duration_minutes)
        self.focus_started_at = now
        self.break_started_at = None
        self.last_activity_at = now

    def end_deep_work(self, completed: bool = True):
        """Termine une session Deep Work"""
        now = utc_now()
        if self.deep_work_started_at:
            elapsed = (now - self.deep_work_started_at).total_seconds() / 60
            self.current_focus_minutes += int(elapsed)
            self.today_focus_minutes += int(elapsed)
            if completed:
                self.deep_work_sessions_completed += 1

        self.status = ParticipantStatus.FOCUSING
        self.deep_work_started_at = None
        self.deep_work_end_at = None
        self.focus_started_at = now
        self.last_activity_at = now

    def is_in_deep_work(self) -> bool:
        """Vérifie si le participant est en mode Deep Work actif"""
        if self.status != ParticipantStatus.DEEP_WORK:
            return False
        now = utc_now()
        return self.deep_work_end_at and now < self.deep_work_end_at

    def get_deep_work_remaining_minutes(self) -> int:
        """Retourne les minutes restantes en Deep Work"""
        if not self.is_in_deep_work():
            return 0
        now = utc_now()
        remaining = (self.deep_work_end_at - now).total_seconds() / 60
        return max(0, int(remaining))

    def _save_current_time(self):
        """Sauvegarde le temps en cours"""
        now = utc_now()
        if self.focus_started_at:
            elapsed = (now - self.focus_started_at).total_seconds() / 60
            self.current_focus_minutes += int(elapsed)
            self.today_focus_minutes += int(elapsed)
        if self.break_started_at:
            elapsed = (now - self.break_started_at).total_seconds() / 60
            self.current_break_minutes += int(elapsed)

    def get_total_minutes(self) -> int:
        """Retourne le total des minutes de focus de la session actuelle"""
        now = utc_now()
        total = self.current_focus_minutes
        # Compter le temps si en mode focusing OU en deep_work
        if self.status in (ParticipantStatus.FOCUSING, ParticipantStatus.DEEP_WORK) and self.focus_started_at:
            elapsed = (now - self.focus_started_at).total_seconds() / 60
            total += int(elapsed)
        return total

    def get_today_total_minutes(self) -> int:
        """Retourne le total des minutes de focus du jour (sessions précédentes + actuelle)"""
        now = utc_now()
        # today_focus_minutes contient déjà les minutes des sessions précédentes du jour
        # + les minutes accumulées dans la session actuelle (via _save_current_time lors des changements d'état)
        total = self.today_focus_minutes or 0
        elapsed_minutes = 0
        # Ajouter le temps en cours si on est en train de focus
        if self.status in (ParticipantStatus.FOCUSING, ParticipantStatus.DEEP_WORK) and self.focus_started_at:
            elapsed_minutes = int((now - self.focus_started_at).total_seconds() / 60)
            total += elapsed_minutes
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[GET_TODAY_TOTAL] user_id={self.user_id}, today_focus_minutes={self.today_focus_minutes}, elapsed={elapsed_minutes}, total={total}, status={self.status}")
        return total

    def check_milestone(self) -> str:
        """Verifie si un nouveau milestone a ete atteint"""
        minutes = self.get_total_minutes()
        milestones = self.milestones_reached or []

        # Liste des milestones du plus grand au plus petit
        milestone_checks = [
            (240, "4h"),
            (180, "3h"),
            (120, "2h"),
            (90, "90min"),
            (60, "1h"),
            (45, "45min"),
            (30, "30min"),
            (15, "15min"),
        ]

        for min_required, milestone_name in milestone_checks:
            if minutes >= min_required and milestone_name not in milestones:
                milestones.append(milestone_name)
                self.milestones_reached = milestones
                return milestone_name

        return None


class FocusSession(Base):
    """
    Historique des sessions de focus (quand un user quitte une room)
    """
    __tablename__ = "focus_sessions"

    id = Column(Integer, primary_key=True, index=True)

    # References
    room_id = Column(Integer, ForeignKey("focus_rooms.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)

    # Timing
    started_at = Column(DateTime(timezone=True), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    # Durees
    focus_minutes = Column(Integer, default=0)
    break_minutes = Column(Integer, default=0)
    total_minutes = Column(Integer, default=0)

    # Performance
    focus_score = Column(Integer, nullable=True)  # 0-100, ratio focus/total
    activities_completed = Column(Integer, default=0)  # Quiz, flashcards, etc.
    milestones_reached = Column(JSON, default=list)

    # XP
    xp_earned = Column(Integer, default=0)
    xp_bonus = Column(Integer, default=0)  # Bonus room (20%)

    # Metadata
    room_name = Column(String(100), nullable=True)  # Garde le nom meme si room supprimee

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relations
    room = relationship("FocusRoom", back_populates="sessions")
    user = relationship("User")
    subject = relationship("Subject")

    __table_args__ = (
        Index('ix_focus_session_user_date', 'user_id', 'started_at'),
    )

    def __repr__(self):
        return f"<FocusSession user={self.user_id} minutes={self.focus_minutes}>"

    def calculate_focus_score(self) -> int:
        """Calcule le score de focus (ratio temps focus / temps total)"""
        if self.total_minutes == 0:
            return 0
        return int((self.focus_minutes / self.total_minutes) * 100)

    def calculate_xp(self) -> tuple:
        """Calcule l'XP gagne et le bonus"""
        base_xp = self.focus_minutes  # 1 XP par minute
        bonus_xp = int(base_xp * 0.20)  # 20% bonus room

        # Bonus milestones
        milestone_bonus = 0
        milestones = self.milestones_reached or []
        if "30min" in milestones:
            milestone_bonus += 3
        if "1h" in milestones:
            milestone_bonus += 6
        if "2h" in milestones:
            milestone_bonus += 12
        if "3h" in milestones:
            milestone_bonus += 18

        return base_xp + milestone_bonus, bonus_xp


class FocusRoomActivity(Base):
    """
    Feed d'activites de la room (pour affichage temps reel)
    """
    __tablename__ = "focus_room_activities"

    id = Column(Integer, primary_key=True, index=True)

    # References
    room_id = Column(Integer, ForeignKey("focus_rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Activite
    activity_type = Column(
        SQLEnum(FocusActivityType, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    message = Column(String(500), nullable=True)

    # Metadata supplementaire
    extra_data = Column(JSON, nullable=True)  # Ex: {"score": 95, "minutes": 60}

    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Relations
    room = relationship("FocusRoom", back_populates="activities")
    user = relationship("User")

    def __repr__(self):
        return f"<FocusRoomActivity {self.activity_type.value} user={self.user_id}>"


class FocusRoomInvitation(Base):
    """
    Invitations pour les rooms privees
    """
    __tablename__ = "focus_room_invitations"

    id = Column(Integer, primary_key=True, index=True)

    # References
    room_id = Column(Integer, ForeignKey("focus_rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    inviter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    invitee_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Statut
    status = Column(
        SQLEnum(InvitationStatus, values_callable=lambda x: [e.value for e in x]),
        default=InvitationStatus.PENDING,
        nullable=False
    )

    # Message personnalise
    message = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    responded_at = Column(DateTime(timezone=True), nullable=True)

    # Relations
    room = relationship("FocusRoom", back_populates="invitations")
    inviter = relationship("User", foreign_keys=[inviter_id])
    invitee = relationship("User", foreign_keys=[invitee_id])

    __table_args__ = (
        Index('ix_invitation_invitee_status', 'invitee_id', 'status'),
    )

    def __repr__(self):
        return f"<FocusRoomInvitation room={self.room_id} to={self.invitee_id}>"

    def is_expired(self) -> bool:
        """Verifie si l'invitation a expire"""
        return utc_now() > self.expires_at

    def accept(self):
        """Accepte l'invitation"""
        self.status = InvitationStatus.ACCEPTED
        self.responded_at = utc_now()

    def decline(self):
        """Decline l'invitation"""
        self.status = InvitationStatus.DECLINED
        self.responded_at = utc_now()


class FocusRoomPoke(Base):
    """
    Historique des pokes entre participants
    """
    __tablename__ = "focus_room_pokes"

    id = Column(Integer, primary_key=True, index=True)

    # References
    room_id = Column(Integer, ForeignKey("focus_rooms.id", ondelete="CASCADE"), nullable=False)
    from_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    to_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Message
    message = Column(String(200), nullable=True)

    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relations
    room = relationship("FocusRoom")
    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])

    def __repr__(self):
        return f"<FocusRoomPoke from={self.from_user_id} to={self.to_user_id}>"


# ==================== EXTENSION USER STATS ====================

class UserFocusRoomStats(Base):
    """
    Stats Focus Room par utilisateur
    Separe de UserStats pour modularite
    """
    __tablename__ = "user_focus_room_stats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # Stats globales
    total_focus_room_minutes = Column(Integer, default=0)
    total_focus_room_sessions = Column(Integer, default=0)
    total_rooms_joined = Column(Integer, default=0)
    total_rooms_created = Column(Integer, default=0)

    # Streaks
    focus_room_streak_days = Column(Integer, default=0)
    best_focus_room_streak = Column(Integer, default=0)
    last_focus_room_date = Column(DateTime(timezone=True), nullable=True)

    # Records
    longest_session_minutes = Column(Integer, default=0)
    best_focus_score = Column(Integer, default=0)  # 0-100

    # Room favorite (celle ou on passe le plus de temps)
    favorite_room_id = Column(Integer, ForeignKey("focus_rooms.id", ondelete="SET NULL"), nullable=True)
    favorite_room_minutes = Column(Integer, default=0)

    # Heure preferee (0-23)
    preferred_hour = Column(Integer, nullable=True)

    # XP gagne en Focus Rooms
    total_xp_earned = Column(Integer, default=0)
    total_xp_bonus = Column(Integer, default=0)

    # Achievements Focus Room
    focus_room_achievements = Column(JSON, default=list)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relations
    user = relationship("User", back_populates="focus_room_stats")
    favorite_room = relationship("FocusRoom")

    def __repr__(self):
        return f"<UserFocusRoomStats user={self.user_id} minutes={self.total_focus_room_minutes}>"

    def update_streak(self):
        """Met a jour le streak"""
        now = utc_now()

        if not self.last_focus_room_date:
            self.focus_room_streak_days = 1
        else:
            days_diff = (now.date() - self.last_focus_room_date.date()).days
            if days_diff == 0:
                pass  # Meme jour, pas de changement
            elif days_diff == 1:
                self.focus_room_streak_days += 1
            else:
                self.focus_room_streak_days = 1  # Reset

        self.last_focus_room_date = now

        if self.focus_room_streak_days > self.best_focus_room_streak:
            self.best_focus_room_streak = self.focus_room_streak_days

    def record_session(self, minutes: int, focus_score: int, xp_earned: int, xp_bonus: int):
        """Enregistre une session terminee"""
        self.total_focus_room_minutes += minutes
        self.total_focus_room_sessions += 1
        self.total_xp_earned += xp_earned
        self.total_xp_bonus += xp_bonus

        if minutes > self.longest_session_minutes:
            self.longest_session_minutes = minutes

        if focus_score > self.best_focus_score:
            self.best_focus_score = focus_score

        self.update_streak()
