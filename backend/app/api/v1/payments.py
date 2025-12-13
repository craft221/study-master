"""
API de Paiement
===============

Endpoints pour gérer les paiements et abonnements:
- Liste des plans
- Méthodes de paiement disponibles
- Création de paiement
- Webhooks
- Statut et historique
"""

import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_user
from app.core.datetime_utils import utc_now
from app.core.payment_security import (
    payment_security_check,
    check_duplicate_transaction,
    validate_phone_number,
    validate_promo_code_format,
    log_payment_event,
    verify_stripe_signature,
    verify_flutterwave_signature
)
from app.models.user import User
from app.models.document import Document
from app.models.payment import (
    Transaction, TransactionStatus, PaymentProvider, PaymentMethod,
    SubscriptionPlan, Currency, PromoCode, PaymentWebhookLog
)
from app.schemas.payment import (
    SubscriptionPlanResponse, PlanListResponse,
    AvailableMethodsResponse, PaymentMethodInfo,
    CreatePaymentRequest, CreatePaymentResponse,
    TransactionResponse, TransactionListResponse, TransactionStatusResponse,
    ValidatePromoRequest, PromoCodeResponse,
    WebhookResponse,
    PaymentCallbackRequest, PaymentSuccessResponse,
    UserSubscriptionResponse,
    SimulatePaymentRequest, SimulatePaymentResponse,
    PaymentMethodEnum, CurrencyEnum
)
from app.services.payment_service import payment_service, initialize_subscription_plans

router = APIRouter(prefix="/payments", tags=["Payments"])
logger = logging.getLogger(__name__)


# ==================== PLANS ====================

@router.get("/plans", response_model=PlanListResponse)
async def get_subscription_plans(
    db: AsyncSession = Depends(get_db),
    currency: Optional[CurrencyEnum] = Query(None, description="Devise pour les prix")
):
    """
    Récupère la liste des plans d'abonnement disponibles.

    Les prix sont retournés dans toutes les devises supportées.
    """
    result = await db.execute(
        select(SubscriptionPlan)
        .where(SubscriptionPlan.is_active == True)
        .order_by(SubscriptionPlan.display_order)
    )
    plans = result.scalars().all()

    if not plans:
        # Initialiser les plans si vides
        await initialize_subscription_plans(db)
        result = await db.execute(
            select(SubscriptionPlan)
            .where(SubscriptionPlan.is_active == True)
            .order_by(SubscriptionPlan.display_order)
        )
        plans = result.scalars().all()

    return PlanListResponse(
        plans=[SubscriptionPlanResponse.from_db(p) for p in plans],
        recommended_plan="premium"
    )


@router.get("/plans/{plan_code}", response_model=SubscriptionPlanResponse)
async def get_plan_details(
    plan_code: str,
    db: AsyncSession = Depends(get_db)
):
    """Récupère les détails d'un plan spécifique."""
    result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.code == plan_code)
    )
    plan = result.scalar_one_or_none()

    if not plan:
        raise HTTPException(status_code=404, detail="Plan non trouvé")

    return SubscriptionPlanResponse.from_db(plan)


# ==================== MÉTHODES DE PAIEMENT ====================

@router.get("/methods", response_model=AvailableMethodsResponse)
async def get_available_payment_methods(
    country_code: Optional[str] = Query(None, description="Code pays ISO (ex: SN, FR)"),
    currency: Optional[CurrencyEnum] = Query(None, description="Devise préférée")
):
    """
    Récupère les méthodes de paiement disponibles.

    Filtre automatiquement selon le pays:
    - Europe/International: Carte, PayPal
    - Afrique: Carte, Mobile Money (Orange, Wave, MTN...)
    """
    currency_enum = Currency(currency.value) if currency else None
    methods = await payment_service.get_available_methods(country_code, currency_enum)

    return AvailableMethodsResponse(
        cards=[PaymentMethodInfo(**m) for m in methods["cards"]],
        mobile_money=[PaymentMethodInfo(**m) for m in methods["mobile_money"]],
        other=[PaymentMethodInfo(**m) for m in methods["other"]],
        recommended_currency=methods["recommended_currency"],
        country_code=methods.get("country_code")
    )


# ==================== CRÉATION DE PAIEMENT ====================

