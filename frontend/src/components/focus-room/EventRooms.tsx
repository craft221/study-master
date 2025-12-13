'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Clock, Users, Play, Plus, Timer, Sparkles, ChevronRight, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { format, formatDistanceToNow, isBefore, isAfter } from 'date-fns'
import { fr } from 'date-fns/locale'

interface EventRoom {
  id: number
  name: string
  description?: string
  emoji: string
  room_type: string
  category: string
  is_private: boolean
  creator_username?: string
  creator_avatar?: string
  active_participants: number
  max_participants: number
  starts_at: string
  ends_at: string
  created_at: string
}

interface EventRoomsProps {
  onJoinRoom?: (roomId: number) => void
  onCreateEvent?: () => void
  className?: string
}

export default function EventRooms({ onJoinRoom, onCreateEvent, className }: EventRoomsProps) {
  const { toast } = useToast()
  const [activeEvents, setActiveEvents] = useState<EventRoom[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<EventRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [countdowns, setCountdowns] = useState<Record<number, { status: string; remaining: number }>>({})

  const fetchEvents = useCallback(async () => {
    try {
      const [activeRes, upcomingRes] = await Promise.all([
        api.get('/focus-rooms/events/active'),
        api.get('/focus-rooms/events/upcoming')
      ])
      setActiveEvents(activeRes.data)
      setUpcomingEvents(upcomingRes.data)
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
    // Refresh every minute
    const interval = setInterval(fetchEvents, 60000)
    return () => clearInterval(interval)
  }, [fetchEvents])

  // Update countdowns every second
  useEffect(() => {
    const updateCountdowns = () => {
      const now = new Date()
      const newCountdowns: Record<number, { status: string; remaining: number }> = {}

      ;[...activeEvents, ...upcomingEvents].forEach(event => {
        const startsAt = new Date(event.starts_at)
        const endsAt = new Date(event.ends_at)

        if (isBefore(now, startsAt)) {
          // Event hasn't started
          const remaining = Math.floor((startsAt.getTime() - now.getTime()) / 1000)
          newCountdowns[event.id] = { status: 'upcoming', remaining }
        } else if (isBefore(now, endsAt)) {
          // Event is active
          const remaining = Math.floor((endsAt.getTime() - now.getTime()) / 1000)
          newCountdowns[event.id] = { status: 'active', remaining }
        } else {
          // Event ended
          newCountdowns[event.id] = { status: 'ended', remaining: 0 }
        }
      })

      setCountdowns(newCountdowns)
    }

    updateCountdowns()
    const interval = setInterval(updateCountdowns, 1000)
    return () => clearInterval(interval)
  }, [activeEvents, upcomingEvents])

  const formatCountdown = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}j ${hours % 24}h`
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`
    }
    return `${secs}s`
  }

  const handleJoinEvent = async (eventId: number) => {
    try {
      await api.post(`/focus-rooms/${eventId}/join`)
      toast({ title: 'Tu as rejoint l\'evenement!' })
      onJoinRoom?.(eventId)
    } catch (error: any) {
      toast({ title: error.response?.data?.detail || 'Erreur lors de la connexion', variant: 'destructive' })
    }
  }

  const EventCard = ({ event, isActive }: { event: EventRoom; isActive: boolean }) => {
    const countdown = countdowns[event.id]

    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border p-4 transition-all hover:shadow-lg",
          isActive
            ? "bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-500/30"
            : "bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border-blue-500/30"
        )}
      >
        {/* Live badge for active events */}
        {isActive && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/20 border border-green-500/30">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-300">En cours</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="text-3xl">{event.emoji}</div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-white truncate">{event.name}</h4>
            {event.description && (
              <p className="text-sm text-gray-400 line-clamp-1">{event.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">par {event.creator_username}</span>
            </div>
          </div>
        </div>

        {/* Time Info */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-gray-300">
              {format(new Date(event.starts_at), 'dd MMM', { locale: fr })}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-gray-300">
              {format(new Date(event.starts_at), 'HH:mm')} - {format(new Date(event.ends_at), 'HH:mm')}
            </span>
          </div>
        </div>

        {/* Countdown */}
        {countdown && (
          <div className={cn(
            "flex items-center justify-center gap-2 py-2 px-3 rounded-lg mb-4",
            isActive ? "bg-green-500/10" : "bg-blue-500/10"
          )}>
            <Timer className={cn("h-4 w-4", isActive ? "text-green-400" : "text-blue-400")} />
            <span className={cn("font-mono font-medium", isActive ? "text-green-300" : "text-blue-300")}>
              {countdown.status === 'upcoming' && `Commence dans ${formatCountdown(countdown.remaining)}`}
              {countdown.status === 'active' && `Termine dans ${formatCountdown(countdown.remaining)}`}
              {countdown.status === 'ended' && 'Termine'}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm text-gray-400">
            <Users className="h-4 w-4" />
            <span>{event.active_participants}/{event.max_participants}</span>
          </div>

          <button
            onClick={() => handleJoinEvent(event.id)}
            disabled={countdown?.status === 'ended'}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition",
              isActive
                ? "bg-green-600 hover:bg-green-500 text-white"
                : countdown?.status === 'ended'
                  ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
            )}
          >
            {isActive ? (
              <>
                <Play className="h-4 w-4" />
                Rejoindre
              </>
            ) : countdown?.status === 'ended' ? (
              'Termine'
            ) : (
              <>
                <ChevronRight className="h-4 w-4" />
                Voir
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  const hasEvents = activeEvents.length > 0 || upcomingEvents.length > 0

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/20">
            <Calendar className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Evenements</h3>
            <p className="text-sm text-gray-400">Sessions d'etude temporaires</p>
          </div>
        </div>

        <button
          onClick={onCreateEvent}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition"
        >
          <Plus className="h-4 w-4" />
          Creer un evenement
        </button>
      </div>

      {!hasEvents ? (
        <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-gray-700">
          <Calendar className="h-12 w-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">Aucun evenement prevu</p>
          <p className="text-sm text-gray-500 mb-4">
            Cree un evenement pour etudier avec d'autres personnes!
          </p>
          <button
            onClick={onCreateEvent}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition"
          >
            <Plus className="h-4 w-4" />
            Creer le premier evenement
          </button>
        </div>
      ) : (
        <>
          {/* Active Events */}
          {activeEvents.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <h4 className="font-medium text-green-300">En cours maintenant</h4>
                <span className="text-sm text-gray-500">({activeEvents.length})</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {activeEvents.map(event => (
                  <EventCard key={event.id} event={event} isActive={true} />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-blue-400" />
                <h4 className="font-medium text-blue-300">A venir</h4>
                <span className="text-sm text-gray-500">({upcomingEvents.length})</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingEvents.map(event => (
                  <EventCard key={event.id} event={event} isActive={false} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Tips */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-800/30 border border-gray-700">
        <Sparkles className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-gray-300">
            <strong>Astuce:</strong> Les evenements sont parfaits pour organiser des sessions d'etude en groupe
            avant les examens ou pour des marathons de revision!
          </p>
        </div>
      </div>
    </div>
  )
}
