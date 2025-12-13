from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.security import get_current_user
from app.models.user import User, UserGamification, UserStats, UserProfile
from app.models.gamification import LeaderboardType, LeaderboardPeriod
from app.schemas.gamification import (
    LeaderboardListResponse,
    LeaderboardEntryResponse
)
from app.services.cache_service import cache_service
from app.services.leaderboard_service import leaderboard_service
from app.models.leaderboard import LeagueTier, LEAGUE_CONFIG

router = APIRouter()


def get_score_column(lb_type: LeaderboardType):
    """Retourne la colonne SQL pour le type de classement"""
    if lb_type == LeaderboardType.XP:
        return func.coalesce(UserGamification.total_xp, 0)
    elif lb_type == LeaderboardType.STREAK:
        return func.coalesce(UserGamification.current_streak, 0)
    elif lb_type == LeaderboardType.NOTES:
        return func.coalesce(UserStats.total_notes_created, 0)
    elif lb_type == LeaderboardType.FLASHCARDS:
        # Utiliser flashcards RÉVISÉES (pas créées) pour le classement
        return func.coalesce(UserStats.total_flashcards_reviewed, 0)
    elif lb_type == LeaderboardType.QUIZZES:
        # Utiliser quizzes COMPLÉTÉS pour le classement
        return func.coalesce(UserStats.total_quizzes_completed, 0)
    elif lb_type == LeaderboardType.STUDY_TIME:
        return func.coalesce(UserStats.total_study_time_minutes, 0)
    else:
        return func.coalesce(UserGamification.total_xp, 0)


def calculate_user_score(user: User, lb_type: LeaderboardType) -> int:
    """Calculer le score d'un utilisateur selon le type de classement"""
    if lb_type == LeaderboardType.XP:
        return user.total_xp or 0
    elif lb_type == LeaderboardType.STREAK:
        return user.current_streak or 0
    elif lb_type == LeaderboardType.NOTES:
        return user.total_notes_created or 0
    elif lb_type == LeaderboardType.FLASHCARDS:
        # Flashcards RÉVISÉES
        return user.total_flashcards_reviewed or 0
    elif lb_type == LeaderboardType.QUIZZES:
        # Quiz COMPLÉTÉS
        return user.total_quizzes_completed or 0
    elif lb_type == LeaderboardType.STUDY_TIME:
        return user.total_study_time_minutes or 0
    return 0


async def get_leaderboard_data(
    lb_type: LeaderboardType,
    lb_period: LeaderboardPeriod,
    limit: int,
    db: AsyncSession,
    university: Optional[str] = None,
    promotion: Optional[str] = None
) -> list:
    """
    Récupère les données du leaderboard depuis la base de données

    Note: Le filtre par période utilise last_activity_date pour déterminer
    les utilisateurs actifs pendant la période. Les utilisateurs sans activité
    récente mais avec un score > 0 sont inclus pour all_time uniquement.
    """
    # Colonne de score
    score_column = get_score_column(lb_type)

    # Construire la requête de base avec toutes les jointures nécessaires
    query = (
        select(User)
        .join(UserGamification, User.id == UserGamification.user_id, isouter=True)
        .join(UserStats, User.id == UserStats.user_id, isouter=True)
        .join(UserProfile, User.id == UserProfile.user_id, isouter=True)
        .options(
            selectinload(User.gamification),
            selectinload(User.stats),
            selectinload(User.profile)
        )
        .where(
            and_(
                User.is_deleted == False,
                User.is_active == True
            )
        )
    )

    # Filtrer par université si spécifié
    if university:
        query = query.where(UserProfile.university == university)

    # Filtrer par promotion si spécifié
    if promotion:
        query = query.where(UserProfile.promotion == promotion)

    # Filtrer par période si applicable (seulement pour daily/weekly/monthly)
    # Pour all_time, on montre tous les utilisateurs avec un score > 0
    if lb_period == LeaderboardPeriod.DAILY:
        date_filter = utc_now() - timedelta(days=1)
        query = query.where(UserGamification.last_activity_date >= date_filter)
    elif lb_period == LeaderboardPeriod.WEEKLY:
        date_filter = utc_now() - timedelta(days=7)
        # Pour weekly, inclure les utilisateurs actifs cette semaine OU avec un score significatif
        query = query.where(
            or_(
                UserGamification.last_activity_date >= date_filter,
                score_column > 0  # Inclure tous ceux qui ont un score
            )
        )
    elif lb_period == LeaderboardPeriod.MONTHLY:
        date_filter = utc_now() - timedelta(days=30)
        query = query.where(
            or_(
                UserGamification.last_activity_date >= date_filter,
                score_column > 0
            )
        )
    else:
        # all_time - juste filtrer par score > 0
        query = query.where(score_column > 0)

    # Ordonner et limiter
    query = query.order_by(desc(score_column)).limit(limit)

    result = await db.execute(query)
    users = result.scalars().all()

    return users


