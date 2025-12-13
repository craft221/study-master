'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Crown, Star, Zap, X, ArrowRight, Clock, Sparkles,
  Check, AlertTriangle, Gift
} from 'lucide-react'

interface UpgradeBenefit {
  requests: number
  price_usd: string
  price_xof: string
}

interface QuotaExceededError {
  message: string
  code: string
  subscription_type: string
  max_requests: number
  used_requests: number
  remaining: number
  reset_time: string
  upgrade_available: boolean
  next_plan: string | null
  upgrade_url: string
  upgrade_benefits: Record<string, UpgradeBenefit> | null
}

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  error: QuotaExceededError | null
  currency?: 'USD' | 'XOF'
}

export default function UpgradeModal({ isOpen, onClose, error, currency = 'USD' }: UpgradeModalProps) {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!isVisible || !error) return null

  const planIcons: Record<string, React.ReactNode> = {
    FREE: <Gift className="w-6 h-6" />,
    PREMIUM: <Star className="w-6 h-6" />,
    PREMIUM_PLUS: <Crown className="w-6 h-6" />,
    INSTITUTIONAL: <Zap className="w-6 h-6" />
  }

  const planColors: Record<string, string> = {
    FREE: 'bg-gray-500',
    PREMIUM: 'bg-blue-500',
    PREMIUM_PLUS: 'bg-purple-500',
    INSTITUTIONAL: 'bg-green-500'
  }

  const handleUpgrade = () => {
    onClose()
    router.push('/pricing')
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all duration-300 ${
          isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        {/* Header avec gradient */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Quota épuisé</h2>
              <p className="text-white/80 text-sm">
                {error.used_requests}/{error.max_requests} requêtes utilisées
              </p>
            </div>
          </div>

          <p className="text-white/90">
            Vous avez utilisé toutes vos requêtes IA pour aujourd'hui avec le plan{' '}
            <span className="font-semibold">{error.subscription_type}</span>.
          </p>
        </div>

        {/* Contenu */}
        <div className="p-6">
          {/* Timer de reset */}
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 mb-6 p-3 bg-gray-100 dark:bg-gray-700 rounded-xl">
            <Clock className="w-5 h-5" />
            <span>Votre quota sera réinitialisé à <strong>{error.reset_time}</strong></span>
          </div>

          {/* Options de mise à niveau */}
          {error.upgrade_available && error.upgrade_benefits && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                Passez à un plan supérieur
              </h3>

              <div className="space-y-3">
                {Object.entries(error.upgrade_benefits).map(([planName, benefits]) => (
                  <div
                    key={planName}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
                      planName === error.next_plan
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 dark:border-gray-600'
                    }`}
                    onClick={handleUpgrade}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg text-white ${planColors[planName]}`}>
                          {planIcons[planName]}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {planName.replace('_', ' ')}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {benefits.requests} requêtes/jour
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">
                          {currency === 'XOF' ? benefits.price_xof : benefits.price_usd}
                        </p>
                        <p className="text-xs text-gray-400">/mois</p>
                      </div>
                    </div>

                    {planName === error.next_plan && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                          <Check className="w-4 h-4" />
                          <span>Recommandé pour vous</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="mt-6 space-y-3">
            {error.upgrade_available ? (
              <>
                <button
                  onClick={handleUpgrade}
                  className="w-full py-3 bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  Voir les offres
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Attendre demain
                </button>
              </>
            ) : (
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/30 rounded-xl">
                <p className="text-green-700 dark:text-green-300">
                  Vous avez déjà le plan maximum ! Votre quota sera réinitialisé à minuit.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook pour détecter et afficher le modal automatiquement
export function useQuotaExceededHandler() {
  const [showModal, setShowModal] = useState(false)
  const [quotaError, setQuotaError] = useState<QuotaExceededError | null>(null)

  const handleError = (error: any) => {
    // Vérifier si c'est une erreur 429 avec notre format
    if (error?.response?.status === 429) {
      const detail = error.response.data?.detail
      if (detail?.code === 'QUOTA_EXCEEDED') {
        setQuotaError(detail)
        setShowModal(true)
        return true // Erreur gérée
      }
    }
    return false // Erreur non gérée
  }

  const closeModal = () => {
    setShowModal(false)
    setQuotaError(null)
  }

  return {
    showModal,
    quotaError,
    handleError,
    closeModal,
    UpgradeModalComponent: () => (
      <UpgradeModal
        isOpen={showModal}
        onClose={closeModal}
        error={quotaError}
      />
    )
  }
}
