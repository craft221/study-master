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
  Sparkles
} from 'lucide-react'
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
}

interface Event {
  id: number | string
  title: string
  date: string
  time?: string
  type?: string
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
        <div className="bg-gray-200 rounded-2xl h-64"></div>

        {/* Skeleton pour Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-200 rounded-xl h-40"></div>
          ))}
        </div>

        {/* Skeleton pour Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-gray-200 rounded-xl h-96"></div>
          <div className="bg-gray-200 rounded-xl h-96"></div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={pageVariants}
    >
      {/* Welcome Section */}
      <motion.div
        className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-2xl p-8 text-white"
        variants={fadeInUpVariants}
      >
        <motion.h1
          className="text-3xl font-bold mb-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          {t('dashboard.welcomeBack')}! 👋
        </motion.h1>
        <motion.p
          className="text-primary-100 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {t('dashboard.flashcardsDue')}: {stats.flashcards_due_today}
        </motion.p>
        <motion.div
          className="flex flex-wrap gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <motion.div whileHover="hover" whileTap="tap" variants={buttonVariants}>
            <Link
              href="/flashcards"
              className="bg-white text-primary-600 px-6 py-3 rounded-lg hover:bg-gray-100 transition font-semibold flex items-center space-x-2"
            >
              <CreditCard className="h-5 w-5" />
              <span>{t('flashcards.study')}</span>
            </Link>
          </motion.div>
          <motion.div whileHover="hover" whileTap="tap" variants={buttonVariants}>
            <Link
              href="/notes/new"
              className="border-2 border-white text-white px-6 py-3 rounded-lg hover:bg-white hover:text-primary-600 transition font-semibold flex items-center space-x-2"
            >
              <BookOpen className="h-5 w-5" />
              <span>{t('notes.addNote')}</span>
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        variants={containerVariants}
      >
        {/* XP Card */}
        <motion.div
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition"
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-sm text-blue-600 font-semibold">
              {stats.xp_progress}/{stats.xp_needed} XP
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.total_xp.toLocaleString()}</h3>
          <p className="text-gray-600 text-sm">{t('dashboard.xpEarned')}</p>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
              <span>{t('dashboard.level')} {stats.level}</span>
              <span>{t('dashboard.level')} {stats.level + 1}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((stats.xp_progress / stats.xp_needed) * 100, 100)}%` }}
              />
            </div>
          </div>
        </motion.div>

        {/* Streak Card */}
        <motion.div
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition"
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Flame className="h-6 w-6 text-orange-600" />
            </div>
            <span className="text-sm text-orange-600 font-semibold">Record: {stats.longest_streak}</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.current_streak} {t('dashboard.days')}</h3>
          <p className="text-gray-600 text-sm">{t('dashboard.studyStreak')}</p>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <span>{t('spark.encourage')} 🔥</span>
          </div>
        </motion.div>

        {/* Study Time Card */}
        <motion.div
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition"
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
            {stats.study_time_this_month > 0 && (
              <span className="text-sm text-green-600 font-semibold">
                +{stats.study_time_this_month >= 60
                  ? `${Math.floor(stats.study_time_this_month / 60)}h${stats.study_time_this_month % 60 > 0 ? stats.study_time_this_month % 60 + 'min' : ''}`
                  : `${stats.study_time_this_month}min`
                }
              </span>
            )}
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {stats.total_study_time_minutes >= 60
              ? `${Math.floor(stats.total_study_time_minutes / 60)}h${stats.total_study_time_minutes % 60 > 0 ? ` ${stats.total_study_time_minutes % 60}min` : ''}`
              : `${stats.total_study_time_minutes}min`
            }
          </h3>
          <p className="text-gray-600 text-sm">{t('dashboard.todayStats')}</p>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <span>{stats.study_time_this_month > 0 ? `${stats.study_time_this_month}min` : t('dashboard.noActivity')}</span>
          </div>
        </motion.div>

        {/* Flashcards Card */}
        <motion.div
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition"
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-sm text-purple-600 font-semibold">{stats.flashcards_due_today} {t('flashcards.dueToday')}</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.total_flashcards}</h3>
          <p className="text-gray-600 text-sm">{t('nav.flashcards')}</p>
          <Link href="/flashcards" className="mt-4 flex items-center text-sm text-primary-600 hover:text-primary-700">
            <span>{t('flashcards.study')}</span>
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </motion.div>
      </motion.div>

      {/* Main Content Grid */}
      <motion.div
        className="grid lg:grid-cols-3 gap-6"
        variants={containerVariants}
      >
        {/* Recent Activity */}
        <motion.div
          className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200"
          variants={cardVariants}
        >
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">{t('dashboard.recentActivity')}</h2>
          </div>
          <motion.div
            className="divide-y divide-gray-200"
            variants={containerVariants}
          >
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  className="p-6 hover:bg-gray-50 transition"
                  variants={itemVariants}
                  custom={index}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`p-2 rounded-lg ${
                      activity.type === 'note' ? 'bg-blue-100' :
                      activity.type === 'quiz' ? 'bg-green-100' : 'bg-purple-100'
                    }`}>
                      {activity.type === 'note' && <BookOpen className="h-5 w-5 text-blue-600" />}
                      {activity.type === 'quiz' && <Brain className="h-5 w-5 text-green-600" />}
                      {activity.type === 'flashcard' && <CreditCard className="h-5 w-5 text-purple-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      {activity.action && <p className="text-sm text-gray-600">{activity.action}</p>}
                      <div className="flex items-center space-x-2 mt-2">
                        <span className="text-xs text-gray-500">{activity.time}</span>
                        {activity.subject && (
                          <>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-primary-600">{activity.subject}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="p-12 text-center text-gray-500">
                <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">{t('dashboard.noActivity')}</p>
                <p className="text-xs mt-1">{t('dashboard.startStudying')}</p>
              </div>
            )}
          </motion.div>
          <div className="p-4 border-t border-gray-200">
            <Link href="/activity" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center">
              <span>{t('common.all')}</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        </motion.div>

        {/* Upcoming Events */}
        <motion.div
          className="bg-white rounded-xl shadow-sm border border-gray-200"
          variants={cardVariants}
        >
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">{t('dashboard.upcomingExams')}</h2>
          </div>
          <div className="p-6 space-y-4">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg bg-${event.color}-100`}>
                    <Calendar className={`h-4 w-4 text-${event.color}-600`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{event.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(event.date).toLocaleDateString(
                        locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : 'en-US',
                        { day: 'numeric', month: 'long' }
                      )}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">{t('calendar.noEvents')}</p>
                <p className="text-xs mt-1">{t('calendar.addEvent')}</p>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-gray-200">
            <Link href="/schedule" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center">
              <span>{t('nav.calendar')}</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        </motion.div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
        variants={containerVariants}
      >
        <motion.div
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <Link
            href="/flashcards/new"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition group block"
          >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition">
              <CreditCard className="h-6 w-6 text-blue-600" />
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-primary-600 transition" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">{t('flashcards.addDeck')}</h3>
          <p className="text-sm text-gray-600">{t('flashcards.addFlashcard')}</p>
          </Link>
        </motion.div>

        <motion.div
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <Link
            href="/quizzes/new"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition group block"
          >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition">
              <Brain className="h-6 w-6 text-green-600" />
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-primary-600 transition" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">{t('quiz.addQuiz')}</h3>
          <p className="text-sm text-gray-600">{t('quiz.startQuiz')}</p>
          </Link>
        </motion.div>

        <motion.div
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <Link
            href="/ai"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition group block"
          >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-primary-600 transition" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">{t('nav.spark')}</h3>
          <p className="text-sm text-gray-600">{t('spark.greeting')}</p>
          </Link>
        </motion.div>

        <motion.div
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <Link
            href="/sessions/new"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition group block"
          >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 rounded-lg group-hover:bg-yellow-200 transition">
              <Zap className="h-6 w-6 text-yellow-600" />
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-primary-600 transition" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">{t('nav.sessions')}</h3>
          <p className="text-sm text-gray-600">{t('calendar.studySession')}</p>
          </Link>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
