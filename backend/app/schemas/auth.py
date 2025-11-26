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


class RegisterRequest(BaseModel):
    """Requête d'inscription"""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = Field(None, max_length=100)


class LoginResponse(BaseModel):
    """Réponse de connexion avec token et info utilisateur"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

    class Config:
        from_attributes = True


class RefreshTokenRequest(BaseModel):
    """Requête de rafraîchissement de token"""
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    """Réponse de rafraîchissement de token"""
    access_token: str
    token_type: str = "bearer"
