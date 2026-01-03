"""
Schémas Pydantic pour Spark ⚡🐿️

Définit tous les modèles de requête/réponse pour:
- Messages contextuels
- Conversations persistantes
- Mode tuteur
- Briefings quotidiens
- Notifications
- Insights utilisateur
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# =============================================================================
# ENUMS
# =============================================================================

class SparkMood(str, Enum):
    HAPPY = "happy"
    EXCITED = "excited"
    SAD = "sad"
    THINKING = "thinking"
    ENCOURAGING = "encouraging"
    SLEEPING = "sleeping"
    SARCASTIC = "sarcastic"
    PROUD = "proud"
    WORRIED = "worried"
    PLAYFUL = "playful"


class SparkAnimation(str, Enum):
    IDLE = "idle"
    WAVE = "wave"
    CELEBRATION = "celebration"
    JUMP = "jump"
    SLEEP = "sleep"
    THINK = "think"
    PAT = "pat"
    COLLECT = "collect"
    READ = "read"
    SHOWCASE = "showcase"
    EVOLUTION = "evolution"
    EXPLAIN = "explain"


class InsightType(str, Enum):
    STUDY_PATTERN = "study_pattern"
    WEAKNESS = "weakness"
    STRENGTH = "strength"
    RECOMMENDATION = "recommendation"
    WARNING = "warning"
    ACHIEVEMENT = "achievement"
    STREAK_RISK = "streak_risk"
    EXAM_PREP = "exam_prep"


class NotificationType(str, Enum):
    STREAK_WARNING = "streak_warning"
    STREAK_LOST = "streak_lost"
    EXAM_REMINDER = "exam_reminder"
    COMEBACK = "comeback"
    MILESTONE = "milestone"
    DAILY_REMINDER = "daily_reminder"
    ENCOURAGEMENT = "encouragement"


# =============================================================================
# MESSAGES CONTEXTUELS
# =============================================================================

class SparkMessageRequest(BaseModel):
    """Requête pour obtenir un message de Spark"""
    event: str = Field(
        ...,
        description="Type d'événement (welcome, quiz_success, streak_warning, etc.)"
    )
    context: Optional[Dict[str, Any]] = Field(
        default={},
        description="Contexte additionnel (score, topic, days, etc.)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "event": "quiz_success",
                "context": {"score": 85, "topic": "Mathématiques"}
            }
        }


class SparkMessageResponse(BaseModel):
    """Réponse avec message de Spark"""
    message: str
    mood: SparkMood
    animation: SparkAnimation
    timestamp: str

    class Config:
        json_schema_extra = {
            "example": {
                "message": "ATTENDS QUOI ?! 85% ?! Tu gères TROP ! 🔥",
                "mood": "excited",
                "animation": "celebration",
                "timestamp": "2024-01-15T10:30:00Z"
            }
        }


# =============================================================================
# CONVERSATIONS
# =============================================================================

class SparkChatRequest(BaseModel):
    """Requête pour chatter avec Spark"""
    message: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Message de l'utilisateur"
    )
    conversation_id: Optional[int] = Field(
        None,
        description="ID de conversation existante (optionnel)"
    )
    context: Optional[Dict[str, Any]] = Field(
        default={},
        description="Contexte additionnel (page actuelle, sujet en cours, etc.)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Hey Spark ! Je comprends pas les intégrales...",
                "conversation_id": None,
                "context": {"current_page": "notes"}
            }
        }


class SparkChatResponse(BaseModel):
    """Réponse de Spark dans une conversation"""
    response: str
    mood: SparkMood
    animation: SparkAnimation
    conversation_id: int
    suggestions: List[str] = Field(default=[])
    timestamp: str
    # Quotas hybrides
    quota_remaining: Optional[int] = Field(None, description="Requêtes restantes aujourd'hui (-1 = illimité)")
    quota_max: Optional[int] = Field(None, description="Maximum de requêtes par jour (-1 = illimité)")

    class Config:
        json_schema_extra = {
            "example": {
                "response": "Les intégrales ! Mon sujet préféré (non). 😏 OK, dis-moi d'abord: tu sais ce qu'est une dérivée ? C'est important pour comprendre...",
                "mood": "thinking",
                "animation": "think",
                "conversation_id": 42,
                "suggestions": ["Expliquer les dérivées", "Voir un exemple", "Créer des exercices"],
                "timestamp": "2024-01-15T10:30:00Z",
                "quota_remaining": 8,
                "quota_max": 10
            }
        }


class ConversationSummary(BaseModel):
    """Résumé d'une conversation"""
    id: int
    title: str
    context_type: str
    message_count: int
    last_message_at: Optional[str]
    created_at: str


