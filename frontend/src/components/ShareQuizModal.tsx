'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Share2,
  Copy,
  MessageCircle,
  Twitter,
  Facebook,
  Link2,
  Users,
  TrendingUp,
  Eye,
  Check,
  Loader2,
  QrCode
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

interface ShareQuizModalProps {
  isOpen: boolean
  onClose: () => void
  quizId: number
  quizTitle: string
}

interface ShareStats {
  share_code: string
  share_url: string
  is_public: boolean
  total_plays: number
  total_shares: number
  total_guest_attempts?: number
  average_guest_score?: number
  conversion_rate?: number
}

const ShareQuizModal: React.FC<ShareQuizModalProps> = ({
  isOpen,
  onClose,
  quizId,
  quizTitle
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [shareStats, setShareStats] = useState<ShareStats | null>(null)
  const [copied, setCopied] = useState(false)

  // Activer le partage et récupérer les stats
  useEffect(() => {
    if (isOpen && quizId) {
      enableSharing()
    }
  }, [isOpen, quizId])

  const enableSharing = async () => {
    setIsLoading(true)
    try {
      const response = await api.post(`/quizzes/${quizId}/share`)
      setShareStats(response.data)

      // Récupérer les stats détaillées
      try {
        const statsResponse = await api.get(`/quizzes/${quizId}/share/stats`)
        setShareStats(prev => ({ ...prev, ...statsResponse.data }))
      } catch (e) {
        // Stats optionnelles
      }
    } catch (error) {
      toast.error('Erreur lors de l\'activation du partage')
    } finally {
      setIsLoading(false)
    }
  }

  const getFullShareUrl = () => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/play/${shareStats?.share_code}`
  }

  const handleCopy = async () => {
    const url = getFullShareUrl()
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Lien copié !')
    setTimeout(() => setCopied(false), 2000)

    // Tracker le partage
    trackShare('copy')
  }

  const trackShare = async (platform: string) => {
    try {
      await api.post(`/public/quiz/${shareStats?.share_code}/track-share?platform=${platform}`)
    } catch (e) {
      // Non bloquant
    }
  }

  const handleShare = (platform: string) => {
    const url = getFullShareUrl()
    const text = `J'ai créé un quiz "${quizTitle}" sur Study Master ! Teste tes connaissances !`

    trackShare(platform)

    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank')
        break
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank')
        break
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank')
        break
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

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Share2 className="w-6 h-6" />
                    <h2 className="text-xl font-bold">Partager le quiz</h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-1 hover:bg-white/20 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-white/80 text-sm mt-1">{quizTitle}</p>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              ) : shareStats ? (
                <div className="p-6 space-y-6">
                  {/* Lien de partage */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Lien de partage
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3 text-sm text-gray-600 dark:text-gray-300 truncate">
                        {getFullShareUrl()}
                      </div>
                      <button
                        onClick={handleCopy}
                        className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                          copied
                            ? 'bg-green-500 text-white'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                        }`}
                      >
                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Boutons de partage */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Partager sur
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => handleShare('whatsapp')}
                        className="flex flex-col items-center gap-2 p-4 bg-green-500 hover:bg-green-600 text-white rounded-xl transition"
                      >
                        <MessageCircle className="w-6 h-6" />
                        <span className="text-xs font-medium">WhatsApp</span>
                      </button>
                      <button
                        onClick={() => handleShare('twitter')}
                        className="flex flex-col items-center gap-2 p-4 bg-blue-400 hover:bg-blue-500 text-white rounded-xl transition"
                      >
                        <Twitter className="w-6 h-6" />
                        <span className="text-xs font-medium">Twitter</span>
                      </button>
                      <button
                        onClick={() => handleShare('facebook')}
                        className="flex flex-col items-center gap-2 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition"
                      >
                        <Facebook className="w-6 h-6" />
                        <span className="text-xs font-medium">Facebook</span>
                      </button>
                    </div>
                  </div>

                  {/* Statistiques */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Statistiques
                    </h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-purple-600">{shareStats.total_plays || 0}</p>
                        <p className="text-xs text-gray-500">Parties</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">{shareStats.total_shares || 0}</p>
                        <p className="text-xs text-gray-500">Partages</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-amber-600">
                          {shareStats.average_guest_score?.toFixed(0) || 0}%
                        </p>
                        <p className="text-xs text-gray-500">Score moyen</p>
                      </div>
                    </div>
                  </div>

                  {/* Info virale */}
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>Astuce virale :</strong> Les amis qui jouent peuvent s'inscrire et ça booste ton XP !
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  Une erreur s'est produite
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default ShareQuizModal
