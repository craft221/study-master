"""
Fonctions de sécurité et authentification avancées
Inclut: JWT, RBAC, CSRF, ownership verification, rate limiting, token revocation
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List, Callable, Any, TypeVar
from functools import wraps
import secrets
import hashlib
import hmac
import logging
import redis.asyncio as aioredis

from jose import JWTError, jwt
from app.core.datetime_utils import utc_now, utc_timestamp
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

# ============================================
# TOKEN REVOCATION (BLACKLIST)
# ============================================

_redis_client: Optional[aioredis.Redis] = None


async def get_token_blacklist_redis() -> Optional[aioredis.Redis]:
    """Get Redis connection for token blacklist"""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            await _redis_client.ping()
        except Exception as e:
            logger.warning(f"Redis unavailable for token blacklist: {e}")
            _redis_client = None
    return _redis_client


async def revoke_token(token: str, expires_in_seconds: int) -> bool:
    """
    Ajoute un token à la blacklist Redis.
    Le token sera automatiquement supprimé après son expiration naturelle.

    Args:
        token: Le JWT à révoquer
        expires_in_seconds: Durée avant expiration naturelle du token

    Returns:
        True si le token a été révoqué, False sinon
    """
    redis_client = await get_token_blacklist_redis()
    if not redis_client:
        logger.error("Cannot revoke token: Redis unavailable")
        return False

    try:
        # Utiliser un hash du token comme clé pour éviter de stocker le token complet
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        key = f"revoked_token:{token_hash}"

        # Stocker avec TTL égal au temps restant avant expiration
        await redis_client.setex(key, expires_in_seconds, "revoked")
        logger.info(f"Token revoked successfully (hash: {token_hash[:16]}...)")
        return True
    except Exception as e:
        logger.error(f"Error revoking token: {e}")
        return False


async def is_token_revoked(token: str) -> bool:
    """
    Vérifie si un token est dans la blacklist.

    Args:
        token: Le JWT à vérifier

    Returns:
        True si le token est révoqué, False sinon
    """
    redis_client = await get_token_blacklist_redis()
    if not redis_client:
        # Si Redis est indisponible, on refuse par sécurité en production
        if settings.ENVIRONMENT == "production":
            logger.warning("Redis unavailable in production - denying token for safety")
            return True
        return False

    try:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        key = f"revoked_token:{token_hash}"
        result = await redis_client.get(key)
        return result is not None
    except Exception as e:
        logger.error(f"Error checking token revocation: {e}")
        # En cas d'erreur, refuser par sécurité en production
        return settings.ENVIRONMENT == "production"


async def revoke_all_user_tokens(user_id: int) -> bool:
    """
    Révoque tous les tokens d'un utilisateur en incrémentant sa version de token.
    Utile pour les cas de changement de mot de passe ou de compromission de compte.

    Args:
        user_id: L'ID de l'utilisateur

    Returns:
        True si la révocation a réussi, False sinon
    """
    redis_client = await get_token_blacklist_redis()
    if not redis_client:
        return False

    try:
        key = f"user_token_version:{user_id}"
        await redis_client.incr(key)
        logger.info(f"All tokens revoked for user {user_id}")
        return True
    except Exception as e:
        logger.error(f"Error revoking all user tokens: {e}")
        return False


async def get_user_token_version(user_id: int) -> int:
    """Récupère la version actuelle des tokens d'un utilisateur"""
    redis_client = await get_token_blacklist_redis()
    if not redis_client:
        return 0

    try:
        key = f"user_token_version:{user_id}"
        version = await redis_client.get(key)
        return int(version) if version else 0
    except Exception:
        return 0

# Configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Type pour les modèles
T = TypeVar('T')


# ============================================
# PASSWORD HASHING
# ============================================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifie si le mot de passe correspond au hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash un mot de passe avec bcrypt"""
    return pwd_context.hash(password)


# ============================================
# JWT TOKEN MANAGEMENT
# ============================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Crée un JWT access token avec type validation"""
    to_encode = data.copy()
    now = utc_now()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "type": "access",
        "iat": now
    })
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Crée un JWT refresh token"""
    to_encode = data.copy()
    now = utc_now()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "type": "refresh",
        "iat": now
    })
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str, expected_type: str = "access") -> Optional[dict]:
    """
    Vérifie un token JWT et valide son type

    Args:
        token: Le JWT à vérifier
        expected_type: 'access' ou 'refresh'

    Returns:
        Le payload du token ou None si invalide
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_type = payload.get("type")

        if token_type != expected_type:
            logger.warning(f"Token type mismatch: expected {expected_type}, got {token_type}")
            return None

        return payload
    except JWTError as e:
        logger.warning(f"JWT verification failed: {e}")
        return None


