"""
MFA (Multi-Factor Authentication) Service
==========================================

Ce service gère l'authentification à deux facteurs (2FA) avec TOTP.

Fonctionnalités:
- Génération de secrets TOTP
- Génération de QR codes pour les apps authenticator
- Validation des codes TOTP
- Gestion des codes de backup
"""

import secrets
import hashlib
import base64
import io
from typing import Optional, List, Tuple
import logging

import pyotp
import qrcode
from qrcode.image.pil import PilImage

from app.core.config import settings
from app.core.security import get_password_hash, verify_password

logger = logging.getLogger(__name__)

# Constantes
BACKUP_CODES_COUNT = 10
BACKUP_CODE_LENGTH = 8
ISSUER_NAME = "StudyMaster"


def generate_mfa_secret() -> str:
    """
    Génère un secret TOTP aléatoire pour l'utilisateur.

    Returns:
        Secret Base32 compatible avec les apps authenticator
    """
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    """
    Génère l'URI TOTP pour configurer l'app authenticator.

    Args:
        secret: Le secret TOTP de l'utilisateur
        email: L'email de l'utilisateur (affiché dans l'app)

    Returns:
        URI otpauth:// compatible avec Google Authenticator, Authy, etc.
    """
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=ISSUER_NAME)


def generate_qr_code(secret: str, email: str) -> str:
    """
    Génère un QR code pour configurer l'app authenticator.

    Args:
        secret: Le secret TOTP
        email: L'email de l'utilisateur

    Returns:
        Image QR code encodée en base64 (data URL)
    """
    uri = get_totp_uri(secret, email)

    # Créer le QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(uri)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    # Convertir en base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)

    img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{img_base64}"


def verify_totp_code(secret: str, code: str) -> bool:
    """
    Vérifie un code TOTP.

    Args:
        secret: Le secret TOTP de l'utilisateur
        code: Le code à 6 chiffres fourni par l'utilisateur

    Returns:
        True si le code est valide, False sinon
    """
    if not secret or not code:
        return False

    # Nettoyer le code (enlever espaces)
    code = code.replace(" ", "").strip()

    if not code.isdigit() or len(code) != 6:
        return False

    totp = pyotp.TOTP(secret)

    # valid_window=1 permet une tolérance d'une période (30 sec avant/après)
    # pour compenser le décalage d'horloge
    return totp.verify(code, valid_window=1)


