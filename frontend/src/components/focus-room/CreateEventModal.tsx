'use client'

import { useState } from 'react'
import { X, Calendar, Clock, Users, Lock, Globe, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { format, addHours, addDays, startOfHour } from 'date-fns'

interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (roomId: number) => void
}

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'sciences', label: 'Sciences' },
  { value: 'humanities', label: 'Lettres & Sciences Humaines' },
  { value: 'languages', label: 'Langues' },
  { value: 'business', label: 'Business & Economie' },
  { value: 'technology', label: 'Technologie & Informatique' },
  { value: 'medicine', label: 'Medecine & Sante' },
  { value: 'law', label: 'Droit' },
  { value: 'other', label: 'Autre' },
]

const EMOJIS = ['📚', '💻', '🎯', '🧠', '📖', '✏️', '🔬', '🎓', '💡', '🚀', '⚡', '🌟']

const QUICK_DURATIONS = [
  { label: '1 heure', hours: 1 },
  { label: '2 heures', hours: 2 },
  { label: '3 heures', hours: 3 },
  { label: 'Demi-journee', hours: 4 },
]

export default function CreateEventModal({ isOpen, onClose, onCreated }: CreateEventModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    emoji: '📚',
    category: 'general',
    max_participants: 50,
    is_private: false,
    starts_at: format(addHours(startOfHour(new Date()), 1), "yyyy-MM-dd'T'HH:mm"),
    ends_at: format(addHours(startOfHour(new Date()), 3), "yyyy-MM-dd'T'HH:mm"),
  })

  const handleQuickDuration = (hours: number) => {
    const startsAt = new Date(formData.starts_at)
    const endsAt = addHours(startsAt, hours)
    setFormData(prev => ({
      ...prev,
      ends_at: format(endsAt, "yyyy-MM-dd'T'HH:mm")
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast({ title: 'Le nom est requis', variant: 'destructive' })
      return
    }

    const startsAt = new Date(formData.starts_at)
    const endsAt = new Date(formData.ends_at)

    if (endsAt <= startsAt) {
      toast({ title: 'La date de fin doit etre apres la date de debut', variant: 'destructive' })
      return
    }

    if (startsAt < new Date()) {
      toast({ title: 'La date de debut doit etre dans le futur', variant: 'destructive' })
      return
    }

    try {
      setLoading(true)
      const response = await api.post('/focus-rooms/events', {
        ...formData,
        room_type: 'event',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })

      toast({ title: 'Evenement cree avec succes!' })
      onCreated?.(response.data.id)
      onClose()

      // Reset form
      setFormData({
        name: '',
        description: '',
        emoji: '📚',
        category: 'general',
        max_participants: 50,
        is_private: false,
        starts_at: format(addHours(startOfHour(new Date()), 1), "yyyy-MM-dd'T'HH:mm"),
        ends_at: format(addHours(startOfHour(new Date()), 3), "yyyy-MM-dd'T'HH:mm"),
      })
    } catch (error: any) {
      toast({ title: error.response?.data?.detail || 'Erreur lors de la creation', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/20">
              <Calendar className="h-5 w-5 text-blue-400" />
            </div>
            <h2 className="text-lg font-bold text-white">Creer un evenement</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {/* Emoji Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Emoji
            </label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, emoji }))}
                  className={cn(
                    "w-10 h-10 text-xl rounded-lg transition",
                    formData.emoji === emoji
                      ? "bg-blue-500/30 ring-2 ring-blue-500"
                      : "bg-gray-800 hover:bg-gray-700"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nom de l'evenement *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Marathon de revision Physique"
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Decris l'evenement..."
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Categorie
            </label>
            <select
              value={formData.category}
              onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Clock className="h-4 w-4 inline mr-1" />
                Debut *
              </label>
              <input
                type="datetime-local"
                value={formData.starts_at}
                onChange={e => setFormData(prev => ({ ...prev, starts_at: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Clock className="h-4 w-4 inline mr-1" />
                Fin *
              </label>
              <input
                type="datetime-local"
                value={formData.ends_at}
                onChange={e => setFormData(prev => ({ ...prev, ends_at: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Quick Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Duree rapide
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_DURATIONS.map(dur => (
                <button
                  key={dur.hours}
                  type="button"
                  onClick={() => handleQuickDuration(dur.hours)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition"
                >
                  {dur.label}
                </button>
              ))}
            </div>
          </div>

          {/* Max Participants */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Users className="h-4 w-4 inline mr-1" />
              Participants max
            </label>
            <input
              type="number"
              value={formData.max_participants}
              onChange={e => setFormData(prev => ({ ...prev, max_participants: parseInt(e.target.value) || 50 }))}
              min={10}
              max={500}
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Privacy */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700">
            <div className="flex items-center gap-3">
              {formData.is_private ? (
                <Lock className="h-5 w-5 text-yellow-400" />
              ) : (
                <Globe className="h-5 w-5 text-green-400" />
              )}
              <div>
                <p className="font-medium text-white">
                  {formData.is_private ? 'Evenement prive' : 'Evenement public'}
                </p>
                <p className="text-xs text-gray-400">
                  {formData.is_private ? 'Sur invitation uniquement' : 'Visible par tous'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, is_private: !prev.is_private }))}
              className={cn(
                "relative w-12 h-6 rounded-full transition",
                formData.is_private ? "bg-yellow-500" : "bg-gray-600"
              )}
            >
              <span
                className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                  formData.is_private ? "left-7" : "left-1"
                )}
              />
            </button>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Creer l'evenement
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