def verify_refresh_token(token: str) -> Optional[str]:
    """Vérifie un refresh token et retourne le user_id si valide"""
    payload = verify_token(token, expected_type="refresh")
    if payload:
        return payload.get("sub")
    return None


# ============================================
# CSRF PROTECTION
# ============================================

def generate_csrf_token() -> str:
    """Génère un token CSRF sécurisé"""
    return secrets.token_urlsafe(32)


def verify_csrf_token(token: str, stored_token: str) -> bool:
    """Vérifie un token CSRF avec comparaison constante"""
    if not token or not stored_token:
        return False
    return hmac.compare_digest(token, stored_token)


class CSRFProtection:
    """Middleware de protection CSRF pour les opérations d'état"""

    SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
    CSRF_HEADER = "X-CSRF-Token"
    CSRF_COOKIE = "csrf_token"

    @staticmethod
    def generate_token() -> str:
        return secrets.token_urlsafe(32)

    @staticmethod
    async def validate(request: Request) -> bool:
        """Valide le token CSRF pour les requêtes non-safe"""
        if request.method in CSRFProtection.SAFE_METHODS:
            return True

        # Récupérer le token du header
        header_token = request.headers.get(CSRFProtection.CSRF_HEADER)

        # Récupérer le token du cookie
        cookie_token = request.cookies.get(CSRFProtection.CSRF_COOKIE)

        if not header_token or not cookie_token:
            return False

        return hmac.compare_digest(header_token, cookie_token)


# ============================================
# USER AUTHENTICATION
# ============================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Récupère l'utilisateur actuel depuis le token JWT avec validation du type et vérification de révocation"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        token = credentials.credentials

        # Vérifier si le token est révoqué (blacklist)
        if await is_token_revoked(token):
            logger.warning("Attempt to use revoked token")
            raise credentials_exception

        payload = verify_token(token, expected_type="access")

        if payload is None:
            raise credentials_exception

        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    result = await db.execute(
        select(User).where(
            User.id == int(user_id),
            User.is_deleted == False  # Ne pas retourner les users supprimés
        )
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    # Mettre à jour last_login_at (last_seen n'existe pas dans le modèle User)
    user.last_login_at = utc_now()
    await db.commit()

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Récupère l'utilisateur actuel et vérifie qu'il est actif"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
    return current_user


# Créer un security optionnel pour les endpoints publics
optional_security = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    Récupère l'utilisateur actuel si un token est fourni, sinon retourne None.
    Utile pour les endpoints publics qui veulent personnaliser la réponse si l'utilisateur est connecté.
    """
    if not credentials:
        return None

    try:
        token = credentials.credentials
        payload = verify_token(token, expected_type="access")

        if payload is None:
            return None

        user_id: str = payload.get("sub")
        if user_id is None:
            return None

        result = await db.execute(
            select(User).where(
                User.id == int(user_id),
                User.is_deleted == False
            )
        )
        user = result.scalar_one_or_none()
        return user

    except (JWTError, Exception):
        return None


# ============================================
# ROLE-BASED ACCESS CONTROL (RBAC)
# ============================================

def require_role(allowed_roles: List[UserRole]):
    """
    Dépendance FastAPI pour vérifier le rôle de l'utilisateur

    Usage:
        @router.get("/admin/users")
        async def admin_endpoint(
            current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.MODERATOR]))
        ):
            ...
    """
    async def role_checker(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        if current_user.role not in allowed_roles:
            logger.warning(
                f"Access denied: User {current_user.id} with role {current_user.role} "
                f"tried to access resource requiring {allowed_roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this resource"
            )
        return current_user

    return role_checker


async def get_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Dépendance pour les endpoints admin uniquement"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def get_moderator_or_admin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Dépendance pour les endpoints modérateur ou admin"""
    if current_user.role not in [UserRole.ADMIN, UserRole.MODERATOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Moderator or admin access required"
        )
    return current_user


# ============================================
# OWNERSHIP VERIFICATION
# ============================================

