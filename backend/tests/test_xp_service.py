"""
Tests pour le service XP
"""
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


def run_async(coro):
    """Helper pour exécuter des coroutines"""
    return asyncio.get_event_loop().run_until_complete(coro)


def create_mock_user(total_xp=100, level=1, user_id=1, username="testuser"):
    """Helper pour créer un mock user avec gamification"""
    user = MagicMock()
    user.id = user_id
    user.username = username
    user.gamification = MagicMock()
    user.gamification.total_xp = total_xp
    user.gamification.level = level
    return user


class TestXPServiceAwardXP:
    """Tests pour la fonction award_xp"""

    def test_award_xp_updates_user(self):
        """award_xp met à jour le total_xp de l'utilisateur"""
        from app.services.xp_service import award_xp

        user = create_mock_user(total_xp=100, level=1)

        async def run_test():
            with patch('app.services.xp_service.get_broadcast_func') as mock_get_broadcast:
                mock_broadcast = AsyncMock()
                mock_get_broadcast.return_value = mock_broadcast
                return await award_xp(user, amount=50, reason="Test XP")

        result = run_async(run_test())
        assert user.gamification.total_xp == 150
        assert result["xp_gained"] == 50
        assert result["total_xp"] == 150

    def test_award_xp_calculates_level(self):
        """award_xp calcule correctement le niveau"""
        from app.services.xp_service import award_xp

        # Nouvelle formule Duolingo: niveau 2 à 75 XP
        user = create_mock_user(total_xp=70, level=1)

        async def run_test():
            with patch('app.services.xp_service.get_broadcast_func') as mock_get_broadcast:
                mock_broadcast = AsyncMock()
                mock_get_broadcast.return_value = mock_broadcast
                return await award_xp(user, amount=10, reason="Level up test")

        result = run_async(run_test())
        assert user.gamification.total_xp == 80
        assert result["level"] == 2  # 80 XP = niveau 2 (seuil: 75 XP)

    def test_award_xp_level_up(self):
        """award_xp détecte le level up"""
        from app.services.xp_service import award_xp

        # Nouvelle formule: niveau 2 à 75 XP, on part de 50 XP niveau 1
        user = create_mock_user(total_xp=50, level=1)

        async def run_test():
            with patch('app.services.xp_service.get_broadcast_func') as mock_get_broadcast:
                mock_broadcast = AsyncMock()
                mock_get_broadcast.return_value = mock_broadcast
                return await award_xp(user, amount=30, reason="Big XP gain")

        result = run_async(run_test())
        assert result["level_up"] is True  # 80 XP >= 75 XP (niveau 2)
        assert user.gamification.level == 2

    def test_award_xp_no_level_up(self):
        """award_xp ne lève pas de level up si pas de changement"""
        from app.services.xp_service import award_xp

        # Niveau 2 commence à 75 XP, niveau 3 à 175 XP
        # On part de 80 XP (niveau 2) et on ajoute 40, donc 120 XP (toujours niveau 2)
        user = create_mock_user(total_xp=80, level=2)

        async def run_test():
            with patch('app.services.xp_service.get_broadcast_func') as mock_get_broadcast:
                mock_broadcast = AsyncMock()
                mock_get_broadcast.return_value = mock_broadcast
                return await award_xp(user, amount=40, reason="Small gain")

        result = run_async(run_test())
        assert result["level_up"] is False  # 120 XP < 175 XP (seuil niveau 3)

    def test_award_xp_broadcasts_update(self):
        """award_xp broadcast la mise à jour"""
        from app.services.xp_service import award_xp

        user = create_mock_user(total_xp=100, level=1, user_id=42)

        async def run_test():
            with patch('app.services.xp_service.get_broadcast_func') as mock_get_broadcast:
                mock_broadcast = AsyncMock()
                mock_get_broadcast.return_value = mock_broadcast
                await award_xp(user, amount=50, reason="Test broadcast")
                return mock_broadcast.call_args

        call_args = run_async(run_test())
        assert call_args.kwargs["user_id"] == 42
        assert call_args.kwargs["username"] == "testuser"
        assert call_args.kwargs["data"]["xp_gained"] == 50

    def test_award_xp_broadcast_failure_non_blocking(self):
        """award_xp continue même si le broadcast échoue"""
        from app.services.xp_service import award_xp

        user = create_mock_user(total_xp=100, level=1)

        async def run_test():
            with patch('app.services.xp_service.get_broadcast_func') as mock_get_broadcast:
                mock_broadcast = AsyncMock(side_effect=Exception("Broadcast error"))
                mock_get_broadcast.return_value = mock_broadcast
                return await award_xp(user, amount=50, reason="Test")

        result = run_async(run_test())
        assert result["xp_gained"] == 50
        assert user.gamification.total_xp == 150

    def test_award_xp_with_extra_data(self):
        """award_xp inclut les données supplémentaires"""
        from app.services.xp_service import award_xp

        user = create_mock_user(total_xp=100, level=1)

        async def run_test():
            with patch('app.services.xp_service.get_broadcast_func') as mock_get_broadcast:
                mock_broadcast = AsyncMock()
                mock_get_broadcast.return_value = mock_broadcast
                await award_xp(
                    user, amount=50, reason="Quiz completed",
                    event_type="quiz_completed",
                    extra_data={"quiz_id": 123, "score": 85}
                )
                return mock_broadcast.call_args

        call_args = run_async(run_test())
        assert call_args.kwargs["event_type"] == "quiz_completed"
        assert call_args.kwargs["data"]["quiz_id"] == 123
        assert call_args.kwargs["data"]["score"] == 85

    def test_award_xp_no_gamification_record(self):
        """award_xp gère le cas où gamification n'existe pas"""
        from app.services.xp_service import award_xp

        user = MagicMock()
        user.id = 1
        user.username = "testuser"
        user.gamification = None

        async def run_test():
            with patch('app.services.xp_service.get_broadcast_func') as mock_get_broadcast:
                mock_broadcast = AsyncMock()
                mock_get_broadcast.return_value = mock_broadcast
                return await award_xp(user, amount=50, reason="Test")

        result = run_async(run_test())
        assert result["xp_gained"] == 0
        assert result["total_xp"] == 0
        assert result["level"] == 1
        assert result["level_up"] is False


