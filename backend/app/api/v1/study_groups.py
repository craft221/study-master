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
