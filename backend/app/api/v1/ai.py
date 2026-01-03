from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional, Tuple
from datetime import datetime, date, timezone
from pydantic import BaseModel, Field
import logging

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User, SubscriptionType
from app.models.note import Note
from app.models.subject import Subject
from app.models.flashcard import Flashcard
from app.models.quiz import Quiz
from app.services.ai_service import ai_service
from app.services.xp_service import award_xp

# Configuration du logger
logger = logging.getLogger(__name__)

router = APIRouter()


# ========== SCHEMAS ==========

class GenerateFlashcardsRequest(BaseModel):
    """Requête pour générer des flashcards depuis une note"""
    note_id: int
    count: int = Field(default=10, ge=1, le=20)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")


class GenerateFlashcardsResponse(BaseModel):
    """Réponse après génération de flashcards"""
    flashcards: List[dict]
    count: int
    note_title: str
    ai_requests_remaining: int


class GenerateQuizRequest(BaseModel):
    """Requête pour générer un quiz depuis une note"""
    note_id: int
    question_count: int = Field(default=10, ge=5, le=20)
    question_types: Optional[List[str]] = ["multiple_choice", "true_false", "short_answer"]
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")


class GenerateQuizResponse(BaseModel):
    """Réponse après génération de quiz"""
    quiz: dict
    note_title: str
    ai_requests_remaining: int


class SummarizeNoteRequest(BaseModel):
    """Requête pour résumer une note"""
    note_id: int
    max_length: int = Field(default=300, ge=50, le=1000)


class SummarizeNoteResponse(BaseModel):
    """Réponse après résumé"""
    summary: str
    note_title: str
    word_count: int
    ai_requests_remaining: int


class ExtractKeywordsRequest(BaseModel):
    """Requête pour extraire les mots-clés"""
    note_id: int
    max_keywords: int = Field(default=10, ge=3, le=20)


class ExtractKeywordsResponse(BaseModel):
    """Réponse après extraction"""
    keywords: List[str]
    note_title: str
    ai_requests_remaining: int


class GenerateStudyPlanRequest(BaseModel):
    """Requête pour générer un plan d'étude"""
    subject_id: int
    exam_date: date
    current_knowledge_level: str = Field(..., pattern="^(beginner|intermediate|advanced)$")
    available_hours_per_day: int = Field(default=2, ge=1, le=12)


class GenerateStudyPlanResponse(BaseModel):
    """Réponse après génération du plan"""
    study_plan: dict
    subject_name: str
    ai_requests_remaining: int


class ExplainConceptRequest(BaseModel):
    """Requête pour expliquer un concept"""
    concept: str = Field(..., min_length=2, max_length=200)
    context: Optional[str] = None
    level: str = Field(default="intermediate", pattern="^(beginner|intermediate|advanced)$")


class ExplainConceptResponse(BaseModel):
    """Réponse après explication"""
    explanation: str
    concept: str
    ai_requests_remaining: int


# ========== HELPERS ==========

# Quotas IA par type d'abonnement (Option 3: 55% marge avec cache 70%)
AI_QUOTAS = {
    SubscriptionType.FREE: 5,           # 5 requêtes/jour
    SubscriptionType.PREMIUM: 30,       # 30 requêtes/jour ($5.99/mois)
    SubscriptionType.PREMIUM_PLUS: 60,  # 60 requêtes/jour ($11.99/mois)
    SubscriptionType.INSTITUTIONAL: 200 # 200 requêtes/jour ($39.99/mois)
}


def get_max_requests(subscription_type: SubscriptionType) -> int:
    """Retourne le quota maximum pour un type d'abonnement"""
    return AI_QUOTAS.get(subscription_type, 10)


