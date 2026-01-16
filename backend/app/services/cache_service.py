"""
Service de Cache Redis Asynchrone pour Studera
Cache distribué haute performance avec métriques et observabilité
"""

import asyncio
import hashlib
import json
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from functools import wraps
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union

import redis.asyncio as aioredis
from redis.asyncio import Redis

from app.core.config import settings

# Configuration du logger
logger = logging.getLogger(__name__)

# Type variable pour les décorateurs génériques
T = TypeVar('T')


class CachePrefix(str, Enum):
    """Préfixes standardisés pour les clés de cache"""
    # IA
    AI_FLASHCARDS = "ai:flashcards"
    AI_QUIZ = "ai:quiz"
    AI_SUMMARY = "ai:summary"
    AI_KEYWORDS = "ai:keywords"
    AI_EXPLAIN = "ai:explain"
    AI_STUDY_PLAN = "ai:study_plan"

    # Exam Mode IA
    EXAM_KEY_POINTS = "exam:key_points"
    EXAM_WEAK_POINTS = "exam:weak_points"
    EXAM_ADVICE = "exam:advice"
    EXAM_PRACTICE = "exam:practice"

    # Mascotte
    MASCOT = "mascot"
    MASCOT_STATE = "mascot:state"
    MASCOT_ACCESSORIES = "mascot:accessories"
    MASCOT_AI = "mascot:ai"

    # Duels
    DUEL = "duel"
    DUEL_PENDING = "duel:pending"
    DUEL_STATS = "duel:stats"

    # Notifications
    NOTIFICATION = "notification"
    NOTIFICATION_UNREAD = "notification:unread"

    # Autres
    LEADERBOARD = "leaderboard"
    ACHIEVEMENTS = "achievements"
    USER_STATS = "user:stats"
    USER_PROFILE = "user:profile"
    SEMANTIC = "semantic"


class CacheTTL:
    """Durées de vie standardisées (en secondes)"""
    VERY_SHORT = 60          # 1 minute - données très dynamiques
    SHORT = 300              # 5 minutes - leaderboards, stats
    MEDIUM = 1800            # 30 minutes - achievements, accessories
    LONG = 3600              # 1 heure - réponses IA mascotte
    VERY_LONG = 86400        # 24 heures - contenu IA généré (flashcards, quiz)
    PERMANENT = 604800       # 7 jours - données statiques


@dataclass
class CacheMetrics:
    """Métriques de performance du cache"""
    hits: int = 0
    misses: int = 0
    errors: int = 0
    total_get_time_ms: float = 0.0
    total_set_time_ms: float = 0.0
    total_operations: int = 0
    bytes_read: int = 0
    bytes_written: int = 0
    evictions: int = 0
    start_time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # Métriques par préfixe
    hits_by_prefix: Dict[str, int] = field(default_factory=dict)
    misses_by_prefix: Dict[str, int] = field(default_factory=dict)

    @property
    def hit_rate(self) -> float:
        """Taux de succès du cache (%)"""
        total = self.hits + self.misses
        return (self.hits / total * 100) if total > 0 else 0.0

    @property
    def avg_get_time_ms(self) -> float:
        """Temps moyen d'une opération GET (ms)"""
        return self.total_get_time_ms / self.hits if self.hits > 0 else 0.0

    @property
    def avg_set_time_ms(self) -> float:
        """Temps moyen d'une opération SET (ms)"""
        sets = self.total_operations - self.hits - self.misses
        return self.total_set_time_ms / sets if sets > 0 else 0.0

    @property
    def uptime_seconds(self) -> float:
        """Durée de fonctionnement en secondes"""
        return (datetime.now(timezone.utc) - self.start_time).total_seconds()

    def to_dict(self) -> Dict[str, Any]:
        """Convertit les métriques en dictionnaire pour l'API"""
        return {
            "hits": self.hits,
            "misses": self.misses,
            "errors": self.errors,
            "hit_rate_percent": round(self.hit_rate, 2),
            "avg_get_time_ms": round(self.avg_get_time_ms, 3),
            "avg_set_time_ms": round(self.avg_set_time_ms, 3),
            "total_operations": self.total_operations,
            "bytes_read": self.bytes_read,
            "bytes_written": self.bytes_written,
            "uptime_seconds": round(self.uptime_seconds, 0),
            "hits_by_prefix": self.hits_by_prefix,
            "misses_by_prefix": self.misses_by_prefix
        }


