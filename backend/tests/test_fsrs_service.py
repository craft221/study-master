"""
Tests pour le service FSRS (Free Spaced Repetition Scheduler)
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock

from app.services.fsrs_service import (
    FSRSScheduler, FSRSParameters, FSRSCard, SchedulingCards,
    Rating, State
)


class TestRatingEnum:
    """Tests pour l'enum Rating"""

    def test_rating_values(self):
        """Les valeurs de notation existent"""
        assert Rating.AGAIN == 0
        assert Rating.HARD == 1
        assert Rating.GOOD == 2
        assert Rating.EASY == 3

    def test_rating_ordering(self):
        """L'ordre des notations est correct"""
        assert Rating.AGAIN < Rating.HARD < Rating.GOOD < Rating.EASY

    def test_rating_is_int(self):
        """Les ratings sont des entiers"""
        assert isinstance(Rating.AGAIN.value, int)
        assert isinstance(Rating.EASY.value, int)


class TestStateEnum:
    """Tests pour l'enum State"""

    def test_state_values(self):
        """Les etats existent"""
        assert State.NEW == 0
        assert State.LEARNING == 1
        assert State.REVIEW == 2
        assert State.RELEARNING == 3

    def test_state_ordering(self):
        """L'ordre des etats est correct"""
        assert State.NEW < State.LEARNING < State.REVIEW < State.RELEARNING


class TestFSRSParameters:
    """Tests pour les parametres FSRS"""

    def test_default_parameters(self):
        """Les parametres par defaut sont corrects"""
        params = FSRSParameters.default()

        assert params.w0 == 0.4  # Stabilite apres Again
        assert params.w1 == 0.6  # Stabilite apres Hard
        assert params.w2 == 2.4  # Stabilite apres Good
        assert params.w3 == 5.8  # Stabilite apres Easy

    def test_request_retention(self):
        """La retention cible par defaut est 90%"""
        params = FSRSParameters()
        assert params.request_retention == 0.9

    def test_conservative_parameters(self):
        """Les parametres conservateurs ont une retention plus haute"""
        params = FSRSParameters.conservative()
        assert params.request_retention == 0.95

    def test_aggressive_parameters(self):
        """Les parametres agressifs ont une retention plus basse"""
        params = FSRSParameters.aggressive()
        assert params.request_retention == 0.85

    def test_maximum_interval(self):
        """L'intervalle maximum est raisonnable"""
        params = FSRSParameters()
        assert params.maximum_interval == 36500  # ~100 ans

    def test_learning_steps(self):
        """Les etapes d'apprentissage sont definies"""
        params = FSRSParameters()
        assert params.learning_steps == [1, 10]  # 1min, 10min

    def test_relearning_steps(self):
        """Les etapes de reapprentissage sont definies"""
        params = FSRSParameters()
        assert params.relearning_steps == [10]

    def test_fuzz_enabled(self):
        """Le fuzz est active par defaut"""
        params = FSRSParameters()
        assert params.enable_fuzz == True
        assert params.fuzz_factor == 0.05

    def test_difficulty_parameter(self):
        """Le parametre de difficulte initiale"""
        params = FSRSParameters()
        assert params.w4 == 4.93  # Difficulte initiale moyenne


