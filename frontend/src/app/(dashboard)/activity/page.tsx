'use client'

import { useState, useEffect } from 'react'
import {
  Activity,
  BookOpen,
  Brain,
  CreditCard,
  Calendar,
  Clock,
  TrendingUp,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'
import { useTranslation } from '@/contexts/LanguageContext'

interface ActivityItem {
  type: 'note_created' | 'flashcard_reviewed' | 'quiz_completed'
  title: string
  timestamp: string
  details: {
    note_id?: number
    flashcard_id?: number
    attempt_id?: number
    score?: number
  }
}

interface ActivityResponse {
  activities: ActivityItem[]
  period_days: number
  total_activities: number
}

const activityConfig = {
  note_created: {
    icon: BookOpen,
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
    label: 'Note'
  },
  flashcard_reviewed: {
    icon: CreditCard,
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-600',
    borderColor: 'border-purple-200',
    label: 'Flashcard'
  },
  quiz_completed: {
    icon: Brain,
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-600',
    borderColor: 'border-green-200',
    label: 'Quiz'
  }
}

export default function ActivityPage() {
  const { t, locale } = useTranslation()
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(30) // Default 30 days
  const [filter, setFilter] = useState<string>('all')
  const [stats, setStats] = useState({
    total: 0,
    notes: 0,
    flashcards: 0,
    quizzes: 0
  })

  useEffect(() => {
    fetchActivities()
  }, [period])

  const fetchActivities = async () => {
    try {
      setLoading(true)
      const response = await api.get<ActivityResponse>(`/users/me/activity?days=${period}`)
      const data = response.data

      setActivities(data.activities || [])

      // Calculate stats
      const notes = data.activities.filter(a => a.type === 'note_created').length
      const flashcards = data.activities.filter(a => a.type === 'flashcard_reviewed').length
      const quizzes = data.activities.filter(a => a.type === 'quiz_completed').length

      setStats({
        total: data.total_activities,
        notes,
        flashcards,
        quizzes
      })
    } catch (error) {
      console.error('Error fetching activities:', error)
      toast.error(t('activity.loadError'))
    } finally {
      setLoading(false)
    }
  }

  const getLocaleString = () => {
    const localeMap: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' }
    return localeMap[locale] || 'fr-FR'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(getLocaleString(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString(getLocaleString(), {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffSecs < 30) return t('time.justNow')
    if (diffSecs < 60) return t('time.secondsAgo', { count: diffSecs })
    if (diffMins < 60) return t('time.minutesAgo', { count: diffMins })
    if (diffHours < 24) return t('time.hoursAgo', { count: diffHours })
    if (diffDays === 1) return t('time.yesterday')
    if (diffDays < 7) return t('time.daysAgo', { count: diffDays })
    return formatDate(dateString)
  }

  // Group activities by date
  const groupedActivities = activities.reduce((groups: Record<string, ActivityItem[]>, activity) => {
    const date = formatDate(activity.timestamp)
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(activity)
    return groups
  }, {})

  // Filter activities
  const filteredActivities = filter === 'all'
    ? activities
    : activities.filter(a => a.type === filter)

  const filteredGrouped = filteredActivities.reduce((groups: Record<string, ActivityItem[]>, activity) => {
    const date = formatDate(activity.timestamp)
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(activity)
    return groups
  }, {})

  const getActivityLink = (activity: ActivityItem) => {
    switch (activity.type) {
      case 'note_created':
        return activity.details.note_id ? `/notes/${activity.details.note_id}` : '/notes'
      case 'flashcard_reviewed':
        return '/flashcards'
      case 'quiz_completed':
        return '/quizzes'
      default:
        return '#'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('activity.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('activity.subtitle')}</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {t('activity.backToDashboard')}
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Activity className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('activity.total')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.notes}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('nav.notes')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <CreditCard className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.flashcards}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('nav.flashcards')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Brain className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.quizzes}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('nav.quizzes')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Period Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <select
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
              className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value={7}>{t('activity.last7Days')}</option>
              <option value={14}>{t('activity.last14Days')}</option>
              <option value={30}>{t('activity.last30Days')}</option>
              <option value={60}>{t('activity.last60Days')}</option>
              <option value={90}>{t('activity.last90Days')}</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">{t('activity.allActivities')}</option>
              <option value="note_created">{t('activity.notesOnly')}</option>
              <option value="flashcard_reviewed">{t('activity.flashcardsOnly')}</option>
              <option value="quiz_completed">{t('activity.quizzesOnly')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        {Object.keys(filteredGrouped).length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
            <p className="text-gray-500 dark:text-gray-400">{t('activity.noActivityForPeriod')}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {t('activity.startCreating')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {Object.entries(filteredGrouped).map(([date, dayActivities]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{date}</h3>
                </div>

                {/* Activities for this date */}
                <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {dayActivities.map((activity, index) => {
                    const config = activityConfig[activity.type]
                    const Icon = config.icon

                    return (
                      <Link
                        key={`${activity.type}-${index}-${activity.timestamp}`}
                        href={getActivityLink(activity)}
                        className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                      >
                        <div className={`p-3 rounded-lg ${config.bgColor} dark:bg-opacity-30`}>
                          <Icon className={`h-5 w-5 ${config.textColor}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {activity.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} dark:bg-opacity-30 ${config.textColor}`}>
                              {config.label}
                            </span>
                            {activity.type === 'quiz_completed' && activity.details.score !== undefined && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {t('activity.score')}: {activity.details.score.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-sm text-gray-500 dark:text-gray-400">{formatTime(activity.timestamp)}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{getRelativeTime(activity.timestamp)}</p>
                        </div>

                        <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {filteredActivities.length > 0 && (
        <div className="bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-primary-100 dark:border-primary-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <TrendingUp className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('activity.periodSummary')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('activity.periodSummaryText', { days: period, total: stats.total })}
                {stats.notes > 0 && ` - ${t('activity.notesCreated', { count: stats.notes })}`}
                {stats.flashcards > 0 && `, ${t('activity.flashcardsReviewed', { count: stats.flashcards })}`}
                {stats.quizzes > 0 && `, ${t('activity.quizzesCompleted', { count: stats.quizzes })}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
