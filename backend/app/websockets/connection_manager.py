"""
Gestionnaire de connexions WebSocket
"""

from typing import Dict, List, Set, Optional, Any
from fastapi import WebSocket
from dataclasses import dataclass, field
from datetime import datetime, timezone
import asyncio
import json
import logging

from app.core.datetime_utils import utc_now, utc_timestamp

logger = logging.getLogger(__name__)


@dataclass
class UserConnection:
    """Représente une connexion utilisateur"""
    websocket: WebSocket
    user_id: int
    username: str
    connected_at: datetime = field(default_factory=utc_now)
    rooms: Set[str] = field(default_factory=set)
    metadata: Dict[str, Any] = field(default_factory=dict)


class ConnectionManager:
    """
    Gestionnaire centralisé des connexions WebSocket
    Gère les rooms, les utilisateurs et les messages
    """

    def __init__(self):
        # Connexions par user_id
        self._connections: Dict[int, UserConnection] = {}

        # Rooms (groupes, sessions d'étude, etc.)
        self._rooms: Dict[str, Set[int]] = {}

        # Présence des utilisateurs par room
        self._presence: Dict[str, Dict[int, Dict[str, Any]]] = {}

        # Lock pour les opérations concurrentes
        self._lock = asyncio.Lock()

    async def connect(
        self,
        websocket: WebSocket,
        user_id: int,
        username: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> UserConnection:
        """
        Connecter un utilisateur
        """
        await websocket.accept()

        async with self._lock:
            # Déconnecter l'ancienne connexion si elle existe
            if user_id in self._connections:
                old_connection = self._connections[user_id]
                try:
                    await old_connection.websocket.close()
                except Exception:
                    pass

            # Créer la nouvelle connexion
            connection = UserConnection(
                websocket=websocket,
                user_id=user_id,
                username=username,
                metadata=metadata or {}
            )
            self._connections[user_id] = connection

            logger.info(f"Utilisateur {username} (ID: {user_id}) connecté")

            return connection

    async def disconnect(self, user_id: int) -> None:
        """
        Déconnecter un utilisateur
        """
        async with self._lock:
            if user_id not in self._connections:
                return

            connection = self._connections[user_id]

            # Quitter toutes les rooms
            for room_id in list(connection.rooms):
                await self._leave_room_internal(user_id, room_id)

            # Supprimer la connexion
            del self._connections[user_id]

            logger.info(f"Utilisateur ID: {user_id} déconnecté")

    async def join_room(self, user_id: int, room_id: str) -> bool:
        """
        Rejoindre une room
        """
        async with self._lock:
            if user_id not in self._connections:
                return False

            connection = self._connections[user_id]

            # Créer la room si elle n'existe pas
            if room_id not in self._rooms:
                self._rooms[room_id] = set()
                self._presence[room_id] = {}

            # Ajouter l'utilisateur
            self._rooms[room_id].add(user_id)
            connection.rooms.add(room_id)

            # Mettre à jour la présence
            self._presence[room_id][user_id] = {
                "username": connection.username,
                "joined_at": utc_timestamp(),
                "status": "online"
            }

            logger.info(f"Utilisateur {user_id} a rejoint la room {room_id}")

            # Notifier les autres membres (utiliser la version interne pour éviter deadlock)
            await self._broadcast_to_room_internal(
                room_id,
                {
                    "type": "user_joined",
                    "user_id": user_id,
                    "username": connection.username,
                    "timestamp": utc_timestamp()
                },
                exclude_user=user_id
            )

            return True

    async def leave_room(self, user_id: int, room_id: str) -> bool:
        """
        Quitter une room
        """
        async with self._lock:
            return await self._leave_room_internal(user_id, room_id)

    async def _leave_room_internal(self, user_id: int, room_id: str) -> bool:
        """
        Quitter une room (version interne sans lock)
        """
        if room_id not in self._rooms:
            return False

        if user_id not in self._rooms[room_id]:
            return False

        connection = self._connections.get(user_id)
        username = connection.username if connection else "Unknown"

        # Retirer l'utilisateur
        self._rooms[room_id].discard(user_id)
        if connection:
            connection.rooms.discard(room_id)

        # Mettre à jour la présence
        if room_id in self._presence and user_id in self._presence[room_id]:
            del self._presence[room_id][user_id]

        # Supprimer la room si vide
        if not self._rooms[room_id]:
            del self._rooms[room_id]
            if room_id in self._presence:
                del self._presence[room_id]
        else:
            # Notifier les autres membres
            await self._broadcast_to_room_internal(
                room_id,
                {
                    "type": "user_left",
                    "user_id": user_id,
                    "username": username,
                    "timestamp": utc_timestamp()
                }
            )

        logger.info(f"Utilisateur {user_id} a quitté la room {room_id}")
        return True

    async def send_personal(self, user_id: int, message: Dict[str, Any]) -> bool:
        """
        Envoyer un message à un utilisateur spécifique
        """
        if user_id not in self._connections:
            return False

        try:
            connection = self._connections[user_id]
            await connection.websocket.send_json(message)
            return True
        except Exception as e:
            logger.error(f"Erreur d'envoi à {user_id}: {e}")
            await self.disconnect(user_id)
            return False

    async def broadcast_to_room(
        self,
        room_id: str,
        message: Dict[str, Any],
        exclude_user: Optional[int] = None
    ) -> int:
        """
        Diffuser un message à tous les membres d'une room
        """
        async with self._lock:
            return await self._broadcast_to_room_internal(room_id, message, exclude_user)

    async def _broadcast_to_room_internal(
        self,
        room_id: str,
        message: Dict[str, Any],
        exclude_user: Optional[int] = None
    ) -> int:
        """
        Diffuser un message (version interne sans lock)
        """
        if room_id not in self._rooms:
            return 0

        sent = 0
        failed = []

        for user_id in self._rooms[room_id]:
            if user_id == exclude_user:
                continue

            if user_id not in self._connections:
                failed.append(user_id)
                continue

            try:
                connection = self._connections[user_id]
                await connection.websocket.send_json(message)
                sent += 1
            except Exception as e:
                logger.error(f"Erreur de broadcast à {user_id}: {e}")
                failed.append(user_id)

        # Nettoyer les connexions échouées
        for user_id in failed:
            self._rooms[room_id].discard(user_id)
            if user_id in self._presence.get(room_id, {}):
                del self._presence[room_id][user_id]

        return sent

    async def broadcast_to_all(
        self,
        message: Dict[str, Any],
        exclude_user: Optional[int] = None
    ) -> int:
        """
        Diffuser un message à tous les utilisateurs connectés
        """
        sent = 0
        failed = []

        async with self._lock:
            for user_id, connection in self._connections.items():
                if user_id == exclude_user:
                    continue

                try:
                    await connection.websocket.send_json(message)
                    sent += 1
                except Exception as e:
                    logger.error(f"Erreur de broadcast à {user_id}: {e}")
                    failed.append(user_id)

        # Nettoyer les connexions échouées
        for user_id in failed:
            await self.disconnect(user_id)

        return sent

    def get_room_members(self, room_id: str) -> List[int]:
        """
        Obtenir la liste des membres d'une room
        """
        return list(self._rooms.get(room_id, set()))

    def get_room_presence(self, room_id: str) -> Dict[int, Dict[str, Any]]:
        """
        Obtenir la présence dans une room
        """
        return self._presence.get(room_id, {}).copy()

    def is_user_online(self, user_id: int) -> bool:
        """
        Vérifier si un utilisateur est en ligne
        """
        return user_id in self._connections

    def get_user_rooms(self, user_id: int) -> Set[str]:
        """
        Obtenir les rooms d'un utilisateur
        """
        if user_id not in self._connections:
            return set()
        return self._connections[user_id].rooms.copy()

    def get_online_users_count(self) -> int:
        """
        Obtenir le nombre d'utilisateurs en ligne
        """
        return len(self._connections)

    def get_room_count(self) -> int:
        """
        Obtenir le nombre de rooms actives
        """
        return len(self._rooms)

    async def update_presence(
        self,
        user_id: int,
        room_id: str,
        status: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Mettre à jour le statut de présence d'un utilisateur
        """
        async with self._lock:
            if room_id not in self._presence:
                return False

            if user_id not in self._presence[room_id]:
                return False

            self._presence[room_id][user_id]["status"] = status
            self._presence[room_id][user_id]["updated_at"] = utc_timestamp()

            if metadata:
                self._presence[room_id][user_id].update(metadata)

            # Notifier les autres membres
            await self._broadcast_to_room_internal(
                room_id,
                {
                    "type": "presence_update",
                    "user_id": user_id,
                    "status": status,
                    "metadata": metadata,
                    "timestamp": utc_timestamp()
                },
                exclude_user=user_id
            )

            return True

    async def ping_all(self) -> None:
        """
        Envoyer un ping à toutes les connexions pour les garder actives
        """
        async with self._lock:
            failed = []

            for user_id, connection in self._connections.items():
                try:
                    await connection.websocket.send_json({"type": "ping"})
                except Exception:
                    failed.append(user_id)

            for user_id in failed:
                if user_id in self._connections:
                    del self._connections[user_id]
