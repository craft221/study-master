"""
Handlers WebSocket pour différents types de messages
"""

from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.models.study_group import StudyGroup, StudyGroupMembership
from app.models.group_message import GroupMessage
from app.models.user import User
from app.core.datetime_utils import utc_now, utc_timestamp
import html

logger = logging.getLogger(__name__)


async def handle_group_message(
    manager,
    user_id: int,
    group_id: int,
    message_data: Dict[str, Any],
    db: AsyncSession
) -> Dict[str, Any]:
    """
    Gérer l'envoi d'un message dans un groupe
    """
    room_id = f"group_{group_id}"

    # Vérifier que l'utilisateur est membre du groupe
    result = await db.execute(
        select(StudyGroupMembership)
        .where(StudyGroupMembership.group_id == group_id)
        .where(StudyGroupMembership.user_id == user_id)
    )
    member = result.scalar_one_or_none()

    if not member:
        return {"error": "Vous n'êtes pas membre de ce groupe"}

    # Récupérer l'utilisateur
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    if not user:
        return {"error": "Utilisateur non trouvé"}

    # Sanitiser le contenu pour prévenir le XSS
    raw_content = message_data.get("content", "")
    sanitized_content = html.escape(raw_content) if raw_content else ""

    # Créer le message en base
    new_message = GroupMessage(
        group_id=group_id,
        user_id=user_id,
        content=sanitized_content,
        message_type=message_data.get("type", "text")
    )
    db.add(new_message)
    await db.commit()
    await db.refresh(new_message)

    # Préparer le message pour la diffusion
    broadcast_message = {
        "type": "group_message",
        "message": {
            "id": new_message.id,
            "group_id": group_id,
            "user_id": user_id,
            "username": user.username,
            "avatar_url": user.avatar_url,
            "content": new_message.content,
            "message_type": new_message.message_type,
            "created_at": new_message.created_at.isoformat()
        }
    }

    # Diffuser à tous les membres du groupe
    await manager.broadcast_to_room(room_id, broadcast_message)

    return {"success": True, "message_id": new_message.id}


