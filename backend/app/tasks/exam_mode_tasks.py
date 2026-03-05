"""
Tâches Celery pour Exam Mode
- Rappels quotidiens de révision
- Alertes d'examens imminents
- Notifications de progression
- Mise à jour des prédictions
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, date
from typing import Dict, Any, List

from celery import Task
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, selectinload

from app.celery_app import celery_app
from app.core.config import settings
from app.core.datetime_utils import utc_now
from app.models.user import User
from app.models.notification import Notification, NotificationType, NotificationPriority
from app.models.exam_mode import (
    ExamSession,
    StudyDay,
    StudyTask,
    ExamModeNotification,
    ExamSessionStatus,
    StudyTaskStatus
)

logger = logging.getLogger(__name__)


# Singleton engine pour éviter les fuites de connexion
_engine = None
_async_session_factory = None


def get_async_session():
    """Crée une session async pour les tâches Celery (engine singleton)"""
    global _engine, _async_session_factory
    if _engine is None:
        _engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_size=5, max_overflow=10)
        _async_session_factory = sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)
    return _async_session_factory


def run_async(coro):
    """Helper pour exécuter une coroutine dans Celery"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


class ExamModeTask(Task):
    """Classe de base pour les tâches Exam Mode"""
    # Ne retry que sur les erreurs transitoires (réseau, DB), pas les erreurs logiques
    autoretry_for = (ConnectionError, TimeoutError, OSError)
    retry_kwargs = {"max_retries": 3}
    retry_backoff = True


# =============================================================================
# Messages de motivation personnalisés
# =============================================================================

MOTIVATION_MESSAGES = {
    "morning": [
        "Bonjour ! Ton examen {exam_name} approche. Prêt pour ta session d'étude ?",
        "C'est le moment de réviser ! {days_left} jours avant {exam_name}.",
        "Chaque minute compte ! Commence ta journée avec tes révisions pour {exam_name}.",
    ],
    "afternoon": [
        "N'oublie pas tes révisions pour {exam_name} !",
        "Tu as {tasks_remaining} tâches à faire aujourd'hui pour {exam_name}.",
        "Continue sur ta lancée ! Tu peux encore compléter tes objectifs du jour.",
    ],
    "evening": [
        "Dernière chance aujourd'hui ! {tasks_remaining} tâches restantes pour {exam_name}.",
        "Une petite session ce soir pour {exam_name} ? Tu es à {progress}% de ton objectif !",
        "Ne perds pas ta série ! Finis au moins une tâche pour {exam_name}.",
    ],
    "urgent": [
        "URGENT: Plus que {days_left} jours avant {exam_name} ! Intensifie tes révisions !",
        "Examen {exam_name} dans {days_left} jours ! Tu es à {progress}% de ta préparation.",
        "C'est le moment de tout donner ! {exam_name} arrive bientôt !",
    ],
    "encouragement": [
        "Bravo ! Tu as déjà complété {completed_tasks} tâches pour {exam_name} !",
        "Tu es sur la bonne voie ! Continue comme ça pour {exam_name} !",
        "Ta prédiction de réussite est de {predicted_score}% pour {exam_name} !",
    ]
}


def get_motivation_message(message_type: str, **kwargs) -> str:
    """Génère un message de motivation personnalisé"""
    import random
    messages = MOTIVATION_MESSAGES.get(message_type, MOTIVATION_MESSAGES["encouragement"])
    message = random.choice(messages)
    return message.format(**kwargs)


# =============================================================================
# Rappels quotidiens Exam Mode
# =============================================================================

@celery_app.task(base=ExamModeTask, bind=True, name="exam_mode.send_daily_reminders")
def send_daily_reminders(self) -> Dict[str, Any]:
    """
    Envoie des rappels quotidiens pour les sessions d'examen actives.
    Exécuté toutes les heures par Celery Beat.

    Respecte le fuseau horaire et l'heure de rappel configurée.
    """
    return run_async(_send_daily_reminders_async())


async def _send_daily_reminders_async() -> Dict[str, Any]:
    """Version async des rappels quotidiens"""
    from zoneinfo import ZoneInfo

    async_session = get_async_session()
    notifications_sent = 0

    async with async_session() as db:
        try:
            now_utc = utc_now()
            today = now_utc.date()

            # Récupérer les sessions actives avec notifications activées
            query = (
                select(ExamSession)
                .options(
                    selectinload(ExamSession.user),
                    selectinload(ExamSession.study_days).selectinload(StudyDay.tasks)
                )
                .where(
                    and_(
                        ExamSession.status == ExamSessionStatus.ACTIVE.value,
                        ExamSession.notifications_enabled == True
                    )
                )
            )

            result = await db.execute(query)
            sessions = result.scalars().all()

            for session in sessions:
                user = session.user
                if not user or not user.is_active:
                    continue

                # Déterminer le fuseau horaire de l'utilisateur
                try:
                    user_tz = ZoneInfo(user.timezone or "UTC")
                except Exception:
                    user_tz = ZoneInfo("UTC")

                # Heure locale de l'utilisateur
                user_local_time = now_utc.astimezone(user_tz)
                user_hour = user_local_time.hour
                user_local_date = user_local_time.date()

                # Heure de rappel configurée (format "HH:MM")
                try:
                    reminder_hour = int(session.reminder_time.split(":")[0])
                except Exception:
                    reminder_hour = 9

                # Vérifier si c'est l'heure du rappel (avec marge de 30 min)
                if not (reminder_hour <= user_hour < reminder_hour + 1):
                    continue

                # Vérifier qu'on n'a pas déjà envoyé un rappel aujourd'hui
                # Utiliser la date locale de l'utilisateur pour éviter les doublons cross-timezone
                existing_notification = await db.execute(
                    select(ExamModeNotification).where(
                        and_(
                            ExamModeNotification.exam_session_id == session.id,
                            ExamModeNotification.user_id == user.id,
                            ExamModeNotification.notification_type == "daily_reminder",
                            func.date(ExamModeNotification.created_at) == user_local_date
                        )
                    )
                )
                if existing_notification.scalar_one_or_none():
                    continue

                # Calculer les statistiques du jour
                today_day = None
                tasks_remaining = 0
                for day in session.study_days:
                    if day.study_date == user_local_date:
                        today_day = day
                        tasks_remaining = sum(
                            1 for t in day.tasks
                            if t.status not in [StudyTaskStatus.COMPLETED, StudyTaskStatus.SKIPPED]
                        )
                        break

                if not today_day or tasks_remaining == 0:
                    continue

                # Déterminer le type de message
                days_left = max(0, (session.exam_date - user_local_date).days)
                if days_left <= 3:
                    message_type = "urgent"
                elif user_hour < 12:
                    message_type = "morning"
                elif user_hour < 18:
                    message_type = "afternoon"
                else:
                    message_type = "evening"

                # Générer le message
                message = get_motivation_message(
                    message_type,
                    exam_name=session.exam_name,
                    days_left=days_left,
                    tasks_remaining=tasks_remaining,
                    progress=int(session.progress_percentage),
                    completed_tasks=session.tasks_completed,
                    predicted_score=int(session.predicted_score or 0)
                )

                # Créer la notification Exam Mode (avec user_id)
                exam_notification = ExamModeNotification(
                    user_id=user.id,
                    exam_session_id=session.id,
                    notification_type="daily_reminder",
                    title=f"Révisions du jour - {session.exam_name}",
                    message=message,
                    is_read=False
                )
                db.add(exam_notification)

                # Créer aussi une notification générale
                general_notification = Notification(
                    user_id=user.id,
                    type=NotificationType.EXAM_REMINDER,
                    title=f"📚 {session.exam_name}",
                    message=message,
                    priority=NotificationPriority.HIGH if days_left <= 3 else NotificationPriority.NORMAL,
                    data=json.dumps({
                        "exam_session_id": session.id,
                        "days_left": days_left,
                        "tasks_remaining": tasks_remaining
                    })
                )
                db.add(general_notification)

                notifications_sent += 1

            await db.commit()

            logger.info(f"Exam Mode: {notifications_sent} rappels quotidiens envoyés")
            return {
                "success": True,
                "notifications_sent": notifications_sent
            }

        except Exception as e:
            logger.error(f"Erreur rappels Exam Mode: {e}")
            await db.rollback()
            raise


# =============================================================================
# Alertes d'examens imminents
# =============================================================================

@celery_app.task(base=ExamModeTask, bind=True, name="exam_mode.send_exam_alerts")
def send_exam_alerts(self) -> Dict[str, Any]:
    """
    Envoie des alertes pour les examens imminents.
    - 7 jours avant: alerte de préparation
    - 3 jours avant: alerte urgente
    - 1 jour avant: alerte finale
    - Le jour J: message de bonne chance
    """
    return run_async(_send_exam_alerts_async())


