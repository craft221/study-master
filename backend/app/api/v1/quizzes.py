from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import Optional, List
from datetime import datetime
import random

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.subject import Subject
from app.models.quiz import Quiz, QuizAttempt, QuizDifficulty, QuizType
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
    
    # Convertir les questions en format JSON
    questions_json = [q.model_dump() for q in quiz_data.questions]
    
    # Calculer le total de points
    total_points = sum(q.get("points", 10) for q in questions_json)
    
    # Créer le quiz
    new_quiz = Quiz(
        user_id=current_user.id,
        subject_id=quiz_data.subject_id,
        source_note_id=quiz_data.source_note_id,
        title=quiz_data.title,
        description=quiz_data.description,
        quiz_type=quiz_data.quiz_type,
        difficulty=quiz_data.difficulty,
        questions=questions_json,
        total_points=total_points,
        passing_score=quiz_data.passing_score,
        time_limit_minutes=quiz_data.time_limit_minutes,
        is_timed=quiz_data.is_timed,
        allow_multiple_attempts=quiz_data.allow_multiple_attempts,
        show_correct_answers=quiz_data.show_correct_answers,
        randomize_questions=quiz_data.randomize_questions,
        randomize_options=quiz_data.randomize_options,
        is_ai_generated=quiz_data.is_ai_generated
    )
    
    db.add(new_quiz)
    
    # Mettre à jour les statistiques
    subject.total_quizzes_count += 1
    current_user.total_xp += 15
    current_user.total_quizzes_created += 1
    
    await db.commit()
    await db.refresh(new_quiz)
    
    return new_quiz


