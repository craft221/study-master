"""
Tâches Celery pour les notifications automatiques
- Rappels de série (streak)
- Rappels d'événements calendrier
- Rappels de révision (flashcards, quiz)
- Envoi d'emails
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List

from celery import Task
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, selectinload

from app.celery_app import celery_app
from app.core.config import settings
from app.core.datetime_utils import utc_now
from app.models.user import User, UserGamification, UserPreferences, UserProfile
from app.models.schedule import Schedule
from app.models.notification import Notification, NotificationType, NotificationPriority
from app.models.flashcard import Flashcard

logger = logging.getLogger(__name__)


# Helper pour créer une session async dans Celery
def get_async_session():
    """Crée une session async pour les tâches Celery"""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return async_session


def run_async(coro):
    """Helper pour exécuter une coroutine dans Celery"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


class NotificationTask(Task):
    """Classe de base pour les tâches de notification"""
    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 3}
    retry_backoff = True


# =============================================================================
# Rappels de Streak (Style Duolingo) - Avec Timezone
# =============================================================================

@celery_app.task(base=NotificationTask, bind=True, name="notifications.send_streak_reminders")
def send_streak_reminders(self) -> Dict[str, Any]:
    """
    Envoie des rappels intelligents aux utilisateurs pour maintenir leur série.
    Exécuté toutes les heures par Celery Beat.

    Système intelligent:
    - Respecte le fuseau horaire de l'utilisateur
    - Envoie les rappels à 14h et 19h HEURE LOCALE
    - Respecte les heures de silence
    - Adapte l'urgence selon la longueur de la série

    Cible:
    - Utilisateurs avec streak >= 3 qui n'ont pas encore étudié aujourd'hui
    """
    return run_async(_send_streak_reminders_async())


