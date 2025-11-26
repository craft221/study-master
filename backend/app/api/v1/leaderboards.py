from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, case
from typing import List, Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.gamification import Leaderboard, LeaderboardType, LeaderboardPeriod
from app.schemas.gamification import (
    LeaderboardResponse,
    LeaderboardEntryResponse
)

router = APIRouter()


async def calculate_user_score(user: User, leaderboard_type: LeaderboardType) -> int:
    """Calculer le score d'un utilisateur selon le type de classement"""
    if leaderboard_type == LeaderboardType.XP:
        return user.total_xp
    elif leaderboard_type == LeaderboardType.STREAK:
        return user.current_streak
    elif leaderboard_type == LeaderboardType.NOTES:
        return user.total_notes_created
    elif leaderboard_type == LeaderboardType.FLASHCARDS:
        return user.total_flashcards_created
    elif leaderboard_type == LeaderboardType.QUIZZES:
        return user.total_quizzes_taken
    elif leaderboard_type == LeaderboardType.STUDY_TIME:
        # À implémenter avec les vraies stats de StudySession
        return 0
    return 0


@router.get("/", response_model=LeaderboardResponse)
async def get_leaderboard(
    leaderboard_type: str = Query("xp", description="Type: xp, streak, notes, flashcards, quizzes, study_time"),
    period: str = Query("all_time", description="Period: daily, weekly, monthly, all_time"),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer un classement général"""
    try:
        lb_type = LeaderboardType(leaderboard_type)
        lb_period = LeaderboardPeriod(period)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid leaderboard type or period"
        )
    
    # Filtre de date selon la période
    date_filter = None
    if lb_period == LeaderboardPeriod.DAILY:
        date_filter = datetime.utcnow() - timedelta(days=1)
    elif lb_period == LeaderboardPeriod.WEEKLY:
        date_filter = datetime.utcnow() - timedelta(days=7)
    elif lb_period == LeaderboardPeriod.MONTHLY:
        date_filter = datetime.utcnow() - timedelta(days=30)
    
    # Construire la requête selon le type
    if lb_type == LeaderboardType.XP:
        score_column = User.total_xp
    elif lb_type == LeaderboardType.STREAK:
        score_column = User.current_streak
    elif lb_type == LeaderboardType.NOTES:
        score_column = User.total_notes_created
    elif lb_type == LeaderboardType.FLASHCARDS:
        score_column = User.total_flashcards_created
    elif lb_type == LeaderboardType.QUIZZES:
        score_column = User.total_quizzes_taken
    else:
        score_column = User.total_xp
    
    query = select(User).where(
        and_(
            User.is_deleted == False,
            score_column > 0
        )
    ).order_by(desc(score_column)).limit(limit)
    
    if date_filter and lb_period != LeaderboardPeriod.ALL_TIME:
        query = query.where(User.updated_at >= date_filter)
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    # Construire les entrées du classement
    entries = []
    user_rank = None
    user_score = None
    
    for rank, user in enumerate(users, start=1):
        score = await calculate_user_score(user, lb_type)
        
        entry = LeaderboardEntryResponse(
            rank=rank,
            user_id=user.id,
            username=user.username,
            avatar_url=user.avatar_url,
            score=score,
            university=user.university,
            promotion=user.promotion
        )
        entries.append(entry)
        
        if user.id == current_user.id:
            user_rank = rank
            user_score = score
    
    # Si l'utilisateur n'est pas dans le top, calculer son rang réel
    if user_rank is None:
        user_score = await calculate_user_score(current_user, lb_type)
        count_query = select(func.count()).select_from(User).where(
            and_(
                User.is_deleted == False,
                score_column > user_score
            )
        )
        if date_filter and lb_period != LeaderboardPeriod.ALL_TIME:
            count_query = count_query.where(User.updated_at >= date_filter)
        
        higher_count = await db.scalar(count_query)
        user_rank = (higher_count or 0) + 1
    
    return LeaderboardResponse(
        leaderboard_type=lb_type,
        period=lb_period,
        entries=entries,
        total_participants=len(entries),
        user_rank=user_rank,
        user_score=user_score
    )


@router.get("/university", response_model=LeaderboardResponse)
async def get_university_leaderboard(
    leaderboard_type: str = Query("xp"),
    period: str = Query("all_time"),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Classement limité à l'université de l'utilisateur"""
    if not current_user.university:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has no university set"
        )
    
    try:
        lb_type = LeaderboardType(leaderboard_type)
        lb_period = LeaderboardPeriod(period)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid leaderboard type or period"
        )
    
    # Filtre de date
    date_filter = None
    if lb_period == LeaderboardPeriod.DAILY:
        date_filter = datetime.utcnow() - timedelta(days=1)
    elif lb_period == LeaderboardPeriod.WEEKLY:
        date_filter = datetime.utcnow() - timedelta(days=7)
    elif lb_period == LeaderboardPeriod.MONTHLY:
        date_filter = datetime.utcnow() - timedelta(days=30)
    
    # Score column
    if lb_type == LeaderboardType.XP:
        score_column = User.total_xp
    elif lb_type == LeaderboardType.STREAK:
        score_column = User.current_streak
    elif lb_type == LeaderboardType.NOTES:
        score_column = User.total_notes_created
    elif lb_type == LeaderboardType.FLASHCARDS:
        score_column = User.total_flashcards_created
    elif lb_type == LeaderboardType.QUIZZES:
        score_column = User.total_quizzes_taken
    else:
        score_column = User.total_xp
    
    query = select(User).where(
        and_(
            User.is_deleted == False,
            User.university == current_user.university,
            score_column > 0
        )
    ).order_by(desc(score_column)).limit(limit)
    
    if date_filter:
        query = query.where(User.updated_at >= date_filter)
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    entries = []
    user_rank = None
    user_score = None
    
    for rank, user in enumerate(users, start=1):
        score = await calculate_user_score(user, lb_type)
        
        entry = LeaderboardEntryResponse(
            rank=rank,
            user_id=user.id,
            username=user.username,
            avatar_url=user.avatar_url,
            score=score,
            university=user.university,
            promotion=user.promotion
        )
        entries.append(entry)
        
        if user.id == current_user.id:
            user_rank = rank
            user_score = score
    
    if user_rank is None:
        user_score = await calculate_user_score(current_user, lb_type)
        count_query = select(func.count()).select_from(User).where(
            and_(
                User.is_deleted == False,
                User.university == current_user.university,
                score_column > user_score
            )
        )
        if date_filter:
            count_query = count_query.where(User.updated_at >= date_filter)
        
        higher_count = await db.scalar(count_query)
        user_rank = (higher_count or 0) + 1
    
    return LeaderboardResponse(
        leaderboard_type=lb_type,
        period=lb_period,
        entries=entries,
        total_participants=len(entries),
        user_rank=user_rank,
        user_score=user_score
    )


