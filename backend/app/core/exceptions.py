"""
Exceptions personnalisées et gestionnaires d'erreurs centralisés
"""

from typing import Optional, Any, Dict
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
import logging
import traceback

logger = logging.getLogger(__name__)


# ============================================
# CUSTOM EXCEPTIONS
# ============================================

class AppException(Exception):
    """Exception de base pour l'application"""
    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code: str = "INTERNAL_ERROR",
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


class NotFoundError(AppException):
    """Ressource non trouvée"""
    def __init__(self, resource: str = "Resource", resource_id: Optional[int] = None):
        details = {"resource": resource}
        if resource_id:
            details["id"] = resource_id
        super().__init__(
            message=f"{resource} not found",
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
            details=details
        )


class UnauthorizedError(AppException):
    """Non authentifié"""
    def __init__(self, message: str = "Authentication required"):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="UNAUTHORIZED"
        )


class ForbiddenError(AppException):
    """Accès interdit"""
    def __init__(self, message: str = "You don't have permission to access this resource"):
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="FORBIDDEN"
        )


class OwnershipError(AppException):
    """L'utilisateur n'est pas propriétaire de la ressource"""
    def __init__(self, resource: str = "Resource"):
        super().__init__(
            message=f"{resource} not found",  # Message volontairement vague pour la sécurité
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
            details={"resource": resource}
        )


class DataValidationError(AppException):
    """Erreur de validation des données (renommée pour éviter conflit avec pydantic.ValidationError)"""
    def __init__(self, message: str, field: Optional[str] = None):
        details = {}
        if field:
            details["field"] = field
        super().__init__(
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="VALIDATION_ERROR",
            details=details
        )


class ConflictError(AppException):
    """Conflit (ex: ressource déjà existante)"""
    def __init__(self, message: str = "Resource already exists"):
        super().__init__(
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            error_code="CONFLICT"
        )


class RateLimitError(AppException):
    """Trop de requêtes"""
    def __init__(self, retry_after: int = 60):
        super().__init__(
            message="Too many requests. Please try again later.",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            error_code="RATE_LIMITED",
            details={"retry_after": retry_after}
        )


class DatabaseError(AppException):
    """Erreur de base de données"""
    def __init__(self, message: str = "Database error occurred"):
        super().__init__(
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="DATABASE_ERROR"
        )


class ExternalServiceError(AppException):
    """Erreur de service externe (AI, email, etc.)"""
    def __init__(self, service: str, message: str = "External service error"):
        super().__init__(
            message=message,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="EXTERNAL_SERVICE_ERROR",
            details={"service": service}
        )


class AIServiceError(ExternalServiceError):
    """Erreur spécifique au service AI"""
    def __init__(self, message: str = "AI service temporarily unavailable"):
        super().__init__(service="ai", message=message)


class QuotaExceededError(AppException):
    """Quota dépassé (ex: requêtes AI)"""
    def __init__(self, resource: str = "requests", limit: int = 0):
        super().__init__(
            message=f"Daily {resource} quota exceeded",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            error_code="QUOTA_EXCEEDED",
            details={"resource": resource, "limit": limit}
        )


class InvalidOperationError(AppException):
    """Opération invalide dans l'état actuel"""
    def __init__(self, message: str):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="INVALID_OPERATION"
        )


class AntiCheatViolationError(AppException):
    """Violation anti-triche détectée"""
    def __init__(self, violation_type: str, severity: str = "medium"):
        super().__init__(
            message="Suspicious activity detected",
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="ANTICHEAT_VIOLATION",
            details={"violation_type": violation_type, "severity": severity}
        )


# ============================================
# ERROR HANDLERS
# ============================================

