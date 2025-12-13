"""
Tâches Celery asynchrones pour l'IA (Claude)

Fonctionnalités:
- Cache Redis intégré avant chaque appel IA
- Batch processing pour traiter plusieurs notes
- Progress tracking en temps réel
- Métriques et observabilité
- Retry automatique avec backoff exponentiel
- Rate limiting pour protéger l'API
"""

import asyncio
import hashlib
import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import anthropic
from celery import Task, chain, group, chord
from celery.exceptions import MaxRetriesExceededError

from app.celery_app import celery_app
from app.core.config import settings
from app.core.i18n import get_language_instruction

# Configuration du logger
logger = logging.getLogger(__name__)


# ==================== Configuration ====================

@dataclass
class TaskMetrics:
    """Métriques pour une tâche IA"""
    task_id: str
    task_name: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    cache_hit: bool = False
    api_calls: int = 0
    tokens_used: int = 0
    processing_time_ms: float = 0.0
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "task_name": self.task_name,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "cache_hit": self.cache_hit,
            "api_calls": self.api_calls,
            "tokens_used": self.tokens_used,
            "processing_time_ms": round(self.processing_time_ms, 2),
            "error": self.error
        }


class AITask(Task):
    """
    Classe de base pour les tâches IA avec:
    - Retry automatique avec backoff exponentiel
    - Métriques intégrées
    - Gestion du cache Redis
    """
    autoretry_for = (anthropic.APIConnectionError, anthropic.RateLimitError)
    retry_kwargs = {"max_retries": 3}
    retry_backoff = True
    retry_backoff_max = 60  # Max 60s entre retries
    retry_jitter = True  # Ajoute du random pour éviter les thundering herds

    # Rate limiting: max 50 tâches/minute par défaut
    rate_limit = "50/m"

    # Timeout: 5 minutes max par tâche
    time_limit = 300
    soft_time_limit = 270

    _client: Optional[anthropic.Anthropic] = None
    _redis = None

    @property
    def client(self) -> anthropic.Anthropic:
        """Client Anthropic lazy-loaded"""
        if self._client is None:
            self._client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        return self._client

    @property
    def redis(self):
        """Client Redis pour le cache (synchrone pour Celery)"""
        if self._redis is None:
            import redis
            self._redis = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True
            )
        return self._redis

    def get_cache_key(self, prefix: str, content_hash: str, **params) -> str:
        """Génère une clé de cache standardisée"""
        param_str = ":".join(f"{k}={v}" for k, v in sorted(params.items()) if v is not None)
        return f"cache:celery:{prefix}:{content_hash}:{param_str}"

    def get_cached(self, key: str) -> Optional[Dict]:
        """Récupère une valeur du cache"""
        try:
            value = self.redis.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            logger.warning(f"Erreur cache GET: {e}")
        return None

    def set_cached(self, key: str, value: Dict, ttl: int = 86400) -> bool:
        """Stocke une valeur dans le cache (default: 24h)"""
        try:
            self.redis.setex(key, ttl, json.dumps(value, default=str))
            return True
        except Exception as e:
            logger.warning(f"Erreur cache SET: {e}")
            return False

    def update_progress(self, progress: int, message: str = "") -> None:
        """Met à jour la progression de la tâche"""
        self.update_state(
            state="PROGRESS",
            meta={"progress": progress, "message": message}
        )

    def content_hash(self, content: str, length: int = 16) -> str:
        """Génère un hash du contenu"""
        return hashlib.md5(content.encode('utf-8')).hexdigest()[:length]


# ==================== Tâches principales ====================

