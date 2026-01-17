'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  BookOpen,
  CreditCard,
  Brain,
  Trophy,
  Clock,
  Target,
  Zap,
  Calendar,
  ArrowRight,
  Flame,
  Sparkles,
  Info
} from 'lucide-react'
import HelpTooltip, { WithTooltip } from '@/components/ui/HelpTooltip'
import {
  pageVariants,
  containerVariants,
  itemVariants,
  cardVariants,
  buttonVariants,
  fadeInUpVariants,
} from '@/lib/animations'
import { useTranslation } from '@/contexts/LanguageContext'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Types stricts pour les données
interface Activity {
  id: number | string
  type: 'note' | 'quiz' | 'flashcard' | 'study_session' | string
  title: string
  time: string
  subject?: string
  timestamp?: string
  action?: string
}

interface Event {
  id: number | string
  title: string
  date: string
  time?: string
  type?: string
  color?: string
}

interface DashboardStats {
  total_xp: number
  level: number
  xp_progress: number
  xp_needed: number
  current_streak: number
  longest_streak: number
  total_notes: number
  total_flashcards: number
  total_quizzes_completed: number
  total_study_time_minutes: number
  study_time_this_month: number
  flashcards_due_today: number
  next_exam_days: number
}

export default function DashboardPage() {
  const { t, locale } = useTranslation()
  const [stats, setStats] = useState<DashboardStats>({
    total_xp: 0,
    level: 1,
    xp_progress: 0,
    xp_needed: 100,
    current_streak: 0,
    longest_streak: 0,
    total_notes: 0,
    total_flashcards: 0,
    total_quizzes_completed: 0,
    total_study_time_minutes: 0,
    study_time_this_month: 0,
    flashcards_due_today: 0,
    next_exam_days: 0,
  })
  const [loading, setLoading] = useState(true)
  const [recentActivity, setRecentActivity] = useState<Activity[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])

  // Charger les données au montage
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('access_token')
        if (!token) return

        // Fetch stats
        const statsResponse = await fetch(`${API_BASE_URL}/api/v1/users/me/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (statsResponse.ok) {
          const data = await statsResponse.json()
          setStats({
            total_xp: data.total_xp || 0,
            level: data.level || 1,
            xp_progress: data.xp_progress || 0,
            xp_needed: data.xp_needed_for_next_level || 100,
            current_streak: data.current_streak || 0,
            longest_streak: data.longest_streak || 0,
            total_notes: data.total_notes || 0,
            total_flashcards: data.total_flashcards || 0,
            total_quizzes_completed: data.completed_quiz_attempts || 0,
            total_study_time_minutes: data.total_study_time_minutes || 0,
            study_time_this_month: data.study_time_this_month || 0,
            flashcards_due_today: data.flashcards_due_today || 0,
            next_exam_days: 5,
          })
        }

        // Fetch recent activity
        const activityResponse = await fetch(`${API_BASE_URL}/api/v1/users/me/activity?days=7`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (activityResponse.ok) {
          const activityData = await activityResponse.json()
          interface RawActivity {
            timestamp: string
            title: string
            type: string
            subject_name?: string
          }
          const formattedActivities = activityData.activities.slice(0, 5).map((activity: RawActivity, index: number) => {
            const timestamp = new Date(activity.timestamp)
            const now = new Date()
            const diffMs = now.getTime() - timestamp.getTime()
            const diffMinutes = Math.floor(diffMs / (1000 * 60))
            const diffHours = Math.floor(diffMinutes / 60)
            const diffDays = Math.floor(diffHours / 24)

            let timeAgo = ''
            if (diffDays > 0) {
              timeAgo = diffDays === 1 ? t('time.yesterday') : t('time.daysAgo', { count: diffDays })
            } else if (diffHours > 0) {
              timeAgo = t('time.hoursAgo', { count: diffHours })
            } else if (diffMinutes > 0) {
              timeAgo = t('time.minutesAgo', { count: diffMinutes })
            } else {
              timeAgo = t('time.justNow')
            }

            let type = 'note'
            let actionText = activity.title

            if (activity.type === 'note_created') {
              type = 'note'
            } else if (activity.type === 'quiz_completed') {
              type = 'quiz'
            } else if (activity.type === 'flashcard_reviewed') {
              type = 'flashcard'
            }

            return {
              id: index + 1,
              type,
              title: actionText,
              action: '',
              time: timeAgo,
              subject: 'Général'
            }
          })
          setRecentActivity(formattedActivities)
        }

        // Fetch upcoming events
        const eventsResponse = await fetch(`${API_BASE_URL}/api/v1/schedules/upcoming?limit=5`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json()
          const formattedEvents = eventsData.map((event: any) => {
            let color = 'blue'
            if (event.event_type === 'exam') color = 'red'
            else if (event.event_type === 'study_session') color = 'green'
            else if (event.event_type === 'group_study') color = 'purple'

            return {
              id: event.id,
              title: event.title,
              date: event.start_time.split('T')[0],
              type: event.event_type,
              color
            }
          })
          setUpcomingEvents(formattedEvents)
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des données:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [t, locale])

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Skeleton pour Welcome Section */}
        <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl h-64"></div>

        {/* Skeleton pour Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-xl h-40"></div>
          ))}
        </div>

        {/* Skeleton pour Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-gray-200 dark:bg-gray-700 rounded-xl h-96"></div>
          <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-96"></div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-4 sm:space-y-6"
      initial="initial"
      animate="animate"
      variants={pageVariants}
    >
      {/* Welcome Section */}
      <motion.div
        className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 text-white"
        variants={fadeInUpVariants}
      >
        <motion.h1
          className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          {t('dashboard.welcomeBack')}! 👋
        </motion.h1>
        <motion.p
          className="text-primary-100 text-sm sm:text-base mb-4 sm:mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {t('dashboard.flashcardsDue')}: {stats.flashcards_due_today}
        </motion.p>
        <motion.div
          className="flex flex-col sm:flex-row gap-2 sm:gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <motion.div whileHover="hover" whileTap="tap" variants={buttonVariants}>
            <Link
              href="/flashcards"
              className="bg-white text-primary-600 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:bg-gray-100 transition font-semibold flex items-center justify-center space-x-2 text-sm sm:text-base"
            >
              <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{t('flashcards.study')}</span>
            </Link>
          </motion.div>
          <motion.div whileHover="hover" whileTap="tap" variants={buttonVariants}>
            <Link
              href="/notes/new"
              className="border-2 border-white text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:bg-white hover:text-primary-600 transition font-semibold flex items-center justify-center space-x-2 text-sm sm:text-base"
            >
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{t('notes.addNote')}</span>
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4"
        variants={containerVariants}
      >
        {/* XP Card */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 sm:p-4 lg:p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="p-2 sm:p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 font-semibold">
                {stats.xp_progress}/{stats.xp_needed}
              </span>
              <HelpTooltip content={t('tooltips.dashboard.xp')} size="sm" />
            </div>
          </div>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">{stats.total_xp.toLocaleString()}</h3>
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{t('dashboard.xpEarned')}</p>
          <div className="mt-2 sm:mt-3">
            <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Niv. {stats.level}</span>
              <span>Niv. {stats.level + 1}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 sm:h-2">
              <div
                className="bg-blue-600 h-1.5 sm:h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((stats.xp_progress / stats.xp_needed) * 100, 100)}%` }}
              />
            </div>
          </div>
        </motion.div>

        {/* Streak Card */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 sm:p-4 lg:p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="p-2 sm:p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Flame className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] sm:text-xs text-orange-600 dark:text-orange-400 font-semibold">Max: {stats.longest_streak}</span>
              <HelpTooltip content={t('tooltips.dashboard.streak')} size="sm" />
            </div>
          </div>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">{stats.current_streak} <span className="text-sm font-normal">{t('dashboard.days')}</span></h3>
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{t('dashboard.studyStreak')}</p>
          <div className="mt-2 sm:mt-3 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
            <span>🔥 Continue!</span>
          </div>
        </motion.div>

        {/* Study Time Card */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 sm:p-4 lg:p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="p-2 sm:p-2.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex items-center gap-1">
              {stats.study_time_this_month > 0 && (
                <span className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 font-semibold">
                  +{stats.study_time_this_month >= 60
                    ? `${Math.floor(stats.study_time_this_month / 60)}h`
                    : `${stats.study_time_this_month}m`
                  }
                </span>
              )}
              <HelpTooltip content={t('tooltips.dashboard.studyTime')} size="sm" />
            </div>
          </div>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
            {stats.total_study_time_minutes >= 60
              ? `${Math.floor(stats.total_study_time_minutes / 60)}h`
              : `${stats.total_study_time_minutes}m`
            }
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm truncate">{t('dashboard.totalStudyTime')}</p>
          <div className="mt-2 sm:mt-3 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
            <span>{stats.study_time_this_month > 0 ? `Ce mois` : t('dashboard.noActivity')}</span>
          </div>
        </motion.div>

        {/* Flashcards Card */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 sm:p-4 lg:p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="p-2 sm:p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] sm:text-xs text-purple-600 dark:text-purple-400 font-semibold">{stats.flashcards_due_today} à revoir</span>
              <HelpTooltip content={t('tooltips.dashboard.flashcardsDue')} size="sm" />
            </div>
          </div>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">{stats.total_flashcards}</h3>
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{t('nav.flashcards')}</p>
          <Link href="/flashcards" className="mt-2 sm:mt-3 flex items-center text-[10px] sm:text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400">
            <span>{t('flashcards.study')}</span>
            <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </motion.div>
      </motion.div>

      {/* Main Content Grid */}
      <motion.div
        className="grid lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6"
        variants={containerVariants}
      >
        {/* Recent Activity */}
        <motion.div
          className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
          variants={cardVariants}
        >
          <div className="p-3 sm:p-4 lg:p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 dark:text-white">{t('dashboard.recentActivity')}</h2>
          </div>
          <motion.div
            className="divide-y divide-gray-200 dark:divide-gray-700"
            variants={containerVariants}
          >
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  className="p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                  variants={itemVariants}
                  custom={index}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${
                      activity.type === 'note' ? 'bg-blue-100 dark:bg-blue-900/30' :
                      activity.type === 'quiz' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-purple-100 dark:bg-purple-900/30'
                    }`}>
                      {activity.type === 'note' && <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                      {activity.type === 'quiz' && <Brain className="h-4 w-4 text-green-600 dark:text-green-400" />}
                      {activity.type === 'flashcard' && <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">{activity.title}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{activity.time}</span>
                        {activity.subject && (
                          <>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">•</span>
                            <span className="text-[10px] sm:text-xs text-primary-600 dark:text-primary-400 truncate">{activity.subject}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="p-6 sm:p-8 text-center text-gray-500 dark:text-gray-400">
                <BookOpen className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-xs sm:text-sm font-medium mb-1">{t('dashboard.noActivity')}</p>
                <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">{t('tooltips.emptyStates.activity')}</p>
              </div>
            )}
          </motion.div>
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <Link href="/activity" className="text-xs sm:text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium flex items-center justify-center">
              <span>{t('common.all')}</span>
              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
            </Link>
          </div>
        </motion.div>

        {/* Upcoming Events */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
          variants={cardVariants}
        >
          <div className="p-3 sm:p-4 lg:p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 dark:text-white">{t('dashboard.upcomingExams')}</h2>
          </div>
          <div className="p-3 sm:p-4 space-y-3">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-start space-x-2 sm:space-x-3">
                  <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 bg-${event.color}-100 dark:bg-${event.color}-900/30`}>
                    <Calendar className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-${event.color}-600 dark:text-${event.color}-400`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">{event.title}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {new Date(event.date).toLocaleDateString(
                        locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : 'en-US',
                        { day: 'numeric', month: 'short' }
                      )}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 sm:py-8 text-center text-gray-500 dark:text-gray-400">
                <Calendar className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-xs sm:text-sm font-medium mb-1">{t('calendar.noEvents')}</p>
                <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">{t('tooltips.emptyStates.events')}</p>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <Link href="/schedule" className="text-xs sm:text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium flex items-center justify-center">
              <span>{t('nav.calendar')}</span>
              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
            </Link>
          </div>
        </motion.div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4"
        variants={containerVariants}
      >
        <motion.div
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <Link
            href="/flashcards/new"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 lg:p-5 hover:shadow-md transition group block h-full"
          >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="p-2 sm:p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition">
              <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 transition" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm mb-1">{t('flashcards.addDeck')}</h3>
          <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{t('tooltips.dashboard.addDeck')}</p>
          </Link>
        </motion.div>

        <motion.div
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <Link
            href="/quizzes/new"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 lg:p-5 hover:shadow-md transition group block h-full"
          >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="p-2 sm:p-2.5 bg-green-100 dark:bg-green-900/30 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition">
              <Brain className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 transition" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm mb-1">{t('quiz.addQuiz')}</h3>
          <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{t('tooltips.dashboard.addQuiz')}</p>
          </Link>
        </motion.div>

        <motion.div
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <Link
            href="/ai"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 lg:p-5 hover:shadow-md transition group block h-full"
          >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="p-2 sm:p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 transition" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm mb-1">{t('nav.spark')}</h3>
          <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{t('tooltips.dashboard.spark')}</p>
          </Link>
        </motion.div>

        <motion.div
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <Link
            href="/sessions"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 lg:p-5 hover:shadow-md transition group block h-full"
          >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="p-2 sm:p-2.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg group-hover:bg-yellow-200 dark:group-hover:bg-yellow-900/50 transition">
              <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 transition" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm mb-1">{t('nav.sessions')}</h3>
          <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{t('tooltips.dashboard.sessions')}</p>
          </Link>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