class ConversationListResponse(BaseModel):
    """Liste des conversations"""
    conversations: List[ConversationSummary]
    total: int


class ConversationMessage(BaseModel):
    """Message dans une conversation"""
    id: int
    role: str  # "user" ou "spark"
    content: str
    mood: Optional[SparkMood] = None
    animation: Optional[SparkAnimation] = None
    created_at: str


class ConversationDetailResponse(BaseModel):
    """Détails d'une conversation avec messages"""
    id: int
    title: str
    context_type: str
    message_count: int
    messages: List[ConversationMessage]
    created_at: str
    updated_at: str


# =============================================================================
# MODE TUTEUR
# =============================================================================

class TutorExplainRequest(BaseModel):
    """Requête pour une explication en mode tuteur"""
    concept: str = Field(
        ...,
        min_length=2,
        max_length=500,
        description="Concept à expliquer"
    )
    subject: Optional[str] = Field(
        None,
        description="Matière concernée"
    )
    difficulty: str = Field(
        default="medium",
        pattern="^(easy|medium|hard)$",
        description="Niveau de difficulté souhaité"
    )
    conversation_id: Optional[int] = Field(
        None,
        description="ID de conversation pour contexte"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "concept": "la photosynthèse",
                "subject": "Biologie",
                "difficulty": "medium"
            }
        }


class TutorExplainResponse(BaseModel):
    """Réponse du mode tuteur"""
    explanation: str
    mood: SparkMood
    animation: SparkAnimation
    suggestions: List[str]
    timestamp: str
    # Quotas hybrides
    quota_remaining: Optional[int] = Field(None, description="Requêtes restantes aujourd'hui (-1 = illimité)")
    quota_max: Optional[int] = Field(None, description="Maximum de requêtes par jour (-1 = illimité)")


class TutorHintRequest(BaseModel):
    """Requête pour un indice"""
    question: str = Field(..., description="La question")
    answer: str = Field(..., description="La réponse correcte (ne sera pas révélée)")
    user_attempt: Optional[str] = Field(None, description="Tentative de l'utilisateur")
    hint_level: int = Field(
        default=1,
        ge=1,
        le=3,
        description="Niveau d'indice (1=vague, 3=précis)"
    )


class TutorHintResponse(BaseModel):
    """Réponse avec indice"""
    hint: str
    level: int
    mood: SparkMood
    animation: SparkAnimation
    # Quotas hybrides
    quota_remaining: Optional[int] = Field(None, description="Requêtes restantes aujourd'hui (-1 = illimité)")
    quota_max: Optional[int] = Field(None, description="Maximum de requêtes par jour (-1 = illimité)")


# =============================================================================
# BRIEFING QUOTIDIEN
# =============================================================================

class StreakStatus(BaseModel):
    """Statut du streak"""
    current: int
    longest: int
    risk: str  # "low", "medium", "high", "critical"
    message: str


class DailyGoal(BaseModel):
    """Objectif quotidien"""
    type: str
    title: str
    target: int
    unit: str
    priority: int
    description: Optional[str] = None


class UpcomingExam(BaseModel):
    """Examen à venir"""
    title: str
    date: str
    days_until: int
    urgency: str  # "normal", "high", "critical"


class DailyBriefingResponse(BaseModel):
    """Briefing quotidien de Spark"""
    id: int
    greeting: str
    mood: SparkMood
    tone: str

    streak_status: StreakStatus
    today_goals: List[DailyGoal]
    pending_reviews: Dict[str, Any]
    upcoming_exams: List[UpcomingExam]
    fun_fact: Optional[str]
    motivation_quote: Optional[str]

    is_viewed: bool
    created_at: str


# =============================================================================
# NOTIFICATIONS
# =============================================================================