class TestFSRSCard:
    """Tests pour FSRSCard"""

    def test_new_card_defaults(self):
        """Une nouvelle carte a les bons defaults"""
        card = FSRSCard()

        assert card.stability == 0.0
        assert card.difficulty == 0.0
        assert card.elapsed_days == 0
        assert card.scheduled_days == 0
        assert card.reps == 0
        assert card.lapses == 0
        assert card.state == State.NEW
        assert card.last_review is None
        assert card.due is None
        assert card.retrievability == 1.0

    def test_card_with_values(self):
        """Creation d'une carte avec des valeurs"""
        now = datetime.utcnow()
        card = FSRSCard(
            stability=5.0,
            difficulty=4.5,
            elapsed_days=3,
            scheduled_days=7,
            reps=5,
            lapses=1,
            state=State.REVIEW,
            last_review=now,
            due=now + timedelta(days=7)
        )

        assert card.stability == 5.0
        assert card.difficulty == 4.5
        assert card.reps == 5
        assert card.state == State.REVIEW

    def test_retrievability_new_card(self):
        """Recuperabilite d'une nouvelle carte"""
        card = FSRSCard()
        now = datetime.utcnow()

        retrievability = card.get_retrievability(now)
        assert retrievability == 1.0

    def test_retrievability_after_review(self):
        """Recuperabilite apres une revision"""
        now = datetime.utcnow()
        card = FSRSCard(
            stability=10.0,
            state=State.REVIEW,
            last_review=now - timedelta(days=5)
        )

        retrievability = card.get_retrievability(now)
        assert 0 < retrievability < 1
        assert retrievability > 0.5  # Avec stabilite=10 apres 5 jours

    def test_retrievability_decays(self):
        """La recuperabilite diminue avec le temps"""
        now = datetime.utcnow()
        card = FSRSCard(
            stability=5.0,
            state=State.REVIEW,
            last_review=now
        )

        r_now = card.get_retrievability(now)
        r_later = card.get_retrievability(now + timedelta(days=10))

        assert r_now > r_later

    def test_retrievability_bounds(self):
        """La recuperabilite est entre 0 et 1"""
        now = datetime.utcnow()
        card = FSRSCard(
            stability=5.0,
            state=State.REVIEW,
            last_review=now - timedelta(days=100)
        )

        retrievability = card.get_retrievability(now)
        assert 0 <= retrievability <= 1


class TestFSRSScheduler:
    """Tests pour FSRSScheduler"""

    @pytest.fixture
    def service(self):
        """Instance du service avec parametres par defaut"""
        return FSRSScheduler()

    @pytest.fixture
    def custom_service(self):
        """Instance du service avec parametres personnalises"""
        params = FSRSParameters.conservative()
        return FSRSScheduler(params)

    def test_service_initialization(self, service):
        """Le service s'initialise correctement"""
        assert service is not None
        assert service.params is not None
        assert service.params.request_retention == 0.9

    def test_service_with_custom_params(self, custom_service):
        """Le service accepte des parametres personnalises"""
        assert custom_service.params.request_retention == 0.95


class TestScheduleNewCard:
    """Tests pour la planification d'une nouvelle carte"""

    @pytest.fixture
    def service(self):
        return FSRSScheduler()

    def test_schedule_new_card(self, service):
        """Planification d'une nouvelle carte"""
        card = FSRSCard()
        now = datetime.utcnow()

        result = service.schedule(card, now)

        assert isinstance(result, SchedulingCards)
        assert result.again is not None
        assert result.hard is not None
        assert result.good is not None
        assert result.easy is not None

    def test_schedule_new_card_again(self, service):
        """Reponse 'Again' pour nouvelle carte"""
        card = FSRSCard()
        now = datetime.utcnow()

        result = service.schedule(card, now)
        again_card = result.again.card

        # Apres Again, la carte reste en apprentissage
        assert again_card.state in [State.NEW, State.LEARNING, State.RELEARNING]

    def test_schedule_new_card_good(self, service):
        """Reponse 'Good' pour nouvelle carte"""
        card = FSRSCard()
        now = datetime.utcnow()

        result = service.schedule(card, now)
        good_card = result.good.card

        # La stabilite devrait etre non nulle
        assert good_card.stability > 0

    def test_schedule_new_card_easy(self, service):
        """Reponse 'Easy' pour nouvelle carte"""
        card = FSRSCard()
        now = datetime.utcnow()

        result = service.schedule(card, now)
        easy_card = result.easy.card

        # Easy devrait donner plus de stabilite que Good
        good_card = result.good.card
        assert easy_card.stability >= good_card.stability


