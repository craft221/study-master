"""
Tests pour les modèles User refactorés
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock

from app.models.user import (
    User,
    UserRole,
    SubscriptionType,
    UserProfile,
    UserPreferences,
    UserSubscription,
    UserGamification,
    UserStats,
    UserMascot,
    UserAIUsage,
    create_user_with_defaults
)


class TestUserRole:
    """Tests pour l'enum UserRole"""

    def test_user_roles_exist(self):
        """Tous les rôles doivent exister"""
        assert UserRole.STUDENT.value == "student"
        assert UserRole.TEACHER.value == "teacher"
        assert UserRole.ADMIN.value == "admin"

    def test_role_is_string_enum(self):
        """Les rôles sont des string enums"""
        # UserRole hérite de str et Enum
        assert UserRole.STUDENT.value == "student"
        assert str(UserRole.ADMIN.value) == "admin"


class TestSubscriptionType:
    """Tests pour l'enum SubscriptionType"""

    def test_subscription_types_exist(self):
        """Tous les types d'abonnement doivent exister"""
        assert SubscriptionType.FREE.value == "FREE"
        assert SubscriptionType.PREMIUM.value == "PREMIUM"
        assert SubscriptionType.PREMIUM_PLUS.value == "PREMIUM_PLUS"
        assert SubscriptionType.INSTITUTIONAL.value == "INSTITUTIONAL"


class TestUser:
    """Tests pour le modèle User principal"""

    def test_user_creation(self):
        """Doit pouvoir créer un utilisateur"""
        user = User(
            email="test@example.com",
            username="testuser",
            hashed_password="hashedpassword123",
            full_name="Test User",
            role=UserRole.STUDENT
        )
        assert user.email == "test@example.com"
        assert user.username == "testuser"
        assert user.role == UserRole.STUDENT

    def test_user_repr(self):
        """Test de la représentation string"""
        user = User(
            email="test@example.com",
            username="testuser",
            hashed_password="hash"
        )
        assert "testuser" in repr(user)
        assert "test@example.com" in repr(user)

    def test_user_default_values(self):
        """Les valeurs par défaut doivent être correctes (avec valeurs explicites)"""
        user = User(
            email="test@example.com",
            username="testuser",
            hashed_password="hash",
            is_active=True,
            is_verified=False,
            is_deleted=False,
            is_online=False
        )
        assert user.is_active == True
        assert user.is_verified == False
        assert user.is_deleted == False
        assert user.is_online == False

    def test_user_properties_without_submodels(self):
        """Les propriétés doivent gérer l'absence de sous-modèles"""
        user = User(
            email="test@example.com",
            username="testuser",
            hashed_password="hash"
        )
        # Sans sous-modèles, retourne les valeurs par défaut
        assert user.total_xp == 0
        assert user.level == 1
        assert user.current_streak == 0
        assert user.subscription_type == SubscriptionType.FREE
        assert user.avatar_url is None
        assert user.language == "fr"
        assert user.theme == "light"


class TestUserProfile:
    """Tests pour UserProfile"""

    def test_profile_creation(self):
        """Doit pouvoir créer un profil"""
        profile = UserProfile(
            avatar_url="https://example.com/avatar.png",
            bio="Test bio",
            university="Test University",
            timezone="UTC"
        )
        assert profile.avatar_url == "https://example.com/avatar.png"
        assert profile.bio == "Test bio"
        assert profile.timezone == "UTC"

    def test_profile_repr(self):
        """Test de la représentation string"""
        profile = UserProfile(user_id=1)
        assert "user_id=1" in repr(profile)


class TestUserPreferences:
    """Tests pour UserPreferences"""

    def test_preferences_defaults(self):
        """Les préférences par défaut doivent être correctes (avec valeurs explicites)"""
        prefs = UserPreferences(
            language="fr",
            theme="light",
            notifications_enabled=True,
            email_notifications=True,
            daily_goal_minutes=30,
            profile_public=True,
            show_in_leaderboard=True
        )
        assert prefs.language == "fr"
        assert prefs.theme == "light"
        assert prefs.notifications_enabled == True
        assert prefs.email_notifications == True
        assert prefs.daily_goal_minutes == 30
        assert prefs.profile_public == True
        assert prefs.show_in_leaderboard == True

    def test_preferences_repr(self):
        """Test de la représentation string"""
        prefs = UserPreferences(user_id=1)
        assert "user_id=1" in repr(prefs)


