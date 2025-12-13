"""
API Endpoints pour Focus Rooms
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.focus_room import (
    FocusRoom, FocusRoomParticipant, FocusRoomInvitation,
    FocusRoomType, FocusRoomCategory, ParticipantStatus
)
from app.schemas.focus_room import (
    FocusRoomCreate, FocusRoomUpdate, FocusRoomResponse,
    FocusRoomListResponse, FocusRoomDetailResponse,
    JoinRoomRequest, UpdateStatusRequest, UpdateActivityRequest,
    ParticipantResponse, ActivityResponse,
    InviteRequest, JoinByCodeRequest, InvitationResponse,
    PokeRequest, PokeResponse,
    RoomStatsResponse, UserFocusStatsResponse,
    RoomLeaderboardResponse, FocusSessionResponse,
    StartDeepWorkRequest, DeepWorkStatusResponse,
    CreateEventRoomRequest, EventCountdownResponse
)
from app.services.focus_room_service import focus_room_service

router = APIRouter()


# ==================== ROOM CRUD ====================

@router.post("/", response_model=FocusRoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(
    room_data: FocusRoomCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Creer une nouvelle Focus Room"""
    room = await focus_room_service.create_room(db, current_user, room_data)

    # Recharger la room avec les relations pour la response
    room = await focus_room_service.get_room(db, room.id, include_participants=True)

    return await _room_to_response(db, room)


