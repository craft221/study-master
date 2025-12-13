"""
API Daily Quests - Objectifs quotidiens style Duolingo
======================================================

Endpoints:
- GET /daily-quests/ - Récupérer les objectifs du jour
- POST /daily-quests/{quest_id}/claim - Réclamer une récompense
- POST /daily-quests/bonus/claim - Réclamer le bonus 3/3
- GET /daily-quests/streak - Stats du streak des quêtes
- GET /daily-quests/chests - Coffres non ouverts
- POST /daily-quests/chests/{chest_id}/open - Ouvrir un coffre
- GET /daily-quests/spark-message - Message de Spark personnalisé
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.daily_quest import QuestStatus, QuestDifficulty
from app.services.daily_quest_service import daily_quest_service, spark_messages

router = APIRouter(prefix="/daily-quests", tags=["Daily Quests"])


# ============================================
# SCHEMAS
# ============================================

class SparkMessageSchema(BaseModel):
    mood: str
    text: str


class QuestSchema(BaseModel):
    id: int
    quest_type: str
    difficulty: str
    title: str
    description: Optional[str]
    icon: str
    target_value: int
    current_value: int
    xp_reward: int
    status: str
    progress_percent: float
    completed_at: Optional[datetime]
    claimed_at: Optional[datetime]

    class Config:
        from_attributes = True


class DailyQuestsResponse(BaseModel):
    quests: List[QuestSchema]
    stats: dict
    spark_message: SparkMessageSchema


class ChestSchema(BaseModel):
    id: int
    rarity: str
    source: str
    is_opened: bool
    contents: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True


class ClaimRewardResponse(BaseModel):
    success: bool
    xp_earned: int
    spark_message: SparkMessageSchema


class ClaimBonusResponse(BaseModel):
    success: bool
    bonus_xp: int
    chest_id: int
    chest_rarity: str
    quest_streak: int
    spark_message: SparkMessageSchema
    milestone_bonus: Optional[dict] = None


class OpenChestResponse(BaseModel):
    success: bool
    chest_id: int
    rarity: str
    contents: dict
    spark_message: SparkMessageSchema


class StreakStatsResponse(BaseModel):
    current_streak: int
    longest_streak: int
    total_quests_completed: int
    total_bonus_claimed: int
    total_xp_from_quests: int


# ============================================
# ENDPOINTS
# ============================================

@router.get("/", response_model=DailyQuestsResponse)
async def get_daily_quests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupère les 3 objectifs quotidiens de l'utilisateur.
    Les génère automatiquement si pas encore créés.
    """
    quests, stats = await daily_quest_service.get_user_daily_quests(db, current_user.id)

    quest_schemas = []
    for q in quests:
        progress_percent = (q.current_value / q.target_value * 100) if q.target_value > 0 else 0
        quest_schemas.append(QuestSchema(
            id=q.id,
            quest_type=q.quest_type.value,
            difficulty=q.difficulty.value,
            title=q.title,
            description=q.description,
            icon=q.icon,
            target_value=q.target_value,
            current_value=q.current_value,
            xp_reward=q.xp_reward,
            status=q.status.value,
            progress_percent=min(progress_percent, 100),
            completed_at=q.completed_at,
            claimed_at=q.claimed_at
        ))

    return DailyQuestsResponse(
        quests=quest_schemas,
        stats=stats,
        spark_message=SparkMessageSchema(**stats["spark_message"])
    )


@router.post("/{quest_id}/claim", response_model=ClaimRewardResponse)
async def claim_quest_reward(
    quest_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Réclame la récompense d'un objectif complété."""
    try:
        result = await daily_quest_service.claim_quest_reward(db, current_user.id, quest_id)
        return ClaimRewardResponse(
            success=True,
            xp_earned=result["xp_earned"],
            spark_message=SparkMessageSchema(**result["spark_message"])
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bonus/claim", response_model=ClaimBonusResponse)
async def claim_daily_bonus(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Réclame le bonus quotidien (quand les 3 objectifs sont complétés).
    Donne 50 XP + un coffre mystère.
    """
    try:
        result = await daily_quest_service.claim_daily_bonus(db, current_user.id)
        return ClaimBonusResponse(
            success=True,
            bonus_xp=result["bonus_xp"],
            chest_id=result["chest_id"],
            chest_rarity=result["chest_rarity"],
            quest_streak=result["quest_streak"],
            spark_message=SparkMessageSchema(**result["spark_message"]),
            milestone_bonus=result.get("milestone_bonus")
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/streak", response_model=StreakStatsResponse)
async def get_quest_streak_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère les statistiques du streak des objectifs quotidiens."""
    from sqlalchemy import select
    from app.models.daily_quest import DailyQuestStreak

    query = select(DailyQuestStreak).where(DailyQuestStreak.user_id == current_user.id)
    result = await db.execute(query)
    streak = result.scalar_one_or_none()

    if not streak:
        return StreakStatsResponse(
            current_streak=0,
            longest_streak=0,
            total_quests_completed=0,
            total_bonus_claimed=0,
            total_xp_from_quests=0
        )

    return StreakStatsResponse(
        current_streak=streak.current_streak,
        longest_streak=streak.longest_streak,
        total_quests_completed=streak.total_quests_completed,
        total_bonus_claimed=streak.total_bonus_claimed,
        total_xp_from_quests=streak.total_xp_from_quests
    )


@router.get("/chests", response_model=List[ChestSchema])
async def get_mystery_chests(
    unopened_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère les coffres mystère de l'utilisateur."""
    chests = await daily_quest_service.get_user_chests(db, current_user.id, unopened_only)
    return [ChestSchema.from_orm(c) for c in chests]


@router.post("/chests/{chest_id}/open", response_model=OpenChestResponse)
async def open_mystery_chest(
    chest_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Ouvre un coffre mystère et révèle son contenu."""
    try:
        result = await daily_quest_service.open_mystery_chest(db, current_user.id, chest_id)
        return OpenChestResponse(
            success=True,
            chest_id=result["chest_id"],
            rarity=result["rarity"],
            contents=result["contents"],
            spark_message=SparkMessageSchema(**result["spark_message"])
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/spark-message")
async def get_spark_contextual_message(
    context: str = "welcome",  # welcome, streak_reminder, absence, return
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupère un message de Spark personnalisé selon le contexte.

    Contextes disponibles:
    - welcome: Message de bienvenue
    - streak_reminder: Rappel de streak
    - absence: Après absence
    - return: Retour après absence
    """
    from app.core.datetime_utils import utc_now
    from datetime import timedelta

    # Calculer les jours d'absence
    days_absent = 0
    if current_user.last_activity_date:
        delta = utc_now() - current_user.last_activity_date
        days_absent = delta.days

    streak = current_user.current_streak or 0

    if context == "welcome":
        message = spark_messages.get_welcome_back_message(streak, days_absent)
    elif context == "streak_reminder":
        # Calculer les heures restantes
        now = utc_now()
        end_of_day = now.replace(hour=23, minute=59, second=59)
        hours_left = (end_of_day - now).total_seconds() / 3600
        message = spark_messages.get_streak_reminder_message(streak, hours_left)
    elif context == "absence":
        message = spark_messages.get_absence_message(days_absent)
    elif context == "return":
        message = spark_messages.get_welcome_back_message(streak, days_absent)
    else:
        message = {"mood": "happy", "text": "Salut ! Prêt à étudier ? 📚"}

    return {
        "context": context,
        "days_absent": days_absent,
        "current_streak": streak,
        "spark_message": message
    }
