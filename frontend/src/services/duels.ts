/**
 * Service Duels - API Client
 * Synchronisé avec le backend corrigé
 */

import api from '@/lib/api'

// Types alignés avec le backend
export type DuelStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'declined' | 'cancelled'

export interface UserBrief {
  id: number
  username: string
  avatar_url: string | null
  level: number
}

export interface QuizBrief {
  id: number
  title: string
}

export interface Duel {
  id: number
  challenger_id: number
  opponent_id: number
  subject_id: number | null
  quiz_id: number | null
  status: DuelStatus
  challenger_score: number | null
  opponent_score: number | null
  winner_id: number | null
  stakes_xp: number
  duration_minutes: number
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string | null
  // Relations
  challenger?: UserBrief
  opponent?: UserBrief
  quiz?: QuizBrief
}

export interface DuelCreate {
  opponent_id: number
  subject_id?: number
  quiz_id?: number
  stakes_xp?: number
  duration_minutes?: number
}

export interface DuelComplete {
  challenger_score: number
  opponent_score: number
}

export interface DuelListResponse {
  duels: Duel[]
  total: number
  page: number
  page_size: number
}

export interface DuelStats {
  total_duels: number
  wins: number
  losses: number
  win_rate: number
  xp_won: number
  xp_lost: number
  net_xp: number
}

export interface RecommendedOpponent {
  id: number
  username: string
  avatar_url: string | null
  level: number
  total_xp: number
  xp_difference: number
  match_quality: 'excellent' | 'good' | 'fair'
  university: string | null
  has_pending_duel: boolean
}

export interface RecommendedOpponentsResponse {
  recommendations: RecommendedOpponent[]
  user_xp: number
  xp_range: { min: number; max: number }
  total: number
}

export interface DuelInviteLink {
  invite_code: string
  invite_url: string
  expires_in_hours: number
  challenger: string
  stakes_xp: number
  quiz_title: string | null
}

export interface DuelInviteDetails {
  invite_code: string
  challenger_id: number
  challenger_username: string
  quiz_id: number | null
  quiz_title: string | null
  stakes_xp: number
  duration_minutes: number
  can_accept: boolean
}

export const duelsService = {
  /**
   * Créer un nouveau duel
   */
  create: async (data: DuelCreate): Promise<Duel> => {
    const response = await api.post('/duels/', {
      opponent_id: data.opponent_id,
      subject_id: data.subject_id,
      quiz_id: data.quiz_id,
      stakes_xp: data.stakes_xp || 50,
      duration_minutes: data.duration_minutes || 30
    })
    return response.data
  },

  /**
   * Récupérer tous les duels de l'utilisateur
   */
  getAll: async (page = 1, pageSize = 20, status?: DuelStatus): Promise<DuelListResponse> => {
    const params: Record<string, any> = { page, page_size: pageSize }
    if (status) params.status_filter = status

    const response = await api.get('/duels/', { params })
    return response.data
  },

  /**
   * Récupérer les duels en attente (invitations reçues)
   */
  getPending: async (): Promise<Duel[]> => {
    const response = await api.get('/duels/pending')
    return response.data
  },

  /**
   * Récupérer un duel par ID
   */
  getById: async (id: number): Promise<Duel> => {
    const response = await api.get(`/duels/${id}`)
    return response.data
  },

  /**
   * Accepter un duel
   * Status passe de PENDING à ACCEPTED
   */
  accept: async (id: number): Promise<Duel> => {
    const response = await api.post(`/duels/${id}/accept`)
    return response.data
  },

  /**
   * Refuser un duel
   * Status passe à DECLINED
   */
  decline: async (id: number): Promise<Duel> => {
    const response = await api.post(`/duels/${id}/decline`)
    return response.data
  },

  /**
   * Démarrer un duel accepté
   * Status passe de ACCEPTED à IN_PROGRESS
   */
  start: async (id: number): Promise<Duel> => {
    const response = await api.post(`/duels/${id}/start`)
    return response.data
  },

  /**
   * Compléter un duel (déterminer le gagnant)
   * Peut fournir les scores manuellement ou les récupérer depuis QuizAttempt
   */
  complete: async (id: number, scores?: DuelComplete): Promise<Duel> => {
    const response = await api.post(`/duels/${id}/complete`, scores || {})
    return response.data
  },

  /**
   * Annuler un duel (seulement si PENDING et par le challenger)
   */
  cancel: async (id: number): Promise<void> => {
    await api.delete(`/duels/${id}`)
  },

  /**
   * Récupérer les statistiques de duel de l'utilisateur
   */
  getMyStats: async (): Promise<DuelStats> => {
    const response = await api.get('/duels/stats/me')
    return response.data
  },

  /**
   * Récupérer des adversaires recommandés (XP similaire)
   */
  getRecommendedOpponents: async (limit = 5): Promise<RecommendedOpponentsResponse> => {
    const response = await api.get('/duels/recommended-opponents', { params: { limit } })
    return response.data
  },

  /**
   * Créer un lien d'invitation pour un duel
   */
  createInviteLink: async (params: {
    quiz_id?: number
    subject_id?: number
    stakes_xp?: number
    duration_minutes?: number
  }): Promise<DuelInviteLink> => {
    const response = await api.post('/duels/invite-link', null, { params })
    return response.data
  },

  /**
   * Récupérer les détails d'une invitation
   */
  getInviteDetails: async (inviteCode: string): Promise<DuelInviteDetails> => {
    const response = await api.get(`/duels/invite/${inviteCode}`)
    return response.data
  },

  /**
   * Accepter une invitation de duel via un lien
   */
  acceptInvite: async (inviteCode: string): Promise<Duel> => {
    const response = await api.post(`/duels/invite/${inviteCode}/accept`)
    return response.data
  }
}

export default duelsService
