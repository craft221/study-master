'use client'

import Link from 'next/link'
import { XCircle, ArrowLeft, HelpCircle, MessageCircle } from 'lucide-react'

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
        {/* Icône */}
        <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-orange-500" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Paiement annulé
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Votre paiement a été annulé. Aucun montant n'a été débité de votre compte.
        </p>

        {/* Raisons possibles */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6 text-left">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            Un problème ?
          </h3>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <li>• Vous avez changé d'avis ? Pas de souci !</li>
            <li>• Problème technique ? Réessayez ou contactez-nous.</li>
            <li>• Besoin de plus d'infos ? Consultez notre FAQ.</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/pricing"
            className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour aux plans
          </Link>

          <Link
            href="/dashboard"
            className="block w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Continuer en version gratuite
          </Link>
        </div>

        {/* Contact */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Besoin d'aide ?
          </p>
          <a
            href="mailto:support@studera.app"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <MessageCircle className="w-4 h-4" />
            Contacter le support
          </a>
        </div>
      </div>
    </div>
  )
}
