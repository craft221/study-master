'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CreditCard, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react'
import { simulatePayment } from '@/services/payments'

export default function PaymentSimulatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkoutId = searchParams.get('checkout_id') || ''
  const plan = searchParams.get('plan') || 'Premium'
  const method = searchParams.get('method') || 'Carte bancaire'
  const provider = searchParams.get('provider') || 'stripe'

  async function handleSimulate(action: 'approve' | 'decline') {
    if (!checkoutId) {
      setError('Session de paiement invalide')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await simulatePayment(checkoutId, action)

      if (result.success) {
        router.push(result.redirect_url || '/payment/success')
      } else {
        router.push(result.redirect_url || '/payment/cancel')
      }
    } catch (err: any) {
      console.error('Erreur simulation:', err)
      setError(err.response?.data?.detail || 'Erreur lors de la simulation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-4">
          <div className="flex items-center gap-2 text-white">
            <AlertTriangle className="w-6 h-6" />
            <span className="font-bold">MODE TEST</span>
          </div>
        </div>

        <div className="p-8">
          {/* Icône paiement */}
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CreditCard className="w-10 h-10 text-blue-500" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-2">
            Simulation de paiement
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
            Ceci est une page de test. En production, vous seriez redirigé vers le provider de paiement.
          </p>

          {/* Détails du paiement */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              Détails de la commande
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Plan</span>
                <span className="font-medium text-gray-900 dark:text-white">{plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Méthode</span>
                <span className="font-medium text-gray-900 dark:text-white">{method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Provider</span>
                <span className="font-medium text-gray-900 dark:text-white capitalize">{provider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Session ID</span>
                <span className="font-mono text-xs text-gray-600 dark:text-gray-300">
                  {checkoutId.slice(0, 20)}...
                </span>
              </div>
            </div>
          </div>

          {/* Message d'erreur */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Actions de simulation */}
          <div className="space-y-3">
            <button
              onClick={() => handleSimulate('approve')}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Simuler paiement réussi
                </>
              )}
            </button>

            <button
              onClick={() => handleSimulate('decline')}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <XCircle className="w-5 h-5" />
                  Simuler paiement refusé
                </>
              )}
            </button>
          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              ⚠️ Mode développement
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Cette page n'apparaît que lorsque les clés API de paiement ne sont pas configurées.
              En production, les utilisateurs seront redirigés vers les vraies pages de paiement
              de Stripe, PayPal ou PayDunya.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
