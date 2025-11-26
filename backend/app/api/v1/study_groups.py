from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.study_group import StudyGroup, StudyGroupMembership, MembershipRole
from app.models.subject import Subject
from app.schemas.collaboration import (
    StudyGroupCreate,
    StudyGroupUpdate,
    StudyGroupResponse,
    StudyGroupDetailResponse,
    StudyGroupListResponse,
    StudyGroupMembershipResponse,
    StudyGroupMemberResponse
)

router = APIRouter()


@router.post("/", response_model=StudyGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_study_group(
    group_data: StudyGroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Créer un nouveau groupe d'étude"""
    # Vérifier le sujet si fourni
    if group_data.subject_id:
        subject = await db.get(Subject, group_data.subject_id)
        if not subject or subject.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subject not found"
            )
    
    # Créer le groupe
    new_group = StudyGroup(
        creator_id=current_user.id,
        name=group_data.name,
        description=group_data.description,
        subject_id=group_data.subject_id,
        university=group_data.university or current_user.university,
        promotion=group_data.promotion or current_user.promotion,
        max_members=group_data.max_members,
        is_private=group_data.is_private,
        cover_image_url=group_data.cover_image_url,
        status="active",
        current_members=1
    )
    
    db.add(new_group)
    await db.flush()
    
    # Ajouter le créateur comme owner
    creator_member = StudyGroupMembership(
        group_id=new_group.id,
        user_id=current_user.id,
        role=MembershipRole.OWNER
    )
    
    db.add(creator_member)
    
    # XP bonus pour création de groupe
    current_user.total_xp += 50
    current_user.level = (current_user.total_xp // 100) + 1
    
    await db.commit()
    await db.refresh(new_group)
    
    return new_group


@router.get("/", response_model=StudyGroupListResponse)
async def get_study_groups(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    subject_id: Optional[int] = None,
    university: Optional[str] = None,
    promotion: Optional[str] = None,
    only_my_groups: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Rechercher des groupes d'étude"""
    if only_my_groups:
        # Récupérer les groupes dont l'utilisateur est membre
        member_query = select(StudyGroupMembership.group_id).where(
            StudyGroupMembership.user_id == current_user.id
        )
        member_result = await db.execute(member_query)
        group_ids = member_result.scalars().all()
        
        query = select(StudyGroup).where(StudyGroup.id.in_(group_ids))
    else:
        # Groupes publics ou dont l'utilisateur est membre
        query = select(StudyGroup).where(
            or_(
                StudyGroup.is_private == False,
                StudyGroup.creator_id == current_user.id
            )
        )
    
    # Filtres
    query = query.where(StudyGroup.status == "active")
    
    if search:
        query = query.where(
            or_(
                StudyGroup.name.ilike(f"%{search}%"),
                StudyGroup.description.ilike(f"%{search}%")
            )
        )
    
    if subject_id:
        query = query.where(StudyGroup.subject_id == subject_id)
    
    if university:
        query = query.where(StudyGroup.university == university)
    
    if promotion:
        query = query.where(StudyGroup.promotion == promotion)
    
    query = query.order_by(StudyGroup.created_at.desc())
    
    # Compte total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    result = await db.execute(query)
    groups = result.scalars().all()
    
    return StudyGroupListResponse(
        groups=groups,
        total=total or 0,
        page=page,
        page_size=page_size
    )


@router.get("/{group_id}", response_model=StudyGroupDetailResponse)
async def get_study_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les détails d'un groupe"""
    group = await db.get(StudyGroup, group_id)
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study group not found"
        )
    
    # Vérifier l'accès pour les groupes privés
    if group.is_private:
        member_query = select(StudyGroupMembership).where(
            and_(
                StudyGroupMembership.group_id == group_id,
                StudyGroupMembership.user_id == current_user.id
            )
        )
        member_result = await db.execute(member_query)
        member = member_result.scalar_one_or_none()
        
        if not member and group.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to private group"
            )
    
    # Charger les membres
    members_query = select(StudyGroupMembership).where(
        StudyGroupMembership.group_id == group_id
    ).order_by(StudyGroupMembership.role, StudyGroupMembership.joined_at)
    
    members_result = await db.execute(members_query)
    members = members_result.scalars().all()
    
    # Enrichir les données membres
    member_responses = []
    for member in members:
        user = await db.get(User, member.user_id)
        if user:
            member_responses.append(
                StudyGroupMembershipResponse(
                    id=member.id,
                    user_id=member.user_id,
                    username=user.username,
                    avatar_url=user.avatar_url,
                    role=member.role,
                    joined_at=member.joined_at,
                    contribution_score=member.contribution_score
                )
            )
    
    # Créer la réponse détaillée
    response = StudyGroupDetailResponse(
        id=group.id,
        creator_id=group.creator_id,
        name=group.name,
        description=group.description,
        subject_id=group.subject_id,
        university=group.university,
        promotion=group.promotion,
        max_members=group.max_members,
        is_private=group.is_private,
        cover_image_url=group.cover_image_url,
        status=group.status,
        current_members=group.current_members,
        total_study_hours=group.total_study_hours,
        total_shared_notes=group.total_shared_notes,
        created_at=group.created_at,
        updated_at=group.updated_at,
        members=member_responses
    )
    
    return response


@router.put("/{group_id}", response_model=StudyGroupResponse)
async def update_study_group(
    group_id: int,
    group_data: StudyGroupUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mettre à jour un groupe (admin/créateur seulement)"""
    group = await db.get(StudyGroup, group_id)
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study group not found"
        )
    
    # Vérifier les permissions
    member_query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == current_user.id
        )
    )
    member_result = await db.execute(member_query)
    member = member_result.scalar_one_or_none()
    
    if group.creator_id != current_user.id and (not member or member.role not in [MembershipRole.OWNER, MembershipRole.ADMIN]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner and admins can update the group"
        )
    
    # Mettre à jour
    update_data = group_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(group, key, value)
    
    await db.commit()
    await db.refresh(group)
    
    return group


@router.post("/{group_id}/join", response_model=StudyGroupMembershipResponse)
async def join_study_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Rejoindre un groupe d'étude"""
    group = await db.get(StudyGroup, group_id)
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study group not found"
        )
    
    if group.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group is not active"
        )
    
    # Vérifier limite de membres
    if group.current_members >= group.max_members:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group is full"
        )
    
    # Vérifier si déjà membre
    existing_query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == current_user.id
        )
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already a member of this group"
        )
    
    # Ajouter comme membre
    new_member = StudyGroupMembership(
        group_id=group_id,
        user_id=current_user.id,
        role=MembershipRole.MEMBER
    )
    
    db.add(new_member)
    group.current_members += 1
    
    # XP bonus
    current_user.total_xp += 10
    current_user.level = (current_user.total_xp // 100) + 1
    
    await db.commit()
    await db.refresh(new_member)
    
    return StudyGroupMembershipResponse(
        id=new_member.id,
        user_id=new_member.user_id,
        username=current_user.username,
        avatar_url=current_user.avatar_url,
        role=new_member.role,
        joined_at=new_member.joined_at,
        contribution_score=new_member.contribution_score
    )


@router.post("/{group_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_study_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Quitter un groupe d'étude"""
    group = await db.get(StudyGroup, group_id)
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study group not found"
        )
    
    # Le créateur ne peut pas quitter son propre groupe
    if group.creator_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group creator cannot leave. Delete the group instead."
        )
    
    # Trouver le membership
    member_query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == current_user.id
        )
    )
    member_result = await db.execute(member_query)
    member = member_result.scalar_one_or_none()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not a member of this group"
        )
    
    await db.delete(member)
    group.current_members -= 1
    
    await db.commit()
    
    return None


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_study_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprimer un groupe (créateur seulement)"""
    group = await db.get(StudyGroup, group_id)
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study group not found"
        )
    
    if group.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can delete the group"
        )
    
    # Supprimer tous les membres
    members_query = select(StudyGroupMembership).where(StudyGroupMembership.group_id == group_id)
    members_result = await db.execute(members_query)
    members = members_result.scalars().all()
    
    for member in members:
        await db.delete(member)
    
    # Supprimer le groupe
    await db.delete(group)
    await db.commit()

    return None


# ============================================
# SHARED NOTES
# ============================================

@router.post("/{group_id}/share-note", status_code=status.HTTP_201_CREATED)
async def share_note_with_group(
    group_id: int,
    note_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Partager une note avec le groupe"""
    from app.models.note import Note
    from app.models.collaboration import SharedGroupContent

    # Vérifier membership
    member_query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == current_user.id
        )
    )
    member_result = await db.execute(member_query)
    member = member_result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )

    # Vérifier que la note existe et appartient à l'utilisateur
    note = await db.get(Note, note_data["note_id"])
    if not note or note.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )

    # Créer le partage
    shared_content = SharedGroupContent(
        group_id=group_id,
        user_id=current_user.id,
        content_type="note",
        content_id=note.id,
        content_data={"title": note.title, "content": note.content}
    )

    db.add(shared_content)

    # XP bonus
    current_user.total_xp += 5
    current_user.level = (current_user.total_xp // 100) + 1

    await db.commit()
    await db.refresh(shared_content)

    return {"id": shared_content.id, "message": "Note shared successfully"}


@router.get("/{group_id}/shared-notes")
async def get_shared_notes(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer toutes les notes partagées dans le groupe"""
    from app.models.collaboration import SharedGroupContent

    # Vérifier membership
    member_query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == current_user.id
        )
    )
    member_result = await db.execute(member_query)
    member = member_result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )

    # Récupérer les notes partagées
    query = select(SharedGroupContent).where(
        and_(
            SharedGroupContent.group_id == group_id,
            SharedGroupContent.content_type == "note"
        )
    ).order_by(SharedGroupContent.shared_at.desc())

    result = await db.execute(query)
    shared_notes = result.scalars().all()

    # Enrichir avec les infos utilisateur
    notes_data = []
    for shared in shared_notes:
        user = await db.get(User, shared.user_id)
        notes_data.append({
            "id": shared.id,
            "note_id": shared.content_id,
            "note_title": shared.content_data.get("title", ""),
            "note_content": shared.content_data.get("content", ""),
            "shared_by_user_id": shared.user_id,
            "shared_by_username": user.username if user else "Unknown",
            "shared_at": shared.shared_at.isoformat(),
            "subject_name": shared.content_data.get("subject_name")
        })

    return notes_data


@router.delete("/{group_id}/shared-notes/{shared_note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unshare_note(
    group_id: int,
    shared_note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retirer une note partagée"""
    from app.models.collaboration import SharedGroupContent

    shared = await db.get(SharedGroupContent, shared_note_id)

    if not shared or shared.group_id != group_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared note not found"
        )

    if shared.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only remove your own shared notes"
        )

    await db.delete(shared)
    await db.commit()

    return None