@celery_app.task(base=AITask, bind=True, name="app.tasks.ai_tasks.generate_quiz_from_content")
def generate_quiz_from_content(
    self,
    content: str,
    subject: str,
    difficulty: str = "medium",
    num_questions: int = 10,
    user_id: Optional[int] = None,
    lang: str = "fr"
) -> Dict[str, Any]:
    """
    Génère un quiz à partir d'un contenu avec cache Redis.

    Args:
        content: Contenu à analyser
        subject: Matière/sujet
        difficulty: Difficulté (easy, medium, hard)
        num_questions: Nombre de questions
        user_id: ID utilisateur (optionnel, pour tracking)
        lang: Code de langue de l'utilisateur

    Returns:
        Dict avec les questions générées et métriques
    """
    start_time = time.perf_counter()
    metrics = TaskMetrics(
        task_id=self.request.id,
        task_name="generate_quiz",
        started_at=datetime.now(timezone.utc)
    )

    try:
        # Vérifier le cache (inclut la langue)
        content_hash = self.content_hash(content)
        cache_key = self.get_cache_key(
            "quiz", content_hash,
            difficulty=difficulty,
            num_questions=num_questions,
            lang=lang
        )

        cached = self.get_cached(cache_key)
        if cached:
            metrics.cache_hit = True
            metrics.completed_at = datetime.now(timezone.utc)
            metrics.processing_time_ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Quiz cache HIT: {cache_key}")
            return {
                "success": True,
                "questions": cached.get("questions", []),
                "total_questions": len(cached.get("questions", [])),
                "task_id": self.request.id,
                "cache_hit": True,
                "metrics": metrics.to_dict()
            }

        self.update_progress(10, "Préparation du prompt...")

        # Instruction de langue
        lang_instruction = get_language_instruction(lang)

        # Prompt optimisé pour les quiz
        prompt = f"""Tu es un professeur expert. Génère exactement {num_questions} questions de quiz
de niveau {difficulty} basées sur ce contenu de {subject}.

RÈGLES STRICTES:
- 4 options par question (A, B, C, D)
- 1 seule bonne réponse
- Distracteurs plausibles basés sur erreurs courantes
- Explication pédagogique pour chaque réponse
- Couvre tout le contenu équitablement

{lang_instruction}

CONTENU:
{content}

Format JSON STRICT (pas de markdown):
{{
    "questions": [
        {{
            "question": "Question claire et précise?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": 0,
            "explanation": "Explication de pourquoi A est correct et les autres non",
            "difficulty": "{difficulty}",
            "points": 10
        }}
    ]
}}"""

        self.update_progress(30, "Appel à Claude...")

        message = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            temperature=0.7,
            messages=[{"role": "user", "content": prompt}]
        )

        metrics.api_calls = 1
        metrics.tokens_used = message.usage.input_tokens + message.usage.output_tokens

        self.update_progress(70, "Parsing des résultats...")

        # Nettoyer la réponse JSON
        response_text = message.content[0].text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        result = json.loads(response_text.strip())
        questions = result.get("questions", [])

        # Stocker dans le cache
        self.set_cached(cache_key, {"questions": questions}, ttl=86400)

        self.update_progress(100, "Terminé!")

        metrics.completed_at = datetime.now(timezone.utc)
        metrics.processing_time_ms = (time.perf_counter() - start_time) * 1000

        logger.info(f"Quiz généré: {len(questions)} questions, {metrics.tokens_used} tokens, {metrics.processing_time_ms:.0f}ms")

        return {
            "success": True,
            "questions": questions,
            "total_questions": len(questions),
            "task_id": self.request.id,
            "cache_hit": False,
            "metrics": metrics.to_dict()
        }

    except json.JSONDecodeError as e:
        metrics.error = f"JSON parse error: {str(e)}"
        logger.error(f"Erreur parsing JSON quiz: {e}")
        return {
            "success": False,
            "error": f"Erreur format JSON: {str(e)}",
            "task_id": self.request.id,
            "metrics": metrics.to_dict()
        }
    except Exception as e:
        metrics.error = str(e)
        logger.error(f"Erreur génération quiz: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id,
            "metrics": metrics.to_dict()
        }


