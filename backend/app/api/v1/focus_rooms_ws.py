"""
WebSocket Handler pour Focus Rooms - Communication temps reel
"""

import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, Set, Optional, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError

from app.core.database import get_db, async_session_maker
from app.core.config import settings
from app.core.datetime_utils import utc_now, utc_timestamp
from app.models.user import User
from app.models.focus_room import (
    FocusRoom, FocusRoomParticipant, ParticipantStatus, FocusActivityType
)
from app.services.focus_room_service import focus_room_service, XP_REWARDS
from app.services.cache_service import cache_service
from app.services.xp_service import award_xp

logger = logging.getLogger(__name__)

router = APIRouter()


class FocusRoomConnectionManager:
    """Gestionnaire des connexions WebSocket pour Focus Rooms"""

    def __init__(self):
        # {room_id: {user_id: WebSocket}}
        self.active_connections: Dict[int, Dict[int, WebSocket]] = {}
        # {user_id: room_id} - pour retrouver la room d'un user
        self.user_rooms: Dict[int, int] = {}
        # Lock pour operations thread-safe
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, room_id: int, user_id: int):
        """Connecte un utilisateur a une room"""
        await websocket.accept()

        async with self._lock:
            if room_id not in self.active_connections:
                self.active_connections[room_id] = {}

            # Deconnecter l'ancienne connexion si existe
            if user_id in self.active_connections[room_id]:
                try:
                    await self.active_connections[room_id][user_id].close()
                except:
                    pass

            self.active_connections[room_id][user_id] = websocket
            self.user_rooms[user_id] = room_id

        logger.info(f"User {user_id} connected to room {room_id}")

    async def disconnect(self, room_id: int, user_id: int):
        """Deconnecte un utilisateur"""
        async with self._lock:
            if room_id in self.active_connections:
                if user_id in self.active_connections[room_id]:
                    del self.active_connections[room_id][user_id]

                # Nettoyer la room si vide
                if not self.active_connections[room_id]:
                    del self.active_connections[room_id]

            if user_id in self.user_rooms:
                del self.user_rooms[user_id]

        logger.info(f"User {user_id} disconnected from room {room_id}")

    async def broadcast_to_room(self, room_id: int, message: dict, exclude_user: int = None):
        """Envoie un message a tous les participants d'une room"""
        if room_id not in self.active_connections:
            return

        message_json = json.dumps(message, default=str)
        disconnected = []

        for user_id, websocket in self.active_connections[room_id].items():
            if exclude_user and user_id == exclude_user:
                continue

            try:
                await websocket.send_text(message_json)
            except Exception as e:
                logger.error(f"Error sending to user {user_id}: {e}")
                disconnected.append(user_id)

        # Nettoyer les connexions mortes
        for user_id in disconnected:
            await self.disconnect(room_id, user_id)

    async def send_to_user(self, user_id: int, message: dict):
        """Envoie un message a un utilisateur specifique"""
        room_id = self.user_rooms.get(user_id)
        if not room_id:
            return

        if room_id not in self.active_connections:
            return

        websocket = self.active_connections[room_id].get(user_id)
        if websocket:
            try:
                await websocket.send_text(json.dumps(message, default=str))
            except Exception as e:
                logger.error(f"Error sending to user {user_id}: {e}")
                await self.disconnect(room_id, user_id)

    def get_room_user_count(self, room_id: int) -> int:
        """Retourne le nombre de connexions dans une room"""
        return len(self.active_connections.get(room_id, {}))

    def is_user_connected(self, user_id: int) -> bool:
        """Verifie si un utilisateur est connecte"""
        return user_id in self.user_rooms


# Instance globale
focus_room_manager = FocusRoomConnectionManager()


