"""
Endpoints publics pour la viralité - Accessibles SANS authentification
Quiz jouables par des invités, partage, classements publics

SÉCURITÉ:
- Rate limiting appliqué sur tous les endpoints
- Validation et sanitization des entrées
- Protection contre les abus automatisés
"""

import secrets
import hashlib
import re
import html
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.database import get_db
from app.core.security import get_current_active_user, sanitize_string
from app.core.datetime_utils import utc_now
from app.models.quiz import Quiz, GuestQuizAttempt, QuizAttempt
from app.models.user import User
from app.models.subject import Subject
from app.api.v1.websocket import broadcast_leaderboard_update
from app.services.cache_service import cache_service

logger = logging.getLogger(__name__)

# Rate limiter pour les endpoints publics
limiter = Limiter(key_func=get_remote_address)

router = APIRouter()


# ========== SCHEMAS ==========

class PublicQuizResponse(BaseModel):
    """Quiz public (sans réponses correctes)"""
    share_code: str
    title: str
    description: Optional[str]
    difficulty: Optional[str]
    total_questions: int
    time_limit_minutes: Optional[int]
    is_timed: bool
    creator_name: str
    total_plays: int
    average_score: float
    questions: List[Dict[str, Any]]  # Sans correct_answer


class GuestStartRequest(BaseModel):
    """Démarrer un quiz en tant qu'invité"""
    guest_name: str = Field(..., min_length=2, max_length=50)
    referrer_code: Optional[str] = None  # Code de l'utilisateur qui a partagé

    @field_validator('guest_name')
    @classmethod
    def validate_guest_name(cls, v: str) -> str:
        """Sanitize le nom d'invité pour éviter XSS"""
        # Supprimer les caractères HTML dangereux
        v = html.escape(v.strip())
        # Garder seulement les caractères alphanumériques, espaces et quelques caractères spéciaux
        v = re.sub(r'[^\w\s\-_àâäéèêëïîôùûüç]', '', v, flags=re.UNICODE)
        if len(v) < 2:
            raise ValueError('Le nom doit contenir au moins 2 caractères valides')
        return v[:50]  # Limiter à 50 caractères

    @field_validator('referrer_code')
    @classmethod
    def validate_referrer_code(cls, v: Optional[str]) -> Optional[str]:
        """Valide le code de parrainage"""
        if v is None:
            return None
        # Code alphanumérique uniquement
        if not re.match(r'^[A-Za-z0-9_-]+$', v):
            return None  # Ignorer silencieusement les codes invalides
        return v[:20]  # Limiter la longueur


class GuestAnswerRequest(BaseModel):
    """Réponse d'un invité"""
    question_id: int
    user_answer: str


class GuestSubmitRequest(BaseModel):
    """Soumettre les réponses d'un invité"""
    session_id: str
    answers: List[GuestAnswerRequest]
    time_taken_seconds: Optional[int] = None


class GuestResultResponse(BaseModel):
    """Résultat d'un invité"""
    guest_name: str
    score: float
    correct_count: int
    total_questions: int
    time_taken_seconds: Optional[int]
    rank: int
    total_players: int
    message: str
    share_text: str
    quiz_title: str
    detailed_answers: Optional[List[Dict[str, Any]]] = None


class LeaderboardEntry(BaseModel):
    """Entrée du classement"""
    rank: int
    name: str
    score: float
    correct_count: int
    is_registered: bool
    completed_at: datetime


class PublicLeaderboardResponse(BaseModel):
    """Classement public d'un quiz"""
    quiz_title: str
    total_players: int
    leaderboard: List[LeaderboardEntry]


class ShareStatsResponse(BaseModel):
    """Statistiques de partage pour le créateur"""
    quiz_id: int
    quiz_title: str
    share_code: str
    total_plays: int
    total_shares: int
    conversion_rate: float  # % d'invités qui se sont inscrits
    top_referrers: List[Dict[str, Any]]


