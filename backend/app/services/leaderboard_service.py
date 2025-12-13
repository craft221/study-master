"""
Service de Classements et Ligues
================================

Gère:
- Classements hebdomadaires/mensuels
- Système de ligues avec promotions/rétrogradations
- Calcul des rangs
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from zoneinfo import ZoneInfo

from sqlalchemy import select, func, and_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.datetime_utils import utc_now
from app.models.user import User
from app.models.leaderboard import (
    UserLeague, LeaderboardEntry, LeagueHistory,
    LeagueTier, LeaderboardPeriod, LeaderboardType,
    LEAGUE_CONFIG
)

logger = logging.getLogger(__name__)


class LeaderboardService:
    """Service pour gérer les classements et ligues"""

    def __init__(self):
        self.league_size = 30  # Nombre d'utilisateurs par groupe de ligue

    # =========================================================================
    # GESTION DES LIGUES
    # =========================================================================

    async def get_or_create_user_league(
        self,
        db: AsyncSession,
        user_id: int
    ) -> UserLeague:
        """Récupère ou crée la ligue d'un utilisateur"""
        query = select(UserLeague).where(UserLeague.user_id == user_id)
        result = await db.execute(query)
        user_league = result.scalar_one_or_none()

        if not user_league:
            user_league = UserLeague(
                user_id=user_id,
                current_tier=LeagueTier.BRONZE,
                weekly_xp=0,
                highest_tier_reached=LeagueTier.BRONZE
            )
            db.add(user_league)
            await db.flush()

        return user_league

    async def add_weekly_xp(
        self,
        db: AsyncSession,
        user_id: int,
        xp_amount: int
    ) -> UserLeague:
        """Ajoute des XP hebdomadaires à un utilisateur"""
        user_league = await self.get_or_create_user_league(db, user_id)
        user_league.weekly_xp += xp_amount
        await db.flush()
        return user_league

    async def get_league_leaderboard(
        self,
        db: AsyncSession,
        tier: LeagueTier,
        limit: int = 30
    ) -> List[Dict[str, Any]]:
        """Récupère le classement d'une ligue"""
        query = (
            select(UserLeague, User)
            .join(User, UserLeague.user_id == User.id)
            .where(UserLeague.current_tier == tier)
            .order_by(desc(UserLeague.weekly_xp))
            .limit(limit)
        )

        result = await db.execute(query)
        rows = result.all()

        leaderboard = []
        for rank, (user_league, user) in enumerate(rows, 1):
            leaderboard.append({
                "rank": rank,
                "user_id": user.id,
                "username": user.username,
                "avatar_url": user.avatar_url,
                "weekly_xp": user_league.weekly_xp,
                "level": user.level,
                "current_streak": user.current_streak,
                "is_promotion_zone": rank <= LEAGUE_CONFIG[tier]["promotion_slots"],
                "is_demotion_zone": rank > (limit - LEAGUE_CONFIG[tier]["demotion_slots"]) if tier != LeagueTier.BRONZE else False,
            })

        return leaderboard

    async def get_user_league_position(
        self,
        db: AsyncSession,
        user_id: int
    ) -> Dict[str, Any]:
        """Récupère la position d'un utilisateur dans sa ligue"""
        user_league = await self.get_or_create_user_league(db, user_id)

        # Compter combien d'utilisateurs ont plus d'XP dans la même ligue
        rank_query = select(func.count()).select_from(UserLeague).where(
            and_(
                UserLeague.current_tier == user_league.current_tier,
                UserLeague.weekly_xp > user_league.weekly_xp
            )
        )
        result = await db.execute(rank_query)
        users_above = result.scalar() or 0
        rank = users_above + 1

        # Compter le total d'utilisateurs dans la ligue
        total_query = select(func.count()).select_from(UserLeague).where(
            UserLeague.current_tier == user_league.current_tier
        )
        total_result = await db.execute(total_query)
        total_in_league = total_result.scalar() or 0

        tier_config = LEAGUE_CONFIG[user_league.current_tier]

        return {
            "user_id": user_id,
            "tier": user_league.current_tier.value,
            "tier_name": tier_config["name"],
            "tier_icon": tier_config["icon"],
            "tier_color": tier_config["color"],
            "weekly_xp": user_league.weekly_xp,
            "rank": rank,
            "total_in_league": total_in_league,
            "is_promotion_zone": rank <= tier_config["promotion_slots"],
            "is_demotion_zone": rank > (total_in_league - tier_config["demotion_slots"]) if user_league.current_tier != LeagueTier.BRONZE else False,
            "promotion_threshold": tier_config["promotion_slots"],
            "demotion_threshold": total_in_league - tier_config["demotion_slots"] if tier_config["demotion_slots"] > 0 else None,
            "next_tier": user_league.next_tier.value if user_league.next_tier else None,
            "previous_tier": user_league.previous_tier.value if user_league.previous_tier else None,
            "weeks_in_tier": user_league.weeks_in_current_tier,
            "highest_tier": user_league.highest_tier_reached.value,
        }

    async def process_weekly_reset(self, db: AsyncSession) -> Dict[str, Any]:
        """
        Traite le reset hebdomadaire des ligues.
        - Promeut le top X de chaque ligue
        - Rétrograde le bottom Y de chaque ligue
        - Remet les XP à zéro
        """
        now = utc_now()
        period_key = now.strftime("%Y-W%W")

        promotions = 0
        demotions = 0

        for tier in LeagueTier:
            tier_config = LEAGUE_CONFIG[tier]

            # Récupérer tous les utilisateurs de cette ligue ordonnés par XP
            query = (
                select(UserLeague)
                .where(UserLeague.current_tier == tier)
                .order_by(desc(UserLeague.weekly_xp))
            )
            result = await db.execute(query)
            users = result.scalars().all()

            total_users = len(users)

            for rank, user_league in enumerate(users, 1):
                # Sauvegarder dans l'historique du leaderboard
                entry = LeaderboardEntry(
                    user_id=user_league.user_id,
                    leaderboard_type=LeaderboardType.XP,
                    period=LeaderboardPeriod.WEEKLY,
                    period_key=period_key,
                    score=user_league.weekly_xp,
                    rank=rank,
                    league_tier=tier
                )
                db.add(entry)

                # Promotion (top X, sauf si déjà Master)
                if rank <= tier_config["promotion_slots"] and tier != LeagueTier.MASTER:
                    new_tier = user_league.next_tier
                    if new_tier:
                        # Enregistrer l'historique
                        history = LeagueHistory(
                            user_id=user_league.user_id,
                            from_tier=tier,
                            to_tier=new_tier,
                            period_key=period_key,
                            final_rank=rank,
                            final_xp=user_league.weekly_xp,
                            is_promotion=True
                        )
                        db.add(history)

                        # Mettre à jour l'utilisateur
                        user_league.current_tier = new_tier
                        user_league.total_promotions += 1
                        user_league.last_promotion_at = now
                        user_league.weeks_in_current_tier = 0

                        if new_tier.value > user_league.highest_tier_reached.value:
                            user_league.highest_tier_reached = new_tier

                        promotions += 1

                # Rétrogradation (bottom Y, sauf si Bronze)
                elif rank > (total_users - tier_config["demotion_slots"]) and tier != LeagueTier.BRONZE:
                    new_tier = user_league.previous_tier
                    if new_tier:
                        history = LeagueHistory(
                            user_id=user_league.user_id,
                            from_tier=tier,
                            to_tier=new_tier,
                            period_key=period_key,
                            final_rank=rank,
                            final_xp=user_league.weekly_xp,
                            is_promotion=False
                        )
                        db.add(history)

                        user_league.current_tier = new_tier
                        user_league.total_demotions += 1
                        user_league.last_demotion_at = now
                        user_league.weeks_in_current_tier = 0

                        demotions += 1
                else:
                    # Reste dans la même ligue
                    user_league.weeks_in_current_tier += 1

                # Reset des XP hebdomadaires
                user_league.weekly_xp = 0

        await db.commit()

        logger.info(f"Weekly league reset: {promotions} promotions, {demotions} demotions")

        return {
            "success": True,
            "period_key": period_key,
            "promotions": promotions,
            "demotions": demotions
        }

    # =========================================================================
    # LEADERBOARDS GÉNÉRAUX
    # =========================================================================

    async def get_global_leaderboard(
        self,
        db: AsyncSession,
        leaderboard_type: LeaderboardType,
        period: LeaderboardPeriod,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Récupère un classement global"""
        now = utc_now()

        # Déterminer les dates selon la période
        if period == LeaderboardPeriod.WEEKLY:
            # Début de la semaine (lundi)
            start_date = now - timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == LeaderboardPeriod.MONTHLY:
            # Début du mois
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            start_date = None  # All time

        # Construire la query selon le type
        if leaderboard_type == LeaderboardType.XP:
            if period == LeaderboardPeriod.ALL_TIME:
                query = (
                    select(User)
                    .where(User.is_active == True)
                    .order_by(desc(User.total_xp))
                    .limit(limit)
                )
            else:
                # Pour weekly, utiliser weekly_xp de UserLeague
                query = (
                    select(User, UserLeague.weekly_xp)
                    .join(UserLeague, User.id == UserLeague.user_id)
                    .where(User.is_active == True)
                    .order_by(desc(UserLeague.weekly_xp))
                    .limit(limit)
                )

        elif leaderboard_type == LeaderboardType.STREAK:
            query = (
                select(User)
                .where(User.is_active == True)
                .order_by(desc(User.current_streak))
                .limit(limit)
            )

        result = await db.execute(query)

        leaderboard = []
        if leaderboard_type == LeaderboardType.XP and period != LeaderboardPeriod.ALL_TIME:
            rows = result.all()
            for rank, (user, weekly_xp) in enumerate(rows, 1):
                leaderboard.append({
                    "rank": rank,
                    "user_id": user.id,
                    "username": user.username,
                    "avatar_url": user.avatar_url,
                    "score": weekly_xp,
                    "level": user.level,
                })
        else:
            users = result.scalars().all()
            for rank, user in enumerate(users, 1):
                score = user.total_xp if leaderboard_type == LeaderboardType.XP else user.current_streak
                leaderboard.append({
                    "rank": rank,
                    "user_id": user.id,
                    "username": user.username,
                    "avatar_url": user.avatar_url,
                    "score": score,
                    "level": user.level,
                })

        return leaderboard

    async def get_user_rank(
        self,
        db: AsyncSession,
        user_id: int,
        leaderboard_type: LeaderboardType,
        period: LeaderboardPeriod
    ) -> Optional[int]:
        """Récupère le rang d'un utilisateur dans un classement"""
        if leaderboard_type == LeaderboardType.XP:
            if period == LeaderboardPeriod.ALL_TIME:
                # Compter les utilisateurs avec plus d'XP total
                user_query = select(User.total_xp).where(User.id == user_id)
                user_result = await db.execute(user_query)
                user_xp = user_result.scalar()

                if user_xp is None:
                    return None

                rank_query = select(func.count()).select_from(User).where(
                    and_(User.is_active == True, User.total_xp > user_xp)
                )
            else:
                # Pour weekly, utiliser UserLeague
                user_league_query = select(UserLeague.weekly_xp).where(UserLeague.user_id == user_id)
                result = await db.execute(user_league_query)
                user_xp = result.scalar()

                if user_xp is None:
                    return None

                rank_query = select(func.count()).select_from(UserLeague).where(
                    UserLeague.weekly_xp > user_xp
                )

        elif leaderboard_type == LeaderboardType.STREAK:
            user_query = select(User.current_streak).where(User.id == user_id)
            user_result = await db.execute(user_query)
            user_streak = user_result.scalar()

            if user_streak is None:
                return None

            rank_query = select(func.count()).select_from(User).where(
                and_(User.is_active == True, User.current_streak > user_streak)
            )

        result = await db.execute(rank_query)
        users_above = result.scalar() or 0

        return users_above + 1


# Instance globale
leaderboard_service = LeaderboardService()
