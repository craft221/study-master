"""
🐿️⚡ API Endpoints Spark - L'assistant IA intelligent

Endpoints pour:
- Messages contextuels avec personnalité
- Conversations persistantes
- Mode tuteur socratique
- Briefings quotidiens
- Notifications proactives
- Insights utilisateur
- Gestion des accessoires
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.spark import (
    SparkConversation, SparkMessage, SparkNotification,
    SparkUserInsight, SparkDailyBriefing, SparkMemory,
    ConversationStatus, MessageRole
)
from app.services.spark_service import spark_service
from app.services.spark_intelligence_service import spark_intelligence
from app.services.cache_service import cache_service, CachePrefix, CacheTTL
from app.schemas.spark import (
    # Messages
    SparkMessageRequest, SparkMessageResponse,
    # Conversations
    SparkChatRequest, SparkChatResponse,
    ConversationListResponse, ConversationSummary,
    ConversationDetailResponse, ConversationMessage,
    # Tuteur
    TutorExplainRequest, TutorExplainResponse,
    TutorHintRequest, TutorHintResponse,
    # Briefing
    DailyBriefingResponse, StreakStatus, DailyGoal, UpcomingExam,
    # Notifications
    SparkNotificationResponse, NotificationListResponse, MarkNotificationReadRequest,
    # Insights
    SparkInsightResponse, InsightListResponse, UserAnalysisResponse,
    # État
    SparkStateResponse, SparkAccessoriesResponse, SparkAccessoryInfo,
    UpdateSparkRequest, SparkInteractionResponse,
    # Mémoire
    SparkMemoriesResponse, SparkMemoryResponse,
    # Q&A
    SparkAskRequest, SparkAskResponse
)

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# ÉTAT DE SPARK
# =============================================================================

@router.get("/state", response_model=SparkStateResponse)
async def get_spark_state(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupère l'état complet de Spark pour l'utilisateur

    Retourne:
    - Nom et niveau de Spark
    - Accessoires débloqués
    - Stats utilisateur
    - Niveau de bonheur
    """
    mascot = current_user.mascot
    gamification = current_user.gamification

    level_names = {
        1: "Spark Bébé",
        2: "Spark Junior",
        3: "Spark Expert",
        4: "Spark Sage",
        5: "Spark Légendaire"
    }

    # Calculer dynamiquement le niveau de Spark basé sur le niveau utilisateur
    # Spark évolue aux niveaux 5, 10, 15, 20 (PAS de stockage en base)
    user_level = current_user.level  # Propriété calculée dynamiquement depuis XP
    if user_level < 5:
        spark_level = 1  # Spark Bébé (niveaux 1-4)
    elif user_level < 10:
        spark_level = 2  # Spark Junior (niveaux 5-9)
    elif user_level < 15:
        spark_level = 3  # Spark Expert (niveaux 10-14)
    elif user_level < 20:
        spark_level = 4  # Spark Sage (niveaux 15-19)
    else:
        spark_level = 5  # Spark Légendaire (niveau 20+)

    # Pas de stockage en base - toujours calculé dynamiquement

    return {
        "name": mascot.name if mascot else "Spark",
        "level": spark_level,
        "level_name": level_names.get(spark_level, "Spark"),
        "unlocked_accessories": mascot.unlocked_accessories if mascot else [],
        "current_accessory": mascot.current_accessory if mascot else None,
        "total_accessories": len(mascot.unlocked_accessories or []) if mascot else 0,
        "user_xp": gamification.total_xp if gamification else 0,
        "user_level": user_level,
        "user_streak": gamification.current_streak if gamification else 0,
        "happiness": mascot.happiness if mascot else 100
    }


@router.get("/accessories", response_model=SparkAccessoriesResponse)
async def get_spark_accessories(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Liste tous les accessoires (débloqués et verrouillés)
    Avec les nouvelles raretés: common, rare, epic, legendary, mythic
    """
    mascot = current_user.mascot
    unlocked = mascot.unlocked_accessories if mascot else []

    all_accessories = spark_service.get_accessory_info()

    accessories_list = [
        SparkAccessoryInfo(
            id=acc_id,
            name=info["name"],
            description=info["description"],
            emoji=info["emoji"],
            requirement=info["requirement"],
            rarity=info.get("rarity", "common"),
            is_unlocked=acc_id in unlocked
        )
        for acc_id, info in all_accessories.items()
    ]

    return SparkAccessoriesResponse(
        accessories=accessories_list,
        unlocked_count=len(unlocked),
        total_count=len(all_accessories)
    )


@router.patch("/update")
async def update_spark(
    request: UpdateSparkRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Met à jour le nom ou l'accessoire équipé de Spark"""
    mascot = current_user.mascot

    if not mascot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mascotte non trouvée"
        )

    if request.name is not None:
        mascot.name = request.name

    if request.current_accessory is not None:
        if request.current_accessory and request.current_accessory not in (mascot.unlocked_accessories or []):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Accessoire '{request.current_accessory}' non débloqué"
            )
        mascot.current_accessory = request.current_accessory if request.current_accessory else None

    await db.commit()
    await cache_service.invalidate_mascot_cache(current_user.id)

    return {"success": True, "message": "Spark mis à jour ! 🐿️"}


