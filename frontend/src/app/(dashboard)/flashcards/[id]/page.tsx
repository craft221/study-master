'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Play,
  BookOpen,
  BarChart3,
  Download,
  Sparkles,
  Globe,
  Lock,
  CreditCard
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'
import LaTeXEditor from '@/components/LaTeXEditor'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { useLanguage } from '@/contexts/LanguageContext'

interface Flashcard {
  id: string
  front: string
  back: string
  difficulty: number
  easiness_factor: number
  interval: number
  repetitions: number
  next_review_at: string
  mastery_percentage: number
}

interface Subject {
  name: string
  color: string
}

interface Deck {
  id: string
  title: string
  description: string
  subject?: Subject | null
  subject_id?: string
  cards: Flashcard[]
  total_cards: number
  cards_due: number
  mastered_cards: number
  is_public: boolean
  language: string
}

export default function FlashcardDeckPage() {
  const params = useParams()
  const router = useRouter()
  const { t, locale } = useLanguage()
  const deckId = decodeURIComponent(params.id as string)

  const localeMap: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', ar: 'ar-SA' }
  const dateLocale = localeMap[locale] || 'fr-FR'

  const [deck, setDeck] = useState<Deck | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddCard, setShowAddCard] = useState(false)
  const [newCard, setNewCard] = useState({ front: '', back: '' })

  useEffect(() => {
    fetchDeck()
  }, [deckId])

  const fetchDeck = async () => {
    try {
      const response = await api.get(`/flashcards/decks/${encodeURIComponent(deckId)}`)
      setDeck(response.data)
    } catch (error) {
      toast.error(t('flashcardsPage.detail.errorLoad'))
      router.push('/flashcards')
    } finally {
      setLoading(false)
    }
  }

  const addCard = async () => {
    if (!newCard.front.trim() || !newCard.back.trim()) {
      toast.error(t('flashcardsPage.detail.fillBothSides'))
      return
    }

    try {
      await api.post(`/flashcards/decks/${encodeURIComponent(deckId)}/cards`, newCard)
      toast.success(t('flashcardsPage.detail.cardAdded'))
      setNewCard({ front: '', back: '' })
      setShowAddCard(false)
      fetchDeck()
    } catch (error) {
      toast.error(t('flashcardsPage.detail.errorAdd'))
    }
  }

  const deleteCard = async (cardId: string) => {
    if (!confirm(t('flashcardsPage.detail.confirmDeleteCard'))) return

    try {
      await api.delete(`/flashcards/${cardId}`)
      toast.success(t('flashcardsPage.detail.cardDeleted'))
      fetchDeck()
    } catch (error) {
      toast.error(t('flashcardsPage.detail.errorDelete'))
    }
  }

  const deleteDeck = async () => {
    if (!confirm(t('flashcardsPage.detail.confirmDeleteDeck'))) return

    try {
      await api.delete(`/flashcards/decks/${encodeURIComponent(deckId)}`)
      toast.success(t('flashcardsPage.detail.deckDeleted'))
      router.push('/flashcards')
    } catch (error) {
      toast.error(t('flashcardsPage.detail.errorGeneric'))
    }
  }

  const togglePublic = async () => {
    if (!deck) return
    try {
      const newPublicState = !deck.is_public
      await api.patch(`/explore/flashcards/deck/visibility?deck_name=${encodeURIComponent(deck.title)}&subject_id=${deck.subject_id || 0}`, {
        is_public: newPublicState
      })
      setDeck({ ...deck, is_public: newPublicState })
      toast.success(newPublicState ? t('flashcardsPage.detail.madePublic') : t('flashcardsPage.detail.madePrivate'))
    } catch (error) {
      toast.error(t('flashcardsPage.detail.errorVisibility'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!deck) return null

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.push('/flashcards')}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <ArrowLeft className="h-6 w-6 text-gray-700" />
        </button>
        <div className="flex-1">
          {deck.subject && (
            <div className="flex items-center space-x-2 mb-1">
              <span
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${deck.subject.color}20`,
                  color: deck.subject.color,
                }}
              >
                {deck.subject.name}
              </span>
            </div>
          )}
          <h1 className="text-3xl font-bold text-gray-900">{deck.title}</h1>
          <p className="text-gray-600 mt-1">{deck.description}</p>
        </div>
      </div>

      {/* Stats & Actions */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-gray-900 mb-1">{deck.total_cards}</div>
          <div className="text-sm text-gray-600">{t('flashcardsPage.detail.totalCards')}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-orange-600 mb-1">{deck.cards_due}</div>
          <div className="text-sm text-gray-600">{t('flashcardsPage.detail.toReview')}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-green-600 mb-1">{deck.mastered_cards}</div>
          <div className="text-sm text-gray-600">{t('flashcardsPage.detail.mastered')}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-blue-600 mb-1">
            {deck.total_cards > 0 ? Math.round((deck.mastered_cards / deck.total_cards) * 100) : 0}%
          </div>
          <div className="text-sm text-gray-600">{t('flashcardsPage.detail.progress')}</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {deck.cards_due > 0 && (
          <button
            onClick={() => router.push(`/flashcards/${deckId}/review`)}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold flex items-center space-x-2"
          >
            <Play className="h-5 w-5" />
            <span>{t('flashcardsPage.detail.reviewBtn', { count: deck.cards_due })}</span>
          </button>
        )}
        <button
          onClick={() => setShowAddCard(!showAddCard)}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>{t('flashcardsPage.detail.addCard')}</span>
        </button>
        <button
          onClick={deleteDeck}
          className="px-6 py-3 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition font-semibold flex items-center space-x-2"
        >
          <Trash2 className="h-5 w-5" />
          <span>{t('flashcardsPage.detail.deleteDeck')}</span>
        </button>
        <button
          onClick={togglePublic}
          className={`px-6 py-3 rounded-lg transition font-semibold flex items-center space-x-2 ${
            deck.is_public
              ? 'bg-green-50 text-green-700 hover:bg-green-100'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
          }`}
        >
          {deck.is_public ? (
            <>
              <Globe className="h-5 w-5" />
              <span>{t('flashcardsPage.detail.public')}</span>
            </>
          ) : (
            <>
              <Lock className="h-5 w-5" />
              <span>{t('flashcardsPage.detail.makePublic')}</span>
            </>
          )}
        </button>
      </div>

      {/* Add Card Form */}
      {showAddCard && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('flashcardsPage.detail.newCard')}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('flashcardsPage.detail.frontLabel')}
              </label>
              <LaTeXEditor
                value={newCard.front}
                onChange={(front) => setNewCard({ ...newCard, front })}
                placeholder={t('flashcardsPage.detail.frontPlaceholder')}
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('flashcardsPage.detail.backLabel')}
              </label>
              <LaTeXEditor
                value={newCard.back}
                onChange={(back) => setNewCard({ ...newCard, back })}
                placeholder={t('flashcardsPage.detail.backPlaceholder')}
                rows={4}
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={addCard}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
              >
                {t('flashcardsPage.detail.add')}
              </button>
              <button
                onClick={() => {
                  setShowAddCard(false)
                  setNewCard({ front: '', back: '' })
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                {t('flashcardsPage.detail.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cards List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {t('flashcardsPage.detail.allCards', { count: deck.cards?.length || 0 })}
          </h2>
        </div>
        <div className="divide-y divide-gray-200">
          {deck.cards && deck.cards.length > 0 ? (
            deck.cards.map((card) => {
              const isMastered = card.mastery_percentage >= 80
              const isDue = !card.next_review_at || new Date(card.next_review_at) <= new Date()

              const statusLabel = isMastered ? t('flashcardsPage.detail.statusMastered') : (isDue ? t('flashcardsPage.detail.statusToReview') : t('flashcardsPage.detail.statusInProgress'))
              const statusColor = isMastered ? 'bg-green-100 text-green-700' :
                                  (isDue ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700')

              return (
                <div key={card.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 grid md:grid-cols-2 gap-6">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">{t('flashcardsPage.detail.front')}</div>
                        <MarkdownRenderer content={card.front} />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">{t('flashcardsPage.detail.back')}</div>
                        <MarkdownRenderer content={card.back} />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>
                        {statusLabel}
                      </span>
                      <button
                        onClick={() => deleteCard(card.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center space-x-4 text-xs text-gray-500">
                    <span>{t('flashcardsPage.detail.repetitions', { count: card.repetitions })}</span>
                    <span>{t('flashcardsPage.detail.interval', { days: card.interval })}</span>
                    <span>{t('flashcardsPage.detail.factor', { value: card.easiness_factor.toFixed(2) })}</span>
                    <span className={card.mastery_percentage >= 80 ? 'text-green-600 font-medium' : ''}>
                      {t('flashcardsPage.detail.mastery', { percent: Math.round(card.mastery_percentage) })}
                    </span>
                    <span>
                      {t('flashcardsPage.detail.nextReview', { date: card.next_review_at ? new Date(card.next_review_at).toLocaleDateString(dateLocale) : t('flashcardsPage.detail.now') })}
                    </span>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="p-12 text-center text-gray-500">
              <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>{t('flashcardsPage.detail.noCards')}</p>
              <button
                onClick={() => setShowAddCard(true)}
                className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
              >
                {t('flashcardsPage.detail.addFirstCard')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
