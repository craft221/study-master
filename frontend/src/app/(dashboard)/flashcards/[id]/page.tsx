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
  Sparkles
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'
import LaTeXEditor from '@/components/LaTeXEditor'
import MarkdownRenderer from '@/components/MarkdownRenderer'

interface Flashcard {
  id: string
  front: string
  back: string
  difficulty: number
  easiness_factor: number
  interval: number
  repetitions: number
  next_review_at: string
}

interface Deck {
  id: string
  title: string
  description: string
  subject: {
    name: string
    color: string
  }
  cards: Flashcard[]
  total_cards: number
  cards_due: number
  mastered_cards: number
}

export default function FlashcardDeckPage() {
  const params = useParams()
  const router = useRouter()
  const deckId = params.id as string

  const [deck, setDeck] = useState<Deck | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddCard, setShowAddCard] = useState(false)
  const [newCard, setNewCard] = useState({ front: '', back: '' })

  useEffect(() => {
    fetchDeck()
  }, [deckId])

  const fetchDeck = async () => {
    try {
      const response = await api.get(`/flashcards/decks/${deckId}`)
      setDeck(response.data)
    } catch (error) {
      toast.error('Erreur lors du chargement du deck')
      router.push('/flashcards')
    } finally {
      setLoading(false)
    }
  }

  const addCard = async () => {
    if (!newCard.front.trim() || !newCard.back.trim()) {
      toast.error('Remplissez les deux côtés de la carte')
      return
    }

    try {
      await api.post(`/flashcards/decks/${deckId}/cards`, newCard)
      toast.success('Carte ajoutée!')
      setNewCard({ front: '', back: '' })
      setShowAddCard(false)
      fetchDeck()
    } catch (error) {
      toast.error('Erreur lors de l\'ajout')
    }
  }

  const deleteCard = async (cardId: string) => {
    if (!confirm('Supprimer cette carte?')) return

    try {
      await api.delete(`/flashcards/${cardId}`)
      toast.success('Carte supprimée')
      fetchDeck()
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const deleteDeck = async () => {
    if (!confirm('Supprimer ce deck et toutes ses cartes?')) return

    try {
      await api.delete(`/flashcards/decks/${deckId}`)
      toast.success('Deck supprimé')
      router.push('/flashcards')
    } catch (error) {
      toast.error('Erreur')
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
          <h1 className="text-3xl font-bold text-gray-900">{deck.title}</h1>
          <p className="text-gray-600 mt-1">{deck.description}</p>
        </div>
      </div>

      {/* Stats & Actions */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-gray-900 mb-1">{deck.total_cards}</div>
          <div className="text-sm text-gray-600">Cartes totales</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-orange-600 mb-1">{deck.cards_due}</div>
          <div className="text-sm text-gray-600">À réviser</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-green-600 mb-1">{deck.mastered_cards}</div>
          <div className="text-sm text-gray-600">Maîtrisées</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-blue-600 mb-1">
            {deck.total_cards > 0 ? Math.round((deck.mastered_cards / deck.total_cards) * 100) : 0}%
          </div>
          <div className="text-sm text-gray-600">Progression</div>
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
            <span>Réviser ({deck.cards_due})</span>
          </button>
        )}
        <button
          onClick={() => setShowAddCard(!showAddCard)}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Ajouter une carte</span>
        </button>
        <button
          onClick={deleteDeck}
          className="px-6 py-3 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition font-semibold flex items-center space-x-2"
        >
          <Trash2 className="h-5 w-5" />
          <span>Supprimer le deck</span>
        </button>
      </div>

      {/* Add Card Form */}
      {showAddCard && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Nouvelle Carte</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recto (Question)
              </label>
              <LaTeXEditor
                value={newCard.front}
                onChange={(front) => setNewCard({ ...newCard, front })}
                placeholder="Quelle est la capitale de la France? (Markdown et LaTeX supportés)"
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verso (Réponse)
              </label>
              <LaTeXEditor
                value={newCard.back}
                onChange={(back) => setNewCard({ ...newCard, back })}
                placeholder="Paris (Markdown et LaTeX supportés)"
                rows={4}
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={addCard}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
              >
                Ajouter
              </button>
              <button
                onClick={() => {
                  setShowAddCard(false)
                  setNewCard({ front: '', back: '' })
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cards List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Toutes les cartes ({deck.cards?.length || 0})
          </h2>
        </div>
        <div className="divide-y divide-gray-200">
          {deck.cards && deck.cards.length > 0 ? (
            deck.cards.map((card) => {
              const isDue = new Date(card.next_review_at) <= new Date()
              const difficultyColor = 
                card.difficulty === 0 ? 'bg-red-100 text-red-700' :
                card.difficulty === 1 ? 'bg-orange-100 text-orange-700' :
                card.difficulty === 2 ? 'bg-blue-100 text-blue-700' :
                'bg-green-100 text-green-700'

              return (
                <div key={card.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 grid md:grid-cols-2 gap-6">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">RECTO</div>
                        <MarkdownRenderer content={card.front} />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">VERSO</div>
                        <MarkdownRenderer content={card.back} />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${difficultyColor}`}>
                        {isDue ? 'À réviser' : 'Maîtrisée'}
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
                    <span>Répétitions: {card.repetitions}</span>
                    <span>Intervalle: {card.interval} jours</span>
                    <span>Facteur: {card.easiness_factor.toFixed(2)}</span>
                    <span>
                      Prochaine révision: {new Date(card.next_review_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="p-12 text-center text-gray-500">
              <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>Aucune carte dans ce deck</p>
              <button
                onClick={() => setShowAddCard(true)}
                className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
              >
                Ajouter votre première carte
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
