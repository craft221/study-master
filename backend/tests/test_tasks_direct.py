"""
Tests directs des tâches Celery - Imports et structure
Ces tests vérifient que les modules de tasks s'importent correctement.
"""
import pytest
from datetime import datetime, timedelta


class TestTaskModuleImports:
    """Tests d'import des modules de tasks"""

    def test_import_gamification_tasks(self):
        """Peut importer gamification_tasks"""
        from app.tasks import gamification_tasks
        assert gamification_tasks is not None

    def test_import_notification_tasks(self):
        """Peut importer notification_tasks"""
        from app.tasks import notification_tasks
        assert notification_tasks is not None

    def test_import_ai_tasks(self):
        """Peut importer ai_tasks"""
        from app.tasks import ai_tasks
        assert ai_tasks is not None

    def test_import_export_tasks(self):
        """Peut importer export_tasks"""
        from app.tasks import export_tasks
        assert export_tasks is not None

    def test_import_ocr_tasks(self):
        """Peut importer ocr_tasks"""
        from app.tasks import ocr_tasks
        assert ocr_tasks is not None

    def test_celery_app_exists(self):
        """L'application Celery existe"""
        from app.celery_app import celery_app
        assert celery_app is not None
        assert hasattr(celery_app, 'task')
        assert hasattr(celery_app, 'conf')


class TestGamificationTasksStructure:
    """Tests de structure pour gamification_tasks"""

    def test_run_async_helper_exists(self):
        """Helper run_async existe"""
        from app.tasks.gamification_tasks import run_async
        assert callable(run_async)

    def test_gamification_task_class_exists(self):
        """Classe GamificationTask existe"""
        from app.tasks.gamification_tasks import GamificationTask
        assert GamificationTask is not None

    def test_reset_daily_ai_requests_is_task(self):
        """reset_daily_ai_requests est une tâche Celery"""
        from app.tasks.gamification_tasks import reset_daily_ai_requests
        assert hasattr(reset_daily_ai_requests, 'delay')
        assert hasattr(reset_daily_ai_requests, 'apply_async')

    def test_calculate_user_level_is_task(self):
        """calculate_user_level est une tâche Celery"""
        from app.tasks.gamification_tasks import calculate_user_level
        assert hasattr(calculate_user_level, 'delay')

    def test_update_streaks_is_task(self):
        """update_streaks est une tâche Celery"""
        from app.tasks.gamification_tasks import update_streaks
        assert hasattr(update_streaks, 'delay')

    def test_check_achievements_is_task(self):
        """check_achievements est une tâche Celery"""
        from app.tasks.gamification_tasks import check_achievements
        assert hasattr(check_achievements, 'delay')

    def test_cleanup_expired_sessions_is_task(self):
        """cleanup_expired_sessions est une tâche Celery"""
        from app.tasks.gamification_tasks import cleanup_expired_sessions
        assert hasattr(cleanup_expired_sessions, 'delay')

    def test_award_daily_bonus_is_task(self):
        """award_daily_bonus est une tâche Celery"""
        from app.tasks.gamification_tasks import award_daily_bonus
        assert hasattr(award_daily_bonus, 'delay')

    def test_calculate_leaderboards_is_task(self):
        """calculate_leaderboards est une tâche Celery"""
        from app.tasks.gamification_tasks import calculate_leaderboards
        assert hasattr(calculate_leaderboards, 'delay')


class TestNotificationTasksStructure:
    """Tests de structure pour notification_tasks"""

    def test_send_streak_reminders_is_task(self):
        """send_streak_reminders est une tâche Celery"""
        from app.tasks.notification_tasks import send_streak_reminders
        assert hasattr(send_streak_reminders, 'delay')

    def test_cleanup_old_notifications_is_task(self):
        """cleanup_old_notifications est une tâche Celery"""
        from app.tasks.notification_tasks import cleanup_old_notifications
        assert hasattr(cleanup_old_notifications, 'delay')

    def test_send_email_digest_is_task(self):
        """send_email_digest est une tâche Celery"""
        from app.tasks.notification_tasks import send_email_digest
        assert hasattr(send_email_digest, 'delay')

    def test_send_flashcard_reminders_is_task(self):
        """send_flashcard_reminders est une tâche Celery"""
        from app.tasks.notification_tasks import send_flashcard_reminders
        assert hasattr(send_flashcard_reminders, 'delay')

    def test_check_lost_streaks_is_task(self):
        """check_lost_streaks est une tâche Celery"""
        from app.tasks.notification_tasks import check_lost_streaks
        assert hasattr(check_lost_streaks, 'delay')

    def test_check_streak_milestones_is_task(self):
        """check_streak_milestones est une tâche Celery"""
        from app.tasks.notification_tasks import check_streak_milestones
        assert hasattr(check_streak_milestones, 'delay')

    def test_send_calendar_reminders_is_task(self):
        """send_calendar_reminders est une tâche Celery"""
        from app.tasks.notification_tasks import send_calendar_reminders
        assert hasattr(send_calendar_reminders, 'delay')


