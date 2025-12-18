'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit,
  MapPin,
  Bell,
  BellOff,
  Repeat,
  GripVertical,
  Sun,
  CloudOff,
  RefreshCw,
} from 'lucide-react'
import { ScheduleEvent } from '@/types/schedule'
import { schedulesService } from '@/services/schedules'
import EventDialog from '@/components/schedule/EventDialog'
import { toast } from 'react-hot-toast'
import { offlineStorage, STORES } from '@/lib/offlineStorage'
import { syncService } from '@/services/syncService'
import { useOfflineContext } from '@/components/providers/OfflineProvider'

type ViewMode = 'month' | 'week' | 'day'

export default function SchedulePage() {
  const { isOnline } = useOfflineContext()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [isFromCache, setIsFromCache] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [draggedEvent, setDraggedEvent] = useState<ScheduleEvent | null>(null)

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ]

  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  const dayNamesShort = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

  const eventTypeColors: Record<string, string> = {
    class: '#3b82f6',
    exam: '#ef4444',
    homework: '#f59e0b',
    deadline: '#f59e0b',
    revision: '#22c55e',
    study: '#22c55e',
    meeting: '#8b5cf6',
    other: '#6b7280',
  }

  const eventTypeLabels: Record<string, string> = {
    class: 'Cours',
    exam: 'Examen',
    homework: 'Devoir',
    deadline: 'Date limite',
    revision: 'Révision',
    study: 'Étude',
    meeting: 'Réunion',
    other: 'Autre',
  }

  // Heures pour la grille semaine/jour
  const hours = Array.from({ length: 16 }, (_, i) => i + 7) // 7h à 22h

  useEffect(() => {
    loadEvents()
    loadUpcomingEvents()
  }, [currentDate, viewMode])

  const loadEvents = async (forceRefresh = false) => {
    try {
      setLoading(true)

      let startDate: Date
      let endDate: Date

      if (viewMode === 'month') {
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59)
      } else if (viewMode === 'week') {
        const dayOfWeek = currentDate.getDay()
        startDate = new Date(currentDate)
        startDate.setDate(currentDate.getDate() - dayOfWeek)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 6)
        endDate.setHours(23, 59, 59, 999)
      } else {
        startDate = new Date(currentDate)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(currentDate)
        endDate.setHours(23, 59, 59, 999)
      }

      if (isOnline || forceRefresh) {
        try {
          const response = await schedulesService.getAll({
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            page_size: 100,
          })
          setEvents(response.events)
          setIsFromCache(false)
          // Sauvegarder en cache pour le mode offline
          await offlineStorage.saveSchedules(response.events)
        } catch (error: any) {
          // Si erreur réseau, essayer le cache
          const cachedEvents = await offlineStorage.getSchedules()
          if (cachedEvents && cachedEvents.length > 0) {
            // Filtrer par date localement
            const filtered = cachedEvents.filter((event: ScheduleEvent) => {
              const eventStart = new Date(event.start_time)
              return eventStart >= startDate && eventStart <= endDate
            })
            setEvents(filtered)
            setIsFromCache(true)
            toast('Données chargées depuis le cache', { icon: '📦' })
          } else {
            toast.error('Erreur lors du chargement des événements')
          }
        }
      } else {
        // Mode hors-ligne: charger depuis le cache
        const cachedEvents = await offlineStorage.getSchedules()
        if (cachedEvents && cachedEvents.length > 0) {
          // Filtrer par date localement
          const filtered = cachedEvents.filter((event: ScheduleEvent) => {
            const eventStart = new Date(event.start_time)
            return eventStart >= startDate && eventStart <= endDate
          })
          setEvents(filtered)
          setIsFromCache(true)
        } else {
          setEvents([])
          setIsFromCache(true)
        }
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement des événements')
    } finally {
      setLoading(false)
    }
  }

  const loadUpcomingEvents = async () => {
    try {
      const upcoming = await schedulesService.getUpcoming(5)
      setUpcomingEvents(upcoming)
    } catch (error: any) {
      console.error('Error loading upcoming events:', error)
    }
  }

  const handleDeleteEvent = async (eventId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) return

    // Mise à jour optimiste
    const eventToDelete = events.find(ev => ev.id === eventId)
    setEvents(events.filter(ev => ev.id !== eventId))
    setUpcomingEvents(upcomingEvents.filter(ev => ev.id !== eventId))

    try {
      if (isOnline) {
        await schedulesService.delete(eventId)
        toast.success('Événement supprimé')
      } else {
        // Queue pour sync offline
        await syncService.queueAction(
          STORES.SCHEDULES,
          'delete',
          `/api/v1/schedules/${eventId}`,
          'DELETE',
          { id: eventId }
        )
        toast.success('Événement supprimé (sera synchronisé)')
      }
    } catch (error: any) {
      // Rollback en cas d'erreur
      if (eventToDelete) {
        setEvents([...events, eventToDelete])
        setUpcomingEvents([...upcomingEvents, eventToDelete])
      }
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleEditEvent = (event: ScheduleEvent, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSelectedEvent(event)
    setIsDialogOpen(true)
  }

  const handleCreateEvent = (date?: Date, hour?: number) => {
    setSelectedEvent(null)
    if (date && hour !== undefined) {
      const newDate = new Date(date)
      newDate.setHours(hour, 0, 0, 0)
      setSelectedDate(newDate)
    } else {
      setSelectedDate(date)
    }
    setIsDialogOpen(true)
  }

  const handleDialogSuccess = () => {
    loadEvents()
    loadUpcomingEvents()
  }

  // Navigation
  const goToToday = () => setCurrentDate(new Date())

  const previousPeriod = () => {
    const newDate = new Date(currentDate)
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setDate(newDate.getDate() - 1)
    }
    setCurrentDate(newDate)
  }

  const nextPeriod = () => {
    const newDate = new Date(currentDate)
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1)
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7)
    } else {
      newDate.setDate(newDate.getDate() + 1)
    }
    setCurrentDate(newDate)
  }

  // Drag & Drop
  const handleDragStart = (event: ScheduleEvent, e: React.DragEvent) => {
    setDraggedEvent(event)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (date: Date, hour?: number, e?: React.DragEvent) => {
    if (e) e.preventDefault()
    if (!draggedEvent) return

    try {
      const oldStart = new Date(draggedEvent.start_time)
      const oldEnd = new Date(draggedEvent.end_time)
      const duration = oldEnd.getTime() - oldStart.getTime()

      const newStart = new Date(date)
      if (hour !== undefined) {
        newStart.setHours(hour, 0, 0, 0)
      } else {
        newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0)
      }
      const newEnd = new Date(newStart.getTime() + duration)

      await schedulesService.update(draggedEvent.id, {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
      })

      toast.success('Événement déplacé')
      loadEvents()
    } catch (error) {
      toast.error('Erreur lors du déplacement')
    } finally {
      setDraggedEvent(null)
    }
  }

  // Calculs pour le calendrier mois
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    return { daysInMonth, startingDayOfWeek }
  }

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return events.filter((event) => event.start_time.startsWith(dateStr))
  }

  const getEventsForHour = (date: Date, hour: number) => {
    return events.filter((event) => {
      const eventStart = new Date(event.start_time)
      const eventEnd = new Date(event.end_time)
      const slotStart = new Date(date)
      slotStart.setHours(hour, 0, 0, 0)
      const slotEnd = new Date(date)
      slotEnd.setHours(hour + 1, 0, 0, 0)

      return eventStart < slotEnd && eventEnd > slotStart &&
             eventStart.toDateString() === date.toDateString()
    })
  }

  // Semaine courante
  const getWeekDays = () => {
    const dayOfWeek = currentDate.getDay()
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - dayOfWeek)

    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      return day
    })
  }

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate)
  const today = new Date()

  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString()
  }

  const getTitle = () => {
    if (viewMode === 'month') {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    } else if (viewMode === 'week') {
      const weekDays = getWeekDays()
      const start = weekDays[0]
      const end = weekDays[6]
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} - ${end.getDate()} ${monthNames[start.getMonth()]} ${start.getFullYear()}`
      }
      return `${start.getDate()} ${monthNames[start.getMonth()]} - ${end.getDate()} ${monthNames[end.getMonth()]} ${start.getFullYear()}`
    }
    return `${dayNames[currentDate.getDay()]} ${currentDate.getDate()} ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
  }

  // Render Event Card (réutilisable)
  const renderEventCard = (event: ScheduleEvent, compact = false) => (
    <div
      key={event.id}
      draggable
      onDragStart={(e) => handleDragStart(event, e)}
      onClick={(e) => handleEditEvent(event, e)}
      className={`group relative rounded cursor-pointer hover:opacity-90 transition ${
        compact ? 'text-xs p-1' : 'text-sm p-2'
      }`}
      style={{
        backgroundColor: `${event.color || eventTypeColors[event.event_type]}20`,
        borderLeft: `3px solid ${event.color || eventTypeColors[event.event_type]}`,
      }}
    >
      <div className="flex items-center gap-1">
        <GripVertical className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} text-gray-400 opacity-0 group-hover:opacity-100 cursor-grab`} />
        <span className="font-medium truncate" style={{ color: event.color || eventTypeColors[event.event_type] }}>
          {!compact && (
            <span className="mr-1">
              {new Date(event.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {event.title}
        </span>
      </div>
      {event.is_recurring && (
        <Repeat className={`absolute top-1 right-1 ${compact ? 'h-3 w-3' : 'h-4 w-4'} text-gray-400`} />
      )}
      {!compact && (
        <div className="absolute top-0 right-0 hidden group-hover:flex items-center space-x-1 bg-white rounded shadow-lg p-1 z-10">
          <button onClick={(e) => handleEditEvent(event, e)} className="p-1 hover:bg-gray-100 rounded">
            <Edit className="h-3 w-3 text-blue-600" />
          </button>
          <button onClick={(e) => handleDeleteEvent(event.id, e)} className="p-1 hover:bg-gray-100 rounded">
            <Trash2 className="h-3 w-3 text-red-600" />
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Emploi du Temps</h1>
            {isFromCache && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                <CloudOff className="w-3 h-3 mr-1" />
                Cache
              </span>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Planifiez et suivez vos événements d'étude
            {isFromCache && !isOnline && ' • Mode hors-ligne'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFromCache && isOnline && (
            <button
              onClick={() => loadEvents(true)}
              className="inline-flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              title="Actualiser les données"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => handleCreateEvent()}
            className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
          >
            <Plus className="h-5 w-5 mr-2" />
            Ajouter un événement
          </button>
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={goToToday}
              className="px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition font-medium"
            >
              Aujourd'hui
            </button>
            <button onClick={previousPeriod} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <ChevronLeft className="h-5 w-5 text-gray-700" />
            </button>
            <button onClick={nextPeriod} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <ChevronRight className="h-5 w-5 text-gray-700" />
            </button>
            <h2 className="text-xl font-bold text-gray-900 ml-2">{getTitle()}</h2>
          </div>

          <div className="flex items-center space-x-2">
            {(['month', 'week', 'day'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  viewMode === mode
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {mode === 'month' ? 'Mois' : mode === 'week' ? 'Semaine' : 'Jour'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Chargement...</div>
          ) : viewMode === 'month' ? (
            /* VUE MOIS */
            <>
              <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                {dayNamesShort.map((day) => (
                  <div key={day} className="p-4 text-center font-semibold text-gray-700 text-sm">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {[...Array(startingDayOfWeek)].map((_, index) => (
                  <div key={`empty-${index}`} className="min-h-[100px] p-2 border-r border-b border-gray-200 bg-gray-50" />
                ))}
                {[...Array(daysInMonth)].map((_, index) => {
                  const day = index + 1
                  const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
                  const dayEvents = getEventsForDate(date)

                  return (
                    <div
                      key={day}
                      onClick={() => handleCreateEvent(date)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(date, undefined, e)}
                      className={`min-h-[100px] p-2 border-r border-b border-gray-200 hover:bg-gray-50 transition cursor-pointer ${
                        isToday(date) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div
                        className={`text-sm font-semibold mb-2 ${
                          isToday(date)
                            ? 'inline-flex items-center justify-center w-7 h-7 bg-primary-600 text-white rounded-full'
                            : 'text-gray-700'
                        }`}
                      >
                        {day}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 2).map((event) => renderEventCard(event, true))}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-gray-500 font-medium">+{dayEvents.length - 2} plus</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : viewMode === 'week' ? (
            /* VUE SEMAINE */
            <>
              {/* Header jours */}
              <div className="grid grid-cols-8 border-b border-gray-200">
                <div className="p-2 text-center text-xs font-medium text-gray-500 border-r border-gray-200 bg-gray-50">
                  Heure
                </div>
                {getWeekDays().map((date, i) => (
                  <div
                    key={i}
                    className={`p-2 text-center border-r border-gray-200 ${
                      isToday(date) ? 'bg-primary-50' : 'bg-gray-50'
                    }`}
                  >
                    <div className="text-xs text-gray-500">{dayNamesShort[date.getDay()]}</div>
                    <div
                      className={`text-lg font-bold ${
                        isToday(date)
                          ? 'inline-flex items-center justify-center w-8 h-8 bg-primary-600 text-white rounded-full'
                          : 'text-gray-900'
                      }`}
                    >
                      {date.getDate()}
                    </div>
                  </div>
                ))}
              </div>
              {/* Grille horaire */}
              <div className="max-h-[600px] overflow-y-auto">
                {hours.map((hour) => (
                  <div key={hour} className="grid grid-cols-8 border-b border-gray-100">
                    <div className="p-2 text-right text-xs text-gray-400 border-r border-gray-200 bg-gray-50">
                      {hour}:00
                    </div>
                    {getWeekDays().map((date, i) => {
                      const hourEvents = getEventsForHour(date, hour)
                      return (
                        <div
                          key={i}
                          onClick={() => handleCreateEvent(date, hour)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(date, hour, e)}
                          className={`min-h-[50px] p-1 border-r border-gray-100 hover:bg-gray-50 cursor-pointer ${
                            isToday(date) ? 'bg-primary-50/30' : ''
                          }`}
                        >
                          {hourEvents.map((event) => renderEventCard(event, true))}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* VUE JOUR */
            <>
              <div className="p-4 bg-gray-50 border-b border-gray-200 text-center">
                <div className="text-sm text-gray-500">{dayNames[currentDate.getDay()]}</div>
                <div
                  className={`text-3xl font-bold ${
                    isToday(currentDate)
                      ? 'inline-flex items-center justify-center w-12 h-12 bg-primary-600 text-white rounded-full'
                      : 'text-gray-900'
                  }`}
                >
                  {currentDate.getDate()}
                </div>
                <div className="text-sm text-gray-500">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </div>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {hours.map((hour) => {
                  const hourEvents = getEventsForHour(currentDate, hour)
                  return (
                    <div key={hour} className="flex border-b border-gray-100">
                      <div className="w-20 p-3 text-right text-sm text-gray-400 border-r border-gray-200 bg-gray-50 flex-shrink-0">
                        {hour}:00
                      </div>
                      <div
                        onClick={() => handleCreateEvent(currentDate, hour)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(currentDate, hour, e)}
                        className="flex-1 min-h-[60px] p-2 hover:bg-gray-50 cursor-pointer"
                      >
                        {hourEvents.map((event) => renderEventCard(event))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Événements à venir */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2" />
              Événements à venir
            </h3>
            <div className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun événement à venir</p>
              ) : (
                upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg border-l-4 bg-gray-50 hover:bg-gray-100 transition cursor-pointer"
                    style={{ borderLeftColor: event.color || eventTypeColors[event.event_type] }}
                    onClick={() => handleEditEvent(event)}
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold text-gray-900 text-sm mb-1">{event.title}</h4>
                      <div className="flex items-center gap-1">
                        {event.is_recurring && <Repeat className="h-3 w-3 text-gray-400" />}
                        {event.reminder_enabled ? (
                          <Bell className="h-3 w-3 text-green-500" />
                        ) : (
                          <BellOff className="h-3 w-3 text-gray-300" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center text-xs text-gray-600 space-x-2">
                      <span>
                        {new Date(event.start_time).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                      <span>•</span>
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(event.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {event.location && (
                      <div className="mt-1 text-xs text-gray-500 flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        {event.location}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Légende */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4">Légende</h3>
            <div className="space-y-2">
              {Object.entries(eventTypeLabels).map(([type, label]) => (
                <div key={type} className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: eventTypeColors[type] }}></div>
                  <span className="text-sm text-gray-700">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Info Drag & Drop */}
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
            <h4 className="font-semibold text-blue-900 text-sm mb-2 flex items-center">
              <GripVertical className="h-4 w-4 mr-1" />
              Astuce
            </h4>
            <p className="text-xs text-blue-700">
              Glissez-déposez les événements pour les déplacer rapidement vers une autre date ou heure.
            </p>
          </div>
        </div>
      </div>

      {/* Event Dialog */}
      <EventDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false)
          setSelectedEvent(null)
          setSelectedDate(undefined)
        }}
        onSuccess={handleDialogSuccess}
        event={selectedEvent}
        initialDate={selectedDate}
      />
    </div>
  )
}
