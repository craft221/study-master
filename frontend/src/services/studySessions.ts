import api from '@/lib/api'

export interface StudySession {
  id: number
  user_id: number
  subject_id: number
  session_type: 'pomodoro' | 'continuous' | 'timed'
  planned_duration_minutes: number
  break_duration_minutes: number
  actual_duration_minutes: number | null
  productivity_rating: number | null
  focus_score: number | null
  distractions_count: number
  breaks_taken: number
  xp_earned: number
  notes: string | null
  tags: string | null
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled'
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
}

export interface StudySessionStats {
  total_sessions: number
  total_minutes: number
  total_hours: number
  average_duration: number
  average_productivity: number
  average_focus: number
  sessions_by_type: Record<string, number>
  sessions_by_subject: Record<string, number>
  best_time_of_day: string | null
  total_xp_earned: number
}

export const studySessionsService = {
  // Create session
  create: async (data: Partial<StudySession>): Promise<StudySession> => {
    const response = await api.post('/study-sessions/', data)
    return response.data
  },

  // Get all sessions
  getAll: async (params?: {
    status?: string
    subject_id?: number
  }): Promise<StudySession[]> => {
    const response = await api.get('/study-sessions/', { params })
    return response.data.sessions || response.data
  },

  // Get session by ID
  getById: async (id: number): Promise<StudySession> => {
    const response = await api.get(`/study-sessions/${id}`)
    return response.data
  },

  // Get session stats
  getStats: async (): Promise<StudySessionStats> => {
    const response = await api.get('/study-sessions/stats')
    return response.data
  },

  // Start session
  start: async (id: number): Promise<StudySession> => {
    const response = await api.put(`/study-sessions/${id}/start`)
    return response.data
  },

  // Complete session
  complete: async (
    id: number,
    productivityRating?: number
  ): Promise<StudySession> => {
    const response = await api.put(`/study-sessions/${id}/complete`, {
      productivity_rating: productivityRating,
    })
    return response.data
  },

  // Delete session
  delete: async (id: number): Promise<void> => {
    await api.delete(`/study-sessions/${id}`)
  },
}
