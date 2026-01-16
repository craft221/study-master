/**
 * Service Focus Rooms - API Client pour les salles d'étude virtuelles (body doubling)
 */

import api from '@/lib/api'

// ==================== TYPES ====================

export type FocusRoomType = 'public' | 'subject' | 'university' | 'private' | 'event'
export type FocusRoomCategory = 'general' | 'sciences' | 'humanities' | 'languages' | 'business' | 'technology' | 'medicine' | 'law' | 'other'
export type ParticipantStatus = 'focusing' | 'deep_work' | 'break' | 'idle' | 'away'
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired'

export interface FocusRoom {
  id: number
  name: string
  description: string | null
  emoji: string
  room_type: FocusRoomType
  category: FocusRoomCategory
  subject_id: number | null
  subject_name: string | null
  university: string | null
  promotion: string | null
  max_participants: number
  is_active: boolean
  is_private: boolean
  invite_code: string | null
  creator_id: number
  creator_username: string | null
  creator_avatar: string | null
  total_focus_minutes: number
  total_sessions: number
  total_unique_users: number
  today_focus_minutes: number
  today_sessions: number
  active_participants: number
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
}

export interface FocusRoomParticipant {
  id: number
  user_id: number
  room_id: number
  username: string
  avatar_url: string | null
  level: number
  status: ParticipantStatus
  current_activity: string | null
  current_subject_name: string | null
  joined_at: string
  focus_minutes: number
  today_focus_minutes: number
  milestones_reached?: string[]
  is_visible: boolean
}

export interface FocusRoomActivity {
  id: number
  activity_type: string
  user_id: number
  username: string
  avatar_url: string | null
  message: string | null
  extra_data: Record<string, any> | null
  created_at: string
}

export interface RoomStats {
  active_participants: number
  today_focus_minutes: number
  today_sessions: number
  total_focus_minutes: number
  total_sessions: number
  total_unique_users: number
  peak_participants: number
  top_focuser: {
    user_id: number
    username: string
    minutes: number
  } | null
}

export interface FocusRoomInvitation {
  id: number
  room_id: number
  room_name: string
  room_emoji: string
  inviter_id: number
  inviter_username: string
  inviter_avatar: string | null
  invitee_id: number
  invitee_username: string
  status: InvitationStatus
  message: string | null
  created_at: string
  expires_at: string
  responded_at: string | null
}

export interface UserFocusStats {
  total_focus_room_minutes: number
  total_focus_room_sessions: number
  total_rooms_joined: number
  total_rooms_created: number
  focus_room_streak_days: number
  best_focus_room_streak: number
  longest_session_minutes: number
  best_focus_score: number
  favorite_room_id: number | null
  favorite_room_name: string | null
  preferred_hour: number | null
  total_xp_earned: number
  total_xp_bonus: number
  achievements: string[]
}

export interface LeaderboardEntry {
  rank: number
  user_id: number
  username: string
  avatar_url: string | null
  level: number
  focus_minutes: number
  sessions_count: number
}

export interface FocusSession {
  id: number
  room_id: number | null
  room_name: string | null
  user_id: number
  subject_id: number | null
  subject_name: string | null
  started_at: string
  ended_at: string | null
  focus_minutes: number
  break_minutes: number
  total_minutes: number
  focus_score: number | null
  activities_completed: number
  milestones_reached?: string[]
  xp_earned: number
  xp_bonus: number
}

// ==================== REQUEST TYPES ====================

export interface CreateRoomRequest {
  name: string
  description?: string
  emoji?: string
  room_type?: FocusRoomType
  category?: FocusRoomCategory
  max_participants?: number
  subject_id?: number
  university?: string
  promotion?: string
  is_private?: boolean
  starts_at?: string
  ends_at?: string
}

export interface UpdateRoomRequest {
  name?: string
  description?: string
  emoji?: string
  category?: FocusRoomCategory
  max_participants?: number
  is_active?: boolean
  starts_at?: string
  ends_at?: string
}

export interface JoinRoomRequest {
  activity?: string
  subject_id?: number
  is_visible?: boolean
  show_activity?: boolean
  invite_code?: string
}

