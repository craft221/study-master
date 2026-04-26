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
from app.services.translation_service import async_bulk_achievement_translations

router = APIRouter()


def _localize(achievement_dict: dict, translations: dict) -> dict:
    """Replace name/description in a serialized achievement dict if a
    translation exists for its id. Mutates and returns the dict."""
    aid = achievement_dict.get("id")
    if aid in translations:
        name, desc = translations[aid]
        achievement_dict["name"] = name
        achievement_dict["description"] = desc
    return achievement_dict


@router.get("/", response_model=AchievementListResponse)
async def get_all_achievements(
    category: Optional[str] = None,
    rarity: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer tous les achievements disponibles (avec cache Redis 1h)"""
    lang = current_user.language or "fr"
    # Construire la clé de cache (lang-aware)
    cache_key_parts = ["achievements", "all", f"lang:{lang}"]
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

    # Lookup translations for all achievement ids in one query
    translations = await async_bulk_achievement_translations(
        db, [a.id for a in achievements], lang
    )

    response_data = {
        "achievements": [
            _localize(
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
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                },
                translations,
            )
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
    lang = current_user.language or "fr"
    cache_key = cache_service.generate_key(
        "achievements", f"user:{current_user.id}", f"lang:{lang}"
    )

    # Vérifier le cache
    cached_data = await cache_service.get(cache_key)
    if cached_data is not None:
        print(f"✅ Cache HIT: {cache_key}")
        return UserAchievementListResponse(**cached_data)

    print(f"❌ Cache MISS: {cache_key}")

    # OPTIMISATION: Utiliser selectinload pour éviter N+1 queries
    query = select(UserAchievement).where(
        UserAchievement.user_id == current_user.id
    ).options(
        selectinload(UserAchievement.achievement)
    ).order_by(UserAchievement.unlocked_at.desc())

    result = await db.execute(query)
    user_achievements = result.scalars().all()

    # Bulk-lookup translations for all linked achievements
    achievement_ids = [ua.achievement_id for ua in user_achievements]
    translations = await async_bulk_achievement_translations(db, achievement_ids, lang)

    # Les achievements sont maintenant déjà chargés via selectinload
    # Dédupliquer par achievement_id (garder le plus récent en cas de doublons)
    achievements_data = []
    seen_achievement_ids = set()
    total_xp = 0

    for ua in user_achievements:
        # Skip si on a déjà vu cet achievement (doublons)
        if ua.achievement_id in seen_achievement_ids:
            continue
        seen_achievement_ids.add(ua.achievement_id)

        achievement = ua.achievement  # Déjà chargé, pas de query supplémentaire
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
                "achievement": _localize(
                    {
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
                        "created_at": achievement.created_at.isoformat() if achievement.created_at else None,
                    },
                    translations,
                ),
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

    lang = current_user.language or "fr"
    cache_key = cache_service.generate_key(
        "achievements", f"user:{user_id}", f"lang:{lang}"
    )

    # Vérifier le cache
    cached_data = await cache_service.get(cache_key)
    if cached_data is not None:
        print(f"✅ Cache HIT: {cache_key}")
        return UserAchievementListResponse(**cached_data)

    print(f"❌ Cache MISS: {cache_key}")

    # OPTIMISATION: Utiliser selectinload pour éviter N+1 queries
    query = select(UserAchievement).where(
        UserAchievement.user_id == user_id
    ).options(
        selectinload(UserAchievement.achievement)
    ).order_by(UserAchievement.unlocked_at.desc())

    result = await db.execute(query)
    user_achievements = result.scalars().all()

    achievement_ids = [ua.achievement_id for ua in user_achievements]
    translations = await async_bulk_achievement_translations(db, achievement_ids, lang)

    # Les achievements sont maintenant déjà chargés via selectinload
    # Dédupliquer par achievement_id (garder le plus récent en cas de doublons)
    achievements_data = []
    seen_achievement_ids = set()
    total_xp = 0

    for ua in user_achievements:
        # Skip si on a déjà vu cet achievement (doublons)
        if ua.achievement_id in seen_achievement_ids:
            continue
        seen_achievement_ids.add(ua.achievement_id)

        achievement = ua.achievement  # Déjà chargé, pas de query supplémentaire
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
                "achievement": _localize(
                    {
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
                        "created_at": achievement.created_at.isoformat() if achievement.created_at else None,
                    },
                    translations,
                ),
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
    lang = current_user.language or "fr"
    cache_key = cache_service.generate_key(
        "achievement", str(achievement_id), f"lang:{lang}"
    )

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

    translations = await async_bulk_achievement_translations(
        db, [achievement.id], lang
    )
    achievement_data = _localize(
        {
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
            "created_at": achievement.created_at.isoformat() if achievement.created_at else None,
        },
        translations,
    )

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
        event_type="achievement_unlocked",
        db=db
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
    
    # Récupérer les achievements déjà débloqués (is_unlocked = True)
    unlocked_query = await db.execute(
        select(UserAchievement.achievement_id).where(
            and_(
                UserAchievement.user_id == current_user.id,
                UserAchievement.is_unlocked == True
            )
        )
    )
    already_unlocked_ids = set(unlocked_query.scalars().all())

    # Récupérer les UserAchievements en cours (is_unlocked = False) pour mise à jour
    pending_query = await db.execute(
        select(UserAchievement).where(
            and_(
                UserAchievement.user_id == current_user.id,
                UserAchievement.is_unlocked == False
            )
        )
    )
    pending_achievements = {ua.achievement_id: ua for ua in pending_query.scalars().all()}

    for achievement in achievements:
        if achievement.id in already_unlocked_ids:
            continue

        # Vérifier les conditions selon le requirement_type et requirement_value
        should_unlock = False
        req_type = achievement.requirement_type
        req_value = achievement.requirement_value

        # Logique de déblocage selon le type
        stats = current_user.stats
        gamification = current_user.gamification

        # LEARNING - Notes
        if req_type == "notes_created":
            if stats and stats.total_notes_created >= req_value:
                should_unlock = True

        # LEARNING - Flashcards
        elif req_type == "flashcards_created":
            if stats and stats.total_flashcards_created >= req_value:
                should_unlock = True
        elif req_type == "flashcards_reviewed":
            if stats and stats.total_flashcards_reviewed >= req_value:
                should_unlock = True

        # LEARNING - Quizzes
        elif req_type in ("quizzes_taken", "quizzes_completed"):
            if stats and stats.total_quizzes_completed >= req_value:
                should_unlock = True
        elif req_type == "perfect_quizzes":
            # Note: nécessite un compteur de quiz parfaits dans stats
            # Pour l'instant, on skip ce type
            pass

        # STREAK
        elif req_type == "streak_days":
            if gamification and gamification.current_streak >= req_value:
                should_unlock = True

        # MASTERY - Level
        elif req_type in ("level", "level_reached"):
            if gamification and gamification.level >= req_value:
                should_unlock = True

        # MASTERY - XP
        elif req_type in ("xp", "total_xp"):
            if gamification and gamification.total_xp >= req_value:
                should_unlock = True

        # SOCIAL - Duels
        elif req_type == "duels_participated":
            if stats and stats.total_duels_played >= req_value:
                should_unlock = True
        elif req_type == "duels_won":
            if stats and stats.duels_won >= req_value:
                should_unlock = True

        # SPECIAL - Account created (toujours vrai si l'utilisateur existe)
        elif req_type == "account_created":
            should_unlock = True

        # SPECIAL - PDF imports
        elif req_type == "pdf_imported":
            # Compter les notes avec tag 'ocr' ou 'pdf-import'
            # Note: tags est un champ JSON (liste), on utilise cast pour chercher
            from app.models.note import Note
            from sqlalchemy import cast, String
            pdf_count_query = await db.execute(
                select(func.count(Note.id)).where(
                    and_(
                        Note.user_id == current_user.id,
                        cast(Note.tags, String).ilike('%ocr%')
                    )
                )
            )
            pdf_count = pdf_count_query.scalar() or 0
            if pdf_count >= req_value:
                should_unlock = True

        # SPECIAL - Daily quests
        elif req_type == "daily_quests_completed":
            from app.models.daily_quest import DailyQuest
            quests_count_query = await db.execute(
                select(func.count(DailyQuest.id)).where(
                    and_(
                        DailyQuest.user_id == current_user.id,
                        DailyQuest.claimed_at.isnot(None)  # Quête réclamée
                    )
                )
            )
            quests_count = quests_count_query.scalar() or 0
            if quests_count >= req_value:
                should_unlock = True

        # SPECIAL - Study time
        elif req_type == "study_minutes":
            if stats and stats.total_study_time_minutes >= req_value:
                should_unlock = True

        # Débloquer si conditions remplies
        if should_unlock:
            now = utc_now()

            # Vérifier si un UserAchievement en attente existe déjà
            if achievement.id in pending_achievements:
                # Mettre à jour l'existant
                user_achievement = pending_achievements[achievement.id]
                user_achievement.progress = 100
                user_achievement.is_unlocked = True
                user_achievement.unlocked_at = now
            else:
                # Créer un nouveau
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
                event_type="achievement_unlocked",
                db=db
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