def raise_quota_exceeded_error(subscription_type: SubscriptionType, max_requests: int):
    """
    Lève une exception HTTP 429 avec des informations détaillées pour le frontend.
    Permet d'afficher un modal de mise à niveau personnalisé.
    """
    upgrade_benefits = None
    next_plan = None

    # Option 3: Prix et quotas optimisés (55% marge, cache 70%)
    if subscription_type == SubscriptionType.FREE:
        upgrade_benefits = {
            "PREMIUM": {"requests": 30, "price_usd": "$5.99", "price_xof": "3500 FCFA"},
            "PREMIUM_PLUS": {"requests": 60, "price_usd": "$11.99", "price_xof": "7000 FCFA"}
        }
        next_plan = "PREMIUM"
    elif subscription_type == SubscriptionType.PREMIUM:
        upgrade_benefits = {
            "PREMIUM_PLUS": {"requests": 60, "price_usd": "$11.99", "price_xof": "7000 FCFA"},
            "INSTITUTIONAL": {"requests": 200, "price_usd": "$39.99", "price_xof": "24000 FCFA"}
        }
        next_plan = "PREMIUM_PLUS"
    elif subscription_type == SubscriptionType.PREMIUM_PLUS:
        upgrade_benefits = {
            "INSTITUTIONAL": {"requests": 200, "price_usd": "$39.99", "price_xof": "24000 FCFA"}
        }
        next_plan = "INSTITUTIONAL"

    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "message": "Quota IA épuisé pour aujourd'hui",
            "code": "QUOTA_EXCEEDED",
            "subscription_type": subscription_type.value,
            "max_requests": max_requests,
            "used_requests": max_requests,
            "remaining": 0,
            "reset_time": "minuit UTC",
            "upgrade_available": subscription_type != SubscriptionType.INSTITUTIONAL,
            "next_plan": next_plan,
            "upgrade_url": "/pricing",
            "upgrade_benefits": upgrade_benefits
        }
    )


async def check_and_increment_ai_quota(
    user_id: int,
    subscription_type: SubscriptionType,
    db: AsyncSession
) -> Tuple[bool, int]:
    """
    Vérifie ET incrémente le quota IA de manière ATOMIQUE.

    Cette fonction utilise une transaction avec verrouillage pour éviter
    les race conditions où plusieurs requêtes simultanées pourraient
    contourner le quota.

    Args:
        user_id: ID de l'utilisateur
        subscription_type: Type d'abonnement de l'utilisateur
        db: Session de base de données

    Returns:
        Tuple (can_use, remaining_after_this_request)

    Raises:
        SQLAlchemyError: En cas d'erreur de base de données
    """
    max_requests = get_max_requests(subscription_type)
    today = datetime.now(timezone.utc).date()

    try:
        # Utiliser FOR UPDATE pour verrouiller la ligne pendant la transaction
        result = await db.execute(
            select(User)
            .where(User.id == user_id)
            .with_for_update()
        )
        user = result.scalar_one_or_none()

        if not user:
            logger.error(f"Utilisateur {user_id} non trouvé lors de la vérification du quota IA")
            return False, 0

        # Reset quotidien si nécessaire
        reset_date = user.ai_requests_reset_date.date() if user.ai_requests_reset_date else None

        if reset_date != today:
            # Nouveau jour: reset du compteur
            user.ai_requests_today = 0
            user.ai_requests_reset_date = datetime.now(timezone.utc)
            logger.info(f"Reset quotidien du quota IA pour l'utilisateur {user_id}")

        # Vérifier si l'utilisateur peut faire une requête
        if user.ai_requests_today >= max_requests:
            logger.warning(f"Quota IA dépassé pour l'utilisateur {user_id}: {user.ai_requests_today}/{max_requests}")
            return False, 0

        # Incrémenter les compteurs de manière atomique
        user.ai_requests_today += 1
        user.total_ai_requests += 1

        # Calculer les requêtes restantes APRÈS cette requête
        remaining = max_requests - user.ai_requests_today

        # Commit la transaction
        await db.commit()

        logger.info(f"Quota IA utilisé pour {user_id}: {user.ai_requests_today}/{max_requests} (reste: {remaining})")

        return True, remaining

    except SQLAlchemyError as e:
        await db.rollback()
        logger.error(f"Erreur SQLAlchemy lors de la vérification du quota IA: {e}")
        raise


async def get_ai_quota_info(user: User) -> dict:
    """
    Récupère les informations de quota IA sans incrémenter.
    Pour affichage uniquement.
    """
    max_requests = get_max_requests(user.subscription_type)
    today = datetime.now(timezone.utc).date()

    reset_date = user.ai_requests_reset_date.date() if user.ai_requests_reset_date else None
    requests_today = user.ai_requests_today if reset_date == today else 0

    return {
        "max_requests": max_requests,
        "requests_today": requests_today,
        "remaining": max_requests - requests_today,
        "can_use": requests_today < max_requests
    }


