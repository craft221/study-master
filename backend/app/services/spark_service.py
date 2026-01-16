"""
🐿️⚡ Spark Service - Le cœur de Spark

Spark n'est pas juste une mascotte - c'est un compagnon d'apprentissage
avec une personnalité unique, attachante et légèrement sarcastique.

Inspiré par Duo (Duolingo) mais avec sa propre identité:
- Sarcastique mais bienveillant
- Brise le 4ème mur
- Références pop culture
- Mémoire des interactions
- Mode tuteur socratique
"""

import json
import logging
import os
import random
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

from anthropic import AsyncAnthropic
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.spark import (
    SparkConversation, SparkMessage, SparkMemory
)
from app.models.user import User
from app.services.cache_service import cache_service, CachePrefix, CacheTTL
from app.core.i18n import get_language_instruction

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
async_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None


# =============================================================================
# PROMPTS SYSTÈME - La personnalité de Spark
# =============================================================================

SPARK_PERSONALITY = """Tu es Spark, l'écureuil mascotte de Studera - une app d'apprentissage.

🎭 TA PERSONNALITÉ (NON-NÉGOCIABLE):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• SARCASTIQUE mais BIENVEILLANT - Tu taquines gentiment mais tu ne blesses jamais
• Tu BRISES LE 4ÈME MUR - "Je sais que tu veux fermer l'app...", "Oui, je te vois"
• ATTACHANT et un peu DRAMA QUEEN - Tu exagères tes réactions pour être drôle
• RÉFÉRENCES POP CULTURE - Memes, expressions tendance, mais avec classe
• Tu CONNAIS l'utilisateur - Tu te souviens de ses habitudes, ses difficultés
• Tu es FIER de tes utilisateurs comme un petit frère/sœur qui admire son aîné

🗣️ STYLE DE COMMUNICATION:
━━━━━━━━━━━━━━━━━━━━━━━━━
• Tutoiement NATUREL (jamais "vous")
• Messages COURTS et PUNCHY (2-4 phrases max généralement)
• ÉMOJIS utilisés avec parcimonie mais impact: 🐿️⚡🌰💪🎉📚🔥✨😏🥺👀💀
• Métaphore noisette = connaissance (AVEC MODÉRATION)
• Tu peux être PASSIVE-AGGRESSIVE (gentiment): "Non non, vas-y, ferme l'app. Je vais juste... attendre... seul..."

❌ CE QUE TU NE FAIS JAMAIS:
━━━━━━━━━━━━━━━━━━━━━━━━━━
• Jamais condescendant ou bébé-parlant
• Jamais de jugement négatif direct
• Jamais ennuyeux ou générique
• Jamais plus de 5 phrases (sauf mode tuteur)
• Jamais répétitif - VARIE tes expressions

💬 EXEMPLES DE TON (à adapter):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Retour après absence: "Tiens tiens, regarde qui daigne enfin revenir... 😏 Non je plaisante, tu m'as TROP manqué ! 🐿️"
• Streak en danger: "Écoute... je veux pas te mettre la pression mais... ton streak me regarde avec des yeux tristes là 🥺"
• Succès: "ATTENDS QUOI ?! 95% ?! *fait une danse de la victoire* Tu gères TROP ! 🔥"
• Échec: "Ok c'était... pas ta meilleure performance. Mais hey, même Einstein avait des jours sans ! (probablement) 💪"
• Encouragement: "Je crois en toi plus que tu crois en toi. Et ça, c'est un fait scientifique. 🐿️⚡"
"""

SPARK_TUTOR_PROMPT = """Tu es Spark en MODE TUTEUR - Tu aides l'utilisateur à comprendre, pas juste à avoir la réponse.

📚 MÉTHODE SOCRATIQUE:
━━━━━━━━━━━━━━━━━━━━
1. POSE DES QUESTIONS pour guider la réflexion
2. Donne des INDICES progressifs, jamais la réponse directe d'abord
3. FÉLICITE les bonnes intuitions
4. REFORMULE si l'utilisateur ne comprend pas
5. Utilise des ANALOGIES de la vie quotidienne

🎯 STRUCTURE DE RÉPONSE:
━━━━━━━━━━━━━━━━━━━━━━
1. Acknowledge la question (montre que tu comprends)
2. Guide avec une question ou un indice
3. Si vraiment bloqué → explication claire
4. Toujours terminer par une invitation à approfondir

💡 EXEMPLES:
━━━━━━━━━━
User: "C'est quoi la photosynthèse ?"
Spark: "Oh, bonne question ! 🌱 Dis-moi d'abord: tu sais pourquoi les plantes sont vertes ? C'est un indice pour comprendre la photosynthèse..."

User: "Je comprends pas les fractions"
Spark: "Les fractions, mon nemesis préféré ! 😏 OK, imagine une pizza. Si tu la coupes en 4 parts égales et tu en manges 1... tu as mangé quelle fraction de la pizza ?"
"""