@router.get("/", response_model=FocusRoomListResponse)
async def list_rooms(
    room_type: Optional[FocusRoomType] = None,
    category: Optional[FocusRoomCategory] = None,
    university: Optional[str] = None,
    subject_id: Optional[int] = None,
    search: Optional[str] = None,
    hide_empty: bool = False,
    hide_full: bool = False,
    sort_by: str = Query("active_participants", regex="^(active_participants|created_at|name)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lister les Focus Rooms avec filtres"""
    rooms, total = await focus_room_service.list_rooms(
        db,
        room_type=room_type,
        category=category,
        university=university,
        subject_id=subject_id,
        search=search,
        hide_empty=hide_empty,
        hide_full=hide_full,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
        user_id=current_user.id
    )

    room_responses = [await _room_to_response(db, r) for r in rooms]

    return FocusRoomListResponse(
        rooms=room_responses,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < total
    )


@router.get("/my-rooms", response_model=List[FocusRoomResponse])
async def get_my_rooms(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Recuperer mes rooms (creees et recentes)"""
    rooms = await focus_room_service.get_my_rooms(db, current_user.id)
    return [await _room_to_response(db, r) for r in rooms]


@router.get("/popular", response_model=List[FocusRoomResponse])
async def get_popular_rooms(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Recuperer les rooms populaires"""
    rooms = await focus_room_service.get_popular_rooms(db, limit)
    return [await _room_to_response(db, r) for r in rooms]


@router.get("/recommended", response_model=List[FocusRoomResponse])
async def get_recommended_rooms(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Recuperer les rooms recommandees"""
    rooms = await focus_room_service.get_recommended_rooms(db, current_user, limit)
    return [await _room_to_response(db, r) for r in rooms]


# ==================== EVENTS/TEMPORARY ROOMS ====================

@router.post("/events", response_model=FocusRoomResponse, status_code=status.HTTP_201_CREATED)
async def create_event_room(
    event_data: CreateEventRoomRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Creer une salle evenement/temporaire avec dates de debut et fin"""
    try:
        room = await focus_room_service.create_event_room(db, current_user, event_data)
        room = await focus_room_service.get_room(db, room.id, include_participants=True)
        return await _room_to_response(db, room)

    except ValueError as e:
        error = str(e)
        if error == "event_dates_required":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Event rooms require start and end dates"
            )
        elif error == "invalid_dates":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End date must be after start date"
            )
        raise


@router.get("/events/upcoming", response_model=List[FocusRoomResponse])
async def get_upcoming_events(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Recuperer les evenements a venir"""
    rooms = await focus_room_service.list_upcoming_events(db, limit, current_user.id)
    return [await _room_to_response(db, r) for r in rooms]


@router.get("/events/active", response_model=List[FocusRoomResponse])
async def get_active_events(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Recuperer les evenements en cours"""
    rooms = await focus_room_service.list_active_events(db, limit, current_user.id)
    return [await _room_to_response(db, r) for r in rooms]


@router.get("/{room_id}/countdown", response_model=EventCountdownResponse)
async def get_event_countdown(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Recuperer le compte a rebours d'un evenement"""
    room = await focus_room_service.get_room(db, room_id)

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    countdown = await focus_room_service.get_event_countdown(room)
    return EventCountdownResponse(**countdown)


@router.get("/current", response_model=Optional[FocusRoomDetailResponse])
async def get_current_room(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Recuperer la room actuelle de l'utilisateur"""
    participant = await focus_room_service.get_participant(db, current_user.id)

    if not participant:
        return None

    room = await focus_room_service.get_room(db, participant.room_id, include_participants=True)
    return await _room_to_detail_response(db, room)


@router.get("/{room_id}", response_model=FocusRoomDetailResponse)
async def get_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Recuperer les details d'une room"""
    room = await focus_room_service.get_room(db, room_id, include_participants=True)

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    # Verifier acces room privee
    if room.is_private and room.creator_id != current_user.id:
        # Verifier si participant
        is_participant = any(p.user_id == current_user.id for p in room.participants)
        if not is_participant:
            # Verifier si invite (invitation pending ou accepted)
            from sqlalchemy import select, or_
            from app.models.focus_room import FocusRoomInvitation, InvitationStatus
            invitation_query = select(FocusRoomInvitation).where(
                FocusRoomInvitation.room_id == room_id,
                FocusRoomInvitation.invitee_id == current_user.id,
                FocusRoomInvitation.status.in_([InvitationStatus.PENDING, InvitationStatus.ACCEPTED])
            )
            result = await db.execute(invitation_query)
            has_invitation = result.scalar_one_or_none() is not None

            if not has_invitation:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to private room"
                )

    return await _room_to_detail_response(db, room)


@router.put("/{room_id}", response_model=FocusRoomResponse)
async def update_room(
    room_id: int,
    update_data: FocusRoomUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Modifier une room (createur uniquement)"""
    room = await focus_room_service.get_room(db, room_id)

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    if room.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can update the room"
        )

    updated_room = await focus_room_service.update_room(db, room, update_data)
    return await _room_to_response(db, updated_room)


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprimer une room (createur uniquement)"""
    room = await focus_room_service.get_room(db, room_id)

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    if room.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can delete the room"
        )

    await focus_room_service.delete_room(db, room)


# ==================== PARTICIPATION ====================

@router.post("/{room_id}/join", response_model=ParticipantResponse)
async def join_room(
    room_id: int,
    join_data: JoinRoomRequest = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Rejoindre une room"""
    room = await focus_room_service.get_room(db, room_id, include_participants=True)

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    if not room.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Room is not active"
        )

    try:
        join_data = join_data or JoinRoomRequest()
        participant = await focus_room_service.join_room(
            db, current_user, room,
            activity=join_data.activity,
            subject_id=join_data.subject_id,
            is_visible=join_data.is_visible,
            invite_code=join_data.invite_code
        )

        return await _participant_to_response(participant)

    except ValueError as e:
        error = str(e)
        if error == "already_in_room":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already in a room. Leave your current room first."
            )
        elif error == "room_is_full":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Room is full"
            )
        elif error == "access_denied":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. This is a private room."
            )
        raise


@router.post("/{room_id}/leave", response_model=FocusSessionResponse)
async def leave_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Quitter une room"""
    participant = await focus_room_service.get_participant(db, current_user.id)

    if not participant or participant.room_id != room_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not in this room"
        )

    session = await focus_room_service.leave_room(db, participant)

    return FocusSessionResponse(
        id=session.id,
        room_id=session.room_id,
        room_name=session.room_name,
        user_id=session.user_id,
        subject_id=session.subject_id,
        subject_name=None,
        started_at=session.started_at,
        ended_at=session.ended_at,
        focus_minutes=session.focus_minutes,
        break_minutes=session.break_minutes,
        total_minutes=session.total_minutes,
        focus_score=session.focus_score,
        activities_completed=session.activities_completed,
        milestones_reached=session.milestones_reached or [],
        xp_earned=session.xp_earned,
        xp_bonus=session.xp_bonus
    )


@router.patch("/{room_id}/status", response_model=ParticipantResponse)
async def update_status(
    room_id: int,
    status_data: UpdateStatusRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Changer son statut dans la room"""
    participant = await focus_room_service.get_participant(db, current_user.id)

    if not participant or participant.room_id != room_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not in this room"
        )

    updated = await focus_room_service.update_status(db, participant, status_data.status)
    return await _participant_to_response(updated)


@router.patch("/{room_id}/activity", response_model=ParticipantResponse)
async def update_activity(
    room_id: int,
    activity_data: UpdateActivityRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Changer son activite dans la room"""
    participant = await focus_room_service.get_participant(db, current_user.id)

    if not participant or participant.room_id != room_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not in this room"
        )

    updated = await focus_room_service.update_activity(
        db, participant,
        activity_data.activity,
        activity_data.subject_id
    )
    return await _participant_to_response(updated)


@router.get("/{room_id}/participants", response_model=List[ParticipantResponse])
async def get_participants(
    room_id: int,
    active_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Recuperer la liste des participants"""
    participants = await focus_room_service.get_room_participants(db, room_id, active_only)
    return [await _participant_to_response(p) for p in participants if p.is_visible]


# ==================== INVITATIONS ====================

@router.post("/{room_id}/invite", response_model=InvitationResponse)
async def invite_user(
    room_id: int,
    invite_data: InviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Inviter un utilisateur dans une room privee"""
    room = await focus_room_service.get_room(db, room_id)

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    if room.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can invite users"
        )

    try:
        invitation = await focus_room_service.invite_user(
            db, room, current_user,
            invite_data.invitee_id,
            invite_data.message
        )

        return await _invitation_to_response(invitation)

    except ValueError as e:
        error = str(e)
        if error == "room_not_private":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invitations are only for private rooms"
            )
        elif error == "already_invited":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already has a pending invitation"
            )
        raise


@router.get("/invitations/received", response_model=List[InvitationResponse])
async def get_received_invitations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Recuperer mes invitations en attente"""
    invitations = await focus_room_service.get_pending_invitations(db, current_user.id)
    return [await _invitation_to_response(inv) for inv in invitations]


@router.post("/invitations/{invitation_id}/accept", response_model=InvitationResponse)
async def accept_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Accepter une invitation"""
    invitation = await db.get(FocusRoomInvitation, invitation_id)

    if not invitation or invitation.invitee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    try:
        updated = await focus_room_service.respond_to_invitation(
            db, invitation, accept=True, invitee_username=current_user.username
        )
        return await _invitation_to_response(updated)
    except ValueError as e:
        if str(e) == "invitation_expired":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invitation has expired"
            )
        raise


@router.post("/invitations/{invitation_id}/decline", response_model=InvitationResponse)
async def decline_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Decliner une invitation"""
    invitation = await db.get(FocusRoomInvitation, invitation_id)

    if not invitation or invitation.invitee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    updated = await focus_room_service.respond_to_invitation(db, invitation, accept=False)
    return await _invitation_to_response(updated)


@router.post("/{room_id}/join-by-code", response_model=ParticipantResponse)
async def join_by_code(
    room_id: int,
    join_data: JoinByCodeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Rejoindre une room privee par code"""
    room = await focus_room_service.get_room(db, room_id, include_participants=True)

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    if not room.is_private:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This room is not private"
        )

    if room.invite_code != join_data.code.upper():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid invite code"
        )

    try:
        participant = await focus_room_service.join_room(
            db, current_user, room,
            activity=join_data.activity,
            subject_id=join_data.subject_id,
            invite_code=join_data.code
        )

        return await _participant_to_response(participant)

    except ValueError as e:
        error = str(e)
        if error == "already_in_room":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already in a room"
            )
        elif error == "room_is_full":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Room is full"
            )
        raise