async def _send_streak_reminders_async() -> Dict[str, Any]:
    """Version async du rappel de streak avec support timezone"""
    from zoneinfo import ZoneInfo

    async_session = get_async_session()

    async with async_session() as db:
        try:
            now_utc = utc_now()

            # Heures de rappel optimales (en heure locale)
            reminder_hours = [14, 19]  # 14h et 19h

            # Récupérer tous les utilisateurs éligibles avec leurs préférences
            # Note: current_streak est dans UserGamification, notifications_enabled dans UserPreferences
            query = (
                select(User)
                .join(UserGamification, User.id == UserGamification.user_id)
                .outerjoin(UserPreferences, User.id == UserPreferences.user_id)
                .outerjoin(User.notification_preferences)
                .options(
                    selectinload(User.notification_preferences),
                    selectinload(User.gamification),
                    selectinload(User.profile),
                )
                .where(
                    and_(
                        User.is_active == True,
                        UserGamification.current_streak >= 3,
                        or_(
                            UserPreferences.notifications_enabled == True,
                            UserPreferences.id == None  # Pas de préférences = notifications activées par défaut
                        )
                    )
                )
            )

            result = await db.execute(query)
            users = result.scalars().all()

            notifications_sent = 0
            emails_sent = 0

            # Import des traductions multilingues Spark
            from app.core.spark_translations import spark_messages, get_spark_language

            for user in users:
                try:
                    # Obtenir l'heure locale de l'utilisateur
                    user_tz_str = user.timezone or "UTC"
                    try:
                        user_tz = ZoneInfo(user_tz_str)
                    except Exception:
                        user_tz = ZoneInfo("UTC")

                    user_local_time = now_utc.replace(tzinfo=ZoneInfo("UTC")).astimezone(user_tz)
                    user_local_hour = user_local_time.hour

                    # Vérifier si c'est l'heure d'envoyer (tolérance de 30 min)
                    target_hour = None
                    for h in reminder_hours:
                        if h <= user_local_hour < h + 1:
                            target_hour = h
                            break

                    if target_hour is None:
                        continue  # Pas l'heure pour cet utilisateur

                    # Vérifier les heures de silence
                    prefs = user.notification_preferences
                    if prefs:
                        quiet_start = prefs.quiet_hours_start
                        quiet_end = prefs.quiet_hours_end

                        # Vérifier si on est dans les heures de silence
                        if quiet_start > quiet_end:
                            # Nuit (ex: 22h-8h)
                            if user_local_hour >= quiet_start or user_local_hour < quiet_end:
                                continue
                        else:
                            if quiet_start <= user_local_hour < quiet_end:
                                continue

                        # Vérifier si les rappels streak sont activés
                        if not prefs.streak_notifications:
                            continue

                    # Vérifier l'activité du jour (en heure locale)
                    user_today_start = user_local_time.replace(
                        hour=0, minute=0, second=0, microsecond=0
                    )

                    if user.last_activity_date:
                        last_activity_local = user.last_activity_date.astimezone(user_tz) if user.last_activity_date.tzinfo else user.last_activity_date.replace(tzinfo=ZoneInfo("UTC")).astimezone(user_tz)
                        if last_activity_local >= user_today_start:
                            continue  # Déjà actif aujourd'hui

                    # Vérifier qu'on n'a pas déjà envoyé de rappel dans l'heure
                    one_hour_ago = now_utc - timedelta(hours=1)
                    existing_query = select(func.count()).select_from(Notification).where(
                        and_(
                            Notification.user_id == user.id,
                            Notification.type == NotificationType.STREAK_REMINDER,
                            Notification.created_at >= one_hour_ago
                        )
                    )
                    existing = await db.scalar(existing_query)

                    if existing and existing > 0:
                        continue

                    # Obtenir la langue de l'utilisateur (normalisée via i18n)
                    user_lang = get_spark_language(user.language if hasattr(user, 'language') else "fr")

                    # Choisir le message approprié selon la langue
                    is_evening = target_hour >= 18
                    is_urgent = (24 - user_local_hour) <= 2  # < 2h avant minuit

                    if is_evening:
                        message = spark_messages.get_streak_reminder_19h(user_lang, user.current_streak, is_urgent)
                    else:
                        message = spark_messages.get_streak_reminder_14h(user_lang, user.current_streak)

                    title = spark_messages.get_streak_reminder_title(user_lang, is_evening, is_urgent)

                    # Déterminer la priorité
                    if user.current_streak >= 30:
                        priority = NotificationPriority.URGENT if is_evening else NotificationPriority.HIGH
                    elif user.current_streak >= 7:
                        priority = NotificationPriority.HIGH
                    else:
                        priority = NotificationPriority.NORMAL

                    notification = Notification(
                        user_id=user.id,
                        type=NotificationType.STREAK_REMINDER,
                        title=title,
                        message=message,
                        priority=priority,
                        action_url="/dashboard",
                        data=f'{{"current_streak": {user.current_streak}, "reminder_hour": {target_hour}}}'
                    )

                    db.add(notification)
                    notifications_sent += 1

                    # Envoyer email si série longue et rappel du soir
                    if is_evening and user.current_streak >= 7 and prefs and prefs.email_enabled:
                        from app.services.email_service import email_service
                        email_sent = await email_service.send_streak_reminder(
                            to_email=user.email,
                            username=user.username,
                            current_streak=user.current_streak
                        )
                        if email_sent:
                            emails_sent += 1

                except Exception as user_error:
                    logger.error(f"Error processing streak reminder for user {user.id}: {user_error}")
                    continue

            await db.commit()

            logger.info(f"Streak reminders: {notifications_sent} notifications, {emails_sent} emails")

            return {
                "success": True,
                "users_targeted": len(users),
                "notifications_sent": notifications_sent,
                "emails_sent": emails_sent,
                "executed_at": utc_now().isoformat()
            }

        except Exception as e:
            logger.error(f"Erreur streak reminders: {e}")
            return {"success": False, "error": str(e)}


# =============================================================================
# Rappels Calendrier Intelligents
# =============================================================================

@celery_app.task(base=NotificationTask, bind=True, name="notifications.send_calendar_reminders")
def send_calendar_reminders(self) -> Dict[str, Any]:
    """
    Envoie des rappels intelligents pour les événements du calendrier.
    Exécuté toutes les 5 minutes par Celery Beat.

    Système intelligent:
    - Adapté au fuseau horaire de l'utilisateur
    - Stratégies différentes selon le type d'événement:
      * Examen: 7j, 3j, 1j, 2h, 30min
      * Cours: 1j, 1h, 15min
      * Deadline: 3j, 1j, 3h
      * Session d'étude: 1h, 15min
    - Respecte les heures de silence (sauf urgents)
    - Envoie des emails pour les événements importants
    """
    return run_async(_send_calendar_reminders_async())


