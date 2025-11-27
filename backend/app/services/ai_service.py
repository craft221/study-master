"""
Service IA pour la génération de contenu pédagogique
Utilise Claude Sonnet 4.5 (Anthropic) pour générer flashcards, quiz, résumés, etc.
"""

from anthropic import Anthropic
from typing import List, Dict, Any, Optional
import json
import os
from datetime import date

# Configuration de l'API Anthropic (Claude)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    raise ValueError("ANTHROPIC_API_KEY non configurée dans les variables d'environnement")

client = Anthropic(api_key=ANTHROPIC_API_KEY)


class AIService:
    """Service centralisé pour toutes les fonctionnalités IA avec Claude Sonnet 4.5"""

    def __init__(self):
        self.model = "claude-sonnet-4-20250514"  # Claude Sonnet 4.5
        self.max_tokens = 4096

    def _call_claude(self, prompt: str, system_prompt: str = "") -> str:
        """
        Appelle l'API Claude et retourne la réponse

        Args:
            prompt: Le prompt utilisateur
            system_prompt: Instructions système optionnelles

        Returns:
            Texte de réponse de Claude
        """
        try:
            message = client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                temperature=0.7,
                system=system_prompt if system_prompt else "Tu es un assistant IA expert en pédagogie.",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            # Extraire le texte de la réponse
            if message.content and len(message.content) > 0:
                return message.content[0].text
            else:
                raise ValueError("Réponse vide de Claude")

        except Exception as e:
            print(f"Erreur lors de l'appel à Claude: {e}")
            raise

    async def generate_flashcards_from_note(
        self,
        note_content: str,
        note_title: str,
        count: int = 10,
        difficulty: str = "medium"
    ) -> List[Dict[str, str]]:
        """
        Génère des flashcards à partir d'une note avec qualité pédagogique améliorée

        Args:
            note_content: Contenu de la note
            note_title: Titre de la note
            count: Nombre de flashcards à générer
            difficulty: Niveau de difficulté (easy/medium/hard)

        Returns:
            Liste de flashcards avec front, back, hint, explanation
        """

        system_prompt = "Tu es un expert pédagogique qui crée des flashcards efficaces pour l'apprentissage basé sur la répétition espacée."

        prompt = f"""À partir de cette note intitulée "{note_title}", crée exactement {count} flashcards de qualité VARIÉES et COMPLÉMENTAIRES.

INSTRUCTIONS DE QUALITÉ:
- Varie les TYPES de questions:
  * Définitions et concepts clés
  * Applications pratiques et exemples
  * Comparaisons et différences
  * Causes et conséquences
  * Résolution de problèmes
  * Analyse et synthèse
- Utilise LaTeX pour les formules mathématiques avec $...$ (inline) ou $$...$$ (bloc)
- Front: Question claire, concise et stimulante (test la compréhension, pas la mémorisation brute)
- Back: Réponse précise, complète avec exemples si pertinent
- Hint: Indice progressif qui guide sans révéler la réponse
- Explanation: Contexte détaillé, pourquoi c'est important, liens avec autres concepts

BONNES PRATIQUES:
✓ Une seule idée par flashcard
✓ Questions formulées activement ("Pourquoi...", "Comment...", "Quelle est la différence...")
✓ Réponses structurées et mémorables
✓ Utilise LaTeX pour math: $E = mc^2$ ou $$\\int_0^\\infty e^{{-x^2}} dx$$
✓ Évite "Qu'est-ce que..." (trop passif)
✓ Couvre toutes les sections de la note

NIVEAU DE DIFFICULTÉ: {difficulty}
- easy: Définitions de base, faits simples
- medium: Applications, comparaisons, causes/effets
- hard: Analyse complexe, synthèse, résolution de problèmes

CONTENU DE LA NOTE:
{note_content}

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas de ```json):
{{
  "flashcards": [
    {{
      "front": "Question claire et engageante",
      "back": "Réponse précise et complète",
      "hint": "Indice progressif",
      "explanation": "Contexte et importance du concept"
    }}
  ]
}}"""

        try:
            response_text = self._call_claude(prompt, system_prompt)
            result_text = response_text.strip()

            # Nettoyage du JSON
            if result_text.startswith("```json"):
                result_text = result_text[7:]
            if result_text.startswith("```"):
                result_text = result_text[3:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]
            result_text = result_text.strip()

            result = json.loads(result_text)
            flashcards = result.get("flashcards", [])

            # Validation
            if not flashcards:
                raise ValueError("Aucune flashcard générée")

            # Limiter au nombre demandé
            return flashcards[:count]

        except json.JSONDecodeError as e:
            print(f"Erreur de parsing JSON: {e}")
            print(f"Réponse brute: {result_text}")
            raise ValueError(f"Erreur de format JSON: {str(e)}")
        except Exception as e:
            print(f"Erreur lors de la génération: {e}")
            raise

    async def generate_quiz_from_note(
        self,
        note_content: str,
        note_title: str,
        question_count: int = 10,
        question_types: Optional[List[str]] = None,
        difficulty: str = "medium"
    ) -> Dict[str, Any]:
        """
        Génère un quiz à partir d'une note avec qualité pédagogique améliorée

        Args:
            note_content: Contenu de la note
            note_title: Titre de la note
            question_count: Nombre de questions
            question_types: Types de questions (multiple_choice, true_false, short_answer)
            difficulty: Niveau de difficulté

        Returns:
            Dict avec le quiz complet
        """

        if question_types is None:
            question_types = ["multiple_choice", "true_false", "short_answer"]

        types_str = ", ".join(question_types)

        system_prompt = "Tu es un expert pédagogique qui crée des quiz de qualité pour évaluer la compréhension."

        prompt = f"""À partir de cette note intitulée "{note_title}", crée un quiz de {question_count} questions avec les types suivants: {types_str}.

RÈGLES PAR TYPE:

**multiple_choice**:
- Question claire testant compréhension profonde
- 4 options (A, B, C, D)
- 1 réponse correcte
- 3 distracteurs PLAUSIBLES mais incorrects (erreurs communes, concepts liés)
- Évite "toutes les réponses" ou "aucune de ces réponses"

**true_false**:
- Affirmation claire et non ambiguë
- Teste un concept spécifique
- Évite les généralisations absolues

**short_answer**:
- Question ouverte nécessitant réflexion
- Réponse attendue précise (2-3 phrases)
- Peut inclure résolution de problème

QUALITÉ:
✓ Varie les niveaux cognitifs (Bloom): mémorisation, compréhension, application, analyse
✓ Couvre différentes sections de la note
✓ Utilise LaTeX pour math: $E = mc^2$ ou $$\\frac{{a}}{{b}}$$
✓ Explications pédagogiques avec contexte
✓ Distracteurs basés sur erreurs communes réelles

NIVEAU: {difficulty}
- easy: Reconnaissance, définitions
- medium: Compréhension, application
- hard: Analyse, évaluation, création

CONTENU DE LA NOTE:
{note_content}

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide (pas de markdown):
{{
  "title": "{note_title} - Quiz",
  "description": "Quiz sur {note_title}",
  "questions": [
    {{
      "type": "multiple_choice",
      "question": "Question claire avec $LaTeX$ si nécessaire",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "explanation": "Explication détaillée avec contexte",
      "difficulty_level": "medium",
      "topic": "Section de la note"
    }},
    {{
      "type": "true_false",
      "question": "Affirmation claire",
      "correct_answer": true,
      "explanation": "Pourquoi vrai/faux avec contexte"
    }},
    {{
      "type": "short_answer",
      "question": "Question ouverte",
      "expected_answer": "Réponse attendue détaillée",
      "explanation": "Contexte et points clés"
    }}
  ]
}}"""

        try:
            response_text = self._call_claude(prompt, system_prompt)
            result_text = response_text.strip()

            # Nettoyage du JSON
            if result_text.startswith("```json"):
                result_text = result_text[7:]
            if result_text.startswith("```"):
                result_text = result_text[3:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]
            result_text = result_text.strip()

            quiz_data = json.loads(result_text)

            # Validation
            if "questions" not in quiz_data or not quiz_data["questions"]:
                raise ValueError("Aucune question générée")

            # Limiter au nombre demandé
            quiz_data["questions"] = quiz_data["questions"][:question_count]

            return quiz_data

        except json.JSONDecodeError as e:
            print(f"Erreur de parsing JSON: {e}")
            print(f"Réponse brute: {result_text}")
            raise ValueError(f"Erreur de format JSON: {str(e)}")
        except Exception as e:
            print(f"Erreur lors de la génération: {e}")
            raise

    async def summarize_note(
        self,
        note_content: str,
        note_title: str,
        max_length: int = 300
    ) -> str:
        """
        Résume une note de manière concise

        Args:
            note_content: Contenu de la note
            note_title: Titre de la note
            max_length: Longueur maximale du résumé en mots

        Returns:
            Résumé de la note
        """

        system_prompt = "Tu es un expert en synthèse pédagogique."

        prompt = f"""Résume cette note intitulée "{note_title}" en maximum {max_length} mots.

CRITÈRES:
- Identifie les concepts clés et idées principales
- Structure claire (introduction, points clés, conclusion)
- Langage concis mais précis
- Préserve les formules LaTeX importantes avec $...$
- Focus sur CE QU'IL FAUT RETENIR

CONTENU:
{note_content}

IMPORTANT: Réponds UNIQUEMENT avec le résumé en texte brut (Markdown accepté, LaTeX avec $...$):"""

        try:
            summary = self._call_claude(prompt, system_prompt)
            return summary.strip()

        except Exception as e:
            print(f"Erreur lors du résumé: {e}")
            raise

    async def extract_keywords(
        self,
        note_content: str,
        note_title: str,
        max_keywords: int = 10
    ) -> List[str]:
        """
        Extrait les mots-clés d'une note

        Args:
            note_content: Contenu de la note
            note_title: Titre de la note
            max_keywords: Nombre maximum de mots-clés

        Returns:
            Liste de mots-clés
        """

        system_prompt = "Tu es un expert en analyse de contenu pédagogique."

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
            response_text = self._call_claude(prompt, system_prompt)
            result_text = response_text.strip()

            # Nettoyage du JSON
            if result_text.startswith("```json"):
                result_text = result_text[7:]
            if result_text.startswith("```"):
                result_text = result_text[3:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]
            result_text = result_text.strip()

            result = json.loads(result_text)
            keywords = result.get("keywords", [])

            return keywords[:max_keywords]

        except json.JSONDecodeError as e:
            print(f"Erreur de parsing JSON: {e}")
            raise ValueError(f"Erreur de format JSON: {str(e)}")
        except Exception as e:
            print(f"Erreur lors de l'extraction: {e}")
            raise

    async def generate_study_plan(
        self,
        notes_content: List[Dict[str, str]],
        target_date: date,
        study_time_per_day: int = 2
    ) -> Dict[str, Any]:
        """
        Génère un plan d'étude personnalisé

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

        system_prompt = "Tu es un expert en planification d'études."

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
            response_text = self._call_claude(prompt, system_prompt)
            result_text = response_text.strip()

            # Nettoyage
            if result_text.startswith("```json"):
                result_text = result_text[7:]
            if result_text.startswith("```"):
                result_text = result_text[3:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]
            result_text = result_text.strip()

            plan = json.loads(result_text)
            return plan

        except json.JSONDecodeError as e:
            print(f"Erreur de parsing JSON: {e}")
            raise ValueError(f"Erreur de format JSON: {str(e)}")
        except Exception as e:
            print(f"Erreur lors de la génération du plan: {e}")
            raise


# Instance globale du service
ai_service = AIService()
