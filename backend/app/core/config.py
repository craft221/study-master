import os
import secrets
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator


def generate_secret_key() -> str:
    """Génère une clé secrète sécurisée pour le développement"""
    return secrets.token_urlsafe(32)


class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "Studera"
    APP_NAME: str = "Studera API"
    APP_VERSION: str = "1.0.0"

    # Security - IMPORTANT: Toujours définir en production via variables d'environnement
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    CSRF_SECRET: str = os.getenv("CSRF_SECRET", "")
    ALGORITHM: str = "HS256"
    # Access token court (30 min) pour limiter la fenêtre d'attaque en cas de vol
    # Le refresh token permet de renouveler sans re-authentification
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # 30 minutes (était 24h - trop long!)
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days (réduit de 30 jours)

    @field_validator('SECRET_KEY', mode='before')
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        """Valide et génère une clé secrète si nécessaire"""
        env = os.getenv("ENVIRONMENT", "development")
        if not v or v == "your-secret-key-change-in-production":
            if env == "production":
                raise ValueError(
                    "SECRET_KEY must be set in production! "
                    "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
                )
            # En développement, générer une clé temporaire (avertissement)
            import logging
            logging.warning("⚠️  Using auto-generated SECRET_KEY. Set SECRET_KEY env var for persistence.")
            return generate_secret_key()
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return v

    @field_validator('CSRF_SECRET', mode='before')
    @classmethod
    def validate_csrf_secret(cls, v: str) -> str:
        """Valide et génère un secret CSRF si nécessaire"""
        if not v:
            return generate_secret_key()
        return v

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://studymaster:studymaster123@postgres:5432/studymaster_db"
    )

    # Environment
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")  # development, staging, production

    # CORS - Configuration sécurisée selon l'environnement
    @property
    def CORS_ORIGINS(self) -> List[str]:
        """
        Retourne les origines CORS autorisées selon l'environnement.
        En production, utiliser la variable d'environnement ALLOWED_ORIGINS.
        """
        if self.ENVIRONMENT == "production":
            # En production, lire depuis les variables d'environnement
            allowed = os.getenv("ALLOWED_ORIGINS", "")
            if allowed:
                return [origin.strip() for origin in allowed.split(",")]
            # Fallback sécurisé - aucune origine par défaut en prod
            return []
        # En développement, autoriser localhost sur tous les ports courants
        return [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://localhost:3003",
            "http://localhost:3004",
            "http://localhost:3005",
            "http://localhost:8000",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8000"
        ]

    CORS_ALLOW_CREDENTIALS: bool = True

    @property
    def CORS_ALLOW_METHODS(self) -> List[str]:
        """Méthodes HTTP autorisées - restrictif en production"""
        if self.ENVIRONMENT == "production":
            return ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
        return ["*"]

    @property
    def CORS_ALLOW_HEADERS(self) -> List[str]:
        """Headers autorisés - restrictif en production"""
        if self.ENVIRONMENT == "production":
            return [
                "Authorization",
                "Content-Type",
                "Accept",
                "Origin",
                "X-Requested-With",
                "X-CSRF-Token"
            ]
        return ["*"]

    # Celery & Redis
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/2")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")

    # AI Configuration (Anthropic Claude)
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    AI_MODEL_CLAUDE: str = "claude-sonnet-4-20250514"
    AI_MAX_TOKENS: int = 4096
    AI_TEMPERATURE: float = 0.7

    # AI Rate Limiting - BETA: Limite unique pour tous les utilisateurs
    AI_DAILY_LIMIT_FREE: int = 20  # Requêtes IA par jour pour tous (BETA)
    AI_DAILY_LIMIT_PREMIUM: int = 20  # Même limite pour tous pendant la beta

    # Rate Limiting général
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    AUTH_RATE_LIMIT_PER_MINUTE: int = int(os.getenv("AUTH_RATE_LIMIT_PER_MINUTE", "10"))

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Payment Configuration - Stripe
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_PUBLIC_KEY: str = os.getenv("STRIPE_PUBLIC_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")

    # Payment Configuration - PayPal
    PAYPAL_CLIENT_ID: str = os.getenv("PAYPAL_CLIENT_ID", "")
    PAYPAL_CLIENT_SECRET: str = os.getenv("PAYPAL_CLIENT_SECRET", "")
    PAYPAL_WEBHOOK_ID: str = os.getenv("PAYPAL_WEBHOOK_ID", "")
    PAYPAL_SANDBOX: bool = os.getenv("PAYPAL_SANDBOX", "true").lower() == "true"

    # Payment Configuration - PayDunya (Mobile Money Afrique de l'Ouest)
    PAYDUNYA_MASTER_KEY: str = os.getenv("PAYDUNYA_MASTER_KEY", "")
    PAYDUNYA_PRIVATE_KEY: str = os.getenv("PAYDUNYA_PRIVATE_KEY", "")
    PAYDUNYA_PUBLIC_KEY: str = os.getenv("PAYDUNYA_PUBLIC_KEY", "")
    PAYDUNYA_TOKEN: str = os.getenv("PAYDUNYA_TOKEN", "")

    # Payment Configuration - Flutterwave (désactivé - non disponible au Sénégal)
    # FLUTTERWAVE_SECRET_KEY: str = os.getenv("FLUTTERWAVE_SECRET_KEY", "")
    # FLUTTERWAVE_PUBLIC_KEY: str = os.getenv("FLUTTERWAVE_PUBLIC_KEY", "")
    # FLUTTERWAVE_ENCRYPTION_KEY: str = os.getenv("FLUTTERWAVE_ENCRYPTION_KEY", "")
    # FLUTTERWAVE_WEBHOOK_SECRET: str = os.getenv("FLUTTERWAVE_WEBHOOK_SECRET", "")

    # Frontend URL (pour les redirections après paiement)
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

    # Email Configuration - Resend (recommandé)
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")

    # Email Configuration - SMTP (fallback)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")

    # Email Common
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "noreply@studera.app")
    EMAIL_FROM_NAME: str = os.getenv("EMAIL_FROM_NAME", "Studera")

    # Monitoring - Sentry
    SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")
    SENTRY_TRACES_SAMPLE_RATE: float = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1"))  # 10% des requêtes


settings = Settings()