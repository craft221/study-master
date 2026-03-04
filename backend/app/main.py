import asyncio
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from threading import Lock
from typing import Dict, Any

from fastapi import FastAPI, APIRouter, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings

# Initialisation de Sentry pour le monitoring des erreurs
if settings.SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    from sentry_sdk.integrations.redis import RedisIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        release=settings.APP_VERSION,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        profiles_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
            RedisIntegration(),
            LoggingIntegration(
                level=logging.INFO,
                event_level=logging.ERROR
            ),
        ],
        # Ne pas capturer les données sensibles
        send_default_pii=False,
        # Filtrer les erreurs 404 et autres erreurs communes
        before_send=lambda event, hint: event if event.get("level") != "error" or "404" not in str(hint.get("exc_info", "")) else None,
    )
    logging.info(f"🔍 Sentry initialized for environment: {settings.ENVIRONMENT}")

from app.core.security import require_role
from app.models.user import UserRole

# Dependency pour protéger les endpoints admin
require_admin = require_role([UserRole.ADMIN])

from app.services.cache_service import cache_service
from app.services.search_cache_service import search_cache
from app.core.exceptions import register_exception_handlers
from app.middleware.security import (
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
    IPBlockMiddleware
)

# Configuration du logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Variables globales pour les métriques (thread-safe)
_metrics_lock = Lock()
app_start_time: datetime = datetime.now(timezone.utc)
request_count: int = 0
error_count: int = 0

# Configuration du rate limiter global
limiter = Limiter(key_func=get_remote_address)

# Import routers
from app.api.v1.auth import router as auth_router
from app.api.v1.subjects import router as subjects_router
from app.api.v1.notes import router as notes_router
from app.api.v1.flashcards import router as flashcards_router
from app.api.v1.quizzes import router as quizzes_router
from app.api.v1.users import router as users_router
from app.api.v1.ai import router as ai_router
from app.api.v1.study_sessions import router as study_sessions_router
from app.api.v1.schedules import router as schedules_router
from app.api.v1.achievements import router as achievements_router
from app.api.v1.leaderboards import router as leaderboards_router
from app.api.v1.study_groups import router as study_groups_router
from app.api.v1.group_messages import router as group_messages_router
from app.api.v1.duels import router as duels_router
from app.api.v1.ocr import router as ocr_router
from app.api.v1.export import router as export_router
from app.api.v1.mascot import router as mascot_router
from app.api.v1.spark import router as spark_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.public import router as public_router
from app.api.v1.websocket import router as websocket_router
from app.api.v1.anti_cheat import router as anti_cheat_router
from app.api.v1.documents import router as documents_router
from app.api.v1.focus_rooms import router as focus_rooms_router
from app.api.v1.focus_rooms_ws import (
    router as focus_rooms_ws_router,
    check_idle_participants_task,
    cleanup_stale_participants_task
)
from app.api.v1.payments import router as payments_router
from app.api.v1.daily_quests import router as daily_quests_router
from app.api.v1.social_share import router as social_share_router
from app.api.v1.explore import router as explore_router
from app.api.v1.mfa import router as mfa_router
from app.api.v1.exam_mode import router as exam_mode_router

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="API pour Studera - L'application ultime d'apprentissage avec IA",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configuration du rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Register centralized exception handlers AVANT le middleware CORS
# pour que CORS puisse wrapper toutes les réponses d'erreur
register_exception_handlers(app)

