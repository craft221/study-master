'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, Mail, Lock, User, ArrowRight, AlertCircle } from 'lucide-react'
import UniversitySelect from '@/components/ui/UniversitySelect'
import { majors, searchMajors, type Major } from '@/data/majors'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useTranslation } from '@/contexts/LanguageContext'

const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  username: z.string().min(3, 'Minimum 3 caractères').max(50),
  full_name: z.string().min(2, 'Minimum 2 caractères'),
  password: z.string().min(8, 'Minimum 8 caractères'),
  password_confirm: z.string(),
  university: z.string().optional(),
  major: z.string().optional(),
}).refine((data) => data.password === data.password_confirm, {
  message: "Les mots de passe ne correspondent pas",
  path: ["password_confirm"],
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [university, setUniversity] = useState('')
  const [major, setMajor] = useState('')
  const [majorQuery, setMajorQuery] = useState('')
  const [majorSuggestions, setMajorSuggestions] = useState<Major[]>([])
  const [showMajorDropdown, setShowMajorDropdown] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true)
    setError('')

    try {
      const { password_confirm, ...rest } = data
      const registerData = {
        ...rest,
        university: university || undefined,
        major: major || undefined,
      }

      const response = await api.post('/auth/register', registerData)

      // Si vérification email requise, rediriger vers la page de vérification
      if (response.data.requires_verification) {
        toast.success(response.data.message || t('auth.verificationSent'))
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`)
        return
      }

      // Si pas de vérification requise (ne devrait pas arriver normalement)
      if (response.data.access_token) {
        localStorage.setItem('access_token', response.data.access_token)
        localStorage.setItem('refresh_token', response.data.refresh_token)
        toast.success(t('auth.registerSuccess'))
        router.push('/dashboard')
      }
    } catch (err: any) {
      const message = err.response?.data?.detail || t('errors.generic')
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-6">
            <BookOpen className="h-10 w-10 text-primary-600" />
            <span className="text-3xl font-bold text-gray-900">{t('common.appName')}</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.register')}</h1>
          <p className="text-gray-600">{t('dashboard.welcome')}</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auth.email')} *
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

              {/* Username */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auth.username')} *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    {...register('username')}
                    type="text"
                    id="username"
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="johndoe"
                  />
                </div>
                {errors.username && (
                  <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
                )}
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.fullName')} *
              </label>
              <input
                {...register('full_name')}
                type="text"
                id="full_name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="John Doe"
              />
              {errors.full_name && (
                <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auth.password')} *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    {...register('password')}
                    type="password"
                    id="password"
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="password_confirm" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auth.confirmPassword')} *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    {...register('password_confirm')}
                    type="password"
                    id="password_confirm"
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
                {errors.password_confirm && (
                  <p className="mt-1 text-sm text-red-600">{errors.password_confirm.message}</p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* University */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('profile.university')}
                </label>
                <UniversitySelect
                  value={university}
                  onChange={setUniversity}
                />
              </div>

              {/* Major */}
              <div className="relative">
                <label htmlFor="major" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('profile.major')}
                </label>
                <input
                  type="text"
                  id="major"
                  value={majorQuery}
                  onChange={(e) => {
                    const query = e.target.value
                    setMajorQuery(query)
                    if (query.length >= 2) {
                      setMajorSuggestions(searchMajors(query))
                      setShowMajorDropdown(true)
                    } else {
                      setMajorSuggestions([])
                      setShowMajorDropdown(false)
                    }
                  }}
                  onFocus={() => majorQuery.length >= 2 && setShowMajorDropdown(true)}
                  onBlur={() => setTimeout(() => setShowMajorDropdown(false), 200)}
                  placeholder="Ex: Informatique, Médecine..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {showMajorDropdown && majorSuggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                    {majorSuggestions.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setMajor(m.name)
                          setMajorQuery(m.name)
                          setShowMajorDropdown(false)
                        }}
                        className="flex w-full items-center px-4 py-2 text-left text-sm hover:bg-gray-100"
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                  <span>{t('auth.register')}</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">{t('common.or')}</span>
            </div>
          </div>

          {/* Login Link */}
          <p className="text-center text-gray-600">
            {t('auth.hasAccount')}{' '}
            <Link href="/login" className="text-primary-600 hover:text-primary-700 font-semibold">
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