@router.get("/", response_model=QuizListResponse)
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
    """Récupérer la liste des quizzes avec filtres"""
    
    query = select(Quiz).where(Quiz.user_id == current_user.id)
    
    # Appliquer les filtres
    if subject_id:
        query = query.where(Quiz.subject_id == subject_id)
    if quiz_type:
        query = query.where(Quiz.quiz_type == quiz_type)
    if difficulty:
        query = query.where(Quiz.difficulty == difficulty)
    if is_published is not None:
        query = query.where(Quiz.is_published == is_published)
    
    # Compter le total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Pagination et tri
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(Quiz.created_at.desc())
    
    result = await db.execute(query)
    quizzes = result.scalars().all()
    
    return {
        "quizzes": quizzes,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/{quiz_id}", response_model=QuizResponse)
async def get_quiz(
    quiz_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les détails d'un quiz"""
    
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
    
    return quiz


@router.post("/{quiz_id}/attempt", response_model=QuizAttemptResponse, status_code=status.HTTP_201_CREATED)
async def start_quiz_attempt(
    quiz_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Commencer une tentative de quiz"""
    
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
    
    if not quiz.is_published and quiz.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce quiz n'est pas encore publié"
        )
    
    # Vérifier si plusieurs tentatives sont autorisées
    if not quiz.allow_multiple_attempts:
        result = await db.execute(
            select(QuizAttempt).where(
                and_(
                    QuizAttempt.quiz_id == quiz_id,
                    QuizAttempt.user_id == current_user.id,
                    QuizAttempt.is_completed == True
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
    
    # Créer une nouvelle tentative
    new_attempt = QuizAttempt(
        user_id=current_user.id,
        quiz_id=quiz_id,
        attempt_number=attempt_count + 1,
        answers=[],
        points_possible=quiz.total_points,
        time_started=datetime.now()
    )
    
    db.add(new_attempt)
    await db.commit()
    await db.refresh(new_attempt)
    
    return new_attempt


@router.put("/attempt/{attempt_id}", response_model=QuizResultsResponse)
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
    
    if attempt.is_completed:
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
    
    # Vérifier que toutes les questions ont une réponse
    if len(submission.answers) != len(quiz.questions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vous devez répondre à toutes les questions ({len(quiz.questions)} questions)"
        )
    
    # Corriger les réponses
    answers_with_correction = []
    points_earned = 0
    correct_count = 0
    
    for user_answer in submission.answers:
        question_id = user_answer.question_id
        
        if question_id < 0 or question_id >= len(quiz.questions):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"question_id {question_id} invalide"
            )
        
        question = quiz.questions[question_id]
        correct_answer = question["correct_answer"]
        is_correct = user_answer.user_answer.strip().lower() == correct_answer.strip().lower()
        
        points_for_question = question.get("points", 10) if is_correct else 0
        points_earned += points_for_question
        
        if is_correct:
            correct_count += 1
        
        answers_with_correction.append({
            "question_id": question_id,
            "user_answer": user_answer.user_answer,
            "correct_answer": correct_answer,
            "is_correct": is_correct,
            "points_earned": points_for_question,
            "time_spent_seconds": user_answer.time_spent_seconds
        })
    
    # Calculer le score en pourcentage
    score = (points_earned / quiz.total_points) * 100 if quiz.total_points > 0 else 0
    is_passed = score >= quiz.passing_score
    
    # Calculer le temps total
    time_completed = datetime.now()
    total_time_seconds = int((time_completed - attempt.time_started).total_seconds())
    
    # Mettre à jour la tentative
    attempt.answers = answers_with_correction
    attempt.score = score
    attempt.points_earned = points_earned
    attempt.is_passed = is_passed
    attempt.time_completed = time_completed
    attempt.total_time_seconds = total_time_seconds
    attempt.is_completed = True
    
    # Analyse simple des forces/faiblesses
    strengths = []
    weaknesses = []
    
    if correct_count == len(quiz.questions):
        strengths.append("Parfait ! Toutes les réponses correctes")
    elif score >= 80:
        strengths.append("Excellente maîtrise du sujet")
    elif score >= 60:
        strengths.append("Bonne compréhension générale")
    
    if score < 60:
        weaknesses.append("Revoir les concepts de base")
    
    attempt.strengths = strengths
    attempt.weaknesses = weaknesses
    attempt.recommendations = [f"Réviser les {len(quiz.questions) - correct_count} questions incorrectes"] if correct_count < len(quiz.questions) else []
    
    # Mettre à jour les stats du quiz
    quiz.total_attempts += 1
    if quiz.average_score == 0:
        quiz.average_score = score
    else:
        quiz.average_score = (quiz.average_score * (quiz.total_attempts - 1) + score) / quiz.total_attempts
    
    if score > quiz.highest_score:
        quiz.highest_score = score
    
    quiz.completion_rate = 100.0  # Simplifié pour le MVP
    
    # Attribuer XP
    xp_earned = 20  # Base
    if is_passed:
        xp_earned += 10
    if score >= 90:
        xp_earned += 20  # Bonus excellence
    
    current_user.total_xp += xp_earned
    current_user.total_quizzes_taken += 1
    
    await db.commit()
    await db.refresh(attempt)
    
    # Préparer la réponse détaillée
    detailed_answers = []
    if quiz.show_correct_answers:
        for i, q in enumerate(quiz.questions):
            answer_data = next((a for a in answers_with_correction if a["question_id"] == i), None)
            detailed_answers.append({
                "question": q["question"],
                "type": q["type"],
                "user_answer": answer_data["user_answer"] if answer_data else "",
                "correct_answer": q["correct_answer"],
                "is_correct": answer_data["is_correct"] if answer_data else False,
                "explanation": q.get("explanation"),
                "points_earned": answer_data["points_earned"] if answer_data else 0
            })
    
    performance_summary = {
        "total_questions": len(quiz.questions),
        "correct_answers": correct_count,
        "incorrect_answers": len(quiz.questions) - correct_count,
        "accuracy": (correct_count / len(quiz.questions)) * 100 if len(quiz.questions) > 0 else 0,
        "time_taken": total_time_seconds,
        "status": "Réussi" if is_passed else "Échoué"
    }
    
    return {
        "attempt": attempt,
        "quiz_title": quiz.title,
        "passing_score": quiz.passing_score,
        "show_correct_answers": quiz.show_correct_answers,
        "detailed_answers": detailed_answers,
        "performance_summary": performance_summary,
        "xp_earned": xp_earned
    }


@router.get("/attempt/{attempt_id}/results", response_model=QuizResultsResponse)
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
    
    if not attempt.is_completed:
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
    correct_count = sum(1 for a in attempt.answers if a.get("is_correct", False))
    
    if quiz.show_correct_answers:
        for i, q in enumerate(quiz.questions):
            answer_data = next((a for a in attempt.answers if a["question_id"] == i), None)
            detailed_answers.append({
                "question": q["question"],
                "type": q["type"],
                "user_answer": answer_data["user_answer"] if answer_data else "",
                "correct_answer": q["correct_answer"],
                "is_correct": answer_data["is_correct"] if answer_data else False,
                "explanation": q.get("explanation"),
                "points_earned": answer_data["points_earned"] if answer_data else 0
            })
    
    performance_summary = {
        "total_questions": len(quiz.questions),
        "correct_answers": correct_count,
        "incorrect_answers": len(quiz.questions) - correct_count,
        "accuracy": (correct_count / len(quiz.questions)) * 100 if len(quiz.questions) > 0 else 0,
        "time_taken": attempt.total_time_seconds,
        "status": "Réussi" if attempt.is_passed else "Échoué"
    }
    
    return {
        "attempt": attempt,
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
    query = query.order_by(QuizAttempt.created_at.desc())
    
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
        quiz.published_at = datetime.now()
    
    await db.commit()
    await db.refresh(quiz)
    
    return quiz
