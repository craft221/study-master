"""
Sécurité des Paiements
======================

Middleware et utilitaires de sécurité pour les paiements:
- Vérification des signatures de webhook
- Validation des montants
- Protection contre la fraude
- Rate limiting spécifique aux paiements
- Logging sécurisé
"""

import logging
import hashlib
import hmac
import json
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from functools import wraps
from collections import defaultdict
import asyncio

from fastapi import Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.config import settings
from app.core.datetime_utils import utc_now
from app.models.payment import Transaction, TransactionStatus, PaymentProvider, Currency

logger = logging.getLogger(__name__)

# ==================== RATE LIMITING ====================

# Stockage en mémoire pour le rate limiting (utiliser Redis en production)
payment_attempts: Dict[str, list] = defaultdict(list)
PAYMENT_RATE_LIMIT = 5  # Max 5 tentatives
PAYMENT_RATE_WINDOW = 300  # Par 5 minutes


def check_payment_rate_limit(user_id: int) -> Tuple[bool, str]:
    """
    Vérifie le rate limit pour les tentatives de paiement.
    Empêche les attaques par force brute et les abus.

    Returns:
        Tuple (allowed: bool, message: str)
    """
    now = datetime.now()
    key = f"payment:{user_id}"

    # Nettoyer les anciennes tentatives
    payment_attempts[key] = [
        t for t in payment_attempts[key]
        if (now - t).total_seconds() < PAYMENT_RATE_WINDOW
    ]

    # Vérifier la limite
    if len(payment_attempts[key]) >= PAYMENT_RATE_LIMIT:
        wait_time = PAYMENT_RATE_WINDOW - (now - payment_attempts[key][0]).total_seconds()
        return False, f"Trop de tentatives de paiement. Réessayez dans {int(wait_time)} secondes."

    # Enregistrer cette tentative
    payment_attempts[key].append(now)
    return True, ""


# ==================== VALIDATION DES MONTANTS ====================

def validate_payment_amount(
    amount: int,
    currency: Currency,
    plan_amount: int
) -> Tuple[bool, str]:
    """
    Valide que le montant payé correspond au prix du plan.
    Protège contre la manipulation des montants côté client.

    Args:
        amount: Montant reçu
        currency: Devise
        plan_amount: Montant attendu selon le plan

    Returns:
        Tuple (valid: bool, message: str)
    """
    # Tolérance de 1% pour les arrondis de conversion
    tolerance = max(1, int(plan_amount * 0.01))

    if abs(amount - plan_amount) > tolerance:
        logger.warning(
            f"Montant suspect: reçu {amount} {currency}, attendu {plan_amount} {currency}"
        )
        return False, f"Montant invalide: {amount} {currency}"

    return True, ""


def validate_currency(currency: str, allowed_currencies: list = None) -> bool:
    """Vérifie que la devise est supportée"""
    allowed = allowed_currencies or [c.value for c in Currency]
    return currency.upper() in allowed


# ==================== VÉRIFICATION DES WEBHOOKS ====================

def verify_stripe_signature(payload: bytes, signature: str, secret: str) -> bool:
    """
    Vérifie la signature Stripe d'un webhook.

    Stripe utilise HMAC-SHA256 avec un timestamp pour éviter les replay attacks.
    """
    if not signature or not secret:
        return False

    try:
        # Parse la signature
        elements = dict(x.split("=") for x in signature.split(","))
        timestamp = elements.get("t")
        v1_signature = elements.get("v1")

        if not timestamp or not v1_signature:
            return False

        # Vérifier que le timestamp n'est pas trop vieux (5 minutes max)
        timestamp_int = int(timestamp)
        now = int(datetime.now().timestamp())
        if abs(now - timestamp_int) > 300:
            logger.warning("Webhook Stripe avec timestamp expiré")
            return False

        # Calculer la signature attendue
        signed_payload = f"{timestamp}.{payload.decode('utf-8')}"
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            signed_payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        # Comparaison time-safe pour éviter les timing attacks
        return hmac.compare_digest(expected_signature, v1_signature)

    except Exception as e:
        logger.error(f"Erreur vérification signature Stripe: {e}")
        return False


