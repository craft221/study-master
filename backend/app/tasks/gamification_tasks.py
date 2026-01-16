"""
Tâches asynchrones pour la gamification
"""
from celery import Task
from app.celery_app import celery_app
from typing import Dict, Any, List
from datetime import datetime, timedelta
from sqlalchemy import select, update, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
import logging

from app.core.database import async_session_maker
from app.core.datetime_utils import utc_now, utc_date
from app.models.user import User, UserGamification, UserStats, UserAIUsage
from app.models.study_session import StudySession
from app.models.focus_room import FocusRoom
from app.services.cache_service import cache_service
from app.services.xp_service import calculate_level, get_level_progress
from app.services.leaderboard_service import leaderboard_service
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)


class GamificationTask(Task):
    """Classe de base pour les tâches de gamification"""
    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 2}
    retry_backoff = True


def run_async(coro):
    """Helper pour exécuter des coroutines dans Celery"""
    loop = asyncio.get_event_loop()
    if loop.is_running():
        # Si une loop tourne déjà, créer une nouvelle
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


@celery_app.task(base=GamificationTask, bind=True, name="app.tasks.gamification_tasks.reset_daily_ai_requests")
def reset_daily_ai_requests(self) -> Dict[str, Any]:
    """
    Réinitialise le compteur de requêtes IA quotidiennes
    Exécuté chaque jour à minuit par Celery Beat

    Returns:
        Dict avec les statistiques
    """
    async def _reset():
        async with async_session_maker() as db:
            try:
                # Réinitialiser tous les compteurs journaliers
                result = await db.execute(
                    update(UserAIUsage)
                    .values(
                        requests_today=0,
                        requests_reset_date=utc_now()
                    )
                )
                await db.commit()

                users_reset = result.rowcount
                logger.info(f"Réinitialisation des requêtes IA: {users_reset} utilisateurs")

                return users_reset
            except Exception as e:
                await db.rollback()
                raise e

    try:
        users_reset = run_async(_reset())

        return {
            "success": True,
            "users_reset": users_reset,
            "task_id": self.request.id,
            "executed_at": utc_now().isoformat()
        }

    except Exception as e:
        logger.error(f"Erreur reset_daily_ai_requests: {e}")
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }


@celery_app.task(base=GamificationTask, bind=True, name="app.tasks.gamification_tasks.calculate_leaderboards")
def calculate_leaderboards(self) -> Dict[str, Any]:
    """
    Recalcule tous les classements
    Exécuté toutes les heures par Celery Beat

    Returns:
        Dict avec les statistiques
    """
    async def _calculate():
        async with async_session_maker() as db:
            leaderboards = {}

            # 1. Classement global (XP total) - Top 100
            global_query = (
                select(
                    User.id,
                    User.username,
                    UserGamification.total_xp,
                    UserGamification.level
                )
                .join(UserGamification, User.id == UserGamification.user_id)
                .where(User.is_active == True)
                .order_by(UserGamification.total_xp.desc())
                .limit(100)
            )
            result = await db.execute(global_query)
            global_leaderboard = [
                {
                    "rank": idx + 1,
                    "user_id": row.id,
                    "username": row.username,
                    "total_xp": row.total_xp,
                    "level": row.level
                }
                for idx, row in enumerate(result.fetchall())
            ]
            leaderboards["global"] = global_leaderboard

            # 2. Classement hebdomadaire (XP gagné cette semaine)
            week_start = utc_now() - timedelta(days=utc_now().weekday())
            week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

            # Stocker dans le cache Redis
            await cache_service.set(
                "leaderboard:global",
                global_leaderboard,
                expire=3600  # 1 heure
            )

            # 3. Classement des streaks
            streak_query = (
                select(
                    User.id,
                    User.username,
                    UserGamification.current_streak,
                    UserGamification.longest_streak
                )
                .join(UserGamification, User.id == UserGamification.user_id)
                .where(and_(
                    User.is_active == True,
                    UserGamification.current_streak > 0
                ))
                .order_by(UserGamification.current_streak.desc())
                .limit(50)
            )
            result = await db.execute(streak_query)
            streak_leaderboard = [
                {
                    "rank": idx + 1,
                    "user_id": row.id,
                    "username": row.username,
                    "current_streak": row.current_streak,
                    "longest_streak": row.longest_streak
                }
                for idx, row in enumerate(result.fetchall())
            ]
            leaderboards["streaks"] = streak_leaderboard

            await cache_service.set(
                "leaderboard:streaks",
                streak_leaderboard,
                expire=3600
            )

            # 4. Classement des duels
            duel_query = (
                select(
                    User.id,
                    User.username,
                    UserStats.duels_won,
                    UserStats.total_duels_played
                )
                .join(UserStats, User.id == UserStats.user_id)
                .where(and_(
                    User.is_active == True,
                    UserStats.total_duels_played >= 5  # Minimum 5 duels
                ))
                .order_by(UserStats.duels_won.desc())
                .limit(50)
            )
            result = await db.execute(duel_query)
            duel_leaderboard = [
                {
                    "rank": idx + 1,
                    "user_id": row.id,
                    "username": row.username,
                    "duels_won": row.duels_won,
                    "total_duels": row.total_duels_played,
                    "win_rate": round(row.duels_won / row.total_duels_played * 100, 1) if row.total_duels_played > 0 else 0
                }
                for idx, row in enumerate(result.fetchall())
            ]
            leaderboards["duels"] = duel_leaderboard

            await cache_service.set(
                "leaderboard:duels",
                duel_leaderboard,
                expire=3600
            )

            return len(leaderboards), sum(len(lb) for lb in leaderboards.values())

    try:
        leaderboards_updated, total_entries = run_async(_calculate())

        return {
            "success": True,
            "leaderboards_updated": leaderboards_updated,
            "total_entries": total_entries,
            "task_id": self.request.id,
            "executed_at": utc_now().isoformat()
        }

    except Exception as e:
        logger.error(f"Erreur calculate_leaderboards: {e}")
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }


