"""
Service de rappels intelligents - Gère les notifications basées sur:
- Le fuseau horaire de l'utilisateur
- Le type d'événement (examen, cours, deadline, etc.)
- Les heures de silence (quiet hours)
- L'historique des rappels déjà envoyés
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.core.datetime_utils import utc_now
from app.models.schedule import Schedule, EventType, REMINDER_STRATEGIES
from app.models.notification import (
    Notification, NotificationPreference,
    NotificationType, NotificationPriority, NotificationChannel
)
from app.models.user import User
from app.services.email_service import email_service

logger = logging.getLogger(__name__)


# Labels pour les types d'événements
EVENT_TYPE_LABELS = {
    "exam": "Examen",
    "class": "Cours",
    "deadline": "Date limite",
    "study": "Session d'étude",
    "meeting": "Réunion",
    "other": "Événement"
}


class SmartReminderService:
    """Service de rappels intelligents avec support timezone"""

    def __init__(self):
        self.default_timezone = "UTC"

    def get_user_timezone(self, user: User) -> ZoneInfo:
        """Récupère le timezone de l'utilisateur ou UTC par défaut"""
        tz_str = user.timezone or self.default_timezone
        try:
            return ZoneInfo(tz_str)
        except Exception:
            logger.warning(f"Invalid timezone '{tz_str}' for user {user.id}, using UTC")
            return ZoneInfo("UTC")

    def get_user_local_time(self, user: User, utc_time: Optional[datetime] = None) -> datetime:
        """Convertit un datetime UTC en heure locale de l'utilisateur"""
        if utc_time is None:
            utc_time = utc_now()

        user_tz = self.get_user_timezone(user)

        # S'assurer que le datetime est aware (avec timezone)
        if utc_time.tzinfo is None:
            utc_time = utc_time.replace(tzinfo=ZoneInfo("UTC"))

        return utc_time.astimezone(user_tz)

    def is_in_quiet_hours(self, user: User, preferences: Optional[NotificationPreference]) -> bool:
        """Vérifie si l'utilisateur est dans ses heures de silence"""
        if not preferences:
            return False

        user_local = self.get_user_local_time(user)
        current_hour = user_local.hour

        quiet_start = preferences.quiet_hours_start  # ex: 22
        quiet_end = preferences.quiet_hours_end       # ex: 8

        # Gestion du passage à minuit
        if quiet_start > quiet_end:
            # Ex: 22h-8h (nuit)
            return current_hour >= quiet_start or current_hour < quiet_end
        else:
            # Ex: 14h-16h (sieste)
            return quiet_start <= current_hour < quiet_end

    def should_send_email(
        self,
        user: User,
        preferences: Optional[NotificationPreference],
        event_type: str,
        priority: str
    ) -> bool:
        """Détermine si un email doit être envoyé pour cette notification"""
        if not preferences or not preferences.email_enabled:
            return False

        if not user.email_notifications:
            return False

        # Toujours envoyer les emails pour les urgents
        if priority == "urgent":
            return True

        # Pour les examens, envoyer des emails pour high et urgent
        if event_type == "exam" and priority in ("high", "urgent"):
            return True

        # Pour les deadlines, envoyer des emails pour high
        if event_type == "deadline" and priority in ("high", "urgent"):
            return True

        # Email digest activé = pas d'emails individuels
        if preferences.email_digest:
            return False

        return False

    def get_notification_priority(self, reminder_priority: str) -> NotificationPriority:
        """Convertit la priorité string en enum"""
        mapping = {
            "low": NotificationPriority.LOW,
            "normal": NotificationPriority.NORMAL,
            "high": NotificationPriority.HIGH,
            "urgent": NotificationPriority.URGENT
        }
        return mapping.get(reminder_priority, NotificationPriority.NORMAL)

    def get_notification_type(self, event_type: str) -> NotificationType:
        """Retourne le type de notification selon le type d'événement"""
        if event_type == "exam":
            return NotificationType.EXAM_REMINDER
        return NotificationType.EVENT_REMINDER

    def format_time_remaining(self, minutes: int) -> str:
        """Formate le temps restant de manière lisible"""
        if minutes >= 10080:  # 7 jours
            days = minutes // 1440
            return f"dans {days} jour{'s' if days > 1 else ''}"
        elif minutes >= 1440:  # 1+ jour
            days = minutes // 1440
            return f"dans {days} jour{'s' if days > 1 else ''}"
        elif minutes >= 60:
            hours = minutes // 60
            return f"dans {hours} heure{'s' if hours > 1 else ''}"
        else:
            return f"dans {minutes} minute{'s' if minutes > 1 else ''}"

    async def get_events_needing_reminders(
        self,
        db: AsyncSession,
        lookahead_minutes: int = 10080  # 7 jours par défaut
    ) -> List[Tuple[Schedule, User, NotificationPreference]]:
        """
        Récupère tous les événements qui ont des rappels en attente.
        Retourne des tuples (event, user, preferences).
        """
        now = utc_now()
        max_time = now + timedelta(minutes=lookahead_minutes)

        # Récupérer les événements futurs non complétés avec leurs utilisateurs
        query = (
            select(Schedule)
            .options(
                selectinload(Schedule.user),
                selectinload(Schedule.subject)
            )
            .where(
                and_(
                    Schedule.start_time > now,
                    Schedule.start_time <= max_time,
                    Schedule.is_completed == False,
                    Schedule.is_cancelled == False,
                    Schedule.reminder_enabled == True
                )
            )
        )

        result = await db.execute(query)
        events = result.scalars().all()

        # Récupérer les préférences pour tous les utilisateurs concernés
        user_ids = list(set(e.user_id for e in events))

        if not user_ids:
            return []

        prefs_query = select(NotificationPreference).where(
            NotificationPreference.user_id.in_(user_ids)
        )
        prefs_result = await db.execute(prefs_query)
        prefs = {p.user_id: p for p in prefs_result.scalars().all()}

        # Construire les tuples
        results = []
        for event in events:
            user = event.user
            preference = prefs.get(user.id)
            results.append((event, user, preference))

        return results

    async def process_event_reminders(
        self,
        db: AsyncSession,
        event: Schedule,
        user: User,
        preferences: Optional[NotificationPreference]
    ) -> List[Dict[str, Any]]:
        """
        Traite les rappels pour un événement donné.
        Retourne la liste des rappels envoyés.
        """
        sent_reminders = []

        # Vérifier si les notifications calendrier sont activées
        if preferences and not preferences.calendar_notifications:
            return sent_reminders

        # Vérifier les heures de silence (sauf urgents)
        in_quiet_hours = self.is_in_quiet_hours(user, preferences)

        # Obtenir l'heure locale de l'utilisateur
        user_tz = self.get_user_timezone(user)
        now_utc = utc_now().replace(tzinfo=ZoneInfo("UTC"))

        # Obtenir les rappels en attente
        pending_reminders = event.get_pending_reminders(now_utc)

        for reminder in pending_reminders:
            priority = reminder["priority"]

            # Skip si en heures de silence (sauf urgent)
            if in_quiet_hours and priority != "urgent":
                continue

            # Créer la notification
            notification = await self._create_reminder_notification(
                db, event, user, reminder, user_tz
            )

            if notification:
                # Marquer le rappel comme envoyé
                event.mark_reminder_sent(reminder["minutes"])

                # Envoyer email si nécessaire
                should_email = self.should_send_email(
                    user, preferences, event.event_type, priority
                )

                if should_email:
                    await self._send_reminder_email(event, user, reminder, user_tz)
                    notification.email_sent = True
                    notification.email_sent_at = utc_now()

                sent_reminders.append({
                    "event_id": event.id,
                    "minutes_before": reminder["minutes"],
                    "email_sent": should_email
                })

        return sent_reminders

    async def _create_reminder_notification(
        self,
        db: AsyncSession,
        event: Schedule,
        user: User,
        reminder: Dict[str, Any],
        user_tz: ZoneInfo
    ) -> Optional[Notification]:
        """Crée une notification de rappel"""
        try:
            event_type_label = EVENT_TYPE_LABELS.get(event.event_type, "Événement")
            time_label = reminder["label"]

            # Formatter l'heure de l'événement en heure locale
            event_start_local = event.start_time.astimezone(user_tz)
            event_time_str = event_start_local.strftime("%H:%M")
            event_date_str = event_start_local.strftime("%d/%m/%Y")

            # Déterminer le titre selon le type
            if event.event_type == "exam":
                title = f"Examen {time_label} !"
                message = f"'{event.title}' commence le {event_date_str} à {event_time_str}"
            elif event.event_type == "deadline":
                title = f"Date limite {time_label} !"
                message = f"'{event.title}' expire le {event_date_str} à {event_time_str}"
            else:
                title = f"{event_type_label} {time_label}"
                message = f"'{event.title}' commence à {event_time_str}"

            # Ajouter le lieu si disponible
            if event.location:
                message += f" - {event.location}"

            notification = Notification(
                user_id=user.id,
                type=self.get_notification_type(event.event_type),
                title=title,
                message=message,
                priority=self.get_notification_priority(reminder["priority"]),
                channel=NotificationChannel.ALL,
                action_url=f"/schedule?event={event.id}",
                data=f'{{"event_id": {event.id}, "event_type": "{event.event_type}", "minutes_before": {reminder["minutes"]}}}'
            )

            db.add(notification)
            await db.flush()

            logger.info(f"Created reminder notification for event {event.id}, user {user.id}")
            return notification

        except Exception as e:
            logger.error(f"Error creating reminder notification: {e}")
            return None

    async def _send_reminder_email(
        self,
        event: Schedule,
        user: User,
        reminder: Dict[str, Any],
        user_tz: ZoneInfo
    ) -> bool:
        """Envoie un email de rappel"""
        try:
            event_start_local = event.start_time.astimezone(user_tz)

            return await email_service.send_event_reminder(
                to_email=user.email,
                username=user.username,
                event_title=event.title,
                event_time=event_start_local,
                event_url=f"https://studera.app/schedule?event={event.id}"
            )
        except Exception as e:
            logger.error(f"Error sending reminder email: {e}")
            return False

    async def run_reminder_check(self, db: AsyncSession) -> Dict[str, Any]:
        """
        Exécute une vérification complète des rappels.
        À appeler depuis une tâche Celery.
        """
        results = {
            "events_checked": 0,
            "reminders_sent": 0,
            "emails_sent": 0,
            "errors": []
        }

        try:
            events_data = await self.get_events_needing_reminders(db)
            results["events_checked"] = len(events_data)

            for event, user, preferences in events_data:
                try:
                    sent = await self.process_event_reminders(db, event, user, preferences)

                    results["reminders_sent"] += len(sent)
                    results["emails_sent"] += sum(1 for r in sent if r.get("email_sent"))

                except Exception as e:
                    error_msg = f"Error processing event {event.id}: {str(e)}"
                    logger.error(error_msg)
                    results["errors"].append(error_msg)

            await db.commit()

        except Exception as e:
            error_msg = f"Error in reminder check: {str(e)}"
            logger.error(error_msg)
            results["errors"].append(error_msg)

        logger.info(
            f"Reminder check complete: {results['events_checked']} events, "
            f"{results['reminders_sent']} reminders, {results['emails_sent']} emails"
        )

        return results

    def get_reminder_preview(self, event_type: str) -> List[Dict[str, str]]:
        """
        Retourne un aperçu des rappels qui seront envoyés pour un type d'événement.
        Utile pour l'affichage dans le frontend.
        """
        try:
            et = EventType(event_type)
            strategy = REMINDER_STRATEGIES.get(et, REMINDER_STRATEGIES[EventType.OTHER])
        except ValueError:
            strategy = REMINDER_STRATEGIES[EventType.OTHER]

        return [
            {
                "time_before": self.format_time_remaining(r["minutes"]),
                "priority": r["priority"],
                "label": r["label"]
            }
            for r in strategy
        ]


# Instance singleton
smart_reminder_service = SmartReminderService()
