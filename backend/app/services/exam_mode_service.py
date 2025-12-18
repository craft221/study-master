"""
Service Exam Mode - Logique métier pour la préparation aux examens
===================================================================

Ce service gère:
- Création et gestion des sessions d'examen
- Algorithme intelligent de planification
- Répétition espacée
- Prédiction de réussite
- Attribution d'XP
"""

import logging
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
import math
import random

from app.models.exam_mode import (
    ExamSession, StudyDay, StudyTask, ExamModeNotification,
    ExamSessionStatus, StudyTaskType, StudyTaskStatus, DifficultyLevel,
    EXAM_MODE_XP_REWARDS, TASK_DURATION_ESTIMATES, SPACED_REPETITION_INTERVALS
)
from app.models.user import User, SubscriptionType
from app.models.note import Note
from app.models.subject import Subject
from app.schemas.exam_mode import (
    ExamSessionCreate, ExamSessionUpdate,
    ExamSessionResponse, ExamSessionDetailResponse,
    StudyDayResponse, StudyTaskResponse,
    GeneratePlanResponse, PredictionResponse
)
from app.services.xp_service import award_xp
from app.core.datetime_utils import utc_now

logger = logging.getLogger(__name__)


class ExamModeService:
    """Service principal pour Exam Mode"""

    # ==================== LIMITES PAR ABONNEMENT ====================
    SUBSCRIPTION_LIMITS = {
        SubscriptionType.FREE: {
            "max_active_exams": 1,
            "can_use_ai_generation": False,
            "can_get_predictions": False,
            "max_notes_per_exam": 5,
        },
        SubscriptionType.PREMIUM: {
            "max_active_exams": 5,
            "can_use_ai_generation": True,
            "can_get_predictions": True,
            "max_notes_per_exam": 50,
        },
        SubscriptionType.PREMIUM_PLUS: {
            "max_active_exams": 999,  # Illimité
            "can_use_ai_generation": True,
            "can_get_predictions": True,
            "max_notes_per_exam": 999,
        },
        SubscriptionType.INSTITUTIONAL: {
            "max_active_exams": 999,
            "can_use_ai_generation": True,
            "can_get_predictions": True,
            "max_notes_per_exam": 999,
        },
    }

    # ==================== CRÉATION DE SESSION ====================

    async def create_exam_session(
        self,
        db: AsyncSession,
        user: User,
        data: ExamSessionCreate
    ) -> ExamSession:
        """Crée une nouvelle session d'examen"""

        # Vérifier les limites d'abonnement
        limits = self.SUBSCRIPTION_LIMITS.get(user.subscription_type, self.SUBSCRIPTION_LIMITS[SubscriptionType.FREE])

        # Compter les sessions actives
        active_count = await self._count_active_sessions(db, user.id)
        if active_count >= limits["max_active_exams"]:
            raise ValueError(f"limit_reached:Vous avez atteint la limite de {limits['max_active_exams']} examen(s) actif(s)")

        # Vérifier la limite de notes
        if len(data.note_ids) > limits["max_notes_per_exam"]:
            raise ValueError(f"too_many_notes:Maximum {limits['max_notes_per_exam']} notes par examen")

        # Calculer le contenu total
        total_words = 0
        total_pages = 0
        if data.note_ids:
            notes_query = select(Note).where(
                Note.id.in_(data.note_ids),
                Note.user_id == user.id
            )
            result = await db.execute(notes_query)
            notes = result.scalars().all()

            for note in notes:
                words = len(note.content.split()) if note.content else 0
                total_words += words
                total_pages += math.ceil(words / 300)  # ~300 mots par page

        # Créer la session
        session = ExamSession(
            user_id=user.id,
            exam_name=data.exam_name,
            exam_description=data.exam_description,
            exam_date=data.exam_date,
            exam_time=data.exam_time,
            subject_id=data.subject_id,
            note_ids=data.note_ids,
            total_content_words=total_words,
            total_content_pages=total_pages,
            study_hours_per_day=data.study_hours_per_day,
            preferred_study_times=data.preferred_study_times,
            include_weekends=data.include_weekends,
            difficulty_level=DifficultyLevel(data.difficulty_level.value),
            notifications_enabled=data.notifications_enabled,
            reminder_time=data.reminder_time,
            status=ExamSessionStatus.PLANNING,
        )

        db.add(session)
        await db.commit()
        await db.refresh(session)

        # Générer le plan d'étude automatiquement
        await self.generate_study_plan(db, session, user)

        # Attribuer XP pour la création
        await award_xp(db, user.id, EXAM_MODE_XP_REWARDS["create_plan"], "exam_mode_create")

        logger.info(f"Exam session created: {session.id} for user {user.id}")
        return session

    async def _count_active_sessions(self, db: AsyncSession, user_id: int) -> int:
        """Compte les sessions actives d'un utilisateur"""
        # Use .value to get lowercase string values that match PostgreSQL enum
        active_statuses = [
            ExamSessionStatus.PLANNING.value,
            ExamSessionStatus.ACTIVE.value,
            ExamSessionStatus.PAUSED.value
        ]
        query = select(func.count(ExamSession.id)).where(
            ExamSession.user_id == user_id,
            ExamSession.status.in_(active_statuses)
        )
        result = await db.execute(query)
        return result.scalar() or 0

    # ==================== GÉNÉRATION DU PLAN ====================

    async def generate_study_plan(
        self,
        db: AsyncSession,
        session: ExamSession,
        user: User,
        regenerate: bool = False
    ) -> GeneratePlanResponse:
        """Génère un plan d'étude intelligent"""

        # Supprimer l'ancien plan si régénération
        if regenerate:
            await db.execute(
                StudyDay.__table__.delete().where(StudyDay.exam_session_id == session.id)
            )

        # Calculer le nombre de jours disponibles
        today = date.today()
        exam_date = session.exam_date
        total_available_days = (exam_date - today).days

        if total_available_days <= 0:
            raise ValueError("exam_date_passed:La date d'examen est déjà passée")

        # Filtrer les jours selon les préférences (weekends, etc.)
        study_dates = self._get_study_dates(today, exam_date, session.include_weekends)
        num_study_days = len(study_dates)

        if num_study_days == 0:
            raise ValueError("no_study_days:Aucun jour d'étude disponible")

        # Récupérer les notes à réviser
        notes = []
        if session.note_ids:
            notes_query = select(Note).where(Note.id.in_(session.note_ids))
            result = await db.execute(notes_query)
            notes = list(result.scalars().all())

        # Diviser le contenu sur les jours disponibles
        study_days = await self._create_study_days(
            db, session, study_dates, notes, user
        )

        # Mettre à jour la session
        session.total_days = len(study_days)
        session.tasks_total = sum(day.tasks_total for day in study_days)
        session.status = ExamSessionStatus.ACTIVE
        session.started_at = utc_now()

        await db.commit()

        return GeneratePlanResponse(
            success=True,
            exam_session_id=session.id,
            total_days=len(study_days),
            total_tasks=session.tasks_total,
            study_days=[],  # On peut charger si besoin
            estimated_total_hours=session.study_hours_per_day * len(study_days),
            message=f"Plan créé avec succès: {len(study_days)} jours, {session.tasks_total} tâches"
        )

    def _get_study_dates(
        self,
        start_date: date,
        end_date: date,
        include_weekends: bool
    ) -> List[date]:
        """Retourne la liste des dates d'étude valides"""
        dates = []
        current = start_date + timedelta(days=1)  # Commencer demain

        # Garder un jour de repos avant l'examen
        end = end_date - timedelta(days=1)

        while current <= end:
            if include_weekends or current.weekday() < 5:  # 0-4 = Lun-Ven
                dates.append(current)
            current += timedelta(days=1)

        return dates

    async def _create_study_days(
        self,
        db: AsyncSession,
        session: ExamSession,
        study_dates: List[date],
        notes: List[Note],
        user: User
    ) -> List[StudyDay]:
        """Crée les jours d'étude avec leurs tâches"""

        study_days = []
        num_days = len(study_dates)

        # Diviser les notes sur les jours (en gardant des jours de révision)
        learning_days = int(num_days * 0.6)  # 60% apprentissage
        review_days = int(num_days * 0.3)    # 30% révision
        practice_days = num_days - learning_days - review_days  # 10% examen blanc

        # Répartir les notes sur les jours d'apprentissage
        notes_per_day = max(1, len(notes) // learning_days) if learning_days > 0 and notes else 0

        for day_num, study_date in enumerate(study_dates, 1):
            is_last_day = day_num == num_days
            is_practice_day = day_num > learning_days + review_days
            is_review_day = learning_days < day_num <= learning_days + review_days

            # Déterminer le titre du jour
            if is_last_day:
                title = "Révision finale et repos"
                is_rest = True
            elif is_practice_day:
                title = f"Examen blanc #{day_num - learning_days - review_days}"
                is_rest = False
            elif is_review_day:
                title = f"Révision - Jour {day_num - learning_days}"
                is_rest = False
            else:
                # Jour d'apprentissage - assigner des notes
                start_idx = (day_num - 1) * notes_per_day
                end_idx = min(start_idx + notes_per_day, len(notes))
                day_notes = notes[start_idx:end_idx] if notes else []

                if day_notes:
                    note_titles = [n.title[:30] for n in day_notes[:2]]
                    title = f"Étude: {', '.join(note_titles)}"
                else:
                    title = f"Jour {day_num}: Étude et révision"
                is_rest = False

            # Créer le jour
            study_day = StudyDay(
                exam_session_id=session.id,
                day_number=day_num,
                study_date=study_date,
                title=title,
                is_review_day=is_review_day,
                is_practice_exam_day=is_practice_day,
                is_rest_day=is_rest,
                estimated_minutes=int(session.study_hours_per_day * 60),
            )

            db.add(study_day)
            await db.flush()  # Pour obtenir l'ID

            # Créer les tâches pour ce jour
            tasks = await self._create_day_tasks(
                db, study_day, session, user,
                day_notes if not is_review_day and not is_practice_day and not is_rest else [],
                is_review_day, is_practice_day, is_rest
            )

            study_day.tasks_total = len(tasks)
            study_days.append(study_day)

        await db.commit()
        return study_days

    async def _create_day_tasks(
        self,
        db: AsyncSession,
        study_day: StudyDay,
        session: ExamSession,
        user: User,
        notes: List[Note],
        is_review: bool,
        is_practice: bool,
        is_rest: bool
    ) -> List[StudyTask]:
        """Crée les tâches pour un jour donné"""

        tasks = []
        order = 0

        if is_rest:
            # Jour de repos - une seule tâche légère
            task = StudyTask(
                study_day_id=study_day.id,
                user_id=user.id,
                task_type=StudyTaskType.SUMMARY,
                order=order,
                title="Relecture légère des points clés",
                description="Parcourez rapidement vos notes sans stress",
                estimated_minutes=30,
            )
            tasks.append(task)
            db.add(task)

        elif is_practice:
            # Examen blanc
            task = StudyTask(
                study_day_id=study_day.id,
                user_id=user.id,
                task_type=StudyTaskType.PRACTICE_EXAM,
                order=order,
                title="Examen blanc complet",
                description="Conditions réelles - Testez vos connaissances",
                estimated_minutes=TASK_DURATION_ESTIMATES[StudyTaskType.PRACTICE_EXAM],
                target_score=80.0,
            )
            tasks.append(task)
            db.add(task)

            # Analyse des points faibles après
            order += 1
            task2 = StudyTask(
                study_day_id=study_day.id,
                user_id=user.id,
                task_type=StudyTaskType.WEAK_POINTS,
                order=order,
                title="Analyse et révision des erreurs",
                description="Identifiez et travaillez vos points faibles",
                estimated_minutes=30,
            )
            tasks.append(task2)
            db.add(task2)

        elif is_review:
            # Jour de révision - répétition espacée
            task = StudyTask(
                study_day_id=study_day.id,
                user_id=user.id,
                task_type=StudyTaskType.REVIEW,
                order=order,
                title="Révision par répétition espacée",
                description="Revoyez le contenu des jours précédents",
                estimated_minutes=TASK_DURATION_ESTIMATES[StudyTaskType.REVIEW],
            )
            tasks.append(task)
            db.add(task)

            order += 1
            task2 = StudyTask(
                study_day_id=study_day.id,
                user_id=user.id,
                task_type=StudyTaskType.FLASHCARDS,
                order=order,
                title="Session flashcards",
                description="Révisez avec les flashcards générées",
                estimated_minutes=TASK_DURATION_ESTIMATES[StudyTaskType.FLASHCARDS],
                target_score=85.0,
            )
            tasks.append(task2)
            db.add(task2)

        else:
            # Jour d'apprentissage normal
            for note in notes:
                # Tâche de lecture
                task_read = StudyTask(
                    study_day_id=study_day.id,
                    user_id=user.id,
                    task_type=StudyTaskType.READ,
                    order=order,
                    title=f"Lire: {note.title[:50]}",
                    description="Lisez attentivement et prenez des notes",
                    note_id=note.id,
                    estimated_minutes=TASK_DURATION_ESTIMATES[StudyTaskType.READ],
                )
                tasks.append(task_read)
                db.add(task_read)
                order += 1

            # Ajouter flashcards
            task_flash = StudyTask(
                study_day_id=study_day.id,
                user_id=user.id,
                task_type=StudyTaskType.FLASHCARDS,
                order=order,
                title="Créer et réviser les flashcards",
                description="Générez des flashcards à partir du contenu",
                estimated_minutes=TASK_DURATION_ESTIMATES[StudyTaskType.FLASHCARDS],
                target_score=80.0,
            )
            tasks.append(task_flash)
            db.add(task_flash)
            order += 1

            # Quiz de fin de journée
            task_quiz = StudyTask(
                study_day_id=study_day.id,
                user_id=user.id,
                task_type=StudyTaskType.QUIZ,
                order=order,
                title="Quiz de validation",
                description="Testez votre compréhension du jour",
                estimated_minutes=TASK_DURATION_ESTIMATES[StudyTaskType.QUIZ],
                target_score=70.0,
            )
            tasks.append(task_quiz)
            db.add(task_quiz)

        return tasks

    # ==================== RÉCUPÉRATION ====================

    async def get_session(
        self,
        db: AsyncSession,
        session_id: int,
        user_id: int,
        include_days: bool = False
    ) -> Optional[ExamSession]:
        """Récupère une session par ID"""
        query = select(ExamSession).where(
            ExamSession.id == session_id,
            ExamSession.user_id == user_id
        )

        if include_days:
            query = query.options(
                selectinload(ExamSession.study_days).selectinload(StudyDay.tasks),
                selectinload(ExamSession.subject)
            )

        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def get_user_sessions(
        self,
        db: AsyncSession,
        user_id: int,
        status: Optional[ExamSessionStatus] = None,
        limit: int = 20
    ) -> List[ExamSession]:
        """Liste les sessions d'un utilisateur"""
        query = select(ExamSession).where(ExamSession.user_id == user_id)

        if status:
            query = query.where(ExamSession.status == status)

        query = query.order_by(ExamSession.exam_date.asc()).limit(limit)
        query = query.options(selectinload(ExamSession.subject))

        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_today_tasks(
        self,
        db: AsyncSession,
        user_id: int
    ) -> List[Dict[str, Any]]:
        """Récupère les tâches du jour pour l'utilisateur"""
        today = date.today()

        query = select(StudyTask).join(StudyDay).join(ExamSession).where(
            ExamSession.user_id == user_id,
            ExamSession.status == ExamSessionStatus.ACTIVE.value,
            StudyDay.study_date == today
        ).options(
            selectinload(StudyTask.study_day).selectinload(StudyDay.exam_session)
        ).order_by(StudyTask.order)

        result = await db.execute(query)
        tasks = result.scalars().all()

        return [
            {
                "task": task,
                "exam_name": task.study_day.exam_session.exam_name,
                "days_until_exam": (task.study_day.exam_session.exam_date - today).days
            }
            for task in tasks
        ]

    # ==================== ACTIONS SUR LES TÂCHES ====================

    async def start_task(
        self,
        db: AsyncSession,
        task_id: int,
        user_id: int
    ) -> StudyTask:
        """Démarre une tâche"""
        task = await self._get_task(db, task_id, user_id)
        if not task:
            raise ValueError("task_not_found")

        task.status = StudyTaskStatus.IN_PROGRESS
        task.started_at = utc_now()

        await db.commit()
        return task

    async def complete_task(
        self,
        db: AsyncSession,
        task_id: int,
        user_id: int,
        score: Optional[float] = None,
        actual_minutes: Optional[int] = None
    ) -> Tuple[StudyTask, int]:
        """Termine une tâche et retourne l'XP gagné"""
        task = await self._get_task(db, task_id, user_id)
        if not task:
            raise ValueError("task_not_found")

        task.status = StudyTaskStatus.COMPLETED
        task.completed_at = utc_now()

        if score is not None:
            task.achieved_score = score
        if actual_minutes is not None:
            task.actual_minutes = actual_minutes

        # Mettre à jour le compteur du jour
        study_day = task.study_day
        study_day.tasks_completed += 1

        if actual_minutes:
            study_day.actual_minutes += actual_minutes

        # Vérifier si le jour est terminé
        if study_day.tasks_completed >= study_day.tasks_total:
            study_day.is_completed = True
            study_day.completed_at = utc_now()

        # Mettre à jour la session
        exam_session = study_day.exam_session
        exam_session.tasks_completed += 1
        exam_session.progress_percentage = exam_session.calculate_progress()

        if actual_minutes:
            exam_session.total_study_minutes += actual_minutes

        # Calculer XP
        xp_earned = EXAM_MODE_XP_REWARDS["complete_task"]

        # Bonus si score élevé
        if score and score >= 90:
            xp_earned += 10

        # Bonus si jour terminé
        if study_day.is_completed:
            xp_earned += EXAM_MODE_XP_REWARDS["complete_day"]

            # Bonus jour parfait
            day_tasks = await self._get_day_tasks(db, study_day.id)
            avg_score = sum(t.achieved_score or 0 for t in day_tasks) / len(day_tasks) if day_tasks else 0
            if avg_score >= 90:
                xp_earned += EXAM_MODE_XP_REWARDS["perfect_day"]

        await award_xp(db, user_id, xp_earned, "exam_mode_task")
        await db.commit()

        return task, xp_earned

    async def skip_task(
        self,
        db: AsyncSession,
        task_id: int,
        user_id: int,
        reason: Optional[str] = None
    ) -> StudyTask:
        """Passe une tâche"""
        task = await self._get_task(db, task_id, user_id)
        if not task:
            raise ValueError("task_not_found")

        task.status = StudyTaskStatus.SKIPPED
        if reason:
            task.metadata = {"skip_reason": reason}

        await db.commit()
        return task

    async def _get_task(
        self,
        db: AsyncSession,
        task_id: int,
        user_id: int
    ) -> Optional[StudyTask]:
        """Récupère une tâche avec vérification utilisateur"""
        query = select(StudyTask).options(
            selectinload(StudyTask.study_day).selectinload(StudyDay.exam_session)
        ).where(
            StudyTask.id == task_id,
            StudyTask.user_id == user_id
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def _get_day_tasks(
        self,
        db: AsyncSession,
        day_id: int
    ) -> List[StudyTask]:
        """Récupère toutes les tâches d'un jour"""
        query = select(StudyTask).where(StudyTask.study_day_id == day_id)
        result = await db.execute(query)
        return list(result.scalars().all())

    # ==================== PRÉDICTION ====================

    async def predict_success(
        self,
        db: AsyncSession,
        session: ExamSession
    ) -> PredictionResponse:
        """Prédit les chances de réussite"""

        # Facteurs de prédiction
        factors = {}

        # 1. Progression dans le plan (40%)
        progress_factor = session.progress_percentage / 100
        factors["progress"] = {
            "value": session.progress_percentage,
            "weight": 0.4,
            "label": "Progression du plan"
        }

        # 2. Scores moyens aux quiz (30%)
        avg_score = session.average_quiz_score / 100 if session.average_quiz_score else 0.5
        factors["quiz_scores"] = {
            "value": session.average_quiz_score,
            "weight": 0.3,
            "label": "Score moyen aux quiz"
        }

        # 3. Régularité (20%)
        # TODO: Calculer basé sur les jours complétés à temps
        regularity = 0.7  # Placeholder
        factors["regularity"] = {
            "value": regularity * 100,
            "weight": 0.2,
            "label": "Régularité d'étude"
        }

        # 4. Temps restant (10%)
        days_left = session.days_until_exam
        total_days = session.total_days
        time_factor = min(1.0, days_left / max(1, total_days * 0.3))  # OK si > 30% du temps reste
        factors["time_remaining"] = {
            "value": days_left,
            "weight": 0.1,
            "label": "Jours restants"
        }

        # Calcul pondéré
        predicted_score = (
            progress_factor * 0.4 +
            avg_score * 0.3 +
            regularity * 0.2 +
            time_factor * 0.1
        ) * 100

        # Confiance basée sur la quantité de données
        confidence = min(90, session.tasks_completed * 5 + 20)

        # Recommandations
        recommendations = []
        if progress_factor < 0.5:
            recommendations.append("Accélérez votre rythme pour terminer le plan")
        if avg_score < 0.7:
            recommendations.append("Revoyez les concepts où vous avez eu moins de 70%")
        if days_left < 3 and progress_factor < 0.8:
            recommendations.append("Concentrez-vous sur les points essentiels")

        # Mettre à jour la session
        session.predicted_score = predicted_score
        session.confidence_level = confidence
        await db.commit()

        return PredictionResponse(
            exam_session_id=session.id,
            predicted_score=round(predicted_score, 1),
            confidence_level=round(confidence, 1),
            factors=factors,
            recommendations=recommendations
        )

    # ==================== STATISTIQUES ====================

    async def get_user_stats(
        self,
        db: AsyncSession,
        user_id: int
    ) -> Dict[str, Any]:
        """Statistiques globales de l'utilisateur pour Exam Mode"""

        # Compter les sessions
        all_sessions = await self.get_user_sessions(db, user_id, limit=100)

        completed = [s for s in all_sessions if s.status == ExamSessionStatus.COMPLETED]
        active = [s for s in all_sessions if s.status == ExamSessionStatus.ACTIVE]

        total_minutes = sum(s.total_study_minutes for s in all_sessions)
        avg_predicted = sum(s.predicted_score or 0 for s in completed) / len(completed) if completed else 0

        return {
            "total_exams_prepared": len(all_sessions),
            "total_exams_completed": len(completed),
            "current_active_exams": len(active),
            "total_study_hours": round(total_minutes / 60, 1),
            "average_predicted_score": round(avg_predicted, 1),
            "upcoming_exams_count": len([s for s in active if s.days_until_exam <= 7]),
        }

    # ==================== MOTIVATION ====================

    def get_motivation_message(self, session: ExamSession) -> str:
        """Génère un message de motivation contextuel"""
        days_left = session.days_until_exam
        progress = session.progress_percentage

        messages = {
            "on_track": [
                "Tu es sur la bonne voie ! Continue comme ça 💪",
                "Excellent travail ! Ta régularité paie 🌟",
                "Tu gères ! L'examen n'a qu'à bien se tenir 🎯",
            ],
            "behind": [
                "Pas de panique ! Concentre-toi sur l'essentiel 🎯",
                "Chaque minute compte. Tu peux le faire ! 💪",
                "Reste focus sur les points clés 📚",
            ],
            "almost_done": [
                "La ligne d'arrivée est proche ! 🏁",
                "Tu as fait le plus dur. Dernière ligne droite ! 🚀",
                "Bientôt l'examen ! Tu es prêt(e) 💯",
            ],
            "exam_tomorrow": [
                "Demain c'est le jour J ! Repose-toi bien ce soir 😴",
                "Tu as bien travaillé. Fais-toi confiance ! 🌟",
                "Dernière révision légère et au lit ! 💪",
            ],
        }

        if days_left <= 1:
            category = "exam_tomorrow"
        elif days_left <= 3 and progress >= 80:
            category = "almost_done"
        elif progress >= (100 - days_left * 10):
            category = "on_track"
        else:
            category = "behind"

        return random.choice(messages[category])


# Singleton
exam_mode_service = ExamModeService()
