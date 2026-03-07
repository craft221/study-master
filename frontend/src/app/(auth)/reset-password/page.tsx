'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Lock, ArrowRight, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { authService } from '@/services/auth'
import { useTranslation } from '@/contexts/LanguageContext'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  const resetPasswordSchema = z.object({
    new_password: z.string().min(8, t('auth.passwordMinLength')),
    confirm_password: z.string(),
  }).refine((data) => data.new_password === data.confirm_password, {
    message: t('auth.passwordsDoNotMatch'),
    path: ['confirm_password'],
  })

  type ResetPasswordForm = z.infer<typeof resetPasswordSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) return

    setIsLoading(true)
    setError('')

    try {
      await authService.resetPassword(token, data.new_password, data.confirm_password)
      setIsSuccess(true)
      toast.success(t('auth.passwordResetSuccess'))

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (err: any) {
      console.error('Reset password error:', err)
      const message = err.response?.data?.detail || t('auth.invalidResetToken')
      setError(typeof message === 'string' ? message : JSON.stringify(message))
      toast.error(typeof message === 'string' ? message : JSON.stringify(message))
    } finally {
      setIsLoading(false)
    }
  }

  // No token provided
  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center space-x-2 mb-6">
              <BookOpen className="h-10 w-10 text-primary-600" />
              <span className="text-3xl font-bold text-gray-900">{t('common.appName')}</span>
            </Link>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center space-y-4">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
            <h2 className="text-xl font-semibold text-gray-900">{t('auth.noResetToken')}</h2>
            <Link
              href="/forgot-password"
              className="inline-flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-semibold"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t('auth.forgotPasswordTitle')}</span>
            </Link>
          </div>
        </div>
      </div>
    )
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.resetPasswordTitle')}</h1>
          <p className="text-gray-600">{t('auth.resetPasswordSubtitle')}</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {isSuccess ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{t('auth.passwordResetSuccess')}</h2>
              <p className="text-gray-600">{t('auth.backToLogin')}...</p>
              <Link
                href="/login"
                className="inline-flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-semibold"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{t('auth.backToLogin')}</span>
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* New Password */}
                <div>
                  <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('auth.newPassword')}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      {...register('new_password')}
                      type="password"
                      id="new_password"
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="••••••••"
                    />
                  </div>
                  {errors.new_password && (
                    <p className="mt-1 text-sm text-red-600">{errors.new_password.message}</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('auth.confirmNewPassword')}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      {...register('confirm_password')}
                      type="password"
                      id="confirm_password"
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="••••••••"
                    />
                  </div>
                  {errors.confirm_password && (
                    <p className="mt-1 text-sm text-red-600">{errors.confirm_password.message}</p>
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
                      <span>{t('auth.resetPasswordButton')}</span>
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
