"""
Service de Notifications - Study Master
Gère les notifications in-app, push et email
"""

import logging
import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, update, delete

from app.core.datetime_utils import utc_now
from app.models.notification import (
    Notification,
    NotificationPreference,
    NotificationType,
    NotificationPriority,
    NotificationChannel
)
from app.models.user import User
from app.services.cache_service import cache_service, CachePrefix, CacheTTL

logger = logging.getLogger(__name__)


class NotificationService:
    """Service centralisé pour les notifications"""

    # =========================================================================
    # Création de notifications
    # =========================================================================

    async def create_notification(
        self,
        db: AsyncSession,
        user_id: int,
        notification_type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.NORMAL,
        channel: NotificationChannel = NotificationChannel.IN_APP,
        action_url: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
        expires_in_hours: Optional[int] = None,
        bypass_deep_work: bool = False
    ) -> Optional[Notification]:
        """
        Crée une notification pour un utilisateur.
        Vérifie les préférences utilisateur et le mode Deep Work avant d'envoyer.
        """
        try:
            # Vérifier si l'utilisateur est en mode Deep Work (sauf si bypass)
            if not bypass_deep_work and priority != NotificationPriority.URGENT:
                if await self._is_user_in_deep_work(db, user_id):
                    logger.debug(f"Notification bloquée - user {user_id} en mode Deep Work")
                    return None

            # Vérifier les préférences utilisateur
            prefs = await self.get_user_preferences(db, user_id)

            # Vérifier si ce type de notification est activé
            if not self._should_notify(prefs, notification_type):
                logger.debug(f"Notification {notification_type.value} désactivée pour user {user_id}")
                return None

            # Vérifier les heures de silence (sauf urgentes)
            if priority != NotificationPriority.URGENT:
                if self._is_quiet_hours(prefs):
                    logger.debug(f"Heures de silence pour user {user_id}")
                    # En heures de silence, on crée quand même mais sans email
                    channel = NotificationChannel.IN_APP

            # Créer la notification
            notification = Notification(
                user_id=user_id,
                type=notification_type,
                title=title,
                message=message,
                priority=priority,
                channel=channel,
                action_url=action_url,
                data=json.dumps(data) if data else None,
                expires_at=utc_now() + timedelta(hours=expires_in_hours) if expires_in_hours else None
            )

            db.add(notification)
            await db.flush()

            # Invalider le cache des notifications
            await self._invalidate_notification_cache(user_id)

            # Envoyer email si nécessaire
            if channel in [NotificationChannel.EMAIL, NotificationChannel.ALL]:
                if prefs and prefs.email_enabled and not prefs.email_digest:
                    await self._send_email_notification(db, user_id, notification)

            logger.info(f"Notification créée: user={user_id}, type={notification_type.value}")

            return notification

        except Exception as e:
            logger.error(f"Erreur création notification: {e}")
            return None

    async def create_bulk_notifications(
        self,
        db: AsyncSession,
        user_ids: List[int],
        notification_type: NotificationType,
        title: str,
        message: str,
        **kwargs
    ) -> int:
        """Crée des notifications pour plusieurs utilisateurs"""
        created = 0
        for user_id in user_ids:
            notif = await self.create_notification(
                db=db,
                user_id=user_id,
                notification_type=notification_type,
                title=title,
                message=message,
                **kwargs
            )
            if notif:
                created += 1

        await db.commit()
        logger.info(f"Notifications bulk créées: {created}/{len(user_ids)}")
        return created

    # =========================================================================
    # Notifications spécifiques
    # =========================================================================

    async def notify_duel_challenge(
        self,
        db: AsyncSession,
        opponent_id: int,
        challenger_username: str,
        stakes_xp: int,
        duel_id: int
    ):
        """Notification de défi reçu"""
        return await self.create_notification(
            db=db,
            user_id=opponent_id,
            notification_type=NotificationType.DUEL_CHALLENGE,
            title="Nouveau défi ! ⚔️",
            message=f"{challenger_username} vous défie ! Enjeux: {stakes_xp} XP",
            priority=NotificationPriority.HIGH,
            action_url=f"/duels/{duel_id}",
            data={"duel_id": duel_id, "challenger": challenger_username, "stakes": stakes_xp}
        )

    async def notify_streak_reminder(
        self,
        db: AsyncSession,
        user_id: int,
        current_streak: int
    ):
        """Rappel pour maintenir la série"""
        messages = [
            f"N'oublie pas d'étudier aujourd'hui ! 🔥 Série actuelle: {current_streak} jours",
            f"Une petite session pour garder ta série de {current_streak} jours ? 💪",
            f"Spark te rappelle: révise pour garder tes {current_streak} jours de série ! ⚡"
        ]
        import random
        message = random.choice(messages)

        return await self.create_notification(
            db=db,
            user_id=user_id,
            notification_type=NotificationType.STREAK_REMINDER,
            title="Garde ta série ! 🔥",
            message=message,
            priority=NotificationPriority.NORMAL,
            action_url="/dashboard",
            data={"current_streak": current_streak},
            expires_in_hours=24
        )

    async def notify_event_reminder(
        self,
        db: AsyncSession,
        user_id: int,
        event_title: str,
        event_id: int,
        minutes_before: int
    ):
        """Rappel d'événement du calendrier"""
        if minutes_before >= 60:
            time_str = f"{minutes_before // 60}h"
        else:
            time_str = f"{minutes_before}min"

        return await self.create_notification(
            db=db,
            user_id=user_id,
            notification_type=NotificationType.EVENT_REMINDER,
            title=f"Rappel: {event_title}",
            message=f"Votre événement commence dans {time_str}",
            priority=NotificationPriority.HIGH,
            channel=NotificationChannel.ALL,
            action_url=f"/schedule?event={event_id}",
            data={"event_id": event_id, "minutes_before": minutes_before}
        )

    async def notify_flashcard_review(
        self,
        db: AsyncSession,
        user_id: int,
        cards_due: int,
        subject_name: Optional[str] = None
    ):
        """Rappel de révision de flashcards"""
        message = f"Tu as {cards_due} flashcards à réviser"
        if subject_name:
            message += f" en {subject_name}"
        message += " ! 📚"

        return await self.create_notification(
            db=db,
            user_id=user_id,
            notification_type=NotificationType.FLASHCARD_REVIEW,
            title="Flashcards à réviser 📚",
            message=message,
            priority=NotificationPriority.NORMAL,
            action_url="/flashcards",
            data={"cards_due": cards_due, "subject": subject_name}
        )

    async def notify_achievement_unlocked(
        self,
        db: AsyncSession,
        user_id: int,
        achievement_name: str,
        achievement_id: int,
        xp_reward: int
    ):
        """Notification de succès débloqué"""
        return await self.create_notification(
            db=db,
            user_id=user_id,
            notification_type=NotificationType.ACHIEVEMENT_UNLOCKED,
            title="Succès débloqué ! 🏆",
            message=f"Tu as débloqué '{achievement_name}' ! +{xp_reward} XP",
            priority=NotificationPriority.HIGH,
            action_url=f"/achievements#{achievement_id}",
            data={"achievement_id": achievement_id, "xp_reward": xp_reward}
        )

    async def notify_level_up(
        self,
        db: AsyncSession,
        user_id: int,
        new_level: int
    ):
        """Notification de niveau supérieur"""
        return await self.create_notification(
            db=db,
            user_id=user_id,
            notification_type=NotificationType.LEVEL_UP,
            title=f"Niveau {new_level} atteint ! 🎉",
            message=f"Félicitations ! Tu es maintenant niveau {new_level} !",
            priority=NotificationPriority.HIGH,
            action_url="/profile",
            data={"new_level": new_level}
        )

    async def notify_focus_room_invite(
        self,
        db: AsyncSession,
        invitee_id: int,
        inviter_username: str,
        room_name: str,
        room_id: int,
        invitation_id: int,
        message: Optional[str] = None
    ):
        """Notification d'invitation à une Focus Room"""
        notif_message = f"{inviter_username} t'invite à rejoindre la salle '{room_name}'"
        if message:
            notif_message += f" - \"{message}\""

        return await self.create_notification(
            db=db,
            user_id=invitee_id,
            notification_type=NotificationType.FOCUS_ROOM_INVITE,
            title="Invitation Focus Room 📚",
            message=notif_message,
            priority=NotificationPriority.HIGH,
            action_url=f"/focus-rooms/{room_id}",
            data={
                "room_id": room_id,
                "room_name": room_name,
                "invitation_id": invitation_id,
                "inviter": inviter_username
            }
        )

    async def notify_focus_room_invite_accepted(
        self,
        db: AsyncSession,
        inviter_id: int,
        invitee_username: str,
        room_name: str,
        room_id: int
    ):
        """Notification quand une invitation Focus Room est acceptée"""
        return await self.create_notification(
            db=db,
            user_id=inviter_id,
            notification_type=NotificationType.FOCUS_ROOM_INVITE_ACCEPTED,
            title="Invitation acceptée ! 🎉",
            message=f"{invitee_username} a rejoint ta salle '{room_name}'",
            priority=NotificationPriority.NORMAL,
            action_url=f"/focus-rooms/{room_id}",
            data={
                "room_id": room_id,
                "room_name": room_name,
                "invitee": invitee_username
            }
        )

    # =========================================================================
    # Lecture et gestion
    # =========================================================================

    async def get_user_notifications(
        self,
        db: AsyncSession,
        user_id: int,
        page: int = 1,
        page_size: int = 20,
        unread_only: bool = False
    ) -> tuple[List[Notification], int, int]:
        """
        Récupère les notifications d'un utilisateur.
        Retourne: (notifications, total, unread_count)
        """
        # Cache pour le count
        cache_key = cache_service.generate_key(
            CachePrefix.NOTIFICATION_UNREAD,
            user_id=user_id
        )

        # Base query
        query = select(Notification).where(
            Notification.user_id == user_id
        )

        if unread_only:
            query = query.where(Notification.is_read == False)

        # Filtrer les expirées
        query = query.where(
            (Notification.expires_at.is_(None)) |
            (Notification.expires_at > utc_now())
        )

        # Count total
        count_query = select(func.count()).select_from(Notification).where(
            Notification.user_id == user_id
        )
        total = await db.scalar(count_query) or 0

        # Count unread
        unread_query = select(func.count()).select_from(Notification).where(
            and_(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
        )
        unread_count = await db.scalar(unread_query) or 0

        # Pagination
        offset = (page - 1) * page_size
        query = query.order_by(Notification.created_at.desc()).offset(offset).limit(page_size)

        result = await db.execute(query)
        notifications = result.scalars().all()

        return list(notifications), total, unread_count

    async def get_unread_count(self, db: AsyncSession, user_id: int) -> Dict[str, Any]:
        """Récupère le nombre de notifications non lues avec cache"""
        cache_key = cache_service.generate_key(
            CachePrefix.NOTIFICATION_UNREAD,
            user_id=user_id
        )

        cached = await cache_service.get(cache_key)
        if cached:
            return cached

        # Total unread
        unread_query = select(func.count()).select_from(Notification).where(
            and_(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
        )
        total_unread = await db.scalar(unread_query) or 0

        # Par type
        by_type_query = select(
            Notification.type,
            func.count()
        ).where(
            and_(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
        ).group_by(Notification.type)

        result = await db.execute(by_type_query)
        by_type = {row[0].value: row[1] for row in result.all()}

        data = {
            "unread_count": total_unread,
            "by_type": by_type
        }

        await cache_service.set(cache_key, data, ttl=CacheTTL.VERY_SHORT)

        return data

    async def mark_as_read(
        self,
        db: AsyncSession,
        user_id: int,
        notification_ids: List[int]
    ) -> int:
        """Marque des notifications comme lues"""
        stmt = (
            update(Notification)
            .where(
                and_(
                    Notification.id.in_(notification_ids),
                    Notification.user_id == user_id
                )
            )
            .values(is_read=True, read_at=utc_now())
        )

        result = await db.execute(stmt)
        await db.commit()

        await self._invalidate_notification_cache(user_id)

        return result.rowcount

    async def mark_all_as_read(
        self,
        db: AsyncSession,
        user_id: int,
        before_date: Optional[datetime] = None
    ) -> int:
        """Marque toutes les notifications comme lues"""
        stmt = (
            update(Notification)
            .where(
                and_(
                    Notification.user_id == user_id,
                    Notification.is_read == False
                )
            )
        )

        if before_date:
            stmt = stmt.where(Notification.created_at <= before_date)

        stmt = stmt.values(is_read=True, read_at=utc_now())

        result = await db.execute(stmt)
        await db.commit()

        await self._invalidate_notification_cache(user_id)

        return result.rowcount

    async def delete_notification(
        self,
        db: AsyncSession,
        user_id: int,
        notification_id: int
    ) -> bool:
        """Supprime une notification"""
        stmt = delete(Notification).where(
            and_(
                Notification.id == notification_id,
                Notification.user_id == user_id
            )
        )

        result = await db.execute(stmt)
        await db.commit()

        if result.rowcount > 0:
            await self._invalidate_notification_cache(user_id)
            return True
        return False

    async def delete_old_notifications(
        self,
        db: AsyncSession,
        days_old: int = 30
    ) -> int:
        """Supprime les anciennes notifications lues"""
        cutoff_date = utc_now() - timedelta(days=days_old)

        stmt = delete(Notification).where(
            and_(
                Notification.is_read == True,
                Notification.created_at < cutoff_date
            )
        )

        result = await db.execute(stmt)
        await db.commit()

        logger.info(f"Supprimé {result.rowcount} anciennes notifications")
        return result.rowcount

    # =========================================================================
    # Préférences
    # =========================================================================

    async def get_user_preferences(
        self,
        db: AsyncSession,
        user_id: int
    ) -> Optional[NotificationPreference]:
        """Récupère les préférences de notification d'un utilisateur"""
        query = select(NotificationPreference).where(
            NotificationPreference.user_id == user_id
        )
        result = await db.execute(query)
        prefs = result.scalar_one_or_none()

        # Créer les préférences par défaut si n'existe pas
        if not prefs:
            prefs = NotificationPreference(user_id=user_id)
            db.add(prefs)
            await db.commit()
            await db.refresh(prefs)

        return prefs

    async def update_preferences(
        self,
        db: AsyncSession,
        user_id: int,
        updates: Dict[str, Any]
    ) -> NotificationPreference:
        """Met à jour les préférences de notification"""
        prefs = await self.get_user_preferences(db, user_id)

        for key, value in updates.items():
            if hasattr(prefs, key) and value is not None:
                setattr(prefs, key, value)

        await db.commit()
        await db.refresh(prefs)

        return prefs

    # =========================================================================
    # Helpers privés
    # =========================================================================

    def _should_notify(
        self,
        prefs: Optional[NotificationPreference],
        notification_type: NotificationType
    ) -> bool:
        """Vérifie si ce type de notification est activé"""
        if not prefs:
            return True  # Par défaut, tout est activé

        if not prefs.in_app_enabled:
            return False

        # Mapper les types vers les préférences
        type_to_pref = {
            NotificationType.DUEL_CHALLENGE: "duel_notifications",
            NotificationType.DUEL_ACCEPTED: "duel_notifications",
            NotificationType.DUEL_DECLINED: "duel_notifications",
            NotificationType.DUEL_COMPLETED: "duel_notifications",
            NotificationType.DUEL_WON: "duel_notifications",
            NotificationType.DUEL_LOST: "duel_notifications",
            NotificationType.EVENT_REMINDER: "calendar_notifications",
            NotificationType.EXAM_REMINDER: "calendar_notifications",
            NotificationType.STREAK_REMINDER: "streak_notifications",
            NotificationType.STREAK_LOST: "streak_notifications",
            NotificationType.STREAK_MILESTONE: "streak_notifications",
            NotificationType.FLASHCARD_REVIEW: "study_reminders",
            NotificationType.QUIZ_REMINDER: "study_reminders",
            NotificationType.ACHIEVEMENT_UNLOCKED: "achievement_notifications",
            NotificationType.LEVEL_UP: "achievement_notifications",
            NotificationType.XP_GAINED: "achievement_notifications",
            NotificationType.GROUP_INVITE: "social_notifications",
            NotificationType.GROUP_MESSAGE: "social_notifications",
            NotificationType.FOCUS_ROOM_INVITE: "social_notifications",
            NotificationType.FOCUS_ROOM_INVITE_ACCEPTED: "social_notifications",
        }

        pref_name = type_to_pref.get(notification_type)
        if pref_name:
            return getattr(prefs, pref_name, True)

        return True

    def _is_quiet_hours(self, prefs: Optional[NotificationPreference]) -> bool:
        """Vérifie si c'est les heures de silence"""
        if not prefs:
            return False

        current_hour = utc_now().hour

        start = prefs.quiet_hours_start
        end = prefs.quiet_hours_end

        if start <= end:
            # Période normale (ex: 22h-8h le même jour)
            return start <= current_hour < end
        else:
            # Période traversant minuit (ex: 22h-8h)
            return current_hour >= start or current_hour < end

    async def _is_user_in_deep_work(self, db: AsyncSession, user_id: int) -> bool:
        """Vérifie si l'utilisateur est actuellement en mode Deep Work"""
        try:
            from app.models.focus_room import FocusRoomParticipant, ParticipantStatus

            result = await db.execute(
                select(FocusRoomParticipant).where(
                    and_(
                        FocusRoomParticipant.user_id == user_id,
                        FocusRoomParticipant.status == ParticipantStatus.DEEP_WORK
                    )
                )
            )
            participant = result.scalar_one_or_none()

            if participant and participant.deep_work_end_at:
                # Vérifier que le deep work n'est pas expiré
                return utc_now() < participant.deep_work_end_at

            return False
        except Exception as e:
            logger.error(f"Erreur vérification deep work: {e}")
            return False

    async def _invalidate_notification_cache(self, user_id: int):
        """Invalide le cache des notifications"""
        await cache_service.delete_pattern(f"cache:notification:*user_id={user_id}*")

    async def _send_email_notification(
        self,
        db: AsyncSession,
        user_id: int,
        notification: Notification
    ):
        """Envoie une notification par email via le service email"""
        try:
            from app.services.email_service import email_service

            # Récupérer l'utilisateur
            user_query = select(User).where(User.id == user_id)
            result = await db.execute(user_query)
            user = result.scalar_one_or_none()

            if not user or not user.email:
                logger.warning(f"Utilisateur {user_id} non trouvé ou sans email")
                return

            # Créer le contenu HTML de l'email
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #6366f1; color: white; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h2 style="margin: 0;">{notification.title}</h2>
                </div>
                <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px;">
                    <p>{notification.message}</p>
                    <a href="https://studymaster.app/notifications"
                       style="display: inline-block; background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                        Voir la notification
                    </a>
                </div>
            </div>
            """

            # Envoyer l'email
            success = await email_service.send_async(
                to_email=user.email,
                subject=f"Study Master: {notification.title}",
                html_content=html_content,
                text_content=f"{notification.title}\n\n{notification.message}"
            )

            if success:
                notification.email_sent = True
                notification.email_sent_at = utc_now()
                logger.info(f"Email notification envoyé: user={user_id}, title={notification.title}")
            else:
                logger.warning(f"Échec envoi email notification: user={user_id}")

        except Exception as e:
            logger.error(f"Erreur envoi email notification: {e}")


# Instance singleton
notification_service = NotificationService()
