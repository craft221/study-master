"""
Service Flutterwave
===================

Gère les paiements Mobile Money et cartes en Afrique:
- Orange Money (Sénégal, Côte d'Ivoire, Mali, Cameroun...)
- Wave (Sénégal, Côte d'Ivoire, Mali...)
- MTN Mobile Money
- M-Pesa (Kenya, Tanzanie)
- Cartes bancaires africaines

Documentation: https://developer.flutterwave.com/docs
"""

import logging
from typing import Optional, Dict, Any
import httpx
import hashlib
import hmac
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.datetime_utils import utc_now
from app.models.payment import (
    Transaction, TransactionStatus, PaymentProvider, PaymentMethod,
    SubscriptionPlan, PaymentWebhookLog, Currency
)

logger = logging.getLogger(__name__)


# Mapping des méthodes vers les types Flutterwave
FLUTTERWAVE_PAYMENT_TYPES = {
    PaymentMethod.ORANGE_MONEY: "mobilemoneysn",  # ou mobilemoneyci, etc.
    PaymentMethod.WAVE: "mobilemoneysn",
    PaymentMethod.MTN_MOMO: "mobilemoneyrw",  # ou mobilemoneygh, etc.
    PaymentMethod.MPESA: "mpesa",
    PaymentMethod.AIRTEL_MONEY: "mobilemoneyuganda",
    PaymentMethod.MOOV_MONEY: "mobilemoneybj",
    PaymentMethod.CARD_VISA: "card",
    PaymentMethod.CARD_MASTERCARD: "card",
    PaymentMethod.BANK_TRANSFER: "banktransfer",
}

# Codes pays -> suffixe mobile money
COUNTRY_MOBILE_SUFFIX = {
    "SN": "sn",  # Sénégal
    "CI": "ci",  # Côte d'Ivoire
    "ML": "ml",  # Mali
    "BF": "bf",  # Burkina Faso
    "BJ": "bj",  # Bénin
    "CM": "cm",  # Cameroun
    "GH": "gh",  # Ghana
    "KE": "ke",  # Kenya
    "TZ": "tz",  # Tanzanie
    "UG": "ug",  # Ouganda
    "RW": "rw",  # Rwanda
    "NG": "ng",  # Nigeria
    "ZA": "za",  # Afrique du Sud
}


