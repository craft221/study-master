"""
Tests pour le service de notifications
"""
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


def run_async(coro):
    """Helper pour exécuter des coroutines"""
    return asyncio.get_event_loop().run_until_complete(coro)


class TestNotificationServiceShouldNotify:
    """Tests pour _should_notify"""

    def test_should_notify_no_prefs(self):
        """Sans préférences, tout est activé par défaut"""
        from app.services.notification_service import NotificationService
        from app.models.notification import NotificationType

        service = NotificationService()
        result = service._should_notify(None, NotificationType.ACHIEVEMENT_UNLOCKED)
        assert result is True

    def test_should_notify_in_app_disabled(self):
        """Si in_app_enabled=False, ne pas notifier"""
        from app.services.notification_service import NotificationService
        from app.models.notification import NotificationType

        service = NotificationService()
        prefs = MagicMock()
        prefs.in_app_enabled = False

        result = service._should_notify(prefs, NotificationType.ACHIEVEMENT_UNLOCKED)
        assert result is False

    def test_should_notify_duel_type(self):
        """Type duel vérifie duel_notifications"""
        from app.services.notification_service import NotificationService
        from app.models.notification import NotificationType

        service = NotificationService()
        prefs = MagicMock()
        prefs.in_app_enabled = True
        prefs.duel_notifications = True

        result = service._should_notify(prefs, NotificationType.DUEL_CHALLENGE)
        assert result is True

    def test_should_notify_duel_disabled(self):
        """Duel désactivé"""
        from app.services.notification_service import NotificationService
        from app.models.notification import NotificationType

        service = NotificationService()
        prefs = MagicMock()
        prefs.in_app_enabled = True
        prefs.duel_notifications = False

        result = service._should_notify(prefs, NotificationType.DUEL_CHALLENGE)
        assert result is False

    def test_should_notify_streak_type(self):
        """Type streak vérifie streak_notifications"""
        from app.services.notification_service import NotificationService
        from app.models.notification import NotificationType

        service = NotificationService()
        prefs = MagicMock()
        prefs.in_app_enabled = True
        prefs.streak_notifications = True

        result = service._should_notify(prefs, NotificationType.STREAK_REMINDER)
        assert result is True

    def test_should_notify_achievement_type(self):
        """Type achievement vérifie achievement_notifications"""
        from app.services.notification_service import NotificationService
        from app.models.notification import NotificationType

        service = NotificationService()
        prefs = MagicMock()
        prefs.in_app_enabled = True
        prefs.achievement_notifications = True

        result = service._should_notify(prefs, NotificationType.LEVEL_UP)
        assert result is True

    def test_should_notify_flashcard_type(self):
        """Type flashcard vérifie study_reminders"""
        from app.services.notification_service import NotificationService
        from app.models.notification import NotificationType

        service = NotificationService()
        prefs = MagicMock()
        prefs.in_app_enabled = True
        prefs.study_reminders = True

        result = service._should_notify(prefs, NotificationType.FLASHCARD_REVIEW)
        assert result is True

    def test_should_notify_calendar_type(self):
        """Type calendar vérifie calendar_notifications"""
        from app.services.notification_service import NotificationService
        from app.models.notification import NotificationType

        service = NotificationService()
        prefs = MagicMock()
        prefs.in_app_enabled = True
        prefs.calendar_notifications = True

        result = service._should_notify(prefs, NotificationType.EVENT_REMINDER)
        assert result is True