# Create main router
router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint basique"""
    return {
        "status": "ok",
        "message": "Studera API is running",
        "version": settings.APP_VERSION
    }


@router.get("/health/detailed")
async def detailed_health_check() -> Dict[str, Any]:
    """
    Health check détaillé avec état de tous les services.
    Utile pour le monitoring et les alertes.
    """
    global request_count, error_count

    # Vérifier Redis/Cache
    cache_health = await cache_service.health_check()

    # Calculer l'uptime
    uptime_seconds = (datetime.now(timezone.utc) - app_start_time).total_seconds()

    # Déterminer le statut global
    overall_status = "healthy"
    if cache_health.get("status") != "healthy":
        overall_status = "degraded"

    return {
        "status": overall_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "uptime_seconds": round(uptime_seconds, 0),
        "uptime_human": f"{int(uptime_seconds // 3600)}h {int((uptime_seconds % 3600) // 60)}m",
        "services": {
            "api": {
                "status": "healthy",
                "request_count": request_count,
                "error_count": error_count,
                "error_rate": round((error_count / request_count * 100), 2) if request_count > 0 else 0
            },
            "cache": cache_health
        }
    }


@router.get("/metrics", dependencies=[Depends(require_admin)])
async def get_metrics() -> Dict[str, Any]:
    """
    Endpoint de métriques pour l'observabilité.
    Compatible Prometheus (format texte) ou JSON.
    Protégé: admin uniquement.
    """
    global request_count, error_count

    # Récupérer les métriques du cache
    cache_metrics = cache_service.metrics.to_dict()

    # Uptime
    uptime_seconds = (datetime.now(timezone.utc) - app_start_time).total_seconds()

    return {
        "app": {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
            "uptime_seconds": round(uptime_seconds, 0),
            "requests_total": request_count,
            "errors_total": error_count,
            "error_rate_percent": round((error_count / request_count * 100), 2) if request_count > 0 else 0
        },
        "cache": {
            "enabled": cache_service.enabled,
            "hit_rate_percent": cache_metrics.get("hit_rate_percent", 0),
            "hits_total": cache_metrics.get("hits", 0),
            "misses_total": cache_metrics.get("misses", 0),
            "errors_total": cache_metrics.get("errors", 0),
            "avg_get_latency_ms": cache_metrics.get("avg_get_time_ms", 0),
            "avg_set_latency_ms": cache_metrics.get("avg_set_time_ms", 0),
            "bytes_read_total": cache_metrics.get("bytes_read", 0),
            "bytes_written_total": cache_metrics.get("bytes_written", 0),
            "hits_by_prefix": cache_metrics.get("hits_by_prefix", {}),
            "misses_by_prefix": cache_metrics.get("misses_by_prefix", {})
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.post("/cache/invalidate/{prefix}", dependencies=[Depends(require_admin)])
async def invalidate_cache(prefix: str) -> Dict[str, Any]:
    """
    Invalide le cache par préfixe.
    Préfixes: ai, leaderboard, achievements, mascot, search, explore, all
    Protégé: admin uniquement.
    """
    if prefix == "ai":
        count = await cache_service.invalidate_ai_cache()
    elif prefix == "leaderboard":
        count = await cache_service.invalidate_leaderboard_cache()
    elif prefix == "achievements":
        count = await cache_service.invalidate_achievements_cache()
    elif prefix == "search":
        count = await cache_service.delete_pattern("cache:search:*")
    elif prefix == "explore":
        count = await search_cache.invalidate_explore_cache()
    elif prefix == "all":
        await cache_service.clear_all()
        count = -1  # Unknown
    else:
        count = await cache_service.delete_pattern(f"cache:{prefix}:*")

    return {
        "success": True,
        "prefix": prefix,
        "keys_deleted": count,
        "message": f"Cache '{prefix}' invalidé"
    }


@router.get("/cache/search-metrics", dependencies=[Depends(require_admin)])
async def get_search_cache_metrics() -> Dict[str, Any]:
    """
    Retourne les métriques de cache spécifiques aux recherches.
    Protégé: admin uniquement.
    """
    return {
        "search_metrics": search_cache.get_search_metrics(),
        "cache_enabled": cache_service.enabled,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.post("/cache/warm", dependencies=[Depends(require_admin)])
async def trigger_cache_warming() -> Dict[str, Any]:
    """
    Déclenche manuellement le cache warming.
    Utile après un déploiement ou après avoir vidé le cache.
    Protégé: admin uniquement.
    """
    try:
        from app.core.database import async_session_maker
        async with async_session_maker() as db:
            results = await search_cache.warm_all_caches(db)

        return {
            "success": True,
            "results": results,
            "message": "Cache warming completed"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "Cache warming failed"
        }


# Include all routers
app.include_router(router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(subjects_router, prefix="/api/v1/subjects", tags=["Subjects"])
app.include_router(notes_router, prefix="/api/v1/notes", tags=["Notes"])
app.include_router(flashcards_router, prefix="/api/v1/flashcards", tags=["Flashcards"])
app.include_router(quizzes_router, prefix="/api/v1/quizzes", tags=["Quizzes"])
app.include_router(users_router, prefix="/api/v1/users", tags=["Users"])
app.include_router(ai_router, prefix="/api/v1/ai", tags=["AI - Intelligence Artificielle"])
app.include_router(study_sessions_router, prefix="/api/v1/study-sessions", tags=["Study Sessions - Pomodoro"])
app.include_router(schedules_router, prefix="/api/v1/schedules", tags=["Schedules - Emploi du Temps"])
app.include_router(achievements_router, prefix="/api/v1/achievements", tags=["Achievements - Succès"])
app.include_router(leaderboards_router, prefix="/api/v1/leaderboards", tags=["Leaderboards - Classements"])
app.include_router(study_groups_router, prefix="/api/v1/study-groups", tags=["Study Groups - Groupes d'étude"])
app.include_router(group_messages_router, prefix="/api/v1/study-groups", tags=["Study Groups - Messages"])
app.include_router(duels_router, prefix="/api/v1/duels", tags=["Duels - Défis"])
app.include_router(ocr_router, prefix="/api/v1/ocr", tags=["OCR - Extraction de Texte"])
app.include_router(export_router, prefix="/api/v1/export", tags=["Export PDF"])
app.include_router(mascot_router, prefix="/api/v1/mascot", tags=["Mascot - Spark l'Écureuil ⚡🐿️ (Legacy)"])
app.include_router(spark_router, prefix="/api/v1/spark", tags=["Spark - Assistant IA Intelligent ⚡🐿️"])
app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(websocket_router, prefix="/api/v1", tags=["WebSocket - Temps Réel"])
app.include_router(public_router, prefix="/api/v1/public", tags=["Public - Quiz Viraux (Sans Auth)"])
app.include_router(anti_cheat_router, prefix="/api/v1/anti-cheat", tags=["Anti-Cheat - Surveillance"])
app.include_router(documents_router, prefix="/api/v1/documents", tags=["Documents - Fichiers par Matière"])
app.include_router(focus_rooms_router, prefix="/api/v1/focus-rooms", tags=["Focus Rooms - Salles d'Étude"])
app.include_router(focus_rooms_ws_router, prefix="/api/v1", tags=["Focus Rooms - WebSocket"])
app.include_router(payments_router, prefix="/api/v1", tags=["Payments - Paiements & Abonnements"])
app.include_router(daily_quests_router, prefix="/api/v1", tags=["Daily Quests - Objectifs Quotidiens 🎯"])
app.include_router(social_share_router, prefix="/api/v1/share", tags=["Social Share - Partage Social 📤"])
app.include_router(explore_router, prefix="/api/v1/explore", tags=["Explore - Découverte de Contenu 🔍"])
app.include_router(mfa_router, prefix="/api/v1/mfa", tags=["MFA - Authentification à Deux Facteurs 🔐"])
app.include_router(exam_mode_router, prefix="/api/v1/exam-mode", tags=["Exam Mode - Préparation aux Examens 📚"])


@app.middleware("http")
async def track_requests(request: Request, call_next):
    """Middleware pour tracker les requêtes et erreurs (thread-safe)"""
    global request_count, error_count

    with _metrics_lock:
        request_count += 1

    start_time = time.perf_counter()

    try:
        response = await call_next(request)

        # Tracker les erreurs HTTP
        if response.status_code >= 400:
            with _metrics_lock:
                error_count += 1

        # Ajouter les headers de timing
        process_time = (time.perf_counter() - start_time) * 1000
        response.headers["X-Process-Time-Ms"] = str(round(process_time, 2))

        return response
    except Exception as e:
        with _metrics_lock:
            error_count += 1
        raise


@app.on_event("startup")
async def startup_event():
    """Événement au démarrage de l'application"""
    global app_start_time
    app_start_time = datetime.now(timezone.utc)

    logger.info("=" * 60)
    logger.info("Studera API démarrée")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    logger.info("=" * 60)

    # Initialiser le cache Redis async
    cache_initialized = await cache_service.initialize()
    if cache_initialized:
        logger.info("Cache Redis initialisé avec succès")

        # Cache Warming - Pré-charger les données populaires
        # Exécuté en background pour ne pas bloquer le démarrage
        async def warm_caches():
            try:
                from app.core.database import async_session_maker
                async with async_session_maker() as db:
                    warmup_results = await search_cache.warm_all_caches(db)
                    logger.info(f"Cache warming completed: {warmup_results}")
            except Exception as e:
                logger.warning(f"Cache warming failed (non-critical): {e}")

        asyncio.create_task(warm_caches())
        logger.info("Cache warming task started in background")
    else:
        logger.warning("Cache Redis non disponible - fonctionnement en mode dégradé")

    # Démarrer les tâches de fond pour Focus Rooms
    asyncio.create_task(check_idle_participants_task())
    asyncio.create_task(cleanup_stale_participants_task())
    logger.info("Focus Room background tasks started")

    logger.info("Documentation disponible sur: http://localhost:8000/docs")
    logger.info("Métriques disponibles sur: http://localhost:8000/api/v1/metrics")
    logger.info("Health check: http://localhost:8000/api/v1/health/detailed")