async def get_user_from_token(token: str) -> Optional[User]:
    """Valide le token JWT et retourne l'utilisateur"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload.get("sub"))

        async with async_session_maker() as db:
            user = await db.get(User, user_id)
            return user

    except (JWTError, ValueError) as e:
        logger.error(f"Token validation error: {e}")
        return None


@router.websocket("/ws/focus-room/{room_id}")
async def focus_room_websocket(
    websocket: WebSocket,
    room_id: int,
    token: str = Query(...)
):
    """
    WebSocket endpoint pour Focus Rooms

    Messages Client -> Server:
    - {"type": "heartbeat"}
    - {"type": "status_update", "status": "focusing|break|away"}
    - {"type": "activity_update", "activity": "...", "subject_id": ...}
    - {"type": "poke", "target_user_id": ..., "message": "..."}

    Messages Server -> Client:
    - {"type": "room_state", ...} - Etat initial
    - {"type": "user_joined", ...}
    - {"type": "user_left", ...}
    - {"type": "status_changed", ...}
    - {"type": "activity_changed", ...}
    - {"type": "milestone_reached", ...}
    - {"type": "room_stats_update", ...}
    - {"type": "poke_received", ...}
    - {"type": "error", "message": "..."}
    """
    # Valider le token
    user = await get_user_from_token(token)
    if not user:
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Verifier que la room existe
    async with async_session_maker() as db:
        room = await focus_room_service.get_room(db, room_id, include_participants=True)
        if not room:
            await websocket.close(code=4004, reason="Room not found")
            return

        # Verifier que l'utilisateur est participant
        participant = await focus_room_service.get_participant(db, user.id)
        if not participant or participant.room_id != room_id:
            await websocket.close(code=4003, reason="Not a participant")
            return

    # Connecter
    await focus_room_manager.connect(websocket, room_id, user.id)

    try:
        # Envoyer l'etat initial
        await send_room_state(websocket, room_id)

        # Notifier les autres
        await focus_room_manager.broadcast_to_room(
            room_id,
            {
                "type": "user_joined",
                "user_id": user.id,
                "username": user.username,
                "avatar_url": user.avatar_url,
                "level": user.level,
                "timestamp": utc_timestamp()
            },
            exclude_user=user.id
        )

        # Boucle de messages
        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=90  # Timeout de 90 secondes
                )
                message = json.loads(data)
                await handle_message(room_id, user.id, message)

            except asyncio.TimeoutError:
                # Ping pour garder la connexion
                try:
                    await websocket.send_text(json.dumps({"type": "ping"}))
                except:
                    break

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: user {user.id} from room {room_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Deconnecter
        await focus_room_manager.disconnect(room_id, user.id)

        # Sauvegarder la session et nettoyer le participant
        session_minutes = 0
        async with async_session_maker() as db:
            participant = await focus_room_service.get_participant(db, user.id)
            if participant:
                session_minutes = participant.get_total_minutes()
                try:
                    # Sauvegarder la session dans l'historique
                    session = await focus_room_service.leave_room(db, participant)
                    logger.info(f"Session saved for user {user.id}: {session.focus_minutes} min")
                except Exception as e:
                    logger.error(f"Error saving session for user {user.id}: {e}")

        # Notifier les autres
        await focus_room_manager.broadcast_to_room(
            room_id,
            {
                "type": "user_left",
                "user_id": user.id,
                "username": user.username,
                "session_minutes": session_minutes,
                "timestamp": utc_timestamp()
            }
        )


async def send_room_state(websocket: WebSocket, room_id: int):
    """Envoie l'etat complet de la room"""
    async with async_session_maker() as db:
        room = await focus_room_service.get_room(db, room_id, include_participants=True)
        if not room:
            return

        # Construire l'etat
        participants = []
        for p in room.participants:
            if p.is_visible and p.user:
                participants.append({
                    "user_id": p.user_id,
                    "username": p.user.username,
                    "avatar_url": p.user.avatar_url,
                    "level": p.user.level,
                    "status": p.status.value,
                    "activity": p.current_activity,
                    "focus_minutes": p.get_today_total_minutes(),  # Minutes du jour
                    "joined_at": p.joined_at.isoformat()
                })

        # Activites recentes
        activities = await focus_room_service.get_room_activities(db, room_id, 20)
        activity_list = [
            {
                "type": a.activity_type.value,
                "user_id": a.user_id,
                "username": a.user.username if a.user else "Unknown",
                "message": a.message,
                "created_at": a.created_at.isoformat()
            }
            for a in activities
        ]

        # Stats
        stats = await focus_room_service.get_room_stats(db, room)

        state = {
            "type": "room_state",
            "room": {
                "id": room.id,
                "name": room.name,
                "emoji": room.emoji,
                "category": room.category.value,
                "max_participants": room.max_participants
            },
            "participants": participants,
            "activities": activity_list,
            "stats": {
                "active_participants": stats.active_participants,
                "today_focus_minutes": stats.today_focus_minutes,
                "top_focuser": stats.top_focuser
            }
        }

        await websocket.send_text(json.dumps(state, default=str))


