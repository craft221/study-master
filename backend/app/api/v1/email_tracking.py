"""
Routes pour le tracking email, désinscription et webhooks Resend
"""

import logging
import hmac
import hashlib
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.database import get_db
from app.core.config import settings
from app.core.datetime_utils import utc_now
from app.models.user import User
from app.models.email_event import EmailEvent
from app.models.notification import NotificationPreference
from app.services.email_service import verify_unsubscribe_token

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

router = APIRouter()

# =========================================================================
# Pixel de tracking (ouverture)
# =========================================================================

# 1x1 transparent GIF
TRANSPARENT_PIXEL = bytes([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
    0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
    0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
    0x01, 0x00, 0x3b
])


@router.get("/track/open/{event_id}")
async def track_email_open(
    event_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Enregistre l'ouverture d'un email via pixel tracking.
    Retourne un GIF transparent 1x1.
    """
    try:
        result = await db.execute(
            select(EmailEvent).where(EmailEvent.id == event_id)
        )
        event = result.scalar_one_or_none()

        if event and not event.opened_at:
            event.opened_at = utc_now()
            event.status = "opened"
            await db.commit()
            logger.debug(f"Email open tracked: event_id={event_id}")

    except Exception as e:
        logger.warning(f"Erreur tracking open: {e}")

    return Response(
        content=TRANSPARENT_PIXEL,
        media_type="image/gif",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@router.get("/track/click/{event_id}")
async def track_email_click(
    event_id: int,
    url: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Enregistre un clic dans un email et redirige vers l'URL cible.
    Valide que l'URL cible est bien du domaine Studera.
    """
    # Sécurité: valider l'URL de redirection (éviter open redirect)
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://studera.app')
    allowed_domains = [
        frontend_url.replace('https://', '').replace('http://', '').split(':')[0],
        'studera.app'
    ]

    from urllib.parse import urlparse
    parsed = urlparse(url)
    if parsed.hostname and not any(parsed.hostname.endswith(d) for d in allowed_domains):
        logger.warning(f"Click tracking: URL rejetée (domaine non autorisé): {url}")
        raise HTTPException(status_code=400, detail="URL non autorisée")

    try:
        result = await db.execute(
            select(EmailEvent).where(EmailEvent.id == event_id)
        )
        event = result.scalar_one_or_none()

        if event and not event.clicked_at:
            event.clicked_at = utc_now()
            if event.status != "bounced":
                event.status = "clicked"
            await db.commit()
            logger.debug(f"Email click tracked: event_id={event_id}")

    except Exception as e:
        logger.warning(f"Erreur tracking click: {e}")

    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=url, status_code=302)


# =========================================================================
# Désinscription (RGPD / CAN-SPAM)
# =========================================================================

