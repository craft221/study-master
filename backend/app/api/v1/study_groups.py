from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.datetime_utils import utc_now
from app.models.user import User, UserProfile
from app.models.study_group import StudyGroup, StudyGroupMembership, MembershipRole, StudyGroupInvitation, InvitationStatus
from app.models.subject import Subject
from app.schemas.collaboration import (
    StudyGroupCreate,
    StudyGroupUpdate,
    StudyGroupResponse,
    StudyGroupDetailResponse,
    StudyGroupListResponse,
    StudyGroupMembershipResponse,
    StudyGroupMemberResponse,
    StudyGroupInvitationCreate,
    StudyGroupInvitationResponse
)
from app.services.xp_service import award_xp
from app.services.notification_service import NotificationService

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
    # Accéder aux données du profil via le sous-modèle
    user_university = current_user.profile.university if current_user.profile else None
    user_promotion = current_user.profile.promotion if current_user.profile else None

    new_group = StudyGroup(
        creator_id=current_user.id,
        name=group_data.name,
        description=group_data.description,
        subject_id=group_data.subject_id,
        university=group_data.university or user_university,
        promotion=group_data.promotion or user_promotion,
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
    await award_xp(
        user=current_user,
        amount=50,
        reason="Création d'un groupe d'étude",
        event_type="study_group_created"
    )

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
            user_avatar = user.profile.avatar_url if user.profile else None
            member_responses.append(
                StudyGroupMembershipResponse(
                    id=member.id,
                    user_id=member.user_id,
                    username=user.username,
                    avatar_url=user_avatar,
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
    from app.core.datetime_utils import utc_now
    from app.models.collaboration import GroupActivity

    new_member = StudyGroupMembership(
        group_id=group_id,
        user_id=current_user.id,
        role=MembershipRole.MEMBER,
        joined_at=utc_now()
    )

    db.add(new_member)
    group.current_members += 1

    # Créer l'activité du groupe
    activity = GroupActivity(
        group_id=group_id,
        user_id=current_user.id,
        activity_type="member_joined",
        description=f"{current_user.username} a rejoint le groupe",
        activity_metadata={"member_id": current_user.id}
    )
    db.add(activity)

    # XP bonus
    await award_xp(
        user=current_user,
        amount=10,
        reason="Rejoindre un groupe d'étude",
        event_type="study_group_joined"
    )

    await db.commit()
    await db.refresh(new_member)

    current_user_avatar = current_user.profile.avatar_url if current_user.profile else None
    return StudyGroupMembershipResponse(
        id=new_member.id,
        user_id=new_member.user_id,
        username=current_user.username,
        avatar_url=current_user_avatar,
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
    from app.models.collaboration import SharedGroupContent, GroupActivity

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

    # Récupérer le groupe pour mettre à jour les stats
    group = await db.get(StudyGroup, group_id)

    # Créer le partage
    shared_content = SharedGroupContent(
        group_id=group_id,
        user_id=current_user.id,
        content_type="note",
        content_id=note.id,
        content_data={"title": note.title, "content": note.content}
    )
    db.add(shared_content)

    # Mettre à jour les statistiques du groupe
    group.total_shared_notes = (group.total_shared_notes or 0) + 1

    # Créer l'activité du groupe
    activity = GroupActivity(
        group_id=group_id,
        user_id=current_user.id,
        activity_type="note_shared",
        description=f"{current_user.username} a partagé une note: {note.title}",
        activity_metadata={"note_id": note.id, "note_title": note.title}
    )
    db.add(activity)

    # Mettre à jour le score de contribution du membre
    member.contribution_score = (member.contribution_score or 0) + 5

    # XP bonus
    await award_xp(
        user=current_user,
        amount=5,
        reason="Partage d'une note dans un groupe",
        event_type="note_shared"
    )

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
    from app.models.flashcard import Flashcard
    from app.models.collaboration import SharedGroupContent, GroupActivity

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

    # Le deck_id est en fait le deck_name (string)
    deck_name = str(deck_data["deck_id"])

    # Vérifier que le deck existe (au moins une carte avec ce deck_name)
    cards_query = select(Flashcard).where(
        and_(
            Flashcard.user_id == current_user.id,
            Flashcard.deck_name == deck_name
        )
    )
    cards_result = await db.execute(cards_query)
    cards = cards_result.scalars().all()

    if not cards:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard deck not found"
        )

    card_count = len(cards)

    # Récupérer le groupe pour mettre à jour les stats
    group = await db.get(StudyGroup, group_id)

    # Créer le partage
    shared_content = SharedGroupContent(
        group_id=group_id,
        user_id=current_user.id,
        content_type="flashcard_deck",
        content_id=0,  # Pas d'ID car ce n'est pas une entité avec ID
        content_data={"name": deck_name, "card_count": card_count}
    )
    db.add(shared_content)

    # Mettre à jour les statistiques du groupe
    group.total_shared_notes = (group.total_shared_notes or 0) + 1

    # Créer l'activité du groupe
    activity = GroupActivity(
        group_id=group_id,
        user_id=current_user.id,
        activity_type="flashcard_shared",
        description=f"{current_user.username} a partagé un deck: {deck_name} ({card_count} cartes)",
        activity_metadata={"deck_name": deck_name, "card_count": card_count}
    )
    db.add(activity)

    # Mettre à jour le score de contribution du membre
    member.contribution_score = (member.contribution_score or 0) + 5

    # XP bonus
    await award_xp(
        user=current_user,
        amount=5,
        reason="Partage de flashcards dans un groupe",
        event_type="flashcards_shared"
    )

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
    from app.models.flashcard import Flashcard
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

    # Récupérer le deck_name depuis content_data
    original_deck_name = shared.content_data.get("name")
    if not original_deck_name:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original deck not found"
        )

    # Récupérer les cartes originales de l'utilisateur qui a partagé
    original_cards_query = select(Flashcard).where(
        and_(
            Flashcard.user_id == shared.user_id,
            Flashcard.deck_name == original_deck_name
        )
    )
    original_cards_result = await db.execute(original_cards_query)
    original_cards = original_cards_result.scalars().all()

    if not original_cards:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original deck cards not found"
        )

    # Créer un nouveau deck_name pour l'utilisateur courant
    new_deck_name = f"{original_deck_name} (copie)"

    # Copier les flashcards
    for card in original_cards:
        new_card = Flashcard(
            user_id=current_user.id,
            deck_name=new_deck_name,
            front=card.front,
            back=card.back,
            hint=card.hint,
            explanation=card.explanation,
            subject_id=card.subject_id,
            tags=card.tags,
            is_ai_generated=card.is_ai_generated
        )
        db.add(new_card)

    await db.commit()

    return {"message": "Deck copied successfully", "deck_name": new_deck_name}


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
    await award_xp(
        user=current_user,
        amount=10,
        reason="Création d'une session de groupe",
        event_type="group_session_created"
    )

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
    await award_xp(
        user=current_user,
        amount=5,
        reason="Participation à une session de groupe",
        event_type="group_session_joined"
    )

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
    await award_xp(
        user=current_user,
        amount=5,
        reason="Partage d'un quiz dans un groupe",
        event_type="quiz_shared"
    )

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
            "metadata": activity.activity_metadata
        })

    return activities_data


