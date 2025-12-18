"""
Tests pour le service de paiement
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from decimal import Decimal

from app.services.payment_service import (
    PaymentService, PROVIDER_CONFIG, COUNTRY_CURRENCY_MAP, METHOD_PROVIDER_MAP
)
from app.models.payment import (
    Transaction, TransactionStatus, PaymentProvider, PaymentMethod,
    SubscriptionPlan, Currency
)
from app.models.user import User, UserSubscription, SubscriptionType


class TestPaymentProviderConfig:
    """Tests pour la configuration des providers"""

    def test_paydunya_config(self):
        """PayDunya est configure correctement"""
        config = PROVIDER_CONFIG[PaymentProvider.PAYDUNYA]

        assert config["name"] == "PayDunya"
        assert config["enabled"] == True
        assert PaymentMethod.ORANGE_MONEY in config["methods"]
        assert PaymentMethod.WAVE in config["methods"]
        assert PaymentMethod.MTN_MOMO in config["methods"]
        assert Currency.XOF in config["currencies"]
        assert "west_africa" in config["regions"]

    def test_paypal_config(self):
        """PayPal est configure correctement"""
        config = PROVIDER_CONFIG[PaymentProvider.PAYPAL]

        assert config["name"] == "PayPal"
        assert config["enabled"] == True
        assert PaymentMethod.PAYPAL in config["methods"]
        assert Currency.EUR in config["currencies"]
        assert Currency.USD in config["currencies"]

    def test_stripe_disabled(self):
        """Stripe est desactive"""
        config = PROVIDER_CONFIG[PaymentProvider.STRIPE]

        assert config["name"] == "Stripe"
        assert config["enabled"] == False

    def test_all_providers_have_required_keys(self):
        """Tous les providers ont les cles requises"""
        required_keys = ["name", "methods", "currencies", "enabled"]

        for provider, config in PROVIDER_CONFIG.items():
            for key in required_keys:
                assert key in config, f"Provider {provider} missing key {key}"


class TestCountryCurrencyMapping:
    """Tests pour le mapping pays/devise"""

    def test_senegal_uses_xof(self):
        """Le Senegal utilise XOF"""
        assert COUNTRY_CURRENCY_MAP["SN"] == Currency.XOF

    def test_france_uses_eur(self):
        """La France utilise EUR"""
        assert COUNTRY_CURRENCY_MAP["FR"] == Currency.EUR

    def test_usa_uses_usd(self):
        """Les USA utilisent USD"""
        assert COUNTRY_CURRENCY_MAP["US"] == Currency.USD

    def test_uk_uses_gbp(self):
        """Le UK utilise GBP"""
        assert COUNTRY_CURRENCY_MAP["GB"] == Currency.GBP

    def test_west_africa_uses_xof(self):
        """Les pays d'Afrique de l'Ouest utilisent XOF"""
        west_africa_countries = ["SN", "CI", "ML", "BF", "BJ", "TG", "NE", "GW"]
        for country in west_africa_countries:
            assert COUNTRY_CURRENCY_MAP[country] == Currency.XOF

    def test_central_africa_uses_xaf(self):
        """Les pays d'Afrique Centrale utilisent XAF"""
        central_africa_countries = ["CM", "GA", "CG", "TD", "CF", "GQ"]
        for country in central_africa_countries:
            assert COUNTRY_CURRENCY_MAP[country] == Currency.XAF


class TestMethodProviderMapping:
    """Tests pour le mapping methode/provider"""

    def test_mobile_money_uses_paydunya(self):
        """Mobile Money utilise PayDunya"""
        mobile_money_methods = [
            PaymentMethod.ORANGE_MONEY,
            PaymentMethod.WAVE,
            PaymentMethod.FREE_MONEY,
            PaymentMethod.MTN_MOMO,
            PaymentMethod.MOOV_MONEY
        ]
        for method in mobile_money_methods:
            assert METHOD_PROVIDER_MAP[method] == PaymentProvider.PAYDUNYA

    def test_paypal_method_uses_paypal(self):
        """PayPal method utilise PayPal provider"""
        assert METHOD_PROVIDER_MAP[PaymentMethod.PAYPAL] == PaymentProvider.PAYPAL