@router.get("/unsubscribe")
@limiter.limit("10/minute")
async def unsubscribe_email(
    request: Request,
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Désactive les emails pour un utilisateur via token signé.
    Le token est un HMAC(user_id) — pas d'expiration (RGPD).
    """
    user_id = verify_unsubscribe_token(token)

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lien de désinscription invalide"
        )

    # Trouver l'utilisateur
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Utilisateur introuvable"
        )

    # Désactiver les emails dans NotificationPreference
    pref_result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user_id)
    )
    pref = pref_result.scalar_one_or_none()

    if pref:
        pref.email_enabled = False
    else:
        # Créer les préférences avec email désactivé
        pref = NotificationPreference(
            user_id=user_id,
            email_enabled=False
        )
        db.add(pref)

    # Désactiver aussi dans UserPreferences
    if user.preferences:
        user.preferences.email_notifications = False

    await db.commit()

    logger.info(f"Utilisateur {user_id} désinscrit des emails")

    return {
        "message": "Vous avez été désinscrit des emails Studera. Vous pouvez réactiver les emails dans vos paramètres."
    }


# =========================================================================
# Webhook Resend (bounces / complaints)
# =========================================================================

@router.post("/webhooks/resend")
async def resend_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Webhook Resend pour gérer bounces et plaintes.
    Vérifie la signature HMAC du webhook.
    """
    # Vérifier la signature si un secret est configuré
    webhook_secret = getattr(settings, 'RESEND_WEBHOOK_SECRET', '')

    if webhook_secret:
        signature = request.headers.get("svix-signature", "")
        svix_id = request.headers.get("svix-id", "")
        svix_timestamp = request.headers.get("svix-timestamp", "")

        if not signature or not svix_id or not svix_timestamp:
            logger.warning("Webhook Resend: headers de signature manquants")
            raise HTTPException(status_code=401, detail="Signature manquante")

        body = await request.body()

        # Resend utilise Svix pour les webhooks
        msg_to_sign = f"{svix_id}.{svix_timestamp}.{body.decode()}"
        try:
            import base64
            secret_bytes = base64.b64decode(webhook_secret.split("_")[-1]) if "whsec_" in webhook_secret else webhook_secret.encode()
            expected = hmac.new(
                secret_bytes,
                msg_to_sign.encode(),
                hashlib.sha256
            ).digest()
            expected_b64 = "v1," + __import__('base64').b64encode(expected).decode()

            # Resend peut envoyer plusieurs signatures séparées par des espaces
            signatures = signature.split(" ")
            if not any(hmac.compare_digest(s, expected_b64) for s in signatures):
                logger.warning("Webhook Resend: signature invalide")
                raise HTTPException(status_code=401, detail="Signature invalide")

        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Webhook Resend: erreur vérification signature: {e}")
            raise HTTPException(status_code=401, detail="Erreur de vérification")

        payload = __import__('json').loads(body)
    else:
        payload = await request.json()

    event_type = payload.get("type", "")
    data = payload.get("data", {})

    logger.info(f"Webhook Resend reçu: type={event_type}")

    if event_type in ("email.bounced", "email.complained"):
        email_id = data.get("email_id", "")
        to_email = ""

        # Extraire l'email du destinataire
        recipients = data.get("to", [])
        if recipients:
            to_email = recipients[0] if isinstance(recipients[0], str) else recipients[0].get("email", "")

        # Mettre à jour l'EmailEvent si on le trouve
        if email_id:
            result = await db.execute(
                select(EmailEvent).where(EmailEvent.provider_id == email_id)
            )
            event = result.scalar_one_or_none()

            if event:
                now = utc_now()
                if event_type == "email.bounced":
                    event.status = "bounced"
                    event.bounced_at = now
                    event.bounce_type = data.get("bounce", {}).get("type", "unknown")
                    event.bounce_reason = data.get("bounce", {}).get("description", "")
                else:
                    event.status = "complained"
                    event.complained_at = now

                to_email = to_email or event.to_email

        # Désactiver les emails pour cet utilisateur (bounce dur ou plainte)
        is_hard_bounce = event_type == "email.bounced" and data.get("bounce", {}).get("type") == "hard"
        is_complaint = event_type == "email.complained"

        if (is_hard_bounce or is_complaint) and to_email:
            # Trouver l'utilisateur par email
            user_result = await db.execute(
                select(User).where(User.email == to_email)
            )
            user = user_result.scalar_one_or_none()

            if user:
                # Désactiver les emails
                pref_result = await db.execute(
                    select(NotificationPreference).where(NotificationPreference.user_id == user.id)
                )
                pref = pref_result.scalar_one_or_none()

                if pref:
                    pref.email_enabled = False
                else:
                    pref = NotificationPreference(user_id=user.id, email_enabled=False)
                    db.add(pref)

                if user.preferences:
                    user.preferences.email_notifications = False

                action = "hard bounce" if is_hard_bounce else "complaint"
                logger.warning(f"Emails désactivés pour {to_email} suite à {action}")

        await db.commit()

    elif event_type == "email.delivered":
        email_id = data.get("email_id", "")
        if email_id:
            result = await db.execute(
                select(EmailEvent).where(EmailEvent.provider_id == email_id)
            )
            event = result.scalar_one_or_none()
            if event and event.status == "sent":
                event.status = "delivered"
                await db.commit()

    return {"received": True}