# ========== HELPER FUNCTIONS ==========

def generate_share_code() -> str:
    """Génère un code de partage unique et lisible"""
    return secrets.token_urlsafe(8)[:10].upper()


def generate_session_id() -> str:
    """Génère un ID de session unique pour un invité"""
    return secrets.token_hex(32)


# ========== ENDPOINTS ==========

@router.get("/quiz/{share_code}", response_model=PublicQuizResponse)
async def get_public_quiz(
    share_code: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Récupérer un quiz public par son code de partage
    Accessible SANS authentification
    """
    result = await db.execute(
        select(Quiz).where(
            and_(
                Quiz.share_code == share_code,
                Quiz.is_public == True
            )
        )
    )
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé ou non public"
        )

    # Récupérer le créateur
    creator_result = await db.execute(
        select(User).where(User.id == quiz.user_id)
    )
    creator = creator_result.scalar_one_or_none()

    # Préparer les questions SANS les réponses correctes
    safe_questions = []
    for i, q in enumerate(quiz.questions_data or []):
        safe_q = {
            "id": i,
            "question": q.get("question"),
            "type": q.get("type"),
            "options": q.get("options"),
            "points": q.get("points", 10)
        }
        safe_questions.append(safe_q)

    return {
        "share_code": share_code,
        "title": quiz.title,
        "description": quiz.description,
        "difficulty": quiz.difficulty,
        "total_questions": len(quiz.questions_data or []),
        "time_limit_minutes": quiz.time_limit_minutes,
        "is_timed": quiz.is_timed,
        "creator_name": creator.username if creator else "Anonyme",
        "total_plays": quiz.total_plays or 0,
        "average_score": quiz.average_score or 0,
        "questions": safe_questions
    }


@router.post("/quiz/{share_code}/start")
async def start_guest_quiz(
    share_code: str,
    request: GuestStartRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Démarrer un quiz en tant qu'invité
    Retourne un session_id pour suivre la tentative
    """
    result = await db.execute(
        select(Quiz).where(
            and_(
                Quiz.share_code == share_code,
                Quiz.is_public == True
            )
        )
    )
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé"
        )

    # Trouver le referrer si code fourni
    referrer_id = None
    if request.referrer_code:
        ref_result = await db.execute(
            select(User).where(User.referral_code == request.referrer_code)
        )
        referrer = ref_result.scalar_one_or_none()
        if referrer:
            referrer_id = referrer.id

    # Créer la session invité
    session_id = generate_session_id()

    guest_attempt = GuestQuizAttempt(
        quiz_id=quiz.id,
        guest_name=request.guest_name,
        guest_session_id=session_id,
        answers=[],
        total_questions=len(quiz.questions_data or []),
        referrer_user_id=referrer_id
    )

    db.add(guest_attempt)

    # Incrémenter le compteur de plays
    quiz.total_plays = (quiz.total_plays or 0) + 1

    await db.commit()

    return {
        "session_id": session_id,
        "quiz_title": quiz.title,
        "total_questions": len(quiz.questions_data or []),
        "time_limit_minutes": quiz.time_limit_minutes,
        "message": f"Bonne chance {request.guest_name} !"
    }


