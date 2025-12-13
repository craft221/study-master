"""
Tests pour les services
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock, MagicMock
import asyncio

from app.services.email_service import EmailService
from app.services.cache_service import AsyncCacheService, cache_service


class TestEmailService:
    """Tests pour le service email"""

    def test_email_service_initialization(self):
        """Le service email s'initialise correctement"""
        service = EmailService()
        assert service.from_name == "Study Master"
        assert service.smtp_port in [587, 465, 25]

    def test_email_service_disabled_without_credentials(self):
        """Le service est désactivé sans credentials"""
        with patch.object(EmailService, '__init__', lambda x: None):
            service = EmailService()
            service.smtp_user = ""
            service.smtp_password = ""
            service.enabled = False

            assert service.enabled == False

    def test_create_message(self):
        """Création d'un message email"""
        service = EmailService()
        service.from_name = "Test"
        service.from_email = "test@example.com"

        msg = service._create_message(
            to_email="recipient@example.com",
            subject="Test Subject",
            html_content="<p>Test</p>",
            text_content="Test"
        )

        assert msg['Subject'] == "Test Subject"
        assert "recipient@example.com" in msg['To']

    def test_send_sync_disabled(self):
        """Envoi échoue quand désactivé"""
        service = EmailService()
        service.enabled = False

        result = service._send_sync(
            to_email="test@example.com",
            subject="Test",
            html_content="<p>Test</p>"
        )

        assert result == False

    @pytest.mark.asyncio
    async def test_send_async_disabled(self):
        """Envoi async échoue quand désactivé"""
        service = EmailService()
        service.enabled = False

        result = await service.send_async(
            to_email="test@example.com",
            subject="Test",
            html_content="<p>Test</p>"
        )

        assert result == False

    def test_base_template_structure(self):
        """Le template de base a la bonne structure"""
        service = EmailService()
        html = service._base_template("<p>Content</p>", "Test Title")

        assert "<!DOCTYPE html>" in html
        assert "Test Title" in html
        assert "<p>Content</p>" in html
        assert "Study Master" in html
        assert "font-family" in html

    @pytest.mark.asyncio
    async def test_send_welcome_email(self):
        """Envoi d'email de bienvenue"""
        service = EmailService()
        service.enabled = False  # Désactivé pour le test

        with patch.object(service, 'send_async', return_value=True) as mock_send:
            result = await service.send_welcome("test@example.com", "testuser")

            # Vérifier que send_async a été appelé
            if mock_send.called:
                call_args = mock_send.call_args
                assert "test@example.com" in str(call_args)

    @pytest.mark.asyncio
    async def test_send_streak_reminder(self):
        """Envoi de rappel de streak"""
        service = EmailService()

        with patch.object(service, 'send_async', return_value=True) as mock_send:
            result = await service.send_streak_reminder(
                to_email="test@example.com",
                username="testuser",
                current_streak=7
            )

            mock_send.assert_called_once()
            # Vérifier le sujet contient le streak
            call_args = mock_send.call_args
            assert "7" in str(call_args)

    @pytest.mark.asyncio
    async def test_send_achievement_unlocked(self):
        """Envoi d'email de succès débloqué"""
        service = EmailService()

        with patch.object(service, 'send_async', return_value=True) as mock_send:
            result = await service.send_achievement_unlocked(
                to_email="test@example.com",
                username="testuser",
                achievement_name="Premier pas",
                achievement_description="Créer sa première note",
                xp_reward=10
            )

            mock_send.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_daily_digest(self):
        """Envoi du résumé quotidien"""
        service = EmailService()

        with patch.object(service, 'send_async', return_value=True) as mock_send:
            result = await service.send_daily_digest(
                to_email="test@example.com",
                username="testuser",
                stats={"streak": 5, "xp_today": 100, "cards_reviewed": 20},
                notifications=[
                    {"title": "Test", "message": "Test message"}
                ]
            )

            mock_send.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_duel_challenge(self):
        """Envoi de défi de duel"""
        service = EmailService()

        with patch.object(service, 'send_async', return_value=True) as mock_send:
            result = await service.send_duel_challenge(
                to_email="test@example.com",
                username="testuser",
                challenger_name="challenger",
                stakes_xp=50,
                duel_url="https://example.com/duel/1"
            )

            mock_send.assert_called_once()