class FlutterwaveService:
    """Service pour les paiements Flutterwave (Afrique)"""

    def __init__(self):
        self.secret_key = getattr(settings, 'FLUTTERWAVE_SECRET_KEY', None) or "FLWSECK_TEST-placeholder"
        self.public_key = getattr(settings, 'FLUTTERWAVE_PUBLIC_KEY', None) or "FLWPUBK_TEST-placeholder"
        self.encryption_key = getattr(settings, 'FLUTTERWAVE_ENCRYPTION_KEY', None) or "placeholder_encryption"
        self.webhook_secret = getattr(settings, 'FLUTTERWAVE_WEBHOOK_SECRET', None) or "placeholder_webhook"

        self.base_url = "https://api.flutterwave.com/v3"

        # Mode test si clés placeholder
        self.is_test_mode = "placeholder" in self.secret_key or "TEST" in self.secret_key

    async def initialize_payment(
        self,
        transaction: Transaction,
        plan: SubscriptionPlan,
        phone_number: str = None,
        success_url: str = None,
        cancel_url: str = None
    ) -> Dict[str, Any]:
        """
        Initialise un paiement Flutterwave.

        Supporte:
        - Mobile Money (Orange, Wave, MTN, M-Pesa...)
        - Cartes bancaires
        - Transferts bancaires

        Args:
            transaction: Transaction en cours
            plan: Plan d'abonnement
            phone_number: Numéro pour Mobile Money (format international: +221...)
            success_url: URL de redirection après succès
            cancel_url: URL de redirection après annulation

        Returns:
            Dict avec payment_url ou instructions
        """
        logger.info(f"=== FLUTTERWAVE INIT ===")
        logger.info(f"Transaction: id={transaction.id}, method={transaction.payment_method}, currency={transaction.currency}")
        logger.info(f"Plan: {plan.code}, phone={phone_number}")
        logger.info(f"Test mode: {self.is_test_mode}, secret_key has placeholder: {'placeholder' in self.secret_key}")
        try:
            # Mode simulation
            if self.is_test_mode and "placeholder" in self.secret_key:
                logger.info("Mode simulation activé - appel _simulate_payment")
                return self._simulate_payment(transaction, plan, phone_number, success_url)

            # URLs par défaut
            base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            success_url = success_url or f"{base_url}/payment/success"
            cancel_url = cancel_url or f"{base_url}/payment/cancel"

            # Formater le montant
            currency = transaction.currency.value
            amount = transaction.amount

            # Flutterwave utilise les montants en unités (pas de centimes pour FCFA)
            # Mais pour EUR/USD, il faut convertir des centimes
            if currency in ["EUR", "USD", "GBP"]:
                amount = amount / 100

            # Générer une référence unique
            tx_ref = f"SM-{transaction.id}-{utc_now().strftime('%Y%m%d%H%M%S')}"

            # Préparer les données de paiement
            payment_data = {
                "tx_ref": tx_ref,
                "amount": amount,
                "currency": currency,
                "redirect_url": success_url,
                "payment_options": self._get_payment_options(transaction.payment_method, transaction.country_code),
                "customer": {
                    "email": f"user_{transaction.user_id}@studera.app",  # TODO: récupérer le vrai email
                    "phonenumber": phone_number or "",
                    "name": f"User {transaction.user_id}"
                },
                "customizations": {
                    "title": "Studera",
                    "description": f"Abonnement {plan.name}",
                    "logo": "https://studera.app/logo.png"
                },
                "meta": {
                    "transaction_id": str(transaction.id),
                    "user_id": str(transaction.user_id),
                    "plan_code": plan.code
                }
            }

            # Pour Mobile Money, ajouter le numéro de téléphone
            if phone_number and self._is_mobile_money(transaction.payment_method):
                payment_data["phone_number"] = phone_number

            # Appel API
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/payments",
                    headers={
                        "Authorization": f"Bearer {self.secret_key}",
                        "Content-Type": "application/json"
                    },
                    json=payment_data,
                    timeout=30.0
                )

                if response.status_code != 200:
                    logger.error(f"Erreur Flutterwave: {response.text}")
                    error_data = response.json()
                    raise Exception(f"Erreur: {error_data.get('message', 'Erreur inconnue')}")

                data = response.json()

                if data.get("status") != "success":
                    raise Exception(f"Erreur: {data.get('message', 'Initialisation échouée')}")

                return {
                    "checkout_id": tx_ref,
                    "payment_url": data.get("data", {}).get("link"),
                    "requires_redirect": True
                }

        except httpx.HTTPError as e:
            logger.error(f"Erreur HTTP Flutterwave: {e}")
            raise Exception(f"Erreur de connexion: {str(e)}")

    async def verify_payment(self, transaction_id: int) -> Dict[str, Any]:
        """
        Vérifie le statut d'un paiement.

        Appelé après le callback ou via webhook.
        """
        try:
            if self.is_test_mode and "placeholder" in self.secret_key:
                return {"status": "successful", "transaction_id": transaction_id}

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/transactions/{transaction_id}/verify",
                    headers={
                        "Authorization": f"Bearer {self.secret_key}"
                    },
                    timeout=30.0
                )

                if response.status_code != 200:
                    logger.error(f"Erreur vérification Flutterwave: {response.text}")
                    return {"status": "error", "message": "Impossible de vérifier"}

                data = response.json()

                if data.get("status") != "success":
                    return {"status": "error", "message": data.get("message")}

                payment_data = data.get("data", {})

                return {
                    "status": payment_data.get("status"),  # successful, failed, pending
                    "flw_transaction_id": payment_data.get("id"),
                    "tx_ref": payment_data.get("tx_ref"),
                    "amount": payment_data.get("amount"),
                    "currency": payment_data.get("currency"),
                    "payment_type": payment_data.get("payment_type"),
                    "customer": payment_data.get("customer", {})
                }

        except httpx.HTTPError as e:
            logger.error(f"Erreur HTTP vérification: {e}")
            return {"status": "error", "message": str(e)}

    async def handle_webhook(
        self,
        db: AsyncSession,
        payload: Dict,
        headers: Dict
    ) -> Dict[str, Any]:
        """
        Traite un webhook Flutterwave.

        Events:
        - charge.completed: Paiement réussi
        - charge.failed: Paiement échoué
        - transfer.completed: Transfert réussi
        """
        try:
            # Vérifier la signature
            if not self._verify_webhook(payload, headers):
                logger.warning("Signature webhook Flutterwave invalide")
                if not self.is_test_mode:
                    raise Exception("Signature invalide")

            event = payload.get("event", "")
            data = payload.get("data", {})

            # Logger le webhook
            webhook_log = PaymentWebhookLog(
                provider=PaymentProvider.FLUTTERWAVE,
                event_type=event,
                event_id=str(data.get("id")),
                payload=payload
            )
            db.add(webhook_log)

            # Traiter selon l'événement
            if event == "charge.completed":
                return await self._handle_charge_completed(db, data, webhook_log)

            elif event == "charge.failed":
                return await self._handle_charge_failed(db, data, webhook_log)

            else:
                logger.info(f"Webhook Flutterwave ignoré: {event}")
                return {"status": "ignored", "event": event}

        except Exception as e:
            logger.error(f"Erreur webhook Flutterwave: {e}")
            raise

    async def initiate_mobile_money_charge(
        self,
        transaction: Transaction,
        plan: SubscriptionPlan,
        phone_number: str,
        network: str  # orange, mtn, wave, airtel, mpesa
    ) -> Dict[str, Any]:
        """
        Initie un paiement Mobile Money direct (sans redirection).

        Cette méthode charge directement le compte Mobile Money.
        L'utilisateur recevra une demande USSD sur son téléphone.
        """
        try:
            if self.is_test_mode and "placeholder" in self.secret_key:
                return self._simulate_mobile_money(transaction, phone_number, network)

            currency = transaction.currency.value
            amount = transaction.amount

            # Déterminer le type de charge selon le réseau
            charge_type = self._get_mobile_charge_type(network, transaction.country_code)

            tx_ref = f"SM-{transaction.id}-{utc_now().strftime('%Y%m%d%H%M%S')}"

            charge_data = {
                "tx_ref": tx_ref,
                "amount": amount,
                "currency": currency,
                "email": f"user_{transaction.user_id}@studera.app",
                "phone_number": phone_number,
                "fullname": f"User {transaction.user_id}",
                "meta": {
                    "transaction_id": str(transaction.id),
                    "user_id": str(transaction.user_id),
                    "plan_code": plan.code
                }
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/charges?type={charge_type}",
                    headers={
                        "Authorization": f"Bearer {self.secret_key}",
                        "Content-Type": "application/json"
                    },
                    json=charge_data,
                    timeout=30.0
                )

                if response.status_code != 200:
                    logger.error(f"Erreur charge mobile: {response.text}")
                    raise Exception("Erreur d'initialisation")

                data = response.json()

                if data.get("status") != "success":
                    raise Exception(data.get("message", "Erreur inconnue"))

                result = data.get("data", {})

                return {
                    "checkout_id": tx_ref,
                    "flw_ref": result.get("flw_ref"),
                    "status": result.get("status"),  # pending, successful
                    "message": result.get("meta", {}).get("authorization", {}).get("instruction"),
                    "requires_redirect": False,
                    "requires_ussd": True  # L'utilisateur doit valider sur son téléphone
                }

        except httpx.HTTPError as e:
            logger.error(f"Erreur HTTP mobile money: {e}")
            raise Exception(f"Erreur de connexion: {str(e)}")

    async def refund_payment(
        self,
        transaction: Transaction,
        amount: int = None
    ) -> Dict[str, Any]:
        """Rembourse un paiement Flutterwave"""
        try:
            if self.is_test_mode:
                return {"refund_id": "FLW_REFUND_TEST", "status": "success"}

            flw_id = transaction.provider_transaction_id
            if not flw_id:
                raise Exception("ID transaction Flutterwave manquant")

            refund_data = {"amount": amount} if amount else {}

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/transactions/{flw_id}/refund",
                    headers={
                        "Authorization": f"Bearer {self.secret_key}",
                        "Content-Type": "application/json"
                    },
                    json=refund_data,
                    timeout=30.0
                )

                if response.status_code != 200:
                    logger.error(f"Erreur remboursement: {response.text}")
                    raise Exception("Erreur de remboursement")

                data = response.json()
                return {
                    "refund_id": data.get("data", {}).get("id"),
                    "status": data.get("status")
                }

        except httpx.HTTPError as e:
            logger.error(f"Erreur HTTP remboursement: {e}")
            raise Exception(f"Erreur de connexion: {str(e)}")

    # ==================== HANDLERS WEBHOOK ====================

    async def _handle_charge_completed(
        self,
        db: AsyncSession,
        data: Dict,
        webhook_log: PaymentWebhookLog
    ) -> Dict[str, Any]:
        """Traite un paiement réussi"""
        # Récupérer la transaction depuis tx_ref ou meta
        tx_ref = data.get("tx_ref", "")
        transaction_id = data.get("meta", {}).get("transaction_id")

        if not transaction_id and tx_ref.startswith("SM-"):
            # Extraire l'ID depuis tx_ref (format: SM-{id}-{timestamp})
            parts = tx_ref.split("-")
            if len(parts) >= 2:
                transaction_id = parts[1]

        if not transaction_id:
            return {"status": "error", "message": "Transaction ID manquant"}

        result = await db.execute(
            select(Transaction).where(Transaction.id == int(transaction_id))
        )
        transaction = result.scalar_one_or_none()

        if transaction:
            # Vérifier que le montant correspond
            expected_amount = transaction.amount
            received_amount = data.get("amount", 0)

            # Pour les devises sans centimes, comparer directement
            if transaction.currency not in [Currency.EUR, Currency.USD, Currency.GBP]:
                if abs(expected_amount - received_amount) > 1:
                    logger.warning(f"Montant différent: attendu {expected_amount}, reçu {received_amount}")

            transaction.mark_success(str(data.get("id")))
            transaction.provider_transaction_id = str(data.get("id"))
            transaction.webhook_received_at = utc_now()
            transaction.webhook_data = data
            transaction.payment_method_details = {
                "payment_type": data.get("payment_type"),
                "processor_response": data.get("processor_response")
            }

            webhook_log.transaction_id = transaction.id

        webhook_log.processed = True
        webhook_log.processed_at = utc_now()
        await db.commit()

        return {
            "status": "success",
            "transaction_id": transaction_id,
            "requires_activation": True
        }

    async def _handle_charge_failed(
        self,
        db: AsyncSession,
        data: Dict,
        webhook_log: PaymentWebhookLog
    ) -> Dict[str, Any]:
        """Traite un paiement échoué"""
        tx_ref = data.get("tx_ref", "")
        transaction_id = data.get("meta", {}).get("transaction_id")

        if not transaction_id and tx_ref.startswith("SM-"):
            parts = tx_ref.split("-")
            if len(parts) >= 2:
                transaction_id = parts[1]

        if not transaction_id:
            return {"status": "ignored"}

        result = await db.execute(
            select(Transaction).where(Transaction.id == int(transaction_id))
        )
        transaction = result.scalar_one_or_none()

        if transaction:
            error_msg = data.get("processor_response") or "Paiement échoué"
            transaction.mark_failed(error_msg)
            webhook_log.transaction_id = transaction.id

        webhook_log.processed = True
        webhook_log.processed_at = utc_now()
        await db.commit()

        return {"status": "failed", "transaction_id": transaction_id}

    # ==================== UTILITAIRES ====================

    def _verify_webhook(self, payload: Dict, headers: Dict) -> bool:
        """Vérifie la signature du webhook"""
        if self.is_test_mode:
            return True

        # Flutterwave envoie le hash dans le header
        signature = headers.get("verif-hash")
        if not signature:
            return False

        return signature == self.webhook_secret

    def _is_mobile_money(self, method: PaymentMethod) -> bool:
        """Vérifie si la méthode est un Mobile Money"""
        mobile_methods = [
            PaymentMethod.ORANGE_MONEY,
            PaymentMethod.WAVE,
            PaymentMethod.MTN_MOMO,
            PaymentMethod.MOOV_MONEY,
            PaymentMethod.MPESA,
            PaymentMethod.AIRTEL_MONEY,
        ]
        return method in mobile_methods

    def _get_payment_options(self, method: PaymentMethod, country_code: str) -> str:
        """Retourne les options de paiement Flutterwave"""
        if self._is_mobile_money(method):
            return f"mobilemoney{COUNTRY_MOBILE_SUFFIX.get(country_code, 'sn')}"
        elif method in [PaymentMethod.CARD_VISA, PaymentMethod.CARD_MASTERCARD]:
            return "card"
        elif method == PaymentMethod.BANK_TRANSFER:
            return "banktransfer"
        else:
            return "card,mobilemoney"

    def _get_mobile_charge_type(self, network: str, country_code: str) -> str:
        """Retourne le type de charge mobile money"""
        suffix = COUNTRY_MOBILE_SUFFIX.get(country_code, "sn")

        network_types = {
            "orange": f"mobile_money_{suffix}",
            "wave": f"mobile_money_{suffix}",
            "mtn": f"mobile_money_{suffix}",
            "airtel": f"mobile_money_{suffix}",
            "mpesa": "mpesa"
        }

        return network_types.get(network.lower(), f"mobile_money_{suffix}")

    # ==================== SIMULATION MODE TEST ====================

    def _simulate_payment(
        self,
        transaction: Transaction,
        plan: SubscriptionPlan,
        phone_number: str,
        success_url: str
    ) -> Dict[str, Any]:
        """Simule un paiement en mode test"""
        import uuid

        tx_ref = f"SM-{transaction.id}-{uuid.uuid4().hex[:8]}"
        base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

        method_name = transaction.payment_method.value.replace("_", " ").title()

        return {
            "checkout_id": tx_ref,
            "payment_url": f"{base_url}/payment/simulate?provider=flutterwave&tx_ref={tx_ref}&plan={plan.code}&method={method_name}",
            "requires_redirect": True,
            "test_mode": True,
            "message": f"Mode test Flutterwave ({method_name}) - Utilisez la page de simulation"
        }

    def _simulate_mobile_money(
        self,
        transaction: Transaction,
        phone_number: str,
        network: str
    ) -> Dict[str, Any]:
        """Simule un paiement Mobile Money"""
        import uuid

        tx_ref = f"SM-{transaction.id}-{uuid.uuid4().hex[:8]}"

        return {
            "checkout_id": tx_ref,
            "flw_ref": f"FLW-{uuid.uuid4().hex[:12]}",
            "status": "pending",
            "message": f"Mode test: Composez *144*4*{transaction.amount}# sur votre téléphone {phone_number}",
            "requires_redirect": False,
            "requires_ussd": True,
            "test_mode": True
        }


# Instance singleton
flutterwave_service = FlutterwaveService()
