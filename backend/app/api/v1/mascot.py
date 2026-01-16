"""
Endpoints API pour Spark la Mascotte ⚡🐿️

Fonctionnalités:
- État de la mascotte avec cache async
- Messages personnalisés via IA
- Système d'accessoires à débloquer
- Assistant Q&A avec cache sémantique
"""

import logging
import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.services.mascot_service import mascot_service
from app.services.cache_service import cache_service, CachePrefix, CacheTTL
from app.schemas.mascot import (
    MascotMessageRequest,
    MascotMessageResponse,
    MascotStateResponse,
    MascotAccessoriesResponse,
    MascotAccessoryInfo,
    UpdateMascotRequest,
    MascotHintRequest,
    MascotHintResponse,
    MascotAskRequest,
    MascotAskResponse
)

# Configuration du logger
logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/state", response_model=MascotStateResponse)
async def get_mascot_state(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupère l'état complet de la mascotte de l'utilisateur (avec cache Redis 5min)

    Retourne :
    - Nom de la mascotte
    - Niveau de la mascotte
    - Accessoires débloqués
    - Accessoire équipé
    - Statistiques utilisateur
    """
    # Générer la clé de cache
    cache_key = cache_service.generate_key(
        CachePrefix.MASCOT_STATE,
        user_id=current_user.id
    )

    # Vérifier le cache async
    cached_data = await cache_service.get(cache_key)
    if cached_data is not None:
        logger.debug(f"Mascot state cache HIT: user {current_user.id}")
        return MascotStateResponse(**cached_data)

    logger.debug(f"Mascot state cache MISS: user {current_user.id}")

    # Mettre à jour le niveau de la mascotte
    mascot_level = current_user.calculate_mascot_level()
    if current_user.mascot_level != mascot_level:
        current_user.mascot_level = mascot_level
        await db.commit()

    # Noms selon le niveau
    level_names = {
        1: "Spark Bébé",
        2: "Spark Junior",
        3: "Spark Expert",
        4: "Spark Sage",
        5: "Spark Légendaire"
    }

    response_data = {
        "name": current_user.mascot_name or "Spark",
        "level": mascot_level,
        "level_name": level_names.get(mascot_level, "Spark"),
        "unlocked_accessories": current_user.mascot_unlocked_accessories or [],
        "current_accessory": current_user.mascot_current_accessory,
        "total_accessories": len(current_user.mascot_unlocked_accessories or []),
        "user_xp": current_user.total_xp,
        "user_streak": current_user.current_streak
    }

    # Mettre en cache pour 5 minutes
    await cache_service.set(cache_key, response_data, ttl=CacheTTL.MEDIUM)

    return response_data


@router.post("/message", response_model=MascotMessageResponse)
async def get_mascot_message(
    request: MascotMessageRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Génère un message de Spark selon l'événement

    - **event**: Type d'événement (welcome, quiz_success, streak, etc.)
    - **use_ai**: Utiliser l'IA pour personnaliser (consomme quota si True)
    - **context**: Contexte additionnel (score, topic, etc.)
    """
    # Contexte utilisateur pour la génération
    user_context = {
        "user_name": current_user.username,
        "streak": current_user.current_streak,
        "xp": current_user.total_xp,
        "level": current_user.level,
        **request.context
    }

    # Générer le message (async)
    message_data = await mascot_service.get_message(
        event=request.event,
        user_context=user_context,
        use_ai=request.use_ai
    )

    # Mettre à jour la dernière interaction
    current_user.mascot_last_interaction_date = datetime.now(timezone.utc)
    await db.commit()

    return message_data


@router.get("/accessories", response_model=MascotAccessoriesResponse)
async def get_mascot_accessories(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Liste tous les accessoires (débloqués et verrouillés) (avec cache Redis 30min)

    Retourne :
    - Liste de tous les accessoires avec leur statut
    - Nombre d'accessoires débloqués
    - Total d'accessoires disponibles
    """
    # Générer la clé de cache
    cache_key = cache_service.generate_key(
        CachePrefix.MASCOT_ACCESSORIES,
        user_id=current_user.id
    )

    # Vérifier le cache async
    cached_data = await cache_service.get(cache_key)
    if cached_data is not None:
        logger.debug(f"Mascot accessories cache HIT: user {current_user.id}")
        return MascotAccessoriesResponse(**cached_data)

    logger.debug(f"Mascot accessories cache MISS: user {current_user.id}")

    # Vérifier et débloquer les nouveaux accessoires
    newly_unlocked = mascot_service.check_and_unlock_accessories(current_user)

    if newly_unlocked:
        await db.commit()

    # Récupérer toutes les infos d'accessoires
    all_accessories = mascot_service.get_accessory_info()
    unlocked = current_user.mascot_unlocked_accessories or []

    accessories_list = [
        {
            "id": acc_id,
            "name": info["name"],
            "description": info["description"],
            "emoji": info["emoji"],
            "requirement": info["requirement"],
            "is_unlocked": acc_id in unlocked
        }
        for acc_id, info in all_accessories.items()
    ]

    response_data = {
        "accessories": accessories_list,
        "unlocked_count": len(unlocked),
        "total_count": len(all_accessories),
        "newly_unlocked": newly_unlocked
    }

    # Mettre en cache pour 30 minutes
    await cache_service.set(cache_key, response_data, ttl=CacheTTL.LONG)

    return response_data


@router.patch("/update")
async def update_mascot(
    request: UpdateMascotRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Met à jour les paramètres de la mascotte

    - **name**: Nouveau nom pour Spark (optionnel)
    - **current_accessory**: Accessoire à équiper (optionnel)
    """
    # Mettre à jour le nom si fourni
    if request.name is not None:
        current_user.mascot_name = request.name

    # Mettre à jour l'accessoire équipé
    if request.current_accessory is not None:
        unlocked = current_user.mascot_unlocked_accessories or []

        # Vérifier que l'accessoire est débloqué
        if request.current_accessory != "" and request.current_accessory not in unlocked:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Accessoire '{request.current_accessory}' non débloqué"
            )

        current_user.mascot_current_accessory = request.current_accessory if request.current_accessory != "" else None

    await db.commit()
    await db.refresh(current_user)

    # Invalider le cache de la mascotte (async)
    await cache_service.invalidate_mascot_cache(current_user.id)

    logger.info(f"Mascotte mise à jour pour user {current_user.id}")

    return {
        "success": True,
        "name": current_user.mascot_name,
        "current_accessory": current_user.mascot_current_accessory,
        "message": "Mascotte mise à jour avec succès !"
    }


@router.post("/hint", response_model=MascotHintResponse)
async def get_mascot_hint(
    request: MascotHintRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtient un indice pédagogique de Spark pour une question

    - **topic**: Sujet de la question
    - **difficulty**: Niveau de difficulté (easy/medium/hard)

    Note: Utilise l'IA si disponible
    """
    # Générer l'indice (async)
    hint = await mascot_service.get_contextual_hint(
        topic=request.topic,
        difficulty=request.difficulty
    )

    return {
        "hint": hint,
        "mood": "thinking",
        "animation": "think"
    }


@router.post("/interaction")
async def record_mascot_interaction(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Enregistre une interaction avec la mascotte (clic sur Spark)

    Retourne un message aléatoire encourageant
    """
    messages = [
        "Besoin d'aide ? Je suis là ! 🐿️",
        "Fun fact : Les écureuils oublient 25% de leurs cachettes. Heureusement, Studera te fait TOUT mémoriser ! 😎",
        "Tu veux une noisette ? Fais un quiz ! 🌰",
        "Je sens que tu vas cartonner aujourd'hui ! ⚡",
        "N'oublie pas : chaque petite session compte ! 💪",
        "Prêt à ajouter des noisettes à ta collection ? 📚",
        "Les meilleures réserves se construisent petit à petit ! 🌰✨"
    ]

    message = random.choice(messages)

    current_user.mascot_last_interaction_date = datetime.now(timezone.utc)
    await db.commit()

    return {
        "message": message,
        "mood": "happy",
        "animation": "wave"
    }


@router.get("/check-new-unlocks")
async def check_new_unlocks(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Vérifie s'il y a de nouveaux accessoires débloqués

    À appeler après des événements majeurs (level up, achievement, etc.)
    """
    newly_unlocked = mascot_service.check_and_unlock_accessories(current_user)

    if newly_unlocked:
        await db.commit()

        # Invalider le cache de la mascotte (async)
        await cache_service.invalidate_mascot_cache(current_user.id)

        # Générer un message de célébration
        accessory_info = mascot_service.get_accessory_info()
        accessories_names = [
            accessory_info[acc]["name"] for acc in newly_unlocked
        ]

        logger.info(f"Nouveaux accessoires débloqués pour user {current_user.id}: {newly_unlocked}")

        return {
            "has_new_unlocks": True,
            "newly_unlocked": newly_unlocked,
            "accessories_names": accessories_names,
            "message": f"🎉 Nouvel accessoire débloqué : {accessories_names[0]} ! Je suis trop stylé ! ⚡",
            "mood": "excited",
            "animation": "celebration"
        }
    else:
        return {
            "has_new_unlocks": False,
            "newly_unlocked": [],
            "accessories_names": [],
            "message": "Continue comme ça ! De nouveaux accessoires t'attendent ! 💪"
        }


@router.post("/ask", response_model=MascotAskResponse)
async def ask_spark(
    request: MascotAskRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Pose une question directe à Spark pour obtenir de l'aide personnalisée

    - **question**: Ta question pour Spark (3-500 caractères)
    - **context**: Contexte additionnel (page actuelle, sujet en cours, etc.)

    Spark va analyser ta question avec l'IA et te donner:
    - Une réponse personnalisée adaptée à ton niveau
    - Des suggestions d'actions concrètes dans Studera

    💡 Utilise l'IA avec cache sémantique (questions similaires = même réponse)
    """
    # Contexte utilisateur pour la génération
    user_context = {
        "user_name": current_user.username,
        "streak": current_user.current_streak,
        "xp": current_user.total_xp,
        "level": current_user.level
    }

    # Générer la réponse avec l'IA (async + cache sémantique)
    response_data = await mascot_service.ask_question(
        question=request.question,
        user_context=user_context,
        additional_context=request.context
    )

    # Mettre à jour la dernière interaction
    current_user.mascot_last_interaction_date = datetime.now(timezone.utc)
    await db.commit()

    logger.debug(f"Spark Q&A pour user {current_user.id}: {request.question[:50]}...")

    return response_data
