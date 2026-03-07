"""
Service Email - Envoi de notifications par email
Supporte Resend (recommandé) et SMTP (fallback)
Inclut: unsubscribe, tracking ouverture/clics, logging EmailEvent
"""

import logging
import smtplib
import httpx
import hmac
import hashlib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List, Dict, Any
from datetime import datetime
import asyncio
from concurrent.futures import ThreadPoolExecutor

from app.core.config import settings

logger = logging.getLogger(__name__)

# Thread pool pour les envois async SMTP
_executor = ThreadPoolExecutor(max_workers=3)


def generate_unsubscribe_token(user_id: int) -> str:
    """
    Génère un token HMAC signé pour le lien de désinscription.
    Pas de JWT/expiration — l'unsubscribe doit toujours fonctionner (RGPD).
    """
    message = f"unsubscribe:{user_id}"
    signature = hmac.new(
        settings.SECRET_KEY.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()[:32]
    return f"{user_id}:{signature}"


def verify_unsubscribe_token(token: str) -> Optional[int]:
    """Vérifie un token de désinscription et retourne le user_id."""
    try:
        parts = token.split(":", 1)
        if len(parts) != 2:
            return None
        user_id = int(parts[0])
        expected = generate_unsubscribe_token(user_id)
        if hmac.compare_digest(token, expected):
            return user_id
        return None
    except (ValueError, TypeError):
        return None


class EmailService:
    """Service d'envoi d'emails - Supporte Resend et SMTP"""

    def __init__(self):
        # Resend configuration (prioritaire)
        self.resend_api_key = getattr(settings, 'RESEND_API_KEY', '')
        self.resend_enabled = bool(self.resend_api_key)

        # SMTP configuration (fallback)
        self.smtp_host = getattr(settings, 'SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = getattr(settings, 'SMTP_PORT', 587)
        self.smtp_user = getattr(settings, 'SMTP_USER', '')
        self.smtp_password = getattr(settings, 'SMTP_PASSWORD', '')
        self.smtp_enabled = bool(self.smtp_user and self.smtp_password)

        # Common config
        self.from_email = getattr(settings, 'EMAIL_FROM', 'noreply@studera.app')
        self.from_name = getattr(settings, 'EMAIL_FROM_NAME', 'Studera')

        # Determine which provider to use
        if self.resend_enabled:
            logger.info("Email service: Resend activé")
            self.provider = "resend"
        elif self.smtp_enabled:
            logger.info("Email service: SMTP activé")
            self.provider = "smtp"
        else:
            logger.warning("Email service désactivé: Aucune configuration trouvée (RESEND_API_KEY ou SMTP)")
            self.provider = None

    @property
    def enabled(self) -> bool:
        return self.provider is not None

    # =========================================================================
    # Resend API
    # =========================================================================

    async def _send_resend(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> Optional[str]:
        """Envoi via Resend API. Retourne le provider_id ou None."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {self.resend_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "from": f"{self.from_name} <{self.from_email}>",
                        "to": [to_email],
                        "subject": subject,
                        "html": html_content,
                        "text": text_content or ""
                    },
                    timeout=30.0
                )

                if response.status_code in [200, 201]:
                    data = response.json()
                    provider_id = data.get('id', None)
                    logger.info(f"Email envoyé via Resend: {to_email} - {subject} (id: {provider_id})")
                    return provider_id
                else:
                    logger.error(f"Erreur Resend {response.status_code}: {response.text}")
                    return None

        except Exception as e:
            logger.error(f"Erreur envoi Resend à {to_email}: {e}")
            return None

    # =========================================================================
    # SMTP Fallback
    # =========================================================================

    def _create_message(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> MIMEMultipart:
        """Crée un message email MIME"""
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{self.from_name} <{self.from_email}>"
        msg['To'] = to_email

        if text_content:
            part_text = MIMEText(text_content, 'plain', 'utf-8')
            msg.attach(part_text)

        part_html = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part_html)

        return msg

    def _send_smtp_sync(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Envoi synchrone via SMTP"""
        try:
            msg = self._create_message(to_email, subject, html_content, text_content)

            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)

            logger.info(f"Email envoyé via SMTP: {to_email} - {subject}")
            return True

        except Exception as e:
            logger.error(f"Erreur envoi SMTP à {to_email}: {e}")
            return False

    async def _send_smtp(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Envoi asynchrone via SMTP"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _executor,
            self._send_smtp_sync,
            to_email, subject, html_content, text_content
        )

    # =========================================================================
    # Main Send Method
    # =========================================================================

    async def send_async(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        email_type: str = "general",
        user_id: Optional[int] = None
    ) -> bool:
        """
        Envoi asynchrone d'email avec logging dans EmailEvent.
        Utilise Resend si configuré, sinon SMTP.
        """
        if not self.enabled:
            logger.debug(f"Email skip (disabled): {to_email}")
            return False

        provider_id = None
        success = False

        if self.provider == "resend":
            provider_id = await self._send_resend(to_email, subject, html_content, text_content)
            success = provider_id is not None
        else:
            success = await self._send_smtp(to_email, subject, html_content, text_content)

        # Log dans EmailEvent (fire-and-forget, ne bloque pas l'envoi)
        try:
            await self._log_email_event(
                to_email=to_email,
                subject=subject,
                email_type=email_type,
                user_id=user_id,
                provider_id=provider_id,
                success=success
            )
        except Exception as e:
            logger.warning(f"Erreur logging email event: {e}")

        return success

    async def _log_email_event(
        self,
        to_email: str,
        subject: str,
        email_type: str,
        user_id: Optional[int],
        provider_id: Optional[str],
        success: bool
    ):
        """Log l'envoi d'email dans la table email_events"""
        try:
            from app.core.database import async_session_maker
            from app.models.email_event import EmailEvent

            async with async_session_maker() as db:
                event = EmailEvent(
                    user_id=user_id,
                    provider_id=provider_id,
                    to_email=to_email,
                    subject=subject,
                    email_type=email_type,
                    status="sent" if success else "failed"
                )
                db.add(event)
                await db.commit()
        except Exception as e:
            logger.warning(f"Impossible de logger l'email event: {e}")

    # =========================================================================
    # Templates d'emails
    # =========================================================================

    def _base_template(self, content: str, title: str = "Studera", user_id: Optional[int] = None, email_event_id: Optional[int] = None) -> str:
        """Template HTML de base - Design moderne avec lien désinscription et tracking"""
        frontend_url = getattr(settings, 'FRONTEND_URL', 'https://studera.app')
        api_url = frontend_url.replace(':3000', ':8000').replace(':3001', ':8000')
        if 'localhost' not in api_url and 'studera.app' in api_url:
            api_url = api_url.replace('https://studera.app', 'https://studera.app/api/v1').rstrip('/api/v1')
            api_url = frontend_url  # Use same domain, API is behind /api/v1

        # Lien de désinscription (RGPD obligatoire)
        unsubscribe_html = ""
        if user_id:
            unsub_token = generate_unsubscribe_token(user_id)
            unsubscribe_url = f"{frontend_url}/unsubscribe?token={unsub_token}"
            unsubscribe_html = f'<p><a href="{unsubscribe_url}" style="color: #999; font-size: 11px;">Se désinscrire des emails</a></p>'

        # Tracking pixel (1x1 transparent)
        tracking_pixel = ""
        if email_event_id:
            tracking_pixel = f'<img src="{frontend_url}/api/v1/email/track/open/{email_event_id}" width="1" height="1" style="display:none;" alt="" />'

        return f"""
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            background-color: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        .header {{
            text-align: center;
            margin-bottom: 30px;
        }}
        .logo {{
            font-size: 28px;
            font-weight: bold;
            color: #6366f1;
        }}
        .logo-icon {{
            font-size: 32px;
            margin-right: 8px;
        }}
        .content {{
            margin-bottom: 30px;
        }}
        .button {{
            display: inline-block;
            background-color: #6366f1;
            color: white !important;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 10px 0;
        }}
        .button:hover {{
            background-color: #4f46e5;
        }}
        .footer {{
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }}
        .highlight {{
            background-color: #fef3c7;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
        }}
        .stat {{
            display: inline-block;
            margin: 10px 15px;
            text-align: center;
        }}
        .stat-value {{
            font-size: 28px;
            font-weight: bold;
            color: #6366f1;
        }}
        .stat-label {{
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
        }}
        .code {{
            background-color: #f3f4f6;
            padding: 15px 25px;
            border-radius: 8px;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            text-align: center;
            color: #6366f1;
            margin: 20px 0;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">
                <span class="logo-icon">🐿️</span>Studera
            </div>
        </div>
        <div class="content">
            {content}
        </div>
        <div class="footer">
            <p>Cet email a été envoyé par Studera.</p>
            <p>&copy; 2025 Studera. Tous droits réservés.</p>
            {unsubscribe_html}
        </div>
    </div>
    {tracking_pixel}
</body>
</html>
"""

    # =========================================================================
    # Emails spécifiques
    # =========================================================================

    async def send_verification_code(
        self,
        to_email: str,
        username: str,
        code: str,
        user_id: Optional[int] = None
    ) -> bool:
        """Email de vérification avec code à 6 chiffres"""
        content = f"""
        <h2>Vérifie ton adresse email</h2>
        <p>Salut <strong>{username}</strong>,</p>
        <p>Voici ton code de vérification :</p>
        <div class="code">{code}</div>
        <p>Ce code expire dans <strong>15 minutes</strong>.</p>
        <p style="color: #666; font-size: 14px;">
            Si tu n'as pas créé de compte sur Studera, ignore cet email.
        </p>
        """
        html = self._base_template(content, "Vérifie ton email - Studera", user_id=user_id)
        text = f"Salut {username}, ton code de vérification Studera est: {code}. Ce code expire dans 15 minutes."

        return await self.send_async(to_email, f"Code de vérification: {code}", html, text, email_type="verification", user_id=user_id)

    async def send_password_reset(
        self,
        to_email: str,
        username: str,
        reset_url: str,
        user_id: Optional[int] = None
    ) -> bool:
        """Email de réinitialisation de mot de passe"""
        content = f"""
        <h2>Réinitialise ton mot de passe</h2>
        <p>Salut <strong>{username}</strong>,</p>
        <p>Tu as demandé à réinitialiser ton mot de passe.</p>
        <p>Clique sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
        <p style="text-align: center;">
            <a href="{reset_url}" class="button">Réinitialiser mon mot de passe</a>
        </p>
        <p style="color: #666; font-size: 14px;">
            Ce lien expire dans <strong>1 heure</strong>.<br>
            Si tu n'as pas demandé cette réinitialisation, ignore cet email.
        </p>
        """
        html = self._base_template(content, "Réinitialisation mot de passe - Studera", user_id=user_id)
        text = f"Salut {username}, clique sur ce lien pour réinitialiser ton mot de passe: {reset_url}"

        return await self.send_async(to_email, "Réinitialise ton mot de passe", html, text, email_type="password_reset", user_id=user_id)

    async def send_welcome(
        self,
        to_email: str,
        username: str,
        user_id: Optional[int] = None
    ) -> bool:
        """Email de bienvenue"""
        frontend_url = getattr(settings, 'FRONTEND_URL', 'https://studera.app')
        content = f"""
        <h2>Bienvenue sur Studera ! 🎉</h2>
        <p>Salut <strong>{username}</strong>,</p>
        <p>Ton compte a été créé avec succès. Tu fais maintenant partie de la communauté Studera !</p>
        <p>Voici ce que tu peux faire :</p>
        <ul>
            <li>📝 Créer des notes et les organiser par matière</li>
            <li>🤖 Générer des flashcards automatiquement avec l'IA</li>
            <li>📊 Tester tes connaissances avec des quiz</li>
            <li>⚔️ Défier tes amis en duel</li>
            <li>🏆 Suivre ta progression et gagner des succès</li>
        </ul>
        <p>Spark, notre mascotte, sera là pour t'accompagner ! 🐿️</p>
        <p style="text-align: center;">
            <a href="{frontend_url}/dashboard" class="button">Commencer à étudier</a>
        </p>
        """
        html = self._base_template(content, "Bienvenue sur Studera", user_id=user_id)
        text = f"Bienvenue {username} ! Ton compte Studera a été créé avec succès."

        return await self.send_async(to_email, "Bienvenue sur Studera ! 🎉", html, text, email_type="welcome", user_id=user_id)

    async def send_duel_challenge(
        self,
        to_email: str,
        username: str,
        challenger_name: str,
        stakes_xp: int,
        duel_url: str,
        user_id: Optional[int] = None
    ) -> bool:
        """Email de défi reçu"""
        content = f"""
        <h2>Nouveau défi ! ⚔️</h2>
        <p>Salut <strong>{username}</strong>,</p>
        <p><strong>{challenger_name}</strong> te lance un défi sur Studera !</p>
        <p>Enjeux: <span class="highlight">{stakes_xp} XP</span></p>
        <p>Accepte le défi et montre de quoi tu es capable !</p>
        <p style="text-align: center;">
            <a href="{duel_url}" class="button">Voir le défi</a>
        </p>
        """
        html = self._base_template(content, "Nouveau défi sur Studera", user_id=user_id)
        text = f"Salut {username}, {challenger_name} te défie sur Studera ! Enjeux: {stakes_xp} XP"

        return await self.send_async(to_email, f"⚔️ {challenger_name} te défie !", html, text, email_type="duel_challenge", user_id=user_id)

    async def send_streak_reminder(
        self,
        to_email: str,
        username: str,
        current_streak: int,
        user_id: Optional[int] = None
    ) -> bool:
        """Email de rappel de série"""
        frontend_url = getattr(settings, 'FRONTEND_URL', 'https://studera.app')
        content = f"""
        <h2>Ta série est en danger ! 🔥</h2>
        <p>Salut <strong>{username}</strong>,</p>
        <p>Tu as une série de <span class="highlight">{current_streak} jours</span> en cours.</p>
        <p>N'oublie pas d'étudier aujourd'hui pour la maintenir !</p>
        <p style="text-align: center;">
            <a href="{frontend_url}/dashboard" class="button">Étudier maintenant</a>
        </p>
        """
        html = self._base_template(content, "Garde ta série !", user_id=user_id)
        text = f"Salut {username}, ta série de {current_streak} jours est en danger ! Étudie aujourd'hui."

        return await self.send_async(to_email, f"🔥 Ta série de {current_streak} jours est en danger !", html, text, email_type="streak_reminder", user_id=user_id)

    async def send_event_reminder(
        self,
        to_email: str,
        username: str,
        event_title: str,
        event_time: datetime,
        event_url: str,
        user_id: Optional[int] = None
    ) -> bool:
        """Email de rappel d'événement"""
        time_str = event_time.strftime("%H:%M")
        date_str = event_time.strftime("%d/%m/%Y")

        content = f"""
        <h2>Rappel d'événement 📅</h2>
        <p>Salut <strong>{username}</strong>,</p>
        <p>N'oublie pas ton événement :</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <strong>{event_title}</strong><br>
            <span style="color: #666;">📅 {date_str} à {time_str}</span>
        </div>
        <p style="text-align: center;">
            <a href="{event_url}" class="button">Voir les détails</a>
        </p>
        """
        html = self._base_template(content, f"Rappel: {event_title}", user_id=user_id)
        text = f"Rappel: {event_title} le {date_str} à {time_str}"

        return await self.send_async(to_email, f"📅 Rappel: {event_title}", html, text, email_type="event_reminder", user_id=user_id)

    async def send_daily_digest(
        self,
        to_email: str,
        username: str,
        stats: Dict[str, Any],
        notifications: List[Dict[str, Any]],
        user_id: Optional[int] = None
    ) -> bool:
        """Email résumé quotidien"""
        frontend_url = getattr(settings, 'FRONTEND_URL', 'https://studera.app')
        stats_html = ""
        if stats:
            stats_html = f"""
            <div style="text-align: center; margin: 20px 0;">
                <div class="stat">
                    <div class="stat-value">{stats.get('streak', 0)}</div>
                    <div class="stat-label">Jours de série</div>
                </div>
                <div class="stat">
                    <div class="stat-value">{stats.get('xp_today', 0)}</div>
                    <div class="stat-label">XP aujourd'hui</div>
                </div>
                <div class="stat">
                    <div class="stat-value">{stats.get('cards_reviewed', 0)}</div>
                    <div class="stat-label">Cartes révisées</div>
                </div>
            </div>
            """

        notifs_html = ""
        if notifications:
            notifs_html = "<h3>Notifications non lues</h3><ul>"
            for notif in notifications[:5]:
                notifs_html += f"<li><strong>{notif.get('title')}</strong>: {notif.get('message')}</li>"
            notifs_html += "</ul>"

        content = f"""
        <h2>Ton résumé quotidien 📊</h2>
        <p>Salut <strong>{username}</strong> !</p>
        <p>Voici ton résumé Studera de la journée :</p>
        {stats_html}
        {notifs_html}
        <p style="text-align: center;">
            <a href="{frontend_url}/dashboard" class="button">Continuer à apprendre</a>
        </p>
        """
        html = self._base_template(content, "Ton résumé Studera", user_id=user_id)
        text = f"Salut {username}, voici ton résumé Studera quotidien."

        return await self.send_async(to_email, "📊 Ton résumé Studera du jour", html, text, email_type="daily_digest", user_id=user_id)

    async def send_achievement_unlocked(
        self,
        to_email: str,
        username: str,
        achievement_name: str,
        achievement_description: str,
        xp_reward: int,
        user_id: Optional[int] = None
    ) -> bool:
        """Email de succès débloqué"""
        frontend_url = getattr(settings, 'FRONTEND_URL', 'https://studera.app')
        content = f"""
        <h2>Félicitations ! 🏆</h2>
        <p>Salut <strong>{username}</strong>,</p>
        <p>Tu as débloqué un nouveau succès !</p>
        <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
            <div style="font-size: 48px;">🏆</div>
            <h3 style="margin: 10px 0;">{achievement_name}</h3>
            <p style="color: #666;">{achievement_description}</p>
            <p><strong>+{xp_reward} XP</strong></p>
        </div>
        <p style="text-align: center;">
            <a href="{frontend_url}/achievements" class="button">Voir tous tes succès</a>
        </p>
        """
        html = self._base_template(content, f"Succès débloqué: {achievement_name}", user_id=user_id)
        text = f"Félicitations {username} ! Tu as débloqué '{achievement_name}' et gagné {xp_reward} XP !"

        return await self.send_async(to_email, f"🏆 Succès débloqué: {achievement_name} !", html, text, email_type="achievement_unlocked", user_id=user_id)

    async def send_inactivity_reminder(
        self,
        to_email: str,
        username: str,
        days_absent: int,
        old_streak: int = 0,
        email_subject: str = "Tu nous manques sur Studera !",
        user_id: Optional[int] = None
    ) -> bool:
        """Email de rappel d'inactivité / réengagement"""
        frontend_url = getattr(settings, 'FRONTEND_URL', 'https://studera.app')
        streak_text = ""
        if old_streak > 0:
            streak_text = f"""
            <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center;">
                <span style="font-size: 24px;">💔</span>
                <p style="margin: 5px 0;">Tu avais une série de <strong>{old_streak} jours</strong></p>
                <p style="color: #666; font-size: 14px;">Reviens pour en commencer une nouvelle !</p>
            </div>
            """

        if days_absent >= 30:
            spark_mood = "🥺"
            intro = f"Ça fait {days_absent} jours... Spark ne t'a pas oublié !"
        elif days_absent >= 14:
            spark_mood = "😢"
            intro = f"2 semaines sans toi ! Tes amis continuent de progresser."
        elif days_absent >= 7:
            spark_mood = "😟"
            intro = f"Une semaine déjà ! Tes flashcards s'accumulent."
        else:
            spark_mood = "🐿️"
            intro = f"Ça fait {days_absent} jours qu'on ne s'est pas vus !"

        content = f"""
        <h2>{spark_mood} Spark te cherche partout !</h2>
        <p>Salut <strong>{username}</strong>,</p>
        <p>{intro}</p>
        {streak_text}
        <p>Juste <strong>5 minutes</strong> suffisent pour garder le rythme :</p>
        <ul>
            <li>📚 Révise quelques flashcards</li>
            <li>📝 Relis tes notes</li>
            <li>🎯 Fais un quiz rapide</li>
        </ul>
        <p style="text-align: center;">
            <a href="{frontend_url}/dashboard" class="button">Revenir étudier</a>
        </p>
        <p style="color: #666; font-size: 13px; text-align: center;">
            Spark t'attend ! 🐿️❤️
        </p>
        """
        html = self._base_template(content, "Tu nous manques !", user_id=user_id)
        text = f"Salut {username}, ça fait {days_absent} jours ! Reviens sur Studera."

        return await self.send_async(to_email, email_subject, html, text, email_type="inactivity_reminder", user_id=user_id)

    async def send_flashcard_reminder(
        self,
        to_email: str,
        username: str,
        cards_due: int,
        subject_name: Optional[str] = None,
        user_id: Optional[int] = None
    ) -> bool:
        """Email de rappel de flashcards à réviser"""
        frontend_url = getattr(settings, 'FRONTEND_URL', 'https://studera.app')
        subject_text = f" en {subject_name}" if subject_name else ""

        content = f"""
        <h2>Flashcards à réviser ! 📚</h2>
        <p>Salut <strong>{username}</strong>,</p>
        <p>Tu as <span class="highlight">{cards_due} flashcards</span> à réviser{subject_text}.</p>
        <p>Une petite session de révision pour garder tes connaissances fraîches ?</p>
        <p style="text-align: center;">
            <a href="{frontend_url}/flashcards" class="button">Réviser maintenant</a>
        </p>
        """
        html = self._base_template(content, "Flashcards à réviser", user_id=user_id)
        text = f"Salut {username}, tu as {cards_due} flashcards à réviser{subject_text}."

        return await self.send_async(to_email, f"📚 {cards_due} flashcards t'attendent !", html, text, email_type="flashcard_reminder", user_id=user_id)

    async def send_onboarding(
        self,
        to_email: str,
        username: str,
        day: int,
        user_id: Optional[int] = None
    ) -> bool:
        """Emails d'onboarding progressifs (J+1, J+3, J+7)"""
        frontend_url = getattr(settings, 'FRONTEND_URL', 'https://studera.app')

        if day == 1:
            subject = "🐿️ 3 astuces pour bien démarrer sur Studera"
            content = f"""
            <h2>Tes premiers pas sur Studera 🚀</h2>
            <p>Salut <strong>{username}</strong>,</p>
            <p>Bienvenue dans l'aventure ! Voici 3 astuces pour bien démarrer :</p>
            <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <p><strong>1. 📝 Crée ta première note</strong><br>Organise tes cours par matière et retrouve tout facilement.</p>
            </div>
            <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <p><strong>2. 🤖 Génère des flashcards avec l'IA</strong><br>Sélectionne une note et laisse l'IA créer des cartes de révision pour toi.</p>
            </div>
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <p><strong>3. 🎯 Fais ton premier quiz</strong><br>Teste tes connaissances et gagne tes premiers XP !</p>
            </div>
            <p style="text-align: center;">
                <a href="{frontend_url}/dashboard" class="button">Commencer maintenant</a>
            </p>
            """
        elif day == 3:
            subject = "📚 Découvre les flashcards et les quiz de Studera"
            content = f"""
            <h2>Apprendre plus efficacement 🧠</h2>
            <p>Salut <strong>{username}</strong>,</p>
            <p>Savais-tu que la <strong>répétition espacée</strong> est la méthode d'apprentissage la plus efficace ?</p>
            <p>Studera l'utilise automatiquement avec les flashcards :</p>
            <ul>
                <li>📚 Tes cartes reviennent au bon moment pour optimiser ta mémorisation</li>
                <li>🤖 L'IA génère des flashcards depuis tes notes</li>
                <li>📊 Suis ta progression et ton taux de maîtrise</li>
            </ul>
            <p>Et avec les <strong>quiz</strong>, tu peux tester tes connaissances et gagner des XP pour monter de niveau !</p>
            <p style="text-align: center;">
                <a href="{frontend_url}/flashcards" class="button">Essayer les flashcards</a>
            </p>
            """
        elif day == 7:
            subject = "🔥 Lance ta première série d'étude !"
            content = f"""
            <h2>Le secret des meilleurs étudiants 🏆</h2>
            <p>Salut <strong>{username}</strong>,</p>
            <p>Les étudiants qui réussissent le mieux sur Studera ont un point commun : <strong>la régularité</strong>.</p>
            <p>Avec le système de <strong>séries (streaks)</strong> :</p>
            <ul>
                <li>🔥 Étudie chaque jour pour maintenir ta série</li>
                <li>⚔️ Défie tes amis en duel pour rendre l'étude fun</li>
                <li>🏆 Débloque des succès et monte dans le classement</li>
                <li>💪 Bonus XP quotidien qui augmente avec ta série !</li>
            </ul>
            <p>Même <strong>5 minutes par jour</strong> suffisent pour garder ta série !</p>
            <p style="text-align: center;">
                <a href="{frontend_url}/dashboard" class="button">Lancer ma série</a>
            </p>
            """
        else:
            return False

        html = self._base_template(content, "Studera - Onboarding", user_id=user_id)
        text = f"Salut {username}, découvre les fonctionnalités de Studera !"

        return await self.send_async(to_email, subject, html, text, email_type=f"onboarding_day_{day}", user_id=user_id)


# Instance singleton
email_service = EmailService()
