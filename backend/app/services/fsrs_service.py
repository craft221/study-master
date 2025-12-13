"""
FSRS (Free Spaced Repetition Scheduler) Service
===============================================

Un algorithme de répétition espacée moderne et sophistiqué basé sur la recherche
scientifique en sciences cognitives et apprentissage automatique.

FSRS offre une amélioration significative par rapport à SM-2:
- ~30% moins de révisions pour le même taux de rétention
- Adaptation personnalisée basée sur l'historique de l'utilisateur
- Modélisation précise de la mémoire avec stabilité et récupérabilité
- Paramètres optimisés par machine learning

Référence: https://github.com/open-spaced-repetition/fsrs4anki
"""

import math
from datetime import datetime, timedelta
from typing import Optional, Tuple, Dict, Any, List
from dataclasses import dataclass, field
from enum import IntEnum


class Rating(IntEnum):
    """Évaluation de la qualité de la réponse"""
    AGAIN = 0  # Échec complet - réapprendre
    HARD = 1   # Difficile mais correct
    GOOD = 2   # Correct avec effort normal
    EASY = 3   # Facile, parfaitement mémorisé


class State(IntEnum):
    """État de la carte dans le processus d'apprentissage"""
    NEW = 0        # Jamais révisée
    LEARNING = 1   # En cours d'apprentissage initial
    REVIEW = 2     # En révision normale (long terme)
    RELEARNING = 3 # Réapprentissage après un échec


@dataclass
class FSRSParameters:
    """
    Paramètres FSRS optimisés par machine learning.

    Ces 19 paramètres ont été calibrés sur des millions de révisions
    pour modéliser précisément la courbe d'oubli humaine.
    """
    # Stabilités initiales pour chaque niveau de difficulté lors de la première révision
    # w[0-3]: Stabilité initiale après première réponse (Again, Hard, Good, Easy)
    w0: float = 0.4    # Stabilité après "Again" - très court
    w1: float = 0.6    # Stabilité après "Hard" - court
    w2: float = 2.4    # Stabilité après "Good" - moyen
    w3: float = 5.8    # Stabilité après "Easy" - long

    # Difficulté initiale
    # w[4]: Difficulté de base pour nouvelles cartes
    w4: float = 4.93   # Difficulté initiale moyenne (échelle 1-10)

    # Modificateurs de difficulté
    # w[5]: Impact de la note sur la difficulté
    w5: float = 0.94   # Coefficient d'ajustement de difficulté par note
    # w[6]: Facteur de régression vers la moyenne de difficulté
    w6: float = 0.86   # Mean reversion pour stabiliser la difficulté

    # Facteurs de stabilité après succès
    # w[7]: Modificateur de stabilité pour "Hard"
    w7: float = 0.01   # Bonus stabilité pour Hard (minimal)
    # w[8]: Modificateur de stabilité de base
    w8: float = 1.49   # Multiplicateur de stabilité de base
    # w[9]: Impact de la difficulté sur la croissance de stabilité
    w9: float = 0.14   # Pénalité difficulté sur croissance stabilité
    # w[10]: Impact de la stabilité actuelle sur sa croissance
    w10: float = 0.94  # Decay factor - haute stabilité = croissance moindre
    # w[11]: Modificateur pour "Easy" (bonus)
    w11: float = 2.18  # Bonus stabilité pour Easy

    # Facteurs de stabilité après échec (réapprentissage)
    # w[12]: Multiplicateur de stabilité après échec
    w12: float = 0.05  # Réduction majeure après oubli
    # w[13]: Impact de la difficulté sur la récupération
    w13: float = 0.34  # Pénalité difficulté en réapprentissage
    # w[14]: Impact de la stabilité pré-échec sur la récupération
    w14: float = 1.26  # Bonus mémoire résiduelle
    # w[15]: Impact de la récupérabilité sur la récupération
    w15: float = 0.29  # Bonus récupérabilité pré-échec

    # Modificateur "Hard" en révision
    # w[16]: Pénalité pour réponse "Hard"
    w16: float = 2.61  # Pénalité Hard sur stabilité

    # Short-term scheduling (pour sessions d'apprentissage)
    # w[17-18]: Stabilité court terme pour apprentissage/réapprentissage
    w17: float = 0.0   # Non utilisé dans cette implémentation
    w18: float = 0.0   # Non utilisé dans cette implémentation

    # Paramètres de planification
    request_retention: float = 0.9  # Rétention cible (90%)
    maximum_interval: int = 36500   # Intervalle max en jours (100 ans)

    # Étapes d'apprentissage (minutes)
    learning_steps: List[int] = field(default_factory=lambda: [1, 10])
    relearning_steps: List[int] = field(default_factory=lambda: [10])

    # Bonus/pénalités contextuels
    enable_fuzz: bool = True        # Ajouter variation aléatoire
    fuzz_factor: float = 0.05       # ±5% de variation

    @classmethod
    def default(cls) -> 'FSRSParameters':
        """Retourne les paramètres par défaut optimisés"""
        return cls()

    @classmethod
    def conservative(cls) -> 'FSRSParameters':
        """Paramètres conservateurs pour meilleure rétention"""
        params = cls()
        params.request_retention = 0.95
        return params

    @classmethod
    def aggressive(cls) -> 'FSRSParameters':
        """Paramètres agressifs pour moins de révisions"""
        params = cls()
        params.request_retention = 0.85
        return params


