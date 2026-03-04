"""
Modèle Schedule (Emploi du temps) avec système de rappels intelligents
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base
from app.core.datetime_utils import utc_now


class EventType(str, enum.Enum):
    """Types d'événements avec stratégies de rappel différentes"""
    EXAM = "exam"           # Examen: rappels 7j, 3j, 1j, 2h, 30min
    CLASS = "class"         # Cours: rappels 1j, 1h, 15min
    DEADLINE = "deadline"   # Devoir/Deadline: rappels 3j, 1j, 3h
    STUDY = "study"         # Session d'étude: rappels 1h, 15min
    MEETING = "meeting"     # Réunion: rappels 1j, 1h, 15min
    OTHER = "other"         # Autre: rappels 1j, 1h


# Configuration des rappels par type d'événement (en minutes)
REMINDER_STRATEGIES = {
    EventType.EXAM: [
        {"minutes": 10080, "label": "1 semaine", "priority": "normal"},      # 7 jours
        {"minutes": 4320, "label": "3 jours", "priority": "normal"},          # 3 jours
        {"minutes": 1440, "label": "1 jour", "priority": "high"},             # 1 jour
        {"minutes": 120, "label": "2 heures", "priority": "high"},            # 2 heures
        {"minutes": 30, "label": "30 minutes", "priority": "urgent"},         # 30 min
    ],
    EventType.CLASS: [
        {"minutes": 1440, "label": "1 jour", "priority": "low"},              # 1 jour
        {"minutes": 60, "label": "1 heure", "priority": "normal"},            # 1 heure
        {"minutes": 15, "label": "15 minutes", "priority": "high"},           # 15 min
    ],
    EventType.DEADLINE: [
        {"minutes": 4320, "label": "3 jours", "priority": "normal"},          # 3 jours
        {"minutes": 1440, "label": "1 jour", "priority": "high"},             # 1 jour
        {"minutes": 180, "label": "3 heures", "priority": "urgent"},          # 3 heures
    ],
    EventType.STUDY: [
        {"minutes": 60, "label": "1 heure", "priority": "normal"},            # 1 heure
        {"minutes": 15, "label": "15 minutes", "priority": "high"},           # 15 min
    ],
    EventType.MEETING: [
        {"minutes": 1440, "label": "1 jour", "priority": "low"},              # 1 jour
        {"minutes": 60, "label": "1 heure", "priority": "normal"},            # 1 heure
        {"minutes": 15, "label": "15 minutes", "priority": "high"},           # 15 min
    ],
    EventType.OTHER: [
        {"minutes": 1440, "label": "1 jour", "priority": "low"},              # 1 jour
        {"minutes": 60, "label": "1 heure", "priority": "normal"},            # 1 heure
    ],
}


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(String(50), default="other")  # exam, class, deadline, study, meeting, other
    day_of_week = Column(Integer, nullable=True)  # 0=Monday, 6=Sunday (pour récurrent)
    start_time = Column(DateTime(timezone=True), nullable=False)  # Avec timezone
    end_time = Column(DateTime(timezone=True), nullable=False)
    location = Column(String(255), nullable=True)
    is_recurring = Column(Boolean, default=False)
    recurrence_pattern = Column(String(50), nullable=True)  # daily, weekly, monthly

    # Rappels intelligents
    reminder_enabled = Column(Boolean, default=True)
    reminder_minutes_before = Column(Integer, nullable=True)  # Override manuel
    reminders_sent = Column(JSON, default=list)  # [{"minutes": 1440, "sent_at": "2024-..."}]

    # État
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    is_cancelled = Column(Boolean, default=False)

    # Affichage
    color = Column(String(20), default="#3B82F6")

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relations
    user = relationship("User")
    subject = relationship("Subject")

    def get_reminder_strategy(self) -> list:
        """Retourne la stratégie de rappels selon le type d'événement"""
        try:
            event = EventType(self.event_type)
            return REMINDER_STRATEGIES.get(event, REMINDER_STRATEGIES[EventType.OTHER])
        except ValueError:
            return REMINDER_STRATEGIES[EventType.OTHER]

    def get_pending_reminders(self, current_time: datetime) -> List[Dict[str, Any]]:
        """Retourne les rappels à envoyer (non encore envoyés et dans la fenêtre)"""
        if not self.reminder_enabled or self.is_completed or self.is_cancelled:
            return []

        strategy = self.get_reminder_strategy()
        sent_minutes = [r.get("minutes") for r in (self.reminders_sent or [])]

        pending = []
        for reminder in strategy:
            minutes_before = reminder["minutes"]
            if minutes_before in sent_minutes:
                continue  # Déjà envoyé

            # Calcul du moment où le rappel doit être envoyé
            reminder_time = self.start_time - timedelta(minutes=minutes_before)

            # Si on est dans la fenêtre (rappel_time <= now < event_time)
            if reminder_time <= current_time < self.start_time:
                pending.append({
                    **reminder,
                    "reminder_time": reminder_time
                })

        return pending

    def mark_reminder_sent(self, minutes_before: int) -> None:
        """Marque un rappel comme envoyé"""
        if self.reminders_sent is None:
            self.reminders_sent = []

        self.reminders_sent = self.reminders_sent + [{
            "minutes": minutes_before,
            "sent_at": utc_now().isoformat()
        }]
