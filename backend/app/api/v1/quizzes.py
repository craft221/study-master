from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timezone
import random
import logging

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.subject import Subject
from app.models.quiz import Quiz, QuizAttempt, QuizDifficulty, QuizType
from app.services.xp_service import award_xp, broadcast_stat_update
from app.services.cache_service import cache_service, CacheTTL
from app.services.daily_quest_service import daily_quest_service
from app.models.daily_quest import QuestType
from app.models.gamification import Duel, DuelStatus

logger = logging.getLogger(__name__)


async def send_duel_notification(
    db: AsyncSession,
    user_id: int,
    notification_type: str,
    title: str,
    message: str,
    duel_id: int,
    data: dict = None
):
    """Envoie une notification de duel (helper local)"""
    try:
        from app.models.notification import Notification, NotificationType, NotificationPriority

        # Mapping des types
        type_map = {
            "challenge": NotificationType.DUEL_CHALLENGE,
            "accepted": NotificationType.DUEL_ACCEPTED,
            "declined": NotificationType.DUEL_DECLINED,
            "completed": NotificationType.DUEL_COMPLETED,
            "won": NotificationType.DUEL_WON,
            "lost": NotificationType.DUEL_LOST,
            "duel_won": NotificationType.DUEL_WON,
            "duel_lost": NotificationType.DUEL_LOST,
            "duel_draw": NotificationType.DUEL_COMPLETED,
        }

        notification = Notification(
            user_id=user_id,
            type=type_map.get(notification_type, NotificationType.DUEL_COMPLETED),
            title=title,
            message=message,
            priority=NotificationPriority.NORMAL,
            action_url=f"/duels/{duel_id}",
            data=str(data) if data else None
        )

        db.add(notification)
        logger.info(f"Notification duel envoyée: user={user_id}, type={notification_type}")

    except Exception as e:
        logger.warning(f"Erreur création notification duel: {e}")


async def invalidate_quiz_cache(user_id: int, quiz_id: int = None):
    """Invalide le cache des quizzes pour un utilisateur"""
    await cache_service.delete_pattern(f"cache:quiz:list:user={user_id}*")
    if quiz_id:
        await cache_service.delete_pattern(f"cache:quiz:detail:{quiz_id}*")
    logger.debug(f"Quiz cache invalidated for user {user_id}")


def normalize_correct_answer(correct_answer) -> str:
    """
    Convertit une réponse correcte en string.
    Gère les booléens (pour true/false) et autres types.
    """
    if isinstance(correct_answer, bool):
        return "Vrai" if correct_answer else "Faux"
    return str(correct_answer) if correct_answer is not None else ""


from app.schemas.quiz import (
    QuizCreate,
    QuizUpdate,
    QuizResponse,
    QuizListResponse,
    QuizSummaryResponse,
    QuizAttemptCreate,
    QuizAttemptSubmit,
    QuizAttemptResponse,
    QuizResultsResponse,
    QuizAttemptListResponse,
    QuizStatsResponse
)

router = APIRouter()


