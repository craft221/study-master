"""
Tests pour le service anti-triche
"""

import pytest
from datetime import datetime
from unittest.mock import patch, AsyncMock, MagicMock

from app.services.anti_cheat_service import (
    AntiCheatService,
    ViolationType,
    SeverityLevel,
    Violation,
    AntiCheatResult
)


class TestViolationTypes:
    """Tests pour les types de violations"""

    def test_violation_types_exist(self):
        """Tous les types de violations doivent exister"""
        assert ViolationType.TOO_FAST_ANSWER is not None
        assert ViolationType.TOO_FAST_QUIZ is not None
        assert ViolationType.TAB_SWITCH is not None
        assert ViolationType.WINDOW_BLUR is not None
        assert ViolationType.COPY_PASTE is not None
        assert ViolationType.IDENTICAL_ANSWERS is not None

    def test_severity_levels_exist(self):
        """Tous les niveaux de sévérité doivent exister"""
        assert SeverityLevel.LOW is not None
        assert SeverityLevel.MEDIUM is not None
        assert SeverityLevel.HIGH is not None
        assert SeverityLevel.CRITICAL is not None


class TestViolation:
    """Tests pour la classe Violation"""

    def test_violation_creation(self):
        """Doit pouvoir créer une violation"""
        violation = Violation(
            type=ViolationType.TOO_FAST_ANSWER,
            severity=SeverityLevel.MEDIUM,
            timestamp=datetime.utcnow(),
            details={"time_taken_ms": 500},
            user_id=1,
            quiz_id=1
        )

        assert violation.type == ViolationType.TOO_FAST_ANSWER
        assert violation.severity == SeverityLevel.MEDIUM
        assert violation.user_id == 1
        assert violation.quiz_id == 1
        assert "time_taken_ms" in violation.details


class TestAntiCheatResult:
    """Tests pour la classe AntiCheatResult"""

    def test_valid_result(self):
        """Doit créer un résultat valide"""
        result = AntiCheatResult(
            is_valid=True,
            violations=[],
            penalty_xp=0,
            is_disqualified=False
        )

        assert result.is_valid is True
        assert len(result.violations) == 0
        assert result.penalty_xp == 0

    def test_invalid_result_with_violations(self):
        """Doit créer un résultat invalide avec violations"""
        violations = [
            Violation(
                type=ViolationType.COPY_PASTE,
                severity=SeverityLevel.HIGH,
                timestamp=datetime.utcnow(),
                details={},
                user_id=1
            )
        ]

        result = AntiCheatResult(
            is_valid=False,
            violations=violations,
            penalty_xp=50,
            is_disqualified=True,
            warning_message="Comportement suspect détecté"
        )

        assert result.is_valid is False
        assert len(result.violations) == 1
        assert result.is_disqualified is True