class TestPaymentService:
    """Tests pour PaymentService"""

    @pytest.fixture
    def service(self):
        """Instance du service"""
        return PaymentService()

    def test_service_initialization(self, service):
        """Le service s'initialise correctement"""
        assert service is not None
        assert service._stripe_service is None  # Lazy loaded
        assert service._paypal_service is None
        assert service._paydunya_service is None

    def test_lazy_loading_stripe(self, service):
        """Stripe service est lazy loaded"""
        with patch('app.services.payment_service.StripeService') as MockStripe:
            mock_instance = MagicMock()
            MockStripe.return_value = mock_instance

            result = service.stripe

            assert result == mock_instance
            MockStripe.assert_called_once()

    def test_lazy_loading_paypal(self, service):
        """PayPal service est lazy loaded"""
        with patch('app.services.payment_service.PayPalService') as MockPayPal:
            mock_instance = MagicMock()
            MockPayPal.return_value = mock_instance

            result = service.paypal

            assert result == mock_instance
            MockPayPal.assert_called_once()

    def test_lazy_loading_paydunya(self, service):
        """PayDunya service est lazy loaded"""
        with patch('app.services.payment_service.PayDunyaService') as MockPayDunya:
            mock_instance = MagicMock()
            MockPayDunya.return_value = mock_instance

            result = service.paydunya

            assert result == mock_instance
            MockPayDunya.assert_called_once()


class TestGetAvailableMethods:
    """Tests pour get_available_methods"""

    @pytest.fixture
    def service(self):
        return PaymentService()

    @pytest.mark.asyncio
    async def test_get_methods_for_senegal(self, service):
        """Methodes disponibles pour le Senegal"""
        result = await service.get_available_methods(country_code="SN")

        assert "recommended_currency" in result
        assert result["recommended_currency"] == "XOF"
        assert result["country_code"] == "SN"

    @pytest.mark.asyncio
    async def test_get_methods_for_france(self, service):
        """Methodes disponibles pour la France"""
        result = await service.get_available_methods(country_code="FR")

        assert result["recommended_currency"] == "EUR"
        assert result["country_code"] == "FR"

    @pytest.mark.asyncio
    async def test_get_methods_default_currency(self, service):
        """Devise par defaut si pays non reconnu"""
        result = await service.get_available_methods(country_code="XX")

        assert result["recommended_currency"] == "EUR"  # Default

    @pytest.mark.asyncio
    async def test_get_methods_structure(self, service):
        """Structure de la reponse"""
        result = await service.get_available_methods(country_code="SN")

        assert "cards" in result
        assert "mobile_money" in result
        assert "other" in result
        assert isinstance(result["cards"], list)
        assert isinstance(result["mobile_money"], list)


class TestCurrency:
    """Tests pour l'enum Currency"""

    def test_currencies_exist(self):
        """Les devises principales existent"""
        assert Currency.EUR is not None
        assert Currency.USD is not None
        assert Currency.XOF is not None
        assert Currency.XAF is not None

    def test_currency_values(self):
        """Les valeurs des devises sont correctes"""
        assert Currency.EUR.value == "EUR"
        assert Currency.USD.value == "USD"
        assert Currency.XOF.value == "XOF"


class TestPaymentMethod:
    """Tests pour l'enum PaymentMethod"""

    def test_payment_methods_exist(self):
        """Les methodes de paiement existent"""
        assert PaymentMethod.CARD is not None
        assert PaymentMethod.PAYPAL is not None
        assert PaymentMethod.ORANGE_MONEY is not None
        assert PaymentMethod.WAVE is not None

    def test_mobile_money_methods(self):
        """Les methodes Mobile Money existent"""
        mobile_methods = [
            PaymentMethod.ORANGE_MONEY,
            PaymentMethod.WAVE,
            PaymentMethod.FREE_MONEY,
            PaymentMethod.MTN_MOMO,
            PaymentMethod.MOOV_MONEY,
            PaymentMethod.MPESA,
            PaymentMethod.AIRTEL_MONEY
        ]
        for method in mobile_methods:
            assert method is not None


class TestPaymentProvider:
    """Tests pour l'enum PaymentProvider"""

    def test_providers_exist(self):
        """Les providers existent"""
        assert PaymentProvider.STRIPE is not None
        assert PaymentProvider.PAYPAL is not None
        assert PaymentProvider.PAYDUNYA is not None