@router.post("/", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
async def create_quiz(
    quiz_data: QuizCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Créer un nouveau quiz"""
    
    # Vérifier que la matière existe et appartient à l'utilisateur
    result = await db.execute(
        select(Subject).where(
            and_(
                Subject.id == quiz_data.subject_id,
                Subject.user_id == current_user.id
            )
        )
    )
    subject = result.scalar_one_or_none()
    
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Matière non trouvée"
        )
    
    # Convertir les questions en format JSON (mode='json' pour sérialiser les enums)
    questions_json = [q.model_dump(mode='json') for q in quiz_data.questions]

    # Calculer le total de points
    total_points = sum(q.get("points", 10) for q in questions_json)

    # Créer le quiz avec timestamps explicites
    now = utc_now()

    # Utiliser la langue de l'utilisateur si non spécifiée
    quiz_language = quiz_data.language
    if not quiz_language:
        quiz_language = current_user.preferences.language if current_user.preferences else "fr"

    new_quiz = Quiz(
        user_id=current_user.id,
        subject_id=quiz_data.subject_id,
        source_note_id=quiz_data.source_note_id,
        title=quiz_data.title,
        description=quiz_data.description,
        quiz_type=quiz_data.quiz_type.value if quiz_data.quiz_type else None,
        difficulty=quiz_data.difficulty.value if quiz_data.difficulty else None,
        questions_data=questions_json,
        total_points=total_points,
        passing_score=quiz_data.passing_score,
        time_limit_minutes=quiz_data.time_limit_minutes,
        is_timed=quiz_data.is_timed,
        allow_multiple_attempts=quiz_data.allow_multiple_attempts,
        show_correct_answers=quiz_data.show_correct_answers,
        randomize_questions=quiz_data.randomize_questions,
        randomize_options=quiz_data.randomize_options,
        is_ai_generated=quiz_data.is_ai_generated,
        language=quiz_language,
        created_at=now,
        updated_at=now
    )
    
    db.add(new_quiz)

    # Mettre à jour les statistiques
    subject.total_quizzes_count += 1
    current_user.total_quizzes_created += 1

    await db.commit()

    # Invalider le cache
    await invalidate_quiz_cache(current_user.id)

    # Attribuer XP avec broadcast temps réel
    await award_xp(
        user=current_user,
        amount=15,
        reason="Quiz créé",
        event_type="quiz_completed",
        extra_data={"quiz_title": new_quiz.title},
        db=db
    )

    # Mettre à jour la quête EARN_XP (+15 XP pour création de quiz)
    await daily_quest_service.update_quest_progress(
        db=db,
        user_id=current_user.id,
        quest_type=QuestType.EARN_XP,
        progress=15
    )

    await db.refresh(new_quiz)

    # Construire la réponse manuellement pour éviter les problèmes de lazy loading
    return {
        "id": new_quiz.id,
        "user_id": new_quiz.user_id,
        "subject_id": new_quiz.subject_id,
        "source_note_id": new_quiz.source_note_id,
        "title": new_quiz.title,
        "description": new_quiz.description,
        "quiz_type": new_quiz.quiz_type,
        "difficulty": new_quiz.difficulty,
        "questions": new_quiz.questions_data or [],
        "total_points": new_quiz.total_points or 0,
        "passing_score": new_quiz.passing_score or 60,
        "time_limit_minutes": new_quiz.time_limit_minutes,
        "is_ai_generated": new_quiz.is_ai_generated or False,
        "ai_prompt_used": new_quiz.ai_prompt_used,
        "total_attempts": new_quiz.total_attempts or 0,
        "average_score": new_quiz.average_score or 0.0,
        "highest_score": new_quiz.highest_score or 0.0,
        "completion_rate": new_quiz.completion_rate or 0.0,
        "is_published": new_quiz.is_published or False,
        "is_timed": new_quiz.is_timed or False,
        "allow_multiple_attempts": new_quiz.allow_multiple_attempts if new_quiz.allow_multiple_attempts is not None else True,
        "show_correct_answers": new_quiz.show_correct_answers if new_quiz.show_correct_answers is not None else True,
        "randomize_questions": new_quiz.randomize_questions or False,
        "randomize_options": new_quiz.randomize_options or False,
        "created_at": new_quiz.created_at,
        "updated_at": new_quiz.updated_at,
        "published_at": new_quiz.published_at
    }


@router.get("/", response_model=List[QuizSummaryResponse])
async def list_quizzes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    subject_id: Optional[int] = None,
    quiz_type: Optional[QuizType] = None,
    difficulty: Optional[QuizDifficulty] = None,
    is_published: Optional[bool] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer la liste des quizzes avec filtres (avec cache 2min)"""

    # Cache key
    cache_key = f"cache:quiz:list:user={current_user.id}:page={page}:subject={subject_id}:type={quiz_type}:diff={difficulty}"

    # Vérifier le cache
    cached = await cache_service.get(cache_key)
    if cached:
        logger.debug(f"Cache HIT: quizzes list user {current_user.id}")
        return cached

    logger.debug(f"Cache MISS: quizzes list user {current_user.id}")

    # Utiliser selectinload pour charger les relations en une seule requête
    query = select(Quiz).where(Quiz.user_id == current_user.id).options(
        selectinload(Quiz.subject),
        selectinload(Quiz.attempts)
    )

    # Appliquer les filtres
    if subject_id:
        query = query.where(Quiz.subject_id == subject_id)
    if quiz_type:
        query = query.where(Quiz.quiz_type == quiz_type)
    if difficulty:
        query = query.where(Quiz.difficulty == difficulty)
    if is_published is not None:
        query = query.where(Quiz.is_published == is_published)

    # Pagination et tri
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(Quiz.created_at.desc())

    result = await db.execute(query)
    quizzes = result.scalars().all()

    # Construire la réponse avec les infos complètes (plus de N+1 queries!)
    response_data = []
    for quiz in quizzes:
        # Subject est déjà chargé via selectinload
        subject = quiz.subject

        # Attempts sont déjà chargés via selectinload
        # Utiliser datetime.min avec timezone UTC pour éviter l'erreur de comparaison
        min_datetime = datetime.min.replace(tzinfo=timezone.utc)
        attempts = sorted(quiz.attempts, key=lambda a: a.completed_at or min_datetime, reverse=True)

        # Calculer le meilleur score
        best_score = max((a.score for a in attempts if a.completed_at is not None), default=None)

        response_data.append({
            "id": quiz.id,
            "title": quiz.title,
            "description": quiz.description,
            "subject": {
                "id": subject.id,
                "name": subject.name,
                "color": subject.color
            } if subject else None,
            "total_questions": len(quiz.questions_data) if quiz.questions_data else 0,
            "time_limit_minutes": quiz.time_limit_minutes,
            "attempts": [
                {
                    "id": a.id,
                    "score": a.score,
                    "is_completed": a.completed_at is not None and a.score > 0,
                    "created_at": a.completed_at.isoformat() if a.completed_at else None
                }
                for a in attempts
            ],
            "best_score": best_score,
            "created_at": quiz.created_at,
            # Champs viraux
            "share_code": quiz.share_code,
            "is_public": quiz.is_public or False,
            "total_plays": quiz.total_plays or 0
        })

    # Mettre en cache (2 minutes)
    await cache_service.set(cache_key, response_data, ttl=CacheTTL.SHORT)

    return response_data


@router.get("/{quiz_id}", response_model=QuizResponse)
async def get_quiz(
    quiz_id: int,
    duel_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les détails d'un quiz (avec cache 5min)

    Accessible si:
    - L'utilisateur est le propriétaire du quiz
    - Le quiz est public (is_public = True)
    - L'utilisateur participe à un duel utilisant ce quiz
    """

    # Cache key
    cache_key = f"cache:quiz:detail:{quiz_id}:user={current_user.id}"

    # Vérifier le cache
    cached = await cache_service.get(cache_key)
    if cached:
        return cached

    # Récupérer le quiz
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé"
        )

    # Vérifier les permissions d'accès
    has_access = False

    # 1. Propriétaire du quiz
    if quiz.user_id == current_user.id:
        has_access = True

    # 2. Quiz public
    elif quiz.is_public:
        has_access = True

    # 3. Participant à un duel avec ce quiz
    else:
        # Duel is already imported at module level from app.models.gamification
        duel_query = select(Duel).where(
            and_(
                Duel.quiz_id == quiz_id,
                or_(
                    Duel.challenger_id == current_user.id,
                    Duel.opponent_id == current_user.id
                )
            )
        ).limit(1)
        duel_result = await db.execute(duel_query)
        if duel_result.scalar():
            has_access = True

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé"
        )

    # Transformer les questions au format attendu par le frontend
    questions_transformed = []
    for idx, q in enumerate(quiz.questions_data or []):
        question_type = q.get("type", "multiple_choice")
        # Pour les questions vrai/faux, générer les options si absentes
        options = q.get("options", [])
        if question_type == "true_false" and not options:
            options = ["Vrai", "Faux"]

        questions_transformed.append({
            "id": str(idx),  # Utiliser l'index comme ID
            "question_text": q.get("question", ""),  # question -> question_text
            "question_type": question_type,  # type -> question_type
            "options": options,
            "correct_answer": normalize_correct_answer(q.get("correct_answer")),
            "explanation": q.get("explanation", ""),
            "points": q.get("points", 10)
        })

    # Sérialiser et mettre en cache
    quiz_data = {
        "id": quiz.id,
        "user_id": quiz.user_id,
        "subject_id": quiz.subject_id,
        "source_note_id": quiz.source_note_id,
        "title": quiz.title,
        "description": quiz.description,
        "quiz_type": quiz.quiz_type,
        "difficulty": quiz.difficulty,
        "questions": questions_transformed,
        "total_points": quiz.total_points or 0,
        "passing_score": quiz.passing_score or 60,
        "time_limit_minutes": quiz.time_limit_minutes,
        "is_ai_generated": quiz.is_ai_generated or False,
        "ai_prompt_used": quiz.ai_prompt_used,
        "total_attempts": quiz.total_attempts or 0,
        "average_score": quiz.average_score or 0.0,
        "highest_score": quiz.highest_score or 0.0,
        "completion_rate": quiz.completion_rate or 0.0,
        "is_published": quiz.is_published or False,
        "is_timed": quiz.is_timed or False,
        "allow_multiple_attempts": quiz.allow_multiple_attempts if quiz.allow_multiple_attempts is not None else True,
        "show_correct_answers": quiz.show_correct_answers if quiz.show_correct_answers is not None else True,
        "randomize_questions": quiz.randomize_questions or False,
        "randomize_options": quiz.randomize_options or False,
        "created_at": quiz.created_at.isoformat() if quiz.created_at else None,
        "updated_at": quiz.updated_at.isoformat() if quiz.updated_at else None,
        "published_at": quiz.published_at.isoformat() if quiz.published_at else None
    }

    await cache_service.set(cache_key, quiz_data, ttl=CacheTTL.SHORT)

    return quiz_data


@router.post("/{quiz_id}/attempt", status_code=status.HTTP_201_CREATED)
async def start_quiz_attempt(
    quiz_id: int,
    duel_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Commencer une tentative de quiz

    Accessible si:
    - L'utilisateur est le propriétaire du quiz
    - Le quiz est publié (is_published = True)
    - Le quiz est public (is_public = True)
    - L'utilisateur participe à un duel utilisant ce quiz
    """

    # Récupérer le quiz
    result = await db.execute(
        select(Quiz).where(Quiz.id == quiz_id)
    )
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé"
        )

    # Vérifier les permissions d'accès
    has_access = False

    # 1. Propriétaire du quiz
    if quiz.user_id == current_user.id:
        has_access = True

    # 2. Quiz publié
    elif quiz.is_published:
        has_access = True

    # 3. Quiz public
    elif quiz.is_public:
        has_access = True

    # 4. Participant à un duel avec ce quiz
    else:
        # Duel is already imported at module level from app.models.gamification
        duel_query = select(Duel).where(
            and_(
                Duel.quiz_id == quiz_id,
                or_(
                    Duel.challenger_id == current_user.id,
                    Duel.opponent_id == current_user.id
                )
            )
        ).limit(1)
        duel_result = await db.execute(duel_query)
        if duel_result.scalar():
            has_access = True

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce quiz n'est pas accessible"
        )

    # === VÉRIFICATION SPÉCIALE POUR LES DUELS ===
    # Vérifier si ce quiz fait partie d'un duel actif où l'utilisateur est participant
    # On prend le duel le plus récent pour éviter les conflits avec les duels complétés
    duel_check_query = select(Duel).where(
        and_(
            Duel.quiz_id == quiz_id,
            Duel.status.in_([DuelStatus.ACCEPTED, DuelStatus.IN_PROGRESS]),
            or_(
                Duel.challenger_id == current_user.id,
                Duel.opponent_id == current_user.id
            )
        )
    ).order_by(Duel.created_at.desc()).limit(1)
    duel_check_result = await db.execute(duel_check_query)
    duel_for_quiz = duel_check_result.scalar()

    if duel_for_quiz:
        # Vérifier si l'utilisateur a déjà complété sa partie du duel
        is_challenger = duel_for_quiz.challenger_id == current_user.id
        user_score = duel_for_quiz.challenger_score if is_challenger else duel_for_quiz.opponent_score

        if user_score is not None:
            # Message différent selon le statut du duel
            if duel_for_quiz.status == DuelStatus.COMPLETED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ce duel est terminé. Vous ne pouvez plus rejouer ce quiz dans le cadre de ce duel."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Vous avez déjà complété votre partie de ce duel. Attendez que votre adversaire termine."
                )

    # Vérifier si plusieurs tentatives sont autorisées (pour les quiz normaux)
    if not quiz.allow_multiple_attempts:
        result = await db.execute(
            select(QuizAttempt).where(
                and_(
                    QuizAttempt.quiz_id == quiz_id,
                    QuizAttempt.user_id == current_user.id,
                    QuizAttempt.completed_at.isnot(None)
                )
            )
        )
        existing_attempt = result.scalar_one_or_none()

        if existing_attempt:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vous avez déjà complété ce quiz. Les tentatives multiples ne sont pas autorisées."
            )

    # Compter les tentatives précédentes
    result = await db.execute(
        select(func.count()).select_from(QuizAttempt).where(
            and_(
                QuizAttempt.quiz_id == quiz_id,
                QuizAttempt.user_id == current_user.id
            )
        )
    )
    attempt_count = result.scalar()

    # Créer une nouvelle tentative avec les valeurs par défaut pour un nouvel attempt
    new_attempt = QuizAttempt(
        user_id=current_user.id,
        quiz_id=quiz_id,
        answers=[],
        score=0.0,
        time_taken=None,
        completed_at=None
    )

    db.add(new_attempt)
    await db.commit()
    await db.refresh(new_attempt)

    # Retourner une réponse simplifiée compatible avec le frontend
    return {
        "id": new_attempt.id,
        "user_id": new_attempt.user_id,
        "quiz_id": new_attempt.quiz_id,
        "attempt_number": attempt_count + 1,
        "answers": new_attempt.answers or [],
        "score": 0.0,
        "points_earned": 0,
        "points_possible": quiz.total_points or 0,
        "is_passed": False,
        "time_started": utc_now().isoformat(),
        "time_completed": None,
        "total_time_seconds": None,
        "is_completed": False,
        "is_abandoned": False,
        "ai_feedback": None,
        "strengths": None,
        "weaknesses": None,
        "recommendations": None,
        "created_at": new_attempt.completed_at.isoformat() if new_attempt.completed_at else utc_now().isoformat(),
        "updated_at": utc_now().isoformat()
    }


