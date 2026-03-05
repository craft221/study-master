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
from sqlalchemy.orm import selectinload

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
    ReportContentRequest,
    ReportContentResponse,
    DuplicateContentRequest,
    DuplicateContentResponse,
    ContentType,
    SortBy,
    Language
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
    language: Language = Query("all", description="Filtrer par langue: fr, en, es, all"),
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
    - **language**: Filtrer par langue (fr, en, es) ou all pour tout
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
        language=language,
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
    # Gérer le cas spécial "Sans deck" pour les flashcards sans deck_name
    from sqlalchemy import or_

    if deck_name == "Sans deck":
        deck_condition = or_(
            Flashcard.deck_name.is_(None),
            Flashcard.deck_name == "Sans deck"
        )
    else:
        deck_condition = Flashcard.deck_name == deck_name

    stmt = select(Flashcard).where(
        deck_condition,
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


# ================== Signalement de contenu ==================

@router.post("/report", response_model=ReportContentResponse)
async def report_content(
    request: ReportContentRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Signaler un contenu public inapproprié

    - **content_type**: notes, flashcards, quizzes
    - **content_id**: ID du contenu à signaler
    - **reason**: inappropriate, spam, harassment, copyright, misinformation, other
    - **description**: Description optionnelle du problème
    """
    from app.models.content_report import ContentReport, ContentType as ReportContentType, ReportReason, ReportStatus

    # Vérifier que le contenu existe et est public
    content_title = None
    content_owner_id = None

    if request.content_type == "notes":
        stmt = select(Note).where(Note.id == request.content_id, Note.is_public == True)
        result = await db.execute(stmt)
        content = result.scalar_one_or_none()
        if content:
            content_title = content.title
            content_owner_id = content.user_id
        report_type = ReportContentType.NOTE

    elif request.content_type == "flashcards":
        # Pour les flashcards, on signale via un deck (première carte trouvée)
        stmt = select(Flashcard).where(Flashcard.id == request.content_id, Flashcard.is_public == True)
        result = await db.execute(stmt)
        content = result.scalar_one_or_none()
        if content:
            content_title = content.deck_name or f"Flashcard #{content.id}"
            content_owner_id = content.user_id
        report_type = ReportContentType.FLASHCARD_DECK

    elif request.content_type == "quizzes":
        stmt = select(Quiz).where(Quiz.id == request.content_id, Quiz.is_public == True)
        result = await db.execute(stmt)
        content = result.scalar_one_or_none()
        if content:
            content_title = content.title
            content_owner_id = content.user_id
        report_type = ReportContentType.QUIZ

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type de contenu invalide"
        )

    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contenu non trouvé ou non public"
        )

    # Vérifier que l'utilisateur ne signale pas son propre contenu
    if content_owner_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas signaler votre propre contenu"
        )

    # Mapper le reason string vers l'enum
    reason_map = {
        "inappropriate": ReportReason.INAPPROPRIATE,
        "spam": ReportReason.SPAM,
        "harassment": ReportReason.HARASSMENT,
        "copyright": ReportReason.COPYRIGHT,
        "misinformation": ReportReason.MISINFORMATION,
        "other": ReportReason.OTHER
    }

    # Créer le signalement
    report = ContentReport(
        reporter_id=current_user.id,
        content_type=report_type,
        content_id=request.content_id,
        content_title=content_title,
        content_owner_id=content_owner_id,
        reason=reason_map.get(request.reason, ReportReason.OTHER),
        description=request.description,
        status=ReportStatus.PENDING
    )

    db.add(report)
    await db.commit()
    await db.refresh(report)

    logger.info(f"Contenu signalé: {request.content_type} #{request.content_id} par user {current_user.id}")

    return {
        "success": True,
        "message": "Signalement enregistré. Notre équipe va examiner ce contenu.",
        "report_id": report.id
    }


# ================== Duplication de contenu ==================

@router.post("/duplicate", response_model=DuplicateContentResponse)
async def duplicate_content(
    request: DuplicateContentRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Dupliquer un contenu public dans sa bibliothèque personnelle

    - **content_type**: notes, flashcards, quizzes
    - **content_id**: ID du contenu à dupliquer
    - Pour les flashcards par deck_name: fournir deck_name, deck_owner_id, deck_subject_id
    """
    from app.models.flashcard import FlashcardDeck
    from app.models.quiz import QuizQuestion
    from app.models.subject import Subject

    async def get_or_create_subject_for_user(original_subject_id: int, user_id: int) -> int:
        """Trouve ou crée un subject similaire pour l'utilisateur courant"""
        # Récupérer le subject original pour obtenir son nom
        orig_subject = await db.get(Subject, original_subject_id)
        if not orig_subject:
            raise HTTPException(status_code=404, detail="Matière source non trouvée")

        # Vérifier si l'utilisateur a déjà un subject avec le même nom
        existing = await db.execute(
            select(Subject).where(
                Subject.user_id == user_id,
                Subject.name == orig_subject.name
            )
        )
        user_subject = existing.scalar_one_or_none()
        if user_subject:
            return user_subject.id

        # Créer un nouveau subject pour l'utilisateur
        new_subject = Subject(
            name=orig_subject.name,
            color=orig_subject.color,
            icon=orig_subject.icon,
            user_id=user_id
        )
        db.add(new_subject)
        await db.flush()
        return new_subject.id

    if request.content_type == "notes":
        # Récupérer la note publique
        stmt = select(Note).where(Note.id == request.content_id, Note.is_public == True)
        result = await db.execute(stmt)
        original = result.scalar_one_or_none()

        if not original:
            raise HTTPException(status_code=404, detail="Note non trouvée ou non publique")

        # Trouver ou créer le subject pour l'utilisateur courant
        user_subject_id = await get_or_create_subject_for_user(original.subject_id, current_user.id)

        # Créer une copie
        new_note = Note(
            title=f"{original.title} (copie)",
            content=original.content,
            subject_id=user_subject_id,
            user_id=current_user.id,
            tags=original.tags,
            language=original.language or "fr",
            is_public=False
        )
        db.add(new_note)
        await db.commit()
        await db.refresh(new_note)

        logger.info(f"Note #{original.id} dupliquée vers #{new_note.id} par user {current_user.id}")

        return {
            "success": True,
            "message": "Note dupliquée avec succès",
            "new_content_id": new_note.id,
            "content_type": "note"
        }

    elif request.content_type == "flashcards":
        # Dupliquer un deck de flashcards
        if request.deck_name and request.deck_owner_id and request.deck_subject_id:
            # Récupérer par deck_name
            stmt = select(Flashcard).where(
                Flashcard.deck_name == request.deck_name,
                Flashcard.user_id == request.deck_owner_id,
                Flashcard.subject_id == request.deck_subject_id,
                Flashcard.is_public == True
            )
        else:
            # Récupérer une flashcard par ID pour trouver le deck
            stmt = select(Flashcard).where(
                Flashcard.id == request.content_id,
                Flashcard.is_public == True
            )

        result = await db.execute(stmt)
        flashcards = result.scalars().all()

        if not flashcards:
            raise HTTPException(status_code=404, detail="Flashcards non trouvées ou non publiques")

        # Si on a une seule flashcard, récupérer tout le deck
        if len(flashcards) == 1 and flashcards[0].deck_name:
            first_card = flashcards[0]
            stmt = select(Flashcard).where(
                Flashcard.deck_name == first_card.deck_name,
                Flashcard.user_id == first_card.user_id,
                Flashcard.subject_id == first_card.subject_id,
                Flashcard.is_public == True
            )
            result = await db.execute(stmt)
            flashcards = result.scalars().all()

        # Trouver ou créer le subject pour l'utilisateur courant
        user_subject_id = await get_or_create_subject_for_user(flashcards[0].subject_id, current_user.id)

        # Créer les copies
        new_deck_name = f"{flashcards[0].deck_name} (copie)" if flashcards[0].deck_name else "Deck copié"
        new_cards = []

        for card in flashcards:
            new_card = Flashcard(
                front=card.front,
                back=card.back,
                hint=card.hint,
                explanation=card.explanation,
                subject_id=user_subject_id,
                user_id=current_user.id,
                deck_name=new_deck_name,
                language=card.language or "fr",
                is_public=False
            )
            db.add(new_card)
            new_cards.append(new_card)

        await db.commit()

        logger.info(f"Deck '{flashcards[0].deck_name}' ({len(new_cards)} cartes) dupliqué par user {current_user.id}")

        return {
            "success": True,
            "message": f"Deck dupliqué avec succès ({len(new_cards)} cartes)",
            "new_content_id": new_cards[0].id if new_cards else 0,
            "content_type": "flashcard_deck"
        }

    elif request.content_type == "quizzes":
        # Récupérer le quiz public avec ses questions
        stmt = (
            select(Quiz)
            .options(selectinload(Quiz.questions))
            .where(Quiz.id == request.content_id, Quiz.is_public == True)
        )
        result = await db.execute(stmt)
        original = result.scalar_one_or_none()

        if not original:
            raise HTTPException(status_code=404, detail="Quiz non trouvé ou non public")

        # Trouver ou créer le subject pour l'utilisateur courant
        user_subject_id = await get_or_create_subject_for_user(original.subject_id, current_user.id)

        # Créer une copie du quiz
        new_quiz = Quiz(
            title=f"{original.title} (copie)",
            description=original.description,
            subject_id=user_subject_id,
            user_id=current_user.id,
            quiz_type=original.quiz_type,
            difficulty=original.difficulty,
            time_limit_minutes=original.time_limit_minutes,
            is_timed=original.is_timed,
            passing_score=original.passing_score,
            randomize_questions=original.randomize_questions,
            randomize_options=original.randomize_options,
            language=original.language or "fr",
            is_public=False,
            is_published=False
        )
        db.add(new_quiz)
        await db.flush()  # Pour obtenir l'ID

        # Copier les questions
        for q in original.questions:
            new_question = QuizQuestion(
                quiz_id=new_quiz.id,
                question=q.question,
                question_type=q.question_type,
                options=q.options,
                correct_answer=q.correct_answer,
                explanation=q.explanation,
                points=q.points,
                order=q.order
            )
            db.add(new_question)

        await db.commit()
        await db.refresh(new_quiz)

        logger.info(f"Quiz #{original.id} dupliqué vers #{new_quiz.id} par user {current_user.id}")

        return {
            "success": True,
            "message": f"Quiz dupliqué avec succès ({len(original.questions)} questions)",
            "new_content_id": new_quiz.id,
            "content_type": "quiz"
        }

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type de contenu invalide"
        )


# ================== Récupérer une note publique ==================

@router.get("/notes/{note_id}")
async def get_public_note(
    note_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupérer une note publique par son ID
    """
    from sqlalchemy.orm import selectinload

    stmt = (
        select(Note)
        .options(
            selectinload(Note.user),
            selectinload(Note.subject)
        )
        .where(Note.id == note_id, Note.is_public == True)
    )
    result = await db.execute(stmt)
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(status_code=404, detail="Note non trouvée ou non publique")

    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "tags": note.tags or [],
        "language": note.language or "fr",
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
        "created_at": note.created_at.isoformat() if note.created_at else None
    }