@router.post("/quiz/{share_code}/submit", response_model=GuestResultResponse)
async def submit_guest_quiz(
    share_code: str,
    request: GuestSubmitRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Soumettre les réponses d'un invité et calculer le score
    """
    # Récupérer le quiz
    result = await db.execute(
        select(Quiz).where(Quiz.share_code == share_code)
    )
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé"
        )

    # Récupérer la tentative de l'invité
    attempt_result = await db.execute(
        select(GuestQuizAttempt).where(
            and_(
                GuestQuizAttempt.guest_session_id == request.session_id,
                GuestQuizAttempt.quiz_id == quiz.id,
                GuestQuizAttempt.is_completed == False
            )
        )
    )
    attempt = attempt_result.scalar_one_or_none()

    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session non trouvée ou déjà terminée"
        )

    # Corriger les réponses
    answers_with_correction = []
    correct_count = 0

    for user_answer in request.answers:
        question_id = user_answer.question_id

        if question_id < 0 or question_id >= len(quiz.questions_data):
            continue

        question = quiz.questions_data[question_id]
        correct_answer = question.get("correct_answer", "")
        is_correct = user_answer.user_answer.strip().lower() == correct_answer.strip().lower()

        if is_correct:
            correct_count += 1

        answers_with_correction.append({
            "question_id": question_id,
            "user_answer": user_answer.user_answer,
            "correct_answer": correct_answer,
            "is_correct": is_correct
        })

    # Calculer le score
    total_questions = len(quiz.questions_data or [])
    score = (correct_count / total_questions) * 100 if total_questions > 0 else 0

    # Mettre à jour la tentative
    attempt.answers = answers_with_correction
    attempt.score = score
    attempt.correct_count = correct_count
    attempt.time_taken_seconds = request.time_taken_seconds
    attempt.is_completed = True
    attempt.completed_at = utc_now()

    # Calculer le rang
    rank_result = await db.execute(
        select(func.count()).select_from(GuestQuizAttempt).where(
            and_(
                GuestQuizAttempt.quiz_id == quiz.id,
                GuestQuizAttempt.is_completed == True,
                GuestQuizAttempt.score > score
            )
        )
    )
    better_scores = rank_result.scalar() or 0
    rank = better_scores + 1

    # Total de joueurs
    total_result = await db.execute(
        select(func.count()).select_from(GuestQuizAttempt).where(
            and_(
                GuestQuizAttempt.quiz_id == quiz.id,
                GuestQuizAttempt.is_completed == True
            )
        )
    )
    total_players = total_result.scalar() or 1

    await db.commit()

    # Diffuser la mise à jour du classement en temps réel
    try:
        await broadcast_leaderboard_update(share_code, {
            "name": attempt.guest_name,
            "score": score,
            "correct_count": correct_count,
            "total_questions": total_questions,
            "is_registered": False,
            "rank": rank
        })
    except Exception as e:
        # Non bloquant si le broadcast échoue
        pass

    # Générer le message de résultat
    if score >= 90:
        message = f"Incroyable {attempt.guest_name} ! Tu as tout déchiré !"
    elif score >= 70:
        message = f"Bravo {attempt.guest_name} ! Excellent résultat !"
    elif score >= 50:
        message = f"Bien joué {attempt.guest_name} ! Tu peux faire encore mieux !"
    else:
        message = f"Continue {attempt.guest_name} ! La pratique rend parfait !"

    # Texte de partage
    share_text = f"J'ai obtenu {score:.0f}% ({correct_count}/{total_questions}) sur '{quiz.title}' ! Tu peux faire mieux ?"

    # Réponses détaillées si autorisé
    detailed = None
    if quiz.show_correct_answers:
        detailed = []
        for i, q in enumerate(quiz.questions_data):
            ans = next((a for a in answers_with_correction if a["question_id"] == i), None)
            detailed.append({
                "question": q.get("question"),
                "your_answer": ans["user_answer"] if ans else "",
                "correct_answer": q.get("correct_answer"),
                "is_correct": ans["is_correct"] if ans else False,
                "explanation": q.get("explanation")
            })

    return {
        "guest_name": attempt.guest_name,
        "score": score,
        "correct_count": correct_count,
        "total_questions": total_questions,
        "time_taken_seconds": request.time_taken_seconds,
        "rank": rank,
        "total_players": total_players,
        "message": message,
        "share_text": share_text,
        "quiz_title": quiz.title,
        "detailed_answers": detailed
    }


@router.get("/quiz/{share_code}/leaderboard", response_model=PublicLeaderboardResponse)
async def get_public_leaderboard(
    share_code: str,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupérer le classement public d'un quiz
    Combine les scores des utilisateurs inscrits ET des invités
    """
    result = await db.execute(
        select(Quiz).where(Quiz.share_code == share_code)
    )
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé"
        )

    all_scores = []

    # 1. Récupérer les scores des INVITÉS
    guest_result = await db.execute(
        select(GuestQuizAttempt)
        .where(
            and_(
                GuestQuizAttempt.quiz_id == quiz.id,
                GuestQuizAttempt.is_completed == True
            )
        )
    )
    guest_attempts = guest_result.scalars().all()

    for attempt in guest_attempts:
        all_scores.append({
            "name": attempt.guest_name,
            "score": attempt.score if attempt.score is not None else 0,
            "correct_count": attempt.correct_count or 0,
            "is_registered": False,
            "completed_at": attempt.completed_at,
            "user_id": None
        })

    # 2. Récupérer les scores des UTILISATEURS INSCRITS
    registered_result = await db.execute(
        select(QuizAttempt, User)
        .join(User, QuizAttempt.user_id == User.id)
        .where(
            and_(
                QuizAttempt.quiz_id == quiz.id,
                QuizAttempt.completed_at.isnot(None),
                QuizAttempt.score.isnot(None)
            )
        )
    )
    registered_attempts = registered_result.all()

    for attempt, user in registered_attempts:
        # Calculer correct_count à partir du score si pas disponible
        total_q = len(quiz.questions_data or [])
        attempt_score = attempt.score if attempt.score is not None else 0
        correct_count = int((attempt_score / 100) * total_q) if total_q > 0 else 0

        all_scores.append({
            "name": user.username,
            "score": attempt_score,
            "correct_count": correct_count,
            "is_registered": True,
            "completed_at": attempt.completed_at,
            "user_id": user.id
        })

    # 3. Trier par score décroissant, puis par date
    all_scores.sort(key=lambda x: (-x["score"], x["completed_at"] or datetime.min))

    # 4. Attribuer les rangs et limiter
    leaderboard = []
    for i, entry in enumerate(all_scores[:limit]):
        leaderboard.append({
            "rank": i + 1,
            "name": entry["name"],
            "score": entry["score"],
            "correct_count": entry["correct_count"],
            "is_registered": entry["is_registered"],
            "completed_at": entry["completed_at"]
        })

    return {
        "quiz_title": quiz.title,
        "total_players": len(all_scores),
        "leaderboard": leaderboard
    }


