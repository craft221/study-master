'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Share2,
  Copy,
  MessageCircle,
  Twitter,
  Facebook,
  Linkedin,
  Check,
  Loader2,
  Send,
  Link2,
  Sparkles
} from 'lucide-react'
import toast from 'react-hot-toast'
import { socialShareService, ShareType, SharePlatform, ShareResponse } from '@/services/socialShare'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  shareType: ShareType
  title: string
  subtitle?: string
  // Données spécifiques selon le type
  data?: {
    streak_days?: number
    score?: number
    total_questions?: number
    quiz_title?: string
    level?: number
    new_tier?: string
    previous_tier?: string
    xp_earned?: number
    study_time_minutes?: number
    quizzes_completed?: number
    notes_created?: number
    achievement_name?: string
  }
}

// Configuration des icônes et couleurs par type de partage
const SHARE_TYPE_CONFIG: Record<ShareType, { icon: string; gradient: string }> = {
  streak: { icon: '🔥', gradient: 'from-orange-500 to-red-600' },
  quiz_score: { icon: '🎯', gradient: 'from-purple-500 to-indigo-600' },
  level_up: { icon: '⬆️', gradient: 'from-green-500 to-emerald-600' },
  achievement: { icon: '🏆', gradient: 'from-yellow-500 to-amber-600' },
  league_promotion: { icon: '🏅', gradient: 'from-blue-500 to-cyan-600' },
  weekly_stats: { icon: '📊', gradient: 'from-violet-500 to-purple-600' },
  study_time: { icon: '⏱️', gradient: 'from-teal-500 to-cyan-600' },
  duel_victory: { icon: '⚔️', gradient: 'from-red-500 to-rose-600' }
}