@app.on_event("shutdown")
async def shutdown_event():
    """Événement à l'arrêt de l'application"""
    logger.info("Arrêt de Studera API...")

    # Fermer la connexion Redis
    await cache_service.close()

    # Log des métriques finales
    metrics = cache_service.metrics.to_dict()
    logger.info(f"Métriques finales du cache:")
    logger.info(f"  - Hit rate: {metrics.get('hit_rate_percent', 0):.1f}%")
    logger.info(f"  - Total hits: {metrics.get('hits', 0)}")
    logger.info(f"  - Total misses: {metrics.get('misses', 0)}")
    logger.info(f"  - Total requests: {request_count}")
    logger.info(f"  - Total errors: {error_count}")

    logger.info("Studera API arrêtée")


# ============================================
# SECURITY MIDDLEWARES
# ============================================

# Middleware de blocage IP dynamique (après trop de tentatives échouées)
app.add_middleware(
    IPBlockMiddleware,
    redis_url=settings.REDIS_URL,
    max_failed_attempts=10,  # Bloquer après 10 échecs
    block_duration=3600  # Bloquer pendant 1 heure
)

# Middleware de rate limiting avancé (par IP ET par utilisateur)
# Note: Limites élevées pour le développement local
app.add_middleware(
    RateLimitMiddleware,
    redis_url=settings.REDIS_URL,
    requests_per_minute=300,  # 300/min pour dev (au lieu de 60)
    requests_per_hour=5000,   # 5000/heure pour dev (au lieu de 1000)
    burst_size=50             # Burst de 50 (au lieu de 20)
)

# Middleware de headers de sécurité
app.add_middleware(SecurityHeadersMiddleware)

# IMPORTANT: Le middleware CORS doit être ajouté EN DERNIER
# pour être exécuté EN PREMIER dans la chaîne de middlewares.
# Cela garantit que les headers CORS sont ajoutés à TOUTES les réponses,
# y compris les réponses d'erreur générées par les exception handlers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)