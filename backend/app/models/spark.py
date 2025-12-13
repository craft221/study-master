"""
Modèles Spark - L'assistant IA intelligent ⚡🐿️

Spark est bien plus qu'une mascotte - c'est un compagnon d'apprentissage
qui connaît l'utilisateur, anticipe ses besoins, et l'accompagne avec
une personnalité attachante et sarcastique.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, JSON, Float, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class ConversationStatus(str, enum.Enum):
    """Statut d'une conversation avec Spark"""
    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"


class MessageRole(str, enum.Enum):
    """Rôle dans un message de conversation"""
    USER = "user"
    SPARK = "spark"
    SYSTEM = "system"


class SparkMoodType(str, enum.Enum):
    """Types d'humeur de Spark"""
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


class InsightType(str, enum.Enum):
    """Types d'insights générés par Spark"""
    STUDY_PATTERN = "study_pattern"
    WEAKNESS = "weakness"
    STRENGTH = "strength"
    RECOMMENDATION = "recommendation"
    WARNING = "warning"
    ACHIEVEMENT = "achievement"
    STREAK_RISK = "streak_risk"
    EXAM_PREP = "exam_prep"


class SparkConversation(Base):
    """
    Historique des conversations avec Spark
    Permet la continuité et la mémoire des échanges
    """
    __tablename__ = "spark_conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Métadonnées de conversation
    title = Column(String(200), nullable=True)  # Auto-généré à partir du premier message
    status = Column(String(20), default="active", nullable=False)

    # Contexte de la conversation
    context_type = Column(String(50), nullable=True)  # "general", "tutoring", "quiz_help", "note_help"
    context_data = Column(JSON, default=dict)  # Données contextuelles (subject_id, note_id, etc.)

    # Stats de conversation
    message_count = Column(Integer, default=0)
    last_message_at = Column(DateTime(timezone=True))

    # Résumé pour contexte long-term
    summary = Column(Text, nullable=True)  # Résumé IA de la conversation
    key_topics = Column(JSON, default=list)  # Sujets abordés

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relations
    messages = relationship("SparkMessage", back_populates="conversation", cascade="all, delete-orphan")
    user = relationship("User", backref="spark_conversations")

    def __repr__(self):
        return f"<SparkConversation id={self.id} messages={self.message_count}>"


class SparkMessage(Base):
    """
    Messages individuels dans une conversation Spark
    """
    __tablename__ = "spark_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("spark_conversations.id", ondelete="CASCADE"), nullable=False, index=True)

    # Contenu du message
    role = Column(String(20), nullable=False)  # 'user', 'spark', 'system'
    content = Column(Text, nullable=False)

    # Métadonnées Spark (pour les réponses de Spark)
    mood = Column(String(30), nullable=True)
    animation = Column(String(50), nullable=True)
    suggestions = Column(JSON, default=list)  # Actions suggérées

    # Contexte du message
    context_snapshot = Column(JSON, default=dict)  # État utilisateur au moment du message

    # Feedback utilisateur
    was_helpful = Column(Boolean, nullable=True)  # L'utilisateur a trouvé ça utile?

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relations
    conversation = relationship("SparkConversation", back_populates="messages")

    def __repr__(self):
        return f"<SparkMessage role={self.role} conv={self.conversation_id}>"


class SparkUserInsight(Base):
    """
    Insights et observations de Spark sur l'utilisateur
    Permet à Spark de "connaître" l'utilisateur et d'être proactif
    """
    __tablename__ = "spark_user_insights"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Type et contenu de l'insight
    insight_type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)

    # Données associées
    data = Column(JSON, default=dict)  # Données spécifiques à l'insight
    confidence = Column(Float, default=0.8)  # Niveau de confiance (0-1)
    priority = Column(Integer, default=5)  # 1-10, 10 = très important

    # Statut
    is_active = Column(Boolean, default=True)
    is_acknowledged = Column(Boolean, default=False)  # L'utilisateur a vu
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)

    # Validité temporelle
    valid_until = Column(DateTime(timezone=True), nullable=True)  # Expiration de l'insight

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relations
    user = relationship("User", backref="spark_insights")

    def __repr__(self):
        return f"<SparkUserInsight type={self.insight_type} user={self.user_id}>"


class SparkNotification(Base):
    """
    Notifications proactives de Spark
    Les messages que Spark envoie de sa propre initiative
    """
    __tablename__ = "spark_notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Type de notification
    notification_type = Column(String(50), nullable=False)  # "streak_warning", "exam_reminder", "encouragement", etc.

    # Contenu
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    mood = Column(String(30), default="happy")

    # Call to action
    action_type = Column(String(50), nullable=True)  # "open_flashcards", "start_quiz", etc.
    action_data = Column(JSON, default=dict)  # Données pour l'action

    # Statut
    is_read = Column(Boolean, default=False)
    is_dismissed = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True), nullable=True)

    # Planification
    scheduled_for = Column(DateTime(timezone=True), nullable=True)  # Si programmée pour plus tard
    sent_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relations
    user = relationship("User", backref="spark_notifications")

    def __repr__(self):
        return f"<SparkNotification type={self.notification_type} user={self.user_id}>"


class SparkMemory(Base):
    """
    Mémoire long-terme de Spark sur l'utilisateur
    Ce que Spark "retient" sur les préférences et l'historique
    """
    __tablename__ = "spark_memories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Type de mémoire
    memory_type = Column(String(50), nullable=False)  # "preference", "achievement", "struggle", "milestone"

    # Contenu
    key = Column(String(100), nullable=False)  # "favorite_subject", "best_study_time", etc.
    value = Column(JSON, nullable=False)  # Valeur associée

    # Métadonnées
    source = Column(String(50), nullable=True)  # D'où vient cette info
    confidence = Column(Float, default=0.8)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_used_at = Column(DateTime(timezone=True), nullable=True)  # Dernière fois utilisée

    # Relations
    user = relationship("User", backref="spark_memories")

    def __repr__(self):
        return f"<SparkMemory key={self.key} user={self.user_id}>"


class SparkDailyBriefing(Base):
    """
    Briefing quotidien généré par Spark
    Un résumé personnalisé pour commencer la journée
    """
    __tablename__ = "spark_daily_briefings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Date du briefing
    briefing_date = Column(DateTime(timezone=True), nullable=False)

    # Contenu du briefing
    greeting = Column(Text, nullable=False)  # Message d'accueil personnalisé

    # Sections du briefing
    streak_status = Column(JSON, default=dict)  # État du streak
    today_goals = Column(JSON, default=list)  # Objectifs suggérés
    pending_reviews = Column(JSON, default=dict)  # Révisions en attente
    upcoming_exams = Column(JSON, default=list)  # Examens à venir
    achievements_progress = Column(JSON, default=list)  # Progrès vers achievements
    fun_fact = Column(Text, nullable=True)  # Fait amusant du jour
    motivation_quote = Column(Text, nullable=True)  # Citation motivante

    # Personnalité du briefing
    mood = Column(String(30), default="happy")
    tone = Column(String(50), default="encouraging")  # "encouraging", "urgent", "playful", "serious"

    # Statut
    is_viewed = Column(Boolean, default=False)
    viewed_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relations
    user = relationship("User", backref="spark_briefings")

    def __repr__(self):
        return f"<SparkDailyBriefing date={self.briefing_date} user={self.user_id}>"