@router.put("/attempt/{attempt_id}")
async def submit_quiz_attempt(
    attempt_id: int,
    submission: QuizAttemptSubmit,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Soumettre les réponses d'un quiz et calculer le score"""

    # Récupérer la tentative
    result = await db.execute(
        select(QuizAttempt).where(
            and_(
                QuizAttempt.id == attempt_id,
                QuizAttempt.user_id == current_user.id
            )
        )
    )
    attempt = result.scalar_one_or_none()

    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tentative de quiz non trouvée"
        )

    # Vérifier si déjà complété (utiliser completed_at comme indicateur)
    if attempt.completed_at is not None and attempt.score > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette tentative a déjà été soumise"
        )

    # Récupérer le quiz
    result = await db.execute(
        select(Quiz).where(Quiz.id == attempt.quiz_id)
    )
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé"
        )

    # Vérifier si ce quiz fait partie d'un duel actif pour cet utilisateur
    is_duel_quiz = False
    duel_check_query = select(Duel).where(
        and_(
            Duel.quiz_id == quiz.id,
            Duel.status.in_([DuelStatus.ACCEPTED, DuelStatus.IN_PROGRESS]),
            or_(
                Duel.challenger_id == current_user.id,
                Duel.opponent_id == current_user.id
            )
        )
    ).limit(1)
    duel_check_result = await db.execute(duel_check_query)
    if duel_check_result.scalar():
        is_duel_quiz = True
        logger.info(f"Quiz {quiz.id} is part of a duel - skipping regular XP rewards")

    # SÉCURITÉ: Validation stricte des réponses soumises
    total_questions = len(quiz.questions_data)

    # Vérifier le nombre de réponses
    if len(submission.answers) != total_questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vous devez répondre à toutes les questions ({total_questions} questions)"
        )

    # Extraire et valider tous les question_id AVANT le traitement
    submitted_question_ids = set()
    for user_answer in submission.answers:
        question_id = user_answer.question_id

        # Vérifier que question_id est un entier valide
        if not isinstance(question_id, int) or question_id != int(question_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"question_id doit être un entier: {question_id}"
            )

        # Vérifier les bounds
        if question_id < 0 or question_id >= total_questions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"question_id {question_id} invalide (doit être entre 0 et {total_questions - 1})"
            )

        # Vérifier les doublons (CRITIQUE: empêche la manipulation de score)
        if question_id in submitted_question_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"question_id {question_id} en double - chaque question ne peut être répondue qu'une fois"
            )
        submitted_question_ids.add(question_id)

    # Vérifier que TOUTES les questions sont couvertes
    expected_ids = set(range(total_questions))
    if submitted_question_ids != expected_ids:
        missing = expected_ids - submitted_question_ids
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Questions manquantes: {sorted(missing)}"
        )

    # Corriger les réponses (maintenant que la validation est passée)
    answers_with_correction = []
    points_earned = 0
    correct_count = 0
    total_time_seconds = 0

    for user_answer in submission.answers:
        question_id = user_answer.question_id
        question = quiz.questions_data[question_id]
        correct_answer_raw = question["correct_answer"]

        # Convertir la réponse correcte en string (peut être booléen pour true/false)
        if isinstance(correct_answer_raw, bool):
            correct_answer = "vrai" if correct_answer_raw else "faux"
        else:
            correct_answer = str(correct_answer_raw)

        # Normaliser la réponse de l'utilisateur pour true/false
        user_answer_normalized = user_answer.user_answer.strip().lower()
        # Mapper les variations communes de vrai/faux
        if user_answer_normalized in ("true", "vrai", "yes", "oui"):
            user_answer_normalized = "vrai"
        elif user_answer_normalized in ("false", "faux", "no", "non"):
            user_answer_normalized = "faux"

        is_correct = user_answer_normalized == correct_answer.strip().lower()

        points_for_question = question.get("points", 10) if is_correct else 0
        points_earned += points_for_question

        if is_correct:
            correct_count += 1

        # Accumuler le temps passé par question
        if user_answer.time_spent_seconds:
            total_time_seconds += user_answer.time_spent_seconds

        answers_with_correction.append({
            "question_id": question_id,
            "user_answer": user_answer.user_answer,
            "correct_answer": correct_answer,  # Toujours string maintenant
            "is_correct": is_correct,
            "points_earned": points_for_question,
            "time_spent_seconds": user_answer.time_spent_seconds
        })

    # Calculer le score en pourcentage
    # Si total_points est None, le calculer à partir des questions
    total_points = quiz.total_points
    if total_points is None or total_points == 0:
        total_points = sum(q.get("points", 10) for q in quiz.questions_data) if quiz.questions_data else 0

    score = round((points_earned / total_points) * 100, 1) if total_points > 0 else 0
    passing_score = quiz.passing_score if quiz.passing_score is not None else 60
    is_passed = score >= passing_score

    # Mettre à jour la tentative avec les champs qui existent dans le modèle
    attempt.answers = answers_with_correction
    attempt.score = score
    attempt.time_taken = total_time_seconds if total_time_seconds > 0 else submission.total_time_seconds
    attempt.completed_at = utc_now()

    # Analyse simple des forces/faiblesses (pour la réponse uniquement, pas stocké)
    strengths = []
    weaknesses = []
    recommendations = []

    if correct_count == len(quiz.questions_data):
        strengths.append("Parfait ! Toutes les réponses correctes")
    elif score >= 80:
        strengths.append("Excellente maîtrise du sujet")
    elif score >= 60:
        strengths.append("Bonne compréhension générale")

    if score < 60:
        weaknesses.append("Revoir les concepts de base")

    if correct_count < len(quiz.questions_data):
        recommendations.append(f"Réviser les {len(quiz.questions_data) - correct_count} questions incorrectes")

    # Mettre à jour les stats du quiz
    quiz.total_attempts = (quiz.total_attempts or 0) + 1
    if quiz.average_score == 0 or quiz.average_score is None:
        quiz.average_score = score
    else:
        quiz.average_score = (quiz.average_score * (quiz.total_attempts - 1) + score) / quiz.total_attempts

    if score > (quiz.highest_score or 0):
        quiz.highest_score = score

    quiz.completion_rate = 100.0  # Simplifié pour le MVP

    # Calculer XP - SEULEMENT si ce n'est PAS un quiz de duel
    xp_earned = 0
    if not is_duel_quiz:
        xp_earned = 20  # Base
        if is_passed:
            xp_earned += 10
        if score >= 90:
            xp_earned += 20  # Bonus excellence
    else:
        logger.info(f"Skipping regular XP for duel quiz {quiz.id} - XP will come from duel result")

    # Mettre à jour les stats de l'utilisateur si disponibles
    if current_user.stats:
        current_user.stats.total_quizzes_taken = (current_user.stats.total_quizzes_taken or 0) + 1

    # Mettre à jour la progression des quêtes quotidiennes (compte pour les duels aussi)
    await daily_quest_service.update_quest_progress(
        db=db,
        user_id=current_user.id,
        quest_type=QuestType.COMPLETE_QUIZ,
        progress=1
    )

    # Si score parfait (100%), mettre à jour aussi la quête PERFECT_QUIZ
    if score == 100:
        await daily_quest_service.update_quest_progress(
            db=db,
            user_id=current_user.id,
            quest_type=QuestType.PERFECT_QUIZ,
            progress=1
        )

    # Mettre à jour la quête EARN_XP avec les XP gagnés du quiz
    if xp_earned > 0:
        await daily_quest_service.update_quest_progress(
            db=db,
            user_id=current_user.id,
            quest_type=QuestType.EARN_XP,
            progress=xp_earned
        )

    # Mettre à jour la quête MAINTAIN_STREAK (garder le streak actif)
    await daily_quest_service.update_quest_progress(
        db=db,
        user_id=current_user.id,
        quest_type=QuestType.MAINTAIN_STREAK,
        progress=1
    )

    await db.commit()

    # Invalider le cache des quizzes et des stats utilisateur après soumission
    await invalidate_quiz_cache(current_user.id, quiz.id)
    # Invalider aussi le cache des stats utilisateur pour mettre à jour le score moyen
    await cache_service.delete_pattern(f"cache:user_stats:user:{current_user.id}*")

    # Attribuer XP avec broadcast temps réel - SEULEMENT si pas un duel
    if xp_earned > 0:
        await award_xp(
            user=current_user,
            amount=xp_earned,
            reason=f"Quiz terminé: {score:.0f}%",
            event_type="quiz_completed",
            extra_data={
                "quiz_title": quiz.title,
                "score": score,
                "is_passed": is_passed
            },
            db=db
        )
    await db.refresh(attempt)

    # Préparer la réponse détaillée
    detailed_answers = []
    if quiz.show_correct_answers:
        for i, q in enumerate(quiz.questions_data):
            answer_data = next((a for a in answers_with_correction if a["question_id"] == i), None)
            detailed_answers.append({
                "question": q.get("question", ""),
                "type": q.get("type", "multiple_choice"),
                "user_answer": answer_data["user_answer"] if answer_data else "",
                "correct_answer": normalize_correct_answer(q["correct_answer"]),
                "is_correct": answer_data["is_correct"] if answer_data else False,
                "explanation": q.get("explanation"),
                "points_earned": answer_data["points_earned"] if answer_data else 0
            })

    performance_summary = {
        "total_questions": len(quiz.questions_data),
        "correct_answers": correct_count,
        "incorrect_answers": len(quiz.questions_data) - correct_count,
        "accuracy": (correct_count / len(quiz.questions_data)) * 100 if len(quiz.questions_data) > 0 else 0,
        "time_taken": attempt.time_taken or total_time_seconds,
        "status": "Réussi" if is_passed else "Échoué"
    }

    # Construire manuellement la réponse attempt pour éviter les problèmes de sérialisation
    attempt_response = {
        "id": attempt.id,
        "quiz_id": attempt.quiz_id,
        "user_id": attempt.user_id,
        "answers": attempt.answers,
        "score": attempt.score,
        "points_earned": points_earned,
        "points_possible": quiz.total_points or 0,
        "is_passed": is_passed,
        "is_completed": True,
        "time_taken": attempt.time_taken,
        "completed_at": attempt.completed_at.isoformat() if attempt.completed_at else None,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "recommendations": recommendations
    }

    # === AUTO-COMPLETION DU DUEL ===
    # Vérifier si ce quiz fait partie d'un duel actif et auto-compléter si les deux joueurs ont fini
    try:
        duel_query = select(Duel).where(
            and_(
                Duel.quiz_id == quiz.id,
                Duel.status.in_([DuelStatus.ACCEPTED, DuelStatus.IN_PROGRESS]),
                or_(
                    Duel.challenger_id == current_user.id,
                    Duel.opponent_id == current_user.id
                )
            )
        ).order_by(Duel.created_at.desc()).limit(1)
        duel_result = await db.execute(duel_query)
        duel = duel_result.scalar()

        if duel:
            # IMPORTANT: Seules les tentatives APRÈS le début du duel comptent
            # Cela empêche d'utiliser des scores d'anciennes tentatives
            duel_start_time = duel.started_at
            if not duel_start_time:
                # Si started_at n'est pas défini, utiliser created_at comme fallback
                duel_start_time = duel.created_at

            # Vérifier si les deux joueurs ont complété leur quiz APRÈS le début du duel
            challenger_attempt_query = select(QuizAttempt).where(
                and_(
                    QuizAttempt.quiz_id == duel.quiz_id,
                    QuizAttempt.user_id == duel.challenger_id,
                    QuizAttempt.completed_at.isnot(None),
                    QuizAttempt.time_started >= duel_start_time  # Tentative après début du duel
                )
            ).order_by(QuizAttempt.completed_at.desc()).limit(1)

            opponent_attempt_query = select(QuizAttempt).where(
                and_(
                    QuizAttempt.quiz_id == duel.quiz_id,
                    QuizAttempt.user_id == duel.opponent_id,
                    QuizAttempt.completed_at.isnot(None),
                    QuizAttempt.time_started >= duel_start_time  # Tentative après début du duel
                )
            ).order_by(QuizAttempt.completed_at.desc()).limit(1)

            challenger_result = await db.execute(challenger_attempt_query)
            opponent_result = await db.execute(opponent_attempt_query)

            challenger_attempt = challenger_result.scalar_one_or_none()
            opponent_attempt = opponent_result.scalar_one_or_none()

            # Si les deux ont terminé, auto-compléter le duel
            if challenger_attempt and opponent_attempt:
                logger.info(f"Auto-completing duel {duel.id}: both players have finished")

                # Récupérer les scores
                duel.challenger_score = int(challenger_attempt.score)
                duel.opponent_score = int(opponent_attempt.score)

                # Déterminer le gagnant - charger avec gamification
                challenger_query = select(User).options(
                    selectinload(User.gamification)
                ).where(User.id == duel.challenger_id)
                opponent_query = select(User).options(
                    selectinload(User.gamification)
                ).where(User.id == duel.opponent_id)

                challenger_res = await db.execute(challenger_query)
                opponent_res = await db.execute(opponent_query)
                challenger = challenger_res.scalar_one_or_none()
                opponent = opponent_res.scalar_one_or_none()

                winner = None
                loser = None

                if duel.challenger_score > duel.opponent_score:
                    duel.winner_id = duel.challenger_id
                    winner = challenger
                    loser = opponent
                elif duel.opponent_score > duel.challenger_score:
                    duel.winner_id = duel.opponent_id
                    winner = opponent
                    loser = challenger
                else:
                    # Égalité
                    duel.winner_id = None

                # Transfert XP
                if winner and loser:
                    # Gagnant gagne l'enjeu complet
                    if winner.gamification:
                        winner.gamification.total_xp += duel.stakes_xp
                        winner.gamification.level = (winner.gamification.total_xp // 100) + 1

                    # Perdant perd la moitié de l'enjeu
                    xp_loss = duel.stakes_xp // 2
                    if loser.gamification:
                        loser.gamification.total_xp = max(0, loser.gamification.total_xp - xp_loss)
                        loser.gamification.level = (loser.gamification.total_xp // 100) + 1

                    logger.info(f"Duel {duel.id} auto-completed: {winner.username} wins +{duel.stakes_xp}XP, {loser.username} loses -{xp_loss}XP")

                    # Notifications
                    await send_duel_notification(
                        db=db,
                        user_id=winner.id,
                        notification_type="duel_won",
                        title="Victoire ! 🏆",
                        message=f"Vous avez gagné le duel contre {loser.username} ! +{duel.stakes_xp} XP",
                        duel_id=duel.id,
                        data={"xp_gained": duel.stakes_xp}
                    )
                    await send_duel_notification(
                        db=db,
                        user_id=loser.id,
                        notification_type="duel_lost",
                        title="Défaite",
                        message=f"Vous avez perdu le duel contre {winner.username}. -{xp_loss} XP",
                        duel_id=duel.id,
                        data={"xp_lost": xp_loss}
                    )
                else:
                    # Égalité
                    logger.info(f"Duel {duel.id} auto-completed: draw between {challenger.username} and {opponent.username}")
                    for user in [challenger, opponent]:
                        await send_duel_notification(
                            db=db,
                            user_id=user.id,
                            notification_type="duel_draw",
                            title="Égalité ! 🤝",
                            message="Match nul ! Aucun XP échangé.",
                            duel_id=duel.id
                        )

                duel.status = DuelStatus.COMPLETED
                duel.ended_at = utc_now()
                await db.commit()

    except Exception as e:
        logger.error(f"Error auto-completing duel: {e}")
        # Ne pas faire échouer la soumission du quiz si l'auto-completion échoue

    return {
        "attempt": attempt_response,
        "score": attempt.score,  # Score au niveau racine pour le frontend
        "quiz_title": quiz.title,
        "passing_score": quiz.passing_score,
        "show_correct_answers": quiz.show_correct_answers,
        "detailed_answers": detailed_answers,
        "performance_summary": performance_summary,
        "xp_earned": xp_earned
    }


@router.get("/attempt/{attempt_id}/results")
async def get_quiz_results(
    attempt_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les résultats détaillés d'une tentative de quiz"""

    # Récupérer la tentative
    result = await db.execute(
        select(QuizAttempt).where(
            and_(
                QuizAttempt.id == attempt_id,
                QuizAttempt.user_id == current_user.id
            )
        )
    )
    attempt = result.scalar_one_or_none()

    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tentative de quiz non trouvée"
        )

    # Vérifier si complété (utiliser completed_at et score > 0)
    is_completed = attempt.completed_at is not None and attempt.score > 0
    if not is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette tentative n'est pas encore terminée"
        )

    # Récupérer le quiz
    result = await db.execute(
        select(Quiz).where(Quiz.id == attempt.quiz_id)
    )
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé"
        )

    # Préparer les réponses détaillées
    detailed_answers = []
    correct_count = sum(1 for a in (attempt.answers or []) if a.get("is_correct", False))
    passing_score = quiz.passing_score if quiz.passing_score is not None else 60
    is_passed = (attempt.score or 0) >= passing_score

    if quiz.show_correct_answers:
        for i, q in enumerate(quiz.questions_data or []):
            answer_data = next((a for a in (attempt.answers or []) if a.get("question_id") == i), None)
            detailed_answers.append({
                "question": q.get("question", ""),
                "type": q.get("type", "multiple_choice"),
                "user_answer": answer_data["user_answer"] if answer_data else "",
                "correct_answer": normalize_correct_answer(q.get("correct_answer")),
                "is_correct": answer_data["is_correct"] if answer_data else False,
                "explanation": q.get("explanation"),
                "points_earned": answer_data.get("points_earned", 0) if answer_data else 0
            })

    performance_summary = {
        "total_questions": len(quiz.questions_data or []),
        "correct_answers": correct_count,
        "incorrect_answers": len(quiz.questions_data or []) - correct_count,
        "accuracy": (correct_count / len(quiz.questions_data)) * 100 if quiz.questions_data and len(quiz.questions_data) > 0 else 0,
        "time_taken": attempt.time_taken,
        "status": "Réussi" if is_passed else "Échoué"
    }

    # Construire manuellement la réponse attempt
    attempt_response = {
        "id": attempt.id,
        "quiz_id": attempt.quiz_id,
        "user_id": attempt.user_id,
        "answers": attempt.answers,
        "score": attempt.score,
        "is_passed": is_passed,
        "is_completed": True,
        "time_taken": attempt.time_taken,
        "completed_at": attempt.completed_at.isoformat() if attempt.completed_at else None
    }

    return {
        "attempt": attempt_response,
        "quiz_title": quiz.title,
        "passing_score": quiz.passing_score,
        "show_correct_answers": quiz.show_correct_answers,
        "detailed_answers": detailed_answers,
        "performance_summary": performance_summary,
        "xp_earned": 0  # Déjà attribué
    }


