'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Zap,
  Check,
  X,
  ArrowLeft,
  Trophy,
  CloudOff,
  Clock,
  Wifi
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { useSparkEventMessages } from '@/hooks/useSparkEvents'
import { offlineStorage } from '@/lib/offlineStorage'
import { formatIntervalDisplay, type SchedulingOptions } from '@/lib/fsrs'
import { useOfflineContext } from '@/components/providers/OfflineProvider'

interface Flashcard {
  id: string
  front: string
  back: string
  difficulty: number
  stability?: number
  state?: string
  next_review_at: string
  last_reviewed_at?: string
}

export default function FlashcardReviewPage() {
  const params = useParams()
  const router = useRouter()
  const deckId = params.id as string
  const { isOnline } = useOfflineContext()

  const [cards, setCards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reviewComplete, setReviewComplete] = useState(false)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [schedulingPreview, setSchedulingPreview] = useState<SchedulingOptions | null>(null)
  const [stats, setStats] = useState({
    easy: 0,
    medium: 0,
    hard: 0,
    again: 0,
  })

  // Hook Spark pour les messages d'événements
  const { onFlashcardDeckComplete } = useSparkEventMessages()

  // Charger les cartes (online ou offline)
  const fetchCardsToReview = useCallback(async () => {
    setLoading(true)

    try {
      if (isOnline) {
        // Mode online: récupérer depuis l'API
        const response = await api.get(`/flashcards/decks/${deckId}/due`)

        if (response.data.length === 0) {
          toast('Aucune carte à réviser pour le moment!', { icon: '✅' })
          router.push(`/flashcards/${deckId}`)
          return
        }

        setCards(response.data)
        setIsOfflineMode(false)

        // Sauvegarder dans IndexedDB pour usage offline
        await offlineStorage.init()
        await offlineStorage.saveFlashcards(response.data)
      } else {
        // Mode offline: charger depuis IndexedDB
        await offlineStorage.init()
        const offlineCards = await offlineStorage.getDueFlashcards(deckId)

        if (offlineCards.length === 0) {
          toast('Aucune carte à réviser en mode hors ligne', { icon: '📴' })
          router.push(`/flashcards/${deckId}`)
          return
        }

        setCards(offlineCards)
        setIsOfflineMode(true)
        toast('Mode hors ligne - Révisions FSRS locales', { icon: '📴' })
      }
    } catch (error) {
      console.error('Error loading cards:', error)

      // Fallback vers offline si l'API échoue
      try {
        await offlineStorage.init()
        const offlineCards = await offlineStorage.getDueFlashcards(deckId)

        if (offlineCards.length > 0) {
          setCards(offlineCards)
          setIsOfflineMode(true)
          toast('Connexion perdue - Mode FSRS local activé', { icon: '📴' })
        } else {
          toast.error('Aucune carte disponible hors ligne')
          router.push('/flashcards')
        }
      } catch (offlineError) {
        toast.error('Erreur lors du chargement des cartes')
        router.push('/flashcards')
      }
    } finally {
      setLoading(false)
    }
  }, [deckId, isOnline, router])

  useEffect(() => {
    fetchCardsToReview()
  }, [fetchCardsToReview])

  // Calculer la prévisualisation FSRS quand on retourne la carte
  useEffect(() => {
    if (isFlipped && cards[currentIndex]) {
      try {
        const preview = offlineStorage.getSchedulingPreview(cards[currentIndex])
        setSchedulingPreview(preview)
      } catch (error) {
        console.warn('Could not calculate FSRS preview:', error)
        setSchedulingPreview(null)
      }
    } else {
      setSchedulingPreview(null)
    }
  }, [isFlipped, currentIndex, cards])

  const handleReview = async (quality: 0 | 1 | 2 | 3) => {
    const currentCard = cards[currentIndex]

    try {
      if (isOnline && !isOfflineMode) {
        // Mode online: envoyer à l'API
        await api.post(`/flashcards/${currentCard.id}/review`, {
          quality,
          review_date: new Date().toISOString(),
        })
      } else {
        // Mode offline: utiliser FSRS local
        const result = await offlineStorage.reviewFlashcardOffline(currentCard.id, quality)

        if (result.success) {
          // Mettre à jour la carte dans la liste locale
          const updatedCards = [...cards]
          updatedCards[currentIndex] = result.updatedCard
          setCards(updatedCards)

          // Afficher l'intervalle calculé
          const intervalDisplay = formatIntervalDisplay(result.schedulingInfo.intervalDays)
          console.log(`[FSRS] Next review in: ${intervalDisplay}`)
        }
      }

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
        // Calculer le score (easy + medium comptent comme correct)
        const correctCount = newStats.easy + newStats.medium
        const totalCards = cards.length
        onFlashcardDeckComplete(correctCount, totalCards)
        setReviewComplete(true)

        if (isOfflineMode) {
          toast.success('Révisions terminées! Synchronisation en attente...', { icon: '📴' })
        }
      }
    } catch (error) {
      console.error('Review error:', error)

      // Fallback vers offline si l'API échoue
      if (!isOfflineMode) {
        try {
          const result = await offlineStorage.reviewFlashcardOffline(currentCard.id, quality)
          if (result.success) {
            setIsOfflineMode(true)
            toast('Mode hors ligne activé', { icon: '📴' })

            // Continuer normalement
            const newStats = { ...stats }
            if (quality === 0) newStats.again++
            else if (quality === 1) newStats.hard++
            else if (quality === 2) newStats.medium++
            else if (quality === 3) newStats.easy++
            setStats(newStats)

            if (currentIndex < cards.length - 1) {
              setCurrentIndex(currentIndex + 1)
              setIsFlipped(false)
            } else {
              const correctCount = newStats.easy + newStats.medium
              onFlashcardDeckComplete(correctCount, cards.length)
              setReviewComplete(true)
            }
            return
          }
        } catch (offlineError) {
          console.error('Offline fallback failed:', offlineError)
        }
      }

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

  // Vérifier qu'il y a des cartes à afficher
  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Aucune carte à réviser</p>
          <button
            onClick={() => router.push('/flashcards')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Retour aux flashcards
          </button>
        </div>
      </div>
    )
  }

  const currentCard = cards[currentIndex]

  // Double vérification pour la carte actuelle
  if (!currentCard) {
    router.push(`/flashcards/${deckId}`)
    return null
  }

  const progress = ((currentIndex + 1) / cards.length) * 100

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Offline Mode Banner */}
      {isOfflineMode && (
        <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CloudOff className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <div className="flex-1">
              <p className="font-medium text-orange-900 dark:text-orange-100">
                Mode hors ligne FSRS
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                Calcul local des intervalles. Synchronisation automatique au retour en ligne.
              </p>
            </div>
            <div className="flex items-center gap-1 text-sm text-orange-600 dark:text-orange-400">
              <Clock className="h-4 w-4" />
              <span>En attente</span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
        >
          <ArrowLeft className="h-6 w-6 text-gray-700 dark:text-gray-300" />
        </button>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Révision en cours
            </h2>
            {isOfflineMode && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                <CloudOff className="w-3 h-3 mr-1" />
                Offline
              </span>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-center text-gray-700 dark:text-gray-300 font-medium mb-4">
            Comment avez-vous trouvé cette carte?
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => handleReview(0)}
              className="p-4 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg transition flex flex-col items-center space-y-2 group"
            >
              <X className="h-6 w-6 group-hover:scale-110 transition" />
              <span className="font-medium">À revoir</span>
              {schedulingPreview && (
                <span className="text-xs font-semibold bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded">
                  {schedulingPreview.again.display}
                </span>
              )}
              <span className="text-xs opacity-60">Touche 1</span>
            </button>
            <button
              onClick={() => handleReview(1)}
              className="p-4 bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-400 rounded-lg transition flex flex-col items-center space-y-2 group"
            >
              <ThumbsDown className="h-6 w-6 group-hover:scale-110 transition" />
              <span className="font-medium">Difficile</span>
              {schedulingPreview && (
                <span className="text-xs font-semibold bg-orange-100 dark:bg-orange-900/50 px-2 py-0.5 rounded">
                  {schedulingPreview.hard.display}
                </span>
              )}
              <span className="text-xs opacity-60">Touche 2</span>
            </button>
            <button
              onClick={() => handleReview(2)}
              className="p-4 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 rounded-lg transition flex flex-col items-center space-y-2 group"
            >
              <Check className="h-6 w-6 group-hover:scale-110 transition" />
              <span className="font-medium">Bien</span>
              {schedulingPreview && (
                <span className="text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded">
                  {schedulingPreview.good.display}
                </span>
              )}
              <span className="text-xs opacity-60">Touche 3</span>
            </button>
            <button
              onClick={() => handleReview(3)}
              className="p-4 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 rounded-lg transition flex flex-col items-center space-y-2 group"
            >
              <ThumbsUp className="h-6 w-6 group-hover:scale-110 transition" />
              <span className="font-medium">Facile</span>
              {schedulingPreview && (
                <span className="text-xs font-semibold bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded">
                  {schedulingPreview.easy.display}
                </span>
              )}
              <span className="text-xs opacity-60">Touche 4</span>
            </button>
          </div>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
            {isOfflineMode
              ? 'FSRS local - Les intervalles seront synchronisés au retour en ligne'
              : 'Votre réponse détermine quand vous reverrez cette carte (algorithme FSRS)'
            }
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
