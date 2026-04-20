import os
import asyncio
import base64
import io
import subprocess
import tempfile
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, and_, update
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional, Tuple
from datetime import datetime, date, timezone
from pydantic import BaseModel, Field
import logging
import time

from app.core.database import get_db, async_session_maker
from app.core.security import get_current_active_user
from app.models.user import User, SubscriptionType
from app.models.note import Note
from app.models.subject import Subject
from app.models.flashcard import Flashcard
from app.models.quiz import Quiz
from app.models.document import Document
from app.models.ai_task import AITask, AITaskType, AITaskStatus
from app.services.ai_service import ai_service
from app.services.xp_service import award_xp
from app.services.ocr_service import OCRService, OCRSizeLimitError

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


# ========== SCHEMAS DOCUMENTS ==========

class GenerateFlashcardsFromDocumentRequest(BaseModel):
    """Requête pour générer des flashcards depuis un document"""
    document_id: int
    count: int = Field(default=10, ge=1, le=20)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    language: str = Field(default="fra", description="Langue pour OCR si nécessaire")


class GenerateFlashcardsFromDocumentResponse(BaseModel):
    """Réponse après génération de flashcards depuis document"""
    flashcards: List[dict]
    count: int
    document_title: str
    text_extracted: bool
    ai_requests_remaining: int


class GenerateQuizFromDocumentRequest(BaseModel):
    """Requête pour générer un quiz depuis un document"""
    document_id: int
    question_count: int = Field(default=10, ge=5, le=20)
    question_types: Optional[List[str]] = ["multiple_choice", "true_false", "short_answer"]
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    language: str = Field(default="fra", description="Langue pour OCR si nécessaire")
    time_limit_minutes: Optional[int] = Field(default=None, ge=5, le=180, description="Limite de temps en minutes")
    quiz_type: str = Field(default="practice", pattern="^(practice|test|exam)$")


class GenerateQuizFromDocumentResponse(BaseModel):
    """Réponse après génération de quiz depuis document"""
    quiz: dict
    document_title: str
    text_extracted: bool
    ai_requests_remaining: int


# ========== SCHEMAS TÂCHES ASYNC ==========

class AITaskResponse(BaseModel):
    """Réponse pour une tâche IA lancée en arrière-plan"""
    task_id: int
    status: str
    message: str
    document_title: str


class AITaskStatusResponse(BaseModel):
    """Réponse pour le statut d'une tâche IA"""
    id: int
    task_type: str
    status: str
    source_type: str
    source_id: int
    source_title: Optional[str]
    progress: int
    progress_message: Optional[str]
    result_count: Optional[int]
    error_message: Optional[str]
    error_code: Optional[str]
    started_at: Optional[str]
    completed_at: Optional[str]
    created_at: Optional[str]
    processing_time_seconds: Optional[int]
    # Résultats si complété
    flashcards: Optional[List[dict]] = None
    quiz: Optional[dict] = None


class AITaskListResponse(BaseModel):
    """Liste des tâches IA d'un utilisateur"""
    tasks: List[AITaskStatusResponse]
    total: int


# ========== HELPERS ==========