class TestUserSubscription:
    """Tests pour UserSubscription"""

    def test_subscription_defaults(self):
        """L'abonnement par défaut doit être FREE (avec valeurs explicites)"""
        sub = UserSubscription(
            subscription_type=SubscriptionType.FREE,
            ai_requests_limit=10,
            storage_limit_mb=100,
            auto_renew=True
        )
        assert sub.subscription_type == SubscriptionType.FREE
        assert sub.ai_requests_limit == 10
        assert sub.storage_limit_mb == 100
        assert sub.auto_renew == True

    def test_is_premium_free(self):
        """FREE n'est pas premium"""
        sub = UserSubscription(subscription_type=SubscriptionType.FREE)
        assert sub.is_premium() == False

    def test_is_premium_premium(self):
        """PREMIUM est premium"""
        sub = UserSubscription(subscription_type=SubscriptionType.PREMIUM)
        assert sub.is_premium() == True

    def test_is_premium_premium_plus(self):
        """PREMIUM_PLUS est premium"""
        sub = UserSubscription(subscription_type=SubscriptionType.PREMIUM_PLUS)
        assert sub.is_premium() == True

    def test_is_premium_institutional(self):
        """INSTITUTIONAL est premium"""
        sub = UserSubscription(subscription_type=SubscriptionType.INSTITUTIONAL)
        assert sub.is_premium() == True

    def test_is_active_free(self):
        """FREE est toujours actif"""
        sub = UserSubscription(subscription_type=SubscriptionType.FREE)
        assert sub.is_active() == True

    def test_is_active_premium_no_end_date(self):
        """Premium sans date de fin n'est pas actif"""
        sub = UserSubscription(
            subscription_type=SubscriptionType.PREMIUM,
            subscription_ends_at=None
        )
        assert sub.is_active() == False

    def test_is_active_premium_future_end_date(self):
        """Premium avec date future est actif"""
        sub = UserSubscription(
            subscription_type=SubscriptionType.PREMIUM,
            subscription_ends_at=datetime.utcnow() + timedelta(days=30)
        )
        assert sub.is_active() == True

    def test_is_active_premium_past_end_date(self):
        """Premium avec date passée n'est pas actif"""
        sub = UserSubscription(
            subscription_type=SubscriptionType.PREMIUM,
            subscription_ends_at=datetime.utcnow() - timedelta(days=1)
        )
        assert sub.is_active() == False

    def test_subscription_repr(self):
        """Test de la représentation string"""
        sub = UserSubscription(user_id=1, subscription_type=SubscriptionType.PREMIUM)
        assert "user_id=1" in repr(sub)
        assert "PREMIUM" in repr(sub)


