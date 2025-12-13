/**
 * Service Mascot - API Client pour Spark la mascotte
 */

import api from '@/lib/api'

// Types d'événements pour les messages de Spark
export type MascotEvent =
  | 'welcome'
  | 'login'
  | 'quiz_start'
  | 'quiz_success'
  | 'quiz_fail'
  | 'streak_reminder'
  | 'streak_milestone'
  | 'level_up'
  | 'achievement'
  | 'study_start'
  | 'study_complete'
  | 'flashcard_review'
  | 'note_created'
  | 'duel_challenge'
  | 'duel_win'
  | 'duel_lose'
  | 'idle'
  | 'encouragement'

export interface MascotState {
  name: string
  level: number
  level_name: string
  unlocked_accessories: string[]
  current_accessory: string | null
  total_accessories: number
  user_xp: number
  user_streak: number
}

export interface MascotAccessory {
  id: string
  name: string
  description: string
  emoji: string
  requirement: string
  is_unlocked: boolean
}

export interface MascotAccessoriesResponse {
  accessories: MascotAccessory[]
  unlocked_count: number
  total_count: number
  newly_unlocked: string[]
}

export interface MascotMessage {
  message: string
  mood: string
  animation: string
  suggestions?: string[]
}

export interface MascotAskResponse {
  answer: string
  mood: string
  animation: string
  suggestions: string[]
  from_cache: boolean
}

export const mascotService = {
  /**
   * Récupérer l'état de la mascotte
   */
  getState: async (): Promise<MascotState> => {
    const response = await api.get('/mascot/state')
    return response.data
  },

  /**
   * Obtenir un message de Spark selon l'événement
   */
  getMessage: async (
    event: MascotEvent,
    context?: Record<string, any>,
    useAi: boolean = false
  ): Promise<MascotMessage> => {
    const response = await api.post('/mascot/message', {
      event,
      context: context || {},
      use_ai: useAi
    })
    return response.data
  },

  /**
   * Récupérer tous les accessoires (débloqués et verrouillés)
   */
  getAccessories: async (): Promise<MascotAccessoriesResponse> => {
    const response = await api.get('/mascot/accessories')
    return response.data
  },

  /**
   * Mettre à jour la mascotte (nom, accessoire)
   */
  update: async (data: {
    name?: string
    current_accessory?: string
  }): Promise<{ success: boolean; name: string; current_accessory: string | null }> => {
    const response = await api.patch('/mascot/update', data)
    return response.data
  },

  /**
   * Obtenir un indice pédagogique
   */
  getHint: async (topic: string, difficulty: string = 'medium'): Promise<{
    hint: string
    mood: string
    animation: string
  }> => {
    const response = await api.post('/mascot/hint', { topic, difficulty })
    return response.data
  },

  /**
   * Enregistrer une interaction avec Spark (clic)
   */
  recordInteraction: async (): Promise<{
    message: string
    mood: string
    animation: string
  }> => {
    const response = await api.post('/mascot/interaction')
    return response.data
  },

  /**
   * Vérifier les nouveaux accessoires débloqués
   */
  checkNewUnlocks: async (): Promise<{
    has_new_unlocks: boolean
    newly_unlocked: string[]
    accessories_names: string[]
    message: string
    mood: string
    animation: string
  }> => {
    const response = await api.get('/mascot/check-new-unlocks')
    return response.data
  },

  /**
   * Poser une question à Spark (avec IA)
   */
  ask: async (question: string, context?: Record<string, any>): Promise<MascotAskResponse> => {
    const response = await api.post('/mascot/ask', {
      question,
      context: context || {}
    })
    return response.data
  }
}

export default mascotService
