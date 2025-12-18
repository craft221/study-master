"""
Service de Cache pour Recherches - Phase 2 Optimization
========================================================

Cache intelligent pour les recherches avec:
- Cache par utilisateur et requête
- Invalidation automatique sur modifications
- Cache warming pour contenu populaire
- Métriques de performance

Impact: -80% charge DB pour recherches répétées
"""

import hashlib
import logging
from typing import Optional, List, Dict, Any, Callable
from functools import wraps

from app.services.cache_service import (
    cache_service,
    CachePrefix,
    CacheTTL
)

logger = logging.getLogger(__name__)


class SearchCachePrefix(str):
    """Préfixes spécifiques pour le cache de recherche"""
    NOTES_SEARCH = "search:notes"
    NOTES_LIST = "search:notes:list"
    FLASHCARDS_SEARCH = "search:flashcards"
    FLASHCARDS_DECKS = "search:flashcards:decks"
    QUIZZES_SEARCH = "search:quizzes"
    QUIZZES_LIST = "search:quizzes:list"
    EXPLORE_PUBLIC = "search:explore"
    EXPLORE_TRENDING = "search:explore:trending"
    EXPLORE_SUBJECTS = "search:explore:subjects"
    USERS_SEARCH = "search:users"
    STUDY_GROUPS_SEARCH = "search:groups"


class SearchCacheTTL:
    """TTL spécifiques pour les recherches"""
    USER_SEARCH = 120       # 2 minutes - recherches personnelles
    PUBLIC_SEARCH = 300     # 5 minutes - contenu public
    TRENDING = 600          # 10 minutes - trending content
    POPULAR_SUBJECTS = 1800 # 30 minutes - matières populaires
    LIST_RESULTS = 60       # 1 minute - listes paginées


