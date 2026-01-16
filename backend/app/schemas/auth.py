"""
Schémas d'authentification
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

# Re-export from user schemas for compatibility
from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    """Requête de connexion"""
    email: EmailStr
    password: str
    mfa_code: Optional[str] = Field(None, min_length=6, max_length=20, description="Code MFA (TOTP ou backup code)")


class RegisterRequest(BaseModel):
    """Requête d'inscription"""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = Field(None, max_length=100)
    university: Optional[str] = Field(None, max_length=200)
    major: Optional[str] = Field(None, max_length=100)
    promotion: Optional[str] = Field(None, max_length=50)


class LoginResponse(BaseModel):
    """Réponse de connexion avec token et info utilisateur"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
    mfa_required: bool = False  # True si le compte a MFA mais pas de code fourni

    class Config:
        from_attributes = True


class MFARequiredResponse(BaseModel):
    """Réponse quand MFA est requis mais pas fourni"""
    mfa_required: bool = True
    message: str = "MFA code required"
    temp_token: str  # Token temporaire pour soumettre le code MFA


class RefreshTokenRequest(BaseModel):
    """Requête de rafraîchissement de token"""
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    """Réponse de rafraîchissement de token"""
    access_token: str
    token_type: str = "bearer"


class VerifyEmailRequest(BaseModel):
    """Requête de vérification d'email"""
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, description="Code de vérification à 6 chiffres")


class ResendVerificationRequest(BaseModel):
    """Requête de renvoi du code de vérification"""
    email: EmailStr


class RegisterResponse(BaseModel):
    """Réponse d'inscription (avant vérification)"""
    message: str
    email: str
    requires_verification: bool = True
