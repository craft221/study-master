import api from '@/lib/api'

export interface Quiz {
  id: number
  title: string
  description: string | null
  quiz_type: 'practice' | 'test' | 'exam'
  difficulty: 'easy' | 'medium' | 'hard'
  time_limit_minutes: number | null
  passing_score: number | null
  is_published: boolean
  subject_id: number | null
  user_id: number
  created_at: string
  updated_at: string
}

export interface QuizAttempt {
  id: number
  quiz_id: number
  user_id: number
  score: number
  total_questions: number
  correct_answers: number
  time_taken_seconds: number
  is_completed: boolean
  started_at: string
  completed_at: string | null
  created_at: string
}

export const quizzesService = {
  // Get all quizzes
  getAll: async (params?: {
    subject_id?: number
    quiz_type?: string
    difficulty?: string
    is_published?: boolean
  }): Promise<Quiz[]> => {
    const response = await api.get('/quizzes/', { params })
    return response.data.quizzes || response.data
  },

  // Get quiz by ID
  getById: async (id: number): Promise<Quiz> => {
    const response = await api.get(`/quizzes/${id}`)
    return response.data
  },

  // Start quiz attempt
  startAttempt: async (quizId: number): Promise<QuizAttempt> => {
    const response = await api.post(`/quizzes/${quizId}/attempt`)
    return response.data
  },

  // Submit quiz answers
  submitAttempt: async (
    attemptId: number,
    answers: any[]
  ): Promise<QuizAttempt> => {
    const response = await api.put(`/quizzes/attempt/${attemptId}`, {
      answers,
    })
    return response.data
  },

  // Get attempt results
  getAttemptResults: async (attemptId: number): Promise<any> => {
    const response = await api.get(`/quizzes/attempt/${attemptId}/results`)
    return response.data
  },

  // Get all attempts for a quiz
  getAttempts: async (quizId: number): Promise<QuizAttempt[]> => {
    const response = await api.get(`/quizzes/${quizId}/attempts`)
    return response.data.attempts || response.data
  },

  // Toggle publish status
  togglePublish: async (id: number): Promise<Quiz> => {
    const response = await api.post(`/quizzes/${id}/publish`)
    return response.data
  },

  // Create quiz
  create: async (data: Partial<Quiz>): Promise<Quiz> => {
    const response = await api.post('/quizzes/', data)
    return response.data
  },

  // Update quiz
  update: async (id: number, data: Partial<Quiz>): Promise<Quiz> => {
    const response = await api.put(`/quizzes/${id}`, data)
    return response.data
  },

  // Delete quiz
  delete: async (id: number): Promise<void> => {
    await api.delete(`/quizzes/${id}`)
  },
}
