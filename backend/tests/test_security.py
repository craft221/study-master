"""
Tests pour le module de sécurité
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, AsyncMock

from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_token,
    verify_refresh_token,
    generate_csrf_token,
    verify_csrf_token,
    sanitize_string,
    sanitize_html,
    validate_email,
    validate_username,
    validate_password_strength,
    verify_ownership,
    OwnershipError
)
from app.models.user import User, UserRole


class TestPasswordHashing:
    """Tests pour le hashing de mots de passe"""

    def test_password_hash_is_different_from_original(self):
        """Le hash ne doit pas être égal au mot de passe original"""
        password = "SecurePassword123!"
        hashed = get_password_hash(password)

        assert hashed != password
        assert len(hashed) > 0

    def test_password_verification_success(self):
        """La vérification doit réussir avec le bon mot de passe"""
        password = "SecurePassword123!"
        hashed = get_password_hash(password)

        assert verify_password(password, hashed) is True

    def test_password_verification_failure(self):
        """La vérification doit échouer avec un mauvais mot de passe"""
        password = "SecurePassword123!"
        wrong_password = "WrongPassword123!"
        hashed = get_password_hash(password)

        assert verify_password(wrong_password, hashed) is False

    def test_different_passwords_have_different_hashes(self):
        """Deux mots de passe différents doivent avoir des hashs différents"""
        password1 = "Password1!"
        password2 = "Password2!"

        hash1 = get_password_hash(password1)
        hash2 = get_password_hash(password2)

        assert hash1 != hash2

    def test_same_password_has_different_hashes(self):
        """Le même mot de passe doit avoir des hashs différents (salt)"""
        password = "SamePassword123!"

        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)

        # Les hashs sont différents grâce au salt
        assert hash1 != hash2
        # Mais la vérification doit fonctionner pour les deux
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True


class TestJWTTokens:
    """Tests pour les tokens JWT"""

    def test_create_access_token(self):
        """Doit créer un token d'accès valide"""
        data = {"sub": "123"}
        token = create_access_token(data)

        assert token is not None
        assert len(token) > 0
        assert "." in token  # Format JWT

    def test_create_refresh_token(self):
        """Doit créer un token de rafraîchissement valide"""
        data = {"sub": "123"}
        token = create_refresh_token(data)

        assert token is not None
        assert len(token) > 0

    def test_verify_access_token_success(self):
        """La vérification d'un token valide doit réussir"""
        data = {"sub": "123"}
        token = create_access_token(data)

        payload = verify_token(token, expected_type="access")

        assert payload is not None
        assert payload["sub"] == "123"
        assert payload["type"] == "access"

    def test_verify_access_token_wrong_type(self):
        """La vérification doit échouer avec le mauvais type"""
        data = {"sub": "123"}
        token = create_access_token(data)

        payload = verify_token(token, expected_type="refresh")

        assert payload is None

    def test_verify_refresh_token_success(self):
        """La vérification d'un refresh token doit réussir"""
        data = {"sub": "123"}
        token = create_refresh_token(data)

        user_id = verify_refresh_token(token)

        assert user_id == "123"

    def test_verify_invalid_token(self):
        """La vérification d'un token invalide doit échouer"""
        invalid_token = "invalid.token.here"

        payload = verify_token(invalid_token)

        assert payload is None

    def test_token_with_custom_expiration(self):
        """Doit pouvoir créer un token avec une expiration personnalisée"""
        data = {"sub": "123"}
        expires = timedelta(minutes=5)
        token = create_access_token(data, expires_delta=expires)

        payload = verify_token(token)

        assert payload is not None
        assert payload["sub"] == "123"


class TestCSRFProtection:
    """Tests pour la protection CSRF"""

    def test_generate_csrf_token(self):
        """Doit générer un token CSRF unique"""
        token1 = generate_csrf_token()
        token2 = generate_csrf_token()

        assert token1 is not None
        assert token2 is not None
        assert token1 != token2
        assert len(token1) >= 32

    def test_verify_csrf_token_success(self):
        """La vérification CSRF doit réussir avec le bon token"""
        token = generate_csrf_token()

        result = verify_csrf_token(token, token)

        assert result is True

    def test_verify_csrf_token_failure(self):
        """La vérification CSRF doit échouer avec un mauvais token"""
        token1 = generate_csrf_token()
        token2 = generate_csrf_token()

        result = verify_csrf_token(token1, token2)

        assert result is False

    def test_verify_csrf_token_empty(self):
        """La vérification doit échouer avec des tokens vides"""
        assert verify_csrf_token("", "token") is False
        assert verify_csrf_token("token", "") is False
        assert verify_csrf_token("", "") is False
        assert verify_csrf_token(None, "token") is False


