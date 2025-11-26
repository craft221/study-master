from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import datetime, date
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User, SubscriptionType
from app.models.note import Note
from app.models.subject import Subject
from app.models.flashcard import Flashcard
from app.models.quiz import Quiz
from app.services.ai_service import ai_service

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

def check_ai_quota(user: User) -> tuple[bool, int]:
    """
    Vérifie si l'utilisateur peut faire une requête IA
    
    Returns:
        (can_use, remaining_requests)
    """
    # Quotas selon l'abonnement
    quotas = {
        SubscriptionType.FREE: 10,
        SubscriptionType.PREMIUM: 200,
        SubscriptionType.PREMIUM_PLUS: 500,
        SubscriptionType.INSTITUTIONAL: 1000
    }
    
    max_requests = quotas.get(user.subscription_type, 10)
    
    # Reset quotidien
    today = datetime.now().date()
    reset_date = user.ai_requests_reset_date.date() if user.ai_requests_reset_date else None
    
    if reset_date != today:
        user.ai_requests_today = 0
        user.ai_requests_reset_date = datetime.now()
    
    remaining = max_requests - user.ai_requests_today
    can_use = user.ai_requests_today < max_requests
    
    return can_use, remaining


async def increment_ai_usage(user: User, db: AsyncSession):
    """Incrémente le compteur d'utilisation IA"""
    user.ai_requests_today += 1
    user.total_ai_requests += 1
    await db.commit()


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
    # Vérifier le quota
    can_use, remaining = check_ai_quota(current_user)
    if not can_use:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Quota IA dépassé. Abonnement {current_user.subscription_type.value}: {remaining} requêtes restantes aujourd'hui."
        )
    
    # Récupérer la note
    result = await db.execute(
        select(Note).where(
            and_(
                Note.id == request.note_id,
                Note.author_id == current_user.id
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
            difficulty=request.difficulty
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
        
        current_user.total_flashcards_created += len(flashcards)
        current_user.total_xp += 10  # Bonus IA
        
        # Incrémenter usage IA
        await increment_ai_usage(current_user, db)
        
        await db.commit()
        
        return {
            "flashcards": flashcards,
            "count": len(flashcards),
            "note_title": note.title,
            "ai_requests_remaining": remaining - 1
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la génération: {str(e)}"
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
    # Vérifier le quota
    can_use, remaining = check_ai_quota(current_user)
    if not can_use:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Quota IA dépassé. {remaining} requêtes restantes aujourd'hui."
        )
    
    # Récupérer la note
    result = await db.execute(
        select(Note).where(
            and_(
                Note.id == request.note_id,
                Note.author_id == current_user.id
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
            difficulty=request.difficulty
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
        
        current_user.total_quizzes_created += 1
        current_user.total_xp += 15  # Bonus IA
        
        # Incrémenter usage IA
        await increment_ai_usage(current_user, db)
        
        await db.commit()
        await db.refresh(new_quiz)
        
        return {
            "quiz": {
                "id": new_quiz.id,
                "title": new_quiz.title,
                "description": new_quiz.description,
                "questions": new_quiz.questions,
                "total_points": new_quiz.total_points
            },
            "note_title": note.title,
            "ai_requests_remaining": remaining - 1
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la génération: {str(e)}"
        )


@router.post("/summarize-note", response_model=SummarizeNoteResponse)
async def summarize_note(
    request: SummarizeNoteRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Crée un résumé concis d'une note"""
    
    can_use, remaining = check_ai_quota(current_user)
    if not can_use:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Quota IA dépassé. {remaining} requêtes restantes."
        )
    
    result = await db.execute(
        select(Note).where(
            and_(
                Note.id == request.note_id,
                Note.author_id == current_user.id
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
            max_length=request.max_length
        )
        
        await increment_ai_usage(current_user, db)
        
        return {
            "summary": summary,
            "note_title": note.title,
            "word_count": len(summary.split()),
            "ai_requests_remaining": remaining - 1
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/extract-keywords", response_model=ExtractKeywordsResponse)
async def extract_keywords(
    request: ExtractKeywordsRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Extrait les mots-clés principaux d'une note"""
    
    can_use, remaining = check_ai_quota(current_user)
    if not can_use:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Quota IA dépassé."
        )
    
    result = await db.execute(
        select(Note).where(
            and_(
                Note.id == request.note_id,
                Note.author_id == current_user.id
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
            max_keywords=request.max_keywords
        )
        
        await increment_ai_usage(current_user, db)
        
        return {
            "keywords": keywords,
            "note_title": note.title,
            "ai_requests_remaining": remaining - 1
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/explain-concept", response_model=ExplainConceptResponse)
async def explain_concept(
    request: ExplainConceptRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Explique un concept de manière pédagogique"""
    
    can_use, remaining = check_ai_quota(current_user)
    if not can_use:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Quota IA dépassé."
        )
    
    try:
        explanation = await ai_service.explain_concept(
            concept=request.concept,
            context=request.context,
            level=request.level
        )
        
        await increment_ai_usage(current_user, db)
        
        return {
            "explanation": explanation,
            "concept": request.concept,
            "ai_requests_remaining": remaining - 1
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/quota")
async def get_ai_quota(
    current_user: User = Depends(get_current_active_user)
):
    """Récupère le quota IA de l'utilisateur"""
    
    can_use, remaining = check_ai_quota(current_user)
    
    quotas = {
        SubscriptionType.FREE: 10,
        SubscriptionType.PREMIUM: 200,
        SubscriptionType.PREMIUM_PLUS: 500,
        SubscriptionType.INSTITUTIONAL: 1000
    }
    
    max_requests = quotas.get(current_user.subscription_type, 10)
    
    return {
        "subscription_type": current_user.subscription_type.value,
        "max_requests_per_day": max_requests,
        "requests_used_today": current_user.ai_requests_today,
        "requests_remaining": remaining,
        "total_requests_all_time": current_user.total_ai_requests,
        "can_use": can_use
    }
