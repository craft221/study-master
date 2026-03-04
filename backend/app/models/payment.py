"""
Modèles de Paiement et Abonnement
=================================

Système de paiement multi-provider supportant:
- Cartes bancaires (Stripe): Visa, Mastercard, Amex
- PayPal
- Mobile Money Afrique (Flutterwave): Orange Money, Wave, MTN MoMo, etc.
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from app.core.database import Base


class PaymentProvider(str, enum.Enum):
    """Fournisseurs de paiement disponibles"""
    STRIPE = "stripe"           # Cartes internationales
    PAYPAL = "paypal"           # PayPal
    FLUTTERWAVE = "flutterwave" # Mobile Money + Cartes Afrique
    PAYDUNYA = "paydunya"       # Mobile Money Afrique de l'Ouest (backup)
    CINETPAY = "cinetpay"       # Mobile Money Afrique (backup)
    FREE = "free"               # Gratuit (pas de paiement)


class PaymentMethod(str, enum.Enum):
    """Méthodes de paiement supportées"""
    # Cartes
    CARD = "card"  # Générique (pour le frontend)
    CARD_VISA = "card_visa"
    CARD_MASTERCARD = "card_mastercard"
    CARD_AMEX = "card_amex"
    CARD_OTHER = "card_other"

    # PayPal
    PAYPAL = "paypal"

    # Mobile Money - Afrique de l'Ouest
    ORANGE_MONEY = "orange_money"
    WAVE = "wave"
    MTN_MOMO = "mtn_momo"
    MOOV_MONEY = "moov_money"
    FREE_MONEY = "free_money"  # Free Sénégal

    # Mobile Money - Afrique Centrale/Est
    AIRTEL_MONEY = "airtel_money"
    MPESA = "mpesa"  # Kenya, Tanzanie

    # Autres
    BANK_TRANSFER = "bank_transfer"
    FREE = "free"


class TransactionStatus(str, enum.Enum):
    """Statuts possibles d'une transaction"""
    PENDING = "pending"           # En attente de confirmation
    PROCESSING = "processing"     # En cours de traitement
    SUCCESS = "success"           # Réussie
    FAILED = "failed"             # Échouée
    CANCELLED = "cancelled"       # Annulée par l'utilisateur
    REFUNDED = "refunded"         # Remboursée
    EXPIRED = "expired"           # Expirée (timeout)


class Currency(str, enum.Enum):
    """Devises supportées"""
    # Internationales
    EUR = "EUR"
    USD = "USD"
    GBP = "GBP"

    # Afrique de l'Ouest (FCFA)
    XOF = "XOF"  # Sénégal, Côte d'Ivoire, Mali, Burkina, Bénin, Togo, Niger

    # Afrique Centrale (FCFA)
    XAF = "XAF"  # Cameroun, Gabon, Congo, Tchad, RCA, Guinée Équatoriale

    # Autres Afrique
    NGN = "NGN"  # Nigeria
    GHS = "GHS"  # Ghana
    KES = "KES"  # Kenya
    ZAR = "ZAR"  # Afrique du Sud
    MAD = "MAD"  # Maroc
    TND = "TND"  # Tunisie
    EGP = "EGP"  # Égypte


