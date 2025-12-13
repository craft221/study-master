/**
 * Service Social Share - API Client pour le partage social
 */

import api from '@/lib/api'

// Types de partage
export type ShareType =
  | 'streak'
  | 'quiz_score'
  | 'level_up'
  | 'achievement'
  | 'league_promotion'
  | 'weekly_stats'
  | 'study_time'
  | 'duel_victory'

// Plateformes de partage
export type SharePlatform =
  | 'whatsapp'
  | 'twitter'
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'telegram'
  | 'copy'
  | 'other'

// Interface pour une demande de partage
export interface ShareRequest {
  share_type: ShareType
  platform: SharePlatform
  content_data?: Record<string, any>
}

// Interface pour une réponse de partage
export interface ShareResponse {
  success: boolean
  share_code: string
  share_url: string
  message: string
  platform: SharePlatform
  share_type: ShareType
  xp_earned: number
}

// Interface pour les statistiques de partage
export interface ShareStatsResponse {
  user_id: number
  total_shares: number
  total_clicks: number
  total_conversions: number
  shares_by_platform: {
    whatsapp: number
    twitter: number
    facebook: number
    instagram: number
    linkedin: number
    telegram: number
    other: number
  }
  share_badges: ShareBadge[]
  first_share_at: string | null
  last_share_at: string | null
  conversion_rate: number
}

// Interface pour les badges de partage
export interface ShareBadge {
  id: string
  name: string
  description: string
  icon: string
  requirement: number
  unlocked: boolean
  unlocked_at?: string
}

// Configuration des plateformes de partage
export const SHARE_PLATFORMS: Record<SharePlatform, {
  name: string
  icon: string
  color: string
  bgColor: string
}> = {
  whatsapp: {
    name: 'WhatsApp',
    icon: '📱',
    color: '#25D366',
    bgColor: 'bg-green-500'
  },
  twitter: {
    name: 'Twitter/X',
    icon: '🐦',
    color: '#1DA1F2',
    bgColor: 'bg-blue-400'
  },
  facebook: {
    name: 'Facebook',
    icon: '📘',
    color: '#1877F2',
    bgColor: 'bg-blue-600'
  },
  instagram: {
    name: 'Instagram',
    icon: '📸',
    color: '#E4405F',
    bgColor: 'bg-pink-500'
  },
  linkedin: {
    name: 'LinkedIn',
    icon: '💼',
    color: '#0A66C2',
    bgColor: 'bg-blue-700'
  },
  telegram: {
    name: 'Telegram',
    icon: '✈️',
    color: '#0088cc',
    bgColor: 'bg-sky-500'
  },
  copy: {
    name: 'Copier le lien',
    icon: '📋',
    color: '#6B7280',
    bgColor: 'bg-gray-500'
  },
  other: {
    name: 'Autre',
    icon: '🔗',
    color: '#6B7280',
    bgColor: 'bg-gray-500'
  }
}

// Types de contenu partageable
export const SHARE_TYPES: Record<ShareType, {
  name: string
  icon: string
  description: string
}> = {
  streak: {
    name: 'Série',
    icon: '🔥',
    description: 'Partagez votre série de jours consécutifs'
  },
  quiz_score: {
    name: 'Score Quiz',
    icon: '🎯',
    description: 'Partagez votre score de quiz'
  },
  level_up: {
    name: 'Niveau',
    icon: '⬆️',
    description: 'Partagez votre nouveau niveau'
  },
  achievement: {
    name: 'Succès',
    icon: '🏆',
    description: 'Partagez vos succès débloqués'
  },
  league_promotion: {
    name: 'Ligue',
    icon: '🏅',
    description: 'Partagez votre promotion de ligue'
  },
  weekly_stats: {
    name: 'Stats Semaine',
    icon: '📊',
    description: 'Partagez vos statistiques hebdomadaires'
  },
  study_time: {
    name: 'Temps d\'étude',
    icon: '⏱️',
    description: 'Partagez votre temps d\'étude'
  },
  duel_victory: {
    name: 'Victoire Duel',
    icon: '⚔️',
    description: 'Partagez votre victoire en duel'
  }
}