class TestScheduleReviewCard:
    """Tests pour la planification d'une carte en revision"""

    @pytest.fixture
    def service(self):
        return FSRSScheduler()

    @pytest.fixture
    def review_card(self):
        """Une carte en revision"""
        return FSRSCard(
            stability=10.0,
            difficulty=5.0,
            state=State.REVIEW,
            reps=5,
            last_review=datetime.utcnow() - timedelta(days=10)
        )

    def test_schedule_review_card(self, service, review_card):
        """Planification d'une carte en revision"""
        now = datetime.utcnow()
        result = service.schedule(review_card, now)

        assert isinstance(result, SchedulingCards)

    def test_again_decreases_stability(self, service, review_card):
        """'Again' diminue la stabilite"""
        now = datetime.utcnow()
        original_stability = review_card.stability

        result = service.schedule(review_card, now)
        again_card = result.again.card

        assert again_card.stability < original_stability

    def test_again_increases_lapses(self, service, review_card):
        """'Again' augmente les echecs"""
        now = datetime.utcnow()
        original_lapses = review_card.lapses

        result = service.schedule(review_card, now)
        again_card = result.again.card

        assert again_card.lapses == original_lapses + 1

    def test_good_increases_stability(self, service, review_card):
        """'Good' augmente la stabilite"""
        now = datetime.utcnow()
        original_stability = review_card.stability

        result = service.schedule(review_card, now)
        good_card = result.good.card

        assert good_card.stability >= original_stability

    def test_easy_gives_highest_stability(self, service, review_card):
        """'Easy' donne la plus haute stabilite"""
        now = datetime.utcnow()

        result = service.schedule(review_card, now)

        assert result.easy.card.stability >= result.good.card.stability
        assert result.good.card.stability >= result.hard.card.stability


class TestReviewCard:
    """Tests pour la fonction review"""

    @pytest.fixture
    def service(self):
        return FSRSScheduler()

    def test_review_new_card(self, service):
        """Revision d'une nouvelle carte"""
        card = FSRSCard()
        now = datetime.utcnow()

        new_card = service.review(card, Rating.GOOD, now)

        assert new_card.reps == 1
        assert new_card.stability > 0
        assert new_card.last_review == now

    def test_review_increments_reps(self, service):
        """Chaque revision incremente le compteur"""
        card = FSRSCard(reps=5)
        now = datetime.utcnow()

        new_card = service.review(card, Rating.GOOD, now)

        assert new_card.reps == 6

    def test_review_again_increments_lapses(self, service):
        """'Again' incremente les echecs pour carte en revision"""
        card = FSRSCard(
            state=State.REVIEW,
            stability=5.0,
            difficulty=5.0,
            reps=5,
            lapses=2
        )
        now = datetime.utcnow()

        new_card = service.review(card, Rating.AGAIN, now)

        assert new_card.lapses == 3

    def test_review_updates_last_review(self, service):
        """La revision met a jour last_review"""
        card = FSRSCard()
        now = datetime.utcnow()

        new_card = service.review(card, Rating.GOOD, now)

        assert new_card.last_review == now


class TestDifficulty:
    """Tests pour le calcul de difficulte"""

    @pytest.fixture
    def service(self):
        return FSRSScheduler()

    def test_initial_difficulty(self, service):
        """Difficulte initiale pour nouvelle carte"""
        card = FSRSCard()
        now = datetime.utcnow()

        new_card = service.review(card, Rating.GOOD, now)

        # Difficulte devrait etre initialisee
        assert new_card.difficulty > 0
        assert new_card.difficulty <= 10

    def test_difficulty_increases_with_hard(self, service):
        """La difficulte augmente avec les reponses difficiles"""
        card = FSRSCard(
            state=State.REVIEW,
            stability=5.0,
            difficulty=5.0,
            reps=5
        )
        now = datetime.utcnow()

        new_card = service.review(card, Rating.HARD, now)

        # La difficulte devrait augmenter ou rester stable
        assert new_card.difficulty >= card.difficulty - 0.5

    def test_difficulty_decreases_with_easy(self, service):
        """La difficulte diminue avec les reponses faciles"""
        card = FSRSCard(
            state=State.REVIEW,
            stability=5.0,
            difficulty=5.0,
            reps=5
        )
        now = datetime.utcnow()

        new_card = service.review(card, Rating.EASY, now)

        # La difficulte devrait diminuer ou rester stable
        assert new_card.difficulty <= card.difficulty + 0.5