async def get_cached_leaderboard_data(
    leaderboard_type: str,
    period: str,
    limit: int,
    db: AsyncSession,
    university: Optional[str] = None,
    promotion: Optional[str] = None
) -> dict:
    """
    Récupère les données du leaderboard avec cache Redis
    Cache TTL: 5 minutes (300s)
    """
    # Construire la clé de cache
    cache_key_parts = ["leaderboard", leaderboard_type, period, str(limit)]
    if university:
        cache_key_parts.append(f"uni:{university}")
    if promotion:
        cache_key_parts.append(f"promo:{promotion}")

    cache_key = cache_service.generate_key(*cache_key_parts)

    # Vérifier le cache
    cached_data = await cache_service.get(cache_key)
    if cached_data is not None:
        return cached_data

    # Cache MISS - Calculer les données
    try:
        lb_type = LeaderboardType(leaderboard_type)
        lb_period = LeaderboardPeriod(period)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid leaderboard type or period"
        )

    # Récupérer les utilisateurs
    users = await get_leaderboard_data(
        lb_type=lb_type,
        lb_period=lb_period,
        limit=limit,
        db=db,
        university=university,
        promotion=promotion
    )

    # Construire les entrées
    entries = []
    for rank, user in enumerate(users, start=1):
        score = calculate_user_score(user, lb_type)

        # Récupérer university et promotion depuis le profil
        user_university = user.profile.university if user.profile else None
        user_promotion = user.profile.promotion if user.profile else None

        entry = {
            "rank": rank,
            "user_id": user.id,
            "username": user.username,
            "avatar_url": user.avatar_url,
            "score": score,
            "level": user.level or 1,
            "streak": user.current_streak or 0,
            "university": user_university,
            "promotion": user_promotion
        }
        entries.append(entry)

    result_data = {
        "leaderboard_type": leaderboard_type,
        "period": period,
        "entries": entries,
        "total_participants": len(entries)
    }

    # Mettre en cache pour 5 minutes
    await cache_service.set(cache_key, result_data, ttl=300)

    return result_data


@router.get("/", response_model=LeaderboardListResponse)
async def get_leaderboard(
    leaderboard_type: str = Query("xp", description="Type: xp, streak, notes, flashcards, quizzes, study_time"),
    period: str = Query("all_time", description="Period: daily, weekly, monthly, all_time"),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer un classement général (avec cache Redis 5min)"""
    # Récupérer les données cachées du leaderboard
    leaderboard_data = await get_cached_leaderboard_data(
        leaderboard_type=leaderboard_type,
        period=period,
        limit=limit,
        db=db
    )

    lb_type = LeaderboardType(leaderboard_type)

    # Convertir les entrées en objets Pydantic
    entries = [LeaderboardEntryResponse(**entry) for entry in leaderboard_data["entries"]]

    # Calculer le rang de l'utilisateur actuel
    user_rank = None
    user_score = None

    for entry in entries:
        if entry.user_id == current_user.id:
            user_rank = entry.rank
            user_score = entry.score
            break

    # Si l'utilisateur n'est pas dans le top, calculer son rang réel
    if user_rank is None:
        user_score = calculate_user_score(current_user, lb_type)
        score_column = get_score_column(lb_type)

        count_query = (
            select(func.count())
            .select_from(User)
            .join(UserGamification, User.id == UserGamification.user_id, isouter=True)
            .join(UserStats, User.id == UserStats.user_id, isouter=True)
            .where(
                and_(
                    User.is_deleted == False,
                    score_column > user_score
                )
            )
        )

        higher_count = await db.scalar(count_query)
        user_rank = (higher_count or 0) + 1

    return LeaderboardListResponse(
        leaderboard_type=leaderboard_type,
        period=period,
        entries=entries,
        total_participants=leaderboard_data["total_participants"],
        user_rank=user_rank,
        user_score=user_score
    )


@router.get("/university", response_model=LeaderboardListResponse)
async def get_university_leaderboard(
    leaderboard_type: str = Query("xp"),
    period: str = Query("all_time"),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Classement limité à l'université de l'utilisateur (avec cache Redis 5min)"""
    # Récupérer l'université de l'utilisateur depuis son profil
    user_university = current_user.profile.university if current_user.profile else None

    if not user_university:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous n'avez pas configuré votre université dans votre profil"
        )

    # Récupérer les données cachées du leaderboard
    leaderboard_data = await get_cached_leaderboard_data(
        leaderboard_type=leaderboard_type,
        period=period,
        limit=limit,
        university=user_university,
        db=db
    )

    lb_type = LeaderboardType(leaderboard_type)

    # Convertir les entrées en objets Pydantic
    entries = [LeaderboardEntryResponse(**entry) for entry in leaderboard_data["entries"]]

    # Calculer le rang de l'utilisateur actuel
    user_rank = None
    user_score = None

    for entry in entries:
        if entry.user_id == current_user.id:
            user_rank = entry.rank
            user_score = entry.score
            break

    if user_rank is None:
        user_score = calculate_user_score(current_user, lb_type)
        score_column = get_score_column(lb_type)

        count_query = (
            select(func.count())
            .select_from(User)
            .join(UserGamification, User.id == UserGamification.user_id, isouter=True)
            .join(UserStats, User.id == UserStats.user_id, isouter=True)
            .join(UserProfile, User.id == UserProfile.user_id, isouter=True)
            .where(
                and_(
                    User.is_deleted == False,
                    UserProfile.university == user_university,
                    score_column > user_score
                )
            )
        )

        higher_count = await db.scalar(count_query)
        user_rank = (higher_count or 0) + 1

    return LeaderboardListResponse(
        leaderboard_type=leaderboard_type,
        period=period,
        entries=entries,
        total_participants=leaderboard_data["total_participants"],
        user_rank=user_rank,
        user_score=user_score
    )