async def _send_calendar_reminders_async() -> Dict[str, Any]:
    """Version async des rappels calendrier avec système intelligent"""
    async_session = get_async_session()

    async with async_session() as db:
        try:
            from app.services.smart_reminder_service import smart_reminder_service

            # Utiliser le service de rappels intelligents
            results = await smart_reminder_service.run_reminder_check(db)

            logger.info(
                f"Smart calendar reminders: {results['events_checked']} events checked, "
                f"{results['reminders_sent']} reminders sent, {results['emails_sent']} emails sent"
            )

            return {
                "success": len(results.get("errors", [])) == 0,
                "events_checked": results["events_checked"],
                "notifications_sent": results["reminders_sent"],
                "emails_sent": results["emails_sent"],
                "errors": results.get("errors", []),
                "executed_at": utc_now().isoformat()
            }

        except Exception as e:
            logger.error(f"Erreur smart calendar reminders: {e}")
            return {"success": False, "error": str(e)}


# =============================================================================
# Rappels Flashcards (Spaced Repetition)
# =============================================================================

@celery_app.task(base=NotificationTask, bind=True, name="notifications.send_flashcard_reminders")
def send_flashcard_reminders(self) -> Dict[str, Any]:
    """
    Envoie des rappels pour les flashcards à réviser.
    Exécuté 1 fois par jour (9h) par Celery Beat.

    Cible les utilisateurs avec des flashcards dont next_review_date est passé.
    """
    return run_async(_send_flashcard_reminders_async())


async def _send_flashcard_reminders_async() -> Dict[str, Any]:
    """Version async des rappels flashcards"""
    async_session = get_async_session()

    async with async_session() as db:
        try:
            now = utc_now()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            notifications_sent = 0

            # Compter les flashcards à réviser par utilisateur
            # (flashcards avec next_review_date <= maintenant)
            query = select(
                Flashcard.user_id,
                func.count(Flashcard.id).label('count')
            ).where(
                and_(
                    Flashcard.next_review_date <= now,
                    Flashcard.is_active == True
                )
            ).group_by(Flashcard.user_id).having(func.count(Flashcard.id) >= 5)  # Au moins 5 cartes

            result = await db.execute(query)
            user_counts = result.all()

            for user_id, count in user_counts:
                # Vérifier qu'on n'a pas déjà envoyé de rappel aujourd'hui
                existing_query = select(func.count()).select_from(Notification).where(
                    and_(
                        Notification.user_id == user_id,
                        Notification.type == NotificationType.FLASHCARD_REVIEW,
                        Notification.created_at >= today_start
                    )
                )
                existing = await db.scalar(existing_query)

                if existing and existing > 0:
                    continue

                # Récupérer la langue de l'utilisateur
                from app.core.spark_translations import spark_messages, get_spark_language
                user_query = select(User).where(User.id == user_id)
                user_result = await db.execute(user_query)
                user_obj = user_result.scalar_one_or_none()
                user_lang = get_spark_language(user_obj.language if user_obj and hasattr(user_obj, 'language') else "fr")

                # Messages Spark multilingues pour les rappels flashcards
                message, title = spark_messages.get_flashcard_reminder(user_lang, count)

                notification = Notification(
                    user_id=user_id,
                    type=NotificationType.FLASHCARD_REVIEW,
                    title=title,
                    message=message,
                    priority=NotificationPriority.NORMAL,
                    action_url="/flashcards",
                    data=f'{{"cards_due": {count}}}'
                )

                db.add(notification)
                notifications_sent += 1

            await db.commit()

            logger.info(f"Flashcard reminders: {notifications_sent} notifications envoyées")

            return {
                "success": True,
                "users_targeted": len(user_counts),
                "notifications_sent": notifications_sent,
                "executed_at": utc_now().isoformat()
            }

        except Exception as e:
            logger.error(f"Erreur flashcard reminders: {e}")
            return {"success": False, "error": str(e)}


# =============================================================================
# Détection Streak Perdu
# =============================================================================

@celery_app.task(base=NotificationTask, bind=True, name="notifications.check_lost_streaks")
def check_lost_streaks(self) -> Dict[str, Any]:
    """
    Vérifie les streaks perdus et notifie les utilisateurs.
    Exécuté 1 fois par jour à minuit par Celery Beat.
    """
    return run_async(_check_lost_streaks_async())


