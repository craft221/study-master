"""
Service de Partage Social
=========================

Gère:
- Génération de liens de partage
- Génération de cartes de stats
- Tracking des partages et conversions
- Badges de partage
"""

import logging
import secrets
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional
from urllib.parse import urlencode, quote

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utc_now
from app.core.config import settings
from app.core.spark_translations import get_spark_language
from app.models.user import User
from app.models.social_share import (
    SocialShare, ShareStats, ShareType, SharePlatform,
    SHARE_TEMPLATES, SHARE_BADGES
)
from app.models.leaderboard import UserLeague, LEAGUE_CONFIG

logger = logging.getLogger(__name__)


class SocialShareService:
    """Service pour gérer le partage social"""

    def __init__(self):
        self.base_url = getattr(settings, 'FRONTEND_URL', 'https://studymaster.app')
        self.app_name = "Study Master"

    # =========================================================================
    # GÉNÉRATION DE CONTENU DE PARTAGE
    # =========================================================================

    def generate_share_code(self, user_id: int, share_type: str) -> str:
        """Génère un code de partage unique"""
        timestamp = int(utc_now().timestamp())
        raw = f"{user_id}-{share_type}-{timestamp}-{secrets.token_hex(4)}"
        return hashlib.sha256(raw.encode()).hexdigest()[:12]

    def get_share_message(
        self,
        share_type: ShareType,
        lang: str,
        **kwargs
    ) -> str:
        """Génère le message de partage selon le type et la langue"""
        lang = get_spark_language(lang)
        templates = SHARE_TEMPLATES.get(share_type, {})
        template = templates.get(lang, templates.get("fr", ""))

        try:
            return template.format(**kwargs)
        except KeyError:
            return template

    def get_share_url(self, share_code: str) -> str:
        """Génère l'URL de partage avec tracking"""
        return f"{self.base_url}/share/{share_code}"

    def generate_platform_share_url(
        self,
        platform: SharePlatform,
        message: str,
        url: str
    ) -> str:
        """Génère l'URL de partage pour une plateforme spécifique"""
        encoded_message = quote(message)
        encoded_url = quote(url)

        if platform == SharePlatform.WHATSAPP:
            return f"https://wa.me/?text={encoded_message}%20{encoded_url}"

        elif platform == SharePlatform.TWITTER:
            return f"https://twitter.com/intent/tweet?text={encoded_message}&url={encoded_url}"

        elif platform == SharePlatform.FACEBOOK:
            return f"https://www.facebook.com/sharer/sharer.php?u={encoded_url}&quote={encoded_message}"

        elif platform == SharePlatform.LINKEDIN:
            return f"https://www.linkedin.com/sharing/share-offsite/?url={encoded_url}"

        elif platform == SharePlatform.TELEGRAM:
            return f"https://t.me/share/url?url={encoded_url}&text={encoded_message}"

        else:
            return url

    # =========================================================================
    # CRÉATION DE PARTAGES
    # =========================================================================

    async def create_share(
        self,
        db: AsyncSession,
        user_id: int,
        share_type: ShareType,
        platform: SharePlatform,
        content_data: Optional[Dict[str, Any]] = None,
        lang: str = "fr"
    ) -> Dict[str, Any]:
        """Crée un nouveau partage et retourne les infos nécessaires"""

        # Générer le code de partage
        share_code = self.generate_share_code(user_id, share_type.value)
        share_url = self.get_share_url(share_code)

        # Générer le message
        kwargs = content_data or {}
        message = self.get_share_message(share_type, lang, **kwargs)

        # URL de partage pour la plateforme
        platform_url = self.generate_platform_share_url(platform, message, share_url)

        # Créer l'enregistrement
        share = SocialShare(
            user_id=user_id,
            share_type=share_type,
            platform=platform,
            content_data=content_data,
            share_url=share_url,
            share_code=share_code
        )
        db.add(share)

        # Mettre à jour les stats
        await self._update_share_stats(db, user_id, platform)

        await db.flush()

        return {
            "share_id": share.id,
            "share_code": share_code,
            "share_url": share_url,
            "platform_url": platform_url,
            "message": message,
            "platform": platform.value,
            "share_type": share_type.value
        }

    async def _update_share_stats(
        self,
        db: AsyncSession,
        user_id: int,
        platform: SharePlatform
    ) -> ShareStats:
        """Met à jour les statistiques de partage"""
        query = select(ShareStats).where(ShareStats.user_id == user_id)
        result = await db.execute(query)
        stats = result.scalar_one_or_none()

        now = utc_now()

        if not stats:
            stats = ShareStats(
                user_id=user_id,
                first_share_at=now
            )
            db.add(stats)

        # Incrémenter le compteur de la plateforme
        platform_field = f"{platform.value}_shares" if platform.value != "copy_link" else "other_shares"
        if hasattr(stats, platform_field):
            setattr(stats, platform_field, getattr(stats, platform_field) + 1)
        else:
            stats.other_shares += 1

        stats.total_shares += 1
        stats.last_share_at = now

        # Vérifier les badges
        await self._check_share_badges(db, stats)

        await db.flush()
        return stats

    async def _check_share_badges(self, db: AsyncSession, stats: ShareStats) -> List[str]:
        """Vérifie et débloque les badges de partage + ajoute XP"""
        from sqlalchemy.orm import selectinload
        from app.models.gamification import UserGamification

        new_badges = []
        current_badges = stats.share_badges or []
        total_xp_to_add = 0

        for badge_id, badge_config in SHARE_BADGES.items():
            if badge_id in current_badges:
                continue

            requirement = badge_config["requirement"]
            unlocked = False

            if "total_shares" in requirement:
                unlocked = stats.total_shares >= requirement["total_shares"]
            elif "total_clicks" in requirement:
                unlocked = stats.total_clicks >= requirement["total_clicks"]
            elif "total_conversions" in requirement:
                unlocked = stats.total_conversions >= requirement["total_conversions"]
            elif "platforms" in requirement:
                # Compter les plateformes utilisées
                platforms_used = sum(1 for p in [
                    stats.whatsapp_shares, stats.twitter_shares,
                    stats.facebook_shares, stats.instagram_shares,
                    stats.linkedin_shares, stats.telegram_shares
                ] if p > 0)
                unlocked = platforms_used >= requirement["platforms"]

            if unlocked:
                new_badges.append(badge_id)
                total_xp_to_add += badge_config.get("xp_reward", 0)

        if new_badges:
            stats.share_badges = current_badges + new_badges

            # Ajouter les XP gagnés via gamification
            if total_xp_to_add > 0:
                user_query = select(User).options(
                    selectinload(User.gamification)
                ).where(User.id == stats.user_id)
                result = await db.execute(user_query)
                user = result.scalar_one_or_none()

                if user:
                    if user.gamification:
                        user.gamification.total_xp = (user.gamification.total_xp or 0) + total_xp_to_add
                    else:
                        user.gamification = UserGamification(user_id=stats.user_id, total_xp=total_xp_to_add)
                        db.add(user.gamification)

                    logger.info(f"Added {total_xp_to_add} XP to user {stats.user_id} for share badges: {new_badges}")

        return new_badges

    # =========================================================================
    # TRACKING
    # =========================================================================

    async def track_click(self, db: AsyncSession, share_code: str) -> bool:
        """Enregistre un clic sur un lien de partage"""
        query = select(SocialShare).where(SocialShare.share_code == share_code)
        result = await db.execute(query)
        share = result.scalar_one_or_none()

        if not share:
            return False

        share.clicks += 1

        # Mettre à jour les stats de l'utilisateur
        stats_query = select(ShareStats).where(ShareStats.user_id == share.user_id)
        stats_result = await db.execute(stats_query)
        stats = stats_result.scalar_one_or_none()

        if stats:
            stats.total_clicks += 1
            await self._check_share_badges(db, stats)

        await db.flush()
        return True

    async def track_conversion(
        self,
        db: AsyncSession,
        share_code: str,
        new_user_id: int
    ) -> bool:
        """Enregistre une conversion (inscription via partage)"""
        query = select(SocialShare).where(SocialShare.share_code == share_code)
        result = await db.execute(query)
        share = result.scalar_one_or_none()

        if not share:
            return False

        share.conversions += 1

        # Mettre à jour les stats
        stats_query = select(ShareStats).where(ShareStats.user_id == share.user_id)
        stats_result = await db.execute(stats_query)
        stats = stats_result.scalar_one_or_none()

        if stats:
            stats.total_conversions += 1
            await self._check_share_badges(db, stats)

        await db.flush()
        return True

    # =========================================================================
    # GÉNÉRATION DE CONTENU SPÉCIFIQUE
    # =========================================================================

    async def generate_streak_share(
        self,
        db: AsyncSession,
        user_id: int,
        platform: SharePlatform,
        lang: str = "fr"
    ) -> Dict[str, Any]:
        """Génère un partage de milestone de streak"""
        user_query = select(User).where(User.id == user_id)
        result = await db.execute(user_query)
        user = result.scalar_one_or_none()

        if not user:
            return {"error": "User not found"}

        return await self.create_share(
            db=db,
            user_id=user_id,
            share_type=ShareType.STREAK_MILESTONE,
            platform=platform,
            content_data={"streak": user.current_streak},
            lang=lang
        )

    async def generate_quiz_share(
        self,
        db: AsyncSession,
        user_id: int,
        platform: SharePlatform,
        score: int,
        topic: str,
        lang: str = "fr"
    ) -> Dict[str, Any]:
        """Génère un partage de score de quiz"""
        return await self.create_share(
            db=db,
            user_id=user_id,
            share_type=ShareType.QUIZ_SCORE,
            platform=platform,
            content_data={"score": score, "topic": topic},
            lang=lang
        )

    async def generate_level_share(
        self,
        db: AsyncSession,
        user_id: int,
        platform: SharePlatform,
        level: int,
        lang: str = "fr"
    ) -> Dict[str, Any]:
        """Génère un partage de level up"""
        return await self.create_share(
            db=db,
            user_id=user_id,
            share_type=ShareType.LEVEL_UP,
            platform=platform,
            content_data={"level": level},
            lang=lang
        )

    async def generate_league_share(
        self,
        db: AsyncSession,
        user_id: int,
        platform: SharePlatform,
        lang: str = "fr"
    ) -> Dict[str, Any]:
        """Génère un partage de promotion de ligue"""
        league_query = select(UserLeague).where(UserLeague.user_id == user_id)
        result = await db.execute(league_query)
        user_league = result.scalar_one_or_none()

        if not user_league:
            return {"error": "User not in a league"}

        league_name = LEAGUE_CONFIG[user_league.current_tier]["name"]

        return await self.create_share(
            db=db,
            user_id=user_id,
            share_type=ShareType.LEAGUE_PROMOTION,
            platform=platform,
            content_data={"league": league_name},
            lang=lang
        )

    async def generate_weekly_stats_share(
        self,
        db: AsyncSession,
        user_id: int,
        platform: SharePlatform,
        lang: str = "fr"
    ) -> Dict[str, Any]:
        """Génère un partage des stats de la semaine"""
        user_query = select(User).where(User.id == user_id)
        result = await db.execute(user_query)
        user = result.scalar_one_or_none()

        if not user:
            return {"error": "User not found"}

        # Récupérer les XP hebdomadaires
        league_query = select(UserLeague).where(UserLeague.user_id == user_id)
        league_result = await db.execute(league_query)
        user_league = league_result.scalar_one_or_none()
        weekly_xp = user_league.weekly_xp if user_league else 0

        return await self.create_share(
            db=db,
            user_id=user_id,
            share_type=ShareType.WEEKLY_STATS,
            platform=platform,
            content_data={
                "xp": weekly_xp,
                "streak": user.current_streak,
                "quizzes": user.quizzes_completed
            },
            lang=lang
        )

    # =========================================================================
    # RÉCUPÉRATION
    # =========================================================================

    async def get_user_share_stats(
        self,
        db: AsyncSession,
        user_id: int
    ) -> Dict[str, Any]:
        """Récupère les statistiques de partage d'un utilisateur"""
        query = select(ShareStats).where(ShareStats.user_id == user_id)
        result = await db.execute(query)
        stats = result.scalar_one_or_none()

        if not stats:
            return {
                "total_shares": 0,
                "total_clicks": 0,
                "total_conversions": 0,
                "badges": [],
                "platforms": {}
            }

        # Préparer les badges avec leurs détails
        badges_details = []
        for badge_id in (stats.share_badges or []):
            if badge_id in SHARE_BADGES:
                badge = SHARE_BADGES[badge_id]
                badges_details.append({
                    "id": badge_id,
                    "name": badge["name"],
                    "description": badge["description"],
                    "icon": badge["icon"],
                    "xp_reward": badge["xp_reward"]
                })

        return {
            "total_shares": stats.total_shares,
            "total_clicks": stats.total_clicks,
            "total_conversions": stats.total_conversions,
            "badges": badges_details,
            "platforms": {
                "whatsapp": stats.whatsapp_shares,
                "twitter": stats.twitter_shares,
                "facebook": stats.facebook_shares,
                "instagram": stats.instagram_shares,
                "linkedin": stats.linkedin_shares,
                "telegram": stats.telegram_shares,
                "other": stats.other_shares,
            },
            "first_share_at": stats.first_share_at.isoformat() if stats.first_share_at else None,
            "last_share_at": stats.last_share_at.isoformat() if stats.last_share_at else None,
        }


# Instance globale
social_share_service = SocialShareService()
