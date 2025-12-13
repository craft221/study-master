"""
Schémas Pydantic pour le système de paiement
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ==================== ENUMS ====================

class PaymentMethodEnum(str, Enum):
    """Méthodes de paiement disponibles"""
    # Cartes
    CARD_VISA = "card_visa"
    CARD_MASTERCARD = "card_mastercard"
    CARD_AMEX = "card_amex"
    CARD = "card"  # Générique

    # PayPal
    PAYPAL = "paypal"

    # Mobile Money
    ORANGE_MONEY = "orange_money"
    WAVE = "wave"
    MTN_MOMO = "mtn_momo"
    MOOV_MONEY = "moov_money"
    MPESA = "mpesa"
    AIRTEL_MONEY = "airtel_money"

    # Autres
    BANK_TRANSFER = "bank_transfer"


class CurrencyEnum(str, Enum):
    """Devises supportées"""
    EUR = "EUR"
    USD = "USD"
    GBP = "GBP"
    XOF = "XOF"  # FCFA Afrique de l'Ouest
    XAF = "XAF"  # FCFA Afrique Centrale
    NGN = "NGN"  # Naira
    GHS = "GHS"  # Cedi
    KES = "KES"  # Shilling kenyan
    ZAR = "ZAR"  # Rand
    MAD = "MAD"  # Dirham


class TransactionStatusEnum(str, Enum):
    """Statuts de transaction"""
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


# ==================== PLANS ====================

class PlanFeature(BaseModel):
    """Fonctionnalité d'un plan"""
    name: str
    included: bool = True
    limit: Optional[int] = None


class SubscriptionPlanBase(BaseModel):
    """Base d'un plan d'abonnement"""
    code: str
    name: str
    description: Optional[str] = None


class SubscriptionPlanResponse(SubscriptionPlanBase):
    """Plan d'abonnement (réponse API)"""
    id: int

    # Prix par devise
    price_eur: float  # En euros (pas centimes)
    price_usd: float
    price_xof: int  # FCFA (pas de centimes)
    price_xaf: int
    price_ngn: int
    price_mad: float

    # Durée
    duration_days: int
    is_recurring: bool

    # Quotas
    ai_requests_per_day: int
    storage_limit_mb: int
    max_notes: int
    max_flashcards: int
    max_quizzes: int

    # Fonctionnalités
    features: List[str]
    has_ads: bool
    has_priority_support: bool
    has_advanced_analytics: bool
    has_api_access: bool
    has_export: bool
    has_collaboration: bool

    # Affichage
    is_popular: bool
    color: str
    icon: str

    class Config:
        from_attributes = True

    @classmethod
    def from_db(cls, plan) -> "SubscriptionPlanResponse":
        """Convertit un plan DB en réponse API"""
        return cls(
            id=plan.id,
            code=plan.code,
            name=plan.name,
            description=plan.description,
            # Convertir centimes en unités pour EUR/USD/MAD
            price_eur=plan.price_eur_cents / 100,
            price_usd=plan.price_usd_cents / 100,
            price_xof=plan.price_xof,
            price_xaf=plan.price_xaf,
            price_ngn=plan.price_ngn,
            price_mad=plan.price_mad_cents / 100,
            duration_days=plan.duration_days,
            is_recurring=plan.is_recurring,
            ai_requests_per_day=plan.ai_requests_per_day,
            storage_limit_mb=plan.storage_limit_mb,
            max_notes=plan.max_notes,
            max_flashcards=plan.max_flashcards,
            max_quizzes=plan.max_quizzes,
            features=plan.features or [],
            has_ads=plan.has_ads,
            has_priority_support=plan.has_priority_support,
            has_advanced_analytics=plan.has_advanced_analytics,
            has_api_access=plan.has_api_access,
            has_export=plan.has_export,
            has_collaboration=plan.has_collaboration,
            is_popular=plan.is_popular,
            color=plan.color,
            icon=plan.icon
        )


class PlanListResponse(BaseModel):
    """Liste des plans disponibles"""
    plans: List[SubscriptionPlanResponse]
    recommended_plan: str = "premium"


# ==================== MÉTHODES DE PAIEMENT ====================

class PaymentMethodInfo(BaseModel):
    """Information sur une méthode de paiement"""
    id: str
    name: str
    description: str
    icon: str
    provider: str
    methods: List[str]
    requires_phone: bool = False


class AvailableMethodsResponse(BaseModel):
    """Méthodes de paiement disponibles"""
    cards: List[PaymentMethodInfo]
    mobile_money: List[PaymentMethodInfo]
    other: List[PaymentMethodInfo]
    recommended_currency: str
    country_code: Optional[str] = None


# ==================== CRÉATION DE PAIEMENT ====================

