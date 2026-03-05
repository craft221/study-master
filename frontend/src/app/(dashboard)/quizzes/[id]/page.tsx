'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Clock, CheckCircle, XCircle, Award, Shield } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'
import { useAntiCheat } from '@/hooks/use-anti-cheat'
import { AntiCheatMonitor, AntiCheatResult } from '@/components/anti-cheat-monitor'
import { ValidateQuizResponse } from '@/services/anti-cheat'
import { useSparkEventMessages } from '@/hooks/useSparkEvents'
import { useLanguage } from '@/contexts/LanguageContext'

interface Question {
  id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false'
  options: string[]
  correct_answer: string
  explanation: string
}

interface Quiz {
  id: string
  title: string
  description: string
  subject: { name: string; color: string }
  total_questions: number
  time_limit_minutes: number | null
  questions: Question[]
}

export default function TakeQuizPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const quizId = params.id as string
  const rawDuelId = searchParams.get('duel_id')
  const duelId = rawDuelId && !isNaN(parseInt(rawDuelId)) ? rawDuelId : null

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [score, setScore] = useState(0)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [antiCheatResult, setAntiCheatResult] = useState<ValidateQuizResponse | null>(null)

  // Hook Spark pour les messages d'événements
  const { onQuizComplete } = useSparkEventMessages()

  // Hook pour les traductions
  const { t } = useLanguage()

  // Timing pour chaque question
  const questionStartTime = useRef<number>(Date.now())
  const quizStartTime = useRef<number>(Date.now())

  // Anti-triche hook
  const antiCheat = useAntiCheat({
    quizId: parseInt(quizId),
    duelId: duelId ? parseInt(duelId) : undefined,
    onViolation: (violation) => {
      if (violation.severity === 'high' || violation.severity === 'critical') {
        toast.error(violation.message, { duration: 4000 })
      }
    },
    onWarning: (message) => {
      toast(message, { icon: '⚠️', duration: 5000 })
    },
    enabled: true
  })

  useEffect(() => {
    fetchQuiz()
  }, [quizId])

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || showResults) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, showResults])

  const fetchQuiz = async () => {
    try {
      const response = await api.get(`/quizzes/${quizId}`)
      setQuiz(response.data)
      if (response.data.time_limit_minutes) {
        setTimeLeft(response.data.time_limit_minutes * 60)
      }

      // Create attempt (pass duel_id if in duel mode)
      const attemptUrl = duelId
        ? `/quizzes/${quizId}/attempt?duel_id=${duelId}`
        : `/quizzes/${quizId}/attempt`
      const attemptResponse = await api.post(attemptUrl)
      setAttemptId(attemptResponse.data.id)

      // Démarrer la session anti-triche
      await antiCheat.startSession()
      quizStartTime.current = Date.now()
      questionStartTime.current = Date.now()
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Erreur lors du chargement du quiz'

      // Si c'est une erreur de duel déjà complété, afficher un message approprié et rediriger vers le duel
      if (errorMessage.includes('duel') || errorMessage.includes('déjà complété')) {
        toast.error(errorMessage, { duration: 5000 })
        if (duelId) {
          router.push(`/duels/${duelId}`)
        } else {
          router.push('/duels')
        }
      } else {
        toast.error(errorMessage)
        router.push('/quizzes')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = async (questionId: string, answer: string, answerIndex: number) => {
    // Calculer le temps de réponse
    const timeTakenMs = Date.now() - questionStartTime.current

    setAnswers({ ...answers, [questionId]: answer })

    // Enregistrer la réponse pour l'anti-triche
    await antiCheat.recordAnswer(
      parseInt(questionId),
      answerIndex,
      timeTakenMs,
      currentQuestion
    )

    // Réinitialiser le timer pour la prochaine question
    questionStartTime.current = Date.now()
  }

  const handleSubmit = async () => {
    if (!quiz || !attemptId) return

    // Vérifier que toutes les questions ont une réponse
    const unansweredQuestions = quiz.questions.filter(q => !answers[q.id])
    if (unansweredQuestions.length > 0) {
      toast.error(t('quiz.answerAllQuestions', { count: unansweredQuestions.length }))
      // Naviguer vers la première question sans réponse
      const firstUnansweredIndex = quiz.questions.findIndex(q => !answers[q.id])
      if (firstUnansweredIndex !== -1) {
        setCurrentQuestion(firstUnansweredIndex)
      }
      return
    }

    try {
      const totalTimeSeconds = Math.round((Date.now() - quizStartTime.current) / 1000)

      // S'assurer que toutes les questions sont incluses dans la soumission
      const response = await api.put(`/quizzes/attempt/${attemptId}`, {
        answers: quiz.questions.map((question) => ({
          question_id: parseInt(question.id),
          user_answer: answers[question.id] || '',
          time_spent_seconds: 0
        })),
      })

      const quizScore = response.data.score

      // Valider avec le système anti-triche
      const acResult = await antiCheat.validateAndEnd(
        quiz.questions.length,
        quizScore,
        totalTimeSeconds
      )

      setAntiCheatResult(acResult)

      // Utiliser le score ajusté si disponible
      const finalScore = acResult?.adjusted_score ?? quizScore
      setScore(Math.round(finalScore))
      setShowResults(true)

      // Message de Spark selon le score
      if (!acResult?.is_disqualified) {
        const correctCount = quiz.questions.filter(
          (q) => answers[q.id] === q.correct_answer
        ).length
        onQuizComplete(correctCount, quiz.questions.length, quiz.title)
      }

      if (acResult?.is_disqualified) {
        toast.error(t('quiz.resultInvalidated'))
      } else if (acResult && acResult.violations_count > 0) {
        toast(`${t('quiz.quizFinished')} ${acResult.violations_count} warning(s)`, { icon: '⚠️' })
      } else {
        toast.success(`${t('quiz.quizFinished')} Score: ${Math.round(finalScore)}%`)
      }

      // Fallback: trigger duel completion if backend auto-complete didn't fire
      if (duelId) {
        try {
          await api.post(`/duels/${duelId}/complete`)
        } catch {
          // Expected to fail if auto-complete already handled it or opponent hasn't played yet
        }
      }
    } catch (error) {
      toast.error(t('quiz.submissionError'))
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!quiz) return null

  if (showResults) {
    const correctCount = quiz.questions.filter(
      (q) => answers[q.id] === q.correct_answer
    ).length

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Résultat Anti-Triche */}
        {antiCheatResult && (
          <AntiCheatResult
            isValid={antiCheatResult.is_valid}
            violationsCount={antiCheatResult.violations_count}
            penaltyXp={antiCheatResult.penalty_xp}
            isDisqualified={antiCheatResult.is_disqualified}
            warningMessage={antiCheatResult.warning_message}
            adjustedScore={antiCheatResult.adjusted_score}
            originalScore={score}
          />
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${
            antiCheatResult?.is_disqualified ? 'bg-red-100 dark:bg-red-900/30' : 'bg-primary-100 dark:bg-primary-900/30'
          }`}>
            {antiCheatResult?.is_disqualified ? (
              <XCircle className="h-10 w-10 text-red-600" />
            ) : (
              <Award className="h-10 w-10 text-primary-600" />
            )}
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {antiCheatResult?.is_disqualified ? t('quiz.resultInvalidated') : t('quiz.quizFinished')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">{t('quiz.yourResults')}</p>

          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className={`text-3xl font-bold ${antiCheatResult?.is_disqualified ? 'text-gray-400 line-through' : 'text-blue-600'}`}>
                {score}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('quiz.finalScore')}</div>
            </div>
            <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-3xl font-bold text-green-600">{correctCount}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('quiz.correctAnswers')}</div>
            </div>
            <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-3xl font-bold text-red-600">
                {quiz.questions.length - correctCount}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('quiz.incorrectAnswers')}</div>
            </div>
          </div>

          {antiCheatResult?.penalty_xp && antiCheatResult.penalty_xp > 0 && !antiCheatResult.is_disqualified && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-yellow-800 dark:text-yellow-300 font-semibold">
                {t('quiz.penaltyApplied')}: -{antiCheatResult.penalty_xp} XP
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* Afficher Recommencer seulement si ce n'est pas un duel */}
            {!duelId && (
              <button
                onClick={() => router.push(`/quizzes/${quizId}`)}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
              >
                {t('quiz.retry')}
              </button>
            )}
            {/* Si c'est un duel, proposer de retourner au duel */}
            {duelId ? (
              <button
                onClick={() => router.push(`/duels/${duelId}`)}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
              >
                {t('quiz.viewDuelResults')}
              </button>
            ) : (
              <button
                onClick={() => router.push('/quizzes')}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold"
              >
                {t('quiz.backToQuizzes')}
              </button>
            )}
          </div>
        </div>

        {/* Review Answers */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900">{t('quiz.reviewTitle')}</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {quiz.questions.map((question, index) => {
              const userAnswer = answers[question.id]
              const isCorrect = userAnswer === question.correct_answer

              return (
                <div key={question.id} className="p-6">
                  <div className="flex items-start space-x-4">
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        isCorrect ? 'bg-green-100' : 'bg-red-100'
                      }`}
                    >
                      {isCorrect ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-3">
                        {index + 1}. {question.question_text}
                      </h4>
                      <div className="space-y-2 mb-3">
                        {question.options.map((option) => (
                          <div
                            key={option}
                            className={`p-3 rounded-lg border ${
                              option === question.correct_answer
                                ? 'bg-green-50 border-green-500'
                                : option === userAnswer
                                ? 'bg-red-50 border-red-500'
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            {option}
                            {option === question.correct_answer && (
                              <span className="ml-2 text-green-600 text-sm font-medium">
                                ✓ {t('quiz.correct')}
                              </span>
                            )}
                            {option === userAnswer && option !== question.correct_answer && (
                              <span className="ml-2 text-red-600 text-sm font-medium">
                                ✗ {t('quiz.yourAnswer')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      {question.explanation && (
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <strong>{t('quiz.explanation')}:</strong> {question.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const question = quiz.questions[currentQuestion]
  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <ArrowLeft className="h-6 w-6 text-gray-700" />
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">{quiz.title}</h2>
          <p className="text-sm text-gray-600">
            {t('quiz.questionOf', { current: currentQuestion + 1, total: quiz.questions.length })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Moniteur Anti-Triche */}
          <AntiCheatMonitor
            isActive={antiCheat.isActive}
            violations={antiCheat.violations}
            tabSwitchCount={antiCheat.tabSwitchCount}
            focusLossCount={antiCheat.focusLossCount}
          />

          {timeLeft !== null && (
            <div className="flex items-center space-x-2 px-4 py-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Clock className="h-5 w-5 text-orange-600" />
              <span className="font-mono font-bold text-orange-900 dark:text-orange-300">
                {formatTime(timeLeft)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Question */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h3 className="text-2xl font-semibold text-gray-900 mb-8">
          {question.question_text}
        </h3>

        <div className="space-y-3">
          {/* Questions avec options (multiple_choice ou true_false avec options) */}
          {question.options && question.options.length > 0 ? (
            question.options.map((option, index) => (
              <button
                key={option}
                onClick={() => handleAnswer(question.id, option, index)}
                className={`w-full p-4 text-left rounded-lg border-2 transition ${
                  answers[question.id] === option
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <span className="font-medium text-gray-900 dark:text-white">{option}</span>
              </button>
            ))
          ) : question.question_type === 'true_false' ? (
            /* Questions vrai/faux sans options prédéfinies */
            ['Vrai', 'Faux'].map((option, index) => (
              <button
                key={option}
                onClick={() => handleAnswer(question.id, option.toLowerCase(), index)}
                className={`w-full p-4 text-left rounded-lg border-2 transition ${
                  answers[question.id] === option.toLowerCase()
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <span className="font-medium text-gray-900 dark:text-white">{option}</span>
              </button>
            ))
          ) : null}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
          disabled={currentQuestion === 0}
          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('quiz.previous')}
        </button>

        {currentQuestion === quiz.questions.length - 1 ? (
          <button
            onClick={handleSubmit}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
          >
            {t('quiz.finishQuiz')}
          </button>
        ) : (
          <button
            onClick={() => setCurrentQuestion(currentQuestion + 1)}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
          >
            {t('quiz.next')}
          </button>
        )}
      </div>

      {/* Question Navigator */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">{t('quiz.quickNav')}</h4>
        <div className="flex flex-wrap gap-2">
          {quiz.questions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentQuestion(index)}
              className={`w-10 h-10 rounded-lg font-semibold transition ${
                index === currentQuestion
                  ? 'bg-primary-600 text-white'
                  : answers[quiz.questions[index].id]
                  ? 'bg-green-100 text-green-700 border border-green-500'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
