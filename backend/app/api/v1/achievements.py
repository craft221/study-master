from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.security import get_current_user
from app.models.user import User
from app.models.gamification import Achievement, UserAchievement, AchievementCategory, AchievementRarity
from app.schemas.gamification import (
    AchievementResponse,
    AchievementListResponse,
    UserAchievementResponse,
    UserAchievementListResponse
)
from app.services.cache_service import cache_service
from app.services.xp_service import award_xp

router = APIRouter()


@router.get("/", response_model=AchievementListResponse)
async def get_all_achievements(
    category: Optional[str] = None,
    rarity: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer tous les achievements disponibles (avec cache Redis 1h)"""
    # Construire la clé de cache
    cache_key_parts = ["achievements", "all"]
    if category:
        cache_key_parts.append(f"cat:{category}")
    if rarity:
        cache_key_parts.append(f"rarity:{rarity}")

    cache_key = cache_service.generate_key(*cache_key_parts)

    # Vérifier le cache
    cached_data = await cache_service.get(cache_key)
    if cached_data is not None:
        print(f"✅ Cache HIT: {cache_key}")
        return AchievementListResponse(**cached_data)

    print(f"❌ Cache MISS: {cache_key}")

    query = select(Achievement)

    if category:
        try:
            cat_enum = AchievementCategory(category)
            query = query.where(Achievement.category == cat_enum)
        except ValueError:
            pass

    if rarity:
        try:
            rarity_enum = AchievementRarity(rarity)
            query = query.where(Achievement.rarity == rarity_enum)
        except ValueError:
            pass

    query = query.order_by(Achievement.category, Achievement.rarity.desc())

    result = await db.execute(query)
    achievements = result.scalars().all()

    response_data = {
        "achievements": [
            {
                "id": a.id,
                "name": a.name,
                "description": a.description,
                "category": a.category.value if a.category else None,
                "rarity": a.rarity.value if a.rarity else None,
                "icon": a.icon,
                "xp_reward": a.xp_reward,
                "requirement_value": a.requirement_value,
                "requirement_type": a.requirement_type,
                "is_active": a.is_active,
                "created_at": a.created_at.isoformat() if a.created_at else None
            }
            for a in achievements
        ],
        "total": len(achievements)
    }

    # Mettre en cache pour 1 heure (3600s)
    await cache_service.set(cache_key, response_data, ttl=3600)

    return AchievementListResponse(**response_data)


@router.get("/user/me", response_model=UserAchievementListResponse)
async def get_my_achievements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les achievements de l'utilisateur connecté (avec cache Redis 2min)"""
    cache_key = cache_service.generate_key("achievements", f"user:{current_user.id}")

    # Vérifier le cache
    cached_data = await cache_service.get(cache_key)
    if cached_data is not None:
        print(f"✅ Cache HIT: {cache_key}")
        return UserAchievementListResponse(**cached_data)

    print(f"❌ Cache MISS: {cache_key}")

    query = select(UserAchievement).where(
        UserAchievement.user_id == current_user.id
    ).order_by(UserAchievement.unlocked_at.desc())

    result = await db.execute(query)
    user_achievements = result.scalars().all()

    # Charger les achievements associés
    achievements_data = []
    total_xp = 0

    for ua in user_achievements:
        achievement = await db.get(Achievement, ua.achievement_id)
        if achievement:
            total_xp += achievement.xp_reward
            achievements_data.append({
                "id": ua.id,
                "user_id": ua.user_id,
                "achievement_id": ua.achievement_id,
                "unlocked_at": ua.unlocked_at.isoformat() if ua.unlocked_at else None,
                "progress": ua.progress,
                "is_unlocked": ua.is_unlocked,
                "created_at": ua.created_at.isoformat() if ua.created_at else None,
                "achievement": {
                    "id": achievement.id,
                    "name": achievement.name,
                    "description": achievement.description,
                    "category": achievement.category.value if achievement.category else None,
                    "rarity": achievement.rarity.value if achievement.rarity else None,
                    "icon": achievement.icon,
                    "xp_reward": achievement.xp_reward,
                    "requirement_value": achievement.requirement_value,
                    "requirement_type": achievement.requirement_type,
                    "is_active": achievement.is_active,
                    "created_at": achievement.created_at.isoformat() if achievement.created_at else None
                }
            })

    response_data = {
        "achievements": achievements_data,
        "total": len(achievements_data)
    }

    # Mettre en cache pour 2 minutes (120s)
    await cache_service.set(cache_key, response_data, ttl=120)

    return UserAchievementListResponse(**response_data)


@router.get("/user/{user_id}", response_model=UserAchievementListResponse)
async def get_user_achievements(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les achievements d'un utilisateur spécifique (avec cache Redis 5min)"""
    # Vérifier que l'utilisateur existe
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    cache_key = cache_service.generate_key("achievements", f"user:{user_id}")

    # Vérifier le cache
    cached_data = await cache_service.get(cache_key)
    if cached_data is not None:
        print(f"✅ Cache HIT: {cache_key}")
        return UserAchievementListResponse(**cached_data)

    print(f"❌ Cache MISS: {cache_key}")

    query = select(UserAchievement).where(
        UserAchievement.user_id == user_id
    ).order_by(UserAchievement.unlocked_at.desc())

    result = await db.execute(query)
    user_achievements = result.scalars().all()

    # Charger les achievements
    achievements_data = []
    total_xp = 0

    for ua in user_achievements:
        achievement = await db.get(Achievement, ua.achievement_id)
        if achievement:
            total_xp += achievement.xp_reward
            achievements_data.append({
                "id": ua.id,
                "user_id": ua.user_id,
                "achievement_id": ua.achievement_id,
                "unlocked_at": ua.unlocked_at.isoformat() if ua.unlocked_at else None,
                "progress": ua.progress,
                "is_unlocked": ua.is_unlocked,
                "created_at": ua.created_at.isoformat() if ua.created_at else None,
                "achievement": {
                    "id": achievement.id,
                    "name": achievement.name,
                    "description": achievement.description,
                    "category": achievement.category.value if achievement.category else None,
                    "rarity": achievement.rarity.value if achievement.rarity else None,
                    "icon": achievement.icon,
                    "xp_reward": achievement.xp_reward,
                    "requirement_value": achievement.requirement_value,
                    "requirement_type": achievement.requirement_type,
                    "is_active": achievement.is_active,
                    "created_at": achievement.created_at.isoformat() if achievement.created_at else None
                }
            })

    response_data = {
        "achievements": achievements_data,
        "total": len(achievements_data)
    }

    # Mettre en cache pour 5 minutes (300s)
    await cache_service.set(cache_key, response_data, ttl=300)

    return UserAchievementListResponse(**response_data)


@router.get("/{achievement_id}", response_model=AchievementResponse)
async def get_achievement(
    achievement_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer un achievement spécifique (avec cache Redis 1h)"""
    cache_key = cache_service.generate_key("achievement", str(achievement_id))

    # Vérifier le cache
    cached_data = await cache_service.get(cache_key)
    if cached_data is not None:
        print(f"✅ Cache HIT: {cache_key}")
        return AchievementResponse(**cached_data)

    print(f"❌ Cache MISS: {cache_key}")

    achievement = await db.get(Achievement, achievement_id)

    if not achievement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Achievement not found"
        )

    achievement_data = {
        "id": achievement.id,
        "name": achievement.name,
        "description": achievement.description,
        "category": achievement.category.value if achievement.category else None,
        "rarity": achievement.rarity.value if achievement.rarity else None,
        "icon": achievement.icon,
        "xp_reward": achievement.xp_reward,
        "requirement_value": achievement.requirement_value,
        "requirement_type": achievement.requirement_type,
        "is_active": achievement.is_active,
        "created_at": achievement.created_at.isoformat() if achievement.created_at else None
    }

    # Mettre en cache pour 1 heure (3600s)
    await cache_service.set(cache_key, achievement_data, ttl=3600)

    return AchievementResponse(**achievement_data)


@router.post("/unlock/{achievement_id}", response_model=UserAchievementResponse)
async def unlock_achievement(
    achievement_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Débloquer un achievement pour l'utilisateur"""
    # Vérifier que l'achievement existe
    achievement = await db.get(Achievement, achievement_id)
    if not achievement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Achievement not found"
        )
    
    # Vérifier si déjà débloqué
    existing = await db.execute(
        select(UserAchievement).where(
            and_(
                UserAchievement.user_id == current_user.id,
                UserAchievement.achievement_id == achievement_id
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Achievement already unlocked"
        )
    
    # Créer le déblocage
    user_achievement = UserAchievement(
        user_id=current_user.id,
        achievement_id=achievement_id,
        progress=100,
        is_unlocked=True,
        unlocked_at=utc_now()
    )

    db.add(user_achievement)

    # Récompenser XP
    await award_xp(
        user=current_user,
        amount=achievement.xp_reward,
        reason=f"Achievement débloqué: {achievement.name}",
        event_type="achievement_unlocked"
    )

    await db.commit()
    await db.refresh(user_achievement)

    # Invalider le cache achievements de l'utilisateur
    await cache_service.delete_pattern(f"cache:achievements:user:{current_user.id}*")
    await cache_service.invalidate_achievements_cache()
    await cache_service.invalidate_user_cache(current_user.id)
    await cache_service.invalidate_leaderboard_cache()

    # Charger l'achievement pour la réponse
    user_achievement.achievement = achievement

    return user_achievement


@router.post("/check-progress", response_model=List[UserAchievementResponse])
async def check_achievement_progress(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Vérifier et débloquer automatiquement les achievements selon la progression"""
    unlocked = []
    
    # Récupérer tous les achievements
    all_achievements = await db.execute(select(Achievement))
    achievements = all_achievements.scalars().all()
    
    # Récupérer les achievements déjà débloqués
    unlocked_query = await db.execute(
        select(UserAchievement.achievement_id).where(
            UserAchievement.user_id == current_user.id
        )
    )
    unlocked_ids = set(unlocked_query.scalars().all())
    
    for achievement in achievements:
        if achievement.id in unlocked_ids:
            continue

        # Vérifier les conditions selon le requirement_type et requirement_value
        should_unlock = False
        req_type = achievement.requirement_type
        req_value = achievement.requirement_value

        # Logique de déblocage selon le type
        if req_type == "notes_created":
            if current_user.total_notes_created >= req_value:
                should_unlock = True
        elif req_type == "flashcards_created":
            if current_user.total_flashcards_created >= req_value:
                should_unlock = True
        elif req_type == "flashcards_reviewed":
            if current_user.total_flashcards_reviewed >= req_value:
                should_unlock = True
        elif req_type == "quizzes_taken":
            if current_user.total_quizzes_taken >= req_value:
                should_unlock = True
        elif req_type == "streak_days":
            if current_user.current_streak >= req_value:
                should_unlock = True
        elif req_type == "level":
            if current_user.level >= req_value:
                should_unlock = True
        elif req_type == "xp":
            if current_user.total_xp >= req_value:
                should_unlock = True

        # Débloquer si conditions remplies
        if should_unlock:
            now = utc_now()
            user_achievement = UserAchievement(
                user_id=current_user.id,
                achievement_id=achievement.id,
                progress=100,
                is_unlocked=True,
                unlocked_at=now,
                created_at=now
            )
            db.add(user_achievement)

            # Récompenser XP
            await award_xp(
                user=current_user,
                amount=achievement.xp_reward,
                reason=f"Achievement débloqué: {achievement.name}",
                event_type="achievement_unlocked"
            )

            unlocked.append((user_achievement, achievement))

    if unlocked:
        await db.commit()

        # Recharger les UserAchievements avec la relation achievement
        unlocked_ids = []
        for ua, _ in unlocked:
            await db.refresh(ua)
            unlocked_ids.append(ua.id)

        # Charger les achievements avec selectinload
        result = await db.execute(
            select(UserAchievement)
            .options(selectinload(UserAchievement.achievement))
            .where(UserAchievement.id.in_(unlocked_ids))
        )
        unlocked_achievements = result.scalars().all()

        # Invalider le cache achievements de l'utilisateur
        await cache_service.delete_pattern(f"cache:achievements:user:{current_user.id}*")
        await cache_service.invalidate_achievements_cache()
        await cache_service.invalidate_user_cache(current_user.id)
        await cache_service.invalidate_leaderboard_cache()

        return list(unlocked_achievements)

    return []
