"""
Tests pour le service Mascotte Spark
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone


class TestMascotServiceFallbackMessages:
    """Tests des messages de fallback (sans IA)"""

    def test_get_fallback_message_welcome(self):
        """Retourne un message de bienvenue"""
        from app.services.mascot_service import MascotService
        service = MascotService()
        message = service._get_fallback_message("welcome")
        assert message is not None
        assert len(message) > 10

    def test_get_fallback_message_quiz_success(self):
        """Retourne un message de réussite quiz"""
        from app.services.mascot_service import MascotService
        service = MascotService()
        message = service._get_fallback_message("quiz_success")
        assert message is not None
        assert any(emoji in message for emoji in ["🎉", "⚡", "💪"])

    def test_get_fallback_message_quiz_failed(self):
        """Retourne un message d'encouragement"""
        from app.services.mascot_service import MascotService
        service = MascotService()
        message = service._get_fallback_message("quiz_failed")
        assert message is not None

    def test_get_fallback_message_streak_with_days(self):
        """Retourne un message de streak avec jours formatés"""
        from app.services.mascot_service import MascotService
        service = MascotService()
        message = service._get_fallback_message("streak", days=10)
        assert "10" in message

    def test_get_fallback_message_idle(self):
        """Retourne un message quand l'utilisateur est inactif"""
        from app.services.mascot_service import MascotService
        service = MascotService()
        message = service._get_fallback_message("idle")
        assert message is not None

    def test_get_fallback_message_unknown_event(self):
        """Retourne un message de bienvenue pour événement inconnu"""
        from app.services.mascot_service import MascotService
        service = MascotService()
        message = service._get_fallback_message("unknown_event_type")
        assert message is not None  # Fallback vers welcome

    def test_get_fallback_message_level_up(self):
        """Retourne un message de level up avec niveau formaté"""
        from app.services.mascot_service import MascotService
        service = MascotService()
        message = service._get_fallback_message("level_up", level=5)
        assert "5" in message

    def test_get_fallback_message_new_accessory(self):
        """Retourne un message nouvel accessoire"""
        from app.services.mascot_service import MascotService
        service = MascotService()
        message = service._get_fallback_message("new_accessory", accessory="glasses")
        assert "glasses" in message


class TestMascotServiceGetMessage:
    """Tests pour get_message - utilise asyncio.run pour éviter les problèmes pytest-asyncio"""

    def test_get_message_welcome_no_ai(self):
        """get_message pour welcome utilise fallback (pas IA)"""
        import asyncio
        from app.services.mascot_service import MascotService
        service = MascotService()

        async def run_test():
            with patch.object(service, '_call_claude_for_message') as mock_claude:
                result = await service.get_message(
                    event="welcome",
                    user_context={"user_name": "Test"},
                    use_ai=True  # Même avec use_ai=True, welcome n'appelle pas l'IA
                )

                # welcome ne doit pas appeler Claude
                mock_claude.assert_not_called()
                return result

        result = asyncio.get_event_loop().run_until_complete(run_test())

        assert "message" in result
        assert "mood" in result
        assert "animation" in result
        assert result["mood"] == "happy"
        assert result["animation"] == "wave"

    def test_get_message_idle_no_ai(self):
        """get_message pour idle utilise fallback"""
        import asyncio
        from app.services.mascot_service import MascotService
        service = MascotService()

        async def run_test():
            return await service.get_message(
                event="idle",
                user_context={"user_name": "Test"},
                use_ai=True
            )

        result = asyncio.get_event_loop().run_until_complete(run_test())

        assert result["mood"] == "sad"
        assert result["animation"] == "sleep"

    def test_get_message_quiz_success_with_ai_disabled(self):
        """get_message avec use_ai=False utilise fallback"""
        import asyncio
        from app.services.mascot_service import MascotService
        service = MascotService()

        async def run_test():
            return await service.get_message(
                event="quiz_success",
                user_context={"user_name": "Test"},
                use_ai=False
            )

        result = asyncio.get_event_loop().run_until_complete(run_test())

        assert result["mood"] == "excited"
        assert result["animation"] == "celebration"
        assert "message" in result

    def test_get_message_returns_timestamp(self):
        """get_message inclut un timestamp"""
        import asyncio
        from app.services.mascot_service import MascotService
        service = MascotService()

        async def run_test():
            return await service.get_message(
                event="welcome",
                user_context={}
            )

        result = asyncio.get_event_loop().run_until_complete(run_test())

        assert "timestamp" in result
        assert "T" in result["timestamp"]  # Format ISO

    def test_get_message_achievement(self):
        """get_message pour achievement"""
        import asyncio
        from app.services.mascot_service import MascotService
        service = MascotService()

        async def run_test():
            with patch.object(service, '_call_claude_for_message', new_callable=AsyncMock) as mock:
                mock.return_value = "Bravo pour ce succès ! 🎉"
                return await service.get_message(
                    event="achievement",
                    user_context={"user_name": "Test", "level": 5}
                )

        result = asyncio.get_event_loop().run_until_complete(run_test())

        assert result["mood"] == "excited"
        assert result["animation"] == "celebration"


class TestMascotServiceAccessories:
    """Tests pour les accessoires"""

    def test_get_accessory_info_returns_all_accessories(self):
        """get_accessory_info retourne tous les accessoires"""
        from app.services.mascot_service import MascotService
        service = MascotService()

        info = service.get_accessory_info()

        assert "graduate_hat" in info
        assert "glasses" in info
        assert "golden_acorn" in info
        assert "lightning_cape" in info
        assert "mini_library" in info
        assert "trophy" in info
        assert "crown" in info

    def test_accessory_info_structure(self):
        """Chaque accessoire a les bons champs"""
        from app.services.mascot_service import MascotService
        service = MascotService()

        info = service.get_accessory_info()

        for accessory_id, accessory_data in info.items():
            assert "name" in accessory_data
            assert "description" in accessory_data
            assert "emoji" in accessory_data
            assert "requirement" in accessory_data