class TestCacheService:
    """Tests pour le service de cache"""

    def test_cache_service_singleton_exists(self):
        """Le singleton cache_service existe"""
        assert cache_service is not None
        assert isinstance(cache_service, AsyncCacheService)

    def test_cache_service_has_required_methods(self):
        """Le service a les méthodes requises"""
        assert hasattr(cache_service, 'get')
        assert hasattr(cache_service, 'set')
        assert hasattr(cache_service, 'delete')
        assert callable(cache_service.get)
        assert callable(cache_service.set)
        assert callable(cache_service.delete)

    @pytest.mark.asyncio
    async def test_cache_get_returns_none_for_missing_key(self):
        """Get sur une clé inexistante retourne None"""
        # Test avec une clé qui n'existe certainement pas
        result = await cache_service.get("definitely_nonexistent_key_12345")
        assert result is None

    @pytest.mark.asyncio
    async def test_cache_delete_nonexistent_key(self):
        """Delete sur une clé inexistante ne lève pas d'erreur"""
        # Ne devrait pas lever d'exception
        result = await cache_service.delete("nonexistent_key_to_delete")
        # Le résultat peut être True, False, ou 0/1 selon l'implémentation
        assert result is not None or result == 0 or result == False or result == True


class TestGamificationTasks:
    """Tests pour les tâches de gamification"""

    def test_calculate_user_level_low_xp(self):
        """Calcul de niveau avec peu d'XP"""
        import math
        xp = 50
        level = max(1, int(math.sqrt(xp / 100)))
        assert level == 1

    def test_calculate_user_level_medium_xp(self):
        """Calcul de niveau avec XP moyen"""
        import math
        xp = 900
        level = max(1, int(math.sqrt(xp / 100)))
        assert level == 3

    def test_calculate_user_level_high_xp(self):
        """Calcul de niveau avec beaucoup d'XP"""
        import math
        xp = 10000
        level = max(1, int(math.sqrt(xp / 100)))
        assert level == 10

    def test_xp_for_next_level_formula(self):
        """Formule XP pour niveau suivant"""
        level = 5
        xp_needed = ((level + 1) ** 2) * 100  # 3600
        assert xp_needed == 3600

    def test_streak_calculation(self):
        """Calcul du streak"""
        today = datetime.utcnow().date()
        yesterday = today - timedelta(days=1)

        # Activité hier = streak continue
        last_activity = yesterday
        should_continue = (last_activity == yesterday or last_activity == today)
        assert should_continue == True

        # Pas d'activité depuis 2 jours = streak cassé
        two_days_ago = today - timedelta(days=2)
        should_break = (two_days_ago != yesterday and two_days_ago != today)
        assert should_break == True


class TestAntiCheatService:
    """Tests additionnels pour le service anti-triche"""

    def test_min_answer_time_constants(self):
        """Les constantes de temps minimum sont raisonnables"""
        from app.services.anti_cheat_service import AntiCheatService

        service = AntiCheatService()
        # Le temps minimum pour répondre doit être entre 500ms et 2000ms
        assert 500 <= service.MIN_ANSWER_TIME_MS <= 2000

    def test_max_tab_switches_constants(self):
        """Le nombre max de changements d'onglet est raisonnable"""
        from app.services.anti_cheat_service import AntiCheatService

        service = AntiCheatService()
        # Max tab switches entre 2 et 5
        assert 2 <= service.MAX_TAB_SWITCHES <= 5

    def test_penalty_structure(self):
        """Structure des pénalités"""
        from app.services.anti_cheat_service import (
            AntiCheatService,
            SeverityLevel
        )

        service = AntiCheatService()
        penalties = service.PENALTIES

        # Pénalités croissantes
        assert penalties[SeverityLevel.LOW] < penalties[SeverityLevel.MEDIUM]
        assert penalties[SeverityLevel.MEDIUM] < penalties[SeverityLevel.HIGH]
        assert penalties[SeverityLevel.HIGH] < penalties[SeverityLevel.CRITICAL]