class TestInputValidation:
    """Tests pour la validation des entrées"""

    def test_sanitize_string_removes_html(self):
        """Doit échapper les caractères HTML"""
        dangerous = "<script>alert('xss')</script>"
        safe = sanitize_string(dangerous)

        assert "<script>" not in safe
        assert "&lt;script&gt;" in safe

    def test_sanitize_string_truncates(self):
        """Doit tronquer les chaînes trop longues"""
        long_string = "a" * 20000
        safe = sanitize_string(long_string, max_length=100)

        assert len(safe) == 100

    def test_sanitize_string_removes_control_chars(self):
        """Doit supprimer les caractères de contrôle"""
        with_control = "Hello\x00World\x1f!"
        safe = sanitize_string(with_control)

        assert "\x00" not in safe
        assert "\x1f" not in safe
        assert "HelloWorld!" in safe

    def test_sanitize_html_removes_scripts(self):
        """Doit supprimer les balises script du HTML"""
        html = "<p>Hello</p><script>evil()</script><p>World</p>"
        safe = sanitize_html(html)

        assert "<script>" not in safe
        assert "evil()" not in safe
        assert "<p>Hello</p>" in safe

    def test_sanitize_html_removes_event_handlers(self):
        """Doit supprimer les event handlers"""
        html = '<img src="x" onerror="alert(1)" onclick="hack()">'
        safe = sanitize_html(html)

        assert "onerror" not in safe
        assert "onclick" not in safe

    def test_sanitize_html_removes_javascript_urls(self):
        """Doit supprimer les URLs javascript:"""
        html = '<a href="javascript:alert(1)">Click</a>'
        safe = sanitize_html(html)

        assert "javascript:" not in safe

    def test_validate_email_valid(self):
        """Doit accepter les emails valides"""
        assert validate_email("user@example.com") is True
        assert validate_email("user.name@domain.co.uk") is True
        assert validate_email("user+tag@example.org") is True

    def test_validate_email_invalid(self):
        """Doit rejeter les emails invalides"""
        assert validate_email("invalid") is False
        assert validate_email("@example.com") is False
        assert validate_email("user@") is False
        assert validate_email("user@.com") is False

    def test_validate_username_valid(self):
        """Doit accepter les noms d'utilisateur valides"""
        is_valid, error = validate_username("john_doe")
        assert is_valid is True
        assert error == ""

        is_valid, error = validate_username("user123")
        assert is_valid is True

    def test_validate_username_too_short(self):
        """Doit rejeter les noms d'utilisateur trop courts"""
        is_valid, error = validate_username("ab")
        assert is_valid is False
        assert "3 characters" in error

    def test_validate_username_too_long(self):
        """Doit rejeter les noms d'utilisateur trop longs"""
        is_valid, error = validate_username("a" * 31)
        assert is_valid is False
        assert "30 characters" in error

    def test_validate_username_invalid_chars(self):
        """Doit rejeter les caractères spéciaux"""
        is_valid, error = validate_username("user@name")
        assert is_valid is False

        is_valid, error = validate_username("user name")
        assert is_valid is False

    def test_validate_username_reserved(self):
        """Doit rejeter les noms réservés"""
        is_valid, error = validate_username("admin")
        assert is_valid is False
        assert "reserved" in error

        is_valid, error = validate_username("ADMIN")  # Case insensitive
        assert is_valid is False

    def test_validate_password_valid(self):
        """Doit accepter les mots de passe forts"""
        is_valid, error = validate_password_strength("SecurePass123!")
        assert is_valid is True
        assert error == ""

    def test_validate_password_too_short(self):
        """Doit rejeter les mots de passe trop courts"""
        is_valid, error = validate_password_strength("Short1!")
        assert is_valid is False
        assert "8 characters" in error

    def test_validate_password_no_uppercase(self):
        """Doit rejeter les mots de passe sans majuscule"""
        is_valid, error = validate_password_strength("lowercase123!")
        assert is_valid is False
        assert "uppercase" in error

    def test_validate_password_no_lowercase(self):
        """Doit rejeter les mots de passe sans minuscule"""
        is_valid, error = validate_password_strength("UPPERCASE123!")
        assert is_valid is False
        assert "lowercase" in error

    def test_validate_password_no_number(self):
        """Doit rejeter les mots de passe sans chiffre"""
        is_valid, error = validate_password_strength("NoNumbersHere!")
        assert is_valid is False
        assert "number" in error


class TestOwnershipVerification:
    """Tests pour la vérification d'ownership"""

    def test_ownership_error_creation(self):
        """Doit créer une erreur OwnershipError correctement"""
        error = OwnershipError("Subject")
        assert "Subject" in str(error.detail)
        assert error.status_code == 404

    def test_ownership_error_default_resource(self):
        """Doit créer une erreur avec ressource par défaut"""
        error = OwnershipError()
        assert "Resource" in str(error.detail)
        assert error.status_code == 404

    def test_ownership_error_different_resources(self):
        """Test avec différentes ressources"""
        error1 = OwnershipError("Subject")
        error2 = OwnershipError("Quiz")
        error3 = OwnershipError("Flashcard")

        assert "Subject" in error1.detail
        assert "Quiz" in error2.detail
        assert "Flashcard" in error3.detail

    def test_ownership_error_is_http_exception(self):
        """OwnershipError doit être une HTTPException"""
        from fastapi import HTTPException
        error = OwnershipError("Test")
        assert isinstance(error, HTTPException)

    def test_ownership_error_returns_404(self):
        """OwnershipError retourne 404 pour éviter de révéler l'existence des ressources"""
        error = OwnershipError("Secret")
        # Intentionnellement 404 (not found) au lieu de 403 (forbidden)
        # pour ne pas révéler si la ressource existe
        assert error.status_code == 404
