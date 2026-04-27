'use client'

import { useState, useEffect, useMemo } from 'react'
import { Flame, Zap, Trophy, Star, Gift } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/contexts/LanguageContext'

interface StreakTrackerProps {
  focusMinutes: number
  isActive: boolean
  onMilestone?: (milestone: string) => void
  className?: string
}

interface Milestone {
  minutes: number
  label: string
  emoji: string
  xpBonus: number
  color: string
}

interface Achievement {
  id: number
  milestone: Milestone
  timestamp: number
}

export default function StreakTracker({ focusMinutes, isActive, onMilestone, className }: StreakTrackerProps) {
  const { t } = useTranslation()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [showCelebration, setShowCelebration] = useState<Milestone | null>(null)
  const [lastMilestoneIndex, setLastMilestoneIndex] = useState(-1)

  const MILESTONES: Milestone[] = useMemo(() => [
    { minutes: 15, label: '15 min', emoji: '🌱', xpBonus: 10, color: 'from-green-400 to-green-500' },
    { minutes: 30, label: '30 min', emoji: '🌟', xpBonus: 25, color: 'from-yellow-400 to-yellow-500' },
    { minutes: 45, label: '45 min', emoji: '💫', xpBonus: 40, color: 'from-amber-400 to-orange-500' },
    { minutes: 60, label: t('focusRoom.streak.dur1h'), emoji: '⭐', xpBonus: 60, color: 'from-orange-500 to-red-500' },
    { minutes: 90, label: t('focusRoom.streak.dur1h30'), emoji: '🔥', xpBonus: 100, color: 'from-red-500 to-pink-500' },
    { minutes: 120, label: t('focusRoom.streak.dur2h'), emoji: '💎', xpBonus: 150, color: 'from-purple-500 to-purple-600' },
    { minutes: 180, label: t('focusRoom.streak.dur3h'), emoji: '🏆', xpBonus: 250, color: 'from-yellow-500 to-amber-600' },
    { minutes: 240, label: t('focusRoom.streak.dur4h'), emoji: '👑', xpBonus: 400, color: 'from-amber-500 to-yellow-400' },
  ], [t])

  // Check for new milestones
  useEffect(() => {
    const currentMilestoneIndex = MILESTONES.findIndex(m => focusMinutes < m.minutes)
    const actualIndex = currentMilestoneIndex === -1 ? MILESTONES.length - 1 : currentMilestoneIndex - 1

    if (actualIndex > lastMilestoneIndex && actualIndex >= 0) {
      const newMilestone = MILESTONES[actualIndex]

      // Trigger celebration
      setShowCelebration(newMilestone)
      setAchievements(prev => [...prev, {
        id: Date.now(),
        milestone: newMilestone,
        timestamp: Date.now()
      }])

      onMilestone?.(newMilestone.label)
      setLastMilestoneIndex(actualIndex)

      // Play sound
      const audio = new Audio('/sounds/achievement.mp3')
      audio.play().catch(() => {})

      // Hide celebration after 5 seconds
      setTimeout(() => setShowCelebration(null), 5000)
    }
  }, [focusMinutes, lastMilestoneIndex, onMilestone])

  // Get current streak level
  const currentMilestone = MILESTONES.filter(m => focusMinutes >= m.minutes).pop()
  const nextMilestone = MILESTONES.find(m => focusMinutes < m.minutes)
  const progress = nextMilestone
    ? ((focusMinutes - (currentMilestone?.minutes || 0)) / (nextMilestone.minutes - (currentMilestone?.minutes || 0))) * 100
    : 100

  const streakLevel = MILESTONES.filter(m => focusMinutes >= m.minutes).length

  return (
    <div className={cn("relative", className)}>
      {/* Celebration Overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              className="text-center"
            >
              {/* Confetti effect */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(30)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{
                      y: -20,
                      x: Math.random() * 400 - 200,
                      rotate: 0,
                      opacity: 1
                    }}
                    animate={{
                      y: 400,
                      rotate: Math.random() * 360,
                      opacity: 0
                    }}
                    transition={{
                      duration: 2 + Math.random(),
                      delay: Math.random() * 0.5
                    }}
                    className="absolute text-2xl"
                    style={{ left: `${Math.random() * 100}%` }}
                  >
                    {['🎉', '✨', '⭐', '🎊', '💫'][Math.floor(Math.random() * 5)]}
                  </motion.div>
                ))}
              </div>

              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: 3 }}
                className="text-8xl block mb-4"
              >
                {showCelebration.emoji}
              </motion.span>

              <h2 className="text-3xl font-bold text-white mb-2">
                {t('focusRoom.streak.milestoneReached')}
              </h2>
              <p className="text-xl text-gray-300 mb-4">
                {showCelebration.label} {t('focusRoom.streak.ofFocus')}
              </p>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  "inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-bold",
                  `bg-gradient-to-r ${showCelebration.color}`
                )}
              >
                <Gift className="h-5 w-5" />
                +{showCelebration.xpBonus} {t('focusRoom.streak.xpBonus')}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streak Display */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-4 border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-2 rounded-lg",
              isActive ? "bg-orange-500/20" : "bg-gray-700"
            )}>
              <Flame className={cn(
                "h-5 w-5",
                isActive ? "text-orange-500 animate-pulse" : "text-gray-500"
              )} />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{t('focusRoom.streak.title')}</p>
              <p className="text-xs text-gray-400">{t('focusRoom.streak.level')} {streakLevel}</p>
            </div>
          </div>

          {currentMilestone && (
            <span className="text-2xl">{currentMilestone.emoji}</span>
          )}
        </div>

        {/* Progress to next milestone */}
        {nextMilestone && (
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">
                {currentMilestone?.label || '0 min'}
              </span>
              <span className="text-gray-400">
                {nextMilestone.emoji} {nextMilestone.label}
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
                className={cn(
                  "h-full rounded-full bg-gradient-to-r",
                  nextMilestone.color
                )}
              />
            </div>
            <p className="text-xs text-center text-gray-400">
              {t('focusRoom.streak.moreMinFor', { minutes: nextMilestone.minutes - focusMinutes, milestone: nextMilestone.label })}
            </p>
          </div>
        )}

        {/* Milestones achieved */}
        <div className="flex flex-wrap gap-2">
          {MILESTONES.map((milestone, index) => {
            const achieved = focusMinutes >= milestone.minutes
            return (
              <div
                key={milestone.minutes}
                className={cn(
                  "px-2 py-1 rounded-full text-xs font-medium transition-all",
                  achieved
                    ? `bg-gradient-to-r ${milestone.color} text-white`
                    : "bg-gray-700 text-gray-500"
                )}
              >
                {milestone.emoji} {milestone.label}
              </div>
            )
          })}
        </div>

        {/* Streak incentive message */}
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              <p className="text-sm text-orange-300">
                {nextMilestone
                  ? t('focusRoom.streak.continueBonus', { xp: nextMilestone.xpBonus, minutes: nextMilestone.minutes - focusMinutes })
                  : t('focusRoom.streak.allMilestones') + ' 👑'
                }
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
