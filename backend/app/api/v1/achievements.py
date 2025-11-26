from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.gamification import Achievement, UserAchievement, AchievementCategory, AchievementRarity
from app.schemas.gamification import (
    AchievementResponse,
    AchievementListResponse,
    UserAchievementResponse,
    UserAchievementListResponse
)

router = APIRouter()


@router.get("/", response_model=AchievementListResponse)
async def get_all_achievements(
    category: Optional[str] = None,
    rarity: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer tous les achievements disponibles"""
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
    
    return AchievementListResponse(
        achievements=achievements,
        total=len(achievements)
    )


@router.get("/user/me", response_model=UserAchievementListResponse)
async def get_my_achievements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les achievements de l'utilisateur connecté"""
    query = select(UserAchievement).where(
        UserAchievement.user_id == current_user.id
    ).order_by(UserAchievement.unlocked_at.desc())
    
    result = await db.execute(query)
    user_achievements = result.scalars().all()
    
    # Charger les achievements associés
    for ua in user_achievements:
        achievement = await db.get(Achievement, ua.achievement_id)
        ua.achievement = achievement
    
    # Calculer XP total gagné
    total_xp = sum(
        ua.achievement.xp_reward 
        for ua in user_achievements 
        if ua.achievement
    )
    
    return UserAchievementListResponse(
        achievements=user_achievements,
        total_unlocked=len(user_achievements),
        total_xp_earned=total_xp
    )


@router.get("/user/{user_id}", response_model=UserAchievementListResponse)
async def get_user_achievements(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les achievements d'un utilisateur spécifique"""
    # Vérifier que l'utilisateur existe
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    query = select(UserAchievement).where(
        UserAchievement.user_id == user_id
    ).order_by(UserAchievement.unlocked_at.desc())
    
    result = await db.execute(query)
    user_achievements = result.scalars().all()
    
    # Charger les achievements
    for ua in user_achievements:
        achievement = await db.get(Achievement, ua.achievement_id)
        ua.achievement = achievement
    
    total_xp = sum(
        ua.achievement.xp_reward 
        for ua in user_achievements 
        if ua.achievement
    )
    
    return UserAchievementListResponse(
        achievements=user_achievements,
        total_unlocked=len(user_achievements),
        total_xp_earned=total_xp
    )


@router.get("/{achievement_id}", response_model=AchievementResponse)
async def get_achievement(
    achievement_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer un achievement spécifique"""
    achievement = await db.get(Achievement, achievement_id)
    
    if not achievement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Achievement not found"
        )
    
    return achievement


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
        progress=100.0
    )
    
    db.add(user_achievement)
    
    # Récompenser XP
    current_user.total_xp += achievement.xp_reward
    current_user.level = (current_user.total_xp // 100) + 1
    
    # Incrémenter compteur achievement
    achievement.total_unlocked += 1
    
    await db.commit()
    await db.refresh(user_achievement)
    
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
        
        # Vérifier les conditions selon les requirements
        should_unlock = False
        requirements = achievement.requirements or {}
        
        # Exemple de logique de déblocage
        if achievement.category == AchievementCategory.STUDY_TIME:
            required_hours = requirements.get('hours', 0)
            # Cette logique serait à implémenter avec les vraies stats utilisateur
            
        elif achievement.category == AchievementCategory.NOTES:
            required_notes = requirements.get('count', 0)
            if current_user.total_notes_created >= required_notes:
                should_unlock = True
        
        elif achievement.category == AchievementCategory.FLASHCARDS:
            required_cards = requirements.get('count', 0)
            if current_user.total_flashcards_created >= required_cards:
                should_unlock = True
        
        elif achievement.category == AchievementCategory.QUIZZES:
            required_quizzes = requirements.get('count', 0)
            if current_user.total_quizzes_taken >= required_quizzes:
                should_unlock = True
        
        elif achievement.category == AchievementCategory.STREAK:
            required_streak = requirements.get('days', 0)
            if current_user.current_streak >= required_streak:
                should_unlock = True
        
        elif achievement.category == AchievementCategory.LEVEL:
            required_level = requirements.get('level', 0)
            if current_user.level >= required_level:
                should_unlock = True
        
        # Débloquer si conditions remplies
        if should_unlock:
            user_achievement = UserAchievement(
                user_id=current_user.id,
                achievement_id=achievement.id,
                progress=100.0
            )
            db.add(user_achievement)
            
            # Récompenser XP
            current_user.total_xp += achievement.xp_reward
            current_user.level = (current_user.total_xp // 100) + 1
            
            achievement.total_unlocked += 1
            
            user_achievement.achievement = achievement
            unlocked.append(user_achievement)
    
    if unlocked:
        await db.commit()
        for ua in unlocked:
            await db.refresh(ua)
    
    return unlocked
