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
        "app.tasks.exam_mode_tasks",
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
        "cleanup-expired-focus-rooms": {
            "task": "app.tasks.gamification_tasks.cleanup_expired_focus_rooms",
            "schedule": 86400.0,  # Une fois par jour - supprime les rooms sans activité depuis 7 jours
        },

        # === Reset Hebdomadaire des Ligues ===
        # Promeut/rétrograde les utilisateurs et reset les XP
        # Exécuté chaque lundi à 00:00 UTC
        "weekly-league-reset": {
            "task": "app.tasks.gamification_tasks.process_weekly_league_reset",
            "schedule": 604800.0,  # 7 jours en secondes
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

        # === Exam Mode - Rappels Quotidiens ===
        # Envoie des rappels aux heures configurées par chaque utilisateur
        "exam-mode-daily-reminders": {
            "task": "exam_mode.send_daily_reminders",
            "schedule": 3600.0,  # Toutes les heures (vérifie les timezones)
        },

        # === Exam Mode - Alertes Examens ===
        # Alerte J-7, J-3, J-1, Jour J
        "exam-mode-exam-alerts": {
            "task": "exam_mode.send_exam_alerts",
            "schedule": 21600.0,  # Toutes les 6 heures
        },

        # === Exam Mode - Mise à jour Prédictions ===
        "exam-mode-update-predictions": {
            "task": "exam_mode.update_predictions",
            "schedule": 21600.0,  # Toutes les 6 heures
        },

        # === Exam Mode - Nettoyage Sessions Expirées ===
        "exam-mode-cleanup-sessions": {
            "task": "exam_mode.cleanup_expired_sessions",
            "schedule": 86400.0,  # Une fois par jour
        },

        # === Exam Mode - Notifications Progression ===
        "exam-mode-progress-notifications": {
            "task": "exam_mode.send_progress_notifications",
            "schedule": 7200.0,  # Toutes les 2 heures
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
    "app.tasks.exam_mode_tasks.*": {"queue": "notifications"},
    "exam_mode.*": {"queue": "notifications"},
}

if __name__ == "__main__":
    celery_app.start()