async def handle_message(room_id: int, user_id: int, message: dict):
    """Traite un message du client"""
    msg_type = message.get("type")

    async with async_session_maker() as db:
        participant = await focus_room_service.get_participant(db, user_id)
        if not participant:
            return

        user = await db.get(User, user_id)

        if msg_type == "heartbeat":
            # Mise a jour heartbeat
            milestone = await focus_room_service.heartbeat(db, participant)

            if milestone:
                # Notifier le milestone
                milestone_type = {
                    "15min": FocusActivityType.MILESTONE_15MIN,
                    "30min": FocusActivityType.MILESTONE_30MIN,
                    "45min": FocusActivityType.MILESTONE_45MIN,
                    "1h": FocusActivityType.MILESTONE_1H,
                    "90min": FocusActivityType.MILESTONE_90MIN,
                    "2h": FocusActivityType.MILESTONE_2H,
                    "3h": FocusActivityType.MILESTONE_3H,
                    "4h": FocusActivityType.MILESTONE_4H,
                }.get(milestone)

                await focus_room_manager.broadcast_to_room(
                    room_id,
                    {
                        "type": "milestone_reached",
                        "user_id": user_id,
                        "username": user.username,
                        "milestone": milestone,
                        "total_minutes": participant.get_total_minutes(),
                        "timestamp": utc_timestamp()
                    }
                )

                # Creer activite
                await focus_room_service._create_activity(
                    db, room_id, user_id, milestone_type,
                    f"{user.username} a atteint {milestone}!",
                    {"minutes": participant.get_total_minutes()}
                )

                # Attribuer XP pour le milestone
                milestone_xp_map = {
                    "15min": XP_REWARDS.get("milestone_15min", 10),
                    "30min": XP_REWARDS.get("milestone_30min", 25),
                    "45min": XP_REWARDS.get("milestone_45min", 40),
                    "1h": XP_REWARDS.get("milestone_1h", 60),
                    "90min": XP_REWARDS.get("milestone_90min", 100),
                    "2h": XP_REWARDS.get("milestone_2h", 150),
                    "3h": XP_REWARDS.get("milestone_3h", 250),
                    "4h": XP_REWARDS.get("milestone_4h", 400),
                }
                xp_amount = milestone_xp_map.get(milestone, 0)
                if xp_amount > 0 and user:
                    await award_xp(
                        user=user,
                        amount=xp_amount,
                        reason=f"focus_milestone_{milestone}",
                        extra_data={"room_id": room_id, "minutes": participant.get_total_minutes()},
                        db=db
                    )
                    # Mettre à jour aussi les stats Focus Room
                    await focus_room_service._update_user_focus_stats(
                        db, user_id, xp_earned=xp_amount
                    )
                    await db.commit()  # Sauvegarder les XP dans la base de données
                    logger.info(f"Awarded {xp_amount} XP to user {user_id} for milestone {milestone}")

            # Toujours diffuser le temps de focus mis à jour après le heartbeat
            await focus_room_manager.broadcast_to_room(
                room_id,
                {
                    "type": "focus_time_update",
                    "user_id": user_id,
                    "focus_minutes": participant.get_today_total_minutes(),  # Minutes du jour
                    "timestamp": utc_now().isoformat()
                }
            )

        elif msg_type == "status_update":
            new_status = ParticipantStatus(message.get("status"))
            await focus_room_service.update_status(db, participant, new_status)

            await focus_room_manager.broadcast_to_room(
                room_id,
                {
                    "type": "status_changed",
                    "user_id": user_id,
                    "new_status": new_status.value,
                    "focus_minutes": participant.get_today_total_minutes(),  # Minutes du jour
                    "timestamp": utc_now().isoformat()
                }
            )

        elif msg_type == "activity_update":
            activity = message.get("activity")
            subject_id = message.get("subject_id")
            await focus_room_service.update_activity(db, participant, activity, subject_id)

            await focus_room_manager.broadcast_to_room(
                room_id,
                {
                    "type": "activity_changed",
                    "user_id": user_id,
                    "activity": activity,
                    "subject_id": subject_id,
                    "timestamp": utc_now().isoformat()
                }
            )

        elif msg_type == "poke":
            target_user_id = message.get("target_user_id")
            poke_message = message.get("message")

            try:
                poke = await focus_room_service.send_poke(
                    db, room_id, user_id, target_user_id, poke_message
                )

                # Envoyer au destinataire
                await focus_room_manager.send_to_user(
                    target_user_id,
                    {
                        "type": "poke_received",
                        "from_user_id": user_id,
                        "from_username": user.username,
                        "message": poke_message,
                        "timestamp": utc_now().isoformat()
                    }
                )

            except ValueError as e:
                await focus_room_manager.send_to_user(
                    user_id,
                    {"type": "error", "message": str(e)}
                )

        elif msg_type == "claim_reward":
            # Récompense aléatoire réclamée par l'utilisateur
            # SÉCURITÉ: Les valeurs XP sont calculées côté serveur uniquement
            # Le client ne peut PAS spécifier de valeurs arbitraires
            reward_type = message.get("reward_type")  # 'xp', 'multiplier', 'streak_saver', 'badge', 'mystery'
            reward_rarity = message.get("rarity", "common")

            # Valider le type de récompense
            valid_reward_types = {"xp", "multiplier", "streak_saver", "badge", "mystery"}
            if reward_type not in valid_reward_types:
                await focus_room_manager.send_to_user(
                    user_id,
                    {"type": "error", "message": "Type de récompense invalide"}
                )
                return

            # Valider la rareté
            valid_rarities = {"common", "rare", "epic", "legendary"}
            if reward_rarity not in valid_rarities:
                reward_rarity = "common"  # Fallback sécurisé

            # Vérifier le temps de focus minimum pour réclamer (anti-abus)
            min_focus_minutes = 5  # Minimum 5 minutes de focus pour réclamer
            if participant.get_today_total_minutes() < min_focus_minutes:
                await focus_room_manager.send_to_user(
                    user_id,
                    {"type": "error", "message": f"Focus minimum de {min_focus_minutes} minutes requis"}
                )
                return

            # SÉCURITÉ: XP calculé côté SERVEUR uniquement avec valeurs fixes
            # Les valeurs du client sont IGNORÉES pour éviter la manipulation
            REWARD_XP_TABLE = {
                "xp": {"common": 5, "rare": 15, "epic": 30, "legendary": 50},
                "multiplier": {"common": 10, "rare": 15, "epic": 25, "legendary": 40},
                "mystery": {"common": 10, "rare": 25, "epic": 50, "legendary": 100},
                "badge": {"common": 5, "rare": 10, "epic": 20, "legendary": 50},
                "streak_saver": {"common": 5, "rare": 10, "epic": 20, "legendary": 50},
            }

            xp_amount = REWARD_XP_TABLE.get(reward_type, {}).get(reward_rarity, 5)
            reward_name = f"{reward_rarity.capitalize()} {reward_type.replace('_', ' ').title()}"

            if xp_amount > 0 and user:
                await award_xp(
                    user=user,
                    amount=xp_amount,
                    reason=f"focus_room_reward_{reward_type}",
                    extra_data={
                        "room_id": room_id,
                        "reward_name": reward_name,
                        "reward_rarity": reward_rarity
                    },
                    db=db
                )
                # Mettre à jour aussi les stats Focus Room (bonus XP)
                await focus_room_service._update_user_focus_stats(
                    db, user_id, xp_bonus=xp_amount
                )
                await db.commit()  # Sauvegarder les XP dans la base de données
                logger.info(f"Awarded {xp_amount} XP to user {user_id} for reward {reward_name} ({reward_rarity})")

                # Confirmer au client
                await focus_room_manager.send_to_user(
                    user_id,
                    {
                        "type": "reward_claimed",
                        "xp_earned": xp_amount,
                        "reward_name": reward_name,
                        "reward_type": reward_type,
                        "timestamp": utc_now().isoformat()
                    }
                )