@router.get("/{quiz_id}/attempts", response_model=QuizAttemptListResponse)
async def list_quiz_attempts(
    quiz_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer toutes les tentatives d'un quiz pour l'utilisateur"""
    
    query = select(QuizAttempt).where(
        and_(
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.user_id == current_user.id
        )
    )
    
    # Compter le total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Pagination et tri
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(QuizAttempt.completed_at.desc())
    
    result = await db.execute(query)
    attempts = result.scalars().all()
    
    return {
        "attempts": attempts,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.put("/{quiz_id}", response_model=QuizResponse)
async def update_quiz(
    quiz_id: int,
    quiz_data: QuizUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Mettre à jour un quiz"""
    
    result = await db.execute(
        select(Quiz).where(
            and_(
                Quiz.id == quiz_id,
                Quiz.user_id == current_user.id
            )
        )
    )
    quiz = result.scalar_one_or_none()
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé"
        )
    
    # Mettre à jour les champs
    update_data = quiz_data.model_dump(exclude_unset=True)
    
    # Convertir les questions si présentes
    if "questions" in update_data and update_data["questions"]:
        update_data["questions"] = [q.model_dump() if hasattr(q, "model_dump") else q for q in update_data["questions"]]
        # Recalculer le total de points
        update_data["total_points"] = sum(q.get("points", 10) for q in update_data["questions"])
    
    for field, value in update_data.items():
        setattr(quiz, field, value)

    await db.commit()
    await db.refresh(quiz)

    # Invalider le cache
    await invalidate_quiz_cache(current_user.id, quiz_id)

    return quiz


