'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Mail, ArrowRight, AlertCircle, RefreshCw, CheckCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useTranslation } from '@/contexts/LanguageContext'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()

  const email = searchParams.get('email') || ''

  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown pour le bouton de renvoi
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Focus sur le premier input au chargement
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const handleChange = (index: number, value: string) => {
    // Ne garder que les chiffres
    const digit = value.replace(/\D/g, '').slice(-1)

    const newCode = [...code]
    newCode[index] = digit
    setCode(newCode)
    setError('')

    // Auto-focus sur le prochain input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit si tous les chiffres sont remplis
    if (digit && index === 5) {
      const fullCode = newCode.join('')
      if (fullCode.length === 6) {
        handleSubmit(fullCode)
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)

    if (pastedData.length === 6) {
      const newCode = pastedData.split('')
      setCode(newCode)
      handleSubmit(pastedData)
    }
  }

  const handleSubmit = async (fullCode?: string) => {
    const codeToSubmit = fullCode || code.join('')

    if (codeToSubmit.length !== 6) {
      setError('Veuillez entrer le code complet à 6 chiffres')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await api.post('/auth/verify-email', {
        email: email,
        code: codeToSubmit
      })

      setSuccess(true)

      // Stocker les tokens
      localStorage.setItem('access_token', response.data.access_token)
      localStorage.setItem('refresh_token', response.data.refresh_token)

      toast.success('Email vérifié avec succès !')

      // Rediriger vers le dashboard après 2 secondes
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Code invalide ou expiré'
      setError(message)
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (countdown > 0) return

    setIsResending(true)
    setError('')

    try {
      await api.post('/auth/resend-verification', { email })
      toast.success('Nouveau code envoyé !')
      setCountdown(60) // 60 secondes avant de pouvoir renvoyer
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Erreur lors de l\'envoi'
      setError(message)
    } finally {
      setIsResending(false)
    }
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Email manquant</h1>
          <p className="text-gray-600 mb-4">Aucun email à vérifier.</p>
          <Link href="/register" className="text-primary-600 hover:text-primary-700 font-semibold">
            Retour à l'inscription
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-6">
            <BookOpen className="h-10 w-10 text-primary-600" />
            <span className="text-3xl font-bold text-gray-900">{t('common.appName')}</span>
          </Link>

          {success ? (
            <>
              <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Email vérifié !</h1>
              <p className="text-gray-600">Redirection vers le dashboard...</p>
            </>
          ) : (
            <>
              <div className="bg-primary-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Mail className="h-12 w-12 text-primary-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Vérifiez votre email</h1>
              <p className="text-gray-600">
                Nous avons envoyé un code à 6 chiffres à
              </p>
              <p className="text-primary-600 font-semibold">{email}</p>
            </>
          )}
        </div>

        {!success && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Code inputs */}
            <div className="flex justify-center gap-3 mb-6">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  disabled={isLoading}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
                />
              ))}
            </div>

            {/* Submit button */}
            <button
              onClick={() => handleSubmit()}
              disabled={isLoading || code.join('').length !== 6}
              className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 transition font-semibold flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span>Vérification...</span>
              ) : (
                <>
                  <span>Vérifier</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>

            {/* Resend code */}
            <div className="mt-6 text-center">
              <p className="text-gray-600 text-sm mb-2">Vous n'avez pas reçu de code ?</p>
              <button
                onClick={handleResendCode}
                disabled={isResending || countdown > 0}
                className="text-primary-600 hover:text-primary-700 font-semibold inline-flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${isResending ? 'animate-spin' : ''}`} />
                <span>
                  {countdown > 0
                    ? `Renvoyer dans ${countdown}s`
                    : isResending
                      ? 'Envoi...'
                      : 'Renvoyer le code'
                  }
                </span>
              </button>
            </div>

            {/* Change email */}
            <div className="mt-4 text-center">
              <Link
                href="/register"
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Utiliser une autre adresse email
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
