/**
 * Types pour le système de calendrier avec rappels intelligents
 */

// Types d'événements avec stratégies de rappels différentes
export type EventType = 'exam' | 'class' | 'deadline' | 'study' | 'meeting' | 'other'

// Labels français pour les types d'événements
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  exam: 'Examen',
  class: 'Cours',
  deadline: 'Date limite',
  study: 'Session d\'étude',
  meeting: 'Réunion',
  other: 'Autre'
}

// Couleurs par défaut pour les types d'événements
export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  exam: '#EF4444',      // Rouge
  class: '#3B82F6',     // Bleu
  deadline: '#F59E0B',  // Orange
  study: '#10B981',     // Vert
  meeting: '#8B5CF6',   // Violet
  other: '#6B7280'      // Gris
}

// Information sur un rappel envoyé
export interface ReminderInfo {
  minutes: number
  sent_at: string
}

// Aperçu d'un rappel planifié
export interface ReminderPreview {
  time_before: string   // "dans 1 jour", "dans 2 heures"
  priority: string      // "low", "normal", "high", "urgent"
  label: string         // "1 jour", "2 heures"
}

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
  day_of_week: number | null  // 0=Monday, 6=Sunday
  is_recurring: boolean
  recurrence_pattern: 'daily' | 'weekly' | 'monthly' | null
  color: string
  // Rappels intelligents
  reminder_enabled: boolean
  reminder_minutes_before: number | null  // Override manuel
  reminders_sent: ReminderInfo[] | null   // Historique des rappels envoyés
  // État
  is_completed: boolean
  completed_at: string | null
  is_cancelled: boolean
  // Timestamps
  created_at: string
  updated_at: string
}

export interface ScheduleEventCreate {
  subject_id?: number
  title: string
  description?: string
  event_type?: EventType
  location?: string
  start_time: string
  end_time: string
  day_of_week?: number
  is_recurring?: boolean
  recurrence_pattern?: 'daily' | 'weekly' | 'monthly'
  color?: string
  reminder_enabled?: boolean
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
  day_of_week?: number
  is_recurring?: boolean
  recurrence_pattern?: 'daily' | 'weekly' | 'monthly' | null
  color?: string
  reminder_enabled?: boolean
  reminder_minutes_before?: number | null
  is_completed?: boolean
  is_cancelled?: boolean
}

export interface ScheduleListResponse {
  events: ScheduleEvent[]
  total: number
  page: number
  page_size: number
}

// Réponse de l'API pour les stratégies de rappels
export interface ReminderStrategiesResponse {
  strategies: Record<EventType, ReminderPreview[]>
  event_types: Array<{ value: EventType; label: string }>
}