@celery_app.task(base=AITask, bind=True, name="app.tasks.ai_tasks.generate_flashcards_from_content")
def generate_flashcards_from_content(
    self,
    content: str,
    subject: str,
    num_flashcards: int = 20,
    difficulty: str = "medium",
    user_id: Optional[int] = None,
    lang: str = "fr"
) -> Dict[str, Any]:
    """
    Génère des flashcards à partir d'un contenu avec cache Redis.

    Args:
        content: Contenu à analyser
        subject: Matière/sujet
        num_flashcards: Nombre de flashcards
        difficulty: Difficulté
        user_id: ID utilisateur
        lang: Code de langue de l'utilisateur

    Returns:
        Dict avec les flashcards générées et métriques
    """
    start_time = time.perf_counter()
    metrics = TaskMetrics(
        task_id=self.request.id,
        task_name="generate_flashcards",
        started_at=datetime.now(timezone.utc)
    )

    try:
        # Vérifier le cache (inclut la langue)
        content_hash = self.content_hash(content)
        cache_key = self.get_cache_key(
            "flashcards", content_hash,
            num_flashcards=num_flashcards,
            difficulty=difficulty,
            lang=lang
        )

        cached = self.get_cached(cache_key)
        if cached:
            metrics.cache_hit = True
            metrics.completed_at = datetime.now(timezone.utc)
            metrics.processing_time_ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Flashcards cache HIT: {cache_key}")
            return {
                "success": True,
                "flashcards": cached.get("flashcards", []),
                "total_flashcards": len(cached.get("flashcards", [])),
                "task_id": self.request.id,
                "cache_hit": True,
                "metrics": metrics.to_dict()
            }

        self.update_progress(10, "Préparation du prompt...")

        # Instruction de langue
        lang_instruction = get_language_instruction(lang)

        # Prompt optimisé v2.1 pour flashcards
        prompt = f"""Tu es un expert en sciences cognitives. Génère exactement {num_flashcards} flashcards
optimisées pour la mémorisation à long terme de ce contenu de {subject}.

RÉPARTITION OBLIGATOIRE:
- 40% : Définitions et faits fondamentaux
- 30% : Applications et exemples concrets
- 20% : Comparaisons et relations entre concepts
- 10% : Analyse critique

RÈGLES DE QUALITÉ:
✓ Front: Question atomique (1 concept), 10-80 caractères
✓ Back: Réponse concise 2-4 phrases avec exemple
✓ Hint: Indice progressif SANS révéler la réponse
✓ Explanation: Contexte + lien avec autres concepts

NIVEAU: {difficulty}

{lang_instruction}

CONTENU:
{content}

Format JSON STRICT (pas de markdown):
{{
    "flashcards": [
        {{
            "front": "Question atomique testant UN concept?",
            "back": "Réponse concise avec exemple",
            "hint": "Catégorie → Contexte → Amorce",
            "explanation": "Importance et liens",
            "difficulty": "{difficulty}",
            "concept_type": "definition|application|comparison|analysis"
        }}
    ]
}}"""

        self.update_progress(30, "Appel à Claude...")

        message = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            temperature=0.7,
            messages=[{"role": "user", "content": prompt}]
        )

        metrics.api_calls = 1
        metrics.tokens_used = message.usage.input_tokens + message.usage.output_tokens

        self.update_progress(70, "Parsing des résultats...")

        # Nettoyer la réponse JSON
        response_text = message.content[0].text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        result = json.loads(response_text.strip())
        flashcards = result.get("flashcards", [])

        # Stocker dans le cache (24h)
        self.set_cached(cache_key, {"flashcards": flashcards}, ttl=86400)

        self.update_progress(100, "Terminé!")

        metrics.completed_at = datetime.now(timezone.utc)
        metrics.processing_time_ms = (time.perf_counter() - start_time) * 1000

        logger.info(f"Flashcards générées: {len(flashcards)}, {metrics.tokens_used} tokens, {metrics.processing_time_ms:.0f}ms")

        return {
            "success": True,
            "flashcards": flashcards,
            "total_flashcards": len(flashcards),
            "task_id": self.request.id,
            "cache_hit": False,
            "metrics": metrics.to_dict()
        }

    except json.JSONDecodeError as e:
        metrics.error = f"JSON parse error: {str(e)}"
        logger.error(f"Erreur parsing JSON flashcards: {e}")
        return {
            "success": False,
            "error": f"Erreur format JSON: {str(e)}",
            "task_id": self.request.id,
            "metrics": metrics.to_dict()
        }
    except Exception as e:
        metrics.error = str(e)
        logger.error(f"Erreur génération flashcards: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id,
            "metrics": metrics.to_dict()
        }