@router.post("/create", response_model=CreatePaymentResponse)
async def create_payment(
    request: CreatePaymentRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Crée une nouvelle transaction de paiement.

    Retourne une URL de paiement (Stripe Checkout, PayPal, ou Flutterwave).
    Le frontend doit rediriger l'utilisateur vers cette URL.

    Sécurité:
    - Rate limiting sur les tentatives de paiement
    - Détection des transactions dupliquées
    - Validation des numéros de téléphone pour Mobile Money
    - Logging sécurisé de tous les événements
    """
    logger.info(f"=== CRÉATION PAIEMENT ===")
    logger.info(f"User ID: {current_user.id}")
    logger.info(f"Request: plan={request.plan_code}, method={request.payment_method}, currency={request.currency}, country={request.country_code}, phone={request.phone_number}")
    try:
        # === VÉRIFICATIONS DE SÉCURITÉ ===

        # 1. Rate limiting et détection d'activité suspecte
        await payment_security_check(http_request, current_user.id, db)

        # 2. Valider le numéro de téléphone pour Mobile Money
        phone_number = request.phone_number
        mobile_methods = ['orange_money', 'wave', 'mtn_momo', 'mpesa', 'airtel_money', 'moov_money']
        if request.payment_method.value in mobile_methods:
            if not phone_number:
                raise HTTPException(
                    status_code=400,
                    detail="Numéro de téléphone requis pour Mobile Money"
                )
            valid, formatted_phone = validate_phone_number(
                phone_number,
                request.country_code or "SN"
            )
            if not valid:
                raise HTTPException(
                    status_code=400,
                    detail="Numéro de téléphone invalide. Format attendu: +221 XX XXX XX XX"
                )
            phone_number = formatted_phone

        # 3. Valider le format du code promo
        if request.promo_code and not validate_promo_code_format(request.promo_code):
            raise HTTPException(
                status_code=400,
                detail="Code promo invalide"
            )

        # 4. Récupérer le plan pour vérifier les transactions dupliquées
        plan_result = await db.execute(
            select(SubscriptionPlan).where(SubscriptionPlan.code == request.plan_code)
        )
        plan = plan_result.scalar_one_or_none()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan non trouvé")

        # 5. Vérifier les transactions dupliquées
        currency = Currency(request.currency.value) if request.currency else Currency.EUR
        amount = plan.get_price(currency)

        duplicate = await check_duplicate_transaction(
            db, current_user.id, plan.id, amount, time_window_minutes=5
        )
        if duplicate:
            log_payment_event(
                "DUPLICATE_BLOCKED",
                current_user.id,
                transaction_id=duplicate.id,
                extra={"plan": request.plan_code}
            )
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Une transaction similaire est déjà en cours",
                    "transaction_id": duplicate.id,
                    "status": duplicate.status.value
                }
            )

        # === CRÉATION DU PAIEMENT ===
        logger.info(f"Step 5: Création du paiement - amount={amount}, currency={currency}")

        log_payment_event(
            "PAYMENT_INITIATED",
            current_user.id,
            amount=amount,
            currency=currency.value,
            provider=request.payment_method.value,
            extra={"plan": request.plan_code}
        )

        # Convertir les enums
        logger.info(f"Step 6: Conversion PaymentMethod({request.payment_method.value})")
        payment_method = PaymentMethod(request.payment_method.value)
        logger.info(f"Step 7: PaymentMethod converti: {payment_method}")

        logger.info(f"Step 8: Appel payment_service.create_payment")
        result = await payment_service.create_payment(
            db=db,
            user=current_user,
            plan_code=request.plan_code,
            payment_method=payment_method,
            currency=currency,
            phone_number=phone_number,  # Numéro validé/formaté
            country_code=request.country_code,
            promo_code=request.promo_code,
            success_url=request.success_url,
            cancel_url=request.cancel_url
        )
        logger.info(f"Step 9: Résultat payment_service: {result}")

        # Formater le montant
        amount = result["amount"]
        curr = result["currency"]

        if curr in ["EUR", "USD", "GBP", "MAD"]:
            amount_formatted = f"{amount / 100:.2f} {curr}"
        else:
            amount_formatted = f"{amount:,} {curr}".replace(",", " ")

        return CreatePaymentResponse(
            transaction_id=result["transaction_id"],
            provider=result["provider"],
            payment_url=result.get("payment_url"),
            checkout_id=result.get("checkout_id"),
            client_secret=result.get("client_secret"),
            amount=amount,
            amount_formatted=amount_formatted,
            currency=curr,
            plan=result["plan"],
            requires_redirect=result.get("requires_redirect", True),
            test_mode=result.get("test_mode", False),
            message=result.get("message")
        )

    except ValueError as e:
        logger.error(f"ValueError création paiement: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        logger.error(f"Erreur création paiement: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création du paiement: {str(e)}")


# ==================== WEBHOOKS ====================

@router.post("/webhook/stripe", response_model=WebhookResponse)
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Webhook Stripe pour les notifications de paiement.

    Sécurité:
    - Vérification de la signature Stripe
    - Logging de tous les événements
    - Protection contre les replay attacks
    """
    try:
        # Récupérer le payload brut pour la vérification de signature
        raw_body = await request.body()
        headers = dict(request.headers)

        # Log de l'événement reçu
        log_payment_event(
            "WEBHOOK_RECEIVED",
            user_id=0,  # Pas d'user pour les webhooks
            provider="stripe",
            extra={"event_type": "webhook", "has_signature": "stripe-signature" in headers}
        )

        # Vérifier la signature en production
        stripe_signature = headers.get("stripe-signature", "")
        webhook_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', '')

        if webhook_secret and stripe_signature:
            if not verify_stripe_signature(raw_body, stripe_signature, webhook_secret):
                log_payment_event(
                    "WEBHOOK_SIGNATURE_INVALID",
                    user_id=0,
                    provider="stripe"
                )
                raise HTTPException(status_code=401, detail="Signature invalide")

        # Parser le payload
        import json
        payload = json.loads(raw_body)

        result = await payment_service.handle_webhook(
            db=db,
            provider=PaymentProvider.STRIPE,
            payload=payload,
            headers=headers
        )

        # Si le paiement est réussi, activer l'abonnement
        if result.get("requires_activation") and result.get("transaction_id"):
            await payment_service.confirm_payment(
                db=db,
                transaction_id=int(result["transaction_id"])
            )
            log_payment_event(
                "SUBSCRIPTION_ACTIVATED",
                user_id=0,
                transaction_id=int(result["transaction_id"]),
                provider="stripe"
            )

        return WebhookResponse(
            status=result.get("status", "received"),
            transaction_id=result.get("transaction_id")
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur webhook Stripe: {e}")
        return WebhookResponse(status="error", message=str(e))


@router.post("/webhook/paypal", response_model=WebhookResponse)
async def paypal_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Webhook PayPal pour les notifications de paiement."""
    try:
        payload = await request.json()
        headers = dict(request.headers)

        result = await payment_service.handle_webhook(
            db=db,
            provider=PaymentProvider.PAYPAL,
            payload=payload,
            headers=headers
        )

        if result.get("requires_activation") and result.get("transaction_id"):
            await payment_service.confirm_payment(
                db=db,
                transaction_id=int(result["transaction_id"])
            )

        return WebhookResponse(
            status=result.get("status", "received"),
            transaction_id=result.get("transaction_id")
        )

    except Exception as e:
        logger.error(f"Erreur webhook PayPal: {e}")
        return WebhookResponse(status="error", message=str(e))


@router.post("/webhook/flutterwave", response_model=WebhookResponse)
async def flutterwave_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Webhook Flutterwave pour les notifications de paiement."""
    try:
        payload = await request.json()
        headers = dict(request.headers)

        result = await payment_service.handle_webhook(
            db=db,
            provider=PaymentProvider.FLUTTERWAVE,
            payload=payload,
            headers=headers
        )

        if result.get("requires_activation") and result.get("transaction_id"):
            await payment_service.confirm_payment(
                db=db,
                transaction_id=int(result["transaction_id"])
            )

        return WebhookResponse(
            status=result.get("status", "received"),
            transaction_id=result.get("transaction_id")
        )

    except Exception as e:
        logger.error(f"Erreur webhook Flutterwave: {e}")
        return WebhookResponse(status="error", message=str(e))


# ==================== CALLBACK / CONFIRMATION ====================

@router.post("/callback", response_model=PaymentSuccessResponse)
async def payment_callback(
    request: PaymentCallbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Callback après retour de la page de paiement.

    Appelé par le frontend après redirection depuis Stripe/PayPal/Flutterwave.
    Vérifie et finalise le paiement.
    """
    try:
        transaction_id = request.transaction_id

        # Si pas d'ID direct, chercher par checkout_id
        if not transaction_id:
            query = select(Transaction).where(Transaction.user_id == current_user.id)

            if request.checkout_id:
                query = query.where(Transaction.provider_checkout_id == request.checkout_id)
            elif request.tx_ref:
                # Flutterwave tx_ref format: SM-{id}-{timestamp}
                parts = request.tx_ref.split("-")
                if len(parts) >= 2:
                    transaction_id = int(parts[1])
            elif request.order_id:
                query = query.where(Transaction.provider_checkout_id == request.order_id)

            if not transaction_id:
                result = await db.execute(query.order_by(desc(Transaction.created_at)).limit(1))
                transaction = result.scalar_one_or_none()
                if transaction:
                    transaction_id = transaction.id

        if not transaction_id:
            raise HTTPException(status_code=404, detail="Transaction non trouvée")

        # Confirmer le paiement
        result = await payment_service.confirm_payment(
            db=db,
            transaction_id=transaction_id,
            provider_data={"status": request.status}
        )

        # Récupérer les infos mises à jour
        trans_result = await db.execute(
            select(Transaction).where(Transaction.id == transaction_id)
        )
        transaction = trans_result.scalar_one_or_none()

        # Récupérer l'abonnement mis à jour
        await db.refresh(current_user)

        return PaymentSuccessResponse(
            success=True,
            message=result.get("message", "Paiement confirmé"),
            transaction_id=transaction_id,
            subscription_activated=True,
            subscription_type=current_user.subscription.subscription_type.value if current_user.subscription else "free",
            subscription_ends_at=current_user.subscription.subscription_ends_at if current_user.subscription else None,
            plan=transaction.plan.name if transaction and transaction.plan else "Premium"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur callback paiement: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la confirmation")


@router.get("/verify/{transaction_id}", response_model=TransactionStatusResponse)
async def verify_transaction(
    transaction_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Vérifie le statut d'une transaction."""
    result = await payment_service.get_transaction_status(
        db=db,
        transaction_id=transaction_id,
        user_id=current_user.id
    )

    if not result:
        raise HTTPException(status_code=404, detail="Transaction non trouvée")

    # Formater le montant
    amount = result["amount"]
    curr = result["currency"]
    if curr in ["EUR", "USD", "GBP", "MAD"]:
        amount_formatted = f"{amount / 100:.2f} {curr}"
    else:
        amount_formatted = f"{amount:,} {curr}".replace(",", " ")

    return TransactionStatusResponse(
        id=result["id"],
        status=TransactionStatusEnum(result["status"]),
        amount=amount,
        amount_formatted=amount_formatted,
        currency=curr,
        payment_method=result["payment_method"],
        created_at=result["created_at"],
        completed_at=result.get("completed_at")
    )


# ==================== HISTORIQUE ====================

@router.get("/history", response_model=TransactionListResponse)
async def get_transaction_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Récupère l'historique des transactions de l'utilisateur."""
    offset = (page - 1) * per_page

    # Compter le total
    count_result = await db.execute(
        select(Transaction).where(Transaction.user_id == current_user.id)
    )
    total = len(count_result.scalars().all())

    # Récupérer les transactions
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(desc(Transaction.created_at))
        .offset(offset)
        .limit(per_page)
    )
    transactions = result.scalars().all()

    # Formater les transactions
    formatted = []
    for t in transactions:
        amount = t.amount
        curr = t.currency.value
        if curr in ["EUR", "USD", "GBP", "MAD"]:
            amount_formatted = f"{amount / 100:.2f} {curr}"
        else:
            amount_formatted = f"{amount:,} {curr}".replace(",", " ")

        formatted.append(TransactionResponse(
            id=t.id,
            amount=t.amount,
            currency=CurrencyEnum(t.currency.value),
            status=TransactionStatusEnum(t.status.value),
            payment_method=PaymentMethodEnum(t.payment_method.value),
            provider=t.provider.value,
            created_at=t.created_at,
            completed_at=t.completed_at,
            plan_code=t.plan.code if t.plan else None,
            plan_name=t.plan.name if t.plan else None,
            amount_formatted=amount_formatted,
            status_message=t.status_message
        ))

    return TransactionListResponse(
        transactions=formatted,
        total=total,
        page=page,
        per_page=per_page
    )


# ==================== CODES PROMO ====================

@router.post("/promo/validate", response_model=PromoCodeResponse)
async def validate_promo_code(
    request: ValidatePromoRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Valide un code promotionnel."""
    result = await db.execute(
        select(PromoCode).where(PromoCode.code == request.code.upper())
    )
    promo = result.scalar_one_or_none()

    if not promo:
        return PromoCodeResponse(
            valid=False,
            code=request.code,
            message="Code invalide"
        )

    if not promo.is_valid():
        return PromoCodeResponse(
            valid=False,
            code=request.code,
            message="Code expiré ou limite atteinte"
        )

    # Vérifier les restrictions de plan
    if promo.applicable_plans and request.plan_code not in promo.applicable_plans:
        return PromoCodeResponse(
            valid=False,
            code=request.code,
            message="Code non applicable à ce plan"
        )

    # Récupérer le plan pour calculer la réduction
    plan_result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.code == request.plan_code)
    )
    plan = plan_result.scalar_one_or_none()

    if not plan:
        return PromoCodeResponse(
            valid=False,
            code=request.code,
            message="Plan non trouvé"
        )

    # Calculer la réduction
    currency = Currency(request.currency.value)
    amount = plan.get_price(currency)
    discount_amount = promo.calculate_discount(amount)

    return PromoCodeResponse(
        valid=True,
        code=promo.code,
        discount_type=promo.discount_type,
        discount_value=promo.discount_value,
        discount_amount=discount_amount,
        message=f"Réduction de {promo.discount_value}%" if promo.discount_type == "percentage" else f"Réduction de {discount_amount}",
        expires_at=promo.valid_until
    )


# ==================== ABONNEMENT UTILISATEUR ====================

@router.get("/subscription", response_model=UserSubscriptionResponse)
async def get_user_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Récupère les informations d'abonnement de l'utilisateur."""
    sub = current_user.subscription

    if not sub:
        raise HTTPException(status_code=404, detail="Abonnement non trouvé")

    # Calculer les jours restants
    days_remaining = None
    if sub.subscription_ends_at:
        delta = sub.subscription_ends_at - utc_now()
        days_remaining = max(0, delta.days)

    # Récupérer le plan actuel
    plan_result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.code == sub.subscription_type.value.lower())
    )
    plan = plan_result.scalar_one_or_none()

    features = plan.features if plan else []

    # Calculer le stockage utilisé (documents)
    storage_result = await db.execute(
        select(func.coalesce(func.sum(Document.file_size), 0))
        .where(Document.user_id == current_user.id)
    )
    storage_used_bytes = storage_result.scalar() or 0
    storage_used_mb = int(storage_used_bytes / (1024 * 1024))

    # Récupérer les requêtes AI du jour depuis ai_usage (via la propriété User)
    ai_requests_today = current_user.ai_requests_today or 0

    return UserSubscriptionResponse(
        subscription_type=sub.subscription_type.value,
        plan_name=plan.name if plan else sub.subscription_type.value,
        is_active=sub.subscription_ends_at is None or sub.subscription_ends_at > utc_now(),
        starts_at=sub.subscription_starts_at,
        ends_at=sub.subscription_ends_at,
        days_remaining=days_remaining,
        auto_renew=False,  # TODO: gérer le renouvellement auto
        ai_requests_limit=sub.ai_requests_limit,
        ai_requests_used_today=ai_requests_today,
        ai_requests_remaining=max(0, sub.ai_requests_limit - ai_requests_today),
        storage_limit_mb=sub.storage_limit_mb,
        storage_used_mb=storage_used_mb,
        features=features,
        can_upgrade=sub.subscription_type.value != "INSTITUTIONAL"
    )


# ==================== SIMULATION (MODE TEST) ====================

@router.post("/simulate", response_model=SimulatePaymentResponse)
async def simulate_payment(
    request: SimulatePaymentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Simule un paiement en mode test.

    Permet de tester le flux de paiement sans vraies transactions.
    """
    # Trouver la transaction par checkout_id
    query = select(Transaction).where(
        Transaction.user_id == current_user.id
    )

    # Chercher par différents formats de checkout_id
    if request.checkout_id.startswith("SM-"):
        parts = request.checkout_id.split("-")
        if len(parts) >= 2:
            query = query.where(Transaction.id == int(parts[1]))
    else:
        query = query.where(Transaction.provider_checkout_id == request.checkout_id)

    result = await db.execute(query)
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction non trouvée")

    if request.action == "approve":
        # Confirmer le paiement
        await payment_service.confirm_payment(
            db=db,
            transaction_id=transaction.id,
            provider_data={"simulated": True}
        )

        return SimulatePaymentResponse(
            success=True,
            message="Paiement simulé avec succès",
            redirect_url="/payment/success"
        )

    elif request.action == "decline":
        # Refuser le paiement
        transaction.mark_failed("Paiement refusé (simulation)")
        await db.commit()

        return SimulatePaymentResponse(
            success=False,
            message="Paiement refusé (simulation)",
            redirect_url="/payment/cancel"
        )

    else:
        raise HTTPException(status_code=400, detail="Action non valide (approve ou decline)")
