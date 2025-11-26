import api from '@/lib/api'
import {
  ScheduleEvent,
  ScheduleEventCreate,
  ScheduleEventUpdate,
  ScheduleListResponse,
} from '@/types/schedule'

export const schedulesService = {
  // Create a new schedule event
  create: async (data: ScheduleEventCreate): Promise<ScheduleEvent> => {
    const response = await api.post('/schedules/', data)
    return response.data
  },

  // Get all schedule events with filters
  getAll: async (params?: {
    page?: number
    page_size?: number
    start_date?: string
    end_date?: string
    event_type?: string
    subject_id?: number
  }): Promise<ScheduleListResponse> => {
    const response = await api.get('/schedules/', { params })
    return response.data
  },

  // Get current week's schedule
  getWeek: async (start_of_week?: string): Promise<ScheduleListResponse> => {
    const params = start_of_week ? { start_of_week } : {}
    const response = await api.get('/schedules/week', { params })
    return response.data
  },

  // Get upcoming events
  getUpcoming: async (limit: number = 10): Promise<ScheduleEvent[]> => {
    const response = await api.get('/schedules/upcoming', {
      params: { limit },
    })
    return response.data
  },

  // Get a specific event
  getById: async (id: number): Promise<ScheduleEvent> => {
    const response = await api.get(`/schedules/${id}`)
    return response.data
  },

  // Update an event
  update: async (
    id: number,
    data: ScheduleEventUpdate
  ): Promise<ScheduleEvent> => {
    const response = await api.put(`/schedules/${id}`, data)
    return response.data
  },

  // Delete an event
  delete: async (id: number): Promise<void> => {
    await api.delete(`/schedules/${id}`)
  },
}
