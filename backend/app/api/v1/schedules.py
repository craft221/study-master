from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.datetime_utils import utc_now, utc_date
from app.core.security import get_current_user
from app.models.user import User
from app.models.schedule import Schedule, EventType, REMINDER_STRATEGIES
from app.models.subject import Subject
from app.schemas.study_session import (
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleResponse,
    ScheduleListResponse
)

router = APIRouter()


# =============================================================================
# Endpoints pour les rappels intelligents
# =============================================================================

@router.get("/reminder-strategies", response_model=Dict[str, Any])
async def get_reminder_strategies(
    current_user: User = Depends(get_current_user)
):
    """
    Récupère les stratégies de rappels pour chaque type d'événement.
    Utile pour afficher à l'utilisateur quels rappels il recevra.
    """
    from app.services.smart_reminder_service import smart_reminder_service

    strategies = {}
    for event_type in EventType:
        strategies[event_type.value] = smart_reminder_service.get_reminder_preview(event_type.value)

    return {
        "strategies": strategies,
        "event_types": [
            {"value": et.value, "label": get_event_type_label(et.value)}
            for et in EventType
        ]
    }


def get_event_type_label(event_type: str) -> str:
    """Retourne le label français pour un type d'événement"""
    labels = {
        "exam": "Examen",
        "class": "Cours",
        "deadline": "Date limite",
        "study": "Session d'étude",
        "meeting": "Réunion",
        "other": "Autre"
    }
    return labels.get(event_type, "Événement")


@router.post("/", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule_event(
    event_data: ScheduleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Créer un événement dans l'emploi du temps"""
    # Validation des dates
    if event_data.end_time <= event_data.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time"
        )
    
    # Vérifier le sujet si fourni
    if event_data.subject_id:
        subject = await db.get(Subject, event_data.subject_id)
        if not subject or subject.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subject not found"
            )
    
    # Créer l'événement
    new_event = Schedule(
        user_id=current_user.id,
        subject_id=event_data.subject_id,
        title=event_data.title,
        description=event_data.description,
        event_type=event_data.event_type,
        location=event_data.location,
        start_time=event_data.start_time,
        end_time=event_data.end_time,
        day_of_week=event_data.day_of_week,
        is_recurring=event_data.is_recurring,
        recurrence_pattern=event_data.recurrence_pattern,
        color=event_data.color,
        reminder_minutes_before=event_data.reminder_minutes_before
    )
    
    db.add(new_event)
    await db.commit()
    await db.refresh(new_event)
    
    return new_event


@router.get("/", response_model=ScheduleListResponse)
async def get_schedule_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    event_type: Optional[str] = None,
    subject_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer l'emploi du temps de l'utilisateur"""
    # Convertir les datetimes avec timezone en naive datetimes (pour compatibilité PostgreSQL)
    if start_date and start_date.tzinfo:
        start_date = start_date.replace(tzinfo=None)
    if end_date and end_date.tzinfo:
        end_date = end_date.replace(tzinfo=None)

    query = select(Schedule).where(Schedule.user_id == current_user.id)

    # Filtres
    if start_date and end_date:
        query = query.where(
            and_(
                Schedule.start_time >= start_date,
                Schedule.end_time <= end_date
            )
        )
    elif start_date:
        query = query.where(Schedule.start_time >= start_date)
    elif end_date:
        query = query.where(Schedule.end_time <= end_date)
    
    if event_type:
        query = query.where(Schedule.event_type == event_type)
    
    if subject_id:
        query = query.where(Schedule.subject_id == subject_id)
    
    query = query.order_by(Schedule.start_time.asc())
    
    # Compte total
    count_query = select(func.count()).select_from(Schedule).where(Schedule.user_id == current_user.id)
    if start_date and end_date:
        count_query = count_query.where(
            and_(
                Schedule.start_time >= start_date,
                Schedule.end_time <= end_date
            )
        )
    if event_type:
        count_query = count_query.where(Schedule.event_type == event_type)
    if subject_id:
        count_query = count_query.where(Schedule.subject_id == subject_id)
    
    total = await db.scalar(count_query)
    
    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    result = await db.execute(query)
    events = result.scalars().all()
    
    return ScheduleListResponse(
        events=events,
        total=total or 0,
        page=page,
        page_size=page_size
    )


@router.get("/week", response_model=ScheduleListResponse)
async def get_week_schedule(
    start_of_week: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer l'emploi du temps de la semaine"""
    if not start_of_week:
        today = utc_date()
        start_of_week = datetime.combine(today - timedelta(days=today.weekday()), datetime.min.time())
    
    end_of_week = start_of_week + timedelta(days=7)
    
    query = select(Schedule).where(
        and_(
            Schedule.user_id == current_user.id,
            Schedule.start_time >= start_of_week,
            Schedule.start_time < end_of_week
        )
    ).order_by(Schedule.start_time.asc())
    
    result = await db.execute(query)
    events = result.scalars().all()
    
    return ScheduleListResponse(
        events=events,
        total=len(events),
        page=1,
        page_size=len(events)
    )


@router.get("/upcoming", response_model=List[ScheduleResponse])
async def get_upcoming_events(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les prochains événements"""
    now = utc_now()
    
    query = select(Schedule).where(
        and_(
            Schedule.user_id == current_user.id,
            Schedule.start_time >= now,
            Schedule.is_completed == False
        )
    ).order_by(Schedule.start_time.asc()).limit(limit)
    
    result = await db.execute(query)
    events = result.scalars().all()
    
    return events


@router.get("/{event_id}", response_model=ScheduleResponse)
async def get_schedule_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer un événement spécifique"""
    event = await db.get(Schedule, event_id)
    
    if not event or event.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule event not found"
        )
    
    return event


@router.put("/{event_id}", response_model=ScheduleResponse)
async def update_schedule_event(
    event_id: int,
    event_data: ScheduleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mettre à jour un événement"""
    event = await db.get(Schedule, event_id)
    
    if not event or event.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule event not found"
        )
    
    # Mettre à jour les champs
    update_data = event_data.model_dump(exclude_unset=True)
    
    # Validation des dates si modifiées
    start_time = update_data.get('start_time', event.start_time)
    end_time = update_data.get('end_time', event.end_time)
    if end_time <= start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time"
        )
    
    # Vérifier le sujet si modifié
    if 'subject_id' in update_data and update_data['subject_id']:
        subject = await db.get(Subject, update_data['subject_id'])
        if not subject or subject.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subject not found"
            )
    
    for key, value in update_data.items():
        setattr(event, key, value)
    
    # Marquer comme complété si demandé
    if event_data.is_completed and not event.completed_at:
        event.completed_at = utc_now()
    
    await db.commit()
    await db.refresh(event)
    
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprimer un événement"""
    event = await db.get(Schedule, event_id)
    
    if not event or event.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule event not found"
        )
    
    await db.delete(event)
    await db.commit()
    
    return None
