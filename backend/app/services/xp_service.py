"""
Service centralisé pour la gestion des XP avec broadcast temps réel
"""
import logging
import math
from typing import Optional
from app.models.user import User

logger = logging.getLogger(__name__)


# Import lazy pour éviter les imports circulaires
_leaderboard_service = None


def get_leaderboard_service():
    """Import lazy du service leaderboard"""
    global _leaderboard_service
    if _leaderboard_service is None:
        from app.services.leaderboard_service import leaderboard_service
        _leaderboard_service = leaderboard_service
    return _leaderboard_service


async def update_weekly_xp(user_id: int, xp_amount: int, db=None):
    """
    Met à jour les XP hebdomadaires pour le système de ligues.
    Si pas de session db fournie, utilise une tâche Celery.

    Args:
        user_id: ID de l'utilisateur
        xp_amount: Montant d'XP à ajouter
        db: Session de base de données (optionnel)
    """
    if db is not None:
        # Mise à jour directe avec la session fournie
        leaderboard_svc = get_leaderboard_service()
        await leaderboard_svc.add_weekly_xp(db, user_id, xp_amount)
    else:
        # Utiliser une tâche Celery pour la mise à jour asynchrone
        try:
            from app.tasks.gamification_tasks import add_user_weekly_xp
            add_user_weekly_xp.delay(user_id, xp_amount)
        except Exception as e:
            logger.warning(f"Could not queue weekly XP update task: {e}")


def xp_for_next_level(level: int) -> int:
    """
    Calcule l'XP nécessaire pour passer du niveau actuel au suivant.
    Formule style Duolingo : 50 + (level * 25)

    - Niveau 1 → 2 : 75 XP
    - Niveau 2 → 3 : 100 XP
    - Niveau 5 → 6 : 175 XP
    - Niveau 10 → 11 : 300 XP
    """
    return 50 + (level * 25)


def total_xp_for_level(level: int) -> int:
    """
    Calcule l'XP total nécessaire pour atteindre un niveau donné.
    Somme de tous les XP nécessaires pour chaque niveau précédent.
    """
    if level <= 1:
        return 0
    # Somme arithmétique: sum(50 + i*25 for i in range(1, level))
    # = 50*(level-1) + 25*(1+2+...+(level-1))
    # = 50*(level-1) + 25*(level-1)*level/2
    n = level - 1
    return 50 * n + 25 * n * (n + 1) // 2


def calculate_level(xp: int) -> int:
    """
    Calcule le niveau basé sur l'XP total.
    Formule style Duolingo avec progression linéaire croissante.

    XP pour chaque niveau: 50 + (level * 25)
    - Niveau 2 : 75 XP total
    - Niveau 3 : 175 XP total
    - Niveau 5 : 425 XP total
    - Niveau 10 : 1175 XP total
    - Niveau 20 : 3425 XP total
    """
    if xp <= 0:
        return 1

    level = 1
    xp_needed = 0

    while True:
        xp_for_next = xp_for_next_level(level)
        if xp_needed + xp_for_next > xp:
            break
        xp_needed += xp_for_next
        level += 1

    return level


def get_level_progress(xp: int) -> dict:
    """
    Retourne les infos de progression du niveau actuel.
    """
    level = calculate_level(xp)
    xp_for_current = total_xp_for_level(level)
    xp_for_next = total_xp_for_level(level + 1)
    xp_in_level = xp - xp_for_current
    xp_needed = xp_for_next - xp_for_current

    return {
        "level": level,
        "xp_progress": xp_in_level,
        "xp_needed": xp_needed,
        "xp_for_next_level": xp_for_next,
        "progress_percent": round((xp_in_level / xp_needed) * 100, 1) if xp_needed > 0 else 100
    }

# Import lazy pour éviter les imports circulaires
_broadcast_func = None


def get_broadcast_func():
    """Import lazy de la fonction de broadcast"""
    global _broadcast_func
    if _broadcast_func is None:
        from app.api.v1.websocket import broadcast_main_leaderboard_update
        _broadcast_func = broadcast_main_leaderboard_update
    return _broadcast_func


