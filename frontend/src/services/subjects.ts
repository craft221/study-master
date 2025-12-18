import api from '@/lib/api'

export interface Subject {
  id: number
  name: string
  description: string | null
  color: string
  icon: string
  semester: string | null
  year: string | null
  credits_ects: number | null
  coefficient: number | null
  professor_name: string | null
  professor_email: string | null
  difficulty: 'easy' | 'medium' | 'hard' | 'very_hard' | null
  target_grade: number | null
  user_id: number
  current_grade: number | null
  total_notes_count: number
  total_flashcards_count: number
  total_quizzes_count: number
  total_study_time_minutes: number
  xp_earned: number
  level: number
  mastery_percentage: number
  is_active: boolean
  is_favorite: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface SubjectCreate {
  name: string
  description?: string
  color?: string
  icon?: string
  semester?: string
  year?: string
  credits_ects?: number
  coefficient?: number
  professor_name?: string
  professor_email?: string
  difficulty?: 'easy' | 'medium' | 'hard' | 'very_hard'
  target_grade?: number
}

export interface SubjectUpdate {
  name?: string
  description?: string
  color?: string
  icon?: string
  semester?: string
  year?: string
  credits_ects?: number
  coefficient?: number
  professor_name?: string
  professor_email?: string
  difficulty?: 'easy' | 'medium' | 'hard' | 'very_hard'
  target_grade?: number
  current_grade?: number
  is_active?: boolean
  is_favorite?: boolean
  is_archived?: boolean
}

export interface SubjectStats {
  subject_id: number
  subject_name: string
  current_grade: number | null
  target_grade: number | null
  grade_progress: number | null
  total_notes: number
  total_flashcards: number
  total_quizzes: number
  total_study_time_minutes: number
  total_study_time_hours: number
  average_study_time_per_week: number
  average_quiz_score: number | null
  flashcards_mastered: number
  flashcards_due: number
  xp_earned: number
  level: number
  mastery_percentage: number
  exam_date: string | null
  days_until_exam: number | null
  recommended_study_hours: number | null
}

export const subjectsService = {
  // Get all subjects
  getAll: async (params?: {
    is_active?: boolean
    is_archived?: boolean
    semester?: string
  }): Promise<Subject[]> => {
    const response = await api.get('/subjects/', { params })
    return response.data.subjects || response.data
  },

  // Get subject by ID
  getById: async (id: number): Promise<Subject> => {
    const response = await api.get(`/subjects/${id}`)
    return response.data
  },

  // Create subject
  create: async (data: SubjectCreate): Promise<Subject> => {
    const response = await api.post('/subjects/', data)
    return response.data
  },

  // Update subject
  update: async (id: number, data: SubjectUpdate): Promise<Subject> => {
    const response = await api.put(`/subjects/${id}`, data)
    return response.data
  },

  // Delete subject
  delete: async (id: number): Promise<void> => {
    await api.delete(`/subjects/${id}`)
  },

  // Get subject stats
  getStats: async (id: number): Promise<SubjectStats> => {
    const response = await api.get(`/subjects/${id}/stats`)
    return response.data
  },

  // Toggle favorite
  toggleFavorite: async (id: number): Promise<Subject> => {
    const response = await api.post(`/subjects/${id}/favorite`)
    return response.data
  },

  // Toggle archive
  toggleArchive: async (id: number): Promise<Subject> => {
    const response = await api.post(`/subjects/${id}/archive`)
    return response.data
  },

  // Alias for getAll (compatibility)
  getSubjects: async (params?: {
    is_active?: boolean
    is_archived?: boolean
    semester?: string
  }): Promise<Subject[]> => {
    const response = await api.get('/subjects/', { params })
    return response.data.subjects || response.data
  },
}

export default subjectsService
