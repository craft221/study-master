import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import timedelta

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.subject import Subject
from app.models.flashcard import Flashcard, FlashcardDeck, FlashcardReview, FlashcardStatus
from app.schemas.flashcard import (
    FlashcardCreate,
    FlashcardUpdate,
    FlashcardResponse,
    FlashcardListResponse,
    FlashcardReviewRequest,
    FlashcardReviewResponse,
    FlashcardStatsResponse,
    FlashcardReviewHistoryResponse,
    FlashcardDeckResponse
)
from app.services.fsrs_service import (
    FSRSScheduler,
    FSRSCard,
    FSRSParameters,
    Rating,
    State,
    create_fsrs_card_from_flashcard,
    format_interval_display
)
from app.core.sql_utils import escape_like_pattern
from app.services.daily_quest_service import daily_quest_service
from app.models.daily_quest import QuestType

router = APIRouter()

# Instance globale du scheduler FSRS avec paramètres optimisés
fsrs_scheduler = FSRSScheduler(FSRSParameters.default())


@router.get("/decks", response_model=List[FlashcardDeckResponse])
async def list_flashcard_decks(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer la liste des decks de flashcards avec statistiques"""

    # Récupérer toutes les flashcards de l'utilisateur avec leurs subjects et decks préchargés
    result = await db.execute(
        select(Flashcard)
        .where(Flashcard.user_id == current_user.id)
        .options(selectinload(Flashcard.subject), selectinload(Flashcard.deck))
        .order_by(Flashcard.created_at.desc())
    )
    all_flashcards = result.scalars().all()

    # Aussi récupérer les FlashcardDeck (table) de l'utilisateur
    deck_table_result = await db.execute(
        select(FlashcardDeck)
        .where(FlashcardDeck.user_id == current_user.id)
        .options(selectinload(FlashcardDeck.flashcards))
    )
    all_deck_objects = deck_table_result.scalars().all()
    # Index des FlashcardDeck par id pour lookup rapide
    deck_objects_by_id = {d.id: d for d in all_deck_objects}
    deck_objects_by_name = {d.name: d for d in all_deck_objects}

    # Grouper les cartes par deck (résoudre via deck relation si deck_name est null)
    decks_dict = {}
    seen_deck_obj_ids = set()  # Track des FlashcardDeck déjà vus via les cartes

    for card in all_flashcards:
        # Résoudre le nom du deck: deck_name legacy > FlashcardDeck.name > "Sans deck"
        deck_name = card.deck_name or (card.deck.name if card.deck else None) or "Sans deck"

        # Tracker le FlashcardDeck associé
        if card.deck_id:
            seen_deck_obj_ids.add(card.deck_id)

        if deck_name not in decks_dict:
            decks_dict[deck_name] = {
                "cards": [],
                "subject_id": card.subject_id,
                "subject": card.subject,
                "created_at": card.created_at,
                "last_reviewed_at": card.last_reviewed_at
            }

        decks_dict[deck_name]["cards"].append(card)

        if card.last_reviewed_at:
            if not decks_dict[deck_name]["last_reviewed_at"] or card.last_reviewed_at > decks_dict[deck_name]["last_reviewed_at"]:
                decks_dict[deck_name]["last_reviewed_at"] = card.last_reviewed_at

    # Ajouter les FlashcardDeck qui n'ont PAS de cartes (ou dont les cartes n'ont pas été trouvées)
    for deck_obj in all_deck_objects:
        if deck_obj.id not in seen_deck_obj_ids and deck_obj.name not in decks_dict:
            # Deck de la table flashcard_decks sans cartes associées
            # Vérifier s'il a des cartes via la relation
            deck_cards = [c for c in deck_obj.flashcards if c.user_id == current_user.id]
            if deck_cards:
                # Il a des cartes via deck_id, les ajouter
                decks_dict[deck_obj.name] = {
                    "cards": deck_cards,
                    "subject_id": deck_obj.subject_id,
                    "subject": deck_cards[0].subject if deck_cards else None,
                    "created_at": deck_obj.created_at,
                    "last_reviewed_at": max((c.last_reviewed_at for c in deck_cards if c.last_reviewed_at), default=None)
                }
            else:
                # Deck vide - l'inclure quand même pour que l'utilisateur puisse le supprimer
                decks_dict[deck_obj.name] = {
                    "cards": [],
                    "subject_id": deck_obj.subject_id,
                    "subject": None,
                    "created_at": deck_obj.created_at,
                    "last_reviewed_at": None
                }

    # Construire la réponse
    now = utc_now()
    decks_response = []
    for deck_name, deck_data in decks_dict.items():
        cards = deck_data["cards"]
        total_cards = len(cards)
        cards_due = sum(1 for card in cards if not card.next_review_at or card.next_review_at <= now)
        mastered_cards = sum(1 for card in cards if card.mastery_percentage >= 80)

        subject = None
        subject_obj = deck_data["subject"]
        if subject_obj:
            subject = {
                "id": subject_obj.id,
                "name": subject_obj.name,
                "color": subject_obj.color
            }

        decks_response.append({
            "id": deck_name,
            "title": deck_name,
            "description": f"{total_cards} carte{'s' if total_cards > 1 else ''}",
            "subject_id": deck_data["subject_id"],
            "subject": subject,
            "total_cards": total_cards,
            "cards_due": cards_due,
            "mastered_cards": mastered_cards,
            "created_at": deck_data["created_at"],
            "last_reviewed_at": deck_data["last_reviewed_at"]
        })

    logger.warning(f"[LIST DECKS] user={current_user.id}, decks from cards: {list(decks_dict.keys())}, FlashcardDeck objects: {[(d.id, d.name) for d in all_deck_objects]}")

    return decks_response


@router.get("/decks/{deck_name}")
async def get_flashcard_deck(
    deck_name: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer un deck spécifique avec toutes ses cartes"""

    # Gérer le cas spécial "Sans deck" pour les flashcards sans deck_name
    if deck_name == "Sans deck":
        # Chercher les flashcards avec deck_name NULL et sans deck_id
        result = await db.execute(
            select(Flashcard)
            .where(
                and_(
                    Flashcard.user_id == current_user.id,
                    Flashcard.deck_name.is_(None),
                    Flashcard.deck_id.is_(None)
                )
            )
            .order_by(Flashcard.created_at.desc())
        )
    else:
        # Chercher par deck_name OU par FlashcardDeck.name via deck_id
        deck_obj = await db.execute(
            select(FlashcardDeck).where(
                and_(
                    FlashcardDeck.user_id == current_user.id,
                    FlashcardDeck.name == deck_name
                )
            )
        )
        deck_obj = deck_obj.scalar_one_or_none()

        if deck_obj:
            deck_condition = or_(
                Flashcard.deck_id == deck_obj.id,
                Flashcard.deck_name == deck_name
            )
        else:
            deck_condition = Flashcard.deck_name == deck_name

        result = await db.execute(
            select(Flashcard)
            .where(
                and_(
                    Flashcard.user_id == current_user.id,
                    deck_condition
                )
            )
            .order_by(Flashcard.created_at.desc())
        )
    cards = result.scalars().all()

    if not cards:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deck non trouvé"
        )

    # Statistiques
    total_cards = len(cards)
    now = utc_now()
    # Inclut les nouvelles cartes (next_review_at NULL ou <= maintenant)
    cards_due = sum(1 for card in cards if not card.next_review_at or card.next_review_at <= now)
    mastered_cards = sum(1 for card in cards if card.mastery_percentage >= 80)

    # Charger le subject de la première carte
    subject_data = None
    if cards[0].subject_id:
        subject_result = await db.execute(
            select(Subject).where(Subject.id == cards[0].subject_id)
        )
        subject = subject_result.scalar_one_or_none()
        if subject:
            subject_data = {
                "id": subject.id,
                "name": subject.name,
                "color": subject.color
            }

    # Construire la réponse avec métriques FSRS
    # Récupérer subject_id et is_public de la première carte
    first_card = cards[0]
    deck_subject_id = first_card.subject_id
    deck_is_public = any(card.is_public for card in cards) if hasattr(first_card, 'is_public') else False

    return {
        "id": deck_name,
        "title": deck_name,
        "description": f"{total_cards} carte{'s' if total_cards > 1 else ''}",
        "subject": subject_data,
        "subject_id": deck_subject_id,
        "is_public": deck_is_public,
        "algorithm": "FSRS",
        "cards": [
            {
                "id": card.id,
                "front": card.front,
                "back": card.back,
                "hint": card.hint,
                "explanation": card.explanation,
                "difficulty": card.difficulty if hasattr(card, 'difficulty') else None,
                "easiness_factor": card.ease_factor,
                "interval": card.interval,
                "repetitions": card.repetitions,
                "next_review_at": card.next_review_at,
                "mastery_percentage": card.mastery_percentage,
                "status": card.status.value if card.status else "new",
                # FSRS metrics
                "stability": getattr(card, 'stability', 0) or 0,
                "fsrs_difficulty": getattr(card, 'fsrs_difficulty', 5) or 5,
                "lapses": getattr(card, 'lapses', 0) or 0
            }
            for card in cards
        ],
        "total_cards": total_cards,
        "cards_due": cards_due,
        "mastered_cards": mastered_cards,
        "created_at": cards[0].created_at,
        "last_reviewed_at": max((card.last_reviewed_at for card in cards if card.last_reviewed_at), default=None)
    }


