from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract
from typing import List, Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.study_session import StudySession, SessionType, SessionStatus
from app.models.subject import Subject
from app.schemas.study_session import (
    StudySessionCreate,
    StudySessionUpdate,
    StudySessionResponse,
    StudySessionListResponse,
    StudySessionStatsResponse
)

router = APIRouter()


@router.post("/", response_model=StudySessionResponse, status_code=status.HTTP_201_CREATED)
async def create_study_session(
    session_data: StudySessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Créer une nouvelle session d'étude Pomodoro"""
    # Vérifier que le sujet existe et appartient à l'utilisateur
    subject = await db.get(Subject, session_data.subject_id)
    if not subject or subject.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found"
        )
    
    # Créer la session
    new_session = StudySession(
        user_id=current_user.id,
        subject_id=session_data.subject_id,
        session_type=session_data.session_type,
        planned_duration_minutes=session_data.planned_duration_minutes,
        break_duration_minutes=session_data.break_duration_minutes,
        notes=session_data.notes,
        tags=session_data.tags,
        status=SessionStatus.PLANNED,
        started_at=datetime.utcnow() if session_data.session_type != SessionType.SCHEDULED else None
    )
    
    if new_session.started_at:
        new_session.status = SessionStatus.ACTIVE
    
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    
    return new_session


@router.get("/", response_model=StudySessionListResponse)
async def get_study_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = None,
    subject_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer toutes les sessions d'étude de l'utilisateur"""
    query = select(StudySession).where(StudySession.user_id == current_user.id)
    
    if status_filter:
        query = query.where(StudySession.status == status_filter)
    
    if subject_id:
        query = query.where(StudySession.subject_id == subject_id)
    
    query = query.order_by(StudySession.created_at.desc())
    
    # Compte total
    count_query = select(func.count()).select_from(StudySession).where(StudySession.user_id == current_user.id)
    if status_filter:
        count_query = count_query.where(StudySession.status == status_filter)
    if subject_id:
        count_query = count_query.where(StudySession.subject_id == subject_id)
    
    total = await db.scalar(count_query)
    
    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    result = await db.execute(query)
    sessions = result.scalars().all()
    
    return StudySessionListResponse(
        sessions=sessions,
        total=total or 0,
        page=page,
        page_size=page_size
    )


@router.get("/stats", response_model=StudySessionStatsResponse)
async def get_study_session_stats(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Statistiques des sessions d'étude"""
    since_date = datetime.utcnow() - timedelta(days=days)
    
    query = select(StudySession).where(
        and_(
            StudySession.user_id == current_user.id,
            StudySession.created_at >= since_date,
            StudySession.status == SessionStatus.COMPLETED
        )
    )
    
    result = await db.execute(query)
    sessions = result.scalars().all()
    
    if not sessions:
        return StudySessionStatsResponse(
            total_sessions=0,
            total_minutes=0,
            total_hours=0.0,
            average_duration=0.0,
            average_productivity=0.0,
            average_focus=0.0,
            sessions_by_type={},
            sessions_by_subject={},
            best_time_of_day=None,
            total_xp_earned=0
        )
    
    total_minutes = sum(s.actual_duration_minutes or 0 for s in sessions)
    total_xp = sum(s.xp_earned for s in sessions)
    
    # Productivité moyenne
    rated_sessions = [s for s in sessions if s.productivity_rating]
    avg_productivity = sum(s.productivity_rating for s in rated_sessions) / len(rated_sessions) if rated_sessions else 0.0
    
    # Focus moyen
    focused_sessions = [s for s in sessions if s.focus_score]
    avg_focus = sum(s.focus_score for s in focused_sessions) / len(focused_sessions) if focused_sessions else 0.0
    
    # Sessions par type
    sessions_by_type = {}
    for session in sessions:
        type_name = session.session_type.value if session.session_type else "unknown"
        sessions_by_type[type_name] = sessions_by_type.get(type_name, 0) + 1
    
    # Sessions par sujet
    sessions_by_subject = {}
    for session in sessions:
        subject_id = str(session.subject_id)
        sessions_by_subject[subject_id] = sessions_by_subject.get(subject_id, 0) + 1
    
    # Meilleure heure de la journée (basée sur productivité)
    hours_productivity = {}
    for session in rated_sessions:
        if session.started_at:
            hour = session.started_at.hour
            if hour not in hours_productivity:
                hours_productivity[hour] = []
            hours_productivity[hour].append(session.productivity_rating)
    
    best_time = None
    if hours_productivity:
        hour_avgs = {h: sum(ratings)/len(ratings) for h, ratings in hours_productivity.items()}
        best_hour = max(hour_avgs, key=hour_avgs.get)
        best_time = f"{best_hour:02d}:00-{(best_hour+1):02d}:00"
    
    return StudySessionStatsResponse(
        total_sessions=len(sessions),
        total_minutes=total_minutes,
        total_hours=round(total_minutes / 60, 2),
        average_duration=round(total_minutes / len(sessions), 2),
        average_productivity=round(avg_productivity, 2),
        average_focus=round(avg_focus, 2),
        sessions_by_type=sessions_by_type,
        sessions_by_subject=sessions_by_subject,
        best_time_of_day=best_time,
        total_xp_earned=total_xp
    )