class CreatePaymentRequest(BaseModel):
    """Requête de création de paiement"""
    plan_code: str = Field(..., description="Code du plan (free, premium, premium_plus, institutional)")
    payment_method: PaymentMethodEnum = Field(..., description="Méthode de paiement")
    currency: Optional[CurrencyEnum] = Field(None, description="Devise (auto-détectée si non fournie)")
    country_code: Optional[str] = Field(None, description="Code pays ISO 2 lettres (ex: SN, FR)")
    phone_number: Optional[str] = Field(None, description="Numéro de téléphone (pour Mobile Money)")
    promo_code: Optional[str] = Field(None, description="Code promotionnel")
    success_url: Optional[str] = Field(None, description="URL de redirection après succès")
    cancel_url: Optional[str] = Field(None, description="URL de redirection après annulation")

    @validator('phone_number')
    def validate_phone(cls, v, values):
        if v and values.get('payment_method') in [
            PaymentMethodEnum.ORANGE_MONEY,
            PaymentMethodEnum.WAVE,
            PaymentMethodEnum.MTN_MOMO,
            PaymentMethodEnum.MPESA,
            PaymentMethodEnum.AIRTEL_MONEY
        ]:
            # Vérifier le format (basique)
            if not v.startswith('+'):
                raise ValueError("Le numéro doit commencer par + (format international)")
        return v

    @validator('country_code')
    def validate_country(cls, v):
        if v:
            return v.upper()
        return v


class CreatePaymentResponse(BaseModel):
    """Réponse de création de paiement"""
    transaction_id: int
    provider: str
    payment_url: Optional[str] = None
    checkout_id: Optional[str] = None
    client_secret: Optional[str] = None  # Pour Stripe Elements
    amount: int
    amount_formatted: str
    currency: str
    plan: str
    requires_redirect: bool
    test_mode: bool = False
    message: Optional[str] = None


# ==================== TRANSACTIONS ====================

class TransactionBase(BaseModel):
    """Base d'une transaction"""
    amount: int
    currency: CurrencyEnum
    status: TransactionStatusEnum


class TransactionResponse(TransactionBase):
    """Transaction (réponse API)"""
    id: int
    payment_method: PaymentMethodEnum
    provider: str
    created_at: datetime
    completed_at: Optional[datetime] = None

    # Plan
    plan_code: Optional[str] = None
    plan_name: Optional[str] = None

    # Détails
    amount_formatted: str
    status_message: Optional[str] = None

    class Config:
        from_attributes = True


class TransactionListResponse(BaseModel):
    """Liste des transactions"""
    transactions: List[TransactionResponse]
    total: int
    page: int
    per_page: int


class TransactionStatusResponse(BaseModel):
    """Statut d'une transaction"""
    id: int
    status: TransactionStatusEnum
    amount: int
    amount_formatted: str
    currency: str
    payment_method: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    message: Optional[str] = None


# ==================== CODES PROMO ====================

class ValidatePromoRequest(BaseModel):
    """Requête de validation de code promo"""
    code: str
    plan_code: str
    currency: CurrencyEnum = CurrencyEnum.EUR


class PromoCodeResponse(BaseModel):
    """Réponse de validation de code promo"""
    valid: bool
    code: str
    discount_type: Optional[str] = None  # percentage, fixed_amount
    discount_value: Optional[int] = None
    discount_amount: Optional[int] = None  # Montant de réduction calculé
    message: Optional[str] = None
    expires_at: Optional[datetime] = None


# ==================== WEBHOOKS ====================

class WebhookResponse(BaseModel):
    """Réponse aux webhooks"""
    status: str
    message: Optional[str] = None
    transaction_id: Optional[int] = None


# ==================== CALLBACK / CONFIRMATION ====================

class PaymentCallbackRequest(BaseModel):
    """Requête de callback après paiement"""
    transaction_id: Optional[int] = None
    checkout_id: Optional[str] = None
    order_id: Optional[str] = None  # PayPal
    tx_ref: Optional[str] = None  # Flutterwave
    status: Optional[str] = None


class PaymentSuccessResponse(BaseModel):
    """Réponse après paiement réussi"""
    success: bool
    message: str
    transaction_id: int
    subscription_activated: bool
    subscription_type: str
    subscription_ends_at: Optional[datetime] = None
    plan: str


# ==================== ABONNEMENT UTILISATEUR ====================

class UserSubscriptionResponse(BaseModel):
    """Abonnement actuel de l'utilisateur"""
    subscription_type: str
    plan_name: str
    is_active: bool
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    days_remaining: Optional[int] = None
    auto_renew: bool = False

    # Quotas
    ai_requests_limit: int
    ai_requests_used_today: int
    ai_requests_remaining: int
    storage_limit_mb: int
    storage_used_mb: int

    # Fonctionnalités
    features: List[str]
    can_upgrade: bool


# ==================== SIMULATION (MODE TEST) ====================

class SimulatePaymentRequest(BaseModel):
    """Requête de simulation de paiement (mode test)"""
    checkout_id: str
    action: str = Field(..., description="'approve' ou 'decline'")


class SimulatePaymentResponse(BaseModel):
    """Réponse de simulation"""
    success: bool
    message: str
    redirect_url: Optional[str] = None