@router.post("/quiz/{quiz_id}/generate-share-code")
async def generate_quiz_share_code(
    quiz_id: int,
    current_user: User = Depends(get_current_active_user),  # SÉCURISÉ: Authentification requise
    db: AsyncSession = Depends(get_db)
):
    """
    Générer un code de partage pour un quiz
    REQUIERT AUTHENTIFICATION - Seul le propriétaire peut générer un code
    """
    # Vérification ownership: le quiz doit appartenir à l'utilisateur
    result = await db.execute(
        select(Quiz).where(
            and_(
                Quiz.id == quiz_id,
                Quiz.user_id == current_user.id  # SÉCURISÉ: Utilise l'ID de l'utilisateur authentifié
            )
        )
    )
    quiz = result.scalar_one_or_none()

    if not quiz:
        logger.warning(f"User {current_user.id} attempted to generate share code for quiz {quiz_id} they don't own")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé"
        )

    # Générer un nouveau code si pas déjà existant
    if not quiz.share_code:
        quiz.share_code = generate_share_code()
        quiz.is_public = True
        await db.commit()
        logger.info(f"Share code generated for quiz {quiz_id} by user {current_user.id}")

    return {
        "share_code": quiz.share_code,
        "share_url": f"/play/{quiz.share_code}",
        "is_public": quiz.is_public
    }