class SubscriptionPlan(Base):
    """Plans d'abonnement disponibles"""
    __tablename__ = "subscription_plans"

    id = Column(Integer, primary_key=True, index=True)

    # Identification
    code = Column(String(50), unique=True, nullable=False, index=True)  # free, premium, premium_plus, institutional
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # Tarification (en centimes/unités mineures pour éviter les float)
    price_eur_cents = Column(Integer, default=0)      # Prix en centimes EUR
    price_usd_cents = Column(Integer, default=0)      # Prix en centimes USD
    price_xof = Column(Integer, default=0)            # Prix en FCFA (pas de centimes)
    price_xaf = Column(Integer, default=0)            # Prix en FCFA Afrique Centrale
    price_ngn = Column(Integer, default=0)            # Prix en Naira
    price_mad_cents = Column(Integer, default=0)      # Prix en centimes MAD

    # Durée
    duration_days = Column(Integer, default=30)       # Durée de l'abonnement en jours
    is_recurring = Column(Boolean, default=True)      # Renouvellement automatique

    # Limites et quotas
    ai_requests_per_day = Column(Integer, default=10)
    storage_limit_mb = Column(Integer, default=100)
    max_notes = Column(Integer, default=50)           # -1 = illimité
    max_flashcards = Column(Integer, default=500)     # -1 = illimité
    max_quizzes = Column(Integer, default=20)         # -1 = illimité

    # Fonctionnalités
    features = Column(JSON, default=list)             # Liste des fonctionnalités
    has_ads = Column(Boolean, default=True)           # Affiche des pubs
    has_priority_support = Column(Boolean, default=False)
    has_advanced_analytics = Column(Boolean, default=False)
    has_api_access = Column(Boolean, default=False)
    has_export = Column(Boolean, default=True)
    has_collaboration = Column(Boolean, default=False)

    # Affichage
    is_popular = Column(Boolean, default=False)       # Badge "Populaire"
    is_active = Column(Boolean, default=True)         # Plan disponible à l'achat
    display_order = Column(Integer, default=0)        # Ordre d'affichage
    color = Column(String(20), default="gray")        # Couleur du plan
    icon = Column(String(50), default="gift")         # Icône

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relations
    transactions = relationship("Transaction", back_populates="plan")

    def get_price(self, currency: Currency) -> int:
        """Retourne le prix dans la devise spécifiée"""
        price_map = {
            Currency.EUR: self.price_eur_cents,
            Currency.USD: self.price_usd_cents,
            Currency.XOF: self.price_xof,
            Currency.XAF: self.price_xaf,
            Currency.NGN: self.price_ngn,
            Currency.MAD: self.price_mad_cents,
        }
        return price_map.get(currency, self.price_eur_cents)

    def get_formatted_price(self, currency: Currency) -> str:
        """Retourne le prix formaté pour affichage"""
        price = self.get_price(currency)

        # Devises en centimes
        if currency in [Currency.EUR, Currency.USD, Currency.GBP, Currency.MAD]:
            return f"{price / 100:.2f}"

        # Devises sans centimes (FCFA, etc.)
        return f"{price:,}".replace(",", " ")

    def __repr__(self):
        return f"<SubscriptionPlan {self.code} - {self.name}>"


