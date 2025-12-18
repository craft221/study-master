'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Bell,
  BellOff,
  Repeat,
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
  Info,
  CloudOff
} from 'lucide-react'
import {
  ScheduleEvent,
  ScheduleEventCreate,
  EventType,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  ReminderPreview,
} from '@/types/schedule'
import { schedulesService } from '@/services/schedules'
import { toast } from 'react-hot-toast'
import { useOfflineContext } from '@/components/providers/OfflineProvider'
import { offlineStorage, STORES } from '@/lib/offlineStorage'
import { syncService, generateTempId } from '@/services/syncService'

interface EventDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  event?: ScheduleEvent | null
  initialDate?: Date
}

// Types d'événements avec icônes
const eventTypes: { value: EventType; label: string; color: string; icon: string }[] = [
  { value: 'class', label: 'Cours', color: EVENT_TYPE_COLORS.class, icon: '📚' },
  { value: 'exam', label: 'Examen', color: EVENT_TYPE_COLORS.exam, icon: '📝' },
  { value: 'deadline', label: 'Date limite', color: EVENT_TYPE_COLORS.deadline, icon: '⏰' },
  { value: 'study', label: 'Session d\'étude', color: EVENT_TYPE_COLORS.study, icon: '💡' },
  { value: 'meeting', label: 'Réunion', color: EVENT_TYPE_COLORS.meeting, icon: '👥' },
  { value: 'other', label: 'Autre', color: EVENT_TYPE_COLORS.other, icon: '📌' },
]

// Patterns de récurrence
const recurrencePatterns = [
  { value: 'daily', label: 'Tous les jours', description: 'Se répète chaque jour' },
  { value: 'weekly', label: 'Chaque semaine', description: 'Se répète le même jour chaque semaine' },
  { value: 'monthly', label: 'Chaque mois', description: 'Se répète le même jour chaque mois' },
]

// Stratégies de rappels par type (aperçu local - correspond au backend)
const REMINDER_STRATEGIES: Record<EventType, ReminderPreview[]> = {
  exam: [
    { time_before: 'dans 1 semaine', priority: 'normal', label: '7 jours avant' },
    { time_before: 'dans 3 jours', priority: 'normal', label: '3 jours avant' },
    { time_before: 'dans 1 jour', priority: 'high', label: '1 jour avant' },
    { time_before: 'dans 2 heures', priority: 'high', label: '2 heures avant' },
    { time_before: 'dans 30 min', priority: 'urgent', label: '30 min avant' },
  ],
  class: [
    { time_before: 'dans 1 jour', priority: 'low', label: '1 jour avant' },
    { time_before: 'dans 1 heure', priority: 'normal', label: '1 heure avant' },
    { time_before: 'dans 15 min', priority: 'high', label: '15 min avant' },
  ],
  deadline: [
    { time_before: 'dans 3 jours', priority: 'normal', label: '3 jours avant' },
    { time_before: 'dans 1 jour', priority: 'high', label: '1 jour avant' },
    { time_before: 'dans 3 heures', priority: 'urgent', label: '3 heures avant' },
  ],
  study: [
    { time_before: 'dans 1 heure', priority: 'normal', label: '1 heure avant' },
    { time_before: 'dans 15 min', priority: 'high', label: '15 min avant' },
  ],
  meeting: [
    { time_before: 'dans 1 jour', priority: 'low', label: '1 jour avant' },
    { time_before: 'dans 1 heure', priority: 'normal', label: '1 heure avant' },
    { time_before: 'dans 15 min', priority: 'high', label: '15 min avant' },
  ],
  other: [
    { time_before: 'dans 1 jour', priority: 'low', label: '1 jour avant' },
    { time_before: 'dans 1 heure', priority: 'normal', label: '1 heure avant' },
  ],
}

// Couleurs par priorité
const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
}

