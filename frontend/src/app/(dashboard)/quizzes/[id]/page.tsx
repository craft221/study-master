'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Clock, CheckCircle, XCircle, Award } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'

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
  const quizId = params.id as string

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [score, setScore] = useState(0)
  const [attemptId, setAttemptId] = useState<string | null>(null)

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
      
      // Create attempt
      const attemptResponse = await api.post(`/quizzes/${quizId}/attempts`)
      setAttemptId(attemptResponse.data.id)
    } catch (error) {
      toast.error('Erreur lors du chargement du quiz')
      router.push('/quizzes')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers({ ...answers, [questionId]: answer })
  }

  const handleSubmit = async () => {
    if (!quiz || !attemptId) return

    try {
      const response = await api.post(`/quizzes/attempts/${attemptId}/submit`, {
        answers: Object.entries(answers).map(([question_id, user_answer]) => ({
          question_id,
          user_answer,
        })),
      })

      setScore(response.data.score)
      setShowResults(true)
      toast.success(`Quiz terminé! Score: ${response.data.score}%`)
    } catch (error) {
      toast.error('Erreur lors de la soumission')
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mb-6">
            <Award className="h-10 w-10 text-primary-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Quiz terminé!</h2>
          <p className="text-gray-600 mb-8">Voici vos résultats</p>

          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="p-6 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">{score}%</div>
              <div className="text-sm text-gray-600">Score final</div>
            </div>
            <div className="p-6 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">{correctCount}</div>
              <div className="text-sm text-gray-600">Réponses correctes</div>
            </div>
            <div className="p-6 bg-red-50 rounded-lg">
              <div className="text-3xl font-bold text-red-600">
                {quiz.questions.length - correctCount}
              </div>
              <div className="text-sm text-gray-600">Réponses incorrectes</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push(`/quizzes/${quizId}`)}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
            >
              Recommencer
            </button>
            <button
              onClick={() => router.push('/quizzes')}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold"
            >
              Retour aux quiz
            </button>
          </div>
        </div>

        {/* Review Answers */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900">Révision des réponses</h3>
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
                                ✓ Correcte
                              </span>
                            )}
                            {option === userAnswer && option !== question.correct_answer && (
                              <span className="ml-2 text-red-600 text-sm font-medium">
                                ✗ Votre réponse
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      {question.explanation && (
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <strong>Explication:</strong> {question.explanation}
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
            Question {currentQuestion + 1} sur {quiz.questions.length}
          </p>
        </div>
        {timeLeft !== null && (
          <div className="flex items-center space-x-2 px-4 py-2 bg-orange-100 rounded-lg">
            <Clock className="h-5 w-5 text-orange-600" />
            <span className="font-mono font-bold text-orange-900">
              {formatTime(timeLeft)}
            </span>
          </div>
        )}
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
          {question.options.map((option) => (
            <button
              key={option}
              onClick={() => handleAnswer(question.id, option)}
              className={`w-full p-4 text-left rounded-lg border-2 transition ${
                answers[question.id] === option
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span className="font-medium text-gray-900">{option}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
          disabled={currentQuestion === 0}
          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Précédent
        </button>

        {currentQuestion === quiz.questions.length - 1 ? (
          <button
            onClick={handleSubmit}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
          >
            Terminer le quiz
          </button>
        ) : (
          <button
            onClick={() => setCurrentQuestion(currentQuestion + 1)}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
          >
            Suivant
          </button>
        )}
      </div>

      {/* Question Navigator */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Navigation rapide</h4>
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
