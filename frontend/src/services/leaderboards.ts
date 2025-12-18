/**
 * Service Leaderboards - API Client pour les classements
 */

import api from '@/lib/api'

export type LeaderboardType = 'xp' | 'streak' | 'notes' | 'flashcards' | 'quizzes' | 'study_time'
export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all_time'

export interface LeaderboardEntry {
  rank: number
  user_id: number
  username: string
  avatar_url: string | null
  score: number
  level?: number
  streak?: number
  university: string | null
  promotion: string | null
}

export interface LeaderboardResponse {
  leaderboard_type: LeaderboardType
  period: LeaderboardPeriod
  entries: LeaderboardEntry[]
  total_participants: number
  user_rank: number | null
  user_score: number | null
}

// Types pour les Ligues
export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'master'

export interface LeaguePosition {
  user_id: number
  tier: LeagueTier
  tier_name: string
  tier_icon: string
  tier_color: string
  weekly_xp: number
  rank: number
  total_in_league: number
  is_promotion_zone: boolean
  is_demotion_zone: boolean
  promotion_threshold: number
  demotion_threshold: number | null
  next_tier: LeagueTier | null
  previous_tier: LeagueTier | null
  weeks_in_tier: number
  highest_tier: LeagueTier
}

export interface LeagueEntry {
  rank: number
  user_id: number
  username: string
  avatar_url: string | null
  weekly_xp: number
  level: number
  current_streak: number
  is_promotion_zone: boolean
  is_demotion_zone: boolean
}

export interface LeagueInfo {
  tier: LeagueTier
  name: string
  icon: string
  color: string
  min_xp: number
  promotion_slots: number
  demotion_slots: number
}

export const leaderboardsService = {
  /**
   * Récupérer le classement général
   */
  getGeneral: async (params?: {
    leaderboard_type?: LeaderboardType
    period?: LeaderboardPeriod
    limit?: number
  }): Promise<LeaderboardResponse> => {
    const response = await api.get('/leaderboards/', { params })
    return response.data
  },

  /**
   * Récupérer le classement de l'université de l'utilisateur
   */
  getUniversity: async (params?: {
    leaderboard_type?: LeaderboardType
    period?: LeaderboardPeriod
    limit?: number
  }): Promise<LeaderboardResponse> => {
    const response = await api.get('/leaderboards/university', { params })
    return response.data
  },

  /**
   * Récupérer le classement de la promotion de l'utilisateur
   */
  getPromotion: async (params?: {
    leaderboard_type?: LeaderboardType
    period?: LeaderboardPeriod
    limit?: number
  }): Promise<LeaderboardResponse> => {
    const response = await api.get('/leaderboards/promotion', { params })
    return response.data
  },

  // =========================================================================
  // LEAGUES - Système de Ligues
  // =========================================================================

  /**
   * Récupérer la position de l'utilisateur dans sa ligue
   */
  getMyLeaguePosition: async (): Promise<LeaguePosition> => {
    const response = await api.get('/leaderboards/leagues/my-position')
    return response.data
  },

  /**
   * Récupérer le classement d'une ligue spécifique
   */
  getLeagueLeaderboard: async (tier: LeagueTier, limit: number = 50): Promise<{
    tier: LeagueTier
    tier_info: LeagueInfo
    entries: LeagueEntry[]
    total_participants: number
  }> => {
    const response = await api.get(`/leaderboards/leagues/${tier}`, { params: { limit } })
    // Backend returns array directly, wrap it in expected format
    const entries = Array.isArray(response.data) ? response.data : []
    return {
      tier,
      tier_info: { tier, name: tier, icon: '', color: '', min_xp: 0, promotion_slots: 0, demotion_slots: 0 },
      entries,
      total_participants: entries.length
    }
  },

  /**
   * Récupérer les informations de toutes les ligues
   */
  getAllLeagues: async (): Promise<LeagueInfo[]> => {
    const response = await api.get('/leaderboards/leagues')
    return response.data
  }
}

export default leaderboardsService
