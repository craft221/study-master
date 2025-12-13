"""
Modèles pour le Partage Social
==============================

Système de partage avec:
- Cartes de stats partageables
- Tracking des partages
- Badges de partage
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SQLEnum, Boolean, Text, JSON, Index
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.datetime_utils import utc_now


class SharePlatform(str, Enum):
    """Plateformes de partage"""
    WHATSAPP = "whatsapp"
    TWITTER = "twitter"
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"
    LINKEDIN = "linkedin"
    TELEGRAM = "telegram"
    COPY_LINK = "copy_link"
    OTHER = "other"


class ShareType(str, Enum):
    """Types de contenu partagé"""
    STREAK_MILESTONE = "streak_milestone"      # "J'ai atteint 30 jours de série!"
    QUIZ_SCORE = "quiz_score"                  # "J'ai eu 95% à mon quiz!"
    LEVEL_UP = "level_up"                      # "Je suis passé niveau 10!"
    ACHIEVEMENT = "achievement"                # "J'ai débloqué le badge X!"
    LEAGUE_PROMOTION = "league_promotion"      # "Je suis passé en ligue Or!"
    WEEKLY_STATS = "weekly_stats"              # Stats de la semaine
    PROFILE = "profile"                        # Profil général
    CHALLENGE_WIN = "challenge_win"            # Victoire d'un défi
    STUDY_SESSION = "study_session"            # Session d'étude terminée


# Templates de messages par type et langue
SHARE_TEMPLATES = {
    ShareType.STREAK_MILESTONE: {
        "fr": "🔥 J'ai atteint {streak} jours de série sur Study Master ! Rejoins-moi et améliore tes études !",
        "en": "🔥 I reached a {streak}-day streak on Study Master! Join me and improve your studies!",
        "es": "🔥 ¡Alcancé una racha de {streak} días en Study Master! ¡Únete y mejora tus estudios!",
        "pt": "🔥 Alcancei uma sequência de {streak} dias no Study Master! Junte-se a mim e melhore seus estudos!",
    },
    ShareType.QUIZ_SCORE: {
        "fr": "📚 J'ai obtenu {score}% à mon quiz sur {topic} ! Tu peux faire mieux ? 😏",
        "en": "📚 I scored {score}% on my {topic} quiz! Can you beat that? 😏",
        "es": "📚 ¡Obtuve {score}% en mi quiz de {topic}! ¿Puedes hacerlo mejor? 😏",
        "pt": "📚 Tirei {score}% no meu quiz de {topic}! Você consegue fazer melhor? 😏",
    },
    ShareType.LEVEL_UP: {
        "fr": "⚡ Je suis passé niveau {level} sur Study Master ! Mon écureuil Spark est fier de moi 🐿️",
        "en": "⚡ I reached level {level} on Study Master! My squirrel Spark is proud of me 🐿️",
        "es": "⚡ ¡Subí al nivel {level} en Study Master! Mi ardilla Spark está orgullosa de mí 🐿️",
        "pt": "⚡ Cheguei ao nível {level} no Study Master! Meu esquilo Spark está orgulhoso de mim 🐿️",
    },
    ShareType.LEAGUE_PROMOTION: {
        "fr": "🏆 Je suis monté en ligue {league} sur Study Master ! La compétition est lancée !",
        "en": "🏆 I got promoted to {league} league on Study Master! The competition is on!",
        "es": "🏆 ¡Subí a la liga {league} en Study Master! ¡La competencia comenzó!",
        "pt": "🏆 Fui promovido para a liga {league} no Study Master! A competição começou!",
    },
    ShareType.WEEKLY_STATS: {
        "fr": "📊 Ma semaine sur Study Master:\n• {xp} XP gagnés\n• {streak} jours de série\n• {quizzes} quiz complétés\nEt toi ?",
        "en": "📊 My week on Study Master:\n• {xp} XP earned\n• {streak} day streak\n• {quizzes} quizzes completed\nHow about you?",
        "es": "📊 Mi semana en Study Master:\n• {xp} XP ganados\n• {streak} días de racha\n• {quizzes} quizzes completados\n¿Y tú?",
        "pt": "📊 Minha semana no Study Master:\n• {xp} XP ganhos\n• {streak} dias de sequência\n• {quizzes} quizzes completados\nE você?",
    },
    ShareType.ACHIEVEMENT: {
        "fr": "🎖️ J'ai débloqué le badge '{badge}' sur Study Master ! 🏅",
        "en": "🎖️ I unlocked the '{badge}' badge on Study Master! 🏅",
        "es": "🎖️ ¡Desbloqueé la insignia '{badge}' en Study Master! 🏅",
        "pt": "🎖️ Desbloqueei a medalha '{badge}' no Study Master! 🏅",
    },
}


class SocialShare(Base):
    """Enregistrement d'un partage social"""
    __tablename__ = "social_shares"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Type et plateforme
    share_type = Column(SQLEnum(ShareType), nullable=False)
    platform = Column(SQLEnum(SharePlatform), nullable=False)

    # Contenu partagé
    content_data = Column(JSON, nullable=True)  # Données spécifiques au type
    share_url = Column(String(500), nullable=True)
    share_image_url = Column(String(500), nullable=True)

    # Tracking
    share_code = Column(String(50), unique=True, nullable=False)  # Code unique pour tracking
    clicks = Column(Integer, default=0, nullable=False)
    conversions = Column(Integer, default=0, nullable=False)  # Inscriptions via ce partage

    # Timestamps
    shared_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relations
    user = relationship("User", back_populates="social_shares")

    __table_args__ = (
        Index("ix_social_shares_user_type", "user_id", "share_type"),
        Index("ix_social_shares_code", "share_code"),
    )