@dataclass
class FSRSCard:
    """
    État d'une carte FSRS.

    Attributes:
        stability: Durée estimée (en jours) avant que la récupérabilité
                  tombe à 90%. Plus elle est haute, plus la mémoire est stable.
        difficulty: Difficulté intrinsèque de la carte (1-10).
                   Affecte la croissance de stabilité.
        elapsed_days: Jours depuis la dernière révision.
        scheduled_days: Intervalle planifié pour cette révision.
        reps: Nombre total de révisions.
        lapses: Nombre d'échecs (réponses "Again").
        state: État actuel de la carte.
        last_review: Date de dernière révision.
        due: Date de prochaine révision.
    """
    stability: float = 0.0
    difficulty: float = 0.0
    elapsed_days: int = 0
    scheduled_days: int = 0
    reps: int = 0
    lapses: int = 0
    state: State = State.NEW
    last_review: Optional[datetime] = None
    due: Optional[datetime] = None

    # Métriques avancées
    retrievability: float = 1.0  # Probabilité de rappel actuelle

    def get_retrievability(self, now: datetime) -> float:
        """
        Calcule la récupérabilité actuelle (probabilité de rappel).

        Utilise la formule de décroissance exponentielle:
        R(t) = (1 + t/S * c)^(-1/c)

        où:
        - t = temps écoulé depuis dernière révision
        - S = stabilité
        - c = constante de décroissance (≈ 9/10 pour 90% rétention)
        """
        if self.stability <= 0 or self.last_review is None:
            return 1.0 if self.state == State.NEW else 0.0

        elapsed = (now - self.last_review).total_seconds() / 86400  # En jours
        if elapsed <= 0:
            return 1.0

        # Constante de décroissance pour rétention de 90%
        decay_constant = 19 / 81  # ≈ 0.2346

        # Formule de Ebbinghaus modifiée (power law decay)
        retrievability = (1 + decay_constant * elapsed / self.stability) ** (-1 / decay_constant)

        return max(0.0, min(1.0, retrievability))


@dataclass
class SchedulingInfo:
    """Information de planification pour une option de réponse"""
    card: FSRSCard
    review_log: Dict[str, Any]


@dataclass
class SchedulingCards:
    """Résultat de la planification pour toutes les options"""
    again: SchedulingInfo
    hard: SchedulingInfo
    good: SchedulingInfo
    easy: SchedulingInfo