# Importer OwnershipError depuis exceptions.py pour éviter la duplication
from app.core.exceptions import OwnershipError


async def verify_ownership(
    db: AsyncSession,
    model: Any,
    resource_id: int,
    user_id: int,
    user_id_field: str = "user_id",
    resource_name: str = "Resource",
    allow_admin: bool = True,
    current_user: Optional[User] = None
) -> Any:
    """
    Vérifie qu'une ressource appartient à l'utilisateur

    Args:
        db: Session de base de données
        model: Le modèle SQLAlchemy (Quiz, Note, etc.)
        resource_id: L'ID de la ressource
        user_id: L'ID de l'utilisateur
        user_id_field: Le nom du champ user_id dans le modèle
        resource_name: Nom de la ressource pour les messages d'erreur
        allow_admin: Si True, les admins peuvent accéder à toutes les ressources
        current_user: L'utilisateur courant (pour vérifier admin)

    Returns:
        La ressource si l'ownership est vérifié

    Raises:
        HTTPException 404 si la ressource n'existe pas ou n'appartient pas à l'utilisateur
    """
    from sqlalchemy import and_

    # Construire la requête
    query = select(model).where(model.id == resource_id)

    # Vérifier si le modèle a un champ is_deleted
    if hasattr(model, 'is_deleted'):
        query = query.where(model.is_deleted == False)

    result = await db.execute(query)
    resource = result.scalar_one_or_none()

    if resource is None:
        logger.warning(f"{resource_name} {resource_id} not found")
        raise OwnershipError(resource_name)

    # Vérifier l'ownership
    resource_owner_id = getattr(resource, user_id_field, None)

    if resource_owner_id != user_id:
        # Vérifier si l'utilisateur est admin et si c'est permis
        if allow_admin and current_user and current_user.role == UserRole.ADMIN:
            logger.info(f"Admin {current_user.id} accessing {resource_name} {resource_id}")
            return resource

        logger.warning(
            f"Ownership violation: User {user_id} tried to access "
            f"{resource_name} {resource_id} owned by {resource_owner_id}"
        )
        raise OwnershipError(resource_name)

    return resource