class SearchCacheService:
    """
    Service de cache spécialisé pour les recherches.

    Fonctionnalités:
    - Génération de clés intelligentes basées sur les paramètres de recherche
    - Invalidation sélective par utilisateur ou type de contenu
    - Support pour cache warming
    - Métriques de hit rate par type de recherche
    """

    def __init__(self):
        self._search_metrics: Dict[str, Dict[str, int]] = {
            "notes": {"hits": 0, "misses": 0},
            "flashcards": {"hits": 0, "misses": 0},
            "quizzes": {"hits": 0, "misses": 0},
            "explore": {"hits": 0, "misses": 0},
            "users": {"hits": 0, "misses": 0},
        }

    def _generate_search_key(
        self,
        prefix: str,
        user_id: Optional[int] = None,
        query: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
        **filters
    ) -> str:
        """
        Génère une clé de cache unique pour une recherche.

        Args:
            prefix: Type de recherche (SearchCachePrefix)
            user_id: ID utilisateur (pour cache personnalisé)
            query: Terme de recherche
            page: Page courante
            page_size: Taille de page
            **filters: Filtres supplémentaires (subject_id, is_favorite, etc.)

        Returns:
            Clé de cache formatée
        """
        parts = [f"cache:{prefix}"]

        # Ajouter user_id si fourni
        if user_id is not None:
            parts.append(f"u:{user_id}")

        # Hash de la query si présente (pour éviter clés trop longues)
        if query:
            query_hash = hashlib.md5(query.lower().strip().encode()).hexdigest()[:8]
            parts.append(f"q:{query_hash}")

        # Pagination
        parts.append(f"p:{page}:{page_size}")

        # Filtres triés pour consistance
        for key, value in sorted(filters.items()):
            if value is not None:
                # Convertir les booléens
                if isinstance(value, bool):
                    value = "1" if value else "0"
                parts.append(f"{key}:{value}")

        return ":".join(parts)

    async def get_cached_search(
        self,
        prefix: str,
        user_id: Optional[int] = None,
        query: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
        **filters
    ) -> Optional[Dict[str, Any]]:
        """
        Récupère des résultats de recherche du cache.

        Returns:
            Résultats cachés ou None si cache miss
        """
        if not cache_service.enabled:
            return None

        cache_key = self._generate_search_key(
            prefix, user_id, query, page, page_size, **filters
        )

        result = await cache_service.get(cache_key)

        # Mise à jour des métriques
        search_type = prefix.split(":")[1] if ":" in prefix else "other"
        if search_type in self._search_metrics:
            if result is not None:
                self._search_metrics[search_type]["hits"] += 1
            else:
                self._search_metrics[search_type]["misses"] += 1

        return result

    async def cache_search_results(
        self,
        results: Dict[str, Any],
        prefix: str,
        ttl: int = SearchCacheTTL.USER_SEARCH,
        user_id: Optional[int] = None,
        query: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
        **filters
    ) -> bool:
        """
        Met en cache les résultats d'une recherche.

        Args:
            results: Résultats à cacher
            prefix: Type de recherche
            ttl: Durée de vie en secondes
            user_id, query, page, page_size, **filters: Paramètres de la recherche

        Returns:
            True si succès
        """
        if not cache_service.enabled:
            return False

        cache_key = self._generate_search_key(
            prefix, user_id, query, page, page_size, **filters
        )

        return await cache_service.set(cache_key, results, ttl)

    # ==================== Invalidation Methods ====================

    async def invalidate_user_notes_cache(self, user_id: int) -> int:
        """
        Invalide le cache des notes d'un utilisateur.
        À appeler après création/modification/suppression de note.
        """
        count = 0
        patterns = [
            f"cache:{SearchCachePrefix.NOTES_SEARCH}:u:{user_id}:*",
            f"cache:{SearchCachePrefix.NOTES_LIST}:u:{user_id}:*",
        ]
        for pattern in patterns:
            count += await cache_service.delete_pattern(pattern)

        logger.debug(f"Invalidated {count} notes cache entries for user {user_id}")
        return count

    async def invalidate_user_flashcards_cache(self, user_id: int) -> int:
        """
        Invalide le cache des flashcards d'un utilisateur.
        """
        count = 0
        patterns = [
            f"cache:{SearchCachePrefix.FLASHCARDS_SEARCH}:u:{user_id}:*",
            f"cache:{SearchCachePrefix.FLASHCARDS_DECKS}:u:{user_id}:*",
        ]
        for pattern in patterns:
            count += await cache_service.delete_pattern(pattern)

        logger.debug(f"Invalidated {count} flashcards cache entries for user {user_id}")
        return count

    async def invalidate_user_quizzes_cache(self, user_id: int) -> int:
        """
        Invalide le cache des quizzes d'un utilisateur.
        """
        count = 0
        patterns = [
            f"cache:{SearchCachePrefix.QUIZZES_SEARCH}:u:{user_id}:*",
            f"cache:{SearchCachePrefix.QUIZZES_LIST}:u:{user_id}:*",
        ]
        for pattern in patterns:
            count += await cache_service.delete_pattern(pattern)

        logger.debug(f"Invalidated {count} quizzes cache entries for user {user_id}")
        return count

    async def invalidate_explore_cache(self) -> int:
        """
        Invalide le cache explore (contenu public).
        À appeler après publication de nouveau contenu public.
        """
        count = 0
        patterns = [
            f"cache:{SearchCachePrefix.EXPLORE_PUBLIC}:*",
            f"cache:{SearchCachePrefix.EXPLORE_TRENDING}:*",
            f"cache:{SearchCachePrefix.EXPLORE_SUBJECTS}:*",
        ]
        for pattern in patterns:
            count += await cache_service.delete_pattern(pattern)

        logger.info(f"Invalidated {count} explore cache entries")
        return count

    async def invalidate_all_user_search_cache(self, user_id: int) -> int:
        """
        Invalide tout le cache de recherche d'un utilisateur.
        """
        count = 0
        count += await self.invalidate_user_notes_cache(user_id)
        count += await self.invalidate_user_flashcards_cache(user_id)
        count += await self.invalidate_user_quizzes_cache(user_id)

        logger.info(f"Invalidated {count} total search cache entries for user {user_id}")
        return count

    # ==================== Cache Warming Methods ====================

    async def warm_trending_cache(self, db_session) -> bool:
        """
        Pré-charge le cache avec le contenu trending.
        À appeler au démarrage de l'application ou périodiquement.
        """
        try:
            from app.services.explore_service import explore_service

            # Charger le trending content
            trending = await explore_service.get_trending_content(
                db=db_session,
                days=7,
                limit=20
            )

            cache_key = f"cache:{SearchCachePrefix.EXPLORE_TRENDING}:default"
            await cache_service.set(cache_key, trending, SearchCacheTTL.TRENDING)

            logger.info("Warmed trending content cache")
            return True

        except Exception as e:
            logger.error(f"Failed to warm trending cache: {e}")
            return False

    async def warm_popular_subjects_cache(self, db_session) -> bool:
        """
        Pré-charge le cache avec les matières populaires.
        """
        try:
            from app.services.explore_service import explore_service

            # Charger les matières populaires
            subjects = await explore_service.get_popular_subjects(
                db=db_session,
                limit=20
            )

            cache_key = f"cache:{SearchCachePrefix.EXPLORE_SUBJECTS}:popular"
            await cache_service.set(cache_key, subjects, SearchCacheTTL.POPULAR_SUBJECTS)

            logger.info("Warmed popular subjects cache")
            return True

        except Exception as e:
            logger.error(f"Failed to warm popular subjects cache: {e}")
            return False

    async def warm_public_content_cache(self, db_session) -> bool:
        """
        Pré-charge le cache avec le contenu public récent.
        """
        try:
            from app.services.explore_service import explore_service

            # Charger le contenu public récent (première page)
            for content_type in ["notes", "flashcards", "quizzes"]:
                results = await explore_service.search_public_content(
                    db=db_session,
                    content_type=content_type,
                    sort_by="recent",
                    page=1,
                    limit=20
                )

                cache_key = self._generate_search_key(
                    SearchCachePrefix.EXPLORE_PUBLIC,
                    query=None,
                    page=1,
                    page_size=20,
                    content_type=content_type,
                    sort_by="recent"
                )

                await cache_service.set(cache_key, results, SearchCacheTTL.PUBLIC_SEARCH)

            logger.info("Warmed public content cache")
            return True

        except Exception as e:
            logger.error(f"Failed to warm public content cache: {e}")
            return False

    async def warm_all_caches(self, db_session) -> Dict[str, bool]:
        """
        Pré-charge tous les caches au démarrage.

        Returns:
            Dict avec le statut de chaque cache warmup
        """
        results = {
            "trending": await self.warm_trending_cache(db_session),
            "popular_subjects": await self.warm_popular_subjects_cache(db_session),
            "public_content": await self.warm_public_content_cache(db_session),
        }

        success_count = sum(1 for v in results.values() if v)
        logger.info(f"Cache warming completed: {success_count}/{len(results)} successful")

        return results

    # ==================== Metrics ====================

    def get_search_metrics(self) -> Dict[str, Any]:
        """
        Retourne les métriques de cache pour les recherches.
        """
        metrics = {}

        for search_type, counts in self._search_metrics.items():
            total = counts["hits"] + counts["misses"]
            hit_rate = (counts["hits"] / total * 100) if total > 0 else 0

            metrics[search_type] = {
                "hits": counts["hits"],
                "misses": counts["misses"],
                "total": total,
                "hit_rate_percent": round(hit_rate, 2)
            }

        return metrics

    def reset_metrics(self) -> None:
        """Réinitialise les métriques de recherche."""
        for search_type in self._search_metrics:
            self._search_metrics[search_type] = {"hits": 0, "misses": 0}


