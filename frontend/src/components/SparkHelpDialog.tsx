'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Loader2 } from 'lucide-react'

interface SparkHelpDialogProps {
  isOpen: boolean
  onClose: () => void
  onAskQuestion: (question: string) => Promise<void>
  isLoading?: boolean
}

/**
 * Dialogue pour poser des questions directes à Spark
 * Spark répond avec l'IA et donne des suggestions personnalisées
 */
const SparkHelpDialog: React.FC<SparkHelpDialogProps> = ({
  isOpen,
  onClose,
  onAskQuestion,
  isLoading = false
}) => {
  const [question, setQuestion] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (question.trim().length < 3) {
      setError('Ta question doit faire au moins 3 caractères')
      return
    }

    if (question.trim().length > 500) {
      setError('Ta question est trop longue (max 500 caractères)')
      return
    }

    setError('')
    await onAskQuestion(question.trim())
    setQuestion('')
  }

  const handleClose = () => {
    setQuestion('')
    setError('')
    onClose()
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
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
          <div className="w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Header */}
              <div className="relative bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
                <button
                  onClick={handleClose}
                  className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
                  disabled={isLoading}
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="text-4xl">🐿️</div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Demande de l'aide à Spark
                    </h2>
                    <p className="text-white/90 text-sm">
                      Je suis là pour t'aider ! ⚡
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label
                    htmlFor="question"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Ta question pour Spark
                  </label>

                  <textarea
                    id="question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Comment puis-je mieux mémoriser ce chapitre ? Comment organiser mes révisions ? Quelles flashcards créer ?"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none"
                    rows={4}
                    disabled={isLoading}
                    maxLength={500}
                  />

                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-500">
                      {question.length}/500 caractères
                    </span>

                    {error && (
                      <span className="text-xs text-red-500">
                        {error}
                      </span>
                    )}
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    💡 <strong>Spark utilise l'IA</strong> pour analyser ta question et ton contexte d'apprentissage.
                    Tu recevras des conseils personnalisés et des suggestions d'actions !
                  </p>
                </div>

                {/* Exemples */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Exemples de questions :
                  </p>
                  <div className="space-y-1">
                    {[
                      "Comment mieux réviser les maths ?",
                      "J'ai du mal à mémoriser, des conseils ?",
                      "Quelle est la meilleure méthode pour apprendre ?",
                    ].map((example, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setQuestion(example)}
                        className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        disabled={isLoading}
                      >
                        "{example}"
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || question.trim().length < 3}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold py-3 px-6 rounded-xl hover:from-amber-600 hover:to-orange-600 focus:ring-4 focus:ring-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Spark réfléchit...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Demander à Spark
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default SparkHelpDialog
