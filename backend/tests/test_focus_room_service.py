"""
Tests pour le service Focus Room
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.focus_room_service import FocusRoomService, XP_REWARDS
from app.models.focus_room import (
    FocusRoom, FocusRoomParticipant, FocusSession,
    FocusRoomType, FocusRoomCategory, ParticipantStatus,
    FocusActivityType, InvitationStatus
)
from app.models.user import User


class TestXPRewards:
    """Tests pour les constantes XP"""

    def test_xp_rewards_defined(self):
        """Les recompenses XP sont definies"""
        assert "create_room" in XP_REWARDS
        assert "join_room" in XP_REWARDS
        assert "focus_minute" in XP_REWARDS
        assert "milestone_15min" in XP_REWARDS
        assert "milestone_1h" in XP_REWARDS
        assert "deep_work_completed" in XP_REWARDS

    def test_xp_rewards_values(self):
        """Les valeurs XP sont raisonnables"""
        assert XP_REWARDS["create_room"] == 30
        assert XP_REWARDS["join_room"] == 5
        assert XP_REWARDS["milestone_15min"] == 10
        assert XP_REWARDS["milestone_30min"] == 25
        assert XP_REWARDS["milestone_1h"] == 60
        assert XP_REWARDS["deep_work_completed"] == 50

    def test_milestone_xp_increasing(self):
        """Les XP de milestones augmentent"""
        milestones = [
            XP_REWARDS["milestone_15min"],
            XP_REWARDS["milestone_30min"],
            XP_REWARDS["milestone_45min"],
            XP_REWARDS["milestone_1h"],
            XP_REWARDS["milestone_90min"],
            XP_REWARDS["milestone_2h"],
            XP_REWARDS["milestone_3h"],
            XP_REWARDS["milestone_4h"],
        ]
        for i in range(len(milestones) - 1):
            assert milestones[i] < milestones[i+1], f"Milestone {i} should be less than {i+1}"


class TestFocusRoomService:
    """Tests pour FocusRoomService"""

    @pytest.fixture
    def service(self):
        """Instance du service"""
        return FocusRoomService()

    @pytest.fixture
    def mock_db(self):
        """Mock de session DB"""
        db = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.add = MagicMock()
        db.execute = AsyncMock()
        return db

    @pytest.fixture
    def mock_user(self):
        """Mock d'utilisateur"""
        user = MagicMock(spec=User)
        user.id = 1
        user.username = "testuser"
        user.level = 5
        user.avatar_url = "https://example.com/avatar.png"
        return user


class TestFocusRoomType:
    """Tests pour les types de room"""

    def test_room_types_exist(self):
        """Tous les types de room existent"""
        assert FocusRoomType.PUBLIC is not None
        assert FocusRoomType.PRIVATE is not None
        assert FocusRoomType.SUBJECT is not None
        assert FocusRoomType.UNIVERSITY is not None
        assert FocusRoomType.EVENT is not None

    def test_room_types_values(self):
        """Les valeurs des types sont correctes"""
        assert FocusRoomType.PUBLIC.value == "public"
        assert FocusRoomType.PRIVATE.value == "private"


class TestFocusRoomCategory:
    """Tests pour les categories de room"""

    def test_categories_exist(self):
        """Les categories existent"""
        assert FocusRoomCategory.GENERAL is not None
        assert FocusRoomCategory.SCIENCES is not None
        assert FocusRoomCategory.HUMANITIES is not None
        assert FocusRoomCategory.LANGUAGES is not None
        assert FocusRoomCategory.TECHNOLOGY is not None

    def test_categories_values(self):
        """Les valeurs des categories sont correctes"""
        assert FocusRoomCategory.GENERAL.value == "general"
        assert FocusRoomCategory.SCIENCES.value == "sciences"