class AsyncCacheService:
    """
    Service de cache Redis asynchrone haute performance.

    Fonctionnalités:
    - Opérations non-bloquantes (async/await)
    - Cache sémantique pour requêtes IA similaires
    - Métriques détaillées et observabilité
    - Invalidation intelligente par patterns
    - Compression optionnelle pour gros objets
    - Circuit breaker en cas de panne Redis
    """

    def __init__(self):
        self._client: Optional[Redis] = None
        self._enabled: bool = False
        self._connected: bool = False
        self._metrics = CacheMetrics()
        self._lock = asyncio.Lock()

        # Circuit breaker
        self._consecutive_errors: int = 0
        self._circuit_open: bool = False
        self._circuit_open_time: Optional[datetime] = None
        self._max_consecutive_errors: int = 5
        self._circuit_reset_seconds: int = 30

        # Stop words français pour cache sémantique
        self._stop_words = frozenset({
            'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'à', 'au', 'aux',
            'est', 'sont', 'et', 'ou', 'pour', 'avec', 'dans', 'sur', 'par',
            'comment', 'pourquoi', 'quand', 'où', 'qui', 'que', 'quoi',
            'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
            'mon', 'ton', 'son', 'ma', 'ta', 'sa', 'mes', 'tes', 'ses',
            'ce', 'cette', 'ces', 'quel', 'quelle', 'quels', 'quelles',
            'peux', 'peut', 'puis', 'faut', 'dois', 'doit', 'suis', 'es',
            'faire', 'fait', 'être', 'avoir', 'aller', 'venir', 'voir',
            'plus', 'moins', 'très', 'bien', 'mal', 'aussi', 'encore'
        })

    async def initialize(self) -> bool:
        """
        Initialise la connexion Redis asynchrone.
        Doit être appelé au démarrage de l'application.
        """
        try:
            self._client = await aioredis.from_url(
                settings.REDIS_URL,
                encoding='utf-8',
                decode_responses=True,
                max_connections=20,
                socket_timeout=5.0,
                socket_connect_timeout=5.0,
                retry_on_timeout=True
            )

            # Test de connexion
            await self._client.ping()

            self._enabled = True
            self._connected = True
            self._consecutive_errors = 0

            logger.info("Redis cache initialisé avec succès")
            return True

        except Exception as e:
            logger.error(f"Erreur initialisation Redis: {e}")
            self._enabled = False
            self._connected = False
            return False

    async def close(self) -> None:
        """Ferme proprement la connexion Redis"""
        if self._client:
            await self._client.close()
            self._connected = False
            logger.info("Connexion Redis fermée")

    @property
    def enabled(self) -> bool:
        """Vérifie si le cache est disponible"""
        return self._enabled and self._connected and not self._circuit_open

    @property
    def metrics(self) -> CacheMetrics:
        """Accès aux métriques"""
        return self._metrics

    def _check_circuit_breaker(self) -> bool:
        """
        Vérifie l'état du circuit breaker.
        Retourne True si le circuit est fermé (opérations autorisées).
        """
        if not self._circuit_open:
            return True

        # Vérifier si on peut réinitialiser le circuit
        if self._circuit_open_time:
            elapsed = (datetime.now(timezone.utc) - self._circuit_open_time).total_seconds()
            if elapsed >= self._circuit_reset_seconds:
                self._circuit_open = False
                self._consecutive_errors = 0
                logger.info("Circuit breaker réinitialisé")
                return True

        return False

    def _record_error(self) -> None:
        """Enregistre une erreur et gère le circuit breaker"""
        self._metrics.errors += 1
        self._consecutive_errors += 1

        if self._consecutive_errors >= self._max_consecutive_errors:
            self._circuit_open = True
            self._circuit_open_time = datetime.now(timezone.utc)
            logger.warning(f"Circuit breaker ouvert après {self._consecutive_errors} erreurs consécutives")

    def _record_success(self) -> None:
        """Enregistre un succès et réinitialise le compteur d'erreurs"""
        self._consecutive_errors = 0

    def _extract_prefix(self, key: str) -> str:
        """Extrait le préfixe d'une clé pour les métriques"""
        parts = key.replace("cache:", "").split(":")
        return parts[0] if parts else "unknown"

    def _serialize(self, value: Any) -> str:
        """Sérialise une valeur Python en JSON"""
        return json.dumps(value, default=str, ensure_ascii=False)

    def _deserialize(self, value: str) -> Any:
        """Désérialise un JSON en valeur Python"""
        return json.loads(value)

    def generate_key(self, prefix: Union[str, CachePrefix], *args, **kwargs) -> str:
        """
        Génère une clé de cache unique et standardisée.

        Args:
            prefix: Préfixe de la clé (utiliser CachePrefix)
            *args: Arguments positionnels à inclure
            **kwargs: Arguments nommés à inclure

        Returns:
            Clé formatée: cache:prefix:arg1:arg2:key1=val1:key2=val2
        """
        prefix_str = prefix.value if isinstance(prefix, CachePrefix) else prefix
        parts = [prefix_str]

        # Ajouter les args non-None
        for arg in args:
            if arg is not None:
                parts.append(str(arg))

        # Ajouter les kwargs triés (pour cohérence)
        for k, v in sorted(kwargs.items()):
            if v is not None:
                parts.append(f"{k}={v}")

        return f"cache:{':'.join(parts)}"

    def generate_content_hash(self, content: str, length: int = 16) -> str:
        """
        Génère un hash court du contenu pour les clés de cache.

        Args:
            content: Contenu à hasher
            length: Longueur du hash (default: 16)

        Returns:
            Hash MD5 tronqué
        """
        return hashlib.md5(content.encode('utf-8')).hexdigest()[:length]

    def normalize_for_semantic_cache(self, text: str) -> str:
        """
        Normalise un texte pour le cache sémantique.
        Questions similaires produiront le même hash.

        Args:
            text: Texte à normaliser

        Returns:
            Texte normalisé (mots clés triés)
        """
        # Minuscules
        normalized = text.lower()

        # Supprimer ponctuation (garder espaces)
        normalized = re.sub(r'[^\w\s]', '', normalized)

        # Séparer en mots, filtrer stop words et mots courts
        words = normalized.split()
        filtered = [w for w in words if w not in self._stop_words and len(w) > 2]

        # Trier pour que l'ordre n'importe pas
        filtered.sort()

        return ' '.join(filtered)

    def generate_semantic_key(
        self,
        text: str,
        prefix: Union[str, CachePrefix] = CachePrefix.SEMANTIC,
        context_level: int = 1
    ) -> str:
        """
        Génère une clé de cache sémantique.

        Args:
            text: Texte source (question, recherche)
            prefix: Préfixe de la clé
            context_level: Niveau de contexte utilisateur (1-10)

        Returns:
            Clé sémantique
        """
        normalized = self.normalize_for_semantic_cache(text)
        semantic_hash = self.generate_content_hash(normalized, 12)
        prefix_str = prefix.value if isinstance(prefix, CachePrefix) else prefix
        return f"cache:{prefix_str}:{semantic_hash}:lv{context_level}"

    async def get(self, key: str) -> Optional[Any]:
        """
        Récupère une valeur du cache.

        Args:
            key: Clé de cache

        Returns:
            Valeur désérialisée ou None si non trouvée/erreur
        """
        if not self.enabled or not self._check_circuit_breaker():
            return None

        prefix = self._extract_prefix(key)
        start_time = time.perf_counter()

        try:
            value = await self._client.get(key)
            elapsed_ms = (time.perf_counter() - start_time) * 1000

            if value is not None:
                # Cache HIT
                self._metrics.hits += 1
                self._metrics.hits_by_prefix[prefix] = self._metrics.hits_by_prefix.get(prefix, 0) + 1
                self._metrics.total_get_time_ms += elapsed_ms
                self._metrics.bytes_read += len(value)
                self._record_success()

                logger.debug(f"Cache HIT [{elapsed_ms:.2f}ms]: {key}")
                return self._deserialize(value)
            else:
                # Cache MISS
                self._metrics.misses += 1
                self._metrics.misses_by_prefix[prefix] = self._metrics.misses_by_prefix.get(prefix, 0) + 1
                self._record_success()

                logger.debug(f"Cache MISS: {key}")
                return None

        except Exception as e:
            self._record_error()
            logger.error(f"Erreur cache GET {key}: {e}")
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: int = CacheTTL.SHORT
    ) -> bool:
        """
        Stocke une valeur dans le cache.

        Args:
            key: Clé de cache
            value: Valeur à stocker
            ttl: Durée de vie en secondes

        Returns:
            True si succès, False sinon
        """
        if not self.enabled or not self._check_circuit_breaker():
            return False

        start_time = time.perf_counter()

        try:
            serialized = self._serialize(value)
            await self._client.setex(key, ttl, serialized)

            elapsed_ms = (time.perf_counter() - start_time) * 1000
            self._metrics.total_set_time_ms += elapsed_ms
            self._metrics.total_operations += 1
            self._metrics.bytes_written += len(serialized)
            self._record_success()

            logger.debug(f"Cache SET [{elapsed_ms:.2f}ms]: {key} (TTL: {ttl}s)")
            return True

        except Exception as e:
            self._record_error()
            logger.error(f"Erreur cache SET {key}: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Supprime une clé du cache"""
        if not self.enabled or not self._check_circuit_breaker():
            return False

        try:
            await self._client.delete(key)
            self._metrics.total_operations += 1
            self._record_success()
            logger.debug(f"Cache DELETE: {key}")
            return True
        except Exception as e:
            self._record_error()
            logger.error(f"Erreur cache DELETE {key}: {e}")
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """
        Supprime toutes les clés matchant un pattern.

        Args:
            pattern: Pattern Redis (ex: cache:user:123:*)

        Returns:
            Nombre de clés supprimées
        """
        if not self.enabled or not self._check_circuit_breaker():
            return 0

        try:
            keys = []
            async for key in self._client.scan_iter(match=pattern):
                keys.append(key)

            if keys:
                deleted = await self._client.delete(*keys)
                self._metrics.total_operations += 1
                self._metrics.evictions += deleted
                self._record_success()
                logger.info(f"Cache DELETE_PATTERN: {pattern} ({deleted} clés)")
                return deleted
            return 0

        except Exception as e:
            self._record_error()
            logger.error(f"Erreur cache DELETE_PATTERN {pattern}: {e}")
            return 0

    async def exists(self, key: str) -> bool:
        """Vérifie si une clé existe"""
        if not self.enabled or not self._check_circuit_breaker():
            return False

        try:
            return await self._client.exists(key) > 0
        except Exception as e:
            self._record_error()
            return False

    async def get_ttl(self, key: str) -> int:
        """Retourne le TTL restant d'une clé (-1 si pas de TTL, -2 si n'existe pas)"""
        if not self.enabled or not self._check_circuit_breaker():
            return -2

        try:
            return await self._client.ttl(key)
        except Exception as e:
            self._record_error()
            return -2

    async def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """Incrémente une valeur numérique"""
        if not self.enabled or not self._check_circuit_breaker():
            return None

        try:
            result = await self._client.incr(key, amount)
            self._record_success()
            return result
        except Exception as e:
            self._record_error()
            logger.error(f"Erreur cache INCREMENT {key}: {e}")
            return None

    async def lpush(self, key: str, value: str) -> Optional[int]:
        """Ajoute une valeur au début d'une liste"""
        if not self.enabled or not self._check_circuit_breaker():
            return None

        try:
            result = await self._client.lpush(key, value)
            self._metrics.total_operations += 1
            self._record_success()
            return result
        except Exception as e:
            self._record_error()
            logger.error(f"Erreur cache LPUSH {key}: {e}")
            return None

    async def ltrim(self, key: str, start: int, stop: int) -> bool:
        """Tronque une liste pour garder seulement les éléments entre start et stop"""
        if not self.enabled or not self._check_circuit_breaker():
            return False

        try:
            await self._client.ltrim(key, start, stop)
            self._metrics.total_operations += 1
            self._record_success()
            return True
        except Exception as e:
            self._record_error()
            logger.error(f"Erreur cache LTRIM {key}: {e}")
            return False

    async def lrange(self, key: str, start: int, stop: int) -> List[str]:
        """Récupère les éléments d'une liste entre start et stop"""
        if not self.enabled or not self._check_circuit_breaker():
            return []

        try:
            result = await self._client.lrange(key, start, stop)
            self._record_success()
            return result or []
        except Exception as e:
            self._record_error()
            logger.error(f"Erreur cache LRANGE {key}: {e}")
            return []

    # ==================== Méthodes d'invalidation ====================

    async def invalidate_user_cache(self, user_id: int) -> int:
        """Invalide tout le cache d'un utilisateur"""
        count = 0
        count += await self.delete_pattern(f"cache:*:user:{user_id}:*")
        count += await self.delete_pattern(f"cache:user:*:{user_id}*")
        count += await self.delete_pattern(f"cache:*:user={user_id}*")
        logger.info(f"Cache utilisateur {user_id} invalidé ({count} clés)")
        return count

    async def invalidate_ai_cache(self, user_id: Optional[int] = None) -> int:
        """Invalide le cache IA (optionnellement pour un utilisateur)"""
        if user_id:
            pattern = f"cache:ai:*:user={user_id}*"
        else:
            pattern = "cache:ai:*"
        count = await self.delete_pattern(pattern)
        logger.info(f"Cache IA invalidé ({count} clés)")
        return count

    async def invalidate_leaderboard_cache(self) -> int:
        """Invalide tous les leaderboards"""
        count = await self.delete_pattern("cache:leaderboard:*")
        logger.info(f"Cache leaderboard invalidé ({count} clés)")
        return count

    async def invalidate_achievements_cache(self) -> int:
        """Invalide le cache des achievements"""
        count = await self.delete_pattern("cache:achievements:*")
        logger.info(f"Cache achievements invalidé ({count} clés)")
        return count

    async def invalidate_mascot_cache(self, user_id: int) -> int:
        """Invalide le cache mascotte d'un utilisateur"""
        count = 0
        # Pattern avec user_id dans différents formats
        patterns = [
            f"cache:mascot:state:*user_id={user_id}*",
            f"cache:mascot:accessories:*user_id={user_id}*",
            f"cache:mascot:ai:*user_id={user_id}*",
            f"cache:mascot:*:user={user_id}*",
            f"cache:mascot:*:user:{user_id}*"
        ]
        for pattern in patterns:
            count += await self.delete_pattern(pattern)
        logger.info(f"Cache mascotte utilisateur {user_id} invalidé ({count} clés)")
        return count

    async def clear_all(self) -> bool:
        """Vide tout le cache (DANGER)"""
        if not self.enabled:
            return False

        try:
            await self._client.flushdb()
            self._metrics = CacheMetrics()  # Reset metrics
            logger.warning("Cache entièrement vidé (FLUSHDB)")
            return True
        except Exception as e:
            logger.error(f"Erreur FLUSHDB: {e}")
            return False

    # ==================== Méthodes de health check ====================

    async def health_check(self) -> Dict[str, Any]:
        """
        Retourne l'état de santé du cache.
        """
        status = {
            "status": "unhealthy",
            "connected": self._connected,
            "enabled": self._enabled,
            "circuit_breaker_open": self._circuit_open,
            "consecutive_errors": self._consecutive_errors,
            "metrics": self._metrics.to_dict()
        }

        if not self._enabled:
            status["error"] = "Cache non initialisé"
            return status

        try:
            start = time.perf_counter()
            await self._client.ping()
            latency_ms = (time.perf_counter() - start) * 1000

            # Récupérer info Redis
            info = await self._client.info("memory")

            status.update({
                "status": "healthy",
                "latency_ms": round(latency_ms, 2),
                "redis_memory_used": info.get("used_memory_human", "N/A"),
                "redis_memory_peak": info.get("used_memory_peak_human", "N/A"),
            })

        except Exception as e:
            status["error"] = str(e)

        return status


# ==================== Instance globale ====================

cache_service = AsyncCacheService()


# ==================== Décorateurs de cache ====================

def cached(
    prefix: Union[str, CachePrefix],
    ttl: int = CacheTTL.SHORT,
    key_params: Optional[List[str]] = None,
    include_user_id: bool = False
):
    """
    Décorateur de cache pour fonctions async.

    Args:
        prefix: Préfixe de la clé de cache
        ttl: Durée de vie en secondes
        key_params: Paramètres à inclure dans la clé
        include_user_id: Inclure automatiquement le user_id

    Example:
        @cached(CachePrefix.LEADERBOARD, ttl=CacheTTL.SHORT, key_params=["type", "period"])
        async def get_leaderboard(type: str, period: str):
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            if not cache_service.enabled:
                return await func(*args, **kwargs)

            # Construire les paramètres de clé
            cache_kwargs = {}

            if key_params:
                for param in key_params:
                    if param in kwargs:
                        cache_kwargs[param] = kwargs[param]

            # Extraire user_id si demandé
            if include_user_id:
                user_id = None
                if args and hasattr(args[0], 'id'):
                    user_id = args[0].id
                elif 'current_user' in kwargs and hasattr(kwargs['current_user'], 'id'):
                    user_id = kwargs['current_user'].id
                if user_id:
                    cache_kwargs['user'] = user_id

            cache_key = cache_service.generate_key(prefix, **cache_kwargs)

            # Vérifier le cache
            cached_value = await cache_service.get(cache_key)
            if cached_value is not None:
                return cached_value

            # Cache MISS - exécuter la fonction
            result = await func(*args, **kwargs)

            # Stocker dans le cache
            await cache_service.set(cache_key, result, ttl)

            return result

        return wrapper
    return decorator


def cached_ai_content(
    prefix: CachePrefix,
    ttl: int = CacheTTL.VERY_LONG,
    content_param: str = "note_content",
    extra_params: Optional[List[str]] = None
):
    """
    Décorateur spécialisé pour le cache de contenu IA.
    Utilise un hash du contenu pour la clé.

    Args:
        prefix: Préfixe (AI_FLASHCARDS, AI_QUIZ, etc.)
        ttl: Durée de vie (default: 24h)
        content_param: Nom du paramètre contenant le contenu
        extra_params: Paramètres supplémentaires pour la clé

    Example:
        @cached_ai_content(CachePrefix.AI_FLASHCARDS, extra_params=["count", "difficulty"])
        async def generate_flashcards(note_content: str, count: int, difficulty: str):
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            if not cache_service.enabled:
                return await func(*args, **kwargs)

            # Récupérer le contenu pour le hash
            content = kwargs.get(content_param, "")
            if not content and args:
                # Chercher dans args si pas dans kwargs
                import inspect
                sig = inspect.signature(func)
                params = list(sig.parameters.keys())
                if content_param in params:
                    idx = params.index(content_param)
                    if idx < len(args):
                        content = args[idx]

            if not content:
                # Pas de contenu, exécuter sans cache
                return await func(*args, **kwargs)

            # Générer le hash du contenu
            content_hash = cache_service.generate_content_hash(content)

            # Construire la clé avec les extra_params
            key_parts = {"hash": content_hash}
            if extra_params:
                for param in extra_params:
                    if param in kwargs:
                        key_parts[param] = kwargs[param]

            cache_key = cache_service.generate_key(prefix, **key_parts)

            # Vérifier le cache
            cached_value = await cache_service.get(cache_key)
            if cached_value is not None:
                logger.info(f"Cache IA HIT pour {prefix.value}: contenu déjà généré")
                return cached_value

            # Cache MISS - générer avec IA
            logger.info(f"Cache IA MISS pour {prefix.value}: génération en cours...")
            result = await func(*args, **kwargs)

            # Stocker dans le cache
            await cache_service.set(cache_key, result, ttl)

            return result

        return wrapper
    return decorator


def cached_semantic(
    prefix: Union[str, CachePrefix] = CachePrefix.SEMANTIC,
    ttl: int = CacheTTL.LONG,
    text_param: str = "question",
    level_param: str = "level"
):
    """
    Décorateur pour cache sémantique (questions similaires).

    Args:
        prefix: Préfixe de la clé
        ttl: Durée de vie
        text_param: Nom du paramètre texte
        level_param: Nom du paramètre niveau

    Example:
        @cached_semantic(CachePrefix.MASCOT_AI, text_param="question")
        async def ask_question(question: str, user_context: dict):
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            if not cache_service.enabled:
                return await func(*args, **kwargs)

            # Récupérer le texte
            text = kwargs.get(text_param, "")
            level = kwargs.get(level_param, 1)

            if not text:
                return await func(*args, **kwargs)

            # Générer clé sémantique
            cache_key = cache_service.generate_semantic_key(text, prefix, level)

            # Vérifier le cache
            cached_value = await cache_service.get(cache_key)
            if cached_value is not None:
                logger.info(f"Cache sémantique HIT: question similaire trouvée")
                return cached_value

            # Cache MISS
            result = await func(*args, **kwargs)

            # Stocker
            await cache_service.set(cache_key, result, ttl)

            return result

        return wrapper
    return decorator
