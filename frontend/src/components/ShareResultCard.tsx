'use client'

import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Trophy,
  Star,
  Target,
  ThumbsUp,
  BookOpen,
  Download,
  Share2,
  Twitter,
  MessageCircle,
  Copy,
  Check,
  X,
  Sparkles
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ShareResultCardProps {
  isOpen: boolean
  onClose: () => void
  cardData: {
    player_name: string
    quiz_title: string
    creator_name: string
    score: number
    correct_count: number
    total_questions: number
    rank: number
    total_players: number
    time_taken_seconds?: number
    performance: string
    performance_emoji: string
    performance_title: string
    share_code: string
  }
  shareUrls: {
    play_url: string
    twitter_text: string
    whatsapp_text: string
  }
}

const performanceConfig: Record<string, { bg: string; icon: React.ElementType; color: string }> = {
  legendary: { bg: 'from-amber-500 via-yellow-400 to-orange-500', icon: Trophy, color: 'text-amber-100' },
  excellent: { bg: 'from-purple-600 via-violet-500 to-indigo-600', icon: Star, color: 'text-purple-100' },
  great: { bg: 'from-green-500 via-emerald-500 to-teal-500', icon: Target, color: 'text-green-100' },
  good: { bg: 'from-blue-500 via-sky-500 to-cyan-500', icon: ThumbsUp, color: 'text-blue-100' },
  learning: { bg: 'from-slate-600 via-gray-600 to-zinc-600', icon: BookOpen, color: 'text-slate-100' }
}

const ShareResultCard: React.FC<ShareResultCardProps> = ({
  isOpen,
  onClose,
  cardData,
  shareUrls
}) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const config = performanceConfig[cardData.performance] || performanceConfig.learning
  const IconComponent = config.icon

  const getFullShareUrl = () => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}${shareUrls.play_url}`
  }

  const handleCopyLink = async () => {
    const url = getFullShareUrl()
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Lien copie !')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = (platform: string) => {
    const url = getFullShareUrl()

    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(shareUrls.whatsapp_text + ' ' + url)}`, '_blank')
        break
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareUrls.twitter_text)}&url=${encodeURIComponent(url)}`, '_blank')
        break
    }
  }

  const handleDownload = async () => {
    if (!cardRef.current) return

    setIsDownloading(true)

    try {
      // Dynamic import de html2canvas
      const html2canvas = (await import('html2canvas')).default

      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        logging: false,
        useCORS: true
      })

      // Telecharger l'image
      const link = document.createElement('a')
      link.download = `resultat-${cardData.quiz_title.replace(/\s+/g, '-').toLowerCase()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()

      toast.success('Image telechargee !')
    } catch (error) {
      console.error('Erreur lors du telechargement:', error)
      toast.error('Erreur lors du telechargement')
    } finally {
      setIsDownloading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-purple-500" />
            Partager mon resultat
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* La carte de resultat */}
        <div className="p-4">
          <div
            ref={cardRef}
            className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${config.bg} p-6 text-white shadow-lg`}
          >
            {/* Effets de fond */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-4 right-4 w-32 h-32 bg-white/20 rounded-full blur-3xl"></div>
              <div className="absolute bottom-4 left-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            </div>

            {/* Contenu */}
            <div className="relative z-10">
              {/* Header avec icone */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-sm font-medium opacity-90">Studera</span>
                </div>
                <div className={`p-2 bg-white/20 rounded-lg backdrop-blur-sm`}>
                  <IconComponent className="w-6 h-6" />
                </div>
              </div>

              {/* Performance badge */}
              <div className="text-center mb-4">
                <span className="text-4xl">{cardData.performance_emoji}</span>
                <h2 className="text-2xl font-black mt-2">{cardData.performance_title}</h2>
              </div>

              {/* Score principal */}
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center mb-4">
                <p className="text-5xl font-black">{Math.round(cardData.score ?? 0)}%</p>
                <p className="text-sm opacity-80 mt-1">
                  {cardData.correct_count ?? 0}/{cardData.total_questions ?? 0} bonnes reponses
                </p>
              </div>

              {/* Infos joueur */}
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="opacity-70">Joueur</p>
                  <p className="font-bold">{cardData.player_name || 'Anonyme'}</p>
                </div>
                <div className="text-right">
                  <p className="opacity-70">Classement</p>
                  <p className="font-bold">#{cardData.rank ?? 1} / {cardData.total_players ?? 1}</p>
                </div>
              </div>

              {/* Titre du quiz */}
              <div className="mt-4 pt-4 border-t border-white/20">
                <p className="text-xs opacity-70 text-center">Quiz</p>
                <p className="font-semibold text-center truncate">{cardData.quiz_title}</p>
                <p className="text-xs opacity-60 text-center mt-1">par {cardData.creator_name}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions de partage */}
        <div className="px-4 pb-4 space-y-3">
          {/* Boutons de partage */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleShare('whatsapp')}
              className="flex flex-col items-center gap-1 p-3 bg-green-500 hover:bg-green-600 text-white rounded-xl transition"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-xs font-medium">WhatsApp</span>
            </button>
            <button
              onClick={() => handleShare('twitter')}
              className="flex flex-col items-center gap-1 p-3 bg-blue-400 hover:bg-blue-500 text-white rounded-xl transition"
            >
              <Twitter className="w-5 h-5" />
              <span className="text-xs font-medium">Twitter</span>
            </button>
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex flex-col items-center gap-1 p-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition disabled:opacity-50"
            >
              <Download className={`w-5 h-5 ${isDownloading ? 'animate-bounce' : ''}`} />
              <span className="text-xs font-medium">{isDownloading ? '...' : 'Image'}</span>
            </button>
          </div>

          {/* Copier le lien */}
          <button
            onClick={handleCopyLink}
            className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl transition ${
              copied
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-5 h-5" />
                <span className="font-medium">Lien copie !</span>
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                <span className="font-medium">Copier le lien du quiz</span>
              </>
            )}
          </button>

          {/* CTA pour rejouer */}
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Defie tes amis a faire mieux !
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export default ShareResultCard
