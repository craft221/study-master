"""
API Endpoints pour le Partage Social
====================================
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.social_share import ShareType, SharePlatform, SHARE_BADGES
from app.services.social_share_service import social_share_service


router = APIRouter()


# =============================================================================
# SCHEMAS
# =============================================================================

class ShareRequest(BaseModel):
    share_type: str
    platform: str
    content_data: Optional[dict] = None


class ShareResponse(BaseModel):
    share_id: int
    share_code: str
    share_url: str
    platform_url: str
    message: str
    platform: str
    share_type: str


class ShareStatsResponse(BaseModel):
    total_shares: int
    total_clicks: int
    total_conversions: int
    badges: List[dict]
    platforms: dict
    first_share_at: Optional[str]
    last_share_at: Optional[str]


class BadgeInfoResponse(BaseModel):
    id: str
    name: dict
    description: dict
    icon: str
    requirement: dict
    xp_reward: int


# =============================================================================
# ENDPOINTS PARTAGE
# =============================================================================

@router.post("/create", response_model=ShareResponse)
async def create_share(
    request: ShareRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Crée un nouveau partage.

    Paramètres:
    - share_type: streak_milestone, quiz_score, level_up, league_promotion, weekly_stats, achievement, profile
    - platform: whatsapp, twitter, facebook, instagram, linkedin, telegram, copy_link
    - content_data: données spécifiques au type (ex: {"streak": 30} pour streak_milestone)
    """
    try:
        share_type = ShareType(request.share_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid share type: {request.share_type}")

    try:
        platform = SharePlatform(request.platform)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {request.platform}")

    # Obtenir la langue de l'utilisateur
    lang = current_user.language if hasattr(current_user, 'language') else "fr"

    result = await social_share_service.create_share(
        db=db,
        user_id=current_user.id,
        share_type=share_type,
        platform=platform,
        content_data=request.content_data,
        lang=lang
    )

    await db.commit()
    return result


@router.post("/streak", response_model=ShareResponse)
async def share_streak(
    platform: str = Query(..., description="whatsapp, twitter, facebook, etc."),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Partage le streak actuel de l'utilisateur.
    """
    try:
        plat = SharePlatform(platform)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {platform}")

    lang = current_user.language if hasattr(current_user, 'language') else "fr"

    result = await social_share_service.generate_streak_share(
        db=db,
        user_id=current_user.id,
        platform=plat,
        lang=lang
    )

    await db.commit()

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.post("/quiz", response_model=ShareResponse)
async def share_quiz_score(
    platform: str = Query(...),
    score: int = Query(..., ge=0, le=100),
    topic: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Partage un score de quiz.
    """
    try:
        plat = SharePlatform(platform)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {platform}")

    lang = current_user.language if hasattr(current_user, 'language') else "fr"

    result = await social_share_service.generate_quiz_share(
        db=db,
        user_id=current_user.id,
        platform=plat,
        score=score,
        topic=topic,
        lang=lang
    )

    await db.commit()
    return result


@router.post("/level", response_model=ShareResponse)
async def share_level_up(
    platform: str = Query(...),
    level: int = Query(..., ge=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Partage un level up.
    """
    try:
        plat = SharePlatform(platform)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {platform}")

    lang = current_user.language if hasattr(current_user, 'language') else "fr"

    result = await social_share_service.generate_level_share(
        db=db,
        user_id=current_user.id,
        platform=plat,
        level=level,
        lang=lang
    )

    await db.commit()
    return result


@router.post("/league", response_model=ShareResponse)
async def share_league_promotion(
    platform: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Partage une promotion de ligue.
    """
    try:
        plat = SharePlatform(platform)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {platform}")

    lang = current_user.language if hasattr(current_user, 'language') else "fr"

    result = await social_share_service.generate_league_share(
        db=db,
        user_id=current_user.id,
        platform=plat,
        lang=lang
    )

    await db.commit()

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.post("/weekly-stats", response_model=ShareResponse)
async def share_weekly_stats(
    platform: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Partage les statistiques de la semaine.
    """
    try:
        plat = SharePlatform(platform)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {platform}")

    lang = current_user.language if hasattr(current_user, 'language') else "fr"

    result = await social_share_service.generate_weekly_stats_share(
        db=db,
        user_id=current_user.id,
        platform=plat,
        lang=lang
    )

    await db.commit()

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


# =============================================================================
# ENDPOINTS TRACKING
# =============================================================================

@router.post("/track/click/{share_code}")
async def track_share_click(
    share_code: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Enregistre un clic sur un lien de partage.
    Endpoint public (pas d'auth requise).
    """
    success = await social_share_service.track_click(db, share_code)

    if not success:
        raise HTTPException(status_code=404, detail="Share not found")

    await db.commit()
    return {"success": True}


@router.post("/track/conversion/{share_code}")
async def track_share_conversion(
    share_code: str,
    new_user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Enregistre une conversion (inscription via partage).
    À appeler lors de l'inscription d'un nouvel utilisateur.
    """
    success = await social_share_service.track_conversion(db, share_code, new_user_id)

    if not success:
        raise HTTPException(status_code=404, detail="Share not found")

    await db.commit()
    return {"success": True}


# =============================================================================
# ENDPOINTS STATS
# =============================================================================

@router.get("/my-stats", response_model=ShareStatsResponse)
async def get_my_share_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupère les statistiques de partage de l'utilisateur.
    """
    stats = await social_share_service.get_user_share_stats(db, current_user.id)
    return stats


@router.get("/badges", response_model=List[BadgeInfoResponse])
async def get_available_share_badges(
    current_user: User = Depends(get_current_user)
):
    """
    Récupère la liste de tous les badges de partage disponibles.
    """
    badges = []
    for badge_id, config in SHARE_BADGES.items():
        badges.append({
            "id": badge_id,
            "name": config["name"],
            "description": config["description"],
            "icon": config["icon"],
            "requirement": config["requirement"],
            "xp_reward": config["xp_reward"]
        })
    return badges


@router.get("/platforms")
async def get_available_platforms():
    """
    Récupère la liste des plateformes de partage disponibles.
    """
    return {
        "platforms": [
            {"id": "whatsapp", "name": "WhatsApp", "icon": "whatsapp"},
            {"id": "twitter", "name": "Twitter/X", "icon": "twitter"},
            {"id": "facebook", "name": "Facebook", "icon": "facebook"},
            {"id": "instagram", "name": "Instagram", "icon": "instagram"},
            {"id": "linkedin", "name": "LinkedIn", "icon": "linkedin"},
            {"id": "telegram", "name": "Telegram", "icon": "telegram"},
            {"id": "copy_link", "name": "Copier le lien", "icon": "link"},
        ]
    }
