"""
Service de Paiement Unifié
==========================

Gère tous les paiements via une interface unifiée, quel que soit le provider:
- PayDunya (Mobile Money + Cartes Afrique de l'Ouest)
- PayPal (International)
- Stripe (Cartes internationales - préparé pour plus tard)

Ce service agit comme une façade devant les différents providers.
"""

import logging
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from enum import Enum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.config import settings
from app.core.datetime_utils import utc_now
from app.models.payment import (
    Transaction, TransactionStatus, PaymentProvider, PaymentMethod,
    SubscriptionPlan, Currency, PromoCode, INITIAL_PLANS
)
from app.models.user import User, UserSubscription, SubscriptionType

logger = logging.getLogger(__name__)


# ==================== CONFIGURATION DES PROVIDERS ====================

PROVIDER_CONFIG = {
    PaymentProvider.PAYDUNYA: {
        "name": "PayDunya",
        "methods": [
            PaymentMethod.ORANGE_MONEY,
            PaymentMethod.WAVE,
            PaymentMethod.FREE_MONEY,
            PaymentMethod.MTN_MOMO,
            PaymentMethod.MOOV_MONEY,
            PaymentMethod.CARD,
            PaymentMethod.CARD_VISA,
            PaymentMethod.CARD_MASTERCARD,
        ],
        "currencies": [Currency.XOF, Currency.XAF],
        "regions": ["west_africa"],
        "countries": ["SN", "CI", "ML", "BF", "BJ", "TG", "NE", "GW"],
        "enabled": True
    },
    PaymentProvider.PAYPAL: {
        "name": "PayPal",
        "methods": [PaymentMethod.PAYPAL],
        "currencies": [Currency.EUR, Currency.USD, Currency.GBP],
        "regions": ["europe", "north_america", "international"],
        "enabled": True
    },
    PaymentProvider.STRIPE: {
        "name": "Stripe",
        "methods": [
            PaymentMethod.CARD_VISA,
            PaymentMethod.CARD_MASTERCARD,
            PaymentMethod.CARD_AMEX,
            PaymentMethod.CARD_OTHER
        ],
        "currencies": [Currency.EUR, Currency.USD, Currency.GBP],
        "regions": ["europe", "north_america", "international"],
        "enabled": False  # Désactivé - Stripe non disponible au Sénégal
    },
}

# Mapping pays -> devise par défaut
COUNTRY_CURRENCY_MAP = {
    # Europe
    "FR": Currency.EUR, "DE": Currency.EUR, "ES": Currency.EUR, "IT": Currency.EUR,
    "BE": Currency.EUR, "NL": Currency.EUR, "PT": Currency.EUR, "AT": Currency.EUR,

    # UK
    "GB": Currency.GBP,

    # Amérique du Nord
    "US": Currency.USD, "CA": Currency.USD,

    # Afrique de l'Ouest (FCFA)
    "SN": Currency.XOF, "CI": Currency.XOF, "ML": Currency.XOF, "BF": Currency.XOF,
    "BJ": Currency.XOF, "TG": Currency.XOF, "NE": Currency.XOF, "GW": Currency.XOF,

    # Afrique Centrale (FCFA)
    "CM": Currency.XAF, "GA": Currency.XAF, "CG": Currency.XAF, "TD": Currency.XAF,
    "CF": Currency.XAF, "GQ": Currency.XAF,

    # Autres Afrique
    "NG": Currency.NGN,
    "GH": Currency.GHS,
    "KE": Currency.KES,
    "ZA": Currency.ZAR,
    "MA": Currency.MAD,
    "TN": Currency.TND,
    "EG": Currency.EGP,
}

