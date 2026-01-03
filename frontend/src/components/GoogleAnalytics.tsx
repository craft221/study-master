'use client'

import Script from 'next/script'
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// Votre ID Google Analytics (format: G-XXXXXXXXXX)
// Configurez NEXT_PUBLIC_GA_ID dans votre fichier .env.local
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || ''

// Fonction pour envoyer des page views
export const pageview = (url: string) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
    })
  }
}

// Fonction pour envoyer des événements personnalisés
export const event = (action: string, category: string, label: string, value?: number) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    })
  }
}

// Événements prédéfinis pour Study Master
export const analyticsEvents = {
  // Authentification
  signUp: () => event('sign_up', 'engagement', 'user_registration'),
  login: () => event('login', 'engagement', 'user_login'),

  // Contenu
  createNote: () => event('create_note', 'content', 'note_created'),
  createFlashcard: () => event('create_flashcard', 'content', 'flashcard_created'),
  createQuiz: () => event('create_quiz', 'content', 'quiz_created'),

  // Apprentissage
  startStudySession: (duration: number) => event('start_study', 'learning', 'study_session', duration),
  completeQuiz: (score: number) => event('complete_quiz', 'learning', 'quiz_completed', score),
  reviewFlashcard: () => event('review_flashcard', 'learning', 'flashcard_reviewed'),

  // Gamification
  levelUp: (level: number) => event('level_up', 'gamification', 'new_level', level),
  earnAchievement: (name: string) => event('earn_achievement', 'gamification', name),

  // Premium
  viewPricing: () => event('view_pricing', 'monetization', 'pricing_page'),
  startCheckout: () => event('begin_checkout', 'monetization', 'checkout_started'),
  completePurchase: (value: number) => event('purchase', 'monetization', 'subscription', value),
}

export default function GoogleAnalytics() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Vérifier si le consentement a été donné
    const consent = localStorage.getItem('cookie_consent')
    if (consent !== 'accepted') return

    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')
    pageview(url)
  }, [pathname, searchParams])

  // Ne pas charger si pas d'ID configuré
  if (!GA_MEASUREMENT_ID) {
    return null
  }

  // Vérifier le consentement avant de charger les scripts
  const hasConsent = typeof window !== 'undefined' && localStorage.getItem('cookie_consent') === 'accepted'

  if (!hasConsent && typeof window !== 'undefined') {
    return null
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
              anonymize_ip: true,
              cookie_flags: 'SameSite=None;Secure'
            });
          `,
        }}
      />
    </>
  )
}
