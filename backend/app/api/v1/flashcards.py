from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.subject import Subject
from app.models.flashcard import Flashcard, FlashcardReview, FlashcardStatus
from app.schemas.flashcard import (
    FlashcardCreate,
    FlashcardUpdate,
    FlashcardResponse,
    FlashcardListResponse,
    FlashcardReviewRequest,
    FlashcardReviewResponse,
    FlashcardStatsResponse,
    FlashcardReviewHistoryResponse
)

router = APIRouter()


@router.post("/", response_model=FlashcardResponse, status_code=status.HTTP_201_CREATED)
async def create_flashcard(
    flashcard_data: FlashcardCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Créer une nouvelle flashcard"""
    
    # Vérifier que la matière existe et appartient à l'utilisateur
    result = await db.execute(
        select(Subject).where(
            and_(
                Subject.id == flashcard_data.subject_id,
                Subject.user_id == current_user.id
            )
        )
    )
    subject = result.scalar_one_or_none()
    
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Matière non trouvée"
        )
    
    # Créer la flashcard
    new_flashcard = Flashcard(
        user_id=current_user.id,
        **flashcard_data.model_dump()
    )
    
    db.add(new_flashcard)
    
    # Mettre à jour les statistiques utilisateur et matière
    subject.total_flashcards_count += 1
    current_user.total_xp += 5
    current_user.total_flashcards_created += 1
    
    await db.commit()
    await db.refresh(new_flashcard)
    
    return new_flashcard


@router.get("/", response_model=FlashcardListResponse)
async def list_flashcards(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    subject_id: Optional[int] = None,
    status: Optional[FlashcardStatus] = None,
    deck_name: Optional[str] = None,
    is_favorite: Optional[bool] = None,
    is_suspended: Optional[bool] = None,
    tags: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer la liste des flashcards avec filtres"""
    
    query = select(Flashcard).where(Flashcard.user_id == current_user.id)
    
    # Appliquer les filtres
    if subject_id:
        query = query.where(Flashcard.subject_id == subject_id)
    if status:
        query = query.where(Flashcard.status == status)
    if deck_name:
        query = query.where(Flashcard.deck_name == deck_name)
    if is_favorite is not None:
        query = query.where(Flashcard.is_favorite == is_favorite)
    if is_suspended is not None:
        query = query.where(Flashcard.is_suspended == is_suspended)
    if tags:
        query = query.where(Flashcard.tags.ilike(f"%{tags}%"))
    
    # Compter le total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Pagination et tri
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(Flashcard.created_at.desc())
    
    result = await db.execute(query)
    flashcards = result.scalars().all()
    
    return {
        "flashcards": flashcards,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/due", response_model=FlashcardListResponse)
async def get_due_flashcards(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    subject_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les flashcards à réviser aujourd'hui"""
    
    now = datetime.now()
    
    query = select(Flashcard).where(
        and_(
            Flashcard.user_id == current_user.id,
            Flashcard.next_review_at <= now,
            Flashcard.is_suspended == False,
            Flashcard.is_buried == False
        )
    )
    
    # Filtre optionnel par matière
    if subject_id:
        query = query.where(Flashcard.subject_id == subject_id)
    
    # Compter le total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Pagination et tri (les plus anciennes d'abord)
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(Flashcard.next_review_at.asc())
    
    result = await db.execute(query)
    flashcards = result.scalars().all()
    
    return {
        "flashcards": flashcards,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/{flashcard_id}", response_model=FlashcardResponse)
async def get_flashcard(
    flashcard_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les détails d'une flashcard"""
    
    result = await db.execute(
        select(Flashcard).where(
            and_(
                Flashcard.id == flashcard_id,
                Flashcard.user_id == current_user.id
            )
        )
    )
    flashcard = result.scalar_one_or_none()
    
    if not flashcard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard non trouvée"
        )
    
    return flashcard


@router.post("/{flashcard_id}/review", response_model=FlashcardReviewResponse)
async def review_flashcard(
    flashcard_id: int,
    review_data: FlashcardReviewRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Réviser une flashcard avec l'algorithme SM-2"""
    
    # Récupérer la flashcard
    result = await db.execute(
        select(Flashcard).where(
            and_(
                Flashcard.id == flashcard_id,
                Flashcard.user_id == current_user.id
            )
        )
    )
    flashcard = result.scalar_one_or_none()
    
    if not flashcard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard non trouvée"
        )
    
    # Sauvegarder l'état avant révision
    ease_factor_before = flashcard.ease_factor
    interval_before = flashcard.interval
    
    # Mettre à jour la flashcard avec l'algorithme SM-2
    flashcard.update_after_review(review_data.quality, review_data.response_time_seconds)
    
    # Créer l'enregistrement de révision
    review_record = FlashcardReview(
        user_id=current_user.id,
        flashcard_id=flashcard.id,
        quality=review_data.quality,
        response_time_seconds=review_data.response_time_seconds,
        ease_factor_before=ease_factor_before,
        interval_before=interval_before,
        ease_factor_after=flashcard.ease_factor,
        interval_after=flashcard.interval,
        next_review_at=flashcard.next_review_at
    )
    db.add(review_record)
    
    # Attribuer des XP
    xp_earned = 2  # XP de base pour révision
    if review_data.quality >= 2:  # GOOD ou EASY
        xp_earned = 3
    if review_data.quality == 3:  # EASY
        xp_earned = 4
    
    current_user.total_xp += xp_earned
    current_user.total_flashcards_reviewed += 1
    
    await db.commit()
    await db.refresh(flashcard)
    
    # Message de feedback
    quality_messages = {
        0: "À revoir bientôt !",
        1: "C'était difficile, mais tu progresses !",
        2: "Bien joué !",
        3: "Excellent ! Carte maîtrisée !"
    }
    
    return {
        "flashcard": flashcard,
        "xp_earned": xp_earned,
        "message": quality_messages.get(review_data.quality, "Révision terminée"),
        "next_review_in_days": flashcard.interval
    }


@router.get("/{flashcard_id}/stats", response_model=FlashcardStatsResponse)
async def get_flashcard_stats(
    flashcard_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les statistiques détaillées d'une flashcard"""
    
    # Récupérer la flashcard
    result = await db.execute(
        select(Flashcard).where(
            and_(
                Flashcard.id == flashcard_id,
                Flashcard.user_id == current_user.id
            )
        )
    )
    flashcard = result.scalar_one_or_none()
    
    if not flashcard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard non trouvée"
        )
    
    # Calculer le taux de succès
    success_rate = 0.0
    if flashcard.total_reviews > 0:
        success_rate = (flashcard.correct_reviews / flashcard.total_reviews) * 100
    
    # Récupérer les 10 dernières révisions
    result = await db.execute(
        select(FlashcardReview)
        .where(FlashcardReview.flashcard_id == flashcard_id)
        .order_by(FlashcardReview.reviewed_at.desc())
        .limit(10)
    )
    recent_reviews = result.scalars().all()
    
    # Formater l'historique des révisions
    reviews_list = [
        {
            "id": r.id,
            "quality": r.quality,
            "response_time_seconds": r.response_time_seconds,
            "reviewed_at": r.reviewed_at.isoformat()
        }
        for r in recent_reviews
    ]
    
    # Répartition des difficultés
    difficulty_breakdown = {
        "again": flashcard.times_seen_as_again,
        "hard": flashcard.times_seen_as_hard,
        "good": flashcard.times_seen_as_good,
        "easy": flashcard.times_seen_as_easy
    }
    
    return {
        "flashcard_id": flashcard.id,
        "total_reviews": flashcard.total_reviews,
        "correct_reviews": flashcard.correct_reviews,
        "incorrect_reviews": flashcard.incorrect_reviews,
        "success_rate": success_rate,
        "mastery_percentage": flashcard.mastery_percentage,
        "average_response_time_seconds": flashcard.average_response_time_seconds,
        "status": flashcard.status,
        "ease_factor": flashcard.ease_factor,
        "interval": flashcard.interval,
        "repetitions": flashcard.repetitions,
        "next_review_at": flashcard.next_review_at,
        "difficulty_breakdown": difficulty_breakdown,
        "recent_reviews": reviews_list
    }


@router.put("/{flashcard_id}", response_model=FlashcardResponse)
async def update_flashcard(
    flashcard_id: int,
    flashcard_data: FlashcardUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Mettre à jour une flashcard"""
    
    result = await db.execute(
        select(Flashcard).where(
            and_(
                Flashcard.id == flashcard_id,
                Flashcard.user_id == current_user.id
            )
        )
    )
    flashcard = result.scalar_one_or_none()
    
    if not flashcard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard non trouvée"
        )
    
    # Mettre à jour les champs
    update_data = flashcard_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(flashcard, field, value)
    
    await db.commit()
    await db.refresh(flashcard)
    
    return flashcard


@router.delete("/{flashcard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flashcard(
    flashcard_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprimer une flashcard"""
    
    result = await db.execute(
        select(Flashcard).where(
            and_(
                Flashcard.id == flashcard_id,
                Flashcard.user_id == current_user.id
            )
        )
    )
    flashcard = result.scalar_one_or_none()
    
    if not flashcard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard non trouvée"
        )
    
    # Mettre à jour les stats de la matière
    result = await db.execute(
        select(Subject).where(Subject.id == flashcard.subject_id)
    )
    subject = result.scalar_one_or_none()
    if subject:
        subject.total_flashcards_count = max(0, subject.total_flashcards_count - 1)
    
    await db.delete(flashcard)
    await db.commit()
    
    return None


@router.post("/{flashcard_id}/favorite", response_model=FlashcardResponse)
async def toggle_favorite(
    flashcard_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Marquer/Démarquer une flashcard comme favorite"""
    
    result = await db.execute(
        select(Flashcard).where(
            and_(
                Flashcard.id == flashcard_id,
                Flashcard.user_id == current_user.id
            )
        )
    )
    flashcard = result.scalar_one_or_none()
    
    if not flashcard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard non trouvée"
        )
    
    flashcard.is_favorite = not flashcard.is_favorite
    await db.commit()
    await db.refresh(flashcard)
    
    return flashcard


@router.post("/{flashcard_id}/suspend", response_model=FlashcardResponse)
async def toggle_suspend(
    flashcard_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Suspendre/Réactiver une flashcard"""
    
    result = await db.execute(
        select(Flashcard).where(
            and_(
                Flashcard.id == flashcard_id,
                Flashcard.user_id == current_user.id
            )
        )
    )
    flashcard = result.scalar_one_or_none()
    
    if not flashcard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard non trouvée"
        )
    
    flashcard.is_suspended = not flashcard.is_suspended
    await db.commit()
    await db.refresh(flashcard)
    
    return flashcard