# Mapping méthode de paiement -> provider préféré
METHOD_PROVIDER_MAP = {
    # Cartes - PayDunya pour l'Afrique de l'Ouest
    PaymentMethod.CARD: PaymentProvider.PAYDUNYA,
    PaymentMethod.CARD_VISA: PaymentProvider.PAYDUNYA,
    PaymentMethod.CARD_MASTERCARD: PaymentProvider.PAYDUNYA,
    PaymentMethod.CARD_AMEX: PaymentProvider.PAYPAL,  # Via PayPal si Amex
    PaymentMethod.CARD_OTHER: PaymentProvider.PAYDUNYA,

    # PayPal
    PaymentMethod.PAYPAL: PaymentProvider.PAYPAL,

    # Mobile Money - PayDunya (Afrique de l'Ouest)
    PaymentMethod.ORANGE_MONEY: PaymentProvider.PAYDUNYA,
    PaymentMethod.WAVE: PaymentProvider.PAYDUNYA,
    PaymentMethod.FREE_MONEY: PaymentProvider.PAYDUNYA,
    PaymentMethod.MTN_MOMO: PaymentProvider.PAYDUNYA,
    PaymentMethod.MOOV_MONEY: PaymentProvider.PAYDUNYA,

    # Mobile Money - Non supporté actuellement (nécessiterait un autre provider)
    PaymentMethod.MPESA: PaymentProvider.PAYPAL,  # Fallback PayPal
    PaymentMethod.AIRTEL_MONEY: PaymentProvider.PAYPAL,  # Fallback PayPal

    # Autres
    PaymentMethod.BANK_TRANSFER: PaymentProvider.PAYDUNYA,
}