async def award_xp(
    user: User,
    amount: int,
    reason: str,
    event_type: str = "xp_gained",
    extra_data: Optional[dict] = None,
    db=None
):
    """
    Attribuer des XP à un utilisateur et broadcaster la mise à jour

    Args:
        user: L'utilisateur qui reçoit les XP
        amount: Nombre d'XP à attribuer
        reason: Raison de l'attribution (pour le log et le message)
        event_type: Type d'événement pour le broadcast
        extra_data: Données supplémentaires à inclure dans le broadcast
        db: Session de base de données (optionnel, pour mise à jour directe weekly_xp)
    """
    # Utiliser gamification pour gérer les XP (total_xp est une property en lecture seule sur User)
    if not user.gamification:
        logger.warning(f"User {user.username} has no gamification record, skipping XP award")
        return {
            "xp_gained": 0,
            "total_xp": 0,
            "level": 1,
            "level_up": False
        }

    old_xp = user.gamification.total_xp or 0
    user.gamification.total_xp = old_xp + amount
    new_xp = user.gamification.total_xp

    # Calculer le niveau avec la formule quadratique harmonisée
    old_level = calculate_level(old_xp)
    new_level = calculate_level(new_xp)
    level_up = new_level > old_level

    if level_up:
        user.gamification.level = new_level

    logger.info(f"XP awarded: {user.username} +{amount} XP ({reason}) -> Total: {new_xp}")

    # Mettre à jour weekly_xp pour les ligues
    try:
        await update_weekly_xp(user.id, amount, db)
    except Exception as e:
        # Non bloquant si la mise à jour weekly_xp échoue
        logger.warning(f"Failed to update weekly XP for leagues: {e}")

    # Mettre à jour la quête EARN_XP si une session db est fournie
    if db is not None:
        try:
            from app.services.daily_quest_service import daily_quest_service
            from app.models.daily_quest import QuestType
            await daily_quest_service.update_quest_progress(
                db=db,
                user_id=user.id,
                quest_type=QuestType.EARN_XP,
                progress=amount
            )
        except Exception as e:
            # Non bloquant si la mise à jour quest échoue
            logger.warning(f"Failed to update EARN_XP quest progress: {e}")

    # Envoyer notification de level up
    if level_up and db is not None:
        try:
            from app.services.notification_service import notification_service
            await notification_service.notify_level_up(
                db=db,
                user_id=user.id,
                new_level=new_level
            )
        except Exception as e:
            logger.warning(f"Failed to send level up notification: {e}")

    # Déclencher la vérification des achievements (tâche async)
    try:
        from app.tasks.gamification_tasks import check_achievements
        check_achievements.delay(user.id)
    except Exception as e:
        logger.warning(f"Failed to trigger achievement check: {e}")

    # Broadcaster la mise à jour
    try:
        broadcast_func = get_broadcast_func()
        await broadcast_func(
            user_id=user.id,
            username=user.username,
            event_type=event_type,
            data={
                "xp_gained": amount,
                "total_xp": new_xp,
                "reason": reason,
                "level": new_level,
                "level_up": level_up,
                **(extra_data or {})
            }
        )
    except Exception as e:
        # Non bloquant si le broadcast échoue
        logger.warning(f"Failed to broadcast XP update: {e}")

    return {
        "xp_gained": amount,
        "total_xp": new_xp,
        "level": new_level,
        "level_up": level_up
    }


async def broadcast_stat_update(
    user: User,
    stat_type: str,
    value: int,
    event_type: str
):
    """
    Broadcaster une mise à jour de statistique (quiz, notes, flashcards, etc.)
    """
    try:
        broadcast_func = get_broadcast_func()
        await broadcast_func(
            user_id=user.id,
            username=user.username,
            event_type=event_type,
            data={
                "stat_type": stat_type,
                "value": value,
                "level": user.level,
                "total_xp": user.total_xp
            }
        )
    except Exception as e:
        logger.warning(f"Failed to broadcast stat update: {e}")
