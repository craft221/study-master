'use client'

import { useState, useEffect } from 'react'
import { WifiOff, RefreshCw, BookOpen, Brain, Calendar, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { useTranslation } from '@/contexts/LanguageContext'

export default function OfflinePage() {
  const { t } = useTranslation()
  const [, setIsOnline] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      window.location.href = '/'
    }

    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const checkConnection = async () => {
    setIsChecking(true)
    try {
      const response = await fetch('/api/health', { method: 'HEAD' })
      if (response.ok) {
        window.location.href = '/'
      }
    } catch {
      // Still offline
    }
    setIsChecking(false)
  }

  const offlineFeatures = [
    {
      icon: FileText,
      title: t('offline.page.featureNotesTitle'),
      description: t('offline.page.featureNotesDesc'),
      href: '/notes',
      available: true,
    },
    {
      icon: Brain,
      title: t('offline.page.featureFlashcardsTitle'),
      description: t('offline.page.featureFlashcardsDesc'),
      href: '/flashcards',
      available: true,
    },
    {
      icon: Calendar,
      title: t('offline.page.featureCalendarTitle'),
      description: t('offline.page.featureCalendarDesc'),
      href: '/schedule',
      available: true,
    },
    {
      icon: BookOpen,
      title: t('offline.page.featureStudyTitle'),
      description: t('offline.page.featureStudyDesc'),
      href: '/study',
      available: true,
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <WifiOff className="w-10 h-10 text-orange-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('offline.page.title')}
          </h1>
          <p className="text-gray-600 max-w-md mx-auto">
            {t('offline.page.heroDescription')}
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <Button
            onClick={checkConnection}
            disabled={isChecking}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? t('offline.page.checking') : t('offline.page.checkConnection')}
          </Button>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 text-center">
            {t('offline.page.featuresTitle')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {offlineFeatures.map((feature) => (
              <Link key={feature.href} href={feature.href}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <feature.icon className="w-5 h-5 text-primary" />
                      </div>
                      <CardTitle className="text-base">{feature.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">
            {t('offline.page.modeTitle')}
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• {t('offline.page.tip1')}</li>
            <li>• {t('offline.page.tip2')}</li>
            <li>• {t('offline.page.tip3')}</li>
          </ul>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>{t('offline.page.pwaNote')}</p>
        </div>
      </div>
    </div>
  )
}
