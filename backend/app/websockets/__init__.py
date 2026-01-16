"""
WebSocket Module pour Studera
Gère les connexions temps réel pour la collaboration
"""

from .connection_manager import ConnectionManager
from .handlers import (
    handle_group_message,
    handle_study_session,
    handle_notification,
    handle_presence,
    handle_collaboration,
    handle_quiz_live,
)

# Instance globale du gestionnaire de connexions
manager = ConnectionManager()

__all__ = [
    "ConnectionManager",
    "manager",
    "handle_group_message",
    "handle_study_session",
    "handle_notification",
    "handle_presence",
    "handle_collaboration",
    "handle_quiz_live",
]
