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
  Trash2
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'

interface Quiz {
  id: string
  title: string
  description: string
  subject: {
    id: string
    name: string
    color: string
  }
  total_questions: number
  time_limit_minutes: number | null
  created_at: string
  attempts: {
    id: string
    score: number
    completed: boolean
    created_at: string
  }[]
  best_score: number | null
}

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchQuizzes()
  }, [])

  const fetchQuizzes = async () => {
    try {
      const response = await api.get('/quizzes/')
      setQuizzes(response.data)
    } catch (error) {
      toast.error('Erreur lors du chargement des quiz')
    } finally {
      setLoading(false)
    }
  }

  const deleteQuiz = async (quizId: string) => {
    if (!confirm('Supprimer ce quiz?')) return

    try {
      await api.delete(`/quizzes/${quizId}`)
      setQuizzes(quizzes.filter(q => q.id !== quizId))
      toast.success('Quiz supprimé')
    } catch (error) {
      toast.error('Erreur')
    }
  }

  const filteredQuizzes = quizzes.filter((quiz) =>
    quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    quiz.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalAttempts = quizzes.reduce((sum, quiz) => sum + quiz.attempts.length, 0)
  const completedQuizzes = quizzes.filter(q => q.attempts.some(a => a.completed)).length
  const averageScore = quizzes.reduce((sum, quiz) => {
    const completed = quiz.attempts.filter(a => a.completed)
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quiz</h1>
          <p className="text-gray-600 mt-1">{quizzes.length} quiz disponibles</p>
        </div>
        <Link
          href="/quizzes/new"
          className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
        >
          <Plus className="h-5 w-5 mr-2" />
          Créer un quiz
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Brain className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{totalAttempts}</h3>
          <p className="text-gray-600 text-sm">Tentatives totales</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{completedQuizzes}</h3>
          <p className="text-gray-600 text-sm">Quiz complétés</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Trophy className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {averageScore.toFixed(0)}%
          </h3>
          <p className="text-gray-600 text-sm">Score moyen</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un quiz..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Quizzes Grid */}
      {filteredQuizzes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Brain className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchQuery ? 'Aucun quiz trouvé' : 'Aucun quiz disponible'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchQuery
              ? 'Essayez de modifier votre recherche'
              : 'Créez votre premier quiz pour tester vos connaissances'}
          </p>
          {!searchQuery && (
            <Link
              href="/quizzes/new"
              className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
            >
              <Plus className="h-5 w-5 mr-2" />
              Créer mon premier quiz
            </Link>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuizzes.map((quiz) => {
            const lastAttempt = quiz.attempts[0]
            const bestScore = quiz.best_score

            return (
              <div
                key={quiz.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-medium inline-block mb-2"
                        style={{
                          backgroundColor: `${quiz.subject.color}20`,
                          color: quiz.subject.color,
                        }}
                      >
                        {quiz.subject.name}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {quiz.title}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {quiz.description}
                      </p>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex items-center justify-between py-4 border-t border-b border-gray-200 mb-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{quiz.total_questions}</div>
                      <div className="text-xs text-gray-500">Questions</div>
                    </div>
                    <div className="border-l border-r border-gray-200 px-4 text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {quiz.time_limit_minutes || '∞'}
                      </div>
                      <div className="text-xs text-gray-500">Minutes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{quiz.attempts.length}</div>
                      <div className="text-xs text-gray-500">Tentatives</div>
                    </div>
                  </div>

                  {/* Best Score */}
                  {bestScore !== null && (
                    <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Meilleur score</span>
                        <div className="flex items-center space-x-2">
                          <Trophy className="h-4 w-4 text-yellow-600" />
                          <span className="font-bold text-yellow-700">{bestScore}%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <Link
                      href={`/quizzes/${quiz.id}`}
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium text-center flex items-center justify-center"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Commencer
                    </Link>
                    <button
                      onClick={() => deleteQuiz(quiz.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Last Attempt */}
                  {lastAttempt && (
                    <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(lastAttempt.created_at).toLocaleDateString('fr-FR')}
                      </span>
                      {lastAttempt.completed && (
                        <span className="font-medium text-gray-700">
                          Dernier: {lastAttempt.score}%
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
    </div>
  )
}
