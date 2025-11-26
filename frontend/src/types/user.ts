export interface User {
  id: number
  email: string
  username: string
  full_name: string | null
  university: string | null
  major: string | null
  promotion: string | null
  avatar_url: string | null
  bio: string | null
  role: 'student' | 'teacher' | 'admin'
  subscription_type: 'free' | 'premium' | 'premium_plus' | 'institutional'
  total_xp: number
  level: number
  current_streak: number
  longest_streak: number
  total_study_time_minutes: number
  total_notes_created: number
  total_flashcards_created: number
  total_quizzes_completed: number
  is_active: boolean
  is_verified: boolean
  created_at: string
  student_id?: string | null
  phone?: string | null
  country?: string | null
  city?: string | null
  timezone?: string | null
  language?: string | null
  theme?: string | null
  notifications_enabled?: boolean
  email_notifications?: boolean
  last_activity_date?: string | null
  subscription_ends_at?: string | null
  ai_requests_today?: number
  total_ai_requests?: number
}

export interface UserUpdate {
  email?: string
  full_name?: string
  bio?: string
  university?: string
  major?: string
  promotion?: string
  student_id?: string
  phone?: string
  country?: string
  city?: string
  language?: string
  theme?: string
  notifications_enabled?: boolean
}

export interface PasswordChange {
  current_password: string
  new_password: string
}

export interface UserActivity {
  id: number
  activity_type: string
  description: string
  created_at: string
  metadata?: any
}

export interface UserActivityResponse {
  activities: UserActivity[]
  period_days: number
  total_activities: number
}