class Transaction(Base):
    """Historique des transactions de paiement"""
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)

    # Relations
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey("subscription_plans.id", ondelete="SET NULL"), nullable=True)

    # Identifiants externes
    provider = Column(
        Enum(PaymentProvider, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    provider_transaction_id = Column(String(255), nullable=True, index=True)
    provider_payment_intent_id = Column(String(255), nullable=True)  # Stripe PaymentIntent
    provider_checkout_id = Column(String(255), nullable=True)        # ID de session checkout

    # Méthode de paiement
    payment_method = Column(
        Enum(PaymentMethod, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    payment_method_details = Column(JSON, nullable=True)  # Détails (4 derniers chiffres, etc.)

    # Montant
    amount = Column(Integer, nullable=False)  # En unités mineures (centimes, etc.)
    currency = Column(
        Enum(Currency, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=Currency.EUR
    )

    # Pour Mobile Money
    phone_number = Column(String(20), nullable=True)
    country_code = Column(String(5), nullable=True)  # SN, CI, ML, etc.

    # Statut
    status = Column(
        Enum(TransactionStatus, values_callable=lambda x: [e.value for e in x]),
        default=TransactionStatus.PENDING,
        index=True
    )
    status_message = Column(String(500), nullable=True)

    # Webhooks
    webhook_received_at = Column(DateTime(timezone=True), nullable=True)
    webhook_data = Column(JSON, nullable=True)

    # Remboursement
    refunded_at = Column(DateTime(timezone=True), nullable=True)
    refund_amount = Column(Integer, nullable=True)
    refund_reason = Column(String(500), nullable=True)

    # Métadonnées
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    extra_data = Column(JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relations
    user = relationship("User", backref="transactions")
    plan = relationship("SubscriptionPlan", back_populates="transactions")

    def __repr__(self):
        return f"<Transaction {self.id} - {self.status.value} - {self.amount} {self.currency.value}>"

    def mark_success(self, provider_transaction_id: str = None):
        """Marque la transaction comme réussie"""
        from app.core.datetime_utils import utc_now
        self.status = TransactionStatus.SUCCESS
        self.completed_at = utc_now()
        if provider_transaction_id:
            self.provider_transaction_id = provider_transaction_id

    def mark_failed(self, message: str = None):
        """Marque la transaction comme échouée"""
        self.status = TransactionStatus.FAILED
        self.status_message = message


class PaymentWebhookLog(Base):
    """Log des webhooks reçus (pour debug et audit)"""
    __tablename__ = "payment_webhook_logs"

    id = Column(Integer, primary_key=True, index=True)

    provider = Column(
        Enum(PaymentProvider, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    event_type = Column(String(100), nullable=True)
    event_id = Column(String(255), nullable=True, index=True)

    # Contenu
    headers = Column(JSON, nullable=True)
    payload = Column(JSON, nullable=True)
    raw_body = Column(Text, nullable=True)

    # Traitement
    processed = Column(Boolean, default=False)
    processing_error = Column(Text, nullable=True)

    # Transaction liée
    transaction_id = Column(Integer, ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True)

    # Timestamps
    received_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<WebhookLog {self.provider.value} - {self.event_type}>"


class PromoCode(Base):
    """Codes promotionnels"""
    __tablename__ = "promo_codes"

    id = Column(Integer, primary_key=True, index=True)

    code = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)

    # Type de réduction
    discount_type = Column(String(20), default="percentage")  # percentage, fixed_amount
    discount_value = Column(Integer, nullable=False)  # Pourcentage ou montant en centimes

    # Restrictions
    applicable_plans = Column(JSON, nullable=True)  # Liste des plans concernés, null = tous
    min_amount = Column(Integer, nullable=True)     # Montant minimum d'achat
    max_uses = Column(Integer, nullable=True)       # Nombre max d'utilisations total
    max_uses_per_user = Column(Integer, default=1)  # Nombre max par utilisateur

    # Validité
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)

    # Stats
    times_used = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def is_valid(self) -> bool:
        """Vérifie si le code promo est valide"""
        from app.core.datetime_utils import utc_now
        now = utc_now()

        if not self.is_active:
            return False
        if self.max_uses and self.times_used >= self.max_uses:
            return False
        if self.valid_from and now < self.valid_from:
            return False
        if self.valid_until and now > self.valid_until:
            return False

        return True

    def calculate_discount(self, amount: int) -> int:
        """Calcule le montant de la réduction"""
        if self.discount_type == "percentage":
            return int(amount * self.discount_value / 100)
        else:
            return min(self.discount_value, amount)

    def __repr__(self):
        return f"<PromoCode {self.code}>"


# ==================== DONNÉES INITIALES DES PLANS ====================
# Option 3: Prix optimisés avec 55% de marge (cache 70% hit rate)
# Devise principale: USD

INITIAL_PLANS = [
    {
        "code": "free",
        "name": "Gratuit",
        "description": "Parfait pour découvrir Studera",
        "price_eur_cents": 0,
        "price_usd_cents": 0,
        "price_xof": 0,
        "price_xaf": 0,
        "price_ngn": 0,
        "price_mad_cents": 0,
        "duration_days": 36500,  # ~100 ans = permanent
        "is_recurring": False,
        "ai_requests_per_day": 20,  # 20 requêtes/jour (test)
        "storage_limit_mb": 100,
        "max_notes": -1,           # Illimité (pas de coût)
        "max_flashcards": -1,      # Illimité (pas de coût)
        "max_quizzes": -1,         # Illimité (pas de coût)
        "features": [
            "5 requêtes IA par jour",
            "Notes illimitées",
            "Flashcards illimitées",
            "Quiz illimités",
            "100 MB de stockage",
            "Algorithme FSRS",
            "Mode hors-ligne"
        ],
        "has_ads": True,
        "has_priority_support": False,
        "has_advanced_analytics": False,
        "has_api_access": False,
        "has_export": True,
        "has_collaboration": False,
        "is_popular": False,
        "display_order": 1,
        "color": "gray",
        "icon": "gift"
    },
    {
        "code": "premium",
        "name": "Premium",
        "description": "Pour les étudiants sérieux",
        "price_eur_cents": 549,       # 5.49€
        "price_usd_cents": 599,       # $5.99
        "price_xof": 3500,            # 3500 FCFA
        "price_xaf": 3500,            # 3500 FCFA
        "price_ngn": 4500,            # 4500 NGN
        "price_mad_cents": 6000,      # 60 MAD
        "duration_days": 30,
        "is_recurring": True,
        "ai_requests_per_day": 30,    # 30 requêtes/jour (optimisé pour 55% marge)
        "storage_limit_mb": 1000,     # 1 GB
        "max_notes": -1,              # Illimité
        "max_flashcards": -1,
        "max_quizzes": -1,
        "features": [
            "30 requêtes IA par jour",
            "Notes illimitées",
            "Flashcards illimitées",
            "Quiz illimités",
            "1 GB de stockage",
            "Pas de publicités",
            "Support prioritaire",
            "Export PDF/Word",
            "Groupes d'étude"
        ],
        "has_ads": False,
        "has_priority_support": True,
        "has_advanced_analytics": False,
        "has_api_access": False,
        "has_export": True,
        "has_collaboration": True,
        "is_popular": True,
        "display_order": 2,
        "color": "blue",
        "icon": "star"
    },
    {
        "code": "premium_plus",
        "name": "Premium+",
        "description": "Pour les power users",
        "price_eur_cents": 1099,      # 10.99€
        "price_usd_cents": 1199,      # $11.99
        "price_xof": 7000,            # 7000 FCFA
        "price_xaf": 7000,            # 7000 FCFA
        "price_ngn": 9000,            # 9000 NGN
        "price_mad_cents": 12000,     # 120 MAD
        "duration_days": 30,
        "is_recurring": True,
        "ai_requests_per_day": 60,    # 60 requêtes/jour (optimisé pour 55% marge)
        "storage_limit_mb": 5000,     # 5 GB
        "max_notes": -1,
        "max_flashcards": -1,
        "max_quizzes": -1,
        "features": [
            "60 requêtes IA par jour",
            "Tout illimité",
            "5 GB de stockage",
            "Pas de publicités",
            "Support VIP 24/7",
            "Analytics avancés",
            "Accès anticipé nouvelles fonctionnalités",
            "Thèmes exclusifs",
            "Badge Premium+"
        ],
        "has_ads": False,
        "has_priority_support": True,
        "has_advanced_analytics": True,
        "has_api_access": False,
        "has_export": True,
        "has_collaboration": True,
        "is_popular": False,
        "display_order": 3,
        "color": "purple",
        "icon": "crown"
    },
    {
        "code": "institutional",
        "name": "Institutionnel",
        "description": "Pour les établissements scolaires",
        "price_eur_cents": 3699,      # 36.99€
        "price_usd_cents": 3999,      # $39.99
        "price_xof": 24000,           # 24000 FCFA
        "price_xaf": 24000,           # 24000 FCFA
        "price_ngn": 30000,           # 30000 NGN
        "price_mad_cents": 40000,     # 400 MAD
        "duration_days": 30,
        "is_recurring": True,
        "ai_requests_per_day": 200,   # 200 requêtes/jour (optimisé pour 55% marge)
        "storage_limit_mb": 50000,    # 50 GB
        "max_notes": -1,
        "max_flashcards": -1,
        "max_quizzes": -1,
        "features": [
            "200 requêtes IA par jour",
            "Tout illimité",
            "50 GB de stockage",
            "Gestion multi-utilisateurs",
            "Dashboard administrateur",
            "API dédiée",
            "Support dédié",
            "Formation incluse",
            "Facturation entreprise"
        ],
        "has_ads": False,
        "has_priority_support": True,
        "has_advanced_analytics": True,
        "has_api_access": True,
        "has_export": True,
        "has_collaboration": True,
        "is_popular": False,
        "display_order": 4,
        "color": "green",
        "icon": "building"
    },
    {
        "code": "premium_yearly",
        "name": "Premium Annuel",
        "description": "Premium avec 2 mois offerts",
        "price_eur_cents": 5490,      # 54.90€ (au lieu de 65.88€ = 10 mois)
        "price_usd_cents": 5990,      # $59.90 (au lieu de 71.88€ = 10 mois)
        "price_xof": 35000,           # 35000 FCFA (au lieu de 42000)
        "price_xaf": 35000,
        "price_ngn": 45000,
        "price_mad_cents": 60000,
        "duration_days": 365,
        "is_recurring": True,
        "ai_requests_per_day": 30,    # Même que Premium mensuel
        "storage_limit_mb": 1000,
        "max_notes": -1,
        "max_flashcards": -1,
        "max_quizzes": -1,
        "features": [
            "Tout Premium inclus",
            "2 mois OFFERTS",
            "Économisez 17%"
        ],
        "has_ads": False,
        "has_priority_support": True,
        "has_advanced_analytics": False,
        "has_api_access": False,
        "has_export": True,
        "has_collaboration": True,
        "is_popular": False,
        "display_order": 5,
        "color": "blue",
        "icon": "calendar"
    }
]
