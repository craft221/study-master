"""
Models package - Exports tous les modèles SQLAlchemy
"""

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
from app.models.gamification import *
from app.models.note import Note
from app.models.subject import Subject
from app.models.document import Document, DocumentType
from app.models.flashcard import Flashcard, FlashcardReview, FlashcardStatus
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.models.study_session import StudySession
from app.models.study_group import StudyGroup, StudyGroupMembership
from app.models.schedule import Schedule
from app.models.focus_room import (
    FocusRoom,
    FocusRoomParticipant,
    FocusSession,
    FocusRoomActivity,
    FocusRoomInvitation,
    FocusRoomPoke,
    UserFocusRoomStats,
    FocusRoomType,
    FocusRoomCategory,
    ParticipantStatus,
    FocusActivityType,
    InvitationStatus
)
from app.models.notification import (
    Notification,
    NotificationPreference,
    NotificationType,
    NotificationPriority,
    NotificationChannel
)
from app.models.group_message import GroupMessage, MessageReaction
from app.models.collaboration import (
    SharedGroupContent,
    GroupStudySession,
    GroupSessionParticipant,
    GroupActivity,
    StudyGroupStatus
)
from app.models.daily_quest import (
    DailyQuest,
    DailyQuestStreak,
    MysteryChest,
    QuestType,
    QuestDifficulty,
    QuestStatus
)
from app.models.leaderboard import (
    UserLeague,
    LeaderboardEntry,
    LeagueHistory,
    LeagueTier,
    LeaderboardPeriod,
    LeaderboardType,
    LEAGUE_CONFIG
)
from app.models.social_share import (
    SocialShare,
    ShareStats,
    ShareType,
    SharePlatform,
    SHARE_TEMPLATES,
    SHARE_BADGES
)
from app.models.exam_mode import (
    ExamSession,
    StudyDay,
    StudyTask,
    ExamModeNotification,
    ExamSessionStatus,
    StudyTaskType,
    StudyTaskStatus,
    DifficultyLevel,
    EXAM_MODE_XP_REWARDS,
    TASK_DURATION_ESTIMATES,
    SPACED_REPETITION_INTERVALS
)
from app.models.ai_task import (
    AITask,
    AITaskType,
    AITaskStatus
)
from app.models.spark import (
    SparkConversation,
    SparkMessage,
    SparkUserInsight,
    SparkNotification,
    SparkMemory,
    SparkDailyBriefing,
    ConversationStatus,
    MessageRole,
    SparkMoodType,
    InsightType
)

__all__ = [
    # User et sous-modèles
    "User",
    "UserRole",
    "SubscriptionType",
    "UserProfile",
    "UserPreferences",
    "UserSubscription",
    "UserGamification",
    "UserStats",
    "UserMascot",
    "UserAIUsage",
    "create_user_with_defaults",
    # Autres modèles
    "Note",
    "Subject",
    "Document",
    "DocumentType",
    "Flashcard",
    "FlashcardReview",
    "FlashcardStatus",
    "Quiz",
    "QuizAttempt",
    "QuizQuestion",
    "StudySession",
    "StudyGroup",
    "StudyGroupMembership",
    "Schedule",
    # Focus Rooms
    "FocusRoom",
    "FocusRoomParticipant",
    "FocusSession",
    "FocusRoomActivity",
    "FocusRoomInvitation",
    "FocusRoomPoke",
    "UserFocusRoomStats",
    "FocusRoomType",
    "FocusRoomCategory",
    "ParticipantStatus",
    "FocusActivityType",
    "InvitationStatus",
    # Notifications
    "Notification",
    "NotificationPreference",
    "NotificationType",
    "NotificationPriority",
    "NotificationChannel",
    # Group Messages
    "GroupMessage",
    "MessageReaction",
    # Collaboration
    "SharedGroupContent",
    "GroupStudySession",
    "GroupSessionParticipant",
    "GroupActivity",
    "StudyGroupStatus",
    # Daily Quests
    "DailyQuest",
    "DailyQuestStreak",
    "MysteryChest",
    "QuestType",
    "QuestDifficulty",
    "QuestStatus",
    # Leaderboards & Leagues
    "UserLeague",
    "LeaderboardEntry",
    "LeagueHistory",
    "LeagueTier",
    "LeaderboardPeriod",
    "LeaderboardType",
    "LEAGUE_CONFIG",
    # Social Share
    "SocialShare",
    "ShareStats",
    "ShareType",
    "SharePlatform",
    "SHARE_TEMPLATES",
    "SHARE_BADGES",
    # Exam Mode
    "ExamSession",
    "StudyDay",
    "StudyTask",
    "ExamModeNotification",
    "ExamSessionStatus",
    "StudyTaskType",
    "StudyTaskStatus",
    "DifficultyLevel",
    "EXAM_MODE_XP_REWARDS",
    "TASK_DURATION_ESTIMATES",
    "SPACED_REPETITION_INTERVALS",
    # AI Tasks
    "AITask",
    "AITaskType",
    "AITaskStatus",
    # Spark
    "SparkConversation",
    "SparkMessage",
    "SparkUserInsight",
    "SparkNotification",
    "SparkMemory",
    "SparkDailyBriefing",
    "ConversationStatus",
    "MessageRole",
    "SparkMoodType",
    "InsightType",
]