@celery_app.task(base=AITask, bind=True, name="app.tasks.ai_tasks.summarize_content")
def summarize_content(
    self,
    content: str,
    title: str = "",
    max_length: int = 300,
    user_id: Optional[int] = None,
    lang: str = "fr"
) -> Dict[str, Any]:
    """
    Résume un contenu avec cache Redis.

    Args:
        content: Contenu à résumer
        title: Titre optionnel
        max_length: Longueur maximale du résumé en mots
        user_id: ID utilisateur
        lang: Code de langue de l'utilisateur

    Returns:
        Dict avec le résumé et métriques
    """
    start_time = time.perf_counter()
    metrics = TaskMetrics(
        task_id=self.request.id,
        task_name="summarize",
        started_at=datetime.now(timezone.utc)
    )

    try:
        # Vérifier le cache (inclut la langue)
        content_hash = self.content_hash(content)
        cache_key = self.get_cache_key("summary", content_hash, max_length=max_length, lang=lang)

        cached = self.get_cached(cache_key)
        if cached:
            metrics.cache_hit = True
            metrics.completed_at = datetime.now(timezone.utc)
            metrics.processing_time_ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Summary cache HIT: {cache_key}")
            return {
                "success": True,
                "summary": cached.get("summary", ""),
                "task_id": self.request.id,
                "cache_hit": True,
                "metrics": metrics.to_dict()
            }

        self.update_progress(20, "Génération du résumé...")

        title_str = f'"{title}"' if title else "ce contenu"

        # Instruction de langue
        lang_instruction = get_language_instruction(lang)

        prompt = f"""Résume {title_str} en MAX {max_length} mots avec structure hiérarchique.

FORMAT OBLIGATOIRE (Markdown):
**🎯 L'ESSENTIEL** (1 phrase clé)
[Idée centrale]

**📌 Points clés**
- Point principal 1
- Point principal 2
- Point principal 3

**💡 À retenir**
[Phrase de synthèse ou formule clé]

{lang_instruction}

CONTENU:
{content}

LIMITE STRICTE: {max_length} mots. Réponds directement en Markdown."""

        message = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=max_length * 3,
            temperature=0.5,
            messages=[{"role": "user", "content": prompt}]
        )

        metrics.api_calls = 1
        metrics.tokens_used = message.usage.input_tokens + message.usage.output_tokens

        summary = message.content[0].text.strip()

        # Stocker dans le cache (24h)
        self.set_cached(cache_key, {"summary": summary}, ttl=86400)

        self.update_progress(100, "Terminé!")

        metrics.completed_at = datetime.now(timezone.utc)
        metrics.processing_time_ms = (time.perf_counter() - start_time) * 1000

        logger.info(f"Résumé généré: {len(summary.split())} mots, {metrics.processing_time_ms:.0f}ms")

        return {
            "success": True,
            "summary": summary,
            "task_id": self.request.id,
            "cache_hit": False,
            "metrics": metrics.to_dict()
        }

    except Exception as e:
        metrics.error = str(e)
        logger.error(f"Erreur résumé: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id,
            "metrics": metrics.to_dict()
        }


@celery_app.task(base=AITask, bind=True, name="app.tasks.ai_tasks.extract_keywords")
def extract_keywords(
    self,
    content: str,
    num_keywords: int = 10,
    user_id: Optional[int] = None,
    lang: str = "fr"
) -> Dict[str, Any]:
    """
    Extrait les mots-clés d'un contenu avec cache.

    Args:
        content: Contenu à analyser
        num_keywords: Nombre de mots-clés
        user_id: ID utilisateur
        lang: Code de langue de l'utilisateur

    Returns:
        Dict avec les mots-clés et métriques
    """
    start_time = time.perf_counter()
    metrics = TaskMetrics(
        task_id=self.request.id,
        task_name="extract_keywords",
        started_at=datetime.now(timezone.utc)
    )

    try:
        # Vérifier le cache (inclut la langue)
        content_hash = self.content_hash(content)
        cache_key = self.get_cache_key("keywords", content_hash, num_keywords=num_keywords, lang=lang)

        cached = self.get_cached(cache_key)
        if cached:
            metrics.cache_hit = True
            metrics.completed_at = datetime.now(timezone.utc)
            metrics.processing_time_ms = (time.perf_counter() - start_time) * 1000
            return {
                "success": True,
                "keywords": cached.get("keywords", []),
                "concepts": cached.get("concepts", []),
                "task_id": self.request.id,
                "cache_hit": True,
                "metrics": metrics.to_dict()
            }

        # Instruction de langue
        lang_instruction = get_language_instruction(lang)

        prompt = f"""Analyse ce contenu et extrais les {num_keywords} mots-clés les plus importants.

{lang_instruction}

CONTENU:
{content}

Format JSON:
{{
    "keywords": ["mot1", "mot2", ...],
    "concepts": [
        {{"keyword": "concept", "importance": 0.95, "context": "brève explication"}}
    ]
}}"""

        message = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            temperature=0.5,
            messages=[{"role": "user", "content": prompt}]
        )

        metrics.api_calls = 1
        metrics.tokens_used = message.usage.input_tokens + message.usage.output_tokens

        # Parser le JSON
        response_text = message.content[0].text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]

        result = json.loads(response_text.strip())
        keywords = result.get("keywords", [])
        concepts = result.get("concepts", [])

        # Cache
        self.set_cached(cache_key, {"keywords": keywords, "concepts": concepts}, ttl=86400)

        metrics.completed_at = datetime.now(timezone.utc)
        metrics.processing_time_ms = (time.perf_counter() - start_time) * 1000

        return {
            "success": True,
            "keywords": keywords,
            "concepts": concepts,
            "task_id": self.request.id,
            "cache_hit": False,
            "metrics": metrics.to_dict()
        }

    except Exception as e:
        metrics.error = str(e)
        logger.error(f"Erreur extraction keywords: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id,
            "metrics": metrics.to_dict()
        }


