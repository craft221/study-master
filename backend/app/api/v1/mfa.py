"""
API endpoints pour la gestion MFA (Multi-Factor Authentication)
==============================================================

Ces endpoints permettent aux utilisateurs de:
- Activer le MFA sur leur compte
- Vérifier le setup MFA
- Désactiver le MFA
- Régénérer les codes de backup
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.services.mfa_service import mfa_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================
# SCHEMAS
# ============================================

class MFASetupResponse(BaseModel):
    """Réponse du setup MFA"""
    secret: str
    qr_code: str  # Base64 data URL
    backup_codes: List[str]
    message: str


class MFAVerifyRequest(BaseModel):
    """Requête de vérification MFA"""
    code: str = Field(..., min_length=6, max_length=20, description="Code TOTP ou backup code")


class MFAStatusResponse(BaseModel):
    """Statut MFA de l'utilisateur"""
    mfa_enabled: bool
    mfa_verified_at: Optional[str] = None
    backup_codes_remaining: int = 0


class MFADisableRequest(BaseModel):
    """Requête pour désactiver le MFA"""
    code: str = Field(..., min_length=6, max_length=6, description="Code TOTP pour confirmer")


class MFABackupCodesResponse(BaseModel):
    """Réponse avec les nouveaux codes de backup"""
    backup_codes: List[str]
    message: str


# ============================================
# ENDPOINTS
# ============================================

@router.get("/status", response_model=MFAStatusResponse)
async def get_mfa_status(
    current_user: User = Depends(get_current_active_user)
):
    """
    Récupère le statut MFA de l'utilisateur connecté.
    """
    return MFAStatusResponse(
        mfa_enabled=current_user.mfa_enabled or False,
        mfa_verified_at=current_user.mfa_verified_at.isoformat() if current_user.mfa_verified_at else None,
        backup_codes_remaining=len(current_user.mfa_backup_codes or [])
    )


@router.post("/setup", response_model=MFASetupResponse)
async def setup_mfa(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Initialise le MFA pour l'utilisateur.

    Retourne:
    - Un secret à sauvegarder (backup manuel)
    - Un QR code à scanner avec une app authenticator
    - Des codes de backup à conserver en lieu sûr

    IMPORTANT: Les codes de backup ne seront affichés qu'une seule fois!
    """
    if current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is already enabled on this account"
        )

    result = await mfa_service.setup_mfa(current_user)
    await db.commit()

    logger.info(f"MFA setup initiated for user {current_user.id}")

    return MFASetupResponse(**result)


@router.post("/verify-setup")
async def verify_mfa_setup(
    request: MFAVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Vérifie le setup MFA en validant un code TOTP.

    Cette étape est obligatoire après /setup pour activer définitivement le MFA.
    Entrez le code à 6 chiffres affiché dans votre app authenticator.
    """
    if current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is already enabled"
        )

    if not current_user.mfa_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please call /setup first to initialize MFA"
        )

    success = await mfa_service.verify_setup(current_user, request.code)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid code. Make sure your authenticator app is synced correctly."
        )

    await db.commit()

    logger.info(f"MFA activated for user {current_user.id}")

    return {
        "success": True,
        "message": "MFA has been successfully enabled on your account"
    }


@router.post("/disable")
async def disable_mfa(
    request: MFADisableRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Désactive le MFA sur le compte.

    Requiert un code TOTP valide pour confirmer l'action.
    """
    if not current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled on this account"
        )

    success = await mfa_service.disable_mfa(current_user, request.code)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid code. Cannot disable MFA."
        )

    await db.commit()

    logger.info(f"MFA disabled for user {current_user.id}")

    return {
        "success": True,
        "message": "MFA has been disabled on your account"
    }


@router.post("/regenerate-backup-codes", response_model=MFABackupCodesResponse)
async def regenerate_backup_codes(
    request: MFAVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Régénère les codes de backup.

    Tous les anciens codes seront invalidés.
    Requiert un code TOTP valide pour confirmer.

    IMPORTANT: Les nouveaux codes ne seront affichés qu'une seule fois!
    """
    if not current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled on this account"
        )

    new_codes = await mfa_service.regenerate_backup_codes(current_user, request.code)

    if new_codes is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid code. Cannot regenerate backup codes."
        )

    await db.commit()

    logger.info(f"Backup codes regenerated for user {current_user.id}")

    return MFABackupCodesResponse(
        backup_codes=new_codes,
        message="New backup codes generated. Save them securely - they won't be shown again!"
    )
