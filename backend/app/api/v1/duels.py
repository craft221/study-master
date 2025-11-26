from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.gamification import Duel, DuelStatus
from app.models.subject import Subject
from app.models.quiz import Quiz, QuizAttempt
from app.schemas.gamification import (
    DuelCreate,
    DuelResponse,
    DuelListResponse
)

router = APIRouter()


@router.post("/", response_model=DuelResponse, status_code=status.HTTP_201_CREATED)
async def create_duel(
    duel_data: DuelCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lancer un défi à un autre étudiant"""
    # Vérifier que l'adversaire existe
    opponent = await db.get(User, duel_data.opponent_id)
    if not opponent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opponent not found"
        )
    
    if opponent.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot challenge yourself"
        )
    
    # Vérifier le sujet
    subject = await db.get(Subject, duel_data.subject_id)
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found"
        )
    
    # Vérifier le quiz si fourni
    if duel_data.quiz_id:
        quiz = await db.get(Quiz, duel_data.quiz_id)
        if not quiz or quiz.subject_id != duel_data.subject_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quiz not found or doesn't match subject"
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
    
    return new_duel


@router.get("/", response_model=DuelListResponse)
async def get_duels(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les duels de l'utilisateur"""
    # Duels où l'utilisateur est challenger ou opponent
    query = select(Duel).where(
        or_(
            Duel.challenger_id == current_user.id,
            Duel.opponent_id == current_user.id
        )
    )
    
    if status_filter:
        try:
            status_enum = DuelStatus(status_filter)
            query = query.where(Duel.status == status_enum)
        except ValueError:
            pass
    
    query = query.order_by(Duel.created_at.desc())
    
    # Compte total
    count_query = select(func.count()).select_from(Duel).where(
        or_(
            Duel.challenger_id == current_user.id,
            Duel.opponent_id == current_user.id
        )
    )
    if status_filter:
        try:
            status_enum = DuelStatus(status_filter)
            count_query = count_query.where(Duel.status == status_enum)
        except ValueError:
            pass
    
    total = await db.scalar(count_query)
    
    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    result = await db.execute(query)
    duels = result.scalars().all()
    
    return DuelListResponse(
        duels=duels,
        total=total or 0,
        page=page,
        page_size=page_size
    )


@router.get("/pending", response_model=List[DuelResponse])
async def get_pending_duels(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les défis en attente où l'utilisateur est l'adversaire"""
    query = select(Duel).where(
        and_(
            Duel.opponent_id == current_user.id,
            Duel.status == DuelStatus.PENDING
        )
    ).order_by(Duel.created_at.desc())
    
    result = await db.execute(query)
    duels = result.scalars().all()
    
    return duels


@router.get("/{duel_id}", response_model=DuelResponse)
async def get_duel(
    duel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer un duel spécifique"""
    duel = await db.get(Duel, duel_id)
    
    if not duel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Duel not found"
        )
    
    # Vérifier que l'utilisateur est impliqué
    if duel.challenger_id != current_user.id and duel.opponent_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return duel


@router.post("/{duel_id}/accept", response_model=DuelResponse)
async def accept_duel(
    duel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Accepter un défi"""
    duel = await db.get(Duel, duel_id)
    
    if not duel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Duel not found"
        )
    
    # Seul l'adversaire peut accepter
    if duel.opponent_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the opponent can accept the duel"
        )
    
    if duel.status != DuelStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Duel is not pending (status: {duel.status})"
        )
    
    duel.status = DuelStatus.ACTIVE
    duel.started_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(duel)
    
    return duel


@router.post("/{duel_id}/decline", response_model=DuelResponse)
async def decline_duel(
    duel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Refuser un défi"""
    duel = await db.get(Duel, duel_id)
    
    if not duel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Duel not found"
        )
    
    if duel.opponent_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the opponent can decline the duel"
        )
    
    if duel.status != DuelStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duel is not pending"
        )
    
    duel.status = DuelStatus.CANCELLED
    
    await db.commit()
    await db.refresh(duel)
    
    return duel


@router.post("/{duel_id}/complete", response_model=DuelResponse)
async def complete_duel(
    duel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Compléter un duel et déterminer le gagnant"""
    duel = await db.get(Duel, duel_id)
    
    if not duel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Duel not found"
        )
    
    if duel.status != DuelStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duel is not active"
        )
    
    # Récupérer les tentatives de quiz si un quiz est associé
    if duel.quiz_id:
        # Meilleure tentative du challenger
        challenger_query = select(QuizAttempt).where(
            and_(
                QuizAttempt.quiz_id == duel.quiz_id,
                QuizAttempt.user_id == duel.challenger_id,
                QuizAttempt.started_at >= duel.started_at
            )
        ).order_by(QuizAttempt.score.desc()).limit(1)
        
        challenger_result = await db.execute(challenger_query)
        challenger_attempt = challenger_result.scalar_one_or_none()
        
        # Meilleure tentative de l'adversaire
        opponent_query = select(QuizAttempt).where(
            and_(
                QuizAttempt.quiz_id == duel.quiz_id,
                QuizAttempt.user_id == duel.opponent_id,
                QuizAttempt.started_at >= duel.started_at
            )
        ).order_by(QuizAttempt.score.desc()).limit(1)
        
        opponent_result = await db.execute(opponent_query)
        opponent_attempt = opponent_result.scalar_one_or_none()
        
        # Scores
        duel.challenger_score = challenger_attempt.score if challenger_attempt else 0.0
        duel.opponent_score = opponent_attempt.score if opponent_attempt else 0.0
    else:
        # Sans quiz, scores manuels (à implémenter selon les besoins)
        duel.challenger_score = 0.0
        duel.opponent_score = 0.0
    
    # Déterminer le gagnant
    if duel.challenger_score > duel.opponent_score:
        duel.winner_id = duel.challenger_id
        winner = await db.get(User, duel.challenger_id)
        loser = await db.get(User, duel.opponent_id)
    elif duel.opponent_score > duel.challenger_score:
        duel.winner_id = duel.opponent_id
        winner = await db.get(User, duel.opponent_id)
        loser = await db.get(User, duel.challenger_id)
    else:
        # Égalité - pas de gagnant, remboursement XP
        duel.status = DuelStatus.COMPLETED
        duel.ended_at = datetime.utcnow()
        await db.commit()
        await db.refresh(duel)
        return duel
    
    # Transfert XP
    if winner and loser:
        winner.total_xp += duel.stakes_xp
        winner.level = (winner.total_xp // 100) + 1
        
        # Le perdant perd des XP (mais pas en dessous de 0)
        loser.total_xp = max(0, loser.total_xp - duel.stakes_xp)
        loser.level = (loser.total_xp // 100) + 1
    
    duel.status = DuelStatus.COMPLETED
    duel.ended_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(duel)
    
    return duel


@router.delete("/{duel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_duel(
    duel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Annuler un duel (seulement si pending et par le challenger)"""
    duel = await db.get(Duel, duel_id)
    
    if not duel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Duel not found"
        )
    
    if duel.challenger_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the challenger can cancel the duel"
        )
    
    if duel.status != DuelStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only cancel pending duels"
        )
    
    await db.delete(duel)
    await db.commit()
    
    return None