# ==================== Batch Processing ====================

@celery_app.task(base=AITask, bind=True, name="app.tasks.ai_tasks.batch_generate_content")
def batch_generate_content(
    self,
    notes: List[Dict[str, Any]],
    operations: List[str],
    user_id: int
) -> Dict[str, Any]:
    """
    Traite plusieurs notes avec plusieurs opérations IA en batch.

    Args:
        notes: Liste de notes [{"id": 1, "title": "...", "content": "..."}]
        operations: Liste d'opérations ["flashcards", "quiz", "summary", "keywords"]
        user_id: ID utilisateur

    Returns:
        Dict avec tous les résultats par note et opération
    """
    start_time = time.perf_counter()
    total_tasks = len(notes) * len(operations)
    completed = 0
    results = {}

    logger.info(f"Batch processing: {len(notes)} notes x {len(operations)} ops = {total_tasks} tâches")

    for note in notes:
        note_id = note.get("id")
        note_title = note.get("title", "")
        note_content = note.get("content", "")

        if not note_content:
            continue

        results[note_id] = {}

        for operation in operations:
            try:
                self.update_progress(
                    int((completed / total_tasks) * 100),
                    f"Note {note_id}: {operation}..."
                )

                if operation == "flashcards":
                    result = generate_flashcards_from_content(
                        content=note_content,
                        subject=note_title,
                        num_flashcards=10,
                        user_id=user_id
                    )
                elif operation == "quiz":
                    result = generate_quiz_from_content(
                        content=note_content,
                        subject=note_title,
                        num_questions=5,
                        user_id=user_id
                    )
                elif operation == "summary":
                    result = summarize_content(
                        content=note_content,
                        title=note_title,
                        user_id=user_id
                    )
                elif operation == "keywords":
                    result = extract_keywords(
                        content=note_content,
                        user_id=user_id
                    )
                else:
                    result = {"success": False, "error": f"Opération inconnue: {operation}"}

                results[note_id][operation] = result
                completed += 1

            except Exception as e:
                logger.error(f"Erreur batch note {note_id} op {operation}: {e}")
                results[note_id][operation] = {
                    "success": False,
                    "error": str(e)
                }
                completed += 1

    self.update_progress(100, "Batch terminé!")

    processing_time = (time.perf_counter() - start_time) * 1000

    # Calculer les stats
    cache_hits = sum(
        1 for note_results in results.values()
        for op_result in note_results.values()
        if op_result.get("cache_hit", False)
    )

    successes = sum(
        1 for note_results in results.values()
        for op_result in note_results.values()
        if op_result.get("success", False)
    )

    return {
        "success": True,
        "results": results,
        "stats": {
            "total_tasks": total_tasks,
            "successes": successes,
            "failures": total_tasks - successes,
            "cache_hits": cache_hits,
            "cache_hit_rate": round((cache_hits / total_tasks) * 100, 1) if total_tasks > 0 else 0,
            "processing_time_ms": round(processing_time, 0)
        },
        "task_id": self.request.id
    }


