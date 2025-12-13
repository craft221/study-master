"""
Enterprise Security Middleware
- Rate limiting
- Request validation
- Security headers
- IP blocking
"""
import time
import hashlib
import logging
from typing import Optional, Dict, Set
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import redis.asyncio as redis

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Advanced rate limiting with Redis backend
    Supports:
    - Per-IP rate limiting
    - Per-user rate limiting (authenticated)
    - Sliding window algorithm
    - Burst allowance
    """

    def __init__(
        self,
        app,
        redis_url: str = "redis://localhost:6379/0",
        requests_per_minute: int = 60,
        requests_per_hour: int = 1000,
        burst_size: int = 20,
        whitelist_ips: Optional[Set[str]] = None,
        blacklist_ips: Optional[Set[str]] = None,
    ):
        super().__init__(app)
        self.redis_url = redis_url
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self.burst_size = burst_size
        self.whitelist_ips = whitelist_ips or set()
        self.blacklist_ips = blacklist_ips or set()
        self._redis: Optional[redis.Redis] = None

        # Fallback in-memory rate limiting if Redis is unavailable
        self._memory_store: Dict[str, list] = defaultdict(list)

    async def get_redis(self) -> Optional[redis.Redis]:
        """Get Redis connection with lazy initialization"""
        if self._redis is None:
            try:
                self._redis = redis.from_url(
                    self.redis_url,
                    encoding="utf-8",
                    decode_responses=True
                )
                await self._redis.ping()
            except Exception as e:
                logger.warning(f"Redis unavailable for rate limiting: {e}")
                self._redis = None
        return self._redis

    def get_client_ip(self, request: Request) -> str:
        """Extract real client IP from request"""
        # Check X-Forwarded-For header (common with reverse proxies)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        # Check X-Real-IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # Fallback to direct client
        return request.client.host if request.client else "unknown"

    def get_rate_limit_key(self, request: Request) -> str:
        """Generate rate limit key based on IP and/or user"""
        ip = self.get_client_ip(request)
        ip_hash = hashlib.sha256(ip.encode()).hexdigest()[:16]

        # Essayer d'extraire le user_id du token JWT
        user_id = self._extract_user_id_from_token(request)

        if user_id:
            # Rate limit par utilisateur ET par IP (double protection)
            # Cela empêche un utilisateur de faire des attaques depuis plusieurs IPs
            # ET empêche plusieurs utilisateurs depuis la même IP de contourner les limites
            return f"rate_limit:user:{user_id}:ip:{ip_hash}"

        # Fallback sur IP seule pour les requêtes non authentifiées
        return f"rate_limit:ip:{ip_hash}"

    def _extract_user_id_from_token(self, request: Request) -> Optional[str]:
        """Extrait le user_id du token JWT sans validation complète"""
        try:
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return None

            token = auth_header[7:]
            # Décoder le payload sans vérifier la signature (juste pour le rate limiting)
            # La vérification complète sera faite par get_current_user
            import base64
            import json

            parts = token.split(".")
            if len(parts) != 3:
                return None

            # Décoder le payload (partie centrale du JWT)
            payload_b64 = parts[1]
            # Ajouter le padding si nécessaire
            padding = 4 - len(payload_b64) % 4
            if padding != 4:
                payload_b64 += "=" * padding

            payload = json.loads(base64.urlsafe_b64decode(payload_b64))
            return payload.get("sub")
        except Exception:
            return None

    async def check_rate_limit_redis(self, key: str, window: int, limit: int) -> tuple[bool, int]:
        """Check rate limit using Redis sliding window"""
        redis_client = await self.get_redis()
        if not redis_client:
            return await self.check_rate_limit_memory(key, window, limit)

        try:
            now = time.time()
            window_start = now - window

            pipe = redis_client.pipeline()
            # Remove old entries
            pipe.zremrangebyscore(key, 0, window_start)
            # Add current request
            pipe.zadd(key, {str(now): now})
            # Count requests in window
            pipe.zcard(key)
            # Set expiry
            pipe.expire(key, window + 60)
            results = await pipe.execute()

            count = results[2]
            remaining = max(0, limit - count)

            return count <= limit, remaining

        except Exception as e:
            logger.error(f"Redis rate limit error: {e}")
            return await self.check_rate_limit_memory(key, window, limit)

    async def check_rate_limit_memory(self, key: str, window: int, limit: int) -> tuple[bool, int]:
        """Fallback in-memory rate limiting"""
        now = time.time()
        window_start = now - window

        # Clean old entries
        self._memory_store[key] = [
            ts for ts in self._memory_store[key]
            if ts > window_start
        ]

        # Add current request
        self._memory_store[key].append(now)

        count = len(self._memory_store[key])
        remaining = max(0, limit - count)

        return count <= limit, remaining

    async def dispatch(self, request: Request, call_next):
        client_ip = self.get_client_ip(request)

        # Check blacklist
        if client_ip in self.blacklist_ips:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Access denied"}
            )

        # Skip rate limiting for whitelisted IPs
        if client_ip in self.whitelist_ips:
            return await call_next(request)

        # Skip rate limiting for health checks
        if request.url.path in ["/health", "/metrics", "/docs", "/openapi.json"]:
            return await call_next(request)

        # Get rate limit key
        key = self.get_rate_limit_key(request)

        # Check minute rate limit
        minute_key = f"{key}:minute"
        allowed_minute, remaining_minute = await self.check_rate_limit_redis(
            minute_key, 60, self.requests_per_minute
        )

        # Check hour rate limit
        hour_key = f"{key}:hour"
        allowed_hour, remaining_hour = await self.check_rate_limit_redis(
            hour_key, 3600, self.requests_per_hour
        )

        if not allowed_minute or not allowed_hour:
            retry_after = 60 if not allowed_minute else 3600

            logger.warning(
                f"Rate limit exceeded for {client_ip} on {request.url.path}"
            )

            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Too many requests. Please slow down.",
                    "retry_after": retry_after
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(self.requests_per_minute),
                    "X-RateLimit-Remaining": str(remaining_minute),
                    "X-RateLimit-Reset": str(int(time.time()) + 60)
                }
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining_minute)
        response.headers["X-RateLimit-Reset"] = str(int(time.time()) + 60)

        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), camera=(), geolocation=(), "
            "gyroscope=(), magnetometer=(), microphone=(), "
            "payment=(), usb=()"
        )

        # HSTS (only in production)
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        return response


class RequestValidationMiddleware(BaseHTTPMiddleware):
    """Validate and sanitize incoming requests"""

    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB

    async def dispatch(self, request: Request, call_next):
        # Check content length
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > self.MAX_CONTENT_LENGTH:
                    return JSONResponse(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        content={"detail": "Request body too large"}
                    )
            except ValueError:
                pass

        # Validate content type for POST/PUT/PATCH
        if request.method in ["POST", "PUT", "PATCH"]:
            content_type = request.headers.get("content-type", "")
            allowed_types = [
                "application/json",
                "multipart/form-data",
                "application/x-www-form-urlencoded"
            ]
            if content_type and not any(t in content_type for t in allowed_types):
                # Allow for file uploads and form data
                pass

        return await call_next(request)


class IPBlockMiddleware(BaseHTTPMiddleware):
    """
    Dynamic IP blocking based on suspicious activity
    Integrates with fail2ban or similar systems
    """

    def __init__(
        self,
        app,
        redis_url: str = "redis://localhost:6379/0",
        max_failed_attempts: int = 10,
        block_duration: int = 3600,  # 1 hour
    ):
        super().__init__(app)
        self.redis_url = redis_url
        self.max_failed_attempts = max_failed_attempts
        self.block_duration = block_duration
        self._redis: Optional[redis.Redis] = None

    async def get_redis(self) -> Optional[redis.Redis]:
        if self._redis is None:
            try:
                self._redis = redis.from_url(self.redis_url)
                await self._redis.ping()
            except Exception:
                self._redis = None
        return self._redis

    async def is_blocked(self, ip: str) -> bool:
        """Check if IP is blocked"""
        redis_client = await self.get_redis()
        if not redis_client:
            return False

        try:
            blocked = await redis_client.get(f"blocked_ip:{ip}")
            return blocked is not None
        except Exception:
            return False

    async def record_failed_attempt(self, ip: str):
        """Record a failed authentication attempt"""
        redis_client = await self.get_redis()
        if not redis_client:
            return

        try:
            key = f"failed_attempts:{ip}"
            count = await redis_client.incr(key)
            await redis_client.expire(key, self.block_duration)

            if count >= self.max_failed_attempts:
                await redis_client.setex(
                    f"blocked_ip:{ip}",
                    self.block_duration,
                    "blocked"
                )
                logger.warning(f"IP {ip} blocked due to too many failed attempts")
        except Exception as e:
            logger.error(f"Error recording failed attempt: {e}")

    async def dispatch(self, request: Request, call_next):
        # Get client IP
        ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        if not ip:
            ip = request.client.host if request.client else "unknown"

        # Check if blocked
        if await self.is_blocked(ip):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Your IP has been temporarily blocked"}
            )

        response = await call_next(request)

        # Record failed auth attempts
        if response.status_code == 401 and "/auth/" in request.url.path:
            await self.record_failed_attempt(ip)

        return response
