import api from '@/lib/api'

export interface Duel {
  id: number
  challenger_id: number
  opponent_id: number
  quiz_id: number | null
  subject_id: number | null
  xp_stake: number
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'declined' | 'cancelled'
  winner_id: number | null
  challenger_score: number | null
  opponent_score: number | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export const duelsService = {
  // Create new duel
  create: async (data: {
    opponent_id: number
    quiz_id?: number
    subject_id?: number
    xp_stake: number
  }): Promise<Duel> => {
    const response = await api.post('/duels/', data)
    return response.data
  },

  // Get all duels
  getAll: async (status?: string): Promise<Duel[]> => {
    const response = await api.get('/duels/', {
      params: { status },
    })
    return response.data.duels || response.data
  },

  // Get pending duels
  getPending: async (): Promise<Duel[]> => {
    const response = await api.get('/duels/pending')
    return response.data.duels || response.data
  },

  // Get duel by ID
  getById: async (id: number): Promise<Duel> => {
    const response = await api.get(`/duels/${id}`)
    return response.data
  },

  // Accept duel
  accept: async (id: number): Promise<Duel> => {
    const response = await api.post(`/duels/${id}/accept`)
    return response.data
  },

  // Decline duel
  decline: async (id: number): Promise<Duel> => {
    const response = await api.post(`/duels/${id}/decline`)
    return response.data
  },

  // Complete duel (determine winner)
  complete: async (
    id: number,
    challengerScore: number,
    opponentScore: number
  ): Promise<Duel> => {
    const response = await api.post(`/duels/${id}/complete`, {
      challenger_score: challengerScore,
      opponent_score: opponentScore,
    })
    return response.data
  },

  // Cancel duel
  cancel: async (id: number): Promise<void> => {
    await api.delete(`/duels/${id}`)
  },
}
