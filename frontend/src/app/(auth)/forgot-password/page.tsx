'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpen, Mail, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { authService } from '@/services/auth'
import { useTranslation } from '@/contexts/LanguageContext'

const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
})

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true)

    try {
      await authService.forgotPassword(data.email)
      setIsSubmitted(true)
      toast.success(t('auth.checkEmail'))
    } catch (err: any) {
      console.error('Forgot password error:', err)
      const message = err.response?.data?.detail || t('errors.generic')
      toast.error(typeof message === 'string' ? message : JSON.stringify(message))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-6">
            <BookOpen className="h-10 w-10 text-primary-600" />
            <span className="text-3xl font-bold text-gray-900">{t('common.appName')}</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.forgotPasswordTitle')}</h1>
          <p className="text-gray-600">{t('auth.forgotPasswordSubtitle')}</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {isSubmitted ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{t('auth.checkEmail')}</h2>
              <p className="text-gray-600">{t('auth.resetLinkSent')}</p>
              <Link
                href="/login"
                className="inline-flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-semibold mt-4"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{t('auth.backToLogin')}</span>
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('auth.email')}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      {...register('email')}
                      type="email"
                      id="email"
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="email@example.com"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 transition font-semibold flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span>{t('common.loading')}</span>
                  ) : (
                    <>
                      <span>{t('auth.sendResetLink')}</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </form>

              {/* Back to login */}
              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-semibold"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>{t('auth.backToLogin')}</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
