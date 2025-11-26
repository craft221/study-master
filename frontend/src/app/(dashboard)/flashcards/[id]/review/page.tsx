'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Zap,
  Check,
  X,
  ArrowLeft,
  Trophy
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'
import MarkdownRenderer from '@/components/MarkdownRenderer'

interface Flashcard {
  id: string
  front: string
  back: string
  difficulty: number
  next_review_at: string
}

export default function FlashcardReviewPage() {
  const params = useParams()
  const router = useRouter()
  const deckId = params.id as string

  const [cards, setCards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reviewComplete, setReviewComplete] = useState(false)
  const [stats, setStats] = useState({
    easy: 0,
    medium: 0,
    hard: 0,
    again: 0,
  })

  useEffect(() => {
    fetchCardsToReview()
  }, [deckId])

  const fetchCardsToReview = async () => {
    try {
      const response = await api.get(`/flashcards/decks/${deckId}/due`)
      if (response.data.length === 0) {
        toast('Aucune carte à réviser pour le moment!', { icon: '✅' })
        router.push(`/flashcards/${deckId}`)
        return
      }
      setCards(response.data)
    } catch (error) {
      toast.error('Erreur lors du chargement des cartes')
      router.push('/flashcards')
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (quality: 0 | 1 | 2 | 3) => {
    const currentCard = cards[currentIndex]

    try {
      await api.post(`/flashcards/${currentCard.id}/review`, {
        quality,
        review_date: new Date().toISOString(),
      })

      // Update stats
      const newStats = { ...stats }
      if (quality === 0) newStats.again++
      else if (quality === 1) newStats.hard++
      else if (quality === 2) newStats.medium++
      else if (quality === 3) newStats.easy++
      setStats(newStats)

      // Move to next card
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1)
        setIsFlipped(false)
      } else {
        setReviewComplete(true)
      }
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement')
    }
  }

  const handleKeyPress = (e: KeyboardEvent) => {
    if (!isFlipped) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setIsFlipped(true)
      }
    } else {
      if (e.key === '1') handleReview(0)
      else if (e.key === '2') handleReview(1)
      else if (e.key === '3') handleReview(2)
      else if (e.key === '4') handleReview(3)
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isFlipped, currentIndex])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (reviewComplete) {
    const totalReviewed = stats.easy + stats.medium + stats.hard + stats.again
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
              <Trophy className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Révision terminée! 🎉
            </h2>
            <p className="text-gray-600 mb-8">
              Vous avez révisé {totalReviewed} cartes avec succès
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.again}</div>
              <div className="text-sm text-gray-600">À revoir</div>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stats.hard}</div>
              <div className="text-sm text-gray-600">Difficile</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.medium}</div>
              <div className="text-sm text-gray-600">Moyen</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.easy}</div>
              <div className="text-sm text-gray-600">Facile</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push(`/flashcards/${deckId}`)}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
            >
              Retour au deck
            </button>
            <button
              onClick={() => router.push('/flashcards')}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold"
            >
              Tous les decks
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentCard = cards[currentIndex]
  const progress = ((currentIndex + 1) / cards.length) * 100

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
          <h2 className="text-xl font-bold text-gray-900">
            Révision en cours
          </h2>
          <p className="text-gray-600 text-sm">
            Carte {currentIndex + 1} sur {cards.length}
          </p>
        </div>
        <div className="w-10" />
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Flashcard */}
      <div
        className={`relative bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-12 min-h-[400px] flex items-center justify-center cursor-pointer transition-all duration-500 transform ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
        onClick={() => !isFlipped && setIsFlipped(true)}
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center p-12"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(0deg)',
          }}
        >
          <div className="text-center w-full">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">QUESTION</div>
            <div className="text-xl">
              <MarkdownRenderer content={currentCard.front} />
            </div>
            {!isFlipped && (
              <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
                Cliquez ou appuyez sur Espace pour voir la réponse
              </div>
            )}
          </div>
        </div>

        <div
          className="absolute inset-0 flex items-center justify-center p-12"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="text-center w-full">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">RÉPONSE</div>
            <div className="text-xl">
              <MarkdownRenderer content={currentCard.back} />
            </div>
          </div>
        </div>
      </div>

      {/* Review Buttons */}
      {isFlipped && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-center text-gray-700 font-medium mb-4">
            Comment avez-vous trouvé cette carte?
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => handleReview(0)}
              className="p-4 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition flex flex-col items-center space-y-2 group"
            >
              <X className="h-6 w-6 group-hover:scale-110 transition" />
              <span className="font-medium">À revoir</span>
              <span className="text-xs">Touche 1</span>
            </button>
            <button
              onClick={() => handleReview(1)}
              className="p-4 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg transition flex flex-col items-center space-y-2 group"
            >
              <ThumbsDown className="h-6 w-6 group-hover:scale-110 transition" />
              <span className="font-medium">Difficile</span>
              <span className="text-xs">Touche 2</span>
            </button>
            <button
              onClick={() => handleReview(2)}
              className="p-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition flex flex-col items-center space-y-2 group"
            >
              <Check className="h-6 w-6 group-hover:scale-110 transition" />
              <span className="font-medium">Moyen</span>
              <span className="text-xs">Touche 3</span>
            </button>
            <button
              onClick={() => handleReview(3)}
              className="p-4 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition flex flex-col items-center space-y-2 group"
            >
              <ThumbsUp className="h-6 w-6 group-hover:scale-110 transition" />
              <span className="font-medium">Facile</span>
              <span className="text-xs">Touche 4</span>
            </button>
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">
            Votre réponse détermine quand vous reverrez cette carte (algorithme SM-2)
          </p>
        </div>
      )}

      {/* Stats Preview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-red-600">{stats.again}</div>
            <div className="text-xs text-gray-600">À revoir</div>
          </div>
          <div>
            <div className="text-lg font-bold text-orange-600">{stats.hard}</div>
            <div className="text-xs text-gray-600">Difficile</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-600">{stats.medium}</div>
            <div className="text-xs text-gray-600">Moyen</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">{stats.easy}</div>
            <div className="text-xs text-gray-600">Facile</div>
          </div>
        </div>
      </div>
    </div>
  )
}
