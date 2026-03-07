"""
Routes Admin pour le dashboard email
Tous les endpoints nécessitent le rôle ADMIN.
"""

import logging
from typing import Optional, List
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case, distinct
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.security import get_current_active_user, require_role
from app.models.user import User, UserRole
from app.models.email_event import EmailEvent

logger = logging.getLogger(__name__)

require_admin = require_role([UserRole.ADMIN])

router = APIRouter(dependencies=[Depends(require_admin)])


@router.get("/stats")
async def get_email_stats(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Statistiques globales des emails.
    Retourne les compteurs par statut, par type, et par jour.
    """
    since = utc_now() - timedelta(days=days)

    # Compteurs par statut
    status_query = select(
        EmailEvent.status,
        func.count(EmailEvent.id)
    ).where(
        EmailEvent.created_at >= since
    ).group_by(EmailEvent.status)

    result = await db.execute(status_query)
    status_counts = {row[0]: row[1] for row in result.all()}

    # Compteurs par type
    type_query = select(
        EmailEvent.email_type,
        func.count(EmailEvent.id)
    ).where(
        EmailEvent.created_at >= since
    ).group_by(EmailEvent.email_type).order_by(func.count(EmailEvent.id).desc())

    result = await db.execute(type_query)
    type_counts = {row[0]: row[1] for row in result.all()}

    # Total
    total = sum(status_counts.values())

    # Taux
    sent = status_counts.get("sent", 0) + status_counts.get("delivered", 0) + status_counts.get("opened", 0) + status_counts.get("clicked", 0)
    opened = status_counts.get("opened", 0) + status_counts.get("clicked", 0)
    clicked = status_counts.get("clicked", 0)
    bounced = status_counts.get("bounced", 0)
    complained = status_counts.get("complained", 0)
    failed = status_counts.get("failed", 0)

    # Emails par jour (7 derniers jours)
    daily_query = select(
        func.date(EmailEvent.created_at).label("day"),
        func.count(EmailEvent.id)
    ).where(
        EmailEvent.created_at >= utc_now() - timedelta(days=7)
    ).group_by(func.date(EmailEvent.created_at)).order_by(func.date(EmailEvent.created_at))

    result = await db.execute(daily_query)
    daily_data = [{"date": str(row[0]), "count": row[1]} for row in result.all()]

    # Destinataires uniques
    unique_recipients = await db.scalar(
        select(func.count(distinct(EmailEvent.to_email))).where(
            EmailEvent.created_at >= since
        )
    )

    return {
        "period_days": days,
        "total_emails": total,
        "unique_recipients": unique_recipients or 0,
        "status_breakdown": status_counts,
        "type_breakdown": type_counts,
        "rates": {
            "delivery_rate": round((sent / total * 100), 1) if total > 0 else 0,
            "open_rate": round((opened / sent * 100), 1) if sent > 0 else 0,
            "click_rate": round((clicked / sent * 100), 1) if sent > 0 else 0,
            "bounce_rate": round((bounced / total * 100), 1) if total > 0 else 0,
            "complaint_rate": round((complained / total * 100), 1) if total > 0 else 0,
            "failure_rate": round((failed / total * 100), 1) if total > 0 else 0,
        },
        "daily_volume": daily_data,
    }


@router.get("/list")
async def list_emails(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=10, le=200),
    email_type: Optional[str] = None,
    email_status: Optional[str] = None,
    to_email: Optional[str] = None,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Liste paginée des emails envoyés avec filtres.
    """
    since = utc_now() - timedelta(days=days)

    query = select(EmailEvent).where(EmailEvent.created_at >= since)

    if email_type:
        query = query.where(EmailEvent.email_type == email_type)
    if email_status:
        query = query.where(EmailEvent.status == email_status)
    if to_email:
        query = query.where(EmailEvent.to_email.ilike(f"%{to_email}%"))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Paginate
    query = query.order_by(EmailEvent.created_at.desc()).offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    events = result.scalars().all()

    return {
        "emails": [
            {
                "id": e.id,
                "user_id": e.user_id,
                "to_email": e.to_email,
                "subject": e.subject,
                "email_type": e.email_type,
                "status": e.status,
                "provider_id": e.provider_id,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "opened_at": e.opened_at.isoformat() if e.opened_at else None,
                "clicked_at": e.clicked_at.isoformat() if e.clicked_at else None,
                "bounced_at": e.bounced_at.isoformat() if e.bounced_at else None,
                "bounce_type": e.bounce_type,
                "bounce_reason": e.bounce_reason,
            }
            for e in events
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/bounces")
async def list_bounces(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=10, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Liste les adresses email qui ont bounce ou reçu des plaintes.
    """
    query = select(EmailEvent).where(
        EmailEvent.status.in_(["bounced", "complained"])
    ).order_by(EmailEvent.created_at.desc()).offset((page - 1) * page_size).limit(page_size)

    count_query = select(func.count()).select_from(
        select(EmailEvent.id).where(
            EmailEvent.status.in_(["bounced", "complained"])
        ).subquery()
    )
    total = await db.scalar(count_query) or 0

    result = await db.execute(query)
    events = result.scalars().all()

    return {
        "bounces": [
            {
                "id": e.id,
                "to_email": e.to_email,
                "status": e.status,
                "bounce_type": e.bounce_type,
                "bounce_reason": e.bounce_reason,
                "email_type": e.email_type,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "bounced_at": e.bounced_at.isoformat() if e.bounced_at else None,
                "complained_at": e.complained_at.isoformat() if e.complained_at else None,
            }
            for e in events
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/types")
async def list_email_types(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Liste tous les types d'emails avec leurs compteurs."""
    query = select(
        EmailEvent.email_type,
        func.count(EmailEvent.id)
    ).group_by(EmailEvent.email_type).order_by(func.count(EmailEvent.id).desc())

    result = await db.execute(query)
    return {
        "types": [{"type": row[0], "count": row[1]} for row in result.all()]
    }