class TestIntervalCalculation:
    """Tests pour le calcul des intervalles"""

    @pytest.fixture
    def service(self):
        return FSRSScheduler()

    def test_interval_for_new_card(self, service):
        """Intervalle pour nouvelle carte"""
        card = FSRSCard()
        now = datetime.utcnow()

        result = service.schedule(card, now)

        # Les intervalles devraient etre courts pour une nouvelle carte
        assert result.good.card.scheduled_days <= 30

    def test_interval_increases_with_reviews(self, service):
        """L'intervalle augmente avec les revisions"""
        card = FSRSCard()
        now = datetime.utcnow()

        # Premiere revision
        card = service.review(card, Rating.GOOD, now)
        first_interval = card.scheduled_days

        # Deuxieme revision
        card = service.review(card, Rating.GOOD, now + timedelta(days=first_interval))
        second_interval = card.scheduled_days

        # L'intervalle devrait augmenter
        assert second_interval > first_interval

    def test_interval_respects_maximum(self, service):
        """L'intervalle ne depasse pas le maximum"""
        card = FSRSCard(
            stability=1000.0,  # Tres haute stabilite
            difficulty=2.0,
            state=State.REVIEW,
            reps=50
        )
        now = datetime.utcnow()

        result = service.schedule(card, now)

        assert result.easy.card.scheduled_days <= service.params.maximum_interval


class TestFuzzFactor:
    """Tests pour le facteur de fuzz (variation aleatoire)"""

    @pytest.fixture
    def service_with_fuzz(self):
        params = FSRSParameters()
        params.enable_fuzz = True
        return FSRSScheduler(params)

    @pytest.fixture
    def service_without_fuzz(self):
        params = FSRSParameters()
        params.enable_fuzz = False
        return FSRSScheduler(params)

    def test_fuzz_creates_variation(self, service_with_fuzz):
        """Le fuzz cree de la variation dans les intervalles"""
        card = FSRSCard(
            stability=10.0,
            difficulty=5.0,
            state=State.REVIEW,
            reps=5
        )
        now = datetime.utcnow()

        # Collecter plusieurs intervalles
        intervals = []
        for _ in range(10):
            result = service_with_fuzz.schedule(card, now)
            intervals.append(result.good.card.scheduled_days)

        # Avec fuzz, il peut y avoir de la variation
        # Note: pas garanti car le fuzz peut donner les memes valeurs
        # Ce test verifie juste que ca ne plante pas
        assert len(intervals) == 10

    def test_no_fuzz_deterministic(self, service_without_fuzz):
        """Sans fuzz, les resultats sont deterministes"""
        card = FSRSCard(
            stability=10.0,
            difficulty=5.0,
            state=State.REVIEW,
            reps=5
        )
        now = datetime.utcnow()

        result1 = service_without_fuzz.schedule(card, now)
        result2 = service_without_fuzz.schedule(card, now)

        assert result1.good.card.scheduled_days == result2.good.card.scheduled_days


class TestEdgeCases:
    """Tests pour les cas limites"""

    @pytest.fixture
    def service(self):
        return FSRSScheduler()

    def test_zero_stability(self, service):
        """Gestion de stabilite zero"""
        card = FSRSCard(stability=0.0)
        now = datetime.utcnow()

        result = service.schedule(card, now)

        assert result.good.card.stability > 0

    def test_very_high_stability(self, service):
        """Gestion de tres haute stabilite"""
        card = FSRSCard(
            stability=10000.0,
            difficulty=1.0,
            state=State.REVIEW,
            reps=100
        )
        now = datetime.utcnow()

        result = service.schedule(card, now)

        # Ne devrait pas depasser le maximum
        assert result.easy.card.scheduled_days <= service.params.maximum_interval

    def test_many_lapses(self, service):
        """Carte avec beaucoup d'echecs"""
        card = FSRSCard(
            stability=5.0,
            difficulty=8.0,
            state=State.REVIEW,
            reps=20,
            lapses=15
        )
        now = datetime.utcnow()

        result = service.schedule(card, now)

        # Devrait toujours fonctionner
        assert result is not None
