'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Crown, Star, Gift, Building, Calendar, Check, X, Zap, Sparkles,
  CreditCard, Smartphone, Globe, ArrowRight, Loader2, Tag, AlertCircle
} from 'lucide-react'
import {
  getPlans,
  getAvailablePaymentMethods,
  createPayment,
  validatePromoCode,
  getUserSubscription,
  formatPrice,
  getCurrencyByCountry,
  isAfricanCountry,
  type SubscriptionPlan,
  type AvailableMethods,
  type PaymentMethod,
  type Currency,
  type UserSubscription
} from '@/services/payments'

// Icônes par plan
const planIcons: Record<string, React.ReactNode> = {
  gift: <Gift className="w-8 h-8" />,
  star: <Star className="w-8 h-8" />,
  crown: <Crown className="w-8 h-8" />,
  building: <Building className="w-8 h-8" />,
  calendar: <Calendar className="w-8 h-8" />
}

// Couleurs par plan
const planColors: Record<string, string> = {
  gray: 'from-gray-500 to-gray-600',
  blue: 'from-blue-500 to-blue-600',
  purple: 'from-purple-500 to-purple-600',
  green: 'from-green-500 to-green-600'
}

export default function PricingPage() {
  const router = useRouter()

  // États
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [availableMethods, setAvailableMethods] = useState<AvailableMethods | null>(null)
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  // Sélection
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [currency, setCurrency] = useState<Currency>('EUR')
  const [countryCode, setCountryCode] = useState<string>('FR')

  // Code promo
  const [promoCode, setPromoCode] = useState('')
  const [promoValidation, setPromoValidation] = useState<{
    valid: boolean
    discount_amount?: number
    message?: string
  } | null>(null)
  const [validatingPromo, setValidatingPromo] = useState(false)

  // Mobile Money
  const [phoneNumber, setPhoneNumber] = useState('')

  // Erreur
  const [error, setError] = useState<string | null>(null)

  // Charger les données initiales
  useEffect(() => {
    loadData()
    detectCountry()
  }, [])

  // Charger les méthodes de paiement quand le pays change
  useEffect(() => {
    if (countryCode) {
      loadPaymentMethods()
      setCurrency(getCurrencyByCountry(countryCode))
    }
  }, [countryCode])

  async function loadData() {
    try {
      setLoading(true)
      const [plansData, subscriptionData] = await Promise.all([
        getPlans(),
        getUserSubscription().catch(() => null)
      ])

      setPlans(plansData.plans)
      setCurrentSubscription(subscriptionData)
    } catch (err) {
      console.error('Erreur chargement données:', err)
      setError('Erreur lors du chargement des plans')
    } finally {
      setLoading(false)
    }
  }

  async function loadPaymentMethods() {
    try {
      console.log('[Pricing] Chargement méthodes pour:', countryCode, currency)
      const methods = await getAvailablePaymentMethods(countryCode, currency)
      console.log('[Pricing] Méthodes disponibles:', methods)
      setAvailableMethods(methods)
    } catch (err) {
      console.error('Erreur chargement méthodes:', err)
    }
  }

  async function detectCountry() {
    // Essayer d'abord la géolocalisation IP (plus fiable)
    try {
      // Utiliser une API de géolocalisation IP gratuite
      const response = await fetch('https://ipapi.co/json/', {
        signal: AbortSignal.timeout(3000) // Timeout de 3 secondes
      })
      if (response.ok) {
        const data = await response.json()
        if (data.country_code) {
          console.log('[Pricing] Pays détecté via IP:', data.country_code, data.country_name)
          setCountryCode(data.country_code)
          return
        }
      }
    } catch (err) {
      console.log('[Pricing] Géolocalisation IP échouée, fallback sur timezone')
    }

    // Fallback: Détection basée sur la timezone
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      console.log('[Pricing] Timezone détectée:', timezone)

      // Mapping timezone -> pays (étendu)
      const timezoneToCountry: Record<string, string> = {
        // Afrique de l'Ouest (UTC+0)
        'Africa/Dakar': 'SN',
        'Africa/Abidjan': 'CI',
        'Africa/Bamako': 'ML',
        'Africa/Ouagadougou': 'BF',
        'Africa/Porto-Novo': 'BJ',
        'Africa/Niamey': 'NE',
        'Africa/Conakry': 'GN',
        'Africa/Bissau': 'GW',
        'Africa/Nouakchott': 'MR',
        'Africa/Freetown': 'SL',
        'Africa/Monrovia': 'LR',
        'Africa/Banjul': 'GM',
        // Afrique de l'Ouest (UTC+1)
        'Africa/Lagos': 'NG',
        'Africa/Accra': 'GH',
        'Africa/Lome': 'TG',
        // Afrique Centrale
        'Africa/Douala': 'CM',
        'Africa/Libreville': 'GA',
        'Africa/Brazzaville': 'CG',
        'Africa/Kinshasa': 'CD',
        'Africa/Bangui': 'CF',
        'Africa/Malabo': 'GQ',
        'Africa/Ndjamena': 'TD',
        // Afrique de l'Est
        'Africa/Nairobi': 'KE',
        'Africa/Dar_es_Salaam': 'TZ',
        'Africa/Kampala': 'UG',
        'Africa/Kigali': 'RW',
        'Africa/Addis_Ababa': 'ET',
        // Afrique du Nord
        'Africa/Casablanca': 'MA',
        'Africa/Tunis': 'TN',
        'Africa/Algiers': 'DZ',
        'Africa/Cairo': 'EG',
        // Afrique australe
        'Africa/Johannesburg': 'ZA',
        // Europe
        'Europe/Paris': 'FR',
        'Europe/London': 'GB',
        'Europe/Brussels': 'BE',
        'Europe/Berlin': 'DE',
        'Europe/Madrid': 'ES',
        'Europe/Rome': 'IT',
        'Europe/Zurich': 'CH',
        'Europe/Amsterdam': 'NL',
        // Amérique
        'America/New_York': 'US',
        'America/Los_Angeles': 'US',
        'America/Chicago': 'US',
        'America/Toronto': 'CA',
        'America/Montreal': 'CA',
      }

      // Chercher une correspondance exacte d'abord
      if (timezoneToCountry[timezone]) {
        setCountryCode(timezoneToCountry[timezone])
        console.log('[Pricing] Pays détecté via timezone:', timezoneToCountry[timezone])
        return
      }

      // Sinon, chercher par région
      if (timezone.startsWith('Africa/')) {
        // Défaut Afrique = Sénégal (FCFA)
        setCountryCode('SN')
        console.log('[Pricing] Pays par défaut Afrique: SN')
      } else if (timezone.startsWith('Europe/')) {
        setCountryCode('FR')
      } else if (timezone.startsWith('America/')) {
        setCountryCode('US')
      }
    } catch (err) {
      console.error('Erreur détection pays:', err)
      // Défaut: France
      setCountryCode('FR')
    }
  }

  async function handleValidatePromo() {
    if (!promoCode || !selectedPlan) return

    setValidatingPromo(true)
    try {
      const result = await validatePromoCode(promoCode, selectedPlan.code, currency)
      setPromoValidation({
        valid: result.valid,
        discount_amount: result.discount_amount || undefined,
        message: result.message || undefined
      })
    } catch (err) {
      setPromoValidation({ valid: false, message: 'Erreur de validation' })
    } finally {
      setValidatingPromo(false)
    }
  }

  async function handlePayment() {
    if (!selectedPlan || !selectedMethod) return

    // Vérifier le numéro de téléphone pour Mobile Money
    const mobileMoneyMethods = ['orange_money', 'wave', 'mtn_momo', 'mpesa', 'airtel_money']
    if (mobileMoneyMethods.includes(selectedMethod) && !phoneNumber) {
      setError('Veuillez entrer votre numéro de téléphone')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const result = await createPayment({
        plan_code: selectedPlan.code,
        payment_method: selectedMethod,
        currency,
        country_code: countryCode,
        phone_number: phoneNumber || undefined,
        promo_code: promoValidation?.valid ? promoCode : undefined,
        success_url: `${window.location.origin}/payment/success`,
        cancel_url: `${window.location.origin}/payment/cancel`
      })

      // Rediriger vers la page de paiement
      if (result.payment_url) {
        window.location.href = result.payment_url
      } else if (result.test_mode) {
        // Mode test - afficher un message
        router.push(`/payment/simulate?checkout_id=${result.checkout_id}&plan=${selectedPlan.code}`)
      }
    } catch (err: any) {
      console.error('Erreur paiement:', err)
      setError(err.response?.data?.detail || 'Erreur lors du paiement')
    } finally {
      setProcessing(false)
    }
  }

  function getPriceForCurrency(plan: SubscriptionPlan): string {
    const prices: Record<Currency, number> = {
      EUR: plan.price_eur,
      USD: plan.price_usd,
      GBP: plan.price_eur * 0.85,
      XOF: plan.price_xof,
      XAF: plan.price_xaf,
      NGN: plan.price_ngn,
      GHS: plan.price_ngn * 0.01,
      KES: plan.price_ngn * 0.05,
      ZAR: plan.price_ngn * 0.01,
      MAD: plan.price_mad
    }

    const price = prices[currency] || plan.price_eur
    const isDecimal = ['EUR', 'USD', 'GBP', 'MAD'].includes(currency)

    if (isDecimal) {
      return `${price.toFixed(2)}`
    }
    return price.toLocaleString('fr-FR')
  }

  function getCurrencySymbol(): string {
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
    return symbols[currency] || '€'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choisissez votre plan
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Débloquez tout le potentiel de Studera avec un abonnement adapté à vos besoins
          </p>

          {/* Sélecteur de devise */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <Globe className="w-5 h-5 text-gray-500" />
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <optgroup label="Europe">
                <option value="FR">🇫🇷 France</option>
                <option value="BE">🇧🇪 Belgique</option>
                <option value="CH">🇨🇭 Suisse</option>
                <option value="GB">🇬🇧 Royaume-Uni</option>
              </optgroup>
              <optgroup label="Amérique">
                <option value="US">🇺🇸 États-Unis</option>
                <option value="CA">🇨🇦 Canada</option>
              </optgroup>
              <optgroup label="Afrique de l'Ouest">
                <option value="SN">🇸🇳 Sénégal</option>
                <option value="CI">🇨🇮 Côte d'Ivoire</option>
                <option value="ML">🇲🇱 Mali</option>
                <option value="BF">🇧🇫 Burkina Faso</option>
                <option value="BJ">🇧🇯 Bénin</option>
              </optgroup>
              <optgroup label="Afrique Centrale">
                <option value="CM">🇨🇲 Cameroun</option>
                <option value="GA">🇬🇦 Gabon</option>
                <option value="CG">🇨🇬 Congo</option>
              </optgroup>
              <optgroup label="Autres">
                <option value="NG">🇳🇬 Nigeria</option>
                <option value="GH">🇬🇭 Ghana</option>
                <option value="KE">🇰🇪 Kenya</option>
                <option value="MA">🇲🇦 Maroc</option>
                <option value="ZA">🇿🇦 Afrique du Sud</option>
              </optgroup>
            </select>
          </div>
        </div>

        {/* Abonnement actuel */}
        {currentSubscription && currentSubscription.subscription_type !== 'FREE' && (
          <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3">
              <Crown className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-100">
                  Abonnement actuel: {currentSubscription.plan_name}
                </p>
                {currentSubscription.ends_at && (
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Expire le {new Date(currentSubscription.ends_at).toLocaleDateString('fr-FR')}
                    {currentSubscription.days_remaining !== null && ` (${currentSubscription.days_remaining} jours restants)`}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Grille des plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {plans.filter(p => p.code !== 'premium_yearly').map((plan) => (
            <div
              key={plan.id}
              onClick={() => plan.code !== 'free' && setSelectedPlan(plan)}
              className={`
                relative rounded-2xl p-6 cursor-pointer transition-all duration-300
                ${plan.code === 'free' ? 'cursor-not-allowed opacity-60' : ''}
                ${selectedPlan?.id === plan.id
                  ? 'ring-2 ring-primary shadow-xl scale-[1.02]'
                  : 'hover:shadow-lg hover:scale-[1.01]'}
                ${plan.is_popular ? 'border-2 border-primary' : 'border border-gray-200 dark:border-gray-700'}
                bg-white dark:bg-gray-800
              `}
            >
              {/* Badge populaire */}
              {plan.is_popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-primary text-white text-sm font-semibold rounded-full">
                    Populaire
                  </span>
                </div>
              )}

              {/* Icône et nom */}
              <div className={`
                w-14 h-14 rounded-xl flex items-center justify-center mb-4
                bg-gradient-to-br ${planColors[plan.color] || planColors.gray} text-white
              `}>
                {planIcons[plan.icon] || <Star className="w-8 h-8" />}
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {plan.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {plan.description}
              </p>

              {/* Prix */}
              <div className="mb-6">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  {getPriceForCurrency(plan)}
                </span>
                <span className="text-gray-500 dark:text-gray-400 ml-1">
                  {getCurrencySymbol()}
                </span>
                {plan.duration_days <= 365 && (
                  <span className="text-gray-500 dark:text-gray-400 text-sm">
                    /{plan.duration_days === 30 ? 'mois' : 'an'}
                  </span>
                )}
              </div>

              {/* Fonctionnalités */}
              <ul className="space-y-2 mb-6">
                {plan.features.slice(0, 5).map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600 dark:text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Bouton */}
              <button
                disabled={plan.code === 'free'}
                className={`
                  w-full py-3 rounded-xl font-semibold transition-colors
                  ${plan.code === 'free'
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                    : selectedPlan?.id === plan.id
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                {plan.code === 'free'
                  ? 'Plan actuel'
                  : selectedPlan?.id === plan.id
                    ? 'Sélectionné'
                    : 'Choisir'
                }
              </button>
            </div>
          ))}
        </div>

        {/* Option annuelle */}
        {plans.find(p => p.code === 'premium_yearly') && selectedPlan?.code === 'premium' && (
          <div className="mb-12 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500 rounded-xl text-white">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    Économisez avec le plan annuel !
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    2 mois offerts - Soit 17% d'économie
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPlan(plans.find(p => p.code === 'premium_yearly')!)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                Passer à l'annuel
              </button>
            </div>
          </div>
        )}

        {/* Section paiement */}
        {selectedPlan && selectedPlan.code !== 'free' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Finaliser votre commande
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Colonne gauche - Méthodes de paiement */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Méthode de paiement
                </h3>

                <div className="space-y-3">
                  {/* Cartes */}
                  {availableMethods?.cards.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setSelectedMethod('card' as PaymentMethod)}
                      className={`
                        w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4
                        ${selectedMethod === 'card'
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }
                      `}
                    >
                      <div className="text-2xl">💳</div>
                      <div className="text-left">
                        <p className="font-semibold text-gray-900 dark:text-white">{method.name}</p>
                        <p className="text-sm text-gray-500">{method.description}</p>
                      </div>
                    </button>
                  ))}

                  {/* PayPal */}
                  {availableMethods?.other.filter(m => m.id === 'paypal').map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setSelectedMethod('paypal' as PaymentMethod)}
                      className={`
                        w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4
                        ${selectedMethod === 'paypal'
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }
                      `}
                    >
                      <div className="text-2xl">🅿️</div>
                      <div className="text-left">
                        <p className="font-semibold text-gray-900 dark:text-white">{method.name}</p>
                        <p className="text-sm text-gray-500">{method.description}</p>
                      </div>
                    </button>
                  ))}

                  {/* Mobile Money */}
                  {availableMethods?.mobile_money && availableMethods.mobile_money.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 pt-4">
                        <Smartphone className="w-5 h-5 text-gray-500" />
                        <span className="text-sm font-medium text-gray-500">Mobile Money</span>
                      </div>
                      {availableMethods.mobile_money.map((method) => (
                        <button
                          key={method.id}
                          onClick={() => setSelectedMethod(method.id as PaymentMethod)}
                          className={`
                            w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4
                            ${selectedMethod === method.id
                              ? 'border-primary bg-primary/5'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                            }
                          `}
                        >
                          <div className="text-2xl">
                            {method.id === 'orange_money' && '🟠'}
                            {method.id === 'wave' && '🌊'}
                            {method.id === 'mtn_momo' && '💛'}
                            {method.id === 'mpesa' && '💚'}
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-gray-900 dark:text-white">{method.name}</p>
                            <p className="text-sm text-gray-500">{method.description}</p>
                          </div>
                        </button>
                      ))}

                      {/* Champ numéro de téléphone */}
                      {selectedMethod && ['orange_money', 'wave', 'mtn_momo', 'mpesa', 'airtel_money'].includes(selectedMethod) && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Numéro de téléphone
                          </label>
                          <input
                            type="tel"
                            placeholder="+221 77 123 45 67"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Colonne droite - Récapitulatif */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                  Récapitulatif
                </h3>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 space-y-4">
                  {/* Plan sélectionné */}
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Plan {selectedPlan.name}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {getPriceForCurrency(selectedPlan)} {getCurrencySymbol()}
                    </span>
                  </div>

                  {/* Durée */}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Durée</span>
                    <span className="text-gray-600 dark:text-gray-300">
                      {selectedPlan.duration_days === 30 ? '1 mois' : `${Math.round(selectedPlan.duration_days / 30)} mois`}
                    </span>
                  </div>

                  {/* Code promo */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Code promo
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="WELCOME20"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value.toUpperCase())
                          setPromoValidation(null)
                        }}
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <button
                        onClick={handleValidatePromo}
                        disabled={!promoCode || validatingPromo}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50"
                      >
                        {validatingPromo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Tag className="w-5 h-5" />}
                      </button>
                    </div>
                    {promoValidation && (
                      <p className={`mt-2 text-sm ${promoValidation.valid ? 'text-green-600' : 'text-red-500'}`}>
                        {promoValidation.message}
                      </p>
                    )}
                  </div>

                  {/* Total */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">Total</span>
                      <div className="text-right">
                        {promoValidation?.valid && promoValidation.discount_amount && (
                          <span className="text-sm text-gray-400 line-through mr-2">
                            {getPriceForCurrency(selectedPlan)} {getCurrencySymbol()}
                          </span>
                        )}
                        <span className="text-2xl font-bold text-primary">
                          {promoValidation?.valid && promoValidation.discount_amount
                            ? formatPrice(
                                (selectedPlan.price_eur * 100 - promoValidation.discount_amount),
                                currency
                              )
                            : `${getPriceForCurrency(selectedPlan)} ${getCurrencySymbol()}`
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Erreur */}
                {error && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                {/* Bouton de paiement */}
                <button
                  onClick={handlePayment}
                  disabled={!selectedMethod || processing}
                  className={`
                    w-full mt-6 py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2
                    transition-all
                    ${selectedMethod && !processing
                      ? 'bg-gradient-to-r from-primary to-primary-dark text-white hover:opacity-90'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Traitement en cours...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Payer maintenant
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                {/* Sécurité */}
                <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  🔒 Paiement sécurisé via {selectedMethod === 'card' ? 'Stripe' : selectedMethod === 'paypal' ? 'PayPal' : 'PayDunya'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* FAQ */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
            Questions fréquentes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                q: "Puis-je changer de plan à tout moment ?",
                a: "Oui, vous pouvez passer à un plan supérieur à tout moment. La différence sera calculée au prorata."
              },
              {
                q: "Comment fonctionne le paiement Mobile Money ?",
                a: "Après validation, vous recevrez une notification sur votre téléphone pour confirmer le paiement via Orange Money, Wave ou MTN."
              },
              {
                q: "Y a-t-il un engagement ?",
                a: "Non, tous nos plans sont sans engagement. Vous pouvez annuler à tout moment."
              },
              {
                q: "Les paiements sont-ils sécurisés ?",
                a: "Oui, tous les paiements sont traités par des partenaires certifiés (Stripe, PayPal, PayDunya) avec chiffrement SSL."
              }
            ].map((item, i) => (
              <div key={i} className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{item.q}</h3>
                <p className="text-gray-600 dark:text-gray-300">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
