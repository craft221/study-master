'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Crown, Sparkles, ArrowRight, Loader2 } from 'lucide-react'
import { handlePaymentCallback, type PaymentSuccess } from '@/services/payments'

export default function PaymentSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<PaymentSuccess | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    confirmPayment()
  }, [])

  async function confirmPayment() {
    try {
      setLoading(true)

      // Récupérer les paramètres selon le provider
      const sessionId = searchParams.get('session_id') // Stripe
      const token = searchParams.get('token') // PayPal
      const txRef = searchParams.get('tx_ref') // PayDunya
      const transactionId = searchParams.get('transaction_id')

      const callbackData = {
        checkout_id: sessionId || undefined,
        order_id: token || undefined,
        tx_ref: txRef || undefined,
        transaction_id: transactionId ? parseInt(transactionId) : undefined,
        status: searchParams.get('status') || 'success'
      }

      const response = await handlePaymentCallback(callbackData)
      setResult(response)
    } catch (err: any) {
      console.error('Erreur confirmation:', err)
      setError(err.response?.data?.detail || 'Erreur lors de la confirmation')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto mb-4" />
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Confirmation de votre paiement en cours...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">❌</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Erreur de confirmation
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {error}
          </p>
          <div className="space-y-3">
            <Link
              href="/pricing"
              className="block w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
            >
              Réessayer
            </Link>
            <Link
              href="/dashboard"
              className="block w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Retour au tableau de bord
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
        {/* Animation de succès */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-25"></div>
          <div className="relative w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Paiement réussi ! 🎉
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Merci pour votre confiance. Votre abonnement est maintenant actif.
        </p>

        {/* Détails de l'abonnement */}
        {result && (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Crown className="w-8 h-8 text-yellow-500" />
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                {result.plan}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Type d'abonnement</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {result.subscription_type}
                </span>
              </div>
              {result.subscription_ends_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Valide jusqu'au</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {new Date(result.subscription_ends_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ce qui vous attend */}
        <div className="mb-8">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
            Ce qui vous attend maintenant :
          </h2>
          <ul className="space-y-2 text-left">
            {[
              'Requêtes IA illimitées',
              'Notes et flashcards sans limite',
              'Support prioritaire',
              'Toutes les fonctionnalités premium'
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <Sparkles className="w-4 h-4 text-yellow-500" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            Commencer à étudier
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/ai"
            className="block w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Essayer le Hub IA
          </Link>
        </div>

        {/* Numéro de transaction */}
        {result?.transaction_id && (
          <p className="mt-6 text-xs text-gray-400">
            Transaction #{result.transaction_id}
          </p>
        )}
      </div>
    </div>
  )
}
