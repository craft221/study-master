import api from '@/lib/api'

// ==================== TYPES ====================

export type PaymentMethod =
  | 'card' | 'card_visa' | 'card_mastercard' | 'card_amex'
  | 'paypal'
  | 'orange_money' | 'wave' | 'free_money' | 'mtn_momo' | 'moov_money' | 'mpesa' | 'airtel_money'
  | 'bank_transfer'

export type Currency = 'EUR' | 'USD' | 'GBP' | 'XOF' | 'XAF' | 'NGN' | 'GHS' | 'KES' | 'ZAR' | 'MAD'

export type TransactionStatus = 'pending' | 'processing' | 'success' | 'failed' | 'cancelled' | 'refunded'

// ==================== INTERFACES ====================

export interface SubscriptionPlan {
  id: number
  code: string
  name: string
  description: string | null

  // Prix multi-devises
  price_eur: number
  price_usd: number
  price_xof: number
  price_xaf: number
  price_ngn: number
  price_mad: number

  // Durée
  duration_days: number
  is_recurring: boolean

  // Quotas
  ai_requests_per_day: number
  storage_limit_mb: number
  max_notes: number
  max_flashcards: number
  max_quizzes: number

  // Fonctionnalités
  features: string[]
  has_ads: boolean
  has_priority_support: boolean
  has_advanced_analytics: boolean
  has_api_access: boolean
  has_export: boolean
  has_collaboration: boolean

  // Affichage
  is_popular: boolean
  color: string
  icon: string
}

export interface PaymentMethodInfo {
  id: string
  name: string
  description: string
  icon: string
  provider: string
  methods: string[]
  requires_phone?: boolean
}

export interface AvailableMethods {
  cards: PaymentMethodInfo[]
  mobile_money: PaymentMethodInfo[]
  other: PaymentMethodInfo[]
  recommended_currency: Currency
  country_code: string | null
}

export interface CreatePaymentRequest {
  plan_code: string
  payment_method: PaymentMethod
  currency?: Currency
  country_code?: string
  phone_number?: string
  promo_code?: string
  success_url?: string
  cancel_url?: string
}

export interface CreatePaymentResponse {
  transaction_id: number
  provider: string
  payment_url: string | null
  checkout_id: string | null
  client_secret: string | null
  amount: number
  amount_formatted: string
  currency: Currency
  plan: string
  requires_redirect: boolean
  test_mode: boolean
  message: string | null
}

export interface Transaction {
  id: number
  amount: number
  currency: Currency
  status: TransactionStatus
  payment_method: PaymentMethod
  provider: string
  created_at: string
  completed_at: string | null
  plan_code: string | null
  plan_name: string | null
  amount_formatted: string
  status_message: string | null
}

export interface TransactionList {
  transactions: Transaction[]
  total: number
  page: number
  per_page: number
}

export interface PromoCodeValidation {
  valid: boolean
  code: string
  discount_type: 'percentage' | 'fixed_amount' | null
  discount_value: number | null
  discount_amount: number | null
  message: string | null
  expires_at: string | null
}

export interface UserSubscription {
  subscription_type: string
  plan_name: string
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  days_remaining: number | null
  auto_renew: boolean

  // Quotas
  ai_requests_limit: number
  ai_requests_used_today: number
  ai_requests_remaining: number
  storage_limit_mb: number
  storage_used_mb: number

  // Fonctionnalités
  features: string[]
  can_upgrade: boolean
}

export interface PaymentCallback {
  transaction_id?: number
  checkout_id?: string
  order_id?: string
  tx_ref?: string
  status?: string
}

export interface PaymentSuccess {
  success: boolean
  message: string
  transaction_id: number
  subscription_activated: boolean
  subscription_type: string
  subscription_ends_at: string | null
  plan: string
}

// ==================== API FUNCTIONS ====================

/**
 * Récupère la liste des plans d'abonnement
 */
export async function getPlans(currency?: Currency): Promise<{ plans: SubscriptionPlan[], recommended_plan: string }> {
  const params = currency ? { currency } : {}
  const response = await api.get('/payments/plans', { params })
  return response.data
}

/**
 * Récupère les détails d'un plan spécifique
 */
export async function getPlanDetails(planCode: string): Promise<SubscriptionPlan> {
  const response = await api.get(`/payments/plans/${planCode}`)
  return response.data
}

/**
 * Récupère les méthodes de paiement disponibles selon le pays
 */
export async function getAvailablePaymentMethods(
  countryCode?: string,
  currency?: Currency
): Promise<AvailableMethods> {
  const params: Record<string, string> = {}
  if (countryCode) params.country_code = countryCode
  if (currency) params.currency = currency

  const response = await api.get('/payments/methods', { params })
  return response.data
}

/**
 * Crée un nouveau paiement
 */
export async function createPayment(data: CreatePaymentRequest): Promise<CreatePaymentResponse> {
  const response = await api.post('/payments/create', data)
  return response.data
}

/**
 * Callback après retour de paiement
 */
export async function handlePaymentCallback(data: PaymentCallback): Promise<PaymentSuccess> {
  const response = await api.post('/payments/callback', data)
  return response.data
}