class TestXPServiceBroadcastStatUpdate:
    """Tests pour broadcast_stat_update"""

    def test_broadcast_stat_update(self):
        """broadcast_stat_update envoie les bonnes données"""
        from app.services.xp_service import broadcast_stat_update

        user = MagicMock()
        user.id = 1
        user.username = "testuser"
        user.level = 5
        user.total_xp = 500

        async def run_test():
            with patch('app.services.xp_service.get_broadcast_func') as mock_get_broadcast:
                mock_broadcast = AsyncMock()
                mock_get_broadcast.return_value = mock_broadcast
                await broadcast_stat_update(
                    user=user,
                    stat_type="flashcards_reviewed",
                    value=100,
                    event_type="flashcard_stats"
                )
                return mock_broadcast.call_args

        call_args = run_async(run_test())
        assert call_args.kwargs["user_id"] == 1
        assert call_args.kwargs["username"] == "testuser"
        assert call_args.kwargs["event_type"] == "flashcard_stats"
        assert call_args.kwargs["data"]["stat_type"] == "flashcards_reviewed"
        assert call_args.kwargs["data"]["value"] == 100
        assert call_args.kwargs["data"]["level"] == 5
        assert call_args.kwargs["data"]["total_xp"] == 500

    def test_broadcast_stat_update_failure_non_blocking(self):
        """broadcast_stat_update ne bloque pas sur erreur"""
        from app.services.xp_service import broadcast_stat_update

        user = MagicMock()
        user.id = 1
        user.username = "testuser"
        user.level = 5
        user.total_xp = 500

        async def run_test():
            with patch('app.services.xp_service.get_broadcast_func') as mock_get_broadcast:
                mock_broadcast = AsyncMock(side_effect=Exception("Error"))
                mock_get_broadcast.return_value = mock_broadcast
                # Ne doit pas lever d'exception
                await broadcast_stat_update(
                    user=user,
                    stat_type="test",
                    value=10,
                    event_type="test_event"
                )

        # Ne doit pas lever d'exception
        run_async(run_test())


class TestGetBroadcastFunc:
    """Tests pour get_broadcast_func"""

    def test_get_broadcast_func_returns_callable(self):
        """get_broadcast_func retourne une fonction callable"""
        import app.services.xp_service as xp_module

        # Reset le cache global
        xp_module._broadcast_func = None

        from app.services.xp_service import get_broadcast_func

        result = get_broadcast_func()
        assert callable(result)

        # Cleanup
        xp_module._broadcast_func = None

    def test_get_broadcast_func_caches_result(self):
        """get_broadcast_func cache le résultat"""
        import app.services.xp_service as xp_module

        # Mettre une valeur dans le cache
        mock_func = MagicMock()
        xp_module._broadcast_func = mock_func

        from app.services.xp_service import get_broadcast_func
        result = get_broadcast_func()

        assert result is mock_func

        # Cleanup
        xp_module._broadcast_func = None


class TestXPCalculations:
    """Tests des calculs XP"""

    def test_level_calculation_boundary(self):
        """Test des limites de calcul de niveau"""
        from app.services.xp_service import award_xp

        # Nouvelle formule: niveau 2 à 75 XP exactement
        user = create_mock_user(total_xp=74, level=1)

        async def run_test():
            with patch('app.services.xp_service.get_broadcast_func') as mock_get_broadcast:
                mock_broadcast = AsyncMock()
                mock_get_broadcast.return_value = mock_broadcast
                return await award_xp(user, amount=1, reason="Boundary test")

        result = run_async(run_test())
        assert user.gamification.total_xp == 75
        assert result["level"] == 2  # 75 XP = exactement niveau 2
        assert result["level_up"] is True

    def test_multiple_level_ups(self):
        """Test de plusieurs level ups en une fois"""
        from app.services.xp_service import award_xp

        # Nouvelle formule Duolingo:
        # Niveau 2: 75 XP, Niveau 3: 175 XP, Niveau 4: 300 XP
        # On part de 50 XP (niveau 1), on ajoute 260 = 310 XP (niveau 4)
        user = create_mock_user(total_xp=50, level=1)

        async def run_test():
            with patch('app.services.xp_service.get_broadcast_func') as mock_get_broadcast:
                mock_broadcast = AsyncMock()
                mock_get_broadcast.return_value = mock_broadcast
                return await award_xp(user, amount=260, reason="Big bonus")

        result = run_async(run_test())
        assert user.gamification.total_xp == 310
        assert result["level"] == 4  # 310 XP >= 300 XP (seuil niveau 4)
        assert result["level_up"] is True

    def test_zero_xp_award(self):
        """Test avec 0 XP (cas limite)"""
        from app.services.xp_service import award_xp

        user = create_mock_user(total_xp=100, level=1)

        async def run_test():
            with patch('app.services.xp_service.get_broadcast_func') as mock_get_broadcast:
                mock_broadcast = AsyncMock()
                mock_get_broadcast.return_value = mock_broadcast
                return await award_xp(user, amount=0, reason="Zero XP")

        result = run_async(run_test())
        assert user.gamification.total_xp == 100
        assert result["xp_gained"] == 0
        assert result["level_up"] is False