@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quiz(
    quiz_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprimer un quiz"""
    
    result = await db.execute(
        select(Quiz).where(
            and_(
                Quiz.id == quiz_id,
                Quiz.user_id == current_user.id
            )
        )
    )
    quiz = result.scalar_one_or_none()
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé"
        )
    
    # Mettre à jour les stats de la matière
    result = await db.execute(
        select(Subject).where(Subject.id == quiz.subject_id)
    )
    subject = result.scalar_one_or_none()
    if subject:
        subject.total_quizzes_count = max(0, subject.total_quizzes_count - 1)
    
    await db.delete(quiz)
    await db.commit()

    # Invalider le cache
    await invalidate_quiz_cache(current_user.id, quiz_id)

    return None


@router.post("/{quiz_id}/publish", response_model=QuizResponse)
async def toggle_publish_quiz(
    quiz_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Publier/Dépublier un quiz"""
    
    result = await db.execute(
        select(Quiz).where(
            and_(
                Quiz.id == quiz_id,
                Quiz.user_id == current_user.id
            )
        )
    )
    quiz = result.scalar_one_or_none()
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé"
        )
    
    quiz.is_published = not quiz.is_published
    if quiz.is_published:
        quiz.published_at = utc_now()

    await db.commit()
    await db.refresh(quiz)

    # Invalider le cache
    await invalidate_quiz_cache(current_user.id, quiz_id)

    return quiz


