"""
Routes d'authentification avec rate limiting
"""

import logging
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.core.datetime_utils import utc_now, utc_date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from slowapi import Limiter
from slowapi.util import get_remote_address
import redis.asyncio as redis

from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    revoke_token,
    get_current_active_user
)
from app.core.config import settings
from app.models.user import User, create_user_with_defaults
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    UserResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    VerifyEmailRequest,
    ResendVerificationRequest,
    RegisterResponse
)
from app.services.mfa_service import mfa_service
from app.services.email_service import email_service

# Configuration du logger
logger = logging.getLogger(__name__)

# Configuration du rate limiter
# Utilise l'adresse IP du client pour le rate limiting
limiter = Limiter(key_func=get_remote_address)

router = APIRouter()

# Redis connection pour les codes de vérification
_redis_client = None


async def get_redis():
    """Obtenir une connexion Redis"""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


def generate_verification_code() -> str:
    """Génère un code de vérification à 6 chiffres"""
    return ''.join([str(secrets.randbelow(10)) for _ in range(6)])


@router.post("/login")
@limiter.limit(f"{settings.AUTH_RATE_LIMIT_PER_MINUTE}/minute")
async def login(
    request: Request,
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Connexion utilisateur.

    Rate limited à {AUTH_RATE_LIMIT_PER_MINUTE} requêtes par minute par IP
    pour prévenir les attaques par force brute.

    Si MFA est activé:
    - Sans mfa_code: Retourne mfa_required=true avec un temp_token
    - Avec mfa_code: Valide le code et retourne les tokens complets
    """
    logger.info(f"Tentative de connexion pour: {login_data.email}")

    result = await db.execute(select(User).where(User.email == login_data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(login_data.password, user.hashed_password):
        logger.warning(f"Échec de connexion pour: {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )

    if not user.is_active:
        logger.warning(f"Tentative de connexion sur compte désactivé: {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Compte désactivé"
        )

    # Vérifier si l'email est vérifié
    if not user.is_verified:
        # Renvoyer automatiquement un code de vérification
        code = generate_verification_code()
        redis_client = await get_redis()
        await redis_client.setex(
            f"email_verification:{login_data.email}",
            600,  # 10 minutes
            code
        )
        await email_service.send_verification_code(
            to_email=login_data.email,
            username=user.username,
            code=code
        )
        logger.warning(f"Connexion refusée - email non vérifié: {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email non vérifié. Un nouveau code de vérification a été envoyé."
        )

    # Vérifier MFA si activé
    if user.mfa_enabled:
        if not login_data.mfa_code:
            # MFA requis mais pas de code fourni
            # Créer un token temporaire (court, 5 min) pour soumettre le code MFA
            temp_token = create_access_token(
                data={"sub": str(user.id), "type": "mfa_pending"},
                expires_delta=timedelta(minutes=5)
            )
            logger.info(f"MFA required for user {user.id}")
            return {
                "mfa_required": True,
                "message": "Veuillez entrer votre code d'authentification à deux facteurs",
                "temp_token": temp_token
            }

        # Vérifier le code MFA
        is_valid, mfa_message = await mfa_service.verify_login(user, login_data.mfa_code)
        if not is_valid:
            logger.warning(f"MFA verification failed for user {user.id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Code MFA invalide"
            )
        logger.info(f"MFA verified for user {user.id}: {mfa_message}")

    # Mettre à jour le streak et last_activity_date
    if user.gamification:
        today = utc_date()
        last_activity = user.gamification.last_activity_date.date() if user.gamification.last_activity_date else None

        if last_activity != today:
            # Première activité du jour
            if last_activity == today - timedelta(days=1):
                # Activité hier - incrémenter le streak
                user.gamification.current_streak += 1
            elif last_activity is None or last_activity < today - timedelta(days=1):
                # Pas d'activité hier ou jamais - reset le streak à 1
                user.gamification.current_streak = 1

            # Toujours mettre à jour longest_streak si current_streak est plus grand
            if user.gamification.current_streak > user.gamification.longest_streak:
                user.gamification.longest_streak = user.gamification.current_streak

            user.gamification.last_activity_date = utc_now()
            logger.info(f"Streak mis à jour pour utilisateur {user.id}: {user.gamification.current_streak} jours (longest: {user.gamification.longest_streak})")

    # Mettre à jour last_login
    user.last_login_at = utc_now()

    await db.commit()

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    refresh_token = create_refresh_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    )

    logger.info(f"Connexion réussie pour utilisateur {user.id}")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user,
        "mfa_required": False
    }


@router.post("/register", response_model=RegisterResponse)
@limiter.limit("5/minute")  # Plus strict pour l'inscription
async def register(
    request: Request,
    register_data: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Inscription utilisateur avec vérification par email.

    Rate limited à 5 inscriptions par minute par IP.

    Flow:
    1. Crée le compte (is_verified=False)
    2. Envoie un code à 6 chiffres par email
    3. L'utilisateur doit vérifier avec POST /verify-email
    """
    logger.info(f"Tentative d'inscription: {register_data.email}")

    # Vérifier si l'email existe déjà
    result = await db.execute(select(User).where(User.email == register_data.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        # Si le compte existe mais n'est pas vérifié, on peut renvoyer le code
        if not existing_user.is_verified:
            # Générer et envoyer un nouveau code
            code = generate_verification_code()
            redis_client = await get_redis()
            await redis_client.setex(
                f"email_verification:{register_data.email}",
                600,  # 10 minutes
                code
            )

            # Envoyer l'email
            await email_service.send_verification_code(
                to_email=register_data.email,
                username=existing_user.username,
                code=code
            )

            logger.info(f"Code de vérification renvoyé pour compte non vérifié: {register_data.email}")
            return RegisterResponse(
                message="Un nouveau code de vérification a été envoyé à votre adresse email",
                email=register_data.email,
                requires_verification=True
            )

        logger.warning(f"Tentative d'inscription avec email existant: {register_data.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cet email est déjà utilisé"
        )

    # Vérifier si le username existe déjà
    result = await db.execute(select(User).where(User.username == register_data.username))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        logger.warning(f"Tentative d'inscription avec username existant: {register_data.username}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce nom d'utilisateur est déjà utilisé"
        )

    # Créer le nouvel utilisateur (non vérifié)
    new_user = create_user_with_defaults(
        email=register_data.email,
        username=register_data.username,
        hashed_password=get_password_hash(register_data.password),
        full_name=register_data.full_name
    )
    new_user.is_verified = False  # Explicitement non vérifié

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    logger.info(f"Nouvel utilisateur créé: {new_user.id} ({new_user.email})")

    # Générer le code de vérification
    code = generate_verification_code()

    # Stocker dans Redis (expire après 10 minutes)
    redis_client = await get_redis()
    await redis_client.setex(
        f"email_verification:{register_data.email}",
        600,  # 10 minutes
        code
    )

    # Envoyer l'email de vérification
    email_sent = await email_service.send_verification_code(
        to_email=register_data.email,
        username=new_user.username,
        code=code
    )

    if email_sent:
        logger.info(f"Email de vérification envoyé à {register_data.email}")
    else:
        logger.warning(f"Échec d'envoi de l'email de vérification à {register_data.email}")

    return RegisterResponse(
        message="Compte créé ! Vérifiez votre email pour le code de vérification",
        email=register_data.email,
        requires_verification=True
    )


@router.post("/refresh", response_model=RefreshTokenResponse)
@limiter.limit("30/minute")  # Permet plusieurs refreshs légitimes
async def refresh_access_token(
    request: Request,
    token_request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Rafraîchit l'access token avec un refresh token valide.

    Rate limited à 30 requêtes par minute par IP.
    """
    user_id = verify_refresh_token(token_request.refresh_token)

    if user_id is None:
        logger.warning("Tentative de refresh avec token invalide")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalide ou expiré"
        )

    # Vérifier que l'utilisateur existe et est actif
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        logger.warning(f"Refresh token pour utilisateur invalide/désactivé: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur invalide ou désactivé"
        )

    # Générer un nouveau access token
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    logger.debug(f"Token rafraîchi pour utilisateur {user.id}")

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.post("/logout")
@limiter.limit("10/minute")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_active_user)
):
    """
    Déconnexion utilisateur - révoque l'access token actuel.

    Le token sera ajouté à la blacklist Redis et ne pourra plus être utilisé.
    """
    # Extraire le token de l'en-tête Authorization
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]

        # Révoquer le token pour le temps restant avant son expiration
        # On utilise la durée maximale car on ne peut pas facilement extraire l'exp du token ici
        expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        await revoke_token(token, expires_in)

        logger.info(f"Utilisateur {current_user.id} déconnecté, token révoqué")

    return {"message": "Déconnexion réussie"}


@router.post("/verify-email")
@limiter.limit("10/minute")
async def verify_email(
    request: Request,
    verify_data: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Vérifie l'email avec le code à 6 chiffres.

    Après vérification réussie, retourne les tokens d'accès.
    """
    logger.info(f"Tentative de vérification email: {verify_data.email}")

    # Récupérer le code depuis Redis
    redis_client = await get_redis()
    stored_code = await redis_client.get(f"email_verification:{verify_data.email}")

    if not stored_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code expiré ou invalide. Demandez un nouveau code."
        )

    if stored_code != verify_data.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code incorrect"
        )

    # Trouver l'utilisateur
    result = await db.execute(select(User).where(User.email == verify_data.email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )

    # Marquer comme vérifié
    user.is_verified = True
    await db.commit()

    # Supprimer le code de Redis
    await redis_client.delete(f"email_verification:{verify_data.email}")

    # Générer les tokens
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    refresh_token = create_refresh_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    )

    logger.info(f"Email vérifié pour utilisateur {user.id}")

    # Envoyer email de bienvenue
    await email_service.send_welcome(
        to_email=user.email,
        username=user.username
    )

    return {
        "message": "Email vérifié avec succès !",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user
    }


@router.post("/resend-verification")
@limiter.limit("3/minute")  # Strict pour éviter le spam
async def resend_verification_code(
    request: Request,
    resend_data: ResendVerificationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Renvoie le code de vérification par email.

    Limité à 3 demandes par minute pour éviter les abus.
    """
    logger.info(f"Demande de renvoi de code pour: {resend_data.email}")

    # Trouver l'utilisateur
    result = await db.execute(select(User).where(User.email == resend_data.email))
    user = result.scalar_one_or_none()

    if not user:
        # Ne pas révéler si l'email existe ou non (sécurité)
        return {"message": "Si cet email est enregistré, un nouveau code sera envoyé"}

    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cet email est déjà vérifié"
        )

    # Générer un nouveau code
    code = generate_verification_code()

    # Stocker dans Redis
    redis_client = await get_redis()
    await redis_client.setex(
        f"email_verification:{resend_data.email}",
        600,  # 10 minutes
        code
    )

    # Envoyer l'email
    await email_service.send_verification_code(
        to_email=resend_data.email,
        username=user.username,
        code=code
    )

    logger.info(f"Nouveau code envoyé à {resend_data.email}")

    return {"message": "Un nouveau code de vérification a été envoyé"}
