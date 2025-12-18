'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, FileText, CreditCard, Brain, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

interface SearchResult {
  id: number
  title: string
  type: 'note' | 'flashcard' | 'quiz'
  description?: string
}

interface GlobalSearchProps {
  isOpen: boolean
  onClose: () => void
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
    if (!isOpen) {
      setQuery('')
      setResults([])
      setActiveIndex(0)
    }
  }, [isOpen])

  // OPTIMISÉ: Utilise les endpoints de recherche côté serveur
  // au lieu de charger TOUT le contenu et filtrer côté client
  const searchAll = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      // Utiliser les endpoints de recherche serveur - beaucoup plus efficace!
      const [notesRes, decksRes, quizzesRes] = await Promise.allSettled([
        api.get('/notes/search', { params: { q: searchQuery, page_size: 5 } }),
        api.get('/flashcards/decks/', { params: { search: searchQuery, page_size: 5 } }),
        api.get('/quizzes/', { params: { page_size: 10 } }) // Quiz n'a pas de search, on filtre
      ])

      const allResults: SearchResult[] = []
      const lowerQuery = searchQuery.toLowerCase()

      // Notes - déjà filtrées par le serveur
      if (notesRes.status === 'fulfilled') {
        const notes = notesRes.value.data.notes || notesRes.value.data || []
        notes.slice(0, 5).forEach((n: any) => {
          allResults.push({
            id: n.id,
            title: n.title,
            type: 'note',
            description: n.content ? n.content.substring(0, 80) + '...' : ''
          })
        })
      }

      // Flashcard decks - filtrage serveur si disponible, sinon client
      if (decksRes.status === 'fulfilled') {
        let decks = decksRes.value.data.decks || decksRes.value.data || []
        // Filtrage client de secours si le serveur ne supporte pas le search
        if (!decksRes.value.config?.params?.search) {
          decks = decks.filter((d: any) =>
            d.title?.toLowerCase().includes(lowerQuery) ||
            d.deck_name?.toLowerCase().includes(lowerQuery) ||
            (d.description && d.description.toLowerCase().includes(lowerQuery))
          )
        }
        decks.slice(0, 5).forEach((d: any) => {
          allResults.push({
            id: d.id || d.deck_name,
            title: d.title || d.deck_name,
            type: 'flashcard',
            description: d.description || `${d.card_count || 0} cartes`
          })
        })
      }

      // Quizzes - filtrage client (pas d'endpoint search dédié)
      if (quizzesRes.status === 'fulfilled') {
        const allQuizzes = quizzesRes.value.data || []
        const quizzes = allQuizzes.filter((q: any) =>
          q.title?.toLowerCase().includes(lowerQuery) ||
          (q.description && q.description.toLowerCase().includes(lowerQuery))
        )
        quizzes.slice(0, 5).forEach((q: any) => {
          allResults.push({
            id: q.id,
            title: q.title,
            type: 'quiz',
            description: q.description || `${q.total_questions || 0} questions`
          })
        })
      }

      setResults(allResults)
      setActiveIndex(0)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      searchAll(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, searchAll])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[activeIndex]) {
      handleSelect(results[activeIndex])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const handleSelect = (result: SearchResult) => {
    onClose()
    switch (result.type) {
      case 'note':
        router.push(`/notes/${result.id}`)
        break
      case 'flashcard':
        router.push(`/flashcards/${result.id}`)
        break
      case 'quiz':
        router.push(`/quizzes/${result.id}`)
        break
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'note':
        return <FileText className="w-5 h-5 text-blue-500" />
      case 'flashcard':
        return <CreditCard className="w-5 h-5 text-green-500" />
      case 'quiz':
        return <Brain className="w-5 h-5 text-purple-500" />
      default:
        return null
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'note':
        return 'Note'
      case 'flashcard':
        return 'Flashcard'
      case 'quiz':
        return 'Quiz'
      default:
        return ''
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Search Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center px-4 border-b border-gray-200 dark:border-gray-700">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Rechercher notes, flashcards, quiz..."
                  className="flex-1 px-4 py-4 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
                />
                {isLoading ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                ) : query && (
                  <button onClick={() => setQuery('')} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Results */}
              <div className="max-h-96 overflow-y-auto">
                {results.length > 0 ? (
                  <ul className="py-2">
                    {results.map((result, index) => (
                      <li key={`${result.type}-${result.id}`}>
                        <button
                          onClick={() => handleSelect(result)}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            index === activeIndex
                              ? 'bg-primary-50 dark:bg-primary-900/30'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          {getIcon(result.type)}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {result.title}
                            </p>
                            {result.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {result.description}
                              </p>
                            )}
                          </div>
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            {getTypeLabel(result.type)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : query.length >= 2 && !isLoading ? (
                  <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                    Aucun résultat pour "{query}"
                  </div>
                ) : query.length < 2 && query.length > 0 ? (
                  <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                    Tape au moins 2 caractères pour rechercher
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                    <p>Recherche rapide</p>
                    <p className="text-xs mt-2">Utilise les flèches pour naviguer, Entrée pour sélectionner</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↑↓</kbd> naviguer
                    <kbd className="ml-2 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↵</kbd> sélectionner
                    <kbd className="ml-2 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">esc</kbd> fermer
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default GlobalSearch
