'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Lightbulb, X, Send, BookOpen, FileQuestion, Layers, Loader2 } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useRouter } from 'next/navigation'

interface ConversationMessage {
  role: 'user' | 'spark'
  content: string
  timestamp: string
}

interface SparkAnswerCardProps {
  answer: string
  suggestions?: string[]
  onClose: () => void
  onSuggestionClick?: (suggestion: string) => void
  onFollowUp?: (question: string) => Promise<void>
  isLoading?: boolean
  conversationHistory?: ConversationMessage[]
}

/**
 * Carte affichant la réponse de Spark avec conversation continue
 */
const SparkAnswerCard: React.FC<SparkAnswerCardProps> = ({
  answer,
  suggestions = [],
  onClose,
  onSuggestionClick,
  onFollowUp,
  isLoading = false,
  conversationHistory = []
}) => {
  const { t } = useLanguage()
  const router = useRouter()
  const [followUpQuestion, setFollowUpQuestion] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversationHistory, answer])

  // Focus input when card opens
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus()
    }
  }, [isLoading])

  const handleFollowUp = async () => {
    if (!followUpQuestion.trim() || isLoading || !onFollowUp) return

    const question = followUpQuestion.trim()
    setFollowUpQuestion('')
    await onFollowUp(question)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleFollowUp()
    }
  }

  // Handle action suggestions - navigate to appropriate pages
  const handleActionClick = (suggestion: string) => {
    const suggestionLower = suggestion.toLowerCase()

    // Navigation based on suggestion content
    if (suggestionLower.includes('flashcard') || suggestionLower.includes('carte')) {
      router.push('/flashcards')
      onClose()
    } else if (suggestionLower.includes('quiz') || suggestionLower.includes('test')) {
      router.push('/quizzes')
      onClose()
    } else if (suggestionLower.includes('note') || suggestionLower.includes('cours')) {
      router.push('/notes')
      onClose()
    } else if (suggestionLower.includes('planning') || suggestionLower.includes('calendrier') || suggestionLower.includes('schedule')) {
      router.push('/schedule')
      onClose()
    } else if (suggestionLower.includes('répétition') || suggestionLower.includes('spaced') || suggestionLower.includes('révision')) {
      router.push('/flashcards')
      onClose()
    } else if (suggestionLower.includes('tableau') || suggestionLower.includes('dashboard')) {
      router.push('/dashboard')
      onClose()
    } else {
      // For other suggestions, treat as follow-up question
      if (onFollowUp) {
        onFollowUp(suggestion)
      } else {
        onSuggestionClick?.(suggestion)
      }
    }
  }

  // Get icon for suggestion based on content
  const getSuggestionIcon = (suggestion: string) => {
    const suggestionLower = suggestion.toLowerCase()
    if (suggestionLower.includes('flashcard') || suggestionLower.includes('carte')) {
      return <Layers className="w-4 h-4" />
    } else if (suggestionLower.includes('quiz') || suggestionLower.includes('test')) {
      return <FileQuestion className="w-4 h-4" />
    } else if (suggestionLower.includes('note') || suggestionLower.includes('cours')) {
      return <BookOpen className="w-4 h-4" />
    }
    return <Lightbulb className="w-4 h-4" />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: 'spring', duration: 0.4 }}
      className="fixed bottom-24 right-6 w-[420px] max-w-[calc(100vw-3rem)] z-40"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[70vh]">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <div className="text-2xl">🐿️</div>
            <div>
              <h3 className="font-bold text-white text-sm">
                {t('sparkWidget.answerCard.title')}
              </h3>
              <p className="text-white/90 text-xs">
                {t('sparkWidget.answerCard.subtitle')} ⚡
              </p>
            </div>
          </div>
        </div>

        {/* Conversation Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {/* Previous messages in conversation */}
          {conversationHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary-500 text-white'
                    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-gray-800 dark:text-gray-200'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Current answer */}
          <div className="flex justify-start">
            <div className="max-w-[85%] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                {answer}
              </p>
            </div>
          </div>

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-amber-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">{t('sparkWidget.helpDialog.thinking')}</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && !isLoading && (
          <div className="px-4 pb-2 flex-shrink-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
              <Lightbulb className="w-3 h-3 text-amber-500" />
              {t('sparkWidget.answerCard.suggestedActions')}
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.slice(0, 3).map((suggestion, idx) => (
                <motion.button
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => handleActionClick(suggestion)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 hover:from-amber-50 hover:to-orange-50 dark:hover:from-amber-900/30 dark:hover:to-orange-900/30 border border-gray-200 dark:border-gray-600 hover:border-amber-300 dark:hover:border-amber-700 transition-all text-xs group"
                >
                  <span className="text-gray-400 group-hover:text-amber-500 transition-colors">
                    {getSuggestionIcon(suggestion)}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 truncate max-w-[150px]">
                    {suggestion}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Input for follow-up question */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={followUpQuestion}
              onChange={(e) => setFollowUpQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('sparkWidget.answerCard.followUpPlaceholder')}
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleFollowUp}
              disabled={!followUpQuestion.trim() || isLoading}
              className="p-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default SparkAnswerCard
