'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/contexts/LanguageContext'

interface Reaction {
  emoji: string
  label: string
  color: string
}

interface FloatingReaction {
  id: number
  emoji: string
  x: number
  fromUser?: string
}

interface QuickReactionsProps {
  onReact?: (emoji: string) => void
  incomingReaction?: { emoji: string; fromUser: string } | null
  className?: string
}

export default function QuickReactions({ onReact, incomingReaction, className }: QuickReactionsProps) {
  const { t } = useTranslation()
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([])
  const [lastClicked, setLastClicked] = useState<string | null>(null)

  const REACTIONS: Reaction[] = [
    { emoji: '👏', label: t('focusRoom.reactions.bravo'), color: 'from-yellow-400 to-yellow-500' },
    { emoji: '🔥', label: t('focusRoom.reactions.fire'), color: 'from-orange-500 to-red-500' },
    { emoji: '💪', label: t('focusRoom.reactions.strength'), color: 'from-blue-500 to-blue-600' },
    { emoji: '❤️', label: t('focusRoom.reactions.heart'), color: 'from-pink-500 to-rose-500' },
    { emoji: '🚀', label: t('focusRoom.reactions.rocket'), color: 'from-purple-500 to-purple-600' },
    { emoji: '⭐', label: t('focusRoom.reactions.star'), color: 'from-amber-400 to-yellow-500' },
    { emoji: '🎯', label: t('focusRoom.reactions.focus'), color: 'from-green-500 to-emerald-500' },
    { emoji: '☕', label: t('focusRoom.reactions.coffee'), color: 'from-amber-600 to-amber-700' },
  ]

  // Handle incoming reactions from other users
  useEffect(() => {
    if (incomingReaction) {
      addFloatingReaction(incomingReaction.emoji, incomingReaction.fromUser)
    }
  }, [incomingReaction])

  const addFloatingReaction = (emoji: string, fromUser?: string) => {
    const id = Date.now() + Math.random()
    const x = Math.random() * 80 + 10 // Random position 10-90%

    setFloatingReactions(prev => [...prev, { id, emoji, x, fromUser }])

    // Remove after animation
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id))
    }, 3000)
  }

  const handleReaction = (reaction: Reaction) => {
    setLastClicked(reaction.emoji)
    setTimeout(() => setLastClicked(null), 200)

    addFloatingReaction(reaction.emoji)
    onReact?.(reaction.emoji)

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50)
    }
  }

  return (
    <div className={cn("relative", className)}>
      {/* Floating Reactions Animation */}
      <div className="absolute inset-x-0 bottom-full h-64 pointer-events-none overflow-hidden">
        <AnimatePresence>
          {floatingReactions.map(reaction => (
            <motion.div
              key={reaction.id}
              initial={{ y: 0, opacity: 1, scale: 0.5 }}
              animate={{ y: -200, opacity: 0, scale: 1.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5, ease: "easeOut" }}
              className="absolute bottom-0"
              style={{ left: `${reaction.x}%` }}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl">{reaction.emoji}</span>
                {reaction.fromUser && (
                  <span className="text-xs text-white bg-black/50 px-2 py-0.5 rounded-full mt-1">
                    {reaction.fromUser}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Reactions Bar */}
      <div className="flex items-center gap-1 bg-gray-800/80 backdrop-blur-sm rounded-2xl p-2 border border-gray-700">
        {REACTIONS.map(reaction => (
          <button
            key={reaction.emoji}
            onClick={() => handleReaction(reaction)}
            className={cn(
              "relative p-2 rounded-xl transition-all duration-150 hover:scale-110 active:scale-95",
              "hover:bg-gray-700",
              lastClicked === reaction.emoji && "scale-125"
            )}
            title={reaction.label}
          >
            <span className="text-2xl">{reaction.emoji}</span>

            {/* Click effect */}
            {lastClicked === reaction.emoji && (
              <motion.div
                initial={{ scale: 0.5, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "absolute inset-0 rounded-xl bg-gradient-to-r",
                  reaction.color
                )}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