# ============================================
# SHARED FLASHCARDS
# ============================================

@router.post("/{group_id}/share-flashcards", status_code=status.HTTP_201_CREATED)
async def share_flashcards_with_group(
    group_id: int,
    deck_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Partager un deck de flashcards avec le groupe"""
    from app.models.flashcard import FlashcardDeck
    from app.models.collaboration import SharedGroupContent

    # Vérifier membership
    member_query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == current_user.id
        )
    )
    member_result = await db.execute(member_query)
    member = member_result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )

    # Vérifier le deck
    deck = await db.get(FlashcardDeck, deck_data["deck_id"])
    if not deck or deck.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard deck not found"
        )

    # Créer le partage
    shared_content = SharedGroupContent(
        group_id=group_id,
        user_id=current_user.id,
        content_type="flashcard_deck",
        content_id=deck.id,
        content_data={"name": deck.name, "card_count": deck.card_count}
    )

    db.add(shared_content)

    # XP bonus
    current_user.total_xp += 5
    current_user.level = (current_user.total_xp // 100) + 1

    await db.commit()
    await db.refresh(shared_content)

    return {"id": shared_content.id, "message": "Flashcards shared successfully"}


@router.get("/{group_id}/shared-flashcards")
async def get_shared_flashcards(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer tous les decks partagés"""
    from app.models.collaboration import SharedGroupContent

    # Vérifier membership
    member_query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == current_user.id
        )
    )
    member_result = await db.execute(member_query)
    member = member_result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )

    # Récupérer les decks partagés
    query = select(SharedGroupContent).where(
        and_(
            SharedGroupContent.group_id == group_id,
            SharedGroupContent.content_type == "flashcard_deck"
        )
    ).order_by(SharedGroupContent.shared_at.desc())

    result = await db.execute(query)
    shared_decks = result.scalars().all()

    # Enrichir avec les infos utilisateur
    decks_data = []
    for shared in shared_decks:
        user = await db.get(User, shared.user_id)
        decks_data.append({
            "id": shared.id,
            "deck_id": shared.content_id,
            "deck_name": shared.content_data.get("name", ""),
            "card_count": shared.content_data.get("card_count", 0),
            "shared_by_user_id": shared.user_id,
            "shared_by_username": user.username if user else "Unknown",
            "shared_at": shared.shared_at.isoformat()
        })

    return decks_data


