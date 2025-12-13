"""
API Explore - Découverte de contenu public
==========================================

Permet aux utilisateurs de:
- Rechercher du contenu public (notes, flashcards, quizzes)
- Filtrer par type, matière, tags
- Voir les tendances et matières populaires
- Rendre son propre contenu public/privé
"""

import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_active_user, get_current_user_optional
from app.models.user import User
from app.models.note import Note
from app.models.flashcard import Flashcard
from app.models.quiz import Quiz
from app.services.explore_service import explore_service
from app.schemas.explore import (
    ExploreSearchResponse,
    PopularSubjectsResponse,
    TrendingContentResponse,
    MakePublicRequest,
    MakePublicResponse,
    ContentType,
    SortBy
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/search", response_model=ExploreSearchResponse)
async def search_public_content(
    content_type: ContentType = Query("all", description="Type de contenu à rechercher"),
    q: Optional[str] = Query(None, min_length=1, max_length=200, description="Terme de recherche"),
    subject_id: Optional[int] = Query(None, description="Filtrer par ID de matière"),
    subject_name: Optional[str] = Query(None, description="Filtrer par nom de matière"),
    tags: Optional[str] = Query(None, description="Tags séparés par virgule"),
    sort_by: SortBy = Query("recent", description="Tri: recent, popular, rating"),
    page: int = Query(1, ge=1, description="Numéro de page"),
    limit: int = Query(20, ge=1, le=50, description="Nombre de résultats par page"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Recherche de contenu public avec filtres

    - **content_type**: all, notes, flashcards, quizzes
    - **q**: Terme de recherche (titre, contenu)
    - **subject_id**: Filtrer par matière (ID)
    - **subject_name**: Filtrer par nom de matière
    - **tags**: Tags séparés par virgule
    - **sort_by**: recent (défaut), popular, rating
    - **page**: Pagination (défaut: 1)
    - **limit**: Résultats par page (défaut: 20, max: 50)
    """
    # Parser les tags si fournis
    tags_list = None
    if tags:
        tags_list = [t.strip() for t in tags.split(",") if t.strip()]

    result = await explore_service.search_public_content(
        db=db,
        content_type=content_type,
        query=q,
        subject_id=subject_id,
        subject_name=subject_name,
        tags=tags_list,
        sort_by=sort_by,
        page=page,
        limit=limit,
        user_id=current_user.id if current_user else None
    )

    return result


@router.get("/subjects/popular", response_model=PopularSubjectsResponse)
async def get_popular_subjects(
    limit: int = Query(10, ge=1, le=30, description="Nombre de matières à retourner"),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupère les matières les plus populaires avec du contenu public

    Utile pour afficher des filtres rapides sur la page Explore
    """
    subjects = await explore_service.get_popular_subjects(db, limit=limit)
    return {"subjects": subjects}


@router.get("/trending", response_model=TrendingContentResponse)
async def get_trending_content(
    days: int = Query(7, ge=1, le=30, description="Période en jours"),
    limit: int = Query(10, ge=1, le=20, description="Nombre de résultats"),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupère le contenu tendance (populaire récemment)

    - **days**: Période à considérer (défaut: 7 jours)
    - **limit**: Nombre de résultats (défaut: 10)
    """
    result = await explore_service.get_trending_content(db, days=days, limit=limit)
    return result


# ================== Actions pour rendre public ==================

@router.patch("/notes/{note_id}/visibility", response_model=MakePublicResponse)
async def toggle_note_visibility(
    note_id: int,
    request: MakePublicRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Rendre une note publique ou privée

    Seul le propriétaire peut modifier la visibilité
    """
    # Récupérer la note
    stmt = select(Note).where(Note.id == note_id, Note.user_id == current_user.id)
    result = await db.execute(stmt)
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note non trouvée ou vous n'êtes pas le propriétaire"
        )

    note.is_public = request.is_public
    await db.commit()

    action = "publique" if request.is_public else "privée"
    logger.info(f"Note {note_id} rendue {action} par user {current_user.id}")

    return {
        "success": True,
        "message": f"Note rendue {action} avec succès",
        "is_public": note.is_public
    }


@router.patch("/flashcards/deck/visibility", response_model=MakePublicResponse)
async def toggle_flashcard_deck_visibility(
    deck_name: str = Query(..., description="Nom du deck"),
    subject_id: int = Query(..., description="ID de la matière"),
    request: MakePublicRequest = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Rendre un deck de flashcards public ou privé

    Modifie toutes les cartes du deck
    """
    if request is None:
        request = MakePublicRequest()

    # Récupérer toutes les flashcards du deck
    stmt = select(Flashcard).where(
        Flashcard.deck_name == deck_name,
        Flashcard.subject_id == subject_id,
        Flashcard.user_id == current_user.id
    )
    result = await db.execute(stmt)
    flashcards = result.scalars().all()

    if not flashcards:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deck non trouvé ou vous n'êtes pas le propriétaire"
        )

    # Mettre à jour toutes les cartes
    for card in flashcards:
        card.is_public = request.is_public

    await db.commit()

    action = "public" if request.is_public else "privé"
    logger.info(f"Deck '{deck_name}' ({len(flashcards)} cartes) rendu {action} par user {current_user.id}")

    return {
        "success": True,
        "message": f"Deck rendu {action} avec succès ({len(flashcards)} cartes)",
        "is_public": request.is_public
    }


@router.patch("/quizzes/{quiz_id}/visibility", response_model=MakePublicResponse)
async def toggle_quiz_visibility(
    quiz_id: int,
    request: MakePublicRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Rendre un quiz public ou privé

    Un quiz public doit aussi être publié (is_published=True)
    """
    # Récupérer le quiz
    stmt = select(Quiz).where(Quiz.id == quiz_id, Quiz.user_id == current_user.id)
    result = await db.execute(stmt)
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz non trouvé ou vous n'êtes pas le propriétaire"
        )

    quiz.is_public = request.is_public

    # Si on rend public, s'assurer qu'il est publié
    if request.is_public and not quiz.is_published:
        quiz.is_published = True

    await db.commit()

    action = "public" if request.is_public else "privé"
    logger.info(f"Quiz {quiz_id} rendu {action} par user {current_user.id}")

    return {
        "success": True,
        "message": f"Quiz rendu {action} avec succès",
        "is_public": quiz.is_public
    }


@router.get("/my-public-content")
async def get_my_public_content(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupère tout le contenu public de l'utilisateur connecté

    Utile pour gérer sa visibilité
    """
    # Notes publiques
    notes_stmt = select(Note).where(
        Note.user_id == current_user.id,
        Note.is_public == True
    )
    notes_result = await db.execute(notes_stmt)
    public_notes = notes_result.scalars().all()

    # Flashcards publiques (groupées par deck)
    flashcards_stmt = select(Flashcard).where(
        Flashcard.user_id == current_user.id,
        Flashcard.is_public == True
    )
    flashcards_result = await db.execute(flashcards_stmt)
    public_flashcards = flashcards_result.scalars().all()

    # Grouper par deck
    decks = {}
    for card in public_flashcards:
        deck_key = card.deck_name or "Sans deck"
        if deck_key not in decks:
            decks[deck_key] = {"deck_name": deck_key, "subject_id": card.subject_id, "card_count": 0}
        decks[deck_key]["card_count"] += 1

    # Quizzes publics
    quizzes_stmt = select(Quiz).where(
        Quiz.user_id == current_user.id,
        Quiz.is_public == True
    )
    quizzes_result = await db.execute(quizzes_stmt)
    public_quizzes = quizzes_result.scalars().all()

    return {
        "notes": [
            {"id": n.id, "title": n.title, "created_at": n.created_at.isoformat() if n.created_at else None}
            for n in public_notes
        ],
        "flashcard_decks": list(decks.values()),
        "quizzes": [
            {
                "id": q.id,
                "title": q.title,
                "total_plays": q.total_plays or 0,
                "share_code": q.share_code
            }
            for q in public_quizzes
        ],
        "counts": {
            "notes": len(public_notes),
            "flashcard_decks": len(decks),
            "quizzes": len(public_quizzes)
        }
    }
