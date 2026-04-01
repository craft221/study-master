"""
Endpoints pour les messages de groupe
"""

import html
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from typing import Optional
from collections import defaultdict

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.study_group import StudyGroup, StudyGroupMembership
from app.models.group_message import GroupMessage, MessageReaction
from app.schemas.group_message import (
    GroupMessageCreate,
    GroupMessageUpdate,
    GroupMessageResponse,
    GroupMessageListResponse,
    MessageReactionCreate,
    MessageReactionResponse,
    ReactionCount,
    ReplyToMessage,
    MentionedUser
)
from app.services.xp_service import award_xp

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


async def get_user_membership(
    group_id: int,
    user_id: int,
    db: AsyncSession
) -> StudyGroupMembership | None:
    """Récupérer le membership de l'utilisateur avec sa date d'adhésion"""
    query = select(StudyGroupMembership).where(
        and_(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == user_id
        )
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


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

    # Vérifier membership et récupérer la date d'adhésion
    membership = await get_user_membership(group_id, current_user.id, db)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this group"
        )

    # Construire la requête - filtrer les messages envoyés après l'adhésion de l'utilisateur
    query = select(GroupMessage).where(
        and_(
            GroupMessage.group_id == group_id,
            GroupMessage.created_at >= membership.joined_at  # Seulement les messages après adhésion
        )
    ).order_by(desc(GroupMessage.created_at))

    # Compte total (seulement les messages visibles par l'utilisateur)
    count_query = select(func.count()).select_from(GroupMessage).where(
        and_(
            GroupMessage.group_id == group_id,
            GroupMessage.created_at >= membership.joined_at
        )
    )
    total = await db.scalar(count_query)

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    messages = result.scalars().all()

    # Enrichir avec les infos utilisateur, réactions, réponses, et mentions
    message_responses = []
    for msg in messages:
        user = await db.get(User, msg.user_id)
        if not user:
            continue

        # Récupérer les réactions
        reactions_query = select(MessageReaction).where(MessageReaction.message_id == msg.id)
        reactions_result = await db.execute(reactions_query)
        reactions = reactions_result.scalars().all()

        # Grouper les réactions par emoji
        reactions_by_emoji = defaultdict(list)
        for reaction in reactions:
            reactions_by_emoji[reaction.emoji].append(reaction.user_id)

        reaction_counts = [
            ReactionCount(emoji=emoji, count=len(user_ids), user_ids=user_ids)
            for emoji, user_ids in reactions_by_emoji.items()
        ]

        # Récupérer les infos du message auquel on répond
        reply_to_info = None
        if msg.reply_to_message_id:
            reply_msg = await db.get(GroupMessage, msg.reply_to_message_id)
            if reply_msg:
                reply_user = await db.get(User, reply_msg.user_id)
                if reply_user:
                    reply_to_info = ReplyToMessage(
                        id=reply_msg.id,
                        user_id=reply_msg.user_id,
                        username=reply_user.username,
                        content=reply_msg.content[:100]  # Limiter à 100 caractères
                    )

        # Récupérer les infos des utilisateurs mentionnés
        mentioned_users_list = []
        if msg.mentions:
            for user_id in msg.mentions:
                mentioned_user = await db.get(User, user_id)
                if mentioned_user:
                    mentioned_users_list.append(
                        MentionedUser(id=mentioned_user.id, username=mentioned_user.username)
                    )

        message_responses.append(
            GroupMessageResponse(
                id=msg.id,
                group_id=msg.group_id,
                user_id=msg.user_id,
                username=user.username,
                avatar_url=user.avatar_url,
                content=msg.content,
                is_edited=msg.is_edited,
                is_deleted=msg.is_deleted if hasattr(msg, 'is_deleted') else False,
                reply_to_message_id=msg.reply_to_message_id,
                reply_to=reply_to_info,
                mentions=msg.mentions,
                mentioned_users=mentioned_users_list,
                reactions=reaction_counts if reaction_counts else None,
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

    # Vérifier que le message de réponse existe si spécifié
    reply_to_info = None
    if message_data.reply_to_message_id:
        reply_msg = await db.get(GroupMessage, message_data.reply_to_message_id)
        if not reply_msg or reply_msg.group_id != group_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reply message not found in this group"
            )
        reply_user = await db.get(User, reply_msg.user_id)
        if reply_user:
            reply_to_info = ReplyToMessage(
                id=reply_msg.id,
                user_id=reply_msg.user_id,
                username=reply_user.username,
                content=reply_msg.content[:100]
            )

    # Vérifier que les utilisateurs mentionnés existent et sont membres
    mentioned_users_list = []
    if message_data.mentions:
        for user_id in message_data.mentions:
            mentioned_user = await db.get(User, user_id)
            if mentioned_user:
                is_member = await check_group_membership(group_id, user_id, db)
                if is_member:
                    mentioned_users_list.append(
                        MentionedUser(id=mentioned_user.id, username=mentioned_user.username)
                    )

    # Créer le message (sanitize HTML pour éviter XSS)
    sanitized_content = html.escape(message_data.content)
    new_message = GroupMessage(
        group_id=group_id,
        user_id=current_user.id,
        content=sanitized_content,
        is_edited=False,
        reply_to_message_id=message_data.reply_to_message_id,
        mentions=message_data.mentions
    )

    db.add(new_message)

    # XP bonus pour participation
    await award_xp(
        user=current_user,
        amount=2,
        reason="Envoi d'un message dans un groupe",
        event_type="group_message_sent",
        db=db
    )

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
        reply_to_message_id=new_message.reply_to_message_id,
        reply_to=reply_to_info,
        mentions=new_message.mentions,
        mentioned_users=mentioned_users_list if mentioned_users_list else None,
        reactions=None,
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

    message.content = html.escape(message_data.content)
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
    """Supprimer un message (soft delete - marque comme supprimé)"""
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

    # Soft delete - mark as deleted instead of removing from database
    message.is_deleted = True
    message.content = ""  # Clear content for privacy
    await db.commit()

    return None


@router.post("/{group_id}/messages/{message_id}/reactions", response_model=MessageReactionResponse, status_code=status.HTTP_201_CREATED)
async def add_reaction_to_message(
    group_id: int,
    message_id: int,
    reaction_data: MessageReactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Ajouter une réaction à un message"""
    # Vérifier que le message existe
    message = await db.get(GroupMessage, message_id)
    if not message or message.group_id != group_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    # Vérifier membership
    is_member = await check_group_membership(group_id, current_user.id, db)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this group"
        )

    # Vérifier si la réaction existe déjà
    existing_reaction_query = select(MessageReaction).where(
        and_(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == current_user.id,
            MessageReaction.emoji == reaction_data.emoji
        )
    )
    existing_reaction_result = await db.execute(existing_reaction_query)
    existing_reaction = existing_reaction_result.scalar_one_or_none()

    if existing_reaction:
        # La réaction existe déjà, la retourner
        return MessageReactionResponse(
            id=existing_reaction.id,
            message_id=existing_reaction.message_id,
            user_id=existing_reaction.user_id,
            username=current_user.username,
            emoji=existing_reaction.emoji,
            created_at=existing_reaction.created_at
        )

    # Créer la nouvelle réaction
    new_reaction = MessageReaction(
        message_id=message_id,
        user_id=current_user.id,
        emoji=reaction_data.emoji
    )

    db.add(new_reaction)

    # XP bonus pour interaction
    await award_xp(
        user=current_user,
        amount=1,
        reason="Réaction à un message",
        event_type="message_reaction",
        db=db
    )

    await db.commit()
    await db.refresh(new_reaction)

    return MessageReactionResponse(
        id=new_reaction.id,
        message_id=new_reaction.message_id,
        user_id=new_reaction.user_id,
        username=current_user.username,
        emoji=new_reaction.emoji,
        created_at=new_reaction.created_at
    )


@router.delete("/{group_id}/messages/{message_id}/reactions/{emoji}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_reaction_from_message(
    group_id: int,
    message_id: int,
    emoji: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retirer une réaction d'un message"""
    # Vérifier que le message existe
    message = await db.get(GroupMessage, message_id)
    if not message or message.group_id != group_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    # Vérifier membership
    is_member = await check_group_membership(group_id, current_user.id, db)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this group"
        )

    # Trouver la réaction
    reaction_query = select(MessageReaction).where(
        and_(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == current_user.id,
            MessageReaction.emoji == emoji
        )
    )
    reaction_result = await db.execute(reaction_query)
    reaction = reaction_result.scalar_one_or_none()

    if not reaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reaction not found"
        )

    await db.delete(reaction)
    await db.commit()

    return None
