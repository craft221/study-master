"""
Endpoints pour les messages de groupe
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.study_group import StudyGroup, StudyGroupMembership
from app.models.group_message import GroupMessage
from app.schemas.group_message import (
    GroupMessageCreate,
    GroupMessageUpdate,
    GroupMessageResponse,
    GroupMessageListResponse
)

router = APIRouter()


async def check_group_membership(
    group_id: int,
    user_id: int,
    db: AsyncSession
) -> bool:
    """Vérifier si l'utilisateur est membre du groupe"""
    query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == user_id
        )
    )
    result = await db.execute(query)
    return result.scalar_one_or_none() is not None


@router.get("/{group_id}/messages", response_model=GroupMessageListResponse)
async def get_group_messages(
    group_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les messages d'un groupe"""
    # Vérifier que le groupe existe
    group = await db.get(StudyGroup, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study group not found"
        )

    # Vérifier membership
    is_member = await check_group_membership(group_id, current_user.id, db)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this group"
        )

    # Construire la requête
    query = select(GroupMessage).where(
        GroupMessage.group_id == group_id
    ).order_by(desc(GroupMessage.created_at))

    # Compte total
    count_query = select(func.count()).select_from(GroupMessage).where(
        GroupMessage.group_id == group_id
    )
    total = await db.scalar(count_query)

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    messages = result.scalars().all()

    # Enrichir avec les infos utilisateur
    message_responses = []
    for msg in messages:
        user = await db.get(User, msg.user_id)
        if user:
            message_responses.append(
                GroupMessageResponse(
                    id=msg.id,
                    group_id=msg.group_id,
                    user_id=msg.user_id,
                    username=user.username,
                    avatar_url=user.avatar_url,
                    content=msg.content,
                    is_edited=msg.is_edited,
                    created_at=msg.created_at,
                    updated_at=msg.updated_at
                )
            )

    return GroupMessageListResponse(
        messages=message_responses,
        total=total or 0,
        page=page,
        page_size=page_size
    )


@router.post("/{group_id}/messages", response_model=GroupMessageResponse, status_code=status.HTTP_201_CREATED)
async def create_group_message(
    group_id: int,
    message_data: GroupMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Envoyer un message dans un groupe"""
    # Vérifier que le groupe existe
    group = await db.get(StudyGroup, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study group not found"
        )

    # Vérifier membership
    is_member = await check_group_membership(group_id, current_user.id, db)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this group"
        )

    # Créer le message
    new_message = GroupMessage(
        group_id=group_id,
        user_id=current_user.id,
        content=message_data.content,
        is_edited=False
    )

    db.add(new_message)

    # XP bonus pour participation
    current_user.total_xp += 2
    current_user.level = (current_user.total_xp // 100) + 1

    await db.commit()
    await db.refresh(new_message)

    return GroupMessageResponse(
        id=new_message.id,
        group_id=new_message.group_id,
        user_id=new_message.user_id,
        username=current_user.username,
        avatar_url=current_user.avatar_url,
        content=new_message.content,
        is_edited=new_message.is_edited,
        created_at=new_message.created_at,
        updated_at=new_message.updated_at
    )


@router.put("/{group_id}/messages/{message_id}", response_model=GroupMessageResponse)
async def update_group_message(
    group_id: int,
    message_id: int,
    message_data: GroupMessageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Modifier un message"""
    message = await db.get(GroupMessage, message_id)

    if not message or message.group_id != group_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    # Seul l'auteur peut modifier
    if message.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own messages"
        )

    message.content = message_data.content
    message.is_edited = True

    await db.commit()
    await db.refresh(message)

    return GroupMessageResponse(
        id=message.id,
        group_id=message.group_id,
        user_id=message.user_id,
        username=current_user.username,
        avatar_url=current_user.avatar_url,
        content=message.content,
        is_edited=message.is_edited,
        created_at=message.created_at,
        updated_at=message.updated_at
    )


@router.delete("/{group_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group_message(
    group_id: int,
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprimer un message"""
    message = await db.get(GroupMessage, message_id)

    if not message or message.group_id != group_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    # Seul l'auteur ou un admin peut supprimer
    is_author = message.user_id == current_user.id

    # Vérifier si admin du groupe
    membership_query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == current_user.id
        )
    )
    membership_result = await db.execute(membership_query)
    membership = membership_result.scalar_one_or_none()

    from app.models.study_group import MembershipRole
    is_admin = membership and membership.role in [MembershipRole.ADMIN, MembershipRole.OWNER]

    if not is_author and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own messages or be an admin"
        )

    await db.delete(message)
    await db.commit()

    return None