# ========== ROUTES ==========

@router.post("/generate-flashcards", response_model=GenerateFlashcardsResponse)
async def generate_flashcards_from_note(
    request: GenerateFlashcardsRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Génère automatiquement des flashcards depuis le contenu d'une note

    - **note_id**: ID de la note source
    - **count**: Nombre de flashcards à générer (1-20)
    - **difficulty**: Difficulté (easy, medium, hard)
    """
    # Vérifier et incrémenter le quota de manière atomique
    can_use, remaining = await check_and_increment_ai_quota(
        user_id=current_user.id,
        subscription_type=current_user.subscription_type,
        db=db
    )
    if not can_use:
        max_requests = get_max_requests(current_user.subscription_type)
        raise_quota_exceeded_error(current_user.subscription_type, max_requests)
    
    # Récupérer la note
    result = await db.execute(
        select(Note).where(
            and_(
                Note.id == request.note_id,
                Note.user_id == current_user.id
            )
        )
    )
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note non trouvée"
        )
    
    if not note.content or len(note.content) < 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La note doit contenir au moins 50 caractères pour générer des flashcards"
        )
    
    # Générer les flashcards avec IA
    try:
        flashcards = await ai_service.generate_flashcards_from_note(
            note_content=note.content,
            note_title=note.title,
            count=request.count,
            difficulty=request.difficulty,
            lang=current_user.language
        )
        
        # Créer les flashcards en DB
        for card_data in flashcards:
            new_flashcard = Flashcard(
                user_id=current_user.id,
                subject_id=note.subject_id,
                source_note_id=note.id,
                front=card_data["front"],
                back=card_data["back"],
                hint=card_data.get("hint", ""),
                explanation=card_data.get("explanation", ""),
                is_ai_generated=True
            )
            db.add(new_flashcard)
        
        # Mettre à jour les stats
        result = await db.execute(
            select(Subject).where(Subject.id == note.subject_id)
        )
        subject = result.scalar_one_or_none()
        if subject:
            subject.total_flashcards_count += len(flashcards)

        if current_user.stats:
            current_user.stats.total_flashcards_created += len(flashcards)

        # Bonus IA XP
        await award_xp(
            user=current_user,
            amount=10,
            reason="Génération de flashcards par IA",
            event_type="ai_flashcards_generated",
            db=db
        )

        await db.commit()

        logger.info(f"Flashcards générées pour utilisateur {current_user.id}: {len(flashcards)} cartes")

        return {
            "flashcards": flashcards,
            "count": len(flashcards),
            "note_title": note.title,
            "ai_requests_remaining": remaining
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la génération de flashcards: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Une erreur est survenue lors de la génération. Veuillez réessayer."
        )


@router.post("/generate-quiz", response_model=GenerateQuizResponse)
async def generate_quiz_from_note(
    request: GenerateQuizRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Génère automatiquement un quiz depuis le contenu d'une note

    - **note_id**: ID de la note source
    - **question_count**: Nombre de questions (5-20)
    - **question_types**: Types de questions
    - **difficulty**: Difficulté
    """
    # Vérifier et incrémenter le quota de manière atomique
    can_use, remaining = await check_and_increment_ai_quota(
        user_id=current_user.id,
        subscription_type=current_user.subscription_type,
        db=db
    )
    if not can_use:
        max_requests = get_max_requests(current_user.subscription_type)
        raise_quota_exceeded_error(current_user.subscription_type, max_requests)

    # Récupérer la note
    result = await db.execute(
        select(Note).where(
            and_(
                Note.id == request.note_id,
                Note.user_id == current_user.id
            )
        )
    )
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note non trouvée"
        )
    
    if not note.content or len(note.content) < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La note doit contenir au moins 100 caractères pour générer un quiz"
        )
    
    # Générer le quiz avec IA
    try:
        quiz_data = await ai_service.generate_quiz_from_note(
            note_content=note.content,
            note_title=note.title,
            question_count=request.question_count,
            question_types=request.question_types,
            difficulty=request.difficulty,
            lang=current_user.language
        )
        
        # Calculer le total de points
        total_points = sum(q.get("points", 10) for q in quiz_data["questions"])
        
        # Créer le quiz en DB
        new_quiz = Quiz(
            user_id=current_user.id,
            subject_id=note.subject_id,
            source_note_id=note.id,
            title=quiz_data.get("title", f"Quiz - {note.title}"),
            description=f"Quiz généré automatiquement par IA depuis la note '{note.title}'",
            questions=quiz_data["questions"],
            total_points=total_points,
            difficulty=request.difficulty,
            is_ai_generated=True,
            ai_prompt_used=f"Generated from note {note.id}",
        )
        db.add(new_quiz)
        
        # Mettre à jour les stats
        result = await db.execute(
            select(Subject).where(Subject.id == note.subject_id)
        )
        subject = result.scalar_one_or_none()
        if subject:
            subject.total_quizzes_count += 1

        if current_user.stats:
            current_user.stats.total_quizzes_created += 1

        # Bonus IA XP
        await award_xp(
            user=current_user,
            amount=15,
            reason="Génération de quiz par IA",
            event_type="ai_quiz_generated",
            db=db
        )

        await db.commit()
        await db.refresh(new_quiz)

        logger.info(f"Quiz généré pour utilisateur {current_user.id}: {len(quiz_data['questions'])} questions")

        return {
            "quiz": {
                "id": new_quiz.id,
                "title": new_quiz.title,
                "description": new_quiz.description,
                "questions": new_quiz.questions_data,
                "total_points": new_quiz.total_points
            },
            "note_title": note.title,
            "ai_requests_remaining": remaining
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la génération de quiz: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Une erreur est survenue lors de la génération. Veuillez réessayer."
        )


