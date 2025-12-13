"""
API Notifications - Système de notifications en temps réel
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.notification import (
    NotificationResponse,
    NotificationListResponse,
    NotificationMarkRead,
    NotificationPreferenceUpdate,
    NotificationPreferenceResponse,
    UnreadCountResponse
)
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=NotificationListResponse)
async def get_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupérer les notifications de l'utilisateur.

    - **page**: Page de résultats
    - **page_size**: Nombre de résultats par page
    - **unread_only**: Afficher uniquement les non lues
    """
    notifications, total, unread_count = await notification_service.get_user_notifications(
        db=db,
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        unread_only=unread_only
    )

    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
        total=total,
        unread_count=unread_count,
        page=page,
        page_size=page_size
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer le nombre de notifications non lues (avec cache)"""
    data = await notification_service.get_unread_count(db, current_user.id)
    return UnreadCountResponse(**data)


@router.post("/mark-read")
async def mark_notifications_read(
    data: NotificationMarkRead,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Marquer des notifications comme lues"""
    count = await notification_service.mark_as_read(
        db=db,
        user_id=current_user.id,
        notification_ids=data.notification_ids
    )

    return {
        "success": True,
        "marked_count": count,
        "message": f"{count} notification(s) marquée(s) comme lue(s)"
    }


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Marquer toutes les notifications comme lues"""
    count = await notification_service.mark_all_as_read(
        db=db,
        user_id=current_user.id
    )

    return {
        "success": True,
        "marked_count": count,
        "message": f"{count} notification(s) marquée(s) comme lue(s)"
    }


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprimer une notification"""
    deleted = await notification_service.delete_notification(
        db=db,
        user_id=current_user.id,
        notification_id=notification_id
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification introuvable"
        )

    return {"success": True, "message": "Notification supprimée"}


@router.get("/preferences", response_model=NotificationPreferenceResponse)
async def get_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les préférences de notification"""
    prefs = await notification_service.get_user_preferences(db, current_user.id)
    return NotificationPreferenceResponse.model_validate(prefs)


@router.patch("/preferences", response_model=NotificationPreferenceResponse)
async def update_notification_preferences(
    updates: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mettre à jour les préférences de notification.

    Seuls les champs fournis seront mis à jour.
    """
    prefs = await notification_service.update_preferences(
        db=db,
        user_id=current_user.id,
        updates=updates.model_dump(exclude_none=True)
    )

    logger.info(f"Préférences notifications mises à jour: user {current_user.id}")

    return NotificationPreferenceResponse.model_validate(prefs)


@router.post("/test")
async def send_test_notification(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Envoyer une notification de test (dev only)"""
    from app.models.notification import NotificationType, NotificationPriority

    notif = await notification_service.create_notification(
        db=db,
        user_id=current_user.id,
        notification_type=NotificationType.SYSTEM,
        title="Notification de test 🧪",
        message="Ceci est une notification de test. Si vous voyez ceci, les notifications fonctionnent !",
        priority=NotificationPriority.NORMAL,
        action_url="/notifications"
    )

    await db.commit()

    if notif:
        return {
            "success": True,
            "notification_id": notif.id,
            "message": "Notification de test envoyée"
        }
    else:
        return {
            "success": False,
            "message": "Notifications désactivées dans vos préférences"
        }