class TestUserGamification:
    """Tests pour UserGamification"""

    def test_gamification_defaults(self):
        """Les valeurs par défaut de gamification (avec valeurs explicites)"""
        gam = UserGamification(
            total_xp=0,
            level=1,
            current_streak=0,
            longest_streak=0
        )
        assert gam.total_xp == 0
        assert gam.level == 1
        assert gam.current_streak == 0
        assert gam.longest_streak == 0

    def test_calculate_level_low_xp(self):
        """Niveau 1 avec peu d'XP"""
        gam = UserGamification(total_xp=50)
        assert gam.calculate_level() == 1

    def test_calculate_level_medium_xp(self):
        """Niveau calculé correctement avec XP moyen"""
        gam = UserGamification(total_xp=400)  # sqrt(400/100) = 2
        assert gam.calculate_level() == 2

    def test_calculate_level_high_xp(self):
        """Niveau calculé correctement avec XP élevé"""
        gam = UserGamification(total_xp=10000)  # sqrt(10000/100) = 10
        assert gam.calculate_level() == 10

    def test_xp_for_next_level(self):
        """XP pour le niveau suivant"""
        gam = UserGamification(level=3)
        # Niveau 4 = 4^2 * 100 = 1600
        assert gam.xp_for_next_level() == 1600

    def test_xp_progress_percentage_start(self):
        """Progression au début d'un niveau"""
        gam = UserGamification(level=2, total_xp=400)  # Exactement niveau 2
        # Niveau 2 = 400 XP, niveau 3 = 900 XP
        # Progress = (400 - 400) / (900 - 400) * 100 = 0%
        assert gam.xp_progress_percentage() == 0

    def test_xp_progress_percentage_middle(self):
        """Progression au milieu d'un niveau"""
        gam = UserGamification(level=2, total_xp=650)
        # Progress = (650 - 400) / (900 - 400) * 100 = 50%
        assert gam.xp_progress_percentage() == 50

    def test_add_xp_no_level_up(self):
        """Ajouter XP sans monter de niveau"""
        gam = UserGamification(level=1, total_xp=50)
        result = gam.add_xp(20)

        assert result["xp_gained"] == 20
        assert result["total_xp"] == 70
        assert result["leveled_up"] == False
        assert result["old_level"] == 1
        assert result["new_level"] == 1

    def test_add_xp_with_level_up(self):
        """Ajouter XP avec montée de niveau"""
        gam = UserGamification(level=1, total_xp=90)
        result = gam.add_xp(20)  # 110 XP = niveau 1 (sqrt(110/100) = 1.04)

        # Test avec plus d'XP pour level up
        gam2 = UserGamification(level=1, total_xp=350)
        result2 = gam2.add_xp(100)  # 450 XP = niveau 2 (sqrt(450/100) = 2.12)

        assert result2["leveled_up"] == True
        assert result2["new_level"] == 2

    def test_gamification_repr(self):
        """Test de la représentation string"""
        gam = UserGamification(user_id=1, level=5, total_xp=2500)
        assert "user_id=1" in repr(gam)
        assert "level=5" in repr(gam)


class TestUserStats:
    """Tests pour UserStats"""

    def test_stats_defaults(self):
        """Les statistiques par défaut (avec valeurs explicites)"""
        stats = UserStats(
            total_study_time_minutes=0,
            total_notes_created=0,
            total_flashcards_created=0,
            total_quizzes_completed=0,
            duels_won=0,
            duels_lost=0
        )
        assert stats.total_study_time_minutes == 0
        assert stats.total_notes_created == 0
        assert stats.total_flashcards_created == 0
        assert stats.total_quizzes_completed == 0
        assert stats.duels_won == 0

    def test_get_duel_win_rate_no_duels(self):
        """Taux de victoire sans duels"""
        stats = UserStats(duels_won=0, duels_lost=0)
        assert stats.get_duel_win_rate() == 0.0

    def test_get_duel_win_rate_with_wins(self):
        """Taux de victoire avec des duels"""
        stats = UserStats(duels_won=7, duels_lost=3)
        assert stats.get_duel_win_rate() == 70.0

    def test_get_duel_win_rate_all_wins(self):
        """Taux de victoire 100%"""
        stats = UserStats(duels_won=10, duels_lost=0)
        assert stats.get_duel_win_rate() == 100.0

    def test_increment_stat_valid(self):
        """Incrémenter une stat valide"""
        stats = UserStats(total_notes_created=5)
        result = stats.increment_stat("total_notes_created", 3)

        assert result == True
        assert stats.total_notes_created == 8

    def test_increment_stat_invalid(self):
        """Incrémenter une stat invalide"""
        stats = UserStats()
        result = stats.increment_stat("invalid_stat", 1)
        assert result == False

    def test_increment_stat_default_amount(self):
        """Incrémenter avec le montant par défaut"""
        stats = UserStats(total_flashcards_created=10)
        stats.increment_stat("total_flashcards_created")
        assert stats.total_flashcards_created == 11

    def test_stats_repr(self):
        """Test de la représentation string"""
        stats = UserStats(user_id=1)
        assert "user_id=1" in repr(stats)