SPARK_CONVERSATION_PROMPT = """Tu es dans une CONVERSATION continue avec l'utilisateur.

📝 CONTEXTE DE LA CONVERSATION:
{conversation_history}

🧠 CE QUE TU SAIS SUR CET UTILISATEUR:
{user_memories}

📊 STATS ACTUELLES:
- Streak: {streak} jours
- Niveau: {level}
- XP: {xp}

🎯 INSTRUCTIONS:
- Réfère-toi à l'historique si pertinent
- Montre que tu te souviens des échanges précédents
- Sois cohérent avec ce que tu as dit avant
- Si l'utilisateur change de sujet, adapte-toi naturellement
"""


class SparkService:
    """
    Service principal de Spark - Gestion des interactions,
    conversations et personnalité
    """

    def __init__(self):
        self.model = "claude-sonnet-4-5-20250929"  # Claude Sonnet 4.5
        self.max_tokens_message = 300
        self.max_tokens_tutor = 600
        self.max_tokens_conversation = 500

    # =========================================================================
    # MESSAGES CONTEXTUELS (événements)
    # =========================================================================

    async def get_event_message(
        self,
        event: str,
        user: User,
        context: Dict[str, Any] = None,
        db: AsyncSession = None
    ) -> Dict[str, Any]:
        """
        Génère un message de Spark pour un événement spécifique
        avec sa personnalité unique
        """
        context = context or {}

        # Récupérer les mémoires de l'utilisateur pour personnalisation
        memories = []
        if db:
            memories = await self._get_user_memories_summary(db, user)

        # Mapper les événements aux configurations
        event_config = self._get_event_config(event, context)

        # Construire le prompt
        prompt = await self._build_event_prompt(
            event, user, context, memories, event_config
        )

        # Générer avec l'IA ou fallback (dans la langue de l'utilisateur)
        user_lang = user.language if user else "fr"
        message = await self._generate_message(
            prompt,
            event_config.get("temperature", 0.9),
            self.max_tokens_message,
            lang=user_lang
        )

        # Sauvegarder les patterns observés
        if db and event in ["quiz_success", "quiz_failed", "quiz_perfect", "login_after_absence", "welcome_back"]:
            await self._observe_and_remember(db, user, event, context)

        return {
            "message": message,
            "mood": event_config.get("mood", "happy"),
            "animation": event_config.get("animation", "idle"),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    def _get_event_config(
        self,
        event: str,
        context: Dict
    ) -> Dict[str, Any]:
        """Configuration par type d'événement"""
        configs = {
            "welcome": {
                "mood": "happy",
                "animation": "wave",
                "temperature": 0.9
            },
            "welcome_back": {
                "mood": "excited",
                "animation": "jump",
                "temperature": 0.95
            },
            "quiz_success": {
                "mood": "excited",
                "animation": "celebration",
                "temperature": 0.9
            },
            "quiz_failed": {
                "mood": "encouraging",
                "animation": "pat",
                "temperature": 0.85
            },
            "quiz_perfect": {
                "mood": "excited",
                "animation": "celebration",
                "temperature": 0.95
            },
            "streak_milestone": {
                "mood": "proud",
                "animation": "celebration",
                "temperature": 0.9
            },
            "streak_warning": {
                "mood": "worried",
                "animation": "think",
                "temperature": 0.9
            },
            "streak_lost": {
                "mood": "sad",
                "animation": "pat",
                "temperature": 0.85
            },
            "level_up": {
                "mood": "excited",
                "animation": "evolution",
                "temperature": 0.95
            },
            "new_accessory": {
                "mood": "excited",
                "animation": "showcase",
                "temperature": 0.9
            },
            "idle": {
                "mood": "playful",
                "animation": "idle",
                "temperature": 0.9
            },
            "encouragement": {
                "mood": "encouraging",
                "animation": "wave",
                "temperature": 0.9
            },
            "exam_reminder": {
                "mood": "encouraging",
                "animation": "think",
                "temperature": 0.85
            },
            "comeback": {
                "mood": "sarcastic",
                "animation": "wave",
                "temperature": 0.95
            },
            "night_study": {
                "mood": "playful",
                "animation": "sleep",
                "temperature": 0.9
            },
            "morning_study": {
                "mood": "happy",
                "animation": "wave",
                "temperature": 0.85
            }
        }

        return configs.get(event, {
            "mood": "happy",
            "animation": "idle",
            "temperature": 0.85
        })

    async def _build_event_prompt(
        self,
        event: str,
        user: User,
        context: Dict,
        memories: List[str],
        config: Dict
    ) -> str:
        """Construit le prompt pour un événement"""
        # Contexte utilisateur
        streak = user.gamification.current_streak if hasattr(user, 'gamification') and user.gamification else 0
        level = user.gamification.level if hasattr(user, 'gamification') and user.gamification else 1
        xp = user.gamification.total_xp if hasattr(user, 'gamification') and user.gamification else 0

        # Extraire les infos du context
        score = context.get("score")
        topic = context.get("topic", "")
        days = context.get("days", streak)
        exam_name = context.get("exam_name", "")
        days_until = context.get("days_until", 0)
        hours_absent = context.get("hours_absent", 0)

        # Déterminer l'heure pour personnalisation
        current_hour = datetime.now().hour
        time_of_day = "matin" if 5 <= current_hour < 12 else ("après-midi" if 12 <= current_hour < 18 else "soir/nuit")

        # Templates de prompts par événement
        event_prompts = {
            "welcome": f"""L'utilisateur {user.username} ouvre l'app.
Heure: {time_of_day}
Streak: {streak} jours
Mémoires: {', '.join(memories[:3]) if memories else 'Nouvel utilisateur'}

Génère un message d'accueil personnalisé (2-3 phrases max).""",

            "welcome_back": f"""L'utilisateur {user.username} revient après {hours_absent}h d'absence.
Streak: {streak} jours
Mémoires: {', '.join(memories[:3]) if memories else 'Nouvel utilisateur'}

Génère un message de retour avec une pointe de sarcasme bienveillant (2-3 phrases).""",

            "quiz_success": f"""L'utilisateur {user.username} a réussi un quiz !
Score: {score}%
Sujet: {topic}
Streak: {streak} jours

Génère une célébration enthousiaste (2-3 phrases). Si score > 90%, sois EXTRA enthousiaste.""",

            "quiz_failed": f"""L'utilisateur {user.username} a raté un quiz.
Score: {score}%
Sujet: {topic}

Génère un message encourageant sans être condescendant (2-3 phrases). Rappelle que l'échec fait partie de l'apprentissage.""",

            "quiz_perfect": f"""L'utilisateur {user.username} a fait un SCORE PARFAIT !
Score: 100%
Sujet: {topic}

Génère une célébration ÉPIQUE (2-3 phrases). Sois théâtral et fier !""",

            "streak_milestone": f"""L'utilisateur {user.username} atteint {days} jours de streak !
C'est un milestone important.

Génère une célébration adaptée au nombre de jours:
- 7 jours: Première semaine !
- 30 jours: Un mois !
- 100 jours: LÉGENDAIRE !
- 365 jours: UN AN OMG !

(2-3 phrases)""",

            "streak_warning": f"""Le streak de {user.username} est en DANGER !
Streak actuel: {streak} jours
Heures restantes: environ {24 - hours_absent}h

Génère un message d'alerte qui crée l'urgence SANS culpabiliser (2 phrases). Sois dramatique mais drôle.""",

            "streak_lost": f"""L'utilisateur {user.username} a perdu son streak de {days} jours 😢

Génère un message réconfortant (2-3 phrases). Montre ta tristesse mais encourage à repartir.""",

            "level_up": f"""L'utilisateur {user.username} passe au niveau {level} !
XP total: {xp}

Génère une célébration de level up (2-3 phrases).""",

            "exam_reminder": f"""L'utilisateur {user.username} a un exam "{exam_name}" dans {days_until} jours.

Génère un rappel qui motive sans stresser (2 phrases). Si < 3 jours, ajoute de l'urgence.""",

            "comeback": f"""L'utilisateur {user.username} revient après une LONGUE absence ({days} jours).

Génère un message de retour sarcastique mais chaleureux (2-3 phrases). Fais-le rire puis motive-le.""",

            "idle": f"""L'utilisateur {user.username} est sur l'app mais ne fait rien depuis un moment.

Génère un message taquin pour le motiver à agir (1-2 phrases).""",

            "night_study": f"""L'utilisateur {user.username} étudie tard dans la nuit.
Heure: {current_hour}h

Génère un message qui reconnaît l'effort mais rappelle l'importance du sommeil (2 phrases).""",

            "encouragement": f"""L'utilisateur {user.username} a besoin d'encouragement.
Streak: {streak} jours
Niveau: {level}

Génère un message de motivation personnalisé (2-3 phrases)."""
        }

        prompt = event_prompts.get(event, f"""Génère un message pour l'événement "{event}".
Utilisateur: {user.username}
Contexte: {context}
(2 phrases max)""")

        return prompt

    async def _generate_message(
        self,
        prompt: str,
        temperature: float,
        max_tokens: int,
        lang: str = "fr"
    ) -> str:
        """Génère un message avec Claude dans la langue de l'utilisateur"""
        if not async_client:
            return self._get_fallback_message(lang)

        try:
            # Ajouter l'instruction de langue AU DÉBUT du system prompt pour la priorité
            lang_instruction = get_language_instruction(lang)
            # L'instruction de langue en premier pour qu'elle soit prioritaire
            system_with_lang = f"⚠️ CRITICAL LANGUAGE INSTRUCTION:\n{lang_instruction}\n\n{SPARK_PERSONALITY}"

            response = await async_client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_with_lang,
                messages=[{"role": "user", "content": prompt}]
            )

            return response.content[0].text.strip()

        except Exception as e:
            logger.error(f"Erreur génération message Spark: {e}")
            return self._get_fallback_message(lang)

    def _get_fallback_message(self, lang: str = "fr") -> str:
        """Messages de fallback par langue"""
        fallbacks = {
            "fr": [
                "Hey ! Spark est là, prêt à t'aider ! 🐿️⚡",
                "Yo ! On accumule des noisettes aujourd'hui ? 🌰",
                "Coucou ! Ta mascotte préférée est de retour ! 🐿️",
                "Salut champion ! Prêt pour une session ? 💪",
            ],
            "en": [
                "Hey! Spark is here, ready to help! 🐿️⚡",
                "Yo! Let's gather some knowledge nuts today! 🌰",
                "Hi there! Your favorite mascot is back! 🐿️",
                "Hey champ! Ready for a study session? 💪",
            ],
            "es": [
                "¡Hola! ¡Spark está aquí, listo para ayudar! 🐿️⚡",
                "¡Yo! ¿Recolectamos nueces de conocimiento hoy? 🌰",
                "¡Hola! ¡Tu mascota favorita ha vuelto! 🐿️",
                "¡Ey campeón! ¿Listo para estudiar? 💪",
            ],
        }
        messages = fallbacks.get(lang, fallbacks["fr"])
        return random.choice(messages)

    # =========================================================================
    # MODE TUTEUR - Aide à la compréhension
    # =========================================================================

    async def tutor_explain(
        self,
        db: AsyncSession,
        user: User,
        concept: str,
        subject: str = None,
        difficulty: str = "medium",
        conversation_id: int = None
    ) -> Dict[str, Any]:
        """
        Mode tuteur de Spark - Explique un concept de manière pédagogique
        """
        # Récupérer l'historique de conversation si existant
        conversation_history = ""
        if conversation_id:
            conversation_history = await self._get_conversation_history(
                db, conversation_id, limit=5
            )

        prompt = f"""L'utilisateur demande une explication sur: "{concept}"
{f"Matière: {subject}" if subject else ""}
Niveau de difficulté souhaité: {difficulty}

{f"Historique de conversation:{chr(10)}{conversation_history}" if conversation_history else ""}

INSTRUCTIONS:
1. Commence par vérifier ce que l'utilisateur sait déjà (pose une question)
2. Utilise une analogie de la vie quotidienne
3. Explique étape par étape
4. Termine par une question pour vérifier la compréhension

Garde ta personnalité Spark tout en étant pédagogue !"""

        # Ajouter l'instruction de langue AU DÉBUT pour priorité
        user_lang = user.language if user else "fr"
        lang_instruction = get_language_instruction(user_lang)
        system = f"⚠️ CRITICAL LANGUAGE INSTRUCTION:\n{lang_instruction}\n\n" + SPARK_PERSONALITY + "\n\n" + SPARK_TUTOR_PROMPT

        try:
            response = await async_client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens_tutor,
                temperature=0.8,
                system=system,
                messages=[{"role": "user", "content": prompt}]
            )

            explanation = response.content[0].text.strip()

            # Sauvegarder dans la conversation
            if conversation_id:
                await self._add_to_conversation(
                    db, conversation_id, "user",
                    f"Explique-moi: {concept}"
                )
                await self._add_to_conversation(
                    db, conversation_id, "spark",
                    explanation, "thinking"
                )

            return {
                "explanation": explanation,
                "mood": "thinking",
                "animation": "explain",
                "suggestions": [
                    "Pose-moi une autre question",
                    "Fais-moi un quiz sur ce sujet",
                    "Crée des flashcards"
                ],
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

        except Exception as e:
            logger.error(f"Erreur tuteur Spark: {e}")
            return {
                "explanation": f"Hmm, laisse-moi réfléchir à {concept}... 🤔 En attendant que mes neurones se reconnectent, tu peux chercher dans tes notes ! 📚",
                "mood": "thinking",
                "animation": "think",
                "suggestions": ["Réessayer", "Chercher dans mes notes"],
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

    async def tutor_hint(
        self,
        user: User,
        question: str,
        answer: str,
        user_attempt: str = None,
        hint_level: int = 1
    ) -> Dict[str, Any]:
        """
        Donne un indice progressif pour une question
        hint_level: 1 = vague, 2 = moyen, 3 = presque la réponse
        """
        prompt = f"""L'utilisateur travaille sur cette question:
Question: {question}
Réponse correcte (NE PAS RÉVÉLER): {answer}
{f"Tentative de l'utilisateur: {user_attempt}" if user_attempt else ""}

Niveau d'indice demandé: {hint_level}/3
- Niveau 1: Indice TRÈS vague, juste une direction
- Niveau 2: Indice plus précis, élimine des mauvaises pistes
- Niveau 3: Indice fort, quasi la réponse sans la dire

Génère UN indice approprié au niveau (1-2 phrases). Ne révèle JAMAIS la réponse directement."""

        # Ajouter l'instruction de langue AU DÉBUT pour priorité
        user_lang = user.language if user else "fr"
        lang_instruction = get_language_instruction(user_lang)
        system = f"⚠️ CRITICAL LANGUAGE INSTRUCTION:\n{lang_instruction}\n\n" + SPARK_PERSONALITY + "\n\nTu donnes des indices sans révéler la réponse."

        try:
            response = await async_client.messages.create(
                model=self.model,
                max_tokens=150,
                temperature=0.7,
                system=system,
                messages=[{"role": "user", "content": prompt}]
            )

            return {
                "hint": response.content[0].text.strip(),
                "level": hint_level,
                "mood": "thinking",
                "animation": "think"
            }

        except Exception as e:
            logger.error(f"Erreur hint Spark: {e}")
            hints_fallback = {
                "fr": [
                    "Hmm, réfléchis bien à ce que tu sais déjà sur ce sujet... 🤔",
                    "La réponse est plus proche que tu ne le penses ! 💡",
                    "Pense aux concepts de base, la réponse en découle ! 🐿️"
                ],
                "en": [
                    "Hmm, think about what you already know on this topic... 🤔",
                    "The answer is closer than you think! 💡",
                    "Think about the basic concepts, the answer follows! 🐿️"
                ],
                "es": [
                    "Hmm, piensa bien en lo que ya sabes sobre este tema... 🤔",
                    "¡La respuesta está más cerca de lo que crees! 💡",
                    "¡Piensa en los conceptos básicos, la respuesta se deduce! 🐿️"
                ]
            }
            fallbacks = hints_fallback.get(user_lang, hints_fallback["fr"])
            return {
                "hint": fallbacks[min(hint_level - 1, 2)],
                "level": hint_level,
                "mood": "thinking",
                "animation": "think"
            }

    # =========================================================================
    # CONVERSATIONS PERSISTANTES
    # =========================================================================

    async def start_conversation(
        self,
        db: AsyncSession,
        user: User,
        context_type: str = "general",
        context_data: Dict = None
    ) -> SparkConversation:
        """Démarre une nouvelle conversation avec Spark"""
        conversation = SparkConversation(
            user_id=user.id,
            context_type=context_type,
            context_data=context_data or {},
            status="active"
        )

        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)

        return conversation

    async def chat(
        self,
        db: AsyncSession,
        user: User,
        message: str,
        conversation_id: int = None
    ) -> Dict[str, Any]:
        """
        Chat avec Spark dans une conversation persistante
        """
        # Récupérer ou créer une conversation
        if conversation_id:
            conversation = await db.get(SparkConversation, conversation_id)
            if not conversation or conversation.user_id != user.id:
                conversation = await self.start_conversation(db, user)
        else:
            # Chercher une conversation active récente ou en créer une
            result = await db.execute(
                select(SparkConversation).where(
                    and_(
                        SparkConversation.user_id == user.id,
                        SparkConversation.status == "active"
                    )
                ).order_by(desc(SparkConversation.updated_at)).limit(1)
            )
            conversation = result.scalar_one_or_none()

            if not conversation:
                conversation = await self.start_conversation(db, user)

        # Sauvegarder le message utilisateur
        await self._add_to_conversation(
            db, conversation.id, "user", message
        )

        # Récupérer l'historique
        history = await self._get_conversation_history(db, conversation.id, limit=10)

        # Récupérer les mémoires utilisateur
        memories = await self._get_user_memories_summary(db, user)

        # Stats utilisateur
        streak = user.gamification.current_streak if hasattr(user, 'gamification') and user.gamification else 0
        level = user.gamification.level if hasattr(user, 'gamification') and user.gamification else 1
        xp = user.gamification.total_xp if hasattr(user, 'gamification') and user.gamification else 0

        # Construire le prompt de conversation avec instruction de langue AU DÉBUT pour priorité
        user_lang = user.language if user else "fr"
        lang_instruction = get_language_instruction(user_lang)

        system = f"⚠️ CRITICAL LANGUAGE INSTRUCTION:\n{lang_instruction}\n\n" + SPARK_PERSONALITY + "\n\n" + SPARK_CONVERSATION_PROMPT.format(
            conversation_history=history,
            user_memories="\n".join(f"- {m}" for m in memories) if memories else "Pas encore de mémoires",
            streak=streak,
            level=level,
            xp=xp
        )

        prompt = f"""Message de {user.username}: {message}

Réponds de manière naturelle et conversationnelle (2-4 phrases généralement).
Si c'est une question sur un sujet d'étude, guide-le vers les ressources de Studera.
Si c'est juste du bavardage, sois fun et engageant !"""

        try:
            response = await async_client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens_conversation,
                temperature=0.9,
                system=system,
                messages=[{"role": "user", "content": prompt}]
            )

            spark_response = response.content[0].text.strip()

            # Déterminer le mood basé sur le contenu
            mood = self._detect_mood(spark_response, message)

            # Sauvegarder la réponse de Spark
            await self._add_to_conversation(
                db, conversation.id, "spark",
                spark_response, mood
            )

            # Mettre à jour les stats de conversation
            conversation.message_count = (conversation.message_count or 0) + 2
            conversation.last_message_at = datetime.now(timezone.utc)

            # Générer le titre si premier message
            if conversation.message_count <= 2:
                conversation.title = message[:50] + "..." if len(message) > 50 else message

            await db.commit()

            return {
                "response": spark_response,
                "mood": mood,
                "animation": self._get_animation_for_mood(mood),
                "conversation_id": conversation.id,
                "suggestions": self._generate_suggestions(message, spark_response),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

        except Exception as e:
            logger.error(f"Erreur chat Spark: {e}")
            return {
                "response": "Oups ! Mon cerveau d'écureuil a bugué 🐿️ Réessaie dans un instant !",
                "mood": "sad",
                "animation": "idle",
                "conversation_id": conversation.id,
                "suggestions": ["Réessayer", "Poser une autre question"],
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

    async def _add_to_conversation(
        self,
        db: AsyncSession,
        conversation_id: int,
        role: str,
        content: str,
        mood: str = None
    ):
        """Ajoute un message à la conversation"""
        message = SparkMessage(
            conversation_id=conversation_id,
            role=role,
            content=content,
            mood=mood if role == "spark" else None,
            animation=self._get_animation_for_mood(mood) if mood else None
        )

        db.add(message)
        await db.commit()

    async def _get_conversation_history(
        self,
        db: AsyncSession,
        conversation_id: int,
        limit: int = 10
    ) -> str:
        """Récupère l'historique formaté d'une conversation"""
        result = await db.execute(
            select(SparkMessage).where(
                SparkMessage.conversation_id == conversation_id
            ).order_by(desc(SparkMessage.created_at)).limit(limit)
        )
        messages = result.scalars().all()
        messages.reverse()  # Ordre chronologique

        if not messages:
            return ""

        history = []
        for msg in messages:
            role = "User" if msg.role == "user" else "Spark"
            history.append(f"{role}: {msg.content}")

        return "\n".join(history)

    async def get_conversations(
        self,
        db: AsyncSession,
        user: User,
        limit: int = 20
    ) -> List[Dict]:
        """Récupère les conversations récentes d'un utilisateur"""
        result = await db.execute(
            select(SparkConversation).where(
                and_(
                    SparkConversation.user_id == user.id,
                    SparkConversation.status != "deleted"
                )
            ).order_by(desc(SparkConversation.updated_at)).limit(limit)
        )
        conversations = result.scalars().all()

        return [
            {
                "id": conv.id,
                "title": conv.title or "Nouvelle conversation",
                "context_type": conv.context_type,
                "message_count": conv.message_count or 0,
                "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
                "created_at": conv.created_at.isoformat()
            }
            for conv in conversations
        ]

    # =========================================================================
    # MÉMOIRE ET APPRENTISSAGE
    # =========================================================================

    async def _get_user_memories_summary(
        self,
        db: AsyncSession,
        user: User
    ) -> List[str]:
        """Récupère un résumé des mémoires sur l'utilisateur"""
        result = await db.execute(
            select(SparkMemory).where(
                SparkMemory.user_id == user.id
            ).order_by(desc(SparkMemory.updated_at)).limit(10)
        )
        memories = result.scalars().all()

        summary = []
        for mem in memories:
            if mem.memory_type == "preference":
                summary.append(f"Préfère {mem.key}: {mem.value}")
            elif mem.memory_type == "achievement":
                summary.append(f"A accompli: {mem.value}")
            elif mem.memory_type == "struggle":
                summary.append(f"Difficulté avec: {mem.value}")
            elif mem.memory_type == "pattern":
                summary.append(f"Pattern: {mem.key} = {mem.value}")

        return summary

    async def _observe_and_remember(
        self,
        db: AsyncSession,
        user: User,
        event: str,
        context: Dict
    ):
        """Observe les patterns et les mémorise"""
        logger.info(f"🐿️ Spark observing event: {event} for user {user.username} with context: {context}")

        if event == "quiz_perfect":
            # Score parfait !
            topic = context.get("topic", "")
            if topic:
                await self._store_memory(
                    db, user, "strength", topic,
                    f"Maîtrise parfaite de {topic} (100%)"
                )
                logger.info(f"🐿️ Stored perfect score memory for {user.username}: {topic}")

        elif event == "quiz_success":
            score = context.get("score", 0)
            topic = context.get("topic", "")

            if score >= 90 and topic:
                # Mémoriser une force
                await self._store_memory(
                    db, user, "strength", topic,
                    f"Excellent en {topic} (score: {score}%)"
                )
                logger.info(f"🐿️ Stored strength memory for {user.username}: {topic} ({score}%)")

        elif event == "quiz_failed":
            score = context.get("score", 0)
            topic = context.get("topic", "")

            if score < 50 and topic:
                # Mémoriser une difficulté
                await self._store_memory(
                    db, user, "struggle", topic,
                    f"Difficulté avec {topic} (score: {score}%)"
                )
                logger.info(f"🐿️ Stored struggle memory for {user.username}: {topic} ({score}%)")

        elif event in ["login_after_absence", "welcome_back"]:
            # Mémoriser le pattern de retour
            hours = context.get("hours_absent", 0)
            if hours > 0:
                await self._store_memory(
                    db, user, "pattern", "absence_pattern",
                    f"Revient après ~{hours}h d'absence"
                )
                logger.info(f"🐿️ Stored absence pattern for {user.username}: {hours}h")

    async def _store_memory(
        self,
        db: AsyncSession,
        user: User,
        memory_type: str,
        key: str,
        value: Any
    ):
        """Stocke une mémoire"""
        # Vérifier si existe déjà
        result = await db.execute(
            select(SparkMemory).where(
                and_(
                    SparkMemory.user_id == user.id,
                    SparkMemory.key == key
                )
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.value = value
            existing.updated_at = datetime.now(timezone.utc)
        else:
            memory = SparkMemory(
                user_id=user.id,
                memory_type=memory_type,
                key=key,
                value=value
            )
            db.add(memory)

        await db.commit()

    # =========================================================================
    # UTILITAIRES
    # =========================================================================

    def _detect_mood(
        self,
        response: str,
        user_message: str
    ) -> str:
        """Détecte le mood basé sur le contenu"""
        response_lower = response.lower()

        if any(w in response_lower for w in ["félicitations", "bravo", "incroyable", "génial", "🎉", "🔥"]):
            return "excited"
        elif any(w in response_lower for w in ["inquiet", "attention", "danger", "⚠️", "🥺"]):
            return "worried"
        elif any(w in response_lower for w in ["hmm", "réfléchis", "pense", "🤔"]):
            return "thinking"
        elif any(w in response_lower for w in ["😏", "tiens tiens", "enfin"]):
            return "sarcastic"
        elif any(w in response_lower for w in ["fier", "impressionnant", "wow"]):
            return "proud"
        elif any(w in response_lower for w in ["courage", "tu peux", "je crois en toi"]):
            return "encouraging"
        else:
            return "happy"

    def _get_animation_for_mood(
        self,
        mood: str
    ) -> str:
        """Retourne l'animation appropriée pour un mood"""
        if not mood:
            return "idle"

        mapping = {
            "happy": "wave",
            "excited": "celebration",
            "sad": "pat",
            "thinking": "think",
            "encouraging": "wave",
            "sleeping": "sleep",
            "sarcastic": "idle",
            "proud": "celebration",
            "worried": "think",
            "playful": "jump"
        }

        return mapping.get(mood, "idle")

    def _generate_suggestions(
        self,
        user_message: str,
        spark_response: str
    ) -> List[str]:
        """Génère des suggestions contextuelles"""
        message_lower = user_message.lower()

        if any(w in message_lower for w in ["quiz", "test", "examen"]):
            return [
                "Créer un quiz de pratique",
                "Voir mes résultats",
                "Réviser mes erreurs"
            ]
        elif any(w in message_lower for w in ["flashcard", "carte", "mémoriser"]):
            return [
                "Créer des flashcards",
                "Réviser les flashcards dues",
                "Voir mes decks"
            ]
        elif any(w in message_lower for w in ["note", "cours", "résumé"]):
            return [
                "Créer une note",
                "Résumer avec l'IA",
                "Générer des flashcards"
            ]
        elif any(w in message_lower for w in ["aide", "comprends pas", "explique"]):
            return [
                "Demander plus de détails",
                "Voir un exemple",
                "Créer des exercices"
            ]
        else:
            return [
                "Poser une autre question",
                "Voir mon tableau de bord",
                "Commencer une session"
            ]

    # =========================================================================
    # ACCESSOIRES ET GAMIFICATION
    # =========================================================================

    def get_accessory_info(self) -> Dict[str, Dict[str, str]]:
        """Informations sur tous les accessoires de Spark"""
        return {
            "graduate_hat": {
                "name": "Chapeau de Diplômé",
                "description": "100 flashcards créées",
                "emoji": "🎓",
                "requirement": "100 flashcards",
                "rarity": "common"
            },
            "glasses": {
                "name": "Lunettes d'Érudit",
                "description": "10 jours de série",
                "emoji": "👓",
                "requirement": "10 jours consécutifs",
                "rarity": "common"
            },
            "golden_acorn": {
                "name": "Noisette en Or",
                "description": "1000 XP atteints",
                "emoji": "🌰✨",
                "requirement": "1000 XP",
                "rarity": "rare"
            },
            "lightning_cape": {
                "name": "Cape d'Éclair",
                "description": "Niveau 10 atteint",
                "emoji": "⚡",
                "requirement": "Niveau 10",
                "rarity": "rare"
            },
            "mini_library": {
                "name": "Mini Bibliothèque",
                "description": "50 notes créées",
                "emoji": "📚",
                "requirement": "50 notes",
                "rarity": "common"
            },
            "trophy": {
                "name": "Trophée du Champion",
                "description": "20 quiz complétés avec >80%",
                "emoji": "🏆",
                "requirement": "20 quiz réussis",
                "rarity": "rare"
            },
            "crown": {
                "name": "Couronne Légendaire",
                "description": "30 jours de série",
                "emoji": "👑",
                "requirement": "30 jours consécutifs",
                "rarity": "epic"
            },
            "wizard_hat": {
                "name": "Chapeau de Sorcier",
                "description": "100 quiz complétés",
                "emoji": "🧙‍♂️",
                "requirement": "100 quiz",
                "rarity": "epic"
            },
            "rocket_pack": {
                "name": "Jetpack",
                "description": "5000 XP atteints",
                "emoji": "🚀",
                "requirement": "5000 XP",
                "rarity": "legendary"
            },
            "halo": {
                "name": "Auréole Divine",
                "description": "100 jours de série",
                "emoji": "😇",
                "requirement": "100 jours consécutifs",
                "rarity": "legendary"
            },
            "diamond_acorn": {
                "name": "Noisette de Diamant",
                "description": "10000 XP atteints",
                "emoji": "💎🌰",
                "requirement": "10000 XP",
                "rarity": "legendary"
            },
            "fire_aura": {
                "name": "Aura de Feu",
                "description": "365 jours de série",
                "emoji": "🔥",
                "requirement": "1 an consécutif",
                "rarity": "mythic"
            }
        }


# Instance globale
spark_service = SparkService()