def ownership_required(
    model: Any,
    id_param: str = "id",
    user_id_field: str = "user_id",
    resource_name: str = "Resource",
    allow_admin: bool = True
):
    """
    Décorateur pour vérifier l'ownership automatiquement

    Usage:
        @router.get("/quizzes/{quiz_id}")
        @ownership_required(Quiz, id_param="quiz_id", resource_name="Quiz")
        async def get_quiz(quiz_id: int, current_user: User, db: AsyncSession):
            # Le quiz est automatiquement vérifié
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            db = kwargs.get('db')
            current_user = kwargs.get('current_user')
            resource_id = kwargs.get(id_param)

            if db and current_user and resource_id:
                await verify_ownership(
                    db=db,
                    model=model,
                    resource_id=resource_id,
                    user_id=current_user.id,
                    user_id_field=user_id_field,
                    resource_name=resource_name,
                    allow_admin=allow_admin,
                    current_user=current_user
                )

            return await func(*args, **kwargs)
        return wrapper
    return decorator


# ============================================
# INPUT VALIDATION & SANITIZATION
# ============================================

import re
import html
import bleach

# Tags HTML autorisés pour le contenu riche (notes, etc.)
ALLOWED_TAGS = [
    'p', 'br', 'strong', 'em', 'u', 's', 'sub', 'sup',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'div', 'span',
    'hr',
]

# Attributs autorisés par tag
ALLOWED_ATTRIBUTES = {
    '*': ['class', 'id'],
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'td': ['colspan', 'rowspan'],
    'th': ['colspan', 'rowspan'],
}

# Protocoles autorisés pour les URLs
ALLOWED_PROTOCOLS = ['http', 'https', 'mailto']


def sanitize_string(value: str, max_length: int = 10000) -> str:
    """
    Sanitize une chaîne pour prévenir XSS et injection

    Args:
        value: La chaîne à nettoyer
        max_length: Longueur maximale autorisée

    Returns:
        La chaîne nettoyée
    """
    if not value:
        return ""

    # Tronquer si trop long
    value = value[:max_length]

    # Échapper les caractères HTML
    value = html.escape(value)

    # Supprimer les caractères de contrôle (sauf newlines et tabs)
    value = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', value)

    return value.strip()


def sanitize_html(value: str, max_length: int = 50000) -> str:
    """
    Sanitize du contenu HTML avec bleach (bibliothèque spécialisée XSS)

    Utilise une whitelist de tags et attributs autorisés plutôt que
    des regex qui peuvent être contournées.

    Args:
        value: Le contenu HTML à nettoyer
        max_length: Longueur maximale autorisée

    Returns:
        Le HTML nettoyé et sécurisé
    """
    if not value:
        return ""

    value = value[:max_length]

    # Utiliser bleach pour nettoyer le HTML de manière sécurisée
    cleaned = bleach.clean(
        value,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,  # Supprimer les tags non autorisés au lieu de les échapper
        strip_comments=True  # Supprimer les commentaires HTML
    )

    return cleaned


def sanitize_markdown(value: str, max_length: int = 50000) -> str:
    """
    Sanitize du contenu Markdown avant conversion en HTML

    Args:
        value: Le contenu Markdown
        max_length: Longueur maximale

    Returns:
        Le Markdown nettoyé
    """
    if not value:
        return ""

    value = value[:max_length]

    # Supprimer les tentatives d'injection HTML dans le Markdown
    # Supprime les tags HTML bruts
    value = re.sub(r'<script[^>]*>.*?</script>', '', value, flags=re.DOTALL | re.IGNORECASE)
    value = re.sub(r'<[^>]+on\w+\s*=', '<', value, flags=re.IGNORECASE)

    # Supprimer javascript: dans les liens
    value = re.sub(r'\[([^\]]*)\]\(javascript:[^)]*\)', r'[\1](#)', value, flags=re.IGNORECASE)

    return value


def validate_email(email: str) -> bool:
    """Valide le format d'un email"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_username(username: str) -> tuple[bool, str]:
    """
    Valide un nom d'utilisateur

    Returns:
        (is_valid, error_message)
    """
    if not username:
        return False, "Username is required"

    if len(username) < 3:
        return False, "Username must be at least 3 characters"

    if len(username) > 30:
        return False, "Username must be at most 30 characters"

    if not re.match(r'^[a-zA-Z0-9_-]+$', username):
        return False, "Username can only contain letters, numbers, underscores and hyphens"

    # Vérifier les mots interdits
    forbidden = ['admin', 'root', 'system', 'moderator', 'support']
    if username.lower() in forbidden:
        return False, "This username is reserved"

    return True, ""


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Vérifie la force d'un mot de passe

    Returns:
        (is_valid, error_message)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters"

    if len(password) > 128:
        return False, "Password must be at most 128 characters"

    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"

    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"

    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"

    return True, ""


# ============================================
# RATE LIMITING HELPERS
# ============================================

def get_client_ip(request: Request) -> str:
    """Récupère l'IP réelle du client (avec support proxy)"""
    # Vérifier X-Forwarded-For pour les proxies
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Prendre la première IP (client original)
        return forwarded.split(",")[0].strip()

    # Vérifier X-Real-IP
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Fallback sur l'IP directe
    return request.client.host if request.client else "unknown"


def generate_rate_limit_key(request: Request, prefix: str = "rl") -> str:
    """Génère une clé de rate limiting basée sur l'IP et l'endpoint"""
    ip = get_client_ip(request)
    path = request.url.path
    return f"{prefix}:{ip}:{path}"


# ============================================
# AUDIT LOGGING
# ============================================

def log_security_event(
    event_type: str,
    user_id: Optional[int],
    details: dict,
    severity: str = "INFO",
    ip_address: Optional[str] = None
):
    """
    Log un événement de sécurité pour audit

    Args:
        event_type: Type d'événement (login, logout, permission_denied, etc.)
        user_id: ID de l'utilisateur concerné
        details: Détails additionnels
        severity: Niveau (INFO, WARNING, ERROR, CRITICAL)
        ip_address: Adresse IP du client
    """
    log_data = {
        "event_type": event_type,
        "user_id": user_id,
        "ip_address": ip_address,
        "timestamp": utc_timestamp(),
        **details
    }

    log_message = f"SECURITY_EVENT: {event_type} | User: {user_id} | IP: {ip_address} | {details}"

    if severity == "CRITICAL":
        logger.critical(log_message, extra=log_data)
    elif severity == "ERROR":
        logger.error(log_message, extra=log_data)
    elif severity == "WARNING":
        logger.warning(log_message, extra=log_data)
    else:
        logger.info(log_message, extra=log_data)