@celery_app.task(base=AITask, bind=True, name="app.tasks.ai_tasks.generate_study_plan")
def generate_study_plan(
    self,
    subject_name: str,
    exam_date: str,
    available_hours: int,
    difficulty_level: str,
    current_knowledge: List[str],
    user_id: Optional[int] = None,
    lang: str = "fr"
) -> Dict[str, Any]:
    """
    Génère un plan d'étude personnalisé avec cache.

    Args:
        subject_name: Nom de la matière
        exam_date: Date de l'examen (ISO format)
        available_hours: Heures disponibles par semaine
        difficulty_level: Niveau (beginner, intermediate, advanced)
        current_knowledge: Concepts déjà maîtrisés
        user_id: ID utilisateur
        lang: Code de langue de l'utilisateur

    Returns:
        Dict avec le plan d'étude
    """
    start_time = time.perf_counter()
    metrics = TaskMetrics(
        task_id=self.request.id,
        task_name="generate_study_plan",
        started_at=datetime.now(timezone.utc)
    )

    try:
        # Cache key basé sur les paramètres (pas de contenu)
        params_hash = self.content_hash(
            f"{subject_name}:{exam_date}:{available_hours}:{difficulty_level}:{','.join(sorted(current_knowledge or []))}"
        )
        cache_key = self.get_cache_key("study_plan", params_hash)

        cached = self.get_cached(cache_key)
        if cached:
            metrics.cache_hit = True
            metrics.completed_at = datetime.now(timezone.utc)
            metrics.processing_time_ms = (time.perf_counter() - start_time) * 1000
            return {
                "success": True,
                "plan": cached,
                "task_id": self.request.id,
                "cache_hit": True,
                "metrics": metrics.to_dict()
            }

        self.update_progress(20, "Création du plan d'étude...")

        # Instruction de langue
        lang_instruction = get_language_instruction(lang)

        prompt = f"""Crée un plan d'étude personnalisé détaillé:

Matière: {subject_name}
Examen: {exam_date}
Disponibilité: {available_hours}h/semaine
Niveau: {difficulty_level}
Concepts maîtrisés: {', '.join(current_knowledge) if current_knowledge else 'Aucun'}

{lang_instruction}

Format JSON:
{{
    "weekly_schedule": [
        {{
            "week": 1,
            "topics": ["topic1", "topic2"],
            "hours_allocated": 10,
            "goals": ["goal1", "goal2"],
            "resources": ["resource1"]
        }}
    ],
    "milestones": [
        {{"date": "2025-01-15", "description": "Finir chapitre 1"}}
    ],
    "daily_routine": {{
        "morning": "Révision des concepts",
        "afternoon": "Exercices pratiques",
        "evening": "Flashcards"
    }},
    "tips": ["tip1", "tip2"]
}}"""

        message = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=3000,
            temperature=0.7,
            messages=[{"role": "user", "content": prompt}]
        )

        metrics.api_calls = 1
        metrics.tokens_used = message.usage.input_tokens + message.usage.output_tokens

        # Parser le JSON
        response_text = message.content[0].text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]

        result = json.loads(response_text.strip())

        # Cache pour 1h (plan peut nécessiter régénération)
        self.set_cached(cache_key, result, ttl=3600)

        self.update_progress(100, "Plan créé!")

        metrics.completed_at = datetime.now(timezone.utc)
        metrics.processing_time_ms = (time.perf_counter() - start_time) * 1000

        return {
            "success": True,
            "plan": result,
            "task_id": self.request.id,
            "cache_hit": False,
            "metrics": metrics.to_dict()
        }

    except Exception as e:
        metrics.error = str(e)
        logger.error(f"Erreur génération plan d'étude: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id,
            "metrics": metrics.to_dict()
        }