def generate_backup_codes() -> Tuple[List[str], List[str]]:
    """
    Génère des codes de backup pour la récupération.

    Returns:
        Tuple (codes_clairs, codes_hashés)
        - codes_clairs: À afficher à l'utilisateur (une seule fois!)
        - codes_hashés: À stocker en base de données
    """
    plain_codes = []
    hashed_codes = []

    for _ in range(BACKUP_CODES_COUNT):
        # Générer un code alphanumérique
        code = secrets.token_hex(BACKUP_CODE_LENGTH // 2).upper()

        # Formater pour la lisibilité (XXXX-XXXX)
        formatted_code = f"{code[:4]}-{code[4:]}"
        plain_codes.append(formatted_code)

        # Hasher pour le stockage
        hashed = hashlib.sha256(code.encode()).hexdigest()
        hashed_codes.append(hashed)

    return plain_codes, hashed_codes


def verify_backup_code(code: str, hashed_codes: List[str]) -> Tuple[bool, int]:
    """
    Vérifie un code de backup.

    Args:
        code: Le code fourni par l'utilisateur
        hashed_codes: Liste des codes hashés stockés

    Returns:
        Tuple (is_valid, index)
        - is_valid: True si le code est valide
        - index: Index du code utilisé (-1 si invalide)
    """
    if not code or not hashed_codes:
        return False, -1

    # Nettoyer le code (enlever tirets et espaces)
    clean_code = code.replace("-", "").replace(" ", "").upper()

    # Hasher le code fourni
    code_hash = hashlib.sha256(clean_code.encode()).hexdigest()

    # Chercher dans la liste
    try:
        index = hashed_codes.index(code_hash)
        return True, index
    except ValueError:
        return False, -1


class MFAService:
    """Service de gestion MFA pour les utilisateurs"""

    @staticmethod
    async def setup_mfa(user) -> dict:
        """
        Initialise le MFA pour un utilisateur.

        Args:
            user: L'objet User

        Returns:
            dict avec secret, qr_code, backup_codes
        """
        # Générer le secret
        secret = generate_mfa_secret()

        # Générer le QR code
        qr_code = generate_qr_code(secret, user.email)

        # Générer les codes de backup
        plain_codes, hashed_codes = generate_backup_codes()

        # Stocker temporairement (en attendant la vérification)
        # Le secret ne sera définitivement sauvegardé qu'après verify_setup
        user.mfa_secret = secret
        user.mfa_backup_codes = hashed_codes
        # NE PAS activer mfa_enabled ici - attendre la vérification

        logger.info(f"MFA setup initiated for user {user.id}")

        return {
            "secret": secret,
            "qr_code": qr_code,
            "backup_codes": plain_codes,
            "message": "Scannez le QR code avec votre app authenticator, puis entrez le code pour confirmer"
        }

    @staticmethod
    async def verify_setup(user, code: str) -> bool:
        """
        Vérifie le code TOTP pour confirmer l'activation du MFA.
        Doit être appelé après setup_mfa pour finaliser l'activation.

        Args:
            user: L'objet User
            code: Le code TOTP à vérifier

        Returns:
            True si la vérification a réussi et le MFA est activé
        """
        if not user.mfa_secret:
            logger.warning(f"MFA verify_setup called without secret for user {user.id}")
            return False

        if verify_totp_code(user.mfa_secret, code):
            from app.core.datetime_utils import utc_now
            user.mfa_enabled = True
            user.mfa_verified_at = utc_now()
            logger.info(f"MFA enabled successfully for user {user.id}")
            return True

        logger.warning(f"MFA verify_setup failed for user {user.id}")
        return False

    @staticmethod
    async def disable_mfa(user, code: str) -> bool:
        """
        Désactive le MFA pour un utilisateur.
        Requiert un code TOTP valide pour confirmer.

        Args:
            user: L'objet User
            code: Le code TOTP pour confirmer

        Returns:
            True si le MFA a été désactivé
        """
        if not user.mfa_enabled:
            return True

        if verify_totp_code(user.mfa_secret, code):
            user.mfa_enabled = False
            user.mfa_secret = None
            user.mfa_backup_codes = []
            user.mfa_verified_at = None
            logger.info(f"MFA disabled for user {user.id}")
            return True

        logger.warning(f"MFA disable failed - invalid code for user {user.id}")
        return False

    @staticmethod
    async def verify_login(user, code: str) -> Tuple[bool, str]:
        """
        Vérifie le code MFA lors de la connexion.
        Supporte les codes TOTP et les codes de backup.

        Args:
            user: L'objet User
            code: Le code TOTP ou backup

        Returns:
            Tuple (success, message)
        """
        if not user.mfa_enabled:
            return True, "MFA not enabled"

        # Essayer d'abord le TOTP
        if verify_totp_code(user.mfa_secret, code):
            return True, "TOTP verified"

        # Sinon essayer les codes de backup
        is_valid, index = verify_backup_code(code, user.mfa_backup_codes or [])
        if is_valid:
            # Supprimer le code utilisé
            user.mfa_backup_codes = [
                c for i, c in enumerate(user.mfa_backup_codes)
                if i != index
            ]
            remaining = len(user.mfa_backup_codes)
            logger.info(f"Backup code used for user {user.id}. {remaining} codes remaining.")
            return True, f"Backup code verified. {remaining} codes remaining."

        return False, "Invalid MFA code"

    @staticmethod
    async def regenerate_backup_codes(user, code: str) -> Optional[List[str]]:
        """
        Régénère les codes de backup (nécessite un code TOTP valide).

        Args:
            user: L'objet User
            code: Le code TOTP pour confirmer

        Returns:
            Liste des nouveaux codes de backup, ou None si échec
        """
        if not user.mfa_enabled:
            return None

        if not verify_totp_code(user.mfa_secret, code):
            logger.warning(f"Backup code regeneration failed for user {user.id}")
            return None

        plain_codes, hashed_codes = generate_backup_codes()
        user.mfa_backup_codes = hashed_codes

        logger.info(f"Backup codes regenerated for user {user.id}")
        return plain_codes


# Instance singleton
mfa_service = MFAService()
