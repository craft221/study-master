"""
Service PayPal
==============

Gère les paiements PayPal:
- Création de commandes (Orders API)
- Capture de paiements
- Gestion des webhooks

Documentation: https://developer.paypal.com/docs/api/overview/
"""

import logging
from typing import Optional, Dict, Any
import httpx
import base64
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.datetime_utils import utc_now
from app.models.payment import (
    Transaction, TransactionStatus, PaymentProvider,
    SubscriptionPlan, PaymentWebhookLog
)

logger = logging.getLogger(__name__)


class PayPalService:
    """Service pour les paiements PayPal"""

    def __init__(self):
        self.client_id = getattr(settings, 'PAYPAL_CLIENT_ID', None) or "placeholder_client_id"
        self.client_secret = getattr(settings, 'PAYPAL_CLIENT_SECRET', None) or "placeholder_secret"
        self.webhook_id = getattr(settings, 'PAYPAL_WEBHOOK_ID', None) or "placeholder_webhook"

        # Mode sandbox ou live
        self.sandbox = getattr(settings, 'PAYPAL_SANDBOX', True)
        self.base_url = "https://api-m.sandbox.paypal.com" if self.sandbox else "https://api-m.paypal.com"

        # Mode test si clés placeholder
        self.is_test_mode = "placeholder" in self.client_id

        # Token d'accès (cache simple)
        self._access_token = None
        self._token_expires_at = None

    async def _get_access_token(self) -> str:
        """Obtient un token d'accès OAuth2"""
        if self.is_test_mode:
            return "test_token"

        # Vérifier si le token est encore valide
        if self._access_token and self._token_expires_at:
            if utc_now().timestamp() < self._token_expires_at:
                return self._access_token

        # Obtenir un nouveau token
        auth = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v1/oauth2/token",
                headers={
                    "Authorization": f"Basic {auth}",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data="grant_type=client_credentials"
            )

            if response.status_code != 200:
                logger.error(f"Erreur token PayPal: {response.text}")
                raise Exception("Impossible d'obtenir le token PayPal")

            data = response.json()
            self._access_token = data["access_token"]
            self._token_expires_at = utc_now().timestamp() + data["expires_in"] - 60

            return self._access_token

    async def create_order(
        self,
        transaction: Transaction,
        plan: SubscriptionPlan,
        success_url: str = None,
        cancel_url: str = None
    ) -> Dict[str, Any]:
        """
        Crée une commande PayPal.

        Args:
            transaction: Transaction en cours
            plan: Plan d'abonnement
            success_url: URL de retour après approbation
            cancel_url: URL de retour après annulation

        Returns:
            Dict avec order_id, approval_url
        """
        try:
            # Mode simulation
            if self.is_test_mode:
                return self._simulate_order(transaction, plan, success_url)

            # URLs par défaut
            base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            success_url = success_url or f"{base_url}/payment/success"
            cancel_url = cancel_url or f"{base_url}/payment/cancel"

            token = await self._get_access_token()

            # Convertir le montant selon la devise
            currency = transaction.currency.value
            amount = transaction.amount

            # Pour EUR, USD, etc. (centimes -> unités)
            if currency in ["EUR", "USD", "GBP"]:
                amount_str = f"{amount / 100:.2f}"
            else:
                # FCFA et autres (pas de centimes)
                amount_str = str(amount)

            order_data = {
                "intent": "CAPTURE",
                "purchase_units": [{
                    "reference_id": str(transaction.id),
                    "description": f"Abonnement {plan.name} - Studera",
                    "amount": {
                        "currency_code": currency,
                        "value": amount_str
                    },
                    "custom_id": str(transaction.id)
                }],
                "application_context": {
                    "brand_name": "Studera",
                    "landing_page": "LOGIN",
                    "user_action": "PAY_NOW",
                    "return_url": success_url,
                    "cancel_url": cancel_url
                }
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/v2/checkout/orders",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json"
                    },
                    json=order_data
                )

                if response.status_code not in [200, 201]:
                    logger.error(f"Erreur création order PayPal: {response.text}")
                    raise Exception(f"Erreur PayPal: {response.json().get('message', 'Erreur inconnue')}")

                data = response.json()

                # Trouver l'URL d'approbation
                approval_url = None
                for link in data.get("links", []):
                    if link.get("rel") == "approve":
                        approval_url = link.get("href")
                        break

                return {
                    "checkout_id": data["id"],
                    "payment_url": approval_url,
                    "requires_redirect": True
                }

        except httpx.HTTPError as e:
            logger.error(f"Erreur HTTP PayPal: {e}")
            raise Exception(f"Erreur de connexion PayPal: {str(e)}")

    async def capture_order(self, order_id: str) -> Dict[str, Any]:
        """
        Capture le paiement après approbation par l'utilisateur.

        Cette méthode est appelée après le retour de PayPal.
        """
        try:
            if self.is_test_mode:
                return self._simulate_capture(order_id)

            token = await self._get_access_token()

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/v2/checkout/orders/{order_id}/capture",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json"
                    }
                )

                if response.status_code not in [200, 201]:
                    logger.error(f"Erreur capture PayPal: {response.text}")
                    data = response.json()
                    raise Exception(f"Erreur capture: {data.get('message', 'Erreur inconnue')}")

                data = response.json()

                # Vérifier le statut
                status = data.get("status")
                if status != "COMPLETED":
                    raise Exception(f"Capture non complétée: {status}")

                # Récupérer les détails
                capture_id = None
                purchase_unit = data.get("purchase_units", [{}])[0]
                captures = purchase_unit.get("payments", {}).get("captures", [])
                if captures:
                    capture_id = captures[0].get("id")

                return {
                    "status": "success",
                    "order_id": order_id,
                    "capture_id": capture_id,
                    "payer_email": data.get("payer", {}).get("email_address"),
                    "transaction_id": purchase_unit.get("custom_id")
                }

        except httpx.HTTPError as e:
            logger.error(f"Erreur HTTP capture PayPal: {e}")
            raise Exception(f"Erreur de connexion: {str(e)}")

    async def handle_webhook(
        self,
        db: AsyncSession,
        payload: Dict,
        headers: Dict
    ) -> Dict[str, Any]:
        """
        Traite un webhook PayPal.

        Events importants:
        - CHECKOUT.ORDER.APPROVED: Commande approuvée
        - PAYMENT.CAPTURE.COMPLETED: Paiement capturé
        - PAYMENT.CAPTURE.DENIED: Paiement refusé
        """
        try:
            # Vérifier la signature (en production)
            if not self.is_test_mode:
                verified = await self._verify_webhook_signature(payload, headers)
                if not verified:
                    logger.warning("Signature webhook PayPal invalide")
                    # En mode sandbox, on peut continuer quand même
                    if not self.sandbox:
                        raise Exception("Signature invalide")

            event_type = payload.get("event_type", "")
            resource = payload.get("resource", {})

            # Logger le webhook
            webhook_log = PaymentWebhookLog(
                provider=PaymentProvider.PAYPAL,
                event_type=event_type,
                event_id=payload.get("id"),
                payload=payload
            )
            db.add(webhook_log)

            # Traiter selon le type
            if event_type == "CHECKOUT.ORDER.APPROVED":
                return await self._handle_order_approved(db, resource, webhook_log)

            elif event_type == "PAYMENT.CAPTURE.COMPLETED":
                return await self._handle_capture_completed(db, resource, webhook_log)

            elif event_type == "PAYMENT.CAPTURE.DENIED":
                return await self._handle_capture_denied(db, resource, webhook_log)

            else:
                logger.info(f"Webhook PayPal ignoré: {event_type}")
                return {"status": "ignored", "event_type": event_type}

        except Exception as e:
            logger.error(f"Erreur webhook PayPal: {e}")
            raise

    async def refund_payment(
        self,
        transaction: Transaction,
        amount: int = None,
        reason: str = None
    ) -> Dict[str, Any]:
        """Rembourse un paiement PayPal"""
        try:
            if self.is_test_mode:
                return {"refund_id": "RF_simulated", "status": "COMPLETED"}

            capture_id = transaction.provider_transaction_id
            if not capture_id:
                raise Exception("ID de capture manquant")

            token = await self._get_access_token()

            refund_data = {}
            if amount:
                currency = transaction.currency.value
                if currency in ["EUR", "USD", "GBP"]:
                    amount_str = f"{amount / 100:.2f}"
                else:
                    amount_str = str(amount)

                refund_data = {
                    "amount": {
                        "currency_code": currency,
                        "value": amount_str
                    },
                    "note_to_payer": reason or "Remboursement Studera"
                }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/v2/payments/captures/{capture_id}/refund",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json"
                    },
                    json=refund_data if refund_data else None
                )

                if response.status_code not in [200, 201]:
                    logger.error(f"Erreur remboursement PayPal: {response.text}")
                    raise Exception("Erreur de remboursement")

                data = response.json()
                return {
                    "refund_id": data.get("id"),
                    "status": data.get("status")
                }

        except httpx.HTTPError as e:
            logger.error(f"Erreur HTTP remboursement: {e}")
            raise Exception(f"Erreur de connexion: {str(e)}")

    # ==================== HANDLERS WEBHOOK ====================

    async def _handle_order_approved(
        self,
        db: AsyncSession,
        resource: Dict,
        webhook_log: PaymentWebhookLog
    ) -> Dict[str, Any]:
        """Traite l'approbation d'une commande"""
        # Récupérer l'ID de transaction depuis custom_id
        purchase_unit = resource.get("purchase_units", [{}])[0]
        transaction_id = purchase_unit.get("custom_id") or purchase_unit.get("reference_id")

        if not transaction_id:
            return {"status": "error", "message": "Transaction ID manquant"}

        result = await db.execute(
            select(Transaction).where(Transaction.id == int(transaction_id))
        )
        transaction = result.scalar_one_or_none()

        if transaction:
            transaction.provider_checkout_id = resource.get("id")
            transaction.status = TransactionStatus.PROCESSING
            webhook_log.transaction_id = transaction.id

        webhook_log.processed = True
        webhook_log.processed_at = utc_now()
        await db.commit()

        return {
            "status": "approved",
            "transaction_id": transaction_id,
            "order_id": resource.get("id"),
            "action_required": "capture"
        }

    async def _handle_capture_completed(
        self,
        db: AsyncSession,
        resource: Dict,
        webhook_log: PaymentWebhookLog
    ) -> Dict[str, Any]:
        """Traite la capture réussie d'un paiement"""
        transaction_id = resource.get("custom_id")

        if not transaction_id:
            return {"status": "ignored"}

        result = await db.execute(
            select(Transaction).where(Transaction.id == int(transaction_id))
        )
        transaction = result.scalar_one_or_none()

        if transaction:
            transaction.mark_success(resource.get("id"))
            transaction.webhook_received_at = utc_now()
            transaction.webhook_data = resource
            webhook_log.transaction_id = transaction.id

        webhook_log.processed = True
        webhook_log.processed_at = utc_now()
        await db.commit()

        return {
            "status": "success",
            "transaction_id": transaction_id,
            "requires_activation": True
        }

    async def _handle_capture_denied(
        self,
        db: AsyncSession,
        resource: Dict,
        webhook_log: PaymentWebhookLog
    ) -> Dict[str, Any]:
        """Traite l'échec d'une capture"""
        transaction_id = resource.get("custom_id")

        if not transaction_id:
            return {"status": "ignored"}

        result = await db.execute(
            select(Transaction).where(Transaction.id == int(transaction_id))
        )
        transaction = result.scalar_one_or_none()

        if transaction:
            transaction.mark_failed("Paiement refusé par PayPal")
            webhook_log.transaction_id = transaction.id

        webhook_log.processed = True
        webhook_log.processed_at = utc_now()
        await db.commit()

        return {"status": "failed", "transaction_id": transaction_id}

    async def _verify_webhook_signature(
        self,
        payload: Dict,
        headers: Dict
    ) -> bool:
        """Vérifie la signature d'un webhook PayPal"""
        # En mode test, toujours valide
        if self.is_test_mode or self.sandbox:
            return True

        # TODO: Implémenter la vérification complète
        # https://developer.paypal.com/docs/api-basics/notifications/webhooks/notification-messages/
        return True

    # ==================== SIMULATION MODE TEST ====================

    def _simulate_order(
        self,
        transaction: Transaction,
        plan: SubscriptionPlan,
        success_url: str
    ) -> Dict[str, Any]:
        """Simule une commande en mode test"""
        import uuid

        order_id = f"ORDER_TEST_{uuid.uuid4().hex[:12].upper()}"
        base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

        return {
            "checkout_id": order_id,
            "payment_url": f"{base_url}/payment/simulate?provider=paypal&order_id={order_id}&plan={plan.code}",
            "requires_redirect": True,
            "test_mode": True,
            "message": "Mode test PayPal - Utilisez la page de simulation"
        }

    def _simulate_capture(self, order_id: str) -> Dict[str, Any]:
        """Simule une capture en mode test"""
        import uuid

        return {
            "status": "success",
            "order_id": order_id,
            "capture_id": f"CAPTURE_TEST_{uuid.uuid4().hex[:12].upper()}",
            "payer_email": "test@sandbox.paypal.com",
            "test_mode": True
        }


# Instance singleton
paypal_service = PayPalService()