def create_error_response(
    status_code: int,
    error_code: str,
    message: str,
    details: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None,
    request: Optional[Request] = None
) -> JSONResponse:
    """Crée une réponse d'erreur standardisée avec headers CORS"""
    content = {
        "success": False,
        "error": {
            "code": error_code,
            "message": message,
        }
    }

    if details:
        content["error"]["details"] = details

    if request_id:
        content["request_id"] = request_id

    # Ajouter les headers CORS pour les réponses d'erreur
    headers = {}
    if request:
        origin = request.headers.get("origin")
        # En développement, autoriser localhost
        import os
        if os.getenv("ENVIRONMENT", "development") == "development":
            if origin and ("localhost" in origin or "127.0.0.1" in origin):
                headers["Access-Control-Allow-Origin"] = origin
                headers["Access-Control-Allow-Credentials"] = "true"

    return JSONResponse(
        status_code=status_code,
        content=content,
        headers=headers if headers else None
    )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Gestionnaire pour les exceptions de l'application"""
    request_id = request.headers.get("X-Request-ID")

    # Logger l'erreur
    logger.error(
        f"AppException: {exc.error_code} - {exc.message}",
        extra={
            "error_code": exc.error_code,
            "status_code": exc.status_code,
            "details": exc.details,
            "path": request.url.path,
            "method": request.method,
            "request_id": request_id
        }
    )

    return create_error_response(
        status_code=exc.status_code,
        error_code=exc.error_code,
        message=exc.message,
        details=exc.details,
        request_id=request_id,
        request=request
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Gestionnaire pour les HTTPException FastAPI"""
    request_id = request.headers.get("X-Request-ID")

    # Mapper les codes HTTP aux codes d'erreur
    error_codes = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMITED",
        500: "INTERNAL_ERROR",
        503: "SERVICE_UNAVAILABLE"
    }

    error_code = error_codes.get(exc.status_code, "UNKNOWN_ERROR")

    logger.warning(
        f"HTTPException: {exc.status_code} - {exc.detail}",
        extra={
            "status_code": exc.status_code,
            "path": request.url.path,
            "method": request.method,
            "request_id": request_id
        }
    )

    return create_error_response(
        status_code=exc.status_code,
        error_code=error_code,
        message=str(exc.detail),
        request_id=request_id,
        request=request
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError
) -> JSONResponse:
    """Gestionnaire pour les erreurs de validation Pydantic"""
    request_id = request.headers.get("X-Request-ID")

    # Formater les erreurs de validation
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        errors.append({
            "field": field,
            "message": error["msg"],
            "type": error["type"]
        })

    logger.warning(
        f"Validation error: {len(errors)} errors",
        extra={
            "errors": errors,
            "path": request.url.path,
            "method": request.method,
            "request_id": request_id
        }
    )

    return create_error_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        error_code="VALIDATION_ERROR",
        message="Validation failed",
        details={"errors": errors},
        request_id=request_id,
        request=request
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Gestionnaire pour toutes les autres exceptions non gérées"""
    request_id = request.headers.get("X-Request-ID")

    # Logger l'erreur complète avec le traceback
    logger.exception(
        f"Unhandled exception: {type(exc).__name__} - {str(exc)}",
        extra={
            "exception_type": type(exc).__name__,
            "path": request.url.path,
            "method": request.method,
            "request_id": request_id,
            "traceback": traceback.format_exc()
        }
    )

    # En production, ne pas exposer les détails de l'erreur
    import os
    is_debug = os.getenv("DEBUG", "False").lower() == "true"

    message = "An unexpected error occurred"
    details = None

    if is_debug:
        message = str(exc)
        details = {
            "type": type(exc).__name__,
            "traceback": traceback.format_exc().split("\n")
        }

    return create_error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code="INTERNAL_ERROR",
        message=message,
        details=details,
        request_id=request_id,
        request=request
    )


# ============================================
# REGISTER HANDLERS
# ============================================

def register_exception_handlers(app):
    """Enregistre tous les gestionnaires d'exceptions sur l'application FastAPI"""
    from fastapi.exceptions import RequestValidationError

    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)

    logger.info("Exception handlers registered successfully")


# ============================================
# HELPER DECORATORS
# ============================================

from functools import wraps
from typing import Callable, TypeVar
from sqlalchemy.exc import SQLAlchemyError

T = TypeVar('T')


def handle_db_errors(func: Callable[..., T]) -> Callable[..., T]:
    """
    Décorateur pour gérer les erreurs de base de données

    Usage:
        @handle_db_errors
        async def my_endpoint():
            ...
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except SQLAlchemyError as e:
            logger.exception(f"Database error in {func.__name__}: {e}")
            raise DatabaseError(f"Database operation failed")
    return wrapper


def handle_external_service_errors(service_name: str):
    """
    Décorateur pour gérer les erreurs de services externes

    Usage:
        @handle_external_service_errors("anthropic")
        async def call_ai_service():
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                logger.exception(f"External service error ({service_name}): {e}")
                raise ExternalServiceError(service_name, str(e))
        return wrapper
    return decorator