@router.get("/promotion", response_model=LeaderboardResponse)
async def get_promotion_leaderboard(
    leaderboard_type: str = Query("xp"),
    period: str = Query("all_time"),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Classement limité à la promotion de l'utilisateur"""
    if not current_user.promotion:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has no promotion set"
        )
    
    try:
        lb_type = LeaderboardType(leaderboard_type)
        lb_period = LeaderboardPeriod(period)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid leaderboard type or period"
        )
    
    date_filter = None
    if lb_period == LeaderboardPeriod.DAILY:
        date_filter = datetime.utcnow() - timedelta(days=1)
    elif lb_period == LeaderboardPeriod.WEEKLY:
        date_filter = datetime.utcnow() - timedelta(days=7)
    elif lb_period == LeaderboardPeriod.MONTHLY:
        date_filter = datetime.utcnow() - timedelta(days=30)
    
    if lb_type == LeaderboardType.XP:
        score_column = User.total_xp
    elif lb_type == LeaderboardType.STREAK:
        score_column = User.current_streak
    elif lb_type == LeaderboardType.NOTES:
        score_column = User.total_notes_created
    elif lb_type == LeaderboardType.FLASHCARDS:
        score_column = User.total_flashcards_created
    elif lb_type == LeaderboardType.QUIZZES:
        score_column = User.total_quizzes_taken
    else:
        score_column = User.total_xp
    
    query = select(User).where(
        and_(
            User.is_deleted == False,
            User.promotion == current_user.promotion,
            score_column > 0
        )
    ).order_by(desc(score_column)).limit(limit)
    
    if date_filter:
        query = query.where(User.updated_at >= date_filter)
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    entries = []
    user_rank = None
    user_score = None
    
    for rank, user in enumerate(users, start=1):
        score = await calculate_user_score(user, lb_type)
        
        entry = LeaderboardEntryResponse(
            rank=rank,
            user_id=user.id,
            username=user.username,
            avatar_url=user.avatar_url,
            score=score,
            university=user.university,
            promotion=user.promotion
        )
        entries.append(entry)
        
        if user.id == current_user.id:
            user_rank = rank
            user_score = score
    
    if user_rank is None:
        user_score = await calculate_user_score(current_user, lb_type)
        count_query = select(func.count()).select_from(User).where(
            and_(
                User.is_deleted == False,
                User.promotion == current_user.promotion,
                score_column > user_score
            )
        )
        if date_filter:
            count_query = count_query.where(User.updated_at >= date_filter)
        
        higher_count = await db.scalar(count_query)
        user_rank = (higher_count or 0) + 1
    
    return LeaderboardResponse(
        leaderboard_type=lb_type,
        period=lb_period,
        entries=entries,
        total_participants=len(entries),
        user_rank=user_rank,
        user_score=user_score
    )