# ==================== DEEP WORK ====================

@router.post("/{room_id}/deep-work/start", response_model=ParticipantResponse)
async def start_deep_work(
    room_id: int,
    deep_work_data: StartDeepWorkRequest = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Démarrer une session Deep Work (notifications bloquées pendant la durée)"""
    participant = await focus_room_service.get_participant(db, current_user.id)

    if not participant or participant.room_id != room_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not in this room"
        )

    try:
        deep_work_data = deep_work_data or StartDeepWorkRequest()
        updated = await focus_room_service.start_deep_work(
            db, participant, deep_work_data.duration_minutes
        )
        return await _participant_to_response(updated)

    except ValueError as e:
        if str(e) == "already_in_deep_work":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already in deep work mode"
            )
        raise


@router.post("/{room_id}/deep-work/end", response_model=ParticipantResponse)
async def end_deep_work(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Terminer une session Deep Work (peut être interrompue avant la fin)"""
    participant = await focus_room_service.get_participant(db, current_user.id)

    if not participant or participant.room_id != room_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not in this room"
        )

    try:
        updated, completed = await focus_room_service.end_deep_work(
            db, participant, current_user
        )
        return await _participant_to_response(updated)

    except ValueError as e:
        if str(e) == "not_in_deep_work":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are not in deep work mode"
            )
        raise