export default function EventDialog({
  isOpen,
  onClose,
  onSuccess,
  event,
  initialDate,
}: EventDialogProps) {
  const { isOnline } = useOfflineContext()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<ScheduleEventCreate>({
    title: '',
    event_type: 'class',
    start_time: '',
    end_time: '',
    description: '',
    location: '',
    color: EVENT_TYPE_COLORS.class,
    is_recurring: false,
    recurrence_pattern: undefined,
    reminder_enabled: true,
    reminder_minutes_before: undefined,
  })

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        event_type: event.event_type,
        start_time: formatDateTimeForInput(event.start_time),
        end_time: formatDateTimeForInput(event.end_time),
        description: event.description || '',
        location: event.location || '',
        color: event.color,
        is_recurring: event.is_recurring,
        recurrence_pattern: event.recurrence_pattern || undefined,
        reminder_enabled: event.reminder_enabled,
        reminder_minutes_before: event.reminder_minutes_before || undefined,
        subject_id: event.subject_id || undefined,
      })
    } else if (initialDate) {
      const dateStr = initialDate.toISOString().split('T')[0]
      setFormData((prev) => ({
        ...prev,
        start_time: `${dateStr}T09:00`,
        end_time: `${dateStr}T10:00`,
      }))
    }
  }, [event, initialDate])

  // Format datetime pour input
  const formatDateTimeForInput = (dateStr: string): string => {
    try {
      const date = new Date(dateStr)
      return date.toISOString().slice(0, 16)
    } catch {
      return dateStr
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Préparer les données
      const submitData = {
        ...formData,
        // Nettoyer recurrence_pattern si non récurrent
        recurrence_pattern: formData.is_recurring ? formData.recurrence_pattern : undefined,
      }

      if (isOnline) {
        // Mode en ligne: créer/modifier directement sur le serveur
        if (event) {
          await schedulesService.update(event.id, submitData)
          toast.success('Événement modifié avec succès')
        } else {
          await schedulesService.create(submitData)
          toast.success('Événement créé avec succès')
        }
      } else {
        // Mode hors-ligne: créer/modifier localement avec un ID temporaire
        if (event) {
          // Modification offline
          const updatedEvent = {
            ...event,
            ...submitData,
            updated_at: new Date().toISOString(),
            _isOffline: true,
          }
          await offlineStorage.put(STORES.SCHEDULES, updatedEvent)
          await syncService.queueAction(
            STORES.SCHEDULES,
            'update',
            `/api/v1/schedules/${event.id}`,
            'PUT',
            submitData
          )
          toast.success('Événement modifié localement (sera synchronisé)')
        } else {
          // Création offline
          const tempId = generateTempId()
          const now = new Date().toISOString()

          const offlineEvent: ScheduleEvent = {
            id: tempId as any,
            title: submitData.title,
            event_type: submitData.event_type,
            start_time: submitData.start_time,
            end_time: submitData.end_time,
            description: submitData.description || null,
            location: submitData.location || null,
            color: submitData.color,
            is_recurring: submitData.is_recurring,
            recurrence_pattern: submitData.recurrence_pattern || null,
            reminder_enabled: submitData.reminder_enabled !== false,
            reminder_minutes_before: submitData.reminder_minutes_before || null,
            subject_id: submitData.subject_id || null,
            user_id: 0, // Sera remplacé côté serveur
            created_at: now,
            updated_at: now,
            _tempId: tempId,
            _isOffline: true,
          } as ScheduleEvent & { _tempId: string; _isOffline: boolean }

          // Sauvegarder dans IndexedDB
          await offlineStorage.put(STORES.SCHEDULES, offlineEvent)

          // Ajouter à la queue de synchronisation
          await syncService.queueAction(
            STORES.SCHEDULES,
            'create',
            '/api/v1/schedules/',
            'POST',
            { ...submitData, _tempId: tempId }
          )

          toast.success('Événement créé localement (sera synchronisé)')
        }
      }
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail || 'Une erreur est survenue'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleEventTypeChange = (eventType: EventType) => {
    const selectedType = eventTypes.find((t) => t.value === eventType)
    setFormData({
      ...formData,
      event_type: eventType,
      color: selectedType?.color || EVENT_TYPE_COLORS.other,
    })
  }

  // Obtenir les rappels pour le type d'événement actuel
  const currentReminders = REMINDER_STRATEGIES[formData.event_type || 'other']

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: formData.color }}
            />
            <h2 className="text-2xl font-bold text-gray-900">
              {event ? 'Modifier l\'événement' : 'Nouvel événement'}
            </h2>
            {!isOnline && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                <CloudOff className="w-3 h-3 mr-1" />
                Hors-ligne
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Offline Banner */}
        {!isOnline && (
          <div className="mx-6 mt-4 bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-orange-700">
              <CloudOff className="h-4 w-4" />
              <span>L'événement sera sauvegardé localement et synchronisé quand vous serez reconnecté.</span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Titre *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Ex: Cours de Mathématiques"
            />
          </div>

          {/* Event Type - Grille avec icônes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Type d'événement *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {eventTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleEventTypeChange(type.value)}
                  className={`
                    flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all
                    ${formData.event_type === type.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <span className="text-xl">{type.icon}</span>
                  <span className="text-sm font-medium text-gray-700">
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                Début *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.start_time}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline h-4 w-4 mr-1" />
                Fin *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="inline h-4 w-4 mr-1" />
              Lieu
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Ex: Amphithéâtre A, Salle 201, En ligne..."
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Notes supplémentaires..."
            />
          </div>

          {/* Récurrence Section */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-900">Récurrence</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_recurring}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_recurring: e.target.checked,
                      recurrence_pattern: e.target.checked ? 'weekly' : undefined
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            {/* Pattern de récurrence */}
            {formData.is_recurring && (
              <div className="space-y-3 pt-2">
                <p className="text-sm text-gray-600">
                  Choisissez la fréquence de répétition :
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {recurrencePatterns.map((pattern) => (
                    <button
                      key={pattern.value}
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          recurrence_pattern: pattern.value as 'daily' | 'weekly' | 'monthly'
                        })
                      }
                      className={`
                        px-4 py-2 rounded-lg border-2 transition-all text-sm
                        ${formData.recurrence_pattern === pattern.value
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }
                      `}
                    >
                      {pattern.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {recurrencePatterns.find(p => p.value === formData.recurrence_pattern)?.description ||
                   'Sélectionnez une fréquence'}
                </p>
              </div>
            )}
          </div>

          {/* Rappels Section */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-900">Rappels intelligents</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.reminder_enabled !== false}
                  onChange={(e) =>
                    setFormData({ ...formData, reminder_enabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            {/* Aperçu des rappels */}
            {formData.reminder_enabled !== false ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Pour un <strong>{EVENT_TYPE_LABELS[formData.event_type || 'other']}</strong>, vous recevrez :
                </p>
                <div className="flex flex-wrap gap-2">
                  {currentReminders.map((reminder, idx) => (
                    <span
                      key={idx}
                      className={`
                        inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium
                        ${priorityColors[reminder.priority]}
                      `}
                    >
                      <Bell className="h-3 w-3" />
                      {reminder.label}
                    </span>
                  ))}
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-500 bg-white p-2 rounded">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  <span>
                    Les rappels sont adaptés selon l'importance de l'événement.
                    Les examens ont plus de rappels que les cours réguliers.
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <BellOff className="h-4 w-4" />
                <span>Aucun rappel ne sera envoyé pour cet événement</span>
              </div>
            )}
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Couleur personnalisée
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={formData.color}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                className="h-10 w-14 border border-gray-300 rounded-lg cursor-pointer"
              />
              <div className="flex gap-2">
                {Object.entries(EVENT_TYPE_COLORS).map(([type, color]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`
                      w-8 h-8 rounded-full border-2 transition-all
                      ${formData.color === color ? 'border-gray-800 scale-110' : 'border-gray-200'}
                    `}
                    style={{ backgroundColor: color }}
                    title={EVENT_TYPE_LABELS[type as EventType]}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Enregistrement...</span>
                </>
              ) : (
                <span>{event ? 'Modifier' : 'Créer l\'événement'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