# Quotas IA par type d'abonnement (PHASE TEST: 20 pour tous)
AI_QUOTAS = {
    SubscriptionType.FREE: 20,          # 20 requêtes/jour (TEST)
    SubscriptionType.PREMIUM: 20,       # 20 requêtes/jour (TEST)
    SubscriptionType.PREMIUM_PLUS: 20,  # 20 requêtes/jour (TEST)
    SubscriptionType.INSTITUTIONAL: 20  # 20 requêtes/jour (TEST)
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
    db: AsyncSession,
    request_type: str = None
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
        request_type: Type de requête ("quiz", "flashcard", "summary", "explanation")

    Returns:
        Tuple (can_use, remaining_after_this_request)

    Raises:
        SQLAlchemyError: En cas d'erreur de base de données
    """
    max_requests = get_max_requests(subscription_type)
    today = datetime.now(timezone.utc).date()

    try:
        from app.models.user import UserAIUsage

        # Récupérer ou créer l'entrée ai_usage directement (sans jointure)
        result = await db.execute(
            select(UserAIUsage)
            .where(UserAIUsage.user_id == user_id)
            .with_for_update()
        )
        ai_usage = result.scalar_one_or_none()

        # Si pas d'entrée ai_usage, la créer
        if not ai_usage:
            ai_usage = UserAIUsage(user_id=user_id)
            db.add(ai_usage)
            await db.flush()  # Pour obtenir l'ID

        # Reset quotidien si nécessaire
        reset_date = ai_usage.requests_reset_date.date() if ai_usage.requests_reset_date else None

        if reset_date != today:
            # Nouveau jour: reset du compteur
            ai_usage.requests_today = 0
            ai_usage.requests_reset_date = datetime.now(timezone.utc)
            logger.info(f"Reset quotidien du quota IA pour l'utilisateur {user_id}")

        # Vérifier si l'utilisateur peut faire une requête
        requests_today = ai_usage.requests_today or 0
        if requests_today >= max_requests:
            logger.warning(f"Quota IA dépassé pour l'utilisateur {user_id}: {requests_today}/{max_requests}")
            return False, 0

        # Incrémenter les compteurs de manière atomique
        ai_usage.requests_today = requests_today + 1
        ai_usage.total_requests = (ai_usage.total_requests or 0) + 1

        # Incrémenter le compteur par type de requête
        if request_type:
            type_mapping = {
                "quiz": "quiz_generations",
                "flashcard": "flashcard_generations",
                "summary": "note_summaries",
                "explanation": "explanations"
            }
            if request_type in type_mapping:
                attr = type_mapping[request_type]
                current_val = getattr(ai_usage, attr) or 0
                setattr(ai_usage, attr, current_val + 1)
                logger.info(f"Compteur {attr} incrémenté à {current_val + 1} pour user {user_id}")

        # Calculer les requêtes restantes APRÈS cette requête
        remaining = max_requests - ai_usage.requests_today

        # Commit la transaction
        await db.commit()

        logger.info(f"Quota IA utilisé pour {user_id}: {ai_usage.requests_today}/{max_requests} (reste: {remaining})")

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
        db=db,
        request_type="flashcard"
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
        db=db,
        request_type="quiz"
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
            questions_data=quiz_data["questions"],
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
        db=db,
        request_type="summary"
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
        db=db,
        request_type="summary"  # Keywords extraction counts as summary/analysis
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
        db=db,
        request_type="explanation"
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


# ========== ENDPOINTS DOCUMENTS ==========

# Service OCR (instance globale)
ocr_service = OCRService()

UPLOAD_DIR = "/app/uploads/documents"


async def extract_text_from_document(document: Document, language: str = "fra") -> str:
    """
    Extrait le texte d'un document.
    Si le texte est déjà extrait, le retourne directement.
    Sinon, utilise l'OCR pour l'extraire.
    """
    # Si le texte est déjà extrait, le retourner
    if document.is_text_extracted and document.extracted_text:
        return document.extracted_text

    # Sinon, extraire le texte avec OCR
    # Le storage_path contient déjà "user_id/stored_filename"
    file_path = f"{UPLOAD_DIR}/{document.storage_path}"

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fichier document non trouvé sur le serveur"
        )

    # Lire le fichier
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    # Extraire le texte selon le type de fichier
    # OCRSizeLimitError -> HTTP 413 (depassement des garde-fous anti-DoS)
    try:
        if document.file_type == "pdf":
            result = await ocr_service.extract_text_from_pdf(
                pdf_file=file_bytes,
                language=language
            )
            # Le service OCR retourne 'full_text' pour les PDFs
            extracted_text = result.get("full_text", "") or result.get("text", "")
        elif document.file_type == "image":
            result = await ocr_service.extract_text_from_image(
                image_file=file_bytes,
                language=language
            )
            # Le service OCR retourne 'full_text' pour les images aussi
            extracted_text = result.get("full_text", "") or result.get("text", "")
        elif document.file_type in ["word", "excel", "powerpoint"]:
            # Pour Office, convertir en PDF puis extraire le texte
            logger.info(f"Document Office ({document.file_type}), conversion en PDF pour extraction...")
            try:
                pdf_path = convert_office_to_pdf(file_path)
                temp_dir = os.path.dirname(pdf_path)
                try:
                    with open(pdf_path, "rb") as pdf_f:
                        pdf_bytes = pdf_f.read()
                    result = await ocr_service.extract_text_from_pdf(
                        pdf_file=pdf_bytes,
                        language=language
                    )
                    extracted_text = result.get("full_text", "") or result.get("text", "")
                finally:
                    # Nettoyer le PDF temporaire
                    shutil.rmtree(temp_dir, ignore_errors=True)
            except OCRSizeLimitError:
                # Propager : l'except externe convertit en HTTP 413
                raise
            except Exception as e:
                logger.error(f"Erreur conversion Office: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Erreur lors de la conversion du document Office: {str(e)}"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Type de document non supporté pour l'extraction: {document.file_type}. Types supportés: PDF, images, Word, Excel, PowerPoint."
            )
    except OCRSizeLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=str(e)
        )

    return extracted_text


# ========== TRAITEMENT ARRIÈRE-PLAN ==========

def convert_office_to_pdf(input_path: str) -> str:
    """
    Convertit un document Office (Word, Excel, PowerPoint) en PDF avec LibreOffice.

    Args:
        input_path: Chemin vers le fichier Office

    Returns:
        Chemin vers le fichier PDF généré (dans un dossier temporaire)

    Raises:
        ValueError: Si la conversion échoue
    """
    # Créer un répertoire temporaire pour la sortie
    temp_dir = tempfile.mkdtemp(prefix="office_convert_")

    try:
        # Commande LibreOffice pour convertir en PDF
        # --headless: pas d'interface graphique
        # --convert-to pdf: format de sortie
        # --outdir: dossier de sortie
        cmd = [
            'libreoffice',
            '--headless',
            '--convert-to', 'pdf',
            '--outdir', temp_dir,
            input_path
        ]

        logger.info(f"Conversion Office → PDF: {os.path.basename(input_path)}")

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120  # 2 minutes max
        )

        if result.returncode != 0:
            logger.error(f"LibreOffice error: {result.stderr}")
            raise ValueError(f"Erreur de conversion: {result.stderr}")

        # Trouver le fichier PDF généré
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        pdf_path = os.path.join(temp_dir, f"{base_name}.pdf")

        if not os.path.exists(pdf_path):
            # Parfois le nom peut être légèrement différent
            pdf_files = [f for f in os.listdir(temp_dir) if f.endswith('.pdf')]
            if pdf_files:
                pdf_path = os.path.join(temp_dir, pdf_files[0])
            else:
                raise ValueError("Fichier PDF non généré")

        logger.info(f"Conversion réussie: {pdf_path}")
        return pdf_path

    except subprocess.TimeoutExpired:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise ValueError("Timeout: conversion trop longue")
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise


# Extensions Office supportées
OFFICE_EXTENSIONS = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp']


async def convert_document_to_images(document: Document) -> List[dict]:
    """
    Convertit un document (PDF, image, ou Office) en liste d'images base64 pour Claude Vision.

    Supporte:
    - PDF: conversion directe en images
    - Images: encodage base64 direct
    - Word/Excel/PowerPoint: conversion en PDF puis en images

    Returns:
        Liste de dicts {"data": base64_string, "media_type": "image/png"|"image/jpeg"}
    """
    images = []
    temp_pdf_dir = None  # Pour nettoyer le PDF temporaire si créé

    # Construire le chemin complet: UPLOAD_DIR + storage_path
    file_path = f"{UPLOAD_DIR}/{document.storage_path}"

    if not os.path.exists(file_path):
        logger.error(f"Fichier non trouvé: {file_path}")
        raise FileNotFoundError(f"Document non trouvé: {file_path}")

    file_ext = os.path.splitext(file_path)[1].lower()

    # Variable pour le chemin effectif à traiter (peut être le PDF converti)
    path_to_process = file_path
    is_converted_pdf = False

    try:
        # === CONVERSION OFFICE → PDF SI NÉCESSAIRE ===
        if file_ext in OFFICE_EXTENSIONS:
            logger.info(f"Document Office détecté ({file_ext}), conversion en PDF...")
            path_to_process = convert_office_to_pdf(file_path)
            temp_pdf_dir = os.path.dirname(path_to_process)
            is_converted_pdf = True
            file_ext = '.pdf'  # Maintenant on traite un PDF
            logger.info(f"Document Office converti en PDF: {path_to_process}")

        # === TRAITEMENT PDF (original ou converti) ===
        if file_ext == '.pdf':
            # Convertir PDF en images avec pdf2image
            from pdf2image import convert_from_path

            # Limiter à 20 pages max pour Claude Vision
            pdf_images = convert_from_path(path_to_process, dpi=150, first_page=1, last_page=20)

            for i, img in enumerate(pdf_images):
                # Convertir l'image PIL en base64
                buffer = io.BytesIO()
                img.save(buffer, format='PNG', optimize=True)
                buffer.seek(0)
                img_base64 = base64.standard_b64encode(buffer.read()).decode('utf-8')

                images.append({
                    "data": img_base64,
                    "media_type": "image/png"
                })
                logger.debug(f"Page PDF {i+1} convertie en image")

            logger.info(f"PDF converti: {len(images)} pages")

        elif file_ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp']:
            # Image directe - lire et encoder en base64
            with open(file_path, 'rb') as f:
                img_data = f.read()

            img_base64 = base64.standard_b64encode(img_data).decode('utf-8')

            media_type = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.webp': 'image/webp'
            }.get(file_ext, 'image/png')

            images.append({
                "data": img_base64,
                "media_type": media_type
            })
            logger.info(f"Image convertie: {media_type}")

        else:
            logger.warning(f"Type de fichier non supporté pour Vision: {file_ext}")
            raise ValueError(f"Type de fichier non supporté: {file_ext}")

    except ImportError as e:
        logger.error(f"pdf2image non disponible: {e}")
        raise ValueError("Conversion PDF non disponible")
    except Exception as e:
        logger.error(f"Erreur conversion document en images: {e}", exc_info=True)
        raise
    finally:
        # Nettoyer le PDF temporaire si créé
        if temp_pdf_dir and os.path.exists(temp_pdf_dir):
            shutil.rmtree(temp_pdf_dir, ignore_errors=True)
            logger.debug(f"Dossier temporaire nettoyé: {temp_pdf_dir}")

    return images


async def process_flashcards_task(task_id: int, document_id: int, user_id: int, user_language: str, params: dict):
    """
    Traite la génération de flashcards en arrière-plan avec Claude Vision.
    Envoie directement les images du document à Claude pour une meilleure compréhension.
    """
    start_time = time.time()

    async with async_session_maker() as db:
        try:
            # Récupérer la tâche
            result = await db.execute(select(AITask).where(AITask.id == task_id))
            task = result.scalar_one_or_none()
            if not task:
                logger.error(f"Tâche {task_id} non trouvée")
                return

            # Marquer comme en cours
            task.status = AITaskStatus.PROCESSING.value
            task.started_at = datetime.now(timezone.utc)
            task.progress = 5
            task.progress_message = "Démarrage du traitement..."
            await db.commit()

            # Récupérer le document
            result = await db.execute(
                select(Document).where(
                    and_(Document.id == document_id, Document.user_id == user_id)
                )
            )
            document = result.scalar_one_or_none()

            if not document:
                task.status = AITaskStatus.FAILED.value
                task.error_message = "Document non trouvé"
                task.error_code = "DOCUMENT_NOT_FOUND"
                await db.commit()
                return

            doc_title = document.title or document.original_filename

            # Conversion du document en images pour Claude Vision
            task.status = AITaskStatus.EXTRACTING_TEXT.value
            task.progress = 10
            task.progress_message = "Conversion du document en images..."
            await db.commit()

            try:
                images = await convert_document_to_images(document)
                task.progress = 30
                task.progress_message = f"Document converti: {len(images)} page(s)"
                await db.commit()

                if not images:
                    raise ValueError("Aucune image extraite du document")

            except Exception as e:
                logger.error(f"Erreur conversion document pour tâche {task_id}: {e}", exc_info=True)
                task.status = AITaskStatus.FAILED.value
                task.error_message = f"Erreur conversion document: {str(e)}"
                task.error_code = "CONVERSION_ERROR"
                task.completed_at = datetime.now(timezone.utc)
                task.processing_time_seconds = int(time.time() - start_time)
                await db.commit()
                return

            # Génération des flashcards avec Claude Vision
            task.status = AITaskStatus.GENERATING.value
            task.progress = 40
            task.progress_message = "Analyse du document avec Claude Vision..."
            await db.commit()

            try:
                logger.info(f"Envoi de {len(images)} images à Claude Vision pour tâche {task_id}")

                flashcards = await ai_service.generate_flashcards_from_images(
                    images=images,
                    document_title=doc_title,
                    count=params.get("count", 10),
                    difficulty=params.get("difficulty", "medium"),
                    lang=user_language
                )

                task.progress = 80
                task.progress_message = "Sauvegarde des flashcards..."
                await db.commit()

                # Créer les flashcards en base avec un nom de deck basé sur le document
                deck_name = f"Flashcards - {doc_title}"
                created_flashcards = []
                for fc_data in flashcards:
                    flashcard = Flashcard(
                        front=fc_data.get("front", ""),
                        back=fc_data.get("back", ""),
                        hint=fc_data.get("hint"),
                        explanation=fc_data.get("explanation"),
                        subject_id=document.subject_id,
                        user_id=user_id,
                        deck_name=deck_name,
                        is_ai_generated=True
                    )
                    db.add(flashcard)
                    created_flashcards.append({
                        "front": flashcard.front,
                        "back": flashcard.back,
                        "hint": flashcard.hint,
                        "explanation": flashcard.explanation
                    })

                await db.commit()

                # Terminer avec succès
                task.status = AITaskStatus.COMPLETED.value
                task.progress = 100
                task.progress_message = "Terminé avec succès!"
                task.result = {"flashcards": created_flashcards, "document_title": doc_title}
                task.result_count = len(created_flashcards)
                task.completed_at = datetime.now(timezone.utc)
                task.processing_time_seconds = int(time.time() - start_time)
                await db.commit()

                logger.info(f"Tâche Vision {task_id} terminée: {len(created_flashcards)} flashcards créées en {task.processing_time_seconds}s")

            except Exception as e:
                logger.error(f"Erreur génération Vision flashcards pour tâche {task_id}: {e}", exc_info=True)
                task.status = AITaskStatus.FAILED.value
                task.error_message = f"Erreur génération IA: {str(e)}"
                task.error_code = "GENERATION_ERROR"
                task.completed_at = datetime.now(timezone.utc)
                task.processing_time_seconds = int(time.time() - start_time)
                await db.commit()

        except Exception as e:
            logger.error(f"Erreur globale tâche {task_id}: {e}", exc_info=True)
            try:
                task.status = AITaskStatus.FAILED.value
                task.error_message = f"Erreur inattendue: {str(e)}"
                task.error_code = "UNEXPECTED_ERROR"
                task.completed_at = datetime.now(timezone.utc)
                task.processing_time_seconds = int(time.time() - start_time)
                await db.commit()
            except:
                pass


async def process_quiz_task(task_id: int, document_id: int, user_id: int, user_language: str, params: dict):
    """
    Traite la génération de quiz en arrière-plan avec Claude Vision.
    Envoie directement les images du document à Claude pour une meilleure compréhension.
    """
    start_time = time.time()

    async with async_session_maker() as db:
        try:
            # Récupérer la tâche
            result = await db.execute(select(AITask).where(AITask.id == task_id))
            task = result.scalar_one_or_none()
            if not task:
                logger.error(f"Tâche {task_id} non trouvée")
                return

            # Marquer comme en cours
            task.status = AITaskStatus.PROCESSING.value
            task.started_at = datetime.now(timezone.utc)
            task.progress = 5
            task.progress_message = "Démarrage du traitement..."
            await db.commit()

            # Récupérer le document
            result = await db.execute(
                select(Document).where(
                    and_(Document.id == document_id, Document.user_id == user_id)
                )
            )
            document = result.scalar_one_or_none()

            if not document:
                task.status = AITaskStatus.FAILED.value
                task.error_message = "Document non trouvé"
                task.error_code = "DOCUMENT_NOT_FOUND"
                await db.commit()
                return

            doc_title = document.title or document.original_filename

            # Conversion du document en images pour Claude Vision
            task.status = AITaskStatus.EXTRACTING_TEXT.value
            task.progress = 10
            task.progress_message = "Conversion du document en images..."
            await db.commit()

            try:
                images = await convert_document_to_images(document)
                task.progress = 30
                task.progress_message = f"Document converti: {len(images)} page(s)"
                await db.commit()

                if not images:
                    raise ValueError("Aucune image extraite du document")

            except Exception as e:
                logger.error(f"Erreur conversion document pour tâche quiz {task_id}: {e}", exc_info=True)
                task.status = AITaskStatus.FAILED.value
                task.error_message = f"Erreur conversion document: {str(e)}"
                task.error_code = "CONVERSION_ERROR"
                task.completed_at = datetime.now(timezone.utc)
                task.processing_time_seconds = int(time.time() - start_time)
                await db.commit()
                return

            # Génération du quiz avec Claude Vision
            task.status = AITaskStatus.GENERATING.value
            task.progress = 40
            task.progress_message = "Analyse du document avec Claude Vision..."
            await db.commit()

            try:
                logger.info(f"Envoi de {len(images)} images à Claude Vision pour quiz tâche {task_id}")

                questions = await ai_service.generate_quiz_from_images(
                    images=images,
                    document_title=doc_title,
                    question_count=params.get("question_count", 10),
                    question_types=params.get("question_types", ["multiple_choice", "true_false"]),
                    difficulty=params.get("difficulty", "medium"),
                    lang=user_language
                )

                task.progress = 80
                task.progress_message = "Sauvegarde du quiz..."
                await db.commit()

                # Créer le quiz en base
                quiz_title = f"Quiz - {doc_title}"
                # Calculer le total des points
                total_points = sum(q.get("points", 10) for q in questions)
                quiz = Quiz(
                    title=quiz_title,
                    description=f"Quiz généré par IA (Vision) depuis le document: {doc_title}",
                    user_id=user_id,
                    subject_id=document.subject_id,
                    is_ai_generated=True,
                    questions_data=questions,  # JSON field, not relationship
                    quiz_type=params.get("quiz_type", "practice"),
                    difficulty=params.get("difficulty", "medium"),
                    time_limit_minutes=params.get("time_limit_minutes"),
                    is_timed=params.get("time_limit_minutes") is not None,
                    total_points=total_points,
                    passing_score=60
                )
                db.add(quiz)
                await db.commit()
                await db.refresh(quiz)

                quiz_result = {
                    "id": quiz.id,
                    "title": quiz.title,
                    "description": quiz.description,
                    "questions": questions,
                    "question_count": len(questions),
                    "document_title": doc_title
                }

                # Terminer avec succès
                task.status = AITaskStatus.COMPLETED.value
                task.progress = 100
                task.progress_message = "Terminé avec succès!"
                task.result = {"quiz": quiz_result}
                task.result_count = len(questions)
                task.completed_at = datetime.now(timezone.utc)
                task.processing_time_seconds = int(time.time() - start_time)
                await db.commit()

                logger.info(f"Tâche Vision quiz {task_id} terminée: {len(questions)} questions créées en {task.processing_time_seconds}s")

            except Exception as e:
                logger.error(f"Erreur génération Vision quiz pour tâche {task_id}: {e}", exc_info=True)
                task.status = AITaskStatus.FAILED.value
                task.error_message = f"Erreur génération IA: {str(e)}"
                task.error_code = "GENERATION_ERROR"
                task.completed_at = datetime.now(timezone.utc)
                task.processing_time_seconds = int(time.time() - start_time)
                await db.commit()

        except Exception as e:
            logger.error(f"Erreur globale tâche quiz {task_id}: {e}", exc_info=True)
            try:
                task.status = AITaskStatus.FAILED.value
                task.error_message = f"Erreur inattendue: {str(e)}"
                task.error_code = "UNEXPECTED_ERROR"
                task.completed_at = datetime.now(timezone.utc)
                task.processing_time_seconds = int(time.time() - start_time)
                await db.commit()
            except:
                pass


# ========== ENDPOINTS TÂCHES ASYNC ==========

@router.post("/document/generate-flashcards-async", response_model=AITaskResponse)
async def generate_flashcards_from_document_async(
    request: GenerateFlashcardsFromDocumentRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lance la génération de flashcards en arrière-plan pour les gros documents.
    Retourne immédiatement un task_id pour suivre la progression.
    """
    logger.info(f"=== DEBUT generate_flashcards_async pour user {current_user.id}, document {request.document_id} ===")

    # Vérifier et incrémenter le quota
    can_use, remaining = await check_and_increment_ai_quota(
        user_id=current_user.id,
        subscription_type=current_user.subscription_type,
        db=db,
        request_type="flashcard"
    )

    if not can_use:
        max_requests = get_max_requests(current_user.subscription_type)
        raise_quota_exceeded_error(current_user.subscription_type, max_requests)

    # Récupérer le document pour validation
    result = await db.execute(
        select(Document).where(
            and_(
                Document.id == request.document_id,
                Document.user_id == current_user.id
            )
        )
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document non trouvé"
        )

    doc_title = document.title or document.original_filename

    # Créer la tâche
    task = AITask(
        user_id=current_user.id,
        task_type=AITaskType.FLASHCARDS_FROM_DOCUMENT.value,
        status=AITaskStatus.PENDING.value,
        source_type="document",
        source_id=document.id,
        source_title=doc_title,
        params={
            "count": request.count,
            "difficulty": request.difficulty,
            "language": request.language
        },
        progress=0,
        progress_message="En attente de traitement..."
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    logger.info(f"Tâche {task.id} créée pour document {document.id}")

    # Lancer le traitement en arrière-plan
    asyncio.create_task(
        process_flashcards_task(
            task_id=task.id,
            document_id=document.id,
            user_id=current_user.id,
            user_language=current_user.language,
            params={
                "count": request.count,
                "difficulty": request.difficulty,
                "language": request.language
            }
        )
    )

    return {
        "task_id": task.id,
        "status": task.status,
        "message": "Génération lancée en arrière-plan. Utilisez /ai/task/{task_id} pour suivre la progression.",
        "document_title": doc_title
    }


@router.post("/document/generate-quiz-async", response_model=AITaskResponse)
async def generate_quiz_from_document_async(
    request: GenerateQuizFromDocumentRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lance la génération d'un quiz en arrière-plan pour les gros documents.
    """
    logger.info(f"=== DEBUT generate_quiz_async pour user {current_user.id}, document {request.document_id} ===")

    # Vérifier et incrémenter le quota
    can_use, remaining = await check_and_increment_ai_quota(
        user_id=current_user.id,
        subscription_type=current_user.subscription_type,
        db=db,
        request_type="quiz"
    )

    if not can_use:
        max_requests = get_max_requests(current_user.subscription_type)
        raise_quota_exceeded_error(current_user.subscription_type, max_requests)

    # Récupérer le document pour validation
    result = await db.execute(
        select(Document).where(
            and_(
                Document.id == request.document_id,
                Document.user_id == current_user.id
            )
        )
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document non trouvé"
        )

    doc_title = document.title or document.original_filename

    # Créer la tâche
    task = AITask(
        user_id=current_user.id,
        task_type=AITaskType.QUIZ_FROM_DOCUMENT.value,
        status=AITaskStatus.PENDING.value,
        source_type="document",
        source_id=document.id,
        source_title=doc_title,
        params={
            "question_count": request.question_count,
            "question_types": request.question_types,
            "difficulty": request.difficulty,
            "language": request.language,
            "time_limit_minutes": request.time_limit_minutes,
            "quiz_type": request.quiz_type
        },
        progress=0,
        progress_message="En attente de traitement..."
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    logger.info(f"Tâche quiz {task.id} créée pour document {document.id}")

    # Lancer le traitement en arrière-plan
    asyncio.create_task(
        process_quiz_task(
            task_id=task.id,
            document_id=document.id,
            user_id=current_user.id,
            user_language=current_user.language,
            params={
                "question_count": request.question_count,
                "question_types": request.question_types,
                "difficulty": request.difficulty,
                "language": request.language,
                "time_limit_minutes": request.time_limit_minutes,
                "quiz_type": request.quiz_type
            }
        )
    )

    return {
        "task_id": task.id,
        "status": task.status,
        "message": "Génération lancée en arrière-plan. Utilisez /ai/task/{task_id} pour suivre la progression.",
        "document_title": doc_title
    }


@router.get("/task/{task_id}", response_model=AITaskStatusResponse)
async def get_task_status(
    task_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupère le statut d'une tâche IA.
    """
    result = await db.execute(
        select(AITask).where(
            and_(
                AITask.id == task_id,
                AITask.user_id == current_user.id
            )
        )
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tâche non trouvée"
        )

    response = {
        "id": task.id,
        "task_type": task.task_type,
        "status": task.status,
        "source_type": task.source_type,
        "source_id": task.source_id,
        "source_title": task.source_title,
        "progress": task.progress,
        "progress_message": task.progress_message,
        "result_count": task.result_count,
        "error_message": task.error_message,
        "error_code": task.error_code,
        "started_at": task.started_at.isoformat() if task.started_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "processing_time_seconds": task.processing_time_seconds
    }

    # Inclure les résultats si la tâche est terminée
    if task.status == AITaskStatus.COMPLETED.value and task.result:
        if task.task_type == AITaskType.FLASHCARDS_FROM_DOCUMENT.value:
            response["flashcards"] = task.result.get("flashcards", [])
        elif task.task_type == AITaskType.QUIZ_FROM_DOCUMENT.value:
            response["quiz"] = task.result.get("quiz")

    return response


@router.get("/tasks", response_model=AITaskListResponse)
async def get_user_tasks(
    status_filter: Optional[str] = None,
    task_type: Optional[str] = None,
    limit: int = 20,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Liste les tâches IA de l'utilisateur.
    """
    query = select(AITask).where(AITask.user_id == current_user.id)

    if status_filter:
        query = query.where(AITask.status == status_filter)
    if task_type:
        query = query.where(AITask.task_type == task_type)

    query = query.order_by(AITask.created_at.desc()).limit(limit)

    result = await db.execute(query)
    tasks = result.scalars().all()

    task_responses = []
    for task in tasks:
        task_response = {
            "id": task.id,
            "task_type": task.task_type,
            "status": task.status,
            "source_type": task.source_type,
            "source_id": task.source_id,
            "source_title": task.source_title,
            "progress": task.progress,
            "progress_message": task.progress_message,
            "result_count": task.result_count,
            "error_message": task.error_message,
            "error_code": task.error_code,
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "processing_time_seconds": task.processing_time_seconds
        }
        task_responses.append(task_response)

    return {
        "tasks": task_responses,
        "total": len(task_responses)
    }


# ========== ENDPOINTS DOCUMENTS SYNCHRONES (gardés pour petits documents) ==========

@router.post("/document/generate-flashcards", response_model=GenerateFlashcardsFromDocumentResponse)
async def generate_flashcards_from_document(
    request: GenerateFlashcardsFromDocumentRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Génère des flashcards directement depuis un document (PDF ou image)

    - **document_id**: ID du document source
    - **count**: Nombre de flashcards à générer (1-20)
    - **difficulty**: Difficulté (easy, medium, hard)
    - **language**: Langue pour l'OCR si nécessaire (fra, eng, etc.)
    """
    logger.info(f"=== DEBUT generate_flashcards_from_document pour user {current_user.id}, document {request.document_id} ===")

    # Vérifier et incrémenter le quota
    can_use, remaining = await check_and_increment_ai_quota(
        user_id=current_user.id,
        subscription_type=current_user.subscription_type,
        db=db,
        request_type="flashcard"
    )
    logger.info(f"Quota check: can_use={can_use}, remaining={remaining}")

    if not can_use:
        max_requests = get_max_requests(current_user.subscription_type)
        raise_quota_exceeded_error(current_user.subscription_type, max_requests)

    # Récupérer le document
    logger.info(f"Recherche document {request.document_id} pour user {current_user.id}")
    result = await db.execute(
        select(Document).where(
            and_(
                Document.id == request.document_id,
                Document.user_id == current_user.id
            )
        )
    )
    document = result.scalar_one_or_none()

    if not document:
        logger.warning(f"Document {request.document_id} non trouvé pour user {current_user.id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document non trouvé"
        )

    logger.info(f"Document trouvé: {document.original_filename}, type={document.file_type}, storage_path={document.storage_path}")

    # Extraire le texte du document
    try:
        logger.info(f"Extraction texte du document {document.id}")
        text_content = await extract_text_from_document(document, request.language)
        text_extracted = not document.is_text_extracted  # True si on vient d'extraire
        logger.info(f"Texte extrait: {len(text_content) if text_content else 0} caractères")

        # Sauvegarder le texte extrait pour les prochaines fois
        if not document.is_text_extracted and text_content:
            document.extracted_text = text_content
            document.is_text_extracted = True
            await db.commit()
            logger.info(f"Texte sauvegardé pour document {document.id}")

    except Exception as e:
        logger.error(f"Erreur extraction texte document {document.id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Impossible d'extraire le texte du document: {str(e)}"
        )

    if not text_content or len(text_content) < 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le document doit contenir au moins 50 caractères de texte pour générer des flashcards"
        )

    # Générer les flashcards avec IA
    try:
        doc_title = document.title or document.original_filename
        logger.info(f"Génération flashcards IA pour document '{doc_title}'")
        flashcards = await ai_service.generate_flashcards_from_note(
            note_content=text_content,
            note_title=doc_title,
            count=request.count,
            difficulty=request.difficulty,
            lang=current_user.language
        )
        logger.info(f"Flashcards générées par IA: {len(flashcards)}")

        # Créer les flashcards en base
        created_flashcards = []
        for fc_data in flashcards:
            flashcard = Flashcard(
                front=fc_data.get("front", ""),
                back=fc_data.get("back", ""),
                hint=fc_data.get("hint"),
                explanation=fc_data.get("explanation"),
                subject_id=document.subject_id,
                user_id=current_user.id,
                is_ai_generated=True
            )
            db.add(flashcard)
            created_flashcards.append({
                "front": flashcard.front,
                "back": flashcard.back,
                "hint": flashcard.hint,
                "explanation": flashcard.explanation
            })

        await db.commit()

        # XP bonus
        await award_xp(
            user=current_user,
            amount=10,
            reason="Génération IA flashcards depuis document",
            event_type="ai_document_flashcards_generated",
            db=db
        )

        logger.info(f"=== FIN generate_flashcards_from_document: {len(created_flashcards)} flashcards créées ===")

        return {
            "flashcards": created_flashcards,
            "count": len(created_flashcards),
            "document_title": doc_title,
            "text_extracted": text_extracted,
            "ai_requests_remaining": remaining
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur génération flashcards depuis document: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Une erreur est survenue lors de la génération des flashcards."
        )


@router.post("/document/generate-quiz", response_model=GenerateQuizFromDocumentResponse)
async def generate_quiz_from_document(
    request: GenerateQuizFromDocumentRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Génère un quiz directement depuis un document (PDF ou image)

    - **document_id**: ID du document source
    - **question_count**: Nombre de questions (5-20)
    - **question_types**: Types de questions (multiple_choice, true_false, short_answer)
    - **difficulty**: Difficulté (easy, medium, hard)
    - **language**: Langue pour l'OCR si nécessaire
    """
    # Vérifier et incrémenter le quota
    can_use, remaining = await check_and_increment_ai_quota(
        user_id=current_user.id,
        subscription_type=current_user.subscription_type,
        db=db,
        request_type="quiz"
    )
    if not can_use:
        max_requests = get_max_requests(current_user.subscription_type)
        raise_quota_exceeded_error(current_user.subscription_type, max_requests)

    # Récupérer le document
    result = await db.execute(
        select(Document).where(
            and_(
                Document.id == request.document_id,
                Document.user_id == current_user.id
            )
        )
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document non trouvé"
        )

    # Extraire le texte du document
    try:
        text_content = await extract_text_from_document(document, request.language)
        text_extracted = not document.is_text_extracted

        # Sauvegarder le texte extrait
        if not document.is_text_extracted and text_content:
            document.extracted_text = text_content
            document.is_text_extracted = True
            await db.commit()

    except Exception as e:
        logger.error(f"Erreur extraction texte document {document.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Impossible d'extraire le texte du document: {str(e)}"
        )

    if not text_content or len(text_content) < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le document doit contenir au moins 100 caractères de texte pour générer un quiz"
        )

    # Générer le quiz avec IA
    try:
        doc_title = document.title or document.original_filename
        quiz_data = await ai_service.generate_quiz_from_note(
            note_content=text_content,
            note_title=doc_title,
            question_count=request.question_count,
            question_types=request.question_types,
            difficulty=request.difficulty,
            lang=current_user.language
        )

        # Créer le quiz en base
        quiz = Quiz(
            title=f"Quiz - {doc_title}",
            description=f"Quiz généré automatiquement depuis le document '{doc_title}'",
            subject_id=document.subject_id,
            user_id=current_user.id,
            questions_data=quiz_data.get("questions", []),
            difficulty=request.difficulty,
            time_limit_minutes=request.question_count * 2,  # 2 min par question
            total_points=sum(q.get("points", 1) for q in quiz_data.get("questions", [])),
            is_ai_generated=True
        )
        db.add(quiz)
        await db.commit()
        await db.refresh(quiz)

        # XP bonus
        await award_xp(
            user=current_user,
            amount=15,
            reason="Génération IA quiz depuis document",
            event_type="ai_document_quiz_generated",
            db=db
        )

        logger.info(f"Quiz généré depuis document {document.id} pour utilisateur {current_user.id}")

        return {
            "quiz": {
                "id": quiz.id,
                "title": quiz.title,
                "description": quiz.description,
                "question_count": len(quiz_data.get("questions", [])),
                "difficulty": quiz.difficulty,
                "time_limit_minutes": quiz.time_limit_minutes,
                "total_points": quiz.total_points
            },
            "document_title": doc_title,
            "text_extracted": text_extracted,
            "ai_requests_remaining": remaining
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur génération quiz depuis document: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Une erreur est survenue lors de la génération du quiz."
        )
