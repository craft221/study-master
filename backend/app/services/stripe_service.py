"""
Service Stripe
==============

Gère les paiements par carte bancaire via Stripe:
- Création de sessions Checkout
- Gestion des webhooks
- Remboursements

Documentation: https://stripe.com/docs/api
"""

import logging
from typing import Optional, Dict, Any
import stripe
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.datetime_utils import utc_now
from app.models.payment import (
    Transaction, TransactionStatus, PaymentProvider,
    SubscriptionPlan, PaymentWebhookLog
)

logger = logging.getLogger(__name__)


class StripeService:
    """Service pour les paiements Stripe"""

    def __init__(self):
        self.api_key = getattr(settings, 'STRIPE_SECRET_KEY', None) or "sk_test_placeholder"
        self.webhook_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', None) or "whsec_placeholder"
        self.public_key = getattr(settings, 'STRIPE_PUBLIC_KEY', None) or "pk_test_placeholder"

        # Configurer Stripe
        stripe.api_key = self.api_key

        # Mode test si clés placeholder
        self.is_test_mode = "placeholder" in self.api_key or "test" in self.api_key

    async def create_checkout_session(
        self,
        transaction: Transaction,
        plan: SubscriptionPlan,
        success_url: str = None,
        cancel_url: str = None
    ) -> Dict[str, Any]:
        """
        Crée une session Stripe Checkout.

        Args:
            transaction: Transaction en cours
            plan: Plan d'abonnement
            success_url: URL de redirection après succès
            cancel_url: URL de redirection après annulation

        Returns:
            Dict avec checkout_id, payment_url, client_secret
        """
        try:
            # En mode test sans vraies clés, simuler
            if self.is_test_mode and "placeholder" in self.api_key:
                return self._simulate_checkout(transaction, plan, success_url)

            # URLs par défaut
            base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            success_url = success_url or f"{base_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
            cancel_url = cancel_url or f"{base_url}/payment/cancel"

            # Créer la session Checkout
            session = stripe.checkout.Session.create(
                mode="payment",  # ou "subscription" pour abonnement récurrent
                payment_method_types=["card"],
                line_items=[{
                    "price_data": {
                        "currency": transaction.currency.value.lower(),
                        "unit_amount": transaction.amount,
                        "product_data": {
                            "name": plan.name,
                            "description": plan.description or f"Abonnement {plan.name}",
                            "metadata": {
                                "plan_code": plan.code
                            }
                        },
                    },
                    "quantity": 1,
                }],
                metadata={
                    "transaction_id": str(transaction.id),
                    "user_id": str(transaction.user_id),
                    "plan_code": plan.code
                },
                customer_email=None,  # Sera récupéré dans Checkout
                success_url=success_url,
                cancel_url=cancel_url,
                expires_at=int((utc_now().timestamp()) + 1800),  # 30 min
            )

            return {
                "checkout_id": session.id,
                "payment_url": session.url,
                "payment_intent_id": session.payment_intent,
                "requires_redirect": True
            }

        except stripe.error.StripeError as e:
            logger.error(f"Erreur Stripe: {e}")
            raise Exception(f"Erreur de paiement: {str(e)}")

    async def create_payment_intent(
        self,
        transaction: Transaction,
        plan: SubscriptionPlan
    ) -> Dict[str, Any]:
        """
        Crée un PaymentIntent pour Stripe Elements (intégration custom).

        Utile pour une intégration directe dans le frontend sans redirection.
        """
        try:
            if self.is_test_mode and "placeholder" in self.api_key:
                return self._simulate_payment_intent(transaction)

            intent = stripe.PaymentIntent.create(
                amount=transaction.amount,
                currency=transaction.currency.value.lower(),
                metadata={
                    "transaction_id": str(transaction.id),
                    "user_id": str(transaction.user_id),
                    "plan_code": plan.code
                },
                automatic_payment_methods={"enabled": True},
            )

            return {
                "payment_intent_id": intent.id,
                "client_secret": intent.client_secret,
                "requires_redirect": False
            }

        except stripe.error.StripeError as e:
            logger.error(f"Erreur Stripe PaymentIntent: {e}")
            raise Exception(f"Erreur de paiement: {str(e)}")

    async def handle_webhook(
        self,
        db: AsyncSession,
        payload: Dict,
        headers: Dict
    ) -> Dict[str, Any]:
        """
        Traite un webhook Stripe.

        Events importants:
        - checkout.session.completed: Checkout terminé
        - payment_intent.succeeded: Paiement réussi
        - payment_intent.payment_failed: Paiement échoué
        """
        try:
            # Vérifier la signature (en production)
            sig_header = headers.get("stripe-signature", "")

            if not self.is_test_mode and sig_header:
                try:
                    import json as json_module
                    payload_str = payload if isinstance(payload, str) else json_module.dumps(payload)
                    event = stripe.Webhook.construct_event(
                        payload_str,
                        sig_header,
                        self.webhook_secret
                    )
                except stripe.error.SignatureVerificationError:
                    logger.error("Signature webhook invalide")
                    raise Exception("Signature invalide")
            else:
                # Mode test ou pas de signature
                event = payload if isinstance(payload, dict) else {"type": "unknown"}

            event_type = event.get("type", "")
            event_data = event.get("data", {}).get("object", {})

            # Logger le webhook
            webhook_log = PaymentWebhookLog(
                provider=PaymentProvider.STRIPE,
                event_type=event_type,
                event_id=event.get("id"),
                payload=event
            )
            db.add(webhook_log)

            # Traiter selon le type d'événement
            if event_type == "checkout.session.completed":
                return await self._handle_checkout_completed(db, event_data, webhook_log)

            elif event_type == "payment_intent.succeeded":
                return await self._handle_payment_succeeded(db, event_data, webhook_log)

            elif event_type == "payment_intent.payment_failed":
                return await self._handle_payment_failed(db, event_data, webhook_log)

            else:
                logger.info(f"Webhook Stripe ignoré: {event_type}")
                return {"status": "ignored", "event_type": event_type}

        except Exception as e:
            logger.error(f"Erreur webhook Stripe: {e}")
            raise

    async def refund_payment(
        self,
        transaction: Transaction,
        amount: int = None,
        reason: str = None
    ) -> Dict[str, Any]:
        """Rembourse un paiement"""
        try:
            if self.is_test_mode and "placeholder" in self.api_key:
                return {"refund_id": "re_simulated", "status": "succeeded"}

            refund_params = {
                "payment_intent": transaction.provider_payment_intent_id,
            }

            if amount:
                refund_params["amount"] = amount
            if reason:
                refund_params["reason"] = reason

            refund = stripe.Refund.create(**refund_params)

            return {
                "refund_id": refund.id,
                "status": refund.status,
                "amount": refund.amount
            }

        except stripe.error.StripeError as e:
            logger.error(f"Erreur remboursement Stripe: {e}")
            raise Exception(f"Erreur de remboursement: {str(e)}")

    # ==================== HANDLERS WEBHOOK ====================

    async def _handle_checkout_completed(
        self,
        db: AsyncSession,
        data: Dict,
        webhook_log: PaymentWebhookLog
    ) -> Dict[str, Any]:
        """Traite l'événement checkout.session.completed"""
        transaction_id = data.get("metadata", {}).get("transaction_id")

        if not transaction_id:
            return {"status": "error", "message": "Transaction ID manquant"}

        # Récupérer la transaction
        result = await db.execute(
            select(Transaction).where(Transaction.id == int(transaction_id))
        )
        transaction = result.scalar_one_or_none()

        if not transaction:
            return {"status": "error", "message": "Transaction non trouvée"}

        # Mettre à jour la transaction
        transaction.provider_checkout_id = data.get("id")
        transaction.provider_payment_intent_id = data.get("payment_intent")
        transaction.mark_success(data.get("payment_intent"))
        transaction.webhook_received_at = utc_now()
        transaction.webhook_data = data

        webhook_log.transaction_id = transaction.id
        webhook_log.processed = True
        webhook_log.processed_at = utc_now()

        await db.commit()

        logger.info(f"Checkout Stripe complété pour transaction {transaction_id}")

        return {
            "status": "success",
            "transaction_id": transaction_id,
            "requires_activation": True
        }

    async def _handle_payment_succeeded(
        self,
        db: AsyncSession,
        data: Dict,
        webhook_log: PaymentWebhookLog
    ) -> Dict[str, Any]:
        """Traite l'événement payment_intent.succeeded"""
        transaction_id = data.get("metadata", {}).get("transaction_id")

        if not transaction_id:
            # Peut-être déjà traité via checkout.session.completed
            return {"status": "ignored", "message": "Pas de transaction_id"}

        result = await db.execute(
            select(Transaction).where(Transaction.id == int(transaction_id))
        )
        transaction = result.scalar_one_or_none()

        if transaction and transaction.status != TransactionStatus.SUCCESS:
            transaction.mark_success(data.get("id"))
            transaction.payment_method_details = {
                "card_brand": data.get("payment_method_details", {}).get("card", {}).get("brand"),
                "card_last4": data.get("payment_method_details", {}).get("card", {}).get("last4"),
            }

            webhook_log.transaction_id = transaction.id
            webhook_log.processed = True
            webhook_log.processed_at = utc_now()

            await db.commit()

        return {"status": "success", "transaction_id": transaction_id}

    async def _handle_payment_failed(
        self,
        db: AsyncSession,
        data: Dict,
        webhook_log: PaymentWebhookLog
    ) -> Dict[str, Any]:
        """Traite l'événement payment_intent.payment_failed"""
        transaction_id = data.get("metadata", {}).get("transaction_id")

        if not transaction_id:
            return {"status": "ignored"}

        result = await db.execute(
            select(Transaction).where(Transaction.id == int(transaction_id))
        )
        transaction = result.scalar_one_or_none()

        if transaction:
            error_message = data.get("last_payment_error", {}).get("message", "Paiement échoué")
            transaction.mark_failed(error_message)

            webhook_log.transaction_id = transaction.id
            webhook_log.processed = True
            webhook_log.processed_at = utc_now()

            await db.commit()

        return {"status": "failed", "transaction_id": transaction_id}

    # ==================== SIMULATION MODE TEST ====================

    def _simulate_checkout(
        self,
        transaction: Transaction,
        plan: SubscriptionPlan,
        success_url: str
    ) -> Dict[str, Any]:
        """Simule une session checkout en mode test"""
        import uuid

        checkout_id = f"cs_test_{uuid.uuid4().hex[:24]}"
        payment_intent_id = f"pi_test_{uuid.uuid4().hex[:24]}"

        # URL de simulation
        base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

        return {
            "checkout_id": checkout_id,
            "payment_url": f"{base_url}/payment/simulate?checkout_id={checkout_id}&plan={plan.code}",
            "payment_intent_id": payment_intent_id,
            "requires_redirect": True,
            "test_mode": True,
            "message": "Mode test - Utilisez la page de simulation pour tester"
        }

    def _simulate_payment_intent(self, transaction: Transaction) -> Dict[str, Any]:
        """Simule un PaymentIntent en mode test"""
        import uuid

        return {
            "payment_intent_id": f"pi_test_{uuid.uuid4().hex[:24]}",
            "client_secret": f"pi_test_{uuid.uuid4().hex[:24]}_secret_{uuid.uuid4().hex[:12]}",
            "requires_redirect": False,
            "test_mode": True
        }


# Instance singleton
stripe_service = StripeService()
