"""
Service Mascotte - Spark l'Écureuil ⚡🐿️
Génère des messages personnalisés et contextuels pour la mascotte

Fonctionnalités:
- Messages IA personnalisés avec Claude
- Cache sémantique pour questions similaires
- Cache Redis async pour performance
- Fallback sur messages prédéfinis
"""

import json
import logging
import os
import random
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from anthropic import AsyncAnthropic

from app.services.cache_service import (
    cache_service,
    CachePrefix,
    CacheTTL
)
from app.core.i18n import get_language_instruction

# Configuration du logger
logger = logging.getLogger(__name__)

# Configuration API
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
async_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None


class MascotService:
    """Service pour gérer Spark, la mascotte écureuil de Studera"""

    def __init__(self):
        self.model = "claude-sonnet-4-5-20250929"  # Claude Sonnet 4.5
        self.max_tokens = 200  # Messages courts

        # Messages prédéfinis par langue (économie API)
        self.cached_messages = {
            "fr": {
                "welcome": [
                    "Salut ! Spark est prêt à collecter des connaissances avec toi ! 🌰⚡",
                    "Hey ! Prêt pour une session d'étude productive ? Go go go ! 🐿️",
                    "Spark est réveillé et motivé ! On fait quoi aujourd'hui ? ✨",
                ],
                "quiz_success": [
                    "WOHOOO ! Quiz réussi ! Ma réserve de noisettes déborde ! 🎉🌰",
                    "Incroyable ! Tu as tout explosé ! Tu es une légende ! ⚡",
                    "Parfait ! Tes connaissances sont bien stockées ! 💪",
                ],
                "quiz_failed": [
                    "Cette noisette était amère... Mais on apprend de nos erreurs ! 💪",
                    "Pas grave ! Même les meilleurs écureuils ratent parfois une noisette ! 🐿️",
                    "C'est en se trompant qu'on progresse ! Réessaie, je crois en toi ! ⚡",
                ],
                "streak": [
                    "🔥 Série de {days} jours ! Ton stock grandit ! Continue comme ça !",
                    "⚡ {days} jours consécutifs ! Tu es une machine à apprendre !",
                    "💪 {days} jours ! Les noisettes s'accumulent ! Objectif : 30 jours !",
                ],
                "idle": [
                    "Coucou ! Ça fait un moment... Mes noisettes s'ennuient ! 🥺",
                    "Spark te cherche ! On révise ensemble ? 🐿️",
                    "Les connaissances rouillent sans pratique... Allez, une petite session ? 📚",
                ],
                "new_accessory": [
                    "🎉 Nouvel accessoire débloqué : {accessory} ! Je suis trop stylé ! ⚡",
                    "YESSS ! J'ai gagné : {accessory} ! Merci pour ton travail acharné ! 🌰",
                ],
                "level_up": [
                    "✨ NIVEAU {level} ! Je grandis grâce à toi ! Continue ! 🐿️⚡",
                    "🎊 Level {level} atteint ! Ma queue est encore plus touffue ! 💪",
                ],
            },
            "en": {
                "welcome": [
                    "Hey! Spark is ready to gather knowledge with you! 🌰⚡",
                    "Hi! Ready for a productive study session? Let's go! 🐿️",
                    "Spark is awake and motivated! What are we doing today? ✨",
                ],
                "quiz_success": [
                    "WOHOOO! Quiz passed! My acorn stash is overflowing! 🎉🌰",
                    "Amazing! You crushed it! You're a legend! ⚡",
                    "Perfect! Your knowledge is well stored! 💪",
                ],
                "quiz_failed": [
                    "That was a bitter acorn... But we learn from our mistakes! 💪",
                    "No worries! Even the best squirrels miss an acorn sometimes! 🐿️",
                    "We grow by making mistakes! Try again, I believe in you! ⚡",
                ],
                "streak": [
                    "🔥 {days} day streak! Your stash is growing! Keep it up!",
                    "⚡ {days} consecutive days! You're a learning machine!",
                    "💪 {days} days! Acorns are piling up! Goal: 30 days!",
                ],
                "idle": [
                    "Hey! It's been a while... My acorns are getting lonely! 🥺",
                    "Spark is looking for you! Shall we study together? 🐿️",
                    "Knowledge gets rusty without practice... How about a quick session? 📚",
                ],
                "new_accessory": [
                    "🎉 New accessory unlocked: {accessory}! I look so cool! ⚡",
                    "YESSS! I earned: {accessory}! Thanks for your hard work! 🌰",
                ],
                "level_up": [
                    "✨ LEVEL {level}! I'm growing thanks to you! Keep going! 🐿️⚡",
                    "🎊 Level {level} reached! My tail is even fluffier now! 💪",
                ],
            },
        }

    async def _call_claude_for_message(self, context: Dict[str, Any], lang: str = "fr") -> str:
        """
        Génère un message personnalisé avec Claude (avec cache Redis 1h)

        Args:
            context: Contexte de l'utilisateur (event, stats, etc.)
            lang: Code de langue de l'utilisateur

        Returns:
            Message personnalisé de Spark
        """
        if not async_client:
            return self._get_fallback_message(context.get("event", "welcome"), lang=lang)

        # Créer une clé de cache basée sur le contexte
        event = context.get("event", "")
        level = context.get("level", 1)
        score = context.get("score")

        # Clé de cache simplifiée (event + level range + score range + lang)
        level_range = "beginner" if level <= 3 else ("advanced" if level >= 8 else "intermediate")
        score_range = ""
        if score is not None:
            score_range = "high" if score >= 80 else ("low" if score < 50 else "medium")

        cache_key = cache_service.generate_key(
            CachePrefix.MASCOT_AI,
            event=event,
            level=level_range,
            score=score_range if score_range else None,
            lang=lang
        )

        # Vérifier le cache
        cached_message = await cache_service.get(cache_key)
        if cached_message:
            logger.debug(f"Mascot cache HIT: {cache_key}")
            return cached_message

        logger.debug(f"Mascot cache MISS: {cache_key}")

        # Instruction de langue
        lang_instruction = get_language_instruction(lang)

        system_prompt = f"""Tu es Spark, l'écureuil pédagogue et motivant, mascotte de Studera.

PERSONNALITÉ ADAPTATIVE selon le niveau:
**Niveau 1-3 (Débutant)**: Encourageant, métaphores simples, célèbre chaque victoire
**Niveau 4-7 (Intermédiaire)**: Motivant, défis progressifs, références à la progression
**Niveau 8+ (Avancé)**: Complice, challenges stimulants, ton de "compagnon de route"

STYLE (RÈGLES STRICTES):
✓ 1-2 phrases MAX (20-30 mots TOTAL)
✓ 1-2 émojis MAX parmi: 🐿️⚡🌰💪🎉📚🔥✨
✓ Tutoiement naturel et direct
✓ Métaphore noisette = connaissance (avec modération)
✓ Concret et actionnable

RÈGLES ABSOLUES:
✗ Jamais langage bébé ou condescendant
✗ Jamais jugements négatifs
✗ Jamais plus de 2 émojis
✗ Jamais plus de 30 mots

{lang_instruction}"""

        user_name = context.get("user_name", "")
        streak = context.get("streak", 0)
        xp = context.get("xp", 0)
        topic = context.get("topic", "")

        prompt = f"""Génère UN message Spark adapté au contexte:

EVENT: {event}
Utilisateur: {user_name} (Niveau {level})
Série: {streak} jours
XP: {xp}"""

        if score is not None:
            prompt += f"\nScore: {score}%"
        if topic:
            prompt += f"\nSujet: {topic}"

        prompt += "\n\nRéponds UNIQUEMENT avec le message (pas de guillemets, pas de préambule):"

        try:
            message = await async_client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                temperature=0.8,
                system=system_prompt,
                messages=[{"role": "user", "content": prompt}]
            )

            if message.content and len(message.content) > 0:
                result = message.content[0].text.strip()

                # Mettre en cache pour 1 heure
                await cache_service.set(cache_key, result, ttl=CacheTTL.LONG)

                return result
            else:
                return self._get_fallback_message(event, lang=lang)

        except Exception as e:
            logger.error(f"Erreur Claude mascotte: {e}")
            return self._get_fallback_message(event, lang=lang)

    def _get_fallback_message(self, event: str, lang: str = "fr", **kwargs) -> str:
        """Message de secours si l'IA n'est pas disponible"""
        lang_messages = self.cached_messages.get(lang, self.cached_messages["fr"])
        messages = lang_messages.get(event, lang_messages["welcome"])
        message = random.choice(messages)
        return message.format(**kwargs)

    async def get_message(
        self,
        event: str,
        user_context: Dict[str, Any],
        use_ai: bool = True,
        lang: str = "fr"
    ) -> Dict[str, Any]:
        """
        Récupère un message de Spark selon l'événement

        Args:
            event: Type d'événement (welcome, quiz_success, streak, etc.)
            user_context: Contexte utilisateur (name, xp, streak, etc.)
            use_ai: Utiliser l'IA ou messages prédéfinis
            lang: Code de langue de l'utilisateur

        Returns:
            Dict avec message, mood, animation
        """
        # Événements fréquents → messages cachés (économie API)
        if event in ["welcome", "idle"] or not use_ai:
            message = self._get_fallback_message(event, lang=lang, **user_context)
        else:
            context = {"event": event, **user_context}
            message = await self._call_claude_for_message(context, lang=lang)

        # Déterminer le mood et l'animation selon l'événement
        mood_mapping = {
            "welcome": {"mood": "happy", "animation": "wave"},
            "quiz_success": {"mood": "excited", "animation": "celebration"},
            "quiz_failed": {"mood": "encouraging", "animation": "pat"},
            "streak": {"mood": "excited", "animation": "jump"},
            "idle": {"mood": "sad", "animation": "sleep"},
            "new_accessory": {"mood": "excited", "animation": "showcase"},
            "level_up": {"mood": "excited", "animation": "evolution"},
            "flashcard_created": {"mood": "happy", "animation": "collect"},
            "note_created": {"mood": "thinking", "animation": "read"},
            "achievement": {"mood": "excited", "animation": "celebration"},
        }

        mood_data = mood_mapping.get(event, {"mood": "happy", "animation": "idle"})

        return {
            "message": message,
            "mood": mood_data["mood"],
            "animation": mood_data["animation"],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    async def get_contextual_hint(self, topic: str, difficulty: str, lang: str = "fr") -> str:
        """
        Génère un indice pédagogique pour une flashcard/quiz

        Args:
            topic: Sujet de la question
            difficulty: Niveau de difficulté
            lang: Code de langue de l'utilisateur

        Returns:
            Indice de Spark
        """
        fallbacks = {
            "fr": f"Réfléchis bien à {topic}... Tu peux y arriver ! 🐿️",
            "en": f"Think carefully about {topic}... You can do it! 🐿️",
        }
        fallback = fallbacks.get(lang, fallbacks["fr"])

        if not async_client:
            return fallback

        lang_instruction = get_language_instruction(lang)
        system_prompt = f"Tu es Spark, un écureuil pédagogue qui donne des indices sans révéler la réponse.\n\n{lang_instruction}"

        prompt = f"""Donne un indice pour une question sur : {topic}
Difficulté : {difficulty}

L'indice doit :
- Guider sans révéler la réponse
- Être court (1 phrase)
- Être encourageant

Réponds UNIQUEMENT avec l'indice :"""

        try:
            message = await async_client.messages.create(
                model=self.model,
                max_tokens=100,
                temperature=0.7,
                system=system_prompt,
                messages=[{"role": "user", "content": prompt}]
            )

            return message.content[0].text.strip()

        except Exception as e:
            logger.error(f"Erreur indice mascotte: {e}")
            return fallback

    def check_and_unlock_accessories(self, user) -> list:
        """
        Vérifie et débloque les nouveaux accessoires

        Args:
            user: Instance du modèle User

        Returns:
            Liste des nouveaux accessoires débloqués
        """
        unlockable = user.get_unlockable_accessories()
        current_unlocked = user.mascot_unlocked_accessories or []

        newly_unlocked = [
            acc for acc in unlockable
            if acc not in current_unlocked
        ]

        if newly_unlocked:
            user.mascot_unlocked_accessories = list(set(current_unlocked + newly_unlocked))

        return newly_unlocked

    async def ask_question(
        self,
        question: str,
        user_context: Dict[str, Any],
        additional_context: Optional[Dict[str, Any]] = None,
        lang: str = "fr"
    ) -> Dict[str, Any]:
        """
        Répond à une question directe de l'utilisateur avec cache sémantique

        Args:
            question: Question de l'utilisateur
            user_context: Contexte utilisateur (name, xp, streak, level, etc.)
            additional_context: Contexte additionnel (page actuelle, sujet en cours, etc.)
            lang: Code de langue de l'utilisateur

        Returns:
            Dict avec answer, mood, animation, suggestions
        """
        user_level = user_context.get("level", 1)

        # Utiliser le cache sémantique - questions similaires = même réponse (avec langue)
        cache_key = cache_service.generate_semantic_key(
            f"{lang}:{question}",
            prefix=CachePrefix.MASCOT_AI,
            context_level=user_level,
        )

        # Vérifier le cache
        cached_response = await cache_service.get(cache_key)
        if cached_response:
            logger.info(f"Mascot semantic cache HIT for: {question[:50]}...")
            return cached_response

        logger.debug(f"Mascot cache MISS: {cache_key}")

        if not async_client:
            return self._get_fallback_answer(lang=lang)

        # Instruction de langue
        lang_instruction = get_language_instruction(lang)

        system_prompt = f"""Tu es Spark, l'assistant pédagogique IA de Studera.

CAPACITÉS de Studera:
✓ Créer flashcards et quiz (manuels ou IA)
✓ Notes avec LaTeX/Markdown
✓ Répétition espacée automatique
✓ Stats XP, streak, scores
✓ Résumer notes avec IA
✓ Groupes d'étude collaboratifs

RÈGLES:
- 3 suggestions CONCRÈTES et ACTIONNABLES
- Verbes d'action: "Crée", "Active", "Fais"
- 2-4 phrases de réponse MAX
- 1-2 émojis parmi 🐿️⚡🌰💪📚

RÉPONSE FORMAT JSON STRICT:
{{{{
  "answer": "Réponse pédagogique 2-4 phrases",
  "suggestions": ["Action 1", "Action 2", "Action 3"],
  "priority": "1"
}}}}

{lang_instruction}"""

        user_name = user_context.get("user_name", "")
        streak = user_context.get("streak", 0)
        xp = user_context.get("xp", 0)

        context_info = f"""Question: {question}

Utilisateur: {user_name} (Niveau {user_level})
Série: {streak} jours | XP: {xp}"""

        if additional_context:
            current_page = additional_context.get("current_page")
            current_topic = additional_context.get("current_topic")
            if current_page:
                context_info += f"\nPage: {current_page}"
            if current_topic:
                context_info += f"\nSujet: {current_topic}"

        context_info += "\n\nRéponds UNIQUEMENT avec le JSON (pas de ```json):"

        try:
            message = await async_client.messages.create(
                model=self.model,
                max_tokens=400,
                temperature=0.8,
                system=system_prompt,
                messages=[{"role": "user", "content": context_info}]
            )

            response_text = message.content[0].text.strip()

            # Nettoyer le JSON
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            # Suggestions par défaut par langue
            default_suggestions_map = {
                "fr": [
                    "Crée des flashcards sur ce sujet",
                    "Fais un quiz pour vérifier tes connaissances",
                    "Active la répétition espacée"
                ],
                "en": [
                    "Create flashcards on this topic",
                    "Take a quiz to test your knowledge",
                    "Enable spaced repetition"
                ]
            }
            default_suggestions = default_suggestions_map.get(lang, default_suggestions_map["fr"])

            try:
                parsed_data = json.loads(response_text)
                answer = parsed_data.get("answer", "")
                suggestions = parsed_data.get("suggestions", [])
                priority = parsed_data.get("priority", "2")

                # Compléter les suggestions si nécessaire
                if len(suggestions) < 3:
                    suggestions.extend(default_suggestions)
                    suggestions = suggestions[:3]

            except json.JSONDecodeError:
                logger.warning(f"JSON parsing failed: {response_text[:100]}")
                answer = response_text[:200]
                suggestions = default_suggestions
                priority = "2"

            result = {
                "answer": answer,
                "mood": "helpful",
                "animation": "explain",
                "suggestions": suggestions[:3],
                "priority": priority,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

            # Cache sémantique pour 1 heure
            await cache_service.set(cache_key, result, ttl=CacheTTL.LONG)

            return result

        except Exception as e:
            logger.error(f"Erreur ask_question: {e}")
            return self._get_fallback_answer(lang=lang)

    def _get_fallback_answer(self, lang: str = "fr") -> Dict[str, Any]:
        """Réponse de fallback sans IA"""
        fallbacks = {
            "fr": {
                "answer": "Je voudrais t'aider, mais je n'ai pas accès à mes pouvoirs magiques pour l'instant ! 🐿️ Consulte les ressources de Studera ! 📚",
                "suggestions": [
                    "Consulte tes notes",
                    "Fais un quiz pour t'entraîner",
                    "Crée des flashcards sur ce sujet"
                ]
            },
            "en": {
                "answer": "I'd love to help, but I can't access my magic powers right now! 🐿️ Check out Studera's resources! 📚",
                "suggestions": [
                    "Check your notes",
                    "Take a practice quiz",
                    "Create flashcards on this topic"
                ]
            }
        }
        fallback = fallbacks.get(lang, fallbacks["fr"])
        return {
            "answer": fallback["answer"],
            "mood": "thinking",
            "animation": "think",
            "suggestions": fallback["suggestions"],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    def get_accessory_info(self) -> Dict[str, Dict[str, str]]:
        """Informations sur tous les accessoires disponibles"""
        return {
            "graduate_hat": {
                "name": "Chapeau de Diplômé",
                "description": "100 flashcards créées",
                "emoji": "🎓",
                "requirement": "100 flashcards"
            },
            "glasses": {
                "name": "Lunettes d'Érudit",
                "description": "10 jours de série",
                "emoji": "👓",
                "requirement": "10 jours consécutifs"
            },
            "golden_acorn": {
                "name": "Noisette en Or",
                "description": "1000 XP atteints",
                "emoji": "🌰✨",
                "requirement": "1000 XP"
            },
            "lightning_cape": {
                "name": "Cape d'Éclair",
                "description": "Niveau 10 atteint",
                "emoji": "⚡",
                "requirement": "Niveau 10"
            },
            "mini_library": {
                "name": "Mini Bibliothèque",
                "description": "50 notes créées",
                "emoji": "📚",
                "requirement": "50 notes"
            },
            "trophy": {
                "name": "Trophée du Champion",
                "description": "20 quiz complétés",
                "emoji": "🏆",
                "requirement": "20 quiz"
            },
            "crown": {
                "name": "Couronne Légendaire",
                "description": "30 jours de série",
                "emoji": "👑",
                "requirement": "30 jours consécutifs"
            }
        }


# Instance globale
mascot_service = MascotService()