export const socialShareService = {
  // =========================================================================
  // Création de partages
  // =========================================================================

  /**
   * Créer un partage générique
   */
  createShare: async (data: ShareRequest): Promise<ShareResponse> => {
    const response = await api.post('/share/create', data)
    return response.data
  },

  /**
   * Partager une série (streak)
   */
  shareStreak: async (platform: SharePlatform, streakDays: number): Promise<ShareResponse> => {
    const response = await api.post('/share/streak', { platform, streak_days: streakDays })
    return response.data
  },

  /**
   * Partager un score de quiz
   */
  shareQuizScore: async (
    platform: SharePlatform,
    score: number,
    totalQuestions: number,
    quizTitle?: string
  ): Promise<ShareResponse> => {
    const response = await api.post('/share/quiz', {
      platform,
      score,
      total_questions: totalQuestions,
      quiz_title: quizTitle
    })
    return response.data
  },

  /**
   * Partager un niveau atteint
   */
  shareLevel: async (platform: SharePlatform, level: number): Promise<ShareResponse> => {
    const response = await api.post('/share/level', { platform, level })
    return response.data
  },

  /**
   * Partager une promotion de ligue
   */
  shareLeaguePromotion: async (
    platform: SharePlatform,
    newTier: string,
    previousTier: string
  ): Promise<ShareResponse> => {
    const response = await api.post('/share/league', {
      platform,
      new_tier: newTier,
      previous_tier: previousTier
    })
    return response.data
  },

  /**
   * Partager les statistiques hebdomadaires
   */
  shareWeeklyStats: async (
    platform: SharePlatform,
    stats: {
      xp_earned: number
      study_time_minutes: number
      quizzes_completed: number
      notes_created: number
    }
  ): Promise<ShareResponse> => {
    const response = await api.post('/share/weekly-stats', { platform, ...stats })
    return response.data
  },

  // =========================================================================
  // Tracking
  // =========================================================================

  /**
   * Tracker un clic sur un lien partagé
   */
  trackClick: async (shareCode: string): Promise<{ success: boolean; clicks: number }> => {
    const response = await api.post(`/share/track/click/${shareCode}`)
    return response.data
  },

  /**
   * Tracker une conversion (inscription via partage)
   */
  trackConversion: async (shareCode: string): Promise<{ success: boolean; conversions: number }> => {
    const response = await api.post(`/share/track/conversion/${shareCode}`)
    return response.data
  },

  // =========================================================================
  // Statistiques et badges
  // =========================================================================

  /**
   * Récupérer les statistiques de partage de l'utilisateur
   */
  getMyStats: async (): Promise<ShareStatsResponse> => {
    const response = await api.get('/share/my-stats')
    return response.data
  },

  /**
   * Récupérer les badges de partage disponibles et débloqués
   */
  getBadges: async (): Promise<ShareBadge[]> => {
    const response = await api.get('/share/badges')
    return response.data
  },

  /**
   * Récupérer les plateformes disponibles
   */
  getPlatforms: async (): Promise<Array<{
    id: SharePlatform
    name: string
    icon: string
    color: string
  }>> => {
    const response = await api.get('/share/platforms')
    return response.data
  },

  // =========================================================================
  // Utilitaires côté client
  // =========================================================================

  /**
   * Ouvrir le lien de partage dans une nouvelle fenêtre
   */
  openShareWindow: (url: string, platform: SharePlatform): void => {
    const width = 600
    const height = 400
    const left = (window.innerWidth - width) / 2
    const top = (window.innerHeight - height) / 2

    // WhatsApp et Telegram s'ouvrent mieux en popup
    if (platform === 'whatsapp' || platform === 'telegram') {
      window.open(url, '_blank')
    } else if (platform === 'copy') {
      // Ne pas ouvrir de fenêtre pour la copie
      return
    } else {
      window.open(
        url,
        'share',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      )
    }
  },

  /**
   * Copier le lien dans le presse-papier
   */
  copyToClipboard: async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      // Fallback pour les navigateurs plus anciens
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      return success
    }
  },

  /**
   * Partager via l'API native du navigateur (si disponible)
   */
  nativeShare: async (data: {
    title: string
    text: string
    url: string
  }): Promise<boolean> => {
    if (navigator.share) {
      try {
        await navigator.share(data)
        return true
      } catch (error) {
        // L'utilisateur a annulé ou erreur
        return false
      }
    }
    return false
  },

  /**
   * Vérifier si le partage natif est disponible
   */
  isNativeShareAvailable: (): boolean => {
    return typeof navigator !== 'undefined' && !!navigator.share
  }
}

export default socialShareService