class PaymentService:
    """Service principal de gestion des paiements"""

    def __init__(self):
        self._stripe_service = None
        self._paypal_service = None
        self._paydunya_service = None

    @property
    def stripe(self):
        """Lazy loading du service Stripe"""
        if self._stripe_service is None:
            from app.services.stripe_service import StripeService
            self._stripe_service = StripeService()
        return self._stripe_service

    @property
    def paypal(self):
        """Lazy loading du service PayPal"""
        if self._paypal_service is None:
            from app.services.paypal_service import PayPalService
            self._paypal_service = PayPalService()
        return self._paypal_service

    @property
    def paydunya(self):
        """Lazy loading du service PayDunya"""
        if self._paydunya_service is None:
            from app.services.paydunya_service import PayDunyaService
            self._paydunya_service = PayDunyaService()
        return self._paydunya_service

    # ==================== MÉTHODES PUBLIQUES ====================

    async def get_available_methods(
        self,
        country_code: str = None,
        currency: Currency = None
    ) -> Dict[str, Any]:
        """
        Retourne les méthodes de paiement disponibles pour un pays/devise.

        Args:
            country_code: Code pays ISO (ex: "SN", "FR")
            currency: Devise préférée

        Returns:
            Dict avec les méthodes groupées par catégorie
        """
        # Déterminer la devise
        if currency is None and country_code:
            currency = COUNTRY_CURRENCY_MAP.get(country_code.upper(), Currency.EUR)

        # Déterminer la région
        region = self._get_region(country_code)

        methods = {
            "cards": [],
            "mobile_money": [],
            "other": [],
            "recommended_currency": currency.value if currency else "EUR",
            "country_code": country_code
        }

        # Cartes (Stripe)
        if PROVIDER_CONFIG[PaymentProvider.STRIPE]["enabled"]:
            methods["cards"] = [
                {
                    "id": "card",
                    "name": "Carte bancaire",
                    "description": "Visa, Mastercard, Amex",
                    "icon": "credit-card",
                    "provider": "stripe",
                    "methods": ["card_visa", "card_mastercard", "card_amex"]
                }
            ]

        # PayPal
        if PROVIDER_CONFIG[PaymentProvider.PAYPAL]["enabled"]:
            methods["other"].append({
                "id": "paypal",
                "name": "PayPal",
                "description": "Paiement sécurisé via PayPal",
                "icon": "paypal",
                "provider": "paypal",
                "methods": ["paypal"]
            })

        # Mobile Money (Afrique de l'Ouest via PayDunya)
        if region == "africa" and PROVIDER_CONFIG[PaymentProvider.PAYDUNYA]["enabled"]:
            mobile_methods = []

            # Orange Money - Sénégal, Côte d'Ivoire, Mali, Burkina, etc.
            if country_code in ["SN", "CI", "ML", "BF", "NE", "GW"]:
                mobile_methods.append({
                    "id": "orange_money",
                    "name": "Orange Money",
                    "description": "Paiement via Orange Money",
                    "icon": "smartphone",
                    "provider": "paydunya",
                    "methods": ["orange_money"],
                    "requires_phone": True
                })

            # Wave - Sénégal, Côte d'Ivoire, Mali, Burkina
            if country_code in ["SN", "CI", "ML", "BF"]:
                mobile_methods.append({
                    "id": "wave",
                    "name": "Wave",
                    "description": "Paiement via Wave",
                    "icon": "smartphone",
                    "provider": "paydunya",
                    "methods": ["wave"],
                    "requires_phone": True
                })

            # Free Money - Sénégal uniquement
            if country_code == "SN":
                mobile_methods.append({
                    "id": "free_money",
                    "name": "Free Money",
                    "description": "Paiement via Free Money",
                    "icon": "smartphone",
                    "provider": "paydunya",
                    "methods": ["free_money"],
                    "requires_phone": True
                })

            # MTN Mobile Money - Côte d'Ivoire, Bénin
            if country_code in ["CI", "BJ"]:
                mobile_methods.append({
                    "id": "mtn_momo",
                    "name": "MTN Mobile Money",
                    "description": "Paiement via MTN MoMo",
                    "icon": "smartphone",
                    "provider": "paydunya",
                    "methods": ["mtn_momo"],
                    "requires_phone": True
                })

            # Moov Money - Côte d'Ivoire, Bénin, Togo, Burkina
            if country_code in ["CI", "BJ", "TG", "BF", "NE"]:
                mobile_methods.append({
                    "id": "moov_money",
                    "name": "Moov Money",
                    "description": "Paiement via Moov Money",
                    "icon": "smartphone",
                    "provider": "paydunya",
                    "methods": ["moov_money"],
                    "requires_phone": True
                })

            methods["mobile_money"] = mobile_methods

        return methods

    async def create_payment(
        self,
        db: AsyncSession,
        user: User,
        plan_code: str,
        payment_method: PaymentMethod,
        currency: Currency = None,
        phone_number: str = None,
        country_code: str = None,
        promo_code: str = None,
        success_url: str = None,
        cancel_url: str = None,
        metadata: Dict = None
    ) -> Dict[str, Any]:
        """
        Crée une nouvelle transaction de paiement.

        Args:
            db: Session de base de données
            user: Utilisateur effectuant le paiement
            plan_code: Code du plan (premium, premium_plus, etc.)
            payment_method: Méthode de paiement choisie
            currency: Devise (auto-détectée si non fournie)
            phone_number: Numéro de téléphone (pour Mobile Money)
            country_code: Code pays
            promo_code: Code promo optionnel
            success_url: URL de redirection après succès
            cancel_url: URL de redirection après annulation
            metadata: Données additionnelles

        Returns:
            Dict avec les informations pour finaliser le paiement
        """
        # Récupérer le plan
        plan = await self._get_plan(db, plan_code)
        if not plan:
            raise ValueError(f"Plan '{plan_code}' non trouvé")

        # Plan gratuit = pas de paiement
        if plan.code == "free":
            return await self._activate_free_plan(db, user, plan)

        # Déterminer la devise
        if currency is None:
            currency = COUNTRY_CURRENCY_MAP.get(country_code, Currency.EUR) if country_code else Currency.EUR

        # Calculer le montant
        amount = plan.get_price(currency)

        # Appliquer le code promo
        discount = 0
        promo = None
        if promo_code:
            promo = await self._validate_promo_code(db, promo_code, user.id, plan.code, amount)
            if promo:
                discount = promo.calculate_discount(amount)
                amount = max(0, amount - discount)

        # Déterminer le provider
        provider = METHOD_PROVIDER_MAP.get(payment_method, PaymentProvider.STRIPE)

        # Créer la transaction
        transaction = Transaction(
            user_id=user.id,
            plan_id=plan.id,
            provider=provider,
            payment_method=payment_method,
            amount=amount,
            currency=currency,
            phone_number=phone_number,
            country_code=country_code,
            status=TransactionStatus.PENDING,
            extra_data={
                "plan_code": plan.code,
                "original_amount": plan.get_price(currency),
                "discount": discount,
                "promo_code": promo_code if promo else None,
                **(metadata or {})
            }
        )
        db.add(transaction)
        await db.flush()

        # Initialiser le paiement avec le provider approprié
        try:
            if provider == PaymentProvider.STRIPE:
                result = await self.stripe.create_checkout_session(
                    transaction=transaction,
                    plan=plan,
                    success_url=success_url,
                    cancel_url=cancel_url
                )
            elif provider == PaymentProvider.PAYPAL:
                result = await self.paypal.create_order(
                    transaction=transaction,
                    plan=plan,
                    success_url=success_url,
                    cancel_url=cancel_url
                )
            elif provider == PaymentProvider.PAYDUNYA:
                logger.info(f"Initialisation PayDunya: transaction_id={transaction.id}, phone={phone_number}")
                result = await self.paydunya.initialize_payment(
                    transaction=transaction,
                    plan=plan,
                    phone_number=phone_number,
                    success_url=success_url,
                    cancel_url=cancel_url
                )
                logger.info(f"Résultat PayDunya: {result}")
            else:
                raise ValueError(f"Provider '{provider}' non supporté")

            # Mettre à jour la transaction avec les IDs du provider
            transaction.provider_checkout_id = result.get("checkout_id")
            transaction.provider_payment_intent_id = result.get("payment_intent_id")
            transaction.status = TransactionStatus.PROCESSING

            await db.commit()

            return {
                "transaction_id": transaction.id,
                "provider": provider.value,
                "payment_url": result.get("payment_url"),
                "checkout_id": result.get("checkout_id"),
                "client_secret": result.get("client_secret"),  # Pour Stripe Elements
                "amount": amount,
                "currency": currency.value,
                "plan": plan.name,
                "requires_redirect": result.get("requires_redirect", True)
            }

        except Exception as e:
            logger.error(f"Erreur création paiement: {e}")
            transaction.status = TransactionStatus.FAILED
            transaction.status_message = str(e)
            await db.commit()
            raise

    async def handle_webhook(
        self,
        db: AsyncSession,
        provider: PaymentProvider,
        payload: Dict,
        headers: Dict
    ) -> Dict[str, Any]:
        """
        Traite un webhook de paiement.

        Args:
            db: Session de base de données
            provider: Provider source du webhook
            payload: Contenu du webhook
            headers: Headers HTTP

        Returns:
            Dict avec le résultat du traitement
        """
        try:
            if provider == PaymentProvider.STRIPE:
                return await self.stripe.handle_webhook(db, payload, headers)
            elif provider == PaymentProvider.PAYPAL:
                return await self.paypal.handle_webhook(db, payload, headers)
            elif provider == PaymentProvider.PAYDUNYA:
                # PayDunya webhook handling
                webhook_data = self.paydunya.handle_webhook(payload)
                if webhook_data.get("transaction_id"):
                    # Mettre à jour la transaction
                    transaction = await db.get(Transaction, webhook_data["transaction_id"])
                    if transaction:
                        transaction.status = webhook_data.get("status", TransactionStatus.PENDING)
                        if webhook_data["status"] == TransactionStatus.SUCCESS:
                            transaction.completed_at = utc_now()
                        await db.commit()
                return webhook_data
            else:
                raise ValueError(f"Provider '{provider}' non supporté")

        except Exception as e:
            logger.error(f"Erreur traitement webhook {provider}: {e}")
            raise

    async def confirm_payment(
        self,
        db: AsyncSession,
        transaction_id: int,
        provider_data: Dict = None,
        user_id: int = None,
        from_webhook: bool = False
    ) -> Dict[str, Any]:
        """
        Confirme un paiement et active l'abonnement.

        Args:
            db: Session de base de données
            transaction_id: ID de la transaction
            provider_data: Données additionnelles du provider
            user_id: ID de l'utilisateur (obligatoire sauf si from_webhook=True,
                     car les webhooks n'ont pas de session utilisateur)
            from_webhook: True si appelé depuis un webhook provider (signature déjà
                          vérifiée en amont). Skip la vérification d'ownership.

        Returns:
            Dict avec le statut de l'activation

        Raises:
            ValueError: Si user_id absent hors webhook, ou transaction non autorisée
        """
        # Sécurité : hors webhook, l'identité utilisateur est obligatoire
        # (empêche toute confirmation anonyme depuis une route authentifiée)
        if not from_webhook and user_id is None:
            raise ValueError(
                "user_id requis pour confirm_payment hors webhook"
            )

        # Récupérer la transaction
        result = await db.execute(
            select(Transaction).where(Transaction.id == transaction_id)
        )
        transaction = result.scalar_one_or_none()

        if not transaction:
            raise ValueError("Transaction non trouvée")

        # Vérifier l'ownership (sauf webhook, où la signature du provider fait foi)
        if not from_webhook and transaction.user_id != user_id:
            raise ValueError("Transaction non autorisée")

        if transaction.status == TransactionStatus.SUCCESS:
            return {"status": "already_activated", "message": "Abonnement déjà activé"}

        # Marquer comme succès
        transaction.mark_success(provider_data.get("transaction_id") if provider_data else None)
        transaction.webhook_data = provider_data

        # Activer l'abonnement
        await self._activate_subscription(db, transaction)

        await db.commit()

        return {
            "status": "success",
            "message": "Abonnement activé avec succès",
            "transaction_id": transaction.id
        }

    async def get_transaction_status(
        self,
        db: AsyncSession,
        transaction_id: int,
        user_id: int
    ) -> Dict[str, Any]:
        """Récupère le statut d'une transaction"""
        result = await db.execute(
            select(Transaction)
            .where(Transaction.id == transaction_id)
            .where(Transaction.user_id == user_id)
        )
        transaction = result.scalar_one_or_none()

        if not transaction:
            return None

        return {
            "id": transaction.id,
            "status": transaction.status.value,
            "amount": transaction.amount,
            "currency": transaction.currency.value,
            "payment_method": transaction.payment_method.value,
            "created_at": transaction.created_at.isoformat(),
            "completed_at": transaction.completed_at.isoformat() if transaction.completed_at else None
        }

    # ==================== MÉTHODES PRIVÉES ====================

    async def _get_plan(self, db: AsyncSession, code: str) -> Optional[SubscriptionPlan]:
        """Récupère un plan par son code"""
        result = await db.execute(
            select(SubscriptionPlan).where(SubscriptionPlan.code == code)
        )
        return result.scalar_one_or_none()

    async def _validate_promo_code(
        self,
        db: AsyncSession,
        code: str,
        user_id: int,
        plan_code: str,
        amount: int
    ) -> Optional[PromoCode]:
        """Valide un code promo"""
        result = await db.execute(
            select(PromoCode).where(PromoCode.code == code.upper())
        )
        promo = result.scalar_one_or_none()

        if not promo or not promo.is_valid():
            return None

        # Vérifier les restrictions de plan
        if promo.applicable_plans and plan_code not in promo.applicable_plans:
            return None

        # Vérifier le montant minimum
        if promo.min_amount and amount < promo.min_amount:
            return None

        # TODO: Vérifier le nombre d'utilisations par l'utilisateur

        return promo

    async def _activate_free_plan(
        self,
        db: AsyncSession,
        user: User,
        plan: SubscriptionPlan
    ) -> Dict[str, Any]:
        """Active le plan gratuit sans paiement"""
        # Mettre à jour l'abonnement de l'utilisateur
        if user.subscription:
            user.subscription.subscription_type = SubscriptionType.FREE
            user.subscription.ai_requests_limit = plan.ai_requests_per_day
            user.subscription.storage_limit_mb = plan.storage_limit_mb
        await db.commit()

        return {
            "status": "success",
            "message": "Plan gratuit activé",
            "requires_payment": False
        }

    async def _activate_subscription(
        self,
        db: AsyncSession,
        transaction: Transaction
    ):
        """Active l'abonnement après paiement réussi"""
        # Récupérer le plan
        plan = transaction.plan

        # Déterminer le type d'abonnement
        subscription_type_map = {
            "free": SubscriptionType.FREE,
            "premium": SubscriptionType.PREMIUM,
            "premium_yearly": SubscriptionType.PREMIUM,
            "premium_plus": SubscriptionType.PREMIUM_PLUS,
            "institutional": SubscriptionType.INSTITUTIONAL
        }
        subscription_type = subscription_type_map.get(plan.code, SubscriptionType.PREMIUM)

        # Récupérer l'utilisateur avec son abonnement
        result = await db.execute(
            select(User).where(User.id == transaction.user_id)
        )
        user = result.scalar_one_or_none()

        if user and user.subscription:
            now = utc_now()

            # Si l'utilisateur a déjà un abonnement actif, prolonger
            if user.subscription.subscription_ends_at and user.subscription.subscription_ends_at > now:
                start_date = user.subscription.subscription_ends_at
            else:
                start_date = now

            end_date = start_date + timedelta(days=plan.duration_days)

            # Mettre à jour l'abonnement
            user.subscription.subscription_type = subscription_type
            user.subscription.subscription_starts_at = start_date
            user.subscription.subscription_ends_at = end_date
            user.subscription.ai_requests_limit = plan.ai_requests_per_day
            user.subscription.storage_limit_mb = plan.storage_limit_mb

            logger.info(f"Abonnement {subscription_type.value} activé pour user {user.id} jusqu'au {end_date}")

    def _get_region(self, country_code: str) -> str:
        """Détermine la région à partir du code pays"""
        if not country_code:
            return "international"

        country_code = country_code.upper()

        african_countries = [
            "SN", "CI", "ML", "BF", "BJ", "TG", "NE", "GW",  # Afrique de l'Ouest
            "CM", "GA", "CG", "TD", "CF", "GQ",              # Afrique Centrale
            "NG", "GH", "KE", "TZ", "UG", "RW",              # Autres
            "ZA", "MA", "TN", "EG", "DZ"
        ]

        european_countries = [
            "FR", "DE", "ES", "IT", "BE", "NL", "PT", "AT",
            "CH", "GB", "IE", "PL", "CZ", "SE", "NO", "DK", "FI"
        ]

        north_american_countries = ["US", "CA", "MX"]

        if country_code in african_countries:
            return "africa"
        elif country_code in european_countries:
            return "europe"
        elif country_code in north_american_countries:
            return "north_america"
        else:
            return "international"


# ==================== INITIALISATION DES PLANS ====================

async def initialize_subscription_plans(db: AsyncSession):
    """
    Initialise les plans d'abonnement dans la base de données.
    À appeler au démarrage de l'application ou via une migration.
    """
    for plan_data in INITIAL_PLANS:
        # Vérifier si le plan existe
        result = await db.execute(
            select(SubscriptionPlan).where(SubscriptionPlan.code == plan_data["code"])
        )
        existing = result.scalar_one_or_none()

        if not existing:
            plan = SubscriptionPlan(**plan_data)
            db.add(plan)
            logger.info(f"Plan '{plan_data['code']}' créé")
        else:
            # Mettre à jour le plan existant
            for key, value in plan_data.items():
                setattr(existing, key, value)
            logger.info(f"Plan '{plan_data['code']}' mis à jour")

    await db.commit()


# Instance singleton
payment_service = PaymentService()
