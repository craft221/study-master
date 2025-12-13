"""
Tests pour le gestionnaire WebSocket
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from app.websockets.connection_manager import ConnectionManager, UserConnection


class TestConnectionManagerInit:
    """Tests pour l'initialisation du gestionnaire"""

    def test_connection_manager_initialization(self):
        """Le gestionnaire s'initialise correctement"""
        manager = ConnectionManager()

        assert manager._connections == {}
        assert manager._rooms == {}
        assert manager._presence == {}
        assert manager._lock is not None


class TestUserConnection:
    """Tests pour UserConnection"""

    def test_user_connection_creation(self):
        """Création d'une UserConnection"""
        mock_ws = MagicMock()

        connection = UserConnection(
            websocket=mock_ws,
            user_id=1,
            username="testuser"
        )

        assert connection.user_id == 1
        assert connection.username == "testuser"
        assert connection.rooms == set()
        assert connection.metadata == {}
        assert connection.connected_at is not None

    def test_user_connection_with_metadata(self):
        """UserConnection avec métadonnées"""
        mock_ws = MagicMock()

        connection = UserConnection(
            websocket=mock_ws,
            user_id=1,
            username="testuser",
            metadata={"role": "student"}
        )

        assert connection.metadata["role"] == "student"


class TestConnect:
    """Tests pour la connexion"""

    @pytest.mark.asyncio
    async def test_connect_new_user(self):
        """Connexion d'un nouvel utilisateur"""
        manager = ConnectionManager()
        mock_ws = AsyncMock()

        connection = await manager.connect(
            websocket=mock_ws,
            user_id=1,
            username="testuser"
        )

        assert connection.user_id == 1
        assert connection.username == "testuser"
        assert 1 in manager._connections
        mock_ws.accept.assert_called_once()

    @pytest.mark.asyncio
    async def test_connect_replaces_existing(self):
        """La connexion remplace l'ancienne"""
        manager = ConnectionManager()

        # Première connexion
        old_ws = AsyncMock()
        await manager.connect(old_ws, 1, "user1")

        # Deuxième connexion (même utilisateur)
        new_ws = AsyncMock()
        await manager.connect(new_ws, 1, "user1")

        # L'ancienne connexion doit être fermée
        old_ws.close.assert_called_once()
        assert manager._connections[1].websocket == new_ws

    @pytest.mark.asyncio
    async def test_connect_with_metadata(self):
        """Connexion avec métadonnées"""
        manager = ConnectionManager()
        mock_ws = AsyncMock()

        connection = await manager.connect(
            websocket=mock_ws,
            user_id=1,
            username="testuser",
            metadata={"device": "mobile"}
        )

        assert connection.metadata["device"] == "mobile"


class TestDisconnect:
    """Tests pour la déconnexion"""

    @pytest.mark.asyncio
    async def test_disconnect_user(self):
        """Déconnexion d'un utilisateur"""
        manager = ConnectionManager()
        mock_ws = AsyncMock()

        await manager.connect(mock_ws, 1, "user1")
        await manager.disconnect(1)

        assert 1 not in manager._connections

    @pytest.mark.asyncio
    async def test_disconnect_nonexistent_user(self):
        """Déconnexion d'un utilisateur inexistant"""
        manager = ConnectionManager()

        # Ne doit pas lever d'erreur
        await manager.disconnect(999)

    @pytest.mark.asyncio
    async def test_disconnect_leaves_all_rooms(self):
        """La déconnexion quitte toutes les rooms"""
        manager = ConnectionManager()
        mock_ws = AsyncMock()

        await manager.connect(mock_ws, 1, "user1")
        await manager.join_room(1, "room1")
        await manager.join_room(1, "room2")

        await manager.disconnect(1)

        assert 1 not in manager._rooms.get("room1", set())
        assert 1 not in manager._rooms.get("room2", set())