def generate_share_code() -> str:
    """Génère un code de partage unique et lisible"""
    import secrets
    return secrets.token_urlsafe(8)[:10].upper()


@router.post("/{quiz_id}/share")
async def enable_quiz_sharing(
    quiz_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Activer le partage public d'un quiz et générer un code de partage
    """
    result = await db.execute(
        select(Quiz).where(
            and_(
                Quiz.id == quiz_id,
                Quiz.user_id == current_user.id
            )
        )
    )
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé"
        )

    # Générer un code de partage si pas déjà existant
    if not quiz.share_code:
        quiz.share_code = generate_share_code()

    quiz.is_public = True

    await db.commit()
    await db.refresh(quiz)

    # Invalider le cache
    await invalidate_quiz_cache(current_user.id, quiz_id)

    return {
        "share_code": quiz.share_code,
        "share_url": f"/play/{quiz.share_code}",
        "is_public": quiz.is_public,
        "total_plays": quiz.total_plays or 0,
        "total_shares": quiz.total_shares or 0
    }


@router.delete("/{quiz_id}/share")
async def disable_quiz_sharing(
    quiz_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Désactiver le partage public d'un quiz
    """
    result = await db.execute(
        select(Quiz).where(
            and_(
                Quiz.id == quiz_id,
                Quiz.user_id == current_user.id
            )
        )
    )
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé"
        )

    quiz.is_public = False

    await db.commit()

    # Invalider le cache
    await invalidate_quiz_cache(current_user.id, quiz_id)

    return {"message": "Partage désactivé", "is_public": False}