@router.get("/promotion", response_model=LeaderboardListResponse)
async def get_promotion_leaderboard(
    leaderboard_type: str = Query("xp"),
    period: str = Query("all_time"),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Classement limité à la promotion de l'utilisateur (avec cache Redis 5min)"""
    # Récupérer la promotion de l'utilisateur depuis son profil
    user_promotion = current_user.profile.promotion if current_user.profile else None

    if not user_promotion:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous n'avez pas configuré votre promotion dans votre profil"
        )

    # Récupérer les données cachées du leaderboard
    leaderboard_data = await get_cached_leaderboard_data(
        leaderboard_type=leaderboard_type,
        period=period,
        limit=limit,
        promotion=user_promotion,
        db=db
    )

    lb_type = LeaderboardType(leaderboard_type)

    # Convertir les entrées en objets Pydantic
    entries = [LeaderboardEntryResponse(**entry) for entry in leaderboard_data["entries"]]

    # Calculer le rang de l'utilisateur actuel
    user_rank = None
    user_score = None

    for entry in entries:
        if entry.user_id == current_user.id:
            user_rank = entry.rank
            user_score = entry.score
            break

    if user_rank is None:
        user_score = calculate_user_score(current_user, lb_type)
        score_column = get_score_column(lb_type)

        count_query = (
            select(func.count())
            .select_from(User)
            .join(UserGamification, User.id == UserGamification.user_id, isouter=True)
            .join(UserStats, User.id == UserStats.user_id, isouter=True)
            .join(UserProfile, User.id == UserProfile.user_id, isouter=True)
            .where(
                and_(
                    User.is_deleted == False,
                    UserProfile.promotion == user_promotion,
                    score_column > user_score
                )
            )
        )

        higher_count = await db.scalar(count_query)
        user_rank = (higher_count or 0) + 1

    return LeaderboardListResponse(
        leaderboard_type=leaderboard_type,
        period=period,
        entries=entries,
        total_participants=leaderboard_data["total_participants"],
        user_rank=user_rank,
        user_score=user_score
    )


# =============================================================================
# SCHEMAS LIGUES
# =============================================================================

class LeaguePositionResponse(BaseModel):
    user_id: int
    tier: str
    tier_name: str
    tier_icon: str
    tier_color: str
    weekly_xp: int
    rank: int
    total_in_league: int
    is_promotion_zone: bool
    is_demotion_zone: bool
    promotion_threshold: int
    demotion_threshold: Optional[int]
    next_tier: Optional[str]
    previous_tier: Optional[str]
    weeks_in_tier: int
    highest_tier: str


class LeagueEntryResponse(BaseModel):
    rank: int
    user_id: int
    username: str
    avatar_url: Optional[str]
    weekly_xp: int
    level: int
    current_streak: int
    is_promotion_zone: bool
    is_demotion_zone: bool


class LeagueInfoResponse(BaseModel):
    tier: str
    name: str
    icon: str
    color: str
    min_xp: int
    promotion_slots: int
    demotion_slots: int


# =============================================================================
# ENDPOINTS LIGUES
# =============================================================================

@router.get("/leagues/my-position", response_model=LeaguePositionResponse)
async def get_my_league_position(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupère la position de l'utilisateur connecté dans sa ligue.

    Retourne:
    - Ligue actuelle et ses infos
    - Position dans le classement
    - Zone de promotion/rétrogradation
    - Historique (semaines dans la ligue, plus haute ligue atteinte)
    """
    position = await leaderboard_service.get_user_league_position(db, current_user.id)
    return position


@router.get("/leagues/{tier}", response_model=List[LeagueEntryResponse])
async def get_league_leaderboard(
    tier: str,
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupère le classement d'une ligue spécifique.

    Paramètres:
    - tier: bronze, silver, gold, diamond, master
    - limit: nombre maximum de résultats (défaut: 30)
    """
    try:
        league_tier = LeagueTier(tier)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid tier: {tier}")

    leaderboard = await leaderboard_service.get_league_leaderboard(db, league_tier, limit)
    return leaderboard


@router.get("/leagues", response_model=List[LeagueInfoResponse])
async def get_all_leagues_info(
    current_user: User = Depends(get_current_user)
):
    """
    Récupère les informations de toutes les ligues.
    """
    leagues = []
    for tier in LeagueTier:
        config = LEAGUE_CONFIG[tier]
        leagues.append({
            "tier": tier.value,
            "name": config["name"],
            "icon": config["icon"],
            "color": config["color"],
            "min_xp": config["min_xp"],
            "promotion_slots": config["promotion_slots"],
            "demotion_slots": config["demotion_slots"],
        })

    return leagues
