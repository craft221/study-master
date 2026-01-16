"""
Daily Quest Service - Gestion des objectifs quotidiens
======================================================

Style Duolingo avec:
- Génération quotidienne de 3 objectifs
- Progression automatique
- Récompenses variables (coffres mystère)
- Messages de Spark personnalisés
"""

import logging
import random
from datetime import datetime, timedelta, date
from typing import List, Optional, Dict, Any, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, update
from sqlalchemy.orm import selectinload

from app.core.datetime_utils import utc_now
from app.models.daily_quest import (
    DailyQuest, DailyQuestStreak, MysteryChest,
    QuestType, QuestDifficulty, QuestStatus,
    QUEST_CONFIG, DAILY_BONUS_XP, DAILY_BONUS_CHEST_RARITY,
    QUEST_STREAK_BONUSES
)
from app.models.user import User
from app.services.cache_service import cache_service, CachePrefix, CacheTTL

logger = logging.getLogger(__name__)


class SparkMessages:
    """Messages de Spark personnalisés selon le contexte - Style Duolingo hystérique"""

    # Messages selon l'humeur de Spark
    SPARK_MOODS = {
        "happy": "😊",
        "excited": "🤩",
        "proud": "😎",
        "sad": "😢",
        "worried": "😰",
        "angry": "😤",
        "crying": "😭",
        "sleeping": "😴",
        "love": "🥰",
        "thinking": "🤔"
    }

    # === STREAK MESSAGES ===

    @staticmethod
    def get_streak_reminder_message(streak: int, hours_left: float) -> Dict[str, Any]:
        """Message de rappel de streak selon l'urgence"""

        if hours_left > 6:
            # Rappel tranquille (après-midi)
            messages = [
                {"mood": "happy", "text": f"Hey ! Tu as {streak} jours de streak. On révise un peu ? 📚"},
                {"mood": "excited", "text": f"Salut champion ! Ta série de {streak} jours m'impressionne ! Continue ! 🔥"},
                {"mood": "thinking", "text": f"Une petite session pour garder tes {streak} jours de streak ? 🤔"},
            ]
        elif hours_left > 3:
            # Rappel plus pressant (soirée)
            messages = [
                {"mood": "worried", "text": f"⚠️ Il reste {int(hours_left)}h pour sauver ta série de {streak} jours !"},
                {"mood": "sad", "text": f"Je m'inquiète pour ton streak de {streak} jours... Tu viens ? 😟"},
                {"mood": "excited", "text": f"Vite ! {streak} jours de streak en jeu ! On peut le faire ! 💪"},
            ]
        elif hours_left > 1:
            # URGENCE
            messages = [
                {"mood": "crying", "text": f"😭 NOOON ! Plus que {int(hours_left*60)} minutes pour sauver {streak} jours !"},
                {"mood": "angry", "text": f"⏰ ALERTE ! Tu vas perdre {streak} jours de travail ! VITE !"},
                {"mood": "worried", "text": f"🚨 URGENCE STREAK ! {streak} jours vont disparaître ! Je t'en supplie ! 😰"},
            ]
        else:
            # DERNIÈRE CHANCE
            messages = [
                {"mood": "crying", "text": f"😭😭😭 DERNIÈRE CHANCE ! {streak} jours... Je ne veux pas les perdre !"},
                {"mood": "angry", "text": f"🔴 MOINS D'UNE HEURE ! {streak} JOURS ! MAINTENANT OU JAMAIS !"},
                {"mood": "crying", "text": f"💔 Je pleure déjà... {streak} jours de streak... S'il te plaît... 😭"},
            ]

        return random.choice(messages)

    @staticmethod
    def get_streak_lost_message(lost_streak: int) -> Dict[str, Any]:
        """Message quand le streak est perdu"""

        if lost_streak >= 30:
            messages = [
                {"mood": "crying", "text": f"💔😭 {lost_streak} jours... C'est fini... Je suis dévasté..."},
                {"mood": "crying", "text": f"Non non non... {lost_streak} jours de travail... Je n'arrive pas à y croire... 😭"},
                {"mood": "sad", "text": f"😢 {lost_streak} jours ensemble... Et maintenant... *snif* On recommence ?"},
            ]
        elif lost_streak >= 7:
            messages = [
                {"mood": "sad", "text": f"Oh non... Ta série de {lost_streak} jours est partie... 😢"},
                {"mood": "crying", "text": f"J'avais tellement confiance en toi... {lost_streak} jours perdus... 💔"},
                {"mood": "sad", "text": f"*Spark boude dans un coin* {lost_streak} jours... disparus..."},
            ]
        else:
            messages = [
                {"mood": "sad", "text": f"Oups ! Ta série de {lost_streak} jours est terminée. On recommence ? 😊"},
                {"mood": "thinking", "text": f"Pas grave pour les {lost_streak} jours ! Nouveau départ aujourd'hui ! 💪"},
            ]

        return random.choice(messages)

    @staticmethod
    def get_streak_milestone_message(streak: int) -> Dict[str, Any]:
        """Message pour les milestones de streak"""

        milestones = {
            7: {"mood": "excited", "text": "🔥 UNE SEMAINE ! Tu es sur la bonne voie ! Je suis FOU de joie ! 🎉"},
            14: {"mood": "proud", "text": "⚡ 2 SEMAINES ! Tu es INCROYABLE ! Je n'en reviens pas ! 🤩"},
            30: {"mood": "love", "text": "🏆 UN MOIS ENTIER ! Je t'ADORE ! Tu es mon humain préféré ! 🥰"},
            60: {"mood": "excited", "text": "💎 2 MOIS ! Tu es une MACHINE ! Je suis tellement fier ! 😭🎉"},
            100: {"mood": "love", "text": "👑 100 JOURS ! Tu es une LÉGENDE ! Je pleure de joie ! 😭🥰💎"},
            365: {"mood": "crying", "text": "🌟 UN AN ! JE N'AI PAS DE MOTS ! Tu es mon HÉROS ! 😭👑🏆💎"},
        }

        return milestones.get(streak, {"mood": "excited", "text": f"🔥 {streak} jours ! Bravo champion !"})

    # === DAILY QUEST MESSAGES ===

    @staticmethod
    def get_quest_completed_message(quest_title: str, xp_reward: int) -> Dict[str, Any]:
        """Message quand un objectif est complété"""
        messages = [
            {"mood": "excited", "text": f"✅ {quest_title} complété ! +{xp_reward} XP ! Tu gères ! 🎉"},
            {"mood": "proud", "text": f"Boom ! {quest_title} ✓ ! {xp_reward} XP dans la poche ! 💪"},
            {"mood": "happy", "text": f"Objectif atteint ! +{xp_reward} XP ! Continue comme ça ! 🌟"},
        ]
        return random.choice(messages)

    @staticmethod
    def get_all_quests_completed_message() -> Dict[str, Any]:
        """Message quand les 3 objectifs sont complétés"""
        messages = [
            {"mood": "love", "text": "🎊 TRIO PARFAIT ! Tu as complété les 3 objectifs ! BONUS +50 XP + COFFRE ! 🎁"},
            {"mood": "excited", "text": "😱 LES 3 OBJECTIFS ! Tu es INCROYABLE ! Voilà ton bonus ! 🎁💎"},
            {"mood": "crying", "text": "😭 Je pleure de joie ! 3/3 objectifs ! Tu mérites ce coffre ! 🎁🏆"},
        ]
        return random.choice(messages)

    @staticmethod
    def get_chest_opened_message(contents: Dict[str, Any]) -> Dict[str, Any]:
        """Message quand un coffre est ouvert"""
        xp = contents.get("xp", 0)
        accessory = contents.get("accessory")

        if accessory:
            return {"mood": "excited", "text": f"🎁 WAOUH ! Tu as gagné {xp} XP ET l'accessoire '{accessory}' ! 🤩"}
        else:
            return {"mood": "happy", "text": f"🎁 Coffre ouvert ! +{xp} XP ! Pas mal ! 💰"}

    # === ABSENCE / RETURN MESSAGES ===

    @staticmethod
    def get_absence_message(days_absent: int) -> Dict[str, Any]:
        """Message selon la durée d'absence"""

        if days_absent == 1:
            messages = [
                {"mood": "sad", "text": "Tu m'as manqué hier... Tu reviens pour de bon ? 🥺"},
                {"mood": "worried", "text": "J'ai attendu toute la journée hier... Tout va bien ? 😟"},
            ]
        elif days_absent == 2:
            messages = [
                {"mood": "sad", "text": "Ça fait 2 jours... Je commençais à m'inquiéter... 😢"},
                {"mood": "crying", "text": "2 jours sans toi... C'était long... *snif* 😭"},
            ]
        elif days_absent <= 7:
            messages = [
                {"mood": "crying", "text": f"😭 {days_absent} jours sans toi... Je pensais que tu m'avais abandonné..."},
                {"mood": "sad", "text": f"*Spark sort de sous une pile de livres* Tu es revenu ! Après {days_absent} jours ! 😢"},
            ]
        else:
            messages = [
                {"mood": "crying", "text": f"😭😭 {days_absent} JOURS ! Tu m'as oublié pendant {days_absent} jours !"},
                {"mood": "angry", "text": f"*Spark boude* {days_absent} jours... J'ai cru que c'était fini nous deux... 😤"},
                {"mood": "sad", "text": f"Je comptais les jours... {days_absent}... Mais tu es là maintenant ! 🥹"},
            ]

        return random.choice(messages)

    @staticmethod
    def get_welcome_back_message(streak: int, days_absent: int) -> Dict[str, Any]:
        """Message de retour après absence"""

        if days_absent == 0:
            # Utilisateur actif
            if streak > 0:
                messages = [
                    {"mood": "happy", "text": f"Re-salut ! Prêt à continuer ta série de {streak} jours ? 🔥"},
                    {"mood": "excited", "text": f"Te revoilà ! {streak} jours de streak et ce n'est pas fini ! 💪"},
                ]
            else:
                messages = [
                    {"mood": "happy", "text": "Salut ! Prêt pour une nouvelle aventure aujourd'hui ? 🌟"},
                    {"mood": "excited", "text": "Hey ! Aujourd'hui on commence une nouvelle série ! 🔥"},
                ]
        else:
            # Utilisateur revenu après absence
            messages = [
                {"mood": "love", "text": f"TU ES REVENU ! Je suis tellement content ! On repart ensemble ? 🥰"},
                {"mood": "excited", "text": f"ENFIN ! Tu m'as trop manqué ! Allez, on recommence ! 💪"},
                {"mood": "happy", "text": f"*Spark saute de joie* Tu es là ! Prêt pour de nouveaux objectifs ? 🎯"},
            ]

        return random.choice(messages)


