'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Lightbulb, X, CheckCircle } from 'lucide-react'

interface SparkAnswerCardProps {
  answer: string
  suggestions?: string[]
  onClose: () => void
  onSuggestionClick?: (suggestion: string) => void
}

/**
 * Carte affichant la réponse de Spark avec suggestions
 */
const SparkAnswerCard: React.FC<SparkAnswerCardProps> = ({
  answer,
  suggestions = [],
  onClose,
  onSuggestionClick
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: 'spring', duration: 0.4 }}
      className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] z-40"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3">
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
                Spark te répond
              </h3>
              <p className="text-white/90 text-xs">
                Avec l'aide de l'IA ⚡
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Answer */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
              {answer}
            </p>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                Actions suggérées
              </div>

              <div className="space-y-2">
                {suggestions.map((suggestion, idx) => (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={() => onSuggestionClick?.(suggestion)}
                    className="w-full flex items-start gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 hover:from-amber-50 hover:to-orange-50 dark:hover:from-amber-900/30 dark:hover:to-orange-900/30 border border-gray-200 dark:border-gray-600 hover:border-amber-300 dark:hover:border-amber-700 transition-all text-left group"
                  >
                    <CheckCircle className="w-4 h-4 text-gray-400 group-hover:text-amber-500 transition-colors flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                      {suggestion}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              💡 Besoin de plus d'aide ? Clique sur Spark pour poser une autre question !
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default SparkAnswerCard