@router.post("/summarize-note", response_model=SummarizeNoteResponse)
async def summarize_note(
    request: SummarizeNoteRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Crée un résumé concis d'une note"""

    can_use, remaining = await check_and_increment_ai_quota(
        user_id=current_user.id,
        subscription_type=current_user.subscription_type,
        db=db
    )
    if not can_use:
        max_requests = get_max_requests(current_user.subscription_type)
        raise_quota_exceeded_error(current_user.subscription_type, max_requests)

    result = await db.execute(
        select(Note).where(
            and_(
                Note.id == request.note_id,
                Note.user_id == current_user.id
            )
        )
    )
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note non trouvée"
        )

    try:
        summary = await ai_service.summarize_note(
            note_content=note.content,
            note_title=note.title,
            max_length=request.max_length,
            lang=current_user.language
        )

        logger.info(f"Résumé généré pour utilisateur {current_user.id}")

        return {
            "summary": summary,
            "note_title": note.title,
            "word_count": len(summary.split()),
            "ai_requests_remaining": remaining
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors du résumé: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Une erreur est survenue lors de la génération du résumé."
        )


@router.post("/extract-keywords", response_model=ExtractKeywordsResponse)
async def extract_keywords(
    request: ExtractKeywordsRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Extrait les mots-clés principaux d'une note"""

    can_use, remaining = await check_and_increment_ai_quota(
        user_id=current_user.id,
        subscription_type=current_user.subscription_type,
        db=db
    )
    if not can_use:
        max_requests = get_max_requests(current_user.subscription_type)
        raise_quota_exceeded_error(current_user.subscription_type, max_requests)

    result = await db.execute(
        select(Note).where(
            and_(
                Note.id == request.note_id,
                Note.user_id == current_user.id
            )
        )
    )
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note non trouvée"
        )

    try:
        keywords = await ai_service.extract_keywords(
            note_content=note.content,
            note_title=note.title,
            max_keywords=request.max_keywords,
            lang=current_user.language
        )

        logger.info(f"Mots-clés extraits pour utilisateur {current_user.id}: {len(keywords)} mots")

        return {
            "keywords": keywords,
            "note_title": note.title,
            "ai_requests_remaining": remaining
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de l'extraction de mots-clés: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Une erreur est survenue lors de l'extraction des mots-clés."
        )


