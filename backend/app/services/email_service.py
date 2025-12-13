"""
Service Email - Envoi de notifications par email
Supporte SMTP (Gmail, SendGrid, etc.)
"""

import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List, Dict, Any
from datetime import datetime
import asyncio
from concurrent.futures import ThreadPoolExecutor

from app.core.config import settings

logger = logging.getLogger(__name__)

# Thread pool pour les envois async
_executor = ThreadPoolExecutor(max_workers=3)


class EmailService:
    """Service d'envoi d'emails"""

    def __init__(self):
        self.smtp_host = getattr(settings, 'SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = getattr(settings, 'SMTP_PORT', 587)
        self.smtp_user = getattr(settings, 'SMTP_USER', '')
        self.smtp_password = getattr(settings, 'SMTP_PASSWORD', '')
        self.from_email = getattr(settings, 'EMAIL_FROM', 'noreply@studymaster.app')
        self.from_name = getattr(settings, 'EMAIL_FROM_NAME', 'Study Master')
        self.enabled = bool(self.smtp_user and self.smtp_password)

        if not self.enabled:
            logger.warning("Email service désactivé: SMTP_USER/SMTP_PASSWORD non configurés")

    def _create_message(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> MIMEMultipart:
        """Crée un message email"""
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{self.from_name} <{self.from_email}>"
        msg['To'] = to_email

        # Version texte
        if text_content:
            part_text = MIMEText(text_content, 'plain', 'utf-8')
            msg.attach(part_text)

        # Version HTML
        part_html = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part_html)

        return msg

    def _send_sync(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Envoi synchrone d'email"""
        if not self.enabled:
            logger.debug(f"Email skip (disabled): {to_email}")
            return False

        try:
            msg = self._create_message(to_email, subject, html_content, text_content)

            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)

            logger.info(f"Email envoyé: {to_email} - {subject}")
            return True

        except Exception as e:
            logger.error(f"Erreur envoi email à {to_email}: {e}")
            return False

    async def send_async(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Envoi asynchrone d'email"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _executor,
            self._send_sync,
            to_email, subject, html_content, text_content
        )

    # =========================================================================
    # Templates d'emails
    # =========================================================================

    def _base_template(self, content: str, title: str = "Study Master") -> str:
        """Template HTML de base"""
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
            font-size: 24px;
            font-weight: bold;
            color: #6366f1;
        }}
        .content {{
            margin-bottom: 30px;
        }}
        .button {{
            display: inline-block;
            background-color: #6366f1;
            color: white !important;
            padding: 12px 24px;
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
            padding: 2px 6px;
            border-radius: 4px;
        }}
        .stat {{
            display: inline-block;
            margin: 10px;
            text-align: center;
        }}
        .stat-value {{
            font-size: 24px;
            font-weight: bold;
            color: #6366f1;
        }}
        .stat-label {{
            font-size: 12px;
            color: #666;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Study Master</div>
        </div>
        <div class="content">
            {content}
        </div>
        <div class="footer">
            <p>Cet email a été envoyé par Study Master.</p>
            <p>Si vous ne souhaitez plus recevoir ces emails,
               <a href="{{{{ unsubscribe_url }}}}">désabonnez-vous ici</a>.</p>
        </div>
    </div>
</body>
</html>
"""

    # =========================================================================
    # Emails spécifiques
    # =========================================================================

    async def send_duel_challenge(
        self,
        to_email: str,
        username: str,
        challenger_name: str,
        stakes_xp: int,
        duel_url: str
    ) -> bool:
        """Email de défi reçu"""
        content = f"""
        <h2>Nouveau défi !</h2>
        <p>Salut <strong>{username}</strong>,</p>
        <p><strong>{challenger_name}</strong> vous lance un défi sur Study Master !</p>
        <p>Enjeux: <span class="highlight">{stakes_xp} XP</span></p>
        <p>Acceptez le défi et montrez de quoi vous êtes capable !</p>
        <p style="text-align: center;">
            <a href="{duel_url}" class="button">Voir le défi</a>
        </p>
        """
        html = self._base_template(content, "Nouveau défi sur Study Master")
        text = f"Salut {username}, {challenger_name} vous défie sur Study Master ! Enjeux: {stakes_xp} XP"

        return await self.send_async(to_email, f"{challenger_name} vous défie !", html, text)

    async def send_streak_reminder(
        self,
        to_email: str,
        username: str,
        current_streak: int
    ) -> bool:
        """Email de rappel de série"""
        content = f"""
        <h2>Ta série est en danger !</h2>
        <p>Salut <strong>{username}</strong>,</p>
        <p>Tu as une série de <span class="highlight">{current_streak} jours</span> en cours.</p>
        <p>N'oublie pas d'étudier aujourd'hui pour la maintenir !</p>
        <p style="text-align: center;">
            <a href="https://studymaster.app/dashboard" class="button">Étudier maintenant</a>
        </p>
        """
        html = self._base_template(content, "Garde ta série !")
        text = f"Salut {username}, ta série de {current_streak} jours est en danger ! Étudie aujourd'hui."

        return await self.send_async(to_email, f"Ta série de {current_streak} jours est en danger !", html, text)

    async def send_event_reminder(
        self,
        to_email: str,
        username: str,
        event_title: str,
        event_time: datetime,
        event_url: str
    ) -> bool:
        """Email de rappel d'événement"""
        time_str = event_time.strftime("%H:%M")
        date_str = event_time.strftime("%d/%m/%Y")

        content = f"""
        <h2>Rappel d'événement</h2>
        <p>Salut <strong>{username}</strong>,</p>
        <p>N'oublie pas ton événement :</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <strong>{event_title}</strong><br>
            <span style="color: #666;">{date_str} à {time_str}</span>
        </div>
        <p style="text-align: center;">
            <a href="{event_url}" class="button">Voir les détails</a>
        </p>
        """
        html = self._base_template(content, f"Rappel: {event_title}")
        text = f"Rappel: {event_title} le {date_str} à {time_str}"

        return await self.send_async(to_email, f"Rappel: {event_title}", html, text)

    async def send_daily_digest(
        self,
        to_email: str,
        username: str,
        stats: Dict[str, Any],
        notifications: List[Dict[str, Any]]
    ) -> bool:
        """Email résumé quotidien"""
        # Stats
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

        # Notifications
        notifs_html = ""
        if notifications:
            notifs_html = "<h3>Notifications non lues</h3><ul>"
            for notif in notifications[:5]:
                notifs_html += f"<li><strong>{notif.get('title')}</strong>: {notif.get('message')}</li>"
            notifs_html += "</ul>"

        content = f"""
        <h2>Ton résumé quotidien</h2>
        <p>Salut <strong>{username}</strong> !</p>
        <p>Voici ton résumé Study Master de la journée :</p>
        {stats_html}
        {notifs_html}
        <p style="text-align: center;">
            <a href="https://studymaster.app/dashboard" class="button">Continuer à apprendre</a>
        </p>
        """
        html = self._base_template(content, "Ton résumé Study Master")
        text = f"Salut {username}, voici ton résumé Study Master quotidien."

        return await self.send_async(to_email, "Ton résumé Study Master du jour", html, text)

    async def send_achievement_unlocked(
        self,
        to_email: str,
        username: str,
        achievement_name: str,
        achievement_description: str,
        xp_reward: int
    ) -> bool:
        """Email de succès débloqué"""
        content = f"""
        <h2>Félicitations !</h2>
        <p>Salut <strong>{username}</strong>,</p>
        <p>Tu as débloqué un nouveau succès !</p>
        <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
            <div style="font-size: 48px;">🏆</div>
            <h3 style="margin: 10px 0;">{achievement_name}</h3>
            <p style="color: #666;">{achievement_description}</p>
            <p><strong>+{xp_reward} XP</strong></p>
        </div>
        <p style="text-align: center;">
            <a href="https://studymaster.app/achievements" class="button">Voir tous tes succès</a>
        </p>
        """
        html = self._base_template(content, f"Succès débloqué: {achievement_name}")
        text = f"Félicitations {username} ! Tu as débloqué '{achievement_name}' et gagné {xp_reward} XP !"

        return await self.send_async(to_email, f"Succès débloqué: {achievement_name} !", html, text)

    async def send_welcome(
        self,
        to_email: str,
        username: str
    ) -> bool:
        """Email de bienvenue"""
        content = f"""
        <h2>Bienvenue sur Study Master !</h2>
        <p>Salut <strong>{username}</strong>,</p>
        <p>Ton compte a été créé avec succès. Tu fais maintenant partie de la communauté Study Master !</p>
        <p>Voici ce que tu peux faire :</p>
        <ul>
            <li>Créer des notes et les organiser par matière</li>
            <li>Générer des flashcards automatiquement avec l'IA</li>
            <li>Tester tes connaissances avec des quiz</li>
            <li>Défier tes amis en duel</li>
            <li>Suivre ta progression et gagner des succès</li>
        </ul>
        <p>Spark, notre mascotte, sera là pour t'accompagner !</p>
        <p style="text-align: center;">
            <a href="https://studymaster.app/dashboard" class="button">Commencer</a>
        </p>
        """
        html = self._base_template(content, "Bienvenue sur Study Master")
        text = f"Bienvenue {username} ! Ton compte Study Master a été créé avec succès."

        return await self.send_async(to_email, "Bienvenue sur Study Master !", html, text)


# Instance singleton
email_service = EmailService()