class TestTransactionStatus:
    """Tests pour l'enum TransactionStatus"""

    def test_statuses_exist(self):
        """Les statuts existent"""
        assert TransactionStatus.PENDING is not None
        assert TransactionStatus.COMPLETED is not None
        assert TransactionStatus.FAILED is not None
        assert TransactionStatus.REFUNDED is not None
        assert TransactionStatus.CANCELLED is not None


class TestTransaction:
    """Tests pour le modele Transaction"""

    def test_transaction_creation(self):
        """Creation d'une transaction"""
        tx = Transaction(
            user_id=1,
            amount=1000,
            currency=Currency.XOF,
            provider=PaymentProvider.PAYDUNYA,
            payment_method=PaymentMethod.ORANGE_MONEY,
            status=TransactionStatus.PENDING
        )

        assert tx.user_id == 1
        assert tx.amount == 1000
        assert tx.currency == Currency.XOF
        assert tx.status == TransactionStatus.PENDING

    def test_transaction_status_update(self):
        """Mise a jour du statut de transaction"""
        tx = Transaction(
            user_id=1,
            amount=1000,
            currency=Currency.XOF,
            provider=PaymentProvider.PAYDUNYA,
            status=TransactionStatus.PENDING
        )

        tx.status = TransactionStatus.COMPLETED
        assert tx.status == TransactionStatus.COMPLETED


class TestSubscriptionType:
    """Tests pour les types d'abonnement"""

    def test_subscription_types_exist(self):
        """Les types d'abonnement existent"""
        assert SubscriptionType.FREE is not None
        assert SubscriptionType.PREMIUM is not None
        assert SubscriptionType.PREMIUM_PLUS is not None

    def test_subscription_type_values(self):
        """Les valeurs sont correctes"""
        assert SubscriptionType.FREE.value == "FREE"
        assert SubscriptionType.PREMIUM.value == "PREMIUM"


class TestUserSubscription:
    """Tests pour UserSubscription"""

    def test_subscription_creation(self):
        """Creation d'un abonnement"""
        sub = UserSubscription(
            user_id=1,
            subscription_type=SubscriptionType.PREMIUM
        )

        assert sub.subscription_type == SubscriptionType.PREMIUM

    def test_is_premium_check(self):
        """Verification is_premium"""
        free_sub = UserSubscription(subscription_type=SubscriptionType.FREE)
        premium_sub = UserSubscription(subscription_type=SubscriptionType.PREMIUM)

        assert free_sub.is_premium() == False
        assert premium_sub.is_premium() == True

    def test_subscription_expiry(self):
        """Verification expiration abonnement"""
        # Abonnement expire
        expired_sub = UserSubscription(
            subscription_type=SubscriptionType.PREMIUM,
            subscription_ends_at=datetime.utcnow() - timedelta(days=1)
        )
        assert expired_sub.is_active() == False

        # Abonnement actif
        active_sub = UserSubscription(
            subscription_type=SubscriptionType.PREMIUM,
            subscription_ends_at=datetime.utcnow() + timedelta(days=30)
        )
        assert active_sub.is_active() == True


class TestPaymentIntegration:
    """Tests d'integration pour les paiements"""

    @pytest.fixture
    def service(self):
        return PaymentService()

    @pytest.mark.asyncio
    async def test_provider_selection_for_orange_money(self, service):
        """Selection du provider pour Orange Money"""
        provider = METHOD_PROVIDER_MAP[PaymentMethod.ORANGE_MONEY]
        assert provider == PaymentProvider.PAYDUNYA

    @pytest.mark.asyncio
    async def test_provider_selection_for_paypal(self, service):
        """Selection du provider pour PayPal"""
        provider = METHOD_PROVIDER_MAP[PaymentMethod.PAYPAL]
        assert provider == PaymentProvider.PAYPAL

    @pytest.mark.asyncio
    async def test_currency_for_west_africa(self, service):
        """Devise pour l'Afrique de l'Ouest"""
        result = await service.get_available_methods(country_code="SN")
        assert result["recommended_currency"] == "XOF"

    @pytest.mark.asyncio
    async def test_currency_for_europe(self, service):
        """Devise pour l'Europe"""
        result = await service.get_available_methods(country_code="FR")
        assert result["recommended_currency"] == "EUR"
