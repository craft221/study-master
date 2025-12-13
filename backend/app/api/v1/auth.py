"""
Routes d'authentification avec rate limiting
"""

import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.core.datetime_utils import utc_now, utc_date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from slowapi import Limiter
from slowapi.util import get_remote_address

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
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    UserResponse,
    RefreshTokenRequest,
    RefreshTokenResponse
)
from app.services.mfa_service import mfa_service

# Configuration du logger
logger = logging.getLogger(__name__)

# Configuration du rate limiter
# Utilise l'adresse IP du client pour le rate limiting
limiter = Limiter(key_func=get_remote_address)

router = APIRouter()


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


@router.post("/register", response_model=UserResponse)
@limiter.limit("5/minute")  # Plus strict pour l'inscription
async def register(
    request: Request,
    register_data: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Inscription utilisateur.

    Rate limited à 5 inscriptions par minute par IP
    pour prévenir les créations de comptes en masse.
    """
    logger.info(f"Tentative d'inscription: {register_data.email}")

    # Vérifier si l'email existe déjà
    result = await db.execute(select(User).where(User.email == register_data.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
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

    # Créer le nouvel utilisateur
    new_user = User(
        email=register_data.email,
        username=register_data.username,
        hashed_password=get_password_hash(register_data.password),
        full_name=register_data.full_name
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    logger.info(f"Nouvel utilisateur créé: {new_user.id} ({new_user.email})")

    return new_user


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