async def handle_study_session(
    manager,
    user_id: int,
    session_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Gérer les événements de session d'étude en temps réel
    """
    action = session_data.get("action")
    room_id = session_data.get("room_id")

    if not room_id:
        return {"error": "room_id requis"}

    if action == "start":
        # Démarrer une session d'étude
        await manager.join_room(user_id, room_id)
        await manager.update_presence(user_id, room_id, "studying", {
            "subject": session_data.get("subject"),
            "started_at": utc_timestamp()
        })

        return {"success": True, "message": "Session démarrée"}

    elif action == "pause":
        await manager.update_presence(user_id, room_id, "paused")
        return {"success": True, "message": "Session en pause"}

    elif action == "resume":
        await manager.update_presence(user_id, room_id, "studying")
        return {"success": True, "message": "Session reprise"}

    elif action == "end":
        # Terminer la session
        await manager.leave_room(user_id, room_id)
        return {"success": True, "message": "Session terminée"}

    elif action == "update_progress":
        # Vérifier que l'utilisateur est bien dans la room
        if not manager.is_user_in_room(user_id, room_id):
            return {"error": "Vous n'êtes pas dans cette room"}

        # Mettre à jour la progression
        await manager.update_presence(user_id, room_id, "studying", {
            "progress": session_data.get("progress"),
            "duration": session_data.get("duration")
        })

        # Notifier les autres
        await manager.broadcast_to_room(
            room_id,
            {
                "type": "session_progress",
                "user_id": user_id,
                "progress": session_data.get("progress"),
                "duration": session_data.get("duration")
            },
            exclude_user=user_id
        )

        return {"success": True}

    return {"error": f"Action inconnue: {action}"}


async def handle_notification(
    manager,
    user_id: int,
    notification_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Gérer l'envoi de notifications en temps réel.
    Seul l'envoi à soi-même est autorisé (le serveur gère les notifications vers d'autres users).
    """
    target_user_id = notification_data.get("target_user_id")
    notification_type = notification_data.get("type")

    if not target_user_id:
        return {"error": "target_user_id requis"}

    # Sécurité: un utilisateur ne peut envoyer des notifications qu'à lui-même
    # Les notifications vers d'autres utilisateurs passent par les services backend
    if int(target_user_id) != user_id:
        logger.warning(f"User {user_id} tried to send notification to user {target_user_id}")
        return {"error": "Non autorisé: vous ne pouvez pas envoyer de notifications à d'autres utilisateurs"}

    notification = {
        "type": "notification",
        "notification": {
            "id": notification_data.get("id"),
            "type": notification_type,
            "title": notification_data.get("title"),
            "message": notification_data.get("message"),
            "data": notification_data.get("data", {}),
            "from_user_id": user_id,
            "created_at": utc_timestamp()
        }
    }

    # Envoyer la notification à l'utilisateur cible
    success = await manager.send_personal(target_user_id, notification)

    return {"success": success}


async def handle_presence(
    manager,
    user_id: int,
    presence_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Gérer les mises à jour de présence
    """
    action = presence_data.get("action")
    room_id = presence_data.get("room_id")

    if action == "get_presence":
        # Récupérer la présence dans une room
        if not room_id:
            return {"error": "room_id requis"}

        presence = manager.get_room_presence(room_id)
        return {
            "success": True,
            "presence": presence,
            "member_count": len(presence)
        }

    elif action == "update_status":
        # Mettre à jour son statut
        if not room_id:
            return {"error": "room_id requis"}

        status = presence_data.get("status", "online")
        metadata = presence_data.get("metadata")

        success = await manager.update_presence(user_id, room_id, status, metadata)
        return {"success": success}

    elif action == "typing":
        # Indiquer que l'utilisateur est en train de taper
        if not room_id:
            return {"error": "room_id requis"}

        await manager.broadcast_to_room(
            room_id,
            {
                "type": "typing",
                "user_id": user_id,
                "is_typing": presence_data.get("is_typing", True)
            },
            exclude_user=user_id
        )

        return {"success": True}

    return {"error": f"Action inconnue: {action}"}


async def handle_collaboration(
    manager,
    user_id: int,
    collab_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Gérer les événements de collaboration (édition de notes, etc.)
    """
    action = collab_data.get("action")
    room_id = collab_data.get("room_id")
    resource_type = collab_data.get("resource_type")  # note, flashcard, etc.
    resource_id = collab_data.get("resource_id")

    if not room_id:
        return {"error": "room_id requis"}

    if action == "lock":
        # Verrouiller une ressource pour édition
        await manager.broadcast_to_room(
            room_id,
            {
                "type": "resource_locked",
                "resource_type": resource_type,
                "resource_id": resource_id,
                "locked_by": user_id,
                "timestamp": utc_timestamp()
            },
            exclude_user=user_id
        )
        return {"success": True}

    elif action == "unlock":
        # Déverrouiller une ressource
        await manager.broadcast_to_room(
            room_id,
            {
                "type": "resource_unlocked",
                "resource_type": resource_type,
                "resource_id": resource_id,
                "unlocked_by": user_id,
                "timestamp": utc_timestamp()
            },
            exclude_user=user_id
        )
        return {"success": True}

    elif action == "update":
        # Diffuser une mise à jour en temps réel
        await manager.broadcast_to_room(
            room_id,
            {
                "type": "resource_updated",
                "resource_type": resource_type,
                "resource_id": resource_id,
                "updated_by": user_id,
                "changes": collab_data.get("changes", {}),
                "timestamp": utc_timestamp()
            },
            exclude_user=user_id
        )
        return {"success": True}

    elif action == "cursor":
        # Partager la position du curseur
        await manager.broadcast_to_room(
            room_id,
            {
                "type": "cursor_update",
                "user_id": user_id,
                "position": collab_data.get("position"),
                "selection": collab_data.get("selection")
            },
            exclude_user=user_id
        )
        return {"success": True}

    return {"error": f"Action inconnue: {action}"}


async def handle_quiz_live(
    manager,
    user_id: int,
    quiz_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Gérer les quiz en temps réel
    """
    action = quiz_data.get("action")
    room_id = quiz_data.get("room_id")

    if not room_id:
        return {"error": "room_id requis"}

    if action == "start_quiz":
        # L'hôte démarre le quiz
        await manager.broadcast_to_room(
            room_id,
            {
                "type": "quiz_started",
                "quiz_id": quiz_data.get("quiz_id"),
                "host_id": user_id,
                "timestamp": utc_timestamp()
            }
        )
        return {"success": True}

    elif action == "next_question":
        # Passer à la question suivante
        await manager.broadcast_to_room(
            room_id,
            {
                "type": "next_question",
                "question_index": quiz_data.get("question_index"),
                "question": quiz_data.get("question"),
                "time_limit": quiz_data.get("time_limit", 30),
                "timestamp": utc_timestamp()
            }
        )
        return {"success": True}

    elif action == "submit_answer":
        # Un participant soumet sa réponse
        await manager.broadcast_to_room(
            room_id,
            {
                "type": "answer_submitted",
                "user_id": user_id,
                "question_index": quiz_data.get("question_index"),
                "timestamp": utc_timestamp()
            },
            exclude_user=user_id
        )
        return {"success": True}

    elif action == "show_results":
        # Afficher les résultats d'une question
        await manager.broadcast_to_room(
            room_id,
            {
                "type": "question_results",
                "question_index": quiz_data.get("question_index"),
                "correct_answer": quiz_data.get("correct_answer"),
                "stats": quiz_data.get("stats"),
                "leaderboard": quiz_data.get("leaderboard")
            }
        )
        return {"success": True}

    elif action == "end_quiz":
        # Terminer le quiz
        await manager.broadcast_to_room(
            room_id,
            {
                "type": "quiz_ended",
                "final_leaderboard": quiz_data.get("final_leaderboard"),
                "timestamp": utc_timestamp()
            }
        )
        return {"success": True}

    return {"error": f"Action inconnue: {action}"}