@celery_app.task(base=GamificationTask, bind=True, name="app.tasks.gamification_tasks.cleanup_expired_sessions")
def cleanup_expired_sessions(self) -> Dict[str, Any]:
    """
    Nettoie les sessions d'étude expirées
    Exécuté toutes les 2 heures par Celery Beat

    Returns:
        Dict avec les statistiques
    """
    async def _cleanup():
        async with async_session_maker() as db:
            try:
                # Définir le seuil d'expiration (24 heures)
                expiration_threshold = utc_now() - timedelta(hours=24)

                # Trouver les sessions expirées
                expired_query = (
                    select(StudySession)
                    .where(and_(
                        StudySession.status == "IN_PROGRESS",
                        StudySession.started_at < expiration_threshold
                    ))
                )
                result = await db.execute(expired_query)
                expired_sessions = result.scalars().all()

                sessions_cleaned = 0
                for session in expired_sessions:
                    # Marquer comme abandonnée
                    session.status = "ABANDONED"
                    session.ended_at = utc_now()
                    sessions_cleaned += 1

                await db.commit()

                logger.info(f"Sessions nettoyées: {sessions_cleaned}")
                return sessions_cleaned

            except Exception as e:
                await db.rollback()
                raise e

    try:
        sessions_cleaned = run_async(_cleanup())

        return {
            "success": True,
            "sessions_cleaned": sessions_cleaned,
            "task_id": self.request.id,
            "executed_at": utc_now().isoformat()
        }

    except Exception as e:
        logger.error(f"Erreur cleanup_expired_sessions: {e}")
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }


