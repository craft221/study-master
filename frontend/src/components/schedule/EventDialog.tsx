'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import {
  ScheduleEvent,
  ScheduleEventCreate,
  EventType,
} from '@/types/schedule'
import { schedulesService } from '@/services/schedules'
import { toast } from 'react-hot-toast'

interface EventDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  event?: ScheduleEvent | null
  initialDate?: Date
}

const eventTypes: { value: EventType; label: string; color: string }[] = [
  { value: 'class', label: 'Cours', color: '#3b82f6' },
  { value: 'exam', label: 'Examen', color: '#ef4444' },
  { value: 'homework', label: 'Devoir', color: '#f59e0b' },
  { value: 'revision', label: 'Révision', color: '#22c55e' },
  { value: 'other', label: 'Autre', color: '#8b5cf6' },
]

export default function EventDialog({
  isOpen,
  onClose,
  onSuccess,
  event,
  initialDate,
}: EventDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<ScheduleEventCreate>({
    title: '',
    event_type: 'class',
    start_time: '',
    end_time: '',
    description: '',
    location: '',
    color: '#3b82f6',
    is_recurring: false,
  })

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        event_type: event.event_type,
        start_time: event.start_time,
        end_time: event.end_time,
        description: event.description || '',
        location: event.location || '',
        color: event.color,
        is_recurring: event.is_recurring,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (event) {
        await schedulesService.update(event.id, formData)
        toast.success('Événement modifié avec succès')
      } else {
        await schedulesService.create(formData)
        toast.success('Événement créé avec succès')
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {event ? 'Modifier l\'événement' : 'Nouvel événement'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type d'événement *
            </label>
            <select
              required
              value={formData.event_type}
              onChange={(e) => {
                const eventType = e.target.value as EventType
                const selectedType = eventTypes.find(
                  (t) => t.value === eventType
                )
                setFormData({
                  ...formData,
                  event_type: eventType,
                  color: selectedType?.color || '#3b82f6',
                })
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {eventTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
              Lieu
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Ex: Amphithéâtre A"
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

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Couleur
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={formData.color}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                className="h-10 w-20 border border-gray-300 rounded-lg cursor-pointer"
              />
              <span className="text-sm text-gray-600">{formData.color}</span>
            </div>
          </div>

          {/* Recurring */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="recurring"
              checked={formData.is_recurring}
              onChange={(e) =>
                setFormData({ ...formData, is_recurring: e.target.checked })
              }
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label
              htmlFor="recurring"
              className="ml-2 block text-sm text-gray-700"
            >
              Événement récurrent
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50"
            >
              {loading
                ? 'Enregistrement...'
                : event
                ? 'Modifier'
                : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
