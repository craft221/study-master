"""
API Anti-Triche - Endpoints pour la surveillance des quiz et duels
"""

import logging
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.anti_cheat_service import anti_cheat_service, ViolationType, SeverityLevel

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================

class StartSessionRequest(BaseModel):
    quiz_id: int
    duel_id: Optional[int] = None


class StartSessionResponse(BaseModel):
    session_id: str
    message: str


class RecordAnswerRequest(BaseModel):
    session_id: str
    question_id: int
    answer_id: int
    time_taken_ms: int = Field(ge=0)
    question_index: int = Field(ge=0)


class RecordEventRequest(BaseModel):
    session_id: str
    event_type: str  # tab_switch, window_blur, copy_paste, etc.
    details: Optional[dict] = None


class ViolationResponse(BaseModel):
    type: str
    severity: str
    message: str


class ValidateQuizRequest(BaseModel):
    session_id: str
    total_questions: int
    score: float
    total_time_seconds: int


class ValidateQuizResponse(BaseModel):
    is_valid: bool
    violations_count: int
    penalty_xp: int
    is_disqualified: bool
    warning_message: Optional[str]
    adjusted_score: Optional[float]
    violations: List[ViolationResponse]


class UserReputationResponse(BaseModel):
    trust_score: int
    risk_level: str
    violation_count: int
    disqualification_count: int


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/session/start", response_model=StartSessionResponse)
async def start_anti_cheat_session(
    data: StartSessionRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Démarre une session de surveillance anti-triche pour un quiz.
    Doit être appelé avant de commencer un quiz ou un duel.
    """
    # Récupérer les infos du client
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    session_id = await anti_cheat_service.start_session(
        user_id=current_user.id,
        quiz_id=data.quiz_id,
        duel_id=data.duel_id,
        ip_address=ip_address,
        user_agent=user_agent
    )

    logger.info(f"Anti-cheat session started for user {current_user.id}, quiz {data.quiz_id}")

    return StartSessionResponse(
        session_id=session_id,
        message="Session de surveillance démarrée"
    )


@router.post("/answer", response_model=Optional[ViolationResponse])
async def record_answer(
    data: RecordAnswerRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Enregistre une réponse avec son timing pour analyse anti-triche.
    Retourne une violation si détectée (réponse trop rapide).
    """
    violation = await anti_cheat_service.record_answer(
        session_id=data.session_id,
        question_id=data.question_id,
        answer_id=data.answer_id,
        time_taken_ms=data.time_taken_ms,
        question_index=data.question_index
    )

    if violation:
        return ViolationResponse(
            type=violation.type.value,
            severity=violation.severity.value,
            message=_get_violation_message(violation.type)
        )

    return None


@router.post("/event", response_model=Optional[ViolationResponse])
async def record_event(
    data: RecordEventRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Enregistre un événement de surveillance (changement d'onglet, perte de focus, etc.)
    """
    violation = await anti_cheat_service.record_event(
        session_id=data.session_id,
        event_type=data.event_type,
        details=data.details
    )

    if violation:
        return ViolationResponse(
            type=violation.type.value,
            severity=violation.severity.value,
            message=_get_violation_message(violation.type)
        )

    return None


@router.post("/validate", response_model=ValidateQuizResponse)
async def validate_quiz_completion(
    data: ValidateQuizRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Valide la complétion d'un quiz et retourne les résultats anti-triche.
    Calcule les pénalités et ajuste le score si nécessaire.
    """
    result = await anti_cheat_service.validate_quiz_completion(
        session_id=data.session_id,
        total_questions=data.total_questions,
        score=data.score,
        total_time_seconds=data.total_time_seconds
    )

    # Ajouter à l'historique de l'utilisateur
    if result.violations:
        await anti_cheat_service.add_to_violation_history(
            user_id=current_user.id,
            violations=result.violations,
            penalty_xp=result.penalty_xp,
            was_disqualified=result.is_disqualified
        )

    # Appliquer les pénalités XP si nécessaire
    if result.penalty_xp > 0 and not result.is_disqualified:
        # Charger explicitement la gamification de l'utilisateur
        from app.models.user import UserGamification
        from sqlalchemy import select as sql_select

        gamification_result = await db.execute(
            sql_select(UserGamification).where(UserGamification.user_id == current_user.id)
        )
        gamification = gamification_result.scalar_one_or_none()

        if gamification:
            old_xp = gamification.total_xp or 0
            gamification.total_xp = max(0, old_xp - result.penalty_xp)
            await db.commit()
            logger.warning(f"Applied {result.penalty_xp} XP penalty to user {current_user.id}: {old_xp} -> {gamification.total_xp}")

    violations_response = [
        ViolationResponse(
            type=v.type.value,
            severity=v.severity.value,
            message=_get_violation_message(v.type)
        )
        for v in result.violations
    ]

    return ValidateQuizResponse(
        is_valid=result.is_valid,
        violations_count=len(result.violations),
        penalty_xp=result.penalty_xp,
        is_disqualified=result.is_disqualified,
        warning_message=result.warning_message,
        adjusted_score=result.adjusted_score,
        violations=violations_response
    )


@router.get("/reputation", response_model=UserReputationResponse)
async def get_my_reputation(
    current_user: User = Depends(get_current_user)
):
    """
    Récupère le score de confiance et la réputation anti-triche de l'utilisateur.
    """
    reputation = await anti_cheat_service.check_user_reputation(current_user.id)

    return UserReputationResponse(
        trust_score=reputation["trust_score"],
        risk_level=reputation["risk_level"],
        violation_count=reputation["violation_count"],
        disqualification_count=reputation["disqualification_count"]
    )


@router.get("/reputation/{user_id}", response_model=UserReputationResponse)
async def get_user_reputation(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupère la réputation anti-triche d'un utilisateur (pour les duels).
    """
    # Vérifier que l'utilisateur existe
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable"
        )

    reputation = await anti_cheat_service.check_user_reputation(user_id)

    return UserReputationResponse(
        trust_score=reputation["trust_score"],
        risk_level=reputation["risk_level"],
        violation_count=reputation["violation_count"],
        disqualification_count=reputation["disqualification_count"]
    )


# ============================================================================
# Helper Functions
# ============================================================================

def _get_violation_message(violation_type: ViolationType) -> str:
    """Retourne un message utilisateur pour chaque type de violation"""
    messages = {
        ViolationType.TOO_FAST_ANSWER: "Réponse enregistrée trop rapidement",
        ViolationType.TOO_FAST_QUIZ: "Quiz complété en un temps inhabituellement court",
        ViolationType.TIMEOUT_EXCEEDED: "Temps dépassé",
        ViolationType.TAB_SWITCH: "Changements d'onglet détectés",
        ViolationType.WINDOW_BLUR: "Pertes de focus de la fenêtre détectées",
        ViolationType.COPY_PASTE: "Tentative de copier-coller détectée",
        ViolationType.IDENTICAL_ANSWERS: "Réponses identiques à un autre joueur détectées",
        ViolationType.PERFECT_SCORE_SUSPICIOUS: "Score parfait avec timing suspect",
        ViolationType.ANSWER_PATTERN: "Pattern de réponse inhabituel détecté",
        ViolationType.MULTIPLE_SESSIONS: "Sessions multiples détectées",
        ViolationType.IP_CHANGE: "Changement d'adresse IP pendant le quiz",
        ViolationType.DEVICE_CHANGE: "Changement d'appareil pendant le quiz",
        ViolationType.DUEL_ABANDONMENT: "Abandon de duel",
        ViolationType.SCORE_MANIPULATION: "Tentative de manipulation de score"
    }
    return messages.get(violation_type, "Violation détectée")