@celery_app.task(base=GamificationTask, bind=True, name="app.tasks.gamification_tasks.update_streaks")
def update_streaks(self) -> Dict[str, Any]:
    """
    Met à jour les streaks (séries) des utilisateurs
    Exécuté chaque jour à 00:05 par Celery Beat

    Returns:
        Dict avec les statistiques
    """
    async def _update():
        async with async_session_maker() as db:
            try:
                today = utc_now().date()
                yesterday = today - timedelta(days=1)

                # Récupérer tous les utilisateurs avec gamification
                query = (
                    select(UserGamification)
                    .join(User, User.id == UserGamification.user_id)
                    .where(User.is_active == True)
                )
                result = await db.execute(query)
                gamifications = result.scalars().all()

                streaks_updated = 0
                streaks_broken = 0

                for gam in gamifications:
                    last_activity = gam.last_activity_date.date() if gam.last_activity_date else None

                    if last_activity == today:
                        # Activité aujourd'hui - streak continue
                        streaks_updated += 1
                    elif last_activity == yesterday:
                        # Activité hier - on attend encore aujourd'hui
                        pass
                    elif gam.current_streak > 0:
                        # Pas d'activité hier ni aujourd'hui - streak cassé
                        gam.current_streak = 0
                        streaks_broken += 1

                await db.commit()

                logger.info(f"Streaks mis à jour: {streaks_updated}, cassés: {streaks_broken}")
                return streaks_updated, streaks_broken

            except Exception as e:
                await db.rollback()
                raise e

    try:
        streaks_updated, streaks_broken = run_async(_update())

        return {
            "success": True,
            "streaks_updated": streaks_updated,
            "streaks_broken": streaks_broken,
            "task_id": self.request.id,
            "executed_at": utc_now().isoformat()
        }

    except Exception as e:
        logger.error(f"Erreur update_streaks: {e}")
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }


@celery_app.task(base=GamificationTask, bind=True, name="app.tasks.gamification_tasks.check_achievements")
def check_achievements(self, user_id: int) -> Dict[str, Any]:
    """
    Vérifie et débloque les succès pour un utilisateur

    Args:
        user_id: ID de l'utilisateur

    Returns:
        Dict avec les succès débloqués
    """
    # Définition des achievements
    ACHIEVEMENTS = {
        "first_note": {
            "name": "Premier pas",
            "description": "Créer sa première note",
            "xp_reward": 10,
            "condition": lambda stats, gam: stats.total_notes_created >= 1
        },
        "note_master": {
            "name": "Maître des notes",
            "description": "Créer 50 notes",
            "xp_reward": 100,
            "condition": lambda stats, gam: stats.total_notes_created >= 50
        },
        "flashcard_beginner": {
            "name": "Apprenti flashcards",
            "description": "Créer 10 flashcards",
            "xp_reward": 20,
            "condition": lambda stats, gam: stats.total_flashcards_created >= 10
        },
        "flashcard_master": {
            "name": "Maître des flashcards",
            "description": "Créer 100 flashcards",
            "xp_reward": 150,
            "condition": lambda stats, gam: stats.total_flashcards_created >= 100
        },
        "quiz_taker": {
            "name": "Testeur",
            "description": "Compléter 10 quiz",
            "xp_reward": 50,
            "condition": lambda stats, gam: stats.total_quizzes_completed >= 10
        },
        "streak_3": {
            "name": "En série",
            "description": "Maintenir un streak de 3 jours",
            "xp_reward": 30,
            "condition": lambda stats, gam: gam.current_streak >= 3
        },
        "streak_7": {
            "name": "Une semaine !",
            "description": "Maintenir un streak de 7 jours",
            "xp_reward": 70,
            "condition": lambda stats, gam: gam.current_streak >= 7
        },
        "streak_30": {
            "name": "Un mois !",
            "description": "Maintenir un streak de 30 jours",
            "xp_reward": 300,
            "condition": lambda stats, gam: gam.longest_streak >= 30
        },
        "level_5": {
            "name": "Niveau 5",
            "description": "Atteindre le niveau 5",
            "xp_reward": 50,
            "condition": lambda stats, gam: gam.level >= 5
        },
        "level_10": {
            "name": "Niveau 10",
            "description": "Atteindre le niveau 10",
            "xp_reward": 100,
            "condition": lambda stats, gam: gam.level >= 10
        },
        "duel_winner": {
            "name": "Duelliste",
            "description": "Gagner 5 duels",
            "xp_reward": 50,
            "condition": lambda stats, gam: stats.duels_won >= 5
        },
        "duel_champion": {
            "name": "Champion de duel",
            "description": "Gagner 50 duels",
            "xp_reward": 200,
            "condition": lambda stats, gam: stats.duels_won >= 50
        },
        "study_1h": {
            "name": "Étudiant assidu",
            "description": "Étudier pendant 1 heure au total",
            "xp_reward": 20,
            "condition": lambda stats, gam: stats.total_study_time_minutes >= 60
        },
        "study_10h": {
            "name": "Étudiant dévoué",
            "description": "Étudier pendant 10 heures au total",
            "xp_reward": 100,
            "condition": lambda stats, gam: stats.total_study_time_minutes >= 600
        },
    }

    async def _check():
        async with async_session_maker() as db:
            try:
                # Récupérer les données de l'utilisateur
                gam_query = select(UserGamification).where(UserGamification.user_id == user_id)
                stats_query = select(UserStats).where(UserStats.user_id == user_id)

                gam_result = await db.execute(gam_query)
                stats_result = await db.execute(stats_query)

                gamification = gam_result.scalar_one_or_none()
                stats = stats_result.scalar_one_or_none()

                if not gamification or not stats:
                    return []

                new_achievements = []
                unlocked = gamification.unlocked_achievements or []
                total_achievement_xp = 0

                for achievement_id, achievement in ACHIEVEMENTS.items():
                    if achievement_id not in unlocked:
                        try:
                            if achievement["condition"](stats, gamification):
                                # Débloquer l'achievement
                                unlocked.append(achievement_id)
                                new_achievements.append({
                                    "id": achievement_id,
                                    "name": achievement["name"],
                                    "description": achievement["description"],
                                    "xp_reward": achievement["xp_reward"]
                                })

                                # Ajouter l'XP de récompense
                                gamification.total_xp += achievement["xp_reward"]
                                gamification.achievement_points += achievement["xp_reward"]
                                total_achievement_xp += achievement["xp_reward"]
                        except Exception:
                            pass  # Ignorer les erreurs de condition

                if new_achievements:
                    gamification.unlocked_achievements = unlocked

                    # Sauvegarder le niveau actuel pour détecter un level up
                    old_level = gamification.level

                    # Recalculer le niveau
                    gamification.level = gamification.calculate_level()
                    new_level = gamification.level

                    # Mettre à jour weekly_xp pour les ligues
                    if total_achievement_xp > 0:
                        await leaderboard_service.add_weekly_xp(db, user_id, total_achievement_xp)

                    await db.commit()

                    # Envoyer les notifications pour chaque achievement débloqué
                    for achievement in new_achievements:
                        await notification_service.notify_achievement_unlocked(
                            db=db,
                            user_id=user_id,
                            achievement_name=achievement["name"],
                            achievement_id=achievement["id"],
                            xp_reward=achievement["xp_reward"]
                        )

                    # Envoyer notification de level up si le niveau a changé
                    if new_level > old_level:
                        await notification_service.notify_level_up(
                            db=db,
                            user_id=user_id,
                            new_level=new_level
                        )

                    await db.commit()

                    logger.info(f"User {user_id}: {len(new_achievements)} nouveaux achievements (+{total_achievement_xp} weekly XP)")

                return new_achievements

            except Exception as e:
                await db.rollback()
                raise e

    try:
        new_achievements = run_async(_check())

        return {
            "success": True,
            "user_id": user_id,
            "new_achievements": new_achievements,
            "total_unlocked": len(new_achievements),
            "task_id": self.request.id
        }

    except Exception as e:
        logger.error(f"Erreur check_achievements: {e}")
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }


@celery_app.task(base=GamificationTask, bind=True, name="app.tasks.gamification_tasks.calculate_user_level")
def calculate_user_level_task(self, user_id: int, total_xp: int) -> Dict[str, Any]:
    """
    Calcule le niveau d'un utilisateur basé sur son XP
    Utilise la formule centralisée du service XP: 50 + (level * 25) par niveau

    Args:
        user_id: ID utilisateur
        total_xp: XP total

    Returns:
        Dict avec le niveau calculé
    """
    try:
        # Utiliser le service XP centralisé pour calculer le niveau
        level_info = get_level_progress(total_xp)
        level = level_info["level"]
        xp_progress = level_info["xp_progress"]
        xp_needed = level_info["xp_needed"]
        progress_percent = level_info["progress_percent"]

        return {
            "success": True,
            "user_id": user_id,
            "level": level,
            "total_xp": total_xp,
            "xp_for_next_level": level_info["xp_for_next_level"],
            "xp_needed": xp_needed,
            "xp_progress": xp_progress,
            "progress_percentage": progress_percent,
            "task_id": self.request.id
        }

    except Exception as e:
        logger.error(f"Erreur calculate_user_level: {e}")
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }


@celery_app.task(base=GamificationTask, bind=True, name="app.tasks.gamification_tasks.award_daily_bonus")
def award_daily_bonus(self, user_id: int) -> Dict[str, Any]:
    """
    Attribue le bonus quotidien de connexion

    Args:
        user_id: ID de l'utilisateur

    Returns:
        Dict avec les détails du bonus
    """
    async def _award():
        async with async_session_maker() as db:
            try:
                # Récupérer la gamification de l'utilisateur
                query = select(UserGamification).where(UserGamification.user_id == user_id)
                result = await db.execute(query)
                gamification = result.scalar_one_or_none()

                if not gamification:
                    return None

                today = utc_now().date()
                last_activity = gamification.last_activity_date.date() if gamification.last_activity_date else None

                # Vérifier si le bonus a déjà été donné aujourd'hui
                if last_activity == today:
                    return {"already_claimed": True}

                # Calculer le bonus basé sur le streak
                base_bonus = 10
                streak_multiplier = min(gamification.current_streak, 7)  # Max 7x
                bonus_xp = base_bonus + (streak_multiplier * 5)

                # Mettre à jour le streak
                if last_activity == today - timedelta(days=1):
                    gamification.current_streak += 1
                    if gamification.current_streak > gamification.longest_streak:
                        gamification.longest_streak = gamification.current_streak
                else:
                    gamification.current_streak = 1

                # Sauvegarder le niveau actuel pour détecter un level up
                old_level = gamification.level

                # Attribuer le bonus
                gamification.total_xp += bonus_xp
                gamification.last_activity_date = utc_now()
                gamification.level = gamification.calculate_level()
                new_level = gamification.level

                # Mettre à jour weekly_xp pour les ligues
                await leaderboard_service.add_weekly_xp(db, user_id, bonus_xp)

                await db.commit()

                # Envoyer notification de level up si le niveau a changé
                if new_level > old_level:
                    await notification_service.notify_level_up(
                        db=db,
                        user_id=user_id,
                        new_level=new_level
                    )
                    await db.commit()

                return {
                    "bonus_xp": bonus_xp,
                    "current_streak": gamification.current_streak,
                    "total_xp": gamification.total_xp,
                    "level": gamification.level,
                    "leveled_up": new_level > old_level
                }

            except Exception as e:
                await db.rollback()
                raise e

    try:
        result = run_async(_award())

        if result is None:
            return {
                "success": False,
                "error": "User gamification not found",
                "task_id": self.request.id
            }

        return {
            "success": True,
            "user_id": user_id,
            **result,
            "task_id": self.request.id
        }

    except Exception as e:
        logger.error(f"Erreur award_daily_bonus: {e}")
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }


@celery_app.task(base=GamificationTask, bind=True, name="app.tasks.gamification_tasks.process_weekly_league_reset")
def process_weekly_league_reset(self) -> Dict[str, Any]:
    """
    Traite le reset hebdomadaire des ligues.
    - Promeut le top X de chaque ligue
    - Rétrograde le bottom Y de chaque ligue
    - Remet les XP hebdomadaires à zéro
    - Envoie des notifications aux utilisateurs promus/rétrogradés

    Exécuté chaque lundi à 00:00 UTC par Celery Beat

    Returns:
        Dict avec les statistiques de promotions/rétrogradations
    """
    async def _process():
        async with async_session_maker() as db:
            try:
                result = await leaderboard_service.process_weekly_reset(db)

                # Envoyer les notifications de promotion
                notifications_sent = 0
                for promoted in result.get("promoted_users", []):
                    try:
                        await notification_service.notify_league_promotion(
                            db=db,
                            user_id=promoted["user_id"],
                            from_tier=promoted["from_tier"],
                            to_tier=promoted["to_tier"],
                            final_rank=promoted["rank"],
                            final_xp=promoted["xp"]
                        )
                        notifications_sent += 1
                    except Exception as e:
                        logger.warning(f"Erreur notification promotion user {promoted['user_id']}: {e}")

                # Envoyer les notifications de rétrogradation
                for demoted in result.get("demoted_users", []):
                    try:
                        await notification_service.notify_league_demotion(
                            db=db,
                            user_id=demoted["user_id"],
                            from_tier=demoted["from_tier"],
                            to_tier=demoted["to_tier"],
                            final_rank=demoted["rank"],
                            final_xp=demoted["xp"]
                        )
                        notifications_sent += 1
                    except Exception as e:
                        logger.warning(f"Erreur notification demotion user {demoted['user_id']}: {e}")

                await db.commit()
                result["notifications_sent"] = notifications_sent
                return result
            except Exception as e:
                await db.rollback()
                raise e

    try:
        result = run_async(_process())

        logger.info(f"Weekly league reset completed: {result}")

        return {
            "success": True,
            **result,
            "task_id": self.request.id,
            "executed_at": utc_now().isoformat()
        }

    except Exception as e:
        logger.error(f"Erreur process_weekly_league_reset: {e}")
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }


@celery_app.task(base=GamificationTask, bind=True, name="app.tasks.gamification_tasks.add_user_weekly_xp")
def add_user_weekly_xp(self, user_id: int, xp_amount: int) -> Dict[str, Any]:
    """
    Ajoute des XP hebdomadaires à un utilisateur pour les ligues.
    Appelé chaque fois qu'un utilisateur gagne des XP.

    Args:
        user_id: ID de l'utilisateur
        xp_amount: Montant d'XP à ajouter

    Returns:
        Dict avec les informations de ligue mises à jour
    """
    async def _add():
        async with async_session_maker() as db:
            try:
                user_league = await leaderboard_service.add_weekly_xp(db, user_id, xp_amount)
                await db.commit()
                return {
                    "user_id": user_id,
                    "weekly_xp": user_league.weekly_xp,
                    "tier": user_league.current_tier
                }
            except Exception as e:
                await db.rollback()
                raise e

    try:
        result = run_async(_add())

        return {
            "success": True,
            **result,
            "xp_added": xp_amount,
            "task_id": self.request.id
        }

    except Exception as e:
        logger.error(f"Erreur add_user_weekly_xp: {e}")
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }


@celery_app.task(base=GamificationTask, bind=True, name="app.tasks.gamification_tasks.cleanup_expired_focus_rooms")
def cleanup_expired_focus_rooms(self) -> Dict[str, Any]:
    """
    Supprime les Focus Rooms sans activité depuis 7 jours.
    Exécuté une fois par jour par Celery Beat.

    Les rooms d'événements (EVENT) ne sont pas supprimées automatiquement.

    Returns:
        Dict avec les statistiques de nettoyage
    """
    async def _cleanup():
        async with async_session_maker() as db:
            try:
                # Seuil d'expiration: 7 jours sans activité
                expiration_threshold = utc_now() - timedelta(days=7)

                # Trouver les rooms expirées (sauf les events)
                expired_query = (
                    select(FocusRoom)
                    .where(and_(
                        FocusRoom.last_activity_at < expiration_threshold,
                        FocusRoom.is_active == True,
                        FocusRoom.room_type != "event"  # Ne pas supprimer les événements
                    ))
                )
                result = await db.execute(expired_query)
                expired_rooms = result.scalars().all()

                rooms_deleted = 0
                room_names = []

                for room in expired_rooms:
                    room_names.append(f"{room.name} (id={room.id}, inactif depuis {room.last_activity_at})")
                    # Supprimer la room (cascade supprimera participants, activities, etc.)
                    await db.delete(room)
                    rooms_deleted += 1

                await db.commit()

                if rooms_deleted > 0:
                    logger.info(f"Focus Rooms expirées supprimées: {rooms_deleted}")
                    for name in room_names:
                        logger.info(f"  - {name}")

                return rooms_deleted, room_names

            except Exception as e:
                await db.rollback()
                raise e

    try:
        rooms_deleted, room_names = run_async(_cleanup())

        return {
            "success": True,
            "rooms_deleted": rooms_deleted,
            "deleted_rooms": room_names,
            "expiration_days": 7,
            "task_id": self.request.id,
            "executed_at": utc_now().isoformat()
        }

    except Exception as e:
        logger.error(f"Erreur cleanup_expired_focus_rooms: {e}")
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }
