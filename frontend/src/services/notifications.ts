/**
 * Service Notifications - API Client
 */

import api from '@/lib/api'

export type NotificationType =
  | 'duel_challenge' | 'duel_accepted' | 'duel_declined' | 'duel_completed' | 'duel_won' | 'duel_lost'
  | 'event_reminder' | 'exam_reminder'
  | 'streak_reminder' | 'streak_lost' | 'streak_milestone'
  | 'flashcard_review' | 'quiz_reminder'
  | 'achievement_unlocked' | 'level_up' | 'xp_gained'
  | 'group_invite' | 'group_message'
  | 'system' | 'welcome'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Notification {
  id: number
  user_id: number
  type: NotificationType
  title: string
  message: string
  priority: NotificationPriority
  channel: string
  is_read: boolean
  read_at: string | null
  action_url: string | null
  data: string | null
  created_at: string
  expires_at: string | null
}

export interface NotificationListResponse {
  notifications: Notification[]
  total: number
  unread_count: number
  page: number
  page_size: number
}

export interface UnreadCountResponse {
  unread_count: number
  by_type: Record<string, number>
}

export interface NotificationPreferences {
  id: number
  user_id: number
  email_enabled: boolean
  push_enabled: boolean
  in_app_enabled: boolean
  duel_notifications: boolean
  calendar_notifications: boolean
  streak_notifications: boolean
  study_reminders: boolean
  achievement_notifications: boolean
  social_notifications: boolean
  quiet_hours_start: number
  quiet_hours_end: number
  email_digest: boolean
  email_digest_hour: number
  created_at: string
  updated_at: string
}

export interface NotificationPreferencesUpdate {
  email_enabled?: boolean
  push_enabled?: boolean
  in_app_enabled?: boolean
  duel_notifications?: boolean
  calendar_notifications?: boolean
  streak_notifications?: boolean
  study_reminders?: boolean
  achievement_notifications?: boolean
  social_notifications?: boolean
  quiet_hours_start?: number
  quiet_hours_end?: number
  email_digest?: boolean
  email_digest_hour?: number
}

export const notificationsService = {
  /**
   * Récupérer les notifications
   */
  getAll: async (
    page = 1,
    pageSize = 20,
    unreadOnly = false
  ): Promise<NotificationListResponse> => {
    const response = await api.get('/notifications/', {
      params: { page, page_size: pageSize, unread_only: unreadOnly }
    })
    return response.data
  },

  /**
   * Récupérer le nombre de notifications non lues
   */
  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    const response = await api.get('/notifications/unread-count')
    return response.data
  },

  /**
   * Marquer des notifications comme lues
   */
  markAsRead: async (notificationIds: number[]): Promise<{ marked_count: number }> => {
    const response = await api.post('/notifications/mark-read', {
      notification_ids: notificationIds
    })
    return response.data
  },

  /**
   * Marquer toutes les notifications comme lues
   */
  markAllAsRead: async (): Promise<{ marked_count: number }> => {
    const response = await api.post('/notifications/mark-all-read')
    return response.data
  },

  /**
   * Supprimer une notification
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/notifications/${id}`)
  },

  /**
   * Récupérer les préférences de notification
   */
  getPreferences: async (): Promise<NotificationPreferences> => {
    const response = await api.get('/notifications/preferences')
    return response.data
  },

  /**
   * Mettre à jour les préférences de notification
   */
  updatePreferences: async (
    updates: NotificationPreferencesUpdate
  ): Promise<NotificationPreferences> => {
    const response = await api.patch('/notifications/preferences', updates)
    return response.data
  },

  /**
   * Envoyer une notification de test
   */
  sendTest: async (): Promise<{ success: boolean; notification_id?: number }> => {
    const response = await api.post('/notifications/test')
    return response.data
  }
}

/**
 * Helper pour obtenir l'icône selon le type de notification
 */
export function getNotificationIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    duel_challenge: '⚔️',
    duel_accepted: '✅',
    duel_declined: '❌',
    duel_completed: '🏁',
    duel_won: '🏆',
    duel_lost: '😢',
    event_reminder: '📅',
    exam_reminder: '📝',
    streak_reminder: '🔥',
    streak_lost: '💔',
    streak_milestone: '🎉',
    flashcard_review: '📚',
    quiz_reminder: '🧠',
    achievement_unlocked: '🏆',
    level_up: '⬆️',
    xp_gained: '✨',
    group_invite: '👥',
    group_message: '💬',
    system: 'ℹ️',
    welcome: '👋'
  }
  return icons[type] || '🔔'
}

/**
 * Helper pour obtenir la couleur selon la priorité
 */
export function getPriorityColor(priority: NotificationPriority): string {
  const colors: Record<NotificationPriority, string> = {
    low: 'text-gray-500',
    normal: 'text-blue-500',
    high: 'text-orange-500',
    urgent: 'text-red-500'
  }
  return colors[priority] || 'text-gray-500'
}

export default notificationsService