class ShareStats(Base):
    """Statistiques de partage agrégées par utilisateur"""
    __tablename__ = "share_stats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    # Compteurs par plateforme
    whatsapp_shares = Column(Integer, default=0, nullable=False)
    twitter_shares = Column(Integer, default=0, nullable=False)
    facebook_shares = Column(Integer, default=0, nullable=False)
    instagram_shares = Column(Integer, default=0, nullable=False)
    linkedin_shares = Column(Integer, default=0, nullable=False)
    telegram_shares = Column(Integer, default=0, nullable=False)
    other_shares = Column(Integer, default=0, nullable=False)

    # Totaux
    total_shares = Column(Integer, default=0, nullable=False)
    total_clicks = Column(Integer, default=0, nullable=False)
    total_conversions = Column(Integer, default=0, nullable=False)

    # Badges de partage
    share_badges = Column(JSON, default=list, nullable=False)  # Liste des badges débloqués

    # Timestamps
    first_share_at = Column(DateTime(timezone=True), nullable=True)
    last_share_at = Column(DateTime(timezone=True), nullable=True)

    # Relations
    user = relationship("User", back_populates="share_stats")


# Configuration des badges de partage
SHARE_BADGES = {
    "first_share": {
        "name": {"fr": "Premier Partage", "en": "First Share"},
        "description": {"fr": "Partager pour la première fois", "en": "Share for the first time"},
        "icon": "📤",
        "requirement": {"total_shares": 1},
        "xp_reward": 50,
    },
    "social_butterfly": {
        "name": {"fr": "Papillon Social", "en": "Social Butterfly"},
        "description": {"fr": "Partager sur 3 plateformes différentes", "en": "Share on 3 different platforms"},
        "icon": "🦋",
        "requirement": {"platforms": 3},
        "xp_reward": 100,
    },
    "viral_star": {
        "name": {"fr": "Star Virale", "en": "Viral Star"},
        "description": {"fr": "Obtenir 10 clics sur vos partages", "en": "Get 10 clicks on your shares"},
        "icon": "⭐",
        "requirement": {"total_clicks": 10},
        "xp_reward": 150,
    },
    "influencer": {
        "name": {"fr": "Influenceur", "en": "Influencer"},
        "description": {"fr": "Amener 5 personnes à s'inscrire", "en": "Get 5 people to sign up"},
        "icon": "🎤",
        "requirement": {"total_conversions": 5},
        "xp_reward": 500,
    },
    "share_master": {
        "name": {"fr": "Maître du Partage", "en": "Share Master"},
        "description": {"fr": "Partager 50 fois", "en": "Share 50 times"},
        "icon": "👑",
        "requirement": {"total_shares": 50},
        "xp_reward": 300,
    },
}
