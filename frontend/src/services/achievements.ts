import api from '@/lib/api'

export interface Achievement {
  id: number
  name: string
  description: string
  icon: string
  category: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  xp_reward: number
  requirement_type: string
  requirement_value: number
  created_at: string
}

export interface UserAchievement {
  id: number
  user_id: number
  achievement_id: number
  progress: number
  is_unlocked: boolean
  unlocked_at: string | null
  created_at: string
  achievement?: Achievement
}

export const achievementsService = {
  // Get all available achievements
  getAll: async (params?: {
    category?: string
    rarity?: string
  }): Promise<Achievement[]> => {
    const response = await api.get('/achievements/', { params })
    return response.data.achievements || response.data
  },

  // Get current user's achievements
  getMy: async (): Promise<UserAchievement[]> => {
    const response = await api.get('/achievements/user/me')
    return response.data.achievements || response.data
  },

  // Get user achievements by ID
  getUserAchievements: async (
    userId: number
  ): Promise<UserAchievement[]> => {
    const response = await api.get(`/achievements/user/${userId}`)
    return response.data.achievements || response.data
  },

  // Get achievement by ID
  getById: async (id: number): Promise<Achievement> => {
    const response = await api.get(`/achievements/${id}`)
    return response.data
  },

  // Manually unlock achievement (admin/testing)
  unlock: async (id: number): Promise<UserAchievement> => {
    const response = await api.post(`/achievements/unlock/${id}`)
    return response.data
  },

  // Auto-check and unlock achievements
  checkProgress: async (): Promise<UserAchievement[]> => {
    const response = await api.post('/achievements/check-progress')
    // Backend returns a direct array, not { unlocked: [...] }
    return Array.isArray(response.data) ? response.data : (response.data.unlocked || [])
  },
}
