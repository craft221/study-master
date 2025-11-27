from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import get_current_active_user, get_password_hash, verify_password
from app.models.user import User
from app.models.subject import Subject
from app.models.note import Note
from app.models.flashcard import Flashcard
from app.models.quiz import Quiz, QuizAttempt
from app.schemas.user import (
    UserProfileResponse,
    UserStatsResponse,
    UserUpdate,
    PasswordChange,
    UserActivityResponse
)

router = APIRouter()


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user(
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer l'utilisateur actuellement connecté"""
    return current_user


@router.get("/me/profile", response_model=UserProfileResponse)
async def get_user_profile(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer le profil détaillé de l'utilisateur"""

    return current_user


@router.put("/me", response_model=UserProfileResponse)
async def update_user_profile(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Mettre à jour le profil utilisateur"""
    
    update_data = user_data.model_dump(exclude_unset=True)
    
    # Vérifier si l'email est déjà utilisé
    if "email" in update_data and update_data["email"] != current_user.email:
        result = await db.execute(
            select(User).where(User.email == update_data["email"])
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cet email est déjà utilisé"
            )
    
    # Vérifier si le username est déjà utilisé
    if "username" in update_data and update_data["username"] != current_user.username:
        result = await db.execute(
            select(User).where(User.username == update_data["username"])
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce nom d'utilisateur est déjà utilisé"
            )
    
    # Mettre à jour les champs
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    await db.commit()
    await db.refresh(current_user)
    
    return current_user


@router.get("/me/stats", response_model=UserStatsResponse)
async def get_user_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les statistiques complètes de l'utilisateur"""
    
    # Compter les matières
    result = await db.execute(
        select(func.count()).select_from(Subject).where(Subject.user_id == current_user.id)
    )
    total_subjects = result.scalar()
    
    # Compter les notes
    result = await db.execute(
        select(func.count()).select_from(Note).where(Note.author_id == current_user.id)
    )
    total_notes = result.scalar()
    
    # Compter les flashcards
    result = await db.execute(
        select(func.count()).select_from(Flashcard).where(Flashcard.user_id == current_user.id)
    )
    total_flashcards = result.scalar()
    
    # Flashcards dues aujourd'hui
    result = await db.execute(
        select(func.count()).select_from(Flashcard).where(
            and_(
                Flashcard.user_id == current_user.id,
                Flashcard.next_review_at <= datetime.now(),
                Flashcard.is_suspended == False
            )
        )
    )
    flashcards_due_today = result.scalar()
    
    # Compter les quizzes
    result = await db.execute(
        select(func.count()).select_from(Quiz).where(Quiz.user_id == current_user.id)
    )
    total_quizzes = result.scalar()
    
    # Compter les tentatives de quiz
    result = await db.execute(
        select(func.count()).select_from(QuizAttempt).where(
            and_(
                QuizAttempt.user_id == current_user.id,
                QuizAttempt.is_completed == True
            )
        )
    )
    completed_quiz_attempts = result.scalar()
    
    # Moyenne des scores de quiz
    result = await db.execute(
        select(func.avg(QuizAttempt.score)).select_from(QuizAttempt).where(
            and_(
                QuizAttempt.user_id == current_user.id,
                QuizAttempt.is_completed == True
            )
        )
    )
    average_quiz_score = result.scalar() or 0.0
    
    # Calculer le niveau
    level = int((current_user.total_xp / 100) ** 0.5) + 1
    xp_for_current_level = (level - 1) ** 2 * 100
    xp_for_next_level = level ** 2 * 100
    xp_progress = current_user.total_xp - xp_for_current_level
    xp_needed = xp_for_next_level - xp_for_current_level
    
    # Activité cette semaine
    week_ago = datetime.now() - timedelta(days=7)
    
    result = await db.execute(
        select(func.count()).select_from(Note).where(
            and_(
                Note.author_id == current_user.id,
                Note.created_at >= week_ago
            )
        )
    )
    notes_this_week = result.scalar()
    
    result = await db.execute(
        select(func.count()).select_from(Flashcard).where(
            and_(
                Flashcard.user_id == current_user.id,
                Flashcard.last_reviewed_at >= week_ago
            )
        )
    )
    flashcards_reviewed_this_week = result.scalar()
    
    result = await db.execute(
        select(func.count()).select_from(QuizAttempt).where(
            and_(
                QuizAttempt.user_id == current_user.id,
                QuizAttempt.created_at >= week_ago,
                QuizAttempt.is_completed == True
            )
        )
    )
    quizzes_taken_this_week = result.scalar()
    
    # Vérifier la streak
    today = datetime.now().date()
    yesterday = today - timedelta(days=1)
    
    # Activité aujourd'hui
    result = await db.execute(
        select(func.count()).select_from(Note).where(
            and_(
                Note.author_id == current_user.id,
                func.date(Note.created_at) == today
            )
        )
    )
    activity_today = result.scalar()
    
    # Activité hier
    result = await db.execute(
        select(func.count()).select_from(Note).where(
            and_(
                Note.author_id == current_user.id,
                func.date(Note.created_at) == yesterday
            )
        )
    )
    activity_yesterday = result.scalar()
    
    # Calculer la streak (simplifié)
    if activity_today > 0:
        current_streak = current_user.current_streak
    elif activity_yesterday > 0:
        current_streak = current_user.current_streak
    else:
        current_streak = 0
    
    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "avatar_url": current_user.avatar_url,
        "total_xp": current_user.total_xp,
        "level": level,
        "xp_progress": xp_progress,
        "xp_needed_for_next_level": xp_needed,
        "current_streak": current_streak,
        "longest_streak": current_user.longest_streak,
        "total_subjects": total_subjects,
        "total_notes": total_notes,
        "total_flashcards": total_flashcards,
        "flashcards_due_today": flashcards_due_today,
        "total_flashcards_reviewed": current_user.total_flashcards_reviewed,
        "total_quizzes": total_quizzes,
        "completed_quiz_attempts": completed_quiz_attempts,
        "average_quiz_score": round(average_quiz_score, 2),
        "notes_this_week": notes_this_week,
        "flashcards_reviewed_this_week": flashcards_reviewed_this_week,
        "quizzes_taken_this_week": quizzes_taken_this_week,
        "member_since": current_user.created_at,
        "last_login": current_user.last_login_at
    }


@router.put("/me/password", status_code=status.HTTP_200_OK)
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Changer le mot de passe de l'utilisateur"""
    
    # Vérifier l'ancien mot de passe
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe actuel incorrect"
        )
    
    # Vérifier que le nouveau mot de passe est différent
    if password_data.current_password == password_data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nouveau mot de passe doit être différent de l'ancien"
        )
    
    # Mettre à jour le mot de passe
    current_user.hashed_password = get_password_hash(password_data.new_password)
    
    await db.commit()
    
    return {"message": "Mot de passe modifié avec succès"}


