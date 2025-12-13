"""
Configuration Celery pour les tâches asynchrones
"""
from celery import Celery
from app.core.config import settings

# Créer l'application Celery
celery_app = Celery(
    "study_master",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.ai_tasks",
        "app.tasks.ocr_tasks",
        "app.tasks.export_tasks",
        "app.tasks.notification_tasks",
        "app.tasks.gamification_tasks",
    ]
)

# Configuration Celery
celery_app.conf.update(
    # Timezone
    timezone="UTC",
    enable_utc=True,
    
    # Serialisation
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    
    # Résultats
    result_expires=3600,  # 1 heure
    result_backend_transport_options={
        "master_name": "mymaster",
        "visibility_timeout": 3600,
    },
    
    # Workers
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,
    
    # Retry policy
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    
    # Rate limiting
    task_default_rate_limit="100/m",
    
    # Tâches planifiées (Celery Beat) - Système intelligent de notifications
    beat_schedule={
        # === Gamification ===
        "reset-daily-ai-requests": {
            "task": "app.tasks.gamification_tasks.reset_daily_ai_requests",
            "schedule": 86400.0,  # Chaque jour (24h)
        },
        "calculate-leaderboards": {
            "task": "app.tasks.gamification_tasks.calculate_leaderboards",
            "schedule": 3600.0,  # Chaque heure
        },
        "cleanup-expired-sessions": {
            "task": "app.tasks.gamification_tasks.cleanup_expired_sessions",
            "schedule": 7200.0,  # Toutes les 2 heures
        },

        # === Rappels Calendrier Intelligents ===
        # Vérifie les événements et envoie des rappels selon le type:
        # - Examen: 7j, 3j, 1j, 2h, 30min avant
        # - Cours: 1j, 1h, 15min avant
        # - Deadline: 3j, 1j, 3h avant
        # Respecte le timezone et les heures de silence
        "smart-calendar-reminders": {
            "task": "app.tasks.notification_tasks.send_calendar_reminders",
            "schedule": 300.0,  # Toutes les 5 minutes
        },

        # === Rappels de Streak (Style Duolingo) ===
        # Envoie des rappels à 14h et 19h HEURE LOCALE de l'utilisateur
        # Vérifie chaque heure pour couvrir tous les fuseaux horaires
        "smart-streak-reminders": {
            "task": "app.tasks.notification_tasks.send_streak_reminders",
            "schedule": 3600.0,  # Toutes les heures
        },

        # === Rappels Flashcards (Spaced Repetition) ===
        # Rappel quotidien pour les cartes à réviser
        "daily-flashcard-reminders": {
            "task": "app.tasks.notification_tasks.send_flashcard_reminders",
            "schedule": 21600.0,  # Toutes les 6 heures (couvre les timezones)
        },

        # === Vérification Streak Perdu ===
        # Réinitialise les streaks à minuit et notifie
        "check-lost-streaks": {
            "task": "app.tasks.notification_tasks.check_lost_streaks",
            "schedule": 3600.0,  # Toutes les heures (minuit dans différents TZ)
        },

        # === Nettoyage Notifications ===
        # Supprime les notifications lues de plus de 30 jours
        "cleanup-old-notifications": {
            "task": "app.tasks.notification_tasks.cleanup_old_notifications",
            "schedule": 86400.0,  # Une fois par jour
        },

        # === Email Digest ===
        # Envoie un résumé quotidien aux utilisateurs qui l'ont activé
        "daily-email-digest": {
            "task": "app.tasks.notification_tasks.send_email_digest",
            "schedule": 3600.0,  # Toutes les heures (18h heure locale)
        },
    },
)

# Configuration des queues
celery_app.conf.task_routes = {
    "app.tasks.ai_tasks.*": {"queue": "ai"},
    "app.tasks.ocr_tasks.*": {"queue": "processing"},
    "app.tasks.export_tasks.*": {"queue": "processing"},
    "app.tasks.notification_tasks.*": {"queue": "notifications"},
    "app.tasks.gamification_tasks.*": {"queue": "default"},
}

if __name__ == "__main__":
    celery_app.start()
