"""
Schémas Pydantic pour la mascotte Spark ⚡🐿️
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class MascotMessageRequest(BaseModel):
    """Requête pour obtenir un message de Spark"""
    event: str = Field(..., description="Type d'événement (welcome, quiz_success, etc.)")
    use_ai: bool = Field(default=False, description="Utiliser l'IA pour générer le message")
    context: Optional[dict] = Field(default={}, description="Contexte additionnel")


class MascotMessageResponse(BaseModel):
    """Réponse avec message de Spark"""
    message: str
    mood: str  # happy, excited, sad, thinking, encouraging
    animation: str  # idle, wave, celebration, jump, sleep, etc.
    timestamp: str


class MascotStateResponse(BaseModel):
    """État complet de la mascotte"""
    name: str
    level: int
    level_name: str  # "Spark Bébé", "Spark Junior", etc.
    unlocked_accessories: List[str]
    current_accessory: Optional[str]
    total_accessories: int
    user_xp: int
    user_streak: int


class MascotAccessoryInfo(BaseModel):
    """Information sur un accessoire"""
    id: str
    name: str
    description: str
    emoji: str
    requirement: str
    is_unlocked: bool


class MascotAccessoriesResponse(BaseModel):
    """Liste de tous les accessoires"""
    accessories: List[MascotAccessoryInfo]
    unlocked_count: int
    total_count: int


class UpdateMascotRequest(BaseModel):
    """Requête pour mettre à jour la mascotte"""
    name: Optional[str] = Field(None, min_length=1, max_length=50, description="Nouveau nom")
    current_accessory: Optional[str] = Field(None, description="Accessoire à équiper")


class MascotHintRequest(BaseModel):
    """Requête pour obtenir un indice"""
    topic: str = Field(..., min_length=2, description="Sujet de la question")
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")


class MascotHintResponse(BaseModel):
    """Réponse avec indice de Spark"""
    hint: str
    mood: str
    animation: str


class MascotAskRequest(BaseModel):
    """Requête pour poser une question directe à Spark"""
    question: str = Field(..., min_length=3, max_length=500, description="Question de l'utilisateur")
    context: Optional[dict] = Field(default={}, description="Contexte additionnel (page actuelle, sujet en cours, etc.)")


class MascotAskResponse(BaseModel):
    """Réponse de Spark à une question"""
    answer: str
    mood: str
    animation: str
    suggestions: Optional[List[str]] = Field(default=[], description="Suggestions d'actions ou de ressources")
    timestamp: str