class SparkNotificationResponse(BaseModel):
    """Notification de Spark"""
    id: int
    notification_type: NotificationType
    title: str
    message: str
    mood: SparkMood

    action_type: Optional[str]
    action_data: Optional[Dict[str, Any]]

    is_read: bool
    created_at: str


class NotificationListResponse(BaseModel):
    """Liste des notifications"""
    notifications: List[SparkNotificationResponse]
    unread_count: int
    total: int


class MarkNotificationReadRequest(BaseModel):
    """Marquer une notification comme lue"""
    notification_ids: List[int]


# =============================================================================
# INSIGHTS
# =============================================================================

class SparkInsightResponse(BaseModel):
    """Insight généré par Spark"""
    id: int
    insight_type: InsightType
    title: str
    description: str
    data: Dict[str, Any]
    confidence: float
    priority: int

    is_acknowledged: bool
    valid_until: Optional[str]
    created_at: str


class InsightListResponse(BaseModel):
    """Liste des insights"""
    insights: List[SparkInsightResponse]
    total: int


class UserAnalysisResponse(BaseModel):
    """Analyse complète de l'utilisateur par Spark"""
    study_times: Dict[str, Any]
    strengths: List[Dict[str, Any]]
    weaknesses: List[Dict[str, Any]]
    streak_health: Dict[str, Any]
    upcoming_needs: Dict[str, Any]
    engagement_level: Dict[str, Any]
    learning_velocity: Dict[str, Any]


# =============================================================================
# ÉTAT DE SPARK
# =============================================================================

class SparkStateResponse(BaseModel):
    """État complet de Spark"""
    name: str
    level: int
    level_name: str
    unlocked_accessories: List[str]
    current_accessory: Optional[str]
    total_accessories: int
    user_xp: int
    user_level: int = Field(description="Niveau de l'utilisateur (calculé dynamiquement)")
    user_streak: int
    happiness: int = Field(default=100, description="Niveau de bonheur de Spark (0-100)")


class SparkAccessoryInfo(BaseModel):
    """Information sur un accessoire"""
    id: str
    name: str
    description: str
    emoji: str
    requirement: str
    rarity: str  # "common", "rare", "epic", "legendary", "mythic"
    is_unlocked: bool


class SparkAccessoriesResponse(BaseModel):
    """Liste des accessoires"""
    accessories: List[SparkAccessoryInfo]
    unlocked_count: int
    total_count: int
    newly_unlocked: List[str] = Field(default=[])


class UpdateSparkRequest(BaseModel):
    """Mettre à jour Spark"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    current_accessory: Optional[str] = None


# =============================================================================
# MÉMOIRE
# =============================================================================

class SparkMemoryResponse(BaseModel):
    """Mémoire de Spark sur l'utilisateur"""
    id: int
    memory_type: str
    key: str
    value: Any
    source: Optional[str]
    created_at: str
    updated_at: str


class SparkMemoriesResponse(BaseModel):
    """Toutes les mémoires de Spark"""
    memories: List[SparkMemoryResponse]
    total: int


# =============================================================================
# INTERACTION
# =============================================================================

class SparkInteractionResponse(BaseModel):
    """Réponse à une interaction avec Spark"""
    message: str
    mood: SparkMood
    animation: SparkAnimation
    happiness: int
    interaction_count: int


# =============================================================================
# DEMANDE D'AIDE (Q&A)
# =============================================================================

class SparkAskRequest(BaseModel):
    """Poser une question à Spark"""
    question: str = Field(
        ...,
        min_length=3,
        max_length=500,
        description="Question de l'utilisateur"
    )
    context: Optional[Dict[str, Any]] = Field(
        default={},
        description="Contexte additionnel"
    )


class SparkAskResponse(BaseModel):
    """Réponse de Spark à une question"""
    answer: str
    mood: SparkMood
    animation: SparkAnimation
    suggestions: List[str] = Field(default=[])
    timestamp: str
    # Quotas hybrides
    quota_remaining: Optional[int] = Field(None, description="Requêtes restantes aujourd'hui (-1 = illimité)")
    quota_max: Optional[int] = Field(None, description="Maximum de requêtes par jour (-1 = illimité)")
