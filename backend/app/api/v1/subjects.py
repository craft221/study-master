from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.subject import Subject
from app.schemas.subject import (
    SubjectCreate,
    SubjectUpdate,
    SubjectResponse,
    SubjectListResponse,
    SubjectStats
)
from app.services.xp_service import award_xp

router = APIRouter()


@router.post("/", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
async def create_subject(
    subject_data: SubjectCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Créer une nouvelle matière"""

    new_subject = Subject(
        user_id=current_user.id,
        **subject_data.model_dump()
    )

    db.add(new_subject)

    # Ajouter XP via le service centralisé
    await award_xp(
        user=current_user,
        amount=5,
        reason="Création d'une matière",
        event_type="subject_created",
        db=db
    )

    await db.commit()
    await db.refresh(new_subject)

    return new_subject


@router.get("/", response_model=SubjectListResponse)
async def list_subjects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = None,
    is_archived: Optional[bool] = False,
    semester: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer la liste des matières"""
    
    query = select(Subject).where(Subject.user_id == current_user.id)
    
    if is_active is not None:
        query = query.where(Subject.is_active == is_active)
    if is_archived is not None:
        query = query.where(Subject.is_archived == is_archived)
    if semester:
        query = query.where(Subject.semester == semester)
    
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(Subject.is_favorite.desc(), Subject.created_at.desc())
    
    result = await db.execute(query)
    subjects = result.scalars().all()
    
    return {
        "subjects": subjects,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/{subject_id}", response_model=SubjectResponse)
async def get_subject(
    subject_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les détails d'une matière"""
    
    result = await db.execute(
        select(Subject).where(
            and_(
                Subject.id == subject_id,
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
    
    return subject


@router.put("/{subject_id}", response_model=SubjectResponse)
async def update_subject(
    subject_id: int,
    subject_data: SubjectUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Mettre à jour une matière"""
    
    result = await db.execute(
        select(Subject).where(
            and_(
                Subject.id == subject_id,
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
    
    update_data = subject_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(subject, field, value)
    
    await db.commit()
    await db.refresh(subject)
    
    return subject


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(
    subject_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprimer une matière"""
    
    result = await db.execute(
        select(Subject).where(
            and_(
                Subject.id == subject_id,
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
    
    await db.delete(subject)
    await db.commit()
    
    return None


@router.get("/{subject_id}/stats", response_model=SubjectStats)
async def get_subject_stats(
    subject_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les statistiques détaillées d'une matière"""
    
    result = await db.execute(
        select(Subject).where(
            and_(
                Subject.id == subject_id,
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
    
    grade_progress = None
    if subject.target_grade and subject.current_grade:
        grade_progress = (subject.current_grade / subject.target_grade) * 100
    
    days_until_exam = None
    if subject.exam_date:
        days_until_exam = (subject.exam_date - utc_now()).days
    
    return SubjectStats(
        subject_id=subject.id,
        subject_name=subject.name,
        current_grade=subject.current_grade,
        target_grade=subject.target_grade,
        grade_progress=grade_progress,
        total_notes=subject.total_notes_count,
        total_flashcards=subject.total_flashcards_count,
        total_quizzes=subject.total_quizzes_count,
        total_study_time_minutes=subject.total_study_time_minutes,
        total_study_time_hours=subject.total_study_time_minutes / 60,
        average_study_time_per_week=0,
        average_quiz_score=None,
        flashcards_mastered=0,
        flashcards_due=0,
        xp_earned=subject.xp_earned,
        level=subject.level,
        mastery_percentage=subject.mastery_percentage,
        exam_date=subject.exam_date,
        days_until_exam=days_until_exam,
        recommended_study_hours=None
    )


@router.post("/{subject_id}/favorite", response_model=SubjectResponse)
async def toggle_favorite(
    subject_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Marquer/Démarquer une matière comme favorite"""
    
    result = await db.execute(
        select(Subject).where(
            and_(
                Subject.id == subject_id,
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
    
    subject.is_favorite = not subject.is_favorite
    await db.commit()
    await db.refresh(subject)
    
    return subject


@router.post("/{subject_id}/archive", response_model=SubjectResponse)
async def toggle_archive(
    subject_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Archiver/Désarchiver une matière"""
    
    result = await db.execute(
        select(Subject).where(
            and_(
                Subject.id == subject_id,
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
    
    subject.is_archived = not subject.is_archived
    await db.commit()
    await db.refresh(subject)
    
    return subject