@router.post("/me/avatar", response_model=UserProfileResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload d'avatar (simplifié - retourne juste un placeholder pour le MVP)"""
    
    # Validation du fichier
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le fichier doit être une image"
        )
    
    # Pour le MVP, on utilise un service comme Gravatar ou un placeholder
    # Dans une vraie app, on uploadera vers S3/Cloudinary
    
    # Simuler l'upload et générer une URL
    avatar_url = f"https://api.dicebear.com/7.x/avataaars/svg?seed={current_user.username}"
    
    current_user.avatar_url = avatar_url
    
    await db.commit()
    await db.refresh(current_user)
    
    return current_user


@router.get("/me/activity", response_model=UserActivityResponse)
async def get_user_activity(
    days: int = 30,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer l'activité récente de l'utilisateur"""
    
    if days < 1 or days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nombre de jours doit être entre 1 et 365"
        )
    
    days_ago = datetime.now() - timedelta(days=days)
    
    # Notes récentes
    result = await db.execute(
        select(Note).where(
            and_(
                Note.author_id == current_user.id,
                Note.created_at >= days_ago
            )
        ).order_by(Note.created_at.desc()).limit(10)
    )
    recent_notes = result.scalars().all()
    
    # Flashcards révisées récemment
    result = await db.execute(
        select(Flashcard).where(
            and_(
                Flashcard.user_id == current_user.id,
                Flashcard.last_reviewed_at >= days_ago
            )
        ).order_by(Flashcard.last_reviewed_at.desc()).limit(10)
    )
    recent_flashcards = result.scalars().all()
    
    # Quiz récents
    result = await db.execute(
        select(QuizAttempt).where(
            and_(
                QuizAttempt.user_id == current_user.id,
                QuizAttempt.created_at >= days_ago,
                QuizAttempt.is_completed == True
            )
        ).order_by(QuizAttempt.created_at.desc()).limit(10)
    )
    recent_quiz_attempts = result.scalars().all()
    
    # Préparer les activités
    activities = []
    
    for note in recent_notes:
        activities.append({
            "type": "note_created",
            "title": f"Note créée: {note.title}",
            "timestamp": note.created_at,
            "details": {"note_id": note.id}
        })
    
    for flashcard in recent_flashcards:
        activities.append({
            "type": "flashcard_reviewed",
            "title": f"Flashcard révisée",
            "timestamp": flashcard.last_reviewed_at,
            "details": {"flashcard_id": flashcard.id}
        })
    
    for attempt in recent_quiz_attempts:
        activities.append({
            "type": "quiz_completed",
            "title": f"Quiz terminé avec {attempt.score:.0f}%",
            "timestamp": attempt.created_at,
            "details": {"attempt_id": attempt.id, "score": attempt.score}
        })
    
    # Trier par date décroissante
    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return {
        "activities": activities[:20],  # Top 20 activités
        "period_days": days,
        "total_activities": len(activities)
    }


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_account(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprimer le compte utilisateur (soft delete)"""
    
    # Soft delete
    current_user.is_active = False
    current_user.is_deleted = True
    current_user.deleted_at = datetime.now()
    
    await db.commit()
    
    return None