async def broadcast_stats_update(room_id: int):
    """Broadcast les stats mises a jour"""
    async with async_session_maker() as db:
        room = await focus_room_service.get_room(db, room_id, include_participants=True)
        if room:
            stats = await focus_room_service.get_room_stats(db, room)

            await focus_room_manager.broadcast_to_room(
                room_id,
                {
                    "type": "room_stats_update",
                    "active_participants": stats.active_participants,
                    "today_focus_minutes": stats.today_focus_minutes,
                    "top_focuser": stats.top_focuser
                }
            )


# Task de verification des participants idle
async def check_idle_participants_task():
    """Tache periodique pour verifier les participants inactifs"""
    while True:
        try:
            async with async_session_maker() as db:
                for room_id in list(focus_room_manager.active_connections.keys()):
                    idle_users = await focus_room_service.check_idle_participants(db, room_id)

                    for user_id in idle_users:
                        await focus_room_manager.broadcast_to_room(
                            room_id,
                            {
                                "type": "status_changed",
                                "user_id": user_id,
                                "new_status": ParticipantStatus.IDLE.value,
                                "timestamp": utc_now().isoformat()
                            }
                        )

        except Exception as e:
            logger.error(f"Error in idle check task: {e}")

        await asyncio.sleep(60)  # Verifier toutes les minutes


# Task de nettoyage des participants abandonnés
async def cleanup_stale_participants_task():
    """Tache periodique pour nettoyer les participants abandonnés et sauvegarder leurs sessions"""
    while True:
        try:
            async with async_session_maker() as db:
                cleaned = await focus_room_service.cleanup_stale_participants(db)
                if cleaned > 0:
                    logger.info(f"Cleaned {cleaned} stale participants")

        except Exception as e:
            logger.error(f"Error in cleanup stale participants task: {e}")

        await asyncio.sleep(300)  # Verifier toutes les 5 minutes