class TestAITasksStructure:
    """Tests de structure pour ai_tasks"""

    def test_generate_flashcards_from_content_is_task(self):
        """generate_flashcards_from_content est une tâche Celery"""
        from app.tasks.ai_tasks import generate_flashcards_from_content
        assert hasattr(generate_flashcards_from_content, 'delay')

    def test_generate_quiz_from_content_is_task(self):
        """generate_quiz_from_content est une tâche Celery"""
        from app.tasks.ai_tasks import generate_quiz_from_content
        assert hasattr(generate_quiz_from_content, 'delay')

    def test_summarize_content_is_task(self):
        """summarize_content est une tâche Celery"""
        from app.tasks.ai_tasks import summarize_content
        assert hasattr(summarize_content, 'delay')

    def test_extract_keywords_is_task(self):
        """extract_keywords est une tâche Celery"""
        from app.tasks.ai_tasks import extract_keywords
        assert hasattr(extract_keywords, 'delay')

    def test_generate_study_plan_is_task(self):
        """generate_study_plan est une tâche Celery"""
        from app.tasks.ai_tasks import generate_study_plan
        assert hasattr(generate_study_plan, 'delay')

    def test_analyze_study_progress_is_task(self):
        """analyze_study_progress est une tâche Celery"""
        from app.tasks.ai_tasks import analyze_study_progress
        assert hasattr(analyze_study_progress, 'delay')

    def test_batch_generate_content_is_task(self):
        """batch_generate_content est une tâche Celery"""
        from app.tasks.ai_tasks import batch_generate_content
        assert hasattr(batch_generate_content, 'delay')


class TestExportTasksStructure:
    """Tests de structure pour export_tasks"""

    def test_export_notes_to_pdf_is_task(self):
        """export_notes_to_pdf est une tâche Celery"""
        from app.tasks.export_tasks import export_notes_to_pdf
        assert hasattr(export_notes_to_pdf, 'delay')

    def test_export_flashcards_to_pdf_is_task(self):
        """export_flashcards_to_pdf est une tâche Celery"""
        from app.tasks.export_tasks import export_flashcards_to_pdf
        assert hasattr(export_flashcards_to_pdf, 'delay')


class TestOCRTasksStructure:
    """Tests de structure pour ocr_tasks"""

    def test_extract_text_from_image_is_task(self):
        """extract_text_from_image est une tâche Celery"""
        from app.tasks.ocr_tasks import extract_text_from_image
        assert hasattr(extract_text_from_image, 'delay')

    def test_extract_text_from_pdf_is_task(self):
        """extract_text_from_pdf est une tâche Celery"""
        from app.tasks.ocr_tasks import extract_text_from_pdf
        assert hasattr(extract_text_from_pdf, 'delay')

    def test_process_document_with_ocr_is_task(self):
        """process_document_with_ocr est une tâche Celery"""
        from app.tasks.ocr_tasks import process_document_with_ocr
        assert hasattr(process_document_with_ocr, 'delay')


class TestRunAsyncHelper:
    """Tests pour le helper run_async"""

    def test_run_async_executes_coroutine(self):
        """run_async exécute une coroutine"""
        from app.tasks.gamification_tasks import run_async
        import asyncio

        async def sample_coro():
            return "test_result"

        result = run_async(sample_coro())
        assert result == "test_result"

    def test_run_async_with_async_value(self):
        """run_async avec valeur async"""
        from app.tasks.gamification_tasks import run_async
        import asyncio

        async def compute():
            await asyncio.sleep(0.01)
            return 42

        result = run_async(compute())
        assert result == 42


class TestCeleryConfiguration:
    """Tests de configuration Celery"""

    def test_celery_broker_configured(self):
        """Le broker Celery est configuré"""
        from app.celery_app import celery_app
        assert celery_app.conf.broker_url is not None

    def test_celery_result_backend_configured(self):
        """Le result backend est configuré"""
        from app.celery_app import celery_app
        assert celery_app.conf.result_backend is not None

    def test_celery_has_registered_tasks(self):
        """Celery a des tasks enregistrées"""
        from app.celery_app import celery_app
        assert len(celery_app.tasks) > 0