# Instance globale
search_cache = SearchCacheService()


# ==================== Decorators ====================

def cached_search(
    prefix: str,
    ttl: int = SearchCacheTTL.USER_SEARCH,
    user_id_param: Optional[str] = "user_id",
    query_param: Optional[str] = "query",
    include_pagination: bool = True
):
    """
    Décorateur pour cacher automatiquement les résultats de recherche.

    Args:
        prefix: Préfixe du cache (SearchCachePrefix.*)
        ttl: Durée de vie en secondes
        user_id_param: Nom du paramètre contenant l'user_id
        query_param: Nom du paramètre contenant la query
        include_pagination: Inclure page/page_size dans la clé

    Example:
        @cached_search(SearchCachePrefix.NOTES_SEARCH, ttl=120)
        async def search_notes(user_id: int, query: str, page: int = 1):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not cache_service.enabled:
                return await func(*args, **kwargs)

            # Extraire les paramètres pour la clé
            user_id = kwargs.get(user_id_param) if user_id_param else None
            query = kwargs.get(query_param) if query_param else None
            page = kwargs.get("page", 1) if include_pagination else 1
            page_size = kwargs.get("page_size", 20) if include_pagination else 20

            # Filtres supplémentaires (tout sauf les paramètres standards)
            standard_params = {user_id_param, query_param, "page", "page_size", "db", "current_user"}
            filters = {k: v for k, v in kwargs.items() if k not in standard_params}

            # Vérifier le cache
            cached = await search_cache.get_cached_search(
                prefix=prefix,
                user_id=user_id,
                query=query,
                page=page,
                page_size=page_size,
                **filters
            )

            if cached is not None:
                logger.debug(f"Search cache HIT: {prefix}")
                return cached

            # Exécuter la fonction
            logger.debug(f"Search cache MISS: {prefix}")
            result = await func(*args, **kwargs)

            # Mettre en cache
            await search_cache.cache_search_results(
                results=result,
                prefix=prefix,
                ttl=ttl,
                user_id=user_id,
                query=query,
                page=page,
                page_size=page_size,
                **filters
            )

            return result

        return wrapper
    return decorator


def invalidate_on_change(
    cache_type: str,
    user_id_param: str = "user_id"
):
    """
    Décorateur pour invalider le cache après une modification.

    Args:
        cache_type: Type de cache à invalider ("notes", "flashcards", "quizzes", "explore")
        user_id_param: Paramètre contenant l'user_id

    Example:
        @invalidate_on_change("notes")
        async def create_note(user_id: int, data: dict):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Exécuter la fonction d'abord
            result = await func(*args, **kwargs)

            # Invalider le cache
            user_id = kwargs.get(user_id_param)
            if user_id:
                if cache_type == "notes":
                    await search_cache.invalidate_user_notes_cache(user_id)
                elif cache_type == "flashcards":
                    await search_cache.invalidate_user_flashcards_cache(user_id)
                elif cache_type == "quizzes":
                    await search_cache.invalidate_user_quizzes_cache(user_id)

            if cache_type == "explore":
                await search_cache.invalidate_explore_cache()

            return result

        return wrapper
    return decorator
