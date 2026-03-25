'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Brain,
  Plus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Trophy,
  Play,
  Trash2,
  Share2,
  Users,
  Medal,
  X,
  Crown,
  Copy,
  ExternalLink,
  CloudOff
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'
import { useOfflineContext } from '@/components/providers/OfflineProvider'
import { offlineStorage } from '@/lib/offlineStorage'
import { useLanguage } from '@/contexts/LanguageContext'
import HelpTooltip from '@/components/ui/HelpTooltip'

interface Subject {
  id: string
  name: string
  color: string
}

interface Quiz {
  id: number | string
  title: string
  description: string
  subject?: Subject | null
  total_questions: number
  question_count?: number
  time_limit_minutes: number | null
  created_at: string
  attempts?: {
    id: number
    score: number
    is_completed: boolean
    created_at: string | null
  }[]
  best_score: number | null
  share_code: string | null
  is_public: boolean
  total_plays: number
  _isOffline?: boolean
  _tempId?: string
}

interface LeaderboardEntry {
  rank: number
  name: string
  score: number
  correct_count: number
  is_registered: boolean
  completed_at: string
}

export default function QuizzesPage() {
  const { isOnline } = useOfflineContext()
  const { t } = useLanguage()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // État pour le modal de classement
  const [leaderboardModal, setLeaderboardModal] = useState<{
    isOpen: boolean
    quiz: Quiz | null
    leaderboard: LeaderboardEntry[]
    loading: boolean
  }>({
    isOpen: false,
    quiz: null,
    leaderboard: [],
    loading: false
  })

  useEffect(() => {
    fetchQuizzes()
  }, [])

  const fetchQuizzes = async () => {
    try {
      if (isOnline) {
        const response = await api.get('/quizzes/')
        const onlineQuizzes = response.data || []

        // Sauvegarder en cache
        await offlineStorage.saveQuizzes(onlineQuizzes)

        // Récupérer les quizzes offline non synchronisés
        const offlineQuizzes = await offlineStorage.getQuizzes()
        const pendingOfflineQuizzes = offlineQuizzes.filter((q: any) => q._isOffline)

        // Fusionner (offline en premier pour visibilité)
        setQuizzes([...pendingOfflineQuizzes, ...onlineQuizzes])
      } else {
        // Mode hors-ligne: charger depuis le cache
        const cachedQuizzes = await offlineStorage.getQuizzes()
        setQuizzes(cachedQuizzes || [])
      }
    } catch (error) {
      console.error('Erreur lors du chargement des quiz:', error)
      // Essayer le cache en cas d'erreur
      const cachedQuizzes = await offlineStorage.getQuizzes()
      if (cachedQuizzes && cachedQuizzes.length > 0) {
        setQuizzes(cachedQuizzes)
      } else {
        toast.error(t('quizzesPage.loadError'))
      }
    } finally {
      setLoading(false)
    }
  }

  const deleteQuiz = async (quizId: number) => {
    if (!confirm(t('quizzesPage.confirmDelete'))) return

    try {
      await api.delete(`/quizzes/${quizId}`)
      setQuizzes(quizzes.filter(q => q.id !== quizId))
      toast.success(t('quizzesPage.quizDeleted'))
    } catch (error) {
      toast.error(t('quizzesPage.error'))
    }
  }

  // Activer le partage pour un quiz
  const enableSharing = async (quizId: number) => {
    try {
      const response = await api.post(`/quizzes/${quizId}/share`)
      const shareCode = response.data.share_code

      // Mettre à jour le quiz dans la liste
      setQuizzes(quizzes.map(q =>
        q.id === quizId ? { ...q, share_code: shareCode, is_public: true } : q
      ))

      // Copier le lien
      const shareUrl = `${window.location.origin}/play/${shareCode}`
      navigator.clipboard.writeText(shareUrl)
      toast.success(t('quizzesPage.linkCopiedPublic'))
    } catch (error) {
      toast.error(t('quizzesPage.sharingError'))
    }
  }

  // Copier le lien de partage
  const copyShareLink = (shareCode: string) => {
    const shareUrl = `${window.location.origin}/play/${shareCode}`
    navigator.clipboard.writeText(shareUrl)
    toast.success(t('quizzesPage.linkCopied'))
  }

  // Ouvrir le modal de classement
  const openLeaderboard = async (quiz: Quiz) => {
    if (!quiz.share_code) return

    setLeaderboardModal({
      isOpen: true,
      quiz,
      leaderboard: [],
      loading: true
    })

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.studera.app'
      const response = await fetch(
        `${apiBase}/api/v1/public/quiz/${quiz.share_code}/leaderboard`
      )
      const data = await response.json()

      setLeaderboardModal(prev => ({
        ...prev,
        leaderboard: data.leaderboard || [],
        loading: false
      }))
    } catch (error) {
      toast.error(t('quizzesPage.leaderboardError'))
      setLeaderboardModal(prev => ({ ...prev, loading: false }))
    }
  }

  // Fermer le modal
  const closeLeaderboard = () => {
    setLeaderboardModal({
      isOpen: false,
      quiz: null,
      leaderboard: [],
      loading: false
    })
  }

  const filteredQuizzes = quizzes.filter((quiz) =>
    quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    quiz.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalAttempts = quizzes.reduce((sum, quiz) => sum + (quiz.attempts?.length || 0), 0)
  const completedQuizzes = quizzes.filter(q => q.attempts?.some(a => a.is_completed)).length
  const averageScore = quizzes.reduce((sum, quiz) => {
    const completed = quiz.attempts?.filter(a => a.is_completed) || []
    if (completed.length === 0) return sum
    const avgQuizScore = completed.reduce((s, a) => s + a.score, 0) / completed.length
    return sum + avgQuizScore
  }, 0) / (completedQuizzes || 1)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">{t('quizzesPage.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">{t('quizzesPage.quizzesAvailable', { count: quizzes.length })}</p>
        </div>
        <Link
          href="/quizzes/new"
          className="inline-flex items-center justify-center px-4 py-2 sm:px-6 sm:py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold text-sm sm:text-base"
        >
          <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">{t('quizzesPage.createQuiz')}</span>
          <span className="sm:hidden">Créer</span>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 sm:p-4 lg:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Brain className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <HelpTooltip content={t('tooltips.quizzes.attempts')} size="sm" />
          </div>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-0.5 sm:mb-1">{totalAttempts}</h3>
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{t('quizzesPage.totalAttempts')}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 sm:p-4 lg:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-green-600 dark:text-green-400" />
            </div>
            <HelpTooltip content={t('tooltips.quizzes.completed')} size="sm" />
          </div>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-0.5 sm:mb-1">{completedQuizzes}</h3>
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{t('quizzesPage.completedQuizzes')}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 sm:p-4 lg:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Trophy className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <HelpTooltip content={t('tooltips.quizzes.avgScore')} size="sm" />
          </div>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-0.5 sm:mb-1">
            {averageScore.toFixed(0)}%
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{t('quizzesPage.averageScore')}</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('quizzesPage.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Quizzes Grid */}
      {filteredQuizzes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-12 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <Brain className="h-8 w-8 sm:h-10 sm:w-10 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {searchQuery ? t('quizzesPage.noQuizFound') : t('quizzesPage.noQuizAvailable')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-2 text-sm sm:text-base">
            {searchQuery
              ? t('quizzesPage.tryDifferentSearch')
              : t('quizzesPage.createFirstQuiz')}
          </p>
          {!searchQuery && (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4 sm:mb-6 max-w-md mx-auto">
                {t('tooltips.emptyStates.quizzes')}
              </p>
              <Link
                href="/quizzes/new"
                className="inline-flex items-center justify-center px-4 py-2 sm:px-6 sm:py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold text-sm sm:text-base"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                {t('quizzesPage.createMyFirstQuiz')}
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          {filteredQuizzes.map((quiz) => {
            const lastAttempt = quiz.attempts?.[0]
            const bestScore = quiz.best_score

            return (
              <div
                key={quiz.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
              >
                <div className="p-3 sm:p-4 lg:p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2 sm:mb-4">
                    <div className="flex-1 min-w-0">
                      {quiz.subject && (
                        <span
                          className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium inline-block mb-2 truncate max-w-[120px] sm:max-w-none"
                          style={{
                            backgroundColor: `${quiz.subject.color}20`,
                            color: quiz.subject.color,
                          }}
                        >
                          {quiz.subject.name}
                        </span>
                      )}
                      <div className="flex items-center gap-2 mb-1 sm:mb-2">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
                          {quiz.title}
                        </h3>
                        {quiz._isOffline && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                            <CloudOff className="w-3 h-3 mr-1" />
                            {t('quizzesPage.offline')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {quiz.description}
                      </p>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex items-center justify-between py-2 sm:py-4 border-t border-b border-gray-200 dark:border-gray-700 mb-2 sm:mb-4">
                    <div className="text-center flex-1">
                      <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{quiz.total_questions || quiz.question_count || 0}</div>
                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('quizzesPage.questions')}</div>
                    </div>
                    <div className="border-l border-r border-gray-200 dark:border-gray-700 px-2 sm:px-4 text-center flex-1">
                      <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                        {quiz.time_limit_minutes || '∞'}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('quizzesPage.minutes')}</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{quiz.attempts?.length || 0}</div>
                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('quizzesPage.attempts')}</div>
                    </div>
                  </div>

                  {/* Best Score */}
                  {bestScore !== null && (
                    <div className="mb-2 sm:mb-4 p-2 sm:p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">{t('quizzesPage.bestScore')}</span>
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600 dark:text-yellow-400" />
                          <span className="font-bold text-yellow-700 dark:text-yellow-400 text-sm sm:text-base">{bestScore}%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    {quiz._isOffline ? (
                      <div
                        className="flex-1 px-2 sm:px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg text-xs sm:text-sm font-medium text-center flex items-center justify-center cursor-not-allowed"
                        title={t('quizzesPage.waitingSync')}
                      >
                        <CloudOff className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span className="hidden sm:inline">{t('quizzesPage.waitingSync')}</span>
                        <span className="sm:hidden">Sync...</span>
                      </div>
                    ) : (
                      <Link
                        href={`/quizzes/${quiz.id}`}
                        className="flex-1 px-2 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-xs sm:text-sm font-medium text-center flex items-center justify-center"
                      >
                        <Play className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        {t('quizzesPage.start')}
                      </Link>
                    )}

                    {/* Bouton Partager / Classement */}
                    {quiz.share_code ? (
                      <>
                        <button
                          onClick={() => openLeaderboard(quiz)}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                          title="Voir le classement"
                        >
                          <Users className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => copyShareLink(quiz.share_code!)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Copier le lien"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => enableSharing(Number(quiz.id))}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                        title="Activer le partage"
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      onClick={() => deleteQuiz(Number(quiz.id))}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Badge si partagé */}
                  {quiz.share_code && (
                    <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-xs">
                      <span className="flex items-center text-green-600">
                        <Share2 className="h-3 w-3 mr-1" />
                        {t('quizzesPage.publicQuiz')}
                      </span>
                      <span className="text-gray-500">
                        {quiz.total_plays || 0} {t('quizzesPage.players')}
                      </span>
                    </div>
                  )}

                  {/* Last Attempt */}
                  {lastAttempt && lastAttempt.created_at && (
                    <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(lastAttempt.created_at).toLocaleDateString()}
                      </span>
                      {lastAttempt.is_completed && (
                        <span className="font-medium text-gray-700">
                          {t('quizzesPage.last')} {lastAttempt.score.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Classement */}
      {leaderboardModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeLeaderboard}
          />

          {/* Modal Content */}
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{t('quizzesPage.leaderboard')}</h2>
                    <p className="text-purple-100 text-sm">{leaderboardModal.quiz?.title}</p>
                  </div>
                </div>
                <button
                  onClick={closeLeaderboard}
                  className="p-2 hover:bg-white/20 rounded-lg transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Lien de partage */}
              {leaderboardModal.quiz?.share_code && (
                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/play/${leaderboardModal.quiz.share_code}`}
                    className="flex-1 px-3 py-2 bg-white/20 rounded-lg text-sm text-white placeholder-white/70 border border-white/30"
                  />
                  <button
                    onClick={() => copyShareLink(leaderboardModal.quiz!.share_code!)}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <a
                    href={`/play/${leaderboardModal.quiz.share_code}`}
                    target="_blank"
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              )}
            </div>

            {/* Leaderboard Content */}
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              {leaderboardModal.loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
                </div>
              ) : leaderboardModal.leaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">{t('quizzesPage.noParticipants')}</h3>
                  <p className="text-gray-500 text-sm">
                    {t('quizzesPage.shareToSeeLeaderboard')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderboardModal.leaderboard.map((entry, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-4 p-4 rounded-xl transition ${
                        entry.rank === 1
                          ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300'
                          : entry.rank === 2
                          ? 'bg-gradient-to-r from-gray-50 to-slate-50 border-2 border-gray-300'
                          : entry.rank === 3
                          ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300'
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      {/* Rang */}
                      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                        {entry.rank === 1 ? (
                          <Crown className="h-8 w-8 text-yellow-500" />
                        ) : entry.rank === 2 ? (
                          <Medal className="h-7 w-7 text-gray-400" />
                        ) : entry.rank === 3 ? (
                          <Medal className="h-6 w-6 text-orange-500" />
                        ) : (
                          <span className="text-lg font-bold text-gray-500">#{entry.rank}</span>
                        )}
                      </div>

                      {/* Nom */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 truncate">
                            {entry.name}
                          </span>
                          {entry.is_registered && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                              {t('quizzesPage.member')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {entry.correct_count} {t('quizzesPage.correctAnswers')} •{' '}
                          {new Date(entry.completed_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Score */}
                      <div className={`text-right font-bold text-lg ${
                        entry.rank === 1 ? 'text-yellow-600' :
                        entry.rank === 2 ? 'text-gray-600' :
                        entry.rank === 3 ? 'text-orange-600' :
                        'text-gray-700'
                      }`}>
                        {entry.score}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>{leaderboardModal.leaderboard.length} {t('quizzesPage.participants')}</span>
                <button
                  onClick={() => openLeaderboard(leaderboardModal.quiz!)}
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  {t('quizzesPage.refresh')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