class TestAntiCheatService:
    """Tests pour le service anti-triche"""

    @pytest.fixture
    def service(self):
        """Crée une instance du service"""
        return AntiCheatService()

    @pytest.fixture
    def mock_cache(self):
        """Mock du service de cache"""
        with patch('app.services.anti_cheat_service.cache_service') as mock:
            mock.get = AsyncMock(return_value=None)
            mock.set = AsyncMock(return_value=True)
            mock.delete = AsyncMock(return_value=True)
            yield mock

    @pytest.mark.asyncio
    async def test_start_session(self, service, mock_cache):
        """Doit démarrer une session anti-triche"""
        mock_cache.get.return_value = []  # Pas de sessions existantes

        session_id = await service.start_session(
            user_id=1,
            quiz_id=1,
            ip_address="127.0.0.1"
        )

        assert session_id is not None
        assert len(session_id) > 0
        mock_cache.set.assert_called()

    @pytest.mark.asyncio
    async def test_record_answer_normal(self, service, mock_cache):
        """Une réponse normale ne doit pas générer de violation"""
        # Simuler une session existante
        mock_cache.get.return_value = {
            "user_id": 1,
            "quiz_id": 1,
            "answers": [],
            "events": [],
            "violations": []
        }

        violation = await service.record_answer(
            session_id="test-session",
            question_id=0,
            answer_id=1,
            time_taken_ms=5000,  # 5 secondes - temps normal
            question_index=0
        )

        assert violation is None

    @pytest.mark.asyncio
    async def test_record_answer_too_fast(self, service, mock_cache):
        """Une réponse trop rapide doit générer une violation"""
        mock_cache.get.return_value = {
            "user_id": 1,
            "quiz_id": 1,
            "answers": [],
            "events": [],
            "violations": []
        }

        violation = await service.record_answer(
            session_id="test-session",
            question_id=0,
            answer_id=1,
            time_taken_ms=100,  # 100ms - trop rapide!
            question_index=0
        )

        assert violation is not None
        assert violation.type == ViolationType.TOO_FAST_ANSWER
        assert violation.severity == SeverityLevel.MEDIUM

    @pytest.mark.asyncio
    async def test_record_tab_switch_event(self, service, mock_cache):
        """Enregistrer des changements d'onglet"""
        mock_cache.get.return_value = {
            "user_id": 1,
            "quiz_id": 1,
            "answers": [],
            "events": [],
            "violations": [],
            "tab_switches": 0
        }

        # Premier changement - pas de violation
        violation = await service.record_event(
            session_id="test-session",
            event_type="tab_switch"
        )
        assert violation is None

    @pytest.mark.asyncio
    async def test_record_many_tab_switches(self, service, mock_cache):
        """Trop de changements d'onglet doit générer une violation"""
        mock_cache.get.return_value = {
            "user_id": 1,
            "quiz_id": 1,
            "answers": [],
            "events": [],
            "violations": [],
            "tab_switches": 4  # Déjà au dessus du seuil
        }

        violation = await service.record_event(
            session_id="test-session",
            event_type="tab_switch"
        )

        assert violation is not None
        assert violation.type == ViolationType.TAB_SWITCH

    @pytest.mark.asyncio
    async def test_record_copy_paste(self, service, mock_cache):
        """Un copier-coller doit générer une violation HIGH"""
        mock_cache.get.return_value = {
            "user_id": 1,
            "quiz_id": 1,
            "answers": [],
            "events": [],
            "violations": []
        }

        violation = await service.record_event(
            session_id="test-session",
            event_type="copy_paste",
            details={"action": "paste"}
        )

        assert violation is not None
        assert violation.type == ViolationType.COPY_PASTE
        assert violation.severity == SeverityLevel.HIGH

    @pytest.mark.asyncio
    async def test_validate_quiz_valid(self, service, mock_cache):
        """Un quiz normal doit être validé"""
        mock_cache.get.return_value = {
            "user_id": 1,
            "quiz_id": 1,
            "answers": [
                {"question_id": 0, "time_taken_ms": 5000},
                {"question_id": 1, "time_taken_ms": 4000},
                {"question_id": 2, "time_taken_ms": 6000}
            ],
            "events": [],
            "violations": []
        }

        result = await service.validate_quiz_completion(
            session_id="test-session",
            total_questions=3,
            score=80.0,
            total_time_seconds=60  # 1 minute pour 3 questions
        )

        assert result.is_valid is True
        assert result.is_disqualified is False
        assert result.penalty_xp == 0

    @pytest.mark.asyncio
    async def test_validate_quiz_too_fast(self, service, mock_cache):
        """Un quiz terminé trop vite doit être signalé"""
        mock_cache.get.return_value = {
            "user_id": 1,
            "quiz_id": 1,
            "answers": [],
            "events": [],
            "violations": []
        }

        result = await service.validate_quiz_completion(
            session_id="test-session",
            total_questions=10,
            score=100.0,
            total_time_seconds=5  # 5 secondes pour 10 questions - impossible!
        )

        assert result.is_valid is False or len(result.violations) > 0
        # Doit avoir au moins une violation TOO_FAST_QUIZ
        fast_violations = [v for v in result.violations if v.type == ViolationType.TOO_FAST_QUIZ]
        assert len(fast_violations) > 0

    @pytest.mark.asyncio
    async def test_validate_quiz_with_prior_violations(self, service, mock_cache):
        """Les violations précédentes doivent être prises en compte"""
        mock_cache.get.return_value = {
            "user_id": 1,
            "quiz_id": 1,
            "answers": [],
            "events": [],
            "violations": [
                {
                    "type": ViolationType.COPY_PASTE.value,
                    "severity": SeverityLevel.HIGH.value,
                    "timestamp": datetime.utcnow().isoformat(),
                    "details": {},
                    "user_id": 1,
                    "quiz_id": 1,
                    "duel_id": None
                },
                {
                    "type": ViolationType.TAB_SWITCH.value,
                    "severity": SeverityLevel.HIGH.value,
                    "timestamp": datetime.utcnow().isoformat(),
                    "details": {},
                    "user_id": 1,
                    "quiz_id": 1,
                    "duel_id": None
                },
                {
                    "type": ViolationType.WINDOW_BLUR.value,
                    "severity": SeverityLevel.HIGH.value,
                    "timestamp": datetime.utcnow().isoformat(),
                    "details": {},
                    "user_id": 1,
                    "quiz_id": 1,
                    "duel_id": None
                }
            ]
        }

        result = await service.validate_quiz_completion(
            session_id="test-session",
            total_questions=5,
            score=90.0,
            total_time_seconds=60
        )

        # Avec 3 violations HIGH, devrait être disqualifié
        assert result.is_disqualified is True
        assert result.penalty_xp > 0

    @pytest.mark.asyncio
    async def test_compare_duel_answers_no_cheating(self, service, mock_cache):
        """Des réponses différentes ne doivent pas être signalées"""
        session1_data = {
            "user_id": 1,
            "quiz_id": 1,
            "answers": [
                {"question_id": 0, "answer_id": 1, "time_taken_ms": 3000},
                {"question_id": 1, "answer_id": 2, "time_taken_ms": 4000}
            ],
            "events": [],
            "violations": []
        }

        session2_data = {
            "user_id": 2,
            "quiz_id": 1,
            "answers": [
                {"question_id": 0, "answer_id": 3, "time_taken_ms": 5000},
                {"question_id": 1, "answer_id": 4, "time_taken_ms": 6000}
            ],
            "events": [],
            "violations": []
        }

        # Configurer le mock pour retourner différentes données selon la clé
        async def mock_get(key):
            if "session1" in key:
                return session1_data
            elif "session2" in key:
                return session2_data
            return None

        mock_cache.get.side_effect = mock_get

        violation = await service.compare_duel_answers(
            session_id_1="session1",
            session_id_2="session2"
        )

        assert violation is None

    @pytest.mark.asyncio
    async def test_user_reputation_new_user(self, service, mock_cache):
        """Un nouvel utilisateur doit avoir une bonne réputation"""
        mock_cache.get.return_value = None  # Pas d'historique

        reputation = await service.check_user_reputation(user_id=1)

        assert reputation["trust_score"] == 100
        assert reputation["risk_level"] == "low"
        assert reputation["violation_count"] == 0

    @pytest.mark.asyncio
    async def test_user_reputation_with_violations(self, service, mock_cache):
        """Les violations doivent réduire la réputation"""
        mock_cache.get.return_value = {
            "violations": [
                {"type": "tab_switch", "severity": "medium", "timestamp": datetime.utcnow().isoformat()},
                {"type": "copy_paste", "severity": "high", "timestamp": datetime.utcnow().isoformat()}
            ],
            "total_penalty_xp": 60,
            "disqualification_count": 0
        }

        reputation = await service.check_user_reputation(user_id=1)

        assert reputation["trust_score"] < 100
        assert reputation["violation_count"] == 2

    @pytest.mark.asyncio
    async def test_user_reputation_disqualified(self, service, mock_cache):
        """Les disqualifications doivent fortement réduire la réputation"""
        mock_cache.get.return_value = {
            "violations": [
                {"type": "score_manipulation", "severity": "critical", "timestamp": datetime.utcnow().isoformat()}
            ],
            "total_penalty_xp": 100,
            "disqualification_count": 2
        }

        reputation = await service.check_user_reputation(user_id=1)

        assert reputation["trust_score"] < 60  # 100 - 5 - 40 = 55
        assert reputation["risk_level"] in ["medium", "high"]
        assert reputation["disqualification_count"] == 2


class TestAntiCheatThresholds:
    """Tests pour les seuils de détection"""

    def test_min_answer_time(self):
        """Le temps minimum de réponse doit être raisonnable"""
        service = AntiCheatService()
        assert service.MIN_ANSWER_TIME_MS >= 500
        assert service.MIN_ANSWER_TIME_MS <= 2000

    def test_max_tab_switches(self):
        """Le nombre max de changements d'onglet doit être tolérant mais pas trop"""
        service = AntiCheatService()
        assert service.MAX_TAB_SWITCHES >= 2
        assert service.MAX_TAB_SWITCHES <= 5

    def test_penalties_structure(self):
        """Les pénalités doivent être croissantes par sévérité"""
        service = AntiCheatService()
        penalties = service.PENALTIES

        assert penalties[SeverityLevel.LOW] < penalties[SeverityLevel.MEDIUM]
        assert penalties[SeverityLevel.MEDIUM] < penalties[SeverityLevel.HIGH]
        assert penalties[SeverityLevel.HIGH] < penalties[SeverityLevel.CRITICAL]