class TestMascotServiceFallbackAnswer:
    """Tests pour les réponses de fallback"""

    def test_get_fallback_answer_structure(self):
        """_get_fallback_answer retourne la bonne structure"""
        from app.services.mascot_service import MascotService
        service = MascotService()

        result = service._get_fallback_answer()

        assert "answer" in result
        assert "mood" in result
        assert "animation" in result
        assert "suggestions" in result
        assert "timestamp" in result

    def test_get_fallback_answer_has_suggestions(self):
        """_get_fallback_answer a des suggestions"""
        from app.services.mascot_service import MascotService
        service = MascotService()

        result = service._get_fallback_answer()

        assert len(result["suggestions"]) >= 3

    def test_get_fallback_answer_mood_thinking(self):
        """_get_fallback_answer a le mood 'thinking'"""
        from app.services.mascot_service import MascotService
        service = MascotService()

        result = service._get_fallback_answer()

        assert result["mood"] == "thinking"
        assert result["animation"] == "think"


class TestMascotServiceAskQuestion:
    """Tests pour ask_question"""

    def test_ask_question_no_api_key(self):
        """ask_question sans API key retourne fallback"""
        import asyncio
        from app.services.mascot_service import MascotService

        service = MascotService()

        async def run_test():
            with patch('app.services.mascot_service.async_client', None):
                return await service.ask_question(
                    question="Comment créer des flashcards ?",
                    user_context={"level": 1, "user_name": "Test"}
                )

        result = asyncio.get_event_loop().run_until_complete(run_test())

        assert "answer" in result
        assert "suggestions" in result
        assert result["mood"] == "thinking"  # Fallback mood


class TestMascotServiceGetContextualHint:
    """Tests pour get_contextual_hint"""

    def test_get_contextual_hint_no_api(self):
        """get_contextual_hint sans API retourne fallback"""
        import asyncio
        from app.services.mascot_service import MascotService

        service = MascotService()

        async def run_test():
            with patch('app.services.mascot_service.async_client', None):
                return await service.get_contextual_hint("Mathématiques", "easy")

        result = asyncio.get_event_loop().run_until_complete(run_test())

        assert "Mathématiques" in result
        assert "🐿️" in result


class TestMascotServiceCachedMessages:
    """Tests pour les messages en cache"""

    def test_cached_messages_exist(self):
        """Les messages cachés existent"""
        from app.services.mascot_service import MascotService
        service = MascotService()

        assert "welcome" in service.cached_messages
        assert "quiz_success" in service.cached_messages
        assert "quiz_failed" in service.cached_messages
        assert "streak" in service.cached_messages
        assert "idle" in service.cached_messages

    def test_cached_messages_non_empty(self):
        """Chaque catégorie a des messages"""
        from app.services.mascot_service import MascotService
        service = MascotService()

        for category, messages in service.cached_messages.items():
            assert len(messages) >= 1, f"Category {category} is empty"


class TestMascotServiceMoodMapping:
    """Tests pour le mapping mood/animation"""

    def test_mood_mapping_streak(self):
        """streak a le bon mood"""
        import asyncio
        from app.services.mascot_service import MascotService
        service = MascotService()

        async def run_test():
            return await service.get_message("streak", {"days": 5}, use_ai=False)

        result = asyncio.get_event_loop().run_until_complete(run_test())
        assert result["mood"] == "excited"
        assert result["animation"] == "jump"

    def test_mood_mapping_level_up(self):
        """level_up a le bon mood"""
        import asyncio
        from app.services.mascot_service import MascotService
        service = MascotService()

        async def run_test():
            return await service.get_message("level_up", {"level": 5}, use_ai=False)

        result = asyncio.get_event_loop().run_until_complete(run_test())
        assert result["mood"] == "excited"
        assert result["animation"] == "evolution"

    def test_mood_mapping_flashcard_created(self):
        """flashcard_created a le bon mood"""
        import asyncio
        from app.services.mascot_service import MascotService
        service = MascotService()

        async def run_test():
            return await service.get_message("flashcard_created", {}, use_ai=False)

        result = asyncio.get_event_loop().run_until_complete(run_test())
        assert result["mood"] == "happy"
        assert result["animation"] == "collect"

    def test_mood_mapping_unknown_event(self):
        """unknown event a le mood par défaut"""
        import asyncio
        from app.services.mascot_service import MascotService
        service = MascotService()

        async def run_test():
            return await service.get_message("unknown_event", {}, use_ai=False)

        result = asyncio.get_event_loop().run_until_complete(run_test())
        assert result["mood"] == "happy"
        assert result["animation"] == "idle"


class TestMascotServiceInstance:
    """Tests de l'instance globale"""

    def test_global_instance_exists(self):
        """L'instance globale existe"""
        from app.services.mascot_service import mascot_service
        assert mascot_service is not None

    def test_global_instance_is_mascot_service(self):
        """L'instance globale est un MascotService"""
        from app.services.mascot_service import mascot_service, MascotService
        assert isinstance(mascot_service, MascotService)

    def test_model_is_configured(self):
        """Le modèle IA est configuré"""
        from app.services.mascot_service import mascot_service
        assert mascot_service.model is not None
        assert "claude" in mascot_service.model

    def test_max_tokens_configured(self):
        """max_tokens est configuré"""
        from app.services.mascot_service import mascot_service
        assert mascot_service.max_tokens == 200