async def _send_exam_alerts_async() -> Dict[str, Any]:
    """Version async des alertes d'examens"""
    from zoneinfo import ZoneInfo

    async_session = get_async_session()
    alerts_sent = 0

    async with async_session() as db:
        try:
            now_utc = utc_now()
            today = now_utc.date()
            alert_days = [7, 3, 1, 0]  # Jours avant l'examen

            for days_before in alert_days:
                target_date = today + timedelta(days=days_before)

                # Trouver les examens à cette date
                query = (
                    select(ExamSession)
                    .options(selectinload(ExamSession.user))
                    .where(
                        and_(
                            ExamSession.exam_date == target_date,
                            ExamSession.status.in_([
                                ExamSessionStatus.ACTIVE.value,
                                ExamSessionStatus.PLANNING.value
                            ]),
                            ExamSession.notifications_enabled == True
                        )
                    )
                )

                result = await db.execute(query)
                sessions = result.scalars().all()

                for session in sessions:
                    user = session.user
                    if not user or not user.is_active:
                        continue

                    # Vérifier l'heure locale de l'utilisateur (ne pas envoyer la nuit)
                    try:
                        user_tz = ZoneInfo(user.timezone or "UTC")
                    except Exception:
                        user_tz = ZoneInfo("UTC")
                    user_local_time = now_utc.astimezone(user_tz)
                    user_hour = user_local_time.hour
                    # Ne pas envoyer entre 22h et 7h
                    if user_hour >= 22 or user_hour < 7:
                        continue

                    # Déterminer le type d'alerte
                    if days_before == 0:
                        notification_type = "exam_day"
                        title = f"🎯 C'est le jour J - {session.exam_name}"
                        message = f"Bonne chance pour ton examen ! Tu es prêt à {int(session.predicted_score or 0)}% selon nos prédictions. Tu vas y arriver !"
                        priority = NotificationPriority.URGENT
                    elif days_before == 1:
                        notification_type = "exam_tomorrow"
                        title = f"⚡ Demain: {session.exam_name}"
                        message = f"Ton examen est demain ! Fais une dernière révision des points clés et repose-toi bien ce soir."
                        priority = NotificationPriority.URGENT
                    elif days_before == 3:
                        notification_type = "exam_3_days"
                        title = f"🔥 J-3: {session.exam_name}"
                        message = f"Plus que 3 jours ! Tu es à {int(session.progress_percentage)}% de ta préparation. Concentre-toi sur tes points faibles."
                        priority = NotificationPriority.HIGH
                    else:  # 7 jours
                        notification_type = "exam_week"
                        title = f"📅 J-7: {session.exam_name}"
                        message = f"Une semaine avant ton examen ! Continue tes révisions régulièrement."
                        priority = NotificationPriority.NORMAL

                    # Vérifier qu'on n'a pas déjà envoyé cette alerte
                    existing = await db.execute(
                        select(ExamModeNotification).where(
                            and_(
                                ExamModeNotification.exam_session_id == session.id,
                                ExamModeNotification.user_id == user.id,
                                ExamModeNotification.notification_type == notification_type
                            )
                        )
                    )
                    if existing.scalar_one_or_none():
                        continue

                    # Créer les notifications (avec user_id)
                    exam_notification = ExamModeNotification(
                        user_id=user.id,
                        exam_session_id=session.id,
                        notification_type=notification_type,
                        title=title,
                        message=message,
                        is_read=False
                    )
                    db.add(exam_notification)

                    general_notification = Notification(
                        user_id=user.id,
                        type=NotificationType.EXAM_REMINDER,
                        title=title,
                        message=message,
                        priority=priority,
                        data=json.dumps({
                            "exam_session_id": session.id,
                            "days_until_exam": days_before
                        })
                    )
                    db.add(general_notification)

                    alerts_sent += 1

            await db.commit()

            logger.info(f"Exam Mode: {alerts_sent} alertes d'examens envoyées")
            return {
                "success": True,
                "alerts_sent": alerts_sent
            }

        except Exception as e:
            logger.error(f"Erreur alertes Exam Mode: {e}")
            await db.rollback()
            raise


# =============================================================================
# Mise à jour des prédictions
# =============================================================================

@celery_app.task(base=ExamModeTask, bind=True, name="exam_mode.update_predictions")
def update_predictions(self) -> Dict[str, Any]:
    """
    Met à jour les prédictions de réussite pour toutes les sessions actives.
    Exécuté toutes les 6 heures.
    """
    return run_async(_update_predictions_async())