class FSRSScheduler:
    """
    Planificateur FSRS principal.

    Implémente l'algorithme FSRS-4.5 complet avec:
    - Calcul de stabilité basé sur la théorie de la mémoire
    - Difficulté adaptative par carte
    - Intervalles optimaux pour rétention cible
    - Support des phases d'apprentissage
    """

    def __init__(self, params: Optional[FSRSParameters] = None):
        self.params = params or FSRSParameters.default()

    def schedule(
        self,
        card: FSRSCard,
        rating: Rating,
        now: Optional[datetime] = None
    ) -> Tuple[FSRSCard, Dict[str, Any]]:
        """
        Planifie la prochaine révision d'une carte.

        Args:
            card: État actuel de la carte
            rating: Évaluation de la réponse (0-3)
            now: Date/heure actuelle (défaut: maintenant)

        Returns:
            Tuple (nouvelle carte mise à jour, log de révision)
        """
        if now is None:
            now = datetime.utcnow()

        # Calculer les jours écoulés
        if card.last_review is not None:
            elapsed_days = max(0, (now - card.last_review).days)
        else:
            elapsed_days = 0

        # Créer une copie de la carte pour modification
        new_card = FSRSCard(
            stability=card.stability,
            difficulty=card.difficulty,
            elapsed_days=elapsed_days,
            scheduled_days=card.scheduled_days,
            reps=card.reps,
            lapses=card.lapses,
            state=card.state,
            last_review=card.last_review,
            due=card.due,
            retrievability=card.get_retrievability(now)
        )

        # Traiter selon l'état actuel
        if new_card.state == State.NEW:
            new_card = self._handle_new_card(new_card, rating, now)
        elif new_card.state in (State.LEARNING, State.RELEARNING):
            new_card = self._handle_learning_card(new_card, rating, now)
        else:  # State.REVIEW
            new_card = self._handle_review_card(new_card, rating, now)

        # Mettre à jour les statistiques communes
        new_card.reps += 1
        new_card.last_review = now

        # Créer le log de révision
        review_log = {
            "rating": rating,
            "state": new_card.state.name,
            "stability": new_card.stability,
            "difficulty": new_card.difficulty,
            "elapsed_days": elapsed_days,
            "scheduled_days": new_card.scheduled_days,
            "retrievability": card.retrievability,
            "reviewed_at": now.isoformat()
        }

        return new_card, review_log

    def _handle_new_card(
        self,
        card: FSRSCard,
        rating: Rating,
        now: datetime
    ) -> FSRSCard:
        """Traite une nouvelle carte (première révision)"""

        # Initialiser la difficulté
        card.difficulty = self._init_difficulty(rating)

        # Initialiser la stabilité selon la note
        card.stability = self._init_stability(rating)

        if rating == Rating.AGAIN:
            # Échec: entrer en mode apprentissage
            card.state = State.LEARNING
            card.lapses += 1
            card.scheduled_days = 0
            # Prochaine révision dans learning_steps[0] minutes
            card.due = now + timedelta(minutes=self.params.learning_steps[0])
        elif rating == Rating.HARD:
            # Difficile: apprentissage court
            card.state = State.LEARNING
            card.scheduled_days = 0
            card.due = now + timedelta(minutes=self.params.learning_steps[0])
        elif rating == Rating.GOOD:
            # Bon: passer en révision
            card.state = State.REVIEW
            card.scheduled_days = self._next_interval(card.stability)
            card.due = now + timedelta(days=card.scheduled_days)
        else:  # EASY
            # Facile: intervalle plus long directement
            card.state = State.REVIEW
            card.scheduled_days = self._next_interval(card.stability * 2)
            card.due = now + timedelta(days=card.scheduled_days)

        return card

    def _handle_learning_card(
        self,
        card: FSRSCard,
        rating: Rating,
        now: datetime
    ) -> FSRSCard:
        """Traite une carte en apprentissage/réapprentissage"""

        steps = (self.params.learning_steps if card.state == State.LEARNING
                 else self.params.relearning_steps)

        if rating == Rating.AGAIN:
            # Échec: recommencer les étapes
            card.lapses += 1
            card.scheduled_days = 0
            card.due = now + timedelta(minutes=steps[0])

            # Réduire la stabilité si on était en révision avant
            if card.stability > 0:
                card.stability = self._next_forget_stability(
                    card.difficulty,
                    card.stability,
                    card.retrievability
                )

        elif rating == Rating.HARD:
            # Difficile: rester en apprentissage, première étape
            card.scheduled_days = 0
            card.due = now + timedelta(minutes=steps[0])

        elif rating == Rating.GOOD:
            # Bon: passer à l'étape suivante ou en révision
            # Simplification: passer directement en révision
            card.state = State.REVIEW

            # Calculer nouvelle stabilité
            if card.stability > 0:
                card.stability = self._next_recall_stability(
                    card.difficulty,
                    card.stability,
                    card.retrievability,
                    rating
                )
            else:
                card.stability = self._init_stability(rating)

            card.scheduled_days = self._next_interval(card.stability)
            card.due = now + timedelta(days=card.scheduled_days)

        else:  # EASY
            # Facile: passer en révision avec bonus
            card.state = State.REVIEW

            if card.stability > 0:
                card.stability = self._next_recall_stability(
                    card.difficulty,
                    card.stability,
                    card.retrievability,
                    rating
                )
            else:
                card.stability = self._init_stability(rating)

            # Bonus pour réponse facile
            card.stability *= 1.5
            card.scheduled_days = self._next_interval(card.stability)
            card.due = now + timedelta(days=card.scheduled_days)

        # Mettre à jour la difficulté
        card.difficulty = self._next_difficulty(card.difficulty, rating)

        return card

    def _handle_review_card(
        self,
        card: FSRSCard,
        rating: Rating,
        now: datetime
    ) -> FSRSCard:
        """Traite une carte en révision normale"""

        # Récupérer la récupérabilité avant révision
        retrievability = card.get_retrievability(now)

        if rating == Rating.AGAIN:
            # Échec: entrer en réapprentissage
            card.state = State.RELEARNING
            card.lapses += 1

            # Nouvelle stabilité après oubli
            card.stability = self._next_forget_stability(
                card.difficulty,
                card.stability,
                retrievability
            )

            card.scheduled_days = 0
            card.due = now + timedelta(minutes=self.params.relearning_steps[0])

        else:
            # Succès: calculer nouvelle stabilité
            card.stability = self._next_recall_stability(
                card.difficulty,
                card.stability,
                retrievability,
                rating
            )

            card.scheduled_days = self._next_interval(card.stability)
            card.due = now + timedelta(days=card.scheduled_days)

        # Mettre à jour la difficulté
        card.difficulty = self._next_difficulty(card.difficulty, rating)

        return card

    def _init_difficulty(self, rating: Rating) -> float:
        """
        Calcule la difficulté initiale d'une carte.

        D0(G) = w4 - e^(w5 * (G - 1)) + 1

        où G est la note (0-3) et w4, w5 sont des paramètres.
        """
        p = self.params

        # Formule FSRS pour difficulté initiale
        difficulty = p.w4 - math.exp(p.w5 * (rating - 1)) + 1

        # Contraindre entre 1 et 10
        return max(1.0, min(10.0, difficulty))

    def _init_stability(self, rating: Rating) -> float:
        """
        Calcule la stabilité initiale après première révision.

        S0(G) = w[G]

        où w[0-3] sont les stabilités initiales pour chaque note.
        """
        p = self.params

        stability_map = {
            Rating.AGAIN: p.w0,
            Rating.HARD: p.w1,
            Rating.GOOD: p.w2,
            Rating.EASY: p.w3
        }

        return stability_map.get(rating, p.w2)

    def _next_difficulty(self, difficulty: float, rating: Rating) -> float:
        """
        Calcule la nouvelle difficulté après révision.

        D'(D, G) = w6 * D0(3) + (1 - w6) * (D - w5 * (G - 3))

        Cette formule applique une régression vers la moyenne (mean reversion)
        pour stabiliser la difficulté au fil du temps.
        """
        p = self.params

        # Difficulté de référence (pour une réponse "Good")
        d0_ref = self._init_difficulty(Rating.GOOD)

        # Ajustement basé sur la note
        delta = -p.w5 * (rating - 3)

        # Mean reversion: tendre vers la difficulté de référence
        new_difficulty = p.w6 * d0_ref + (1 - p.w6) * (difficulty + delta)

        # Contraindre entre 1 et 10
        return max(1.0, min(10.0, new_difficulty))

    def _next_recall_stability(
        self,
        difficulty: float,
        stability: float,
        retrievability: float,
        rating: Rating
    ) -> float:
        """
        Calcule la nouvelle stabilité après un rappel réussi.

        S'(D, S, R, G) = S * (e^(w8) * (11 - D) * S^(-w9) * (e^(w10 * (1-R)) - 1) * hard_penalty * easy_bonus + 1)

        Cette formule modélise la consolidation de la mémoire:
        - Plus la difficulté est basse, plus la stabilité augmente
        - Plus la stabilité actuelle est haute, moins elle augmente (rendements décroissants)
        - Plus la récupérabilité était basse, plus le rappel renforce la mémoire
        """
        p = self.params

        # Pénalité/bonus selon la note
        hard_penalty = 1.0 if rating != Rating.HARD else p.w16
        easy_bonus = 1.0 if rating != Rating.EASY else p.w11

        # Facteur de croissance de stabilité
        # SInc = e^w8 * (11 - D) * S^(-w9) * (e^(w10 * (1 - R)) - 1)
        sinc = (
            math.exp(p.w8) *
            (11 - difficulty) *
            (stability ** (-p.w9)) *
            (math.exp(p.w10 * (1 - retrievability)) - 1) *
            hard_penalty *
            easy_bonus
        )

        # Nouvelle stabilité
        new_stability = stability * (sinc + 1)

        # Appliquer fuzz si activé
        if p.enable_fuzz and new_stability > 2.5:
            new_stability = self._apply_fuzz(new_stability)

        # Limiter à l'intervalle maximum
        max_stability = p.maximum_interval / 2

        return max(0.1, min(max_stability, new_stability))

    def _next_forget_stability(
        self,
        difficulty: float,
        stability: float,
        retrievability: float
    ) -> float:
        """
        Calcule la nouvelle stabilité après un échec (oubli).

        S'(D, S, R) = w12 * D^(-w13) * ((S + 1)^w14 - 1) * e^(w15 * (1 - R))

        Cette formule modélise la perte de mémoire après un échec:
        - La nouvelle stabilité est significativement réduite
        - Une partie de la mémoire résiduelle est préservée (S + 1)^w14
        - Plus la récupérabilité était basse, plus de mémoire est préservée
        """
        p = self.params

        new_stability = (
            p.w12 *
            (difficulty ** (-p.w13)) *
            ((stability + 1) ** p.w14 - 1) *
            math.exp(p.w15 * (1 - retrievability))
        )

        return max(0.1, min(stability, new_stability))

    def _next_interval(self, stability: float) -> int:
        """
        Calcule l'intervalle optimal pour la rétention cible.

        I(S, R) = S / FACTOR * ln(R)

        où:
        - S = stabilité
        - R = rétention cible (ex: 0.9)
        - FACTOR = constante de décroissance

        L'intervalle est choisi pour que la récupérabilité
        atteigne exactement la rétention cible à la date de révision.
        """
        p = self.params

        if stability <= 0:
            return 1

        # Constante de décroissance (inverse de la formule de récupérabilité)
        decay_constant = 19 / 81

        # Calcul de l'intervalle pour atteindre la rétention cible
        interval = stability / decay_constant * (
            (1 / p.request_retention) ** decay_constant - 1
        )

        # Arrondir et contraindre
        interval = round(interval)

        # Appliquer fuzz si activé
        if p.enable_fuzz and interval > 2:
            interval = round(self._apply_fuzz(float(interval)))

        return max(1, min(p.maximum_interval, interval))

    def _apply_fuzz(self, value: float) -> float:
        """
        Applique une légère variation aléatoire pour éviter les clusters.

        Le fuzzing aide à:
        - Éviter trop de cartes dues le même jour
        - Rendre les intervalles moins prévisibles
        - Améliorer l'espacement naturel des révisions
        """
        import random

        fuzz_range = value * self.params.fuzz_factor
        return value + random.uniform(-fuzz_range, fuzz_range)

    def get_scheduling_cards(
        self,
        card: FSRSCard,
        now: Optional[datetime] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Obtient les prévisions pour toutes les options de réponse.

        Utile pour afficher à l'utilisateur ce qui se passera
        selon sa réponse (Again/Hard/Good/Easy).
        """
        if now is None:
            now = datetime.utcnow()

        result = {}

        for rating in Rating:
            new_card, review_log = self.schedule(
                FSRSCard(
                    stability=card.stability,
                    difficulty=card.difficulty,
                    elapsed_days=card.elapsed_days,
                    scheduled_days=card.scheduled_days,
                    reps=card.reps,
                    lapses=card.lapses,
                    state=card.state,
                    last_review=card.last_review,
                    due=card.due
                ),
                rating,
                now
            )

            result[rating.name.lower()] = {
                "interval_days": new_card.scheduled_days,
                "due": new_card.due.isoformat() if new_card.due else None,
                "stability": round(new_card.stability, 2),
                "difficulty": round(new_card.difficulty, 2),
                "state": new_card.state.name
            }

        return result


# ============== FONCTIONS UTILITAIRES ==============

def convert_sm2_to_fsrs(
    ease_factor: float,
    interval: int,
    repetitions: int,
    status: str
) -> Tuple[float, float, State]:
    """
    Convertit les paramètres SM-2 existants vers FSRS.

    Cette fonction permet une migration transparente des données
    existantes vers le nouveau système FSRS.
    """
    # Convertir l'ease_factor (1.3-2.5+) vers difficulté (1-10)
    # ease_factor haut = carte facile = difficulté basse
    difficulty = max(1.0, min(10.0, 11 - (ease_factor * 3)))

    # Estimer la stabilité à partir de l'intervalle
    # Un intervalle de N jours suggère une stabilité d'environ N * 0.9
    stability = max(0.1, interval * 0.9) if interval > 0 else 0.4

    # Convertir le statut
    status_map = {
        "new": State.NEW,
        "learning": State.LEARNING,
        "review": State.REVIEW,
        "relearning": State.RELEARNING
    }
    state = status_map.get(status.lower(), State.NEW)

    # Ajuster selon les répétitions
    if repetitions == 0:
        state = State.NEW
        stability = 0.0
        difficulty = 5.0  # Difficulté moyenne par défaut

    return stability, difficulty, state


def create_fsrs_card_from_flashcard(
    ease_factor: float = 2.5,
    interval: int = 0,
    repetitions: int = 0,
    status: str = "new",
    last_reviewed_at: Optional[datetime] = None,
    next_review_at: Optional[datetime] = None,
    stability: Optional[float] = None,
    difficulty: Optional[float] = None
) -> FSRSCard:
    """
    Crée un FSRSCard à partir des données d'une flashcard existante.
    """
    # Si stabilité et difficulté sont déjà définies, les utiliser
    if stability is not None and difficulty is not None:
        state_map = {
            "new": State.NEW,
            "learning": State.LEARNING,
            "review": State.REVIEW,
            "relearning": State.RELEARNING
        }
        state = state_map.get(status.lower(), State.NEW)
    else:
        # Sinon, convertir depuis SM-2
        stability, difficulty, state = convert_sm2_to_fsrs(
            ease_factor, interval, repetitions, status
        )

    return FSRSCard(
        stability=stability,
        difficulty=difficulty,
        elapsed_days=0,
        scheduled_days=interval,
        reps=repetitions,
        lapses=0,
        state=state,
        last_review=last_reviewed_at,
        due=next_review_at
    )


def format_interval_display(days: int) -> str:
    """
    Formate un intervalle en jours pour l'affichage.

    Examples:
        0 -> "< 1 min"
        1 -> "1 jour"
        7 -> "1 semaine"
        30 -> "1 mois"
        365 -> "1 an"
    """
    if days == 0:
        return "< 10 min"
    elif days == 1:
        return "1 jour"
    elif days < 7:
        return f"{days} jours"
    elif days < 14:
        return "1 semaine"
    elif days < 30:
        weeks = days // 7
        return f"{weeks} semaines"
    elif days < 60:
        return "1 mois"
    elif days < 365:
        months = days // 30
        return f"{months} mois"
    elif days < 730:
        return "1 an"
    else:
        years = days // 365
        return f"{years} ans"


# ============== STATISTIQUES AVANCÉES ==============

class FSRSStatistics:
    """
    Calcule des statistiques avancées pour un ensemble de cartes FSRS.
    """

    @staticmethod
    def calculate_deck_metrics(cards: List[FSRSCard]) -> Dict[str, Any]:
        """
        Calcule les métriques globales d'un deck.
        """
        if not cards:
            return {
                "total_cards": 0,
                "new_cards": 0,
                "learning_cards": 0,
                "review_cards": 0,
                "average_stability": 0,
                "average_difficulty": 0,
                "average_retrievability": 0,
                "total_lapses": 0,
                "retention_estimate": 0
            }

        now = datetime.utcnow()

        new_count = sum(1 for c in cards if c.state == State.NEW)
        learning_count = sum(1 for c in cards if c.state in (State.LEARNING, State.RELEARNING))
        review_count = sum(1 for c in cards if c.state == State.REVIEW)

        # Calculer les moyennes pour les cartes non-nouvelles
        non_new_cards = [c for c in cards if c.state != State.NEW]

        if non_new_cards:
            avg_stability = sum(c.stability for c in non_new_cards) / len(non_new_cards)
            avg_difficulty = sum(c.difficulty for c in non_new_cards) / len(non_new_cards)
            avg_retrievability = sum(c.get_retrievability(now) for c in non_new_cards) / len(non_new_cards)
        else:
            avg_stability = 0
            avg_difficulty = 5.0
            avg_retrievability = 1.0

        total_lapses = sum(c.lapses for c in cards)

        return {
            "total_cards": len(cards),
            "new_cards": new_count,
            "learning_cards": learning_count,
            "review_cards": review_count,
            "average_stability": round(avg_stability, 2),
            "average_difficulty": round(avg_difficulty, 2),
            "average_retrievability": round(avg_retrievability * 100, 1),
            "total_lapses": total_lapses,
            "retention_estimate": round(avg_retrievability * 100, 1)
        }

    @staticmethod
    def predict_workload(
        cards: List[FSRSCard],
        days_ahead: int = 30
    ) -> Dict[int, int]:
        """
        Prédit le nombre de cartes à réviser pour les N prochains jours.
        """
        now = datetime.utcnow()
        workload = {i: 0 for i in range(days_ahead + 1)}

        for card in cards:
            if card.due is None:
                workload[0] += 1
            else:
                days_until_due = (card.due - now).days
                if days_until_due < 0:
                    workload[0] += 1
                elif days_until_due <= days_ahead:
                    workload[days_until_due] += 1

        return workload
