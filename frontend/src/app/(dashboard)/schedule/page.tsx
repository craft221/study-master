'use client'

import { useState, useEffect } from 'react'
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit,
  MapPin,
} from 'lucide-react'
import { ScheduleEvent } from '@/types/schedule'
import { schedulesService } from '@/services/schedules'
import EventDialog from '@/components/schedule/EventDialog'
import { toast } from 'react-hot-toast'

export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()

  const monthNames = [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ]

  const eventTypeColors: Record<string, string> = {
    class: '#3b82f6',
    exam: '#ef4444',
    homework: '#f59e0b',
    revision: '#22c55e',
    other: '#8b5cf6',
  }

  const eventTypeLabels: Record<string, string> = {
    class: 'Cours',
    exam: 'Examen',
    homework: 'Devoir',
    revision: 'Révision',
    other: 'Autre',
  }

  useEffect(() => {
    loadEvents()
    loadUpcomingEvents()
  }, [currentDate])

  const loadEvents = async () => {
    try {
      setLoading(true)
      const startDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      )
      const endDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
        23,
        59,
        59
      )

      const response = await schedulesService.getAll({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        page_size: 100,
      })
      setEvents(response.events)
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

    try {
      await schedulesService.delete(eventId)
      toast.success('Événement supprimé')
      loadEvents()
      loadUpcomingEvents()
    } catch (error: any) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleEditEvent = (event: ScheduleEvent, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedEvent(event)
    setIsDialogOpen(true)
  }

  const handleCreateEvent = (date?: Date) => {
    setSelectedEvent(null)
    setSelectedDate(date)
    setIsDialogOpen(true)
  }

  const handleDialogSuccess = () => {
    loadEvents()
    loadUpcomingEvents()
  }

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
    return events.filter((event) =>
      event.start_time.startsWith(dateStr)
    )
  }

  const previousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
    )
  }

  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
    )
  }

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate)
  const today = new Date()
  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Emploi du Temps
          </h1>
          <p className="text-gray-600 mt-1">
            Planifiez et suivez vos événements d'étude
          </p>
        </div>
        <button
          onClick={() => handleCreateEvent()}
          className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
        >
          <Plus className="h-5 w-5 mr-2" />
          Ajouter un événement
        </button>
      </div>

      {/* Calendar Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronLeft className="h-5 w-5 text-gray-700" />
            </button>
            <h2 className="text-xl font-bold text-gray-900">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronRight className="h-5 w-5 text-gray-700" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                viewMode === 'month'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Mois
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                viewMode === 'week'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Semaine
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Chargement...
            </div>
          ) : (
            <>
              {/* Day Headers */}
              <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(
                  (day) => (
                    <div
                      key={day}
                      className="p-4 text-center font-semibold text-gray-700 text-sm"
                    >
                      {day}
                    </div>
                  )
                )}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7">
                {/* Empty cells for days before month starts */}
                {[...Array(startingDayOfWeek)].map((_, index) => (
                  <div
                    key={`empty-${index}`}
                    className="min-h-[100px] p-2 border-r border-b border-gray-200 bg-gray-50"
                  />
                ))}

                {/* Days of the month */}
                {[...Array(daysInMonth)].map((_, index) => {
                  const day = index + 1
                  const date = new Date(
                    currentDate.getFullYear(),
                    currentDate.getMonth(),
                    day
                  )
                  const dayEvents = getEventsForDate(date)

                  return (
                    <div
                      key={day}
                      onClick={() => handleCreateEvent(date)}
                      className={`min-h-[100px] p-2 border-r border-b border-gray-200 hover:bg-gray-50 transition cursor-pointer ${
                        isToday(day) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div
                        className={`text-sm font-semibold mb-2 ${
                          isToday(day)
                            ? 'inline-flex items-center justify-center w-7 h-7 bg-primary-600 text-white rounded-full'
                            : 'text-gray-700'
                        }`}
                      >
                        {day}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            onClick={(e) => e.stopPropagation()}
                            className="group relative text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 transition"
                            style={{
                              backgroundColor: `${event.color}20`,
                              color: event.color,
                            }}
                            title={event.title}
                          >
                            <span className="font-medium">
                              {new Date(event.start_time).toLocaleTimeString(
                                'fr-FR',
                                {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }
                              )}
                            </span>{' '}
                            {event.title}
                            <div className="absolute top-0 right-0 hidden group-hover:flex items-center space-x-1 bg-white rounded shadow-lg p-1">
                              <button
                                onClick={(e) => handleEditEvent(event, e)}
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                <Edit className="h-3 w-3 text-blue-600" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteEvent(event.id, e)}
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                <Trash2 className="h-3 w-3 text-red-600" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-gray-500 font-medium">
                            +{dayEvents.length - 2} plus
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Upcoming Events Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2" />
              Événements à venir
            </h3>
            <div className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Aucun événement à venir
                </p>
              ) : (
                upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg border-l-4 bg-gray-50 hover:bg-gray-100 transition cursor-pointer"
                    style={{ borderLeftColor: event.color }}
                    onClick={() => handleEditEvent(event, {} as any)}
                  >
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">
                      {event.title}
                    </h4>
                    <div className="flex items-center text-xs text-gray-600 space-x-2">
                      <span>
                        {new Date(event.start_time).toLocaleDateString(
                          'fr-FR',
                          {
                            day: 'numeric',
                            month: 'short',
                          }
                        )}
                      </span>
                      <span>•</span>
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(event.start_time).toLocaleTimeString(
                          'fr-FR',
                          {
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        )}
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

          {/* Legend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4">Légende</h3>
            <div className="space-y-2">
              {Object.entries(eventTypeLabels).map(([type, label]) => (
                <div key={type} className="flex items-center space-x-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: eventTypeColors[type] }}
                  ></div>
                  <span className="text-sm text-gray-700">{label}</span>
                </div>
              ))}
            </div>
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