class TestNotificationServiceQuietHours:
    """Tests pour _is_quiet_hours"""

    def test_quiet_hours_no_prefs(self):
        """Sans préférences, pas d'heures de silence"""
        from app.services.notification_service import NotificationService

        service = NotificationService()
        result = service._is_quiet_hours(None)
        assert result is False

    def test_quiet_hours_normal_range(self):
        """Heures de silence normales (ex: 22h-8h même jour)"""
        from app.services.notification_service import NotificationService

        service = NotificationService()
        prefs = MagicMock()
        prefs.quiet_hours_start = 22
        prefs.quiet_hours_end = 8

        # Test avec différentes heures
        with patch('app.services.notification_service.datetime') as mock_dt:
            mock_now = MagicMock()
            mock_now.hour = 23  # 23h est entre 22h et 8h (traverse minuit)
            mock_dt.utcnow.return_value = mock_now

            result = service._is_quiet_hours(prefs)
            assert result is True

    def test_quiet_hours_crossing_midnight(self):
        """Heures de silence traversant minuit"""
        from app.services.notification_service import NotificationService

        service = NotificationService()
        prefs = MagicMock()
        prefs.quiet_hours_start = 22
        prefs.quiet_hours_end = 8

        with patch('app.services.notification_service.datetime') as mock_dt:
            mock_now = MagicMock()
            mock_now.hour = 3  # 3h est entre 22h et 8h
            mock_dt.utcnow.return_value = mock_now

            result = service._is_quiet_hours(prefs)
            assert result is True

    def test_quiet_hours_outside_range(self):
        """En dehors des heures de silence"""
        from app.services.notification_service import NotificationService

        service = NotificationService()
        prefs = MagicMock()
        prefs.quiet_hours_start = 22
        prefs.quiet_hours_end = 8

        with patch('app.services.notification_service.datetime') as mock_dt:
            mock_now = MagicMock()
            mock_now.hour = 15  # 15h n'est pas entre 22h et 8h
            mock_dt.utcnow.return_value = mock_now

            result = service._is_quiet_hours(prefs)
            assert result is False


class TestNotificationServiceInstance:
    """Tests de l'instance globale"""

    def test_global_instance_exists(self):
        """L'instance globale existe"""
        from app.services.notification_service import notification_service
        assert notification_service is not None

    def test_global_instance_is_notification_service(self):
        """L'instance globale est un NotificationService"""
        from app.services.notification_service import notification_service, NotificationService
        assert isinstance(notification_service, NotificationService)


