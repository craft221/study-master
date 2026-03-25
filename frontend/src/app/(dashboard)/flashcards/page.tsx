'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CreditCard,
  Plus,
  Search,
  BookOpen,
  Clock,
  TrendingUp,
  MoreVertical,
  Edit,
  Trash2,
  Play,
  BarChart3,
  CloudOff,
  RefreshCw
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'
import { useOfflineDecks } from '@/hooks/useOffline'
import { offlineStorage, STORES } from '@/lib/offlineStorage'
import { syncService } from '@/services/syncService'
import { useOfflineContext } from '@/components/providers/OfflineProvider'
import { useLanguage } from '@/contexts/LanguageContext'
import HelpTooltip from '@/components/ui/HelpTooltip'

interface FlashcardDeck {
  id: string
  title: string
  description: string
  subject_id: string
  subject: {
    id: string
    name: string
    color: string
  }
  total_cards: number
  cards_due: number
  mastered_cards: number
  created_at: string
  last_reviewed_at: string | null
}

export default function FlashcardsPage() {
  // Utiliser le hook offline pour les decks
  const { data: decksData, loading, error, isFromCache, refetch } = useOfflineDecks()
  const { isOnline } = useOfflineContext()
  const { t } = useLanguage()
  const [decks, setDecks] = useState<FlashcardDeck[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Mettre à jour les decks quand les données arrivent
  useEffect(() => {
    if (decksData) {
      setDecks(Array.isArray(decksData) ? decksData : [])
    }
  }, [decksData])

  const filteredDecks = decks.filter((deck) =>
    deck.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deck.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalCardsDue = decks.reduce((sum, deck) => sum + deck.cards_due, 0)
  const totalCards = decks.reduce((sum, deck) => sum + deck.total_cards, 0)
  const totalMastered = decks.reduce((sum, deck) => sum + deck.mastered_cards, 0)

  const deleteDeck = async (deckId: string) => {
    if (!confirm(t('flashcardsPage.confirmDelete'))) return

    const deckToDelete = decks.find(d => d.id === deckId)
    // Mise à jour optimiste
    setDecks(decks.filter(d => d.id !== deckId))

    try {
      if (isOnline) {
        await api.delete(`/flashcards/decks/${encodeURIComponent(deckId)}`)
      } else {
        // Queue pour sync offline
        await syncService.queueAction(
          STORES.FLASHCARD_DECKS,
          'delete',
          `/api/v1/flashcards/decks/${encodeURIComponent(deckId)}`,
          'DELETE',
          { id: deckId }
        )
      }
      // Mettre à jour le cache offline avec la liste sans le deck supprimé
      const updatedDecks = decks.filter(d => d.id !== deckId)
      try { await offlineStorage.saveDecks(updatedDecks) } catch {}
      toast.success(isOnline ? t('flashcardsPage.deckDeleted') : t('flashcardsPage.deckDeletedSync'))
    } catch (error) {
      // Rollback en cas d'erreur
      if (deckToDelete) {
        setDecks([...decks, deckToDelete])
      }
      toast.error(t('flashcardsPage.deleteError'))
    }
  }

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
          <div className="flex items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">{t('flashcardsPage.title')}</h1>
            {isFromCache && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                <CloudOff className="w-3 h-3 mr-1" />
                {t('flashcardsPage.cache')}
              </span>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {decks.length} decks • {totalCards} {t('flashcardsPage.cardsCount', { count: '' }).replace('{count} ', '')}
            {isFromCache && !isOnline && ` • ${t('flashcardsPage.offlineMode')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFromCache && isOnline && (
            <button
              onClick={() => refetch()}
              className="inline-flex items-center justify-center p-2 sm:px-4 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          <Link
            href="/flashcards/new"
            className="inline-flex items-center justify-center px-4 py-2 sm:px-6 sm:py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold text-sm sm:text-base"
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">{t('flashcardsPage.newDeck')}</span>
            <span className="sm:hidden">Créer</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 sm:p-4 lg:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <HelpTooltip content={t('tooltips.flashcards.cardsDue')} size="sm" />
          </div>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-0.5 sm:mb-1">{totalCardsDue}</h3>
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{t('flashcardsPage.cardsToReview')}</p>
          {totalCardsDue > 0 && (
            <Link
              href="/flashcards/review-all"
              className="mt-2 sm:mt-4 inline-flex items-center text-xs sm:text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <Play className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">{t('flashcardsPage.startReview')}</span>
              <span className="sm:hidden">Réviser</span>
            </Link>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 sm:p-4 lg:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <HelpTooltip content={t('tooltips.flashcards.totalCards')} size="sm" />
          </div>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-0.5 sm:mb-1">{totalCards}</h3>
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{t('flashcardsPage.totalCards')}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 sm:p-4 lg:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-green-600 dark:text-green-400" />
            </div>
            <HelpTooltip content={t('tooltips.flashcards.mastered')} size="sm" />
          </div>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-0.5 sm:mb-1">{totalMastered}</h3>
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{t('flashcardsPage.masteredCards')}</p>
          <div className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {totalCards > 0 ? Math.round((totalMastered / totalCards) * 100) : 0}% {t('flashcardsPage.progression')}
          </div>
        </div>
      </div>

      {/* Info sur la répétition espacée */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800/30">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-1">
              {t('flashcards.spacedRepetitionTitle') || 'Répétition espacée'}
            </h4>
            <p className="text-xs sm:text-sm text-purple-700 dark:text-purple-300">
              {t('tooltips.flashcards.spacedRepetition')}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('flashcardsPage.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Decks Grid */}
      {filteredDecks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-12 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <CreditCard className="h-8 w-8 sm:h-10 sm:w-10 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {searchQuery ? t('flashcardsPage.noDeckFound') : t('flashcardsPage.noDeckYet')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-2 text-sm sm:text-base">
            {searchQuery
              ? t('flashcardsPage.tryDifferentSearch')
              : t('flashcardsPage.createFirstDeck')}
          </p>
          {!searchQuery && (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4 sm:mb-6 max-w-md mx-auto">
                {t('tooltips.emptyStates.flashcards')}
              </p>
              <Link
                href="/flashcards/new"
                className="inline-flex items-center justify-center px-4 py-2 sm:px-6 sm:py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold text-sm sm:text-base"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                {t('flashcardsPage.createMyFirstDeck')}
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          {filteredDecks.map((deck) => {
            const progressPercent = deck.total_cards > 0
              ? Math.round((deck.mastered_cards / deck.total_cards) * 100)
              : 0

            return (
              <div
                key={deck.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition group"
              >
                <div className="p-3 sm:p-4 lg:p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2 sm:mb-4">
                    <div className="flex-1 min-w-0">
                      {deck.subject && (
                        <span
                          className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium inline-block mb-2 truncate max-w-[120px] sm:max-w-none"
                          style={{
                            backgroundColor: `${deck.subject.color}20`,
                            color: deck.subject.color,
                          }}
                        >
                          {deck.subject.name}
                        </span>
                      )}
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2 truncate">
                        {deck.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {deck.description}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-2 sm:mb-4 py-2 sm:py-4 border-t border-b border-gray-200 dark:border-gray-700">
                    <div className="text-center">
                      <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{deck.total_cards}</div>
                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('flashcardsPage.total')}</div>
                    </div>
                    <div className="text-center border-l border-r border-gray-200 dark:border-gray-700">
                      <div className="text-base sm:text-lg font-bold text-orange-600 dark:text-orange-400">{deck.cards_due}</div>
                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('flashcardsPage.toReview')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-base sm:text-lg font-bold text-green-600 dark:text-green-400">{deck.mastered_cards}</div>
                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('flashcardsPage.mastered')}</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-2 sm:mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <span>{t('flashcardsPage.progress')}</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 sm:h-2">
                      <div
                        className="bg-gradient-to-r from-green-500 to-green-600 h-1.5 sm:h-2 rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    {deck.cards_due > 0 && (
                      <Link
                        href={`/flashcards/${deck.id}/review`}
                        className="flex-1 px-2 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-xs sm:text-sm font-medium text-center flex items-center justify-center"
                      >
                        <Play className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        {t('flashcardsPage.review')}
                      </Link>
                    )}
                    <Link
                      href={`/flashcards/${deck.id}`}
                      className="flex-1 px-2 sm:px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition text-xs sm:text-sm font-medium text-center flex items-center justify-center"
                    >
                      <BookOpen className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      {t('flashcardsPage.view')}
                    </Link>
                    <button
                      onClick={() => deleteDeck(deck.id)}
                      className="p-1.5 sm:p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </div>

                  {/* Last Review */}
                  {deck.last_reviewed_at && (
                    <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">{t('flashcardsPage.lastReview')}:</span> {new Date(deck.last_reviewed_at).toLocaleDateString()}
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