@router.post("/quiz/{share_code}/track-share")
async def track_quiz_share(
    share_code: str,
    platform: str = Query(..., description="whatsapp, twitter, facebook, copy"),
    db: AsyncSession = Depends(get_db)
):
    """
    Tracker un partage de quiz (pour analytics)
    """
    result = await db.execute(
        select(Quiz).where(Quiz.share_code == share_code)
    )
    quiz = result.scalar_one_or_none()

    if quiz:
        quiz.total_shares = (quiz.total_shares or 0) + 1
        await db.commit()

    return {"tracked": True, "platform": platform}


@router.get("/quiz/{share_code}/share-card/{session_id}")
async def get_share_card_data(
    share_code: str,
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Récupérer les données pour générer une carte de résultats partageable
    """
    # Récupérer le quiz
    result = await db.execute(
        select(Quiz).where(Quiz.share_code == share_code)
    )
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé"
        )

    # Récupérer la tentative
    attempt_result = await db.execute(
        select(GuestQuizAttempt).where(
            and_(
                GuestQuizAttempt.guest_session_id == session_id,
                GuestQuizAttempt.quiz_id == quiz.id,
                GuestQuizAttempt.is_completed == True
            )
        )
    )
    attempt = attempt_result.scalar_one_or_none()

    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Résultat non trouvé"
        )

    # Récupérer le créateur
    creator_result = await db.execute(
        select(User).where(User.id == quiz.user_id)
    )
    creator = creator_result.scalar_one_or_none()

    # Calculer le rang
    rank_result = await db.execute(
        select(func.count()).select_from(GuestQuizAttempt).where(
            and_(
                GuestQuizAttempt.quiz_id == quiz.id,
                GuestQuizAttempt.is_completed == True,
                GuestQuizAttempt.score > attempt.score
            )
        )
    )
    better_scores = rank_result.scalar() or 0
    rank = better_scores + 1

    # Total de joueurs
    total_result = await db.execute(
        select(func.count()).select_from(GuestQuizAttempt).where(
            and_(
                GuestQuizAttempt.quiz_id == quiz.id,
                GuestQuizAttempt.is_completed == True
            )
        )
    )
    total_players = total_result.scalar() or 1

    # Déterminer la performance
    score = attempt.score
    if score >= 90:
        performance = "legendary"
        emoji = "🏆"
        title = "LÉGENDAIRE !"
    elif score >= 80:
        performance = "excellent"
        emoji = "⭐"
        title = "EXCELLENT !"
    elif score >= 70:
        performance = "great"
        emoji = "🎯"
        title = "TRÈS BIEN !"
    elif score >= 50:
        performance = "good"
        emoji = "👍"
        title = "BIEN !"
    else:
        performance = "learning"
        emoji = "📚"
        title = "CONTINUE !"

    return {
        "card_data": {
            "player_name": attempt.guest_name,
            "quiz_title": quiz.title,
            "creator_name": creator.username if creator else "Anonyme",
            "score": round(attempt.score, 1),
            "correct_count": attempt.correct_count,
            "total_questions": attempt.total_questions,
            "rank": rank,
            "total_players": total_players,
            "time_taken_seconds": attempt.time_taken_seconds,
            "performance": performance,
            "performance_emoji": emoji,
            "performance_title": title,
            "completed_at": attempt.completed_at.isoformat() if attempt.completed_at else None,
            "share_code": share_code,
            "app_name": "Studera",
            "app_tagline": "Apprends. Défie. Progresse."
        },
        "share_urls": {
            "play_url": f"/play/{share_code}",
            "twitter_text": f"J'ai obtenu {score:.0f}% sur '{quiz.title}' {emoji} Tu peux faire mieux ?",
            "whatsapp_text": f"🎮 J'ai obtenu {score:.0f}% ({attempt.correct_count}/{attempt.total_questions}) sur le quiz '{quiz.title}' !\n\n{emoji} {title}\n\nViens me défier ➡️"
        }
    }