class TestRooms:
    """Tests pour les rooms"""

    @pytest.mark.asyncio
    async def test_join_room(self):
        """Rejoindre une room"""
        manager = ConnectionManager()
        mock_ws = AsyncMock()

        await manager.connect(mock_ws, 1, "user1")
        result = await manager.join_room(1, "study_room")

        assert result == True
        assert 1 in manager._rooms["study_room"]
        assert "study_room" in manager._connections[1].rooms

    @pytest.mark.asyncio
    async def test_join_room_nonexistent_user(self):
        """Rejoindre une room sans être connecté"""
        manager = ConnectionManager()

        result = await manager.join_room(999, "room1")

        assert result == False

    @pytest.mark.asyncio
    async def test_join_room_creates_room(self):
        """Rejoindre une room la crée si elle n'existe pas"""
        manager = ConnectionManager()
        mock_ws = AsyncMock()

        await manager.connect(mock_ws, 1, "user1")
        await manager.join_room(1, "new_room")

        assert "new_room" in manager._rooms
        assert "new_room" in manager._presence

    @pytest.mark.asyncio
    async def test_leave_room(self):
        """Quitter une room"""
        manager = ConnectionManager()
        mock_ws = AsyncMock()

        await manager.connect(mock_ws, 1, "user1")
        await manager.join_room(1, "room1")

        result = await manager.leave_room(1, "room1")

        assert result == True
        assert 1 not in manager._rooms.get("room1", set())

    @pytest.mark.asyncio
    async def test_leave_room_not_member(self):
        """Quitter une room dont on n'est pas membre"""
        manager = ConnectionManager()
        mock_ws = AsyncMock()

        await manager.connect(mock_ws, 1, "user1")
        result = await manager.leave_room(1, "nonexistent_room")

        assert result == False

    @pytest.mark.asyncio
    async def test_get_room_members(self):
        """Obtenir les membres d'une room"""
        manager = ConnectionManager()

        ws1 = AsyncMock()
        ws2 = AsyncMock()

        await manager.connect(ws1, 1, "user1")
        await manager.connect(ws2, 2, "user2")
        await manager.join_room(1, "room1")
        await manager.join_room(2, "room1")

        members = manager.get_room_members("room1")

        assert 1 in members
        assert 2 in members

    def test_get_room_members_empty(self):
        """Obtenir les membres d'une room vide"""
        manager = ConnectionManager()

        members = manager.get_room_members("nonexistent")

        assert members == []


class TestMessaging:
    """Tests pour l'envoi de messages"""

    @pytest.mark.asyncio
    async def test_send_personal_message(self):
        """Envoyer un message personnel"""
        manager = ConnectionManager()
        mock_ws = AsyncMock()

        await manager.connect(mock_ws, 1, "user1")

        result = await manager.send_personal(1, {"type": "test", "data": "hello"})

        assert result == True
        mock_ws.send_json.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_personal_to_offline_user(self):
        """Envoyer un message à un utilisateur hors ligne"""
        manager = ConnectionManager()

        result = await manager.send_personal(999, {"type": "test"})

        assert result == False

    @pytest.mark.asyncio
    async def test_broadcast_to_room(self):
        """Diffuser un message à une room"""
        manager = ConnectionManager()

        ws1 = AsyncMock()
        ws2 = AsyncMock()
        ws3 = AsyncMock()

        await manager.connect(ws1, 1, "user1")
        await manager.connect(ws2, 2, "user2")
        await manager.connect(ws3, 3, "user3")

        await manager.join_room(1, "room1")
        await manager.join_room(2, "room1")
        # user3 n'est pas dans la room

        await manager.broadcast_to_room("room1", {"type": "test"})

        ws1.send_json.assert_called()
        ws2.send_json.assert_called()
        # ws3 ne devrait pas avoir reçu le message dans ce broadcast

    @pytest.mark.asyncio
    async def test_broadcast_to_room_exclude_user(self):
        """Diffuser en excluant un utilisateur"""
        manager = ConnectionManager()

        ws1 = AsyncMock()
        ws2 = AsyncMock()

        await manager.connect(ws1, 1, "user1")
        await manager.connect(ws2, 2, "user2")

        await manager.join_room(1, "room1")
        await manager.join_room(2, "room1")

        await manager.broadcast_to_room("room1", {"type": "test"}, exclude_user=1)

        # user1 exclu
        ws2.send_json.assert_called()

    @pytest.mark.asyncio
    async def test_broadcast_to_all(self):
        """Diffuser à tous les utilisateurs connectés"""
        manager = ConnectionManager()

        ws1 = AsyncMock()
        ws2 = AsyncMock()

        await manager.connect(ws1, 1, "user1")
        await manager.connect(ws2, 2, "user2")

        await manager.broadcast_to_all({"type": "announcement"})

        ws1.send_json.assert_called()
        ws2.send_json.assert_called()


class TestPresence:
    """Tests pour la gestion de présence"""

    @pytest.mark.asyncio
    async def test_presence_on_join(self):
        """La présence est mise à jour à l'entrée"""
        manager = ConnectionManager()
        mock_ws = AsyncMock()

        await manager.connect(mock_ws, 1, "user1")
        await manager.join_room(1, "room1")

        presence = manager.get_room_presence("room1")

        assert 1 in presence
        assert presence[1]["username"] == "user1"
        assert presence[1]["status"] == "online"

    @pytest.mark.asyncio
    async def test_update_presence(self):
        """Mise à jour du statut de présence"""
        manager = ConnectionManager()
        mock_ws = AsyncMock()

        await manager.connect(mock_ws, 1, "user1")
        await manager.join_room(1, "room1")

        await manager.update_presence(1, "room1", "away")

        presence = manager.get_room_presence("room1")
        assert presence[1]["status"] == "away"

    def test_is_user_online(self):
        """Vérifier si un utilisateur est en ligne"""
        manager = ConnectionManager()

        # Pas connecté
        assert manager.is_user_online(1) == False

    @pytest.mark.asyncio
    async def test_is_user_online_connected(self):
        """Utilisateur connecté est en ligne"""
        manager = ConnectionManager()
        mock_ws = AsyncMock()

        await manager.connect(mock_ws, 1, "user1")

        assert manager.is_user_online(1) == True


