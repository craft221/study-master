/**
 * Service Schedules - API Client pour le calendrier avec rappels intelligents
 */

import api from '@/lib/api'
import {
  ScheduleEvent,
  ScheduleEventCreate,
  ScheduleEventUpdate,
  ScheduleListResponse,
  ReminderStrategiesResponse,
  EventType,
  EVENT_TYPE_COLORS
} from '@/types/schedule'

export const schedulesService = {
  /**
   * Créer un nouvel événement
   */
  create: async (data: ScheduleEventCreate): Promise<ScheduleEvent> => {
    // Appliquer la couleur par défaut selon le type si non spécifiée
    if (!data.color && data.event_type) {
      data.color = EVENT_TYPE_COLORS[data.event_type]
    }
    const response = await api.post('/schedules/', data)
    return response.data
  },

  /**
   * Récupérer tous les événements avec filtres
   */
  getAll: async (params?: {
    page?: number
    page_size?: number
    start_date?: string
    end_date?: string
    event_type?: EventType
    subject_id?: number
  }): Promise<ScheduleListResponse> => {
    const response = await api.get('/schedules/', { params })
    return response.data
  },

  /**
   * Récupérer les événements de la semaine
   */
  getWeek: async (start_of_week?: string): Promise<ScheduleListResponse> => {
    const params = start_of_week ? { start_of_week } : {}
    const response = await api.get('/schedules/week', { params })
    return response.data
  },

  /**
   * Récupérer les prochains événements
   */
  getUpcoming: async (limit: number = 10): Promise<ScheduleEvent[]> => {
    const response = await api.get('/schedules/upcoming', {
      params: { limit },
    })
    return response.data
  },

  /**
   * Récupérer un événement par ID
   */
  getById: async (id: number): Promise<ScheduleEvent> => {
    const response = await api.get(`/schedules/${id}`)
    return response.data
  },

  /**
   * Mettre à jour un événement
   */
  update: async (
    id: number,
    data: ScheduleEventUpdate
  ): Promise<ScheduleEvent> => {
    const response = await api.put(`/schedules/${id}`, data)
    return response.data
  },

  /**
   * Supprimer un événement
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/schedules/${id}`)
  },

  /**
   * Marquer un événement comme terminé
   */
  markComplete: async (id: number): Promise<ScheduleEvent> => {
    const response = await api.put(`/schedules/${id}`, { is_completed: true })
    return response.data
  },

  /**
   * Annuler un événement
   */
  cancel: async (id: number): Promise<ScheduleEvent> => {
    const response = await api.put(`/schedules/${id}`, { is_cancelled: true })
    return response.data
  },

  /**
   * Récupérer les stratégies de rappels pour chaque type d'événement
   * Utile pour afficher à l'utilisateur quels rappels il recevra
   */
  getReminderStrategies: async (): Promise<ReminderStrategiesResponse> => {
    const response = await api.get('/schedules/reminder-strategies')
    return response.data
  },

  /**
   * Activer/désactiver les rappels pour un événement
   */
  toggleReminders: async (id: number, enabled: boolean): Promise<ScheduleEvent> => {
    const response = await api.put(`/schedules/${id}`, { reminder_enabled: enabled })
    return response.data
  }
}

export default schedulesService