/**
 * Vérifie le statut d'une transaction
 */
export async function verifyTransaction(transactionId: number): Promise<{
  id: number
  status: TransactionStatus
  amount: number
  amount_formatted: string
  currency: Currency
  payment_method: PaymentMethod
  created_at: string
  completed_at: string | null
  message: string | null
}> {
  const response = await api.get(`/payments/verify/${transactionId}`)
  return response.data
}

/**
 * Récupère l'historique des transactions
 */
export async function getTransactionHistory(
  page: number = 1,
  perPage: number = 20
): Promise<TransactionList> {
  const response = await api.get('/payments/history', {
    params: { page, per_page: perPage }
  })
  return response.data
}

/**
 * Valide un code promo
 */
export async function validatePromoCode(
  code: string,
  planCode: string,
  currency: Currency = 'EUR'
): Promise<PromoCodeValidation> {
  const response = await api.post('/payments/promo/validate', {
    code,
    plan_code: planCode,
    currency
  })
  return response.data
}

/**
 * Récupère l'abonnement actuel de l'utilisateur
 */
export async function getUserSubscription(): Promise<UserSubscription> {
  const response = await api.get('/payments/subscription')
  return response.data
}

/**
 * Simule un paiement (mode test)
 */
export async function simulatePayment(
  checkoutId: string,
  action: 'approve' | 'decline'
): Promise<{ success: boolean; message: string; redirect_url: string | null }> {
  const response = await api.post('/payments/simulate', {
    checkout_id: checkoutId,
    action
  })
  return response.data
}

// ==================== HELPERS ====================

/**
 * Formate un prix selon la devise
 */
export function formatPrice(amount: number, currency: Currency): string {
  const symbols: Record<Currency, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£',
    XOF: 'FCFA',
    XAF: 'FCFA',
    NGN: '₦',
    GHS: 'GH₵',
    KES: 'KSh',
    ZAR: 'R',
    MAD: 'DH'
  }

  // Pour EUR, USD, GBP, MAD les montants sont en centimes
  const isDecimal = ['EUR', 'USD', 'GBP', 'MAD'].includes(currency)
  const value = isDecimal ? amount / 100 : amount

  if (isDecimal) {
    return `${value.toFixed(2)} ${symbols[currency]}`
  }

  return `${value.toLocaleString('fr-FR')} ${symbols[currency]}`
}

/**
 * Récupère le prix d'un plan selon la devise
 */
export function getPlanPrice(plan: SubscriptionPlan, currency: Currency): number {
  const priceMap: Record<Currency, number> = {
    EUR: plan.price_eur * 100, // Convertir en centimes pour uniformité
    USD: plan.price_usd * 100,
    GBP: plan.price_eur * 100 * 0.85, // Approximation
    XOF: plan.price_xof,
    XAF: plan.price_xaf,
    NGN: plan.price_ngn,
    GHS: plan.price_ngn * 0.01, // Approximation
    KES: plan.price_ngn * 0.05, // Approximation
    ZAR: plan.price_ngn * 0.01, // Approximation
    MAD: plan.price_mad * 100
  }

  return priceMap[currency] || plan.price_eur * 100
}

/**
 * Détermine la devise recommandée selon le pays
 */
export function getCurrencyByCountry(countryCode: string): Currency {
  const countryToCurrency: Record<string, Currency> = {
    // Europe
    FR: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR', BE: 'EUR', NL: 'EUR',
    // UK
    GB: 'GBP',
    // USA/Canada
    US: 'USD', CA: 'USD',
    // Afrique de l'Ouest (FCFA)
    SN: 'XOF', CI: 'XOF', ML: 'XOF', BF: 'XOF', BJ: 'XOF', TG: 'XOF',
    // Afrique Centrale
    CM: 'XAF', GA: 'XAF', CG: 'XAF',
    // Autres Afrique
    NG: 'NGN', GH: 'GHS', KE: 'KES', ZA: 'ZAR', MA: 'MAD'
  }

  return countryToCurrency[countryCode.toUpperCase()] || 'EUR'
}

/**
 * Vérifie si c'est un pays africain (pour Mobile Money)
 */
export function isAfricanCountry(countryCode: string): boolean {
  const africanCountries = [
    'SN', 'CI', 'ML', 'BF', 'BJ', 'TG', 'NE', 'GW',
    'CM', 'GA', 'CG', 'TD', 'CF', 'GQ',
    'NG', 'GH', 'KE', 'TZ', 'UG', 'RW',
    'ZA', 'MA', 'TN', 'EG', 'DZ'
  ]
  return africanCountries.includes(countryCode.toUpperCase())
}

/**
 * Récupère l'icône pour une méthode de paiement
 */
export function getPaymentMethodIcon(method: PaymentMethod): string {
  const icons: Record<string, string> = {
    card: '💳',
    card_visa: '💳',
    card_mastercard: '💳',
    paypal: '🅿️',
    orange_money: '🟠',
    wave: '🌊',
    free_money: '🔵',
    mtn_momo: '💛',
    moov_money: '🔵',
    mpesa: '💚',
    airtel_money: '🔴',
    bank_transfer: '🏦'
  }
  return icons[method] || '💰'
}