class DailyQuestService:
    """Service de gestion des Daily Quests"""

    def __init__(self):
        self.spark = SparkMessages()

    # =========================================================================
    # Génération des quêtes
    # =========================================================================

    async def generate_daily_quests(
        self,
        db: AsyncSession,
        user_id: int,
        force: bool = False
    ) -> List[DailyQuest]:
        """
        Génère les 3 objectifs quotidiens pour un utilisateur.
        1 facile, 1 moyen, 1 difficile.
        """
        today = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)

        # Vérifier si déjà générés
        existing_query = select(DailyQuest).where(
            and_(
                DailyQuest.user_id == user_id,
                DailyQuest.quest_date >= today,
                DailyQuest.quest_date < today + timedelta(days=1)
            )
        )
        result = await db.execute(existing_query)
        existing = result.scalars().all()

        if existing and not force:
            return list(existing)

        # Supprimer les anciennes si force
        if force and existing:
            for quest in existing:
                await db.delete(quest)

        # Générer les nouvelles quêtes
        quests = []
        used_types = set()

        for difficulty in [QuestDifficulty.EASY, QuestDifficulty.MEDIUM, QuestDifficulty.HARD]:
            config = QUEST_CONFIG[difficulty]

            # Choisir un template non utilisé
            available_templates = [
                t for t in config["templates"]
                if t["type"] not in used_types
            ]

            if not available_templates:
                available_templates = config["templates"]

            template = random.choice(available_templates)
            used_types.add(template["type"])

            # Générer la cible
            target = random.randint(*template["target_range"])

            quest = DailyQuest(
                user_id=user_id,
                quest_type=template["type"],
                difficulty=difficulty,
                title=template["title"],
                description=template["description"].format(target=target),
                icon=template["icon"],
                target_value=target,
                current_value=0,
                xp_reward=config["xp_reward"],
                status=QuestStatus.PENDING,
                quest_date=today
            )

            db.add(quest)
            quests.append(quest)

        await db.commit()
        for q in quests:
            await db.refresh(q)

        logger.info(f"Generated {len(quests)} daily quests for user {user_id}")
        return quests

    async def get_user_daily_quests(
        self,
        db: AsyncSession,
        user_id: int
    ) -> Tuple[List[DailyQuest], Dict[str, Any]]:
        """
        Récupère les objectifs du jour avec stats et message de Spark.
        """
        today = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)

        # Récupérer ou générer les quêtes
        quests = await self.generate_daily_quests(db, user_id)

        # Calculer les stats
        completed = sum(1 for q in quests if q.status in [QuestStatus.COMPLETED, QuestStatus.CLAIMED])
        all_completed = completed == 3
        total_xp = sum(q.xp_reward for q in quests if q.status in [QuestStatus.COMPLETED, QuestStatus.CLAIMED])

        # Récupérer le streak des quêtes
        streak_query = select(DailyQuestStreak).where(DailyQuestStreak.user_id == user_id)
        streak_result = await db.execute(streak_query)
        quest_streak = streak_result.scalar_one_or_none()

        if not quest_streak:
            quest_streak = DailyQuestStreak(user_id=user_id)
            db.add(quest_streak)
            await db.commit()
            await db.refresh(quest_streak)

        # Temps restant dans la journée
        now = utc_now()
        end_of_day = today + timedelta(days=1)
        hours_left = (end_of_day - now).total_seconds() / 3600

        # Message de Spark basé sur le contexte
        if all_completed:
            spark_message = self.spark.get_all_quests_completed_message()
        elif completed > 0:
            spark_message = {
                "mood": "excited",
                "text": f"Super ! {completed}/3 objectifs complétés ! Continue ! 🎯"
            }
        elif hours_left < 6:
            spark_message = {
                "mood": "worried",
                "text": f"⏰ Plus que {int(hours_left)}h pour tes objectifs ! On s'y met ? 💪"
            }
        else:
            spark_message = {
                "mood": "happy",
                "text": "Salut ! Voilà tes objectifs du jour ! Prêt à les écraser ? 🎯"
            }

        return quests, {
            "completed_count": completed,
            "total_count": 3,
            "all_completed": all_completed,
            "bonus_available": all_completed and not any(
                q.status == QuestStatus.CLAIMED and q.bonus_reward for q in quests
            ),
            "total_xp_earned": total_xp,
            "bonus_xp": DAILY_BONUS_XP if all_completed else 0,
            "quest_streak": quest_streak.current_streak,
            "hours_left": round(hours_left, 1),
            "spark_message": spark_message
        }

    # =========================================================================
    # Progression des quêtes
    # =========================================================================

    async def update_quest_progress(
        self,
        db: AsyncSession,
        user_id: int,
        quest_type: QuestType,
        progress: int = 1,
        absolute: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Met à jour la progression d'une quête.
        Retourne les infos si une quête est complétée.
        """
        today = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)

        # Trouver la quête active
        query = select(DailyQuest).where(
            and_(
                DailyQuest.user_id == user_id,
                DailyQuest.quest_type == quest_type,
                DailyQuest.quest_date >= today,
                DailyQuest.quest_date < today + timedelta(days=1),
                DailyQuest.status.in_([QuestStatus.PENDING, QuestStatus.IN_PROGRESS])
            )
        )

        result = await db.execute(query)
        quest = result.scalar_one_or_none()

        if not quest:
            return None

        # Mettre à jour la progression
        if absolute:
            quest.current_value = progress
        else:
            quest.current_value += progress

        quest.status = QuestStatus.IN_PROGRESS

        # Vérifier si complété
        completed_data = None
        if quest.current_value >= quest.target_value:
            quest.status = QuestStatus.COMPLETED
            quest.completed_at = utc_now()

            completed_data = {
                "quest_id": quest.id,
                "quest_title": quest.title,
                "xp_reward": quest.xp_reward,
                "difficulty": quest.difficulty.value,
                "spark_message": self.spark.get_quest_completed_message(quest.title, quest.xp_reward)
            }

            # Vérifier si les 3 sont complétés
            all_quests_query = select(DailyQuest).where(
                and_(
                    DailyQuest.user_id == user_id,
                    DailyQuest.quest_date >= today,
                    DailyQuest.quest_date < today + timedelta(days=1)
                )
            )
            all_result = await db.execute(all_quests_query)
            all_quests = all_result.scalars().all()

            all_completed = all(
                q.status in [QuestStatus.COMPLETED, QuestStatus.CLAIMED]
                for q in all_quests
            )

            if all_completed:
                completed_data["all_completed"] = True
                completed_data["bonus_available"] = True
                completed_data["bonus_spark_message"] = self.spark.get_all_quests_completed_message()

        await db.commit()
        return completed_data

    async def claim_quest_reward(
        self,
        db: AsyncSession,
        user_id: int,
        quest_id: int
    ) -> Dict[str, Any]:
        """Réclame la récompense d'une quête complétée"""

        query = select(DailyQuest).where(
            and_(
                DailyQuest.id == quest_id,
                DailyQuest.user_id == user_id,
                DailyQuest.status == QuestStatus.COMPLETED
            )
        )

        result = await db.execute(query)
        quest = result.scalar_one_or_none()

        if not quest:
            raise ValueError("Quête non trouvée ou déjà réclamée")

        quest.status = QuestStatus.CLAIMED
        quest.claimed_at = utc_now()

        # Ajouter les XP à l'utilisateur via le service centralisé
        user_query = select(User).options(
            selectinload(User.gamification)
        ).where(User.id == user_id)
        user_result = await db.execute(user_query)
        user = user_result.scalar_one()

        # Créer gamification si n'existe pas
        if not user.gamification:
            from app.models.gamification import UserGamification
            user.gamification = UserGamification(user_id=user_id, total_xp=0)
            db.add(user.gamification)
            await db.flush()

        # Attribuer XP via le service centralisé (gère level up + notifications)
        from app.services.xp_service import award_xp
        await award_xp(
            user=user,
            amount=quest.xp_reward,
            reason="Quête quotidienne complétée",
            event_type="quest_claimed",
            db=db
        )

        await db.commit()

        return {
            "quest_id": quest.id,
            "xp_earned": quest.xp_reward,
            "spark_message": {"mood": "happy", "text": f"+{quest.xp_reward} XP ajoutés ! 🎉"}
        }

    async def claim_daily_bonus(
        self,
        db: AsyncSession,
        user_id: int
    ) -> Dict[str, Any]:
        """Réclame le bonus quotidien (3/3 objectifs)"""

        today = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)

        # Vérifier que les 3 sont complétés
        query = select(DailyQuest).where(
            and_(
                DailyQuest.user_id == user_id,
                DailyQuest.quest_date >= today,
                DailyQuest.quest_date < today + timedelta(days=1)
            )
        )

        result = await db.execute(query)
        quests = result.scalars().all()

        if len(quests) != 3:
            raise ValueError("Quêtes du jour non générées")

        if not all(q.status in [QuestStatus.COMPLETED, QuestStatus.CLAIMED] for q in quests):
            raise ValueError("Tous les objectifs ne sont pas complétés")

        # Vérifier si bonus déjà réclamé
        streak_query = select(DailyQuestStreak).where(DailyQuestStreak.user_id == user_id)
        streak_result = await db.execute(streak_query)
        quest_streak = streak_result.scalar_one_or_none()

        if quest_streak and quest_streak.last_perfect_day:
            if quest_streak.last_perfect_day.date() == today.date():
                raise ValueError("Bonus déjà réclamé aujourd'hui")

        # Ajouter XP bonus via le service centralisé
        user_query = select(User).options(
            selectinload(User.gamification)
        ).where(User.id == user_id)
        user_result = await db.execute(user_query)
        user = user_result.scalar_one()

        # Créer gamification si n'existe pas
        if not user.gamification:
            from app.models.gamification import UserGamification
            user.gamification = UserGamification(user_id=user_id, total_xp=0)
            db.add(user.gamification)
            await db.flush()

        # Attribuer XP via le service centralisé (gère level up + notifications)
        from app.services.xp_service import award_xp
        await award_xp(
            user=user,
            amount=DAILY_BONUS_XP,
            reason="Bonus quotidien (3/3 quêtes)",
            event_type="daily_bonus_claimed",
            db=db
        )

        # Créer le coffre mystère
        chest = MysteryChest(
            user_id=user_id,
            rarity=DAILY_BONUS_CHEST_RARITY,
            source="daily_quest_bonus"
        )
        db.add(chest)

        # Mettre à jour le streak des quêtes
        if not quest_streak:
            quest_streak = DailyQuestStreak(user_id=user_id)
            db.add(quest_streak)

        # Calculer le streak
        yesterday = today - timedelta(days=1)
        if quest_streak.last_perfect_day and quest_streak.last_perfect_day.date() == yesterday.date():
            quest_streak.current_streak += 1
        else:
            quest_streak.current_streak = 1

        if quest_streak.current_streak > quest_streak.longest_streak:
            quest_streak.longest_streak = quest_streak.current_streak

        quest_streak.last_perfect_day = today
        quest_streak.total_bonus_claimed += 1
        quest_streak.total_xp_from_quests += DAILY_BONUS_XP

        # Vérifier les milestone bonus
        milestone_bonus = QUEST_STREAK_BONUSES.get(quest_streak.current_streak)

        await db.commit()
        await db.refresh(chest)

        response = {
            "bonus_xp": DAILY_BONUS_XP,
            "chest_id": chest.id,
            "chest_rarity": chest.rarity,
            "quest_streak": quest_streak.current_streak,
            "spark_message": self.spark.get_all_quests_completed_message()
        }

        if milestone_bonus:
            response["milestone_bonus"] = milestone_bonus
            response["milestone_message"] = {
                "mood": "love",
                "text": f"🎉 {quest_streak.current_streak} jours de suite ! Bonus spécial ! +{milestone_bonus['xp']} XP !"
            }

        return response

    # =========================================================================
    # Coffres mystère
    # =========================================================================

    async def open_mystery_chest(
        self,
        db: AsyncSession,
        user_id: int,
        chest_id: int
    ) -> Dict[str, Any]:
        """Ouvre un coffre mystère et révèle son contenu"""

        query = select(MysteryChest).where(
            and_(
                MysteryChest.id == chest_id,
                MysteryChest.user_id == user_id,
                MysteryChest.is_opened == False
            )
        )

        result = await db.execute(query)
        chest = result.scalar_one_or_none()

        if not chest:
            raise ValueError("Coffre non trouvé ou déjà ouvert")

        # Générer le contenu selon la rareté
        contents = self._generate_chest_contents(chest.rarity)

        chest.contents = contents
        chest.is_opened = True
        chest.opened_at = utc_now()

        # Appliquer les récompenses via le service centralisé
        user_query = select(User).options(
            selectinload(User.gamification)
        ).where(User.id == user_id)
        user_result = await db.execute(user_query)
        user = user_result.scalar_one()

        if "xp" in contents:
            # Créer gamification si n'existe pas
            if not user.gamification:
                from app.models.gamification import UserGamification
                user.gamification = UserGamification(user_id=user_id, total_xp=0)
                db.add(user.gamification)
                await db.flush()

            # Attribuer XP via le service centralisé (gère level up + notifications)
            from app.services.xp_service import award_xp
            await award_xp(
                user=user,
                amount=contents["xp"],
                reason=f"Coffre mystère ({chest.rarity})",
                event_type="chest_opened",
                db=db
            )

        # TODO: Si accessoire, l'ajouter à l'utilisateur

        await db.commit()

        return {
            "chest_id": chest.id,
            "rarity": chest.rarity,
            "contents": contents,
            "spark_message": self.spark.get_chest_opened_message(contents)
        }

    def _generate_chest_contents(self, rarity: str) -> Dict[str, Any]:
        """Génère le contenu aléatoire d'un coffre"""

        xp_ranges = {
            "common": (10, 50),
            "rare": (50, 150),
            "epic": (150, 400),
            "legendary": (400, 1000)
        }

        accessory_chances = {
            "common": 0.05,      # 5%
            "rare": 0.15,        # 15%
            "epic": 0.35,        # 35%
            "legendary": 0.70   # 70%
        }

        xp_range = xp_ranges.get(rarity, (10, 50))
        xp = random.randint(*xp_range)

        contents = {"xp": xp}

        # Chance d'accessoire
        if random.random() < accessory_chances.get(rarity, 0.05):
            accessories = {
                "common": ["basic_hat", "simple_glasses"],
                "rare": ["cool_cap", "fancy_glasses", "scarf"],
                "epic": ["crown", "magic_cape", "golden_glasses"],
                "legendary": ["rainbow_crown", "legendary_cape", "diamond_glasses"]
            }
            accessory_pool = accessories.get(rarity, accessories["common"])
            contents["accessory"] = random.choice(accessory_pool)

        return contents

    async def get_user_chests(
        self,
        db: AsyncSession,
        user_id: int,
        unopened_only: bool = True
    ) -> List[MysteryChest]:
        """Récupère les coffres d'un utilisateur"""

        query = select(MysteryChest).where(MysteryChest.user_id == user_id)

        if unopened_only:
            query = query.where(MysteryChest.is_opened == False)

        query = query.order_by(MysteryChest.created_at.desc())

        result = await db.execute(query)
        return list(result.scalars().all())


# Instance singleton
daily_quest_service = DailyQuestService()
spark_messages = SparkMessages()