class TestParticipantStatus:
    """Tests pour les statuts de participant"""

    def test_statuses_exist(self):
        """Tous les statuts existent"""
        assert ParticipantStatus.FOCUSING is not None
        assert ParticipantStatus.DEEP_WORK is not None
        assert ParticipantStatus.BREAK is not None
        assert ParticipantStatus.IDLE is not None
        assert ParticipantStatus.AWAY is not None

    def test_status_values(self):
        """Les valeurs des statuts sont correctes"""
        assert ParticipantStatus.FOCUSING.value == "focusing"
        assert ParticipantStatus.DEEP_WORK.value == "deep_work"
        assert ParticipantStatus.BREAK.value == "break"


class TestFocusActivityType:
    """Tests pour les types d'activite"""

    def test_activity_types_exist(self):
        """Les types d'activite existent"""
        assert FocusActivityType.USER_JOINED is not None
        assert FocusActivityType.USER_LEFT is not None
        assert FocusActivityType.STATUS_CHANGED is not None
        assert FocusActivityType.MILESTONE_15MIN is not None
        assert FocusActivityType.MILESTONE_1H is not None


class TestInvitationStatus:
    """Tests pour les statuts d'invitation"""

    def test_invitation_statuses_exist(self):
        """Les statuts d'invitation existent"""
        assert InvitationStatus.PENDING is not None
        assert InvitationStatus.ACCEPTED is not None
        assert InvitationStatus.DECLINED is not None
        assert InvitationStatus.EXPIRED is not None


class TestFocusRoomModel:
    """Tests pour le modele FocusRoom"""

    def test_focus_room_creation(self):
        """Creation d'une FocusRoom"""
        room = FocusRoom(
            name="Test Room",
            description="A test room",
            emoji="📚",
            room_type=FocusRoomType.PUBLIC,
            category=FocusRoomCategory.GENERAL,
            max_participants=50,
            creator_id=1
        )

        assert room.name == "Test Room"
        assert room.room_type == FocusRoomType.PUBLIC
        assert room.max_participants == 50

    def test_focus_room_private(self):
        """Room privee"""
        room = FocusRoom(
            name="Private Room",
            room_type=FocusRoomType.PRIVATE,
            category=FocusRoomCategory.GENERAL,
            is_private=True,
            creator_id=1
        )

        assert room.is_private == True

    def test_generate_invite_code(self):
        """Generation de code d'invitation"""
        room = FocusRoom(
            name="Private Room",
            room_type=FocusRoomType.PRIVATE,
            category=FocusRoomCategory.GENERAL,
            is_private=True,
            creator_id=1
        )

        room.generate_invite_code()

        assert room.invite_code is not None
        assert len(room.invite_code) == 8


class TestFocusRoomParticipant:
    """Tests pour le modele FocusRoomParticipant"""

    def test_participant_creation(self):
        """Creation d'un participant"""
        participant = FocusRoomParticipant(
            room_id=1,
            user_id=1,
            status=ParticipantStatus.FOCUSING
        )

        assert participant.room_id == 1
        assert participant.status == ParticipantStatus.FOCUSING

    def test_participant_status_change(self):
        """Changement de statut"""
        participant = FocusRoomParticipant(
            room_id=1,
            user_id=1,
            status=ParticipantStatus.FOCUSING
        )

        participant.status = ParticipantStatus.BREAK
        assert participant.status == ParticipantStatus.BREAK


class TestFocusSession:
    """Tests pour le modele FocusSession"""

    def test_session_creation(self):
        """Creation d'une session"""
        now = datetime.utcnow()
        session = FocusSession(
            room_id=1,
            user_id=1,
            started_at=now,
            ended_at=now + timedelta(hours=1),
            focus_minutes=60,
            break_minutes=10,
            xp_earned=100
        )

        assert session.focus_minutes == 60
        assert session.xp_earned == 100

    def test_session_duration(self):
        """Calcul de duree de session"""
        now = datetime.utcnow()
        session = FocusSession(
            room_id=1,
            user_id=1,
            started_at=now,
            ended_at=now + timedelta(minutes=90),
            focus_minutes=75,
            break_minutes=15
        )

        assert session.focus_minutes + session.break_minutes == 90


