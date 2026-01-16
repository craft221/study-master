"""
Service PayDunya
================

Intégration PayDunya pour les paiements en Afrique de l'Ouest:
- Cartes bancaires (Visa, Mastercard)
- Orange Money (Sénégal, Côte d'Ivoire, Mali, Burkina, etc.)
- Wave
- Free Money (Sénégal)
- MTN Mobile Money
- Moov Money

Documentation: https://paydunya.com/developers/docs
"""

import logging
import httpx
import uuid
from typing import Dict, Any, Optional
from datetime import datetime

from app.core.config import settings
from app.models.payment import Transaction, SubscriptionPlan, TransactionStatus, Currency

logger = logging.getLogger(__name__)


class PayDunyaService:
    """Service d'intégration PayDunya"""

    # URLs API PayDunya
    SANDBOX_URL = "https://app.paydunya.com/sandbox-api/v1"
    LIVE_URL = "https://app.paydunya.com/api/v1"

    # Pays supportés par PayDunya
    SUPPORTED_COUNTRIES = [
        "SN",  # Sénégal
        "CI",  # Côte d'Ivoire
        "BJ",  # Bénin
        "TG",  # Togo
        "BF",  # Burkina Faso
        "ML",  # Mali
        "NE",  # Niger
        "GW",  # Guinée-Bissau
    ]

    # Méthodes de paiement disponibles
    PAYMENT_CHANNELS = {
        "orange_money": "orange-money-senegal",
        "wave": "wave-senegal",
        "free_money": "free-money-senegal",
        "mtn_momo": "mtn-mobile-money",
        "moov_money": "moov-money",
        "card": "card",
        "card_visa": "card",
        "card_mastercard": "card",
    }

    def __init__(self):
        """Initialise le service PayDunya"""
        self.master_key = getattr(settings, 'PAYDUNYA_MASTER_KEY', '') or ''
        self.private_key = getattr(settings, 'PAYDUNYA_PRIVATE_KEY', '') or ''
        self.public_key = getattr(settings, 'PAYDUNYA_PUBLIC_KEY', '') or ''
        self.token = getattr(settings, 'PAYDUNYA_TOKEN', '') or ''

        # Mode test si clés non configurées ou mode dev
        self.is_test_mode = (
            not self.master_key or
            'test' in self.master_key.lower() or
            getattr(settings, 'ENVIRONMENT', 'development') == 'development'
        )

        self.base_url = self.SANDBOX_URL if self.is_test_mode else self.LIVE_URL

        logger.info(f"PayDunya initialisé - Mode: {'TEST' if self.is_test_mode else 'LIVE'}")

    def _get_headers(self) -> Dict[str, str]:
        """Retourne les headers d'authentification PayDunya"""
        return {
            "Content-Type": "application/json",
            "PAYDUNYA-MASTER-KEY": self.master_key,
            "PAYDUNYA-PRIVATE-KEY": self.private_key,
            "PAYDUNYA-PUBLIC-KEY": self.public_key,
            "PAYDUNYA-TOKEN": self.token,
        }

    async def initialize_payment(
        self,
        transaction: Transaction,
        plan: SubscriptionPlan,
        phone_number: str = None,
        success_url: str = None,
        cancel_url: str = None
    ) -> Dict[str, Any]:
        """
        Initialise un paiement PayDunya.

        Args:
            transaction: Transaction en cours
            plan: Plan d'abonnement
            phone_number: Numéro de téléphone (pour Mobile Money)
            success_url: URL de redirection après succès
            cancel_url: URL de redirection après annulation

        Returns:
            Dict avec payment_url ou instructions
        """
        logger.info(f"=== PAYDUNYA INIT ===")
        logger.info(f"Transaction: id={transaction.id}, method={transaction.payment_method}, currency={transaction.currency}")
        logger.info(f"Plan: {plan.code}, phone={phone_number}")
        logger.info(f"Test mode: {self.is_test_mode}")

        try:
            # Mode simulation si pas de clés configurées
            if self.is_test_mode and not self.master_key:
                logger.info("Mode simulation PayDunya - pas de clés configurées")
                return self._simulate_payment(transaction, plan, phone_number, success_url)

            # URLs par défaut
            base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            if not success_url:
                success_url = f"{base_url}/payment/success?provider=paydunya"
            if not cancel_url:
                cancel_url = f"{base_url}/payment/cancel?provider=paydunya"

            # Construire la requête PayDunya
            invoice_data = {
                "invoice": {
                    "total_amount": transaction.amount,
                    "description": f"Abonnement {plan.name} - Studera",
                },
                "store": {
                    "name": "Studera",
                    "tagline": "Plateforme d'apprentissage intelligente",
                    "phone": getattr(settings, 'SUPPORT_PHONE', ''),
                    "postal_address": getattr(settings, 'SUPPORT_ADDRESS', ''),
                    "website_url": base_url,
                },
                "actions": {
                    "return_url": success_url,
                    "cancel_url": cancel_url,
                    "callback_url": f"{getattr(settings, 'BACKEND_URL', 'http://localhost:8000')}/api/v1/payments/webhook/paydunya",
                },
                "custom_data": {
                    "transaction_id": str(transaction.id),
                    "plan_code": plan.code,
                    "user_id": str(transaction.user_id),
                }
            }

            # Ajouter le numéro de téléphone si Mobile Money
            payment_method = transaction.payment_method.value
            if phone_number and payment_method in self.PAYMENT_CHANNELS:
                channel = self.PAYMENT_CHANNELS.get(payment_method, "card")
                invoice_data["invoice"]["channels"] = [channel]

                # Pour Mobile Money, on peut pré-remplir le numéro
                if "money" in payment_method or "wave" in payment_method or "momo" in payment_method:
                    invoice_data["custom_data"]["phone_number"] = phone_number

            # Appeler l'API PayDunya
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/checkout-invoice/create",
                    json=invoice_data,
                    headers=self._get_headers()
                )

                logger.info(f"PayDunya response status: {response.status_code}")

                if response.status_code == 200:
                    data = response.json()

                    if data.get("response_code") == "00":
                        # Succès
                        return {
                            "checkout_id": data.get("token"),
                            "payment_url": data.get("response_text"),  # URL de paiement
                            "requires_redirect": True,
                            "test_mode": self.is_test_mode,
                            "message": "Redirection vers PayDunya..."
                        }
                    else:
                        # Erreur PayDunya
                        error_msg = data.get("response_text", "Erreur PayDunya inconnue")
                        logger.error(f"Erreur PayDunya: {error_msg}")
                        raise ValueError(f"Erreur PayDunya: {error_msg}")
                else:
                    logger.error(f"Erreur HTTP PayDunya: {response.status_code} - {response.text}")
                    raise ValueError(f"Erreur de communication avec PayDunya: {response.status_code}")

        except httpx.TimeoutException:
            logger.error("Timeout lors de la connexion à PayDunya")
            raise ValueError("Le service de paiement est temporairement indisponible")
        except Exception as e:
            logger.error(f"Erreur PayDunya: {e}")
            raise

    async def verify_payment(self, token: str) -> Dict[str, Any]:
        """
        Vérifie le statut d'un paiement PayDunya.

        Args:
            token: Token de la transaction PayDunya

        Returns:
            Dict avec le statut et les détails
        """
        try:
            if self.is_test_mode and not self.master_key:
                # Mode simulation
                return {
                    "status": "completed",
                    "transaction_id": token,
                    "test_mode": True
                }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/checkout-invoice/confirm/{token}",
                    headers=self._get_headers()
                )

                if response.status_code == 200:
                    data = response.json()

                    status_map = {
                        "completed": TransactionStatus.SUCCESS,
                        "pending": TransactionStatus.PENDING,
                        "cancelled": TransactionStatus.CANCELLED,
                        "failed": TransactionStatus.FAILED,
                    }

                    paydunya_status = data.get("status", "pending")

                    return {
                        "status": status_map.get(paydunya_status, TransactionStatus.PENDING),
                        "paydunya_status": paydunya_status,
                        "transaction_id": data.get("invoice", {}).get("token"),
                        "amount": data.get("invoice", {}).get("total_amount"),
                        "customer": data.get("customer", {}),
                        "custom_data": data.get("custom_data", {}),
                    }
                else:
                    logger.error(f"Erreur vérification PayDunya: {response.status_code}")
                    return {"status": TransactionStatus.PENDING, "error": "Vérification impossible"}

        except Exception as e:
            logger.error(f"Erreur vérification PayDunya: {e}")
            return {"status": TransactionStatus.PENDING, "error": str(e)}

    def handle_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Traite un webhook PayDunya.

        Args:
            payload: Données du webhook

        Returns:
            Dict avec le résultat du traitement
        """
        try:
            data = payload.get("data", payload)

            status = data.get("status", "")
            invoice = data.get("invoice", {})
            custom_data = data.get("custom_data", {})

            transaction_id = custom_data.get("transaction_id")

            status_map = {
                "completed": TransactionStatus.SUCCESS,
                "pending": TransactionStatus.PENDING,
                "cancelled": TransactionStatus.CANCELLED,
                "failed": TransactionStatus.FAILED,
            }

            return {
                "transaction_id": int(transaction_id) if transaction_id else None,
                "status": status_map.get(status, TransactionStatus.PENDING),
                "paydunya_token": invoice.get("token"),
                "amount": invoice.get("total_amount"),
                "customer_name": data.get("customer", {}).get("name"),
                "customer_phone": data.get("customer", {}).get("phone"),
            }

        except Exception as e:
            logger.error(f"Erreur traitement webhook PayDunya: {e}")
            return {"error": str(e)}

    def _simulate_payment(
        self,
        transaction: Transaction,
        plan: SubscriptionPlan,
        phone_number: str,
        success_url: str
    ) -> Dict[str, Any]:
        """Simule un paiement en mode test"""
        tx_ref = f"PDTEST-{transaction.id}-{uuid.uuid4().hex[:8]}"
        base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

        method_name = transaction.payment_method.value.replace("_", " ").title()

        return {
            "checkout_id": tx_ref,
            "payment_url": f"{base_url}/payment/simulate?provider=paydunya&tx_ref={tx_ref}&plan={plan.code}&method={method_name}&amount={transaction.amount}",
            "requires_redirect": True,
            "test_mode": True,
            "message": f"Mode test PayDunya ({method_name}) - Utilisez la page de simulation"
        }

    @staticmethod
    def is_country_supported(country_code: str) -> bool:
        """Vérifie si le pays est supporté par PayDunya"""
        return country_code.upper() in PayDunyaService.SUPPORTED_COUNTRIES

    @staticmethod
    def get_supported_methods(country_code: str) -> list:
        """Retourne les méthodes de paiement disponibles pour un pays"""
        country = country_code.upper()

        # Méthodes par pays
        methods_by_country = {
            "SN": ["orange_money", "wave", "free_money", "card"],  # Sénégal
            "CI": ["orange_money", "mtn_momo", "moov_money", "wave", "card"],  # Côte d'Ivoire
            "ML": ["orange_money", "moov_money", "card"],  # Mali
            "BF": ["orange_money", "moov_money", "card"],  # Burkina Faso
            "BJ": ["mtn_momo", "moov_money", "card"],  # Bénin
            "TG": ["moov_money", "card"],  # Togo
            "NE": ["orange_money", "moov_money", "card"],  # Niger
            "GW": ["orange_money", "card"],  # Guinée-Bissau
        }

        return methods_by_country.get(country, ["card"])


# Instance singleton
paydunya_service = PayDunyaService()
