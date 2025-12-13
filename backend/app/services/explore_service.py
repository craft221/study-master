"""
Service Explore - Découverte de contenu public
==============================================

Permet de rechercher et filtrer le contenu public:
- Notes
- Flashcards (par deck)
- Quizzes

Avec filtres par:
- Type de contenu
- Matière
- Tags
- Popularité
- Récence
"""

import logging
from typing import Optional, List, Literal
from datetime import datetime, timedelta

from sqlalchemy import select, func, or_, and_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.core.datetime_utils import utc_now
from app.models.note import Note
from app.models.flashcard import Flashcard
from app.models.quiz import Quiz
from app.models.subject import Subject
from app.models.user import User, UserProfile

logger = logging.getLogger(__name__)

ContentType = Literal["all", "notes", "flashcards", "quizzes"]
SortBy = Literal["recent", "popular", "rating"]


class ExploreService:
    """Service pour explorer le contenu public"""

    async def search_public_content(
        self,
        db: AsyncSession,
        content_type: ContentType = "all",
        query: Optional[str] = None,
        subject_id: Optional[int] = None,
        subject_name: Optional[str] = None,
        tags: Optional[List[str]] = None,
        sort_by: SortBy = "recent",
        page: int = 1,
        limit: int = 20,
        user_id: Optional[int] = None  # Pour exclure son propre contenu si souhaité
    ) -> dict:
        """
        Recherche du contenu public avec filtres

        Returns:
            {
                "notes": [...],
                "flashcards": [...],  # Groupés par deck
                "quizzes": [...],
                "total_count": int,
                "page": int,
                "limit": int,
                "has_more": bool
            }
        """
        results = {
            "notes": [],
            "flashcards": [],  # Sera groupé par deck_name
            "quizzes": [],
            "total_count": 0,
            "page": page,
            "limit": limit,
            "has_more": False
        }

        offset = (page - 1) * limit

        # Rechercher les notes
        if content_type in ["all", "notes"]:
            notes_result = await self._search_notes(
                db, query, subject_id, subject_name, tags, sort_by, offset, limit, user_id
            )
            results["notes"] = notes_result["items"]
            results["total_count"] += notes_result["count"]

        # Rechercher les flashcards (groupées par deck)
        if content_type in ["all", "flashcards"]:
            flashcards_result = await self._search_flashcard_decks(
                db, query, subject_id, subject_name, tags, sort_by, offset, limit, user_id
            )
            results["flashcards"] = flashcards_result["items"]
            results["total_count"] += flashcards_result["count"]

        # Rechercher les quizzes
        if content_type in ["all", "quizzes"]:
            quizzes_result = await self._search_quizzes(
                db, query, subject_id, subject_name, tags, sort_by, offset, limit, user_id
            )
            results["quizzes"] = quizzes_result["items"]
            results["total_count"] += quizzes_result["count"]

        # Calculer has_more
        total_items = len(results["notes"]) + len(results["flashcards"]) + len(results["quizzes"])
        results["has_more"] = total_items >= limit

        return results

    async def _search_notes(
        self,
        db: AsyncSession,
        query: Optional[str],
        subject_id: Optional[int],
        subject_name: Optional[str],
        tags: Optional[List[str]],
        sort_by: SortBy,
        offset: int,
        limit: int,
        user_id: Optional[int]
    ) -> dict:
        """Recherche des notes publiques"""
        stmt = (
            select(Note)
            .options(
                joinedload(Note.user),
                joinedload(Note.subject)
            )
            .where(Note.is_public == True)
            .where(Note.is_archived == False)
        )

        # Filtres
        if query:
            stmt = stmt.where(
                or_(
                    Note.title.ilike(f"%{query}%"),
                    Note.content.ilike(f"%{query}%")
                )
            )

        if subject_id:
            stmt = stmt.where(Note.subject_id == subject_id)

        if subject_name:
            stmt = stmt.join(Subject).where(Subject.name.ilike(f"%{subject_name}%"))

        # Tri
        if sort_by == "recent":
            stmt = stmt.order_by(desc(Note.created_at))
        elif sort_by == "popular":
            # Pour les notes, on peut trier par date de mise à jour comme proxy de popularité
            stmt = stmt.order_by(desc(Note.updated_at))

        # Pagination
        stmt = stmt.offset(offset).limit(limit)

        result = await db.execute(stmt)
        notes = result.unique().scalars().all()

        # Compter le total
        count_stmt = select(func.count(Note.id)).where(Note.is_public == True)
        if query:
            count_stmt = count_stmt.where(
                or_(
                    Note.title.ilike(f"%{query}%"),
                    Note.content.ilike(f"%{query}%")
                )
            )
        count_result = await db.execute(count_stmt)
        total_count = count_result.scalar() or 0

        return {
            "items": [
                {
                    "id": note.id,
                    "type": "note",
                    "title": note.title,
                    "content_preview": note.content[:200] + "..." if len(note.content) > 200 else note.content,
                    "subject": {
                        "id": note.subject.id,
                        "name": note.subject.name,
                        "color": note.subject.color
                    } if note.subject else None,
                    "author": {
                        "id": note.user.id,
                        "username": note.user.username,
                        "avatar_url": note.user.avatar_url
                    } if note.user else None,
                    "tags": note.tags or [],
                    "created_at": note.created_at.isoformat() if note.created_at else None,
                }
                for note in notes
            ],
            "count": total_count
        }

    async def _search_flashcard_decks(
        self,
        db: AsyncSession,
        query: Optional[str],
        subject_id: Optional[int],
        subject_name: Optional[str],
        tags: Optional[List[str]],
        sort_by: SortBy,
        offset: int,
        limit: int,
        user_id: Optional[int]
    ) -> dict:
        """Recherche des decks de flashcards publics (groupés par deck_name)"""

        # Sous-requête pour grouper par deck et compter les cartes
        deck_subquery = (
            select(
                Flashcard.user_id,
                Flashcard.subject_id,
                Flashcard.deck_name,
                func.count(Flashcard.id).label("card_count"),
                func.max(Flashcard.created_at).label("latest_created")
            )
            .where(Flashcard.is_public == True)
            .where(Flashcard.deck_name.isnot(None))
            .group_by(Flashcard.user_id, Flashcard.subject_id, Flashcard.deck_name)
        )

        if subject_id:
            deck_subquery = deck_subquery.where(Flashcard.subject_id == subject_id)

        if query:
            deck_subquery = deck_subquery.where(
                or_(
                    Flashcard.deck_name.ilike(f"%{query}%"),
                    Flashcard.front.ilike(f"%{query}%")
                )
            )

        deck_subquery = deck_subquery.subquery()

        # Requête principale
        stmt = (
            select(
                deck_subquery.c.user_id,
                deck_subquery.c.subject_id,
                deck_subquery.c.deck_name,
                deck_subquery.c.card_count,
                deck_subquery.c.latest_created,
                User.username,
                UserProfile.avatar_url,
                Subject.name.label("subject_name"),
                Subject.color.label("subject_color")
            )
            .join(User, User.id == deck_subquery.c.user_id)
            .outerjoin(UserProfile, UserProfile.user_id == User.id)
            .outerjoin(Subject, Subject.id == deck_subquery.c.subject_id)
        )

        # Tri
        if sort_by == "recent":
            stmt = stmt.order_by(desc(deck_subquery.c.latest_created))
        elif sort_by == "popular":
            stmt = stmt.order_by(desc(deck_subquery.c.card_count))

        # Pagination
        stmt = stmt.offset(offset).limit(limit)

        result = await db.execute(stmt)
        decks = result.all()

        # Compter le total de decks
        count_stmt = (
            select(func.count())
            .select_from(
                select(Flashcard.deck_name)
                .where(Flashcard.is_public == True)
                .where(Flashcard.deck_name.isnot(None))
                .group_by(Flashcard.user_id, Flashcard.subject_id, Flashcard.deck_name)
                .subquery()
            )
        )
        count_result = await db.execute(count_stmt)
        total_count = count_result.scalar() or 0

        return {
            "items": [
                {
                    "type": "flashcard_deck",
                    "deck_name": deck.deck_name,
                    "card_count": deck.card_count,
                    "subject": {
                        "id": deck.subject_id,
                        "name": deck.subject_name,
                        "color": deck.subject_color
                    } if deck.subject_id else None,
                    "author": {
                        "id": deck.user_id,
                        "username": deck.username,
                        "avatar_url": deck.avatar_url
                    },
                    "created_at": deck.latest_created.isoformat() if deck.latest_created else None,
                }
                for deck in decks
            ],
            "count": total_count
        }

    async def _search_quizzes(
        self,
        db: AsyncSession,
        query: Optional[str],
        subject_id: Optional[int],
        subject_name: Optional[str],
        tags: Optional[List[str]],
        sort_by: SortBy,
        offset: int,
        limit: int,
        user_id: Optional[int]
    ) -> dict:
        """Recherche des quizzes publics"""
        stmt = (
            select(Quiz)
            .options(
                joinedload(Quiz.user),
                joinedload(Quiz.subject)
            )
            .where(Quiz.is_public == True)
            .where(Quiz.is_published == True)
        )

        # Filtres
        if query:
            stmt = stmt.where(
                or_(
                    Quiz.title.ilike(f"%{query}%"),
                    Quiz.description.ilike(f"%{query}%")
                )
            )

        if subject_id:
            stmt = stmt.where(Quiz.subject_id == subject_id)

        if subject_name:
            stmt = stmt.join(Subject, Quiz.subject_id == Subject.id).where(
                Subject.name.ilike(f"%{subject_name}%")
            )

        # Tri
        if sort_by == "recent":
            stmt = stmt.order_by(desc(Quiz.created_at))
        elif sort_by == "popular":
            stmt = stmt.order_by(desc(Quiz.total_plays))
        elif sort_by == "rating":
            stmt = stmt.order_by(desc(Quiz.average_score))

        # Pagination
        stmt = stmt.offset(offset).limit(limit)

        result = await db.execute(stmt)
        quizzes = result.unique().scalars().all()

        # Compter le total
        count_stmt = (
            select(func.count(Quiz.id))
            .where(Quiz.is_public == True)
            .where(Quiz.is_published == True)
        )
        if query:
            count_stmt = count_stmt.where(
                or_(
                    Quiz.title.ilike(f"%{query}%"),
                    Quiz.description.ilike(f"%{query}%")
                )
            )
        count_result = await db.execute(count_stmt)
        total_count = count_result.scalar() or 0

        return {
            "items": [
                {
                    "id": quiz.id,
                    "type": "quiz",
                    "title": quiz.title,
                    "description": quiz.description,
                    "question_count": len(quiz.questions) if quiz.questions else 0,
                    "difficulty": quiz.difficulty.value if quiz.difficulty else "medium",
                    "time_limit_minutes": quiz.time_limit_minutes,
                    "total_plays": quiz.total_plays or 0,
                    "average_score": round(quiz.average_score or 0, 1),
                    "share_code": quiz.share_code,
                    "subject": {
                        "id": quiz.subject.id,
                        "name": quiz.subject.name,
                        "color": quiz.subject.color
                    } if quiz.subject else None,
                    "author": {
                        "id": quiz.user.id,
                        "username": quiz.user.username,
                        "avatar_url": quiz.user.avatar_url
                    } if quiz.user else None,
                    "is_ai_generated": quiz.is_ai_generated,
                    "created_at": quiz.created_at.isoformat() if quiz.created_at else None,
                }
                for quiz in quizzes
            ],
            "count": total_count
        }

    async def get_popular_subjects(
        self,
        db: AsyncSession,
        limit: int = 10
    ) -> List[dict]:
        """Récupère les matières les plus populaires avec du contenu public"""

        # Compter le contenu public par matière
        stmt = (
            select(
                Subject.id,
                Subject.name,
                Subject.color,
                func.count(Note.id).label("notes_count")
            )
            .outerjoin(Note, and_(Note.subject_id == Subject.id, Note.is_public == True))
            .group_by(Subject.id)
            .order_by(desc("notes_count"))
            .limit(limit)
        )

        result = await db.execute(stmt)
        subjects = result.all()

        return [
            {
                "id": s.id,
                "name": s.name,
                "color": s.color,
                "content_count": s.notes_count or 0
            }
            for s in subjects
        ]

    async def get_trending_content(
        self,
        db: AsyncSession,
        days: int = 7,
        limit: int = 10
    ) -> dict:
        """Récupère le contenu tendance (créé récemment avec beaucoup d'interactions)"""
        since = utc_now() - timedelta(days=days)

        # Quizzes tendance
        quiz_stmt = (
            select(Quiz)
            .options(joinedload(Quiz.user), joinedload(Quiz.subject))
            .where(Quiz.is_public == True)
            .where(Quiz.is_published == True)
            .where(Quiz.created_at >= since)
            .order_by(desc(Quiz.total_plays))
            .limit(limit)
        )
        quiz_result = await db.execute(quiz_stmt)
        trending_quizzes = quiz_result.unique().scalars().all()

        return {
            "trending_quizzes": [
                {
                    "id": q.id,
                    "title": q.title,
                    "total_plays": q.total_plays or 0,
                    "share_code": q.share_code,
                    "author": {
                        "username": q.user.username if q.user else "Anonyme"
                    }
                }
                for q in trending_quizzes
            ]
        }


# Instance globale
explore_service = ExploreService()