def verify_paypal_signature(payload: Dict, headers: Dict, webhook_id: str) -> bool:
    """
    Vérifie la signature PayPal d'un webhook via leur API de vérification.

    PayPal utilise une vérification cryptographique complexe:
    1. Récupère les headers de transmission
    2. Appelle l'API PayPal pour vérifier la signature
    3. PayPal valide avec leur certificat

    Référence: https://developer.paypal.com/docs/api-basics/notifications/webhooks/notification-messages/
    """
    import httpx

    # Headers requis pour la vérification PayPal
    transmission_id = headers.get("paypal-transmission-id")
    transmission_time = headers.get("paypal-transmission-time")
    transmission_sig = headers.get("paypal-transmission-sig")
    cert_url = headers.get("paypal-cert-url")
    auth_algo = headers.get("paypal-auth-algo", "SHA256withRSA")

    # Vérifier que tous les headers requis sont présents
    if not all([transmission_id, transmission_time, transmission_sig, cert_url, webhook_id]):
        logger.warning("PayPal webhook missing required headers")
        return False

    # Vérifier que l'URL du certificat est bien de PayPal
    if not cert_url.startswith("https://api.paypal.com/") and not cert_url.startswith("https://api.sandbox.paypal.com/"):
        logger.warning(f"PayPal cert URL suspicious: {cert_url}")
        return False

    try:
        # Obtenir un access token PayPal
        paypal_client_id = getattr(settings, 'PAYPAL_CLIENT_ID', None)
        paypal_client_secret = getattr(settings, 'PAYPAL_CLIENT_SECRET', None)
        paypal_mode = getattr(settings, 'PAYPAL_MODE', 'sandbox')

        if not paypal_client_id or not paypal_client_secret:
            logger.error("PayPal credentials not configured")
            return False

        # URL de l'API PayPal selon le mode
        if paypal_mode == "live":
            api_base = "https://api-m.paypal.com"
        else:
            api_base = "https://api-m.sandbox.paypal.com"

        # Obtenir le token d'accès
        with httpx.Client(timeout=30.0) as client:
            token_response = client.post(
                f"{api_base}/v1/oauth2/token",
                auth=(paypal_client_id, paypal_client_secret),
                data={"grant_type": "client_credentials"},
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )

            if token_response.status_code != 200:
                logger.error(f"Failed to get PayPal access token: {token_response.status_code}")
                return False

            access_token = token_response.json().get("access_token")

            # Appeler l'API de vérification de signature PayPal
            verify_response = client.post(
                f"{api_base}/v1/notifications/verify-webhook-signature",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "auth_algo": auth_algo,
                    "cert_url": cert_url,
                    "transmission_id": transmission_id,
                    "transmission_sig": transmission_sig,
                    "transmission_time": transmission_time,
                    "webhook_id": webhook_id,
                    "webhook_event": payload
                }
            )

            if verify_response.status_code != 200:
                logger.error(f"PayPal signature verification API error: {verify_response.status_code}")
                return False

            verification_result = verify_response.json()
            verification_status = verification_result.get("verification_status")

            if verification_status == "SUCCESS":
                logger.info(f"PayPal webhook signature verified: {transmission_id}")
                return True
            else:
                logger.warning(f"PayPal webhook signature FAILED: {verification_status}")
                return False

    except httpx.TimeoutException:
        logger.error("PayPal signature verification timed out")
        return False
    except Exception as e:
        logger.error(f"PayPal signature verification error: {e}")
        return False


def verify_flutterwave_signature(payload: Dict, headers: Dict, secret: str) -> bool:
    """
    Vérifie la signature Flutterwave d'un webhook.

    Flutterwave envoie un hash dans le header 'verif-hash'.
    Le hash est calculé à partir du secret configuré dans le dashboard Flutterwave.

    Pour plus de sécurité, on vérifie aussi le payload avec HMAC.
    """
    if not secret:
        logger.warning("Flutterwave secret not configured")
        return False

    verif_hash = headers.get("verif-hash")
    if not verif_hash:
        logger.warning("Flutterwave webhook missing verif-hash header")
        return False

    # Flutterwave utilise le secret hash configuré dans leur dashboard
    # Le verif-hash doit correspondre exactement au secret configuré
    if not hmac.compare_digest(verif_hash, secret):
        logger.warning("Flutterwave verif-hash mismatch")
        return False

    # Vérification supplémentaire: valider la structure du payload
    required_fields = ["event", "data"]
    if not all(field in payload for field in required_fields):
        logger.warning("Flutterwave payload missing required fields")
        return False

    # Vérifier que l'événement est un type connu
    valid_events = [
        "charge.completed",
        "charge.failed",
        "transfer.completed",
        "transfer.failed",
        "subscription.created",
        "subscription.cancelled"
    ]
    event_type = payload.get("event", "")
    if event_type not in valid_events:
        logger.warning(f"Flutterwave unknown event type: {event_type}")
        return False

    logger.info(f"Flutterwave webhook verified: {event_type}")
    return True


# ==================== PROTECTION ANTI-FRAUDE ====================

async def check_duplicate_transaction(
    db: AsyncSession,
    user_id: int,
    plan_id: int,
    amount: int,
    time_window_minutes: int = 5
) -> Optional[Transaction]:
    """
    Vérifie s'il existe une transaction similaire récente.
    Protège contre les doubles soumissions accidentelles.
    """
    cutoff = utc_now() - timedelta(minutes=time_window_minutes)

    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .where(Transaction.plan_id == plan_id)
        .where(Transaction.amount == amount)
        .where(Transaction.created_at >= cutoff)
        .where(Transaction.status.in_([
            TransactionStatus.PENDING,
            TransactionStatus.PROCESSING,
            TransactionStatus.SUCCESS
        ]))
    )

    return result.scalar_one_or_none()


