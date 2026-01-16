"""
API Endpoints pour Exam Mode
=============================

Feature PREMIUM: Préparation intelligente aux examens avec plan personnalisé.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from datetime import date
import logging

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, SubscriptionType
from app.models.exam_mode import ExamSession, ExamSessionStatus, StudyDay, StudyTask
from app.schemas.exam_mode import (
    ExamSessionCreate, ExamSessionUpdate,
    ExamSessionResponse, ExamSessionDetailResponse, ExamSessionListResponse,
    StudyDayResponse, StudyTaskResponse,
    StartTaskRequest, CompleteTaskRequest, SkipTaskRequest,
    GeneratePlanRequest, GeneratePlanResponse,
    PredictionResponse, ExamModeStatsResponse, DayProgressResponse,
    ExamModePremiumStatus, WizardStep1Response, WizardStep2Response
)
from app.services.exam_mode_service import exam_mode_service
from app.services.exam_mode_ai_service import exam_mode_ai_service
from app.api.v1.ai import (
    check_and_increment_ai_quota,
    get_max_requests,
    raise_quota_exceeded_error
)

router = APIRouter()


# ==================== HELPERS ====================

def session_to_response(session: ExamSession) -> ExamSessionResponse:
    """Convertit une session en réponse API"""
    return ExamSessionResponse(
        id=session.id,
        user_id=session.user_id,
        exam_name=session.exam_name,
        exam_description=session.exam_description,
        exam_date=session.exam_date,
        exam_time=session.exam_time,
        subject_id=session.subject_id,
        subject_name=session.subject.name if session.subject else None,
        note_ids=session.note_ids or [],
        document_ids=session.document_ids or [],
        total_content_pages=session.total_content_pages,
        total_content_words=session.total_content_words,
        study_hours_per_day=session.study_hours_per_day,
        preferred_study_times=session.preferred_study_times or [],
        include_weekends=session.include_weekends,
        difficulty_level=session.difficulty_level,
        status=session.status,
        current_day=session.current_day,
        total_days=session.total_days,
        tasks_completed=session.tasks_completed,
        tasks_total=session.tasks_total,
        progress_percentage=session.progress_percentage,
        predicted_score=session.predicted_score,
        confidence_level=session.confidence_level,
        total_study_minutes=session.total_study_minutes,
        total_flashcards_reviewed=session.total_flashcards_reviewed,
        total_quizzes_taken=session.total_quizzes_taken,
        average_quiz_score=session.average_quiz_score,
        weak_points=session.weak_points or [],
        strong_points=session.strong_points or [],
        notifications_enabled=session.notifications_enabled,
        reminder_time=session.reminder_time,
        days_until_exam=session.days_until_exam,
        is_urgent=session.is_urgent,
        is_overdue=session.is_overdue,
        created_at=session.created_at,
        updated_at=session.updated_at,
        started_at=session.started_at,
        completed_at=session.completed_at,
    )


def day_to_response(day: StudyDay) -> StudyDayResponse:
    """Convertit un jour en réponse API"""
    return StudyDayResponse(
        id=day.id,
        day_number=day.day_number,
        study_date=day.study_date,
        title=day.title,
        description=day.description,
        chapters=day.chapters or [],
        note_ids=day.note_ids or [],
        is_review_day=day.is_review_day,
        is_practice_exam_day=day.is_practice_exam_day,
        is_rest_day=day.is_rest_day,
        estimated_minutes=day.estimated_minutes,
        actual_minutes=day.actual_minutes,
        is_completed=day.is_completed,
        completed_at=day.completed_at,
        tasks_completed=day.tasks_completed,
        tasks_total=day.tasks_total,
        score=day.score,
        is_today=day.is_today,
        is_past=day.is_past,
        is_future=day.is_future,
        progress_percentage=day.calculate_progress(),
        tasks=[task_to_response(t) for t in day.tasks] if day.tasks else [],
    )


def task_to_response(task: StudyTask) -> StudyTaskResponse:
    """Convertit une tâche en réponse API"""
    return StudyTaskResponse(
        id=task.id,
        task_type=task.task_type,
        order=task.order,
        title=task.title,
        description=task.description,
        note_id=task.note_id,
        quiz_id=task.quiz_id,
        flashcard_deck_id=task.flashcard_deck_id,
        estimated_minutes=task.estimated_minutes,
        actual_minutes=task.actual_minutes,
        target_score=task.target_score,
        achieved_score=task.achieved_score,
        items_count=task.items_count,
        status=task.status,
        created_at=task.created_at,
        started_at=task.started_at,
        completed_at=task.completed_at,
    )


# ==================== PREMIUM CHECK ====================

@router.get("/premium-status", response_model=ExamModePremiumStatus)
async def get_premium_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Vérifie le statut premium pour Exam Mode"""
    try:
        logger.info(f"[EXAM-MODE] Getting premium status for user {current_user.id}")
        logger.info(f"[EXAM-MODE] User subscription_type: {current_user.subscription_type}")

        limits = exam_mode_service.SUBSCRIPTION_LIMITS.get(
            current_user.subscription_type,
            exam_mode_service.SUBSCRIPTION_LIMITS[SubscriptionType.FREE]
        )
        logger.info(f"[EXAM-MODE] Limits: {limits}")

        active_count = await exam_mode_service._count_active_sessions(db, current_user.id)
        logger.info(f"[EXAM-MODE] Active count: {active_count}")

        is_premium = current_user.subscription_type != SubscriptionType.FREE

        features_available = ["create_exam_plan", "daily_tasks", "progress_tracking"]
        features_locked = []

        if not is_premium:
            features_locked = ["ai_quiz_generation", "predicted_score", "unlimited_exams", "advanced_analytics"]
        else:
            features_available.extend(["ai_quiz_generation", "predicted_score", "unlimited_exams", "advanced_analytics"])

        upgrade_message = None
        if not is_premium and active_count >= limits["max_active_exams"]:
            upgrade_message = "Passez à Premium pour préparer plusieurs examens simultanément !"

        logger.info(f"[EXAM-MODE] Returning premium status successfully")
        return ExamModePremiumStatus(
            is_premium=is_premium,
            can_create_exam=active_count < limits["max_active_exams"],
            active_exams_count=active_count,
            max_active_exams=limits["max_active_exams"],
            features_available=features_available,
            features_locked=features_locked,
            upgrade_message=upgrade_message,
        )
    except Exception as e:
        logger.error(f"[EXAM-MODE] Error in get_premium_status: {str(e)}", exc_info=True)
        raise


# ==================== CRUD SESSIONS ====================

@router.post("/", response_model=ExamSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_exam_session(
    data: ExamSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Crée une nouvelle session d'examen avec plan de révision automatique"""
    try:
        session = await exam_mode_service.create_exam_session(db, current_user, data)
        # Recharger avec les relations
        session = await exam_mode_service.get_session(db, session.id, current_user.id, include_days=False)
        return session_to_response(session)

    except ValueError as e:
        error_msg = str(e)
        if ":" in error_msg:
            code, message = error_msg.split(":", 1)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": code, "message": message}
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)


@router.get("/", response_model=ExamSessionListResponse)
async def list_exam_sessions(
    status_filter: Optional[str] = Query(None, description="Filtrer par statut"),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Liste les sessions d'examen de l'utilisateur"""
    status_enum = ExamSessionStatus(status_filter) if status_filter else None

    sessions = await exam_mode_service.get_user_sessions(
        db, current_user.id, status=status_enum, limit=limit
    )

    active_count = len([s for s in sessions if s.status == ExamSessionStatus.ACTIVE])
    completed_count = len([s for s in sessions if s.status == ExamSessionStatus.COMPLETED])

    return ExamSessionListResponse(
        sessions=[session_to_response(s) for s in sessions],
        total=len(sessions),
        active_count=active_count,
        completed_count=completed_count,
    )


@router.get("/active", response_model=List[ExamSessionResponse])
async def get_active_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère les sessions actives"""
    sessions = await exam_mode_service.get_user_sessions(
        db, current_user.id, status=ExamSessionStatus.ACTIVE
    )
    return [session_to_response(s) for s in sessions]


@router.get("/today", response_model=DayProgressResponse)
async def get_today_progress(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère la progression du jour avec les tâches à faire"""
    # Trouver la session active la plus urgente
    sessions = await exam_mode_service.get_user_sessions(
        db, current_user.id, status=ExamSessionStatus.ACTIVE
    )

    if not sessions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucun examen en cours de préparation"
        )

    # Prendre la session avec l'examen le plus proche
    session = min(sessions, key=lambda s: s.days_until_exam)

    # Charger avec les détails
    session = await exam_mode_service.get_session(db, session.id, current_user.id, include_days=True)

    # Trouver le jour d'aujourd'hui
    today = date.today()
    today_day = next((d for d in session.study_days if d.study_date == today), None)

    if not today_day:
        # Pas de tâches prévues aujourd'hui
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pas de révisions prévues aujourd'hui"
        )

    tasks_remaining = today_day.tasks_total - today_day.tasks_completed
    estimated_time = sum(
        t.estimated_minutes for t in today_day.tasks
        if t.status.value in ["pending", "in_progress"]
    )

    return DayProgressResponse(
        exam_session_id=session.id,
        exam_name=session.exam_name,
        days_until_exam=session.days_until_exam,
        today=day_to_response(today_day),
        tasks_remaining=tasks_remaining,
        estimated_time_remaining=estimated_time,
        streak_days=0,  # TODO: Calculer le streak
        is_on_track=session.progress_percentage >= (100 - session.days_until_exam * 10),
        motivation_message=exam_mode_service.get_motivation_message(session),
    )


@router.get("/{session_id}", response_model=ExamSessionDetailResponse)
async def get_exam_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère les détails d'une session avec le plan complet"""
    session = await exam_mode_service.get_session(
        db, session_id, current_user.id, include_days=True
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session non trouvée"
        )

    # Tâches d'aujourd'hui
    today = date.today()
    today_day = next((d for d in session.study_days if d.study_date == today), None)
    today_tasks = [task_to_response(t) for t in today_day.tasks] if today_day else []

    # Tâches à venir (prochains 3 jours)
    upcoming_tasks = []
    for day in session.study_days:
        if today < day.study_date <= today + timedelta(days=3):
            upcoming_tasks.extend([task_to_response(t) for t in day.tasks])

    response = ExamSessionDetailResponse(
        **session_to_response(session).model_dump(),
        study_days=[day_to_response(d) for d in session.study_days],
        today_tasks=today_tasks,
        upcoming_tasks=upcoming_tasks[:10],  # Limiter
    )

    return response


@router.put("/{session_id}", response_model=ExamSessionResponse)
async def update_exam_session(
    session_id: int,
    data: ExamSessionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Met à jour une session d'examen"""
    session = await exam_mode_service.get_session(db, session_id, current_user.id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session non trouvée"
        )

    # Mettre à jour les champs
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(session, key):
            setattr(session, key, value)

    await db.commit()
    await db.refresh(session)

    return session_to_response(session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exam_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprime une session d'examen"""
    session = await exam_mode_service.get_session(db, session_id, current_user.id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session non trouvée"
        )

    await db.delete(session)
    await db.commit()


# ==================== ACTIONS SUR LES TÂCHES ====================

@router.post("/tasks/{task_id}/start", response_model=StudyTaskResponse)
async def start_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Démarre une tâche d'étude"""
    try:
        task = await exam_mode_service.start_task(db, task_id, current_user.id)
        return task_to_response(task)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/tasks/{task_id}/complete")
async def complete_task(
    task_id: int,
    data: CompleteTaskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Termine une tâche d'étude"""
    try:
        task, xp_earned = await exam_mode_service.complete_task(
            db, task_id, current_user.id,
            score=data.score,
            actual_minutes=data.actual_minutes
        )
        return {
            "task": task_to_response(task),
            "xp_earned": xp_earned,
            "message": f"Tâche terminée ! +{xp_earned} XP"
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/tasks/{task_id}/skip", response_model=StudyTaskResponse)
async def skip_task(
    task_id: int,
    data: SkipTaskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Passe une tâche"""
    try:
        task = await exam_mode_service.skip_task(
            db, task_id, current_user.id, reason=data.reason
        )
        return task_to_response(task)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== PRÉDICTION ====================

@router.get("/{session_id}/prediction", response_model=PredictionResponse)
async def get_prediction(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Obtient la prédiction de réussite (BETA: disponible pour tous)"""
    # BETA: Vérification premium désactivée - tous les utilisateurs ont accès
    session = await exam_mode_service.get_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session non trouvée")

    return await exam_mode_service.predict_success(db, session)


# ==================== STATISTIQUES ====================

@router.get("/stats/me", response_model=ExamModeStatsResponse)
async def get_my_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Statistiques globales Exam Mode de l'utilisateur"""
    stats = await exam_mode_service.get_user_stats(db, current_user.id)

    return ExamModeStatsResponse(
        total_exams_prepared=stats["total_exams_prepared"],
        total_exams_completed=stats["total_exams_completed"],
        average_preparation_days=0,  # TODO
        average_predicted_score=stats["average_predicted_score"],
        total_study_hours=stats["total_study_hours"],
        current_active_exams=stats["current_active_exams"],
        upcoming_exams_count=stats["upcoming_exams_count"],
        best_score_achieved=None,  # TODO
        longest_streak_days=0,  # TODO
        xp_earned_from_exam_mode=0,  # TODO
    )


# ==================== WIZARD ====================

@router.get("/wizard/step1", response_model=WizardStep1Response)
async def wizard_step1(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Étape 1 du wizard: récupère les matières disponibles"""
    from sqlalchemy import select
    from app.models.subject import Subject

    query = select(Subject).where(
        Subject.user_id == current_user.id,
        Subject.is_archived == False
    ).order_by(Subject.name)

    result = await db.execute(query)
    subjects = result.scalars().all()

    return WizardStep1Response(
        subjects=[
            {
                "id": s.id,
                "name": s.name,
                "color": s.color,
                "notes_count": s.total_notes_count,
                "exam_date": s.exam_date.isoformat() if s.exam_date else None,
            }
            for s in subjects
        ],
        suggested_hours=2.0,
    )


@router.get("/wizard/step2/{subject_id}", response_model=WizardStep2Response)
async def wizard_step2(
    subject_id: int,
    exam_date: date = Query(..., description="Date de l'examen"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Étape 2 du wizard: récupère les notes et documents, estime le plan"""
    from sqlalchemy import select
    from app.models.note import Note
    from app.models.document import Document

    # Récupérer les notes
    notes_query = select(Note).where(
        Note.subject_id == subject_id,
        Note.user_id == current_user.id,
        Note.is_archived == False
    ).order_by(Note.created_at.desc())

    notes_result = await db.execute(notes_query)
    notes = notes_result.scalars().all()

    # Récupérer les documents
    docs_query = select(Document).where(
        Document.subject_id == subject_id,
        Document.user_id == current_user.id,
        Document.is_archived == False
    ).order_by(Document.created_at.desc())

    docs_result = await db.execute(docs_query)
    documents = docs_result.scalars().all()

    # Calculer le total (notes + documents)
    total_words = sum(len(n.content.split()) if n.content else 0 for n in notes)
    # Estimer les mots des documents (300 mots par page PDF environ)
    doc_estimated_words = sum(
        len(d.extracted_text.split()) if d.extracted_text else (d.file_size // 500)  # ~500 bytes par "page"
        for d in documents
    )
    total_words += doc_estimated_words

    estimated_pages = total_words // 300

    days_available = (exam_date - date.today()).days
    suggested_days = max(3, min(days_available - 1, estimated_pages // 2 + 3))

    return WizardStep2Response(
        notes=[
            {
                "id": n.id,
                "title": n.title,
                "words": len(n.content.split()) if n.content else 0,
                "created_at": n.created_at.isoformat(),
            }
            for n in notes
        ],
        documents=[
            {
                "id": d.id,
                "title": d.title or d.original_filename,
                "filename": d.original_filename,
                "file_type": d.file_type,
                "file_size": d.file_size,
                "file_size_formatted": d.file_size_formatted,
                "has_extracted_text": bool(d.extracted_text),
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in documents
        ],
        total_words=total_words,
        estimated_pages=estimated_pages,
        suggested_days=suggested_days,
    )


# Import manquant
from datetime import timedelta


# ==================== FONCTIONNALITÉS IA ====================

@router.post("/tasks/{task_id}/generate-content")
async def generate_task_content(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Génère le contenu IA pour une tâche (quiz ou flashcards)

    PREMIUM: Génère automatiquement le quiz/flashcards basé sur les notes associées.
    Lie d'abord les ressources existantes, sinon génère avec IA.

    ⚠️ Consomme 1 requête IA du quota si génération IA nécessaire.
    """
    # BETA: Vérification premium désactivée - tous les utilisateurs ont accès

    # Récupérer la tâche
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    query = select(StudyTask).options(
        selectinload(StudyTask.study_day).selectinload(StudyDay.exam_session)
    ).where(
        StudyTask.id == task_id,
        StudyTask.user_id == current_user.id
    )
    result = await db.execute(query)
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tâche non trouvée")

    # Vérifier et incrémenter le quota IA AVANT la génération
    can_use, remaining = await check_and_increment_ai_quota(
        user_id=current_user.id,
        subscription_type=current_user.subscription_type,
        db=db
    )
    if not can_use:
        max_requests = get_max_requests(current_user.subscription_type)
        raise_quota_exceeded_error(current_user.subscription_type, max_requests)

    # Récupérer la langue de l'utilisateur
    user_lang = current_user.language if hasattr(current_user, 'language') else "fr"

    # Lier/générer le contenu
    linked = await exam_mode_ai_service.link_existing_resources(db, task, current_user, lang=user_lang)

    return {
        "success": True,
        "task_id": task_id,
        "generated": linked.get("generated", False),
        "quiz": linked.get("quiz"),
        "flashcard_deck": linked.get("flashcard_deck"),
        "message": "Contenu généré avec IA" if linked.get("generated") else "Ressources existantes liées",
        "ai_requests_remaining": remaining
    }


@router.get("/{session_id}/key-points")
async def get_key_points_analysis(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Analyse IA des points clés du contenu à réviser

    PREMIUM: Utilise Claude Sonnet 4.5 pour identifier:
    - Concepts clés à maîtriser
    - Formules/définitions importantes
    - Liens conceptuels
    - Priorités de révision

    ⚠️ Consomme 1 requête IA du quota.
    """
    # BETA: Vérification premium désactivée - tous les utilisateurs ont accès

    # Vérifier et incrémenter le quota IA
    can_use, remaining = await check_and_increment_ai_quota(
        user_id=current_user.id,
        subscription_type=current_user.subscription_type,
        db=db
    )
    if not can_use:
        max_requests = get_max_requests(current_user.subscription_type)
        raise_quota_exceeded_error(current_user.subscription_type, max_requests)

    session = await exam_mode_service.get_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session non trouvée")

    # Récupérer la langue de l'utilisateur
    user_lang = current_user.language if hasattr(current_user, 'language') else "fr"

    analysis = await exam_mode_ai_service.analyze_key_points(db, session, lang=user_lang)

    if "error" in analysis:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=analysis["error"]
        )

    return {
        "session_id": session_id,
        "exam_name": session.exam_name,
        "ai_requests_remaining": remaining,
        **analysis
    }


@router.get("/{session_id}/weak-points")
async def get_weak_points_detection(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Détection IA des points faibles basée sur les performances

    PREMIUM: Analyse les résultats aux quiz/flashcards pour identifier:
    - Sujets où l'étudiant a des difficultés
    - Patterns d'erreurs
    - Recommandations personnalisées

    ⚠️ Consomme 1 requête IA du quota.
    """
    # BETA: Vérification premium désactivée

    # Vérifier et incrémenter le quota IA
    can_use, remaining = await check_and_increment_ai_quota(
        user_id=current_user.id,
        subscription_type=current_user.subscription_type,
        db=db
    )
    if not can_use:
        max_requests = get_max_requests(current_user.subscription_type)
        raise_quota_exceeded_error(current_user.subscription_type, max_requests)

    session = await exam_mode_service.get_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session non trouvée")

    # Récupérer la langue de l'utilisateur
    user_lang = current_user.language if hasattr(current_user, 'language') else "fr"

    weak_points = await exam_mode_ai_service.detect_weak_points(db, session, current_user, lang=user_lang)

    return {
        "session_id": session_id,
        "exam_name": session.exam_name,
        "ai_requests_remaining": remaining,
        **weak_points
    }


@router.get("/{session_id}/personalized-advice")
async def get_personalized_advice(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Conseils personnalisés de révision générés par IA

    PREMIUM: Génère des conseils adaptés basés sur:
    - Progression actuelle
    - Points forts/faibles
    - Temps restant avant l'examen
    - Style d'apprentissage déduit

    ⚠️ Consomme 1 requête IA du quota.
    """
    # BETA: Vérification premium désactivée

    # Vérifier et incrémenter le quota IA
    can_use, remaining = await check_and_increment_ai_quota(
        user_id=current_user.id,
        subscription_type=current_user.subscription_type,
        db=db
    )
    if not can_use:
        max_requests = get_max_requests(current_user.subscription_type)
        raise_quota_exceeded_error(current_user.subscription_type, max_requests)

    session = await exam_mode_service.get_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session non trouvée")

    # Récupérer la langue de l'utilisateur
    user_lang = current_user.language if hasattr(current_user, 'language') else "fr"

    advice = await exam_mode_ai_service.get_personalized_advice(db, session, current_user, lang=user_lang)

    return {
        "session_id": session_id,
        "exam_name": session.exam_name,
        "ai_requests_remaining": remaining,
        **advice
    }


@router.post("/{session_id}/adapt-plan")
async def adapt_study_plan(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Adaptation dynamique du plan d'étude

    PREMIUM: Ajuste le plan basé sur:
    - Progression vs prévisions
    - Points faibles identifiés
    - Temps restant

    Peut ajouter/modifier des tâches pour optimiser la préparation.

    ⚠️ Consomme 1 requête IA du quota.
    """
    # BETA: Vérification premium désactivée

    # Vérifier et incrémenter le quota IA
    can_use, remaining = await check_and_increment_ai_quota(
        user_id=current_user.id,
        subscription_type=current_user.subscription_type,
        db=db
    )
    if not can_use:
        max_requests = get_max_requests(current_user.subscription_type)
        raise_quota_exceeded_error(current_user.subscription_type, max_requests)

    session = await exam_mode_service.get_session(db, session_id, current_user.id, include_days=True)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session non trouvée")

    # Récupérer la langue de l'utilisateur
    user_lang = current_user.language if hasattr(current_user, 'language') else "fr"

    adaptation = await exam_mode_ai_service.adapt_study_plan(db, session, current_user, lang=user_lang)

    return {
        "session_id": session_id,
        "exam_name": session.exam_name,
        "ai_requests_remaining": remaining,
        **adaptation
    }


@router.post("/{session_id}/generate-practice-exam")
async def generate_practice_exam(
    session_id: int,
    duration_minutes: int = Query(60, ge=30, le=180, description="Durée en minutes"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Génère un examen blanc complet avec IA

    PREMIUM: Crée un examen complet basé sur tout le contenu de la session,
    avec focus sur les points faibles identifiés.

    ⚠️ Consomme 2 requêtes IA du quota (génération intensive).
    """
    # BETA: Vérification premium désactivée

    # Vérifier et incrémenter le quota IA (2 requêtes pour génération d'examen)
    can_use, remaining = await check_and_increment_ai_quota(
        user_id=current_user.id,
        subscription_type=current_user.subscription_type,
        db=db
    )
    if not can_use:
        max_requests = get_max_requests(current_user.subscription_type)
        raise_quota_exceeded_error(current_user.subscription_type, max_requests)

    # Deuxième incrément pour la génération d'examen (plus coûteuse)
    can_use2, remaining = await check_and_increment_ai_quota(
        user_id=current_user.id,
        subscription_type=current_user.subscription_type,
        db=db
    )
    # On continue même si le 2ème échoue, c'est juste un bonus de comptage

    session = await exam_mode_service.get_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session non trouvée")

    # Récupérer la langue de l'utilisateur
    user_lang = current_user.language if hasattr(current_user, 'language') else "fr"

    quiz = await exam_mode_ai_service.generate_practice_exam(
        db, session, current_user, duration_minutes, lang=user_lang
    )

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de générer l'examen blanc. Vérifiez que des notes sont associées."
        )

    return {
        "success": True,
        "quiz_id": quiz.id,
        "title": quiz.title,
        "duration_minutes": duration_minutes,
        "question_count": len(quiz.questions) if quiz.questions else 0,
        "message": f"Examen blanc généré avec succès ({duration_minutes} min)",
        "ai_requests_remaining": remaining
    }


@router.get("/{session_id}/ai-summary")
async def get_ai_summary(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Résumé IA complet de la session d'examen

    PREMIUM: Combine toutes les analyses IA en un seul rapport:
    - Points clés
    - Points faibles
    - Conseils
    - État de préparation

    ⚠️ Consomme 3 requêtes IA du quota (analyse complète).
    """
    # BETA: Vérification premium désactivée

    # Vérifier le quota pour 3 requêtes (key_points + weak_points + advice)
    max_requests = get_max_requests(current_user.subscription_type)

    # Première requête
    can_use, remaining = await check_and_increment_ai_quota(
        user_id=current_user.id,
        subscription_type=current_user.subscription_type,
        db=db
    )
    if not can_use:
        raise_quota_exceeded_error(current_user.subscription_type, max_requests)

    # Vérifier qu'il reste assez pour les 2 autres requêtes
    if remaining < 2:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Pas assez de quota IA pour le résumé complet (nécessite 3 requêtes)",
                "code": "INSUFFICIENT_QUOTA",
                "required": 3,
                "remaining": remaining + 1,  # +1 car on a déjà incrémenté
                "suggestion": "Utilisez les analyses individuelles ou revenez demain"
            }
        )

    # Incrémenter pour les 2 autres requêtes
    await check_and_increment_ai_quota(current_user.id, current_user.subscription_type, db)
    _, remaining = await check_and_increment_ai_quota(current_user.id, current_user.subscription_type, db)

    session = await exam_mode_service.get_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session non trouvée")

    # Récupérer la langue de l'utilisateur
    user_lang = current_user.language if hasattr(current_user, 'language') else "fr"

    # Collecter toutes les analyses
    key_points = await exam_mode_ai_service.analyze_key_points(db, session, lang=user_lang)
    weak_points = await exam_mode_ai_service.detect_weak_points(db, session, current_user, lang=user_lang)
    advice = await exam_mode_ai_service.get_personalized_advice(db, session, current_user, lang=user_lang)
    prediction = await exam_mode_service.predict_success(db, session)

    return {
        "session_id": session_id,
        "exam_name": session.exam_name,
        "exam_date": session.exam_date.isoformat(),
        "days_until_exam": session.days_until_exam,
        "progress_percentage": session.progress_percentage,
        "prediction": {
            "predicted_score": prediction.predicted_score,
            "confidence_level": prediction.confidence_level
        },
        "key_points_summary": key_points.get("concepts_cles", [])[:5],
        "weak_points_summary": weak_points.get("weak_points", [])[:3],
        "top_recommendations": advice.get("focus_prioritaire", [])[:3],
        "motivation_message": advice.get("message_motivation", ""),
        "readiness_status": "ready" if session.progress_percentage >= 80 else "preparing" if session.progress_percentage >= 50 else "early_stage",
        "ai_requests_remaining": remaining
    }