@router.post("/interaction", response_model=SparkInteractionResponse)
async def interact_with_spark(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Interaction avec Spark (clic)
    Augmente le bonheur et retourne un message fun
    """
    mascot = current_user.mascot

    if mascot:
        result = mascot.interact()
        await db.commit()
    else:
        result = {
            "happiness": 100,
            "interaction_count": 1,
            "message": "Hey ! Spark est content de te voir ! 🐿️⚡"
        }

    return SparkInteractionResponse(
        message=result["message"],
        mood="happy",
        animation="wave",
        happiness=result["happiness"],
        interaction_count=result["interaction_count"]
    )


# =============================================================================
# MESSAGES CONTEXTUELS
# =============================================================================

@router.post("/message", response_model=SparkMessageResponse)
async def get_spark_message(
    request: SparkMessageRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Génère un message de Spark pour un événement spécifique

    Events supportés:
    - welcome, welcome_back, comeback
    - quiz_success, quiz_failed, quiz_perfect
    - streak_milestone, streak_warning, streak_lost
    - level_up, new_accessory
    - exam_reminder, encouragement
    - idle, night_study, morning_study
    """
    result = await spark_service.get_event_message(
        event=request.event,
        user=current_user,
        context=request.context,
        db=db
    )

    return SparkMessageResponse(**result)


# =============================================================================
# CONVERSATIONS PERSISTANTES
# =============================================================================

@router.post("/chat", response_model=SparkChatResponse)
async def chat_with_spark(
    request: SparkChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Chat avec Spark dans une conversation persistante

    Spark se souvient du contexte et peut avoir des conversations
    continues et naturelles.
    """
    result = await spark_service.chat(
        db=db,
        user=current_user,
        message=request.message,
        conversation_id=request.conversation_id
    )

    return SparkChatResponse(**result)


@router.get("/conversations", response_model=ConversationListResponse)
async def get_conversations(
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère l'historique des conversations avec Spark"""
    conversations = await spark_service.get_conversations(db, current_user, limit)

    return ConversationListResponse(
        conversations=[ConversationSummary(**c) for c in conversations],
        total=len(conversations)
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation_detail(
    conversation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère les détails d'une conversation avec tous ses messages"""
    conversation = await db.get(SparkConversation, conversation_id)

    if not conversation or conversation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation non trouvée"
        )

    # Récupérer les messages
    result = await db.execute(
        select(SparkMessage).where(
            SparkMessage.conversation_id == conversation_id
        ).order_by(SparkMessage.created_at)
    )
    messages = result.scalars().all()

    return ConversationDetailResponse(
        id=conversation.id,
        title=conversation.title or "Conversation",
        context_type=conversation.context_type or "general",
        message_count=conversation.message_count or len(messages),
        messages=[
            ConversationMessage(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                mood=msg.mood,
                animation=msg.animation,
                created_at=msg.created_at.isoformat()
            )
            for msg in messages
        ],
        created_at=conversation.created_at.isoformat(),
        updated_at=conversation.updated_at.isoformat()
    )


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprime (archive) une conversation"""
    conversation = await db.get(SparkConversation, conversation_id)

    if not conversation or conversation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation non trouvée"
        )

    conversation.status = ConversationStatus.DELETED
    await db.commit()


# =============================================================================
# MODE TUTEUR
# =============================================================================

@router.post("/tutor/explain", response_model=TutorExplainResponse)
async def tutor_explain(
    request: TutorExplainRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mode tuteur de Spark - Explique un concept de manière pédagogique

    Spark utilise la méthode socratique:
    - Pose des questions pour guider
    - Donne des indices progressifs
    - Utilise des analogies
    """
    result = await spark_service.tutor_explain(
        db=db,
        user=current_user,
        concept=request.concept,
        subject=request.subject,
        difficulty=request.difficulty,
        conversation_id=request.conversation_id
    )

    return TutorExplainResponse(**result)


@router.post("/tutor/hint", response_model=TutorHintResponse)
async def get_tutor_hint(
    request: TutorHintRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtient un indice progressif pour une question

    - Level 1: Indice vague
    - Level 2: Indice moyen
    - Level 3: Indice précis (sans révéler)
    """
    result = await spark_service.tutor_hint(
        question=request.question,
        answer=request.answer,
        user_attempt=request.user_attempt,
        hint_level=request.hint_level
    )

    return TutorHintResponse(**result)


# =============================================================================
# BRIEFING QUOTIDIEN
# =============================================================================

@router.get("/briefing", response_model=DailyBriefingResponse)
async def get_daily_briefing(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupère le briefing quotidien de Spark

    Contient:
    - Message d'accueil personnalisé
    - État du streak
    - Objectifs du jour
    - Révisions en attente
    - Examens à venir
    - Fun fact et citation motivante
    """
    today = datetime.now(timezone.utc).date()

    # Vérifier si un briefing existe déjà pour aujourd'hui
    result = await db.execute(
        select(SparkDailyBriefing).where(
            and_(
                SparkDailyBriefing.user_id == current_user.id,
                func.date(SparkDailyBriefing.briefing_date) == today
            )
        )
    )
    briefing = result.scalar_one_or_none()

    # Générer un nouveau briefing si nécessaire
    if not briefing:
        briefing = await spark_intelligence.generate_daily_briefing(db, current_user)

    # Marquer comme vu
    if not briefing.is_viewed:
        briefing.is_viewed = True
        briefing.viewed_at = datetime.now(timezone.utc)
        await db.commit()

    return DailyBriefingResponse(
        id=briefing.id,
        greeting=briefing.greeting,
        mood=briefing.mood,
        tone=briefing.tone,
        streak_status=StreakStatus(**briefing.streak_status),
        today_goals=[DailyGoal(**g) for g in briefing.today_goals],
        pending_reviews=briefing.pending_reviews,
        upcoming_exams=[UpcomingExam(**e) for e in briefing.upcoming_exams],
        fun_fact=briefing.fun_fact,
        motivation_quote=briefing.motivation_quote,
        is_viewed=briefing.is_viewed,
        created_at=briefing.created_at.isoformat()
    )


# =============================================================================
# NOTIFICATIONS
# =============================================================================

@router.get("/notifications", response_model=NotificationListResponse)
async def get_notifications(
    limit: int = Query(20, ge=1, le=50),
    unread_only: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère les notifications de Spark"""
    query = select(SparkNotification).where(
        and_(
            SparkNotification.user_id == current_user.id,
            SparkNotification.is_dismissed == False
        )
    )

    if unread_only:
        query = query.where(SparkNotification.is_read == False)

    query = query.order_by(desc(SparkNotification.created_at)).limit(limit)

    result = await db.execute(query)
    notifications = result.scalars().all()

    # Compter les non lus
    unread_count = await db.scalar(
        select(func.count(SparkNotification.id)).where(
            and_(
                SparkNotification.user_id == current_user.id,
                SparkNotification.is_read == False,
                SparkNotification.is_dismissed == False
            )
        )
    )

    return NotificationListResponse(
        notifications=[
            SparkNotificationResponse(
                id=n.id,
                notification_type=n.notification_type,
                title=n.title,
                message=n.message,
                mood=n.mood,
                action_type=n.action_type,
                action_data=n.action_data,
                is_read=n.is_read,
                created_at=n.created_at.isoformat()
            )
            for n in notifications
        ],
        unread_count=unread_count or 0,
        total=len(notifications)
    )


@router.post("/notifications/read")
async def mark_notifications_read(
    request: MarkNotificationReadRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Marque des notifications comme lues"""
    result = await db.execute(
        select(SparkNotification).where(
            and_(
                SparkNotification.id.in_(request.notification_ids),
                SparkNotification.user_id == current_user.id
            )
        )
    )
    notifications = result.scalars().all()

    for notification in notifications:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)

    await db.commit()

    return {"success": True, "marked_count": len(notifications)}


@router.post("/notifications/{notification_id}/dismiss", status_code=status.HTTP_204_NO_CONTENT)
async def dismiss_notification(
    notification_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprime (masque) une notification"""
    notification = await db.get(SparkNotification, notification_id)

    if not notification or notification.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification non trouvée"
        )

    notification.is_dismissed = True
    await db.commit()


# =============================================================================
# INSIGHTS & ANALYSE
# =============================================================================

@router.get("/insights", response_model=InsightListResponse)
async def get_insights(
    limit: int = Query(10, ge=1, le=20),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère les insights de Spark sur l'utilisateur"""
    result = await db.execute(
        select(SparkUserInsight).where(
            and_(
                SparkUserInsight.user_id == current_user.id,
                SparkUserInsight.is_active == True
            )
        ).order_by(
            desc(SparkUserInsight.priority),
            desc(SparkUserInsight.created_at)
        ).limit(limit)
    )
    insights = result.scalars().all()

    return InsightListResponse(
        insights=[
            SparkInsightResponse(
                id=i.id,
                insight_type=i.insight_type.value,
                title=i.title,
                description=i.description,
                data=i.data,
                confidence=i.confidence,
                priority=i.priority,
                is_acknowledged=i.is_acknowledged,
                valid_until=i.valid_until.isoformat() if i.valid_until else None,
                created_at=i.created_at.isoformat()
            )
            for i in insights
        ],
        total=len(insights)
    )


@router.get("/analysis", response_model=UserAnalysisResponse)
async def get_user_analysis(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Analyse complète de l'utilisateur par Spark

    Inclut:
    - Patterns d'étude
    - Forces et faiblesses
    - Santé du streak
    - Besoins à venir
    - Niveau d'engagement
    - Vélocité d'apprentissage
    """
    analysis = await spark_intelligence.analyze_user_patterns(db, current_user)
    return UserAnalysisResponse(**analysis)


@router.post("/insights/{insight_id}/acknowledge")
async def acknowledge_insight(
    insight_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Marque un insight comme vu/reconnu"""
    insight = await db.get(SparkUserInsight, insight_id)

    if not insight or insight.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insight non trouvé"
        )

    insight.is_acknowledged = True
    insight.acknowledged_at = datetime.now(timezone.utc)
    await db.commit()

    return {"success": True}


# =============================================================================
# MÉMOIRE
# =============================================================================

@router.get("/memories", response_model=SparkMemoriesResponse)
async def get_spark_memories(
    memory_type: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Ce que Spark sait sur l'utilisateur

    Types de mémoire:
    - preference: Préférences détectées
    - achievement: Accomplissements notables
    - struggle: Difficultés observées
    - pattern: Patterns comportementaux
    """
    memories = await spark_intelligence.get_memories(db, current_user, memory_type)

    return SparkMemoriesResponse(
        memories=[
            SparkMemoryResponse(
                id=m.id,
                memory_type=m.memory_type,
                key=m.key,
                value=m.value,
                source=m.source,
                created_at=m.created_at.isoformat(),
                updated_at=m.updated_at.isoformat()
            )
            for m in memories
        ],
        total=len(memories)
    )


# =============================================================================
# Q&A RAPIDE (legacy support)
# =============================================================================

@router.post("/ask", response_model=SparkAskResponse)
async def ask_spark(
    request: SparkAskRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Pose une question rapide à Spark (Q&A simple)
    Pour des conversations plus longues, utiliser /chat
    """
    # Utiliser le chat mais sans sauvegarder la conversation
    result = await spark_service.chat(
        db=db,
        user=current_user,
        message=request.question,
        conversation_id=None
    )

    return SparkAskResponse(
        answer=result["response"],
        mood=result["mood"],
        animation=result["animation"],
        suggestions=result.get("suggestions", []),
        timestamp=result["timestamp"]
    )


# =============================================================================
# VÉRIFICATION DES DÉBLOCAGES
# =============================================================================

@router.get("/check-unlocks")
async def check_new_unlocks(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Vérifie s'il y a de nouveaux accessoires débloqués
    À appeler après des événements majeurs
    """
    mascot = current_user.mascot
    if not mascot:
        return {"has_new_unlocks": False, "newly_unlocked": []}

    stats = current_user.stats
    gamification = current_user.gamification

    unlockable = mascot.get_unlockable_accessories(stats, gamification)
    current_unlocked = mascot.unlocked_accessories or []

    newly_unlocked = [acc for acc in unlockable if acc not in current_unlocked]

    if newly_unlocked:
        mascot.unlocked_accessories = list(set(current_unlocked + newly_unlocked))
        await db.commit()
        await cache_service.invalidate_mascot_cache(current_user.id)

        accessory_info = spark_service.get_accessory_info()
        names = [accessory_info[acc]["name"] for acc in newly_unlocked]

        # Générer un message de célébration
        message_result = await spark_service.get_event_message(
            "new_accessory",
            current_user,
            {"accessory": names[0]},
            db
        )

        return {
            "has_new_unlocks": True,
            "newly_unlocked": newly_unlocked,
            "accessories_names": names,
            "message": message_result["message"],
            "mood": message_result["mood"],
            "animation": message_result["animation"]
        }

    return {
        "has_new_unlocks": False,
        "newly_unlocked": [],
        "message": "Continue comme ça ! De nouveaux accessoires t'attendent ! 💪"
    }
