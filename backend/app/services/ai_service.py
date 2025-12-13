"""
Service IA pour la génération de contenu pédagogique
Utilise Claude Sonnet 4 (Anthropic) pour générer flashcards, quiz, résumés, etc.

Cache intelligent avec:
- Cache par hash de contenu pour flashcards/quiz/résumés
- Cache sémantique pour explications de concepts
- TTL de 24h pour contenu généré
- Métriques de performance intégrées
"""

import asyncio
import json
import logging
import os
import re
from datetime import date
from typing import List, Dict, Any, Optional

from anthropic import Anthropic, AsyncAnthropic

from app.services.cache_service import (
    cache_service,
    cached_ai_content,
    cached_semantic,
    cached,
    CachePrefix,
    CacheTTL
)
from app.core.i18n import build_system_prompt_with_language, get_language_instruction

# Configuration du logger
logger = logging.getLogger(__name__)

# Configuration de l'API Anthropic (Claude)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    logger.warning("ANTHROPIC_API_KEY non configurée - les fonctionnalités IA seront désactivées")

# Client async pour les appels non-bloquants
async_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None


class AIService:
    """Service centralisé pour toutes les fonctionnalités IA avec Claude Sonnet 4"""

    def __init__(self):
        self.model = "claude-sonnet-4-5-20250929"  # Claude Sonnet 4.5
        self.max_tokens = 4096
        self.temperature = 0.7

        # Versioning des prompts pour tracking et A/B testing
        self.prompt_versions = {
            "flashcards": "v2.1",
            "quiz": "v2.0",
            "summary": "v2.0",
            "keywords": "v1.5",
            "study_plan": "v1.5"
        }

    async def _call_claude(self, prompt: str, system_prompt: str = "") -> str:
        """
        Appelle l'API Claude de manière asynchrone et retourne la réponse.

        Args:
            prompt: Le prompt utilisateur
            system_prompt: Instructions système optionnelles

        Returns:
            Texte de réponse de Claude

        Raises:
            ValueError: Si la clé API n'est pas configurée ou la réponse est vide
            Exception: Pour les autres erreurs API
        """
        if not async_client:
            logger.error("Client Anthropic non initialisé - ANTHROPIC_API_KEY manquante")
            raise ValueError("Service IA non disponible - clé API non configurée")

        try:
            logger.debug(f"Appel Claude avec modèle {self.model}, max_tokens={self.max_tokens}")

            message = await async_client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                system=system_prompt if system_prompt else "Tu es un assistant IA expert en pédagogie.",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            # Extraire le texte de la réponse
            if message.content and len(message.content) > 0:
                response_text = message.content[0].text
                logger.debug(f"Réponse Claude reçue: {len(response_text)} caractères")
                return response_text
            else:
                logger.warning("Réponse vide reçue de Claude")
                raise ValueError("Réponse vide de Claude")

        except Exception as e:
            logger.error(f"Erreur lors de l'appel à Claude: {e}", exc_info=True)
            raise

    def _clean_json_response(self, text: str) -> str:
        """
        Nettoie la réponse JSON de Claude en supprimant les balises markdown.

        Args:
            text: Texte brut de la réponse

        Returns:
            Texte JSON nettoyé
        """
        result = text.strip()

        # Supprimer les balises de code markdown
        if result.startswith("```json"):
            result = result[7:]
        elif result.startswith("```"):
            result = result[3:]

        if result.endswith("```"):
            result = result[:-3]

        return result.strip()

    def _validate_flashcard_quality(self, flashcard: Dict[str, str]) -> float:
        """
        Valide la qualité d'une flashcard générée (0-100)

        Args:
            flashcard: Dict avec front, back, hint, explanation

        Returns:
            Score de qualité (0-100)
        """
        score = 100.0

        front = flashcard.get("front", "")
        back = flashcard.get("back", "")
        hint = flashcard.get("hint", "")
        explanation = flashcard.get("explanation", "")

        # Pénalités
        if len(front) < 10:
            score -= 20  # Question trop courte
        if len(front) > 150:
            score -= 10  # Question trop longue

        if len(back) < 10:
            score -= 25  # Réponse trop courte
        if len(back) > 500:
            score -= 15  # Réponse trop longue (surcharge cognitive)

        # Hint ne doit pas révéler la réponse
        if hint and back:
            # Vérifier si le hint contient des mots clés de la réponse
            back_words = set(back.lower().split())
            hint_words = set(hint.lower().split())
            overlap = back_words.intersection(hint_words)
            if len(overlap) > len(back_words) * 0.5:  # Plus de 50% de mots en commun
                score -= 25  # Hint révèle trop

        # Vérifier présence de point d'interrogation dans front
        if "?" not in front and "quel" not in front.lower() and "comment" not in front.lower():
            score -= 10  # Pas clairement une question

        # Bonus
        if "$" in back or "$" in front:
            score += 5  # Contient LaTeX (bon pour math/sciences)

        if len(explanation) > 50:
            score += 10  # Explication détaillée

        if any(word in front.lower() for word in ["pourquoi", "comment", "différence", "comparer"]):
            score += 5  # Question engageante

        # S'assurer que le score reste entre 0 et 100
        return max(0.0, min(100.0, score))

    def _validate_quiz_question_quality(self, question: Dict[str, Any]) -> float:
        """
        Valide la qualité d'une question de quiz (0-100)

        Args:
            question: Dict avec question, options, correct_answer, explanation

        Returns:
            Score de qualité (0-100)
        """
        score = 100.0

        q_text = question.get("question", "")
        q_type = question.get("type", "")
        explanation = question.get("explanation", "")

        # Validation générale
        if len(q_text) < 15:
            score -= 20  # Question trop courte

        if not explanation or len(explanation) < 20:
            score -= 25  # Explication insuffisante

        # Validation spécifique par type
        if q_type == "multiple_choice":
            options = question.get("options", [])
            correct_answer = question.get("correct_answer", "")

            if len(options) != 4:
                score -= 30  # Doit avoir exactement 4 options

            # Vérifier que les options ont des longueurs similaires (éviter indices)
            if options:
                lengths = [len(opt) for opt in options]
                avg_length = sum(lengths) / len(lengths)
                if any(abs(l - avg_length) > avg_length * 0.5 for l in lengths):
                    score -= 10  # Disparité de longueur

            # Vérifier que correct_answer est dans options
            if correct_answer not in options:
                score -= 40  # Réponse correcte invalide

        elif q_type == "true_false":
            correct = question.get("correct_answer")
            if not isinstance(correct, bool):
                score -= 30  # Doit être boolean

        elif q_type == "short_answer":
            expected = question.get("expected_answer", "")
            if len(expected) < 10:
                score -= 20  # Réponse attendue trop courte

        # Bonus
        if "$" in q_text:
            score += 5  # LaTeX pour formules

        if "pourquoi" in explanation.lower():
            score += 10  # Explication avec raisonnement

        return max(0.0, min(100.0, score))

    @cached_ai_content(
        prefix=CachePrefix.AI_FLASHCARDS,
        ttl=CacheTTL.VERY_LONG,  # 24h - contenu stable
        content_param="note_content",
        extra_params=["count", "difficulty", "lang"]
    )
    async def generate_flashcards_from_note(
        self,
        note_content: str,
        note_title: str,
        count: int = 10,
        difficulty: str = "medium",
        lang: str = "fr"
    ) -> List[Dict[str, str]]:
        """
        Génère des flashcards à partir d'une note avec qualité pédagogique améliorée v2.1

        Cache: 24h basé sur hash(note_content) + count + difficulty
        Économise les appels API pour le même contenu.

        Args:
            note_content: Contenu de la note
            note_title: Titre de la note
            count: Nombre de flashcards à générer
            difficulty: Niveau de difficulté (easy/medium/hard)

        Returns:
            Liste de flashcards avec front, back, hint, explanation, concept_type
        """

        base_system_prompt = """Tu es un expert en sciences cognitives et pédagogie qui crée des flashcards optimisées pour la mémorisation à long terme basée sur la répétition espacée et les principes de la charge cognitive."""
        system_prompt = build_system_prompt_with_language(base_system_prompt, lang, "flashcards")

        prompt = f"""À partir de cette note intitulée "{note_title}", crée exactement {count} flashcards OPTIMISÉES pour la mémorisation à long terme.

STRATÉGIE DE CRÉATION (DISTRIBUTION OBLIGATOIRE):
1. **Hiérarchie des concepts** (répartition stricte):
   - 40% : Définitions et faits fondamentaux (bases essentielles)
   - 30% : Applications et exemples concrets (mise en pratique)
   - 20% : Comparaisons et relations entre concepts (liens)
   - 10% : Analyse critique et cas limites (approfondissement)

2. **Diversité des types de questions**:
   - Questions fermées précises : "Quelle est la formule de X ?"
   - Questions de compréhension : "Pourquoi X entraîne-t-il Y ?"
   - Questions d'application : "Comment utiliseriez-vous X pour résoudre Z ?"
   - Questions de distinction : "Quelle est la différence clé entre X et Y ?"

3. **PRINCIPE ANTI-REDONDANCE** (CRITIQUE):
   - Chaque flashcard doit tester un concept DISTINCT et unique
   - Éviter absolument les reformulations du même concept
   - Couvrir TOUTE la note de manière équilibrée (pas seulement le début)
   - Prioriser les concepts centraux avant les détails

RÈGLES DE QUALITÉ STRICTES:
✓ **Front (Question)**:
  - 1 concept atomique = 1 carte (pas de questions multiples)
  - Formulation active et engageante
  - 10-80 caractères (court et précis)
  - Commence par: "Quel", "Comment", "Pourquoi", "Quelle différence"

✓ **Back (Réponse)**:
  - 2-4 phrases MAX (50-200 caractères)
  - Commence directement par la réponse (pas de préambule)
  - Inclut un exemple concret si pertinent
  - Structure: Réponse courte → Exemple/contexte si besoin

✓ **Hint (Indice progressif en 3 niveaux)**:
  - Niveau 1: Catégorie/domaine du concept ("C'est une structure de données...")
  - Niveau 2: Contexte ou mot-clé associé ("Utilisée pour...")
  - Niveau 3: Amorce de réponse ("Commence par...")
  - ❌ JAMAIS révéler directement la réponse

  EXEMPLE DE HINT PROGRESSIF:
  - ❌ Mauvais: "C'est une pile, structure LIFO" (révèle trop)
  - ✅ Bon: "Structure de données → Pensez à une pile d'assiettes → Dernier arrivé..."

✓ **Explanation (Contexte enrichi)**:
  - Pourquoi ce concept est important (2-3 phrases)
  - Lien avec d'autres concepts de la note
  - Application pratique ou exemple mémorable
  - Astuce mnémotechnique si pertinent

✓ **LaTeX pour formules**: $E = mc^2$ (inline) ou $$\\int_{{0}}^{{\\infty}} e^{{-x^2}} dx$$ (bloc)

NIVEAU DE DIFFICULTÉ: {difficulty}
- **easy**: Reconnaissance directe, définitions simples, faits de base
- **medium**: Compréhension profonde, relations causales, applications
- **hard**: Analyse complexe, synthèse multi-concepts, résolution de problèmes

CONTENU DE LA NOTE:
{note_content}

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide (sans balises ```json):
{{
  "flashcards": [
    {{
      "front": "Question atomique testant UN seul concept précis",
      "back": "Réponse concise en 2-4 phrases avec exemple si pertinent",
      "hint": "Indice en 3 niveaux: Catégorie → Contexte → Amorce (sans révéler)",
      "explanation": "Importance + liens avec autres concepts + astuce mémorisation",
      "concept_type": "definition|application|comparison|analysis"
    }}
  ]
}}"""

        try:
            response_text = await self._call_claude(prompt, system_prompt)
            result_text = self._clean_json_response(response_text)

            result = json.loads(result_text)
            flashcards = result.get("flashcards", [])

            # Validation
            if not flashcards:
                logger.warning("Aucune flashcard générée par Claude")
                raise ValueError("Aucune flashcard générée")

            # Validation de qualité pour chaque flashcard
            validated_flashcards = []
            rejected_count = 0
            for card in flashcards:
                quality_score = self._validate_flashcard_quality(card)
                card["quality_score"] = round(quality_score, 1)

                if quality_score >= 50:
                    validated_flashcards.append(card)
                else:
                    rejected_count += 1
                    logger.debug(f"Flashcard rejetée (score: {quality_score}): {card.get('front', '')[:50]}")

            if rejected_count > 0:
                logger.info(f"{rejected_count} flashcard(s) rejetée(s) pour qualité insuffisante")

            # Si trop de flashcards rejetées, renvoyer quand même les meilleures
            if len(validated_flashcards) < count * 0.5:
                logger.warning(f"Seulement {len(validated_flashcards)}/{count} flashcards validées, conservation de toutes")
                validated_flashcards = flashcards[:count]
                for card in validated_flashcards:
                    if "quality_score" not in card:
                        card["quality_score"] = self._validate_flashcard_quality(card)

            # Limiter au nombre demandé et trier par qualité
            validated_flashcards.sort(key=lambda x: x.get("quality_score", 0), reverse=True)

            logger.info(f"Flashcards générées: {len(validated_flashcards[:count])} sur {count} demandées")
            return validated_flashcards[:count]

        except json.JSONDecodeError as e:
            logger.error(f"Erreur de parsing JSON: {e}", exc_info=True)
            logger.debug(f"Réponse brute: {result_text[:500]}...")
            raise ValueError(f"Erreur de format JSON: {str(e)}")
        except Exception as e:
            logger.error(f"Erreur lors de la génération de flashcards: {e}", exc_info=True)
            raise

    @cached_ai_content(
        prefix=CachePrefix.AI_QUIZ,
        ttl=CacheTTL.VERY_LONG,  # 24h - quiz stable
        content_param="note_content",
        extra_params=["question_count", "difficulty", "lang"]
    )
    async def generate_quiz_from_note(
        self,
        note_content: str,
        note_title: str,
        question_count: int = 10,
        question_types: Optional[List[str]] = None,
        difficulty: str = "medium",
        lang: str = "fr"
    ) -> Dict[str, Any]:
        """
        Génère un quiz à partir d'une note avec qualité pédagogique améliorée v2.0

        Cache: 24h basé sur hash(note_content) + question_count + difficulty
        Les types de questions ne font pas partie de la clé pour maximiser les hits.

        Args:
            note_content: Contenu de la note
            note_title: Titre de la note
            question_count: Nombre de questions
            question_types: Types de questions (multiple_choice, true_false, short_answer)
            difficulty: Niveau de difficulté

        Returns:
            Dict avec le quiz complet incluant bloom_level et points
        """

        if question_types is None:
            question_types = ["multiple_choice", "true_false", "short_answer"]

        types_str = ", ".join(question_types)

        base_system_prompt = """Tu es un expert en évaluation pédagogique et taxonomie de Bloom qui crée des quiz optimisés pour mesurer la compréhension réelle et identifier les lacunes."""
        system_prompt = build_system_prompt_with_language(base_system_prompt, lang, "quiz")

        prompt = f"""Crée un quiz de {question_count} questions de niveau {difficulty} sur "{note_title}" avec les types: {types_str}.

ARCHITECTURE DU QUIZ (RÉPARTITION OBLIGATOIRE):
📊 **Niveaux de Bloom** (distribution stricte):
- 30% Mémorisation (Se souvenir): Définitions, faits, termes clés
- 30% Compréhension (Comprendre): Expliquer, illustrer, résumer
- 25% Application (Appliquer): Utiliser, résoudre, calculer
- 15% Analyse (Analyser): Comparer, différencier, déduire

RÈGLES PAR TYPE DE QUESTION:

**multiple_choice** (QCM - 4 choix obligatoires):
1. **Question**: Teste compréhension profonde, PAS mémorisation brute
   - Formulation claire et précise
   - Utilise LaTeX pour formules: $E = mc^2$
   - Contexte suffisant pour répondre

2. **Options (A, B, C, D)** - CRITIQUE:
   ✓ **1 réponse CORRECTE** et complète
   ✓ **3 DISTRACTEURS PLAUSIBLES** basés sur:
     * Erreur conceptuelle commune (ex: confusion cause/effet)
     * Réponse partiellement vraie mais incomplète
     * Concept proche mais incorrect (ex: confondre moyenne et médiane)
     * Application incorrecte d'une formule

   RÈGLES DISTRACTEURS:
   - Même longueur approximative que la bonne réponse
   - Éviter les indices grammaticaux (accord, temps)
   - Éviter patterns évidents (toujours C correct)
   - Basés sur des erreurs RÉELLES d'apprentissage
   - ❌ JAMAIS: "Toutes ces réponses", "Aucune de ces réponses"

3. **Explication** (OBLIGATOIRE):
   - Pourquoi la réponse A est correcte (2 phrases)
   - Pourquoi B, C, D sont incorrects (1 phrase chacun)
   - Contexte pédagogique

EXEMPLE QCM OPTIMAL:
Question: "Quelle est la complexité temporelle de la recherche binaire dans un tableau trié?"
A. $O(\\log n)$ ✓ CORRECT
B. $O(n)$ (erreur: confusion avec recherche linéaire)
C. $O(n \\log n)$ (erreur: confusion avec tri fusion)
D. $O(1)$ (erreur: pense que l'indexation = recherche)

**true_false** (Vrai/Faux):
- Affirmation précise et non ambiguë
- Teste UN concept spécifique
- ❌ Éviter mots absolus: "toujours", "jamais", "tous", "aucun"
- Explication: Pourquoi vrai/faux + nuances importantes

EXEMPLE:
✓ Bon: "En Python, les listes sont mutables"
✗ Mauvais: "Les listes sont toujours plus rapides que les tuples"

**short_answer** (Réponse courte):
- Question ouverte nécessitant réflexion personnelle
- **expected_answer**: 2-3 phrases clés (pas mot-à-mot)
- Critères d'évaluation explicites
- Explication: Points clés à inclure dans une bonne réponse

QUALITÉ DES QUESTIONS:
✓ Couvre TOUTE la note équitablement (pas seulement le début)
✓ Varie les niveaux cognitifs selon distribution Bloom
✓ Utilise LaTeX pour formules mathématiques
✓ Explications pédagogiques complètes
✓ Évite questions triviales ou ambiguës

NIVEAU DE DIFFICULTÉ: {difficulty}
- **easy**: Reconnaissance directe, rappel de faits (Bloom: Mémorisation)
- **medium**: Compréhension, application de concepts (Bloom: Compréhension/Application)
- **hard**: Analyse, évaluation, synthèse (Bloom: Analyse/Évaluation)

CONTENU DE LA NOTE:
{note_content}

IMPORTANT: Réponds en JSON valide (sans balises markdown):
{{
  "title": "{note_title} - Quiz",
  "description": "Quiz d'évaluation sur {note_title}",
  "questions": [
    {{
      "type": "multiple_choice",
      "question": "Question avec $LaTeX$ si math/science",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "explanation": "Pourquoi A est correct. Pourquoi B est faux (raison). Pourquoi C est faux (raison). Pourquoi D est faux (raison).",
      "difficulty_level": "medium",
      "bloom_level": "application",
      "topic": "Section ou concept de la note",
      "points": 10
    }},
    {{
      "type": "true_false",
      "question": "Affirmation précise testable",
      "correct_answer": true,
      "explanation": "Justification avec contexte et nuances",
      "difficulty_level": "easy",
      "bloom_level": "memorization",
      "points": 5
    }},
    {{
      "type": "short_answer",
      "question": "Question ouverte nécessitant réflexion",
      "expected_answer": "Réponse attendue en 2-3 phrases avec points clés",
      "explanation": "Critères: Point 1 attendu, Point 2 attendu, contexte",
      "difficulty_level": "hard",
      "bloom_level": "analysis",
      "points": 15
    }}
  ]
}}"""

        try:
            response_text = await self._call_claude(prompt, system_prompt)
            result_text = self._clean_json_response(response_text)

            quiz_data = json.loads(result_text)

            # Validation
            if "questions" not in quiz_data or not quiz_data["questions"]:
                logger.warning("Aucune question générée par Claude")
                raise ValueError("Aucune question générée")

            # Validation de qualité pour chaque question
            validated_questions = []
            rejected_count = 0
            for question in quiz_data["questions"]:
                quality_score = self._validate_quiz_question_quality(question)
                question["quality_score"] = round(quality_score, 1)

                if quality_score >= 50:
                    validated_questions.append(question)
                else:
                    rejected_count += 1
                    logger.debug(f"Question rejetée (score: {quality_score}): {question.get('question', '')[:50]}")

            if rejected_count > 0:
                logger.info(f"{rejected_count} question(s) rejetée(s) pour qualité insuffisante")

            # Si trop de questions rejetées, renvoyer quand même les meilleures
            if len(validated_questions) < question_count * 0.5:
                logger.warning(f"Seulement {len(validated_questions)}/{question_count} questions validées, conservation de toutes")
                validated_questions = quiz_data["questions"][:question_count]
                for q in validated_questions:
                    if "quality_score" not in q:
                        q["quality_score"] = self._validate_quiz_question_quality(q)

            # Trier par qualité et limiter au nombre demandé
            validated_questions.sort(key=lambda x: x.get("quality_score", 0), reverse=True)
            quiz_data["questions"] = validated_questions[:question_count]

            logger.info(f"Quiz généré: {len(quiz_data['questions'])} questions")
            return quiz_data

        except json.JSONDecodeError as e:
            logger.error(f"Erreur de parsing JSON: {e}", exc_info=True)
            logger.debug(f"Réponse brute: {result_text[:500]}...")
            raise ValueError(f"Erreur de format JSON: {str(e)}")
        except Exception as e:
            logger.error(f"Erreur lors de la génération de quiz: {e}", exc_info=True)
            raise

    @cached_ai_content(
        prefix=CachePrefix.AI_SUMMARY,
        ttl=CacheTTL.VERY_LONG,  # 24h - résumé stable
        content_param="note_content",
        extra_params=["max_length", "lang"]
    )
    async def summarize_note(
        self,
        note_content: str,
        note_title: str,
        max_length: int = 300,
        lang: str = "fr"
    ) -> str:
        """
        Résume une note de manière structurée et hiérarchisée v2.0

        Cache: 24h basé sur hash(note_content) + max_length

        Args:
            note_content: Contenu de la note
            note_title: Titre de la note
            max_length: Longueur maximale du résumé en mots

        Returns:
            Résumé structuré en Markdown avec hiérarchie claire
        """

        base_system_prompt = """Tu es un expert en synthèse cognitive et structuration d'information qui crée des résumés optimisés pour la mémorisation et la révision rapide."""
        system_prompt = build_system_prompt_with_language(base_system_prompt, lang, "summary")

        prompt = f"""Résume "{note_title}" en MAX {max_length} mots avec une structure hiérarchique claire.

FORMAT OBLIGATOIRE (Markdown structuré):

**🎯 L'ESSENTIEL** (1 phrase clé)
[Idée centrale capturée en UNE phrase percutante]

**📌 Points clés**
- **Point principal 1**: Explication courte avec contexte
- **Point principal 2**: Explication courte avec contexte
- **Point principal 3**: Explication courte avec contexte

**🔍 Détails importants**
- Nuance/détail critique 1
- Nuance/détail critique 2
- Application pratique ou exemple mémorable

**💡 À retenir absolument**
[Phrase de synthèse finale OU astuce mnémotechnique OU formule clé]

RÈGLES DE QUALITÉ:
✓ **Hiérarchisation stricte**: Essentiel → Points clés → Détails → Synthèse
✓ **Concision maximale**: 2-4 phrases MAX par section
✓ **Préservation LaTeX**: Garde formules importantes avec $...$ (inline) ou $$...$$ (bloc)
✓ **Contexte suffisant**: Chaque point doit être compréhensible seul
✓ **Priorisation intelligente**: Concepts centraux avant détails secondaires
✓ **Mémorabilité**: Utilise métaphores, acronymes, ou liens logiques

CONSEILS STRATÉGIQUES:
- Pour math/sciences: Préserve TOUTES les formules clés avec LaTeX
- Pour concepts abstraits: Utilise analogies concrètes
- Pour listes/processus: Numérote les étapes logiquement
- Pour comparaisons: Tableau ou bullet points clairs

LIMITE STRICTE: {max_length} mots TOTAL (compte tous les mots y compris titres)

CONTENU À RÉSUMER:
{note_content}

IMPORTANT: Réponds directement avec le résumé structuré en Markdown (pas de préambule, pas de balises ```):"""

        try:
            summary = await self._call_claude(prompt, system_prompt)
            result = summary.strip()
            logger.info(f"Résumé généré: {len(result.split())} mots")
            return result

        except Exception as e:
            logger.error(f"Erreur lors du résumé: {e}", exc_info=True)
            raise

    @cached_ai_content(
        prefix=CachePrefix.AI_KEYWORDS,
        ttl=CacheTTL.VERY_LONG,  # 24h - mots-clés stables
        content_param="note_content",
        extra_params=["max_keywords", "lang"]
    )
    async def extract_keywords(
        self,
        note_content: str,
        note_title: str,
        max_keywords: int = 10,
        lang: str = "fr"
    ) -> List[str]:
        """
        Extrait les mots-clés d'une note

        Cache: 24h basé sur hash(note_content) + max_keywords

        Args:
            note_content: Contenu de la note
            note_title: Titre de la note
            max_keywords: Nombre maximum de mots-clés

        Returns:
            Liste de mots-clés
        """

        base_system_prompt = "Tu es un expert en analyse de contenu pédagogique."
        system_prompt = build_system_prompt_with_language(base_system_prompt, lang)

        prompt = f"""Analyse cette note intitulée "{note_title}" et extrais les {max_keywords} mots-clés les plus importants.

CRITÈRES:
- Concepts centraux et termes techniques
- Mots qui captent l'essence du contenu
- Utiles pour l'indexation et la recherche
- Ordonnés par importance

CONTENU:
{note_content}

IMPORTANT: Réponds UNIQUEMENT avec un JSON (pas de markdown):
{{
  "keywords": ["mot1", "mot2", "mot3", ...]
}}"""

        try:
            response_text = await self._call_claude(prompt, system_prompt)
            result_text = self._clean_json_response(response_text)

            result = json.loads(result_text)
            keywords = result.get("keywords", [])

            logger.info(f"Mots-clés extraits: {len(keywords[:max_keywords])}")
            return keywords[:max_keywords]

        except json.JSONDecodeError as e:
            logger.error(f"Erreur de parsing JSON: {e}", exc_info=True)
            raise ValueError(f"Erreur de format JSON: {str(e)}")
        except Exception as e:
            logger.error(f"Erreur lors de l'extraction de mots-clés: {e}", exc_info=True)
            raise

    @cached(
        prefix=CachePrefix.AI_STUDY_PLAN,
        ttl=CacheTTL.LONG,  # 1h - plan peut changer
        key_params=["study_time_per_day", "lang"]
    )
    async def generate_study_plan(
        self,
        notes_content: List[Dict[str, str]],
        target_date: date,
        study_time_per_day: int = 2,
        lang: str = "fr"
    ) -> Dict[str, Any]:
        """
        Génère un plan d'étude personnalisé

        Cache: 1h - dépend des paramètres et peut nécessiter régénération

        Args:
            notes_content: Liste de notes avec titre et contenu
            target_date: Date cible pour l'examen
            study_time_per_day: Heures d'étude par jour

        Returns:
            Plan d'étude structuré
        """

        notes_summary = "\n\n".join([
            f"**{note['title']}**\n{note['content'][:500]}..."
            for note in notes_content
        ])

        base_system_prompt = "Tu es un expert en planification d'études."
        system_prompt = build_system_prompt_with_language(base_system_prompt, lang)

        prompt = f"""Crée un plan d'étude réaliste jusqu'au {target_date} avec {study_time_per_day}h/jour.

MATIÈRES À COUVRIR:
{notes_summary}

CRITÈRES:
- Répartition équilibrée des sujets
- Sessions de révision espacées
- Temps pour les exercices pratiques
- Jours de repos
- Plan adaptatif et réaliste

IMPORTANT: Réponds avec un JSON structuré:
{{
  "total_days": 30,
  "daily_plan": [
    {{
      "day": 1,
      "date": "2024-01-01",
      "topics": ["Sujet 1", "Sujet 2"],
      "activities": ["Lecture", "Exercices", "Révision"],
      "duration_hours": 2
    }}
  ],
  "milestones": [
    {{
      "date": "2024-01-10",
      "goal": "Finir chapitre 1"
    }}
  ]
}}"""

        try:
            response_text = await self._call_claude(prompt, system_prompt)
            result_text = self._clean_json_response(response_text)

            plan = json.loads(result_text)
            logger.info(f"Plan d'étude généré: {plan.get('total_days', 0)} jours")
            return plan

        except json.JSONDecodeError as e:
            logger.error(f"Erreur de parsing JSON: {e}", exc_info=True)
            raise ValueError(f"Erreur de format JSON: {str(e)}")
        except Exception as e:
            logger.error(f"Erreur lors de la génération du plan: {e}", exc_info=True)
            raise

    @cached_semantic(
        prefix=CachePrefix.AI_EXPLAIN,
        ttl=CacheTTL.VERY_LONG,  # 24h - explications stables
        text_param="concept",
        level_param="level"
    )
    async def explain_concept(
        self,
        concept: str,
        context: Optional[str] = None,
        level: str = "intermediate",
        lang: str = "fr"
    ) -> str:
        """
        Explique un concept de manière pédagogique.

        Cache sémantique: Questions similaires ("pile", "c'est quoi une pile",
        "explique pile") retournent le même résultat.

        Args:
            concept: Le concept à expliquer
            context: Contexte optionnel pour l'explication
            level: Niveau de l'explication (beginner, intermediate, advanced)

        Returns:
            Explication structurée du concept
        """
        base_system_prompt = """Tu es un expert pédagogue qui explique des concepts de manière claire,
        structurée et adaptée au niveau de l'apprenant."""
        system_prompt = build_system_prompt_with_language(base_system_prompt, lang, "explanation")

        context_str = f"\nContexte: {context}" if context else ""

        prompt = f"""Explique le concept suivant de manière pédagogique.

CONCEPT: {concept}{context_str}

NIVEAU: {level}
- beginner: Utilise des analogies simples, évite le jargon
- intermediate: Équilibre entre accessibilité et précision technique
- advanced: Détails techniques, nuances, liens avec concepts avancés

FORMAT DE RÉPONSE:
1. **Définition simple** (2-3 phrases)
2. **Explication détaillée** (1-2 paragraphes)
3. **Exemple concret** (application pratique)
4. **Points clés à retenir** (3-5 bullet points)
5. **Pour aller plus loin** (concepts liés ou ressources)

Réponds directement en Markdown formaté."""

        try:
            explanation = await self._call_claude(prompt, system_prompt)
            result = explanation.strip()
            logger.info(f"Concept expliqué: {concept[:50]}")
            return result

        except Exception as e:
            logger.error(f"Erreur lors de l'explication du concept: {e}", exc_info=True)
            raise


# Instance globale du service
ai_service = AIService()
