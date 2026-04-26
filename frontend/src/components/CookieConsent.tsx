'use client'

import { useState, useEffect } from 'react'
import { X, Cookie, Shield, BarChart3, Settings } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from '@/contexts/LanguageContext'

export default function CookieConsent() {
  const { t } = useTranslation()
  const [showBanner, setShowBanner] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent')
    if (!consent) {
      const timer = setTimeout(() => setShowBanner(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'accepted')
    localStorage.setItem('cookie_consent_date', new Date().toISOString())
    setShowBanner(false)
    window.location.reload()
  }

  const handleReject = () => {
    localStorage.setItem('cookie_consent', 'rejected')
    localStorage.setItem('cookie_consent_date', new Date().toISOString())
    setShowBanner(false)
  }

  const handleAcceptEssential = () => {
    localStorage.setItem('cookie_consent', 'essential_only')
    localStorage.setItem('cookie_consent_date', new Date().toISOString())
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 z-[9998]" onClick={() => {}} />

      {/* Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 md:p-6">
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Cookie className="h-6 w-6" />
                <h2 className="text-lg font-bold">{t('cookies.manageTitle')}</h2>
              </div>
              <button
                onClick={handleReject}
                className="p-1 hover:bg-white/20 rounded-lg transition"
                aria-label={t('cookies.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {t('cookies.managePreamble')}
            </p>

            {/* Cookie Types */}
            {showDetails && (
              <div className="space-y-3 mb-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                {/* Essential */}
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <Shield className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{t('cookies.essential')}</h3>
                      <span className="text-xs bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                        {t('cookies.essentialActive')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {t('cookies.essentialFull')}
                    </p>
                  </div>
                </div>

                {/* Analytics */}
                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{t('cookies.analytics')}</h3>
                      <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                        {t('cookies.analyticsOptional')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {t('cookies.analyticsFull')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleAccept}
                className="flex-1 bg-gradient-to-r from-primary-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition"
              >
                {t('cookies.accept')}
              </button>
              <button
                onClick={handleAcceptEssential}
                className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                {t('cookies.essentialOnly')}
              </button>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center justify-center gap-2 px-4 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
              >
                <Settings className="h-4 w-4" />
                <span className="text-sm">{showDetails ? t('cookies.hide') : t('cookies.details')}</span>
              </button>
            </div>

            {/* Privacy Link */}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
              {t('cookies.privacyLinkPrefix')}{' '}
              <Link href="/privacy" className="text-primary-600 hover:underline">
                {t('cookies.privacyLinkLabel')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
