"""
API Duels - Système de défis entre étudiants
Corrigé avec: status cohérent, cache Redis, notifications, XP penalty 50%
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.core.datetime_utils import utc_now
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, UserGamification, UserProfile
from app.models.gamification import Duel, DuelStatus
from app.models.subject import Subject
from app.models.quiz import Quiz, QuizAttempt
from app.schemas.gamification import (
    DuelCreate,
    DuelComplete,
    DuelResponse,
    DuelListResponse
)
from app.services.cache_service import cache_service, CachePrefix, CacheTTL

# Logger
logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Helper Functions
# ============================================================================

def serialize_duel(duel: Duel) -> dict:
    """Sérialise un duel pour la réponse API"""
    result = {
        "id": duel.id,
        "challenger_id": duel.challenger_id,
        "opponent_id": duel.opponent_id,
        "subject_id": duel.subject_id,
        "quiz_id": duel.quiz_id,
        "status": duel.status.value if isinstance(duel.status, DuelStatus) else duel.status,
        "challenger_score": duel.challenger_score,
        "opponent_score": duel.opponent_score,
        "winner_id": duel.winner_id,
        "stakes_xp": duel.stakes_xp,
        "duration_minutes": duel.duration_minutes,
        "started_at": duel.started_at.isoformat() if duel.started_at else None,
        "ended_at": duel.ended_at.isoformat() if duel.ended_at else None,
        "created_at": duel.created_at.isoformat() if duel.created_at else None,
        "updated_at": duel.updated_at.isoformat() if duel.updated_at else None,
    }

    # Ajouter les relations si chargées
    if duel.challenger:
        result["challenger"] = {
            "id": duel.challenger.id,
            "username": duel.challenger.username,
            "avatar_url": duel.challenger.avatar_url,
            "level": duel.challenger.level
        }

    if duel.opponent:
        result["opponent"] = {
            "id": duel.opponent.id,
            "username": duel.opponent.username,
            "avatar_url": duel.opponent.avatar_url,
            "level": duel.opponent.level
        }

    if duel.quiz:
        result["quiz"] = {
            "id": duel.quiz.id,
            "title": duel.quiz.title
        }

    return result


async def invalidate_duel_cache(user_ids: List[int]):
    """Invalide le cache des duels pour plusieurs utilisateurs"""
    for user_id in user_ids:
        await cache_service.delete_pattern(f"cache:duel:*user_id={user_id}*")
        await cache_service.delete_pattern(f"cache:duel:pending:*user_id={user_id}*")
    logger.debug(f"Cache duel invalidé pour users: {user_ids}")


async def send_duel_notification(
    db: AsyncSession,
    user_id: int,
    notification_type: str,
    title: str,
    message: str,
    duel_id: int,
    data: dict = None
):
    """Envoie une notification de duel (in-app + potentiellement email)"""
    try:
        from app.models.notification import Notification, NotificationType, NotificationPriority

        # Mapping des types
        type_map = {
            "challenge": NotificationType.DUEL_CHALLENGE,
            "accepted": NotificationType.DUEL_ACCEPTED,
            "declined": NotificationType.DUEL_DECLINED,
            "completed": NotificationType.DUEL_COMPLETED,
            "won": NotificationType.DUEL_WON,
            "lost": NotificationType.DUEL_LOST,
        }

        notification = Notification(
            user_id=user_id,
            type=type_map.get(notification_type, NotificationType.DUEL_CHALLENGE),
            title=title,
            message=message,
            priority=NotificationPriority.HIGH if notification_type == "challenge" else NotificationPriority.NORMAL,
            action_url=f"/duels/{duel_id}",
            data=str(data) if data else None
        )

        db.add(notification)
        logger.info(f"Notification duel envoyée: user={user_id}, type={notification_type}")

    except Exception as e:
        logger.warning(f"Erreur création notification duel: {e}")


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/", response_model=DuelResponse, status_code=status.HTTP_201_CREATED)
async def create_duel(
    duel_data: DuelCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lancer un défi à un autre étudiant.

    - **opponent_id**: ID de l'adversaire à défier
    - **quiz_id**: Quiz sur lequel le duel portera (optionnel si subject_id)
    - **subject_id**: Matière du duel (optionnel si quiz_id)
    - **stakes_xp**: XP misés (10-500, défaut 50)
    - **duration_minutes**: Durée du duel en minutes (défaut 30)
    """
    # Validation: adversaire existe
    opponent = await db.get(User, duel_data.opponent_id)
    if not opponent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adversaire introuvable"
        )

    if opponent.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de se défier soi-même"
        )

    # Validation: stakes_xp dans les limites
    if duel_data.stakes_xp < 10 or duel_data.stakes_xp > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Les enjeux doivent être entre 10 et 500 XP"
        )

    # Validation: subject si fourni
    if duel_data.subject_id:
        subject = await db.get(Subject, duel_data.subject_id)
        if not subject:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Matière introuvable"
            )

    # Validation: quiz si fourni
    if duel_data.quiz_id:
        quiz = await db.get(Quiz, duel_data.quiz_id)
        if not quiz:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quiz introuvable"
            )
        # Auto-assigner le subject_id depuis le quiz
        if not duel_data.subject_id and quiz.subject_id:
            duel_data.subject_id = quiz.subject_id

    # Vérifier qu'il n'y a pas déjà un duel pending entre ces utilisateurs
    existing_query = select(Duel).where(
        and_(
            or_(
                and_(Duel.challenger_id == current_user.id, Duel.opponent_id == duel_data.opponent_id),
                and_(Duel.challenger_id == duel_data.opponent_id, Duel.opponent_id == current_user.id)
            ),
            Duel.status == DuelStatus.PENDING
        )
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un défi est déjà en attente entre vous deux"
        )

    # Créer le duel
    new_duel = Duel(
        challenger_id=current_user.id,
        opponent_id=duel_data.opponent_id,
        subject_id=duel_data.subject_id,
        quiz_id=duel_data.quiz_id,
        stakes_xp=duel_data.stakes_xp,
        duration_minutes=duel_data.duration_minutes,
        status=DuelStatus.PENDING
    )

    db.add(new_duel)
    await db.commit()
    await db.refresh(new_duel)

    # Charger les relations
    await db.refresh(new_duel, ["challenger", "opponent", "quiz"])

    # Envoyer notification à l'adversaire
    await send_duel_notification(
        db=db,
        user_id=opponent.id,
        notification_type="challenge",
        title="Nouveau défi ! ⚔️",
        message=f"{current_user.username} vous défie sur un quiz ! Enjeux: {duel_data.stakes_xp} XP",
        duel_id=new_duel.id,
        data={"challenger_id": current_user.id, "stakes_xp": duel_data.stakes_xp}
    )
    await db.commit()

    # Invalider le cache
    await invalidate_duel_cache([current_user.id, opponent.id])

    logger.info(f"Duel créé: {new_duel.id} | {current_user.username} vs {opponent.username}")

    return serialize_duel(new_duel)