@router.get("/{session_id}", response_model=StudySessionResponse)
async def get_study_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer une session spécifique"""
    session = await db.get(StudySession, session_id)
    
    if not session or session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study session not found"
        )
    
    return session


@router.put("/{session_id}/start", response_model=StudySessionResponse)
async def start_study_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Démarrer une session planifiée"""
    session = await db.get(StudySession, session_id)
    
    if not session or session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study session not found"
        )
    
    if session.status != SessionStatus.PLANNED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot start session with status: {session.status}"
        )
    
    session.status = SessionStatus.ACTIVE
    session.started_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(session)
    
    return session


@router.put("/{session_id}/complete", response_model=StudySessionResponse)
async def complete_study_session(
    session_id: int,
    session_update: StudySessionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Compléter une session d'étude avec statistiques"""
    session = await db.get(StudySession, session_id)
    
    if not session or session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study session not found"
        )
    
    # Mettre à jour les données
    if session_update.actual_duration_minutes:
        session.actual_duration_minutes = session_update.actual_duration_minutes
    elif session.started_at:
        # Calculer la durée automatiquement
        duration = datetime.utcnow() - session.started_at
        session.actual_duration_minutes = int(duration.total_seconds() / 60)
    
    if session_update.productivity_rating:
        session.productivity_rating = session_update.productivity_rating
    
    if session_update.notes:
        session.notes = session_update.notes
    
    # Calculer focus score (basé sur la durée planifiée vs réelle)
    if session.actual_duration_minutes and session.planned_duration_minutes:
        focus_ratio = min(session.actual_duration_minutes / session.planned_duration_minutes, 1.0)
        session.focus_score = round(focus_ratio * 100, 2)
    
    # Calculer XP gagné
    base_xp = 10
    duration_bonus = (session.actual_duration_minutes or 0) // 5  # 1 XP par 5 minutes
    productivity_bonus = (session.productivity_rating or 0) * 5 if session.productivity_rating else 0
    
    session.xp_earned = base_xp + duration_bonus + productivity_bonus
    
    # Mettre à jour XP utilisateur
    current_user.total_xp += session.xp_earned
    current_user.level = (current_user.total_xp // 100) + 1
    
    session.status = SessionStatus.COMPLETED
    session.ended_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(session)
    
    return session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_study_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprimer une session d'étude"""
    session = await db.get(StudySession, session_id)
    
    if not session or session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study session not found"
        )
    
    await db.delete(session)
    await db.commit()
    
    return None
