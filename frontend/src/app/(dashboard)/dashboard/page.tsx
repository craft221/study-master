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
  Flame
} from 'lucide-react'
import {
  pageVariants,
  containerVariants,
  itemVariants,
  cardVariants,
  buttonVariants,
  fadeInUpVariants,
} from '@/lib/animations'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    total_xp: 1250,
    level: 5,
    current_streak: 7,
    longest_streak: 14,
    total_notes: 42,
    total_flashcards: 156,
    total_quizzes_completed: 23,
    total_study_time_minutes: 1840,
    flashcards_due_today: 12,
    next_exam_days: 5,
  })

  const [recentActivity, setRecentActivity] = useState([
    {
      id: 1,
      type: 'note',
      title: 'Chapitre 5: Les Algorithmes',
      action: 'créé',
      time: 'Il y a 2h',
      subject: 'Informatique'
    },
    {
      id: 2,
      type: 'quiz',
      title: 'Quiz: Révision Générale',
      action: 'complété avec 85%',
      time: 'Il y a 4h',
      subject: 'Mathématiques'
    },
    {
      id: 3,
      type: 'flashcard',
      title: '20 nouvelles flashcards',
      action: 'révisées',
      time: 'Hier',
      subject: 'Anglais'
    },
  ])

  const [upcomingEvents, setUpcomingEvents] = useState([
    {
      id: 1,
      title: 'Examen Final - Mathématiques',
      date: '2025-11-23',
      type: 'exam',
      color: 'red'
    },
    {
      id: 2,
      title: 'Session de groupe: Physique',
      date: '2025-11-20',
      type: 'group',
      color: 'blue'
    },
    {
      id: 3,
      title: 'Révision flashcards',
      date: '2025-11-19',
      type: 'study',
      color: 'green'
    },
  ])

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
          Bon retour! 👋
        </motion.h1>
        <motion.p
          className="text-primary-100 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          Continuez votre apprentissage. Vous avez {stats.flashcards_due_today} flashcards à réviser aujourd'hui.
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
              <span>Réviser maintenant</span>
            </Link>
          </motion.div>
          <motion.div whileHover="hover" whileTap="tap" variants={buttonVariants}>
            <Link
              href="/notes/new"
              className="border-2 border-white text-white px-6 py-3 rounded-lg hover:bg-white hover:text-primary-600 transition font-semibold flex items-center space-x-2"
            >
              <BookOpen className="h-5 w-5" />
              <span>Nouvelle note</span>
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
            <span className="text-sm text-green-600 font-semibold">+150 XP</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.total_xp.toLocaleString()}</h3>
          <p className="text-gray-600 text-sm">XP Total</p>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <span>Niveau {stats.level}</span>
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
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.current_streak} jours</h3>
          <p className="text-gray-600 text-sm">Série actuelle</p>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <span>Continuez comme ça! 🔥</span>
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
            <span className="text-sm text-green-600 font-semibold">+45min</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {Math.floor(stats.total_study_time_minutes / 60)}h
          </h3>
          <p className="text-gray-600 text-sm">Temps d'étude</p>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <span>Ce mois-ci</span>
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
            <span className="text-sm text-purple-600 font-semibold">{stats.flashcards_due_today} à réviser</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.total_flashcards}</h3>
          <p className="text-gray-600 text-sm">Flashcards créées</p>
          <Link href="/flashcards" className="mt-4 flex items-center text-sm text-primary-600 hover:text-primary-700">
            <span>Réviser</span>
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
            <h2 className="text-xl font-bold text-gray-900">Activité récente</h2>
          </div>
          <motion.div
            className="divide-y divide-gray-200"
            variants={containerVariants}
          >
            {recentActivity.map((activity, index) => (
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
                    <p className="text-sm text-gray-600">{activity.action}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="text-xs text-gray-500">{activity.time}</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-primary-600">{activity.subject}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
          <div className="p-4 border-t border-gray-200">
            <Link href="/activity" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center">
              <span>Voir toute l'activité</span>
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
            <h2 className="text-xl font-bold text-gray-900">À venir</h2>
          </div>
          <div className="p-6 space-y-4">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg bg-${event.color}-100`}>
                  <Calendar className={`h-4 w-4 text-${event.color}-600`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{event.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(event.date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-200">
            <Link href="/schedule" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center">
              <span>Voir l'emploi du temps</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        </motion.div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        className="grid md:grid-cols-3 gap-6"
        variants={containerVariants}
      >
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
          <h3 className="font-semibold text-gray-900 mb-2">Créer un quiz</h3>
          <p className="text-sm text-gray-600">Testez vos connaissances avec un nouveau quiz</p>
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
          <h3 className="font-semibold text-gray-900 mb-2">Session Pomodoro</h3>
          <p className="text-sm text-gray-600">Démarrez une session d'étude chronométrée</p>
          </Link>
        </motion.div>

        <motion.div
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <Link
            href="/leaderboard"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition group block"
          >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition">
              <Trophy className="h-6 w-6 text-orange-600" />
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-primary-600 transition" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Classements</h3>
          <p className="text-sm text-gray-600">Comparez votre progression avec les autres</p>
          </Link>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