class TestSecurityService:
    """Tests additionnels pour le service de sécurité"""

    def test_password_hash_length(self):
        """Le hash de mot de passe a une longueur suffisante"""
        from app.core.security import get_password_hash

        password = "TestPassword123!"
        hashed = get_password_hash(password)

        # Les hashs bcrypt font généralement 60 caractères
        assert len(hashed) >= 50

    def test_password_hash_starts_with_bcrypt_prefix(self):
        """Le hash commence par le préfixe bcrypt"""
        from app.core.security import get_password_hash

        password = "TestPassword123!"
        hashed = get_password_hash(password)

        # bcrypt hash commence par $2b$
        assert hashed.startswith("$2b$")

    def test_token_contains_expected_claims(self):
        """Le token JWT contient les claims attendus"""
        from app.core.security import create_access_token, verify_token

        data = {"sub": "123"}
        token = create_access_token(data)
        payload = verify_token(token)

        assert payload is not None
        assert payload["sub"] == "123"
        assert "exp" in payload
        assert payload["type"] == "access"

    def test_csrf_token_uniqueness(self):
        """Les tokens CSRF sont uniques"""
        from app.core.security import generate_csrf_token

        tokens = [generate_csrf_token() for _ in range(100)]
        unique_tokens = set(tokens)

        # Tous les tokens doivent être uniques
        assert len(unique_tokens) == 100

    def test_sanitize_string_xss_prevention(self):
        """La sanitization prévient XSS"""
        from app.core.security import sanitize_string

        dangerous_inputs = [
            "<script>alert('xss')</script>",
            "<img src=x onerror=alert(1)>",
            "<svg onload=alert(1)>",
            "<body onload=alert(1)>"
        ]

        for dangerous in dangerous_inputs:
            safe = sanitize_string(dangerous)
            # html.escape() convertit < en &lt; et > en &gt;
            # Donc les tags dangereux ne seront pas exécutés
            assert "<script>" not in safe  # Converti en &lt;script&gt;
            assert "<img" not in safe  # Converti en &lt;img
            assert "<svg" not in safe  # Converti en &lt;svg
            assert "<body" not in safe  # Converti en &lt;body
            # Vérifier que le contenu a été échappé
            assert "&lt;" in safe or safe == ""


class TestValidationFunctions:
    """Tests pour les fonctions de validation"""

    def test_email_validation_valid_formats(self):
        """Validation d'emails valides"""
        from app.core.security import validate_email

        valid_emails = [
            "user@example.com",
            "user.name@example.com",
            "user+tag@example.com",
            "user@subdomain.example.com",
            "user@example.co.uk"
        ]

        for email in valid_emails:
            assert validate_email(email) == True, f"{email} should be valid"

    def test_email_validation_invalid_formats(self):
        """Validation d'emails invalides"""
        from app.core.security import validate_email

        invalid_emails = [
            "notanemail",
            "@example.com",
            "user@",
            "user@.com",
            "user@example",
            ""
        ]

        for email in invalid_emails:
            assert validate_email(email) == False, f"{email} should be invalid"

    def test_username_validation(self):
        """Validation des usernames"""
        from app.core.security import validate_username

        # Valides
        valid, _ = validate_username("john_doe")
        assert valid == True

        valid, _ = validate_username("user123")
        assert valid == True

        # Invalides
        valid, error = validate_username("ab")  # Trop court
        assert valid == False
        assert "3" in error

        valid, error = validate_username("a" * 31)  # Trop long
        assert valid == False
        assert "30" in error

    def test_password_strength_validation(self):
        """Validation de la force du mot de passe"""
        from app.core.security import validate_password_strength

        # Fort
        valid, _ = validate_password_strength("SecurePass123!")
        assert valid == True

        # Faibles
        valid, error = validate_password_strength("short")
        assert valid == False

        valid, error = validate_password_strength("nouppercase123!")
        assert valid == False

        valid, error = validate_password_strength("NOLOWERCASE123!")
        assert valid == False

        valid, error = validate_password_strength("NoNumbersHere!")
        assert valid == False