# ============================================
# GROUP INVITATIONS
# ============================================

@router.post("/{group_id}/invite", response_model=StudyGroupInvitationResponse)
async def invite_user_to_group(
    group_id: int,
    invitation_data: StudyGroupInvitationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Inviter un utilisateur à rejoindre le groupe"""
    # Vérifier que le groupe existe
    group = await db.get(StudyGroup, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study group not found"
        )

    # Vérifier que l'utilisateur actuel est membre du groupe
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
            detail="You must be a member to invite others"
        )

    # Vérifier que l'invité existe
    invitee = await db.get(User, invitation_data.invitee_id)
    if not invitee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Vérifier que l'invité n'est pas déjà membre
    existing_member_query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == invitation_data.invitee_id
        )
    )
    existing_member_result = await db.execute(existing_member_query)
    if existing_member_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this group"
        )

    # Vérifier qu'il n'y a pas déjà une invitation en attente
    existing_inv_query = select(StudyGroupInvitation).where(
        and_(
            StudyGroupInvitation.group_id == group_id,
            StudyGroupInvitation.invitee_id == invitation_data.invitee_id,
            StudyGroupInvitation.status == "pending"
        )
    )
    existing_inv_result = await db.execute(existing_inv_query)
    if existing_inv_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An invitation is already pending for this user"
        )

    # Vérifier la capacité du groupe
    if group.current_members >= group.max_members:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group is full"
        )

    # Créer l'invitation
    now = utc_now()
    invitation = StudyGroupInvitation(
        group_id=group_id,
        inviter_id=current_user.id,
        invitee_id=invitation_data.invitee_id,
        message=invitation_data.message,
        status="pending",
        created_at=now,
        expires_at=now + timedelta(days=7)
    )

    db.add(invitation)
    await db.flush()

    # Envoyer une notification à l'invité
    notification_service = NotificationService(db)
    await notification_service.create_notification(
        user_id=invitation_data.invitee_id,
        notification_type="group_invitation",
        title=f"Invitation au groupe {group.name}",
        message=f"{current_user.username} vous invite à rejoindre le groupe d'étude {group.name}",
        data={
            "invitation_id": invitation.id,
            "group_id": group_id,
            "group_name": group.name,
            "inviter_username": current_user.username
        },
        priority="high"
    )

    await db.commit()
    await db.refresh(invitation)

    current_user_avatar = current_user.profile.avatar_url if current_user.profile else None

    return StudyGroupInvitationResponse(
        id=invitation.id,
        group_id=group_id,
        group_name=group.name,
        inviter_id=current_user.id,
        inviter_username=current_user.username,
        inviter_avatar=current_user_avatar,
        invitee_id=invitation_data.invitee_id,
        invitee_username=invitee.username,
        status=invitation.status,
        message=invitation.message,
        created_at=invitation.created_at,
        expires_at=invitation.expires_at,
        responded_at=invitation.responded_at
    )


@router.get("/invitations/received", response_model=List[StudyGroupInvitationResponse])
async def get_my_group_invitations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer mes invitations reçues en attente"""
    now = utc_now()

    query = select(StudyGroupInvitation).where(
        and_(
            StudyGroupInvitation.invitee_id == current_user.id,
            StudyGroupInvitation.status == "pending",
            StudyGroupInvitation.expires_at > now
        )
    ).order_by(StudyGroupInvitation.created_at.desc())

    result = await db.execute(query)
    invitations = result.scalars().all()

    # Enrichir avec les infos
    invitations_data = []
    for inv in invitations:
        group = await db.get(StudyGroup, inv.group_id)
        inviter = await db.get(User, inv.inviter_id)
        inviter_avatar = inviter.profile.avatar_url if inviter and inviter.profile else None

        invitations_data.append(StudyGroupInvitationResponse(
            id=inv.id,
            group_id=inv.group_id,
            group_name=group.name if group else "Unknown",
            inviter_id=inv.inviter_id,
            inviter_username=inviter.username if inviter else "Unknown",
            inviter_avatar=inviter_avatar,
            invitee_id=inv.invitee_id,
            invitee_username=current_user.username,
            status=inv.status,
            message=inv.message,
            created_at=inv.created_at,
            expires_at=inv.expires_at,
            responded_at=inv.responded_at
        ))

    return invitations_data


@router.post("/invitations/{invitation_id}/accept", response_model=StudyGroupMembershipResponse)
async def accept_group_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Accepter une invitation à rejoindre un groupe"""
    invitation = await db.get(StudyGroupInvitation, invitation_id)

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    if invitation.invitee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation is not for you"
        )

    if invitation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has already been processed"
        )

    now = utc_now()
    if invitation.expires_at < now:
        invitation.status = "expired"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has expired"
        )

    # Vérifier que le groupe existe toujours
    group = await db.get(StudyGroup, invitation.group_id)
    if not group or group.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group is no longer available"
        )

    # Vérifier la capacité
    if group.current_members >= group.max_members:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group is full"
        )

    # Vérifier si déjà membre
    existing_query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == invitation.group_id,
            StudyGroupMembership.user_id == current_user.id
        )
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of this group"
        )

    # Mettre à jour l'invitation
    invitation.status = "accepted"
    invitation.responded_at = now

    # Créer le membership
    from app.models.collaboration import GroupActivity

    new_member = StudyGroupMembership(
        group_id=invitation.group_id,
        user_id=current_user.id,
        role=MembershipRole.MEMBER,
        joined_at=now
    )

    db.add(new_member)
    group.current_members += 1

    # Créer l'activité du groupe
    activity = GroupActivity(
        group_id=invitation.group_id,
        user_id=current_user.id,
        activity_type="member_joined",
        description=f"{current_user.username} a rejoint le groupe via invitation",
        activity_metadata={"member_id": current_user.id, "invited_by": invitation.inviter_id}
    )
    db.add(activity)

    # XP bonus
    await award_xp(
        user=current_user,
        amount=10,
        reason="Rejoindre un groupe d'étude via invitation",
        event_type="study_group_joined"
    )

    # Notifier l'inviteur
    notification_service = NotificationService(db)
    await notification_service.create_notification(
        user_id=invitation.inviter_id,
        notification_type="invitation_accepted",
        title="Invitation acceptée",
        message=f"{current_user.username} a accepté votre invitation et a rejoint {group.name}",
        data={
            "group_id": invitation.group_id,
            "group_name": group.name,
            "new_member_username": current_user.username
        }
    )

    await db.commit()
    await db.refresh(new_member)

    current_user_avatar = current_user.profile.avatar_url if current_user.profile else None
    return StudyGroupMembershipResponse(
        id=new_member.id,
        user_id=new_member.user_id,
        username=current_user.username,
        avatar_url=current_user_avatar,
        role=new_member.role,
        joined_at=new_member.joined_at,
        contribution_score=new_member.contribution_score
    )


@router.post("/invitations/{invitation_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
async def decline_group_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Refuser une invitation"""
    invitation = await db.get(StudyGroupInvitation, invitation_id)

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    if invitation.invitee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation is not for you"
        )

    if invitation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has already been processed"
        )

    invitation.status = "declined"
    invitation.responded_at = utc_now()

    await db.commit()

    return None
