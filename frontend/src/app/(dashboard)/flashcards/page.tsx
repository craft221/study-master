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
  BarChart3
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'

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
  const [decks, setDecks] = useState<FlashcardDeck[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchDecks()
  }, [])

  const fetchDecks = async () => {
    try {
      // Utiliser le trailing slash pour éviter la redirection 307
      const response = await api.get('/flashcards/')
      console.log('✅ Flashcards loaded:', response.data)
      // L'API retourne probablement un tableau directement ou {flashcards: []}
      const flashcardsData = Array.isArray(response.data) ? response.data : (response.data.flashcards || [])
      setDecks(flashcardsData)
    } catch (error: any) {
      console.error('❌ Error loading flashcards:', error)
      toast.error('Erreur lors du chargement des flashcards')
    } finally {
      setLoading(false)
    }
  }

  const filteredDecks = decks.filter((deck) =>
    deck.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deck.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalCardsDue = decks.reduce((sum, deck) => sum + deck.cards_due, 0)
  const totalCards = decks.reduce((sum, deck) => sum + deck.total_cards, 0)
  const totalMastered = decks.reduce((sum, deck) => sum + deck.mastered_cards, 0)

  const deleteDeck = async (deckId: string) => {
    if (!confirm('Supprimer ce deck et toutes ses cartes?')) return

    try {
      await api.delete(`/flashcards/decks/${deckId}`)
      setDecks(decks.filter(d => d.id !== deckId))
      toast.success('Deck supprimé')
    } catch (error) {
      toast.error('Erreur lors de la suppression')
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Flashcards</h1>
          <p className="text-gray-600 mt-1">{decks.length} decks • {totalCards} cartes</p>
        </div>
        <Link
          href="/flashcards/new"
          className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouveau deck
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{totalCardsDue}</h3>
          <p className="text-gray-600 text-sm">Cartes à réviser</p>
          {totalCardsDue > 0 && (
            <Link
              href="/flashcards/review-all"
              className="mt-4 inline-flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <Play className="h-4 w-4 mr-1" />
              Commencer la révision
            </Link>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{totalCards}</h3>
          <p className="text-gray-600 text-sm">Cartes totales</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{totalMastered}</h3>
          <p className="text-gray-600 text-sm">Cartes maîtrisées</p>
          <div className="mt-2 text-sm text-gray-500">
            {totalCards > 0 ? Math.round((totalMastered / totalCards) * 100) : 0}% de progression
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un deck..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Decks Grid */}
      {filteredDecks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <CreditCard className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchQuery ? 'Aucun deck trouvé' : 'Aucun deck pour le moment'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchQuery
              ? 'Essayez de modifier votre recherche'
              : 'Créez votre premier deck de flashcards pour commencer à réviser'}
          </p>
          {!searchQuery && (
            <Link
              href="/flashcards/new"
              className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
            >
              <Plus className="h-5 w-5 mr-2" />
              Créer mon premier deck
            </Link>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDecks.map((deck) => {
            const progressPercent = deck.total_cards > 0
              ? Math.round((deck.mastered_cards / deck.total_cards) * 100)
              : 0

            return (
              <div
                key={deck.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition group"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-medium inline-block mb-2"
                        style={{
                          backgroundColor: `${deck.subject.color}20`,
                          color: deck.subject.color,
                        }}
                      >
                        {deck.subject.name}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {deck.title}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {deck.description}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4 py-4 border-t border-b border-gray-200">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{deck.total_cards}</div>
                      <div className="text-xs text-gray-500">Total</div>
                    </div>
                    <div className="text-center border-l border-r border-gray-200">
                      <div className="text-lg font-bold text-orange-600">{deck.cards_due}</div>
                      <div className="text-xs text-gray-500">À réviser</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">{deck.mastered_cards}</div>
                      <div className="text-xs text-gray-500">Maîtrisées</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Progression</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    {deck.cards_due > 0 && (
                      <Link
                        href={`/flashcards/${deck.id}/review`}
                        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium text-center flex items-center justify-center"
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Réviser
                      </Link>
                    )}
                    <Link
                      href={`/flashcards/${deck.id}`}
                      className={`${deck.cards_due > 0 ? 'flex-1' : 'flex-1'} px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium text-center flex items-center justify-center`}
                    >
                      <BookOpen className="h-4 w-4 mr-1" />
                      Voir
                    </Link>
                    <button
                      onClick={() => deleteDeck(deck.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Last Review */}
                  {deck.last_reviewed_at && (
                    <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      Dernière révision: {new Date(deck.last_reviewed_at).toLocaleDateString('fr-FR')}
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
