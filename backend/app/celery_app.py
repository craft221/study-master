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
    
    # Tâches planifiées (Celery Beat)
    beat_schedule={
        "reset-daily-ai-requests": {
            "task": "app.tasks.gamification_tasks.reset_daily_ai_requests",
            "schedule": 86400.0,  # Chaque jour (24h)
        },
        "calculate-leaderboards": {
            "task": "app.tasks.gamification_tasks.calculate_leaderboards",
            "schedule": 3600.0,  # Chaque heure
        },
        "send-study-reminders": {
            "task": "app.tasks.notification_tasks.send_study_reminders",
            "schedule": 1800.0,  # Toutes les 30 minutes
        },
        "cleanup-expired-sessions": {
            "task": "app.tasks.gamification_tasks.cleanup_expired_sessions",
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
}

if __name__ == "__main__":
    celery_app.start()
