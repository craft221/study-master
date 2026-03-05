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
from app.services.fsrs_service import FSRSScheduler, FSRSParameters, FSRSCard, State, Rating
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

    def __init__(self):
        """Initialise le service avec FSRS pour la répétition espacée"""
        self.fsrs = FSRSScheduler(FSRSParameters.default())

    # ==================== MÉTHODES FSRS ====================

    def _calculate_fsrs_review_days(
        self,
        total_days: int,
        notes_count: int,
        difficulty_level: DifficultyLevel
    ) -> List[int]:
        """
        Calcule les jours de révision optimaux basés sur FSRS.

        Au lieu d'un pourcentage fixe (30%), utilise les intervalles FSRS
        pour planifier les révisions au moment optimal pour la rétention.

        Args:
            total_days: Nombre total de jours avant l'examen
            notes_count: Nombre de notes à réviser
            difficulty_level: Niveau de difficulté de l'examen

        Returns:
            Liste des numéros de jours où placer des révisions
        """
        review_days = []

        # Intervalles FSRS typiques: 1, 3, 7, 14, 30 jours
        # On adapte selon le temps disponible
        if total_days <= 3:
            # Très peu de temps: révision quotidienne
            review_days = list(range(2, total_days + 1))
        elif total_days <= 7:
            # Une semaine: intervalles courts
            review_days = [2, 4, 6] if total_days >= 6 else [2, total_days - 1]
        elif total_days <= 14:
            # Deux semaines: suivre FSRS
            # Jour 1: apprendre, Jour 2: révision (+1), Jour 4: révision (+3), Jour 8: révision (+7)
            intervals = [1, 3, 7]
            current = 1
            for interval in intervals:
                current += interval
                if current < total_days - 1:  # Garder le dernier jour pour examen blanc
                    review_days.append(current)
        else:
            # Plus de deux semaines: intervalles FSRS complets
            intervals = [1, 3, 7, 14]
            current = 1
            for interval in intervals:
                current += interval
                if current < total_days - 2:
                    review_days.append(current)

            # Ajouter des révisions supplémentaires pour le contenu volumineux
            if notes_count > 10:
                mid_point = total_days // 2
                if mid_point not in review_days:
                    review_days.append(mid_point)

        # Ajuster selon la difficulté
        if difficulty_level == DifficultyLevel.HARD:
            # Plus de révisions pour les examens difficiles
            additional_days = [d + 1 for d in review_days if d + 1 < total_days - 1 and d + 1 not in review_days]
            review_days.extend(additional_days[:2])

        return sorted(set(review_days))

    def _calculate_adaptive_day_distribution(
        self,
        total_days: int,
        notes_count: int,
        total_words: int,
        difficulty_level: DifficultyLevel
    ) -> Dict[str, int]:
        """
        Calcule une répartition adaptative des jours basée sur le contenu.

        Remplace les pourcentages fixes (60/30/10) par une distribution
        intelligente basée sur le volume de contenu et le temps disponible.

        Returns:
            Dict avec learning_days, review_days, practice_days
        """
        # Estimer le temps nécessaire pour tout apprendre (15 min / 500 mots en moyenne)
        estimated_learning_hours = max(1, total_words / 500 * 0.25)

        # Estimer le nombre de jours d'apprentissage nécessaires
        # (basé sur 2h d'étude par jour en moyenne)
        min_learning_days = max(1, math.ceil(estimated_learning_hours / 2))

        # Nombre de révisions recommandées par FSRS selon le temps disponible
        recommended_reviews = len(self._calculate_fsrs_review_days(total_days, notes_count, difficulty_level))

        # Calculer la distribution
        if total_days <= 3:
            # Mode survie: tout apprendre, pas de pratique
            learning = total_days - 1
            review = 1
            practice = 0
        elif total_days <= 7:
            # Court terme: focus apprentissage + une révision
            learning = max(2, total_days - recommended_reviews - 1)
            review = recommended_reviews
            practice = 1
        else:
            # Normal: distribution équilibrée
            # 1. D'abord, allouer les jours d'apprentissage minimum
            learning = max(min_learning_days, int(total_days * 0.5))

            # 2. Allouer les jours de révision FSRS
            review = min(recommended_reviews, total_days - learning - 2)

            # 3. Le reste pour la pratique (min 1, max 3)
            practice = max(1, min(3, total_days - learning - review))

            # Ajuster si on dépasse
            while learning + review + practice > total_days:
                if learning > min_learning_days:
                    learning -= 1
                elif practice > 1:
                    practice -= 1
                else:
                    review -= 1

        # Ajuster selon la difficulté
        if difficulty_level == DifficultyLevel.HARD and practice < 2 and total_days > 7:
            practice = min(2, total_days - learning - review)

        return {
            "learning_days": max(1, learning),
            "review_days": max(0, review),
            "practice_days": max(0, practice)
        }

    async def _calculate_real_regularity(
        self,
        db: AsyncSession,
        session: ExamSession
    ) -> float:
        """
        Calcule la régularité réelle basée sur l'historique des tâches.

        Remplace le placeholder 0.7 par un calcul réel basé sur:
        - Nombre de jours complétés à temps
        - Continuité des sessions (pas de grandes pauses)
        - Respect du planning prévu

        Returns:
            Score de régularité entre 0.0 et 1.0
        """
        # Récupérer tous les jours d'étude passés
        today = utc_now().date()
        query = select(StudyDay).where(
            StudyDay.exam_session_id == session.id,
            StudyDay.study_date < today
        ).order_by(StudyDay.study_date)

        result = await db.execute(query)
        past_days = list(result.scalars().all())

        if not past_days:
            return 0.7  # Valeur par défaut si pas encore d'historique

        # Facteur 1: Taux de complétion des jours (40% du score)
        completed_days = sum(1 for d in past_days if d.is_completed)
        completion_rate = completed_days / len(past_days) if past_days else 0

        # Facteur 2: Continuité (pas de trous) (30% du score)
        consecutive_streaks = 0
        current_streak = 0
        for i, day in enumerate(past_days):
            if day.is_completed:
                current_streak += 1
                consecutive_streaks = max(consecutive_streaks, current_streak)
            else:
                current_streak = 0

        # Score de continuité basé sur le plus long streak vs total
        continuity_score = consecutive_streaks / len(past_days) if past_days else 0

        # Facteur 3: Ponctualité (complétion le jour prévu) (30% du score)
        on_time_count = 0
        for day in past_days:
            if day.is_completed and day.completed_at:
                # Vérifie si complété le jour même ou le lendemain
                completion_date = day.completed_at.date() if hasattr(day.completed_at, 'date') else day.completed_at
                if isinstance(completion_date, datetime):
                    completion_date = completion_date.date()
                days_late = (completion_date - day.study_date).days if isinstance(day.study_date, date) else 0
                if days_late <= 1:
                    on_time_count += 1

        punctuality_score = on_time_count / len(past_days) if past_days else 0

        # Score final pondéré
        regularity = (
            completion_rate * 0.4 +
            continuity_score * 0.3 +
            punctuality_score * 0.3
        )

        return max(0.0, min(1.0, regularity))

    def _get_fsrs_based_task_order(
        self,
        tasks: List[StudyTask],
        scores_history: Dict[int, List[float]]
    ) -> List[StudyTask]:
        """
        Réordonne les tâches selon leur priorité FSRS.

        Les contenus avec une récupérabilité plus basse (plus à risque d'oubli)
        sont placés en premier.
        """
        def get_priority(task: StudyTask) -> float:
            if task.note_id and task.note_id in scores_history:
                scores = scores_history[task.note_id]
                avg_score = sum(scores) / len(scores) if scores else 0.5
                # Plus le score est bas, plus la priorité est haute
                return 1 - avg_score
            return 0.5  # Priorité moyenne par défaut

        return sorted(tasks, key=get_priority, reverse=True)

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

        # Vérifier la limite de notes + documents
        total_content = len(data.note_ids) + len(getattr(data, 'document_ids', []) or [])
        if total_content > limits["max_notes_per_exam"]:
            raise ValueError(f"too_many_notes:Maximum {limits['max_notes_per_exam']} éléments par examen")

        # Calculer le contenu total des notes
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

        # Calculer le contenu des documents
        document_ids = getattr(data, 'document_ids', []) or []
        if document_ids:
            from app.models.document import Document
            docs_query = select(Document).where(
                Document.id.in_(document_ids),
                Document.user_id == user.id
            )
            doc_result = await db.execute(docs_query)
            documents = doc_result.scalars().all()

            for doc in documents:
                # Utiliser le texte extrait si disponible, sinon estimer
                if doc.extracted_text:
                    words = len(doc.extracted_text.split())
                else:
                    # Estimer ~500 bytes par "page" de texte
                    words = doc.file_size // 500
                total_words += words
                total_pages += math.ceil(words / 300)

        # Créer la session
        session = ExamSession(
            user_id=user.id,
            exam_name=data.exam_name,
            exam_description=data.exam_description,
            exam_date=data.exam_date,
            exam_time=data.exam_time,
            subject_id=data.subject_id,
            note_ids=data.note_ids,
            document_ids=document_ids,
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
        await award_xp(
            user=user,
            amount=EXAM_MODE_XP_REWARDS["create_plan"],
            reason="Création d'un plan d'examen",
            event_type="exam_mode_create",
            db=db
        )

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
        today = utc_now().date()
        exam_date = session.exam_date
        total_available_days = (exam_date - today).days

        if total_available_days <= 0:
            raise ValueError("exam_date_passed:La date d'examen est déjà passée")

        # Filtrer les jours selon les préférences (weekends, etc.)
        study_dates = self._get_study_dates(today, exam_date, session.include_weekends)
        num_study_days = len(study_dates)

        if num_study_days == 0:
            raise ValueError("no_study_days:Aucun jour d'étude disponible")

        # Récupérer les notes à réviser (filtrer par user_id pour la sécurité)
        notes = []
        if session.note_ids:
            notes_query = select(Note).where(
                Note.id.in_(session.note_ids),
                Note.user_id == user.id
            )
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

        # ===== NOUVEAU: Distribution adaptative basée sur FSRS =====
        distribution = self._calculate_adaptive_day_distribution(
            total_days=num_days,
            notes_count=len(notes),
            total_words=session.total_content_words,
            difficulty_level=session.difficulty_level
        )

        learning_days_count = distribution["learning_days"]
        review_days_count = distribution["review_days"]
        practice_days_count = distribution["practice_days"]

        # Obtenir les jours de révision optimaux selon FSRS
        fsrs_review_day_numbers = self._calculate_fsrs_review_days(
            num_days, len(notes), session.difficulty_level
        )

        # Répartir les notes sur les jours d'apprentissage
        notes_per_day = max(1, len(notes) // learning_days_count) if learning_days_count > 0 and notes else 0

        # Compteurs pour titres et distribution de notes
        learning_day_counter = 0
        review_day_counter = 0
        practice_day_counter = 0

        for day_num, study_date in enumerate(study_dates, 1):
            is_last_day = day_num == num_days
            # ===== NOUVEAU: Utiliser les jours de révision FSRS =====
            is_review_day = day_num in fsrs_review_day_numbers
            is_practice_day = day_num > num_days - practice_days_count and not is_last_day

            # Déterminer le titre du jour
            if is_last_day:
                title = "Révision finale et repos"
                is_rest = True
            elif is_practice_day:
                practice_day_counter += 1
                title = f"Examen blanc #{practice_day_counter}"
                is_rest = False
            elif is_review_day:
                review_day_counter += 1
                title = f"Révision - Jour {review_day_counter}"
                is_rest = False
            else:
                # Jour d'apprentissage - assigner des notes
                start_idx = learning_day_counter * notes_per_day
                end_idx = min(start_idx + notes_per_day, len(notes))
                day_notes = notes[start_idx:end_idx] if notes else []
                learning_day_counter += 1

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

        # Toujours charger la relation subject
        query = query.options(selectinload(ExamSession.subject))

        if include_days:
            query = query.options(
                selectinload(ExamSession.study_days).selectinload(StudyDay.tasks)
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
        today = utc_now().date()

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

        # Vérifier que la tâche n'est pas déjà complétée ou skippée
        if task.status == StudyTaskStatus.COMPLETED:
            raise ValueError("task_already_completed")
        if task.status == StudyTaskStatus.SKIPPED:
            raise ValueError("task_already_skipped")

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

        # Empêcher la double complétion (double XP, compteurs corrompus)
        if task.status == StudyTaskStatus.COMPLETED:
            raise ValueError("task_already_completed")

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

            # Bonus jour parfait (ignorer les tâches sans score comme READ/SUMMARY)
            day_tasks = await self._get_day_tasks(db, study_day.id)
            scored_tasks = [t for t in day_tasks if t.achieved_score is not None]
            avg_score = sum(t.achieved_score for t in scored_tasks) / len(scored_tasks) if scored_tasks else 0
            if avg_score >= 90:
                xp_earned += EXAM_MODE_XP_REWARDS["perfect_day"]

        # Récupérer l'utilisateur pour award_xp
        from sqlalchemy.orm import selectinload
        user_result = await db.execute(
            select(User).where(User.id == user_id).options(selectinload(User.gamification))
        )
        user = user_result.scalar_one_or_none()
        if user:
            await award_xp(
                user=user,
                amount=xp_earned,
                reason="Tâche d'examen terminée",
                event_type="exam_mode_task",
                db=db
            )
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

        # Ne pas permettre de passer une tâche déjà terminée
        if task.status == StudyTaskStatus.COMPLETED:
            raise ValueError("task_already_completed")

        task.status = StudyTaskStatus.SKIPPED
        if reason:
            task.extra_data = {"skip_reason": reason}

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

        # 3. Régularité (20%) - ===== NOUVEAU: Calcul réel basé sur FSRS =====
        regularity = await self._calculate_real_regularity(db, session)
        factors["regularity"] = {
            "value": round(regularity * 100, 1),
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
        else:
            # Calculer le progrès attendu basé sur le temps écoulé
            total_days = max(1, session.total_days)
            elapsed = total_days - max(0, days_left)
            expected_progress = (elapsed / total_days) * 100 if total_days > 0 else 0
            if progress >= expected_progress * 0.8:  # 80% du progrès attendu = on track
                category = "on_track"
            else:
                category = "behind"

        return random.choice(messages[category])


# Singleton
exam_mode_service = ExamModeService()