class TestUtilities:
    """Tests pour les utilitaires"""

    @pytest.mark.asyncio
    async def test_get_user_rooms(self):
        """Obtenir les rooms d'un utilisateur"""
        manager = ConnectionManager()
        mock_ws = AsyncMock()

        await manager.connect(mock_ws, 1, "user1")
        await manager.join_room(1, "room1")
        await manager.join_room(1, "room2")

        rooms = manager.get_user_rooms(1)

        assert "room1" in rooms
        assert "room2" in rooms

    def test_get_user_rooms_nonexistent(self):
        """Rooms d'un utilisateur non connecté"""
        manager = ConnectionManager()

        rooms = manager.get_user_rooms(999)

        assert rooms == set()

    @pytest.mark.asyncio
    async def test_get_online_users_count(self):
        """Compter les utilisateurs en ligne"""
        manager = ConnectionManager()

        assert manager.get_online_users_count() == 0

        ws1 = AsyncMock()
        ws2 = AsyncMock()

        await manager.connect(ws1, 1, "user1")
        assert manager.get_online_users_count() == 1

        await manager.connect(ws2, 2, "user2")
        assert manager.get_online_users_count() == 2

    @pytest.mark.asyncio
    async def test_get_room_count(self):
        """Compter les rooms actives"""
        manager = ConnectionManager()

        assert manager.get_room_count() == 0

        mock_ws = AsyncMock()
        await manager.connect(mock_ws, 1, "user1")
        await manager.join_room(1, "room1")
        await manager.join_room(1, "room2")

        assert manager.get_room_count() == 2

    @pytest.mark.asyncio
    async def test_ping_all(self):
        """Ping tous les utilisateurs"""
        manager = ConnectionManager()

        ws1 = AsyncMock()
        ws2 = AsyncMock()

        await manager.connect(ws1, 1, "user1")
        await manager.connect(ws2, 2, "user2")

        await manager.ping_all()

        ws1.send_json.assert_called()
        ws2.send_json.assert_called()


class TestConcurrency:
    """Tests pour la gestion de la concurrence"""

    @pytest.mark.asyncio
    async def test_concurrent_connections(self):
        """Connexions simultanées"""
        manager = ConnectionManager()

        async def connect_user(user_id):
            ws = AsyncMock()
            await manager.connect(ws, user_id, f"user{user_id}")

        # Connecter 10 utilisateurs simultanément
        await asyncio.gather(*[connect_user(i) for i in range(10)])

        assert manager.get_online_users_count() == 10

    @pytest.mark.asyncio
    async def test_concurrent_room_operations(self):
        """Opérations simultanées sur les rooms"""
        manager = ConnectionManager()

        # Connecter les utilisateurs d'abord
        for i in range(5):
            ws = AsyncMock()
            await manager.connect(ws, i, f"user{i}")

        # Rejoindre la même room simultanément
        await asyncio.gather(*[manager.join_room(i, "shared_room") for i in range(5)])

        assert len(manager.get_room_members("shared_room")) == 5


class TestErrorHandling:
    """Tests pour la gestion des erreurs"""

    @pytest.mark.asyncio
    async def test_send_message_websocket_error(self):
        """Gestion des erreurs d'envoi WebSocket"""
        manager = ConnectionManager()
        mock_ws = AsyncMock()
        mock_ws.send_json.side_effect = Exception("WebSocket error")

        await manager.connect(mock_ws, 1, "user1")

        # Ne doit pas lever d'exception
        result = await manager.send_personal(1, {"type": "test"})

        # Le résultat peut être False ou l'utilisateur peut être déconnecté
        assert result == False or 1 not in manager._connections

    @pytest.mark.asyncio
    async def test_close_old_connection_error(self):
        """Gestion des erreurs lors de la fermeture d'anciennes connexions"""
        manager = ConnectionManager()

        old_ws = AsyncMock()
        old_ws.close.side_effect = Exception("Already closed")
        await manager.connect(old_ws, 1, "user1")

        new_ws = AsyncMock()
        # Ne doit pas lever d'exception
        await manager.connect(new_ws, 1, "user1")

        assert manager._connections[1].websocket == new_ws
