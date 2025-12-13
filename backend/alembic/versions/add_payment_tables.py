"""Add payment tables

Revision ID: add_payment_tables
Revises: add_fsrs_fields_to_flashcards
Create Date: 2025-01-09

Tables créées:
- subscription_plans: Plans d'abonnement
- transactions: Historique des paiements
- payment_webhook_logs: Logs des webhooks
- promo_codes: Codes promotionnels
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'add_payment_tables'
down_revision = 'add_fsrs_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Créer les types ENUM
    payment_provider_enum = postgresql.ENUM(
        'stripe', 'paypal', 'flutterwave', 'paydunya', 'cinetpay', 'free',
        name='paymentprovider',
        create_type=False
    )

    payment_method_enum = postgresql.ENUM(
        'card_visa', 'card_mastercard', 'card_amex', 'card_other',
        'paypal',
        'orange_money', 'wave', 'mtn_momo', 'moov_money', 'free_money',
        'airtel_money', 'mpesa',
        'bank_transfer', 'free',
        name='paymentmethod',
        create_type=False
    )

    transaction_status_enum = postgresql.ENUM(
        'pending', 'processing', 'success', 'failed', 'cancelled', 'refunded', 'expired',
        name='transactionstatus',
        create_type=False
    )

    currency_enum = postgresql.ENUM(
        'EUR', 'USD', 'GBP', 'XOF', 'XAF', 'NGN', 'GHS', 'KES', 'ZAR', 'MAD', 'TND', 'EGP',
        name='currency',
        create_type=False
    )

    # Créer les types dans la base
    payment_provider_enum.create(op.get_bind(), checkfirst=True)
    payment_method_enum.create(op.get_bind(), checkfirst=True)
    transaction_status_enum.create(op.get_bind(), checkfirst=True)
    currency_enum.create(op.get_bind(), checkfirst=True)

    # Table subscription_plans
    op.create_table(
        'subscription_plans',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('code', sa.String(50), unique=True, nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),

        # Tarification multi-devises
        sa.Column('price_eur_cents', sa.Integer(), default=0),
        sa.Column('price_usd_cents', sa.Integer(), default=0),
        sa.Column('price_xof', sa.Integer(), default=0),
        sa.Column('price_xaf', sa.Integer(), default=0),
        sa.Column('price_ngn', sa.Integer(), default=0),
        sa.Column('price_mad_cents', sa.Integer(), default=0),

        # Durée
        sa.Column('duration_days', sa.Integer(), default=30),
        sa.Column('is_recurring', sa.Boolean(), default=True),

        # Quotas
        sa.Column('ai_requests_per_day', sa.Integer(), default=10),
        sa.Column('storage_limit_mb', sa.Integer(), default=100),
        sa.Column('max_notes', sa.Integer(), default=50),
        sa.Column('max_flashcards', sa.Integer(), default=500),
        sa.Column('max_quizzes', sa.Integer(), default=20),

        # Fonctionnalités
        sa.Column('features', sa.JSON(), default=list),
        sa.Column('has_ads', sa.Boolean(), default=True),
        sa.Column('has_priority_support', sa.Boolean(), default=False),
        sa.Column('has_advanced_analytics', sa.Boolean(), default=False),
        sa.Column('has_api_access', sa.Boolean(), default=False),
        sa.Column('has_export', sa.Boolean(), default=True),
        sa.Column('has_collaboration', sa.Boolean(), default=False),

        # Affichage
        sa.Column('is_popular', sa.Boolean(), default=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('display_order', sa.Integer(), default=0),
        sa.Column('color', sa.String(20), default='gray'),
        sa.Column('icon', sa.String(50), default='gift'),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Table transactions
    op.create_table(
        'transactions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),

        # Relations
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('plan_id', sa.Integer(), sa.ForeignKey('subscription_plans.id'), nullable=True),

        # Provider & méthode
        sa.Column('provider', payment_provider_enum, nullable=False),
        sa.Column('provider_transaction_id', sa.String(255), nullable=True, index=True),
        sa.Column('provider_payment_intent_id', sa.String(255), nullable=True),
        sa.Column('provider_checkout_id', sa.String(255), nullable=True),

        sa.Column('payment_method', payment_method_enum, nullable=False),
        sa.Column('payment_method_details', sa.JSON(), nullable=True),

        # Montant
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('currency', currency_enum, nullable=False, default='EUR'),

        # Mobile Money
        sa.Column('phone_number', sa.String(20), nullable=True),
        sa.Column('country_code', sa.String(5), nullable=True),

        # Statut
        sa.Column('status', transaction_status_enum, default='pending', index=True),
        sa.Column('status_message', sa.String(500), nullable=True),

        # Webhook
        sa.Column('webhook_received_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('webhook_data', sa.JSON(), nullable=True),

        # Remboursement
        sa.Column('refunded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('refund_amount', sa.Integer(), nullable=True),
        sa.Column('refund_reason', sa.String(500), nullable=True),

        # Métadonnées
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('extra_data', sa.JSON(), nullable=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Table payment_webhook_logs
    op.create_table(
        'payment_webhook_logs',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),

        sa.Column('provider', payment_provider_enum, nullable=False),
        sa.Column('event_type', sa.String(100), nullable=True),
        sa.Column('event_id', sa.String(255), nullable=True, index=True),

        # Contenu
        sa.Column('headers', sa.JSON(), nullable=True),
        sa.Column('payload', sa.JSON(), nullable=True),
        sa.Column('raw_body', sa.Text(), nullable=True),

        # Traitement
        sa.Column('processed', sa.Boolean(), default=False),
        sa.Column('processing_error', sa.Text(), nullable=True),

        # Transaction liée
        sa.Column('transaction_id', sa.Integer(), sa.ForeignKey('transactions.id'), nullable=True),

        # Timestamps
        sa.Column('received_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Table promo_codes
    op.create_table(
        'promo_codes',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),

        sa.Column('code', sa.String(50), unique=True, nullable=False, index=True),
        sa.Column('description', sa.String(255), nullable=True),

        # Type de réduction
        sa.Column('discount_type', sa.String(20), default='percentage'),
        sa.Column('discount_value', sa.Integer(), nullable=False),

        # Restrictions
        sa.Column('applicable_plans', sa.JSON(), nullable=True),
        sa.Column('min_amount', sa.Integer(), nullable=True),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('max_uses_per_user', sa.Integer(), default=1),

        # Validité
        sa.Column('valid_from', sa.DateTime(timezone=True), nullable=True),
        sa.Column('valid_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),

        # Stats
        sa.Column('times_used', sa.Integer(), default=0),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Créer les index
    op.create_index('ix_transactions_user_status', 'transactions', ['user_id', 'status'])
    op.create_index('ix_transactions_created_at', 'transactions', ['created_at'])

    # Insérer les plans initiaux (Option 3: Prix optimisés avec 55% de marge, cache 70%)
    op.execute("""
        INSERT INTO subscription_plans (code, name, description, price_eur_cents, price_usd_cents, price_xof, price_xaf, price_ngn, price_mad_cents, duration_days, is_recurring, ai_requests_per_day, storage_limit_mb, max_notes, max_flashcards, max_quizzes, features, has_ads, has_priority_support, has_advanced_analytics, has_api_access, has_export, has_collaboration, is_popular, is_active, display_order, color, icon)
        VALUES
        ('free', 'Gratuit', 'Parfait pour découvrir StudyMaster', 0, 0, 0, 0, 0, 0, 36500, false, 5, 100, 50, 500, 20, '["5 requêtes IA par jour", "50 notes maximum", "500 flashcards", "20 quiz", "100 MB de stockage", "Algorithme FSRS", "Mode hors-ligne"]'::jsonb, true, false, false, false, true, false, false, true, 1, 'gray', 'gift'),
        ('premium', 'Premium', 'Pour les étudiants sérieux', 549, 599, 3500, 3500, 4500, 6000, 30, true, 30, 1000, -1, -1, -1, '["30 requêtes IA par jour", "Notes illimitées", "Flashcards illimitées", "Quiz illimités", "1 GB de stockage", "Pas de publicités", "Support prioritaire", "Export PDF/Word", "Groupes d''étude"]'::jsonb, false, true, false, false, true, true, true, true, 2, 'blue', 'star'),
        ('premium_plus', 'Premium+', 'Pour les power users', 1099, 1199, 7000, 7000, 9000, 12000, 30, true, 60, 5000, -1, -1, -1, '["60 requêtes IA par jour", "Tout illimité", "5 GB de stockage", "Pas de publicités", "Support VIP 24/7", "Analytics avancés", "Accès anticipé nouvelles fonctionnalités", "Thèmes exclusifs", "Badge Premium+"]'::jsonb, false, true, true, false, true, true, false, true, 3, 'purple', 'crown'),
        ('institutional', 'Institutionnel', 'Pour les établissements scolaires', 3699, 3999, 24000, 24000, 30000, 40000, 30, true, 200, 50000, -1, -1, -1, '["200 requêtes IA par jour", "Tout illimité", "50 GB de stockage", "Gestion multi-utilisateurs", "Dashboard administrateur", "API dédiée", "Support dédié", "Formation incluse", "Facturation entreprise"]'::jsonb, false, true, true, true, true, true, false, true, 4, 'green', 'building'),
        ('premium_yearly', 'Premium Annuel', 'Premium avec 2 mois offerts', 5490, 5990, 35000, 35000, 45000, 60000, 365, true, 30, 1000, -1, -1, -1, '["Tout Premium inclus", "2 mois OFFERTS", "Économisez 17%"]'::jsonb, false, true, false, false, true, true, false, true, 5, 'blue', 'calendar')
    """)

    # Insérer quelques codes promo de test
    op.execute("""
        INSERT INTO promo_codes (code, description, discount_type, discount_value, is_active)
        VALUES
        ('WELCOME20', 'Réduction de bienvenue - 20%', 'percentage', 20, true),
        ('STUDENT10', 'Réduction étudiant - 10%', 'percentage', 10, true),
        ('LAUNCH50', 'Offre de lancement - 50%', 'percentage', 50, true)
    """)


def downgrade() -> None:
    # Supprimer les tables
    op.drop_table('promo_codes')
    op.drop_table('payment_webhook_logs')
    op.drop_table('transactions')
    op.drop_table('subscription_plans')

    # Supprimer les types ENUM
    op.execute('DROP TYPE IF EXISTS currency')
    op.execute('DROP TYPE IF EXISTS transactionstatus')
    op.execute('DROP TYPE IF EXISTS paymentmethod')
    op.execute('DROP TYPE IF EXISTS paymentprovider')