@router.post("/explain-concept", response_model=ExplainConceptResponse)
async def explain_concept(
    request: ExplainConceptRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Explique un concept de manière pédagogique"""

    can_use, remaining = await check_and_increment_ai_quota(
        user_id=current_user.id,
        subscription_type=current_user.subscription_type,
        db=db
    )
    if not can_use:
        max_requests = get_max_requests(current_user.subscription_type)
        raise_quota_exceeded_error(current_user.subscription_type, max_requests)

    try:
        explanation = await ai_service.explain_concept(
            concept=request.concept,
            context=request.context,
            level=request.level,
            lang=current_user.language
        )

        logger.info(f"Concept expliqué pour utilisateur {current_user.id}: {request.concept[:50]}")

        return {
            "explanation": explanation,
            "concept": request.concept,
            "ai_requests_remaining": remaining
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de l'explication du concept: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Une erreur est survenue lors de l'explication du concept."
        )


@router.get("/quota")
async def get_ai_quota(
    current_user: User = Depends(get_current_active_user)
):
    """Récupère le quota IA de l'utilisateur avec détails d'abonnement"""

    quota_info = await get_ai_quota_info(current_user)

    # Informations sur l'abonnement
    subscription = current_user.subscription
    subscription_type = current_user.subscription_type

    # Détails par type d'abonnement (Option 3: Prix optimisés avec 55% marge)
    subscription_details = {
        SubscriptionType.FREE: {
            "name": "Gratuit",
            "description": "Accès basique à l'IA",
            "features": [
                "5 requêtes IA par jour",
                "Génération de flashcards",
                "Génération de quiz",
                "Résumé de notes"
            ],
            "color": "gray",
            "icon": "free"
        },
        SubscriptionType.PREMIUM: {
            "name": "Premium",
            "description": "Pour les étudiants sérieux",
            "features": [
                "30 requêtes IA par jour",
                "Toutes les fonctionnalités IA",
                "Support prioritaire",
                "Pas de publicités"
            ],
            "color": "blue",
            "icon": "star"
        },
        SubscriptionType.PREMIUM_PLUS: {
            "name": "Premium+",
            "description": "Pour les power users",
            "features": [
                "60 requêtes IA par jour",
                "Accès anticipé aux nouvelles fonctionnalités",
                "Support VIP 24/7",
                "Stockage illimité"
            ],
            "color": "purple",
            "icon": "crown"
        },
        SubscriptionType.INSTITUTIONAL: {
            "name": "Institutionnel",
            "description": "Pour les établissements",
            "features": [
                "200 requêtes IA par jour",
                "Gestion multi-utilisateurs",
                "Analytics avancés",
                "API dédiée"
            ],
            "color": "green",
            "icon": "building"
        }
    }

    current_plan = subscription_details.get(subscription_type, subscription_details[SubscriptionType.FREE])

    # Statistiques d'utilisation IA
    ai_usage = current_user.ai_usage
    usage_stats = {
        "quiz_generations": ai_usage.quiz_generations if ai_usage else 0,
        "flashcard_generations": ai_usage.flashcard_generations if ai_usage else 0,
        "note_summaries": ai_usage.note_summaries if ai_usage else 0,
        "explanations": ai_usage.explanations if ai_usage else 0
    }

    return {
        "subscription_type": subscription_type.value,
        "subscription_info": {
            "name": current_plan["name"],
            "description": current_plan["description"],
            "features": current_plan["features"],
            "color": current_plan["color"],
            "icon": current_plan["icon"],
            "is_premium": subscription_type != SubscriptionType.FREE,
            "starts_at": subscription.subscription_starts_at.isoformat() if subscription and subscription.subscription_starts_at else None,
            "ends_at": subscription.subscription_ends_at.isoformat() if subscription and subscription.subscription_ends_at else None,
            "auto_renew": subscription.auto_renew if subscription else False
        },
        "quota": {
            "max_requests_per_day": quota_info["max_requests"],
            "requests_used_today": quota_info["requests_today"],
            "requests_remaining": quota_info["remaining"],
            "usage_percentage": round((quota_info["requests_today"] / quota_info["max_requests"]) * 100, 1) if quota_info["max_requests"] > 0 else 0,
            "can_use": quota_info["can_use"]
        },
        "usage_stats": usage_stats,
        "total_requests_all_time": current_user.total_ai_requests,
        # Rétrocompatibilité avec l'ancien format
        "max_requests_per_day": quota_info["max_requests"],
        "requests_used_today": quota_info["requests_today"],
        "requests_remaining": quota_info["remaining"],
        "can_use": quota_info["can_use"]
    }