@router.get("/{quiz_id}/share/stats")
async def get_quiz_share_stats(
    quiz_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupérer les statistiques de partage d'un quiz
    """
    from app.models.quiz import GuestQuizAttempt

    result = await db.execute(
        select(Quiz).where(
            and_(
                Quiz.id == quiz_id,
                Quiz.user_id == current_user.id
            )
        )
    )
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé"
        )

    # Compter les tentatives d'invités
    guest_count = await db.execute(
        select(func.count()).select_from(GuestQuizAttempt).where(
            and_(
                GuestQuizAttempt.quiz_id == quiz_id,
                GuestQuizAttempt.is_completed == True
            )
        )
    )
    total_guests = guest_count.scalar() or 0

    # Score moyen des invités
    avg_score = await db.execute(
        select(func.avg(GuestQuizAttempt.score)).where(
            and_(
                GuestQuizAttempt.quiz_id == quiz_id,
                GuestQuizAttempt.is_completed == True
            )
        )
    )
    average_guest_score = avg_score.scalar() or 0

    # Conversions (invités devenus utilisateurs)
    conversions = await db.execute(
        select(func.count()).select_from(GuestQuizAttempt).where(
            and_(
                GuestQuizAttempt.quiz_id == quiz_id,
                GuestQuizAttempt.converted_to_user_id.isnot(None)
            )
        )
    )
    total_conversions = conversions.scalar() or 0

    conversion_rate = (total_conversions / total_guests * 100) if total_guests > 0 else 0

    return {
        "quiz_id": quiz_id,
        "quiz_title": quiz.title,
        "share_code": quiz.share_code,
        "is_public": quiz.is_public,
        "total_plays": quiz.total_plays or 0,
        "total_shares": quiz.total_shares or 0,
        "total_guest_attempts": total_guests,
        "average_guest_score": round(average_guest_score, 1),
        "total_conversions": total_conversions,
        "conversion_rate": round(conversion_rate, 1)
    }