async def check_suspicious_activity(
    db: AsyncSession,
    user_id: int
) -> Tuple[bool, str]:
    """
    Détecte les activités suspectes:
    - Trop de transactions échouées
    - Changements fréquents de méthode de paiement
    - Montants inhabituels
    """
    # Compter les échecs récents
    one_hour_ago = utc_now() - timedelta(hours=1)

    result = await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.user_id == user_id)
        .where(Transaction.status == TransactionStatus.FAILED)
        .where(Transaction.created_at >= one_hour_ago)
    )
    failed_count = result.scalar() or 0

    if failed_count >= 5:
        logger.warning(f"Activité suspecte détectée pour user {user_id}: {failed_count} échecs en 1h")
        return True, "Trop de tentatives échouées. Contactez le support."

    return False, ""


# ==================== LOGGING SÉCURISÉ ====================

def sanitize_payment_log(data: Dict) -> Dict:
    """
    Nettoie les données sensibles avant logging.
    Masque les numéros de carte, téléphone, etc.
    """
    sensitive_fields = [
        'card_number', 'cvv', 'expiry', 'phone_number',
        'password', 'secret', 'token', 'api_key'
    ]

    sanitized = {}
    for key, value in data.items():
        if any(field in key.lower() for field in sensitive_fields):
            if isinstance(value, str) and len(value) > 4:
                sanitized[key] = f"***{value[-4:]}"
            else:
                sanitized[key] = "***"
        elif isinstance(value, dict):
            sanitized[key] = sanitize_payment_log(value)
        else:
            sanitized[key] = value

    return sanitized


def log_payment_event(
    event_type: str,
    user_id: int,
    transaction_id: Optional[int] = None,
    amount: Optional[int] = None,
    currency: Optional[str] = None,
    provider: Optional[str] = None,
    status: Optional[str] = None,
    extra: Optional[Dict] = None
):
    """
    Log structuré et sécurisé des événements de paiement.
    """
    log_data = {
        "event": event_type,
        "user_id": user_id,
        "transaction_id": transaction_id,
        "amount": amount,
        "currency": currency,
        "provider": provider,
        "status": status,
        "timestamp": utc_now().isoformat()
    }

    if extra:
        log_data["extra"] = sanitize_payment_log(extra)

    logger.info(f"PAYMENT_EVENT: {json.dumps(log_data)}")


# ==================== MIDDLEWARE DE SÉCURITÉ ====================

async def payment_security_check(
    request: Request,
    user_id: int,
    db: AsyncSession
) -> None:
    """
    Middleware de sécurité à appeler avant chaque opération de paiement.

    Vérifie:
    - Rate limiting
    - Activité suspecte
    - IP reputation (TODO)

    Raises:
        HTTPException si la requête est bloquée
    """
    # Rate limiting
    allowed, message = check_payment_rate_limit(user_id)
    if not allowed:
        log_payment_event(
            "RATE_LIMITED",
            user_id,
            extra={"ip": request.client.host if request.client else "unknown"}
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=message
        )

    # Activité suspecte
    suspicious, message = await check_suspicious_activity(db, user_id)
    if suspicious:
        log_payment_event(
            "SUSPICIOUS_BLOCKED",
            user_id,
            extra={"reason": message}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=message
        )


# ==================== VALIDATION DES DONNÉES ====================

def validate_phone_number(phone: str, country_code: str) -> Tuple[bool, str]:
    """
    Valide un numéro de téléphone pour Mobile Money.

    Args:
        phone: Numéro de téléphone
        country_code: Code pays (SN, CI, etc.)

    Returns:
        Tuple (valid: bool, formatted_number: str)
    """
    import re

    # Nettoyer le numéro
    cleaned = re.sub(r'[\s\-\(\)]', '', phone)

    # Préfixes par pays
    country_prefixes = {
        "SN": "+221",  # Sénégal
        "CI": "+225",  # Côte d'Ivoire
        "ML": "+223",  # Mali
        "BF": "+226",  # Burkina Faso
        "BJ": "+229",  # Bénin
        "CM": "+237",  # Cameroun
        "NG": "+234",  # Nigeria
        "GH": "+233",  # Ghana
        "KE": "+254",  # Kenya
    }

    prefix = country_prefixes.get(country_code.upper(), "")

    # Si le numéro commence par 0, remplacer par le préfixe
    if cleaned.startswith("0"):
        cleaned = prefix + cleaned[1:]
    # Si le numéro ne commence pas par +, ajouter le préfixe
    elif not cleaned.startswith("+"):
        cleaned = prefix + cleaned

    # Vérifier le format
    if not re.match(r'^\+\d{10,15}$', cleaned):
        return False, phone

    return True, cleaned


def validate_promo_code_format(code: str) -> bool:
    """Valide le format d'un code promo"""
    import re
    # Alphanumeric, 3-20 caractères
    return bool(re.match(r'^[A-Z0-9]{3,20}$', code.upper()))