class TestUserMascot:
    """Tests pour UserMascot"""

    def test_mascot_defaults(self):
        """Valeurs par défaut de la mascotte (avec valeurs explicites)"""
        mascot = UserMascot(
            name="Spark",
            level=1,
            happiness=100,
            color_variant="orange",
            interaction_count=0
        )
        assert mascot.name == "Spark"
        assert mascot.level == 1
        assert mascot.happiness == 100
        assert mascot.color_variant == "orange"

    def test_calculate_level_baby(self):
        """Spark bébé (niveaux utilisateur 1-4)"""
        mascot = UserMascot()
        assert mascot.calculate_level(1) == 1
        assert mascot.calculate_level(4) == 1

    def test_calculate_level_junior(self):
        """Spark junior (niveaux utilisateur 5-9)"""
        mascot = UserMascot()
        assert mascot.calculate_level(5) == 2
        assert mascot.calculate_level(9) == 2

    def test_calculate_level_expert(self):
        """Spark expert (niveaux utilisateur 10-14)"""
        mascot = UserMascot()
        assert mascot.calculate_level(10) == 3
        assert mascot.calculate_level(14) == 3

    def test_calculate_level_sage(self):
        """Spark sage (niveaux utilisateur 15-19)"""
        mascot = UserMascot()
        assert mascot.calculate_level(15) == 4
        assert mascot.calculate_level(19) == 4

    def test_calculate_level_legendary(self):
        """Spark légendaire (niveau utilisateur 20+)"""
        mascot = UserMascot()
        assert mascot.calculate_level(20) == 5
        assert mascot.calculate_level(50) == 5

    def test_get_unlockable_accessories_empty(self):
        """Pas d'accessoires débloquables sans stats"""
        mascot = UserMascot()
        assert mascot.get_unlockable_accessories(None, None) == []

    def test_get_unlockable_accessories_with_stats(self):
        """Accessoires débloquables avec stats"""
        mascot = UserMascot()

        stats = MagicMock()
        stats.total_flashcards_created = 150
        stats.total_notes_created = 60
        stats.total_quizzes_completed = 25

        gam = MagicMock()
        gam.current_streak = 15
        gam.total_xp = 1500
        gam.level = 12
        gam.longest_streak = 35

        unlockable = mascot.get_unlockable_accessories(stats, gam)

        assert "graduate_hat" in unlockable
        assert "mini_library" in unlockable
        assert "trophy" in unlockable
        assert "glasses" in unlockable
        assert "golden_acorn" in unlockable
        assert "lightning_cape" in unlockable
        assert "crown" in unlockable

    def test_interact(self):
        """Interaction avec la mascotte"""
        mascot = UserMascot(happiness=50, interaction_count=0)
        result = mascot.interact()

        assert result["happiness"] == 55
        assert result["interaction_count"] == 1
        assert "message" in result

    def test_interact_max_happiness(self):
        """Interaction ne dépasse pas 100 de bonheur"""
        mascot = UserMascot(happiness=98, interaction_count=0)
        mascot.interact()
        assert mascot.happiness == 100

    def test_interaction_message_happy(self):
        """Message quand Spark est content"""
        mascot = UserMascot(happiness=85)
        message = mascot._get_interaction_message()
        assert "super content" in message

    def test_interaction_message_neutral(self):
        """Message quand Spark est neutre"""
        mascot = UserMascot(happiness=60)
        message = mascot._get_interaction_message()
        assert "joyeusement" in message

    def test_interaction_message_sad(self):
        """Message quand Spark a besoin d'attention"""
        mascot = UserMascot(happiness=30)
        message = mascot._get_interaction_message()
        assert "attention" in message

    def test_mascot_repr(self):
        """Test de la représentation string"""
        mascot = UserMascot(name="Spark", level=3)
        assert "Spark" in repr(mascot)
        assert "level=3" in repr(mascot)