async def _update_predictions_async() -> Dict[str, Any]:
    """Version async de la mise à jour des prédictions"""
    async_session = get_async_session()
    updated_count = 0

    async with async_session() as db:
        try:
            query = (
                select(ExamSession)
                .options(
                    selectinload(ExamSession.study_days).selectinload(StudyDay.tasks)
                )
                .where(ExamSession.status == ExamSessionStatus.ACTIVE.value)
            )

            result = await db.execute(query)
            sessions = result.scalars().all()

            for session in sessions:
                # Calculer la nouvelle prédiction
                total_tasks = 0
                completed_tasks = 0
                total_score = 0
                scored_tasks = 0

                for day in session.study_days:
                    for task in day.tasks:
                        total_tasks += 1
                        if task.status == StudyTaskStatus.COMPLETED:
                            completed_tasks += 1
                            if task.achieved_score is not None:
                                total_score += task.achieved_score
                                scored_tasks += 1

                # Calculer le score moyen
                avg_score = total_score / scored_tasks if scored_tasks > 0 else 50

                # Calculer le taux de complétion
                completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0

                # Jours restants — clamper pour éviter les négatifs
                days_left = max(0, (session.exam_date - utc_now().date()).days)
                total_days = max(1, session.total_days)
                elapsed = total_days - days_left
                time_factor = min(100, (elapsed / total_days) * 100)

                # Prédiction pondérée — formule alignée avec le service
                progress_factor = completion_rate  # déjà en 0-100
                # Régularité simple basée sur complétion vs temps écoulé
                expected_completion = (elapsed / total_days) * 100 if total_days > 0 else 0
                regularity = min(100, (completion_rate / max(1, expected_completion)) * 100) if expected_completion > 0 else 70

                predicted_score = (
                    progress_factor * 0.4 +
                    avg_score * 0.3 +
                    regularity * 0.2 +
                    time_factor * 0.1
                )

                # Confiance basée sur le nombre de tâches complétées
                confidence = min(90, completed_tasks * 5 + 20)

                # Mettre à jour
                session.predicted_score = round(min(100, max(0, predicted_score)), 1)
                session.confidence_level = round(confidence, 1)
                session.progress_percentage = round(completion_rate, 1)
                session.tasks_completed = completed_tasks
                session.tasks_total = total_tasks

                updated_count += 1

            await db.commit()

            logger.info(f"Exam Mode: {updated_count} prédictions mises à jour")
            return {
                "success": True,
                "updated_count": updated_count
            }

        except Exception as e:
            logger.error(f"Erreur mise à jour prédictions: {e}")
            await db.rollback()
            raise


# =============================================================================
# Nettoyage des sessions expirées
# =============================================================================

@celery_app.task(base=ExamModeTask, bind=True, name="exam_mode.cleanup_expired_sessions")
def cleanup_expired_sessions(self) -> Dict[str, Any]:
    """
    Marque les sessions dont l'examen est passé.
    - Sessions ACTIVE avec progression → COMPLETED
    - Sessions PLANNING/PAUSED sans progression → ABANDONED
    Exécuté une fois par jour.
    """
    return run_async(_cleanup_expired_sessions_async())


async def _cleanup_expired_sessions_async() -> Dict[str, Any]:
    """Version async du nettoyage"""
    async_session = get_async_session()
    cleaned_count = 0

    async with async_session() as db:
        try:
            today = utc_now().date()

            # Trouver les sessions dont l'examen est passé
            query = (
                select(ExamSession)
                .where(
                    and_(
                        ExamSession.exam_date < today,
                        ExamSession.status.in_([
                            ExamSessionStatus.ACTIVE.value,
                            ExamSessionStatus.PLANNING.value,
                            ExamSessionStatus.PAUSED.value
                        ])
                    )
                )
            )

            result = await db.execute(query)
            sessions = result.scalars().all()

            for session in sessions:
                now = utc_now()
                # Sessions actives avec progression → COMPLETED
                if session.status == ExamSessionStatus.ACTIVE and session.tasks_completed > 0:
                    session.status = ExamSessionStatus.COMPLETED
                    session.completed_at = now
                else:
                    # Sessions sans progression ou en planning/paused → ABANDONED
                    session.status = ExamSessionStatus.ABANDONED
                    session.completed_at = now
                cleaned_count += 1

            await db.commit()

            logger.info(f"Exam Mode: {cleaned_count} sessions expirées nettoyées")
            return {
                "success": True,
                "cleaned_count": cleaned_count
            }

        except Exception as e:
            logger.error(f"Erreur nettoyage sessions: {e}")
            await db.rollback()
            raise


# =============================================================================
# Notifications de progression
# =============================================================================