export interface RoomFilters {
  room_type?: FocusRoomType
  category?: FocusRoomCategory
  university?: string
  subject_id?: number
  search?: string
  hide_empty?: boolean
  hide_full?: boolean
  sort_by?: 'active_participants' | 'created_at' | 'name'
  sort_order?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

// ==================== RESPONSE TYPES ====================

export interface RoomListResponse {
  rooms: FocusRoom[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

export interface RoomDetailResponse extends FocusRoom {
  participants: FocusRoomParticipant[]
  recent_activities: FocusRoomActivity[]
  stats: RoomStats
}

export interface LeaderboardResponse {
  room_id: number
  room_name: string
  period: string
  entries: LeaderboardEntry[]
  user_rank: number | null
  user_entry: LeaderboardEntry | null
}

// ==================== SERVICE ====================

export const focusRoomsService = {
  // ==================== ROOMS ====================

  /**
   * Creer une nouvelle room
   */
  createRoom: async (data: CreateRoomRequest): Promise<FocusRoom> => {
    const response = await api.post('/focus-rooms/', data)
    return response.data
  },

  /**
   * Lister les rooms avec filtres
   */
  getRooms: async (filters?: RoomFilters): Promise<RoomListResponse> => {
    const response = await api.get('/focus-rooms/', { params: filters })
    return response.data
  },

  /**
   * Obtenir une room par ID avec details
   */
  getRoom: async (roomId: number): Promise<RoomDetailResponse> => {
    const response = await api.get(`/focus-rooms/${roomId}`)
    return response.data
  },

  /**
   * Mettre a jour une room
   */
  updateRoom: async (roomId: number, data: UpdateRoomRequest): Promise<FocusRoom> => {
    const response = await api.put(`/focus-rooms/${roomId}`, data)
    return response.data
  },

  /**
   * Supprimer une room
   */
  deleteRoom: async (roomId: number): Promise<void> => {
    await api.delete(`/focus-rooms/${roomId}`)
  },

  /**
   * Obtenir mes rooms creees
   */
  getMyRooms: async (): Promise<FocusRoom[]> => {
    const response = await api.get('/focus-rooms/my-rooms')
    return response.data
  },

  // ==================== PARTICIPATION ====================

  /**
   * Rejoindre une room
   */
  joinRoom: async (roomId: number, data?: JoinRoomRequest): Promise<FocusRoomParticipant> => {
    const response = await api.post(`/focus-rooms/${roomId}/join`, data || {})
    return response.data
  },

  /**
   * Quitter une room
   */
  leaveRoom: async (roomId: number): Promise<{ session: FocusSession; xp_earned: number }> => {
    const response = await api.post(`/focus-rooms/${roomId}/leave`)
    return response.data
  },

  /**
   * Mettre a jour le statut
   */
  updateStatus: async (roomId: number, status: ParticipantStatus): Promise<void> => {
    await api.patch(`/focus-rooms/${roomId}/status`, { status })
  },

  /**
   * Mettre a jour l'activite en cours
   */
  updateActivity: async (roomId: number, activity: string | null, subject_id?: number): Promise<void> => {
    await api.patch(`/focus-rooms/${roomId}/activity`, { activity, subject_id })
  },

  /**
   * Heartbeat HTTP pour sauvegarder les minutes de focus periodiquement
   * Remplace/complete le heartbeat WebSocket qui peut ne pas fonctionner
   */
  heartbeat: async (roomId: number): Promise<{ success: boolean; focus_minutes: number; today_focus_minutes: number; milestone: string | null; xp_earned: number }> => {
    const response = await api.post(`/focus-rooms/${roomId}/heartbeat`)
    return response.data
  },

  /**
   * Reclamer une recompense aleatoire gagnee pendant le focus
   * Remplace le WebSocket claim_reward qui peut ne pas fonctionner
   */
  claimReward: async (roomId: number, rewardType: string, rarity: string): Promise<{ success: boolean; xp_earned: number; reward_name: string; reward_type: string; rarity: string }> => {
    const response = await api.post(`/focus-rooms/${roomId}/claim-reward`, {
      reward_type: rewardType,
      rarity: rarity
    })
    return response.data
  },

  /**
   * Obtenir ma participation actuelle
   */
  getCurrentParticipation: async (): Promise<FocusRoomParticipant | null> => {
    try {
      const response = await api.get('/focus-rooms/current')
      return response.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  // ==================== INVITATIONS ====================

  /**
   * Inviter un utilisateur
   */
  inviteUser: async (roomId: number, inviteeId: number, message?: string): Promise<FocusRoomInvitation> => {
    const response = await api.post(`/focus-rooms/${roomId}/invite`, { invitee_id: inviteeId, message })
    return response.data
  },

  /**
   * Accepter une invitation
   */
  acceptInvitation: async (invitationId: number): Promise<FocusRoomParticipant> => {
    const response = await api.post(`/focus-rooms/invitations/${invitationId}/accept`)
    return response.data
  },

  /**
   * Decliner une invitation
   */
  declineInvitation: async (invitationId: number): Promise<void> => {
    await api.post(`/focus-rooms/invitations/${invitationId}/decline`)
  },

  /**
   * Obtenir mes invitations en attente
   */
  getMyInvitations: async (): Promise<FocusRoomInvitation[]> => {
    const response = await api.get('/focus-rooms/invitations/received')
    return response.data
  },

  /**
   * Rejoindre par code d'invitation
   */
  joinByCode: async (code: string, activity?: string, subject_id?: number): Promise<FocusRoomParticipant> => {
    const response = await api.post('/focus-rooms/join-by-code', { code, activity, subject_id })
    return response.data
  },

  // ==================== STATS & LEADERBOARD ====================

  /**
   * Obtenir les stats d'une room
   */
  getRoomStats: async (roomId: number): Promise<RoomStats> => {
    const response = await api.get(`/focus-rooms/${roomId}/stats`)
    return response.data
  },

  /**
   * Obtenir le leaderboard d'une room
   */
  getRoomLeaderboard: async (roomId: number, period: 'today' | 'week' | 'month' | 'all_time' = 'today'): Promise<LeaderboardResponse> => {
    const response = await api.get(`/focus-rooms/${roomId}/leaderboard`, { params: { period } })
    return response.data
  },

  /**
   * Obtenir mes stats Focus Room
   */
  getMyStats: async (): Promise<UserFocusStats> => {
    const response = await api.get('/focus-rooms/stats/me')
    return response.data
  },

  /**
   * Obtenir les activites d'une room
   */
  getRoomActivities: async (roomId: number, limit: number = 20): Promise<FocusRoomActivity[]> => {
    const response = await api.get(`/focus-rooms/${roomId}/activities`, { params: { limit } })
    return response.data
  },

  /**
   * Obtenir mon historique de sessions
   */
  getMySessions: async (page: number = 1, pageSize: number = 20): Promise<{ sessions: FocusSession[]; total: number }> => {
    const response = await api.get('/focus-rooms/sessions/me', { params: { page, page_size: pageSize } })
    return response.data
  }
}

export default focusRoomsService