@router.post("/{group_id}/copy-flashcards/{shared_deck_id}")
async def copy_shared_flashcards(
    group_id: int,
    shared_deck_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Copier un deck partagé dans sa collection"""
    from app.models.flashcard import FlashcardDeck, Flashcard
    from app.models.collaboration import SharedGroupContent

    # Vérifier membership
    member_query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == current_user.id
        )
    )
    member_result = await db.execute(member_query)
    member = member_result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )

    # Récupérer le partage
    shared = await db.get(SharedGroupContent, shared_deck_id)
    if not shared or shared.group_id != group_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared deck not found"
        )

    # Récupérer le deck original
    original_deck = await db.get(FlashcardDeck, shared.content_id)
    if not original_deck:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original deck not found"
        )

    # Créer une copie
    new_deck = FlashcardDeck(
        user_id=current_user.id,
        name=f"{original_deck.name} (copie)",
        description=original_deck.description,
        subject_id=original_deck.subject_id,
        card_count=original_deck.card_count
    )

    db.add(new_deck)
    await db.flush()

    # Copier les flashcards
    cards_query = select(Flashcard).where(Flashcard.deck_id == original_deck.id)
    cards_result = await db.execute(cards_query)
    original_cards = cards_result.scalars().all()

    for card in original_cards:
        new_card = Flashcard(
            deck_id=new_deck.id,
            question=card.question,
            answer=card.answer,
            difficulty=card.difficulty
        )
        db.add(new_card)

    await db.commit()
    await db.refresh(new_deck)

    return {"message": "Deck copied successfully", "deck_id": new_deck.id}


# ============================================
# GROUP SESSIONS
# ============================================

@router.post("/{group_id}/sessions", status_code=status.HTTP_201_CREATED)
async def create_group_session(
    group_id: int,
    session_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Créer une session d'étude de groupe"""
    from app.models.collaboration import GroupStudySession, GroupSessionParticipant

    # Vérifier membership
    member_query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == current_user.id
        )
    )
    member_result = await db.execute(member_query)
    member = member_result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )

    # Créer la session
    session = GroupStudySession(
        group_id=group_id,
        title=session_data["title"],
        description=session_data.get("description"),
        session_type=session_data["session_type"],
        start_time=datetime.fromisoformat(session_data["start_time"].replace("Z", "+00:00")),
        duration_minutes=session_data["duration_minutes"],
        created_by_user_id=current_user.id,
        status="scheduled"
    )

    db.add(session)
    await db.flush()

    # Ajouter le créateur comme participant
    participant = GroupSessionParticipant(
        session_id=session.id,
        user_id=current_user.id
    )
    db.add(participant)

    # XP bonus
    current_user.total_xp += 10
    current_user.level = (current_user.total_xp // 100) + 1

    await db.commit()
    await db.refresh(session)

    return {"id": session.id, "message": "Session created successfully"}


@router.get("/{group_id}/sessions")
async def get_group_sessions(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer toutes les sessions du groupe"""
    from app.models.collaboration import GroupStudySession, GroupSessionParticipant

    # Vérifier membership
    member_query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == current_user.id
        )
    )
    member_result = await db.execute(member_query)
    member = member_result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )

    # Récupérer les sessions
    query = select(GroupStudySession).where(
        GroupStudySession.group_id == group_id
    ).order_by(GroupStudySession.start_time.desc())

    result = await db.execute(query)
    sessions = result.scalars().all()

    # Enrichir avec participants
    sessions_data = []
    for session in sessions:
        creator = await db.get(User, session.created_by_user_id)

        # Récupérer les participants
        parts_query = select(GroupSessionParticipant).where(
            GroupSessionParticipant.session_id == session.id
        )
        parts_result = await db.execute(parts_query)
        participants = parts_result.scalars().all()

        participants_data = []
        for part in participants:
            user = await db.get(User, part.user_id)
            if user:
                participants_data.append({
                    "user_id": user.id,
                    "username": user.username,
                    "joined_at": part.joined_at.isoformat()
                })

        sessions_data.append({
            "id": session.id,
            "title": session.title,
            "description": session.description,
            "session_type": session.session_type,
            "start_time": session.start_time.isoformat(),
            "duration_minutes": session.duration_minutes,
            "created_by_user_id": session.created_by_user_id,
            "created_by_username": creator.username if creator else "Unknown",
            "participants": participants_data,
            "status": session.status
        })

    return sessions_data


@router.post("/{group_id}/sessions/{session_id}/join")
async def join_group_session(
    group_id: int,
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Rejoindre une session de groupe"""
    from app.models.collaboration import GroupStudySession, GroupSessionParticipant

    # Vérifier membership
    member_query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == current_user.id
        )
    )
    member_result = await db.execute(member_query)
    member = member_result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )

    # Vérifier la session
    session = await db.get(GroupStudySession, session_id)
    if not session or session.group_id != group_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    # Vérifier si déjà participant
    existing_query = select(GroupSessionParticipant).where(
        and_(
            GroupSessionParticipant.session_id == session_id,
            GroupSessionParticipant.user_id == current_user.id
        )
    )
    existing_result = await db.execute(existing_query)
    existing = existing_result.scalar_one_or_none()

    if existing:
        return {"message": "Already joined"}

    # Ajouter comme participant
    participant = GroupSessionParticipant(
        session_id=session_id,
        user_id=current_user.id
    )
    db.add(participant)

    # XP bonus
    current_user.total_xp += 5
    current_user.level = (current_user.total_xp // 100) + 1

    await db.commit()

    return {"message": "Joined session successfully"}


@router.post("/{group_id}/sessions/{session_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_group_session(
    group_id: int,
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Quitter une session"""
    from app.models.collaboration import GroupSessionParticipant

    part_query = select(GroupSessionParticipant).where(
        and_(
            GroupSessionParticipant.session_id == session_id,
            GroupSessionParticipant.user_id == current_user.id
        )
    )
    part_result = await db.execute(part_query)
    participant = part_result.scalar_one_or_none()

    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not a participant"
        )

    await db.delete(participant)
    await db.commit()

    return None


@router.delete("/{group_id}/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_group_session(
    group_id: int,
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Annuler une session (créateur seulement)"""
    from app.models.collaboration import GroupStudySession

    session = await db.get(GroupStudySession, session_id)

    if not session or session.group_id != group_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    if session.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can cancel the session"
        )

    session.status = "cancelled"
    await db.commit()

    return None


# ============================================
# SHARED QUIZZES
# ============================================

@router.post("/{group_id}/share-quiz", status_code=status.HTTP_201_CREATED)
async def share_quiz_with_group(
    group_id: int,
    quiz_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Partager un quiz avec le groupe"""
    from app.models.quiz import Quiz
    from app.models.collaboration import SharedGroupContent

    # Vérifier membership
    member_query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == current_user.id
        )
    )
    member_result = await db.execute(member_query)
    member = member_result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )

    # Vérifier le quiz
    quiz = await db.get(Quiz, quiz_data["quiz_id"])
    if not quiz or quiz.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )

    # Créer le partage
    shared_content = SharedGroupContent(
        group_id=group_id,
        user_id=current_user.id,
        content_type="quiz",
        content_id=quiz.id,
        content_data={"title": quiz.title, "question_count": quiz.question_count}
    )

    db.add(shared_content)

    # XP bonus
    current_user.total_xp += 5
    current_user.level = (current_user.total_xp // 100) + 1

    await db.commit()
    await db.refresh(shared_content)

    return {"id": shared_content.id, "message": "Quiz shared successfully"}


@router.get("/{group_id}/shared-quizzes")
async def get_shared_quizzes(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer tous les quiz partagés"""
    from app.models.collaboration import SharedGroupContent
    from app.models.quiz import QuizAttempt

    # Vérifier membership
    member_query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == current_user.id
        )
    )
    member_result = await db.execute(member_query)
    member = member_result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )

    # Récupérer les quiz partagés
    query = select(SharedGroupContent).where(
        and_(
            SharedGroupContent.group_id == group_id,
            SharedGroupContent.content_type == "quiz"
        )
    ).order_by(SharedGroupContent.shared_at.desc())

    result = await db.execute(query)
    shared_quizzes = result.scalars().all()

    # Enrichir avec infos
    quizzes_data = []
    for shared in shared_quizzes:
        user = await db.get(User, shared.user_id)

        # Compter combien de membres ont complété
        attempts_query = select(func.count(func.distinct(QuizAttempt.user_id))).where(
            QuizAttempt.quiz_id == shared.content_id
        )
        attempts_result = await db.execute(attempts_query)
        completed_count = attempts_result.scalar() or 0

        quizzes_data.append({
            "id": shared.id,
            "quiz_id": shared.content_id,
            "quiz_title": shared.content_data.get("title", ""),
            "question_count": shared.content_data.get("question_count", 0),
            "shared_by_user_id": shared.user_id,
            "shared_by_username": user.username if user else "Unknown",
            "shared_at": shared.shared_at.isoformat(),
            "completed_by_count": completed_count
        })

    return quizzes_data


# ============================================
# GROUP ACTIVITIES
# ============================================

@router.get("/{group_id}/activities")
async def get_group_activities(
    group_id: int,
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les activités récentes du groupe"""
    from app.models.collaboration import GroupActivity

    # Vérifier membership
    member_query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == current_user.id
        )
    )
    member_result = await db.execute(member_query)
    member = member_result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )

    # Récupérer les activités
    query = select(GroupActivity).where(
        GroupActivity.group_id == group_id
    ).order_by(GroupActivity.created_at.desc()).limit(limit)

    result = await db.execute(query)
    activities = result.scalars().all()

    # Enrichir avec infos utilisateur
    activities_data = []
    for activity in activities:
        user = await db.get(User, activity.user_id)
        activities_data.append({
            "id": activity.id,
            "activity_type": activity.activity_type,
            "user_id": activity.user_id,
            "username": user.username if user else "Unknown",
            "description": activity.description,
            "created_at": activity.created_at.isoformat(),
            "metadata": activity.metadata
        })

    return activities_data