@celery_app.task(base=ExamModeTask, bind=True, name="exam_mode.send_progress_notifications")
def send_progress_notifications(self) -> Dict[str, Any]:
    """
    Envoie des notifications de progression (milestones).
    - 25%, 50%, 75%, 100% de progression
    - Série de jours consécutifs (3, 7, 14, 30 jours)
    """
    return run_async(_send_progress_notifications_async())


async def _send_progress_notifications_async() -> Dict[str, Any]:
    """Version async des notifications de progression"""
    async_session = get_async_session()
    notifications_sent = 0

    async with async_session() as db:
        try:
            query = (
                select(ExamSession)
                .options(selectinload(ExamSession.user))
                .where(ExamSession.status == ExamSessionStatus.ACTIVE.value)
            )

            result = await db.execute(query)
            sessions = result.scalars().all()

            milestones = [25, 50, 75, 100]

            for session in sessions:
                user = session.user
                if not user or not user.is_active:
                    continue

                progress = session.progress_percentage

                # Trouver le plus haut milestone atteint qui n'a pas encore été notifié
                highest_unnotified = None
                for milestone in milestones:
                    if progress >= milestone:
                        notification_type = f"progress_{milestone}"

                        # Vérifier si déjà notifié
                        existing = await db.execute(
                            select(ExamModeNotification).where(
                                and_(
                                    ExamModeNotification.exam_session_id == session.id,
                                    ExamModeNotification.user_id == user.id,
                                    ExamModeNotification.notification_type == notification_type
                                )
                            )
                        )
                        if not existing.scalar_one_or_none():
                            highest_unnotified = milestone

                # Envoyer uniquement le plus haut milestone non notifié (éviter le flooding)
                if highest_unnotified is not None:
                    milestone = highest_unnotified
                    notification_type = f"progress_{milestone}"

                    # Messages selon le milestone
                    if milestone == 25:
                        title = f"🌱 25% - Bon début !"
                        message = f"Tu as complété 25% de ta préparation pour {session.exam_name}. Continue !"
                    elif milestone == 50:
                        title = f"⭐ 50% - À mi-chemin !"
                        message = f"Bravo ! Tu es à mi-chemin de ta préparation pour {session.exam_name} !"
                    elif milestone == 75:
                        title = f"🔥 75% - Presque fini !"
                        message = f"Excellent ! Plus que 25% et tu seras prêt pour {session.exam_name} !"
                    else:
                        title = f"🏆 100% - Préparation complète !"
                        message = f"Félicitations ! Tu as terminé toute ta préparation pour {session.exam_name} !"

                    # Créer les notifications (avec user_id)
                    exam_notification = ExamModeNotification(
                        user_id=user.id,
                        exam_session_id=session.id,
                        notification_type=notification_type,
                        title=title,
                        message=message,
                        is_read=False
                    )
                    db.add(exam_notification)

                    # Marquer aussi les milestones inférieurs comme notifiés pour éviter
                    # qu'ils soient envoyés plus tard
                    for lower_milestone in milestones:
                        if lower_milestone < milestone:
                            lower_type = f"progress_{lower_milestone}"
                            lower_existing = await db.execute(
                                select(ExamModeNotification).where(
                                    and_(
                                        ExamModeNotification.exam_session_id == session.id,
                                        ExamModeNotification.user_id == user.id,
                                        ExamModeNotification.notification_type == lower_type
                                    )
                                )
                            )
                            if not lower_existing.scalar_one_or_none():
                                skip_notification = ExamModeNotification(
                                    user_id=user.id,
                                    exam_session_id=session.id,
                                    notification_type=lower_type,
                                    title=f"Milestone {lower_milestone}%",
                                    message=f"Milestone {lower_milestone}% atteint (notification groupée)",
                                    is_read=True,
                                    is_sent=True
                                )
                                db.add(skip_notification)

                    general_notification = Notification(
                        user_id=user.id,
                        type=NotificationType.ACHIEVEMENT_UNLOCKED,
                        title=title,
                        message=message,
                        priority=NotificationPriority.NORMAL,
                        data=json.dumps({
                            "exam_session_id": session.id,
                            "milestone": milestone
                        })
                    )
                    db.add(general_notification)

                    notifications_sent += 1

            await db.commit()

            logger.info(f"Exam Mode: {notifications_sent} notifications de progression envoyées")
            return {
                "success": True,
                "notifications_sent": notifications_sent
            }

        except Exception as e:
            logger.error(f"Erreur notifications progression: {e}")
            await db.rollback()
            raise