@router.get("/", response_model=DuelListResponse)
async def get_duels(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupérer les duels de l'utilisateur (avec cache Redis 2min).

    - **page**: Page de résultats
    - **page_size**: Nombre de résultats par page
    - **status_filter**: Filtrer par status (pending, accepted, in_progress, completed, declined, cancelled)
    """
    # Clé de cache
    cache_key = cache_service.generate_key(
        CachePrefix.DUEL,
        user_id=current_user.id,
        page=page,
        status=status_filter or "all"
    )

    # Vérifier le cache
    cached = await cache_service.get(cache_key)
    if cached:
        logger.debug(f"Cache HIT: duels user {current_user.id}")
        return DuelListResponse(**cached)

    logger.debug(f"Cache MISS: duels user {current_user.id}")

    # Query de base: duels où l'utilisateur est impliqué
    query = select(Duel).options(
        selectinload(Duel.challenger),
        selectinload(Duel.opponent),
        selectinload(Duel.quiz)
    ).where(
        or_(
            Duel.challenger_id == current_user.id,
            Duel.opponent_id == current_user.id
        )
    )

    # Filtre par status
    if status_filter:
        try:
            status_enum = DuelStatus(status_filter.lower())
            query = query.where(Duel.status == status_enum)
        except ValueError:
            pass

    # Compter le total
    count_query = select(func.count()).select_from(Duel).where(
        or_(
            Duel.challenger_id == current_user.id,
            Duel.opponent_id == current_user.id
        )
    )
    if status_filter:
        try:
            status_enum = DuelStatus(status_filter.lower())
            count_query = count_query.where(Duel.status == status_enum)
        except ValueError:
            pass

    total = await db.scalar(count_query)

    # Pagination et tri
    offset = (page - 1) * page_size
    query = query.order_by(Duel.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    duels = result.scalars().all()

    response_data = {
        "duels": [serialize_duel(d) for d in duels],
        "total": total or 0,
        "page": page,
        "page_size": page_size
    }

    # Mettre en cache (2 minutes)
    await cache_service.set(cache_key, response_data, ttl=CacheTTL.SHORT)

    return response_data


@router.get("/pending", response_model=List[DuelResponse])
async def get_pending_duels(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupérer les défis en attente où l'utilisateur est l'adversaire (avec cache 1min).
    Ces sont les duels que l'utilisateur peut accepter ou refuser.
    """
    # Clé de cache
    cache_key = cache_service.generate_key(
        CachePrefix.DUEL,
        subtype="pending",
        user_id=current_user.id
    )

    # Vérifier le cache
    cached = await cache_service.get(cache_key)
    if cached:
        logger.debug(f"Cache HIT: pending duels user {current_user.id}")
        return cached

    logger.debug(f"Cache MISS: pending duels user {current_user.id}")

    query = select(Duel).options(
        selectinload(Duel.challenger),
        selectinload(Duel.opponent),
        selectinload(Duel.quiz)
    ).where(
        and_(
            Duel.opponent_id == current_user.id,
            Duel.status == DuelStatus.PENDING
        )
    ).order_by(Duel.created_at.desc())

    result = await db.execute(query)
    duels = result.scalars().all()

    response_data = [serialize_duel(d) for d in duels]

    # Cache court (1 minute) car les pending changent souvent
    await cache_service.set(cache_key, response_data, ttl=60)

    return response_data


@router.get("/recommended-opponents")
async def get_recommended_opponents(
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupérer des adversaires recommandés basés sur un XP similaire.
    L'algorithme cherche des utilisateurs dont le XP est dans une plage de ±30%.
    """
    # Accéder à l'XP via le sous-modèle gamification
    user_xp = current_user.gamification.total_xp if current_user.gamification else 0
    xp_range = max(50, int(user_xp * 0.3))
    min_xp = max(0, user_xp - xp_range)
    max_xp = user_xp + xp_range

    # Joindre UserGamification pour filtrer par XP
    query = (
        select(User)
        .join(UserGamification, User.id == UserGamification.user_id, isouter=True)
        .where(
            and_(
                User.id != current_user.id,
                User.is_active == True,
                User.is_deleted == False,
                UserGamification.total_xp >= min_xp,
                UserGamification.total_xp <= max_xp
            )
        )
        .order_by(func.abs(func.coalesce(UserGamification.total_xp, 0) - user_xp))
        .limit(limit)
    )

    result = await db.execute(query)
    users = result.scalars().all()

    if len(users) < limit:
        # Récupérer des utilisateurs supplémentaires si pas assez
        existing_ids = [u.id for u in users]
        extended_query = (
            select(User)
            .join(UserGamification, User.id == UserGamification.user_id, isouter=True)
            .where(
                and_(
                    User.id != current_user.id,
                    User.is_active == True,
                    User.is_deleted == False,
                    User.id.notin_(existing_ids) if existing_ids else True
                )
            )
            .order_by(func.abs(func.coalesce(UserGamification.total_xp, 0) - user_xp))
            .limit(limit - len(users))
        )
        extended_result = await db.execute(extended_query)
        users.extend(extended_result.scalars().all())

    # Récupérer les duels en attente
    pending_duels_query = select(Duel.opponent_id, Duel.challenger_id).where(
        and_(
            or_(Duel.challenger_id == current_user.id, Duel.opponent_id == current_user.id),
            Duel.status.in_([DuelStatus.PENDING, DuelStatus.ACCEPTED, DuelStatus.IN_PROGRESS])
        )
    )
    pending_result = await db.execute(pending_duels_query)
    users_with_pending = set()
    for row in pending_result.all():
        if row[0] != current_user.id:
            users_with_pending.add(row[0])
        if row[1] != current_user.id:
            users_with_pending.add(row[1])

    recommendations = []
    for user in users:
        # Accéder aux sous-modèles pour les données
        user_total_xp = user.gamification.total_xp if user.gamification else 0
        user_level = user.gamification.level if user.gamification else 1
        user_avatar = user.profile.avatar_url if user.profile else None
        user_university = user.profile.university if user.profile else None

        xp_diff = abs(user_total_xp - user_xp)
        match_quality = "excellent" if xp_diff <= 20 else "good" if xp_diff <= 50 else "fair"
        recommendations.append({
            "id": user.id,
            "username": user.username,
            "avatar_url": user_avatar,
            "level": user_level,
            "total_xp": user_total_xp,
            "xp_difference": xp_diff,
            "match_quality": match_quality,
            "university": user_university,
            "has_pending_duel": user.id in users_with_pending
        })

    return {
        "recommendations": recommendations,
        "user_xp": user_xp,
        "xp_range": {"min": min_xp, "max": max_xp},
        "total": len(recommendations)
    }


@router.post("/invite-link")
async def create_duel_invite_link(
    quiz_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    stakes_xp: int = Query(50, ge=10, le=500),
    duration_minutes: int = Query(30, ge=5, le=120),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Créer un lien d'invitation pour un duel."""
    import secrets
    invite_code = secrets.token_urlsafe(12)

    quiz_title = None
    if quiz_id:
        quiz = await db.get(Quiz, quiz_id)
        if not quiz:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz introuvable")
        quiz_title = quiz.title
        if not subject_id and quiz.subject_id:
            subject_id = quiz.subject_id

    invite_data = {
        "challenger_id": current_user.id,
        "challenger_username": current_user.username,
        "quiz_id": quiz_id,
        "quiz_title": quiz_title,
        "subject_id": subject_id,
        "stakes_xp": stakes_xp,
        "duration_minutes": duration_minutes,
        "created_at": utc_now().isoformat()
    }

    await cache_service.set(f"duel_invite:{invite_code}", invite_data, ttl=86400)
    logger.info(f"Duel invite link created by {current_user.username}: {invite_code}")

    return {
        "invite_code": invite_code,
        "invite_url": f"/duels/join/{invite_code}",
        "expires_in_hours": 24,
        "challenger": current_user.username,
        "stakes_xp": stakes_xp,
        "quiz_title": quiz_title
    }


@router.get("/invite/{invite_code}")
async def get_duel_invite(
    invite_code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les détails d'une invitation de duel"""
    invite_data = await cache_service.get(f"duel_invite:{invite_code}")
    if not invite_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation expirée ou invalide")

    if invite_data["challenger_id"] == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Vous ne pouvez pas accepter votre propre invitation")

    return {
        "invite_code": invite_code,
        "challenger_id": invite_data["challenger_id"],
        "challenger_username": invite_data["challenger_username"],
        "quiz_id": invite_data.get("quiz_id"),
        "quiz_title": invite_data.get("quiz_title"),
        "stakes_xp": invite_data["stakes_xp"],
        "duration_minutes": invite_data["duration_minutes"],
        "can_accept": True
    }


@router.post("/invite/{invite_code}/accept", response_model=DuelResponse)
async def accept_duel_invite(
    invite_code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Accepter une invitation de duel via un lien"""
    invite_data = await cache_service.get(f"duel_invite:{invite_code}")
    if not invite_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation expirée ou invalide")

    challenger_id = invite_data["challenger_id"]
    if challenger_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Vous ne pouvez pas accepter votre propre invitation")

    existing_query = select(Duel).where(
        and_(
            or_(
                and_(Duel.challenger_id == challenger_id, Duel.opponent_id == current_user.id),
                and_(Duel.challenger_id == current_user.id, Duel.opponent_id == challenger_id)
            ),
            Duel.status == DuelStatus.PENDING
        )
    )
    if (await db.execute(existing_query)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Un défi est déjà en attente entre vous deux")

    new_duel = Duel(
        challenger_id=challenger_id,
        opponent_id=current_user.id,
        subject_id=invite_data.get("subject_id"),
        quiz_id=invite_data.get("quiz_id"),
        stakes_xp=invite_data["stakes_xp"],
        duration_minutes=invite_data["duration_minutes"],
        status=DuelStatus.ACCEPTED,
        started_at=utc_now()
    )
    db.add(new_duel)
    await db.commit()
    await db.refresh(new_duel, ["challenger", "opponent", "quiz"])

    await cache_service.delete(f"duel_invite:{invite_code}")
    await send_duel_notification(db, challenger_id, "accepted", "Défi accepté via lien ! 🎯",
                                  f"{current_user.username} a accepté votre invitation au duel !", new_duel.id)
    await db.commit()
    await invalidate_duel_cache([challenger_id, current_user.id])

    return serialize_duel(new_duel)


@router.get("/stats/me")
async def get_my_duel_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les statistiques de duel de l'utilisateur"""
    total_query = select(func.count()).select_from(Duel).where(
        and_(
            or_(Duel.challenger_id == current_user.id, Duel.opponent_id == current_user.id),
            Duel.status == DuelStatus.COMPLETED
        )
    )
    total = await db.scalar(total_query) or 0

    wins_query = select(func.count()).select_from(Duel).where(
        and_(Duel.winner_id == current_user.id, Duel.status == DuelStatus.COMPLETED)
    )
    wins = await db.scalar(wins_query) or 0

    xp_won_query = select(func.coalesce(func.sum(Duel.stakes_xp), 0)).where(
        and_(Duel.winner_id == current_user.id, Duel.status == DuelStatus.COMPLETED)
    )
    xp_won = await db.scalar(xp_won_query) or 0

    xp_lost_query = select(func.coalesce(func.sum(Duel.stakes_xp // 2), 0)).where(
        and_(
            or_(Duel.challenger_id == current_user.id, Duel.opponent_id == current_user.id),
            Duel.winner_id != current_user.id,
            Duel.winner_id.isnot(None),
            Duel.status == DuelStatus.COMPLETED
        )
    )
    xp_lost = await db.scalar(xp_lost_query) or 0

    return {
        "total_duels": total,
        "wins": wins,
        "losses": total - wins if total > wins else 0,
        "win_rate": round((wins / total * 100), 1) if total > 0 else 0,
        "xp_won": xp_won,
        "xp_lost": xp_lost,
        "net_xp": xp_won - xp_lost
    }


@router.get("/{duel_id}", response_model=DuelResponse)
async def get_duel(
    duel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer un duel spécifique"""
    query = select(Duel).options(
        selectinload(Duel.challenger),
        selectinload(Duel.opponent),
        selectinload(Duel.quiz)
    ).where(Duel.id == duel_id)

    result = await db.execute(query)
    duel = result.scalar_one_or_none()

    if not duel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Duel introuvable"
        )

    # Vérifier l'accès
    if duel.challenger_id != current_user.id and duel.opponent_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé"
        )

    return serialize_duel(duel)


@router.post("/{duel_id}/accept", response_model=DuelResponse)
async def accept_duel(
    duel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Accepter un défi.
    Seul l'adversaire (opponent) peut accepter.
    Le status passe de PENDING à ACCEPTED.
    """
    query = select(Duel).options(
        selectinload(Duel.challenger),
        selectinload(Duel.opponent),
        selectinload(Duel.quiz)
    ).where(Duel.id == duel_id)

    result = await db.execute(query)
    duel = result.scalar_one_or_none()

    if not duel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Duel introuvable"
        )

    # Seul l'adversaire peut accepter
    if duel.opponent_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul l'adversaire peut accepter le défi"
        )

    if duel.status != DuelStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ce duel n'est pas en attente (status: {duel.status.value})"
        )

    # Mettre à jour le status -> ACCEPTED (pas ACTIVE!)
    duel.status = DuelStatus.ACCEPTED
    duel.started_at = utc_now()

    await db.commit()
    await db.refresh(duel)

    # Notifier le challenger
    await send_duel_notification(
        db=db,
        user_id=duel.challenger_id,
        notification_type="accepted",
        title="Défi accepté ! 🎯",
        message=f"{current_user.username} a accepté votre défi ! Que le meilleur gagne !",
        duel_id=duel.id
    )
    await db.commit()

    # Invalider le cache
    await invalidate_duel_cache([duel.challenger_id, duel.opponent_id])

    logger.info(f"Duel {duel_id} accepté par {current_user.username}")

    return serialize_duel(duel)


@router.post("/{duel_id}/decline", response_model=DuelResponse)
async def decline_duel(
    duel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Refuser un défi.
    Seul l'adversaire (opponent) peut refuser.
    Le status passe à DECLINED.
    """
    query = select(Duel).options(
        selectinload(Duel.challenger),
        selectinload(Duel.opponent),
        selectinload(Duel.quiz)
    ).where(Duel.id == duel_id)

    result = await db.execute(query)
    duel = result.scalar_one_or_none()

    if not duel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Duel introuvable"
        )

    if duel.opponent_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul l'adversaire peut refuser le défi"
        )

    if duel.status != DuelStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce duel n'est pas en attente"
        )

    duel.status = DuelStatus.DECLINED
    duel.ended_at = utc_now()

    await db.commit()
    await db.refresh(duel)

    # Notifier le challenger
    await send_duel_notification(
        db=db,
        user_id=duel.challenger_id,
        notification_type="declined",
        title="Défi refusé",
        message=f"{current_user.username} a décliné votre défi.",
        duel_id=duel.id
    )
    await db.commit()

    # Invalider le cache
    await invalidate_duel_cache([duel.challenger_id, duel.opponent_id])

    logger.info(f"Duel {duel_id} refusé par {current_user.username}")

    return serialize_duel(duel)


@router.post("/{duel_id}/start", response_model=DuelResponse)
async def start_duel(
    duel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Démarrer un duel accepté.
    L'un des deux joueurs peut démarrer.
    Le status passe de ACCEPTED à IN_PROGRESS.
    """
    query = select(Duel).options(
        selectinload(Duel.challenger),
        selectinload(Duel.opponent),
        selectinload(Duel.quiz)
    ).where(Duel.id == duel_id)

    result = await db.execute(query)
    duel = result.scalar_one_or_none()

    if not duel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Duel introuvable"
        )

    # Vérifier que l'utilisateur est impliqué
    if duel.challenger_id != current_user.id and duel.opponent_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé"
        )

    if duel.status != DuelStatus.ACCEPTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le duel doit être accepté pour démarrer (status: {duel.status.value})"
        )

    duel.status = DuelStatus.IN_PROGRESS

    await db.commit()
    await db.refresh(duel)

    # Invalider le cache
    await invalidate_duel_cache([duel.challenger_id, duel.opponent_id])

    logger.info(f"Duel {duel_id} démarré par {current_user.username}")

    return serialize_duel(duel)


@router.post("/{duel_id}/complete", response_model=DuelResponse)
async def complete_duel(
    duel_id: int,
    scores: Optional[DuelComplete] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Compléter un duel et déterminer le gagnant.

    - Si **scores** est fourni, utilise ces scores
    - Sinon, récupère les scores depuis les QuizAttempt

    Le gagnant gagne stakes_xp, le perdant perd stakes_xp / 2 (50%).
    En cas d'égalité, personne ne gagne/perd d'XP.
    """
    query = select(Duel).options(
        selectinload(Duel.challenger),
        selectinload(Duel.opponent),
        selectinload(Duel.quiz)
    ).where(Duel.id == duel_id)

    result = await db.execute(query)
    duel = result.scalar_one_or_none()

    if not duel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Duel introuvable"
        )

    # Vérifier que le duel est en cours ou accepté
    if duel.status not in [DuelStatus.ACCEPTED, DuelStatus.IN_PROGRESS]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le duel n'est pas actif (status: {duel.status.value})"
        )

    # Récupérer les scores
    if scores:
        # Scores fournis manuellement
        duel.challenger_score = scores.challenger_score
        duel.opponent_score = scores.opponent_score
    elif duel.quiz_id:
        # Récupérer depuis les QuizAttempt
        challenger_query = select(QuizAttempt).where(
            and_(
                QuizAttempt.quiz_id == duel.quiz_id,
                QuizAttempt.user_id == duel.challenger_id,
                QuizAttempt.started_at >= duel.started_at
            )
        ).order_by(QuizAttempt.score.desc()).limit(1)

        opponent_query = select(QuizAttempt).where(
            and_(
                QuizAttempt.quiz_id == duel.quiz_id,
                QuizAttempt.user_id == duel.opponent_id,
                QuizAttempt.started_at >= duel.started_at
            )
        ).order_by(QuizAttempt.score.desc()).limit(1)

        challenger_result = await db.execute(challenger_query)
        opponent_result = await db.execute(opponent_query)

        challenger_attempt = challenger_result.scalar_one_or_none()
        opponent_attempt = opponent_result.scalar_one_or_none()

        duel.challenger_score = int(challenger_attempt.score) if challenger_attempt else 0
        duel.opponent_score = int(opponent_attempt.score) if opponent_attempt else 0
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scores requis (pas de quiz associé)"
        )

    # Déterminer le gagnant
    challenger = await db.get(User, duel.challenger_id)
    opponent = await db.get(User, duel.opponent_id)

    winner = None
    loser = None
    is_draw = False

    if duel.challenger_score > duel.opponent_score:
        duel.winner_id = duel.challenger_id
        winner = challenger
        loser = opponent
    elif duel.opponent_score > duel.challenger_score:
        duel.winner_id = duel.opponent_id
        winner = opponent
        loser = challenger
    else:
        # Égalité
        is_draw = True
        duel.winner_id = None

    # Transfert XP (CORRIGÉ: perdant perd 50%, pas 100%)
    if winner and loser:
        # Gagnant gagne l'enjeu complet
        winner.total_xp += duel.stakes_xp
        winner.level = (winner.total_xp // 100) + 1

        # Perdant perd la MOITIÉ de l'enjeu (50%)
        xp_loss = duel.stakes_xp // 2
        loser.total_xp = max(0, loser.total_xp - xp_loss)
        loser.level = (loser.total_xp // 100) + 1

        logger.info(
            f"Duel {duel_id} terminé: {winner.username} gagne +{duel.stakes_xp}XP, "
            f"{loser.username} perd -{xp_loss}XP"
        )

        # Notifications
        await send_duel_notification(
            db=db,
            user_id=winner.id,
            notification_type="won",
            title="Victoire ! 🏆",
            message=f"Vous avez gagné le duel contre {loser.username} ! +{duel.stakes_xp} XP",
            duel_id=duel.id,
            data={"xp_gained": duel.stakes_xp}
        )

        await send_duel_notification(
            db=db,
            user_id=loser.id,
            notification_type="lost",
            title="Défaite",
            message=f"Vous avez perdu le duel contre {winner.username}. -{xp_loss} XP",
            duel_id=duel.id,
            data={"xp_lost": xp_loss}
        )
    else:
        # Égalité - notification aux deux
        logger.info(f"Duel {duel_id} terminé: égalité entre {challenger.username} et {opponent.username}")

        for user in [challenger, opponent]:
            await send_duel_notification(
                db=db,
                user_id=user.id,
                notification_type="completed",
                title="Égalité ! 🤝",
                message="Match nul ! Aucun XP échangé.",
                duel_id=duel.id
            )

    duel.status = DuelStatus.COMPLETED
    duel.ended_at = utc_now()

    await db.commit()
    await db.refresh(duel)

    # Invalider le cache
    await invalidate_duel_cache([duel.challenger_id, duel.opponent_id])

    return serialize_duel(duel)


@router.delete("/{duel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_duel(
    duel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Annuler un duel.
    Seul le challenger peut annuler, et seulement si le duel est PENDING.
    """
    duel = await db.get(Duel, duel_id)

    if not duel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Duel introuvable"
        )

    if duel.challenger_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le challenger peut annuler le duel"
        )

    if duel.status != DuelStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seuls les duels en attente peuvent être annulés"
        )

    opponent_id = duel.opponent_id

    await db.delete(duel)
    await db.commit()

    # Invalider le cache
    await invalidate_duel_cache([current_user.id, opponent_id])

    logger.info(f"Duel {duel_id} annulé par {current_user.username}")

    return None
