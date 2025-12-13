"""
🧠 Spark Intelligence Service - Le cerveau de Spark ⚡🐿️

Ce service permet à Spark de:
- Analyser les patterns d'étude de l'utilisateur
- Détecter les forces et faiblesses
- Générer des insights proactifs
- Préparer des briefings quotidiens personnalisés
- Anticiper les besoins (examens, révisions, streak à risque)
- Maintenir une mémoire long-terme
"""

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from anthropic import AsyncAnthropic
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.spark import (
    SparkUserInsight, SparkNotification, SparkMemory,
    SparkDailyBriefing, InsightType, SparkMoodType
)
from app.models.user import User, UserStats, UserGamification
from app.models.note import Note
from app.models.flashcard import Flashcard, FlashcardReview
from app.models.quiz import Quiz, QuizAttempt
from app.models.schedule import Schedule
from app.services.cache_service import cache_service, CachePrefix, CacheTTL
from app.core.i18n import get_language_instruction

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
async_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None


class SparkIntelligenceService:
    """
    Service d'intelligence artificielle pour Spark
    Analyse l'utilisateur et génère des insights proactifs
    """

    def __init__(self):
        self.model = "claude-sonnet-4-20250514"

    async def analyze_user_patterns(
        self,
        db: AsyncSession,
        user: User
    ) -> Dict[str, Any]:
        """
        Analyse complète des patterns d'étude de l'utilisateur
        Retourne un dictionnaire d'insights pour alimenter Spark
        """
        analysis = {
            "study_times": await self._analyze_study_times(db, user),
            "strengths": await self._analyze_strengths(db, user),
            "weaknesses": await self._analyze_weaknesses(db, user),
            "streak_health": await self._analyze_streak_health(db, user),
            "upcoming_needs": await self._analyze_upcoming_needs(db, user),
            "engagement_level": await self._calculate_engagement(db, user),
            "learning_velocity": await self._calculate_learning_velocity(db, user),
        }

        return analysis

    async def _analyze_study_times(
        self,
        db: AsyncSession,
        user: User
    ) -> Dict[str, Any]:
        """Analyse les moments où l'utilisateur étudie le plus"""
        # Récupérer les reviews de flashcards avec leur timing
        reviews_query = select(FlashcardReview).where(
            FlashcardReview.user_id == user.id
        ).order_by(FlashcardReview.reviewed_at.desc()).limit(100)

        result = await db.execute(reviews_query)
        reviews = result.scalars().all()

        if not reviews:
            return {"best_hour": None, "best_day": None, "pattern": "unknown"}

        # Analyser les heures
        hours = {}
        days = {}
        for review in reviews:
            if review.reviewed_at:
                hour = review.reviewed_at.hour
                day = review.reviewed_at.strftime("%A")
                hours[hour] = hours.get(hour, 0) + 1
                days[day] = days.get(day, 0) + 1

        best_hour = max(hours, key=hours.get) if hours else None
        best_day = max(days, key=days.get) if days else None

        # Déterminer le pattern
        if best_hour:
            if best_hour < 12:
                pattern = "morning_person"
            elif best_hour < 18:
                pattern = "afternoon_learner"
            else:
                pattern = "night_owl"
        else:
            pattern = "unknown"

        return {
            "best_hour": best_hour,
            "best_day": best_day,
            "pattern": pattern,
            "hour_distribution": hours,
            "day_distribution": days
        }

    async def _analyze_strengths(
        self,
        db: AsyncSession,
        user: User
    ) -> List[Dict[str, Any]]:
        """Identifie les points forts de l'utilisateur"""
        strengths = []

        # Analyser les quiz par sujet
        quiz_query = select(
            QuizAttempt.quiz_id,
            func.avg(QuizAttempt.score).label("avg_score"),
            func.count(QuizAttempt.id).label("attempt_count")
        ).where(
            QuizAttempt.user_id == user.id
        ).group_by(QuizAttempt.quiz_id).having(
            func.count(QuizAttempt.id) >= 2
        )

        result = await db.execute(quiz_query)
        quiz_stats = result.all()

        for quiz_id, avg_score, count in quiz_stats:
            if avg_score and avg_score >= 80:
                quiz = await db.get(Quiz, quiz_id)
                if quiz:
                    strengths.append({
                        "type": "quiz_mastery",
                        "subject": quiz.title,
                        "score": float(avg_score),
                        "attempts": count
                    })

        # Analyser les flashcards maîtrisées (mastery_percentage >= 80%)
        mastered_query = select(func.count(Flashcard.id)).where(
            and_(
                Flashcard.user_id == user.id,
                Flashcard.mastery_percentage >= 80.0
            )
        )
        mastered_count = await db.scalar(mastered_query)

        if mastered_count and mastered_count >= 20:
            strengths.append({
                "type": "flashcard_mastery",
                "count": mastered_count,
                "message": f"{mastered_count} flashcards maîtrisées"
            })

        return strengths

    async def _analyze_weaknesses(
        self,
        db: AsyncSession,
        user: User
    ) -> List[Dict[str, Any]]:
        """Identifie les points faibles à améliorer"""
        weaknesses = []

        # Flashcards avec difficultés
        struggling_query = select(Flashcard).where(
            and_(
                Flashcard.user_id == user.id,
                Flashcard.incorrect_reviews > Flashcard.correct_reviews,
                Flashcard.total_reviews >= 3
            )
        ).limit(10)

        result = await db.execute(struggling_query)
        struggling = result.scalars().all()

        if struggling:
            weaknesses.append({
                "type": "struggling_flashcards",
                "count": len(struggling),
                "decks": list(set(f.deck_name for f in struggling if f.deck_name)),
                "message": f"{len(struggling)} flashcards difficiles"
            })

        # Quiz avec scores bas
        low_quiz_query = select(
            QuizAttempt.quiz_id,
            func.avg(QuizAttempt.score).label("avg_score")
        ).where(
            QuizAttempt.user_id == user.id
        ).group_by(QuizAttempt.quiz_id).having(
            func.avg(QuizAttempt.score) < 60
        )

        result = await db.execute(low_quiz_query)
        low_quizzes = result.all()

        for quiz_id, avg_score in low_quizzes:
            quiz = await db.get(Quiz, quiz_id)
            if quiz:
                weaknesses.append({
                    "type": "quiz_struggle",
                    "quiz": quiz.title,
                    "avg_score": float(avg_score) if avg_score else 0
                })

        return weaknesses

    async def _analyze_streak_health(
        self,
        db: AsyncSession,
        user: User
    ) -> Dict[str, Any]:
        """Analyse la santé du streak et prédit les risques"""
        gamification = user.gamification if hasattr(user, 'gamification') else None

        if not gamification:
            return {"status": "unknown", "risk": "low"}

        streak = gamification.current_streak or 0
        last_study = gamification.last_activity_date

        # Calculer le risque
        now = datetime.now(timezone.utc)
        risk = "low"
        hours_since_activity = 0

        if last_study:
            hours_since_activity = (now - last_study).total_seconds() / 3600

            if hours_since_activity > 20:
                risk = "critical"
            elif hours_since_activity > 16:
                risk = "high"
            elif hours_since_activity > 12:
                risk = "medium"

        return {
            "current_streak": streak,
            "longest_streak": gamification.longest_streak or 0,
            "hours_since_activity": round(hours_since_activity, 1),
            "risk": risk,
            "status": "active" if risk == "low" else "at_risk"
        }

    async def _analyze_upcoming_needs(
        self,
        db: AsyncSession,
        user: User
    ) -> Dict[str, Any]:
        """Analyse les besoins à venir (examens, révisions)"""
        needs = {
            "upcoming_exams": [],
            "overdue_reviews": 0,
            "pending_goals": []
        }

        # Examens à venir (dans les 14 prochains jours)
        now = datetime.now(timezone.utc)
        two_weeks = now + timedelta(days=14)

        exams_query = select(Schedule).where(
            and_(
                Schedule.user_id == user.id,
                Schedule.event_type == "exam",
                Schedule.start_time >= now,
                Schedule.start_time <= two_weeks,
                Schedule.is_cancelled == False
            )
        ).order_by(Schedule.start_time)

        result = await db.execute(exams_query)
        exams = result.scalars().all()

        for exam in exams:
            days_until = (exam.start_time - now).days
            needs["upcoming_exams"].append({
                "title": exam.title,
                "subject": exam.subject_id,
                "date": exam.start_time.isoformat(),
                "days_until": days_until,
                "urgency": "critical" if days_until <= 3 else ("high" if days_until <= 7 else "normal")
            })

        # Flashcards à réviser
        overdue_query = select(func.count(Flashcard.id)).where(
            and_(
                Flashcard.user_id == user.id,
                Flashcard.next_review_at <= now
            )
        )
        needs["overdue_reviews"] = await db.scalar(overdue_query) or 0

        return needs

    async def _calculate_engagement(
        self,
        db: AsyncSession,
        user: User
    ) -> Dict[str, Any]:
        """Calcule le niveau d'engagement de l'utilisateur"""
        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)

        # Activités cette semaine
        reviews_count = await db.scalar(
            select(func.count(FlashcardReview.id)).where(
                and_(
                    FlashcardReview.user_id == user.id,
                    FlashcardReview.reviewed_at >= week_ago
                )
            )
        ) or 0

        quiz_count = await db.scalar(
            select(func.count(QuizAttempt.id)).where(
                and_(
                    QuizAttempt.user_id == user.id,
                    QuizAttempt.completed_at >= week_ago
                )
            )
        ) or 0

        notes_count = await db.scalar(
            select(func.count(Note.id)).where(
                and_(
                    Note.user_id == user.id,
                    Note.created_at >= week_ago
                )
            )
        ) or 0

        total_activities = reviews_count + quiz_count + notes_count

        # Déterminer le niveau
        if total_activities >= 50:
            level = "highly_engaged"
            emoji = "🔥"
        elif total_activities >= 20:
            level = "engaged"
            emoji = "⚡"
        elif total_activities >= 5:
            level = "moderate"
            emoji = "🌱"
        else:
            level = "low"
            emoji = "💤"

        return {
            "level": level,
            "emoji": emoji,
            "weekly_activities": total_activities,
            "reviews": reviews_count,
            "quizzes": quiz_count,
            "notes": notes_count
        }

    async def _calculate_learning_velocity(
        self,
        db: AsyncSession,
        user: User
    ) -> Dict[str, Any]:
        """Calcule la vélocité d'apprentissage"""
        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)
        two_weeks_ago = now - timedelta(days=14)

        # XP cette semaine vs semaine dernière
        # Simplifié: on utilise les stats utilisateur
        stats = user.stats if hasattr(user, 'stats') else None
        gamification = user.gamification if hasattr(user, 'gamification') else None

        if not gamification:
            return {"trend": "stable", "velocity": 0}

        current_xp = gamification.total_xp or 0

        # Estimer la vélocité basée sur le niveau et l'ancienneté
        days_active = (now - (user.created_at or now)).days or 1
        avg_xp_per_day = current_xp / days_active

        if avg_xp_per_day >= 50:
            trend = "accelerating"
        elif avg_xp_per_day >= 20:
            trend = "stable"
        else:
            trend = "slowing"

        return {
            "trend": trend,
            "avg_xp_per_day": round(avg_xp_per_day, 1),
            "total_xp": current_xp
        }

    async def generate_daily_briefing(
        self,
        db: AsyncSession,
        user: User
    ) -> SparkDailyBriefing:
        """
        Génère le briefing quotidien personnalisé de Spark
        """
        # Analyser l'utilisateur
        analysis = await self.analyze_user_patterns(db, user)

        # Déterminer l'humeur et le ton
        streak_health = analysis.get("streak_health", {})
        engagement = analysis.get("engagement_level", {})
        upcoming = analysis.get("upcoming_needs", {})

        # Décider du ton basé sur le contexte
        if streak_health.get("risk") == "critical":
            mood = SparkMoodType.WORRIED
            tone = "urgent"
        elif upcoming.get("upcoming_exams") and upcoming["upcoming_exams"][0].get("urgency") == "critical":
            mood = SparkMoodType.ENCOURAGING
            tone = "serious"
        elif engagement.get("level") == "highly_engaged":
            mood = SparkMoodType.PROUD
            tone = "playful"
        else:
            mood = SparkMoodType.HAPPY
            tone = "encouraging"

        # Générer le greeting avec l'IA
        greeting = await self._generate_personalized_greeting(
            user, analysis, mood, tone
        )

        # Langue de l'utilisateur
        user_lang = user.language if user else "fr"

        # Préparer les sections du briefing
        streak_status = {
            "current": streak_health.get("current_streak", 0),
            "longest": streak_health.get("longest_streak", 0),
            "risk": streak_health.get("risk", "low"),
            "message": self._get_streak_message(streak_health, lang=user_lang)
        }

        # Objectifs du jour
        today_goals = await self._generate_daily_goals(db, user, analysis)

        # Révisions en attente
        pending_reviews = {
            "count": upcoming.get("overdue_reviews", 0),
            "message": self._get_review_message(upcoming.get("overdue_reviews", 0), lang=user_lang)
        }

        # Fun fact
        fun_fact = await self._get_fun_fact(user)

        # Créer le briefing
        briefing = SparkDailyBriefing(
            user_id=user.id,
            briefing_date=datetime.now(timezone.utc),
            greeting=greeting,
            streak_status=streak_status,
            today_goals=today_goals,
            pending_reviews=pending_reviews,
            upcoming_exams=upcoming.get("upcoming_exams", []),
            achievements_progress=[],  # TODO: implémenter
            fun_fact=fun_fact,
            motivation_quote=await self._get_motivation_quote(user, analysis),
            mood=mood,
            tone=tone
        )

        db.add(briefing)
        await db.commit()
        await db.refresh(briefing)

        return briefing

    async def _generate_personalized_greeting(
        self,
        user: User,
        analysis: Dict,
        mood: SparkMoodType,
        tone: str
    ) -> str:
        """Génère un message d'accueil personnalisé avec l'IA"""
        user_lang = user.language if user else "fr"

        if not async_client:
            return self._get_fallback_greeting(user, mood, lang=user_lang)

        streak = analysis.get("streak_health", {}).get("current_streak", 0)
        engagement = analysis.get("engagement_level", {}).get("level", "moderate")
        exams = analysis.get("upcoming_needs", {}).get("upcoming_exams", [])

        lang_instruction = get_language_instruction(user_lang)

        system_prompt = f"""Tu es Spark, l'écureuil mascotte de Study Master. Tu as une personnalité unique:

PERSONNALITÉ:
- Sarcastique mais bienveillant (comme Duo de Duolingo mais en plus cool)
- Tu brises parfois le 4ème mur
- Tu utilises l'humour et des références pop culture
- Tu es attachant malgré ton côté taquin
- Tu n'es JAMAIS condescendant

STYLE:
- 2-3 phrases MAX
- Tutoiement naturel
- 1-2 émojis parmi: 🐿️⚡🌰💪🎉📚🔥✨😏🥺
- Références aux noisettes = connaissances (avec modération)

TONS DISPONIBLES:
- "urgent": préoccupé mais motivant (streak à risque ou exam proche)
- "serious": sérieux mais pas flippant
- "playful": taquin et fun
- "encouraging": motivant et chaleureux

{lang_instruction}"""

        context = f"""Génère un message de BONJOUR MATINAL pour {user.username}.

CONTEXTE:
- Streak actuel: {streak} jours
- Engagement: {engagement}
- Exams proches: {len(exams)} {"(URGENT: " + exams[0]["title"] + " dans " + str(exams[0]["days_until"]) + " jours)" if exams else ""}
- Ton demandé: {tone}
- Humeur: {mood.value}

EXEMPLES DE STYLE SELON LE TON:
- urgent: "Oh oh... Tu reviens enfin ! Ton streak de {streak} jours me stresse un peu là 😏🌰"
- playful: "Tiens tiens, qui voilà ! Mon écureuil préféré revient chercher ses noisettes ! 🐿️⚡"
- serious: "Hey ! On a du pain sur la planche. {exams[0]["title"] if exams else "Tes révisions"} n'attend pas ! 💪"

Génère UNIQUEMENT le message (pas de guillemets, pas d'explication):"""

        try:
            message = await async_client.messages.create(
                model=self.model,
                max_tokens=150,
                temperature=0.9,
                system=system_prompt,
                messages=[{"role": "user", "content": context}]
            )

            return message.content[0].text.strip()

        except Exception as e:
            logger.error(f"Erreur génération greeting: {e}")
            return self._get_fallback_greeting(user, mood, lang=user_lang)

    def _get_fallback_greeting(self, user: User, mood: SparkMoodType, lang: str = "fr") -> str:
        """Greeting de fallback sans IA"""
        name = user.username or ("champion" if lang == "fr" else "champ")

        greetings = {
            "fr": {
                SparkMoodType.HAPPY: f"Salut {name} ! Prêt à accumuler des noisettes ? 🐿️⚡",
                SparkMoodType.WORRIED: f"Oh {name}... je commençais à m'inquiéter ! On rattrape le temps perdu ? 🥺",
                SparkMoodType.PROUD: f"Hey {name} ! Tu gères grave ces derniers temps ! Continue comme ça 🔥",
                SparkMoodType.ENCOURAGING: f"Allez {name}, c'est le moment de briller ! Je crois en toi 💪",
            },
            "en": {
                SparkMoodType.HAPPY: f"Hey {name}! Ready to gather some knowledge acorns? 🐿️⚡",
                SparkMoodType.WORRIED: f"Oh {name}... I was starting to worry! Shall we catch up? 🥺",
                SparkMoodType.PROUD: f"Hey {name}! You've been crushing it lately! Keep it up 🔥",
                SparkMoodType.ENCOURAGING: f"Come on {name}, it's time to shine! I believe in you 💪",
            }
        }

        lang_greetings = greetings.get(lang, greetings["fr"])
        default = f"Hey {name} ! Spark est là ! 🐿️" if lang == "fr" else f"Hey {name}! Spark is here! 🐿️"
        return lang_greetings.get(mood, default)

    def _get_streak_message(self, streak_health: Dict, lang: str = "fr") -> str:
        """Génère un message pour le streak"""
        streak = streak_health.get("current_streak", 0)
        risk = streak_health.get("risk", "low")

        messages = {
            "fr": {
                "critical": f"⚠️ ALERTE: Ton streak de {streak} jours est en danger !",
                "high": f"🕐 Attention, il reste peu de temps pour sauver ton streak de {streak} jours",
                "legend": f"🏆 {streak} jours ! Tu es une légende !",
                "fire": f"🔥 {streak} jours de série ! Continue !",
                "grow": f"🌱 {streak} jour(s) - Chaque jour compte !",
                "none": "📅 Pas de streak actif - C'est le moment d'en commencer un !"
            },
            "en": {
                "critical": f"⚠️ ALERT: Your {streak} day streak is in danger!",
                "high": f"🕐 Warning, little time left to save your {streak} day streak",
                "legend": f"🏆 {streak} days! You're a legend!",
                "fire": f"🔥 {streak} day streak! Keep going!",
                "grow": f"🌱 {streak} day(s) - Every day counts!",
                "none": "📅 No active streak - Time to start one!"
            }
        }

        m = messages.get(lang, messages["fr"])

        if risk == "critical":
            return m["critical"]
        elif risk == "high":
            return m["high"]
        elif streak >= 30:
            return m["legend"]
        elif streak >= 7:
            return m["fire"]
        elif streak > 0:
            return m["grow"]
        else:
            return m["none"]

    def _get_review_message(self, count: int, lang: str = "fr") -> str:
        """Génère un message pour les révisions"""
        messages = {
            "fr": {
                "none": "✅ Aucune révision en attente !",
                "few": f"📚 {count} flashcards t'attendent",
                "some": f"📚 {count} flashcards à réviser - Un petit effort !",
                "many": f"📚 {count} flashcards en attente - On s'y met ? 💪"
            },
            "en": {
                "none": "✅ No reviews pending!",
                "few": f"📚 {count} flashcards waiting for you",
                "some": f"📚 {count} flashcards to review - A little effort!",
                "many": f"📚 {count} flashcards pending - Let's do this! 💪"
            }
        }

        m = messages.get(lang, messages["fr"])

        if count == 0:
            return m["none"]
        elif count <= 10:
            return m["few"]
        elif count <= 30:
            return m["some"]
        else:
            return m["many"]

    async def _generate_daily_goals(
        self,
        db: AsyncSession,
        user: User,
        analysis: Dict
    ) -> List[Dict]:
        """Génère des objectifs quotidiens personnalisés"""
        goals = []
        upcoming = analysis.get("upcoming_needs", {})
        weaknesses = analysis.get("weaknesses", [])

        # Objectif 1: Révisions
        overdue = upcoming.get("overdue_reviews", 0)
        if overdue > 0:
            goals.append({
                "type": "review",
                "title": "Réviser les flashcards",
                "target": min(overdue, 20),
                "unit": "flashcards",
                "priority": 1
            })

        # Objectif 2: Si exam proche
        exams = upcoming.get("upcoming_exams", [])
        if exams:
            exam = exams[0]
            goals.append({
                "type": "exam_prep",
                "title": f"Préparer {exam['title']}",
                "target": 30,
                "unit": "minutes",
                "priority": 1 if exam["days_until"] <= 3 else 2
            })

        # Objectif 3: Travailler les faiblesses
        if weaknesses:
            goals.append({
                "type": "improve",
                "title": "Travailler les points faibles",
                "description": f"Focus sur: {weaknesses[0].get('message', 'révisions')}",
                "target": 15,
                "unit": "minutes",
                "priority": 3
            })

        # Objectif par défaut si aucun
        if not goals:
            goals.append({
                "type": "study",
                "title": "Session d'étude",
                "target": 20,
                "unit": "minutes",
                "priority": 2
            })

        return goals[:3]  # Max 3 objectifs

    async def _get_fun_fact(self, user: User) -> str:
        """Retourne un fun fact du jour"""
        facts = [
            "🧠 Les écureuils cachent jusqu'à 10 000 noisettes par an mais en oublient 25%. Ces oublis font pousser des arbres ! Comme quoi, oublier a du bon 🌳",
            "📚 Notre cerveau peut stocker l'équivalent de 2.5 millions de gigaoctets. Tu as de la place pour quelques flashcards de plus ! 🐿️",
            "💤 Dormir après avoir étudié améliore la mémorisation de 40%. Raison de plus pour bien dormir !",
            "🎮 Les jeux vidéo améliorent la mémoire de travail. Gaming = révisions ? Presque... 😏",
            "🌰 Un écureuil peut retrouver ses cachettes sous 30cm de neige grâce à son odorat. Spark retrouve tes connaissances encore plus vite !",
            "⚡ Le cerveau utilise 20% de ton énergie. Étudier = faire du sport pour le cerveau 💪",
            "🔄 La répétition espacée peut améliorer ta mémorisation de 200%. C'est pour ça que Spark insiste tant !",
            "🎵 Écouter de la musique classique pendant l'étude peut améliorer la concentration. Mozart approuve 🎹",
        ]

        # Utiliser la date pour avoir un fait différent chaque jour
        day_of_year = datetime.now().timetuple().tm_yday
        return facts[day_of_year % len(facts)]

    async def _get_motivation_quote(
        self,
        user: User,
        analysis: Dict
    ) -> str:
        """Retourne une citation motivante adaptée"""
        engagement = analysis.get("engagement_level", {}).get("level", "moderate")

        quotes = {
            "highly_engaged": [
                "« Le succès n'est pas la clé du bonheur. Le bonheur est la clé du succès. » - Albert Schweitzer",
                "« Tu es sur la bonne voie. Continue ! » - Spark 🐿️",
            ],
            "engaged": [
                "« La persévérance n'est pas une longue course, c'est plusieurs courses courtes. » - Walter Elliot",
                "« Chaque expert était autrefois un débutant. » - Helen Hayes",
            ],
            "moderate": [
                "« Le secret pour avancer, c'est de commencer. » - Mark Twain",
                "« Petit à petit, l'oiseau fait son nid. Et l'écureuil sa réserve ! 🌰 » - Spark",
            ],
            "low": [
                "« Ce n'est pas parce que c'est difficile que tu n'oses pas, c'est parce que tu n'oses pas que c'est difficile. » - Sénèque",
                "« Hey, même les plus grands ont des jours sans. L'important c'est de revenir ! » - Spark 🐿️💪",
            ]
        }

        import random
        return random.choice(quotes.get(engagement, quotes["moderate"]))

    async def generate_proactive_notification(
        self,
        db: AsyncSession,
        user: User,
        notification_type: str,
        context: Dict = None
    ) -> Optional[SparkNotification]:
        """
        Génère une notification proactive de Spark
        Types: streak_warning, exam_reminder, encouragement, comeback, milestone
        """
        context = context or {}

        # Templates de notifications
        templates = {
            "streak_warning": {
                "title": "⚠️ Ton streak est en danger !",
                "mood": SparkMoodType.WORRIED,
                "action_type": "open_flashcards"
            },
            "streak_lost": {
                "title": "😢 Streak perdu...",
                "mood": SparkMoodType.SAD,
                "action_type": "start_new_streak"
            },
            "exam_reminder": {
                "title": "📅 Exam dans {days} jours",
                "mood": SparkMoodType.ENCOURAGING,
                "action_type": "open_subject"
            },
            "comeback": {
                "title": "Tu nous manques ! 🥺",
                "mood": SparkMoodType.SAD,
                "action_type": "open_app"
            },
            "milestone": {
                "title": "🎉 Bravo !",
                "mood": SparkMoodType.EXCITED,
                "action_type": "view_achievement"
            },
            "daily_reminder": {
                "title": "📚 C'est l'heure !",
                "mood": SparkMoodType.HAPPY,
                "action_type": "open_flashcards"
            }
        }

        template = templates.get(notification_type)
        if not template:
            return None

        # Générer le message avec l'IA
        message = await self._generate_notification_message(
            user, notification_type, context
        )

        notification = SparkNotification(
            user_id=user.id,
            notification_type=notification_type,
            title=template["title"].format(**context),
            message=message,
            mood=template["mood"],
            action_type=template["action_type"],
            action_data=context
        )

        db.add(notification)
        await db.commit()
        await db.refresh(notification)

        return notification

    async def _generate_notification_message(
        self,
        user: User,
        notification_type: str,
        context: Dict
    ) -> str:
        """Génère le message de notification avec l'IA"""
        user_lang = user.language if user else "fr"

        if not async_client:
            return self._get_fallback_notification(notification_type, context, lang=user_lang)

        lang_instruction = get_language_instruction(user_lang)

        system_prompt = f"""Tu es Spark, l'écureuil mascotte sarcastique mais bienveillant de Study Master.

RÈGLES:
- 1-2 phrases MAX
- Ton attachant et taquin (style Duo de Duolingo)
- 1 émoji max
- Tu peux briser le 4ème mur ou être passive-aggressive (gentiment)

EXEMPLES PAR TYPE:
- streak_warning: "Psst... tu oublierais pas quelque chose ? Ton streak me regarde avec des yeux tristes 🥺"
- comeback: "Coucou... ça fait 3 jours. Je commençais à croire que tu m'avais oublié 😏"
- milestone: "MAIS C'EST QUE TU GÈRES LÀ ! 100 XP d'un coup ! 🔥"
- exam_reminder: "Ton exam de maths dans 3 jours te fait coucou. On révise ? 📚"

{lang_instruction}"""

        prompt = f"""Génère une notification "{notification_type}" pour {user.username}.
Contexte: {json.dumps(context, ensure_ascii=False)}

Message (1-2 phrases, 1 émoji max):"""

        try:
            message = await async_client.messages.create(
                model=self.model,
                max_tokens=100,
                temperature=0.9,
                system=system_prompt,
                messages=[{"role": "user", "content": prompt}]
            )

            return message.content[0].text.strip()

        except Exception as e:
            logger.error(f"Erreur génération notification: {e}")
            return self._get_fallback_notification(notification_type, context, lang=user_lang)

    def _get_fallback_notification(
        self,
        notification_type: str,
        context: Dict,
        lang: str = "fr"
    ) -> str:
        """Message de fallback pour notifications"""
        fallbacks = {
            "fr": {
                "streak_warning": "Ton streak est en danger ! Viens vite réviser 🐿️",
                "comeback": "Hey ! Tu me manques... On révise ensemble ? 🥺",
                "milestone": "Félicitations ! Tu progresses super bien ! 🎉",
                "exam_reminder": "N'oublie pas ton exam qui approche ! 📚",
                "daily_reminder": "C'est l'heure de ta session quotidienne ! ⚡",
                "default": "Spark a un message pour toi ! 🐿️"
            },
            "en": {
                "streak_warning": "Your streak is in danger! Come revise quickly 🐿️",
                "comeback": "Hey! I miss you... Shall we study together? 🥺",
                "milestone": "Congratulations! You're making great progress! 🎉",
                "exam_reminder": "Don't forget your upcoming exam! 📚",
                "daily_reminder": "It's time for your daily session! ⚡",
                "default": "Spark has a message for you! 🐿️"
            }
        }
        lang_fallbacks = fallbacks.get(lang, fallbacks["fr"])
        return lang_fallbacks.get(notification_type, lang_fallbacks["default"])

    async def store_memory(
        self,
        db: AsyncSession,
        user: User,
        memory_type: str,
        key: str,
        value: Any,
        source: str = "observation"
    ):
        """
        Stocke une information dans la mémoire long-terme de Spark
        """
        # Vérifier si la mémoire existe déjà
        existing = await db.execute(
            select(SparkMemory).where(
                and_(
                    SparkMemory.user_id == user.id,
                    SparkMemory.key == key
                )
            )
        )
        memory = existing.scalar_one_or_none()

        if memory:
            memory.value = value
            memory.source = source
            memory.updated_at = datetime.now(timezone.utc)
            memory.last_used_at = datetime.now(timezone.utc)
        else:
            memory = SparkMemory(
                user_id=user.id,
                memory_type=memory_type,
                key=key,
                value=value,
                source=source
            )
            db.add(memory)

        await db.commit()
        return memory

    async def get_memories(
        self,
        db: AsyncSession,
        user: User,
        memory_type: str = None
    ) -> List[SparkMemory]:
        """
        Récupère les mémoires de Spark sur l'utilisateur
        """
        query = select(SparkMemory).where(SparkMemory.user_id == user.id)

        if memory_type:
            query = query.where(SparkMemory.memory_type == memory_type)

        result = await db.execute(query.order_by(SparkMemory.updated_at.desc()))
        return result.scalars().all()


# Instance globale
spark_intelligence = SparkIntelligenceService()
