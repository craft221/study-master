"""
Endpoint WebSocket pour les connexions temps réel
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError
from typing import Optional
from datetime import datetime
import json
import logging

from app.core.config import settings
from app.core.datetime_utils import utc_now
from app.core.database import get_db
from app.websockets import manager
from app.websockets.handlers import (
    handle_group_message,
    handle_study_session,
    handle_notification,
    handle_presence,
    handle_collaboration,
    handle_quiz_live,
)
from app.models.user import User
from sqlalchemy import select

router = APIRouter()
logger = logging.getLogger(__name__)


async def get_user_from_token(token: str, db: AsyncSession) -> Optional[User]:
    """
    Valider le token JWT et récupérer l'utilisateur
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id: int = payload.get("sub")
        if user_id is None:
            return None

        result = await db.execute(select(User).where(User.id == int(user_id)))
        return result.scalar_one_or_none()
    except JWTError:
        return None


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Point d'entrée WebSocket principal
    """
    # Authentifier l'utilisateur
    user = await get_user_from_token(token, db)

    if not user:
        await websocket.close(code=4001, reason="Non autorisé")
        return

    # Connecter l'utilisateur
    connection = await manager.connect(
        websocket=websocket,
        user_id=user.id,
        username=user.username,
        metadata={"avatar_url": user.avatar_url}
    )

    # Envoyer la confirmation de connexion
    await websocket.send_json({
        "type": "connected",
        "user_id": user.id,
        "username": user.username
    })

    try:
        while True:
            # Recevoir les messages
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Format JSON invalide"
                })
                continue

            # Router le message vers le bon handler
            message_type = message.get("type")
            response = await route_message(
                manager=manager,
                user_id=user.id,
                message_type=message_type,
                data=message.get("data", {}),
                db=db
            )

            # Envoyer la réponse
            if response:
                await websocket.send_json({
                    "type": f"{message_type}_response",
                    **response
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket déconnecté pour l'utilisateur {user.id}")
    except Exception as e:
        logger.error(f"Erreur WebSocket: {e}")
    finally:
        await manager.disconnect(user.id)


async def route_message(
    manager,
    user_id: int,
    message_type: str,
    data: dict,
    db: AsyncSession
) -> dict:
    """
    Router les messages vers le bon handler
    """
    try:
        # Messages de groupe
        if message_type == "group_message":
            return await handle_group_message(
                manager=manager,
                user_id=user_id,
                group_id=data.get("group_id"),
                message_data=data,
                db=db
            )

        # Rejoindre/quitter une room
        elif message_type == "join_room":
            room_id = data.get("room_id")
            if room_id:
                success = await manager.join_room(user_id, room_id)
                return {"success": success, "room_id": room_id}
            return {"error": "room_id requis"}

        elif message_type == "leave_room":
            room_id = data.get("room_id")
            if room_id:
                success = await manager.leave_room(user_id, room_id)
                return {"success": success, "room_id": room_id}
            return {"error": "room_id requis"}

        # Sessions d'étude
        elif message_type == "study_session":
            return await handle_study_session(
                manager=manager,
                user_id=user_id,
                session_data=data
            )

        # Présence
        elif message_type == "presence":
            return await handle_presence(
                manager=manager,
                user_id=user_id,
                presence_data=data
            )

        # Collaboration
        elif message_type == "collaboration":
            return await handle_collaboration(
                manager=manager,
                user_id=user_id,
                collab_data=data
            )

        # Quiz en direct
        elif message_type == "quiz_live":
            return await handle_quiz_live(
                manager=manager,
                user_id=user_id,
                quiz_data=data
            )

        # Notifications
        elif message_type == "notification":
            return await handle_notification(
                manager=manager,
                user_id=user_id,
                notification_data=data
            )

        # Ping/Pong pour maintenir la connexion
        elif message_type == "ping":
            return {"type": "pong"}

        else:
            return {"error": f"Type de message inconnu: {message_type}"}

    except Exception as e:
        logger.error(f"Erreur dans le handler {message_type}: {e}")
        return {"error": str(e)}


@router.get("/ws/status")
async def websocket_status():
    """
    Obtenir le statut des connexions WebSocket
    """
    return {
        "online_users": manager.get_online_users_count(),
        "active_rooms": manager.get_room_count()
    }


# ========== WEBSOCKET PUBLIC POUR CLASSEMENTS ==========

# Store des connexions publiques par share_code
public_leaderboard_connections: dict = {}


@router.websocket("/ws/leaderboard/{share_code}")
async def public_leaderboard_websocket(
    websocket: WebSocket,
    share_code: str
):
    """
    WebSocket public pour suivre le classement d'un quiz en temps réel
    Pas d'authentification requise - pour les invités
    """
    await websocket.accept()

    # Ajouter à la liste des connexions pour ce quiz
    if share_code not in public_leaderboard_connections:
        public_leaderboard_connections[share_code] = []
    public_leaderboard_connections[share_code].append(websocket)

    logger.info(f"Nouvelle connexion leaderboard pour {share_code}")

    try:
        # Envoyer confirmation
        await websocket.send_json({
            "type": "connected",
            "share_code": share_code,
            "message": "Connecté au classement en temps réel"
        })

        # Garder la connexion ouverte
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

                # Ping/Pong pour maintenir la connexion
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})

            except json.JSONDecodeError:
                continue

    except WebSocketDisconnect:
        logger.info(f"Déconnexion leaderboard pour {share_code}")
    except Exception as e:
        logger.error(f"Erreur WebSocket leaderboard: {e}")
    finally:
        # Retirer de la liste
        if share_code in public_leaderboard_connections:
            if websocket in public_leaderboard_connections[share_code]:
                public_leaderboard_connections[share_code].remove(websocket)
            if not public_leaderboard_connections[share_code]:
                del public_leaderboard_connections[share_code]


async def broadcast_leaderboard_update(share_code: str, new_entry: dict):
    """
    Diffuser une mise à jour du classement à tous les clients connectés
    """
    if share_code not in public_leaderboard_connections:
        return

    message = {
        "type": "leaderboard_update",
        "share_code": share_code,
        "new_entry": new_entry
    }

    disconnected = []
    for websocket in public_leaderboard_connections[share_code]:
        try:
            await websocket.send_json(message)
        except Exception:
            disconnected.append(websocket)

    # Nettoyer les connexions mortes
    for ws in disconnected:
        public_leaderboard_connections[share_code].remove(ws)


# ========== WEBSOCKET POUR CLASSEMENT PRINCIPAL (GLOBAL) ==========

# Store des connexions au classement principal par type
main_leaderboard_connections: dict = {}  # key: "xp_weekly_global" -> [websockets]


@router.websocket("/ws/main-leaderboard")
async def main_leaderboard_websocket(
    websocket: WebSocket,
    token: str = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    WebSocket pour le classement principal en temps réel
    Authentification optionnelle (pour afficher "vous" dans le classement)
    """
    await websocket.accept()

    # Authentifier si token fourni
    user = None
    if token:
        user = await get_user_from_token(token, db)

    # Clé par défaut
    subscription_key = "xp_weekly_global"

    # Ajouter à la liste des connexions
    if subscription_key not in main_leaderboard_connections:
        main_leaderboard_connections[subscription_key] = []
    main_leaderboard_connections[subscription_key].append({
        "websocket": websocket,
        "user_id": user.id if user else None
    })

    logger.info(f"Nouvelle connexion classement principal: {subscription_key}")

    try:
        # Envoyer confirmation
        await websocket.send_json({
            "type": "connected",
            "subscription": subscription_key,
            "user_id": user.id if user else None,
            "message": "Connecté au classement en temps réel"
        })

        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

                msg_type = message.get("type")

                # Changer de type de classement
                if msg_type == "subscribe":
                    new_key = f"{message.get('leaderboard_type', 'xp')}_{message.get('period', 'weekly')}_{message.get('scope', 'global')}"

                    # Retirer de l'ancien
                    if subscription_key in main_leaderboard_connections:
                        main_leaderboard_connections[subscription_key] = [
                            c for c in main_leaderboard_connections[subscription_key]
                            if c["websocket"] != websocket
                        ]

                    # Ajouter au nouveau
                    subscription_key = new_key
                    if subscription_key not in main_leaderboard_connections:
                        main_leaderboard_connections[subscription_key] = []
                    main_leaderboard_connections[subscription_key].append({
                        "websocket": websocket,
                        "user_id": user.id if user else None
                    })

                    await websocket.send_json({
                        "type": "subscribed",
                        "subscription": subscription_key
                    })

                # Ping/Pong
                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

            except json.JSONDecodeError:
                continue

    except WebSocketDisconnect:
        logger.info(f"Déconnexion classement principal")
    except Exception as e:
        logger.error(f"Erreur WebSocket classement principal: {e}")
    finally:
        # Nettoyer
        for key in list(main_leaderboard_connections.keys()):
            main_leaderboard_connections[key] = [
                c for c in main_leaderboard_connections[key]
                if c["websocket"] != websocket
            ]
            if not main_leaderboard_connections[key]:
                del main_leaderboard_connections[key]


