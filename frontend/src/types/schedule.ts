export type EventType = 'class' | 'exam' | 'homework' | 'revision' | 'other'

export interface ScheduleEvent {
  id: number
  user_id: number
  subject_id: number | null
  title: string
  description: string | null
  event_type: EventType
  location: string | null
  start_time: string
  end_time: string
  day_of_week: string | null
  is_recurring: boolean
  recurrence_pattern: string | null
  color: string
  reminder_minutes_before: number | null
  is_completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ScheduleEventCreate {
  subject_id?: number
  title: string
  description?: string
  event_type: EventType
  location?: string
  start_time: string
  end_time: string
  day_of_week?: string
  is_recurring?: boolean
  recurrence_pattern?: string
  color?: string
  reminder_minutes_before?: number
}

export interface ScheduleEventUpdate {
  subject_id?: number
  title?: string
  description?: string
  event_type?: EventType
  location?: string
  start_time?: string
  end_time?: string
  day_of_week?: string
  is_recurring?: boolean
  recurrence_pattern?: string
  color?: string
  reminder_minutes_before?: number
  is_completed?: boolean
}

export interface ScheduleListResponse {
  events: ScheduleEvent[]
  total: number
  page: number
  page_size: number
}