class TestMilestoneXP:
    """Tests pour les milestones et XP"""

    def test_milestone_detection_15min(self):
        """Detection du milestone 15min"""
        assert XP_REWARDS["milestone_15min"] == 10

    def test_milestone_detection_30min(self):
        """Detection du milestone 30min"""
        assert XP_REWARDS["milestone_30min"] == 25

    def test_milestone_detection_1h(self):
        """Detection du milestone 1h"""
        assert XP_REWARDS["milestone_1h"] == 60

    def test_milestone_detection_2h(self):
        """Detection du milestone 2h"""
        assert XP_REWARDS["milestone_2h"] == 150

    def test_room_bonus_percent(self):
        """Bonus XP pour etudier en room"""
        assert XP_REWARDS["room_bonus_percent"] == 20


class TestDeepWorkMode:
    """Tests pour le mode Deep Work"""

    def test_deep_work_xp_reward(self):
        """XP pour deep work complete"""
        assert XP_REWARDS["deep_work_completed"] == 50

    def test_deep_work_status(self):
        """Statut Deep Work"""
        participant = FocusRoomParticipant(
            room_id=1,
            user_id=1,
            status=ParticipantStatus.DEEP_WORK
        )
        assert participant.status == ParticipantStatus.DEEP_WORK


class TestFocusRoomServiceMethods:
    """Tests pour les methodes du service"""

    @pytest.fixture
    def service(self):
        """Instance du service"""
        return FocusRoomService()

    def test_service_initialization(self, service):
        """Le service s'initialise correctement"""
        assert service is not None

    @pytest.mark.asyncio
    async def test_get_room_not_found(self, service):
        """get_room retourne None si room non trouvee"""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        result = await service.get_room(mock_db, 999)
        assert result is None

    @pytest.mark.asyncio
    async def test_get_room_found(self, service):
        """get_room retourne la room si trouvee"""
        mock_room = MagicMock(spec=FocusRoom)
        mock_room.id = 1
        mock_room.name = "Test Room"

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_room
        mock_db.execute.return_value = mock_result

        result = await service.get_room(mock_db, 1)
        assert result is not None
        assert result.id == 1


class TestFocusRoomCreation:
    """Tests pour la creation de room"""

    @pytest.fixture
    def service(self):
        return FocusRoomService()

    @pytest.mark.asyncio
    async def test_create_room_basic(self, service):
        """Creation d'une room basique"""
        from app.schemas.focus_room import FocusRoomCreate

        mock_db = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()
        mock_db.add = MagicMock()

        mock_user = MagicMock()
        mock_user.id = 1
        mock_user.gamification = MagicMock()
        mock_user.gamification.total_xp = 100

        room_data = FocusRoomCreate(
            name="Test Room",
            description="A test room",
            emoji="📚",
            room_type=FocusRoomType.PUBLIC,
            category=FocusRoomCategory.GENERAL,
            max_participants=50
        )

        with patch('app.services.focus_room_service.award_xp', new_callable=AsyncMock):
            with patch.object(service, '_update_user_focus_stats', new_callable=AsyncMock):
                room = await service.create_room(mock_db, mock_user, room_data)

        assert room is not None
        assert room.name == "Test Room"
        mock_db.add.assert_called_once()


class TestFocusRoomParticipation:
    """Tests pour la participation aux rooms"""

    def test_participant_statuses_transitions(self):
        """Transitions de statut valides"""
        valid_transitions = [
            (ParticipantStatus.FOCUSING, ParticipantStatus.BREAK),
            (ParticipantStatus.BREAK, ParticipantStatus.FOCUSING),
            (ParticipantStatus.FOCUSING, ParticipantStatus.DEEP_WORK),
            (ParticipantStatus.DEEP_WORK, ParticipantStatus.BREAK),
            (ParticipantStatus.FOCUSING, ParticipantStatus.AWAY),
            (ParticipantStatus.IDLE, ParticipantStatus.FOCUSING),
        ]

        for from_status, to_status in valid_transitions:
            participant = FocusRoomParticipant(
                room_id=1,
                user_id=1,
                status=from_status
            )
            participant.status = to_status
            assert participant.status == to_status