@celery_app.task(base=AITask, bind=True, name="app.tasks.ai_tasks.analyze_study_progress")
def analyze_study_progress(
    self,
    user_id: int,
    subject_id: int,
    notes_content: List[str],
    quiz_results: List[Dict],
    flashcard_stats: Optional[Dict] = None,
    lang: str = "fr"
) -> Dict[str, Any]:
    """
    Analyse les progrès d'apprentissage avec recommandations personnalisées.

    Args:
        user_id: ID utilisateur
        subject_id: ID matière
        notes_content: Contenus des notes
        quiz_results: Résultats des quiz
        flashcard_stats: Stats flashcards optionnelles
        lang: Code de langue de l'utilisateur

    Returns:
        Dict avec analyse et recommandations
    """
    start_time = time.perf_counter()
    metrics = TaskMetrics(
        task_id=self.request.id,
        task_name="analyze_progress",
        started_at=datetime.now(timezone.utc)
    )

    try:
        # Calculer les stats
        avg_score = sum(q.get('score', 0) for q in quiz_results) / len(quiz_results) if quiz_results else 0

        self.update_progress(20, "Analyse des données...")

        # Instruction de langue
        lang_instruction = get_language_instruction(lang)

        prompt = f"""Analyse les progrès d'apprentissage de cet étudiant et fournis des recommandations personnalisées:

DONNÉES:
- Notes prises: {len(notes_content)} notes
- Quiz passés: {len(quiz_results)} quiz
- Score moyen: {avg_score:.1f}%
- Flashcards: {flashcard_stats if flashcard_stats else 'Pas de données'}

ANALYSE REQUISE:
1. Points forts identifiés (3-5 items)
2. Lacunes à combler (3-5 items avec priorité)
3. Recommandations d'étude personnalisées (5-7 items)
4. Prochaines étapes concrètes (3-5 actions)
5. Estimation du niveau actuel (0-100%)

{lang_instruction}

Format JSON:
{{
    "strengths": ["point fort 1", "point fort 2"],
    "weaknesses": [{{"topic": "sujet", "priority": "high|medium|low", "suggestion": "conseil"}}],
    "recommendations": ["recommandation 1", "recommandation 2"],
    "next_steps": ["étape 1", "étape 2"],
    "current_level": 65,
    "confidence_score": 0.85
}}"""

        message = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            temperature=0.7,
            messages=[{"role": "user", "content": prompt}]
        )

        metrics.api_calls = 1
        metrics.tokens_used = message.usage.input_tokens + message.usage.output_tokens

        # Parser le JSON
        response_text = message.content[0].text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]

        result = json.loads(response_text.strip())

        self.update_progress(100, "Analyse terminée!")

        metrics.completed_at = datetime.now(timezone.utc)
        metrics.processing_time_ms = (time.perf_counter() - start_time) * 1000

        return {
            "success": True,
            "analysis": result,
            "task_id": self.request.id,
            "metrics": metrics.to_dict()
        }

    except Exception as e:
        metrics.error = str(e)
        logger.error(f"Erreur analyse progrès: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id,
            "metrics": metrics.to_dict()
        }


# ==================== Utilitaires ====================

@celery_app.task(name="app.tasks.ai_tasks.get_cache_stats")
def get_cache_stats() -> Dict[str, Any]:
    """
    Retourne les statistiques du cache Celery IA.
    """
    import redis
    try:
        r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

        # Compter les clés par préfixe
        prefixes = ["quiz", "flashcards", "summary", "keywords", "study_plan"]
        stats = {}

        for prefix in prefixes:
            pattern = f"cache:celery:{prefix}:*"
            keys = list(r.scan_iter(match=pattern, count=100))
            stats[prefix] = len(keys)

        # Info mémoire
        info = r.info("memory")

        return {
            "success": True,
            "cache_counts": stats,
            "total_cached": sum(stats.values()),
            "memory_used": info.get("used_memory_human", "N/A"),
            "memory_peak": info.get("used_memory_peak_human", "N/A")
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@celery_app.task(name="app.tasks.ai_tasks.clear_cache")
def clear_cache(prefix: Optional[str] = None) -> Dict[str, Any]:
    """
    Vide le cache Celery IA (tout ou par préfixe).

    Args:
        prefix: Préfixe optionnel (quiz, flashcards, summary, etc.)
    """
    import redis
    try:
        r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

        if prefix:
            pattern = f"cache:celery:{prefix}:*"
        else:
            pattern = "cache:celery:*"

        keys = list(r.scan_iter(match=pattern, count=1000))

        if keys:
            r.delete(*keys)

        logger.info(f"Cache Celery vidé: {len(keys)} clés supprimées (pattern: {pattern})")

        return {
            "success": True,
            "deleted_count": len(keys),
            "pattern": pattern
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
