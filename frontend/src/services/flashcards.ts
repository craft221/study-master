import api from '@/lib/api'

export interface Flashcard {
  id: number
  front_content: string
  back_content: string
  deck_name: string | null
  subject_id: number | null
  tags: string[]
  difficulty: number
  last_review_date: string | null
  next_review_date: string | null
  interval_days: number
  easiness_factor: number
  review_count: number
  success_count: number
  is_favorite: boolean
  is_suspended: boolean
  user_id: number
  created_at: string
  updated_at: string
}

export interface FlashcardStats {
  flashcard_id: number
  total_reviews: number
  success_rate: number
  average_response_time: number
  mastery_level: string
  current_interval: number
  next_review: string | null
  total_time_spent: number
  streak: number
}

export const flashcardsService = {
  // Get all flashcards
  getAll: async (params?: {
    subject_id?: number
    status?: string
    deck_name?: string
    is_favorite?: boolean
    is_suspended?: boolean
  }): Promise<Flashcard[]> => {
    const response = await api.get('/flashcards/', { params })
    return response.data.flashcards || response.data
  },

  // Get due flashcards
  getDue: async (): Promise<Flashcard[]> => {
    const response = await api.get('/flashcards/due')
    return response.data
  },

  // Get flashcard stats
  getStats: async (id: number): Promise<FlashcardStats> => {
    const response = await api.get(`/flashcards/${id}/stats`)
    return response.data
  },

  // Review flashcard (FSRS algorithm - Free Spaced Repetition Scheduler)
  review: async (
    id: number,
    quality: number,
    responseTime?: number
  ): Promise<Flashcard> => {
    const response = await api.post(`/flashcards/${id}/review`, {
      quality,
      response_time_seconds: responseTime,
    })
    return response.data
  },

  // Get scheduling preview (shows what will happen for each rating option)
  getSchedulingPreview: async (id: number): Promise<{
    flashcard_id: number
    algorithm: string
    current_state: string
    current_stability: number
    current_difficulty: number
    current_retrievability: number
    scheduling_options: {
      again: { interval_days: number; display: string; description: string }
      hard: { interval_days: number; display: string; description: string }
      good: { interval_days: number; display: string; description: string }
      easy: { interval_days: number; display: string; description: string }
    }
  }> => {
    const response = await api.get(`/flashcards/${id}/preview`)
    return response.data
  },

  // Toggle favorite
  toggleFavorite: async (id: number): Promise<Flashcard> => {
    const response = await api.post(`/flashcards/${id}/favorite`)
    return response.data
  },

  // Toggle suspend
  toggleSuspend: async (id: number): Promise<Flashcard> => {
    const response = await api.post(`/flashcards/${id}/suspend`)
    return response.data
  },

  // Create flashcard
  create: async (data: Partial<Flashcard>): Promise<Flashcard> => {
    const response = await api.post('/flashcards/', data)
    return response.data
  },

  // Update flashcard
  update: async (
    id: number,
    data: Partial<Flashcard>
  ): Promise<Flashcard> => {
    const response = await api.put(`/flashcards/${id}`, data)
    return response.data
  },

  // Delete flashcard
  delete: async (id: number): Promise<void> => {
    await api.delete(`/flashcards/${id}`)
  },
}