// Plateformes de partage avec leurs icônes et couleurs
const PLATFORMS: Array<{
  id: SharePlatform
  name: string
  icon: React.ReactNode
  bgColor: string
  hoverColor: string
}> = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: <MessageCircle className="w-6 h-6" />,
    bgColor: 'bg-green-500',
    hoverColor: 'hover:bg-green-600'
  },
  {
    id: 'twitter',
    name: 'Twitter/X',
    icon: <Twitter className="w-6 h-6" />,
    bgColor: 'bg-black',
    hoverColor: 'hover:bg-gray-800'
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: <Facebook className="w-6 h-6" />,
    bgColor: 'bg-blue-600',
    hoverColor: 'hover:bg-blue-700'
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: <Linkedin className="w-6 h-6" />,
    bgColor: 'bg-blue-700',
    hoverColor: 'hover:bg-blue-800'
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: <Send className="w-6 h-6" />,
    bgColor: 'bg-sky-500',
    hoverColor: 'hover:bg-sky-600'
  },
  {
    id: 'copy',
    name: 'Copier',
    icon: <Copy className="w-6 h-6" />,
    bgColor: 'bg-gray-600',
    hoverColor: 'hover:bg-gray-700'
  }
]

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  shareType,
  title,
  subtitle,
  data = {}
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [loadingPlatform, setLoadingPlatform] = useState<SharePlatform | null>(null)
  const [copied, setCopied] = useState(false)
  const [lastShareResult, setLastShareResult] = useState<ShareResponse | null>(null)
  const [xpEarned, setXpEarned] = useState(0)

  const config = SHARE_TYPE_CONFIG[shareType]

  const handleShare = async (platform: SharePlatform) => {
    setIsLoading(true)
    setLoadingPlatform(platform)

    try {
      let response: ShareResponse

      // Appeler l'API appropriée selon le type de partage
      switch (shareType) {
        case 'streak':
          response = await socialShareService.shareStreak(platform, data.streak_days || 0)
          break
        case 'quiz_score':
          response = await socialShareService.shareQuizScore(
            platform,
            data.score || 0,
            data.total_questions || 0,
            data.quiz_title
          )
          break
        case 'level_up':
          response = await socialShareService.shareLevel(platform, data.level || 1)
          break
        case 'league_promotion':
          response = await socialShareService.shareLeaguePromotion(
            platform,
            data.new_tier || 'bronze',
            data.previous_tier || 'bronze'
          )
          break
        case 'weekly_stats':
          response = await socialShareService.shareWeeklyStats(platform, {
            xp_earned: data.xp_earned || 0,
            study_time_minutes: data.study_time_minutes || 0,
            quizzes_completed: data.quizzes_completed || 0,
            notes_created: data.notes_created || 0
          })
          break
        default:
          response = await socialShareService.createShare({
            share_type: shareType,
            platform,
            content_data: data
          })
      }

      setLastShareResult(response)
      setXpEarned(prev => prev + response.xp_earned)

      // Ouvrir le lien de partage ou copier
      if (platform === 'copy') {
        const success = await socialShareService.copyToClipboard(response.share_url)
        if (success) {
          setCopied(true)
          toast.success('Lien copié dans le presse-papier !')
          setTimeout(() => setCopied(false), 2000)
        }
      } else {
        socialShareService.openShareWindow(response.share_url, platform)
        toast.success(`+${response.xp_earned} XP pour le partage !`)
      }
    } catch (error) {
      console.error('Erreur de partage:', error)
      toast.error('Erreur lors du partage')
    } finally {
      setIsLoading(false)
      setLoadingPlatform(null)
    }
  }

  // Essayer le partage natif du navigateur
  const handleNativeShare = async () => {
    if (!socialShareService.isNativeShareAvailable()) {
      toast.error('Partage natif non disponible')
      return
    }

    try {
      const response = await socialShareService.createShare({
        share_type: shareType,
        platform: 'other',
        content_data: data
      })

      const success = await socialShareService.nativeShare({
        title: title,
        text: response.message,
        url: response.share_url
      })

      if (success) {
        setXpEarned(prev => prev + response.xp_earned)
        toast.success(`+${response.xp_earned} XP pour le partage !`)
      }
    } catch (error) {
      toast.error('Erreur lors du partage')
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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              {/* Header avec gradient */}
              <div className={`bg-gradient-to-r ${config.gradient} px-6 py-5 text-white relative overflow-hidden`}>
                {/* Effet décoratif */}
                <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }} />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{config.icon}</span>
                    <div>
                      <h2 className="text-xl font-bold">{title}</h2>
                      {subtitle && <p className="text-white/80 text-sm">{subtitle}</p>}
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/20 rounded-xl transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* XP gagné */}
                {xpEarned > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-medium">+{xpEarned} XP gagnés !</span>
                  </motion.div>
                )}
              </div>

              {/* Contenu */}
              <div className="p-6 space-y-6">
                {/* Message d'incitation */}
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-300">
                    Partagez votre progression et gagnez des <span className="font-bold text-purple-600">+10 XP</span> par partage !
                  </p>
                </div>

                {/* Boutons de partage */}
                <div className="grid grid-cols-3 gap-3">
                  {PLATFORMS.map((platform) => (
                    <motion.button
                      key={platform.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleShare(platform.id)}
                      disabled={isLoading}
                      className={`flex flex-col items-center gap-2 p-4 ${platform.bgColor} ${platform.hoverColor} text-white rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {loadingPlatform === platform.id ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : platform.id === 'copy' && copied ? (
                        <Check className="w-6 h-6" />
                      ) : (
                        platform.icon
                      )}
                      <span className="text-xs font-medium">{platform.name}</span>
                    </motion.button>
                  ))}
                </div>

                {/* Bouton partage natif (si disponible) */}
                {socialShareService.isNativeShareAvailable() && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleNativeShare}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl transition font-medium"
                  >
                    <Share2 className="w-5 h-5" />
                    Autres options de partage
                  </motion.button>
                )}

                {/* Dernier lien partagé */}
                {lastShareResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Link2 className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Dernier lien partagé
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-300 truncate border border-gray-200 dark:border-gray-600">
                        {lastShareResult.share_url}
                      </div>
                      <button
                        onClick={() => handleShare('copy')}
                        className="px-3 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg transition"
                      >
                        <Copy className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Astuce */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Astuce :</strong> Plus tu partages, plus tu débloques de badges et gagnes d'XP bonus !
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default ShareModal