async def _check_lost_streaks_async() -> Dict[str, Any]:
    """Version async de la vérification des streaks perdus"""
    async_session = get_async_session()

    async with async_session() as db:
        try:
            yesterday_start = (utc_now() - timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            yesterday_end = yesterday_start + timedelta(days=1)
            notifications_sent = 0
            streaks_lost = 0

            # Utilisateurs avec streak > 0 et aucune activité hier
            # Note: current_streak et last_activity_date sont dans UserGamification
            query = (
                select(User)
                .join(UserGamification, User.id == UserGamification.user_id)
                .options(selectinload(User.gamification), selectinload(User.preferences))
                .where(
                    and_(
                        User.is_active == True,
                        UserGamification.current_streak > 0,
                        or_(
                            UserGamification.last_activity_date.is_(None),
                            UserGamification.last_activity_date < yesterday_start
                        )
                    )
                )
            )

            result = await db.execute(query)
            users = result.scalars().all()

            for user in users:
                old_streak = user.gamification.current_streak

                # Réinitialiser le streak
                user.gamification.current_streak = 0

                # Notifier seulement si la série était significative (>= 3 jours)
                if old_streak >= 3:
                    # Obtenir la langue de l'utilisateur
                    from app.core.spark_translations import spark_messages, get_spark_language
                    user_lang = get_spark_language(user.language if hasattr(user, 'language') else "fr")

                    # Messages Spark multilingues selon la longueur de la série perdue
                    message, title = spark_messages.get_streak_lost_message(user_lang, old_streak)

                    notification = Notification(
                        user_id=user.id,
                        type=NotificationType.STREAK_LOST,
                        title=title,
                        message=message,
                        priority=NotificationPriority.HIGH,
                        action_url="/dashboard",
                        data=f'{{"lost_streak": {old_streak}}}'
                    )

                    db.add(notification)
                    notifications_sent += 1

                streaks_lost += 1

            await db.commit()

            logger.info(f"Lost streaks: {streaks_lost} streaks réinitialisés, {notifications_sent} notifications")

            return {
                "success": True,
                "streaks_lost": streaks_lost,
                "notifications_sent": notifications_sent,
                "executed_at": utc_now().isoformat()
            }

        except Exception as e:
            logger.error(f"Erreur check lost streaks: {e}")
            return {"success": False, "error": str(e)}


# =============================================================================
# Rappels d'inactivité (réengagement par email)
# =============================================================================

@celery_app.task(base=NotificationTask, bind=True, name="notifications.send_inactivity_reminders")
def send_inactivity_reminders(self) -> Dict[str, Any]:
    """
    Envoie des emails de réengagement aux utilisateurs inactifs.
    Exécuté 1 fois par jour par Celery Beat.

    Stratégie progressive:
    - 3 jours d'absence → notification in-app + email
    - 7 jours → email "tu nous manques"
    - 14 jours → email "tes amis progressent"
    - 30 jours → email "il n'est jamais trop tard"

    Ne re-envoie pas si un rappel du même palier a déjà été envoyé.
    """
    return run_async(_send_inactivity_reminders_async())


async def _send_inactivity_reminders_async() -> Dict[str, Any]:
    """Version async des rappels d'inactivité"""
    async_session = get_async_session()

    async with async_session() as db:
        try:
            from app.core.spark_translations import spark_messages, get_spark_language
            from app.services.email_service import email_service

            now = utc_now()
            notifications_sent = 0
            emails_sent = 0

            # Paliers d'inactivité (en jours)
            inactivity_thresholds = [3, 7, 14, 30]

            for days in inactivity_thresholds:
                threshold_date = now - timedelta(days=days)
                # Fenêtre de 24h pour ce palier (ne pas re-attraper les jours suivants)
                window_start = threshold_date - timedelta(hours=12)
                window_end = threshold_date + timedelta(hours=12)

                # Utilisateurs dont la dernière activité tombe dans cette fenêtre
                query = (
                    select(User)
                    .join(UserGamification, User.id == UserGamification.user_id)
                    .outerjoin(UserPreferences, User.id == UserPreferences.user_id)
                    .options(
                        selectinload(User.gamification),
                        selectinload(User.preferences),
                        selectinload(User.profile),
                    )
                    .where(
                        and_(
                            User.is_active == True,
                            UserGamification.last_activity_date.isnot(None),
                            UserGamification.last_activity_date >= window_start,
                            UserGamification.last_activity_date < window_end,
                            # Ne pas envoyer si notifications désactivées
                            or_(
                                UserPreferences.notifications_enabled == True,
                                UserPreferences.id == None
                            ),
                        )
                    )
                )

                result = await db.execute(query)
                users = result.scalars().all()

                for user in users:
                    try:
                        # Vérifier qu'on n'a pas déjà envoyé ce palier
                        check_window = now - timedelta(days=days)  # Ne pas renvoyer le même palier
                        existing_query = select(func.count()).select_from(Notification).where(
                            and_(
                                Notification.user_id == user.id,
                                Notification.type == NotificationType.INACTIVITY_REMINDER,
                                Notification.created_at >= check_window,
                                Notification.data.contains(f'"days": {days}')
                            )
                        )
                        existing = await db.scalar(existing_query)
                        if existing and existing > 0:
                            continue

                        # Obtenir les messages traduits
                        user_lang = get_spark_language(user.language if hasattr(user, 'language') else "fr")
                        reminder_data = spark_messages.get_inactivity_reminder(user_lang, days)

                        # Créer notification in-app
                        notification = Notification(
                            user_id=user.id,
                            type=NotificationType.INACTIVITY_REMINDER,
                            title=reminder_data["title"],
                            message=reminder_data["message"],
                            priority=NotificationPriority.HIGH,
                            action_url="/dashboard",
                            data=f'{{"days": {days}, "old_streak": {user.gamification.longest_streak or 0}}}'
                        )
                        db.add(notification)
                        notifications_sent += 1

                        # Envoyer email (sauf pour 3 jours si pas de préf email)
                        should_email = True
                        if user.preferences and not user.preferences.email_notifications:
                            should_email = False

                        if should_email and email_service.enabled:
                            email_sent = await email_service.send_inactivity_reminder(
                                to_email=user.email,
                                username=user.username,
                                days_absent=days,
                                old_streak=user.gamification.longest_streak or 0,
                                email_subject=reminder_data.get("email_subject", "Tu nous manques sur Studera !")
                            )
                            if email_sent:
                                emails_sent += 1

                    except Exception as user_error:
                        logger.error(f"Error sending inactivity reminder for user {user.id}: {user_error}")
                        continue

            await db.commit()

            logger.info(f"Inactivity reminders: {notifications_sent} notifications, {emails_sent} emails")

            return {
                "success": True,
                "notifications_sent": notifications_sent,
                "emails_sent": emails_sent,
                "executed_at": now.isoformat()
            }

        except Exception as e:
            logger.error(f"Erreur inactivity reminders: {e}")
            return {"success": False, "error": str(e)}


# =============================================================================
# Milestone de Streak
# =============================================================================

@celery_app.task(base=NotificationTask, bind=True, name="notifications.check_streak_milestones")
def check_streak_milestones(self, user_id: int, new_streak: int) -> Dict[str, Any]:
    """
    Vérifie et notifie les milestones de streak.
    Appelé après chaque activité qui incrémente le streak.

    Milestones: 7, 14, 30, 60, 100, 365 jours
    """
    return run_async(_check_streak_milestones_async(user_id, new_streak))


async def _check_streak_milestones_async(user_id: int, new_streak: int) -> Dict[str, Any]:
    """Version async de la vérification des milestones"""
    milestones = [7, 14, 30, 60, 100, 365]

    if new_streak not in milestones:
        return {"success": True, "milestone": False}

    async_session = get_async_session()

    async with async_session() as db:
        try:
            # Récupérer la langue de l'utilisateur
            from app.core.spark_translations import spark_messages, get_spark_language
            user_query = select(User).where(User.id == user_id)
            user_result = await db.execute(user_query)
            user_obj = user_result.scalar_one_or_none()
            user_lang = get_spark_language(user_obj.language if user_obj and hasattr(user_obj, 'language') else "fr")

            # Messages Spark multilingues pour les milestones
            message, title = spark_messages.get_streak_milestone(user_lang, new_streak)

            notification = Notification(
                user_id=user_id,
                type=NotificationType.STREAK_MILESTONE,
                title=title,
                message=message,
                priority=NotificationPriority.HIGH,
                action_url="/achievements",
                data=f'{{"streak": {new_streak}}}'
            )

            db.add(notification)
            await db.commit()

            logger.info(f"Streak milestone: user {user_id} a atteint {new_streak} jours")

            return {
                "success": True,
                "milestone": True,
                "streak": new_streak
            }

        except Exception as e:
            logger.error(f"Erreur streak milestone: {e}")
            return {"success": False, "error": str(e)}


# =============================================================================
# Nettoyage des anciennes notifications
# =============================================================================

@celery_app.task(base=NotificationTask, bind=True, name="notifications.cleanup_old_notifications")
def cleanup_old_notifications(self, days: int = 30) -> Dict[str, Any]:
    """
    Supprime les anciennes notifications lues.
    Exécuté 1 fois par jour par Celery Beat.
    """
    return run_async(_cleanup_old_notifications_async(days))


async def _cleanup_old_notifications_async(days: int) -> Dict[str, Any]:
    """Version async du nettoyage"""
    async_session = get_async_session()

    async with async_session() as db:
        try:
            from sqlalchemy import delete

            cutoff_date = utc_now() - timedelta(days=days)

            # Supprimer les notifications lues de plus de X jours
            stmt = delete(Notification).where(
                and_(
                    Notification.is_read == True,
                    Notification.created_at < cutoff_date
                )
            )

            result = await db.execute(stmt)
            await db.commit()

            deleted_count = result.rowcount

            logger.info(f"Cleanup: {deleted_count} anciennes notifications supprimées")

            return {
                "success": True,
                "deleted_count": deleted_count,
                "cutoff_date": cutoff_date.isoformat(),
                "executed_at": utc_now().isoformat()
            }

        except Exception as e:
            logger.error(f"Erreur cleanup notifications: {e}")
            return {"success": False, "error": str(e)}


# =============================================================================
# Envoi d'emails digest
# =============================================================================

@celery_app.task(base=NotificationTask, bind=True, name="notifications.send_email_digest")
def send_email_digest(self) -> Dict[str, Any]:
    """
    Envoie un résumé quotidien par email aux utilisateurs qui l'ont activé.
    Exécuté 1 fois par jour à 18h par Celery Beat.
    """
    return run_async(_send_email_digest_async())


async def _send_email_digest_async() -> Dict[str, Any]:
    """Version async de l'envoi du digest email"""
    async_session = get_async_session()

    async with async_session() as db:
        try:
            from app.models.notification import NotificationPreference

            # Utilisateurs avec email_digest activé
            # Note: email_notifications est dans UserPreferences, pas User
            query = (
                select(User)
                .join(NotificationPreference)
                .outerjoin(UserPreferences, User.id == UserPreferences.user_id)
                .options(selectinload(User.gamification))
                .where(
                    and_(
                        User.is_active == True,
                        or_(
                            UserPreferences.email_notifications == True,
                            UserPreferences.id == None
                        ),
                        NotificationPreference.email_digest == True
                    )
                )
            )

            result = await db.execute(query)
            users = result.scalars().all()

            emails_sent = 0
            today_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)

            for user in users:
                # Récupérer les notifications non lues de la journée
                notif_query = select(Notification).where(
                    and_(
                        Notification.user_id == user.id,
                        Notification.is_read == False,
                        Notification.created_at >= today_start
                    )
                ).order_by(Notification.created_at.desc()).limit(10)

                notif_result = await db.execute(notif_query)
                notifications = notif_result.scalars().all()

                if not notifications:
                    continue

                # Envoyer l'email digest avec le service email
                from app.services.email_service import email_service

                # Préparer les données des notifications pour l'email
                notif_data = [
                    {
                        "title": n.title,
                        "message": n.message,
                        "type": n.type if hasattr(n, 'type') else "info"
                    }
                    for n in notifications
                ]

                # Préparer les stats (si disponibles)
                stats = {}
                if hasattr(user, 'gamification') and user.gamification:
                    stats = {
                        "streak": user.gamification.current_streak if hasattr(user.gamification, 'current_streak') else 0,
                        "xp_today": 0,  # À calculer si nécessaire
                        "cards_reviewed": 0
                    }

                # Envoyer l'email
                success = await email_service.send_daily_digest(
                    to_email=user.email,
                    username=user.username,
                    stats=stats,
                    notifications=notif_data
                )

                if success:
                    emails_sent += 1
                    logger.info(f"Email digest envoyé: user={user.id}, notifications={len(notifications)}")
                else:
                    logger.warning(f"Échec envoi email digest: user={user.id}")

            return {
                "success": True,
                "users_targeted": len(users),
                "emails_sent": emails_sent,
                "executed_at": utc_now().isoformat()
            }

        except Exception as e:
            logger.error(f"Erreur email digest: {e}")
            return {"success": False, "error": str(e)}