class TestNotificationServiceMessageTemplates:
    """Tests des templates de messages"""

    def test_notify_streak_reminder_messages(self):
        """Les messages de streak contiennent le nombre de jours"""
        from app.services.notification_service import NotificationService

        service = NotificationService()

        async def run_test():
            with patch.object(service, 'create_notification', new_callable=AsyncMock) as mock_create:
                mock_create.return_value = MagicMock()
                db = AsyncMock()
                await service.notify_streak_reminder(db, user_id=1, current_streak=10)
                return mock_create.call_args

        call_args = run_async(run_test())
        message = call_args.kwargs.get('message', '')
        assert '10' in message

    def test_notify_event_reminder_format_hours(self):
        """Format des heures pour les rappels d'événements"""
        from app.services.notification_service import NotificationService

        service = NotificationService()

        async def run_test():
            with patch.object(service, 'create_notification', new_callable=AsyncMock) as mock_create:
                mock_create.return_value = MagicMock()
                db = AsyncMock()
                await service.notify_event_reminder(
                    db, user_id=1, event_title="Exam", event_id=1, minutes_before=120
                )
                return mock_create.call_args

        call_args = run_async(run_test())
        message = call_args.kwargs.get('message', '')
        assert '2h' in message

    def test_notify_event_reminder_format_minutes(self):
        """Format des minutes pour les rappels d'événements"""
        from app.services.notification_service import NotificationService

        service = NotificationService()

        async def run_test():
            with patch.object(service, 'create_notification', new_callable=AsyncMock) as mock_create:
                mock_create.return_value = MagicMock()
                db = AsyncMock()
                await service.notify_event_reminder(
                    db, user_id=1, event_title="Exam", event_id=1, minutes_before=30
                )
                return mock_create.call_args

        call_args = run_async(run_test())
        message = call_args.kwargs.get('message', '')
        assert '30min' in message

    def test_notify_flashcard_review_with_subject(self):
        """Message de révision avec nom de matière"""
        from app.services.notification_service import NotificationService

        service = NotificationService()

        async def run_test():
            with patch.object(service, 'create_notification', new_callable=AsyncMock) as mock_create:
                mock_create.return_value = MagicMock()
                db = AsyncMock()
                await service.notify_flashcard_review(
                    db, user_id=1, cards_due=10, subject_name="Mathématiques"
                )
                return mock_create.call_args

        call_args = run_async(run_test())
        message = call_args.kwargs.get('message', '')
        assert '10' in message
        assert 'Mathématiques' in message

    def test_notify_flashcard_review_without_subject(self):
        """Message de révision sans nom de matière"""
        from app.services.notification_service import NotificationService

        service = NotificationService()

        async def run_test():
            with patch.object(service, 'create_notification', new_callable=AsyncMock) as mock_create:
                mock_create.return_value = MagicMock()
                db = AsyncMock()
                await service.notify_flashcard_review(
                    db, user_id=1, cards_due=5, subject_name=None
                )
                return mock_create.call_args

        call_args = run_async(run_test())
        message = call_args.kwargs.get('message', '')
        assert '5' in message

    def test_notify_duel_challenge(self):
        """Notification de défi"""
        from app.services.notification_service import NotificationService
        from app.models.notification import NotificationType, NotificationPriority

        service = NotificationService()

        async def run_test():
            with patch.object(service, 'create_notification', new_callable=AsyncMock) as mock_create:
                mock_create.return_value = MagicMock()
                db = AsyncMock()
                await service.notify_duel_challenge(
                    db, opponent_id=2, challenger_username="testuser",
                    stakes_xp=100, duel_id=1
                )
                return mock_create.call_args

        call_args = run_async(run_test())
        assert call_args.kwargs['notification_type'] == NotificationType.DUEL_CHALLENGE
        assert call_args.kwargs['priority'] == NotificationPriority.HIGH
        assert 'testuser' in call_args.kwargs['message']
        assert '100' in call_args.kwargs['message']

    def test_notify_achievement_unlocked(self):
        """Notification de succès débloqué"""
        from app.services.notification_service import NotificationService
        from app.models.notification import NotificationType, NotificationPriority

        service = NotificationService()

        async def run_test():
            with patch.object(service, 'create_notification', new_callable=AsyncMock) as mock_create:
                mock_create.return_value = MagicMock()
                db = AsyncMock()
                await service.notify_achievement_unlocked(
                    db, user_id=1, achievement_name="Premier Quiz",
                    achievement_id=1, xp_reward=50
                )
                return mock_create.call_args

        call_args = run_async(run_test())
        assert call_args.kwargs['notification_type'] == NotificationType.ACHIEVEMENT_UNLOCKED
        assert call_args.kwargs['priority'] == NotificationPriority.HIGH
        assert 'Premier Quiz' in call_args.kwargs['message']
        assert '50' in call_args.kwargs['message']

    def test_notify_level_up(self):
        """Notification de niveau supérieur"""
        from app.services.notification_service import NotificationService
        from app.models.notification import NotificationType

        service = NotificationService()

        async def run_test():
            with patch.object(service, 'create_notification', new_callable=AsyncMock) as mock_create:
                mock_create.return_value = MagicMock()
                db = AsyncMock()
                await service.notify_level_up(db, user_id=1, new_level=5)
                return mock_create.call_args

        call_args = run_async(run_test())
        assert call_args.kwargs['notification_type'] == NotificationType.LEVEL_UP
        assert '5' in call_args.kwargs['title']
        assert '5' in call_args.kwargs['message']


class TestNotificationServiceBulk:
    """Tests pour les notifications bulk"""

    def test_create_bulk_notifications(self):
        """Création de notifications en masse"""
        from app.services.notification_service import NotificationService
        from app.models.notification import NotificationType

        service = NotificationService()

        async def run_test():
            with patch.object(service, 'create_notification', new_callable=AsyncMock) as mock_create:
                mock_create.return_value = MagicMock()
                db = AsyncMock()
                user_ids = [1, 2, 3]
                count = await service.create_bulk_notifications(
                    db=db,
                    user_ids=user_ids,
                    notification_type=NotificationType.STREAK_REMINDER,
                    title="Test",
                    message="Message"
                )
                return count, mock_create.call_count

        count, call_count = run_async(run_test())
        assert call_count == 3
        assert count == 3

    def test_create_bulk_notifications_partial_failure(self):
        """Notifications bulk avec échecs partiels"""
        from app.services.notification_service import NotificationService
        from app.models.notification import NotificationType

        service = NotificationService()

        async def run_test():
            with patch.object(service, 'create_notification', new_callable=AsyncMock) as mock_create:
                mock_create.side_effect = [MagicMock(), None, MagicMock()]
                db = AsyncMock()
                user_ids = [1, 2, 3]
                count = await service.create_bulk_notifications(
                    db=db,
                    user_ids=user_ids,
                    notification_type=NotificationType.STREAK_REMINDER,
                    title="Test",
                    message="Message"
                )
                return count

        count = run_async(run_test())
        assert count == 2  # Seulement 2 ont réussi
