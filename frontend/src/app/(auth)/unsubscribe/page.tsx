'use client'

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { BookOpen, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import api from '@/lib/api'

function UnsubscribeContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Lien de désinscription invalide.')
      return
    }

    const unsubscribe = async () => {
      try {
        const response = await api.get(`/email/unsubscribe?token=${token}`)
        setStatus('success')
        setMessage(response.data.message || 'Vous avez été désinscrit des emails.')
      } catch (err: any) {
        setStatus('error')
        setMessage(err.response?.data?.detail || 'Erreur lors de la désinscription.')
      }
    }

    unsubscribe()
  }, [token])

  return (
    <div className="max-w-md w-full">
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center space-x-2 mb-6">
          <BookOpen className="h-10 w-10 text-primary-600" />
          <span className="text-3xl font-bold text-gray-900">Studera</span>
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 text-center space-y-4">
        {status === 'loading' && (
          <p className="text-gray-500">Traitement en cours...</p>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold text-gray-900">{message}</h2>
            <p className="text-gray-600">
              Vous pouvez réactiver les emails dans vos paramètres à tout moment.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
            <h2 className="text-xl font-semibold text-gray-900">{message}</h2>
          </>
        )}

        <Link
          href="/login"
          className="inline-flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-semibold mt-4"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Retour à la connexion</span>
        </Link>
      </div>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4">
      <Suspense fallback={
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <p className="text-gray-500">Chargement...</p>
          </div>
        </div>
      }>
        <UnsubscribeContent />
      </Suspense>
    </div>
  )
}