async def broadcast_main_leaderboard_update(
    user_id: int,
    username: str,
    event_type: str,  # "xp_gained", "quiz_completed", "streak_updated", etc.
    data: dict
):
    """
    Diffuser une mise à jour du classement principal à tous les clients
    """
    # Déterminer quels types de classement sont affectés
    affected_types = []

    if event_type == "xp_gained":
        affected_types = ["xp"]
    elif event_type == "quiz_completed":
        affected_types = ["xp", "quizzes"]
    elif event_type == "streak_updated":
        affected_types = ["streak"]
    elif event_type == "note_created":
        affected_types = ["notes"]
    elif event_type == "flashcard_reviewed":
        affected_types = ["flashcards"]
    elif event_type == "study_session":
        affected_types = ["study_time", "xp"]

    message = {
        "type": "ranking_update",
        "event": event_type,
        "user": {
            "user_id": user_id,
            "username": username
        },
        "data": data,
        "timestamp": utc_now().isoformat()
    }

    # Broadcaster à tous les clients concernés
    for key, connections in list(main_leaderboard_connections.items()):
        # Vérifier si ce type de classement est affecté
        key_type = key.split("_")[0]  # ex: "xp" de "xp_weekly_global"
        if key_type in affected_types:
            disconnected = []
            for conn in connections:
                try:
                    await conn["websocket"].send_json(message)
                except Exception:
                    disconnected.append(conn)

            # Nettoyer les connexions mortes
            for conn in disconnected:
                main_leaderboard_connections[key].remove(conn)