class TestUserAIUsage:
    """Tests pour UserAIUsage"""

    def test_ai_usage_defaults(self):
        """Valeurs par défaut d'utilisation IA (avec valeurs explicites)"""
        ai = UserAIUsage(
            requests_today=0,
            total_requests=0,
            total_tokens_used=0
        )
        assert ai.requests_today == 0
        assert ai.total_requests == 0
        assert ai.total_tokens_used == 0

    def test_can_make_request_under_limit(self):
        """Peut faire une requête sous la limite"""
        ai = UserAIUsage(requests_today=5, requests_reset_date=datetime.utcnow())
        assert ai.can_make_request(10) == True

    def test_can_make_request_at_limit(self):
        """Ne peut pas faire une requête à la limite"""
        ai = UserAIUsage(requests_today=10, requests_reset_date=datetime.utcnow())
        assert ai.can_make_request(10) == False

    def test_record_request_basic(self):
        """Enregistrer une requête basique"""
        ai = UserAIUsage(
            requests_today=2,
            total_requests=100,
            total_tokens_used=0,
            quiz_generations=0,
            requests_reset_date=datetime.utcnow()
        )
        ai.record_request("quiz", tokens_used=500)

        assert ai.requests_today == 3
        assert ai.total_requests == 101
        assert ai.total_tokens_used == 500
        assert ai.quiz_generations == 1

    def test_record_request_types(self):
        """Enregistrer différents types de requêtes"""
        ai = UserAIUsage(
            requests_today=0,
            total_requests=0,
            total_tokens_used=0,
            quiz_generations=0,
            flashcard_generations=0,
            note_summaries=0,
            explanations=0,
            requests_reset_date=datetime.utcnow()
        )

        ai.record_request("quiz")
        ai.record_request("flashcard")
        ai.record_request("summary")
        ai.record_request("explanation")
        ai.record_request("unknown_type")

        assert ai.quiz_generations == 1
        assert ai.flashcard_generations == 1
        assert ai.note_summaries == 1
        assert ai.explanations == 1
        assert ai.requests_today == 5

    def test_check_reset_same_day(self):
        """Pas de reset le même jour"""
        ai = UserAIUsage(
            requests_today=5,
            requests_reset_date=datetime.utcnow()
        )
        ai._check_reset()
        assert ai.requests_today == 5

    def test_check_reset_new_day(self):
        """Reset le lendemain"""
        ai = UserAIUsage(
            requests_today=5,
            requests_reset_date=datetime.utcnow() - timedelta(days=1)
        )
        ai._check_reset()
        assert ai.requests_today == 0

    def test_ai_usage_repr(self):
        """Test de la représentation string"""
        ai = UserAIUsage(user_id=1, requests_today=5)
        assert "user_id=1" in repr(ai)
        assert "today=5" in repr(ai)


class TestCreateUserWithDefaults:
    """Tests pour la fonction helper create_user_with_defaults"""

    def test_create_user_basic(self):
        """Créer un utilisateur avec les valeurs de base"""
        user = create_user_with_defaults(
            email="test@example.com",
            username="testuser",
            hashed_password="hashedpassword"
        )

        assert user.email == "test@example.com"
        assert user.username == "testuser"
        assert user.hashed_password == "hashedpassword"
        assert user.role == UserRole.STUDENT

    def test_create_user_with_full_name(self):
        """Créer un utilisateur avec nom complet"""
        user = create_user_with_defaults(
            email="test@example.com",
            username="testuser",
            hashed_password="hash",
            full_name="John Doe"
        )
        assert user.full_name == "John Doe"

    def test_create_user_with_role(self):
        """Créer un utilisateur avec un rôle spécifique"""
        user = create_user_with_defaults(
            email="admin@example.com",
            username="adminuser",
            hashed_password="hash",
            role=UserRole.ADMIN
        )
        assert user.role == UserRole.ADMIN

    def test_create_user_has_all_submodels(self):
        """L'utilisateur créé a tous les sous-modèles"""
        user = create_user_with_defaults(
            email="test@example.com",
            username="testuser",
            hashed_password="hash"
        )

        assert user.profile is not None
        assert user.preferences is not None
        assert user.subscription is not None
        assert user.gamification is not None
        assert user.stats is not None
        assert user.mascot is not None
        assert user.ai_usage is not None

    def test_create_user_submodels_have_defaults(self):
        """Les sous-modèles ont les valeurs par défaut"""
        user = create_user_with_defaults(
            email="test@example.com",
            username="testuser",
            hashed_password="hash"
        )

        assert user.profile.timezone == "UTC"
        assert user.preferences.language == "fr"
        assert user.subscription.subscription_type == SubscriptionType.FREE
        assert user.gamification.level == 1
        assert user.stats.total_study_time_minutes == 0
        assert user.mascot.name == "Spark"
        assert user.ai_usage.requests_today == 0