@router.get("/{room_id}/deep-work/status", response_model=DeepWorkStatusResponse)
async def get_deep_work_status(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer le statut Deep Work de l'utilisateur"""
    participant = await focus_room_service.get_participant(db, current_user.id)

    if not participant or participant.room_id != room_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not in this room"
        )

    status_data = await focus_room_service.get_deep_work_status(participant)

    return DeepWorkStatusResponse(
        in_deep_work=status_data["in_deep_work"],
        started_at=status_data.get("started_at"),
        ends_at=status_data.get("ends_at"),
        remaining_minutes=status_data["remaining_minutes"],
        sessions_completed=status_data["sessions_completed"],
        notifications_blocked=status_data["in_deep_work"]  # Notifications bloquées quand en deep work
    )


# ==================== POKES ====================

@router.post("/{room_id}/poke", response_model=PokeResponse)
async def send_poke(
    room_id: int,
    poke_data: PokeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Envoyer un poke a un autre participant"""
    participant = await focus_room_service.get_participant(db, current_user.id)

    if not participant or participant.room_id != room_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not in this room"
        )

    try:
        poke = await focus_room_service.send_poke(
            db, room_id,
            current_user.id,
            poke_data.target_user_id,
            poke_data.message
        )

        return PokeResponse(
            id=poke.id,
            from_user_id=poke.from_user_id,
            from_username=current_user.username,
            to_user_id=poke.to_user_id,
            message=poke.message,
            created_at=poke.created_at
        )

    except ValueError as e:
        if str(e) == "rate_limited":
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many pokes. Wait a minute."
            )
        raise


# ==================== STATS ====================

@router.get("/{room_id}/stats", response_model=RoomStatsResponse)
async def get_room_stats(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Recuperer les stats d'une room"""
    room = await focus_room_service.get_room(db, room_id, include_participants=True)

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    return await focus_room_service.get_room_stats(db, room)


@router.get("/{room_id}/leaderboard", response_model=RoomLeaderboardResponse)
async def get_room_leaderboard(
    room_id: int,
    period: str = Query("today", regex="^(today|week|month|all_time)$"),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Recuperer le leaderboard d'une room"""
    room = await focus_room_service.get_room(db, room_id)

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    entries = await focus_room_service.get_room_leaderboard(db, room_id, period, limit)

    # Trouver le rang de l'utilisateur
    user_rank = None
    user_entry = None
    for entry in entries:
        if entry.user_id == current_user.id:
            user_rank = entry.rank
            user_entry = entry
            break

    return RoomLeaderboardResponse(
        room_id=room_id,
        room_name=room.name,
        period=period,
        entries=entries,
        user_rank=user_rank,
        user_entry=user_entry
    )


@router.get("/stats/me", response_model=UserFocusStatsResponse)
async def get_my_focus_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Recuperer mes stats Focus Room (inclut la session en cours)"""
    stats = await focus_room_service.get_user_focus_stats(db, current_user.id)

    # Récupérer le temps de la session en cours si l'utilisateur est dans une salle
    current_session_minutes = 0
    participant = await focus_room_service.get_participant(db, current_user.id)
    if participant:
        current_session_minutes = participant.get_total_minutes()

    base_minutes = stats.total_focus_room_minutes if stats else 0
    total_minutes = base_minutes + current_session_minutes

    if not stats:
        return UserFocusStatsResponse(
            total_focus_room_minutes=total_minutes,
            total_focus_room_sessions=0,
            total_rooms_joined=0,
            total_rooms_created=0,
            focus_room_streak_days=0,
            best_focus_room_streak=0,
            longest_session_minutes=current_session_minutes,
            best_focus_score=0,
            favorite_room_id=None,
            favorite_room_name=None,
            preferred_hour=None,
            total_xp_earned=0,
            total_xp_bonus=0,
            achievements=[]
        )

    return UserFocusStatsResponse(
        total_focus_room_minutes=total_minutes,
        total_focus_room_sessions=stats.total_focus_room_sessions,
        total_rooms_joined=stats.total_rooms_joined,
        total_rooms_created=stats.total_rooms_created,
        focus_room_streak_days=stats.focus_room_streak_days,
        best_focus_room_streak=stats.best_focus_room_streak,
        longest_session_minutes=max(stats.longest_session_minutes, current_session_minutes),
        best_focus_score=stats.best_focus_score,
        favorite_room_id=stats.favorite_room_id,
        favorite_room_name=stats.favorite_room.name if stats.favorite_room else None,
        preferred_hour=stats.preferred_hour,
        total_xp_earned=stats.total_xp_earned,
        total_xp_bonus=stats.total_xp_bonus,
        achievements=stats.focus_room_achievements or []
    )


@router.get("/{room_id}/activities", response_model=List[ActivityResponse])
async def get_room_activities(
    room_id: int,
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Recuperer les activites recentes d'une room"""
    activities = await focus_room_service.get_room_activities(db, room_id, limit)

    return [
        ActivityResponse(
            id=a.id,
            activity_type=a.activity_type,
            user_id=a.user_id,
            username=a.user.username if a.user else "Unknown",
            avatar_url=a.user.avatar_url if a.user else None,
            message=a.message,
            extra_data=a.extra_data,
            created_at=a.created_at
        )
        for a in activities
    ]


# ==================== HELPER FUNCTIONS ====================

async def _room_to_response(db: AsyncSession, room: FocusRoom) -> FocusRoomResponse:
    """Convertit une room en response"""
    active_count = len([
        p for p in room.participants
        if p.status in [ParticipantStatus.FOCUSING, ParticipantStatus.BREAK, ParticipantStatus.DEEP_WORK]
    ]) if room.participants else 0

    return FocusRoomResponse(
        id=room.id,
        name=room.name,
        description=room.description,
        emoji=room.emoji,
        room_type=room.room_type,
        category=room.category,
        subject_id=room.subject_id,
        subject_name=room.subject.name if room.subject else None,
        university=room.university,
        promotion=room.promotion,
        max_participants=room.max_participants,
        is_active=room.is_active,
        is_private=room.is_private,
        invite_code=room.invite_code,
        creator_id=room.creator_id,
        creator_username=room.creator.username if room.creator else None,
        creator_avatar=room.creator.avatar_url if room.creator else None,
        total_focus_minutes=room.total_focus_minutes,
        total_sessions=room.total_sessions,
        total_unique_users=room.total_unique_users,
        today_focus_minutes=room.today_focus_minutes,
        today_sessions=room.today_sessions,
        active_participants=active_count,
        starts_at=room.starts_at,
        ends_at=room.ends_at,
        created_at=room.created_at,
        updated_at=room.updated_at
    )


async def _room_to_detail_response(db: AsyncSession, room: FocusRoom) -> FocusRoomDetailResponse:
    """Convertit une room en response detaillee"""
    base = await _room_to_response(db, room)

    participants = [
        await _participant_to_response(p)
        for p in room.participants
        if p.is_visible
    ]

    activities = await focus_room_service.get_room_activities(db, room.id, 20)
    activity_responses = [
        ActivityResponse(
            id=a.id,
            activity_type=a.activity_type,
            user_id=a.user_id,
            username=a.user.username if a.user else "Unknown",
            avatar_url=a.user.avatar_url if a.user else None,
            message=a.message,
            extra_data=a.extra_data,
            created_at=a.created_at
        )
        for a in activities
    ]

    stats = await focus_room_service.get_room_stats(db, room)

    return FocusRoomDetailResponse(
        **base.model_dump(),
        participants=participants,
        recent_activities=activity_responses,
        stats=stats
    )


async def _participant_to_response(participant: FocusRoomParticipant) -> ParticipantResponse:
    """Convertit un participant en response"""
    today_minutes = participant.get_today_total_minutes()
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[PARTICIPANT_RESPONSE] user_id={participant.user_id}, today_focus_minutes_db={participant.today_focus_minutes}, calculated_today_total={today_minutes}, status={participant.status}")
    return ParticipantResponse(
        id=participant.id,
        user_id=participant.user_id,
        username=participant.user.username if participant.user else "Unknown",
        avatar_url=participant.user.avatar_url if participant.user else None,
        level=participant.user.level if participant.user else 1,
        status=participant.status,
        current_activity=participant.current_activity,
        current_subject_name=participant.current_subject.name if participant.current_subject else None,
        joined_at=participant.joined_at,
        focus_minutes=today_minutes,  # Minutes du jour (sessions précédentes + actuelle)
        today_focus_minutes=today_minutes,  # Même valeur pour cohérence
        milestones_reached=participant.milestones_reached or [],
        is_visible=participant.is_visible
    )


async def _invitation_to_response(invitation: FocusRoomInvitation) -> InvitationResponse:
    """Convertit une invitation en response"""
    return InvitationResponse(
        id=invitation.id,
        room_id=invitation.room_id,
        room_name=invitation.room.name if invitation.room else "Unknown",
        room_emoji=invitation.room.emoji if invitation.room else "📚",
        inviter_id=invitation.inviter_id,
        inviter_username=invitation.inviter.username if invitation.inviter else "Unknown",
        inviter_avatar=invitation.inviter.avatar_url if invitation.inviter else None,
        invitee_id=invitation.invitee_id,
        invitee_username=invitation.invitee.username if invitation.invitee else "Unknown",
        status=invitation.status,
        message=invitation.message,
        created_at=invitation.created_at,
        expires_at=invitation.expires_at,
        responded_at=invitation.responded_at
    )