@router.post("/decks/{deck_name}/cards", response_model=FlashcardResponse, status_code=status.HTTP_201_CREATED)
async def add_card_to_deck(
    deck_name: str,
    card_data: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Ajouter une carte à un deck existant"""

    # Chercher par deck_name OU par FlashcardDeck.name via deck_id
    deck_obj_result = await db.execute(
        select(FlashcardDeck).where(
            and_(
                FlashcardDeck.user_id == current_user.id,
                FlashcardDeck.name == deck_name
            )
        )
    )
    deck_obj = deck_obj_result.scalar_one_or_none()

    if deck_obj:
        deck_condition = or_(
            Flashcard.deck_id == deck_obj.id,
            Flashcard.deck_name == deck_name
        )
    else:
        deck_condition = Flashcard.deck_name == deck_name

    # Récupérer une carte du deck pour obtenir le subject_id
    result = await db.execute(
        select(Flashcard)
        .where(
            and_(
                Flashcard.user_id == current_user.id,
                deck_condition
            )
        )
        .limit(1)
    )
    existing_card = result.scalar_one_or_none()

    subject_id = existing_card.subject_id if existing_card else (deck_obj.subject_id if deck_obj else None)

    if not subject_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de déterminer la matière du deck"
        )

    # Créer la nouvelle flashcard
    now = utc_now()
    new_flashcard = Flashcard(
        user_id=current_user.id,
        subject_id=subject_id,
        deck_name=deck_name,
        front=card_data.get("front", ""),
        back=card_data.get("back", ""),
        hint=card_data.get("hint"),
        explanation=card_data.get("explanation"),
        next_review_at=now,  # Disponible immédiatement pour révision
        due_date=now
    )

    db.add(new_flashcard)

    # Mettre à jour les statistiques
    result = await db.execute(
        select(Subject).where(Subject.id == subject_id)
    )
    subject = result.scalar_one_or_none()
    if subject:
        subject.total_flashcards_count += 1

    # Attribuer XP via le service centralisé (gère level up + notifications)
    from app.services.xp_service import award_xp
    await award_xp(
        user=current_user,
        amount=5,
        reason="Création de flashcard",
        event_type="flashcard_created",
        db=db
    )

    if current_user.stats:
        current_user.stats.total_flashcards_created += 1

    await db.commit()
    await db.refresh(new_flashcard)

    return new_flashcard


@router.delete("/decks/{deck_name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deck(
    deck_name: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprimer un deck et toutes ses cartes"""

    logger.warning(f"[DELETE DECK] user={current_user.id}, deck_name='{deck_name}' (repr: {repr(deck_name)})")

    # Chercher le FlashcardDeck (table) correspondant
    deck_obj = None
    if deck_name != "Sans deck":
        # Lister tous les FlashcardDeck de l'utilisateur pour debug
        all_fd_result = await db.execute(
            select(FlashcardDeck).where(FlashcardDeck.user_id == current_user.id)
        )
        all_fd = all_fd_result.scalars().all()
        logger.warning(f"[DELETE DECK] All FlashcardDecks for user: {[(d.id, repr(d.name)) for d in all_fd]}")

        # Chercher par nom exact
        for d in all_fd:
            if d.name == deck_name:
                deck_obj = d
                break

        # Si pas trouvé, chercher par nom strippé (espaces/encodage)
        if not deck_obj:
            for d in all_fd:
                if d.name and d.name.strip() == deck_name.strip():
                    deck_obj = d
                    break

        logger.warning(f"[DELETE DECK] FlashcardDeck found: {deck_obj is not None} (id={deck_obj.id if deck_obj else 'N/A'})")

    # Récupérer toutes les flashcards du deck
    # Cas spécial: "Sans deck" correspond aux cartes avec deck_name NULL
    if deck_name == "Sans deck":
        deck_condition = or_(
            Flashcard.deck_name == None,
            Flashcard.deck_name == "Sans deck"
        )
    elif deck_obj:
        # Deck trouvé dans la table flashcard_decks -> chercher par deck_id OU deck_name
        deck_condition = or_(
            Flashcard.deck_id == deck_obj.id,
            Flashcard.deck_name == deck_name
        )
    else:
        deck_condition = Flashcard.deck_name == deck_name

    result = await db.execute(
        select(Flashcard)
        .where(
            and_(
                Flashcard.user_id == current_user.id,
                deck_condition
            )
        )
    )
    cards = result.scalars().all()
    logger.warning(f"[DELETE DECK] Cards found: {len(cards)}")

    if not cards:
        # Lister tous les deck_name et deck_id de l'utilisateur pour debug
        all_cards = await db.execute(
            select(Flashcard.deck_name, Flashcard.deck_id)
            .where(Flashcard.user_id == current_user.id)
            .distinct()
        )
        all_decks = all_cards.all()
        logger.warning(f"[DELETE DECK] 404! Existing deck_names for user: {[(d.deck_name, d.deck_id) for d in all_decks]}")

        # Supprimer le FlashcardDeck vide (sans cartes) s'il existe
        if deck_obj:
            logger.warning(f"[DELETE DECK] Deleting empty FlashcardDeck id={deck_obj.id}")
            await db.delete(deck_obj)
            await db.commit()
            return None

        # Aussi chercher par LIKE au cas où le nom diffère légèrement (encodage unicode, etc.)
        if deck_name != "Sans deck":
            like_result = await db.execute(
                select(FlashcardDeck).where(
                    and_(
                        FlashcardDeck.user_id == current_user.id,
                        FlashcardDeck.name.ilike(f"%{deck_name[:20]}%")
                    )
                )
            )
            similar_decks = like_result.scalars().all()
            if similar_decks:
                logger.warning(f"[DELETE DECK] Found similar FlashcardDecks by LIKE: {[(d.id, repr(d.name)) for d in similar_decks]}")
                for d in similar_decks:
                    await db.delete(d)
                await db.commit()
                return None

        # Deck n'existe nulle part -> retourner 204 (idempotent delete)
        logger.warning(f"[DELETE DECK] Deck not found anywhere, returning 204 (idempotent)")
        return None

    # Récupérer le subject pour mettre à jour les stats
    subject_id = cards[0].subject_id
    result = await db.execute(
        select(Subject).where(Subject.id == subject_id)
    )
    subject = result.scalar_one_or_none()

    # Supprimer toutes les cartes
    cards_count = len(cards)
    for card in cards:
        await db.delete(card)

    # Supprimer aussi le FlashcardDeck s'il existe
    if deck_obj:
        await db.delete(deck_obj)

    # Mettre à jour les stats de la matière
    if subject:
        subject.total_flashcards_count = max(0, subject.total_flashcards_count - cards_count)

    await db.commit()

    return None


@router.get("/decks/{deck_name}/due")
async def get_deck_due_cards(
    deck_name: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les cartes à réviser d'un deck"""

    now = utc_now()

    # Gérer le cas spécial "Sans deck" pour les flashcards sans deck_name
    if deck_name == "Sans deck":
        deck_condition = Flashcard.deck_name.is_(None)
    else:
        # Chercher par deck_name OU par FlashcardDeck.name via deck_id
        deck_obj_result = await db.execute(
            select(FlashcardDeck).where(
                and_(
                    FlashcardDeck.user_id == current_user.id,
                    FlashcardDeck.name == deck_name
                )
            )
        )
        deck_obj = deck_obj_result.scalar_one_or_none()
        if deck_obj:
            deck_condition = or_(
                Flashcard.deck_id == deck_obj.id,
                Flashcard.deck_name == deck_name
            )
        else:
            deck_condition = Flashcard.deck_name == deck_name

    # Récupérer les flashcards à réviser du deck
    result = await db.execute(
        select(Flashcard)
        .where(
            and_(
                Flashcard.user_id == current_user.id,
                deck_condition,
                or_(
                    Flashcard.next_review_at.is_(None),
                    Flashcard.next_review_at <= now
                )
            )
        )
        .order_by(Flashcard.next_review_at.asc().nulls_first())
    )
    cards = result.scalars().all()

    return [
        {
            "id": card.id,
            "front": card.front,
            "back": card.back,
            "hint": card.hint,
            "explanation": card.explanation,
            "difficulty": card.difficulty if hasattr(card, 'difficulty') else 0,
            "next_review_at": card.next_review_at,
            "mastery_percentage": card.mastery_percentage,
            "status": card.status.value if card.status else "new",
            # FSRS metrics
            "stability": getattr(card, 'stability', 0) or 0,
            "fsrs_difficulty": getattr(card, 'fsrs_difficulty', 5) or 5,
            "lapses": getattr(card, 'lapses', 0) or 0
        }
        for card in cards
    ]


class ReviewRequest(BaseModel):
    quality: int = Field(..., ge=0, le=3, description="0=Again, 1=Hard, 2=Good, 3=Easy")
    review_date: Optional[str] = None
    response_time_seconds: Optional[float] = None


@router.post("/{card_id}/review")
async def review_flashcard(
    card_id: int,
    review_data: ReviewRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Soumettre une révision de flashcard avec algorithme FSRS.

    L'algorithme FSRS (Free Spaced Repetition Scheduler) est un système
    moderne de répétition espacée qui offre ~30% moins de révisions
    pour le même taux de rétention comparé à SM-2.

    Quality ratings:
    - 0 (Again): Échec complet, la carte sera revue très bientôt
    - 1 (Hard): Difficile mais correct, intervalle court
    - 2 (Good): Correct avec effort normal, intervalle standard
    - 3 (Easy): Facile, intervalle plus long
    """

    quality = review_data.quality

    # Récupérer la flashcard
    result = await db.execute(
        select(Flashcard).where(
            and_(
                Flashcard.id == card_id,
                Flashcard.user_id == current_user.id
            )
        )
    )
    card = result.scalar_one_or_none()

    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard non trouvée"
        )

    now = utc_now()

    # ============== FSRS Algorithm ==============

    # Convertir l'état de la carte vers FSRS
    status_map = {
        FlashcardStatus.NEW: "new",
        FlashcardStatus.LEARNING: "learning",
        FlashcardStatus.REVIEW: "review",
        FlashcardStatus.RELEARNING: "relearning"
    }

    # Créer une FSRSCard à partir des données actuelles
    fsrs_card = create_fsrs_card_from_flashcard(
        ease_factor=card.ease_factor,
        interval=card.interval,
        repetitions=card.repetitions,
        status=status_map.get(card.status, "new"),
        last_reviewed_at=card.last_reviewed_at,
        next_review_at=card.next_review_at,
        stability=getattr(card, 'stability', None),
        difficulty=getattr(card, 'fsrs_difficulty', None)
    )

    # Convertir la qualité en Rating FSRS
    rating = Rating(quality)

    # Exécuter l'algorithme FSRS
    new_fsrs_card, review_log = fsrs_scheduler.schedule(fsrs_card, rating, now)

    # ============== Mise à jour de la carte ==============

    # Mettre à jour les compteurs de révision
    card.total_reviews += 1
    if quality >= 2:
        card.correct_reviews += 1
    else:
        card.incorrect_reviews += 1

    # Mettre à jour les compteurs par difficulté
    if quality == 0:
        card.times_seen_as_again += 1
    elif quality == 1:
        card.times_seen_as_hard += 1
    elif quality == 2:
        card.times_seen_as_good += 1
    elif quality == 3:
        card.times_seen_as_easy += 1

    # Appliquer les résultats FSRS
    card.stability = new_fsrs_card.stability
    card.fsrs_difficulty = new_fsrs_card.difficulty
    card.interval = new_fsrs_card.scheduled_days
    card.repetitions = new_fsrs_card.reps
    card.lapses = new_fsrs_card.lapses

    # Mettre à jour le statut
    state_to_status = {
        State.NEW: FlashcardStatus.NEW,
        State.LEARNING: FlashcardStatus.LEARNING,
        State.REVIEW: FlashcardStatus.REVIEW,
        State.RELEARNING: FlashcardStatus.RELEARNING
    }
    card.status = state_to_status.get(new_fsrs_card.state, FlashcardStatus.REVIEW)

    # Calculer ease_factor de compatibilité à partir de la stabilité FSRS
    # (pour rétrocompatibilité avec l'ancien système)
    card.ease_factor = max(1.3, min(3.0, 1.3 + (new_fsrs_card.stability / 100)))

    # Mettre à jour les dates
    card.next_review_at = new_fsrs_card.due
    card.last_reviewed_at = now

    # Calculer le mastery percentage (basé sur taux de succès et stabilité)
    if card.total_reviews > 0:
        success_rate = card.correct_reviews / card.total_reviews
        stability_factor = min(1.0, new_fsrs_card.stability / 365)  # Normaliser sur 1 an
        card.mastery_percentage = min(100, (success_rate * 0.7 + stability_factor * 0.3) * 100)

    # Créer un enregistrement de révision enrichi
    review_record = FlashcardReview(
        flashcard_id=card.id,
        user_id=current_user.id,
        quality=quality,
        reviewed_at=now,
        time_taken=int(review_data.response_time_seconds) if review_data.response_time_seconds else None
    )
    db.add(review_record)

    # XP reward - bonus pour cartes difficiles bien répondues
    base_xp = 5 if quality >= 2 else 2
    difficulty_bonus = int(card.fsrs_difficulty / 3) if quality >= 2 else 0
    xp_reward = base_xp + difficulty_bonus

    # Attribuer XP via le service centralisé (gère level up + notifications)
    from app.services.xp_service import award_xp
    await award_xp(
        user=current_user,
        amount=xp_reward,
        reason="Révision de flashcard",
        event_type="flashcard_reviewed",
        db=db
    )

    if current_user.stats:
        current_user.stats.total_flashcards_reviewed += 1

    # Mettre à jour la progression des quêtes quotidiennes
    quest_result = await daily_quest_service.update_quest_progress(
        db=db,
        user_id=current_user.id,
        quest_type=QuestType.REVIEW_FLASHCARDS,
        progress=1
    )

    # Mettre à jour aussi la quête EARN_XP avec les XP gagnés
    xp_quest_result = await daily_quest_service.update_quest_progress(
        db=db,
        user_id=current_user.id,
        quest_type=QuestType.EARN_XP,
        progress=xp_reward
    )

    # Mettre à jour la quête MAINTAIN_STREAK (garder le streak actif)
    await daily_quest_service.update_quest_progress(
        db=db,
        user_id=current_user.id,
        quest_type=QuestType.MAINTAIN_STREAK,
        progress=1
    )

    # Combiner les résultats des quêtes
    if xp_quest_result and not quest_result:
        quest_result = xp_quest_result

    await db.commit()
    await db.refresh(card)

    # Obtenir les prévisions pour toutes les options (pour le frontend)
    scheduling_preview = fsrs_scheduler.get_scheduling_cards(fsrs_card, now)

    response = {
        "success": True,
        "algorithm": "FSRS",
        "xp_earned": xp_reward,
        "next_review_in_days": card.interval,
        "next_review_at": card.next_review_at.isoformat() if card.next_review_at else None,
        "interval_display": format_interval_display(card.interval),
        "mastery_percentage": round(card.mastery_percentage, 1),
        "stability": round(new_fsrs_card.stability, 2),
        "difficulty": round(new_fsrs_card.difficulty, 2),
        "retrievability": round(new_fsrs_card.retrievability * 100, 1),
        "state": card.status.value,
        "lapses": card.lapses,
        "scheduling_preview": scheduling_preview,
        "message": "Révision enregistrée avec FSRS!"
    }

    # Ajouter les infos de quête si une quête a été complétée
    if quest_result:
        response["quest_progress"] = quest_result

    return response


@router.post("/", response_model=FlashcardResponse, status_code=status.HTTP_201_CREATED)
async def create_flashcard(
    flashcard_data: FlashcardCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Créer une nouvelle flashcard"""
    
    # Vérifier que la matière existe et appartient à l'utilisateur
    result = await db.execute(
        select(Subject).where(
            and_(
                Subject.id == flashcard_data.subject_id,
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
    
    # Créer la flashcard
    now = utc_now()
    flashcard_dict = flashcard_data.model_dump()

    # Utiliser la langue de l'utilisateur si non spécifiée
    if not flashcard_dict.get("language"):
        user_lang = current_user.preferences.language if current_user.preferences else "fr"
        flashcard_dict["language"] = user_lang

    new_flashcard = Flashcard(
        user_id=current_user.id,
        next_review_at=now,  # Disponible immédiatement pour révision
        due_date=now,
        **flashcard_dict
    )

    db.add(new_flashcard)

    # Mettre à jour les statistiques utilisateur et matière
    subject.total_flashcards_count += 1

    # Attribuer XP via le service centralisé (gère level up + notifications)
    from app.services.xp_service import award_xp
    await award_xp(
        user=current_user,
        amount=5,
        reason="Création de flashcard",
        event_type="flashcard_created",
        db=db
    )

    if current_user.stats:
        current_user.stats.total_flashcards_created += 1

    # Mettre à jour la progression des quêtes quotidiennes
    await daily_quest_service.update_quest_progress(
        db=db,
        user_id=current_user.id,
        quest_type=QuestType.CREATE_FLASHCARDS,
        progress=1
    )

    await db.commit()
    await db.refresh(new_flashcard)

    return new_flashcard


@router.get("/", response_model=FlashcardListResponse)
async def list_flashcards(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    subject_id: Optional[int] = None,
    status: Optional[FlashcardStatus] = None,
    deck_name: Optional[str] = None,
    is_favorite: Optional[bool] = None,
    is_suspended: Optional[bool] = None,
    tags: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer la liste des flashcards avec filtres"""
    
    query = select(Flashcard).where(Flashcard.user_id == current_user.id)
    
    # Appliquer les filtres
    if subject_id:
        query = query.where(Flashcard.subject_id == subject_id)
    if status:
        query = query.where(Flashcard.status == status)
    if deck_name:
        query = query.where(Flashcard.deck_name == deck_name)
    if is_favorite is not None:
        query = query.where(Flashcard.is_favorite == is_favorite)
    if is_suspended is not None:
        query = query.where(Flashcard.is_suspended == is_suspended)
    if tags:
        # SÉCURITÉ: Échapper les caractères spéciaux SQL LIKE
        safe_tags = escape_like_pattern(tags)
        query = query.where(Flashcard.tags.ilike(f"%{safe_tags}%"))
    
    # Compter le total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Pagination et tri
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(Flashcard.created_at.desc())
    
    result = await db.execute(query)
    flashcards = result.scalars().all()
    
    return {
        "flashcards": flashcards,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/due", response_model=FlashcardListResponse)
async def get_due_flashcards(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    subject_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les flashcards à réviser aujourd'hui"""

    now = utc_now()
    
    query = select(Flashcard).where(
        and_(
            Flashcard.user_id == current_user.id,
            Flashcard.next_review_at <= now,
            Flashcard.is_suspended == False,
            Flashcard.is_buried == False
        )
    )
    
    # Filtre optionnel par matière
    if subject_id:
        query = query.where(Flashcard.subject_id == subject_id)
    
    # Compter le total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Pagination et tri (les plus anciennes d'abord)
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(Flashcard.next_review_at.asc())
    
    result = await db.execute(query)
    flashcards = result.scalars().all()
    
    return {
        "flashcards": flashcards,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/{flashcard_id}", response_model=FlashcardResponse)
async def get_flashcard(
    flashcard_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les détails d'une flashcard"""
    
    result = await db.execute(
        select(Flashcard).where(
            and_(
                Flashcard.id == flashcard_id,
                Flashcard.user_id == current_user.id
            )
        )
    )
    flashcard = result.scalar_one_or_none()
    
    if not flashcard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard non trouvée"
        )
    
    return flashcard


@router.get("/{flashcard_id}/preview")
async def get_review_preview(
    flashcard_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtenir une prévisualisation des intervalles FSRS pour chaque option de réponse.

    Cette endpoint permet au frontend d'afficher à l'utilisateur ce qui se passera
    selon sa réponse (Again/Hard/Good/Easy) AVANT qu'il ne choisisse.
    """
    result = await db.execute(
        select(Flashcard).where(
            and_(
                Flashcard.id == flashcard_id,
                Flashcard.user_id == current_user.id
            )
        )
    )
    flashcard = result.scalar_one_or_none()

    if not flashcard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard non trouvée"
        )

    now = utc_now()

    # Convertir vers FSRSCard
    status_map = {
        FlashcardStatus.NEW: "new",
        FlashcardStatus.LEARNING: "learning",
        FlashcardStatus.REVIEW: "review",
        FlashcardStatus.RELEARNING: "relearning"
    }

    fsrs_card = create_fsrs_card_from_flashcard(
        ease_factor=flashcard.ease_factor,
        interval=flashcard.interval,
        repetitions=flashcard.repetitions,
        status=status_map.get(flashcard.status, "new"),
        last_reviewed_at=flashcard.last_reviewed_at,
        next_review_at=flashcard.next_review_at,
        stability=getattr(flashcard, 'stability', None),
        difficulty=getattr(flashcard, 'fsrs_difficulty', None)
    )

    # Obtenir les prévisions pour toutes les options
    scheduling_preview = fsrs_scheduler.get_scheduling_cards(fsrs_card, now)

    # Calculer la récupérabilité actuelle
    current_retrievability = fsrs_card.get_retrievability(now)

    return {
        "flashcard_id": flashcard.id,
        "algorithm": "FSRS",
        "current_state": flashcard.status.value,
        "current_stability": round(getattr(flashcard, 'stability', 0) or 0, 2),
        "current_difficulty": round(getattr(flashcard, 'fsrs_difficulty', 5) or 5, 2),
        "current_retrievability": round(current_retrievability * 100, 1),
        "scheduling_options": {
            "again": {
                **scheduling_preview["again"],
                "display": format_interval_display(scheduling_preview["again"]["interval_days"]),
                "description": "Échec - réapprendre immédiatement"
            },
            "hard": {
                **scheduling_preview["hard"],
                "display": format_interval_display(scheduling_preview["hard"]["interval_days"]),
                "description": "Difficile mais correct"
            },
            "good": {
                **scheduling_preview["good"],
                "display": format_interval_display(scheduling_preview["good"]["interval_days"]),
                "description": "Correct avec effort normal"
            },
            "easy": {
                **scheduling_preview["easy"],
                "display": format_interval_display(scheduling_preview["easy"]["interval_days"]),
                "description": "Parfaitement mémorisé"
            }
        }
    }


@router.get("/{flashcard_id}/stats", response_model=FlashcardStatsResponse)
async def get_flashcard_stats(
    flashcard_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les statistiques détaillées d'une flashcard (avec métriques FSRS)"""

    # Récupérer la flashcard
    result = await db.execute(
        select(Flashcard).where(
            and_(
                Flashcard.id == flashcard_id,
                Flashcard.user_id == current_user.id
            )
        )
    )
    flashcard = result.scalar_one_or_none()

    if not flashcard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard non trouvée"
        )

    # Calculer le taux de succès
    success_rate = 0.0
    if flashcard.total_reviews > 0:
        success_rate = (flashcard.correct_reviews / flashcard.total_reviews) * 100

    # Récupérer les 10 dernières révisions
    result = await db.execute(
        select(FlashcardReview)
        .where(FlashcardReview.flashcard_id == flashcard_id)
        .order_by(FlashcardReview.reviewed_at.desc())
        .limit(10)
    )
    recent_reviews = result.scalars().all()

    # Formater l'historique des révisions
    reviews_list = [
        {
            "id": r.id,
            "quality": r.quality,
            "response_time_seconds": getattr(r, 'time_taken', None),
            "reviewed_at": r.reviewed_at.isoformat()
        }
        for r in recent_reviews
    ]

    # Répartition des difficultés
    difficulty_breakdown = {
        "again": flashcard.times_seen_as_again,
        "hard": flashcard.times_seen_as_hard,
        "good": flashcard.times_seen_as_good,
        "easy": flashcard.times_seen_as_easy
    }

    # Calculer la récupérabilité actuelle via FSRS
    now = utc_now()
    status_map = {
        FlashcardStatus.NEW: "new",
        FlashcardStatus.LEARNING: "learning",
        FlashcardStatus.REVIEW: "review",
        FlashcardStatus.RELEARNING: "relearning"
    }

    fsrs_card = create_fsrs_card_from_flashcard(
        ease_factor=flashcard.ease_factor,
        interval=flashcard.interval,
        repetitions=flashcard.repetitions,
        status=status_map.get(flashcard.status, "new"),
        last_reviewed_at=flashcard.last_reviewed_at,
        next_review_at=flashcard.next_review_at,
        stability=getattr(flashcard, 'stability', None),
        difficulty=getattr(flashcard, 'fsrs_difficulty', None)
    )
    current_retrievability = fsrs_card.get_retrievability(now)

    return {
        "flashcard_id": flashcard.id,
        "total_reviews": flashcard.total_reviews,
        "correct_reviews": flashcard.correct_reviews,
        "incorrect_reviews": flashcard.incorrect_reviews,
        "success_rate": success_rate,
        "mastery_percentage": flashcard.mastery_percentage,
        "average_response_time_seconds": flashcard.average_response_time_seconds,
        "status": flashcard.status,
        "ease_factor": flashcard.ease_factor,
        "interval": flashcard.interval,
        "repetitions": flashcard.repetitions,
        "next_review_at": flashcard.next_review_at,
        "difficulty_breakdown": difficulty_breakdown,
        "recent_reviews": reviews_list,
        # FSRS specific metrics
        "fsrs_metrics": {
            "stability": round(getattr(flashcard, 'stability', 0) or 0, 2),
            "difficulty": round(getattr(flashcard, 'fsrs_difficulty', 5) or 5, 2),
            "retrievability": round(current_retrievability * 100, 1),
            "lapses": getattr(flashcard, 'lapses', 0) or 0,
            "stability_display": format_interval_display(int(getattr(flashcard, 'stability', 0) or 0))
        }
    }


@router.put("/{flashcard_id}", response_model=FlashcardResponse)
async def update_flashcard(
    flashcard_id: int,
    flashcard_data: FlashcardUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Mettre à jour une flashcard"""
    
    result = await db.execute(
        select(Flashcard).where(
            and_(
                Flashcard.id == flashcard_id,
                Flashcard.user_id == current_user.id
            )
        )
    )
    flashcard = result.scalar_one_or_none()
    
    if not flashcard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard non trouvée"
        )
    
    # Mettre à jour les champs
    update_data = flashcard_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(flashcard, field, value)
    
    await db.commit()
    await db.refresh(flashcard)
    
    return flashcard


@router.delete("/{flashcard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flashcard(
    flashcard_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprimer une flashcard"""
    
    result = await db.execute(
        select(Flashcard).where(
            and_(
                Flashcard.id == flashcard_id,
                Flashcard.user_id == current_user.id
            )
        )
    )
    flashcard = result.scalar_one_or_none()
    
    if not flashcard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard non trouvée"
        )
    
    # Mettre à jour les stats de la matière
    result = await db.execute(
        select(Subject).where(Subject.id == flashcard.subject_id)
    )
    subject = result.scalar_one_or_none()
    if subject:
        subject.total_flashcards_count = max(0, subject.total_flashcards_count - 1)
    
    await db.delete(flashcard)
    await db.commit()
    
    return None


@router.post("/{flashcard_id}/favorite", response_model=FlashcardResponse)
async def toggle_favorite(
    flashcard_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Marquer/Démarquer une flashcard comme favorite"""
    
    result = await db.execute(
        select(Flashcard).where(
            and_(
                Flashcard.id == flashcard_id,
                Flashcard.user_id == current_user.id
            )
        )
    )
    flashcard = result.scalar_one_or_none()
    
    if not flashcard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard non trouvée"
        )
    
    flashcard.is_favorite = not flashcard.is_favorite
    await db.commit()
    await db.refresh(flashcard)
    
    return flashcard


@router.post("/{flashcard_id}/suspend", response_model=FlashcardResponse)
async def toggle_suspend(
    flashcard_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Suspendre/Réactiver une flashcard"""
    
    result = await db.execute(
        select(Flashcard).where(
            and_(
                Flashcard.id == flashcard_id,
                Flashcard.user_id == current_user.id
            )
        )
    )
    flashcard = result.scalar_one_or_none()
    
    if not flashcard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard non trouvée"
        )
    
    flashcard.is_suspended = not flashcard.is_suspended
    await db.commit()
    await db.refresh(flashcard)
    
    return flashcard
