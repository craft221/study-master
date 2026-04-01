'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  Share2,
  Users,
  ArrowRight,
  Loader2,
  Copy,
  MessageCircle,
  Twitter,
  Sparkles,
  Medal,
  Target,
  Zap,
  Image as ImageIcon
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import ShareResultCard from '@/components/ShareResultCard'

// Types
interface Question {
  id: number
  question: string
  type: string
  options?: string[]
  points: number
}

interface QuizData {
  share_code: string
  title: string
  description?: string
  difficulty?: string
  total_questions: number
  time_limit_minutes?: number
  is_timed: boolean
  creator_name: string
  total_plays: number
  average_score: number
  questions: Question[]
}

interface GameResult {
  guest_name: string
  score: number
  correct_count: number
  total_questions: number
  time_taken_seconds?: number
  rank: number
  total_players: number
  message: string
  share_text: string
  quiz_title: string
  detailed_answers?: any[]
}

interface LeaderboardEntry {
  rank: number
  name: string
  score: number
  correct_count: number
  is_registered: boolean
}

// API Base URL
const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.studera.app') + '/api/v1'

export default function PlayQuizPage() {
  const params = useParams()
  const router = useRouter()
  const shareCode = params.shareCode as string

  // États
  const [phase, setPhase] = useState<'loading' | 'intro' | 'name' | 'playing' | 'results'>('loading')
  const [quiz, setQuiz] = useState<QuizData | null>(null)
  const [guestName, setGuestName] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<{ question_id: number; user_answer: string }[]>([])
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [startTime, setStartTime] = useState<number>(0)
  const [result, setResult] = useState<GameResult | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showShareCard, setShowShareCard] = useState(false)
  const [shareCardData, setShareCardData] = useState<any>(null)
  const [wsConnected, setWsConnected] = useState(false)

  // Charger le quiz
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const response = await fetch(`${API_URL}/public/quiz/${shareCode}`)
        if (!response.ok) {
          throw new Error('Quiz non trouvé')
        }
        const data = await response.json()
        setQuiz(data)
        setPhase('intro')
      } catch (err) {
        setError('Ce quiz n\'existe pas ou n\'est plus disponible.')
        setPhase('loading')
      }
    }

    if (shareCode) {
      fetchQuiz()
    }
  }, [shareCode])

  // WebSocket pour le classement en temps réel
  useEffect(() => {
    if (phase !== 'results') return

    const wsUrl = `${API_URL.replace('http', 'ws').replace('/api/v1', '')}/api/v1/ws/leaderboard/${shareCode}`

    let ws: WebSocket | null = null
    let pingInterval: NodeJS.Timeout | null = null

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          console.log('WebSocket leaderboard connecté')
          setWsConnected(true)

          // Ping toutes les 30 secondes pour garder la connexion
          pingInterval = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }))
            }
          }, 30000)
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)

            if (data.type === 'leaderboard_update') {
              // Ajouter la nouvelle entrée au classement
              const newEntry = data.new_entry
              setLeaderboard(prev => {
                // Vérifier si déjà présent
                const exists = prev.some(e => e.name === newEntry.name && e.score === newEntry.score)
                if (exists) return prev

                // Ajouter et re-trier
                const updated = [...prev, {
                  rank: 0,
                  name: newEntry.name,
                  score: newEntry.score,
                  correct_count: newEntry.correct_count,
                  is_registered: newEntry.is_registered
                }]

                // Trier par score décroissant
                updated.sort((a, b) => b.score - a.score)

                // Réattribuer les rangs
                return updated.map((entry, idx) => ({ ...entry, rank: idx + 1 }))
              })

              // Toast pour notifier
              toast(`🎮 ${newEntry.name} vient de terminer avec ${(newEntry.score ?? 0).toFixed(0)}%!`, {
                icon: '🏆'
              })
            }
          } catch (e) {
            console.error('Erreur parsing WS:', e)
          }
        }

        ws.onclose = () => {
          setWsConnected(false)
          if (pingInterval) clearInterval(pingInterval)
        }

        ws.onerror = () => {
          setWsConnected(false)
        }
      } catch (e) {
        console.error('Erreur connexion WS:', e)
      }
    }

    connect()

    return () => {
      if (pingInterval) clearInterval(pingInterval)
      if (ws) ws.close()
    }
  }, [phase, shareCode])

  // Timer
  useEffect(() => {
    if (phase === 'playing' && quiz?.is_timed && timeLeft !== null && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev && prev <= 1) {
            return 0
          }
          return prev ? prev - 1 : 0
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [phase, timeLeft, quiz?.is_timed])

  // Soumettre quand le timer atteint 0
  useEffect(() => {
    if (timeLeft === 0 && phase === 'playing' && !isSubmitting) {
      handleSubmitQuiz()
    }
  }, [timeLeft, phase, isSubmitting])

  // Démarrer le quiz
  const handleStartQuiz = async () => {
    if (!guestName.trim() || guestName.length < 2) {
      toast.error('Entre un pseudo (min 2 caractères)')
      return
    }

    try {
      const response = await fetch(`${API_URL}/public/quiz/${shareCode}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_name: guestName.trim() })
      })

      if (!response.ok) throw new Error('Erreur de démarrage')

      const data = await response.json()
      setSessionId(data.session_id)
      setStartTime(Date.now())

      if (quiz?.is_timed && quiz.time_limit_minutes) {
        setTimeLeft(quiz.time_limit_minutes * 60)
      }

      setPhase('playing')
    } catch (err) {
      toast.error('Impossible de démarrer le quiz')
    }
  }

  // Répondre à une question
  const handleAnswer = (answer: string) => {
    setSelectedAnswer(answer)
  }

  // Question suivante
  const handleNextQuestion = () => {
    if (selectedAnswer === null) {
      toast.error('Sélectionne une réponse')
      return
    }

    const newAnswers = [
      ...answers,
      { question_id: currentQuestion, user_answer: selectedAnswer }
    ]
    setAnswers(newAnswers)
    setSelectedAnswer(null)

    if (currentQuestion < (quiz?.questions.length || 0) - 1) {
      setCurrentQuestion(prev => prev + 1)
    } else {
      // Dernière question, soumettre
      handleSubmitQuiz(newAnswers)
    }
  }

  // Soumettre le quiz
  const handleSubmitQuiz = async (finalAnswers?: typeof answers) => {
    if (isSubmitting) return
    setIsSubmitting(true)

    const answersToSubmit = finalAnswers || answers
    const timeTaken = Math.floor((Date.now() - startTime) / 1000)

    try {
      const response = await fetch(`${API_URL}/public/quiz/${shareCode}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          answers: answersToSubmit,
          time_taken_seconds: timeTaken
        })
      })

      if (!response.ok) throw new Error('Erreur de soumission')

      const data = await response.json()
      setResult(data)

      // Charger le leaderboard
      const lbResponse = await fetch(`${API_URL}/public/quiz/${shareCode}/leaderboard?limit=10`)
      if (lbResponse.ok) {
        const lbData = await lbResponse.json()
        setLeaderboard(lbData.leaderboard)
      }

      setPhase('results')
    } catch (err) {
      toast.error('Erreur lors de la soumission')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Ouvrir la carte partageable
  const handleOpenShareCard = async () => {
    try {
      const response = await fetch(`${API_URL}/public/quiz/${shareCode}/share-card/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setShareCardData(data)
        setShowShareCard(true)
      } else {
        // Fallback avec les donnees locales si l'API echoue
        setShareCardData({
          card_data: {
            player_name: result?.guest_name || guestName,
            quiz_title: result?.quiz_title || quiz?.title || '',
            creator_name: quiz?.creator_name || 'Anonyme',
            score: result?.score || 0,
            correct_count: result?.correct_count || 0,
            total_questions: result?.total_questions || 0,
            rank: result?.rank || 1,
            total_players: result?.total_players || 1,
            time_taken_seconds: result?.time_taken_seconds,
            performance: (result?.score || 0) >= 90 ? 'legendary' : (result?.score || 0) >= 80 ? 'excellent' : (result?.score || 0) >= 70 ? 'great' : (result?.score || 0) >= 50 ? 'good' : 'learning',
            performance_emoji: (result?.score || 0) >= 90 ? '🏆' : (result?.score || 0) >= 80 ? '⭐' : (result?.score || 0) >= 70 ? '🎯' : (result?.score || 0) >= 50 ? '👍' : '📚',
            performance_title: (result?.score || 0) >= 90 ? 'LEGENDAIRE !' : (result?.score || 0) >= 80 ? 'EXCELLENT !' : (result?.score || 0) >= 70 ? 'TRES BIEN !' : (result?.score || 0) >= 50 ? 'BIEN !' : 'CONTINUE !',
            share_code: shareCode
          },
          share_urls: {
            play_url: `/play/${shareCode}`,
            twitter_text: result?.share_text || `J'ai obtenu ${(result?.score ?? 0).toFixed(0)}% sur ce quiz !`,
            whatsapp_text: result?.share_text || `J'ai obtenu ${(result?.score ?? 0).toFixed(0)}% sur ce quiz !`
          }
        })
        setShowShareCard(true)
      }
    } catch (err) {
      toast.error('Impossible de generer la carte')
    }
  }

  // Partager
  const handleShare = async (platform: string) => {
    const shareUrl = window.location.href
    const shareText = result?.share_text || `J'ai joué à "${quiz?.title}" sur Studera !`

    // Tracker le partage
    fetch(`${API_URL}/public/quiz/${shareCode}/track-share?platform=${platform}`, {
      method: 'POST'
    }).catch(() => {})

    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`, '_blank')
        break
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank')
        break
      case 'copy':
        await navigator.clipboard.writeText(shareUrl)
        toast.success('Lien copié !')
        break
    }
  }

  // Formatage du temps
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Rendu selon la phase
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h1 className="text-2xl font-bold mb-2">Quiz introuvable</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-white text-purple-900 px-6 py-3 rounded-full font-semibold hover:bg-gray-100 transition"
          >
            Découvrir Studera
          </Link>
        </div>
      </div>
    )
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    )
  }

  // Phase Intro
  if (phase === 'intro' && quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full text-white border border-white/20"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">{quiz.title}</h1>
            {quiz.description && (
              <p className="text-gray-300">{quiz.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <Target className="w-6 h-6 mx-auto mb-2 text-amber-400" />
              <p className="text-2xl font-bold">{quiz.total_questions}</p>
              <p className="text-sm text-gray-300">Questions</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <Users className="w-6 h-6 mx-auto mb-2 text-green-400" />
              <p className="text-2xl font-bold">{quiz.total_plays}</p>
              <p className="text-sm text-gray-300">Joueurs</p>
            </div>
            {quiz.time_limit_minutes && (
              <div className="bg-white/10 rounded-xl p-4 text-center">
                <Clock className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                <p className="text-2xl font-bold">{quiz.time_limit_minutes}</p>
                <p className="text-sm text-gray-300">Minutes</p>
              </div>
            )}
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <Trophy className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
              <p className="text-2xl font-bold">{(quiz.average_score ?? 0).toFixed(0)}%</p>
              <p className="text-sm text-gray-300">Score moyen</p>
            </div>
          </div>

          <p className="text-center text-sm text-gray-400 mb-6">
            Créé par <span className="text-amber-400">{quiz.creator_name}</span>
          </p>

          <button
            onClick={() => setPhase('name')}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-4 px-8 rounded-xl hover:from-amber-600 hover:to-orange-600 transition flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            Jouer maintenant
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            Pas besoin de compte pour jouer !
          </p>
        </motion.div>
      </div>
    )
  }

  // Phase Nom
  if (phase === 'name') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full text-white border border-white/20"
        >
          <h2 className="text-2xl font-bold text-center mb-6">Comment tu t'appelles ?</h2>

          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Ton pseudo..."
            maxLength={50}
            className="w-full bg-white/10 border border-white/30 rounded-xl px-4 py-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-center text-xl mb-6"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleStartQuiz()}
          />

          <button
            onClick={handleStartQuiz}
            disabled={guestName.trim().length < 2}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-4 px-8 rounded-xl hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            C'est parti !
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    )
  }

  // Phase Jeu
  if (phase === 'playing' && quiz) {
    const question = quiz.questions[currentQuestion]
    const progress = ((currentQuestion + 1) / quiz.questions.length) * 100

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 text-white">
            <div className="flex items-center gap-2">
              <span className="text-sm opacity-75">Question</span>
              <span className="font-bold">{currentQuestion + 1}/{quiz.questions.length}</span>
            </div>

            {timeLeft !== null && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${timeLeft < 30 ? 'bg-red-500/30 text-red-300' : 'bg-white/10'}`}>
                <Clock className="w-4 h-4" />
                <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-white/20 rounded-full mb-8 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Question */}
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20"
          >
            <h2 className="text-xl md:text-2xl font-bold text-white mb-8">
              {question.question}
            </h2>

            {/* Options */}
            <div className="space-y-3">
              {question.options?.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(option)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedAnswer === option
                      ? 'border-amber-500 bg-amber-500/20 text-white'
                      : 'border-white/20 bg-white/5 text-gray-200 hover:border-white/40 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      selectedAnswer === option ? 'bg-amber-500 text-white' : 'bg-white/20'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{option}</span>
                  </div>
                </button>
              ))}

              {/* Pour les questions vrai/faux */}
              {question.type === 'true_false' && !question.options && (
                <>
                  {['Vrai', 'Faux'].map((option) => (
                    <button
                      key={option}
                      onClick={() => handleAnswer(option.toLowerCase())}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        selectedAnswer === option.toLowerCase()
                          ? 'border-amber-500 bg-amber-500/20 text-white'
                          : 'border-white/20 bg-white/5 text-gray-200 hover:border-white/40'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </>
              )}

              {/* Pour les réponses courtes */}
              {question.type === 'short_answer' && (
                <input
                  type="text"
                  value={selectedAnswer || ''}
                  onChange={(e) => setSelectedAnswer(e.target.value)}
                  placeholder="Ta réponse..."
                  className="w-full bg-white/10 border border-white/30 rounded-xl px-4 py-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              )}
            </div>

            {/* Bouton suivant */}
            <button
              onClick={handleNextQuestion}
              disabled={selectedAnswer === null || isSubmitting}
              className="w-full mt-8 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-4 px-8 rounded-xl hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : currentQuestion === quiz.questions.length - 1 ? (
                <>
                  Terminer
                  <CheckCircle className="w-5 h-5" />
                </>
              ) : (
                <>
                  Suivant
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </motion.div>
        </div>
      </div>
    )
  }

  // Phase Résultats
  if (phase === 'results' && result) {
    const isGreatScore = result.score >= 80
    const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Résultat principal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 text-center text-white border border-white/20 mb-6"
          >
            <div className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center ${
              isGreatScore ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-blue-400 to-purple-500'
            }`}>
              {isGreatScore ? (
                <Trophy className="w-12 h-12 text-white" />
              ) : (
                <Target className="w-12 h-12 text-white" />
              )}
            </div>

            <h1 className="text-3xl font-bold mb-2">{result.message}</h1>

            <div className="text-6xl font-bold my-6 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              {(result.score ?? 0).toFixed(0)}%
            </div>

            <p className="text-xl text-gray-300 mb-6">
              {result.correct_count ?? 0} / {result.total_questions ?? 0} bonnes réponses
            </p>

            {/* Rang */}
            <div className="inline-flex items-center gap-2 bg-white/10 px-6 py-3 rounded-full mb-8">
              <Medal className="w-5 h-5 text-amber-400" />
              <span>
                <strong className="text-amber-400">#{result.rank ?? 1}</strong> sur {result.total_players ?? 1} joueurs
              </span>
            </div>

            {/* Boutons de partage */}
            <div className="space-y-4">
              <p className="text-sm text-gray-400">Défie tes amis !</p>

              {/* Bouton carte partageable */}
              <button
                onClick={handleOpenShareCard}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-3 rounded-xl transition mb-3"
              >
                <ImageIcon className="w-5 h-5" />
                Créer une image partageable
              </button>

              <div className="flex justify-center gap-3">
                <button
                  onClick={() => handleShare('whatsapp')}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl transition"
                >
                  <MessageCircle className="w-5 h-5" />
                  WhatsApp
                </button>
                <button
                  onClick={() => handleShare('twitter')}
                  className="flex items-center gap-2 bg-blue-400 hover:bg-blue-500 text-white px-6 py-3 rounded-xl transition"
                >
                  <Twitter className="w-5 h-5" />
                  Twitter
                </button>
                <button
                  onClick={() => handleShare('copy')}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl transition"
                >
                  <Copy className="w-5 h-5" />
                  Copier
                </button>
              </div>
            </div>
          </motion.div>

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 text-white border border-white/20 mb-6"
            >
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Classement
                {wsConnected && (
                  <span className="flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full ml-auto">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    EN DIRECT
                  </span>
                )}
              </h2>

              <div className="space-y-2">
                {leaderboard.slice(0, 5).map((entry, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-xl ${
                      entry.name === result.guest_name ? 'bg-amber-500/20 border border-amber-500/50' : 'bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-700' : 'bg-white/20'
                      }`}>
                        {entry.rank}
                      </span>
                      <span className="font-medium">{entry.name}</span>
                      {entry.is_registered && (
                        <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded-full">PRO</span>
                      )}
                    </div>
                    <span className="font-bold text-amber-400">{(entry.score ?? 0).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* CTA Inscription */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-lg rounded-3xl p-6 text-center text-white border border-amber-500/30"
          >
            <Zap className="w-10 h-10 mx-auto mb-3 text-amber-400" />
            <h3 className="text-xl font-bold mb-2">Envie de plus ?</h3>
            <p className="text-gray-300 mb-4">
              Crée tes propres quiz, suis ta progression et défie tes amis !
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold px-8 py-3 rounded-xl hover:from-amber-600 hover:to-orange-600 transition"
            >
              Créer un compte gratuit
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-xs text-gray-400 mt-3">
              Ton score sera sauvegardé !
            </p>
          </motion.div>
        </div>

        {/* Modal carte partageable */}
        {shareCardData && (
          <ShareResultCard
            isOpen={showShareCard}
            onClose={() => setShowShareCard(false)}
            cardData={shareCardData.card_data}
            shareUrls={shareCardData.share_urls}
          />
        )}
      </div>
    )
  }

  return null
}
